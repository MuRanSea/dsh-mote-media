/**
 * One client per plugin instance. Browser access is deferred until a request;
 * endpoint discovery and the last working endpoint belong to this module.
 */
export function createHostClient({
  fetch: fetchRequest = (...args) => window.fetch(...args),
  getBaseURI = () => document.baseURI,
  getOrigin = () => window.location.origin,
} = {}) {
  let activeEndpoint = null;

  function endpointCandidates() {
    const out = [];
    if (activeEndpoint) out.push(activeEndpoint);
    try {
      const base = getBaseURI() || '';
      if (base.endsWith('/')) out.push(new URL('api/mote-media', base).href);
    } catch {
      /* fall through */
    }
    out.push(`${getOrigin()}/api/mote-media`);
    out.push('/api/mote-media');
    return out.filter((url, index) => out.indexOf(url) === index);
  }

  async function call(action, payload) {
    const paid = action === 'generate';
    const unknown = (message) => Object.assign(new Error(message), { code: 'submission_unknown', submissionUnknown: true });
    const body = JSON.stringify({ action, ...(payload || {}) });
    let lastError = null;
    for (const url of endpointCandidates()) {
      let response;
      try {
        response = await fetchRequest(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          credentials: 'same-origin',
        });
      } catch (cause) {
        lastError = new Error(`${url} · ${cause instanceof Error ? cause.message : String(cause)}`);
        if (paid) throw unknown(lastError.message);
        continue;
      }
      let text;
      try { text = await response.text(); }
      catch (error) { if (paid) throw unknown(error.message); throw error; }
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      if (data === null) {
        lastError = new Error(`HTTP ${response.status} ${response.statusText || ''} @ ${url} · ${text.slice(0, 160)}`);
        if (paid) throw unknown(lastError.message);
        if (response.status === 404) continue;
        throw lastError;
      }
      activeEndpoint = url;
      if (data.ok !== true) throw Object.assign(new Error(data.error?.message || 'request failed'), {
        code: data.error?.code, submissionUnknown: paid && data.error?.submissionUnknown === true,
      });
      return data;
    }
    throw lastError || new Error('no endpoint answered');
  }

  return { call };
}
