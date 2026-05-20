// ATEMA STUDIO — Mood Board service
//
// The Mood Board is a post-booking editorial surface composed by Fatima
// from the admin booking modal. It auto-selects 6 portfolio images keyed
// to the bride's package + event season, drafts a bilingual title +
// caption in the Atelier voice, and exposes the whole thing at
// /#/board/<token>. The token is a 160-bit random base32 string — the
// only secret guarding the page.
//
// Pairs with database/migrations-2026-05-moodboard.sql.

import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface MoodBoard {
  id: string;
  booking_id: string;
  token: string;
  package_id: number | null;
  season: Season | null;
  image_urls: string[];
  title_ar: string | null;
  title_en: string | null;
  caption_ar: string | null;
  caption_en: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
}

// ── Package → portfolio categories ───────────────────────────────────────
// Per database/seed-packages-2026-05.sql ids 1..6.
//   1 الخطوبة          → bride
//   2 المخصّصة          → bride + couture + editorial
//   3 الكلاسيكية        → bride + editorial
//   4 الملكية           → bride + couture
//   5 التوقيع           → bride + couture + editorial
//   6 ATEMA Couture    → couture + bride
const PACKAGE_CATEGORIES: Record<number, string[]> = {
  1: ['bride'],
  2: ['bride', 'couture', 'editorial'],
  3: ['bride', 'editorial'],
  4: ['bride', 'couture'],
  5: ['bride', 'couture', 'editorial'],
  6: ['couture', 'bride'],
};

// ── Secure token (Crockford base32, 32 chars = 160 bits of entropy) ─────
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function secureToken(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => CROCKFORD[b & 31]).join('');
}

// ── Season from event_date ──────────────────────────────────────────────
// KSA is hot most of the year, but the calendar still drives palette cues.
export function seasonFromDate(isoDate: string | Date | undefined | null): Season {
  if (!isoDate) return 'spring';
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (Number.isNaN(d.getTime())) return 'spring';
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5)  return 'spring';
  if (m >= 6 && m <= 8)  return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

// ── Seeded shuffle (deterministic per booking, so a re-open shows the same
//    6 unless admin reshuffles explicitly) ─────────────────────────────
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  let s = h >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Auto-select 6 image URLs from portfolio_items ───────────────────────
export async function autoSelectImages(
  packageId: number | null,
  seedKey: string,
): Promise<string[]> {
  if (!supabase) return [];
  const sb = supabase;
  const categories =
    (packageId && PACKAGE_CATEGORIES[packageId]) ||
    ['bride', 'couture', 'editorial'];

  const { data, error } = await sb
    .from('portfolio_items')
    .select('image_url, category, sort_order')
    .in('category', categories)
    .eq('published', true)
    .order('sort_order', { ascending: true });

  let urls: string[] = [];
  if (!error && data && data.length > 0) {
    urls = data.map(r => r.image_url as string);
  } else {
    // Graceful fallback: any published portfolio item.
    const { data: all } = await sb
      .from('portfolio_items')
      .select('image_url')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    urls = (all || []).map(r => r.image_url as string);
  }

  if (urls.length === 0) return [];

  const shuffled = seededShuffle(urls, seedKey);
  // Fill to 6 by cycling if the pool is short.
  const out: string[] = [];
  let i = 0;
  while (out.length < 6 && i < shuffled.length * 6) {
    out.push(shuffled[i % shuffled.length]);
    i++;
  }
  return out.slice(0, 6);
}

// ── List the full published portfolio pool (for the swap-picker) ────────
export async function listPortfolioPool(): Promise<
  Array<{ image_url: string; category: string }>
> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('portfolio_items')
    .select('image_url, category')
    .eq('published', true)
    .order('sort_order', { ascending: true });
  return (data || []) as Array<{ image_url: string; category: string }>;
}

// ── Auto-draft bilingual title + caption ────────────────────────────────
const PACKAGE_LINES_AR: Record<number, string> = {
  1: 'لحظاتٌ تسبق العهد — حين يبدأ القلبُ بالحديث قبل أن يقول اللسان.',
  2: 'مساحةٌ مفصّلة على مقاسكِ — تُولد الصورة كما تُولد الذكرى: فريدة.',
  3: 'كلاسيكيّةٌ بلا تكلّف — حيث البساطةُ هي ذروة الأناقة.',
  4: 'باقةٌ ملكيّة — حين يُهمسُ الفخامة، ولا تُعلَن.',
  5: 'باقة التوقيع — لأنّ بعض اللحظاتِ تستحقّ خاتمها الخاص.',
  6: 'ATEMA كوتور — الفنّ كاملاً، من أوّل خيطٍ إلى آخر ضوء.',
};

const PACKAGE_LINES_EN: Record<number, string> = {
  1: 'Moments before the vow — when the heart begins to speak before the tongue.',
  2: 'A space tailored to you — the image born, like memory, unique.',
  3: 'Classicism without effort — where simplicity is the height of elegance.',
  4: 'Royalty — opulence whispered, never announced.',
  5: 'Signature — because some moments deserve their own seal.',
  6: 'ATEMA Couture — the full art, from first thread to last light.',
};

const SEASON_AR: Record<Season, string> = {
  spring: 'تحت ضوء الربيع الناعم',
  summer: 'في دفءِ الصيف الذهبيّ',
  autumn: 'حين يميلُ الضوءُ نحو العسل',
  winter: 'في صمت الشتاءِ الذي يُجمِّل',
};

const SEASON_EN: Record<Season, string> = {
  spring: 'beneath the soft light of spring',
  summer: 'in the gilded warmth of summer',
  autumn: 'as the light leans toward honey',
  winter: "in winter's most flattering hush",
};

export function seasonLabelAr(s: Season): string {
  return s === 'spring' ? 'الربيع'
    : s === 'summer' ? 'الصيف'
    : s === 'autumn' ? 'الخريف'
    : 'الشتاء';
}

export function draftCopy(
  packageId: number | null,
  season: Season,
  customerName?: string,
) {
  const fallbackAr = 'صورٌ تُرسم بالضوء، وذكرى تُصاغ باليد.';
  const fallbackEn = 'Images drawn with light, memories shaped by hand.';
  const lineAr = (packageId && PACKAGE_LINES_AR[packageId]) || fallbackAr;
  const lineEn = (packageId && PACKAGE_LINES_EN[packageId]) || fallbackEn;
  return {
    titleAr: customerName ? `لـ ${customerName} — هكذا نراكِ` : 'هكذا نراها',
    titleEn: customerName ? `For ${customerName} — this is how we see you` : 'This is how we see her',
    captionAr: `${lineAr} ${SEASON_AR[season]}.`,
    captionEn: `${lineEn} — ${SEASON_EN[season]}.`,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────
export async function getMoodBoardForBooking(bookingId: string): Promise<MoodBoard | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('mood_boards')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  return (data as MoodBoard | null) ?? null;
}

export async function getMoodBoardByToken(token: string): Promise<MoodBoard | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('mood_boards')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  return (data as MoodBoard | null) ?? null;
}

export async function markMoodBoardViewed(token: string): Promise<void> {
  if (!supabase) return;
  // Calls the SECURITY DEFINER RPC defined in the migration — anon-safe.
  try { await supabase.rpc('mark_mood_board_viewed', { p_token: token }); }
  catch { /* swallow — viewed_at is best-effort */ }
}

export async function saveMoodBoard(input: {
  bookingId: string;
  packageId: number | null;
  season: Season;
  imageUrls: string[];
  titleAr: string;
  titleEn: string;
  captionAr: string;
  captionEn: string;
  existingId?: string;
}): Promise<MoodBoard | null> {
  if (!supabase) return null;
  const payload = {
    package_id: input.packageId,
    season: input.season,
    image_urls: input.imageUrls,
    title_ar: input.titleAr,
    title_en: input.titleEn,
    caption_ar: input.captionAr,
    caption_en: input.captionEn,
  };

  if (input.existingId) {
    const { data } = await supabase
      .from('mood_boards')
      .update(payload)
      .eq('id', input.existingId)
      .select('*')
      .maybeSingle();
    return (data as MoodBoard | null) ?? null;
  }

  const { data } = await supabase
    .from('mood_boards')
    .insert({ booking_id: input.bookingId, token: secureToken(), ...payload })
    .select('*')
    .maybeSingle();
  return (data as MoodBoard | null) ?? null;
}

export async function markMoodBoardSent(id: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('mood_boards')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', id);
}

// ── URL helper ───────────────────────────────────────────────────────────
export function buildBoardUrl(token: string): string {
  // HashRouter — the path lives after the '#'.
  return `${window.location.origin}/#/board/${token}`;
}
