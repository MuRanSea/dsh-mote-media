import { createIcon } from '../ui/Icon.js';
import { createUsePanelLayout } from '../ui/usePanelLayout.js';
import { modelById, defaultParams, paramsForModel } from '../domain/model-capabilities.js';
import { draftFromWork, referenceIssue, referencePlacement } from '../domain/drafts.js';
import { newId, isPending, primaryMedia, diagnosticsOf, normalizeWorks, mergeWorkTask, mergeSubmissionWorks, mergeChatWorks, removeWork, downloadOutcome } from '../domain/works.js';
import { createComposer } from '../features/composer/Composer.js';
import { createUseDrafts } from '../features/composer/useDrafts.js';
import { createGallery } from '../features/gallery/Gallery.js';
import { createLightbox } from '../features/gallery/Lightbox.js';
import { createSettingsDialog } from '../features/channels/SettingsDialog.js';
import { STUDIO_CSS } from '../styles/studio.js';

// Build component identities once, outside the Studio render function.
export function createStudio(React, { locale, call, storage }) {
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
      const setRefs = (value) => editor.patch((draft) => ({ refs: typeof value === 'function' ? value(draft.refs) : value }));
      const setFrames = (value) => editor.patch((draft) => ({ frames: typeof value === 'function' ? value(draft.frames) : value }));
      const [items, setItems] = useState(() => normalizeWorks(loadItems()));
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [preview, setPreview] = useState(null);
      const [toast, setToast] = useState('');
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
      const chatSignature = useRef('');
      itemsRef.current = items;
      modelsRef.current = models;

      const commit = (update, durable = false) => {
        if (!mounted.current) return;
        const next = update(itemsRef.current);
        if (durable && saveItems(next) === false) throw new Error(t('storageUnavailable'));
        itemsRef.current = next;
        setItems(next);
      };
      const say = useCallback((message) => {
        if (!mounted.current) return;
        setToast(message);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 5000);
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
        saveTimer.current = window.setTimeout(() => { saveItems(itemsRef.current); }, 300);
        return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
      }, [items]);

      const loadCatalog = useCallback(async () => {
        try {
          const result = await call('state');
          if (!mounted.current) return;
          setState(result);
          if (!result.configured) return;
          const [images, videos] = await Promise.all([
            call('models', { category: 'image' }).catch(() => ({ models: [] })),
            call('models', { category: 'video' }).catch(() => ({ models: [] })),
          ]);
          if (mounted.current) setModels({ image: images.models || [], video: videos.models || [] });
        } catch (cause) {
          if (mounted.current) { setState({ configured: false, channels: [] }); setError(cause.message); }
        }
      }, []);
      useEffect(() => { loadCatalog(); }, [loadCatalog]);

      const syncChat = useCallback(async () => {
        try {
          const result = await call('chat_works');
          if (!mounted.current || !Array.isArray(result.submissions)) return;
          const signature = JSON.stringify(result.submissions);
          if (signature === chatSignature.current) return;
          chatSignature.current = signature;
          commit(current => mergeChatWorks(current, result.submissions, hiddenChat.current));
        } catch { /* older Hosts and temporary outages keep existing works */ }
      }, []);
      useEffect(() => { syncChat(); }, [syncChat]);

      const recoverOne = async (item) => {
        try {
          const result = await call('submission', { submissionId: item.submissionId });
          commit((current) => mergeSubmissionWorks(current, result.submission));
        } catch (cause) {
          commit((current) => current.map((entry) => entry.submissionId === item.submissionId
            ? { ...entry, status: 'submission_unknown', recoveryRequired: true, error: { code: cause.code, message: cause.message } } : entry));
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
            const ids = [...new Set(current.filter((item) => item.submissionId && isPending(item) && item.status !== 'prepared' && !item.recoveryRequired).map((item) => item.submissionId))];
            const legacyIds = [...new Set(current.filter((item) => !item.submissionId && isPending(item) && item.taskId).map((item) => item.taskId))];
            if (ids.length) {
              const result = await call('submissions', { ids });
              if (disposed) return;
              for (const row of result.submissions || []) {
                if (row.submission) commit((records) => mergeSubmissionWorks(records, row.submission));
                else if (row.error) commit((records) => records.map((item) => item.submissionId === row.id
                  ? { ...item, status: 'submission_unknown', recoveryRequired: true, error: row.error } : item));
              }
            }
            if (legacyIds.length) {
              const result = await call('tasks', { ids: legacyIds });
              if (disposed) return;
              for (const row of result.tasks || []) if (row.task) commit((records) => mergeWorkTask(records, row.id, row.task));
            }
          } catch { /* preserve receipts; the next safe query may recover */ }
          finally { polling.current = false; }
        }, 3000);
        return () => { disposed = true; window.clearInterval(timer); };
      }, []);

      const model = modelById(models, type, modelId);
      const draftIssue = referenceIssue(editor.draft, model, type);
      const modelUnavailable = modelId !== null && !model;
      const blocked = Boolean(state && !state.configured);
      const switchType = (nextType) => {
        editor.switchTo(nextType); setError('');
      };
      const submitSnapshot = async (snapshot, resumeId, count = 1) => {
        if (submitting.current) return;
        if (blocked) { setSettingsOpen(true); setError(t('needKey')); return; }
        submitting.current = true; setBusy(true); setError('');
        try {
          const ids = resumeId ? [resumeId] : Array.from({ length: count }, () => newId());
          if (!resumeId) {
            if (snapshot.kind === 'image') snapshot = { ...snapshot, params: { ...snapshot.params, n: 1, ...(count > 1 ? { waitSeconds: 0 } : {}) } };
            // Save every child intent before the first paid request. A partial
            // preparation failure leaves only explicit, undispatched receipts.
            for (const id of ids) {
              if (!mounted.current) return;
              await call('prepare', { submissionId: id, snapshot });
              if (!mounted.current) return;
              commit((current) => [{ id, groupId: id, submissionId: id, type: snapshot.kind, channelId: snapshot.channelId,
                model: snapshot.model, prompt: snapshot.prompt, params: snapshot.params, snapshotAvailable: true,
                status: 'prepared', createdAt: Date.now(), artifacts: [], error: null }, ...current], true);
            }
          }
          for (const id of ids) {
            if (!mounted.current) return;
            commit(current => current.map(item => item.submissionId === id ? { ...item, status: 'submitting' } : item));
            try {
              const result = await call('generate', { submissionId: id });
              commit((current) => mergeSubmissionWorks(current, result.submission));
              if (result.submission.state === 'unknown' && mounted.current) setError(t('submissionUnknownHint'));
              if (result.submission.state === 'failed' && mounted.current) setError(result.submission.error?.message || t('failed'));
              if (result.task?.inlined > 0) say(result.task.inlined + ' ' + t('inlinedRefs'));
            } catch (cause) {
              commit((current) => current.map((item) => item.submissionId === id && !item.taskId ? {
                ...item, status: cause.submissionUnknown === false ? 'failed' : 'submission_unknown',
                recoveryRequired: false, error: { code: cause.code, message: cause.message },
              } : item));
              if (mounted.current) setError(cause.submissionUnknown !== false ? t('submissionUnknownHint') : cause.message);
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
        if (draftIssue) { setError(t(draftIssue)); return; }
        const references = [];
        for (const ref of refs) references.push({ role: 'reference', type: 'image', url: ref.url, name: ref.name });
        if (type === 'video') {
          if (frames.first) references.push({ role: 'first_frame', type: 'image', url: frames.first.url, name: frames.first.name });
          if (frames.last) references.push({ role: 'last_frame', type: 'image', url: frames.last.url, name: frames.last.name });
        }
        await submitSnapshot({ kind: type, channelId: active.channelId, model: active.id, prompt: prompt.trim(), params: paramsForModel(active, params), references }, null, type === 'image' ? imageCount : 1);
      };
      const retryOne = async (item) => {
        if (submitting.current || loadingSnapshot.current) return;
        if (!item.submissionId || !item.snapshotAvailable) { setError(t('snapshotUnavailable')); return; }
        loadingSnapshot.current = true;
        setBusy(true);
        try {
          const result = await call('submission', { submissionId: item.submissionId, includeSnapshot: true });
          if (!result.submission.snapshot) throw new Error(t('snapshotUnavailable'));
          if (result.submission.state !== 'failed' && !['succeeded', 'failed', 'cancelled'].includes(result.submission.task?.status)) throw new Error(t('submissionUnknownHint'));
          await submitSnapshot(result.submission.snapshot);
        } catch (cause) { if (mounted.current) setError(cause.message); }
        finally { loadingSnapshot.current = false; if (mounted.current) setBusy(false); }
      };
      const continueOne = (item) => submitSnapshot(null, item.submissionId);

      const focusComposer = () => {
        textareaRef.current?.focus({ preventScroll: true });
        textareaRef.current?.closest('.jz-composer')?.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      };
      const editOne = async (item) => {
        if (submitting.current || loadingSnapshot.current) return;
        loadingSnapshot.current = true; setBusy(true);
        const version = editor.version.current;
        try {
          let snapshot;
          if (item.snapshotAvailable && item.submissionId) {
            const result = await call('submission', { submissionId: item.submissionId, includeSnapshot: true });
            snapshot = result.submission?.snapshot;
            if (!snapshot) throw new Error(t('editSnapshotFailed'));
          }
          if (!mounted.current) return;
          if (editor.version.current !== version) throw new Error(t('editDraftChanged'));
          editor.restore(draftFromWork(item, snapshot, modelsRef.current));
          setError(''); setPreview(null); focusComposer();
        } catch (cause) {
          if (mounted.current) { setPreview(null); setError(cause.message); focusComposer(); }
        } finally {
          loadingSnapshot.current = false;
          if (mounted.current) setBusy(false);
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
          const result = await call('download', { id: item.taskId, submissionId: item.submissionId, channelId: item.channelId, artifactIndex: item.artifactIndex });
          const outcome = downloadOutcome(result);
          const summary = t('saved') + ' ' + outcome.succeeded + ' ' + t('files') + ' ' + result.dir;
          setPreview(null);
          if (outcome.failed.length || !outcome.succeeded) {
            const details = outcome.failed.map((entry) => (entry.path || '') + ': ' + (entry.error || t('downloadFailed'))).join(' · ');
            const message = summary + ' · ' + t('downloadFailed') + ' ' + outcome.failed.length + (details ? ' · ' + details : ' · ' + t('nothingSaved'));
            setError(message); say(message);
          } else { setError(''); say(summary); }
        } catch (cause) { setPreview(null); setError(cause.message); say(cause.message); }
      };

      const useAs = (item) => {
        const media = primaryMedia(item);
        if (!media) return null;
        const reference = { type: item.type === 'image' && !media.video ? 'image' : 'video', url: media.source || media.url, name: item.model };
        const placement = referencePlacement(editor.draft, model, type, reference);
        const label = t(placement.slot === 'first' ? 'reuseFirst' : placement.slot === 'last' ? 'reuseLast' : 'reuse');
        return { label, disabled: Boolean(placement.error), reason: placement.error ? t(placement.error) : '', run() {
          const issue = editor.addReference(reference);
          if (issue) { say(t(issue)); return false; }
          say(label); focusComposer(); return true;
        } };
      };

      const removeItems = (targets) => commit((current) => {
        const next = targets.reduce((records, item) => removeWork(records, item), current);
        for (const item of targets) if (item.source === 'chat' && !next.some(entry => entry.submissionId === item.submissionId)) hiddenChat.current.add(item.submissionId);
        if (storage.saveHiddenChat?.([...hiddenChat.current]) === false) say(t('chatHideFailed'));
        return next;
      });
      const clearFinished = (targets) => removeItems(targets.filter((item) => !isPending(item)));
      const hasWorks = items.length > 0;
      const previewItem = preview ? items.find((item) => item.id === preview.id) || preview : null;

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
        { className: 'jz-root', ref: panel.ref, 'data-layout': panel.layout },
        h('style', null, STUDIO_CSS),
        h(
          'header',
          { className: 'jz-head' },
          h('div', { className: 'jz-brand' }, h('span', { className: 'jz-logo' }, h(Icon, { name: 'sparkles', size: 19 })), h('span', null, t('brand')), h('small', { className: 'jz-brand-caption' }, 'MEDIA STUDIO')),
          h('span', { className: 'jz-spacer' }),
          h(
            'span',
            { className: 'jz-chip-status' },
            h('span', { className: `jz-dot ${state && state.configured ? 'ok' : 'bad'}` }),
            h('span', { className: 'jz-status-text' }, state && state.configured ? t('connected') : t('notConfigured')),
          ),
          h('button', { className: 'jz-icon-btn', title: t('settingsTitle'), 'aria-label': t('settingsTitle'), onClick: () => setSettingsOpen(true) }, h(Icon, { name: 'settings' })),
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
              h('p', null, t('greetingSubtitle')),
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
              draftIssue: modelUnavailable ? 'editModelUnavailable' : draftIssue,
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
              onAddReference: (reference, slot) => mounted.current ? editor.addReference(reference, slot) : '',
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
                getIdeas().map((idea, index) =>
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
                    'button',
                    { type: 'button', className: 'jz-card', onClick: () => applyCard('image', 'text') },
                    h('span', { className: 'jz-card-title' }, t('cardTextToImage')),
                    h('span', { className: 'jz-card-desc' }, t('cardTextToImageDesc')),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'jz-card', onClick: () => applyCard('image', 'reference') },
                    h('span', { className: 'jz-card-title' }, t('cardImageToImage')),
                    h('span', { className: 'jz-card-desc' }, t('cardImageToImageDesc')),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'jz-card', onClick: () => applyCard('video', 'text') },
                    h('span', { className: 'jz-card-title' }, t('cardTextToVideo')),
                    h('span', { className: 'jz-card-desc' }, t('cardTextToVideoDesc')),
                  ),
                  h(
                    'button',
                    { type: 'button', className: 'jz-card', onClick: () => applyCard('video', 'frames') },
                    h('span', { className: 'jz-card-title' }, t('cardFrames')),
                    h('span', { className: 'jz-card-desc' }, t('cardFramesDesc')),
                  ),
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
              busy,
            }),
          ),
        ),
        preview
          ? h(Lightbox, {
              item: previewItem,
              onClose: () => setPreview(null),
              onDownload: download,
              onRetry: retryOne,
              onRecover: recoverOne,
              onContinue: continueOne,
              onCopy: copyDiag,
              onUse: useAs(previewItem),
              onEdit: editOne,
              busy,
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

  return Studio;
}
