'use client';

import { useEffect, useRef } from 'react';

/**
 * Attaches IntersectionObserver to all [data-animate] elements within the
 * component this hook is mounted in, adding the `in-view` class when they
 * enter the viewport.
 */
export function useScrollReveal() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = ref.current ?? document.body;
    const targets = root.querySelectorAll('[data-animate]');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return ref;
}
