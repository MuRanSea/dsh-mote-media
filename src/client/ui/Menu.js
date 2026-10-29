import { createIcon } from './Icon.js';

export function createMenu(React) {
  const h = React.createElement;
  const Icon = createIcon(React);
  const { useState, useEffect, useRef } = React;

    function Menu({ label, value, current, items, onPick, width, hideLabel = false, icon, variant = '', searchLabel, emptyLabel }) {
      const [open, setOpen] = useState(false);
      const [placement, setPlacement] = useState(null);
      const [query, setQuery] = useState('');
      const boxRef = useRef(null);
      const anchorRef = useRef(null);
      const searchRef = useRef(null);
      const listRef = useRef(null);
      const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const visibleItems = [];
      let group = null;
      let groupShown = false;
      for (const item of items || []) {
        if (item.header) { group = item; groupShown = false; continue; }
        const text = [item.label, item.description, group?.label].filter(Boolean).join(' ').toLocaleLowerCase();
        if (!terms.every((term) => text.includes(term))) continue;
        if (group && !groupShown) { visibleItems.push(group); groupShown = true; }
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
        if (!open) return undefined;
        const onDown = (event) => {
          if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
        };
        const onScroll = (event) => {
          // Scrolling the list itself must not dismiss it; any outer scroll does.
          if (boxRef.current && event && event.target instanceof Node && boxRef.current.contains(event.target)) return;
          setOpen(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); anchorRef.current?.focus({ preventScroll: true }); }
          const choices = [...(listRef.current?.querySelectorAll('[role="menuitemradio"]') || [])];
          if (event.key === 'Enter' && document.activeElement === searchRef.current) { event.preventDefault(); choices[0]?.click(); return; }
          if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
          event.preventDefault();
          const index = choices.indexOf(document.activeElement);
          const next = index < 0 ? event.key === 'ArrowDown' ? 0 : choices.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
          choices[next]?.focus({ preventScroll: true }); reveal(choices[next]);
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('pointerdown', onDown);
          window.removeEventListener('scroll', onScroll, true);
          window.removeEventListener('resize', onScroll);
        };
      }, [open]);

      useEffect(() => {
        if (open && placement) {
          const selected = boxRef.current?.querySelector('[aria-checked="true"]') || boxRef.current?.querySelector('[role="menuitemradio"]');
          (searchRef.current || selected)?.focus({ preventScroll: true });
          reveal(selected);
        }
      }, [open]);
      useEffect(() => { if (listRef.current) listRef.current.scrollTop = 0; }, [query]);

      const openMenu = () => {
        setQuery('');
        const rect = anchorRef.current ? anchorRef.current.getBoundingClientRect() : null;
        if (!rect) {
          setOpen((wasOpen) => !wasOpen);
          return;
        }
        const margin = 12;
        const panel = anchorRef.current.closest('.jz-root')?.getBoundingClientRect();
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
        // Open downward by default; flip only when the lower space is unusable.
        const upward = spaceBelow < Math.min(desired, 120) && spaceAbove > spaceBelow;
        const room = Math.min(limit, upward ? spaceAbove : spaceBelow);
        setPlacement({
          left: Math.max(leftEdge, Math.min(rect.left, rightEdge - menuWidth)),
          width: menuWidth,
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
            className: `jz-chip ${variant}${open ? ' open' : ''}`,
            'aria-label': `${label || ''} ${value || ''}`.trim(),
            'aria-expanded': open,
            'aria-haspopup': 'menu',
            onClick: openMenu,
          },
          icon ? h(Icon, { name: icon, size: 16 }) : null,
          label && !hideLabel ? h('span', { className: 'jz-chip-label' }, label) : null,
          h('span', { className: 'jz-chip-value' }, value),
          h('span', { className: 'jz-caret' }, h(Icon, { name: 'chevron', size: 13 })),
        ),
        open && placement
          ? h(
              'div',
              {
                className: 'jz-drop', role: 'menu', 'aria-label': label,
                style: {
                  position: 'fixed',
                  left: `${placement.left}px`,
                  top: placement.top === undefined ? undefined : `${placement.top}px`,
                  bottom: placement.bottom === undefined ? undefined : `${placement.bottom}px`,
                  width: `${placement.width}px`,
                  maxHeight: `${placement.maxHeight}px`,
                },
              },
              searchLabel ? h('div', { className: 'jz-drop-search' },
                h(Icon, { name: 'search', size: 15 }),
                h('input', { ref: searchRef, type: 'search', value: query, 'aria-label': searchLabel, placeholder: searchLabel,
                  onChange: (event) => setQuery(event.target.value) })) : null,
              h('div', { className: 'jz-drop-list', ref: listRef }, visibleItems.length ? visibleItems.map((item) =>
                item.header
                  ? h('div', { key: String(item.value), className: 'jz-drop-head' }, item.label)
                  : h(
                      'button',
                      {
                        key: String(item.value),
                        type: 'button', role: 'menuitemradio', 'aria-checked': String(item.value) === String(current),
                        className: `jz-drop-item${String(item.value) === String(current) ? ' on' : ''}`,
                        title: [item.label, item.description].filter(Boolean).join('\n'),
                        onClick: () => {
                          setOpen(false);
                          onPick(item.value);
                          anchorRef.current?.focus({ preventScroll: true });
                        },
                      },
                      h('span', { className: 'jz-option-label' }, h('span', null, item.label), item.description ? h('small', null, item.description) : null),
                      String(item.value) === String(current) ? h(Icon, { name: 'check', size: 15 }) : null,
                    ),
              ) : h('div', { className: 'jz-drop-empty', role: 'status' }, emptyLabel),
              ),
            )
          : null,
      );
    }

  return Menu;
}
