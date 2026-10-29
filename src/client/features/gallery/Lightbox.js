import { statusLabel, primaryMedia, canRegenerate } from '../../domain/works.js';
import { createIcon } from '../../ui/Icon.js';
import { createUseDialog } from '../../ui/useDialog.js';
import { modelDisplayName, statusTone, taskCost } from '../../ui/presentation.js';

export function createLightbox(React, t) {
  const h = React.createElement;
  const Icon = createIcon(React);
  const useDialog = createUseDialog(React);
  return function Lightbox({ item, onClose, onDownload, onRetry, onCopy, onUse, onRecover, onContinue, onEdit, busy }) {
    const dialog = useDialog(onClose);
    const media = primaryMedia(item);
    const tone = statusTone(item.status);
    const cost = taskCost(item.billing);
    const parameters = [
      ['aspect_ratio', 'ratioLabel'], ['size', 'sizeLabel'], ['resolution', 'qualityLabel'],
      ['n', 'countLabel'], ['duration', 'durationLabel'], ['generate_audio', 'audioLabel'], ['seed', 'seedLabel'],
    ].filter(([key]) => item.params?.[key] !== undefined && item.params[key] !== null);
    const metadata = [[t('task'), item.taskId], [t('submissionId'), item.submissionId], [t('requestId'), item.requestId],
      [t('errorCode'), item.error?.code], [t('errorStage'), item.error?.stage]];
    const utilities = h('div', { className: 'jz-detail-utilities' },
      h('button', { type: 'button', className: 'jz-text-btn', onClick: () => onCopy(item) }, h(Icon, { name: 'copy', size: 14 }), t('copyDiag')),
      media ? h('a', { className: 'jz-text-btn', href: media.url, target: '_blank', rel: 'noreferrer' }, h(Icon, { name: 'external', size: 14 }), t('open')) : null,
      h('button', { type: 'button', className: 'jz-text-btn', onClick: onClose }, t('close')));
    const actions = h('footer', { className: 'jz-detail-actions' },
      cost ? h('div', { className: 'jz-billing' }, h('span', { title: t('taskCostHint') }, t('taskCost')), h('strong', null, cost)) : null,
      h('p', { className: 'jz-snapshot-note' }, t(item.snapshotAvailable ? 'snapshotSaved' : 'snapshotUnavailable')),
      media ? h('button', { type: 'button', className: 'jz-btn primary', onClick: () => onDownload(item) }, h(Icon, { name: 'download', size: 17 }), t('download')) : null,
      onUse && media ? h('button', { type: 'button', className: 'jz-btn', disabled: onUse.disabled, title: onUse.reason || onUse.label, onClick: () => { if (onUse.run(item) !== false) onClose(); } }, h(Icon, { name: 'reuse', size: 16 }), onUse.label) : null,
      onEdit ? h('button', { type: 'button', className: 'jz-btn', disabled: busy, title: t('editAgainHint'), onClick: () => onEdit(item) }, h(Icon, { name: 'settings', size: 16 }), t('editAgain')) : null,
      canRegenerate(item) ? h('button', { type: 'button', className: 'jz-btn', title: t('regenerateHint'), onClick: () => onRetry(item) }, h(Icon, { name: 'sparkles', size: 16 }), t('regenerate')) : null,
      item.submissionId && ['submitting', 'submission_unknown'].includes(item.status) && onRecover ? h('button', { type: 'button', className: 'jz-btn primary', onClick: () => onRecover(item) }, h(Icon, { name: 'reuse', size: 16 }), t('recover')) : null,
      item.submissionId && item.status === 'prepared' && onContinue ? h('button', { type: 'button', className: 'jz-btn primary', onClick: () => onContinue(item) }, t('continueSubmission')) : null,
      utilities);
    const detailBody = h('div', { className: 'jz-detail-body' },
      h('header', { className: 'jz-detail-heading' }, h('span', { className: 'jz-detail-eyebrow' }, t(item.type === 'video' ? 'kindVideo' : 'kindImage')),
        h('h2', { id: 'mote-work-title' }, t('workDetails')),
        h('span', { className: `jz-status-badge ${tone}` }, h('i'), statusLabel(item.status, t))),
      h('section', { className: 'jz-detail-section' }, h('h3', null, t('promptLabel')), h('div', { className: 'jz-prompt-text' }, item.prompt || '—')),
      h('section', { className: 'jz-detail-section' }, h('h3', null, t('generationSettings')),
        h('div', { className: 'jz-detail-model' }, h(Icon, { name: item.type === 'video' ? 'video' : 'image', size: 18 }),
          h('div', null, h('strong', null, modelDisplayName(item.model)), h('small', null, [item.channelId, item.model].filter(Boolean).join(' · ')))),
        parameters.length ? h('dl', { className: 'jz-param-grid' }, parameters.map(([key, label]) => h('div', { key }, h('dt', null, t(label)),
          h('dd', null, typeof item.params[key] === 'boolean' ? t(item.params[key] ? 'on' : 'off') : String(item.params[key]))))) : null),
      item.error?.message && item.status !== 'submission_unknown' ? h('div', { className: 'jz-notice error', role: 'alert' }, h(Icon, { name: 'alert', size: 17 }), h('span', null, item.error.message)) : null,
      item.status === 'submission_unknown' ? h('div', { className: 'jz-notice warning' }, h(Icon, { name: 'clock', size: 17 }), h('span', null, t('submissionUnknownHint'))) : null,
      item.queryError ? h('div', { className: 'jz-notice warning' }, item.queryError) : null,
      h('details', { className: 'jz-task-details' }, h('summary', null, t('taskInformation')),
        h('dl', null, metadata.filter(([, value]) => value).map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, String(value))))),
        Number.isFinite(item.createdAt) ? h('div', { className: 'jz-created' }, t('createdAt'), ' ', new Date(item.createdAt).toLocaleString()) : null),
    );
    const sidebar = h('aside', { className: 'jz-lightbox-side' }, detailBody, actions);
    return h('div', { className: 'jz-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
      h('div', { className: 'jz-lightbox', ref: dialog, role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'mote-work-title', tabIndex: -1 },
        h('button', { type: 'button', className: 'jz-preview-close jz-icon-btn', 'aria-label': t('close'), title: t('close'), 'data-autofocus': true, onClick: onClose }, h(Icon, { name: 'close', size: 19 })),
        h('div', { className: 'jz-lightbox-media' }, media ? media.video
          ? h('video', { src: media.url, controls: true, autoPlay: true, playsInline: true })
          : h('img', { src: media.url, alt: item.prompt || t('preview') })
          : h('div', { className: `jz-preview-placeholder ${tone}` }, h(Icon, { name: tone === 'warning' ? 'clock' : 'image', size: 40 }), h('strong', null, statusLabel(item.status, t)))), sidebar));
  };
}
