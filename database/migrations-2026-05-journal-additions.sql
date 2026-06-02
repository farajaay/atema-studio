-- ATEMA STUDIO — Journal additions (May 2026)
--
-- Two new long-form essays in the Atelier voice — Arabic-first, with
-- English translations. Owner brief: "be dreamy, be passionate, be
-- luxurious, be extra creative."
--
--   7. حارسةُ الذاكرة            On the camera as the keeper of memory
--   8. كيف غيّرت العدسةُ العالم   On photography's silent revolution of
--                                  human civilisation
--
-- UPSERT by slug — safe to re-run; admin edits via JournalManager won't
-- be clobbered as long as the slug is unchanged.

insert into public.journal_posts (
  slug, title_ar, title_en,
  excerpt_ar, excerpt_en,
  body_ar, body_en,
  cover_url, published, published_at
) values

-- ── 7. The Keeper of Memory ──────────────────────────────────────────────
(
  'keeper-of-memory',
  'حارسةُ الذاكرة',
  'The Keeper of Memory',

  'الذاكرةُ خائنةٌ بلطف — تُبقي ما لا نريد، وتنسى ما لا نطيق أن نخسره. والكاميرا، وحدها، هي التي لا تنسى.',
  'Memory is gently treacherous — it keeps what we did not want, and forgets what we could not bear to lose. Only the camera does not forget.',

  $body$في الليلة التي تسبق زفافِكِ، إذا أغمضتِ عينيكِ، حاولي أن تستحضري وجهَ جدّتِكِ كما كان حين كنتِ في الخامسة. حاولي أن تتذكّري لونَ ثوبها يومَ زارَتْكِ. حاولي أن تستعيدي صوتَها بدقّة، كما يصدر من حنجرتها لا من ذاكرتكِ.

ستجدين أنّ شيئاً يُفلتُ منكِ. الصورةُ تتمايلُ كأنّها انعكاسٌ في ماءٍ يهتزّ. تَكاد. تَكاد. ثم لا.

هذه هي الذاكرةُ البشريّة — حارسٌ مخلصٌ، لكنّه يَنام أحياناً. كلُّ ما نظنُّه «محفوظاً للأبد» يتآكلُ صامتاً، لون بعد لون، تفصيل بعد تفصيل، حتى يبقى الإحساسُ وحده — والإحساسُ، رغم جماله، لا يُريكِ وجهَ من تحبّين.

هنا يتدخّلُ الضوء. هنا تُمسكُ الكاميرا ما تعجزُ الذاكرةُ عن إمساكه. لحظةٌ صغيرةٌ — انحناءةُ رأسٍ، ابتسامةٌ في زاوية الفم، لمسةُ يدٍ على كتف — تُسلَّمُ إلى الورق، وتنامُ هناك بهدوء، بانتظار أن يستيقظَ شخصٌ ما، بعد عشرين سنة، فيراها كأنّها حدثَتْ قبل دقيقة.

في كلِّ صورةٍ نلتقطُها في ATEMA، هناك وعدٌ صامتٌ نُقطعُهُ على أنفسنا: أنّ ما حدث في هذه الثانية، لن يُسرَق منكِ. لا الزمن، ولا النسيان، ولا حتى أنتِ — في يومٍ تتعبين فيه من تذكُّر تفاصيلٍ كثيرة — ستقدرين على محو هذه الثانية. ستبقى. مطبوعةً، أو على شاشة، أو في صندوقٍ في الخزانة، تنتظرُ من سيفتحه.

أمّاهٌ سعوديّة قالت لي مرّةً، وهي تتصفّحُ ألبومَ ابنتها بعد سنواتٍ من زواجها: «الصورُ علّمَتْني شيئاً لم أكن أعرفه. علّمَتْني أنّ ابنتي كانت أجملَ ممّا تذكّرت، وأنّ يومَ زفافِها كان أطولَ ممّا عشتُهُ، وأنّني — أنا — كنتُ هناك، وكنتُ سعيدة».

هذا هو ما تفعلُهُ الصور. لا تُؤرّخُ الأحداث فقط — بل تُعيدُ إلينا أنفسَنا، بعد أن نَكون قد نسينا قليلاً من نفسنا.

في عصرٍ يَجري فيه كلُّ شيء بسرعةٍ مُذهلة، صار التصويرُ نوعاً من المقاومة. مقاومةٌ ضدّ الفقدان. ضدّ تَلاشي الوجوه. ضدّ الذاكرةِ التي تخونُ، حتى وإن أخلصت.

كلُّ امرأةٍ تأتي إلى استوديو ATEMA، تأتي لِشيءٍ أعمقَ من الصور. تأتي لِتُودِعَ لحظةً من حياتها لدى حارسةٍ موثوقة — حارسةٍ لا تكذب، ولا تُجمِّل، ولا تُسقط من الذاكرة ما تَريد العيونُ أن تتذكّرَه.

والكاميرا، بصمتٍ نبيل، تتسلّمُ الأمانة.

وتحفظُها.

إلى الأبد.$body$,

  $body$On the night before your wedding, close your eyes and try to summon your grandmother's face as it was when you were five. Try to recall the colour of the dress she wore the day she visited. Try to bring back her voice, precisely — not from your memory of it, but as it once came from her throat.

You will find that something slips. The image trembles, as a reflection trembles in water. It almost forms. It almost. Then it does not.

This is human memory — a loyal guardian, who sometimes sleeps. Everything we believe is "kept forever" is quietly being eroded, colour after colour, detail after detail, until only the feeling remains. And feeling, beautiful as it is, will not show you the face of the one you love.

This is where light intervenes. This is where the camera holds what memory cannot. A small moment — the tilt of a head, a smile in the corner of a mouth, a hand resting on a shoulder — handed gently to paper, where it sleeps quietly, waiting for someone, twenty years from now, to see it as if it happened a minute ago.

In every photograph we take at ATEMA, there is a silent promise we make to ourselves: that what occurred in this second will not be stolen from you. Not by time. Not by forgetting. Not even by you — on the day when, weary of remembering too many things, you might wish to let it go. It will stay. Printed, or on a screen, or in a box in a cupboard, waiting for whoever opens it.

A Saudi mother told me once, leafing through her daughter's album years after the wedding: "The photographs taught me something I had not known. They taught me that my daughter was more beautiful than I remembered, that her wedding day was longer than the one I lived, and that I — I — was there, and I was happy."

This is what photographs do. They do not merely record events — they return us to ourselves, after we have forgotten a little of who we were.

In an age when everything moves at dizzying speed, photography has become a kind of resistance. Resistance against loss. Against the fading of faces. Against the memory that betrays us, however faithfully it tries.

Every woman who arrives at ATEMA studio comes for something deeper than photographs. She comes to deposit a moment of her life with a trustworthy keeper — a keeper that does not lie, does not embellish, does not let fall from memory what the eye most wished to keep.

And the camera, with a noble silence, accepts the trust.

And keeps it.

Forever.$body$,

  '/photos/Untitled-2.JPG',
  true,
  '2026-05-22 09:00:00+03'
),

-- ── 8. How the Lens Changed the World ────────────────────────────────────
(
  'lens-changed-the-world',
  'كيف غيّرت العدسةُ العالم',
  'How the Lens Changed the World',

  'قبل التصوير، كان الخلودُ امتيازاً للملوك وحدَهم. ثمّ وُلِدت الكاميرا — وفجأةً، صار لكلِّ امرأةٍ في الأرض الحقُّ في أن تُرى، وأن تُحفَظ.',
  'Before photography, immortality was a privilege reserved for kings alone. Then the camera was born — and suddenly, every woman on earth held the right to be seen, and to be kept.',

  $body$في عام ١٨٣٩، نظرَ رجلٌ في باريس إلى صندوقٍ خشبيٍّ صغيرٍ فوق ثلاثِ أرجل، وقال للعالم: «انظروا، لقد أمسكتُ الضوءَ بيديّ». اسمه لويس داجير. ما لم يَكن يعرفُهُ في تلك اللحظة هو أنّه لم يَخترع آلةً فقط — بل أعادَ كتابةَ معنى أن نكون بشراً.

قبل تلك اللحظة، إذا أردتِ أن يبقى وجهُكِ بعد مماتِكِ، كان عليكِ أن تكوني ملكةً، أو زوجةَ ملك، أو ابنةَ ثريٍّ يَدفع لرسّامٍ يُمضي ستّةَ أشهرٍ يُصوِّركِ بالزيت. لوحاتٌ ثقيلةٌ، باهظةُ الثمن، تُعلَّق في قصور — بينما تذهب وجوهُ ملايين النساء، عبر القرون، إلى التراب دون أن يَعرفهنّ أحدٌ، حتى أحفادهنّ.

ثم جاءت الكاميرا. وفي ظرفِ جيلٍ واحد، أصبحَ بإمكانِ امرأةٍ في مصر، أو في حلب، أو في الجبيل، أن تَجلسَ أمام عدسةٍ وتقول: «أنا هنا. كنتُ هنا. وها هو الإثبات». لم يكن ذلك تطوّراً تقنيّاً. كان ثورةً صامتةً على الزمن نفسه.

العائلاتُ بدأَت تَملك ألبومات. الجدّاتُ صرنَ يَعرفنَ كيف بَدَت جدّاتُهنّ. الحربُ توقّفَت عن أن تكون قصّةً يَرويها المنتصرون — وصارت وجوهاً تَنظرُ إلينا من ميدانٍ، فلا نَستطيعُ بعدُ الكذبَ على أنفسنا. الموضةُ، الفنُّ، الحبُّ، الرحلاتُ، حتى الطبُّ — كلُّ ذلك انقلبَ، لأنّ بإمكاننا الآن أن نَحفظَ ما نَرى.

والأجملُ من ذلك كلِّه: التصويرُ منحَ المرأةَ صوتاً كانت تَفتقدُه. في عشرينيّاتِ القرن الماضي، في القاهرةِ وبيروت، كانت أوّلُ النساء يَحملنَ كاميراتٍ صغيرةً، يَلتقطنَ صوراً لنساءٍ أخرياتٍ — في بيوتهنّ، في حماماتهنّ، في تجمّعاتهنّ الخاصّة. هذه الصورُ، التي يَتعجَّبُ منها الباحثون اليوم، لم تَكن لتُوجد لو أنّ كلَّ المصوّرين كانوا رجالاً. كانت اللحظاتُ ستبقى خلفَ الأبواب، طيَّ السِّتر.

نحن في ATEMA، نَعرفُ أنّنا جزءٌ من تلك السلسلة. نَعرف أنّ كلَّ مرّةٍ تَجلسُ فيها امرأةٌ سعوديّةٌ أمام كاميرتي، تَحدثُ ثلاثةُ أشياءٍ في آنٍ واحد:

أوّلاً، يُحفَظُ وجهُها — لها، لأبنائها، ولحفيداتٍ سَيَأتينَ بعدها بزمنٍ لا تَتخيّلُه.

ثانياً، تُكتَبُ صفحةٌ من تاريخٍ نسائيٍّ خاصّ — تاريخٌ تَفتقدُهُ مكتباتُنا، تاريخٌ يَنبغي أن يَكون. فكلُّ صورةٍ نَلتقطُها لعروسٍ سعوديّة، اليوم، ستَكون وثيقةً يَدرسُها مؤرّخو الجمالِ والاجتماعِ بعد قرن.

ثالثاً، تَنضمُّ — دون أن تَدري ربّما — إلى قافلةٍ طويلةٍ من النساء اللواتي رَفضنَ أن يَخرجنَ من الزمن بصمت. اللواتي قُلنَ: «أنا كنتُ. ولن تُمحى».

الكاميرا، حين تَنظرُ إليها بعمق، ليست آلةً. هي ميثاقٌ. ميثاقٌ بين الإنسان والزمنِ والذاكرة. ميثاقٌ يَقول: «نَحنُ نَستحقُّ أن نَبقى». ونَحنُ في ATEMA، شَرَفُنا أن نَكون من حُرّاسِ هذا الميثاق — جيلاً بعد جيل، عروساً بعد عروس.

ذاتَ يومٍ، ستُولَدُ ابنةُ ابنتِكِ، وستَفتحُ صندوقاً قديماً في خزانةٍ، وتُخرجُ صورةً لكِ — مأخوذةً في هذه السنة، في هذه المدينة، في هذا الفستان. ستَنظرُ إليكِ، وتَقولُ بنبرةٍ هادئة: «هذه جدّتي. كانت جميلة».

هذه اللحظة، التي لم تَحدُث بعد، هي السببُ الذي من أجله نَعمل.$body$,

  $body$In 1839, a man in Paris looked into a small wooden box atop three legs, and announced to the world: "Behold — I have caught the light in my own hands." His name was Louis Daguerre. What he did not know in that moment was that he had not merely invented a device — he had rewritten what it meant to be human.

Before that moment, if you wanted your face to outlive you, you had to be a queen, or a queen's wife, or the daughter of a wealthy man who could pay a painter to spend six months rendering you in oil. Heavy canvases, ruinously expensive, hung in palaces — while the faces of millions of women, across centuries, went into the earth without anyone knowing them, not even their own granddaughters.

Then came the camera. And within a single generation, a woman in Cairo, or in Aleppo, or in Jubail, could sit before a lens and say: "I am here. I was here. And here is the proof." This was not a technical advance. It was a silent revolution against time itself.

Families began to own albums. Grandmothers came to know what their own grandmothers looked like. War ceased to be a story told by the victors — and became faces looking out from a field, until we could no longer lie to ourselves about it. Fashion, art, love, travel, even medicine — all of them transformed, because we could now keep what we saw.

And most beautiful of all: photography gave women a voice they had been missing. In the 1920s, in Cairo and Beirut, the first women carried small cameras and photographed other women — in their homes, in their bathhouses, in their private gatherings. Those photographs, which historians marvel at today, would not exist had every photographer been a man. The moments would have stayed behind closed doors, hidden in modesty.

We at ATEMA know that we are part of that chain. We know that every time a Saudi woman sits before my camera, three things happen at once:

First, her face is kept — for herself, for her children, and for granddaughters who will arrive in a time she cannot yet imagine.

Second, a page of a particular women's history is written — a history our libraries still lack, a history that ought to exist. Every photograph we take of a Saudi bride today will, a century from now, be a document studied by historians of beauty and society.

Third, she joins — perhaps without knowing it — a long caravan of women who refused to leave time in silence. Who said: "I was. And I will not be erased."

The camera, when you look at it deeply, is not a machine. It is a covenant. A covenant between human, time, and memory. A covenant that says: "We deserve to remain." And at ATEMA, our honour is to be one of the keepers of that covenant — generation after generation, bride after bride.

One day, your daughter's daughter will be born, and she will open an old box in a cupboard, and she will take out a photograph of you — taken in this year, in this city, in this gown. She will look at you, and say softly: "This is my grandmother. She was beautiful."

That moment, which has not yet happened, is the reason we work.$body$,

  '/photos/F41A818D-D3EF-419E-A002-DC76C76BF59D.JPG',
  true,
  '2026-05-23 10:30:00+03'
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
select '— Journal posts (newest first) —' as section;
select slug, title_ar, published_at
  from public.journal_posts
 order by published_at desc;
