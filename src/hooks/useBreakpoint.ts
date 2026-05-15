import { useState, useEffect } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BREAKPOINTS = { xs: 0, sm: 480, md: 768, lg: 1024, xl: 1280 };

function getBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.sm) return 'xs';
  if (width < BREAKPOINTS.md) return 'sm';
  if (width < BREAKPOINTS.lg) return 'md';
  if (width < BREAKPOINTS.xl) return 'lg';
  return 'xl';
}

export function useBreakpoint() {
  const [bp, setBp] = useState<Breakpoint>(() => getBreakpoint(window.innerWidth));
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => {
      setWidth(window.innerWidth);
      setBp(getBreakpoint(window.innerWidth));
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return {
    bp,
    width,
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
  };
}
