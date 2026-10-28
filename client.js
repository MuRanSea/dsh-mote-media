/**
 * Browser half of the mote media plugin — a 即梦-style creation page.
 *
 * Layout follows 即梦's design: a dark stage, a centred greeting over a large
 * composer card (upload slot on the left, prompt in the middle, a bottom bar
 * with 创作类型 / model / ratio / quality and a round send button), inspiration
 * chips and mode cards underneath, and — once there are works — the same page
 * turns into a "我的作品" grid.
 *
 * All upstream work stays in the Host half (`/api/mote-media`).
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-mote-media',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef, useCallback } = React;

    /* ------------------------------------------------------------------ */
    /* Dictionaries                                                        */
    /* ------------------------------------------------------------------ */

    const ZH = {
      panelLabel: 'mote 创作台',
      brand: 'mote 创作台',
      connected: '已连接',
      notConfigured: '未配置渠道',
      greeting: '你好，今天想创作什么？',
      modeImage: '图片生成',
      modeVideo: '视频生成',
      generateSwitch: '生成',
      canvasSwitch: '画布',
      promptPlaceholder: '输入想法、剧本或上传参考图，描述你想要的画面',
      typeLabel: '创作类型',
      modelLabel: '模型',
      ratioLabel: '比例',
      qualityLabel: '清晰度',
      countLabel: '张数',
      durationLabel: '时长',
      audioLabel: '声音',
      modeLabel: '模式',
      auto: '自动',
      send: '生成',
      uploading: '参考图太大（超过 2 MB），请压缩后再试',
      refsFull: '参考图数量已达该模型上限',
      framesFull: '首帧/尾帧已放满',
      inspirationTitle: '提示词灵感',
      inspirations: [
        '白色背景上的金属质感耳机，柔和棚拍光，产品摄影',
        '黄昏街头的女孩侧脸，胶片颗粒，85mm 浅景深',
        '雨夜霓虹的中式老街，湿润地面反光，电影感',
        '一只纸船漂过安静的河面，固定机位，清晨微光',
      ],
      cardTextToImage: '文生图',
      cardTextToImageDesc: '只写提示词，Seedream / Gemini / GPT Image',
      cardImageToImage: '参考图生图',
      cardImageToImageDesc: '上传参考图，改颜色、换风格、做融合',
      cardTextToVideo: '文生视频',
      cardTextToVideoDesc: 'Seedance / 可灵 / MiniMax，可带声音',
      cardFrames: '首尾帧生视频',
      cardFramesDesc: '给首帧和尾帧，让模特转身或花苞绽放',
      gallery: '我的作品',
      empty: '还没有作品。写一句提示词，按右侧的生成键。',
      clearFinished: '清理已结束',
      preview: '预览',
      download: '保存到本地',
      reuse: '用作参考',
      reuseFirst: '用作首帧',
      reuseLast: '用作尾帧',
      remove: '删除',
      open: '新窗口打开',
      saved: '已保存',
      files: '个文件 →',
      queued: '排队中',
      running: '生成中',
      succeeded: '已完成',
      failed: '失败',
      reconciling: '核对中',
      cancelled: '已取消',
      task: '任务',
      cost: '费用',
      createdAt: '生成于',
      close: '关闭',
      settingsTitle: '渠道设置',
      channels: '渠道',
      addChannel: '＋ 添加渠道',
      noChannel: '还没有渠道。点「＋ 添加渠道」，mote 渠道填地址和密钥即可。',
      channelName: '名称（如 主渠道 / 备用）',
      channelBase: '接口地址，如 https://platform.sgt.site',
      channelKey: '虚拟密钥 / API Key',
      channelModels: '模型列表，逗号分隔；点「自动获取」直接从该渠道拉取',
      channelModelsMote: 'mote 渠道留空即可，目录自动读取；也可「自动获取」后固定下来',
      autoFetch: '自动获取',
      probing: '获取中…',
      probeOk: '已获取',
      modelAuto: '自动（渠道首个可用）',
      deleteChannel: '删除渠道',
      channelsHint: 'mote 统一渠道自带图片、视频与模型目录；OpenAI 兼容渠道用于接入自建的 /v1/images/generations。模型按渠道分组，生成自动走模型所属渠道。',
      channelReady: '已配置密钥',
      channelNoKey: '尚未填密钥',
      imageModel: '默认图片模型',
      videoModel: '默认视频模型',
      outputDir: '下载目录（留空用 Pictures\\mote-media）',
      save: '保存',
      saving: '保存中…',
      testSave: '保存并测试',
      testing: '测试中…',
      testOk: '连接成功',
      modelsCount: '个可用模型',
      needKey: '先在「渠道设置」里填虚拟密钥。',
      routeDown: '面板路由未注册，浏览器打到的是：',
      noModel: '该渠道下没有可用模型',
      references: '参考图',
      firstFrame: '首帧',
      lastFrame: '尾帧',
      countSuffix: '张',
      secondsSuffix: '秒',
      on: '开',
      off: '关',
      removeRef: '移除',
      expiring: '签名链接即将过期，先保存到本地',
      retry: '重试',
      retrySubmitted: '已用新的幂等键重新提交',
      retryHint: '可重试：稍后重试原操作，不要重新生成',
      copyDiag: '复制诊断信息',
      diagCopied: '诊断信息已复制到剪贴板',
      requestId: '请求 ID',
      errorCode: '错误码',
      errorStage: '出错环节',
      retryable: '可重试',
      retryableYes: '可重试',
      retryableNo: '不可重试',
      inlinedRefs: '张局域网参考已内联为 base64',
    };

    const EN = {
      panelLabel: 'mote Studio',
      brand: 'mote Studio',
      connected: 'Connected',
      notConfigured: 'No channel',
      greeting: 'What shall we create today?',
      modeImage: 'Image',
      modeVideo: 'Video',
      generateSwitch: 'Generate',
      canvasSwitch: 'Canvas',
      promptPlaceholder: 'Describe an idea, a script, or upload a reference',
      typeLabel: 'Type',
      modelLabel: 'Model',
      ratioLabel: 'Ratio',
      qualityLabel: 'Quality',
      countLabel: 'Count',
      durationLabel: 'Duration',
      audioLabel: 'Audio',
      modeLabel: 'Mode',
      auto: 'Auto',
      send: 'Generate',
      uploading: 'Reference image is larger than 2 MB; compress it first',
      refsFull: 'This model’s reference limit is reached',
      framesFull: 'First and last frame are both taken',
      inspirationTitle: 'Ideas',
      inspirations: [
        'Metal headphones on a white backdrop, soft studio light, product shot',
        'A girl in profile at dusk, film grain, 85mm shallow depth of field',
        'A rainy neon-lit Chinese street at night, wet reflections, cinematic',
        'A paper boat drifting on a quiet river, fixed camera, early light',
      ],
      cardTextToImage: 'Text to image',
      cardTextToImageDesc: 'Prompt only — Seedream / Gemini / GPT Image',
      cardImageToImage: 'Image to image',
      cardImageToImageDesc: 'Upload a reference to recolour, restyle or blend',
      cardTextToVideo: 'Text to video',
      cardTextToVideoDesc: 'Seedance / Kling / MiniMax, with sound',
      cardFrames: 'First–last frame video',
      cardFramesDesc: 'Give both frames: a turn, a bloom, a reveal',
      gallery: 'My creations',
      empty: 'Nothing yet. Write a prompt and press the send button.',
      clearFinished: 'Clear finished',
      preview: 'Preview',
      download: 'Save locally',
      reuse: 'Use as reference',
      reuseFirst: 'Use as first frame',
      reuseLast: 'Use as last frame',
      remove: 'Delete',
      open: 'Open in new window',
      saved: 'Saved',
      files: 'file(s) →',
      queued: 'Queued',
      running: 'Running',
      succeeded: 'Done',
      failed: 'Failed',
      reconciling: 'Reconciling',
      cancelled: 'Cancelled',
      task: 'Task',
      cost: 'Cost',
      createdAt: 'Created',
      close: 'Close',
      settingsTitle: 'Channel settings',
      channels: 'Channels',
      addChannel: '＋ Add channel',
      noChannel: 'No channel yet. Add one: a mote channel needs only its address and key.',
      channelName: 'Name (e.g. primary / backup)',
      channelBase: 'Base URL, e.g. https://platform.sgt.site',
      channelKey: 'Virtual key / API key',
      channelModels: 'Model ids, comma separated; press Auto fetch to read them from the channel',
      channelModelsMote: 'mote channels read the catalog automatically; Auto fetch pins a subset',
      autoFetch: 'Auto fetch',
      probing: 'Fetching…',
      probeOk: 'Fetched',
      modelAuto: 'Auto (first available)',
      deleteChannel: 'Remove channel',
      channelsHint: 'A mote channel brings images, videos and its own catalog; an OpenAI-compatible channel reaches any /v1/images/generations endpoint. Models are grouped by channel and a run routes to the channel that owns the model.',
      channelReady: 'Key configured',
      channelNoKey: 'No key yet',
      imageModel: 'Default image model',
      videoModel: 'Default video model',
      outputDir: 'Download directory (empty = Pictures\\mote-media)',
      save: 'Save',
      saving: 'Saving…',
      testSave: 'Save & test',
      testing: 'Testing…',
      testOk: 'Connected',
      modelsCount: 'available models',
      needKey: 'Set the virtual key in Channel settings first.',
      routeDown: 'Panel route is not registered; the request went to:',
      noModel: 'This channel exposes no usable model',
      references: 'References',
      firstFrame: 'First frame',
      lastFrame: 'Last frame',
      countSuffix: '',
      secondsSuffix: 's',
      on: 'On',
      off: 'Off',
      removeRef: 'Remove',
      expiring: 'Signed link expires soon; save it locally',
      retry: 'Retry',
      retrySubmitted: 'Resubmitted with a fresh idempotency key',
      retryHint: 'Retryable: retry the same operation later; do not regenerate',
      copyDiag: 'Copy diagnostics',
      diagCopied: 'Diagnostics copied',
      requestId: 'Request id',
      errorCode: 'Error code',
      errorStage: 'Stage',
      retryable: 'Retryable',
      retryableYes: 'retryable',
      retryableNo: 'not retryable',
      inlinedRefs: 'LAN reference(s) inlined as base64',
    };

    let t = (key) => EN[key] ?? key;
    let IDEAS = EN.inspirations;

    /* ------------------------------------------------------------------ */
    /* Host route                                                          */
    /* ------------------------------------------------------------------ */

    let activeEndpoint = null;

    function endpointCandidates() {
      const out = [];
      if (activeEndpoint) out.push(activeEndpoint);
      try {
        const base = document.baseURI || '';
        if (base.endsWith('/')) out.push(new URL('api/mote-media', base).href);
      } catch {
        /* fall through */
      }
      out.push(`${window.location.origin}/api/mote-media`);
      out.push('/api/mote-media');
      return out.filter((url, index) => out.indexOf(url) === index);
    }

    async function call(action, payload) {
      const body = JSON.stringify({ action, ...(payload || {}) });
      let lastError = null;
      for (const url of endpointCandidates()) {
        let response;
        try {
          response = await window.fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            credentials: 'same-origin',
          });
        } catch (cause) {
          lastError = new Error(`${url} · ${cause instanceof Error ? cause.message : String(cause)}`);
          continue;
        }
        const text = await response.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        if (data === null) {
          lastError = new Error(`HTTP ${response.status} ${response.statusText || ''} @ ${url} · ${text.slice(0, 160)}`);
          if (response.status === 404) continue;
          throw lastError;
        }
        activeEndpoint = url;
        if (data.ok !== true) throw new Error(data.error && data.error.message ? data.error.message : 'request failed');
        return data;
      }
      throw lastError || new Error('no endpoint answered');
    }

    /* ------------------------------------------------------------------ */
    /* Store and helpers                                                   */
    /* ------------------------------------------------------------------ */

    const STORE_KEY = 'mote-media.studio.v1';
    const PENDING = new Set(['queued', 'running', 'reconciling']);
    const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;

    function loadItems() {
      try {
        const raw = window.localStorage.getItem(STORE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item) => item && typeof item.id === 'string' && (item.type === 'image' || item.type === 'video'));
      } catch {
        return [];
      }
    }

    function newId() {
      return `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    const isPending = (item) => PENDING.has(item.status);

    function statusLabel(status) {
      if (status === 'queued') return t('queued');
      if (status === 'running') return t('running');
      if (status === 'succeeded') return t('succeeded');
      if (status === 'failed') return t('failed');
      if (status === 'reconciling') return t('reconciling');
      if (status === 'cancelled') return t('cancelled');
      return status || '';
    }

    /**
     * A task returns the product plus, for videos, a `cover` and a `last_frame`.
     * Pick by the card's own medium so a video tile never shows its poster.
     */
    const ASSET = '/api/mote-media/asset';

    /** Same classification as the Host: loopback, LAN, and CGNAT addresses. */
    function isNonPublicUrl(value) {
      if (typeof value !== 'string' || value === '' || value.startsWith('data:')) return false;
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        return false;
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (host === '' || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
      if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
      const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
      if (v4) {
        const a = Number(v4[1]);
        const b = Number(v4[2]);
        return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
      }
      return /^(fc|fd|fe8|fe9|fea|feb)/.test(host);
    }

    function primaryMedia(item) {
      const artifacts = Array.isArray(item.artifacts) ? item.artifacts : [];
      const usable = artifacts.filter(
        (artifact) => artifact && artifact.state === 'available' && typeof artifact.url === 'string',
      );
      if (usable.length === 0) return null;
      const wanted = item.type === 'video' ? 'video' : 'image';
      const picked =
        usable.find((artifact) => artifact.kind === wanted) ||
        usable.find((artifact) => artifact.kind === 'image') ||
        usable[0];
      const video =
        picked.kind === 'video' || (typeof picked.mimeType === 'string' && picked.mimeType.startsWith('video/'));
      const expiry = typeof picked.expiresAt === 'string' ? Date.parse(picked.expiresAt) : NaN;
      // A LAN artifact is fetched by the Host and streamed back, so the page does
      // not need to reach the gateway's private address.
      const display = isNonPublicUrl(picked.url) ? `${ASSET}?url=${encodeURIComponent(picked.url)}` : picked.url;
      return { url: display, source: picked.url, video, expiresAt: Number.isFinite(expiry) ? expiry : null };
    }

    /** Everything support asks for when a task fails without a captured reason. */
    function diagnosticsOf(item) {
      return JSON.stringify(
        {
          type: item.type,
          model: item.model,
          task: item.taskId || null,
          request: item.requestId || null,
          status: item.status,
          error: item.error || null,
          billing: item.billing || null,
          prompt: item.prompt || '',
          params: item.params || {},
        },
        null,
        2,
      );
    }

    function formatTime(value) {
      if (!Number.isFinite(value)) return '';
      try {
        return new Date(value).toLocaleString();
      } catch {
        return '';
      }
    }

    function modelChoices(models, type) {
      return Array.isArray(models[type]) ? models[type] : [];
    }

    function modelById(models, type, id) {
      return modelChoices(models, type).find((entry) => entry.id === id) || null;
    }

    function paramEntries(model) {
      const parameters = model && model.parameters && typeof model.parameters === 'object' ? model.parameters : {};
      return Object.entries(parameters).filter(([key]) => key !== 'prompt');
    }

    function defaultParams(model) {
      const out = {};
      for (const [key, spec] of paramEntries(model)) {
        if (spec && spec.default !== undefined && spec.default !== null) out[key] = spec.default;
      }
      return out;
    }

    /** Ratio to pixel size for models that accept `size` but no `aspect_ratio` (GPT Image). */
    const SIZE_BY_RATIO = {
      '1:1': '1024x1024',
      '4:3': '1152x864',
      '3:4': '864x1152',
      '16:9': '1536x864',
      '9:16': '864x1536',
      '3:2': '1536x1024',
      '2:3': '1024x1536',
      '21:9': '1792x768',
    };

    function ratioToSize(ratio) {
      return SIZE_BY_RATIO[ratio] || '';
    }

    function sizeToRatio(size) {
      if (typeof size !== 'string' || size === '' || size === 'auto') return '';
      const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
      if (!match) return '';
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (!width || !height) return '';
      const target = width / height;
      let best = '';
      let distance = Infinity;
      for (const [ratio, pixels] of Object.entries(SIZE_BY_RATIO)) {
        const [w, h] = pixels.split('x').map(Number);
        const gap = Math.abs(w / h - target);
        if (gap < distance) {
          distance = gap;
          best = ratio;
        }
      }
      return best;
    }

    /**
     * Keep only the parameters this model actually declares. A stale field from a
     * previous model (for example `aspect_ratio` on GPT Image) is dropped instead
     * of being rejected upstream with `unsupported_parameter`.
     */
    function paramsForModel(model, params) {
      const specs = model && model.parameters && typeof model.parameters === 'object' ? model.parameters : {};
      // Drop undeclared keys first: a leftover `size` from another model must not
      // take a valid `aspect_ratio` down with it in the conflict pass below.
      const out = {};
      for (const [key, value] of Object.entries(params || {})) {
        if (value === '' || value === undefined || value === null) continue;
        if (!specs[key]) continue;
        out[key] = value;
      }
      if (out.size !== undefined) {
        if (out.aspect_ratio !== undefined) delete out.aspect_ratio;
        if (out.size === out.resolution) delete out.resolution;
      }
      return out;
    }

    function cleanParams(params) {
      const out = {};
      for (const [key, value] of Object.entries(params || {})) {
        if (value === '' || value === undefined || value === null) continue;
        out[key] = value;
      }
      if (out.size !== undefined) {
        if (out.aspect_ratio !== undefined) delete out.aspect_ratio;
        if (out.size === out.resolution) delete out.resolution;
      }
      return out;
    }

    function referenceRoles(model) {
      const specs = model && Array.isArray(model.references) ? model.references : [];
      const limitFor = (role, kind = 'image') => {
        const spec = specs.find((entry) => entry && entry.role === role && Array.isArray(entry.types) && entry.types.includes(kind));
        return spec ? Number(spec.max_count ?? 1) : 0;
      };
      return {
        reference: limitFor('reference', 'image') > 0,
        referenceLimit: limitFor('reference', 'image'),
        firstFrame: limitFor('first_frame', 'image') > 0,
        lastFrame: limitFor('last_frame', 'image') > 0,
      };
    }

    function readFileAsDataUrl(file, onLoad, onError) {
      if (file.size > MAX_REFERENCE_BYTES) {
        onError(t('uploading'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onLoad(String(reader.result || ''));
      reader.onerror = () => onError('cannot read the file');
      reader.readAsDataURL(file);
    }

    /* ------------------------------------------------------------------ */
    /* Popover menu                                                        */
    /* ------------------------------------------------------------------ */

    /**
     * Popover anchored to its chip. It is positioned `fixed` and measured against
     * the viewport, because a dropdown inside the scrolling stage would otherwise
     * be clipped at the top (or bottom) of the scroll box.
     */
    function Menu({ label, value, current, items, onPick, width }) {
      const [open, setOpen] = useState(false);
      const [placement, setPlacement] = useState(null);
      const boxRef = useRef(null);
      const anchorRef = useRef(null);

      useEffect(() => {
        if (!open) return undefined;
        const onDown = (event) => {
          if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
        };
        const onScroll = (event) => {
          // Scrolling the list itself must not dismiss it; any outer scroll does.
          if (boxRef.current && event && event.target instanceof Node && boxRef.current.contains(event.target)) return;
          setOpen(false);
        };
        window.addEventListener('pointerdown', onDown);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
          window.removeEventListener('pointerdown', onDown);
          window.removeEventListener('scroll', onScroll, true);
          window.removeEventListener('resize', onScroll);
        };
      }, [open]);

      const openMenu = () => {
        const rect = anchorRef.current ? anchorRef.current.getBoundingClientRect() : null;
        if (!rect) {
          setOpen((wasOpen) => !wasOpen);
          return;
        }
        const margin = 10;
        const spaceAbove = rect.top - margin;
        const spaceBelow = window.innerHeight - rect.bottom - margin;
        const upward = spaceAbove >= 200 || spaceAbove >= spaceBelow;
        const room = Math.max(140, Math.min(360, upward ? spaceAbove : spaceBelow));
        setPlacement({
          left: Math.min(rect.left, Math.max(margin, window.innerWidth - Math.max(rect.width, width || 0) - margin)),
          width: Math.max(rect.width, width || 0),
          maxHeight: room,
          ...(upward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
        });
        setOpen((wasOpen) => !wasOpen);
      };

      if (!items || items.filter((item) => !item.header).length === 0) {
        return h('span', { className: 'jz-static' }, value);
      }
      return h(
        'div',
        { className: 'jz-menu', ref: boxRef },
        h(
          'button',
          {
            type: 'button',
            ref: anchorRef,
            className: `jz-chip${open ? ' open' : ''}`,
            onClick: openMenu,
          },
          label ? h('span', { className: 'jz-chip-label' }, label) : null,
          h('span', { className: 'jz-chip-value' }, value),
          h('span', { className: 'jz-caret' }, '▾'),
        ),
        open && placement
          ? h(
              'div',
              {
                className: 'jz-drop',
                style: {
                  position: 'fixed',
                  left: `${placement.left}px`,
                  top: placement.top === undefined ? undefined : `${placement.top}px`,
                  bottom: placement.bottom === undefined ? undefined : `${placement.bottom}px`,
                  width: `${placement.width}px`,
                  maxHeight: `${placement.maxHeight}px`,
                },
              },
              items.map((item) =>
                item.header
                  ? h('div', { key: String(item.value), className: 'jz-drop-head' }, item.label)
                  : h(
                      'button',
                      {
                        key: String(item.value),
                        type: 'button',
                        className: `jz-drop-item${String(item.value) === String(current) ? ' on' : ''}`,
                        onClick: () => {
                          setOpen(false);
                          onPick(item.value);
                        },
                      },
                      h('span', null, item.label),
                      String(item.value) === String(current) ? h('span', null, '✓') : null,
                    ),
              ),
            )
          : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Composer                                                            */
    /* ------------------------------------------------------------------ */

    function Composer(props) {
      const { type, models, modelId, params, prompt, refs, frames, busy, error, blocked, onType, onModel, onParams, onPrompt, onRefs, onFrames, onRun, textareaRef } = props;
      const model = modelById(models, type, modelId);
      const roles = referenceRoles(model);
      const fileInput = useRef(null);
      const slotRef = useRef('reference');
      const [note, setNote] = useState('');

      const pick = (slot) => {
        slotRef.current = slot;
        if (fileInput.current) fileInput.current.click();
      };

      const onFile = (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        readFileAsDataUrl(
          file,
          (dataUrl) => {
            if (slotRef.current === 'reference') {
              if (refs.length >= Math.max(1, roles.referenceLimit)) {
                setNote(t('refsFull'));
                return;
              }
              const next = [...refs, { url: dataUrl, name: file.name }];
              const total = next.reduce((sum, ref) => sum + ref.url.length, 0);
              if (total > 3600000) {
                setNote(t('uploading'));
                return;
              }
              setNote('');
              onRefs(next);
              return;
            }
            if (slotRef.current === 'first') {
              onFrames({ ...frames, first: { url: dataUrl, name: file.name } });
              return;
            }
            onFrames({ ...frames, last: { url: dataUrl, name: file.name } });
          },
          (message) => setNote(message),
        );
      };

      const ratioSpec = model && model.parameters ? model.parameters.aspect_ratio : null;
      const sizeSpec = model && model.parameters ? model.parameters.size : null;
      // A model either takes `aspect_ratio` (Seedream, Gemini) or a pixel `size`
      // (GPT Image). For the latter the ratio buttons are translated to `size`.
      const supportsRatio = Boolean(ratioSpec && Array.isArray(ratioSpec.enum));
      const supportsSize = Boolean(sizeSpec);
      const ratioValues = supportsRatio
        ? ratioSpec.enum
        : supportsSize
          ? Object.keys(SIZE_BY_RATIO)
          : [];
      const ratioItems = ratioValues.map((value) => ({ value, label: value }));
      const ratioCurrent = supportsRatio
        ? params.aspect_ratio || (ratioSpec && ratioSpec.default) || ratioItems[0].value
        : sizeToRatio(params.size) ||
          sizeToRatio(sizeSpec && sizeSpec.default) ||
          (ratioItems[0] && ratioItems[0].value) ||
          '';
      const pickRatio = (value) => {
        if (supportsRatio) onParams({ ...params, aspect_ratio: value });
        else onParams({ ...params, size: ratioToSize(value) || value });
      };

      const qualitySpec = model && model.parameters ? model.parameters.resolution : null;
      const qualityItems = qualitySpec && Array.isArray(qualitySpec.enum) ? qualitySpec.enum.map((value) => ({ value, label: value })) : [];
      const qualityCurrent = params.resolution || (qualitySpec && qualitySpec.default) || (qualityItems[0] && qualityItems[0].value);

      const countSpec = model && model.parameters ? model.parameters.n : null;
      const countItems = (() => {
        if (!countSpec) return [];
        const min = Number.isFinite(countSpec.minimum) ? countSpec.minimum : 1;
        const max = Number.isFinite(countSpec.maximum) ? countSpec.maximum : 4;
        const out = [];
        for (let value = min; value <= Math.min(max, min + 7); value += 1) out.push({ value, label: `${value}${t('countSuffix')}` });
        return out;
      })();
      const countCurrent = params.n ?? (countSpec && countSpec.default) ?? 1;

      const durationSpec = model && model.parameters ? model.parameters.duration : null;
      const durationItems = (() => {
        if (!durationSpec) return [];
        const min = Math.max(1, Number.isFinite(durationSpec.minimum) ? durationSpec.minimum : 3);
        const max = Number.isFinite(durationSpec.maximum) ? durationSpec.maximum : 10;
        const out = [];
        for (let value = min; value <= Math.min(max, 15); value += 1) out.push({ value, label: `${value}${t('secondsSuffix')}` });
        return out;
      })();
      const durationCurrent = params.duration ?? (durationSpec && durationSpec.default) ?? (durationItems[0] && durationItems[0].value);

      const catalog = modelChoices(models, type);
      const channelNames = [];
      for (const row of catalog) {
        const name = row.channelName || 'mote';
        if (!channelNames.includes(name)) channelNames.push(name);
      }
      const modelItems = [];
      if (channelNames.length > 1) {
        for (const name of channelNames) {
          modelItems.push({ header: true, value: `__head:${name}`, label: name });
          for (const row of catalog.filter((entry) => (entry.channelName || 'mote') === name)) {
            modelItems.push({ value: row.id, label: row.id });
          }
        }
      } else {
        for (const row of catalog) modelItems.push({ value: row.id, label: row.id });
      }
      const showFrames = type === 'video' && (roles.firstFrame || roles.lastFrame);
      const showRefs = roles.reference && (type === 'image' || !roles.firstFrame);
      const audioOn =
        params.generate_audio === undefined
          ? Boolean(model && model.parameters && model.parameters.generate_audio && model.parameters.generate_audio.default === true)
          : params.generate_audio === true;

      return h(
        'section',
        { className: 'jz-composer' },
        h(
          'div',
          { className: 'jz-composer-main' },
          h(
            'div',
            { className: 'jz-slots' },
            showFrames
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'div',
                    { className: `jz-slot${frames.first ? ' filled' : ''}`, title: t('firstFrame'), onClick: () => pick('first') },
                    frames.first ? h('img', { src: frames.first.url, alt: '' }) : h('span', { className: 'plus' }, '＋'),
                    h('span', { className: 'cap' }, t('firstFrame')),
                    frames.first
                      ? h('span', {
                          className: 'del',
                          onClick: (event) => {
                            event.stopPropagation();
                            onFrames({ ...frames, first: null });
                          },
                        }, '×')
                      : null,
                  ),
                  roles.lastFrame
                    ? h(
                        'div',
                        { className: `jz-slot${frames.last ? ' filled' : ''}`, title: t('lastFrame'), onClick: () => pick('last') },
                        frames.last ? h('img', { src: frames.last.url, alt: '' }) : h('span', { className: 'plus' }, '＋'),
                        h('span', { className: 'cap' }, t('lastFrame')),
                        frames.last
                          ? h('span', {
                              className: 'del',
                              onClick: (event) => {
                                event.stopPropagation();
                                onFrames({ ...frames, last: null });
                              },
                            }, '×')
                          : null,
                      )
                    : null,
                )
              : null,
            showRefs
              ? h(
                  React.Fragment,
                  null,
                  refs.map((ref, index) =>
                    h(
                      'div',
                      { key: `${index}-${ref.url.length}`, className: 'jz-slot filled', title: ref.name || t('references') },
                      h('img', { src: ref.url, alt: '' }),
                      h('span', {
                        className: 'del',
                        onClick: () => onRefs(refs.filter((_, i) => i !== index)),
                      }, '×'),
                    ),
                  ),
                  refs.length < Math.max(1, roles.referenceLimit)
                    ? h(
                        'div',
                        { className: 'jz-slot', title: t('references'), onClick: () => pick('reference') },
                        h('span', { className: 'plus' }, '＋'),
                        h('span', { className: 'cap' }, t('references')),
                      )
                    : null,
                )
              : null,
          ),
          h('textarea', {
            ref: textareaRef,
            className: 'jz-prompt',
            value: prompt,
            placeholder: t('promptPlaceholder'),
            onChange: (event) => onPrompt(event.target.value),
            onKeyDown: (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                onRun();
              }
            },
          }),
          h('input', { ref: fileInput, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: onFile }),
        ),
        h(
          'div',
          { className: 'jz-bar' },
          h(Menu, {
            label: t('typeLabel'),
            value: type === 'image' ? t('modeImage') : t('modeVideo'),
            current: type,
            items: [
              { value: 'image', label: t('modeImage') },
              { value: 'video', label: t('modeVideo') },
            ],
            onPick: onType,
            width: 160,
          }),
          h(Menu, {
            label: t('modelLabel'),
            value: modelId,
            current: modelId,
            items: modelItems,
            onPick: onModel,
            width: 280,
          }),
          ratioItems.length > 1 && (type === 'image' || !roles.firstFrame)
            ? h(Menu, {
                label: t('ratioLabel'),
                value: ratioCurrent,
                current: ratioCurrent,
                items: ratioItems,
                onPick: pickRatio,
                width: 150,
              })
            : null,
          qualityItems.length > 1
            ? h(Menu, {
                label: t('qualityLabel'),
                value: qualityCurrent,
                current: qualityCurrent,
                items: qualityItems,
                onPick: (value) => onParams({ ...params, resolution: value }),
                width: 140,
              })
            : null,
          type === 'image' && countItems.length > 1
            ? h(Menu, {
                label: t('countLabel'),
                value: `${countCurrent}${t('countSuffix')}`,
                current: countCurrent,
                items: countItems,
                onPick: (value) => onParams({ ...params, n: value }),
                width: 120,
              })
            : null,
          type === 'video' && durationItems.length > 1
            ? h(Menu, {
                label: t('durationLabel'),
                value: `${durationCurrent}${t('secondsSuffix')}`,
                current: durationCurrent,
                items: durationItems,
                onPick: (value) => onParams({ ...params, duration: value }),
                width: 120,
              })
            : null,
          type === 'video' && model && model.parameters && model.parameters.generate_audio
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'jz-chip',
                  onClick: () => onParams({ ...params, generate_audio: !audioOn }),
                },
                h('span', { className: 'jz-chip-label' }, t('audioLabel')),
                h('span', { className: 'jz-chip-value' }, audioOn ? t('on') : t('off')),
              )
            : null,
          h('span', { className: 'jz-spacer' }),
          note ? h('span', { className: 'jz-note' }, note) : null,
          h(
            'button',
            {
              type: 'button',
              className: 'jz-send',
              disabled: busy || prompt.trim() === '' || !model || blocked,
              title: blocked ? t('needKey') : t('send'),
              onClick: onRun,
            },
            busy ? h('span', { className: 'jz-send-spin' }) : '↑',
          ),
        ),
        error ? h('div', { className: 'jz-error' }, error) : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Gallery                                                             */
    /* ------------------------------------------------------------------ */

    function Tile({ item, onPreview, onDownload, onUse, onRemove, onRetry, canUse }) {
      const media = primaryMedia(item);
      const progress = Number.isFinite(item.progress) ? Math.max(0, Math.min(100, item.progress)) : 0;
      return h(
        'article',
        { className: 'jz-tile' },
        h(
          'div',
          { className: 'jz-tile-media' },
          media
            ? media.video
              ? h('video', {
                  src: media.url,
                  preload: 'metadata',
                  muted: true,
                  onMouseOver: (event) => event.currentTarget.play().catch(() => {}),
                  onMouseOut: (event) => {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = 0;
                  },
                })
              : h('img', { src: media.url, alt: '', loading: 'lazy' })
            : null,
          isPending(item)
            ? h(
                'div',
                { className: 'jz-tile-pending' },
                h('span', { className: 'jz-spin' }),
                `${statusLabel(item.status)}${progress > 0 ? ` ${progress}%` : ''}`,
              )
            : null,
          item.status === 'failed'
            ? h(
                'div',
                { className: 'jz-tile-err' },
                h('div', null, (item.error && item.error.message) || t('failed')),
                item.error && (item.error.code || item.error.stage)
                  ? h('div', { className: 'jz-tile-err-code' }, [item.error.code, item.error.stage, item.error.retryable ? t('retryableYes') : t('retryableNo')].filter(Boolean).join(' · '))
                  : null,
                item.error && item.error.retryable === true
                  ? h('div', { className: 'jz-tile-err-code' }, t('retryHint'))
                  : null,
              )
            : null,
          media || item.status === 'failed'
            ? h(
                'div',
                { className: 'jz-tile-actions' },
                h('button', { title: t('preview'), onClick: () => onPreview(item) }, '⤢'),
                h('button', { title: t('download'), onClick: () => onDownload(item) }, '↓'),
                canUse(item) ? h('button', { title: onUse.label, onClick: () => onUse.run(item) }, '↺') : null,
                h('button', { title: t('remove'), onClick: () => onRemove(item) }, '✕'),
              )
            : null,
        ),
        h(
          'div',
          { className: 'jz-tile-foot' },
          h('span', { className: 'jz-tile-kind' }, item.type === 'video' ? '▶' : '▢'),
          h('span', { className: 'jz-tile-model' }, item.model || ''),
          media && media.expiresAt && media.expiresAt - Date.now() < 6 * 3600 * 1000
            ? h('span', { className: 'jz-expiry', title: t('expiring') }, '⏳')
            : null,
          h('span', { className: 'jz-spacer' }),
          item.billing && item.billing.amount
            ? h('span', null, `¥${item.billing.amount}${item.billing.status && item.billing.status !== 'settled' ? ` ${item.billing.status}` : ''}`)
            : null,
          item.status === 'failed' ? h('button', { className: 'jz-link', onClick: () => onRetry(item) }, t('retry')) : null,
        ),
      );
    }

    function Lightbox({ item, onClose, onDownload, onRetry, onCopy }) {
      const media = primaryMedia(item);
      return h(
        'div',
        {
          className: 'jz-overlay',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          { className: 'jz-lightbox' },
          h(
            'div',
            { className: 'jz-lightbox-media' },
            media
              ? media.video
                ? h('video', { src: media.url, controls: true, autoPlay: true })
                : h('img', { src: media.url, alt: '' })
              : h('div', { className: 'jz-dim' }, item.status === 'failed' ? (item.error && item.error.message) || t('failed') : statusLabel(item.status)),
          ),
          h(
            'aside',
            { className: 'jz-lightbox-side' },
            h('div', { className: 'jz-meta' }, h('b', null, t('task')), String(item.taskId || '')),
            item.requestId ? h('div', { className: 'jz-meta' }, h('b', null, t('requestId')), String(item.requestId)) : null,
            h('div', { className: 'jz-meta' }, h('b', null, t('modelLabel')), item.model || ''),
            item.error && item.error.code
              ? h('div', { className: 'jz-meta' }, h('b', null, t('errorCode')), item.error.code)
              : null,
            item.error && item.error.stage
              ? h('div', { className: 'jz-meta' }, h('b', null, t('errorStage')), item.error.stage)
              : null,
            item.error && item.error.retryable !== undefined && item.error.retryable !== null
              ? h('div', { className: 'jz-meta' }, h('b', null, t('retryable')), item.error.retryable ? t('retryableYes') : t('retryableNo'))
              : null,
            item.billing && item.billing.amount
              ? h('div', { className: 'jz-meta' }, h('b', null, t('cost')), `¥${item.billing.amount}${item.billing.status ? ` · ${item.billing.status}` : ''}`)
              : null,
            h('div', { className: 'jz-meta' }, h('b', null, t('createdAt')), formatTime(item.createdAt)),
            h('div', { className: 'jz-prompt-text' }, item.prompt || ''),
            item.error && item.error.message ? h('div', { className: 'jz-error' }, item.error.message) : null,
            h('span', { className: 'jz-spacer' }),
            item.status === 'failed' ? h('button', { className: 'jz-btn', onClick: () => onRetry(item) }, t('retry')) : null,
            h('button', { className: 'jz-btn', onClick: () => onCopy(item) }, t('copyDiag')),
            media ? h('button', { className: 'jz-btn', onClick: () => onDownload(item) }, t('download')) : null,
            media ? h('a', { className: 'jz-btn', href: media.url, target: '_blank', rel: 'noreferrer' }, t('open')) : null,
            h('button', { className: 'jz-btn', onClick: onClose }, t('close')),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Settings                                                            */
    /* ------------------------------------------------------------------ */

    function SettingsDialog({ state, onClose, onSave, onTest, models }) {
      const [channels, setChannels] = useState(() =>
        (Array.isArray(state.channels) ? state.channels : []).map((channel) => ({
          id: channel.id || '',
          name: channel.name || '',
          driver: channel.driver === 'openai-images' ? 'openai-images' : 'mote',
          baseUrl: channel.baseUrl || '',
          apiKey: '',
          models: Array.isArray(channel.models) ? channel.models.join(', ') : '',
          configured: channel.configured === true,
        })),
      );
      const [form, setForm] = useState({
        imageModel: state.imageModel || '',
        videoModel: state.videoModel || '',
        outputDir: state.outputDir || '',
      });
      const [busy, setBusy] = useState(false);
      const [message, setMessage] = useState('');
      const [error, setError] = useState('');
      const [probing, setProbing] = useState(-1);
      const [probeNote, setProbeNote] = useState({});

      const catalogOf = (kind) => (models && Array.isArray(models[kind]) ? models[kind] : []);
      const modelOptions = (kind, current) => {
        const rows = catalogOf(kind).map((row) => ({
          id: row.id,
          label: row.channelName && row.channelName !== 'mote' ? `${row.channelName} · ${row.id}` : row.id,
        }));
        if (current && !rows.some((row) => row.id === current)) rows.unshift({ id: current, label: current });
        return rows;
      };
      const probeChannel = async (index) => {
        const channel = channels[index];
        setProbing(index);
        setProbeNote((current) => ({ ...current, [index]: '' }));
        try {
          const result = await call('probe', {
            driver: channel.driver,
            baseUrl: channel.baseUrl,
            apiKey: channel.apiKey,
            channelId: channel.id || undefined,
          });
          const ids =
            channel.driver === 'mote'
              ? result.image.concat(result.video)
              : result.image.length > 0
                ? result.image
                : result.models.map((row) => row.id);
          update(index, { models: ids.join(', ') });
          setProbeNote((current) => ({ ...current, [index]: `${t('probeOk')} ${result.models.length} ${t('modelsCount')}` }));
        } catch (cause) {
          setProbeNote((current) => ({ ...current, [index]: cause instanceof Error ? cause.message : String(cause) }));
        } finally {
          setProbing(-1);
        }
      };

      const update = (index, patch) =>
        setChannels((current) => current.map((channel, i) => (i === index ? { ...channel, ...patch } : channel)));
      const addChannelRow = () =>
        setChannels((current) => [
          ...current,
          { id: '', name: '', driver: 'mote', baseUrl: 'https://platform.sgt.site', apiKey: '', models: '', configured: false },
        ]);

      const buildPatch = () => ({
        channels: channels.map((channel, index) => ({
          id: channel.id || `ch${index + 1}`,
          name: channel.name || `ch${index + 1}`,
          driver: channel.driver,
          baseUrl: channel.baseUrl.trim(),
          apiKey: channel.apiKey,
          models: String(channel.models || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          enabled: true,
        })),
        imageModel: form.imageModel.trim(),
        videoModel: form.videoModel.trim(),
        outputDir: form.outputDir.trim(),
      });

      return h(
        'div',
        {
          className: 'jz-overlay',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          { className: 'jz-modal', role: 'dialog', 'aria-modal': 'true' },
          h(
            'header',
            { className: 'jz-modal-head' },
            h('span', { className: 'jz-modal-title' }, t('settingsTitle')),
            h('span', { className: 'jz-spacer' }),
            h('button', { className: 'jz-icon-btn', onClick: onClose }, '✕'),
          ),
          state.route && state.route.registered === false ? h('div', { className: 'jz-error' }, `${t('routeDown')} ${state.route.error || ''}`) : null,
          h(
            'div',
            { className: 'jz-field' },
            h(
              'div',
              { className: 'jz-field-head' },
              h('span', null, `${t('channels')} (${channels.length})`),
              h('span', { className: 'jz-spacer' }),
              h('button', { className: 'jz-btn small', onClick: addChannelRow }, t('addChannel')),
            ),
            channels.length === 0 ? h('div', { className: 'jz-dim' }, t('noChannel')) : null,
            channels.map((channel, index) =>
              h(
                'div',
                { key: `${channel.id || 'new'}-${index}`, className: 'jz-channel' },
                h(
                  'div',
                  { className: 'jz-grid2' },
                  h('input', {
                    className: 'jz-input',
                    value: channel.name,
                    placeholder: t('channelName'),
                    onChange: (event) => update(index, { name: event.target.value }),
                  }),
                  h(
                    'select',
                    { className: 'jz-input', value: channel.driver, onChange: (event) => update(index, { driver: event.target.value }) },
                    h('option', { value: 'mote' }, 'mote 统一渠道'),
                    h('option', { value: 'openai-images' }, 'OpenAI 兼容图片'),
                  ),
                ),
                h('input', {
                  className: 'jz-input',
                  value: channel.baseUrl,
                  placeholder: t('channelBase'),
                  onChange: (event) => update(index, { baseUrl: event.target.value }),
                }),
                h('input', {
                  className: 'jz-input',
                  type: 'password',
                  value: channel.apiKey,
                  placeholder: channel.configured ? '••••••••' : t('channelKey'),
                  autoComplete: 'off',
                  onChange: (event) => update(index, { apiKey: event.target.value }),
                }),
                channel.driver === 'openai-images' || channel.driver === 'mote'
                  ? h(
                      'div',
                      { className: 'jz-row' },
                      h('input', {
                        className: 'jz-input',
                        value: channel.models,
                        placeholder: channel.driver === 'mote' ? t('channelModelsMote') : t('channelModels'),
                        onChange: (event) => update(index, { models: event.target.value }),
                      }),
                      h(
                        'button',
                        { className: 'jz-btn small', disabled: probing === index, onClick: () => probeChannel(index) },
                        probing === index ? t('probing') : t('autoFetch'),
                      ),
                    )
                  : null,
                probeNote[index] ? h('div', { className: 'jz-dim' }, probeNote[index]) : null,
                h(
                  'div',
                  { className: 'jz-channel-foot' },
                  h('span', { className: 'jz-dim' }, channel.configured ? t('channelReady') : t('channelNoKey')),
                  h('span', { className: 'jz-spacer' }),
                  h('button', { className: 'jz-btn small ghost', onClick: () => setChannels((current) => current.filter((_, i) => i !== index)) }, t('deleteChannel')),
                ),
              ),
            ),
            h('div', { className: 'jz-dim' }, t('channelsHint')),
          ),
          h(
            'div',
            { className: 'jz-grid2' },
            h(
              'label',
              { className: 'jz-field' },
              h('span', { className: 'jz-dim' }, t('imageModel')),
              h(
                'select',
                {
                  className: 'jz-input',
                  value: form.imageModel,
                  onChange: (event) => setForm((current) => ({ ...current, imageModel: event.target.value })),
                },
                h('option', { value: '' }, t('modelAuto')),
                modelOptions('image', form.imageModel).map((row) => h('option', { key: row.id, value: row.id }, row.label)),
              ),
            ),
            h(
              'label',
              { className: 'jz-field' },
              h('span', { className: 'jz-dim' }, t('videoModel')),
              h(
                'select',
                {
                  className: 'jz-input',
                  value: form.videoModel,
                  onChange: (event) => setForm((current) => ({ ...current, videoModel: event.target.value })),
                },
                h('option', { value: '' }, t('modelAuto')),
                modelOptions('video', form.videoModel).map((row) => h('option', { key: row.id, value: row.id }, row.label)),
              ),
            ),
          ),
          h(
            'label',
            { className: 'jz-field' },
            h('span', { className: 'jz-dim' }, t('outputDir')),
            h('input', {
              className: 'jz-input',
              value: form.outputDir,
              onChange: (event) => setForm((current) => ({ ...current, outputDir: event.target.value })),
            }),
          ),
          error ? h('div', { className: 'jz-error' }, error) : null,
          message ? h('div', { className: 'jz-dim' }, message) : null,
          h(
            'footer',
            { className: 'jz-modal-foot' },
            h('span', { className: 'jz-spacer' }),
            h(
              'button',
              {
                className: 'jz-btn',
                disabled: busy,
                onClick: async () => {
                  setBusy(true);
                  setError('');
                  setMessage('');
                  try {
                    const count = await onTest(buildPatch());
                    setMessage(`${t('testOk')} · ${count} ${t('modelsCount')}`);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                  } finally {
                    setBusy(false);
                  }
                },
              },
              busy ? t('testing') : t('testSave'),
            ),
            h(
              'button',
              {
                className: 'jz-btn primary',
                disabled: busy,
                onClick: async () => {
                  setBusy(true);
                  setError('');
                  setMessage('');
                  try {
                    await onSave(buildPatch());
                    onClose();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                  } finally {
                    setBusy(false);
                  }
                },
              },
              busy ? t('saving') : t('save'),
            ),
            h('button', { className: 'jz-btn', onClick: onClose }, t('close')),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Styles (即梦-like dark stage)                                        */
    /* ------------------------------------------------------------------ */

    const CSS = `
.jz-root { --jz-bg: #0a0b0d; --jz-bg-2: #101114; --jz-card: #16171b; --jz-card-2: #1d1f24; --jz-line: rgba(255,255,255,.09); --jz-line-2: rgba(255,255,255,.16); --jz-text: #f1f2f4; --jz-dim: #9a9ea7; --jz-accent: #7c6cff; --jz-accent-2: #b06bff;
  display: flex; flex-direction: column; height: 100%; min-height: 320px; min-width: 0; background: var(--jz-bg); color: var(--jz-text); font-size: 13px; user-select: none; }
.jz-head { display: flex; align-items: center; gap: 14px; padding: 0 20px; height: 52px; flex: none; border-bottom: 1px solid var(--jz-line); background: var(--jz-bg-2); }
.jz-brand { display: flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 600; letter-spacing: .3px; }
.jz-logo { width: 20px; height: 20px; border-radius: 7px; background: linear-gradient(135deg, var(--jz-accent), var(--jz-accent-2)); box-shadow: 0 0 16px rgba(124,108,255,.45); }
.jz-nav { display: flex; gap: 4px; margin-left: 6px; }
.jz-nav button { height: 30px; padding: 0 14px; border: none; border-radius: 8px; background: transparent; color: var(--jz-dim); font-size: 13px; cursor: pointer; }
.jz-nav button:hover { color: var(--jz-text); background: rgba(255,255,255,.04); }
.jz-nav button.on { color: var(--jz-text); background: rgba(255,255,255,.08); }
.jz-spacer { flex: 1; }
.jz-chip-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--jz-line); background: var(--jz-card); color: var(--jz-dim); font-size: 12px; }
.jz-dot { width: 7px; height: 7px; border-radius: 50%; background: #6b7078; }
.jz-dot.ok { background: #35d07f; box-shadow: 0 0 8px rgba(53,208,127,.6); }
.jz-dot.bad { background: #ffb454; }
.jz-icon-btn { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--jz-line); background: var(--jz-card); color: var(--jz-text); font-size: 13px; cursor: pointer; }
.jz-icon-btn:hover { border-color: var(--jz-line-2); }
.jz-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 28px 20px 56px; background-image: radial-gradient(circle, rgba(255,255,255,.045) 1px, transparent 1px); background-size: 22px 22px; }
.jz-wrap { max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 26px; }
.jz-hero { text-align: center; padding: 34px 0 6px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.jz-hero.compact { padding: 6px 0 0; }
.jz-hero h1 { margin: 0; font-size: 32px; font-weight: 650; letter-spacing: .5px; line-height: 1.35; }
.jz-hero.compact h1 { font-size: 19px; font-weight: 600; }
.jz-switch { display: inline-flex; padding: 4px; border-radius: 999px; background: var(--jz-card); border: 1px solid var(--jz-line); gap: 2px; }
.jz-switch button { height: 30px; padding: 0 24px; border: none; border-radius: 999px; background: transparent; color: var(--jz-dim); font-size: 13px; cursor: pointer; }
.jz-switch button.on { color: #0a0b0d; background: linear-gradient(135deg, #dfe3ff, #b9a6ff); font-weight: 600; }
.jz-composer { border: 1px solid var(--jz-line); border-radius: 20px; background: linear-gradient(180deg, #17181d 0%, #121317 100%); box-shadow: 0 18px 48px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.03); }
.jz-composer-main { display: flex; gap: 12px; padding: 14px 14px 6px; align-items: flex-start; }
.jz-slots { display: flex; flex-wrap: wrap; gap: 8px; max-width: 224px; }
.jz-slot { position: relative; width: 64px; height: 64px; border-radius: 12px; border: 1px dashed var(--jz-line-2); background: rgba(255,255,255,.02); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--jz-dim); font-size: 10.5px; cursor: pointer; overflow: hidden; }
.jz-slot:hover { border-color: var(--jz-accent); color: var(--jz-text); }
.jz-slot.filled { border-style: solid; border-color: var(--jz-line); }
.jz-slot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.jz-slot .plus { font-size: 18px; line-height: 1; }
.jz-slot .cap { position: absolute; left: 0; bottom: 0; right: 0; padding: 2px 0; background: linear-gradient(180deg, transparent, rgba(0,0,0,.7)); text-align: center; font-size: 10px; color: #fff; }
.jz-slot .del { position: absolute; top: 2px; right: 2px; width: 16px; height: 16px; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; font-size: 11px; line-height: 16px; text-align: center; }
.jz-prompt { flex: 1; min-height: 116px; max-height: 260px; resize: vertical; border: none; outline: none; background: transparent; color: var(--jz-text); font-size: 14.5px; line-height: 1.65; font-family: inherit; padding: 6px 2px; }
.jz-prompt::placeholder { color: #6d727b; }
.jz-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px 12px; border-top: 1px solid var(--jz-line); }
.jz-menu { position: relative; }
.jz-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--jz-line); background: rgba(255,255,255,.03); color: var(--jz-text); font-size: 12px; cursor: pointer; }
.jz-chip:hover, .jz-chip.open { border-color: var(--jz-line-2); background: rgba(255,255,255,.07); }
.jz-chip-label { color: var(--jz-dim); }
.jz-chip-value { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jz-caret { color: var(--jz-dim); font-size: 10px; }
.jz-static { padding: 0 6px; color: var(--jz-dim); font-size: 12px; }
.jz-drop { z-index: 90; overflow-y: auto; overscroll-behavior: contain; padding: 6px; border-radius: 12px; background: #1b1c21; border: 1px solid var(--jz-line-2); box-shadow: 0 18px 40px rgba(0,0,0,.55); }
.jz-drop-head { padding: 6px 9px 4px; font-size: 10.5px; letter-spacing: .3px; text-transform: uppercase; color: var(--jz-dim); }
.jz-drop-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; min-height: 32px; padding: 0 9px; border: none; border-radius: 8px; background: transparent; color: var(--jz-text); font-size: 12.5px; cursor: pointer; text-align: left; }
.jz-drop-item:hover { background: rgba(255,255,255,.07); }
.jz-drop-item.on { color: #c6bcff; }
.jz-send { width: 38px; height: 38px; flex: none; border-radius: 50%; border: none; background: linear-gradient(135deg, var(--jz-accent), var(--jz-accent-2)); color: #fff; font-size: 17px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 20px rgba(124,108,255,.45); }
.jz-send:disabled { opacity: .45; box-shadow: none; cursor: default; }
.jz-send-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; animation: jz-spin .9s linear infinite; }
@keyframes jz-spin { to { transform: rotate(360deg); } }
.jz-note { color: #ffb454; font-size: 11.5px; }
.jz-error { margin: 8px 14px 12px; padding: 8px 10px; border-radius: 9px; background: rgba(255,90,90,.09); border: 1px solid rgba(255,90,90,.28); color: #ff9c9c; font-size: 12px; line-height: 1.5; word-break: break-word; }
.jz-ideas { display: flex; flex-direction: column; gap: 8px; }
.jz-ideas-head { font-size: 12px; color: var(--jz-dim); }
.jz-idea-row { display: flex; gap: 8px; flex-wrap: wrap; }
.jz-idea { max-width: 340px; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--jz-line); background: rgba(255,255,255,.03); color: var(--jz-dim); font-size: 12px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jz-idea:hover { color: var(--jz-text); border-color: var(--jz-line-2); background: rgba(255,255,255,.07); }
.jz-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.jz-card { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 14px; border: 1px solid var(--jz-line); background: linear-gradient(160deg, rgba(124,108,255,.10), rgba(255,255,255,.02)); cursor: pointer; }
.jz-card:hover { border-color: var(--jz-line-2); transform: translateY(-1px); }
.jz-card-title { font-size: 14px; font-weight: 600; }
.jz-card-desc { font-size: 11.5px; color: var(--jz-dim); line-height: 1.5; }
.jz-gallery { display: flex; flex-direction: column; gap: 12px; }
.jz-gallery-head { display: flex; align-items: baseline; gap: 10px; }
.jz-gallery-title { font-size: 16px; font-weight: 650; }
.jz-count { font-size: 12px; color: var(--jz-dim); }
.jz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.jz-tile { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--jz-line); background: var(--jz-card); aspect-ratio: 1 / 1; display: flex; flex-direction: column; }
.jz-tile-media { position: relative; flex: 1; min-height: 0; background: #0c0d10; }
.jz-tile-media img, .jz-tile-media video { width: 100%; height: 100%; object-fit: cover; display: block; }
.jz-tile-pending { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--jz-dim); font-size: 12px; }
.jz-spin { width: 24px; height: 24px; border-radius: 50%; border: 2px solid rgba(255,255,255,.16); border-top-color: var(--jz-accent); animation: jz-spin 1s linear infinite; }
.jz-tile-err { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 10px; text-align: center; font-size: 11.5px; color: #ff9c9c; background: #141518; }
.jz-tile-actions { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(0,0,0,.45); opacity: 0; transition: opacity .12s ease; }
.jz-tile:hover .jz-tile-actions { opacity: 1; }
.jz-tile-actions button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(255,255,255,.35); background: rgba(0,0,0,.4); color: #fff; font-size: 13px; cursor: pointer; }
.jz-tile-actions button:hover { background: rgba(0,0,0,.65); }
.jz-tile-foot { display: flex; align-items: center; gap: 6px; padding: 7px 9px; font-size: 11px; color: var(--jz-dim); border-top: 1px solid var(--jz-line); background: var(--jz-card); }
.jz-tile-kind { opacity: .7; }
.jz-tile-model { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
.jz-expiry { color: #ffb454; }
.jz-tile-err-code { margin-top: 4px; font-size: 10.5px; color: var(--jz-dim); }
.jz-link { border: none; background: transparent; color: #c6bcff; font-size: 11px; cursor: pointer; padding: 0 2px; }
.jz-empty { border: 1px dashed var(--jz-line-2); border-radius: 16px; padding: 46px 24px; text-align: center; color: var(--jz-dim); font-size: 13px; line-height: 1.7; }
.jz-dim { color: var(--jz-dim); font-size: 12px; line-height: 1.5; }
.jz-root .jz-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--jz-line); background: var(--jz-card); color: var(--jz-text); font-size: 12.5px; cursor: pointer; text-decoration: none; }
.jz-root .jz-btn:hover { border-color: var(--jz-line-2); }
.jz-root .jz-btn:disabled { opacity: .5; cursor: default; }
.jz-root .jz-btn.primary { background: linear-gradient(135deg, var(--jz-accent), var(--jz-accent-2)); border-color: transparent; color: #fff; font-weight: 600; }
.jz-btn.small { height: 26px; padding: 0 10px; font-size: 11.5px; }
.jz-btn.ghost { background: transparent; color: var(--jz-dim); }
.jz-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,.62); display: flex; align-items: center; justify-content: center; padding: 24px; }
.jz-lightbox { display: flex; max-width: min(1040px, 94vw); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #121317; border: 1px solid var(--jz-line-2); box-shadow: 0 24px 64px rgba(0,0,0,.6); }
.jz-lightbox-media { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; background: #000; }
.jz-lightbox-media img, .jz-lightbox-media video { max-width: 100%; max-height: 88vh; display: block; }
.jz-lightbox-side { width: 300px; flex: none; padding: 16px; display: flex; flex-direction: column; gap: 10px; border-left: 1px solid var(--jz-line); }
.jz-meta { display: flex; gap: 8px; font-size: 11.5px; line-height: 1.5; }
.jz-meta b { color: var(--jz-dim); font-weight: 500; min-width: 52px; }
.jz-prompt-text { font-size: 12.5px; line-height: 1.6; color: var(--jz-text); white-space: pre-wrap; user-select: text; }
.jz-modal { width: 560px; max-width: calc(100vw - 48px); max-height: calc(100vh - 80px); overflow-y: auto; padding: 18px; border-radius: 18px; background: #141519; border: 1px solid var(--jz-line-2); box-shadow: 0 24px 64px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 12px; }
.jz-modal-head { display: flex; align-items: center; }
.jz-modal-title { font-size: 15px; font-weight: 600; }
.jz-modal-foot { display: flex; align-items: center; gap: 8px; }
.jz-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.jz-field-head { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--jz-dim); }
.jz-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.jz-input { width: 100%; height: 32px; padding: 0 9px; border-radius: 8px; border: 1px solid var(--jz-line); background: #0e0f12; color: var(--jz-text); font-size: 12px; font-family: inherit; }
.jz-input:focus { outline: none; border-color: var(--jz-accent); }
.jz-row { display: flex; gap: 6px; align-items: center; }
.jz-row .jz-input { flex: 1; min-width: 0; }
.jz-channel { display: flex; flex-direction: column; gap: 7px; padding: 10px; border: 1px solid var(--jz-line); border-radius: 10px; background: rgba(255,255,255,.02); }
.jz-channel-foot { display: flex; align-items: center; gap: 8px; }
.jz-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 80; padding: 9px 16px; border-radius: 10px; background: #1e2026; border: 1px solid var(--jz-line-2); color: var(--jz-text); font-size: 12.5px; box-shadow: 0 12px 32px rgba(0,0,0,.5); max-width: 70vw; }
`;

    /* ------------------------------------------------------------------ */
    /* Studio                                                              */
    /* ------------------------------------------------------------------ */

    function Studio() {
      const [state, setState] = useState(null);
      const [models, setModels] = useState({ image: [], video: [] });
      const [type, setType] = useState('image');
      const [modelId, setModelId] = useState('');
      const [params, setParams] = useState({});
      const [prompt, setPrompt] = useState('');
      const [refs, setRefs] = useState([]);
      const [frames, setFrames] = useState({ first: null, last: null });
      const [items, setItems] = useState(loadItems);
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [preview, setPreview] = useState(null);
      const [toast, setToast] = useState('');

      const itemsRef = useRef(items);
      const stateRef = useRef(state);
      const modelsRef = useRef(models);
      const saveTimer = useRef(null);
      const textareaRef = useRef(null);
      itemsRef.current = items;
      stateRef.current = state;
      modelsRef.current = models;

      useEffect(() => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, 120)));
          } catch {
            /* storage may be unavailable */
          }
        }, 300);
        return () => {
          if (saveTimer.current) window.clearTimeout(saveTimer.current);
        };
      }, [items]);

      const loadCatalog = useCallback(async () => {
        try {
          const result = await call('state');
          setState(result);
          if (!result.configured) return;
          const [images, videos] = await Promise.all([
            call('models', { category: 'image' }).catch(() => ({ models: [] })),
            call('models', { category: 'video' }).catch(() => ({ models: [] })),
          ]);
          setModels({
            image: Array.isArray(images.models) ? images.models : [],
            video: Array.isArray(videos.models) ? videos.models : [],
          });
        } catch (cause) {
          setState({ configured: false, channels: [], route: null });
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }, []);

      useEffect(() => {
        let cancelled = false;
        (async () => {
          await loadCatalog();
          if (cancelled) return;
        })();
        return () => {
          cancelled = true;
        };
      }, [loadCatalog]);

      useEffect(() => {
        const choices = modelChoices(models, type);
        if (choices.length === 0) {
          setModelId('');
          setParams({});
          return;
        }
        const preferred = state ? (type === 'video' ? state.videoModel : state.imageModel) : '';
        setModelId((current) => {
          if (current && choices.some((entry) => entry.id === current)) return current;
          const chosen = choices.find((entry) => entry.id === preferred) || choices[0];
          setParams(defaultParams(chosen));
          return chosen.id;
        });
      }, [type, models, state]);

      useEffect(() => {
        const timer = window.setInterval(async () => {
          const pending = itemsRef.current.filter((item) => isPending(item) && item.taskId);
          if (pending.length === 0) return;
          try {
            const result = await call('tasks', { ids: pending.map((item) => item.taskId) });
            const rows = Array.isArray(result.tasks) ? result.tasks : [];
            if (rows.length === 0) return;
            setItems((current) => {
              let changed = false;
              let next = current.map((item) => {
                if (!item.taskId) return item;
                const hit = rows.find((row) => row.id === item.taskId);
                if (!hit || !hit.task) return item;
                const task = hit.task;
                const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];
                const updated = {
                  ...item,
                  status: task.status || item.status,
                  progress: Number.isFinite(task.progress) ? task.progress : item.progress,
                  artifacts: artifacts.length > 0 ? artifacts : item.artifacts,
                  error: task.error ?? null,
                  billing: task.billing ?? item.billing ?? null,
                  requestId: task.requestId ?? item.requestId ?? null,
                };
                if (JSON.stringify(updated) === JSON.stringify(item)) return item;
                changed = true;
                return updated;
              });
              const finished = next.filter((item) => item.status === 'succeeded');
              for (const item of finished) {
                const artifacts = Array.isArray(item.artifacts) ? item.artifacts : [];
                if (artifacts.length <= 1) continue;
                const siblings = next.filter((entry) => entry.taskId === item.taskId);
                for (let index = 0; index < artifacts.length; index += 1) {
                  if (siblings.some((entry) => (entry.artifactIndex ?? 0) === index)) continue;
                  next = [...next, { ...item, id: `${String(item.taskId).slice(-12)}-${index}`, artifactIndex: index }];
                  changed = true;
                }
              }
              return changed ? next : current;
            });
          } catch {
            /* keep the last known state; the next tick retries */
          }
        }, 3000);
        return () => window.clearInterval(timer);
      }, []);

      const model = modelById(models, type, modelId);
      const roles = referenceRoles(model);
      const blocked = Boolean(state && !state.configured);

      const switchType = (nextType) => {
        if (nextType === type) return;
        setType(nextType);
        setFrames({ first: null, last: null });
        setRefs([]);
        const choices = modelChoices(modelsRef.current, nextType);
        const preferred = stateRef.current ? (nextType === 'video' ? stateRef.current.videoModel : stateRef.current.imageModel) : '';
        const chosen = choices.find((entry) => entry.id === preferred) || choices[0] || null;
        setModelId(chosen ? chosen.id : '');
        setParams(chosen ? defaultParams(chosen) : {});
      };

      const run = async () => {
        if (blocked) {
          setSettingsOpen(true);
          setError(t('needKey'));
          return;
        }
        const active = modelById(modelsRef.current, type, modelId);
        if (!active || prompt.trim() === '') return;
        setBusy(true);
        setError('');
        const references = [];
        if (type === 'video') {
          if (frames.first && roles.firstFrame) references.push({ role: 'first_frame', type: 'image', url: frames.first.url });
          if (frames.last && roles.lastFrame) references.push({ role: 'last_frame', type: 'image', url: frames.last.url });
        } else {
          for (const ref of refs) references.push({ role: 'reference', type: 'image', url: ref.url });
        }
        try {
          const result = await call('generate', {
            kind: type,
            model: active.id,
            prompt: prompt.trim(),
            params: paramsForModel(active, params),
            references: references.length > 0 ? references : undefined,
          });
          const task = result.task || {};
          if (Number.isFinite(task.inlined) && task.inlined > 0) say(`${task.inlined} ${t('inlinedRefs')}`);
          setItems((current) => [
            {
              id: newId(),
              type,
              model: task.model || active.id,
              prompt: prompt.trim(),
              params: cleanParams(params),
              taskId: task.id,
              status: task.status || 'queued',
              progress: Number.isFinite(task.progress) ? task.progress : 0,
              artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
              artifactIndex: 0,
              error: task.error ?? null,
              billing: task.billing ?? null,
              requestId: task.requestId ?? null,
              createdAt: Date.now(),
            },
            ...current,
          ]);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          setBusy(false);
        }
      };

      const toastTimer = useRef(null);
      const say = useCallback((message) => {
        setToast(message);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 3200);
      }, []);

      const retryOne = async (item) => {
        if (blocked) {
          setSettingsOpen(true);
          setError(t('needKey'));
          return;
        }
        const target = modelById(modelsRef.current, item.type, item.model);
        try {
          const result = await call('generate', {
            kind: item.type,
            model: item.model || undefined,
            prompt: item.prompt || '',
            params: target ? paramsForModel(target, item.params || {}) : cleanParams(item.params || {}),
          });
          const task = result.task || {};
          if (Number.isFinite(task.inlined) && task.inlined > 0) say(`${task.inlined} ${t('inlinedRefs')}`);
          setItems((current) => [
            {
              id: newId(),
              type: item.type,
              model: task.model || item.model,
              prompt: item.prompt || '',
              params: item.params || {},
              taskId: task.id,
              status: task.status || 'queued',
              progress: Number.isFinite(task.progress) ? task.progress : 0,
              artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
              artifactIndex: 0,
              error: task.error ?? null,
              billing: task.billing ?? null,
              requestId: task.requestId ?? null,
              createdAt: Date.now(),
            },
            ...current,
          ]);
          say(t('retrySubmitted'));
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const copyDiag = async (item) => {
        const text = diagnosticsOf(item);
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
          } else {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
          }
          say(t('diagCopied'));
        } catch {
          setError(text);
        }
      };

      const download = async (item) => {
        try {
          const result = await call('download', { id: item.taskId });
          const count = Array.isArray(result.saved) ? result.saved.length : 0;
          say(`${t('saved')} ${count} ${t('files')} ${result.dir}`);
          setPreview(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      };

      const useAs = (item) => {
        const media = primaryMedia(item);
        if (!media) return { label: t('reuse'), run: () => {} };
        const source = media.source || media.url;
        const placed = (label) => () => {
          if (type === 'video') {
            if (roles.firstFrame && !frames.first) setFrames((current) => ({ ...current, first: { url: source, name: item.model } }));
            else setFrames((current) => ({ ...current, last: { url: source, name: item.model } }));
          } else {
            setRefs((current) => [...current, { url: source, name: item.model }]);
          }
          say(label);
        };
        if (type === 'video' && roles.firstFrame && !frames.first) {
          return { label: t('reuseFirst'), run: placed(t('reuseFirst')) };
        }
        if (type === 'video' && roles.lastFrame && !frames.last) {
          return { label: t('reuseLast'), run: placed(t('reuseLast')) };
        }
        return { label: t('reuse'), run: placed(t('reuse')) };
      };

      const clearFinished = () => setItems((current) => current.filter((item) => isPending(item)));
      const finishedCount = items.filter((item) => !isPending(item)).length;
      const hasWorks = items.length > 0;

      const applyCard = (kind, mode) => {
        switchType(kind);
        if (mode === 'reference' && textareaRef.current) {
          window.setTimeout(() => {
            if (textareaRef.current) textareaRef.current.focus();
          }, 0);
        }
      };

      return h(
        'div',
        { className: 'jz-root' },
        h('style', null, CSS),
        h(
          'header',
          { className: 'jz-head' },
          h('div', { className: 'jz-brand' }, h('span', { className: 'jz-logo' }), t('brand')),
          h(
            'nav',
            { className: 'jz-nav' },
            h('button', { className: type === 'image' ? 'on' : '', onClick: () => switchType('image') }, t('modeImage')),
            h('button', { className: type === 'video' ? 'on' : '', onClick: () => switchType('video') }, t('modeVideo')),
          ),
          h('span', { className: 'jz-spacer' }),
          h(
            'span',
            { className: 'jz-chip-status' },
            h('span', { className: `jz-dot ${state && state.configured ? 'ok' : 'bad'}` }),
            state && state.configured ? t('connected') : t('notConfigured'),
          ),
          h('button', { className: 'jz-icon-btn', title: t('settingsTitle'), onClick: () => setSettingsOpen(true) }, '⚙'),
        ),
        h(
          'div',
          { className: 'jz-scroll' },
          h(
            'div',
            { className: 'jz-wrap' },
            h(
              'section',
              { className: `jz-hero${hasWorks ? ' compact' : ''}` },
              h('h1', null, t('greeting')),
              hasWorks
                ? null
                : h(
                    'div',
                    { className: 'jz-switch' },
                    h('button', { className: type === 'image' ? 'on' : '', onClick: () => switchType('image') }, t('modeImage')),
                    h('button', { className: type === 'video' ? 'on' : '', onClick: () => switchType('video') }, t('modeVideo')),
                  ),
            ),
            h(Composer, {
              type,
              models,
              modelId,
              params,
              prompt,
              refs,
              frames,
              busy,
              error,
              blocked,
              onType: switchType,
              onModel: (id) => {
                setModelId(id);
                setParams(defaultParams(modelById(models, type, id)));
              },
              onParams: setParams,
              onPrompt: setPrompt,
              onRefs: setRefs,
              onFrames: setFrames,
              onRun: run,
              textareaRef,
            }),
            h(
              'section',
              { className: 'jz-ideas' },
              h('div', { className: 'jz-ideas-head' }, t('inspirationTitle')),
              h(
                'div',
                { className: 'jz-idea-row' },
                IDEAS.map((idea, index) =>
                  h('button', { key: index, className: 'jz-idea', title: idea, onClick: () => setPrompt(idea) }, idea),
                ),
              ),
            ),
            hasWorks
              ? null
              : h(
                  'section',
                  { className: 'jz-cards' },
                  h(
                    'div',
                    { className: 'jz-card', onClick: () => applyCard('image', 'text') },
                    h('span', { className: 'jz-card-title' }, t('cardTextToImage')),
                    h('span', { className: 'jz-card-desc' }, t('cardTextToImageDesc')),
                  ),
                  h(
                    'div',
                    { className: 'jz-card', onClick: () => applyCard('image', 'reference') },
                    h('span', { className: 'jz-card-title' }, t('cardImageToImage')),
                    h('span', { className: 'jz-card-desc' }, t('cardImageToImageDesc')),
                  ),
                  h(
                    'div',
                    { className: 'jz-card', onClick: () => applyCard('video', 'text') },
                    h('span', { className: 'jz-card-title' }, t('cardTextToVideo')),
                    h('span', { className: 'jz-card-desc' }, t('cardTextToVideoDesc')),
                  ),
                  h(
                    'div',
                    { className: 'jz-card', onClick: () => applyCard('video', 'frames') },
                    h('span', { className: 'jz-card-title' }, t('cardFrames')),
                    h('span', { className: 'jz-card-desc' }, t('cardFramesDesc')),
                  ),
                ),
            h(
              'section',
              { className: 'jz-gallery' },
              h(
                'div',
                { className: 'jz-gallery-head' },
                h('span', { className: 'jz-gallery-title' }, t('gallery')),
                h('span', { className: 'jz-count' }, String(items.length)),
                h('span', { className: 'jz-spacer' }),
                finishedCount > 0 ? h('button', { className: 'jz-btn small ghost', onClick: clearFinished }, `${t('clearFinished')} (${finishedCount})`) : null,
              ),
              items.length === 0
                ? h('div', { className: 'jz-empty' }, t('empty'))
                : h(
                    'div',
                    { className: 'jz-grid' },
                    items.map((item) =>
                      h(Tile, {
                        key: item.id,
                        item,
                        onPreview: (target) => setPreview(target),
                        onDownload: download,
                        onUse: useAs(item),
                        onRemove: (target) => setItems((current) => current.filter((entry) => entry.id !== target.id)),
                        onRetry: retryOne,
                        canUse: (target) => Boolean(primaryMedia(target)),
                      }),
                    ),
                  ),
            ),
          ),
        ),
        preview
          ? h(Lightbox, {
              item: preview,
              onClose: () => setPreview(null),
              onDownload: download,
              onRetry: retryOne,
              onCopy: copyDiag,
            })
          : null,
        toast ? h('div', { className: 'jz-toast' }, toast) : null,
        settingsOpen
          ? h(SettingsDialog, {
              state: state || {},
              models,
              onClose: () => setSettingsOpen(false),
              onTest: async (patch) => {
                const saved = await call('config', { patch });
                setState({ ...saved, canEditConfig: true });
                await loadCatalog();
                return (await call('models', { refresh: true })).models.length;
              },
              onSave: async (patch) => {
                const saved = await call('config', { patch });
                setState({ ...saved, canEditConfig: true });
                await loadCatalog();
              },
            })
          : null,
      );
    }

    /* ------------------------------------------------------------------ */
    /* Sidebar icon                                                        */
    /* ------------------------------------------------------------------ */

    function PanelIcon(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 20;
      const active = props && props.active === true;
      return h(
        'svg',
        { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, style: { display: 'block' } },
        h('rect', { x: 2.5, y: 3.5, width: 19, height: 14, rx: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, opacity: active ? 1 : 0.85 }),
        h('circle', { cx: 8, cy: 8.5, r: 1.6, fill: 'currentColor', opacity: 0.9 }),
        h('path', { d: 'M5 14.5l4-4 3 2.8 2.6-2.6 3.9 3.8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        h('path', { d: 'M9 20.5h6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', opacity: 0.8 }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Plugin                                                              */
    /* ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.get('locale');
        if (locale && typeof locale.register === 'function') {
          for (const [id, dict] of [
            ['en', EN],
            ['zh', ZH],
            ['zh-CN', ZH],
          ]) {
            try {
              ctx.effect(() => locale.register('moteMedia', id, dict));
            } catch {
              /* ignore an unsupported locale tag */
            }
          }
          try {
            const bound = locale.bind('moteMedia');
            if (typeof bound === 'function') t = bound;
          } catch {
            /* keep the inline fallback */
          }
        } else {
          const language = String(document.documentElement.lang || navigator.language || 'en').toLowerCase();
          t = (key) => (language.startsWith('zh') ? ZH : EN)[key] ?? key;
        }

        IDEAS = String(t('modeImage')).startsWith('图') ? ZH.inspirations : EN.inspirations;

        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'mote-media', order: 0 }, Studio));
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            { name: 'sidebar.panellist', id: 'mote-media', order: 30, label: () => t('panelLabel') },
            PanelIcon,
          ),
        );
      },
    };
  },
});










