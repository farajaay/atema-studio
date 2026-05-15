import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ATEMA_COLORS } from '../config/constants';

const Header: React.FC = () => {
  const { language, setLanguage, design, setDesign } = useAppContext();

  return (
    <header
      style={{
        background: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {/* LOGO */}
        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: ATEMA_COLORS.deepBronze,
            letterSpacing: '2px'
          }}
        >
          ATEMA STUDIO
        </div>

        {/* CONTROLS */}
        <div
          style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center'
          }}
        >
          {/* DESIGN TOGGLE */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              background: ATEMA_COLORS.lightGray,
              padding: '8px',
              borderRadius: '8px'
            }}
          >
            {[1, 2].map(d => (
              <button
                key={d}
                onClick={() => setDesign(d as 1 | 2)}
                style={{
                  padding: '8px 16px',
                  background: design === d ? ATEMA_COLORS.champagne : 'white',
                  color: design === d ? 'white' : '#666',
                  border: '2px solid transparent',
                  borderColor: design === d ? ATEMA_COLORS.deepBronze : 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.3s ease',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {d === 1 ? '✨ Luxury' : '🎨 Modern'}
              </button>
            ))}
          </div>

          {/* LANGUAGE TOGGLE */}
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            style={{
              background: ATEMA_COLORS.lightGray,
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={e => {
              (e.target as HTMLButtonElement).style.background = ATEMA_COLORS.champagne;
              (e.target as HTMLButtonElement).style.color = 'white';
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.background = ATEMA_COLORS.lightGray;
              (e.target as HTMLButtonElement).style.color = 'inherit';
            }}
          >
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
