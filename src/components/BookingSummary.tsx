import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ATEMA_COLORS } from '../config/constants';

const BookingSummary: React.FC = () => {
  const { selectedPackage, selectedAddOns, subtotal, vat, total } = useAppContext();

  return (
    <aside
      style={{
        position: 'sticky',
        top: '100px',
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
        marginTop: '40px',
        maxWidth: '400px'
      }}
    >
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 700,
          color: ATEMA_COLORS.deepBronze,
          marginBottom: '20px',
          textAlign: 'center'
        }}
      >
        📋 ملخص حجزك
      </h3>

      {/* PACKAGE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '13px'
        }}
      >
        <span style={{ color: '#666' }}>الباقة المختارة:</span>
        <span style={{ fontWeight: 700, color: ATEMA_COLORS.editorial Black }}>
          {selectedPackage?.nameAr || 'لم تختر بعد'}
        </span>
      </div>

      {/* PACKAGE PRICE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '13px'
        }}
      >
        <span style={{ color: '#666' }}>سعر الباقة:</span>
        <span style={{ fontWeight: 700, color: ATEMA_COLORS.editorialBlack }}>
          {selectedPackage ? `${selectedPackage.price.toLocaleString()} ر.س` : '0'}
        </span>
      </div>

      {/* ADD-ONS COUNT */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '13px'
        }}
      >
        <span style={{ color: '#666' }}>الإضافات:</span>
        <span style={{ fontWeight: 700, color: ATEMA_COLORS.editorialBlack }}>
          {selectedAddOns.length > 0 ? `${selectedAddOns.length} خدمة` : 'لا توجد'}
        </span>
      </div>

      {/* ADD-ONS PRICE */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '13px'
        }}
      >
        <span style={{ color: '#666' }}>سعر الإضافات:</span>
        <span style={{ fontWeight: 700, color: ATEMA_COLORS.editorialBlack }}>
          {selectedAddOns.length > 0
            ? `${selectedAddOns.reduce((sum, a) => sum + a.price, 0).toLocaleString()} ر.س`
            : '0'}
        </span>
      </div>

      {/* DIVIDER */}
      <div
        style={{
          height: '1px',
          background: ATEMA_COLORS.champagne,
          margin: '15px 0'
        }}
      />

      {/* SUBTOTAL */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '13px'
        }}
      >
        <span style={{ color: '#666' }}>الإجمالي قبل VAT:</span>
        <span style={{ fontWeight: 700, color: ATEMA_COLORS.editorialBlack }}>
          {subtotal.toLocaleString()} ر.س
        </span>
      </div>

      {/* VAT */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: '13px'
        }}
      >
        <span style={{ color: '#666' }}>VAT 15%:</span>
        <span style={{ fontWeight: 700, color: ATEMA_COLORS.editorialBlack }}>
          {vat.toLocaleString()} ر.س
        </span>
      </div>

      {/* DIVIDER */}
      <div
        style={{
          height: '1px',
          background: ATEMA_COLORS.champagne,
          margin: '15px 0'
        }}
      />

      {/* TOTAL */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 0',
          fontSize: '18px',
          fontWeight: 700,
          color: ATEMA_COLORS.champagne
        }}
      >
        <span>المجموع النهائي:</span>
        <span>{total.toLocaleString()} ر.س</span>
      </div>

      {/* CTA BUTTON */}
      <button
        style={{
          width: '100%',
          background: ATEMA_COLORS.champagne,
          color: 'white',
          border: 'none',
          padding: '14px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: selectedPackage ? 'pointer' : 'not-allowed',
          marginTop: '20px',
          transition: 'all 0.3s ease',
          opacity: selectedPackage ? 1 : 0.5
        }}
        disabled={!selectedPackage}
        onMouseEnter={e => {
          if (selectedPackage) {
            (e.target as HTMLButtonElement).style.background = ATEMA_COLORS.deepBronze;
            (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={e => {
          (e.target as HTMLButtonElement).style.background = ATEMA_COLORS.champagne;
          (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
        }}
        onClick={() => {
          alert(`✓ تم تأكيد الحجز!\n\nالباقة: ${selectedPackage?.nameAr}\nالمجموع: ${total.toLocaleString()} ر.س\n\nسيتم تحويلك للدفع...`);
        }}
      >
        متابعة الحجز →
      </button>
    </aside>
  );
};

export default BookingSummary;
