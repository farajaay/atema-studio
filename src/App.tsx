import { Routes, Route, Navigate } from 'react-router-dom';
import { parseMoyasarCallback } from './services/moyasar';
import BookingPage from './pages/BookingPage';
import PaymentResultPage from './pages/PaymentResultPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PackagesManager from './pages/PackagesManager';

export default function App() {
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
      <Route path="/"                element={<BookingPage />} />
      <Route path="/admin"           element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/packages"  element={<PackagesManager />} />
      <Route path="*"                element={<Navigate to="/" replace />} />
    </Routes>
  );
}
