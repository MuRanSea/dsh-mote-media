export function createUseDialog(React) {
  const { useRef, useEffect } = React;
  return function useDialog(onClose) {
    const ref = useRef(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
      const previous = document.activeElement;
      const panel = ref.current;
      const overflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const focusable = () => [...ref.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),video[controls],[tabindex="0"]')];
      (ref.current.querySelector('[data-autofocus]') || focusable()[0] || ref.current).focus();
      const onKey = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
        if (event.key !== 'Tab') return;
        const elements = focusable();
        const first = elements[0]; const last = elements.at(-1);
        if (!elements.length) { event.preventDefault(); ref.current.focus(); }
        else if (!ref.current.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      };
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = overflow;
        if (previous?.isConnected && (document.activeElement === document.body || panel.contains(document.activeElement))) previous.focus?.({ preventScroll: true });
      };
    }, []);
    return ref;
  };
}
