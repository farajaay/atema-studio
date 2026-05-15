import React, { useState } from 'react';
import { Globe, LayoutGrid, Sparkles, Menu, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ATEMA_COLORS } from '../config/constants';
import { useBreakpoint } from '../hooks/useBreakpoint';

const Header: React.FC = () => {
  const { language, setLanguage, design, setDesign } = useAppContext();
  const { isMobile } = useBreakpoint();
  const [menuOpen, setMenuOpen] = useState(false);

  const controls = (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display:'flex', gap:'6px', background: ATEMA_COLORS.lightGray, padding:'6px', borderRadius:'8px' }}>
        {([1, 2] as const).map(d => (
          <button key={d} onClick={() => { setDesign(d); setMenuOpen(false); }}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px',
              background: design === d ? ATEMA_COLORS.champagne : 'white',
              color: design === d ? 'white' : '#666', border:'none', borderRadius:'6px',
              cursor:'pointer', fontSize:'12px', fontWeight:600, transition:'all 0.2s', fontFamily:'inherit' }}>
            {d === 1 ? <><Sparkles size={13} /> Luxury</> : <><LayoutGrid size={13} /> Modern</>}
          </button>
        ))}
      </div>
      <button onClick={() => { setLanguage(language === 'ar' ? 'en' : 'ar'); setMenuOpen(false); }}
        style={{ display:'flex', alignItems:'center', gap:'6px', background: ATEMA_COLORS.lightGray,
          border:'none', padding:'8px 14px', borderRadius:'6px', cursor:'pointer', fontWeight:600,
          fontSize:'12px', fontFamily:'inherit', color:'#444', transition:'all 0.2s' }}>
        <Globe size={14} />{language === 'ar' ? 'EN' : 'AR'}
      </button>
    </div>
  );

  return (
    <header style={{ background:'white', padding: isMobile ? '14px 20px' : '18px 30px',
      boxShadow:'0 2px 8px rgba(0,0,0,0.07)', position:'sticky', top:0, zIndex:100 }}>
      <div style={{ maxWidth:'1400px', margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight:700, color: ATEMA_COLORS.deepBronze, letterSpacing:'3px' }}>
          ATEMA STUDIO
        </div>
        {!isMobile && controls}
        {isMobile && (
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ background:'none', border:'none', cursor:'pointer', color: ATEMA_COLORS.deepBronze, padding:'4px' }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}
      </div>
      {isMobile && menuOpen && (
        <div style={{ padding:'16px 20px', borderTop:'1px solid #f0f0f0', marginTop:'12px' }}>
          {controls}
        </div>
      )}
    </header>
  );
};

export default Header;
