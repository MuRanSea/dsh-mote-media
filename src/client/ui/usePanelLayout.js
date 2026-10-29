/** Measure the plugin panel, without CSS containment that would offset fixed menus. */
export function createUsePanelLayout(React) {
  const { useState, useRef, useEffect } = React;
  return function usePanelLayout() {
    const ref = useRef(null);
    const [layout, setLayout] = useState('medium');
    useEffect(() => {
      const update = (width) => setLayout(width < 480 ? 'compact' : width < 760 ? 'narrow' : width < 1120 ? 'medium' : 'wide');
      const measure = () => update(ref.current?.getBoundingClientRect().width || window.innerWidth);
      measure();
      if (typeof window.ResizeObserver === 'function') {
        const observer = new window.ResizeObserver((entries) => update(entries[0].contentRect.width));
        observer.observe(ref.current);
        return () => observer.disconnect();
      }
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, []);
    return { ref, layout };
  };
}
