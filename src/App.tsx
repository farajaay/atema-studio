import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';
import { PACKAGES, ADDONS, ATEMA_COLORS } from './config/constants';
import Header from './components/Header';
import PackageCard from './components/PackageCard';
import BookingSummary from './components/BookingSummary';
import BookingForm from './components/BookingForm';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PackagesManager from './pages/PackagesManager';
import { useBreakpoint } from './hooks/useBreakpoint';
import { Clock, Timer, Zap, Mic2, BookOpen, Film, Phone, Mail, MapPin } from 'lucide-react';

function AddonIcon({ id }: { id: string }) {
  const s = 20; const c = ATEMA_COLORS.champagne;
  if (id === 'extra-hour')       return <Timer    size={s} color={c} />;
  if (id === 'extra-photos')     return <Clock    size={s} color={c} />;
  if (id === 'drone')            return <Mic2     size={s} color={c} />;
  if (id === 'express-delivery') return <Zap      size={s} color={c} />;
  if (id === 'album-print')      return <BookOpen size={s} color={c} />;
  if (id === 'extra-video')      return <Film     size={s} color={c} />;
  return <Clock size={s} color={c} />;
}

function BookingPage() {
  const { design, selectedAddOns, toggleAddOn, language } = useAppContext();
  const { isMobile, isTablet } = useBreakpoint();
  const [showForm, setShowForm] = useState(false);
  const cols = isMobile ? 1 : isTablet ? 2 : 3;
  const addonCols = isMobile ? 2 : isTablet ? 3 : 6;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{ background: ATEMA_COLORS.softIvory, fontFamily: 'Cairo, Tajawal, Inter, sans-serif', minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 30px' }}>
        {design === 2 && (
          <div style={{ background: `linear-gradient(135deg, ${ATEMA_COLORS.deepBronze}, ${ATEMA_COLORS.champagne})`,
            padding: isMobile ? '40px 24px' : '60px', borderRadius: '16px', color: 'white',
            marginBottom: '40px', textAlign: 'center', boxShadow: `0 15px 40px rgba(140,107,79,0.3)` }}>
            <h2 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 700, marginBottom: '12px' }}>احجزي حفلتك الآن</h2>
            <p style={{ fontSize: '16px', opacity: 0.9 }}>باقات احترافية مصممة لكل مناسبة</p>
          </div>
        )}
        {design === 1 && (
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '40px' : '70px', padding: isMobile ? '30px 0' : '50px 0' }}>
            <div style={{ fontSize: isMobile ? '36px' : '56px', letterSpacing: '8px', color: ATEMA_COLORS.champagne, fontWeight: 300, marginBottom: '16px' }}>ATEMA</div>
            <p style={{ fontSize: '16px', color: '#888', letterSpacing: '1px', fontWeight: 300 }}>PROFESSIONAL PHOTOGRAPHY SERVICES</p>
          </div>
        )}
        <div style={{ display: 'flex', gap: isMobile ? '24px' : '32px', flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: isMobile ? '16px' : '24px', marginBottom: '40px' }}>
              {PACKAGES.map(pkg => <PackageCard key={pkg.id} package={pkg} design={design} />)}
            </div>
            <div style={{ marginTop: '10px', paddingTop: '32px', borderTop: `1px solid rgba(212,181,160,0.25)` }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '24px', textAlign: 'center' }}>خدمات إضافية اختيارية</h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${addonCols}, 1fr)`, gap: isMobile ? '12px' : '16px' }}>
                {ADDONS.map(addon => {
                  const isSel = selectedAddOns.some(a => a.id === addon.id);
                  return (
                    <div key={addon.id} onClick={() => toggleAddOn(addon)} style={{
                      background: isSel ? 'rgba(212,181,160,0.1)' : 'white', padding: isMobile ? '16px 12px' : '20px',
                      borderRadius: '10px', border: `2px solid ${isSel ? ATEMA_COLORS.champagne : '#f0f0f0'}`,
                      cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><AddonIcon id={addon.id} /></div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '6px' }}>{addon.nameAr}</div>
                      <div style={{ fontSize: '13px', color: ATEMA_COLORS.champagne, fontWeight: 700 }}>{addon.price} ر.س</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <BookingSummary onBook={() => setShowForm(true)} />
        </div>
      </div>

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '14px', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <BookingForm onClose={() => setShowForm(false)} />
          </div>
        </div>
      )}

      <footer style={{ marginTop: '80px', padding: isMobile ? '30px 20px' : '40px 30px', background: 'white', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '16px' }}>© 2024 ATEMA STUDIO — جميع الحقوق محفوظة</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '16px' : '30px', flexWrap: 'wrap' }}>
          {[{ Icon: Phone, text: '+966 54 832 3496' }, { Icon: Mail, text: 'info@atemastudio.com' }, { Icon: MapPin, text: 'الجبيل — السعودية' }].map(({ Icon, text }) => (
            <span key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: ATEMA_COLORS.deepBronze, fontWeight: 600 }}>
              <Icon size={14} color={ATEMA_COLORS.champagne} />{text}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/"              element={<BookingPage />} />
      <Route path="/admin"         element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/packages"  element={<PackagesManager />} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  );
}
