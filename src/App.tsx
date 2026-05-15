import React from 'react';
import { useAppContext } from './context/AppContext';
import { PACKAGES, ADDONS, ATEMA_COLORS } from './config/constants';
import Header from './components/Header';
import PackageCard from './components/PackageCard';
import BookingSummary from './components/BookingSummary';

const App: React.FC = () => {
  const { design, selectedPackage, selectedAddOns, toggleAddOn, language } = useAppContext();

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ background: ATEMA_COLORS.softIvory, fontFamily: 'Cairo, Tajawal, Inter, sans-serif' }}>
      <Header />

      {/* DESIGN 1: LUXURY MINIMAL */}
      {design === 1 && (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 30px' }}>
          <div style={{ background: `linear-gradient(135deg, white 0%, ${ATEMA_COLORS.softIvory} 100%)`, padding: '60px', borderRadius: '12px' }}>
            <div style={{ textAlign: 'center', marginBottom: '80px' }}>
              <div style={{ fontSize: '56px', letterSpacing: '8px', color: ATEMA_COLORS.champagne, marginBottom: '20px', fontWeight: 300 }}>ATEMA</div>
              <p style={{ fontSize: '18px', color: '#888', letterSpacing: '1px', fontWeight: 300 }}>PROFESSIONAL PHOTOGRAPHY SERVICES</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', marginBottom: '40px' }}>
              {PACKAGES.map(pkg => (<PackageCard key={pkg.id} package={pkg} design={1} />))}
            </div>
            <div style={{ marginTop: '60px', paddingTop: '40px', borderTop: `2px solid rgba(212, 181, 160, 0.2)` }}>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '30px', textAlign: 'center' }}>✨ إضافات اختيارية</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {ADDONS.map(addon => {
                  const isSelected = selectedAddOns.some(a => a.id === addon.id);
                  return (
                    <div key={addon.id} onClick={() => toggleAddOn(addon)} style={{ background: isSelected ? `rgba(212, 181, 160, 0.1)` : 'white', padding: '20px', borderRadius: '8px', border: `2px solid ${isSelected ? ATEMA_COLORS.champagne : '#f0f0f0'}`, cursor: 'pointer', transition: 'all 0.3s ease', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>{addon.iconEmoji}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '8px' }}>{addon.nameAr}</div>
                      <div style={{ fontSize: '14px', color: ATEMA_COLORS.champagne, fontWeight: 700 }}>{addon.price} ر.س</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DESIGN 2: MODERN GRADIENT */}
      {design === 2 && (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 30px' }}>
          <div style={{ background: `linear-gradient(135deg, #fafafa 0%, #f0ebe4 50%, #e8dfd2 100%)`, padding: '60px', borderRadius: '16px' }}>
            <div style={{ background: `linear-gradient(135deg, ${ATEMA_COLORS.deepBronze} 0%, ${ATEMA_COLORS.champagne} 100%)`, padding: '60px', borderRadius: '16px', color: 'white', marginBottom: '50px', textAlign: 'center', boxShadow: `0 15px 40px rgba(140, 107, 79, 0.3)` }}>
              <h2 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '15px' }}>احجزي حفلتك الآن</h2>
              <p style={{ fontSize: '16px', opacity: 0.95 }}>باقات احترافية مصممة لكل مناسبة</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '25px', marginBottom: '40px' }}>
              {PACKAGES.map(pkg => (<PackageCard key={pkg.id} package={pkg} design={2} />))}
            </div>
            <div style={{ marginTop: '60px', paddingTop: '40px', borderTop: `2px solid rgba(212, 181, 160, 0.2)` }}>
              <h3 style={{ fontSize: '24px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '30px', textAlign: 'center' }}>✨ خدمات إضافية</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                {ADDONS.map(addon => {
                  const isSelected = selectedAddOns.some(a => a.id === addon.id);
                  return (
                    <div key={addon.id} onClick={() => toggleAddOn(addon)} style={{ background: 'white', padding: '20px', borderRadius: '8px', border: `2px solid ${isSelected ? ATEMA_COLORS.champagne : '#f0f0f0'}`, cursor: 'pointer', transition: 'all 0.3s ease', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>{addon.iconEmoji}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '8px' }}>{addon.nameAr}</div>
                      <div style={{ fontSize: '14px', color: ATEMA_COLORS.champagne, fontWeight: 700 }}>{addon.price} ر.س</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING SUMMARY */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 30px', display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }} />
        <div style={{ width: '350px' }}><BookingSummary /></div>
      </div>

      {/* FOOTER */}
      <footer style={{ marginTop: '80px', padding: '40px 30px', background: 'white', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>© 2024 ATEMA STUDIO — جميع الحقوق محفوظة</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: ATEMA_COLORS.deepBronze, fontWeight: 600 }}>📱 +966 54 832 3496</span>
          <span style={{ fontSize: '13px', color: ATEMA_COLORS.deepBronze, fontWeight: 600 }}>📧 info@atemastudio.com</span>
          <span style={{ fontSize: '13px', color: ATEMA_COLORS.deepBronze, fontWeight: 600 }}>📍 الجبيل — السعودية</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
