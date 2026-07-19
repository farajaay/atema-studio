// ATEMA STUDIO — pageview observer for first-party analytics.
// Renders nothing; on every route change it hands the pathname to
// recordVisit(), which sanitizes (token routes → templates, admin skipped)
// and fire-and-forgets the write. See src/services/analytics.ts.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordVisit } from '../services/analytics';

export default function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => { recordVisit(pathname); }, [pathname]);
  return null;
}
