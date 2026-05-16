// IntersectionObserver-driven fade-up reveal for cinematic scroll motion.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** ms after first reveal */
  delay?:    number;
  /** translate distance in px */
  distance?: number;
  /** ms duration of the transition */
  duration?: number;
  style?:    CSSProperties;
  as?:       ElementType;
}

export default function FadeUp({
  children, delay = 0, distance = 18, duration = 700, style, as,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respect users that prefer reduced motion — show immediately.
    if (typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true); return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp: any = as ?? 'div';
  return (
    <Comp ref={ref} style={{
      opacity: shown ? 1 : 0,
      transform: shown ? 'translateY(0)' : `translateY(${distance}px)`,
      transition: `opacity ${duration}ms cubic-bezier(0.22,0.61,0.36,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22,0.61,0.36,1) ${delay}ms`,
      willChange: 'opacity, transform',
      ...style,
    }}>
      {children}
    </Comp>
  );
}
