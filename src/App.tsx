import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { parseMoyasarCallback } from './services/moyasar';
import { useTheme } from './hooks/useTheme';
import RouteTracker from './components/RouteTracker';
import TrialBadge from './components/TrialBadge';
// Promotion modal disabled till further notice (2026-07-18) — the advertised
// 15% launch offer has lapsed. To re-enable: restore this import, the
// useLocation-based showPromotion gate in App(), and the render below
// (plus the HomePage.tsx render). See CLAUDE.md §6.
// import PromotionModal from './components/PromotionModal';

// ─── Public routes (loaded eagerly — first-paint critical) ───────────────────
import HomePage         from './pages/HomePage';
import BookingPage      from './pages/BookingPage';
import PortfolioPage    from './pages/PortfolioPage';
import JournalPage      from './pages/JournalPage';
import JournalPostPage  from './pages/JournalPostPage';
import AboutPage        from './pages/AboutPage';
import MoodBoardPage    from './pages/MoodBoardPage';
import ManageBookingPage from './pages/ManageBookingPage';
import AlbumSelectionPage from './pages/AlbumSelectionPage';
import PolicyPage       from './pages/PolicyPage';
import PaymentResultPage from './pages/PaymentResultPage';

// ─── Admin routes (lazy — keep the public bundle lean) ──────────────────────
// A typical customer never visits /admin/*, so React.lazy + Suspense cuts the
// admin sub-tree (~140 KB minified incl. PackagesManager / JournalManager /
// PortfolioManager / AdminDashboard / AdminCalendar / AppSettingsPanel) out
// of the initial page payload. They stream in only when an admin navigates
// to one of these routes.
//
// Every deploy re-hashes these chunks and the gh-pages publish deletes the
// previous ones, so a browser still holding an older index.html asks for a
// file that is no longer there. The import rejects, and an uncaught rejection
// in React.lazy unmounts the tree to a black page — which is exactly how the
// admin panel failed after the 2026-09-18 deploys while the eagerly-bundled
// public pages kept working. lazyChunk() reloads once so the browser picks up
// the current index.html; the session flag keeps a genuinely missing chunk
// from turning into a refresh loop.
const RELOAD_KEY = 'atema_chunk_reload';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyChunk<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load();
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* private mode */ }
      return mod;
    } catch (err) {
      let tried = true;
      try { tried = sessionStorage.getItem(RELOAD_KEY) !== null; } catch { /* private mode */ }
      if (!tried) {
        try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* ignore */ }
        // A plain reload can be answered from the same cached index.html
        // (GitHub Pages serves it with max-age=600), which would re-request
        // the very chunk that just 404'd. A one-off query param makes it a
        // different URL, so the browser must go to the network; the hash
        // route is preserved, and `v` is inert to parseMoyasarCallback().
        const fresh = new URL(window.location.href);
        fresh.searchParams.set('v', String(Date.now()));
        window.location.replace(fresh.toString());
        // Hold the subtree in Suspense until the reload lands, so the black
        // page never appears in the gap.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

const AdminLogin           = lazyChunk(() => import('./pages/AdminLogin'));
const AdminDashboard       = lazyChunk(() => import('./pages/AdminDashboard'));
const PackagesManager      = lazyChunk(() => import('./pages/PackagesManager'));
const PortfolioManager     = lazyChunk(() => import('./pages/PortfolioManager'));
const JournalManager       = lazyChunk(() => import('./pages/JournalManager'));
const FilmsManager         = lazyChunk(() => import('./pages/FilmsManager'));
const DiscountCodesManager = lazyChunk(() => import('./pages/DiscountCodesManager'));
const AddonsManager        = lazyChunk(() => import('./pages/AddonsManager'));
const AlbumDesignsManager  = lazyChunk(() => import('./pages/AlbumDesignsManager'));

function AdminFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--a-bg)', color: 'var(--a-gold)',
      fontFamily: "'Cinzel', serif", letterSpacing: '0.3em', fontSize: '0.8rem',
    }}>
      ATEMA · LOADING
    </div>
  );
}

export default function App() {
  useTheme();
  // «نسخة تجريبية» marker — every visitor-facing surface, never the admin
  // panel. Drop this line (and the two renders) once the site leaves preview.
  const showTrialBadge = !useLocation().pathname.startsWith('/admin');

  // Detect Moyasar payment redirect (arrives as query params on any route)
  const callback = parseMoyasarCallback();
  if (callback) {
    return (
      <>
        <PaymentResultPage
          paymentId={callback.id}
          paymentStatus={callback.status}
          bookingId={callback.bookingId}
          bookingRef={callback.bookingRef}
          purpose={callback.purpose}
        />
        {showTrialBadge && <TrialBadge />}
      </>
    );
  }

  return (
    <>
    {/* Promo disabled till further notice — see the import comment above.
        Was: {showPromotion && <PromotionModal />} gated on !/admin && !/films. */}
    <RouteTracker />
    {showTrialBadge && <TrialBadge />}
    <ErrorBoundary>
    <Routes>
      {/* Public — eager */}
      <Route path="/"                element={<HomePage />} />
      <Route path="/book"            element={<BookingPage />} />
      <Route path="/portfolio"       element={<PortfolioPage />} />
      {/* Films public route disabled till further notice — see CLAUDE.md §6.
          /admin/films (FilmsManager) stays live so curation can continue. */}
      <Route path="/films"           element={<Navigate to="/" replace />} />
      <Route path="/journal"         element={<JournalPage />} />
      <Route path="/journal/:slug"   element={<JournalPostPage />} />
      <Route path="/about"           element={<AboutPage />} />
      <Route path="/policy"          element={<PolicyPage />} />
      <Route path="/board/:token"    element={<MoodBoardPage />} />
      <Route path="/manage/:token"   element={<ManageBookingPage />} />
      <Route path="/album/:token"    element={<AlbumSelectionPage />} />

      {/* Admin — lazy */}
      <Route path="/admin"           element={
        <Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>} />
      <Route path="/admin/dashboard" element={
        <Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
      <Route path="/admin/packages"  element={
        <Suspense fallback={<AdminFallback />}><PackagesManager /></Suspense>} />
      <Route path="/admin/portfolio" element={
        <Suspense fallback={<AdminFallback />}><PortfolioManager /></Suspense>} />
      <Route path="/admin/journal"   element={
        <Suspense fallback={<AdminFallback />}><JournalManager /></Suspense>} />
      <Route path="/admin/films"     element={
        <Suspense fallback={<AdminFallback />}><FilmsManager /></Suspense>} />
      <Route path="/admin/discount-codes" element={
        <Suspense fallback={<AdminFallback />}><DiscountCodesManager /></Suspense>} />
      <Route path="/admin/addons" element={
        <Suspense fallback={<AdminFallback />}><AddonsManager /></Suspense>} />
      <Route path="/admin/album-designs" element={
        <Suspense fallback={<AdminFallback />}><AlbumDesignsManager /></Suspense>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
    </>
  );
}
