const PATHS = {
  sparkles: ['m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'm3 16 5-5 4 4 3-3 6 6', 'M8 7h.01'],
  video: ['M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'm17 9 5-3v12l-5-3'],
  plus: ['M12 5v14', 'M5 12h14'], close: ['m6 6 12 12', 'M18 6 6 18'],
  search: ['M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z', 'm16 16 5 5'],
  arrow: ['M12 19V5', 'm5 12 7-7 7 7'], chevron: ['m6 9 6 6 6-6'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 16v4h16v-4'],
  expand: ['M9 3H3v6', 'M15 3h6v6', 'M3 15v6h6', 'M21 15v6h-6'],
  reuse: ['M4 10a8 8 0 1 1 1 8', 'M4 3v7h7'],
  settings: ['M4 7h16', 'M4 17h16', 'M8 4v6', 'M16 14v6'],
  check: ['m5 12 4 4L19 6'], clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
  alert: ['M12 3 2 21h20L12 3Z', 'M12 9v5', 'M12 17h.01'],
  copy: ['M8 8h12v13H8V8Z', 'M16 8V3H3v13h5'],
  external: ['M14 3h7v7', 'm10 14 11-11', 'M10 3H3v18h18v-7'],
  layers: ['m12 3 10 5-10 5L2 8l10-5Z', 'm2 12 10 5 10-5', 'm2 16 10 5 10-5'],
};

export function createIcon(React) {
  const h = React.createElement;
  return function Icon({ name, size = 18, className = '' }) {
    return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.65, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false, className: `jz-icon ${className}` },
      (PATHS[name] || PATHS.sparkles).map((d, index) => h('path', { key: index, d })));
  };
}
