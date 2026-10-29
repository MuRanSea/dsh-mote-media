// Generated from src/client/entry.js. Do not edit; run npm run build.
(() => {
  // src/client/api/host-client.js
  function createHostClient({
    fetch: fetchRequest = (...args) => window.fetch(...args),
    getBaseURI = () => document.baseURI,
    getOrigin = () => window.location.origin
  } = {}) {
    let activeEndpoint = null;
    function endpointCandidates() {
      const out = [];
      if (activeEndpoint) out.push(activeEndpoint);
      try {
        const base = getBaseURI() || "";
        if (base.endsWith("/")) out.push(new URL("api/mote-media", base).href);
      } catch {
      }
      out.push(`${getOrigin()}/api/mote-media`);
      out.push("/api/mote-media");
      return out.filter((url, index) => out.indexOf(url) === index);
    }
    async function call(action, payload) {
      const paid = action === "generate";
      const unknown = (message) => Object.assign(new Error(message), { code: "submission_unknown", submissionUnknown: true });
      const body = JSON.stringify({ action, ...payload || {} });
      let lastError = null;
      for (const url of endpointCandidates()) {
        let response;
        try {
          response = await fetchRequest(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            credentials: "same-origin"
          });
        } catch (cause) {
          lastError = new Error(`${url} · ${cause instanceof Error ? cause.message : String(cause)}`);
          if (paid) throw unknown(lastError.message);
          continue;
        }
        let text;
        try {
          text = await response.text();
        } catch (error) {
          if (paid) throw unknown(error.message);
          throw error;
        }
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
        if (data === null) {
          lastError = new Error(`HTTP ${response.status} ${response.statusText || ""} @ ${url} · ${text.slice(0, 160)}`);
          if (paid) throw unknown(lastError.message);
          if (response.status === 404) continue;
          throw lastError;
        }
        activeEndpoint = url;
        if (data.ok !== true) throw Object.assign(new Error(data.error?.message || "request failed"), {
          code: data.error?.code,
          submissionUnknown: paid && data.error?.submissionUnknown === true
        });
        return data;
      }
      throw lastError || new Error("no endpoint answered");
    }
    return { call };
  }

  // src/client/storage/works-storage.js
  var STORE_KEY = "mote-media.studio.v1";
  var MAX_STORED_ITEMS = 120;
  var HIDDEN_CHAT_KEY = "mote-media.chat-hidden.v1";
  function createWorksStorage({ getStorage = () => window.localStorage } = {}) {
    function loadItems() {
      try {
        const raw = getStorage().getItem(STORE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item) => item && typeof item.id === "string" && (item.type === "image" || item.type === "video"));
      } catch {
        return [];
      }
    }
    function saveItems(items) {
      try {
        getStorage().setItem(STORE_KEY, JSON.stringify(items.slice(0, MAX_STORED_ITEMS).map(({ snapshot, ...item }) => item)));
        return true;
      } catch {
        return false;
      }
    }
    function loadHiddenChat() {
      try {
        const parsed = JSON.parse(getStorage().getItem(HIDDEN_CHAT_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
      } catch {
        return [];
      }
    }
    function saveHiddenChat(ids) {
      try {
        getStorage().setItem(HIDDEN_CHAT_KEY, JSON.stringify([...new Set(ids)].slice(-1e3)));
        return true;
      } catch {
        return false;
      }
    }
    return { loadItems, saveItems, loadHiddenChat, saveHiddenChat };
  }

  // src/client/ui/Icon.js
  var PATHS = {
    sparkles: ["m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"],
    image: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z", "m3 16 5-5 4 4 3-3 6 6", "M8 7h.01"],
    video: ["M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z", "m17 9 5-3v12l-5-3"],
    plus: ["M12 5v14", "M5 12h14"],
    close: ["m6 6 12 12", "M18 6 6 18"],
    search: ["M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z", "m16 16 5 5"],
    arrow: ["M12 19V5", "m5 12 7-7 7 7"],
    chevron: ["m6 9 6 6 6-6"],
    download: ["M12 3v12", "m7 10 5 5 5-5", "M4 16v4h16v-4"],
    expand: ["M9 3H3v6", "M15 3h6v6", "M3 15v6h6", "M21 15v6h-6"],
    reuse: ["M4 10a8 8 0 1 1 1 8", "M4 3v7h7"],
    settings: ["M4 7h16", "M4 17h16", "M8 4v6", "M16 14v6"],
    check: ["m5 12 4 4L19 6"],
    clock: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7v5l3 2"],
    alert: ["M12 3 2 21h20L12 3Z", "M12 9v5", "M12 17h.01"],
    copy: ["M8 8h12v13H8V8Z", "M16 8V3H3v13h5"],
    external: ["M14 3h7v7", "m10 14 11-11", "M10 3H3v18h18v-7"],
    layers: ["m12 3 10 5-10 5L2 8l10-5Z", "m2 12 10 5 10-5", "m2 16 10 5 10-5"]
  };
  function createIcon(React) {
    const h = React.createElement;
    return function Icon({ name, size = 18, className = "" }) {
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false, className: `jz-icon ${className}` },
        (PATHS[name] || PATHS.sparkles).map((d, index) => h("path", { key: index, d }))
      );
    };
  }

  // src/client/ui/usePanelLayout.js
  function createUsePanelLayout(React) {
    const { useState, useRef, useEffect } = React;
    return function usePanelLayout() {
      const ref = useRef(null);
      const [layout, setLayout] = useState("medium");
      useEffect(() => {
        const update = (width) => setLayout(width < 480 ? "compact" : width < 760 ? "narrow" : width < 1120 ? "medium" : "wide");
        const measure = () => update(ref.current?.getBoundingClientRect().width || window.innerWidth);
        measure();
        if (typeof window.ResizeObserver === "function") {
          const observer = new window.ResizeObserver((entries) => update(entries[0].contentRect.width));
          observer.observe(ref.current);
          return () => observer.disconnect();
        }
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
      }, []);
      return { ref, layout };
    };
  }

  // src/client/domain/model-capabilities.js
  function modelChoices(models, type) {
    return Array.isArray(models[type]) ? models[type] : [];
  }
  function modelValue(model) {
    return JSON.stringify([model.channelId || "", model.id]);
  }
  function modelById(models, type, id, channelId) {
    const choices = modelChoices(models, type);
    const exact = choices.find((entry) => modelValue(entry) === id);
    if (exact) return exact;
    const matches = choices.filter((entry) => entry.id === id && (!channelId || entry.channelId === channelId));
    return matches.length === 1 ? matches[0] : null;
  }
  function paramEntries(model) {
    const parameters = model && model.parameters && typeof model.parameters === "object" ? model.parameters : {};
    return Object.entries(parameters).filter(([key]) => key !== "prompt");
  }
  function defaultParams(model) {
    const out = {};
    for (const [key, spec] of paramEntries(model)) {
      if (spec && spec.default !== void 0 && spec.default !== null) out[key] = spec.default;
    }
    return out;
  }
  var SIZE_BY_RATIO = {
    "1:1": "1024x1024",
    "4:3": "1152x864",
    "3:4": "864x1152",
    "16:9": "1536x864",
    "9:16": "864x1536",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "21:9": "1792x768"
  };
  function ratioToSize(ratio) {
    return SIZE_BY_RATIO[ratio] || "";
  }
  function sizeToRatio(size) {
    if (typeof size !== "string" || size === "" || size === "auto") return "";
    const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
    if (!match) return "";
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!width || !height) return "";
    const target = width / height;
    let best = "";
    let distance = Infinity;
    for (const [ratio, pixels] of Object.entries(SIZE_BY_RATIO)) {
      const [w, h] = pixels.split("x").map(Number);
      const gap = Math.abs(w / h - target);
      if (gap < distance) {
        distance = gap;
        best = ratio;
      }
    }
    return best;
  }
  function paramsForModel(model, params) {
    const specs = model && model.parameters && typeof model.parameters === "object" ? model.parameters : {};
    const out = {};
    for (const [key, value] of Object.entries(params || {})) {
      if (value === "" || value === void 0 || value === null) continue;
      if (!specs[key]) continue;
      out[key] = value;
    }
    if (out.size !== void 0) {
      if (out.aspect_ratio !== void 0) delete out.aspect_ratio;
      if (out.size === out.resolution) delete out.resolution;
    }
    return out;
  }
  function referenceRoles(model) {
    const specs = model && Array.isArray(model.references) ? model.references : [];
    const limitFor = (role, kind = "image") => {
      const spec = specs.find((entry) => entry && entry.role === role && Array.isArray(entry.types) && entry.types.includes(kind));
      return spec ? Number(spec.max_count ?? 1) : 0;
    };
    return {
      reference: limitFor("reference", "image") > 0,
      referenceLimit: limitFor("reference", "image"),
      firstFrame: limitFor("first_frame", "image") > 0,
      lastFrame: limitFor("last_frame", "image") > 0
    };
  }

  // src/client/domain/drafts.js
  var emptyDraft = () => ({ modelId: null, params: {}, imageCount: 1, prompt: "", refs: [], frames: { first: null, last: null }, unhandledReferences: [], notice: "", epoch: 0 });
  function draftFromWork(item, snapshot, models) {
    const input = snapshot || { kind: item.type, channelId: item.channelId, model: item.model, prompt: item.prompt, params: item.params };
    if (!["image", "video"].includes(input.kind)) throw new Error("Invalid work type");
    const selected = modelById(models, input.kind, input.model, input.channelId);
    const draft = {
      ...emptyDraft(),
      modelId: selected ? modelValue(selected) : modelValue({ id: input.model || "", channelId: input.channelId || "" }),
      prompt: input.prompt || "",
      params: { ...input.params },
      notice: snapshot ? "editRestoredHint" : "editLegacyHint"
    };
    if (input.kind === "image") draft.params.n = 1;
    for (const reference of input.references || []) {
      const asset = { url: reference.url, name: reference.name || reference.role };
      if (reference.type !== "image" || !reference.url) draft.unhandledReferences.push({ ...reference });
      else if (reference.role === "reference") draft.refs.push(asset);
      else if (input.kind === "video" && reference.role === "first_frame" && !draft.frames.first) draft.frames.first = asset;
      else if (input.kind === "video" && reference.role === "last_frame" && !draft.frames.last) draft.frames.last = asset;
      else draft.unhandledReferences.push({ ...reference });
    }
    return { type: input.kind, draft };
  }
  function referenceIssue(draft, model, type) {
    const roles = referenceRoles(model);
    return draft.unhandledReferences?.length || draft.refs.length > roles.referenceLimit || draft.refs.length && !roles.reference || draft.frames.first && (type !== "video" || !roles.firstFrame) || draft.frames.last && (type !== "video" || !roles.lastFrame) ? "referenceUnsupported" : "";
  }
  function referencePlacement(draft, model, type, reference, requested = "auto") {
    if (reference.type !== "image" || typeof reference.url !== "string" || !reference.url || /^data:(?!image\/)/i.test(reference.url)) return { error: "referenceImageOnly" };
    const issue = referenceIssue(draft, model, type);
    if (issue) return { error: issue };
    const roles = referenceRoles(model);
    let slot = requested;
    if (slot === "auto") {
      if (type === "video" && roles.firstFrame && !draft.frames.first) slot = "first";
      else if (type === "video" && roles.lastFrame && !draft.frames.last) slot = "last";
      else if (roles.reference) slot = "reference";
      else return { error: roles.firstFrame || roles.lastFrame ? "framesFull" : "referenceUnsupported" };
    }
    if (slot === "reference") {
      if (!roles.reference) return { error: "referenceUnsupported" };
      if (draft.refs.length >= roles.referenceLimit) return { error: "refsFull" };
    } else if (type !== "video" || (slot === "first" ? !roles.firstFrame : slot !== "last" || !roles.lastFrame)) return { error: "referenceUnsupported" };
    const asset = { url: reference.url, name: reference.name };
    const next = slot === "reference" ? { ...draft, refs: [...draft.refs, asset] } : { ...draft, frames: { ...draft.frames, [slot]: asset } };
    const total = [...next.refs, next.frames.first, next.frames.last].filter(Boolean).reduce((sum, entry) => sum + entry.url.length, 0);
    return total > 36e5 ? { error: "referencesTooLarge" } : { slot, draft: next };
  }

  // src/client/domain/works.js
  var PENDING = /* @__PURE__ */ new Set(["queued", "running", "reconciling", "submitting", "submission_unknown", "prepared"]);
  function newId() {
    return globalThis.crypto?.randomUUID?.() || `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
  var isPending = (item) => PENDING.has(item.status);
  function statusLabel(status, translate) {
    if (status === "queued") return translate("queued");
    if (status === "running") return translate("running");
    if (status === "succeeded") return translate("succeeded");
    if (status === "failed") return translate("failed");
    if (status === "reconciling") return translate("reconciling");
    if (status === "cancelled") return translate("cancelled");
    if (status === "submitting") return translate("submitting");
    if (status === "submission_unknown") return translate("submissionUnknown");
    if (status === "prepared") return translate("prepared");
    return status || "";
  }
  var ASSET = "/api/mote-media/asset";
  function isNonPublicUrl(value) {
    if (typeof value !== "string" || value === "" || value.startsWith("data:")) return false;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return false;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "" || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
    if (host === "0.0.0.0" || host === "::" || host === "::1") return true;
    const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (v4) {
      const a = Number(v4[1]);
      const b = Number(v4[2]);
      return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
    }
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(host);
  }
  function primaryMedia(item) {
    const artifacts = Array.isArray(item.artifacts) ? item.artifacts : [];
    const usable = artifacts.filter(
      (artifact) => artifact && artifact.state === "available" && typeof artifact.url === "string"
    );
    if (usable.length === 0) return null;
    const wanted = item.type === "video" ? "video" : "image";
    const indexed = Number.isInteger(item.artifactIndex) ? artifacts[item.artifactIndex] : null;
    const picked = Number.isInteger(item.artifactIndex) ? usable.includes(indexed) ? indexed : null : usable.find((artifact) => artifact.kind === wanted) || usable.find((artifact) => artifact.kind === "image") || usable[0];
    if (!picked) return null;
    const video = picked.kind === "video" || typeof picked.mimeType === "string" && picked.mimeType.startsWith("video/");
    const expiry = typeof picked.expiresAt === "string" ? Date.parse(picked.expiresAt) : NaN;
    const local = item.saved?.find((entry) => entry.artifactIndex === artifacts.indexOf(picked) && !entry.error && entry.url);
    const source = local?.url || picked.url;
    const display = isNonPublicUrl(source) ? `${ASSET}?url=${encodeURIComponent(source)}` : source;
    return { url: display, source, video, expiresAt: local ? null : Number.isFinite(expiry) ? expiry : null };
  }
  function groupKey(item) {
    return item.submissionId || (item.taskId ? JSON.stringify([item.channelId || "", item.taskId]) : item.groupId || item.id);
  }
  function normalizeWorks(items) {
    const groups = /* @__PURE__ */ new Map();
    for (const item of items) {
      const key = groupKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.values()].flatMap((siblings) => {
      const base = siblings[0];
      const groupId = base.groupId || base.id;
      const hiddenArtifacts = [...new Set(siblings.flatMap((item) => item.hiddenArtifacts || []))];
      const artifacts = Array.isArray(base.artifacts) ? base.artifacts : [];
      const outputs = artifacts.flatMap((artifact, position) => artifact && artifact.kind === base.type && artifact.state === "available" && artifact.url && !hiddenArtifacts.includes(position) ? [position] : []);
      if (outputs.length === 0) return [{ ...base, groupId, hiddenArtifacts }];
      return outputs.map((position, index) => ({
        ...base,
        id: index === 0 ? groupId : `${groupId}-${position}`,
        groupId,
        hiddenArtifacts,
        artifactIndex: position
      }));
    });
  }
  function mergeWorkTask(items, taskId, task, channelId) {
    return normalizeWorks(items.map((item) => {
      if (item.taskId !== taskId || channelId && item.channelId && item.channelId !== channelId) return item;
      if (["succeeded", "failed", "cancelled"].includes(item.status) && PENDING.has(task.status)) return item;
      return {
        ...item,
        taskId: task.id || taskId,
        model: task.model || item.model,
        status: task.status || item.status,
        progress: task.progress ?? item.progress,
        artifacts: task.artifacts?.length ? task.artifacts : item.artifacts,
        error: task.error ?? null,
        billing: task.billing ?? item.billing ?? null,
        requestId: task.requestId ?? item.requestId ?? null
      };
    }));
  }
  function removeWork(items, target) {
    const key = groupKey(target);
    return items.filter((item) => item.id !== target.id).map((item) => groupKey(item) === key ? { ...item, hiddenArtifacts: [.../* @__PURE__ */ new Set([...item.hiddenArtifacts || [], target.artifactIndex])] } : item);
  }
  function mergeSubmissionWorks(items, submission) {
    return normalizeWorks(items.map((item) => {
      if (item.submissionId !== submission.id) return item;
      const task = submission.task;
      if (["succeeded", "failed", "cancelled"].includes(item.status) && (!task || PENDING.has(task.status))) return item;
      return {
        ...item,
        channelId: submission.channelId || item.channelId,
        snapshotAvailable: submission.snapshotAvailable === true,
        ...submission.saved ? { saved: submission.saved } : {},
        status: task?.status || { prepared: "prepared", submitting: "submitting", unknown: "submission_unknown", failed: "failed" }[submission.state] || item.status,
        taskId: task?.id || item.taskId,
        model: task?.model || item.model,
        progress: task?.progress ?? item.progress,
        artifacts: task?.artifacts?.length ? task.artifacts : item.artifacts,
        error: task?.error || submission.error || null,
        billing: task?.billing ?? item.billing ?? null,
        requestId: task?.requestId ?? item.requestId ?? null,
        recoveryRequired: submission.state === "unknown",
        queryError: submission.queryError || null
      };
    }));
  }
  function mergeChatWorks(items, submissions, hidden = /* @__PURE__ */ new Set()) {
    const receipts = submissions.filter((entry) => entry?.source === "chat" && typeof entry.id === "string" && !hidden.has(entry.id));
    const known = new Set(items.map((item) => item.submissionId));
    let next = [...items, ...receipts.filter((entry) => !known.has(entry.id)).map((entry) => ({
      id: entry.id,
      groupId: entry.id,
      submissionId: entry.id,
      source: "chat",
      type: entry.kind,
      channelId: entry.channelId,
      model: entry.model,
      prompt: entry.creation?.prompt || "",
      originalPrompt: entry.creation?.originalPrompt || "",
      params: entry.creation?.params || {},
      createdAt: entry.createdAt,
      status: "submitting",
      artifacts: []
    }))];
    for (const receipt of receipts) next = mergeSubmissionWorks(next, receipt);
    return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  var canRegenerate = (item) => Boolean(item.submissionId && item.snapshotAvailable && ["succeeded", "failed", "cancelled"].includes(item.status));
  function downloadOutcome(result) {
    const saved = Array.isArray(result.saved) ? result.saved : [];
    const failed = saved.filter((entry) => !entry.path || Object.hasOwn(entry, "error"));
    return { succeeded: saved.length - failed.length, failed };
  }
  function diagnosticsOf(item) {
    return JSON.stringify(
      {
        type: item.type,
        model: item.model,
        task: item.taskId || null,
        submission: item.submissionId || null,
        channel: item.channelId || null,
        artifactIndex: item.artifactIndex ?? null,
        request: item.requestId || null,
        status: item.status,
        error: item.error || null,
        billing: item.billing || null,
        prompt: item.prompt || "",
        params: item.params || {}
      },
      null,
      2
    );
  }

  // src/client/ui/presentation.js
  function modelDisplayName(id = "") {
    const match = /^doubao-(seedream|seedance)-(\d+)-(\d+)(?:-(lite|pro|fast|mini))?(?:-|$)/i.exec(id);
    if (match) return `${match[1] === "seedream" ? "Seedream" : "Seedance"} ${match[2]}.${match[3]}${match[4] ? ` ${match[4][0].toUpperCase()}${match[4].slice(1)}` : ""}`;
    return id;
  }
  function taskCost(billing) {
    if (billing?.amount === void 0 || billing.amount === null) return "";
    const currency = billing.currency || "CNY";
    return `${currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency} `}${billing.amount}`;
  }
  function statusTone(status) {
    return status === "failed" ? "error" : status === "submission_unknown" || status === "prepared" ? "warning" : status === "succeeded" ? "success" : status === "cancelled" ? "muted" : "pending";
  }

  // src/client/ui/Menu.js
  function createMenu(React) {
    const h = React.createElement;
    const Icon = createIcon(React);
    const { useState, useEffect, useRef } = React;
    function Menu({ label, value, current, items, onPick, width, hideLabel = false, icon, variant = "", searchLabel, emptyLabel }) {
      const [open, setOpen] = useState(false);
      const [placement, setPlacement] = useState(null);
      const [query, setQuery] = useState("");
      const boxRef = useRef(null);
      const anchorRef = useRef(null);
      const searchRef = useRef(null);
      const listRef = useRef(null);
      const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const visibleItems = [];
      let group = null;
      let groupShown = false;
      for (const item of items || []) {
        if (item.header) {
          group = item;
          groupShown = false;
          continue;
        }
        const text = [item.label, item.description, group?.label].filter(Boolean).join(" ").toLocaleLowerCase();
        if (!terms.every((term) => text.includes(term))) continue;
        if (group && !groupShown) {
          visibleItems.push(group);
          groupShown = true;
        }
        visibleItems.push(item);
      }
      const reveal = (choice) => {
        const list = listRef.current;
        if (!choice || !list) return;
        const top = choice.offsetTop;
        const bottom = top + choice.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      };
      useEffect(() => {
        if (!open) return void 0;
        const onDown = (event) => {
          if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
        };
        const onScroll = (event) => {
          if (boxRef.current && event && event.target instanceof Node && boxRef.current.contains(event.target)) return;
          setOpen(false);
        };
        const onKey = (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            anchorRef.current?.focus({ preventScroll: true });
          }
          const choices = [...listRef.current?.querySelectorAll('[role="menuitemradio"]') || []];
          if (event.key === "Enter" && document.activeElement === searchRef.current) {
            event.preventDefault();
            choices[0]?.click();
            return;
          }
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          const index = choices.indexOf(document.activeElement);
          const next = index < 0 ? event.key === "ArrowDown" ? 0 : choices.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
          choices[next]?.focus({ preventScroll: true });
          reveal(choices[next]);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onDown);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("pointerdown", onDown);
          window.removeEventListener("scroll", onScroll, true);
          window.removeEventListener("resize", onScroll);
        };
      }, [open]);
      useEffect(() => {
        if (open && placement) {
          const selected = boxRef.current?.querySelector('[aria-checked="true"]') || boxRef.current?.querySelector('[role="menuitemradio"]');
          (searchRef.current || selected)?.focus({ preventScroll: true });
          reveal(selected);
        }
      }, [open]);
      useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = 0;
      }, [query]);
      const openMenu = () => {
        setQuery("");
        const rect = anchorRef.current ? anchorRef.current.getBoundingClientRect() : null;
        if (!rect) {
          setOpen((wasOpen) => !wasOpen);
          return;
        }
        const margin = 12;
        const panel = anchorRef.current.closest(".jz-root")?.getBoundingClientRect();
        const leftEdge = Math.max(margin, panel?.left || 0);
        const rightEdge = Math.min(window.innerWidth - margin, panel?.right || window.innerWidth);
        const menuWidth = Math.min(Math.max(rect.width, width || 0), Math.max(0, rightEdge - leftEdge));
        const gap = 6;
        const topEdge = Math.max(margin, (panel?.top || 0) + margin);
        const bottomEdge = Math.min(window.innerHeight - margin, (panel?.bottom || window.innerHeight) - margin);
        const spaceAbove = Math.max(0, rect.top - topEdge - gap);
        const spaceBelow = Math.max(0, bottomEdge - rect.bottom - gap);
        const limit = Math.min(260, Math.max(0, bottomEdge - topEdge) * 0.4);
        const desired = Math.min(limit, 12 + (searchLabel ? 46 : 0) + items.reduce((height, item) => height + (item.header ? 28 : item.description ? 50 : 36), 0));
        const upward = spaceBelow < Math.min(desired, 120) && spaceAbove > spaceBelow;
        const room = Math.min(limit, upward ? spaceAbove : spaceBelow);
        setPlacement({
          left: Math.max(leftEdge, Math.min(rect.left, rightEdge - menuWidth)),
          width: menuWidth,
          maxHeight: room,
          ...upward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }
        });
        setOpen((wasOpen) => !wasOpen);
      };
      if (!items || items.filter((item) => !item.header).length === 0) {
        return h("span", { className: "jz-static" }, value);
      }
      return h(
        "div",
        { className: "jz-menu", ref: boxRef },
        h(
          "button",
          {
            type: "button",
            ref: anchorRef,
            className: `jz-chip ${variant}${open ? " open" : ""}`,
            "aria-label": `${label || ""} ${value || ""}`.trim(),
            "aria-expanded": open,
            "aria-haspopup": "menu",
            onClick: openMenu
          },
          icon ? h(Icon, { name: icon, size: 16 }) : null,
          label && !hideLabel ? h("span", { className: "jz-chip-label" }, label) : null,
          h("span", { className: "jz-chip-value" }, value),
          h("span", { className: "jz-caret" }, h(Icon, { name: "chevron", size: 13 }))
        ),
        open && placement ? h(
          "div",
          {
            className: "jz-drop",
            role: "menu",
            "aria-label": label,
            style: {
              position: "fixed",
              left: `${placement.left}px`,
              top: placement.top === void 0 ? void 0 : `${placement.top}px`,
              bottom: placement.bottom === void 0 ? void 0 : `${placement.bottom}px`,
              width: `${placement.width}px`,
              maxHeight: `${placement.maxHeight}px`
            }
          },
          searchLabel ? h(
            "div",
            { className: "jz-drop-search" },
            h(Icon, { name: "search", size: 15 }),
            h("input", {
              ref: searchRef,
              type: "search",
              value: query,
              "aria-label": searchLabel,
              placeholder: searchLabel,
              onChange: (event) => setQuery(event.target.value)
            })
          ) : null,
          h(
            "div",
            { className: "jz-drop-list", ref: listRef },
            visibleItems.length ? visibleItems.map(
              (item) => item.header ? h("div", { key: String(item.value), className: "jz-drop-head" }, item.label) : h(
                "button",
                {
                  key: String(item.value),
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": String(item.value) === String(current),
                  className: `jz-drop-item${String(item.value) === String(current) ? " on" : ""}`,
                  title: [item.label, item.description].filter(Boolean).join("\n"),
                  onClick: () => {
                    setOpen(false);
                    onPick(item.value);
                    anchorRef.current?.focus({ preventScroll: true });
                  }
                },
                h("span", { className: "jz-option-label" }, h("span", null, item.label), item.description ? h("small", null, item.description) : null),
                String(item.value) === String(current) ? h(Icon, { name: "check", size: 15 }) : null
              )
            ) : h("div", { className: "jz-drop-empty", role: "status" }, emptyLabel)
          )
        ) : null
      );
    }
    return Menu;
  }

  // src/client/features/composer/Composer.js
  function createComposer(React, t) {
    const h = React.createElement;
    const Icon = createIcon(React);
    const { useState, useRef } = React;
    const Menu = createMenu(React);
    const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
    function readFileAsDataUrl(file, onLoad, onError) {
      if (file.size > MAX_REFERENCE_BYTES) {
        onError(t("uploading"));
        return;
      }
      if (!file.type?.startsWith("image/")) {
        onError(t("referenceImageOnly"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onLoad(String(reader.result || ""));
      reader.onerror = () => onError("cannot read the file");
      reader.readAsDataURL(file);
    }
    function Composer(props) {
      const { type, models, modelId, params, imageCount = 1, prompt, refs, frames, busy, error, blocked, notice, draftIssue, unhandledReferences = [], onRemoveUnhandled, onType, onModel, onParams, onCount, onPrompt, onRefs, onFrames, onAddReference, onRun, textareaRef } = props;
      const model = modelById(models, type, modelId);
      const roles = referenceRoles(model);
      const fileInput = useRef(null);
      const slotRef = useRef("reference");
      const currentType = useRef(type);
      currentType.current = type;
      const [note, setNote] = useState("");
      const pick = (slot) => {
        if (slot === "reference" && !roles.reference || slot === "first" && !roles.firstFrame || slot === "last" && !roles.lastFrame) {
          setNote(t("referenceUnsupported"));
          return;
        }
        slotRef.current = slot;
        if (fileInput.current) fileInput.current.click();
      };
      const slotKeyboard = (slot) => (event) => {
        if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
          pick(slot);
        }
      };
      const onFile = (event) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        const slot = slotRef.current;
        const add = onAddReference;
        const showNote = (message) => {
          if (fileInput.current && currentType.current === type) setNote(message);
        };
        readFileAsDataUrl(
          file,
          (dataUrl) => {
            const issue = add({ type: "image", url: dataUrl, name: file.name }, slot);
            showNote(issue ? t(issue) : "");
          },
          showNote
        );
      };
      const ratioSpec = model && model.parameters ? model.parameters.aspect_ratio : null;
      const sizeSpec = model && model.parameters ? model.parameters.size : null;
      const supportsRatio = Boolean(ratioSpec && Array.isArray(ratioSpec.enum));
      const supportsSize = Boolean(sizeSpec);
      const ratioValues = supportsRatio ? ratioSpec.enum : supportsSize ? Object.keys(SIZE_BY_RATIO) : [];
      const ratioItems = ratioValues.map((value) => ({ value, label: value }));
      const ratioCurrent = supportsRatio ? params.aspect_ratio || ratioSpec && ratioSpec.default || ratioItems[0].value : sizeToRatio(params.size) || sizeToRatio(sizeSpec && sizeSpec.default) || ratioItems[0] && ratioItems[0].value || "";
      const pickRatio = (value) => {
        if (supportsRatio) onParams({ ...params, aspect_ratio: value });
        else onParams({ ...params, size: ratioToSize(value) || value });
      };
      const qualitySpec = model && model.parameters ? model.parameters.resolution : null;
      const qualityItems = qualitySpec && Array.isArray(qualitySpec.enum) ? qualitySpec.enum.map((value) => ({ value, label: value })) : [];
      const qualityCurrent = params.resolution || qualitySpec && qualitySpec.default || qualityItems[0] && qualityItems[0].value;
      const countLabel = (value) => `${value}${t("countSuffix")}`;
      const countItems = Array.from({ length: 15 }, (_, index) => ({ value: index + 1, label: countLabel(index + 1) }));
      const durationSpec = model && model.parameters ? model.parameters.duration : null;
      const durationItems = (() => {
        if (!durationSpec) return [];
        const min = Math.max(1, Number.isFinite(durationSpec.minimum) ? durationSpec.minimum : 3);
        const max = Number.isFinite(durationSpec.maximum) ? durationSpec.maximum : 10;
        const out = [];
        for (let value = min; value <= Math.min(max, 15); value += 1) out.push({ value, label: `${value}${t("secondsSuffix")}` });
        return out;
      })();
      const durationCurrent = params.duration ?? (durationSpec && durationSpec.default) ?? (durationItems[0] && durationItems[0].value);
      const catalog = modelChoices(models, type);
      const channelNames = [];
      for (const row of catalog) {
        const name = row.channelName || "mote";
        if (!channelNames.includes(name)) channelNames.push(name);
      }
      const modelItems = [];
      if (channelNames.length > 1) {
        for (const name of channelNames) {
          modelItems.push({ header: true, value: `__head:${name}`, label: name });
          for (const row of catalog.filter((entry) => (entry.channelName || "mote") === name)) {
            modelItems.push({ value: modelValue(row), label: modelDisplayName(row.id), description: modelDisplayName(row.id) === row.id ? "" : row.id });
          }
        }
      } else {
        for (const row of catalog) modelItems.push({ value: modelValue(row), label: modelDisplayName(row.id), description: modelDisplayName(row.id) === row.id ? "" : row.id });
      }
      const showFrames = type === "video" && (roles.firstFrame || roles.lastFrame || frames.first || frames.last);
      const showRefs = refs.length > 0 || roles.reference && (type === "image" || !roles.firstFrame);
      const audioOn = params.generate_audio === void 0 ? Boolean(model && model.parameters && model.parameters.generate_audio && model.parameters.generate_audio.default === true) : params.generate_audio === true;
      return h(
        "section",
        { className: "jz-composer" },
        notice ? h("div", { className: "jz-composer-notice", role: "status" }, t(notice)) : null,
        unhandledReferences.length ? h(
          "div",
          { className: "jz-unhandled-refs" },
          unhandledReferences.map((reference, index) => h(
            "div",
            { key: index },
            h("span", null, `${reference.name || reference.role || t("references")} · ${reference.type || "—"}`),
            h("button", { type: "button", className: "jz-text-btn", onClick: () => onRemoveUnhandled(index) }, t("removeRef"))
          ))
        ) : null,
        h(
          "div",
          { className: "jz-composer-main" },
          h(
            "div",
            { className: "jz-slots" },
            showFrames ? h(
              React.Fragment,
              null,
              h(
                "div",
                { className: `jz-slot${frames.first ? " filled" : ""}`, title: t("firstFrame"), role: "button", tabIndex: 0, onKeyDown: slotKeyboard("first"), onClick: () => pick("first") },
                frames.first ? h("img", { src: frames.first.url, alt: "" }) : h(Icon, { name: "plus", size: 22 }),
                h("span", { className: "cap" }, t("firstFrame")),
                frames.first ? h("button", {
                  type: "button",
                  "aria-label": t("removeRef"),
                  className: "del",
                  onClick: (event) => {
                    event.stopPropagation();
                    onFrames({ ...frames, first: null });
                  }
                }, h(Icon, { name: "close", size: 12 })) : null
              ),
              roles.lastFrame || frames.last ? h(
                "div",
                { className: `jz-slot${frames.last ? " filled" : ""}`, title: t("lastFrame"), role: "button", tabIndex: 0, onKeyDown: slotKeyboard("last"), onClick: () => pick("last") },
                frames.last ? h("img", { src: frames.last.url, alt: "" }) : h(Icon, { name: "plus", size: 22 }),
                h("span", { className: "cap" }, t("lastFrame")),
                frames.last ? h("button", {
                  type: "button",
                  "aria-label": t("removeRef"),
                  className: "del",
                  onClick: (event) => {
                    event.stopPropagation();
                    onFrames({ ...frames, last: null });
                  }
                }, h(Icon, { name: "close", size: 12 })) : null
              ) : null
            ) : null,
            showRefs ? h(
              React.Fragment,
              null,
              refs.map(
                (ref, index) => h(
                  "div",
                  { key: `${index}-${ref.url.length}`, className: "jz-slot filled", title: ref.name || t("references") },
                  h("img", { src: ref.url, alt: "" }),
                  h("button", {
                    type: "button",
                    "aria-label": t("removeRef"),
                    className: "del",
                    onClick: () => onRefs(refs.filter((_, i) => i !== index))
                  }, h(Icon, { name: "close", size: 12 }))
                )
              ),
              roles.reference && refs.length < Math.max(1, roles.referenceLimit) ? h(
                "div",
                { className: "jz-slot", title: t("references"), role: "button", tabIndex: 0, onKeyDown: slotKeyboard("reference"), onClick: () => pick("reference") },
                h(Icon, { name: "plus", size: 22 }),
                h("span", { className: "cap" }, t("references"))
              ) : null
            ) : null
          ),
          h("textarea", {
            ref: textareaRef,
            className: "jz-prompt",
            value: prompt,
            placeholder: t("promptPlaceholder"),
            onChange: (event) => onPrompt(event.target.value),
            onKeyDown: (event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                onRun();
              }
            }
          }),
          h("input", { ref: fileInput, type: "file", accept: "image/*", style: { display: "none" }, onChange: onFile })
        ),
        h(
          "div",
          { className: "jz-bar" },
          h(Menu, {
            label: t("typeLabel"),
            hideLabel: true,
            icon: type === "video" ? "video" : "image",
            variant: "jz-chip-mode",
            value: type === "image" ? t("modeImage") : t("modeVideo"),
            current: type,
            items: [
              { value: "image", label: t("modeImage") },
              { value: "video", label: t("modeVideo") }
            ],
            onPick: onType,
            width: 160
          }),
          h(Menu, {
            label: t("modelLabel"),
            hideLabel: true,
            value: model ? `${channelNames.length > 1 ? `${model.channelName || model.channelId} · ` : ""}${modelDisplayName(model.id)}` : t("chooseModel"),
            current: model ? modelValue(model) : modelId,
            items: modelItems,
            onPick: onModel,
            width: 280,
            searchLabel: t("searchModels"),
            emptyLabel: t("noMatchingModels")
          }),
          ratioItems.length > 1 && (type === "image" || !roles.firstFrame) ? h(Menu, {
            label: t("ratioLabel"),
            hideLabel: true,
            value: ratioCurrent,
            current: ratioCurrent,
            items: ratioItems,
            onPick: pickRatio,
            width: 150
          }) : null,
          qualityItems.length > 1 ? h(Menu, {
            label: t("qualityLabel"),
            hideLabel: true,
            value: qualityCurrent,
            current: qualityCurrent,
            items: qualityItems,
            onPick: (value) => onParams({ ...params, resolution: value }),
            width: 140
          }) : null,
          type === "image" && model ? h(Menu, {
            label: t("countLabel"),
            hideLabel: true,
            value: countLabel(imageCount),
            current: imageCount,
            items: countItems,
            onPick: onCount,
            width: 120
          }) : null,
          type === "video" && durationItems.length > 1 ? h(Menu, {
            label: t("durationLabel"),
            hideLabel: true,
            value: `${durationCurrent}${t("secondsSuffix")}`,
            current: durationCurrent,
            items: durationItems,
            onPick: (value) => onParams({ ...params, duration: value }),
            width: 120
          }) : null,
          type === "video" && model && model.parameters && model.parameters.generate_audio ? h(
            "button",
            {
              type: "button",
              className: "jz-chip",
              "aria-label": t("audioLabel"),
              "aria-pressed": audioOn,
              onClick: () => onParams({ ...params, generate_audio: !audioOn })
            },
            h("span", { className: "jz-chip-label" }, t("audioLabel")),
            h("span", { className: "jz-chip-value" }, audioOn ? t("on") : t("off"))
          ) : null,
          h("span", { className: "jz-spacer" }),
          note ? h("span", { className: "jz-note" }, note) : null,
          h(
            "button",
            {
              type: "button",
              className: "jz-send",
              disabled: busy || prompt.trim() === "" || !model || blocked || Boolean(draftIssue),
              title: blocked ? t("needKey") : t("send"),
              "aria-label": t("send"),
              onClick: onRun
            },
            busy ? h("span", { className: "jz-send-spin" }) : h(Icon, { name: "arrow", size: 21 })
          )
        ),
        error || draftIssue ? h("div", { className: "jz-error", role: "alert" }, h(Icon, { name: "alert", size: 16 }), h("span", null, error || t(draftIssue))) : null,
        h("div", { className: "jz-composer-help" }, h("span", null, t(type === "image" && imageCount > 1 ? "independentImagesHint" : "composerHint")), h("span", { className: "jz-key-hint" }, h("kbd", null, "⌘ / Ctrl"), " + ", h("kbd", null, "Enter")))
      );
    }
    return Composer;
  }

  // src/client/features/composer/useDrafts.js
  function createUseDrafts(React) {
    const { useState, useRef, useEffect } = React;
    return function useDrafts(models, config) {
      const [editor, setEditor] = useState(() => ({ type: "image", drafts: { image: emptyDraft(), video: emptyDraft() } }));
      const current = useRef(editor);
      const version = useRef(0);
      const catalog = useRef(models);
      current.current = editor;
      catalog.current = models;
      const commit = (next) => {
        current.current = next;
        setEditor(next);
      };
      useEffect(() => {
        let next = current.current;
        for (const type of ["image", "video"]) {
          if (next.drafts[type].modelId !== null) continue;
          const choices = modelChoices(models, type);
          const preferred = config?.[type === "video" ? "videoModel" : "imageModel"];
          const channel = config?.[type === "video" ? "videoChannelId" : "imageChannelId"];
          const model = choices.find((entry) => entry.id === preferred && (!channel || entry.channelId === channel)) || choices[0];
          if (model) next = { ...next, drafts: { ...next.drafts, [type]: { ...next.drafts[type], modelId: modelValue(model), params: defaultParams(model) } } };
        }
        if (next !== current.current) commit(next);
      }, [models, config]);
      const update = (type, change) => {
        const previous = current.current;
        const draft = previous.drafts[type];
        const patch = typeof change === "function" ? change(draft) : change;
        version.current += 1;
        commit({ ...previous, drafts: { ...previous.drafts, [type]: { ...draft, ...patch } } });
      };
      return {
        type: editor.type,
        draft: editor.drafts[editor.type],
        version,
        patch: (change) => update(editor.type, change),
        switchTo(type) {
          if (type === current.current.type || !["image", "video"].includes(type)) return;
          version.current += 1;
          commit({ ...current.current, type });
        },
        restore({ type, draft }) {
          version.current += 1;
          commit({ type, drafts: { ...current.current.drafts, [type]: { ...draft, epoch: current.current.drafts[type].epoch + 1 } } });
        },
        addReference(reference, slot = "auto") {
          const type = editor.type;
          const draft = current.current.drafts[type];
          if (draft.epoch !== editor.drafts[type].epoch) return "uploadDraftChanged";
          const model = modelById(catalog.current, type, draft.modelId);
          const result = referencePlacement(draft, model, type, reference, slot);
          if (result.error) return result.error;
          update(type, result.draft);
          return "";
        }
      };
    };
  }

  // src/client/features/gallery/Tile.js
  function createTile(React, t) {
    const h = React.createElement;
    const { useState, useEffect } = React;
    const Icon = createIcon(React);
    return function Tile({ item, onPreview, onDownload, onUse, onRemove, onRetry, canUse, onRecover, onContinue, onEdit, busy }) {
      const media = primaryMedia(item);
      const [mediaError, setMediaError] = useState(false);
      useEffect(() => setMediaError(false), [media?.url]);
      const tone = statusTone(item.status);
      const pending = isPending(item) && !["submission_unknown", "prepared"].includes(item.status);
      const warning = ["submission_unknown", "prepared"].includes(item.status);
      const progress = Number.isFinite(item.progress) ? Math.max(0, Math.min(100, item.progress)) : 0;
      const cost = taskCost(item.billing);
      const hasActions = media || item.status === "failed" || item.submissionId;
      const hover = (event, play) => {
        const video = event.currentTarget.querySelector("video");
        if (!video) return;
        if (play && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) video.play()?.catch?.(() => {
        });
        else {
          video.pause();
          video.currentTime = 0;
        }
      };
      const action = (name, title, callback, disabled = false, reason = "") => h("button", { type: "button", title: reason || title, "aria-label": title, disabled, onClick: callback }, h(Icon, { name, size: 17 }));
      return h(
        "article",
        { className: `jz-tile is-${tone}`, onMouseEnter: (event) => hover(event, true), onMouseLeave: (event) => hover(event, false) },
        h(
          "div",
          { className: `jz-tile-media${media && !mediaError ? " has-media" : " empty"}` },
          media && !mediaError ? media.video ? h("video", { src: media.url, preload: "metadata", muted: true, playsInline: true, onError: () => setMediaError(true) }) : h("img", { src: media.url, alt: item.prompt || t("preview"), loading: "lazy", onError: () => setMediaError(true) }) : null,
          h(
            "div",
            { className: "jz-tile-badges" },
            h("span", { className: "jz-kind-badge" }, h(Icon, { name: item.type === "video" ? "video" : "image", size: 13 }), item.type === "video" ? t("kindVideo") : t("kindImage")),
            h("span", { className: `jz-status-badge ${tone}` }, h("i"), statusLabel(item.status, t))
          ),
          pending ? h(
            "div",
            { className: "jz-tile-pending" },
            h("span", { className: "jz-spin" }),
            h("strong", null, statusLabel(item.status, t)),
            h("span", null, progress > 0 ? `${progress}%` : t("generationInProgress")),
            progress > 0 ? h("span", { className: "jz-progress-track" }, h("span", { style: { width: `${progress}%` } })) : null
          ) : null,
          item.status === "failed" || warning || mediaError ? h(
            "div",
            { className: `jz-tile-err ${warning || mediaError ? "warning" : ""}` },
            h(Icon, { name: warning ? "clock" : "alert", size: 26 }),
            h("strong", null, mediaError ? t("previewUnavailable") : statusLabel(item.status, t)),
            h("p", null, mediaError ? t("previewUnavailableHint") : warning ? t(item.status === "prepared" ? "preparedHint" : "submissionUnknownHint") : item.error?.message || t("failed"))
          ) : null,
          hasActions ? h(
            "div",
            { className: "jz-tile-actions" },
            action("expand", t("preview"), () => onPreview(item)),
            media ? action("download", t("download"), () => onDownload(item)) : null,
            canUse(item) && onUse ? action("reuse", onUse.label, () => onUse.run(item), onUse.disabled, onUse.reason) : null,
            !isPending(item) || item.status === "prepared" ? action("close", t("remove"), () => onRemove(item)) : null
          ) : null
        ),
        h(
          "div",
          { className: "jz-tile-foot" },
          h("span", { className: "jz-tile-model", title: [item.channelId, item.model].filter(Boolean).join(" · ") }, modelDisplayName(item.model)),
          h("span", { className: "jz-spacer" }),
          media?.expiresAt && media.expiresAt - Date.now() < 6 * 3600 * 1e3 ? h("span", { className: "jz-expiry", title: t("expiring") }, h(Icon, { name: "clock", size: 13 })) : null,
          cost ? h("span", { className: "jz-tile-cost", title: t("taskCostHint") }, cost) : null
        ),
        onEdit || canRegenerate(item) || item.submissionId && isPending(item) ? h(
          "div",
          { className: "jz-tile-followup" },
          onEdit ? h("button", { type: "button", className: "jz-link", disabled: busy, title: t("editAgainHint"), onClick: () => onEdit(item) }, h(Icon, { name: "settings", size: 13 }), t("editAgain")) : null,
          canRegenerate(item) ? h("button", { type: "button", className: "jz-link", title: t("regenerateHint"), onClick: () => onRetry(item) }, h(Icon, { name: "reuse", size: 13 }), t("regenerate")) : null,
          item.submissionId && ["submitting", "submission_unknown"].includes(item.status) && onRecover ? h("button", { type: "button", className: "jz-link", onClick: () => onRecover(item) }, h(Icon, { name: "reuse", size: 13 }), t("recover")) : null,
          item.submissionId && item.status === "prepared" && onContinue ? h("button", { type: "button", className: "jz-link", onClick: () => onContinue(item) }, h(Icon, { name: "arrow", size: 13 }), t("continueSubmission")) : null
        ) : null
      );
    };
  }

  // src/client/features/gallery/Gallery.js
  function createGallery(React, t) {
    const h = React.createElement;
    const Tile = createTile(React, t);
    const Menu = createMenu(React);
    const Icon = createIcon(React);
    return function Gallery({ items, onClearFinished, onPreview, onDownload, onUse, onRemove, onRetry, onRecover, onContinue, onEdit, busy }) {
      const [query, setQuery] = React.useState("");
      const [type, setType] = React.useState("all");
      const [status, setStatus] = React.useState("all");
      const filtered = Boolean(query || type !== "all" || status !== "all");
      const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const visible = items.filter((item) => {
        if (type !== "all" && item.type !== type) return false;
        if (status === "active" ? !["queued", "running", "reconciling", "submitting"].includes(item.status) : status !== "all" && item.status !== status) return false;
        const text = [item.prompt, item.model, modelDisplayName(item.model), item.channelId].filter(Boolean).join(" ").toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
      });
      const finished = visible.filter((item) => !isPending(item));
      const typeItems = [["all", "allTypes"], ["image", "kindImage"], ["video", "kindVideo"]].map(([value, key]) => ({ value, label: t(key) }));
      const statusItems = [["all", "allStatuses"], ["active", "activeTasks"], ["submission_unknown", "submissionUnknown"], ["prepared", "prepared"], ["succeeded", "succeeded"], ["failed", "failed"], ["cancelled", "cancelled"]].map(([value, key]) => ({ value, label: t(key) }));
      return h(
        "section",
        { className: "jz-gallery" },
        h(
          "div",
          { className: "jz-gallery-head" },
          h("div", { className: "jz-gallery-heading" }, h("h2", { className: "jz-gallery-title" }, t("gallery")), h("p", null, t("gallerySubtitle"))),
          h("span", { className: "jz-count", "aria-live": "polite" }, filtered ? `${visible.length} / ${items.length}` : String(items.length)),
          h("span", { className: "jz-spacer" }),
          finished.length ? h("button", { type: "button", className: "jz-btn small ghost", onClick: () => onClearFinished(finished) }, `${t(filtered ? "clearVisibleFinished" : "clearFinished")} (${finished.length})`) : null
        ),
        items.length || filtered ? h(
          "div",
          { className: "jz-gallery-tools" },
          h(
            "label",
            { className: "jz-work-search" },
            h(Icon, { name: "search", size: 16 }),
            h("input", { type: "search", value: query, "aria-label": t("searchWorks"), placeholder: t("searchWorks"), onChange: (event) => setQuery(event.target.value) })
          ),
          h(Menu, { label: t("filterType"), hideLabel: true, value: typeItems.find((item) => item.value === type).label, current: type, items: typeItems, onPick: setType, width: 140 }),
          h(Menu, { label: t("filterStatus"), hideLabel: true, value: statusItems.find((item) => item.value === status).label, current: status, items: statusItems, onPick: setStatus, width: 170 }),
          filtered ? h("button", { type: "button", className: "jz-btn small ghost", onClick: () => {
            setQuery("");
            setType("all");
            setStatus("all");
          } }, t("resetFilters")) : null
        ) : null,
        !visible.length ? h(
          "div",
          { className: "jz-empty" },
          h("strong", null, t(items.length || filtered ? "noMatchingWorks" : "emptyTitle")),
          h("p", null, t(items.length || filtered ? "noMatchingWorksHint" : "empty"))
        ) : h("div", { className: "jz-grid" }, visible.map((item) => h(Tile, {
          key: item.id,
          item,
          onPreview,
          onDownload,
          onUse: onUse(item),
          onRemove,
          onRetry,
          onRecover,
          onContinue,
          onEdit,
          busy,
          canUse: (target) => Boolean(primaryMedia(target))
        })))
      );
    };
  }

  // src/client/ui/useDialog.js
  function createUseDialog(React) {
    const { useRef, useEffect } = React;
    return function useDialog(onClose) {
      const ref = useRef(null);
      const close = useRef(onClose);
      close.current = onClose;
      useEffect(() => {
        const previous = document.activeElement;
        const panel = ref.current;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const focusable = () => [...ref.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),video[controls],[tabindex="0"]')];
        (ref.current.querySelector("[data-autofocus]") || focusable()[0] || ref.current).focus();
        const onKey = (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close.current();
          }
          if (event.key !== "Tab") return;
          const elements = focusable();
          const first = elements[0];
          const last = elements.at(-1);
          if (!elements.length) {
            event.preventDefault();
            ref.current.focus();
          } else if (!ref.current.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener("keydown", onKey);
        return () => {
          document.removeEventListener("keydown", onKey);
          document.body.style.overflow = overflow;
          if (previous?.isConnected && (document.activeElement === document.body || panel.contains(document.activeElement))) previous.focus?.({ preventScroll: true });
        };
      }, []);
      return ref;
    };
  }

  // src/client/features/gallery/Lightbox.js
  function createLightbox(React, t) {
    const h = React.createElement;
    const Icon = createIcon(React);
    const useDialog = createUseDialog(React);
    return function Lightbox({ item, onClose, onDownload, onRetry, onCopy, onUse, onRecover, onContinue, onEdit, busy }) {
      const dialog = useDialog(onClose);
      const media = primaryMedia(item);
      const tone = statusTone(item.status);
      const cost = taskCost(item.billing);
      const parameters = [
        ["aspect_ratio", "ratioLabel"],
        ["size", "sizeLabel"],
        ["resolution", "qualityLabel"],
        ["n", "countLabel"],
        ["duration", "durationLabel"],
        ["generate_audio", "audioLabel"],
        ["seed", "seedLabel"]
      ].filter(([key]) => item.params?.[key] !== void 0 && item.params[key] !== null);
      const metadata = [
        [t("task"), item.taskId],
        [t("submissionId"), item.submissionId],
        [t("requestId"), item.requestId],
        [t("errorCode"), item.error?.code],
        [t("errorStage"), item.error?.stage]
      ];
      const utilities = h(
        "div",
        { className: "jz-detail-utilities" },
        h("button", { type: "button", className: "jz-text-btn", onClick: () => onCopy(item) }, h(Icon, { name: "copy", size: 14 }), t("copyDiag")),
        media ? h("a", { className: "jz-text-btn", href: media.url, target: "_blank", rel: "noreferrer" }, h(Icon, { name: "external", size: 14 }), t("open")) : null,
        h("button", { type: "button", className: "jz-text-btn", onClick: onClose }, t("close"))
      );
      const actions = h(
        "footer",
        { className: "jz-detail-actions" },
        cost ? h("div", { className: "jz-billing" }, h("span", { title: t("taskCostHint") }, t("taskCost")), h("strong", null, cost)) : null,
        h("p", { className: "jz-snapshot-note" }, t(item.snapshotAvailable ? "snapshotSaved" : "snapshotUnavailable")),
        media ? h("button", { type: "button", className: "jz-btn primary", onClick: () => onDownload(item) }, h(Icon, { name: "download", size: 17 }), t("download")) : null,
        onUse && media ? h("button", { type: "button", className: "jz-btn", disabled: onUse.disabled, title: onUse.reason || onUse.label, onClick: () => {
          if (onUse.run(item) !== false) onClose();
        } }, h(Icon, { name: "reuse", size: 16 }), onUse.label) : null,
        onEdit ? h("button", { type: "button", className: "jz-btn", disabled: busy, title: t("editAgainHint"), onClick: () => onEdit(item) }, h(Icon, { name: "settings", size: 16 }), t("editAgain")) : null,
        canRegenerate(item) ? h("button", { type: "button", className: "jz-btn", title: t("regenerateHint"), onClick: () => onRetry(item) }, h(Icon, { name: "sparkles", size: 16 }), t("regenerate")) : null,
        item.submissionId && ["submitting", "submission_unknown"].includes(item.status) && onRecover ? h("button", { type: "button", className: "jz-btn primary", onClick: () => onRecover(item) }, h(Icon, { name: "reuse", size: 16 }), t("recover")) : null,
        item.submissionId && item.status === "prepared" && onContinue ? h("button", { type: "button", className: "jz-btn primary", onClick: () => onContinue(item) }, t("continueSubmission")) : null,
        utilities
      );
      const detailBody = h(
        "div",
        { className: "jz-detail-body" },
        h(
          "header",
          { className: "jz-detail-heading" },
          h("span", { className: "jz-detail-eyebrow" }, t(item.type === "video" ? "kindVideo" : "kindImage")),
          h("h2", { id: "mote-work-title" }, t("workDetails")),
          h("span", { className: `jz-status-badge ${tone}` }, h("i"), statusLabel(item.status, t))
        ),
        h("section", { className: "jz-detail-section" }, h("h3", null, t("promptLabel")), h("div", { className: "jz-prompt-text" }, item.prompt || "—")),
        h(
          "section",
          { className: "jz-detail-section" },
          h("h3", null, t("generationSettings")),
          h(
            "div",
            { className: "jz-detail-model" },
            h(Icon, { name: item.type === "video" ? "video" : "image", size: 18 }),
            h("div", null, h("strong", null, modelDisplayName(item.model)), h("small", null, [item.channelId, item.model].filter(Boolean).join(" · ")))
          ),
          parameters.length ? h("dl", { className: "jz-param-grid" }, parameters.map(([key, label]) => h(
            "div",
            { key },
            h("dt", null, t(label)),
            h("dd", null, typeof item.params[key] === "boolean" ? t(item.params[key] ? "on" : "off") : String(item.params[key]))
          ))) : null
        ),
        item.error?.message && item.status !== "submission_unknown" ? h("div", { className: "jz-notice error", role: "alert" }, h(Icon, { name: "alert", size: 17 }), h("span", null, item.error.message)) : null,
        item.status === "submission_unknown" ? h("div", { className: "jz-notice warning" }, h(Icon, { name: "clock", size: 17 }), h("span", null, t("submissionUnknownHint"))) : null,
        item.queryError ? h("div", { className: "jz-notice warning" }, item.queryError) : null,
        h(
          "details",
          { className: "jz-task-details" },
          h("summary", null, t("taskInformation")),
          h("dl", null, metadata.filter(([, value]) => value).map(([label, value]) => h("div", { key: label }, h("dt", null, label), h("dd", null, String(value))))),
          Number.isFinite(item.createdAt) ? h("div", { className: "jz-created" }, t("createdAt"), " ", new Date(item.createdAt).toLocaleString()) : null
        )
      );
      const sidebar = h("aside", { className: "jz-lightbox-side" }, detailBody, actions);
      return h(
        "div",
        { className: "jz-overlay", onMouseDown: (event) => {
          if (event.target === event.currentTarget) onClose();
        } },
        h(
          "div",
          { className: "jz-lightbox", ref: dialog, role: "dialog", "aria-modal": true, "aria-labelledby": "mote-work-title", tabIndex: -1 },
          h("button", { type: "button", className: "jz-preview-close jz-icon-btn", "aria-label": t("close"), title: t("close"), "data-autofocus": true, onClick: onClose }, h(Icon, { name: "close", size: 19 })),
          h("div", { className: "jz-lightbox-media" }, media ? media.video ? h("video", { src: media.url, controls: true, autoPlay: true, playsInline: true }) : h("img", { src: media.url, alt: item.prompt || t("preview") }) : h("div", { className: `jz-preview-placeholder ${tone}` }, h(Icon, { name: tone === "warning" ? "clock" : "image", size: 40 }), h("strong", null, statusLabel(item.status, t)))),
          sidebar
        )
      );
    };
  }

  // src/client/features/channels/SettingsDialog.js
  function createSettingsDialog(React, { t, call }) {
    const h = React.createElement;
    const Icon = createIcon(React);
    const useDialog = createUseDialog(React);
    const { useState } = React;
    function SettingsDialog({ state, onClose, onSave, onTest, models }) {
      const dialog = useDialog(onClose);
      const selection = (kind) => {
        const id = state[kind + "Model"] || "";
        if (!id) return "";
        const channelId = state[kind + "ChannelId"] || "";
        const chosen = (models?.[kind] || []).find((row) => row.id === id && (!channelId || row.channelId === channelId));
        return chosen ? modelValue(chosen) : JSON.stringify([channelId, id]);
      };
      const decoded = (value) => {
        if (!value) return ["", ""];
        try {
          const row = JSON.parse(value);
          if (Array.isArray(row) && row.length === 2) return row;
        } catch {
        }
        return ["", value];
      };
      const [channels, setChannels] = useState(
        () => (Array.isArray(state.channels) ? state.channels : []).map((channel) => ({
          id: channel.id || "",
          name: channel.name || "",
          driver: channel.driver === "openai-images" ? "openai-images" : "mote",
          baseUrl: channel.baseUrl || "",
          apiKey: "",
          models: Array.isArray(channel.models) ? channel.models.join(", ") : "",
          configured: channel.configured === true
        }))
      );
      const [form, setForm] = useState({
        imageModel: selection("image"),
        videoModel: selection("video"),
        outputDir: state.outputDir || ""
      });
      const [busy, setBusy] = useState(false);
      const [message, setMessage] = useState("");
      const [error, setError] = useState("");
      const [probing, setProbing] = useState(-1);
      const [probeNote, setProbeNote] = useState({});
      const catalogOf = (kind) => models && Array.isArray(models[kind]) ? models[kind] : [];
      const modelOptions = (kind, current) => {
        const rows = catalogOf(kind).map((row) => ({
          id: modelValue(row),
          label: row.channelName && row.channelName !== "mote" ? `${row.channelName} · ${row.id}` : row.id
        }));
        if (current && !rows.some((row) => row.id === current)) rows.unshift({ id: current, label: decoded(current).filter(Boolean).join(" · ") });
        return rows;
      };
      const probeChannel = async (index) => {
        const channel = channels[index];
        setProbing(index);
        setProbeNote((current) => ({ ...current, [index]: "" }));
        try {
          const result = await call("probe", {
            driver: channel.driver,
            baseUrl: channel.baseUrl,
            apiKey: channel.apiKey,
            channelId: channel.id || void 0
          });
          const ids = channel.driver === "mote" ? result.image.concat(result.video) : result.image.length > 0 ? result.image : result.models.map((row) => row.id);
          update(index, { models: ids.join(", ") });
          setProbeNote((current) => ({ ...current, [index]: `${t("probeOk")} ${result.models.length} ${t("modelsCount")}` }));
        } catch (cause) {
          setProbeNote((current) => ({ ...current, [index]: cause instanceof Error ? cause.message : String(cause) }));
        } finally {
          setProbing(-1);
        }
      };
      const update = (index, patch) => setChannels((current) => current.map((channel, i) => i === index ? { ...channel, ...patch } : channel));
      const addChannelRow = () => setChannels((current) => [
        ...current,
        { id: "", name: "", driver: "mote", baseUrl: "https://platform.sgt.site", apiKey: "", models: "", configured: false }
      ]);
      const buildPatch = () => ({
        channels: channels.map((channel, index) => ({
          id: channel.id || `ch${index + 1}`,
          name: channel.name || `ch${index + 1}`,
          driver: channel.driver,
          baseUrl: channel.baseUrl.trim(),
          apiKey: channel.apiKey,
          models: String(channel.models || "").split(",").map((item) => item.trim()).filter(Boolean),
          enabled: true
        })),
        imageModel: decoded(form.imageModel)[1],
        videoModel: decoded(form.videoModel)[1],
        imageChannelId: decoded(form.imageModel)[0],
        videoChannelId: decoded(form.videoModel)[0],
        outputDir: form.outputDir.trim()
      });
      return h(
        "div",
        {
          className: "jz-overlay",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) onClose();
          }
        },
        h(
          "div",
          { className: "jz-modal", ref: dialog, role: "dialog", "aria-modal": "true", "aria-labelledby": "mote-channel-title", tabIndex: -1 },
          h(
            "header",
            { className: "jz-modal-head" },
            h("span", { className: "jz-modal-title", id: "mote-channel-title" }, t("settingsTitle")),
            h("span", { className: "jz-spacer" }),
            h("button", { type: "button", className: "jz-icon-btn", "aria-label": t("close"), "data-autofocus": true, onClick: onClose }, h(Icon, { name: "close", size: 18 }))
          ),
          state.route && state.route.registered === false ? h("div", { className: "jz-error" }, `${t("routeDown")} ${state.route.error || ""}`) : null,
          h(
            "div",
            { className: "jz-field" },
            h(
              "div",
              { className: "jz-field-head" },
              h("span", null, `${t("channels")} (${channels.length})`),
              h("span", { className: "jz-spacer" }),
              h("button", { className: "jz-btn small", onClick: addChannelRow }, t("addChannel"))
            ),
            channels.length === 0 ? h("div", { className: "jz-dim" }, t("noChannel")) : null,
            channels.map(
              (channel, index) => h(
                "div",
                { key: `${channel.id || "new"}-${index}`, className: "jz-channel" },
                h(
                  "div",
                  { className: "jz-grid2" },
                  h("input", {
                    className: "jz-input",
                    value: channel.name,
                    placeholder: t("channelName"),
                    onChange: (event) => update(index, { name: event.target.value })
                  }),
                  h(
                    "select",
                    { className: "jz-input", value: channel.driver, onChange: (event) => update(index, { driver: event.target.value }) },
                    h("option", { value: "mote" }, "mote 统一渠道"),
                    h("option", { value: "openai-images" }, "OpenAI 兼容图片")
                  )
                ),
                h("input", {
                  className: "jz-input",
                  value: channel.baseUrl,
                  placeholder: t("channelBase"),
                  onChange: (event) => update(index, { baseUrl: event.target.value })
                }),
                h("input", {
                  className: "jz-input",
                  type: "password",
                  value: channel.apiKey,
                  placeholder: channel.configured ? "••••••••" : t("channelKey"),
                  autoComplete: "off",
                  onChange: (event) => update(index, { apiKey: event.target.value })
                }),
                channel.driver === "openai-images" || channel.driver === "mote" ? h(
                  "div",
                  { className: "jz-row" },
                  h("input", {
                    className: "jz-input",
                    value: channel.models,
                    placeholder: channel.driver === "mote" ? t("channelModelsMote") : t("channelModels"),
                    onChange: (event) => update(index, { models: event.target.value })
                  }),
                  h(
                    "button",
                    { className: "jz-btn small", disabled: probing === index, onClick: () => probeChannel(index) },
                    probing === index ? t("probing") : t("autoFetch")
                  )
                ) : null,
                probeNote[index] ? h("div", { className: "jz-dim" }, probeNote[index]) : null,
                h(
                  "div",
                  { className: "jz-channel-foot" },
                  h("span", { className: "jz-dim" }, channel.configured ? t("channelReady") : t("channelNoKey")),
                  h("span", { className: "jz-spacer" }),
                  h("button", { className: "jz-btn small ghost", onClick: () => setChannels((current) => current.filter((_, i) => i !== index)) }, t("deleteChannel"))
                )
              )
            ),
            h("div", { className: "jz-dim" }, t("channelsHint"))
          ),
          h(
            "div",
            { className: "jz-grid2" },
            h(
              "label",
              { className: "jz-field" },
              h("span", { className: "jz-dim" }, t("imageModel")),
              h(
                "select",
                {
                  className: "jz-input",
                  value: form.imageModel,
                  onChange: (event) => setForm((current) => ({ ...current, imageModel: event.target.value }))
                },
                h("option", { value: "" }, t("modelAuto")),
                modelOptions("image", form.imageModel).map((row) => h("option", { key: row.id, value: row.id }, row.label))
              )
            ),
            h(
              "label",
              { className: "jz-field" },
              h("span", { className: "jz-dim" }, t("videoModel")),
              h(
                "select",
                {
                  className: "jz-input",
                  value: form.videoModel,
                  onChange: (event) => setForm((current) => ({ ...current, videoModel: event.target.value }))
                },
                h("option", { value: "" }, t("modelAuto")),
                modelOptions("video", form.videoModel).map((row) => h("option", { key: row.id, value: row.id }, row.label))
              )
            )
          ),
          h(
            "label",
            { className: "jz-field" },
            h("span", { className: "jz-dim" }, t("outputDir")),
            h("input", {
              className: "jz-input",
              value: form.outputDir,
              onChange: (event) => setForm((current) => ({ ...current, outputDir: event.target.value }))
            })
          ),
          error ? h("div", { className: "jz-error" }, error) : null,
          message ? h("div", { className: "jz-dim" }, message) : null,
          h(
            "footer",
            { className: "jz-modal-foot" },
            h("span", { className: "jz-spacer" }),
            h(
              "button",
              {
                className: "jz-btn",
                disabled: busy,
                onClick: async () => {
                  setBusy(true);
                  setError("");
                  setMessage("");
                  try {
                    const count = await onTest(buildPatch());
                    setMessage(`${t("testOk")} · ${count} ${t("modelsCount")}`);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                  } finally {
                    setBusy(false);
                  }
                }
              },
              busy ? t("testing") : t("testSave")
            ),
            h(
              "button",
              {
                className: "jz-btn primary",
                disabled: busy,
                onClick: async () => {
                  setBusy(true);
                  setError("");
                  setMessage("");
                  try {
                    await onSave(buildPatch());
                    onClose();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : String(cause));
                  } finally {
                    setBusy(false);
                  }
                }
              },
              busy ? t("saving") : t("save")
            ),
            h("button", { className: "jz-btn", onClick: onClose }, t("close"))
          )
        )
      );
    }
    return SettingsDialog;
  }

  // src/client/styles/studio.js
  var STUDIO_CSS = `
.jz-root { --jz-bg:#0e1014; --jz-bg-2:#14171c; --jz-card:#191d23; --jz-card-2:#222730; --jz-line:rgba(255,255,255,.075); --jz-line-2:rgba(255,255,255,.16); --jz-text:#f0f2f5; --jz-dim:#9099a6; --jz-accent:#bcb0ff; --jz-accent-2:#8bd4cc; display:flex; flex-direction:column; width:100%; height:100%; min-height:360px; min-width:0; color:var(--jz-text); background:var(--jz-bg); font:14px/1.5 Inter,"PingFang SC","Microsoft YaHei UI",system-ui,sans-serif; color-scheme:dark; }
.jz-root *, .jz-root *::before, .jz-root *::after { box-sizing:border-box; }
.jz-root button, .jz-root input, .jz-root select, .jz-root textarea { font-family:inherit; }
.jz-root button { -webkit-tap-highlight-color:transparent; }
.jz-root button, .jz-root a { touch-action:manipulation; }
.jz-root :focus-visible { outline:2px solid #a9cfcf; outline-offset:3px; }
.jz-icon { display:block; flex:none; }
.jz-head { height:64px; flex:none; display:flex; align-items:center; gap:14px; padding:0 28px; background:rgba(17,20,25,.95); border-bottom:1px solid var(--jz-line); }
.jz-brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:650; letter-spacing:.15px; white-space:nowrap; }
.jz-logo { display:grid; place-items:center; width:30px; height:30px; border-radius:10px; color:#f8f5ff; background:linear-gradient(140deg,#9c83ed,#6b59a8); box-shadow:inset 0 1px 0 rgba(255,255,255,.22); }
.jz-brand-caption { color:#697482; font-size:10px; font-weight:500; letter-spacing:1.8px; margin-left:8px; padding-left:18px; border-left:1px solid var(--jz-line-2); }
.jz-spacer { flex:1; min-width:0; }
.jz-chip-status { display:inline-flex; align-items:center; gap:7px; font-size:11px; color:#a8b2be; white-space:nowrap; }
.jz-dot { width:5px; height:5px; border-radius:50%; background:#c3a46e; }
.jz-dot.ok { background:#7dbfa6; }
.jz-root .jz-icon-btn { display:inline-grid; place-items:center; width:34px; height:34px; flex:none; border:1px solid var(--jz-line); border-radius:10px; background:#1c2027; color:#c0c8d2; cursor:pointer; padding:0; }
.jz-root .jz-icon-btn:hover { color:#fff; background:#282e38; border-color:var(--jz-line-2); }
.jz-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; padding:32px 40px 64px; background:radial-gradient(ellipse 70% 380px at 50% 0,rgba(43,91,104,.14),transparent 100%); scrollbar-width:thin; scrollbar-color:#353c47 transparent; }
.jz-wrap { display:flex; flex-direction:column; gap:24px; max-width:1320px; margin:0 auto; min-width:0; }
.jz-hero { text-align:center; padding:28px 0 10px; }
.jz-hero h1 { margin:0; font-size:34px; line-height:1.4; font-weight:570; letter-spacing:-.5px; }
.jz-hero p { margin:12px 0 0; color:var(--jz-dim); font-size:13px; }
.jz-hero.compact { padding:0; }
.jz-hero.compact h1 { font-size:26px; }
.jz-hero.compact p { display:none; }
.jz-composer { width:100%; max-width:980px; align-self:center; min-width:0; border:1px solid rgba(153,183,190,.17); border-radius:24px; background:linear-gradient(120deg,#1d262b,#1d232a 65%,#20262d); box-shadow:0 16px 48px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.025); }
.jz-composer:focus-within { border-color:rgba(151,199,203,.4); box-shadow:0 16px 48px rgba(0,0,0,.18),0 0 0 3px rgba(145,203,202,.025); }
.jz-composer-notice { padding:12px 20px; border-bottom:1px solid var(--jz-line); color:#a9c5c4; font-size:11px; line-height:1.7; }
.jz-unhandled-refs { display:flex; flex-direction:column; gap:8px; margin:12px 20px 0; color:#dfbf80; font-size:12px; overflow-wrap:anywhere; }
.jz-unhandled-refs > div { display:flex; align-items:center; gap:12px; justify-content:space-between; }
.jz-composer-main { display:flex; gap:16px; padding:22px 22px 8px; align-items:flex-start; min-width:0; }
.jz-slots { display:flex; flex-wrap:wrap; gap:8px; max-width:232px; flex:none; }
.jz-slots:empty { display:none; }
.jz-slot { position:relative; display:flex; align-items:center; justify-content:center; width:70px; height:78px; flex:none; border:1px dashed rgba(191,213,217,.22); border-radius:12px; color:#a7b6be; background:rgba(255,255,255,.025); cursor:pointer; overflow:hidden; }
.jz-slot:hover { background:rgba(255,255,255,.055); border-color:#93b9bd; color:#e7f3f2; }
.jz-slot.filled { border-style:solid; }
.jz-slot img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.jz-slot > .jz-icon { margin-bottom:10px; }
.jz-slot .cap { position:absolute; left:0; bottom:0; right:0; padding:4px 2px; color:#c4d1d8; font-size:10px; text-align:center; background:linear-gradient(transparent,rgba(17,23,29,.62)); }
.jz-slot.filled .cap { color:#fff; }
.jz-root .jz-slot .del { position:absolute; top:4px; right:4px; width:20px; height:20px; display:grid; place-items:center; border:0; padding:0; border-radius:50%; background:rgba(8,12,16,.78); color:#fff; cursor:pointer; }
.jz-prompt { display:block; flex:1; width:100%; min-width:0; min-height:84px; max-height:280px; margin:0; padding:1px 0 6px; resize:vertical; border:0; outline:none!important; background:transparent; color:var(--jz-text); font-size:15px; line-height:1.8; }
.jz-prompt::placeholder { color:#84919c; }
.jz-bar { position:relative; display:flex; align-items:center; flex-wrap:wrap; gap:7px; min-height:56px; padding:6px 76px 14px 20px; }
.jz-bar > .jz-spacer { display:none; }
.jz-menu { position:relative; max-width:100%; min-width:0; }
.jz-root .jz-chip { display:inline-flex; align-items:center; justify-content:center; gap:7px; max-width:100%; min-height:32px; height:32px; padding:0 10px; border:1px solid transparent; border-radius:9px; background:rgba(7,12,17,.22); color:#e0e5eb; font-size:12px; cursor:pointer; white-space:nowrap; }
.jz-root .jz-chip:hover, .jz-root .jz-chip.open { border-color:rgba(195,218,221,.17); background:rgba(255,255,255,.055); }
.jz-root .jz-chip-mode { color:#b6e4df; background:rgba(124,190,187,.09); }
.jz-chip-label { color:#95a2af; }
.jz-chip-value { min-width:0; max-width:230px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.jz-caret { color:#768493; }
.jz-chip.open .jz-caret { transform:rotate(180deg); }
.jz-static { color:var(--jz-dim); font-size:12px; }
.jz-root .jz-send { position:absolute; right:19px; bottom:15px; display:grid; place-items:center; width:42px; height:42px; padding:0; flex:none; border:0; border-radius:999px; background:linear-gradient(135deg,#f1e8df,#d9efee 65%,#c7e3e5); color:#263d45; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,.12); }
.jz-root .jz-send:not(:disabled):hover { filter:brightness(1.08); transform:translateY(-1px); }
.jz-root .jz-send:disabled { opacity:.32; box-shadow:none; cursor:default; }
.jz-send-spin { width:16px; height:16px; border:2px solid rgba(26,53,62,.2); border-top-color:#264d57; border-radius:50%; animation:jz-spin .9s linear infinite; }
.jz-composer-help { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 20px; border-top:1px solid rgba(199,224,227,.06); color:#7e8b98; font-size:11px; }
.jz-key-hint { white-space:nowrap; font-size:10px; color:#6e7c89; }
.jz-key-hint kbd { font-family:inherit; }
.jz-note { flex-basis:100%; color:#dfbf80; font-size:12px; }
.jz-error, .jz-notice { display:flex; align-items:flex-start; gap:8px; padding:11px 13px; border:1px solid rgba(227,135,135,.18); border-radius:10px; color:#ecaaaa; background:rgba(202,88,88,.065); font-size:12px; line-height:1.65; overflow-wrap:anywhere; }
.jz-composer > .jz-error { margin:0 20px 12px; }
.jz-error > .jz-icon, .jz-notice > .jz-icon { margin-top:2px; }
.jz-notice.warning { background:rgba(205,161,83,.065); border-color:rgba(221,178,107,.18); color:#ddbd87; }
.jz-drop { z-index:110; display:flex; flex-direction:column; overflow:hidden; padding:0; border:1px solid #3a424e; border-radius:13px; background:#232831; box-shadow:0 18px 45px rgba(0,0,0,.48); }
.jz-drop-list { position:relative; min-height:0; overflow:auto; overscroll-behavior:contain; padding:6px; scrollbar-width:thin; }
.jz-drop-search { display:flex; align-items:center; gap:8px; flex:none; padding:10px 12px; border-bottom:1px solid var(--jz-line); color:#91a6ba; }
.jz-drop-search input { width:100%; min-width:0; height:24px; padding:0; border:0; outline:none; background:transparent; color:#dfe9f0; font-size:12px; }
.jz-drop-search input::placeholder { color:#8b9bac; }
.jz-drop-empty { padding:16px 10px; color:#96a5b7; font-size:12px; }
.jz-drop-head { padding:9px 10px 5px; color:#8f9caa; font-size:10px; letter-spacing:.4px; }
.jz-root .jz-drop-item { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; min-height:36px; padding:8px 10px; border:0; border-radius:8px; background:transparent; color:#dfe5ed; font-size:12px; text-align:left; cursor:pointer; }
.jz-root .jz-drop-item:hover, .jz-root .jz-drop-item:focus-visible { background:#303946; outline-offset:-2px; }
.jz-drop-item.on { color:#bce5df; }
.jz-option-label { display:flex; flex-direction:column; gap:2px; min-width:0; }
.jz-option-label > span, .jz-option-label small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.jz-option-label small { color:#8794a3; font-size:10px; }
.jz-ideas { width:100%; max-width:980px; align-self:center; display:flex; gap:12px; align-items:flex-start; }
.jz-ideas-head { padding:7px 0; color:#778593; white-space:nowrap; font-size:11px; }
.jz-idea-row { display:flex; flex-wrap:wrap; gap:7px; min-width:0; }
.jz-root .jz-idea { max-width:280px; padding:7px 11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:1px solid var(--jz-line); border-radius:999px; background:#181c22; color:#9aa5b3; font-size:11px; cursor:pointer; }
.jz-root .jz-idea:hover { color:#dfe5ee; border-color:var(--jz-line-2); background:#20262d; }
.jz-cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; max-width:980px; width:100%; align-self:center; }
.jz-root .jz-card { display:flex; flex-direction:column; gap:6px; align-items:flex-start; text-align:left; padding:16px; border:1px solid var(--jz-line); border-radius:13px; background:#171c22; color:var(--jz-text); cursor:pointer; }
.jz-root .jz-card:hover { background:#20272f; border-color:rgba(180,209,208,.2); }
.jz-card-title { font-size:13px; font-weight:550; }
.jz-card-desc { font-size:11px; color:var(--jz-dim); line-height:1.65; }
.jz-gallery { display:flex; flex-direction:column; gap:18px; margin-top:10px; padding-top:26px; border-top:1px solid var(--jz-line); }
.jz-gallery-head { display:flex; flex-wrap:wrap; align-items:center; gap:10px; }
.jz-gallery-tools { display:flex; flex-wrap:wrap; align-items:center; gap:9px; min-width:0; }
.jz-work-search { display:flex; align-items:center; gap:9px; flex:1; min-width:min(100%,220px); padding:0 11px; height:36px; border:1px solid var(--jz-line); border-radius:10px; background:#181d24; color:#8090a3; }
.jz-work-search:focus-within { border-color:#749b9f; }
.jz-work-search input { width:100%; min-width:0; border:0; outline:none; color:#d8e2ec; background:transparent; font-size:12px; }
.jz-work-search input::placeholder { color:#768699; }
.jz-gallery-heading { min-width:0; }
.jz-gallery-title { margin:0; font-size:20px; font-weight:570; letter-spacing:-.2px; line-height:1.3; }
.jz-gallery-heading p { margin:6px 0 0; color:#7d8997; font-size:11px; }
.jz-count { align-self:flex-start; margin-top:1px; padding:2px 7px; border-radius:6px; background:#242a32; color:#aeb8c6; font-size:11px; }
.jz-grid { column-count:4; column-gap:16px; }
.jz-tile { display:inline-block; vertical-align:top; width:100%; break-inside:avoid; margin:0 0 16px; overflow:hidden; border:1px solid var(--jz-line); border-radius:15px; background:#181d24; box-shadow:0 3px 10px rgba(0,0,0,.08); }
.jz-tile:hover, .jz-tile:focus-within { border-color:rgba(174,196,211,.24); }
.jz-tile-media { position:relative; min-width:0; overflow:hidden; background:#11161c; }
.jz-tile-media.empty { aspect-ratio:4/3; min-height:190px; background:radial-gradient(ellipse at 50% 35%,#232d3a,#171e28 75%); }
.jz-tile-media img, .jz-tile-media video { display:block; width:100%; height:auto; }
.jz-tile-badges { position:absolute; inset:10px 10px auto; display:flex; align-items:center; justify-content:space-between; gap:8px; pointer-events:none; z-index:2; }
.jz-kind-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 7px; border:1px solid rgba(255,255,255,.1); border-radius:6px; color:#ecf2f6; background:rgba(12,18,24,.62); font-size:10px; backdrop-filter:blur(8px); }
.jz-status-badge { display:inline-flex; align-items:center; gap:5px; width:fit-content; padding:4px 8px; border-radius:6px; background:#29323e; color:#bdc9d8; font-size:10px; white-space:nowrap; line-height:1.45; }
.jz-status-badge i { display:block; width:4px; height:4px; border-radius:50%; background:currentColor; }
.jz-status-badge.success { background:rgba(24,47,41,.9); color:#a4cdb9; }
.jz-status-badge.warning { background:rgba(68,52,31,.92); color:#e5c58f; }
.jz-status-badge.error { background:rgba(70,35,40,.92); color:#eba6ac; }
.jz-status-badge.pending { background:rgba(37,48,65,.92); color:#b6cae6; }
.jz-status-badge.muted { background:#30343c; color:#b1b5be; }
.jz-tile-pending, .jz-tile-err { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; padding:44px 18px 24px; text-align:center; color:#9caec5; font-size:11px; }
.jz-tile-pending strong, .jz-tile-err strong { font-weight:550; font-size:13px; }
.jz-tile-err { background:#241c23; color:#d9a0a8; }
.jz-tile-err.warning { background:#242119; color:#d3b783; }
.jz-tile-err p { display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin:0; font-size:11px; line-height:1.6; color:#a78e95; }
.jz-tile-err.warning p { color:#a6997e; }
.jz-spin { width:23px; height:23px; border:1.5px solid rgba(160,188,222,.15); border-top-color:#a7bfe0; border-radius:50%; animation:jz-spin 1s linear infinite; }
@keyframes jz-spin { to { transform:rotate(360deg); } }
.jz-progress-track { height:3px; width:64px; margin-top:2px; overflow:hidden; border-radius:3px; background:#303d51; }
.jz-progress-track > span { display:block; height:100%; border-radius:inherit; background:#abc4e5; }
.jz-tile-actions { position:absolute; inset:auto 0 0; display:flex; justify-content:flex-end; gap:6px; padding:26px 11px 11px; background:linear-gradient(transparent,rgba(5,9,14,.74)); opacity:0; transition:opacity .16s ease; z-index:3; }
.jz-tile:hover .jz-tile-actions, .jz-tile:focus-within .jz-tile-actions { opacity:1; }
.jz-root .jz-tile-actions button { display:grid; place-items:center; width:31px; height:31px; padding:0; border:1px solid rgba(255,255,255,.17); border-radius:8px; color:#f1f4f8; background:rgba(23,30,39,.8); backdrop-filter:blur(8px); cursor:pointer; }
.jz-root .jz-tile-actions button:hover { background:#3a4657; border-color:#7f94aa; }
.jz-root .jz-tile-actions button:disabled { opacity:.4; cursor:default; }
.jz-tile-foot { display:flex; align-items:center; gap:7px; padding:11px 12px; color:#9ba8b8; font-size:11.5px; }
.jz-tile-model { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.jz-tile-cost { flex:none; color:#8a96a5; font-variant-numeric:tabular-nums; }
.jz-expiry { display:block; color:#c4ad7f; }
.jz-tile-followup { display:flex; flex-wrap:wrap; gap:8px 14px; border-top:1px solid var(--jz-line); padding:9px 12px; }
.jz-root .jz-link:disabled { opacity:.4; cursor:default; }
.jz-root .jz-link { display:inline-flex; align-items:center; gap:5px; padding:0; border:0; background:none; color:#b8cfcf; font-size:11px; cursor:pointer; }
.jz-root .jz-link:hover { color:#e0f1ef; }
.jz-empty { padding:44px 24px; border:1px dashed var(--jz-line-2); border-radius:18px; color:#7f8d9d; text-align:center; font-size:13px; }
.jz-empty strong { color:#bac5d1; font-weight:500; font-size:15px; }
.jz-empty p { margin:9px auto 0; max-width:400px; }
.jz-dim { color:var(--jz-dim); font-size:12px; line-height:1.65; }
.jz-root .jz-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; height:38px; padding:0 15px; border:1px solid var(--jz-line); border-radius:10px; color:#d6dee7; background:#242b35; font-size:12px; cursor:pointer; text-decoration:none; }
.jz-root .jz-btn:hover { border-color:var(--jz-line-2); background:#2d3743; }
.jz-root .jz-btn:disabled { opacity:.4; cursor:default; }
.jz-root .jz-btn.primary { background:#d6e9e5; color:#243b3c; border-color:transparent; font-weight:600; }
.jz-root .jz-btn.primary:hover { background:#e5f3ef; }
.jz-root .jz-btn.small { height:29px; padding:0 10px; font-size:11px; }
.jz-root .jz-btn.ghost { color:#8e9baa; background:transparent; }
.jz-overlay { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:28px; background:rgba(5,8,12,.8); backdrop-filter:blur(7px); }
.jz-lightbox { position:relative; display:flex; width:min(1240px,calc(100vw - 56px)); height:min(780px,calc(100dvh - 64px)); border:1px solid #353d48; border-radius:20px; overflow:hidden; background:#171c23; box-shadow:0 25px 100px rgba(0,0,0,.45); }
.jz-lightbox:focus { outline:none; }
.jz-root .jz-preview-close { position:absolute; right:14px; top:14px; z-index:3; border-radius:999px; background:rgba(22,29,37,.8); }
.jz-lightbox-media { display:flex; align-items:center; justify-content:center; flex:1; min-width:0; min-height:0; padding:20px; background:#090d12; }
.jz-lightbox-media img, .jz-lightbox-media video { display:block; max-width:100%; max-height:100%; width:auto; height:auto; object-fit:contain; }
.jz-preview-placeholder { display:flex; flex-direction:column; align-items:center; gap:18px; color:#6f8199; }
.jz-preview-placeholder.warning { color:#c2a36d; }
.jz-lightbox-side { display:flex; flex-direction:column; gap:0; width:340px; flex:none; min-height:0; padding:0; overflow:hidden; border-left:1px solid var(--jz-line); scrollbar-width:thin; }
.jz-detail-body { display:flex; flex-direction:column; gap:20px; flex:1; min-height:0; padding:27px 24px 20px; overflow:auto; scrollbar-width:thin; }
.jz-detail-heading { padding-right:27px; }
.jz-detail-eyebrow { color:#778597; font-size:10px; letter-spacing:1px; }
.jz-detail-heading h2 { margin:4px 0 11px; color:#e9edf3; font-size:20px; font-weight:550; }
.jz-detail-section h3 { margin:0 0 10px; color:#8492a3; font-size:11px; font-weight:500; }
.jz-prompt-text { color:#d8e0ea; font-size:13px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
.jz-detail-model { display:flex; align-items:flex-start; gap:9px; min-width:0; color:#bfcfdf; }
.jz-detail-model > .jz-icon { margin-top:3px; color:#8aa8b7; }
.jz-detail-model strong { font-size:12px; font-weight:500; }
.jz-detail-model small { display:block; margin-top:3px; color:#768699; font-size:10px; overflow-wrap:anywhere; user-select:text; }
.jz-param-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:14px 0 0; }
.jz-param-grid > div { min-width:0; padding:8px 10px; border:1px solid var(--jz-line); border-radius:8px; background:#1c232c; }
.jz-param-grid dt { color:#78889c; font-size:10px; }
.jz-param-grid dd { margin:3px 0 0; color:#cbd7e4; font-size:12px; overflow-wrap:anywhere; }
.jz-task-details { font-size:11px; color:#7f8fa4; }
.jz-task-details summary { cursor:pointer; width:fit-content; }
.jz-task-details dl { margin:11px 0; }
.jz-task-details dl > div { margin:8px 0; }
.jz-task-details dt { font-size:10px; color:#63758c; }
.jz-task-details dd { margin:3px 0 0; font-family:ui-monospace,monospace; font-size:10px; overflow-wrap:anywhere; user-select:text; }
.jz-created { color:#66798e; font-size:10px; }
.jz-detail-actions { display:flex; flex-direction:column; gap:8px; flex:none; margin:0; padding:16px 24px 20px; border-top:1px solid var(--jz-line); background:#171c23; }
.jz-billing { display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#8796aa; }
.jz-billing strong { color:#d0dce8; font-size:15px; font-weight:500; font-variant-numeric:tabular-nums; }
.jz-snapshot-note { margin:3px 0 8px; font-size:10px; line-height:1.7; color:#75859b; }
.jz-detail-utilities { display:flex; flex-wrap:wrap; gap:8px 12px; justify-content:center; padding-top:8px; }
.jz-root .jz-text-btn { display:inline-flex; align-items:center; gap:5px; padding:0; border:0; background:none; color:#7e91a7; font-size:10px; text-decoration:none; cursor:pointer; }
.jz-root .jz-text-btn:hover { color:#c0d5e8; }
.jz-modal { width:600px; max-width:calc(100vw - 48px); max-height:calc(100dvh - 56px); overflow:auto; display:flex; flex-direction:column; gap:16px; padding:23px; border:1px solid #353d48; border-radius:20px; background:#191e25; box-shadow:0 25px 100px rgba(0,0,0,.4); scrollbar-width:thin; }
.jz-modal-head { display:flex; align-items:center; }
.jz-modal-title { font-size:17px; font-weight:550; }
.jz-modal-foot { display:flex; align-items:center; justify-content:flex-end; gap:8px; padding-top:4px; }
.jz-field { display:flex; flex-direction:column; gap:8px; min-width:0; }
.jz-field-head { display:flex; align-items:center; gap:8px; font-size:12px; color:#91a1b5; }
.jz-grid2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:10px; }
.jz-input { width:100%; min-width:0; height:36px; padding:0 11px; border:1px solid #323b48; border-radius:9px; background:#141a21; color:#d6e0ec; font-size:12px; }
.jz-input:focus { outline:1px solid #93bcbc; border-color:#93bcbc; }
.jz-row { display:flex; align-items:center; gap:7px; }
.jz-row .jz-input { flex:1; min-width:0; }
.jz-channel { display:flex; flex-direction:column; gap:9px; padding:13px; border:1px solid var(--jz-line); border-radius:12px; background:#1d242e; }
.jz-channel-foot { display:flex; align-items:center; gap:8px; }
.jz-toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); z-index:130; max-width:min(620px,calc(100vw - 32px)); padding:12px 17px; border:1px solid #3b4859; border-radius:12px; color:#d6e2f0; background:#242e3c; box-shadow:0 12px 40px rgba(0,0,0,.4); font-size:12px; overflow-wrap:anywhere; }
.jz-root[data-layout="medium"] .jz-grid { column-count:3; }
.jz-root[data-layout="narrow"] .jz-grid { column-count:2; }
.jz-root[data-layout="compact"] .jz-grid { column-count:1; }
.jz-root[data-layout="medium"] .jz-scroll { padding-left:26px; padding-right:26px; }
.jz-root[data-layout="narrow"] .jz-scroll, .jz-root[data-layout="compact"] .jz-scroll { padding:20px 16px 40px; }
.jz-root[data-layout="narrow"] .jz-head, .jz-root[data-layout="compact"] .jz-head { padding:0 18px; height:58px; }
.jz-root[data-layout="narrow"] .jz-brand-caption, .jz-root[data-layout="compact"] .jz-brand-caption { display:none; }
.jz-root[data-layout="narrow"] .jz-hero h1, .jz-root[data-layout="compact"] .jz-hero h1 { font-size:24px; letter-spacing:0; }
.jz-root[data-layout="compact"] .jz-hero p { font-size:12px; }
.jz-root[data-layout="compact"] .jz-hero { padding-top:5px; }
.jz-root[data-layout="narrow"] .jz-composer-main, .jz-root[data-layout="compact"] .jz-composer-main { padding:17px 17px 5px; gap:12px; flex-direction:column; }
.jz-root[data-layout="narrow"] .jz-slots, .jz-root[data-layout="compact"] .jz-slots { max-width:100%; }
.jz-root[data-layout="narrow"] .jz-prompt, .jz-root[data-layout="compact"] .jz-prompt { flex:none; min-height:95px; font-size:14px; }
.jz-root[data-layout="compact"] .jz-composer { border-radius:18px; }
.jz-root[data-layout="compact"] .jz-bar { padding:6px 67px 14px 13px; gap:6px; }
.jz-root[data-layout="compact"] .jz-chip { padding:0 8px; font-size:11px; }
.jz-root[data-layout="compact"] .jz-chip-value { max-width:175px; }
.jz-root[data-layout="compact"] .jz-send { right:14px; bottom:14px; width:38px; height:38px; }
.jz-root[data-layout="compact"] .jz-composer-help { padding:9px 13px; font-size:10px; }
.jz-root[data-layout="compact"] .jz-key-hint { display:none; }
.jz-root[data-layout="compact"] .jz-ideas { flex-direction:column; gap:5px; }
.jz-root[data-layout="compact"] .jz-ideas-head { padding:0; }
.jz-root[data-layout="compact"] .jz-idea { max-width:245px; }
.jz-root[data-layout="narrow"] .jz-cards, .jz-root[data-layout="compact"] .jz-cards { grid-template-columns:repeat(2,minmax(0,1fr)); }
.jz-root[data-layout="compact"] .jz-gallery { padding-top:20px; gap:14px; }
.jz-root[data-layout="compact"] .jz-gallery-heading p { display:none; }
.jz-root[data-layout="compact"] .jz-gallery-title { font-size:18px; }
.jz-root[data-layout="compact"] .jz-work-search { flex-basis:100%; }
@media (hover:none) { .jz-tile-actions { opacity:1; } .jz-root .jz-tile-actions button { width:38px; height:38px; } }
@media (max-width:720px) {
  .jz-overlay { padding:12px; align-items:center; }
  .jz-lightbox { flex-direction:column; width:100%; height:calc(100dvh - 24px); max-height:calc(100dvh - 24px); border-radius:16px; }
  .jz-lightbox-media { flex:none; height:38dvh; padding:10px; }
  .jz-lightbox-side { flex:1; width:100%; padding:0; border-left:0; border-top:1px solid var(--jz-line); gap:0; }
  .jz-detail-body { padding:18px 20px; gap:16px; }
  .jz-detail-actions { padding:12px 20px 16px; }
  .jz-detail-heading { padding-right:0; }
  .jz-detail-heading h2 { font-size:18px; }
  .jz-root .jz-preview-close { background:rgba(17,25,34,.8); right:11px; top:11px; }
  .jz-modal { max-width:100%; width:100%; max-height:calc(100dvh - 24px); padding:17px; border-radius:16px; }
}
@media (max-width:440px) { .jz-grid2 { grid-template-columns:minmax(0,1fr); } .jz-brand { font-size:14px; } }
@media (prefers-reduced-motion:reduce) { .jz-root *, .jz-root *::before, .jz-root *::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; } }
`;

  // src/client/app/Studio.js
  function createStudio(React, { locale, call, storage }) {
    const h = React.createElement;
    const Icon = createIcon(React);
    const usePanelLayout = createUsePanelLayout(React);
    const { useState, useEffect, useRef, useCallback } = React;
    const { t, getIdeas } = locale;
    const { loadItems, saveItems } = storage;
    const Composer = createComposer(React, t);
    const useDrafts = createUseDrafts(React);
    const Gallery = createGallery(React, t);
    const Lightbox = createLightbox(React, t);
    const SettingsDialog = createSettingsDialog(React, { t, call });
    function Studio() {
      const panel = usePanelLayout();
      const [state, setState] = useState(null);
      const [models, setModels] = useState({ image: [], video: [] });
      const editor = useDrafts(models, state);
      const { type } = editor;
      const { modelId, params, imageCount, prompt, refs, frames } = editor.draft;
      const setModelId = (value) => editor.patch({ modelId: value });
      const setParams = (value) => editor.patch({ params: value });
      const setPrompt = (value) => editor.patch({ prompt: value });
      const setRefs = (value) => editor.patch((draft) => ({ refs: typeof value === "function" ? value(draft.refs) : value }));
      const setFrames = (value) => editor.patch((draft) => ({ frames: typeof value === "function" ? value(draft.frames) : value }));
      const [items, setItems] = useState(() => normalizeWorks(loadItems()));
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState("");
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [preview, setPreview] = useState(null);
      const [toast, setToast] = useState("");
      const itemsRef = useRef(items);
      const modelsRef = useRef(models);
      const saveTimer = useRef(null);
      const textareaRef = useRef(null);
      const submitting = useRef(false);
      const loadingSnapshot = useRef(false);
      const polling = useRef(false);
      const mounted = useRef(true);
      const toastTimer = useRef(null);
      const hiddenChat = useRef(new Set(storage.loadHiddenChat?.() || []));
      const chatSignature = useRef("");
      itemsRef.current = items;
      modelsRef.current = models;
      const commit = (update, durable = false) => {
        if (!mounted.current) return;
        const next = update(itemsRef.current);
        if (durable && saveItems(next) === false) throw new Error(t("storageUnavailable"));
        itemsRef.current = next;
        setItems(next);
      };
      const say = useCallback((message) => {
        if (!mounted.current) return;
        setToast(message);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(""), 5e3);
      }, []);
      useEffect(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
          if (toastTimer.current) window.clearTimeout(toastTimer.current);
        };
      }, []);
      useEffect(() => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          saveItems(itemsRef.current);
        }, 300);
        return () => {
          if (saveTimer.current) window.clearTimeout(saveTimer.current);
        };
      }, [items]);
      const loadCatalog = useCallback(async () => {
        try {
          const result = await call("state");
          if (!mounted.current) return;
          setState(result);
          if (!result.configured) return;
          const [images, videos] = await Promise.all([
            call("models", { category: "image" }).catch(() => ({ models: [] })),
            call("models", { category: "video" }).catch(() => ({ models: [] }))
          ]);
          if (mounted.current) setModels({ image: images.models || [], video: videos.models || [] });
        } catch (cause) {
          if (mounted.current) {
            setState({ configured: false, channels: [] });
            setError(cause.message);
          }
        }
      }, []);
      useEffect(() => {
        loadCatalog();
      }, [loadCatalog]);
      const syncChat = useCallback(async () => {
        try {
          const result = await call("chat_works");
          if (!mounted.current || !Array.isArray(result.submissions)) return;
          const signature = JSON.stringify(result.submissions);
          if (signature === chatSignature.current) return;
          chatSignature.current = signature;
          commit((current) => mergeChatWorks(current, result.submissions, hiddenChat.current));
        } catch {
        }
      }, []);
      useEffect(() => {
        syncChat();
      }, [syncChat]);
      const recoverOne = async (item) => {
        try {
          const result = await call("submission", { submissionId: item.submissionId });
          commit((current) => mergeSubmissionWorks(current, result.submission));
        } catch (cause) {
          commit((current) => current.map((entry) => entry.submissionId === item.submissionId ? { ...entry, status: "submission_unknown", recoveryRequired: true, error: { code: cause.code, message: cause.message } } : entry));
          if (mounted.current) setError(cause.message);
        }
      };
      useEffect(() => {
        let disposed = false;
        const timer = window.setInterval(async () => {
          if (polling.current) return;
          polling.current = true;
          try {
            await syncChat();
            if (disposed) return;
            const current = itemsRef.current;
            const ids = [...new Set(current.filter((item) => item.submissionId && isPending(item) && item.status !== "prepared" && !item.recoveryRequired).map((item) => item.submissionId))];
            const legacyIds = [...new Set(current.filter((item) => !item.submissionId && isPending(item) && item.taskId).map((item) => item.taskId))];
            if (ids.length) {
              const result = await call("submissions", { ids });
              if (disposed) return;
              for (const row of result.submissions || []) {
                if (row.submission) commit((records) => mergeSubmissionWorks(records, row.submission));
                else if (row.error) commit((records) => records.map((item) => item.submissionId === row.id ? { ...item, status: "submission_unknown", recoveryRequired: true, error: row.error } : item));
              }
            }
            if (legacyIds.length) {
              const result = await call("tasks", { ids: legacyIds });
              if (disposed) return;
              for (const row of result.tasks || []) if (row.task) commit((records) => mergeWorkTask(records, row.id, row.task));
            }
          } catch {
          } finally {
            polling.current = false;
          }
        }, 3e3);
        return () => {
          disposed = true;
          window.clearInterval(timer);
        };
      }, []);
      const model = modelById(models, type, modelId);
      const draftIssue = referenceIssue(editor.draft, model, type);
      const modelUnavailable = modelId !== null && !model;
      const blocked = Boolean(state && !state.configured);
      const switchType = (nextType) => {
        editor.switchTo(nextType);
        setError("");
      };
      const submitSnapshot = async (snapshot, resumeId, count = 1) => {
        if (submitting.current) return;
        if (blocked) {
          setSettingsOpen(true);
          setError(t("needKey"));
          return;
        }
        submitting.current = true;
        setBusy(true);
        setError("");
        try {
          const ids = resumeId ? [resumeId] : Array.from({ length: count }, () => newId());
          if (!resumeId) {
            if (snapshot.kind === "image") snapshot = { ...snapshot, params: { ...snapshot.params, n: 1, ...count > 1 ? { waitSeconds: 0 } : {} } };
            for (const id of ids) {
              if (!mounted.current) return;
              await call("prepare", { submissionId: id, snapshot });
              if (!mounted.current) return;
              commit((current) => [{
                id,
                groupId: id,
                submissionId: id,
                type: snapshot.kind,
                channelId: snapshot.channelId,
                model: snapshot.model,
                prompt: snapshot.prompt,
                params: snapshot.params,
                snapshotAvailable: true,
                status: "prepared",
                createdAt: Date.now(),
                artifacts: [],
                error: null
              }, ...current], true);
            }
          }
          for (const id of ids) {
            if (!mounted.current) return;
            commit((current) => current.map((item) => item.submissionId === id ? { ...item, status: "submitting" } : item));
            try {
              const result = await call("generate", { submissionId: id });
              commit((current) => mergeSubmissionWorks(current, result.submission));
              if (result.submission.state === "unknown" && mounted.current) setError(t("submissionUnknownHint"));
              if (result.submission.state === "failed" && mounted.current) setError(result.submission.error?.message || t("failed"));
              if (result.task?.inlined > 0) say(result.task.inlined + " " + t("inlinedRefs"));
            } catch (cause) {
              commit((current) => current.map((item) => item.submissionId === id && !item.taskId ? {
                ...item,
                status: cause.submissionUnknown === false ? "failed" : "submission_unknown",
                recoveryRequired: false,
                error: { code: cause.code, message: cause.message }
              } : item));
              if (mounted.current) setError(cause.submissionUnknown !== false ? t("submissionUnknownHint") : cause.message);
            }
          }
        } catch (cause) {
          if (mounted.current) setError(cause.message);
        } finally {
          submitting.current = false;
          if (mounted.current) setBusy(false);
        }
      };
      const run = async () => {
        if (loadingSnapshot.current) return;
        const active = modelById(modelsRef.current, type, modelId);
        if (!active || !prompt.trim()) return;
        if (draftIssue) {
          setError(t(draftIssue));
          return;
        }
        const references = [];
        for (const ref of refs) references.push({ role: "reference", type: "image", url: ref.url, name: ref.name });
        if (type === "video") {
          if (frames.first) references.push({ role: "first_frame", type: "image", url: frames.first.url, name: frames.first.name });
          if (frames.last) references.push({ role: "last_frame", type: "image", url: frames.last.url, name: frames.last.name });
        }
        await submitSnapshot({ kind: type, channelId: active.channelId, model: active.id, prompt: prompt.trim(), params: paramsForModel(active, params), references }, null, type === "image" ? imageCount : 1);
      };
      const retryOne = async (item) => {
        if (submitting.current || loadingSnapshot.current) return;
        if (!item.submissionId || !item.snapshotAvailable) {
          setError(t("snapshotUnavailable"));
          return;
        }
        loadingSnapshot.current = true;
        setBusy(true);
        try {
          const result = await call("submission", { submissionId: item.submissionId, includeSnapshot: true });
          if (!result.submission.snapshot) throw new Error(t("snapshotUnavailable"));
          if (result.submission.state !== "failed" && !["succeeded", "failed", "cancelled"].includes(result.submission.task?.status)) throw new Error(t("submissionUnknownHint"));
          await submitSnapshot(result.submission.snapshot);
        } catch (cause) {
          if (mounted.current) setError(cause.message);
        } finally {
          loadingSnapshot.current = false;
          if (mounted.current) setBusy(false);
        }
      };
      const continueOne = (item) => submitSnapshot(null, item.submissionId);
      const focusComposer = () => {
        textareaRef.current?.focus({ preventScroll: true });
        textareaRef.current?.closest(".jz-composer")?.scrollIntoView?.({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      };
      const editOne = async (item) => {
        if (submitting.current || loadingSnapshot.current) return;
        loadingSnapshot.current = true;
        setBusy(true);
        const version = editor.version.current;
        try {
          let snapshot;
          if (item.snapshotAvailable && item.submissionId) {
            const result = await call("submission", { submissionId: item.submissionId, includeSnapshot: true });
            snapshot = result.submission?.snapshot;
            if (!snapshot) throw new Error(t("editSnapshotFailed"));
          }
          if (!mounted.current) return;
          if (editor.version.current !== version) throw new Error(t("editDraftChanged"));
          editor.restore(draftFromWork(item, snapshot, modelsRef.current));
          setError("");
          setPreview(null);
          focusComposer();
        } catch (cause) {
          if (mounted.current) {
            setPreview(null);
            setError(cause.message);
            focusComposer();
          }
        } finally {
          loadingSnapshot.current = false;
          if (mounted.current) setBusy(false);
        }
      };
      const copyDiag = async (item) => {
        const text = diagnosticsOf(item);
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            await navigator.clipboard.writeText(text);
          } else {
            const area = document.createElement("textarea");
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            document.execCommand("copy");
            document.body.removeChild(area);
          }
          say(t("diagCopied"));
        } catch {
          setError(text);
        }
      };
      const download = async (item) => {
        try {
          const result = await call("download", { id: item.taskId, submissionId: item.submissionId, channelId: item.channelId, artifactIndex: item.artifactIndex });
          const outcome = downloadOutcome(result);
          const summary = t("saved") + " " + outcome.succeeded + " " + t("files") + " " + result.dir;
          setPreview(null);
          if (outcome.failed.length || !outcome.succeeded) {
            const details = outcome.failed.map((entry) => (entry.path || "") + ": " + (entry.error || t("downloadFailed"))).join(" · ");
            const message = summary + " · " + t("downloadFailed") + " " + outcome.failed.length + (details ? " · " + details : " · " + t("nothingSaved"));
            setError(message);
            say(message);
          } else {
            setError("");
            say(summary);
          }
        } catch (cause) {
          setPreview(null);
          setError(cause.message);
          say(cause.message);
        }
      };
      const useAs = (item) => {
        const media = primaryMedia(item);
        if (!media) return null;
        const reference = { type: item.type === "image" && !media.video ? "image" : "video", url: media.source || media.url, name: item.model };
        const placement = referencePlacement(editor.draft, model, type, reference);
        const label = t(placement.slot === "first" ? "reuseFirst" : placement.slot === "last" ? "reuseLast" : "reuse");
        return { label, disabled: Boolean(placement.error), reason: placement.error ? t(placement.error) : "", run() {
          const issue = editor.addReference(reference);
          if (issue) {
            say(t(issue));
            return false;
          }
          say(label);
          focusComposer();
          return true;
        } };
      };
      const removeItems = (targets) => commit((current) => {
        const next = targets.reduce((records, item) => removeWork(records, item), current);
        for (const item of targets) if (item.source === "chat" && !next.some((entry) => entry.submissionId === item.submissionId)) hiddenChat.current.add(item.submissionId);
        if (storage.saveHiddenChat?.([...hiddenChat.current]) === false) say(t("chatHideFailed"));
        return next;
      });
      const clearFinished = (targets) => removeItems(targets.filter((item) => !isPending(item)));
      const hasWorks = items.length > 0;
      const previewItem = preview ? items.find((item) => item.id === preview.id) || preview : null;
      const applyCard = (kind, mode) => {
        switchType(kind);
        if (mode === "reference" && textareaRef.current) {
          window.setTimeout(() => {
            if (textareaRef.current) textareaRef.current.focus();
          }, 0);
        }
      };
      return h(
        "div",
        { className: "jz-root", ref: panel.ref, "data-layout": panel.layout },
        h("style", null, STUDIO_CSS),
        h(
          "header",
          { className: "jz-head" },
          h("div", { className: "jz-brand" }, h("span", { className: "jz-logo" }, h(Icon, { name: "sparkles", size: 19 })), h("span", null, t("brand")), h("small", { className: "jz-brand-caption" }, "MEDIA STUDIO")),
          h("span", { className: "jz-spacer" }),
          h(
            "span",
            { className: "jz-chip-status" },
            h("span", { className: `jz-dot ${state && state.configured ? "ok" : "bad"}` }),
            h("span", { className: "jz-status-text" }, state && state.configured ? t("connected") : t("notConfigured"))
          ),
          h("button", { className: "jz-icon-btn", title: t("settingsTitle"), "aria-label": t("settingsTitle"), onClick: () => setSettingsOpen(true) }, h(Icon, { name: "settings" }))
        ),
        h(
          "div",
          { className: "jz-scroll" },
          h(
            "div",
            { className: "jz-wrap" },
            h(
              "section",
              { className: `jz-hero${hasWorks ? " compact" : ""}` },
              h("h1", null, t("greeting")),
              h("p", null, t("greetingSubtitle"))
            ),
            h(Composer, {
              type,
              models,
              modelId,
              params,
              imageCount,
              prompt,
              refs,
              frames,
              busy,
              error,
              blocked,
              notice: editor.draft.notice,
              draftIssue: modelUnavailable ? "editModelUnavailable" : draftIssue,
              unhandledReferences: editor.draft.unhandledReferences,
              onRemoveUnhandled: (index) => editor.patch((draft) => ({ unhandledReferences: draft.unhandledReferences.filter((_, position) => position !== index) })),
              onType: switchType,
              onCount: (value) => editor.patch({ imageCount: value }),
              onModel: (id) => {
                setModelId(id);
                setParams(defaultParams(modelById(models, type, id)));
              },
              onParams: setParams,
              onPrompt: setPrompt,
              onRefs: setRefs,
              onFrames: setFrames,
              onAddReference: (reference, slot) => mounted.current ? editor.addReference(reference, slot) : "",
              onRun: run,
              textareaRef
            }),
            h(
              "section",
              { className: "jz-ideas" },
              h("div", { className: "jz-ideas-head" }, t("inspirationTitle")),
              h(
                "div",
                { className: "jz-idea-row" },
                getIdeas().map(
                  (idea, index) => h("button", { key: index, className: "jz-idea", title: idea, onClick: () => setPrompt(idea) }, idea)
                )
              )
            ),
            hasWorks ? null : h(
              "section",
              { className: "jz-cards" },
              h(
                "button",
                { type: "button", className: "jz-card", onClick: () => applyCard("image", "text") },
                h("span", { className: "jz-card-title" }, t("cardTextToImage")),
                h("span", { className: "jz-card-desc" }, t("cardTextToImageDesc"))
              ),
              h(
                "button",
                { type: "button", className: "jz-card", onClick: () => applyCard("image", "reference") },
                h("span", { className: "jz-card-title" }, t("cardImageToImage")),
                h("span", { className: "jz-card-desc" }, t("cardImageToImageDesc"))
              ),
              h(
                "button",
                { type: "button", className: "jz-card", onClick: () => applyCard("video", "text") },
                h("span", { className: "jz-card-title" }, t("cardTextToVideo")),
                h("span", { className: "jz-card-desc" }, t("cardTextToVideoDesc"))
              ),
              h(
                "button",
                { type: "button", className: "jz-card", onClick: () => applyCard("video", "frames") },
                h("span", { className: "jz-card-title" }, t("cardFrames")),
                h("span", { className: "jz-card-desc" }, t("cardFramesDesc"))
              )
            ),
            h(Gallery, {
              items,
              onClearFinished: clearFinished,
              onPreview: (target) => setPreview(target),
              onDownload: download,
              onUse: useAs,
              onRemove: (target) => removeItems([target]),
              onRetry: retryOne,
              onRecover: recoverOne,
              onContinue: continueOne,
              onEdit: editOne,
              busy
            })
          )
        ),
        preview ? h(Lightbox, {
          item: previewItem,
          onClose: () => setPreview(null),
          onDownload: download,
          onRetry: retryOne,
          onRecover: recoverOne,
          onContinue: continueOne,
          onCopy: copyDiag,
          onUse: useAs(previewItem),
          onEdit: editOne,
          busy
        }) : null,
        toast ? h("div", { className: "jz-toast" }, toast) : null,
        settingsOpen ? h(SettingsDialog, {
          state: state || {},
          models,
          onClose: () => setSettingsOpen(false),
          onTest: async (patch) => {
            const saved = await call("config", { patch });
            setState({ ...saved, canEditConfig: true });
            await loadCatalog();
            return (await call("models", { refresh: true })).models.length;
          },
          onSave: async (patch) => {
            const saved = await call("config", { patch });
            setState({ ...saved, canEditConfig: true });
            await loadCatalog();
          }
        }) : null
      );
    }
    return Studio;
  }

  // src/client/i18n.js
  function createStudioLocale() {
    const ZH = {
      panelLabel: "mote 创作台",
      chatImageTitle: "图片创作",
      chatImageReady: "图片已生成",
      chatGeneratedImage: "生成图片",
      chatPreparing: "正在规划图片",
      chatGenerating: "正在生成图片",
      chatCheckStatus: "查询状态",
      chatViewPrompt: "查看提示词",
      chatOriginalPrompt: "原始需求",
      chatActualPrompt: "实际提示词",
      chatOpenFile: "打开文件",
      chatSaved: "已保存文件",
      chatHideFailed: "无法保存隐藏记录，下次打开可能再次显示此聊天作品。",
      editAgain: "再次编辑",
      editAgainHint: "恢复到输入区，修改后再生成",
      editRestoredHint: "已恢复完整输入。修改后点击生成会创建新任务。",
      editLegacyHint: "已恢复旧作品现存的提示词和参数，参考素材未保存，请核对并补充后生成。",
      editSnapshotFailed: "无法读取完整输入，当前草稿已保留，请稍后重试。",
      editDraftChanged: "读取期间草稿已更改，已保留你的修改，请再次点击「再次编辑」。",
      editModelUnavailable: "原模型或渠道当前不可用，请明确选择模型后生成。",
      chooseModel: "选择模型",
      submitting: "提交中",
      submissionUnknown: "待核实",
      prepared: "尚未提交",
      submissionId: "提交标识",
      channelLabel: "渠道",
      recover: "恢复查询",
      continueSubmission: "继续提交",
      regenerate: "重新生成",
      regenerateHint: "以相同输入创建新任务，可能产生新的费用",
      submissionUnknownHint: "提交结果待核实。请恢复查询；重新生成可能创建另一个计费任务。",
      snapshotUnavailable: "旧作品未保存完整输入，请重新编辑后生成。",
      storageUnavailable: "无法保存任务恢复记录，尚未提交生成。请释放浏览器存储空间后重试。",
      referenceUnsupported: "参考素材不符合当前模型的类型或数量限制，请移除素材或切换模型。",
      referenceImageOnly: "此处仅支持图片，请选择图片素材作为参考或首尾帧。",
      referencesTooLarge: "参考素材总量过大，请减少素材或压缩图片后重试。",
      uploadDraftChanged: "原草稿已被替换，本次上传未加入新草稿，请重新选择文件。",
      downloadFailed: "保存失败",
      nothingSaved: "没有可保存的产物",
      brand: "mote 创作台",
      greetingSubtitle: "输入描述或上传参考，把想法变成画面。",
      composerHint: "选择模型与参数，开始创作",
      gallerySubtitle: "最近生成的图片与视频",
      emptyTitle: "你的作品，从这里开始",
      kindImage: "图片",
      kindVideo: "视频",
      workDetails: "作品详情",
      promptLabel: "提示词",
      generationSettings: "生成设置",
      taskInformation: "查看任务信息",
      taskCost: "任务费用",
      taskCostHint: "此费用对应整个生成任务",
      sizeLabel: "尺寸",
      seedLabel: "种子",
      snapshotSaved: "输入快照已保存，可沿用完整输入重新生成。",
      generationInProgress: "完成后会自动更新",
      preparedHint: "输入已保存，尚未提交生成。",
      previewUnavailable: "预览暂不可用",
      previewUnavailableHint: "可尝试保存产物，或查看任务信息。",
      connected: "已连接",
      notConfigured: "未配置渠道",
      greeting: "你好，今天想创作什么？",
      modeImage: "图片生成",
      modeVideo: "视频生成",
      generateSwitch: "生成",
      canvasSwitch: "画布",
      promptPlaceholder: "输入想法、剧本或上传参考图，描述你想要的画面",
      typeLabel: "创作类型",
      modelLabel: "模型",
      searchModels: "搜索模型或渠道",
      noMatchingModels: "没有匹配的模型",
      ratioLabel: "比例",
      qualityLabel: "清晰度",
      countLabel: "张数",
      independentImagesHint: "按所选张数分别生成，每张图片独立提交并显示状态。",
      durationLabel: "时长",
      audioLabel: "声音",
      modeLabel: "模式",
      auto: "自动",
      send: "生成",
      uploading: "参考图太大（超过 2 MB），请压缩后再试",
      refsFull: "参考图数量已达该模型上限",
      framesFull: "首帧/尾帧已放满",
      inspirationTitle: "提示词灵感",
      inspirations: [
        "白色背景上的金属质感耳机，柔和棚拍光，产品摄影",
        "黄昏街头的女孩侧脸，胶片颗粒，85mm 浅景深",
        "雨夜霓虹的中式老街，湿润地面反光，电影感",
        "一只纸船漂过安静的河面，固定机位，清晨微光"
      ],
      cardTextToImage: "文生图",
      cardTextToImageDesc: "只写提示词，Seedream / Gemini / GPT Image",
      cardImageToImage: "参考图生图",
      cardImageToImageDesc: "上传参考图，改颜色、换风格、做融合",
      cardTextToVideo: "文生视频",
      cardTextToVideoDesc: "Seedance / 可灵 / MiniMax，可带声音",
      cardFrames: "首尾帧生视频",
      cardFramesDesc: "给首帧和尾帧，让模特转身或花苞绽放",
      gallery: "我的作品",
      empty: "还没有作品。写一句提示词，按右侧的生成键。",
      clearFinished: "清理已结束",
      clearVisibleFinished: "清理当前已结束",
      searchWorks: "搜索提示词、模型或渠道",
      filterType: "作品类型",
      filterStatus: "任务状态",
      allTypes: "全部类型",
      allStatuses: "全部状态",
      activeTasks: "处理中",
      resetFilters: "重置筛选",
      noMatchingWorks: "没有匹配的作品",
      noMatchingWorksHint: "试试其他关键词，或重置筛选查看全部作品。",
      preview: "预览",
      download: "保存到本地",
      reuse: "用作参考",
      reuseFirst: "用作首帧",
      reuseLast: "用作尾帧",
      remove: "删除",
      open: "新窗口打开",
      saved: "已保存",
      files: "个文件 →",
      queued: "排队中",
      running: "生成中",
      succeeded: "已完成",
      failed: "失败",
      reconciling: "核对中",
      cancelled: "已取消",
      task: "任务",
      cost: "费用",
      createdAt: "生成于",
      close: "关闭",
      settingsTitle: "渠道设置",
      channels: "渠道",
      addChannel: "＋ 添加渠道",
      noChannel: "还没有渠道。点「＋ 添加渠道」，mote 渠道填地址和密钥即可。",
      channelName: "名称（如 主渠道 / 备用）",
      channelBase: "接口地址，如 https://platform.sgt.site",
      channelKey: "虚拟密钥 / API Key",
      channelModels: "模型列表，逗号分隔；点「自动获取」直接从该渠道拉取",
      channelModelsMote: "mote 渠道留空即可，目录自动读取；也可「自动获取」后固定下来",
      autoFetch: "自动获取",
      probing: "获取中…",
      probeOk: "已获取",
      modelAuto: "自动（渠道首个可用）",
      deleteChannel: "删除渠道",
      channelsHint: "mote 统一渠道自带图片、视频与模型目录；OpenAI 兼容渠道用于接入自建的 /v1/images/generations。模型按渠道分组，生成自动走模型所属渠道。",
      channelReady: "已配置密钥",
      channelNoKey: "尚未填密钥",
      imageModel: "默认图片模型",
      videoModel: "默认视频模型",
      outputDir: "下载目录（留空用 Pictures\\mote-media）",
      save: "保存",
      saving: "保存中…",
      testSave: "保存并测试",
      testing: "测试中…",
      testOk: "连接成功",
      modelsCount: "个可用模型",
      needKey: "先在「渠道设置」里填虚拟密钥。",
      routeDown: "面板路由未注册，浏览器打到的是：",
      noModel: "该渠道下没有可用模型",
      references: "参考图",
      firstFrame: "首帧",
      lastFrame: "尾帧",
      countSuffix: "张",
      secondsSuffix: "秒",
      on: "开",
      off: "关",
      removeRef: "移除",
      expiring: "签名链接即将过期，先保存到本地",
      retry: "重试",
      retrySubmitted: "已创建新的生成任务",
      retryHint: "重新生成会创建新任务，并可能产生新的费用。",
      copyDiag: "复制诊断信息",
      diagCopied: "诊断信息已复制到剪贴板",
      requestId: "请求 ID",
      errorCode: "错误码",
      errorStage: "出错环节",
      retryable: "可重试",
      retryableYes: "可重试",
      retryableNo: "不可重试",
      inlinedRefs: "张局域网参考已内联为 base64"
    };
    const EN = {
      panelLabel: "mote Studio",
      chatImageTitle: "Image creation",
      chatImageReady: "Image ready",
      chatGeneratedImage: "Generated image",
      chatPreparing: "Planning image",
      chatGenerating: "Generating image",
      chatCheckStatus: "Check status",
      chatViewPrompt: "View prompt",
      chatOriginalPrompt: "Original request",
      chatActualPrompt: "Actual prompt",
      chatOpenFile: "Open file",
      chatSaved: "Files saved",
      chatHideFailed: "Could not remember this removal. The chat work may appear again next time.",
      editAgain: "Edit again",
      editAgainHint: "Restore inputs to the composer for editing",
      editRestoredHint: "Complete inputs restored. Generating after editing creates a new task.",
      editLegacyHint: "Saved prompt and parameters restored. This older work has no saved references; check and add them before generating.",
      editSnapshotFailed: "Cannot read the complete inputs. Your current draft is preserved; try again later.",
      editDraftChanged: "Your draft changed while loading and was preserved. Select Edit again to retry.",
      editModelUnavailable: "The original model or channel is unavailable. Select a model before generating.",
      chooseModel: "Choose a model",
      submitting: "Submitting",
      submissionUnknown: "Unconfirmed",
      prepared: "Not submitted",
      submissionId: "Submission",
      channelLabel: "Channel",
      recover: "Recover status",
      continueSubmission: "Continue submission",
      regenerate: "Generate again",
      regenerateHint: "Create a new task with the same input; a new charge may apply",
      submissionUnknownHint: "Submission is unconfirmed. Recover its status; generating again may create another charged task.",
      snapshotUnavailable: "This older work has no complete input snapshot. Edit the inputs before generating.",
      storageUnavailable: "Cannot save a recovery record. Generation has not been submitted. Free browser storage and retry.",
      referenceUnsupported: "References do not match this model’s supported types or limits. Remove them or change the model.",
      referenceImageOnly: "Only images can be used as references or frames here.",
      referencesTooLarge: "The combined references are too large. Remove or compress images before retrying.",
      uploadDraftChanged: "The original draft was replaced. Select the file again to add it to the new draft.",
      downloadFailed: "Failed to save",
      nothingSaved: "No artifact was saved",
      brand: "mote Studio",
      greetingSubtitle: "Describe an idea or add a reference. Make it yours.",
      composerHint: "Choose a model and settings to create",
      gallerySubtitle: "Your recent images and videos",
      emptyTitle: "Your next creation starts here",
      kindImage: "Image",
      kindVideo: "Video",
      workDetails: "Creation details",
      promptLabel: "Prompt",
      generationSettings: "Generation settings",
      taskInformation: "Task information",
      taskCost: "Task cost",
      taskCostHint: "This is the cost of the entire generation task",
      sizeLabel: "Size",
      seedLabel: "Seed",
      snapshotSaved: "The complete input is saved for generating again.",
      generationInProgress: "Updates automatically when ready",
      preparedHint: "Input saved. Generation has not been submitted.",
      previewUnavailable: "Preview unavailable",
      previewUnavailableHint: "Try saving the artifact or inspect the task details.",
      connected: "Connected",
      notConfigured: "No channel",
      greeting: "What shall we create today?",
      modeImage: "Image",
      modeVideo: "Video",
      generateSwitch: "Generate",
      canvasSwitch: "Canvas",
      promptPlaceholder: "Describe an idea, a script, or upload a reference",
      typeLabel: "Type",
      modelLabel: "Model",
      searchModels: "Search models or channels",
      noMatchingModels: "No matching models",
      ratioLabel: "Ratio",
      qualityLabel: "Quality",
      countLabel: "Count",
      independentImagesHint: "Generates each selected image in a separate request with its own status.",
      durationLabel: "Duration",
      audioLabel: "Audio",
      modeLabel: "Mode",
      auto: "Auto",
      send: "Generate",
      uploading: "Reference image is larger than 2 MB; compress it first",
      refsFull: "This model’s reference limit is reached",
      framesFull: "First and last frame are both taken",
      inspirationTitle: "Ideas",
      inspirations: [
        "Metal headphones on a white backdrop, soft studio light, product shot",
        "A girl in profile at dusk, film grain, 85mm shallow depth of field",
        "A rainy neon-lit Chinese street at night, wet reflections, cinematic",
        "A paper boat drifting on a quiet river, fixed camera, early light"
      ],
      cardTextToImage: "Text to image",
      cardTextToImageDesc: "Prompt only — Seedream / Gemini / GPT Image",
      cardImageToImage: "Image to image",
      cardImageToImageDesc: "Upload a reference to recolour, restyle or blend",
      cardTextToVideo: "Text to video",
      cardTextToVideoDesc: "Seedance / Kling / MiniMax, with sound",
      cardFrames: "First–last frame video",
      cardFramesDesc: "Give both frames: a turn, a bloom, a reveal",
      gallery: "My creations",
      empty: "Nothing yet. Write a prompt and press the send button.",
      clearFinished: "Clear finished",
      clearVisibleFinished: "Clear shown finished",
      searchWorks: "Search prompts, models or channels",
      filterType: "Work type",
      filterStatus: "Task status",
      allTypes: "All types",
      allStatuses: "All statuses",
      activeTasks: "In progress",
      resetFilters: "Reset filters",
      noMatchingWorks: "No matching works",
      noMatchingWorksHint: "Try other keywords or reset filters to view all works.",
      preview: "Preview",
      download: "Save locally",
      reuse: "Use as reference",
      reuseFirst: "Use as first frame",
      reuseLast: "Use as last frame",
      remove: "Delete",
      open: "Open in new window",
      saved: "Saved",
      files: "file(s) →",
      queued: "Queued",
      running: "Running",
      succeeded: "Done",
      failed: "Failed",
      reconciling: "Reconciling",
      cancelled: "Cancelled",
      task: "Task",
      cost: "Cost",
      createdAt: "Created",
      close: "Close",
      settingsTitle: "Channel settings",
      channels: "Channels",
      addChannel: "＋ Add channel",
      noChannel: "No channel yet. Add one: a mote channel needs only its address and key.",
      channelName: "Name (e.g. primary / backup)",
      channelBase: "Base URL, e.g. https://platform.sgt.site",
      channelKey: "Virtual key / API key",
      channelModels: "Model ids, comma separated; press Auto fetch to read them from the channel",
      channelModelsMote: "mote channels read the catalog automatically; Auto fetch pins a subset",
      autoFetch: "Auto fetch",
      probing: "Fetching…",
      probeOk: "Fetched",
      modelAuto: "Auto (first available)",
      deleteChannel: "Remove channel",
      channelsHint: "A mote channel brings images, videos and its own catalog; an OpenAI-compatible channel reaches any /v1/images/generations endpoint. Models are grouped by channel and a run routes to the channel that owns the model.",
      channelReady: "Key configured",
      channelNoKey: "No key yet",
      imageModel: "Default image model",
      videoModel: "Default video model",
      outputDir: "Download directory (empty = Pictures\\mote-media)",
      save: "Save",
      saving: "Saving…",
      testSave: "Save & test",
      testing: "Testing…",
      testOk: "Connected",
      modelsCount: "available models",
      needKey: "Set the virtual key in Channel settings first.",
      routeDown: "Panel route is not registered; the request went to:",
      noModel: "This channel exposes no usable model",
      references: "References",
      firstFrame: "First frame",
      lastFrame: "Last frame",
      countSuffix: "",
      secondsSuffix: "s",
      on: "On",
      off: "Off",
      removeRef: "Remove",
      expiring: "Signed link expires soon; save it locally",
      retry: "Retry",
      retrySubmitted: "Created a new generation task",
      retryHint: "Generating again creates a new task and may incur a new charge.",
      copyDiag: "Copy diagnostics",
      diagCopied: "Diagnostics copied",
      requestId: "Request id",
      errorCode: "Error code",
      errorStage: "Stage",
      retryable: "Retryable",
      retryableYes: "retryable",
      retryableNo: "not retryable",
      inlinedRefs: "LAN reference(s) inlined as base64"
    };
    let t = (key) => EN[key] ?? key;
    let ideas = EN.inspirations;
    function register(ctx) {
      const locale = ctx.get("locale");
      if (locale && typeof locale.register === "function") {
        for (const [id, dict] of [
          ["en", EN],
          ["zh", ZH],
          ["zh-CN", ZH]
        ]) {
          try {
            ctx.effect(() => locale.register("moteMedia", id, dict));
          } catch {
          }
        }
        try {
          const bound = locale.bind("moteMedia");
          if (typeof bound === "function") t = bound;
        } catch {
        }
      } else {
        const language = String(document.documentElement.lang || navigator.language || "en").toLowerCase();
        t = (key) => (language.startsWith("zh") ? ZH : EN)[key] ?? key;
      }
      ideas = String(t("modeImage")).startsWith("图") ? ZH.inspirations : EN.inspirations;
    }
    return { t: (key) => t(key), getIdeas: () => ideas, register };
  }

  // src/client/ui/PanelIcon.js
  function createPanelIcon(React) {
    const h = React.createElement;
    function PanelIcon(props) {
      const size = props && Number.isFinite(props.size) ? props.size : 20;
      const active = props && props.active === true;
      return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, "aria-hidden": true, style: { display: "block" } },
        h("rect", { x: 2.5, y: 3.5, width: 19, height: 14, rx: 3, fill: "none", stroke: "currentColor", strokeWidth: 1.5, opacity: active ? 1 : 0.85 }),
        h("circle", { cx: 8, cy: 8.5, r: 1.6, fill: "currentColor", opacity: 0.9 }),
        h("path", { d: "M5 14.5l4-4 3 2.8 2.6-2.6 3.9 3.8", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
        h("path", { d: "M9 20.5h6", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", opacity: 0.8 })
      );
    }
    return PanelIcon;
  }

  // src/client/styles/chat.js
  var CHAT_CSS = `
.mm-chat{font:inherit;color:inherit;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:14px;overflow:hidden;margin:8px 0;background:color-mix(in srgb,currentColor 2.5%,transparent);max-width:720px;min-width:0}
.mm-chat *{box-sizing:border-box}.mm-chat button,.mm-chat a{font:inherit;color:inherit}
.mm-chat-head{display:flex;align-items:center;gap:10px;padding:14px 16px;min-width:0}.mm-chat-icon{color:#64857a;flex-shrink:0}.mm-chat-heading{min-width:0;flex:1}.mm-chat-heading strong{display:block;font-size:14px;font-weight:600}.mm-chat-heading small{display:block;opacity:.55;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.mm-chat-status{font-size:11px;border-radius:30px;padding:4px 8px;background:#64857a13;color:#49705f;white-space:nowrap}.mm-chat-status.pending{color:#7c6d4d;background:#a8904d12}.mm-chat-status.warning{color:#9b6b25;background:#c2903415}.mm-chat-status.error{color:#ae5353;background:#ae535310}
.mm-chat-params{display:flex;gap:6px;flex-wrap:wrap;padding:0 16px 12px}.mm-chat-params span{font-size:11px;opacity:.7;border:1px solid var(--border,#e3e3e5);padding:3px 8px;border-radius:6px}
.mm-chat-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:6px;padding:0 10px 10px}.mm-chat-image{display:block;border:0;padding:0;background:#8888880c;cursor:zoom-in;min-width:0;border-radius:8px;overflow:hidden}.mm-chat-image img{display:block;width:100%;height:270px;object-fit:contain}.mm-chat-image:only-child img{height:auto;max-height:390px;min-height:120px}
.mm-chat-prompt{padding:0 16px 12px;font-size:12px}.mm-chat-prompt summary{cursor:pointer;opacity:.65;padding:4px 0}.mm-chat-prompt section{padding:10px 0 0}.mm-chat-prompt h4{margin:0 0 5px;font-size:11px;opacity:.5;font-weight:500}.mm-chat-prompt p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;max-height:200px;overflow:auto}
.mm-chat-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--border,#e3e3e5);font-size:12px}.mm-chat-actions button,.mm-chat-actions a{border:1px solid var(--border,#dedee0);background:transparent;border-radius:6px;padding:5px 9px;cursor:pointer;text-decoration:none}.mm-chat button:hover,.mm-chat a:hover{background:#8888880d}.mm-chat button:focus-visible,.mm-chat a:focus-visible,.mm-chat summary:focus-visible{outline:2px solid #769f8e;outline-offset:2px}.mm-chat-actions button:disabled{opacity:.4;cursor:wait}.mm-chat-saved{opacity:.5;margin-left:auto;font-size:11px}
.mm-chat-note{font-size:12px;line-height:1.5;padding:0 16px 12px;overflow-wrap:anywhere;opacity:.8}.mm-chat-note.error{color:#ae5353}.mm-chat-note.warning{color:#a47b36}.mm-chat-fallback{margin:0;padding:0 16px 14px;max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
.mm-chat-overlay{position:fixed;inset:0;z-index:1000;background:#12151dd9;display:flex;align-items:center;justify-content:center;padding:24px}.mm-chat-dialog{position:relative;max-width:100%;max-height:100%;outline:none}.mm-chat-dialog img{display:block;max-width:min(1100px,90vw);max-height:86vh;object-fit:contain;border-radius:8px}.mm-chat-close{position:absolute;right:8px;top:8px;display:flex;align-items:center;justify-content:center;border:0;border-radius:100%;width:32px;height:32px;background:#fff;color:#222!important;cursor:pointer;box-shadow:0 1px 5px #0003}
@media(prefers-color-scheme:dark){.mm-chat-actions{border-color:#ffffff19}.mm-chat-params span,.mm-chat-actions button,.mm-chat-actions a{border-color:#ffffff20}.mm-chat-status{color:#9fc4b2}.mm-chat-status.warning{color:#d6b071}}
`;

  // src/client/features/chat/media-call.js
  var object = (value) => value && typeof value === "object" && !Array.isArray(value);
  function callArguments(block) {
    try {
      const parsed = JSON.parse(block?.argsRaw || block?.call?.argsRaw || "{}");
      return object(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  function validSingleResult(result) {
    if (!object(result) || typeof result.submissionId !== "string" && !object(result.task)) return false;
    if (result.task !== void 0 && result.task !== null) {
      const task = result.task;
      if (!object(task) || typeof task.status !== "string" || task.type === "video" || task.model !== void 0 && typeof task.model !== "string" || task.artifacts !== void 0 && (!Array.isArray(task.artifacts) || task.artifacts.some((row) => !object(row)))) return false;
    }
    if (result.creation !== void 0 && result.creation !== null) {
      const creation = result.creation;
      if (!object(creation) || typeof creation.prompt !== "string" || creation.originalPrompt !== void 0 && typeof creation.originalPrompt !== "string" || creation.params !== void 0 && (!object(creation.params) || Object.values(creation.params).some((value) => !["string", "number", "boolean"].includes(typeof value)))) return false;
    }
    if (result.error !== void 0 && result.error !== null && typeof result.error !== "string") return false;
    if (result.saved !== void 0 && (!Array.isArray(result.saved) || result.saved.some((row) => !object(row) || row.error !== void 0 && typeof row.error !== "string"))) return false;
    return true;
  }
  function validResult(result) {
    if (object(result) && Array.isArray(result.results)) return result.results.length > 0 && result.results.length <= 15 && result.results.every(validSingleResult) && (result.error === void 0 || typeof result.error === "string");
    return validSingleResult(result);
  }
  var individualMediaResults = (result) => result ? result.results || [result] : [];
  function readMediaResult(block) {
    if (block?.isError || !Array.isArray(block?.content) || block.content.some((part) => part.type !== "text")) return null;
    for (const part of block.content) {
      if (part.type !== "text" || typeof part.text !== "string") continue;
      try {
        const result = JSON.parse(part.text);
        if (validResult(result)) return result;
      } catch {
      }
    }
    return null;
  }
  function extraToolText(block) {
    return (block?.content || []).filter((part) => {
      if (part.type !== "text") return false;
      try {
        return !validResult(JSON.parse(part.text));
      } catch {
        return true;
      }
    }).map((part) => part.text).join("\n");
  }
  function resultFromSubmission(submission) {
    return {
      submissionId: submission.id,
      state: submission.state,
      channelId: submission.channelId,
      task: submission.task,
      creation: submission.creation,
      saved: submission.saved || [],
      error: submission.error?.message || null,
      queryError: submission.queryError || null
    };
  }
  function imageUrl(value) {
    if (typeof value !== "string" || !/^(https?:\/\/|data:image\/|\/api\/mote-media\/asset\?)/i.test(value)) return null;
    return primaryMedia({ type: "image", artifacts: [{ kind: "image", state: "available", url: value }] })?.url || null;
  }
  function mediaImages(result) {
    const artifacts = Array.isArray(result?.task?.artifacts) ? result.task.artifacts : [];
    const saved = Array.isArray(result?.saved) ? result.saved : [];
    return artifacts.flatMap((artifact, artifactIndex) => {
      if (!object(artifact) || artifact.kind !== "image" || artifact.state !== "available") return [];
      const local = saved.find((row) => row && row.artifactIndex === artifactIndex && !row.error && imageUrl(row.url));
      const url = imageUrl(local?.url || artifact.url);
      return url ? [{ artifactIndex, url, path: typeof local?.path === "string" ? local.path : null }] : [];
    });
  }
  function rawToolText(block) {
    if (!Array.isArray(block?.content)) return block?.argsRaw || "";
    return block.content.map((part) => part.type === "text" ? part.text : JSON.stringify(part, null, 2)).join("\n") || block.error?.message || block.error?.code || "";
  }
  function mediaStatus(result) {
    return result?.task?.status || { unknown: "submission_unknown", failed: "failed", prepared: "prepared", submitting: "submitting" }[result?.state] || (result?.error ? "failed" : "running");
  }

  // src/client/features/chat/MediaToolRow.js
  function createMediaToolRow(React, { t, call }) {
    const h = React.createElement;
    const Icon = createIcon(React);
    const useDialog = createUseDialog(React);
    function Preview({ image, onClose }) {
      const ref = useDialog(onClose);
      return h(
        "div",
        { className: "mm-chat-overlay", onMouseDown: (event) => {
          if (event.target === event.currentTarget) onClose();
        } },
        h(
          "div",
          { className: "mm-chat-dialog", role: "dialog", "aria-modal": true, "aria-label": t("preview"), ref, tabIndex: -1 },
          h("img", { src: image.url, alt: t("chatGeneratedImage") }),
          h("button", { className: "mm-chat-close", onClick: onClose, "aria-label": t("close"), "data-autofocus": true }, h(Icon, { name: "close", size: 18 }))
        )
      );
    }
    function MediaResultRow(props) {
      const [override, setOverride] = React.useState(null);
      const [preview, setPreview] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [notice, setNotice] = React.useState("");
      const alive = React.useRef(true);
      const acting = React.useRef(false);
      React.useEffect(() => {
        alive.current = true;
        return () => {
          alive.current = false;
        };
      }, []);
      React.useEffect(() => {
        setOverride(null);
        setNotice("");
        setPreview(null);
      }, [props.block, props.result]);
      const block = props.block || {};
      const result = override || props.result || readMediaResult(block);
      const args = callArguments(block);
      const raw = rawToolText(block);
      const extra = props.hideExtra ? "" : extraToolText(block);
      const settled = props.phase === "result" || Array.isArray(block.content);
      if (!result) {
        let prompt = args.prompt || "";
        try {
          prompt || (prompt = block.args?.text?.("prompt") || "");
        } catch {
        }
        return h(
          "div",
          { className: "mm-chat" },
          h("style", null, CHAT_CSS),
          h(
            "div",
            { className: "mm-chat-head" },
            h(Icon, { name: "image", size: 18 }),
            h("div", { className: "mm-chat-heading" }, h("strong", null, settled ? props.toolName || block.name : t(props.phase === "preparing" ? "chatPreparing" : "chatGenerating")))
          ),
          h("pre", { className: "mm-chat-fallback" }, settled ? raw : prompt)
        );
      }
      const status = mediaStatus(result);
      const images = mediaImages(result);
      const creation = result.creation || { prompt: args.prompt || "", originalPrompt: args.original_prompt || "", params: args };
      const params = creation.params || {};
      const model = result.task?.model || args.model || "";
      const saved = Array.isArray(result.saved) ? result.saved : [];
      const failures = saved.filter((row) => row?.error);
      const files = saved.filter((row) => row && !row.error && typeof row.path === "string");
      const recoverable = isPending({ status }) && Boolean(result.submissionId);
      const runAction = async (action) => {
        if (acting.current) return;
        acting.current = true;
        setBusy(true);
        setNotice("");
        try {
          const response = await call(action, { submissionId: result.submissionId });
          const next = action === "submission" ? resultFromSubmission(response.submission) : { ...result, saved: response.saved || [], task: response.task || result.task, saveError: null };
          if (alive.current) setOverride(next);
        } catch (error) {
          if (alive.current) setNotice(error.message);
        } finally {
          acting.current = false;
          if (alive.current) setBusy(false);
        }
      };
      return h(
        "div",
        { className: "mm-chat" },
        h("style", null, CHAT_CSS),
        h(
          "header",
          { className: "mm-chat-head" },
          h("span", { className: "mm-chat-icon" }, h(Icon, { name: "sparkles", size: 20 })),
          h(
            "div",
            { className: "mm-chat-heading" },
            h("strong", null, t(status === "succeeded" ? "chatImageReady" : status === "submission_unknown" ? "submissionUnknown" : "chatImageTitle")),
            model ? h("small", { title: [result.channelId, model].filter(Boolean).join(" · ") }, modelDisplayName(model)) : null
          ),
          h("span", { className: `mm-chat-status ${statusTone(status)}` }, statusLabel(status, t))
        ),
        h("div", { className: "mm-chat-params" }, ["aspect_ratio", "size", "resolution", "n"].filter((key) => params[key] !== void 0).map((key) => h("span", { key, title: t({ aspect_ratio: "ratioLabel", size: "sizeLabel", resolution: "qualityLabel", n: "countLabel" }[key]) }, String(params[key]), key === "n" ? ` ${t("countSuffix")}` : ""))),
        images.length ? h("div", { className: "mm-chat-images" }, images.map((image, index) => h(
          "button",
          { type: "button", className: "mm-chat-image", key: image.artifactIndex, onClick: () => setPreview(image), "aria-label": `${t("preview")} ${index + 1}` },
          h("img", { src: image.url, alt: `${t("chatGeneratedImage")} ${index + 1}`, loading: "lazy" })
        ))) : null,
        creation.prompt ? h(
          "details",
          { className: "mm-chat-prompt" },
          h("summary", null, t("chatViewPrompt")),
          creation.originalPrompt && creation.originalPrompt !== creation.prompt ? h("section", null, h("h4", null, t("chatOriginalPrompt")), h("p", null, creation.originalPrompt)) : null,
          h("section", null, h("h4", null, t("chatActualPrompt")), h("p", null, creation.prompt))
        ) : null,
        status === "submission_unknown" ? h("p", { className: "mm-chat-note warning" }, t("submissionUnknownHint")) : result.error ? h("p", { className: "mm-chat-note error" }, result.error) : null,
        failures.length || result.saveError ? h("p", { className: "mm-chat-note warning" }, `${t("downloadFailed")}: ${failures.map((row) => row.error).join("; ") || result.saveError}`) : null,
        result.queryError || notice ? h("p", { className: "mm-chat-note warning", role: "status" }, notice || result.queryError) : null,
        extra ? h("p", { className: "mm-chat-note" }, extra) : null,
        recoverable || images.length ? h(
          "footer",
          { className: "mm-chat-actions" },
          recoverable ? h("button", { type: "button", disabled: busy, onClick: () => runAction("submission") }, t("chatCheckStatus")) : null,
          images.length && result.submissionId ? h("button", { type: "button", disabled: busy, onClick: () => runAction("download") }, t("download")) : null,
          files.length && typeof props.openFile === "function" ? h("button", { type: "button", onClick: () => props.openFile(files[0].path) }, t("chatOpenFile")) : null,
          !result.submissionId && images.length ? h("a", { href: images[0].url, target: "_blank", rel: "noreferrer" }, t("open")) : null,
          files.length ? h("span", { className: "mm-chat-saved" }, t("chatSaved"), " ", files.length) : null
        ) : null,
        preview ? h(Preview, { image: preview, onClose: () => setPreview(null) }) : null
      );
    }
    return function MediaToolRow(props) {
      const result = readMediaResult(props.block);
      if (!Array.isArray(result?.results)) return h(MediaResultRow, props);
      const extra = extraToolText(props.block);
      return h(
        "div",
        { "data-mote-image-batch": true },
        individualMediaResults(result).map((row, index) => h(MediaResultRow, { ...props, key: row.submissionId || row.task?.id || index, result: row, hideExtra: true })),
        result.error || extra ? h("p", { className: "mm-chat-note warning" }, [result.error, extra].filter(Boolean).join("\n")) : null
      );
    };
  }

  // src/client/features/chat/MediaTurnTail.js
  var EMPTY = [];
  var EMPTY_SOURCE = { getSnapshot: () => EMPTY, subscribe: () => () => {
  } };
  var OWN_TOOLS = /* @__PURE__ */ new Set(["mote_image", "mote_media_task"]);
  function mediaBlocks(data) {
    const blocks = [];
    const visit = (block) => {
      if (!block) return;
      if (block.kind === "tool-result" && OWN_TOOLS.has(block.name || block.call?.name)) blocks.push(block);
      for (const child of block.subCalls || []) visit(child);
    };
    for (const row of data) visit(row.root);
    const latest = /* @__PURE__ */ new Map();
    for (const block of blocks.sort((left, right) => left.seq - right.seq)) {
      const result = readMediaResult(block);
      if (!result) continue;
      for (const row of individualMediaResults(result)) {
        const key = row.submissionId ? `submission:${row.submissionId}` : row.task?.id ? `task:${row.channelId || ""}:${row.task.id}` : `call:${block.callId}`;
        latest.set(key, result.results ? { ...block, content: [{ type: "text", text: JSON.stringify(row) }] } : block);
      }
    }
    return [...latest].map(([key, block]) => ({ key, block }));
  }
  function createMediaTurnTail(React, MediaToolRow) {
    return function MediaTurnTail({ turn, useChat, openFile }) {
      const nodes = useChat?.((snapshot) => snapshot.nodes);
      const source = React.useMemo(() => {
        const current = nodes?.turnDataSource?.(Number(turn.turn), "tool-call");
        return current ? {
          getSnapshot: () => current.getSnapshot(),
          subscribe: (listener) => current.subscribe(listener)
        } : EMPTY_SOURCE;
      }, [nodes, turn.turn]);
      const data = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
      const entries = React.useMemo(() => mediaBlocks(data), [data]);
      if (!entries.length) return null;
      return React.createElement("div", { "data-mote-image-results": true }, entries.map(({ key, block }) => React.createElement(MediaToolRow, {
        key,
        block,
        phase: "result",
        toolName: block.name || block.call?.name,
        callId: block.callId,
        openFile
      })));
    };
  }

  // src/client/plugin.js
  function createClientPlugin(React) {
    const locale = createStudioLocale();
    const { call } = createHostClient();
    const Studio = createStudio(React, {
      locale,
      call,
      storage: createWorksStorage()
    });
    const PanelIcon = createPanelIcon(React);
    const MediaToolRow = createMediaToolRow(React, { t: locale.t, call });
    const MediaTurnTail = createMediaTurnTail(React, MediaToolRow);
    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        locale.register(ctx);
        ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "mote-media", order: 0 }, Studio));
        ctx.slots.inject(
          "sidebar.panellist",
          () => ctx.slots.register(
            { name: "sidebar.panellist", id: "mote-media", order: 30, label: () => locale.t("panelLabel") },
            PanelIcon
          )
        );
        for (const key of ["mote_image", "mote_media_task"]) {
          ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key }, MediaToolRow));
        }
        ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register(
          { name: "conversation.chat.turnTail", id: "mote-media.images", order: 10 },
          MediaTurnTail
        ));
      }
    };
  }

  // src/client/entry.js
  window.__ModuleLoader__.load({
    id: "@local/dsh-mote-media",
    factory(require2) {
      return createClientPlugin(require2("react"));
    }
  });
})();
