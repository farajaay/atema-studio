-- ATEMA STUDIO — Expanded Portfolio (Our Work / Atelier) seed for May 2026
--
-- Adds 23 bilingual portfolio items from a fresh studio session covering
--   bride       — single bridal portraits and full editorial spreads
--   couture     — details (rings, lace, fabric, bouquets, jewellery)
--   editorial   — signature shoots, narrative spreads, product photography
--
-- Each row carries a poetic, sensory caption in the Atelier voice — the
-- same register as src/pages/AboutPage.tsx and the journal seed.
--
-- Safe to re-run: every row points at /photos/<filename>, so we wipe only
-- previously-seeded rows. Admin uploads with Supabase Storage URLs are
-- untouched.
--
-- Run AFTER:
--   database/migrations-2026-05-branding.sql
--   database/migrations-2026-05-custom-domain.sql

-- ── 1. Wipe only the previously-seeded portfolio rows ────────────────────
delete from public.portfolio_items
 where image_url like '/photos/%';

-- ── 2. Seed the curated set ──────────────────────────────────────────────
insert into public.portfolio_items
  (title_ar, title_en, category, image_url, caption_ar, caption_en, sort_order, published)
values

-- ─── BRIDE — full portraits & editorial spreads ─────────────────────────
('عروسٌ تحت قوسٍ من الضوء', 'Bride beneath an arch of light',
 'bride',
 '/photos/bride-hero.jpeg',
 'لحظةٌ قبل الإطلال — حيث يصمت الجميع، ويتقدّم الضوء وحده.',
 'A moment before the entrance — when everyone falls silent, and only the light steps forward.',
 10, true),

('تحت ثريّا القاعة', 'Beneath the chandelier',
 'bride',
 '/photos/IMG_0259.JPG',
 'حين يميلُ الذهبُ من السقف، تختارُ العروسُ نظرتها بكلّ هدوء.',
 'When gold leans down from the ceiling, she chooses her gaze quietly.',
 12, true),

('القاعةُ، قبل العهد', 'The hall, before the vow',
 'bride',
 '/photos/5B05CBF2-9106-4FF8-A00A-2D3DAD8693B7.JPG',
 'ثوبٌ أبيض، رواقٌ ذهبيّ، ونَفَسٌ يُؤجَّل لثانيةٍ واحدة.',
 'A white gown, a gilded hall, and a breath held for one more second.',
 14, true),

('الوعد — في صندوقٍ أحمر', 'The promise — in a small red box',
 'bride',
 '/photos/60FBEE21-EB43-4CFA-AEC2-D73D206E5016.JPG',
 'توليبٌ أبيض، ثوبٌ سماويّ، وعهدٌ يُهمسُ على ضوءِ الصباح.',
 'White tulips, sky-blue silk, and a vow whispered into morning light.',
 16, true),

('هو وهي — بهدوء', 'She, and he — quietly',
 'bride',
 '/photos/B6B52466-B962-4C33-804E-135D26C25236.JPG',
 'الشُماغُ والثوبُ الفاتح — تقليدٌ يتشاركان حِكمته دون كلام.',
 'Shemagh and pale silk — a tradition they share without a word.',
 18, true),

('صباحُ الزفاف', 'The morning of',
 'bride',
 '/photos/3F59C309-D72A-466A-9405-116DE58F69B5.JPG',
 'الفرشاةُ، البالوناتُ، والصحيفةُ التي تقول: للتوّ تزوّجنا.',
 'The brush, the balloons, and the headline that reads: "Just Married".',
 20, true),

('حجابٌ من اللؤلؤ', 'The pearl veil',
 'bride',
 '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.JPG',
 'كلّ حبّةٍ على الحجاب نجمةٌ تعرفُ اسمها.',
 'Each pearl on the veil — a star that knows its own name.',
 22, true),

('الاستوديو، بصوتٍ فضّيّ', 'Studio in silver',
 'bride',
 '/photos/7CC155A1-8BFC-49B7-ADC2-CF8346A3E535.JPG',
 'الخلفيّةُ سوداء، الضوءُ ناعم، والعروسُ تكتفي بالحضور.',
 'A black backdrop, a soft light, and her presence — enough.',
 24, true),

('وردٌ أبيضُ شتويّ', 'Roses in winter white',
 'bride',
 '/photos/IMG_5506.JPG',
 'ابتسامةٌ أهدأ من الموسيقى، وحُسنٌ يعرفُ متى يصمت.',
 'A smile quieter than the music, and a beauty that knows when to be still.',
 26, true),

('النظرةُ التي تحتفظُ بها', 'The look she keeps',
 'bride',
 '/photos/IMG_5525.JPG',
 'يدٌ تلامسُ الذقن، ونظرةٌ تلامسُ الأبد.',
 'A hand at her chin, a gaze touching forever.',
 28, true),

('ضحكةٌ بين نَفَسين', 'A laugh between two breaths',
 'bride',
 '/photos/IMG_5538.JPG',
 'لحظةٌ صغيرة — صغيرةٌ جدًّا — لكنّها التي تبقى.',
 'A small moment — very small — but the one that stays.',
 30, true),

('حين تلتفتُ الغرفةُ إليها', 'When the room turns toward her',
 'bride',
 '/photos/IMG_5607.JPG',
 'لا تحتاجُ إلى دخولٍ صاخب — تكفي إطلالتها.',
 'No loud entrance needed — her arrival is enough.',
 32, true),

('عيناها تستريحان قليلًا', 'Eyes resting, briefly',
 'bride',
 '/photos/IMG_5620.JPG',
 'بين النظرتين، يتنفّسُ الفستان.',
 'Between two glances, the gown breathes.',
 34, true),

('أولى ابتساماتِ المساء', 'The first smile of the evening',
 'bride',
 '/photos/IMG_5623.JPG',
 'ليلةٌ طويلة بدأت بعينين تَلمحان شيئًا جميلًا.',
 'A long night that began with eyes catching something beautiful.',
 36, true),

('وجهٌ، عن قُرب', 'A face, up close',
 'bride',
 '/photos/Untitled-1jpg.JPG',
 'لا فلتر، لا ادّعاء — مجرّد ضوءٍ يعرفُ كيف يقترب.',
 'No filter, no pretense — only a light that knows how to come near.',
 38, true),

('صَمتٌ مُذهَّب', 'Gilded silence',
 'bride',
 '/photos/Untitled-2.JPG',
 'حين تُغمضُ العينين، نسمعُ ما لا يُقال.',
 'When the eyes close, we hear what is never said.',
 40, true),

('ابتسامةٌ تنتمي إلى اليوم', 'A smile that belongs to the day',
 'bride',
 '/photos/Untitled-3.JPG',
 'يومٌ كاملٌ يتمحورُ حولَ هذه الثانية.',
 'A whole day, circling around this single second.',
 42, true),

-- ─── COUTURE — details, fabric, hands, flowers ──────────────────────────
('زنبقٌ في قبضتها', 'Calla lilies, in her grip',
 'couture',
 '/photos/IMG_4237.JPG',
 'الكالا، الدانتيل، الخاتم — ثلاثيّةٌ تفسّرُ اليوم.',
 'Calla, lace, and a ring — the trinity that explains the day.',
 50, true),

('اليدُ التي تحملُ اليوم', 'The hand that holds the day',
 'couture',
 '/photos/65DD9322-629B-46FB-AF4A-A0F848A6FF68.JPG',
 'حلقتان لامعتان، وباقةٌ لا تشيخ.',
 'Two rings, glinting; a bouquet that does not age.',
 52, true),

('سكونٌ بين يديها', 'A stillness between her hands',
 'couture',
 '/photos/IMG_3329.JPG',
 'يدان تلتقيان فوقَ الدانتيل — جوابٌ بلا سؤال.',
 'Two hands meet over lace — an answer with no question.',
 54, true),

('عودٌ، توليب، وطقسٌ هادئ', 'Oud, tulips, and a quiet ritual',
 'couture',
 '/photos/17BB76E6-8297-4355-843B-1A1E2264B3C5.JPG',
 'العطرُ يسبقُ الباقة، والباقةُ تسبقُ الفستان.',
 'The scent arrives first, then the bouquet, then the gown.',
 56, true),

-- ─── EDITORIAL — signature spreads & product narrative ──────────────────
('يوميّاتُ الأتيلييه', 'The Atelier diary',
 'editorial',
 '/photos/ECF730D9-58C1-4F62-B8A2-4BF599422C21.JPG',
 'الحذاءُ، الشمعةُ، التاريخ — تفاصيلُ تحفظُ القصّة.',
 'The shoe, the candle, the date — details that keep the story.',
 70, true),

('أكتوبر — بمجوهرات', 'October, in jewels',
 'editorial',
 '/photos/B27F8308-42F1-41C1-9D28-93C67E00B026.JPG',
 'تقويمٌ يَعِدُ بيوم، ومجوهراتٌ تَعِدُ بأبد.',
 'A calendar that promises a day; jewels that promise a forever.',
 72, true);

-- ── 3. Verify ────────────────────────────────────────────────────────────
select '— Portfolio items seeded —' as section;
select sort_order, category, title_en, image_url
  from public.portfolio_items
 where image_url like '/photos/%'
 order by sort_order;
