// ATEMA STUDIO - curated public photo pool.
//
// These are already optimised assets under public/photos. The admin portfolio
// and journal managers use this list so Fatima can choose from the site pool
// without re-uploading the same images into Supabase Storage.

export type PhotoPoolKind = 'bride' | 'detail' | 'editorial';

export interface PhotoPoolItem {
  id: string;
  label: string;
  kind: PhotoPoolKind;
  url: string;
  webp: string;
}

function photo(id: string, label: string, kind: PhotoPoolKind, file: string): PhotoPoolItem {
  return {
    id,
    label,
    kind,
    url: `/photos/${file}.optimised.jpg`,
    webp: `/photos/${file}.webp`,
  };
}

export const PHOTO_POOL: PhotoPoolItem[] = [
  photo('bride-window-01', 'Window bridal portrait', 'bride', 'IMG_3866 copy'),
  photo('bride-window-02', 'Chandelier profile', 'bride', 'IMG_3864 copy'),
  photo('bride-window-03', 'Side arch portrait', 'bride', 'IMG_3812 copy'),
  photo('bride-window-04', 'Full arch portrait', 'bride', 'IMG_3802 copy'),
  photo('bride-window-05', 'Couture profile', 'bride', 'IMG_3835 copy'),
  photo('bride-window-06', 'Quiet hands portrait', 'bride', 'IMG_3844 copy'),
  photo('bride-window-07', 'Soft standing portrait', 'bride', 'IMG_2646'),
  photo('bride-window-08', 'Sleeved couture portrait', 'bride', 'IMG_2561'),
  photo('bride-window-09', 'Lace profile seated', 'bride', 'IMG_2637'),
  photo('bride-window-10', 'Pearl veil portrait', 'bride', 'IMG_3715 copy1'),
  photo('bride-window-11', 'Editorial face close', 'bride', 'IMG_3597 copy'),
  photo('bride-window-12', 'Soft veil portrait', 'bride', 'IMG_3678 copy'),
  photo('bride-window-13', 'Earring close portrait', 'bride', 'IMG_3688 copy'),
  photo('bride-window-14', 'Resting earring portrait', 'bride', 'IMG_3688 copy1'),
  photo('bride-window-15', 'Couture back profile', 'bride', 'IMG_3500 copy'),
  photo('bride-window-16', 'Lace side glance', 'bride', 'IMG_3502 copy'),
  photo('bride-window-17', 'Poised couture smile', 'bride', 'IMG_3514 copy'),
  photo('bride-window-18', 'Soft couture smile', 'bride', 'IMG_3515 copy'),
  photo('bride-window-19', 'Makeup detail portrait', 'bride', 'IMG_3534 copy'),
  photo('bride-window-20', 'Bright editorial face', 'bride', 'IMG_2591'),
  photo('bride-window-21', 'Veiled editorial portrait', 'bride', 'IMG_2526'),
  photo('bride-window-22', 'Classic lace portrait', 'bride', 'IMG_2543'),
  photo('bride-window-23', 'Soft seated portrait', 'bride', 'IMG_2626'),
  photo('bride-window-24', 'Couture side pose', 'bride', 'IMG_2636'),
  photo('bride-window-25', 'Classic evening bride', 'bride', 'IMG_5506'),
  photo('bride-window-26', 'Diamond veil portrait', 'bride', 'IMG_5525'),
  photo('bride-window-27', 'Bride smile close', 'bride', 'IMG_5538'),
  photo('bride-window-28', 'Veil foreground portrait', 'bride', 'IMG_5607'),
  photo('bride-window-29', 'Eyes resting portrait', 'bride', 'IMG_5620'),
  photo('bride-window-30', 'Bouquet smile portrait', 'bride', 'IMG_5623'),
  photo('bride-window-31', 'Hero arch portrait', 'bride', 'bride-hero'),

  photo('detail-ring-01', 'Ring over lace', 'detail', 'IMG_2592'),
  photo('detail-ring-02', 'Hands over lace', 'detail', 'IMG_3329'),
  photo('detail-ring-03', 'Soft hand detail', 'detail', 'IMG_3567 copy'),
  photo('detail-bouquet-01', 'Calla bouquet detail', 'detail', 'IMG_4237'),
  photo('detail-bouquet-02', 'Tulips and perfume', 'detail', '17BB76E6-8297-4355-843B-1A1E2264B3C5'),
  photo('detail-bouquet-03', 'Bouquet and sleeve', 'detail', '65DD9322-629B-46FB-AF4A-A0F848A6FF68'),
  photo('detail-bouquet-04', 'White bouquet moment', 'detail', 'B6B52466-B962-4C33-804E-135D26C25236'),
  photo('detail-atelier-01', 'Invitation and pearls', 'detail', '2EB22230-C684-4F2D-8E01-E7FAEA49198C'),
  photo('detail-atelier-02', 'Shoe and candle', 'detail', '2F5E6400-4188-4A9C-A13E-21F707D81951'),
  photo('detail-atelier-03', 'Perfume and gold', 'detail', '8A2E651F-3DFF-49C1-9FFF-384BF2ECDBBE'),
  photo('detail-atelier-04', 'Couture shoe detail', 'detail', 'BB3C2F4A-719F-4165-9509-594DF8B0A18F'),
  photo('detail-atelier-05', 'Golden bridal still life', 'detail', 'F517E311-4DD6-4FDF-80A4-46CCB850411F'),

  photo('editorial-atelier-01', 'ATEMA wedding details', 'editorial', 'ECF730D9-58C1-4F62-B8A2-4BF599422C21'),
  photo('editorial-atelier-02', 'Pearl veil collage', 'editorial', 'F41A818D-D3EF-419E-A002-DC76C76BF59D'),
  photo('editorial-atelier-03', 'Gold editorial collage', 'editorial', 'E60CBCE0-A98D-4344-BA72-3090BEF57A2F'),
  photo('editorial-atelier-04', 'Shoe and jewelry story', 'editorial', 'photo-output-2'),
  photo('editorial-atelier-05', 'Golden shoe story', 'editorial', 'photo-output'),
  photo('editorial-atelier-06', 'Couture shoe close', 'editorial', 'photo-output-1'),
  photo('editorial-atelier-07', 'Ring still life', 'editorial', 'signature'),
  photo('editorial-atelier-08', 'Royal ring detail', 'editorial', 'royal'),
];
