import { useMemo, useState } from 'react';
import { Check, Images } from 'lucide-react';
import { PHOTO_POOL } from '../content/photoPool';
import type { PhotoPoolKind } from '../content/photoPool';

interface PublicPhotoPickerProps {
  selectedUrl?: string;
  onSelect: (url: string) => void;
}

const FILTERS: Array<{ key: PhotoPoolKind | 'all'; ar: string; en: string }> = [
  { key: 'all', ar: 'الكل', en: 'All' },
  { key: 'bride', ar: 'العروس', en: 'Bride' },
  { key: 'detail', ar: 'التفاصيل', en: 'Details' },
  { key: 'editorial', ar: 'تحريري', en: 'Editorial' },
];

export default function PublicPhotoPicker({ selectedUrl, onSelect }: PublicPhotoPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<PhotoPoolKind | 'all'>('all');

  const photos = useMemo(
    () => filter === 'all' ? PHOTO_POOL : PHOTO_POOL.filter(photo => photo.kind === filter),
    [filter],
  );

  return (
    <div style={{ marginTop: 10 }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={toggleButton}>
        <Images size={14} />
        اختيار من صور الموقع
      </button>

      {open && (
        <div style={panel}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {FILTERS.map(item => {
              const active = filter === item.key;
              return (
                <button key={item.key} type="button" onClick={() => setFilter(item.key)}
                  style={{
                    ...filterButton,
                    background: active ? 'var(--a-gold)' : 'var(--a-surface)',
                    color: active ? 'var(--a-bg)' : 'var(--a-text-soft)',
                    borderColor: active ? 'var(--a-gold)' : 'var(--a-border)',
                  }}>
                  {item.ar}
                </button>
              );
            })}
          </div>

          <div style={grid}>
            {photos.map(photo => {
              const selected = selectedUrl === photo.url;
              return (
                <button key={photo.id} type="button" title={photo.label}
                  onClick={() => onSelect(photo.url)}
                  style={{
                    ...tile,
                    outline: selected ? '2px solid var(--a-gold)' : '1px solid var(--a-border)',
                  }}>
                  <picture>
                    <source srcSet={photo.webp} type="image/webp" />
                    <img src={photo.url} alt="" loading="lazy" decoding="async"
                      width={180} height={220}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </picture>
                  {selected && (
                    <span style={selectedBadge}>
                      <Check size={12} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const toggleButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--a-border)',
  background: 'var(--a-surface-alt)',
  color: 'var(--a-text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
};

const panel: React.CSSProperties = {
  marginTop: 10,
  border: '1px solid var(--a-border)',
  borderRadius: 8,
  padding: 10,
  background: 'var(--a-surface-alt)',
};

const filterButton: React.CSSProperties = {
  border: '1px solid var(--a-border)',
  borderRadius: 7,
  padding: '6px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 700,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(74px, 1fr))',
  gap: 8,
  maxHeight: 330,
  overflowY: 'auto',
  padding: 2,
};

const tile: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '4 / 5',
  border: 'none',
  borderRadius: 7,
  overflow: 'hidden',
  padding: 0,
  cursor: 'pointer',
  background: 'var(--a-surface)',
};

const selectedBadge: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  width: 22,
  height: 22,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--a-gold)',
  color: 'var(--a-bg)',
};
