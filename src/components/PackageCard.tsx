import React from 'react';
import type { Package } from '../types';
import { ATEMA_COLORS } from '../config/constants';
import { useAppContext } from '../context/AppContext';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Heart, Camera, Image, Gem, Star, Crown, Clock, CheckCircle2, Video } from 'lucide-react';

interface PackageCardProps { package: Package; design: 1 | 2; }

function PackageIcon({ nameAr, size = 36 }: { nameAr: string; size?: number }) {
  const c = ATEMA_COLORS.champagne;
  if (nameAr === 'جلسة الخطوبة')      return <Heart   size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'الباقة المخصصة')    return <Camera  size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'الباقة الكلاسيكية') return <Image   size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'الباقة الملكية')    return <Gem     size={size} color={c} strokeWidth={1.5} />;
  if (nameAr === 'باقة التوقيع')      return <Star    size={size} color={c} strokeWidth={1.5} />;
  return <Crown size={size} color={c} strokeWidth={1.5} />;
}

const PackageCard: React.FC<PackageCardProps> = ({ package: pkg, design }) => {
  const { selectedPackage, selectPackage } = useAppContext();
  const { isMobile } = useBreakpoint();
  const isSelected = selectedPackage?.id === pkg.id;
  const shadow   = isSelected ? '0 16px 40px rgba(212,181,160,0.28)' : '0 2px 8px rgba(0,0,0,0.05)';
  const lift     = isSelected ? 'translateY(-8px)' : 'translateY(0)';
  const onEnter  = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(212,181,160,0.22)'; };
  const onLeave  = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = lift; e.currentTarget.style.boxShadow = shadow; };

  const Features = () => (
    <div style={{ marginBottom: '20px' }}>
      {pkg.features.map((f, i) => (
        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'8px', fontSize:'13px', color:'#555' }}>
          <CheckCircle2 size={14} color={ATEMA_COLORS.champagne} style={{ marginTop:'2px', flexShrink:0 }} />
          <span>{f}</span>
        </div>
      ))}
      {pkg.video && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:ATEMA_COLORS.deepBronze, fontWeight:600, marginTop:'4px' }}>
          <Video size={14} color={ATEMA_COLORS.deepBronze} style={{ flexShrink:0 }} />
          <span>يشمل فيديو سينمائي</span>
        </div>
      )}
    </div>
  );

  const base: React.CSSProperties = {
    background:'white', borderRadius:'12px', cursor:'pointer', transition:'all 0.3s ease',
    transform: lift, position:'relative', overflow:'hidden', boxShadow: shadow,
    padding: isMobile ? '22px 18px' : '34px 28px',
  };

  if (design === 1) return (
    <div onClick={() => selectPackage(pkg)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ ...base, border: `2px solid ${isSelected ? ATEMA_COLORS.champagne : '#eee'}`, textAlign:'center' }}>
      {pkg.badge && <div style={{ position:'absolute', top:'12px', right:'12px',
        background:`linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
        color:'white', padding:'4px 10px', borderRadius:'20px', fontSize:'10px', fontWeight:700 }}>{pkg.badge}</div>}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:'14px' }}><PackageIcon nameAr={pkg.nameAr} size={38} /></div>
      <h3 style={{ fontSize:'16px', fontWeight:700, color:ATEMA_COLORS.deepBronze, marginBottom:'6px' }}>{pkg.nameAr}</h3>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'5px', fontSize:'12px', color:'#aaa', marginBottom:'14px' }}>
        <Clock size={12} color='#ccc' />{pkg.durationHours} ساعات
      </div>
      <div style={{ fontSize:'30px', color:ATEMA_COLORS.champagne, fontWeight:700 }}>{pkg.price.toLocaleString()}</div>
      <div style={{ fontSize:'11px', color:'#bbb', marginBottom:'16px' }}>ر.س شامل VAT</div>
      <Features />
      <button style={{ background: isSelected ? ATEMA_COLORS.deepBronze : ATEMA_COLORS.champagne,
        color:'white', border:'none', padding:'11px', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:600, width:'100%' }}>
        {isSelected ? '✓ تم الاختيار' : 'اختري الآن'}
      </button>
    </div>
  );

  return (
    <div onClick={() => selectPackage(pkg)} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ ...base, borderLeft: `4px solid ${isSelected ? ATEMA_COLORS.deepBronze : ATEMA_COLORS.champagne}` }}>
      {pkg.badge && <div style={{ display:'inline-block',
        background:`linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
        color:'white', padding:'4px 12px', borderRadius:'12px', fontSize:'11px', fontWeight:700, marginBottom:'12px' }}>{pkg.badge}</div>}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
        <PackageIcon nameAr={pkg.nameAr} size={30} />
        <h3 style={{ fontSize:'17px', fontWeight:700, color:ATEMA_COLORS.deepBronze, margin:0 }}>{pkg.nameAr}</h3>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'#aaa', marginBottom:'14px' }}>
        <Clock size={12} color='#ccc' />{pkg.durationHours} ساعات
      </div>
      <div style={{ fontSize:'32px', color:ATEMA_COLORS.champagne, fontWeight:700 }}>{pkg.price.toLocaleString()}</div>
      <div style={{ fontSize:'11px', color:'#bbb', marginBottom:'16px' }}>ر.س شامل VAT</div>
      <Features />
      <button style={{ background:`linear-gradient(135deg, ${ATEMA_COLORS.champagne}, ${ATEMA_COLORS.warmSand})`,
        color:'white', border:'none', padding:'12px', borderRadius:'8px', cursor:'pointer', fontWeight:600, width:'100%', fontSize:'14px' }}>
        {isSelected ? '✓ تم الاختيار' : 'اختري الآن'}
      </button>
    </div>
  );
};

export default PackageCard;
