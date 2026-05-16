import { Routes, Route, Navigate } from 'react-router-dom';
import { parseMoyasarCallback } from './services/moyasar';
import BookingPage from './pages/BookingPage';
import PaymentResultPage from './pages/PaymentResultPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PackagesManager from './pages/PackagesManager';
import PortfolioManager from './pages/PortfolioManager';
import JournalManager from './pages/JournalManager';
import HomePage from './pages/HomePage';
import PortfolioPage from './pages/PortfolioPage';
import JournalPage from './pages/JournalPage';
import JournalPostPage from './pages/JournalPostPage';
import AboutPage from './pages/AboutPage';
import { useTheme } from './hooks/useTheme';

export default function App() {
  // Sync the active theme with admin settings.
  useTheme();

  // Detect Moyasar payment redirect (arrives as query params on any route)
  const callback = parseMoyasarCallback();
  if (callback) {
    return (
      <PaymentResultPage
        paymentId={callback.id}
        paymentStatus={callback.status}
        bookingId={callback.bookingId}
        bookingRef={callback.bookingRef}
      />
    );
  }

  return (
    <Routes>
      <Route path="/"                element={<HomePage />} />
      <Route path="/book"            element={<BookingPage />} />
      <Route path="/portfolio"       element={<PortfolioPage />} />
      <Route path="/journal"         element={<JournalPage />} />
      <Route path="/journal/:slug"   element={<JournalPostPage />} />
      <Route path="/about"           element={<AboutPage />} />
      <Route path="/admin"           element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/packages"  element={<PackagesManager />} />
      <Route path="/admin/portfolio" element={<PortfolioManager />} />
      <Route path="/admin/journal"   element={<JournalManager />} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  );
}
