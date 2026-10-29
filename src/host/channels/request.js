export function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

const ERROR_HINTS = {
  unsupported_parameter: '该模型不接受这个字段，去掉后重试',
  model_not_found: '模型 id 不在当前密钥的目录里',
  model_not_authorized: '当前密钥未开通这个模型',
  invalid_request: '请求字段或取值不合法',
  invalid_prompt: '提示词为空或超过长度限制',
  content_review_failed: '提示词或参考素材未通过内容审核',
  rate_limited: '触发限流，退避后重试',
  insufficient_quota: '额度不足',
  task_not_cancelable: '任务已开始生成，不能取消',
  task_not_found: '任务 id 不存在或已过期',
  media_request_too_large: '请求体超过 4 MiB，减少或压缩参考素材',
};

export function platformError(status, data) {
  const detail = data && typeof data === 'object' ? data.error : undefined;
  const message = detail && typeof detail === 'object' && typeof detail.message === 'string' ? detail.message : undefined;
  const code = detail && typeof detail === 'object' && typeof detail.code === 'string' ? detail.code : undefined;
  const stage = detail && typeof detail === 'object' && typeof detail.stage === 'string' ? detail.stage : undefined;
  const parts = [`HTTP ${status}`];
  if (code) parts.push(code);
  if (stage) parts.push(`(${stage})`);
  const body = message ?? (data && typeof data === 'object' ? JSON.stringify(data).slice(0, 400) : undefined);
  const hint = code && ERROR_HINTS[code] ? `（${ERROR_HINTS[code]}）` : '';
  return Object.assign(new Error(parts.join(' ') + (body ? `: ${body}` : '') + hint), { httpStatus: status, code });
}

export function compact(source) {
  const out = {};
  if (source === null || typeof source !== 'object') return out;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export async function request(channel, path, { method = 'GET', body, idempotencyKey, timeoutMs = 120000, retries = 2, signal } = {}) {
  const headers = { Authorization: `Bearer ${channel.apiKey}`, Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    let response;
    try {
      response = await fetch(channel.baseUrl + path, {
        method,
        headers,
        body: payload,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      signal?.throwIfAborted();
      if (attempt < retries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
      throw new Error(`${channel.name} ${method} ${path} failed: ${messageOf(error)}`);
    }
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await sleep(800 * (attempt + 1));
      continue;
    }
    const text = await response.text();
    const data = parseBody(text);
    if (!response.ok) throw platformError(response.status, data);
    return data;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
