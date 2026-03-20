import { useEffect, useRef, useState } from "react";

/**
 * useIntersectionObserver
 * Returns a [ref, isIntersecting] pair.
 * Attach `ref` to the element you want to observe.
 */
function useIntersectionObserver({ threshold, root, rootMargin } = {}) {
  const ref = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, { threshold, root, rootMargin });

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, root, rootMargin]);

  return [ref, isIntersecting];
}

export default useIntersectionObserver;
