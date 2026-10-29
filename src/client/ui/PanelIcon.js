export function createPanelIcon(React) {
  const h = React.createElement;
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

  return PanelIcon;
}
