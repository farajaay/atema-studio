import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ATEMA_COLORS } from '../config/constants';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { ClipboardList, Package, PlusCircle, ReceiptText, Percent, CircleDollarSign, ArrowRight } from 'lucide-react';

const Row = ({ icon, label, value, bold }: { icon: React.ReactNode; label: string; value: string; bold?: boolean }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'11px 0', borderBottom:'1px solid #f5f0ec', fontSize:'13px' }}>
    <span style={{ display:'flex', alignItems:'center', gap:'7px', color:'#777' }}>
      {icon}{label}
    </span>
    <span style={{ fontWeight: bold ? 700 : 500, color: bold ? ATEMA_COLORS.editorialBlack : '#555' }}>{value}</span>
  </div>
);

const BookingSummary: React.FC<{ onBook?: () => void }> = ({ onBook }) => {
  const { selectedPackage, selectedAddOns, subtotal, vat, total } = useAppContext();
  const { isMobile } = useBreakpoint();

  return (
    <aside style={{
      position: isMobile ? 'static' : 'sticky',
      top: '90px',
      background: 'white',
      padding: isMobile ? '22px 18px' : '28px 24px',
      borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.09)',
      width: isMobile ? '100%' : '340px',
      boxSizing: 'border-box',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px' }}>
        <ClipboardList size={18} color={ATEMA_COLORS.deepBronze} />
        <h3 style={{ fontSize:'15px', fontWeight:700, color:ATEMA_COLORS.deepBronze, margin:0 }}>ملخص حجزك</h3>
      </div>

      <Row icon={<Package size={13} color='#bbb' />} label='الباقة المختارة'
        value={selectedPackage?.nameAr || 'لم تختر بعد'} bold />
      <Row icon={<ReceiptText size={13} color='#bbb' />} label='سعر الباقة'
        value={selectedPackage ? `${selectedPackage.price.toLocaleString()} ر.س` : '0'} bold />
      <Row icon={<PlusCircle size={13} color='#bbb' />} label='الإضافات'
        value={selectedAddOns.length > 0 ? `${selectedAddOns.length} خدمة` : 'لا توجد'} />
      <Row icon={<ReceiptText size={13} color='#bbb' />} label='سعر الإضافات'
        value={selectedAddOns.length > 0
          ? `${selectedAddOns.reduce((s, a) => s + a.price, 0).toLocaleString()} ر.س` : '0'} />

      <div style={{ height:'1px', background: ATEMA_COLORS.champagne + '40', margin:'14px 0' }} />

      <Row icon={<ReceiptText size={13} color='#bbb' />} label='الإجمالي قبل VAT'
        value={`${subtotal.toLocaleString()} ر.س`} />
      <Row icon={<Percent size={13} color='#bbb' />} label='VAT 15%'
        value={`${vat.toLocaleString()} ر.س`} />

      <div style={{ height:'1px', background: ATEMA_COLORS.champagne + '40', margin:'14px 0' }} />

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'12px 0', fontSize:'17px', fontWeight:700, color:ATEMA_COLORS.deepBronze }}>
        <span style={{ display:'flex', alignItems:'center', gap:'7px' }}>
          <CircleDollarSign size={17} color={ATEMA_COLORS.champagne} />المجموع النهائي
        </span>
        <span style={{ color: ATEMA_COLORS.champagne }}>{total.toLocaleString()} ر.س</span>
      </div>

      <button
        disabled={!selectedPackage}
        onClick={onBook}
        style={{
          width:'100%', background: selectedPackage ? ATEMA_COLORS.champagne : '#ccc',
          color:'white', border:'none', padding:'14px', borderRadius:'8px',
          fontSize:'14px', fontWeight:700, cursor: selectedPackage ? 'pointer' : 'not-allowed',
          marginTop:'16px', transition:'all 0.2s',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
        }}
      >
        متابعة الحجز <ArrowRight size={16} />
      </button>
    </aside>
  );
};

export default BookingSummary;
