import { createIcon } from '../../ui/Icon.js';
import { createUseDialog } from '../../ui/useDialog.js';
import { modelDisplayName, statusTone } from '../../ui/presentation.js';
import { isPending, statusLabel } from '../../domain/works.js';
import { CHAT_CSS } from '../../styles/chat.js';
import { callArguments, readMediaResult, individualMediaResults, resultFromSubmission, mediaImages, rawToolText, mediaStatus, extraToolText } from './media-call.js';

/** Own only the plugin's tool names; rendering never submits a generation. */
export function createMediaToolRow(React, { t, call }) {
  const h = React.createElement;
  const Icon = createIcon(React);
  const useDialog = createUseDialog(React);
  function Preview({ image, onClose }) {
    const ref = useDialog(onClose);
    return h('div', { className: 'mm-chat-overlay', onMouseDown: event => { if (event.target === event.currentTarget) onClose(); } },
      h('div', { className: 'mm-chat-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('preview'), ref, tabIndex: -1 },
        h('img', { src: image.url, alt: t('chatGeneratedImage') }),
        h('button', { className: 'mm-chat-close', onClick: onClose, 'aria-label': t('close'), 'data-autofocus': true }, h(Icon, { name: 'close', size: 18 }))));
  }
  function MediaResultRow(props) {
    const [override, setOverride] = React.useState(null);
    const [preview, setPreview] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const alive = React.useRef(true);
    const acting = React.useRef(false);
    React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    React.useEffect(() => { setOverride(null); setNotice(''); setPreview(null); }, [props.block, props.result]);
    const block = props.block || {};
    const result = override || props.result || readMediaResult(block);
    const args = callArguments(block);
    const raw = rawToolText(block);
    const extra = props.hideExtra ? '' : extraToolText(block);
    const settled = props.phase === 'result' || Array.isArray(block.content);
    if (!result) {
      let prompt = args.prompt || '';
      try { prompt ||= block.args?.text?.('prompt') || ''; } catch { /* incomplete streamed arguments */ }
      return h('div', { className: 'mm-chat' }, h('style', null, CHAT_CSS),
        h('div', { className: 'mm-chat-head' }, h(Icon, { name: 'image', size: 18 }),
          h('div', { className: 'mm-chat-heading' }, h('strong', null, settled ? props.toolName || block.name : t(props.phase === 'preparing' ? 'chatPreparing' : 'chatGenerating')))),
        h('pre', { className: 'mm-chat-fallback' }, settled ? raw : prompt));
    }
    const status = mediaStatus(result);
    const images = mediaImages(result);
    const creation = result.creation || { prompt: args.prompt || '', originalPrompt: args.original_prompt || '', params: args };
    const params = creation.params || {};
    const model = result.task?.model || args.model || '';
    const saved = Array.isArray(result.saved) ? result.saved : [];
    const failures = saved.filter(row => row?.error);
    const files = saved.filter(row => row && !row.error && typeof row.path === 'string');
    const recoverable = isPending({ status }) && Boolean(result.submissionId);
    const runAction = async (action) => {
      if (acting.current) return;
      acting.current = true; setBusy(true); setNotice('');
      try {
        const response = await call(action, { submissionId: result.submissionId });
        const next = action === 'submission' ? resultFromSubmission(response.submission) : { ...result, saved: response.saved || [], task: response.task || result.task, saveError: null };
        if (alive.current) setOverride(next);
      } catch (error) { if (alive.current) setNotice(error.message); }
      finally { acting.current = false; if (alive.current) setBusy(false); }
    };
    return h('div', { className: 'mm-chat' }, h('style', null, CHAT_CSS),
      h('header', { className: 'mm-chat-head' }, h('span', { className: 'mm-chat-icon' }, h(Icon, { name: 'sparkles', size: 20 })),
        h('div', { className: 'mm-chat-heading' }, h('strong', null, t(status === 'succeeded' ? 'chatImageReady' : status === 'submission_unknown' ? 'submissionUnknown' : 'chatImageTitle')),
          model ? h('small', { title: [result.channelId, model].filter(Boolean).join(' · ') }, modelDisplayName(model)) : null),
        h('span', { className: `mm-chat-status ${statusTone(status)}` }, statusLabel(status, t))),
      h('div', { className: 'mm-chat-params' }, ['aspect_ratio', 'size', 'resolution', 'n'].filter(key => params[key] !== undefined).map(key =>
        h('span', { key, title: t(({ aspect_ratio: 'ratioLabel', size: 'sizeLabel', resolution: 'qualityLabel', n: 'countLabel' })[key]) }, String(params[key]), key === 'n' ? ` ${t('countSuffix')}` : ''))),
      images.length ? h('div', { className: 'mm-chat-images' }, images.map((image, index) =>
        h('button', { type: 'button', className: 'mm-chat-image', key: image.artifactIndex, onClick: () => setPreview(image), 'aria-label': `${t('preview')} ${index + 1}` },
          h('img', { src: image.url, alt: `${t('chatGeneratedImage')} ${index + 1}`, loading: 'lazy' })))) : null,
      creation.prompt ? h('details', { className: 'mm-chat-prompt' }, h('summary', null, t('chatViewPrompt')),
        creation.originalPrompt && creation.originalPrompt !== creation.prompt ? h('section', null, h('h4', null, t('chatOriginalPrompt')), h('p', null, creation.originalPrompt)) : null,
        h('section', null, h('h4', null, t('chatActualPrompt')), h('p', null, creation.prompt))) : null,
      status === 'submission_unknown' ? h('p', { className: 'mm-chat-note warning' }, t('submissionUnknownHint')) : result.error ? h('p', { className: 'mm-chat-note error' }, result.error) : null,
      failures.length || result.saveError ? h('p', { className: 'mm-chat-note warning' }, `${t('downloadFailed')}: ${failures.map(row => row.error).join('; ') || result.saveError}`) : null,
      result.queryError || notice ? h('p', { className: 'mm-chat-note warning', role: 'status' }, notice || result.queryError) : null,
      extra ? h('p', { className: 'mm-chat-note' }, extra) : null,
      recoverable || images.length ? h('footer', { className: 'mm-chat-actions' },
        recoverable ? h('button', { type: 'button', disabled: busy, onClick: () => runAction('submission') }, t('chatCheckStatus')) : null,
        images.length && result.submissionId ? h('button', { type: 'button', disabled: busy, onClick: () => runAction('download') }, t('download')) : null,
        files.length && typeof props.openFile === 'function' ? h('button', { type: 'button', onClick: () => props.openFile(files[0].path) }, t('chatOpenFile')) : null,
        !result.submissionId && images.length ? h('a', { href: images[0].url, target: '_blank', rel: 'noreferrer' }, t('open')) : null,
        files.length ? h('span', { className: 'mm-chat-saved' }, t('chatSaved'), ' ', files.length) : null) : null,
      preview ? h(Preview, { image: preview, onClose: () => setPreview(null) }) : null);
  }
  return function MediaToolRow(props) {
    const result = readMediaResult(props.block);
    if (!Array.isArray(result?.results)) return h(MediaResultRow, props);
    const extra = extraToolText(props.block);
    return h('div', { 'data-mote-image-batch': true }, individualMediaResults(result).map((row, index) =>
      h(MediaResultRow, { ...props, key: row.submissionId || row.task?.id || index, result: row, hideExtra: true })),
    result.error || extra ? h('p', { className: 'mm-chat-note warning' }, [result.error, extra].filter(Boolean).join('\n')) : null);
  };
}
