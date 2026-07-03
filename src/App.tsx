import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { parseMoyasarCallback } from './services/moyasar';
import { useTheme } from './hooks/useTheme';
import PromotionModal from './components/PromotionModal';

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
const AdminLogin           = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard       = lazy(() => import('./pages/AdminDashboard'));
const PackagesManager      = lazy(() => import('./pages/PackagesManager'));
const PortfolioManager     = lazy(() => import('./pages/PortfolioManager'));
const JournalManager       = lazy(() => import('./pages/JournalManager'));
const DiscountCodesManager = lazy(() => import('./pages/DiscountCodesManager'));
const AddonsManager        = lazy(() => import('./pages/AddonsManager'));
const AlbumDesignsManager  = lazy(() => import('./pages/AlbumDesignsManager'));
const FilmsPage            = lazy(() => import('./pages/FilmsPage'));

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
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const showPromotion = !isAdmin && !pathname.startsWith('/films');

  // Detect Moyasar payment redirect (arrives as query params on any route)
  const callback = parseMoyasarCallback();
  if (callback) {
    return (
      <PaymentResultPage
        paymentId={callback.id}
        paymentStatus={callback.status}
        bookingId={callback.bookingId}
        bookingRef={callback.bookingRef}
        purpose={callback.purpose}
      />
    );
  }

  return (
    <>
    {showPromotion && <PromotionModal />}
    <Routes>
      {/* Public — eager */}
      <Route path="/"                element={<HomePage />} />
      <Route path="/book"            element={<BookingPage />} />
      <Route path="/portfolio"       element={<PortfolioPage />} />
      <Route path="/films"           element={
        <Suspense fallback={<AdminFallback />}><FilmsPage /></Suspense>} />
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
      <Route path="/admin/discount-codes" element={
        <Suspense fallback={<AdminFallback />}><DiscountCodesManager /></Suspense>} />
      <Route path="/admin/addons" element={
        <Suspense fallback={<AdminFallback />}><AddonsManager /></Suspense>} />
      <Route path="/admin/album-designs" element={
        <Suspense fallback={<AdminFallback />}><AlbumDesignsManager /></Suspense>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
