import { isPending, primaryMedia } from '../../domain/works.js';
import { modelDisplayName } from '../../ui/presentation.js';
import { createMenu } from '../../ui/Menu.js';
import { createIcon } from '../../ui/Icon.js';
import { createTile } from './Tile.js';

export function createGallery(React, t) {
  const h = React.createElement;
  const Tile = createTile(React, t);
  const Menu = createMenu(React);
  const Icon = createIcon(React);
  return function Gallery({ items, onClearFinished, onPreview, onDownload, onUse, onRemove, onRetry, onRecover, onContinue, onEdit, busy }) {
    const [query, setQuery] = React.useState('');
    const [type, setType] = React.useState('all');
    const [status, setStatus] = React.useState('all');
    const filtered = Boolean(query || type !== 'all' || status !== 'all');
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const visible = items.filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (status === 'active' ? !['queued', 'running', 'reconciling', 'submitting'].includes(item.status) : status !== 'all' && item.status !== status) return false;
      const text = [item.prompt, item.model, modelDisplayName(item.model), item.channelId].filter(Boolean).join(' ').toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
    const finished = visible.filter((item) => !isPending(item));
    const typeItems = [['all', 'allTypes'], ['image', 'kindImage'], ['video', 'kindVideo']].map(([value, key]) => ({ value, label: t(key) }));
    const statusItems = [['all', 'allStatuses'], ['active', 'activeTasks'], ['submission_unknown', 'submissionUnknown'], ['prepared', 'prepared'], ['succeeded', 'succeeded'], ['failed', 'failed'], ['cancelled', 'cancelled']].map(([value, key]) => ({ value, label: t(key) }));
    return h('section', { className: 'jz-gallery' },
      h('div', { className: 'jz-gallery-head' },
        h('div', { className: 'jz-gallery-heading' }, h('h2', { className: 'jz-gallery-title' }, t('gallery')), h('p', null, t('gallerySubtitle'))),
        h('span', { className: 'jz-count', 'aria-live': 'polite' }, filtered ? `${visible.length} / ${items.length}` : String(items.length)),
        h('span', { className: 'jz-spacer' }),
        finished.length ? h('button', { type: 'button', className: 'jz-btn small ghost', onClick: () => onClearFinished(finished) }, `${t(filtered ? 'clearVisibleFinished' : 'clearFinished')} (${finished.length})`) : null),
      items.length || filtered ? h('div', { className: 'jz-gallery-tools' },
        h('label', { className: 'jz-work-search' }, h(Icon, { name: 'search', size: 16 }),
          h('input', { type: 'search', value: query, 'aria-label': t('searchWorks'), placeholder: t('searchWorks'), onChange: (event) => setQuery(event.target.value) })),
        h(Menu, { label: t('filterType'), hideLabel: true, value: typeItems.find((item) => item.value === type).label, current: type, items: typeItems, onPick: setType, width: 140 }),
        h(Menu, { label: t('filterStatus'), hideLabel: true, value: statusItems.find((item) => item.value === status).label, current: status, items: statusItems, onPick: setStatus, width: 170 }),
        filtered ? h('button', { type: 'button', className: 'jz-btn small ghost', onClick: () => { setQuery(''); setType('all'); setStatus('all'); } }, t('resetFilters')) : null) : null,
      !visible.length ? h('div', { className: 'jz-empty' },
        h('strong', null, t(items.length || filtered ? 'noMatchingWorks' : 'emptyTitle')),
        h('p', null, t(items.length || filtered ? 'noMatchingWorksHint' : 'empty')))
        : h('div', { className: 'jz-grid' }, visible.map((item) => h(Tile, {
            key: item.id, item, onPreview, onDownload, onUse: onUse(item), onRemove, onRetry, onRecover, onContinue, onEdit, busy,
            canUse: (target) => Boolean(primaryMedia(target)),
          }))),
    );
  };
}
