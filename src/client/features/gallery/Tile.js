import { isPending, statusLabel, primaryMedia, canRegenerate } from '../../domain/works.js';
import { createIcon } from '../../ui/Icon.js';
import { modelDisplayName, statusTone, taskCost } from '../../ui/presentation.js';

export function createTile(React, t) {
  const h = React.createElement;
  const { useState, useEffect } = React;
  const Icon = createIcon(React);
  return function Tile({ item, onPreview, onDownload, onUse, onRemove, onRetry, canUse, onRecover, onContinue, onEdit, busy }) {
    const media = primaryMedia(item);
    const [mediaError, setMediaError] = useState(false);
    useEffect(() => setMediaError(false), [media?.url]);
    const tone = statusTone(item.status);
    const pending = isPending(item) && !['submission_unknown', 'prepared'].includes(item.status);
    const warning = ['submission_unknown', 'prepared'].includes(item.status);
    const progress = Number.isFinite(item.progress) ? Math.max(0, Math.min(100, item.progress)) : 0;
    const cost = taskCost(item.billing);
    const hasActions = media || item.status === 'failed' || item.submissionId;
    const hover = (event, play) => {
      const video = event.currentTarget.querySelector('video');
      if (!video) return;
      if (play && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) video.play()?.catch?.(() => {});
      else { video.pause(); video.currentTime = 0; }
    };
    const action = (name, title, callback, disabled = false, reason = '') => h('button', { type: 'button', title: reason || title, 'aria-label': title, disabled, onClick: callback }, h(Icon, { name, size: 17 }));
    return h('article', { className: `jz-tile is-${tone}`, onMouseEnter: (event) => hover(event, true), onMouseLeave: (event) => hover(event, false) },
      h('div', { className: `jz-tile-media${media && !mediaError ? ' has-media' : ' empty'}` },
        media && !mediaError ? media.video
          ? h('video', { src: media.url, preload: 'metadata', muted: true, playsInline: true, onError: () => setMediaError(true) })
          : h('img', { src: media.url, alt: item.prompt || t('preview'), loading: 'lazy', onError: () => setMediaError(true) }) : null,
        h('div', { className: 'jz-tile-badges' },
          h('span', { className: 'jz-kind-badge' }, h(Icon, { name: item.type === 'video' ? 'video' : 'image', size: 13 }), item.type === 'video' ? t('kindVideo') : t('kindImage')),
          h('span', { className: `jz-status-badge ${tone}` }, h('i'), statusLabel(item.status, t))),
        pending ? h('div', { className: 'jz-tile-pending' }, h('span', { className: 'jz-spin' }),
          h('strong', null, statusLabel(item.status, t)), h('span', null, progress > 0 ? `${progress}%` : t('generationInProgress')),
          progress > 0 ? h('span', { className: 'jz-progress-track' }, h('span', { style: { width: `${progress}%` } })) : null) : null,
        item.status === 'failed' || warning || mediaError ? h('div', { className: `jz-tile-err ${warning || mediaError ? 'warning' : ''}` },
          h(Icon, { name: warning ? 'clock' : 'alert', size: 26 }),
          h('strong', null, mediaError ? t('previewUnavailable') : statusLabel(item.status, t)),
          h('p', null, mediaError ? t('previewUnavailableHint') : warning ? t(item.status === 'prepared' ? 'preparedHint' : 'submissionUnknownHint') : item.error?.message || t('failed'))) : null,
        hasActions ? h('div', { className: 'jz-tile-actions' },
          action('expand', t('preview'), () => onPreview(item)),
          media ? action('download', t('download'), () => onDownload(item)) : null,
          canUse(item) && onUse ? action('reuse', onUse.label, () => onUse.run(item), onUse.disabled, onUse.reason) : null,
          !isPending(item) || item.status === 'prepared' ? action('close', t('remove'), () => onRemove(item)) : null) : null),
      h('div', { className: 'jz-tile-foot' },
        h('span', { className: 'jz-tile-model', title: [item.channelId, item.model].filter(Boolean).join(' · ') }, modelDisplayName(item.model)),
        h('span', { className: 'jz-spacer' }),
        media?.expiresAt && media.expiresAt - Date.now() < 6 * 3600 * 1000 ? h('span', { className: 'jz-expiry', title: t('expiring') }, h(Icon, { name: 'clock', size: 13 })) : null,
        cost ? h('span', { className: 'jz-tile-cost', title: t('taskCostHint') }, cost) : null),
      onEdit || canRegenerate(item) || item.submissionId && isPending(item) ? h('div', { className: 'jz-tile-followup' },
        onEdit ? h('button', { type: 'button', className: 'jz-link', disabled: busy, title: t('editAgainHint'), onClick: () => onEdit(item) }, h(Icon, { name: 'settings', size: 13 }), t('editAgain')) : null,
        canRegenerate(item) ? h('button', { type: 'button', className: 'jz-link', title: t('regenerateHint'), onClick: () => onRetry(item) }, h(Icon, { name: 'reuse', size: 13 }), t('regenerate')) : null,
        item.submissionId && ['submitting', 'submission_unknown'].includes(item.status) && onRecover ? h('button', { type: 'button', className: 'jz-link', onClick: () => onRecover(item) }, h(Icon, { name: 'reuse', size: 13 }), t('recover')) : null,
        item.submissionId && item.status === 'prepared' && onContinue ? h('button', { type: 'button', className: 'jz-link', onClick: () => onContinue(item) }, h(Icon, { name: 'arrow', size: 13 }), t('continueSubmission')) : null) : null);
  };
}
