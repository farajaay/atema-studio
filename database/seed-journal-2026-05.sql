-- ATEMA STUDIO — Journal seed (6 editorial posts)
--
-- Six bilingual long-form posts in the same warm, lyrical voice as the
-- AboutPage. UPSERT by slug so it's safe to re-run; admin edits won't be
-- clobbered if the slug stays the same.
--
-- Run AFTER:
--   database/migrations-2026-05-branding.sql   (creates journal_posts table)
--
-- Covers point at /public/photos/*.jpeg — already shipped in the bundle.
-- Admin can later replace them with bespoke covers via JournalManager.

insert into public.journal_posts (
  slug, title_ar, title_en,
  excerpt_ar, excerpt_en,
  body_ar, body_en,
  cover_url, published, published_at
) values

-- ── 1. On Light ──────────────────────────────────────────────────────────
(
  'on-light',
  'خواطر في الضوء',
  'On Light',

  'الضوء ليس عنصراً نضيفه؛ هو الشاهد الأول. يدخل قبلنا، ويبقى بعدنا، ويعرف من المرأة ما لا تستطيع الكلمات أن تحكيه.',
  'Light is not an ingredient we add — it is the first witness. It enters before we do, stays after we leave, and knows of a woman what words cannot say.',

  $body$في الاستوديو، الضوءُ ليس أداةً، بل شخصيّة. يدخل غرفةَ التصوير قبلنا — يفحص الجدران، ويُلامس النوافذ، ويُقرّر إن كان اليومُ يومَ همسٍ أم احتفال.

في كل جلسة، أُحادثُ الضوءَ قبل أن أُحادث العروس. أسأله: من أينَ تأتي اليوم؟ بأيِّ مزاج؟ هل تتقدّم بدلال، أم بحياء؟ ثم أُجلسُها مكاناً يُحبّه، لا مكاناً ناسبَ الكاميرا فقط.

في باقاتِ كوتور، يحدث أحياناً أن أنتظرَ ساعةً كاملةً لأنّ شمسَ العصر لم تصل بعد إلى الزاوية المطلوبة. لا أستعجل. الضوءُ — كالحقيقة — لا يأتي بأمرٍ من أحد.

وحين يأتي، تلتقطه العدسةُ بنفسها تقريباً. لا أُضيف فلتراً، لا أُصحّح ميزانَ ألوان، لا أُصلِحُ ما لم يكن مكسوراً. فقط أُمسك بما رأته عيناي، وأُسلِّمه إلى الصورة.

هذه المهنةُ، في النهاية، ليست عن الكاميرات. هي عن أن نتعلّم متى نسكتُ ونترك الضوءَ يتكلّم.$body$,

  $body$In the studio, light is not a tool. It is a character. It enters the room before we do — it inspects the walls, brushes the windows, and decides whether today is a day of whisper or of celebration.

In every session, I speak to the light before I speak to the bride. I ask it: where are you arriving from today? In what mood? Are you stepping in coquettishly, or shyly? Then I seat her where the light loves her, not where the camera happens to point.

In Couture sessions, I have waited an entire hour because the afternoon sun had not yet reached the corner I wanted. I do not rush it. Light, like truth, will not be commanded.

When it arrives, the lens almost captures it on its own. I add no filter, correct no white balance, fix nothing that was not broken. I simply hold on to what my eyes saw, and hand it to the photograph.

This profession, in the end, is not about cameras. It is about learning when to be quiet, and to let the light do the speaking.$body$,

  '/atema-studio/photos/customise.jpeg',
  true,
  '2026-01-15 10:00:00+03'
),

-- ── 2. The First Look ────────────────────────────────────────────────────
(
  'the-first-look',
  'النظرة الأولى',
  'The First Look',

  'قبل أن تنظرَ العروسُ إلى الكاميرا، عليها أن تنظرَ إلى نفسها — كما هي اليوم، بكلِّ ما فيها. هذه اللحظةُ، في ATEMA، نحرسُها بدقّة.',
  'Before the bride looks into the camera, she must first look at herself — as she is today, with everything she carries. At ATEMA, we guard this moment carefully.',

  $body$لكلِّ امرأةٍ في ATEMA لحظةٌ نسمّيها داخلياً «النظرةَ الأولى». هي ليست أمام الكاميرا، ولا أمام طاقم العمل، ولا حتى أمامي. هي أمام نفسِها — لحظةَ تدخل غرفةَ التجهيز، وترى ذاتَها في المرآة بفستانِ الجلسة.

أُغلقُ البابَ خلفي عمداً. أعطيها خمسَ دقائق. خمسَ دقائق لا تتحدّث فيها مع أحد، ولا ترفع هاتفاً، ولا تسأل سؤالاً. فقط هي، وانعكاسُها، وبدايةُ شيءٍ كبير.

ما يحدث في تلك الدقائق لا يُكتب. أحياناً تبتسم. أحياناً تذرف دمعةً صامتة. أحياناً تضحك ضحكةً قصيرةً لا تعرف لماذا. لكنها — في كلِّ الحالات — تخرج من تلك الغرفة وهي امرأةٌ مختلفةٌ قليلاً عمّن دخلت.

من تلك اللحظة فقط، نبدأ التصوير. لأنّ أصدقَ صورةٍ لا يمكن أن تُؤخذ قبل أن تَرى المرأةُ نفسَها أوّلاً.$body$,

  $body$For every woman at ATEMA there is a moment we quietly call the first look. It is not before the camera, nor before the crew, nor even before me. It is before herself — the moment she steps into the dressing room and meets her own reflection in the gown.

I close the door behind me on purpose. I give her five minutes. Five minutes in which she does not speak to anyone, does not lift a phone, does not ask a question. Just her, her reflection, and the beginning of something large.

What happens in those minutes cannot be written down. Sometimes she smiles. Sometimes a silent tear falls. Sometimes she laughs a brief laugh without knowing why. But in every case, she leaves that room slightly different from the woman who entered it.

Only from that moment do we begin to photograph. Because the truest portrait cannot be taken until the woman has first seen herself.$body$,

  '/atema-studio/photos/royal.jpeg',
  true,
  '2026-02-08 11:30:00+03'
),

-- ── 3. What Hands Remember ───────────────────────────────────────────────
(
  'what-hands-remember',
  'ما تحفظه الأيدي',
  'What Hands Remember',

  'قبل سنواتٍ من تعلّمِ التصوير، كنتُ أتعلّم الخياطة. علّمتني أصابعي ما لم تستطع الكتبُ أن تعلّمَه.',
  'Years before I learned photography, I learned to sew. My fingers taught me what no book ever could.',

  $body$حين أُمسكُ كاميرتي، تتذكّر يدايَ شيئاً قديماً. لقد بدأَتا بإبرةٍ وخيط — لا بعدسة. تعلّمتُ من جدّتي كيف أُجعِّدُ قماشةَ ساتانٍ بلا أن أكسرَها. كيف أُخفي غرزةً خلف غرزة. كيف أُلطّفُ ضوءاً قاسياً بطبقةٍ من تول.

كلُّ ذلك يعود إليّ في الاستوديو. حين أقولُ للعروس: «ارفعي ذقنَكِ قليلاً»، لا أتحدّث كمصوّرة. أتحدّث كخيّاطةٍ ترى أنّ غرزةً واحدةً، إذا تحرّكت، تكشفُ جمالاً كان مخبوءاً.

أحياناً، قبل لقطة، أقتربُ منها وأُعدِّلُ تجعيدةً في الفستان. لا تُصوَّر الكاميرا تلك الحركة، لكنّها تظهر في الإطار النهائي. لأنّ ما يحدثُ في الثلاثين سنتيمتراً بين يدي والعدسة، يتسلّل دائماً إلى الصورة.

هذه يدٌ لا تتسرّع. لأنّها تعرف أنّ القماشة، إذا شُدَّت كثيراً، تفقدُ نَفَسَها — والمرأةُ كذلك.$body$,

  $body$When I hold my camera, my hands remember something old. They began with a needle and thread — not with a lens. My grandmother taught me how to crease a length of satin without breaking it. How to hide one stitch behind another. How to soften a harsh light beneath a layer of tulle.

All of that returns to me in the studio. When I tell a bride, "lift your chin, just slightly," I am not speaking as a photographer. I am speaking as a seamstress who can see that one fold, moved by a single degree, will reveal a beauty that was hiding.

Sometimes, before a frame, I step toward her and adjust a pleat in her gown. The camera does not record that gesture, but it shows up in the final image. Because what passes in the thirty centimetres between my hand and the lens always finds its way into the photograph.

These are hands that do not hurry. Because they know that a fabric, if pulled too tightly, loses its breath — and so does a woman.$body$,

  '/atema-studio/photos/signature.jpeg',
  true,
  '2026-03-02 09:15:00+03'
),

-- ── 4. The Pause Between Frames ──────────────────────────────────────────
(
  'the-pause-between-frames',
  'السكون بين اللقطات',
  'The Pause Between Frames',

  'ليست الصورةُ الجيّدة هي الأولى. ولا الثانية. إنّها التي تأتي بعد أن نسيتِ — للحظةٍ — أنّ هناك كاميرا.',
  'The good photograph is not the first. Nor the second. It is the one that arrives after you have forgotten — for a moment — that there is a camera at all.',

  $body$كثيراتٌ يسألنني: «كم صورةً نأخذ في الجلسة؟» السؤالُ الأهمُّ الذي لا يُسأل: كم لحظةَ صمتٍ ستكون بينها؟

الصورةُ التي ستُعلَّقُ في غرفتكِ، التي ستبقى في الألبوم لسنوات، لن تكون اللقطةَ المثاليّة من حيث الإضاءة فقط. ستكون اللقطةَ التي وقعتْ في لحظةٍ نسيتِ فيها كلَّ شيء: نسيتِ الكاميرا، نسيتِ الفستان، نسيتِ ما يجب أن تبدو عليه «العروس». ابتسمتِ لشيءٍ خاصٍّ بكِ وحدكِ.

تلك الابتسامةُ، أو تلك النظرةُ، لا تأتي بأمرٍ. تأتي حين تُقتنعينَ — في مكانٍ ما عميق — أنّكِ بأمان، وأنّ من أمامكِ لن يستعجلكِ، ولن يحكمَ عليكِ.

لذلك، في كلِّ جلسةٍ مع ATEMA، نُخصِّصُ وقتاً للسكون. للقهوةِ بين اللقطات. للحديثِ عن أمورٍ لا علاقةَ لها بالتصوير. لتلكَ الفسحاتِ التي تظنّينَ فيها أنّنا لا نعمل — بينما، في الحقيقة، نحن نعمل بأهمِّ ما يكون.$body$,

  $body$Many brides ask me, "how many frames will we take in the session?" The more important question, the one rarely asked: how many silences will lie between them?

The photograph that will hang in your home, that will live in the album for years, will not be the technically perfect frame. It will be the one that fell into a moment when you had forgotten everything — forgotten the camera, forgotten the gown, forgotten what a "bride" is supposed to look like. The one in which you smiled at something belonging only to you.

That smile, that gaze, never arrives on command. It comes only when you are convinced — somewhere deep — that you are safe, and that the person across from you will not rush you, and will not judge.

This is why every session at ATEMA includes time for stillness. For coffee between frames. For conversation about things that have nothing to do with photography. For those gaps in which you imagine we are not working — while, in truth, we are working at the very most important part.$body$,

  '/atema-studio/photos/engagement.jpeg',
  true,
  '2026-03-29 14:00:00+03'
),

-- ── 5. What Stays ────────────────────────────────────────────────────────
(
  'what-stays',
  'ما يبقى',
  'What Stays',

  'الصورةُ الرقميّةُ قد تختفي مع كلِّ هاتفٍ نُغيِّره. لكنّ ورقةً مطبوعةً بدقّةٍ، في صندوقٍ هادئ، تستطيع أن تعبرَ قرناً.',
  'A digital photograph may vanish with every phone we replace. But a sheet of archival paper, kept in a quiet box, can cross a century.',

  $body$أعرف أنّ معظم الصور اليوم تعيشُ في هواتفنا. وأعرف أنّ تلك الهواتف تُسرَق، أو تتعطّل، أو تُترَك في سيّارةِ أجرةٍ في الدمام. كم من ذكرى ضاعت بهذه الطريقة؟ لا أحد يحصيها.

لذلك، في ATEMA، نطبعُ. حتى للعميلات اللواتي لا يطلبنَ الطباعةَ، نُقدِّمُ صورتَين أرشيفيّتَين هديّةً مع كلِّ باقة. ورقُ هانيمول فاينارت ١٠٠٪ قطن، حِبرٌ يدوم ٢٠٠ سنة في ظروفٍ معتدلة، صندوقٌ مبطّنٌ يحمل العنوان والتاريخ.

لأنّ هناك سؤالاً واحداً تطرحه كلُّ امرأةٍ، في زاويةٍ ما من قلبها، حين تحجز جلسةً معنا: «ماذا ستتذكّرني ابنتي حين أكون رحلتُ؟»

نحن لا نُجيب على هذا السؤال بكلمات. نُجيب عليه بصندوقٍ، يُوضع في خزانةٍ، يفتحه أحدٌ ما — بعد عشرين سنة، أو خمسين — ويرى ما كنتِ عليه في يومٍ كان لكِ.

هذه ليست خدمةَ تصوير. هذه شهادةُ ميلادٍ لذكرى.$body$,

  $body$I know that most photographs today live in our phones. And I know those phones get stolen, or fail, or get left in the back of a Dammam taxi. How many memories have been lost this way? Nobody is counting.

This is why, at ATEMA, we print. Even for clients who do not request prints, we include two archival photographs as a gift with every package. Hahnemühle FineArt 100% cotton paper, ink rated to last 200 years under stable conditions, a lined box marked with the title and date.

Because there is one question every woman asks, in some corner of her heart, when she books a session with us: "what will my daughter remember of me when I am gone?"

We do not answer that question with words. We answer it with a box, placed in a cabinet, opened one day — twenty years from now, or fifty — by someone who sees who you were on a day that was yours.

This is not a photography service. It is a birth certificate, issued to a memory.$body$,

  '/atema-studio/photos/couture.jpeg',
  true,
  '2026-04-20 16:00:00+03'
),

-- ── 6. A Letter to the Bride ─────────────────────────────────────────────
(
  'a-letter-to-the-bride',
  'رسالة إلى العروس',
  'A Letter to the Bride',

  'في الأسبوع الذي يسبقُ زفافَكِ، قد تشعرين بأنّ كلَّ شيءٍ يحدثُ من حولك. هذه رسالةٌ لتذكيرِكِ: أنتِ في القلب.',
  'In the week before your wedding, you may feel that everything is happening around you. This letter is to remind you: you are at the centre.',

  $body$عزيزتي العروس،

في الأيّامِ القادمة، سيتحدّث الجميعُ من حولكِ عن «اليوم الكبير». سيُذكّرونكِ بالقاعة، بالضيوف، بترتيبِ الطاولات، بلونِ زهور الكوشة. سيتدفّق الكلامُ من كلِّ اتّجاه، وسيُطلب منكِ أن تأخذي قراراتٍ يجب أن تكون مهمّةً، وفي الحقيقة، ليست كذلك.

أرجو منكِ شيئاً صغيراً واحداً: خصِّصي خمسَ دقائق في صباح كلِّ يوم لنفسكِ. دون هاتف. دون قائمةِ مهام. دون أن يدخل أحدٌ الغرفة. تنفّسي. اشربي شيئاً دافئاً. تذكّري أنّ خلف كلِّ هذا الازدحام، هناك امرأةٌ — أنتِ — تستعدُّ لإحدى أجمل لحظاتِ حياتها.

في يومِ التصوير، حين تأتيننا، اتركي القائمةَ الطويلةَ خارج الباب. اتركيها. كلُّ من في الاستوديو يعرف ما عليه فِعله. كلُّ ما عليكِ أنتِ هو أن تكوني، ببساطة، في تلك الغرفة، بتلك الإضاءة، في ذلك الفستان. الباقي علينا.

وحين تنظرين، يوماً، إلى صورِ ذلك اليوم، لن تتذكّري ترتيبَ الطاولات، ولن تتذكّري لونَ الزهور بدقّة. ستتذكّرين كيف شعرتِ. هذا هو ما نحاول، في كلِّ ما نفعله، أن نحفظَه.

بكلِّ الودّ،
استوديو ATEMA$body$,

  $body$Dear bride,

In the days ahead, everyone around you will be speaking about "the big day." They will remind you about the hall, the guests, the seating arrangement, the colour of the kosha's flowers. Words will flow in from every direction, and you will be asked to make decisions that are supposed to feel important — but really, are not.

Allow me one small request: set aside five minutes each morning for yourself. No phone. No checklist. No one entering the room. Breathe. Drink something warm. Remember that behind all this commotion, there is a woman — you — preparing for one of the most beautiful moments of her life.

On the day of the session, when you come to us, leave the long list outside the door. Leave it. Everyone in the studio knows what they need to do. Your only task is to be, simply, in that room, in that light, in that gown. The rest is on us.

And when you look back, one day, at the photographs of that day — you will not recall the table arrangement, nor the precise hue of the flowers. You will remember how you felt. That, in everything we do, is what we are trying to preserve.

With all our warmth,
ATEMA Studio$body$,

  '/atema-studio/photos/classic.jpeg',
  true,
  '2026-05-10 08:45:00+03'
)

on conflict (slug) do update set
  title_ar     = excluded.title_ar,
  title_en     = excluded.title_en,
  excerpt_ar   = excluded.excerpt_ar,
  excerpt_en   = excluded.excerpt_en,
  body_ar      = excluded.body_ar,
  body_en      = excluded.body_en,
  cover_url    = excluded.cover_url,
  published    = excluded.published,
  published_at = excluded.published_at;

-- ─── Verify ─────────────────────────────────────────────────────────────
select '— Journal posts seeded —' as section;
select slug, title_ar, title_en, published, published_at
  from public.journal_posts
 order by published_at desc;
