// ATEMA STUDIO — Client testimonials registry.
//
// These are REAL client words, transcribed from WhatsApp messages the owner
// collected (with permission to quote by first name). Unlike the rest of the
// site's editorial copy, the Arabic here deliberately keeps the authentic
// colloquial voice of the clients — normalise typos and drop emoji, but never
// rewrite or embellish. English versions are faithful supporting translations.
//
// PII discipline: first names only. No surnames, no package codes, no dates,
// no social handles, and never anything derived from the bookings table.
// To pull a quote from the site, flip `published` to false — one-line change.

export interface Testimonial {
  id: string;        // stable slug — keep it name+period, never a full name
  order: number;
  quote_ar: string;
  quote_en: string;
  attr_ar: string;
  attr_en: string;
  published: boolean;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'rotana-2026-01',
    order: 1,
    quote_ar: '«صوّرتي كل شي كأنك داخلة مخي، رغم أني ما شرحت شي… وعندك ذمة وضمير، طلعتي أفضل ما عندك، طاقتك وشغفك وصلني — وقلت لك أنا مصوّرة فأفهم وأقدر.»',
    quote_en: '"You photographed everything as though you had stepped inside my mind, though I had explained almost nothing… You work with real conscience — you gave your very best, and your energy and passion reached me. And I told you: I am a photographer myself, so I understand, and I can judge."',
    attr_ar: '— روتانا، مصوّرة محترفة',
    attr_en: '— Rotana, professional photographer',
    published: true,
  },
  {
    id: 'sara-2026-01',
    order: 2,
    quote_ar: '«توني أشوف الصور، الله يعطيك العافية ما قصّرتي… أبدعتي، ويبارك لك بكل خطوة. شغل نظيف، وبإذن الله مو آخر تعامل.»',
    quote_en: '"I have just seen the photographs — you spared nothing. You created something beautiful; may every step of yours be blessed. Clean, honest work — and God willing, this will not be our last time together."',
    attr_ar: '— ساره',
    attr_en: '— Sara',
    published: true,
  },
  {
    id: 'faten-2024-08',
    order: 3,
    quote_ar: '«شكرًا لك فاطمة، الصور تجنن مرة، الكل حب تصويرك. الله يعطيك العافية وتسلم إيدك يا أجمل مصوّرة.»',
    quote_en: '"Thank you, Fatima — the photographs are simply stunning, and everyone fell in love with your work. Bless your hands, most beautiful of photographers."',
    attr_ar: '— فاتِن',
    attr_en: '— Faten',
    published: true,
  },
  {
    id: 'taif-2025-10',
    order: 4,
    quote_ar: '«يعطيك العافية، توني أشوف الألبوم — والصور تجنن، تفتح النفس، واللقطات روعة. ما قصّرتي.»',
    quote_en: '"I have just opened the album — the photographs are gorgeous, the kind that lift the soul, and every shot is lovely. You spared nothing."',
    attr_ar: '— طيف',
    attr_en: '— Taif',
    published: true,
  },
  {
    id: 'haya-2026',
    order: 5,
    quote_ar: '«والله الصور أكثر من رائعة، صدق. الله يفرح قلبك زي ما أسعدتينا — إن شاء الله المرة الجاية نتصوّر لعائلتي. وشكرًا على حرصك على الوقت وحضورك، ما قصّرتي.»',
    quote_en: '"Truly, the photographs are more than wonderful. You made us as happy as could be — next time, God willing, we will return to photograph my whole family. Thank you for your care with time, and for your presence."',
    attr_ar: '— هيا، حفلة خاصة',
    attr_en: '— Haya, private celebration',
    published: true,
  },
];

/** Published testimonials in display order — the only export public surfaces should use. */
export const publishedTestimonials = (): Testimonial[] =>
  TESTIMONIALS.filter(t => t.published).sort((a, b) => a.order - b.order);
