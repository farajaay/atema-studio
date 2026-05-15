import React from 'react';
import { Package } from '../types';
import { ATEMA_COLORS } from '../config/constants';
import { useAppContext } from '../context/AppContext';

interface PackageCardProps {
  package: Package;
  design: 1 | 2;
}

const PackageCard: React.FC<PackageCardProps> = ({ package: pkg, design }) => {
  const { selectedPackage, selectPackage } = useAppContext();
  const isSelected = selectedPackage?.id === pkg.id;

  if (design === 1) {
    // Luxury Minimal Design
    return (
      <div
        style={{
          background: 'white',
          padding: '40px 30px',
          border: `1px solid ${isSelected ? ATEMA_COLORS.champagne : '#eee'}`,
          borderRadius: '8px',
          textAlign: 'center',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          transform: isSelected ? 'translateY(-8px)' : 'none',
          boxShadow: isSelected ? '0 15px 40px rgba(0,0,0,0.1)' : '0 0 0 rgba(0,0,0,0)'
        }}
        onClick={() => selectPackage(pkg)}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = 'translateY(-8px)';
          el.style.boxShadow = '0 15px 40px rgba(0,0,0,0.1)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = isSelected ? 'translateY(-8px)' : 'translateY(0)';
          el.style.boxShadow = isSelected ? '0 15px 40px rgba(0,0,0,0.1)' : '0 0 0 rgba(0,0,0,0)';
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '15px' }}>
          {pkg.nameAr === 'جلسة الخطوبة' && '💍'}
          {pkg.nameAr === 'الباقة المخصصة' && '👰'}
          {pkg.nameAr === 'الباقة الكلاسيكية' && '📸'}
          {pkg.nameAr === 'الباقة الملكية' && '💎'}
          {pkg.nameAr === 'باقة التوقيع' && '✦'}
          {pkg.nameAr === 'ATEMA Couture' && '👑'}
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '10px' }}>
          {pkg.nameAr}
        </h3>
        <div style={{ fontSize: '32px', color: ATEMA_COLORS.champagne, fontWeight: 700, margin: '15px 0' }}>
          {pkg.price.toLocaleString()}
        </div>
        <p style={{ fontSize: '12px', color: '#999', marginBottom: '10px' }}>
          {pkg.durationHours} ساعات تصوير
        </p>
        <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', marginBottom: '20px' }}>
          {pkg.features.map((feature, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <span style={{ color: ATEMA_COLORS.champagne, fontWeight: 700, marginLeft: '8px' }}>✓</span>
              {feature}
            </div>
          ))}
        </div>
        <button
          style={{
            background: isSelected ? ATEMA_COLORS.deepBronze : ATEMA_COLORS.champagne,
            color: 'white',
            border: 'none',
            padding: '12px 30px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = ATEMA_COLORS.deepBronze;
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = isSelected ? ATEMA_COLORS.deepBronze : ATEMA_COLORS.champagne;
            (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
          }}
        >
          اختري الآن
        </button>
      </div>
    );
  }

  // Modern Gradient Design
  return (
    <div
      style={{
        background: 'white',
        padding: '35px',
        borderRadius: '12px',
        borderLeft: `4px solid ${ATEMA_COLORS.champagne}`,
        boxShadow: isSelected ? '0 20px 40px rgba(212, 181, 160, 0.25)' : '0 4px 15px rgba(0,0,0,0.06)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        transform: isSelected ? 'translateY(-12px)' : 'none'
      }}
      onClick={() => selectPackage(pkg)}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-12px)';
        el.style.boxShadow = '0 20px 40px rgba(212, 181, 160, 0.25)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = isSelected ? 'translateY(-12px)' : 'translateY(0)';
        el.style.boxShadow = isSelected ? '0 20px 40px rgba(212, 181, 160, 0.25)' : '0 4px 15px rgba(0,0,0,0.06)';
      }}
    >
      {pkg.badge && (
        <div
          style={{
            display: 'inline-block',
            background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
            color: 'white',
            padding: '6px 14px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 700,
            marginBottom: '12px'
          }}
        >
          {pkg.badge}
        </div>
      )}
      <h3 style={{ fontSize: '18px', fontWeight: 700, color: ATEMA_COLORS.deepBronze, marginBottom: '10px' }}>
        {pkg.nameAr}
      </h3>
      <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px', fontWeight: 500 }}>
        {pkg.durationHours} ساعات تصوير
      </div>
      <div style={{ fontSize: '36px', color: ATEMA_COLORS.champagne, fontWeight: 700, margin: '15px 0' }}>
        {pkg.price.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: '#999' }}>ر.س</div>
      <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.9', margin: '20px 0' }}>
        {pkg.features.map((feature, i) => (
          <div
            key={i}
            style={{
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ color: ATEMA_COLORS.champagne, fontWeight: 700 }}>✓</span>
            <span>{feature}</span>
          </div>
        ))}
      </div>
      <button
        style={{
          background: `linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
          color: 'white',
          border: 'none',
          padding: '12px 28px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          transition: 'all 0.3s ease',
          width: '100%',
          fontSize: '14px'
        }}
        onMouseEnter={e => {
          (e.target as HTMLButtonElement).style.transform = 'translateY(-3px)';
          (e.target as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(212, 181, 160, 0.4)';
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
          (e.target as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        اختري الآن
      </button>
    </div>
  );
};

export default PackageCard;
