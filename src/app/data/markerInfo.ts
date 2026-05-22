/**
 * Per-marker educational content for the "Learn More" modal on the
 * Recommended Tests page. Keyed by the canonical marker name as it appears
 * in `tests.ts` `includes[].name`. Composite entries (e.g. "LH & FSH",
 * "ALT, AST", "Creatinine, eGFR") get a single combined entry because the
 * markers are interpreted together.
 */

export type LearnMore = {
  /** 2–3 sentences, plain English: what this number actually is */
  measures: string;
  /** Why a healthy reader should care, in everyday terms */
  importance: string;
  /** How it interacts with the HPG axis / endocrine system */
  hormonalImpact: string;
  /** 3–5 actionable bullets — specific, not aspirational */
  improve: string[];
};

export const markerInfo: Record<string, LearnMore> = {
  /* -------------------------------- Hormonal -------------------------------- */

  'Total Testosterone': {
    measures:
      'The total amount of testosterone in your blood — both the small free fraction your body can use and the much larger portion bound to proteins. Best measured between 8–10 AM, fasted, when levels naturally peak.',
    importance:
      'Drives energy, mood, libido, muscle, bone density, fat distribution, and sharp thinking. When it’s low, you usually feel it across all of these at once — and most men don’t connect the dots until they see a number.',
    hormonalImpact:
      'This is the end product of your entire HPG axis: brain (GnRH) → pituitary (LH) → testes (testosterone). A single low Total T number can mean the testes are underperforming, the pituitary signal is weak, or something downstream — sleep, stress, obesity, alcohol — is suppressing the whole loop.',
    improve: [
      'Sleep 7–8 hours — most testosterone is produced during deep sleep',
      'Lift heavy 2–3× a week — compound lifts (squat, deadlift, press) move T the most',
      'Cut alcohol — even moderate intake suppresses production for 24–48 hours',
      'Get Vitamin D into the optimal range (40–80 ng/mL)',
      'Lose belly fat if applicable — fat tissue actively converts T into estrogen',
    ],
  },

  'Free Testosterone': {
    measures:
      'The 1–3% of testosterone that isn’t bound to a protein and is biologically active — what your cells can actually use. Reported in pg/mL.',
    importance:
      'You can have a normal Total T number and still feel low-T symptoms if your free portion is low. That’s because SHBG (a carrier protein) locks most of the hormone away. Free T is the closer-to-truth measure of what your body has to work with.',
    hormonalImpact:
      'Free T reflects the gap between production (testes) and binding (SHBG, mostly liver-driven). Low free T with normal total T usually means high SHBG — common in older men, very lean men, and men on certain medications.',
    improve: [
      'Same levers as Total T: sleep, strength training, alcohol, Vitamin D, body composition',
      'If SHBG is the bottleneck, eat more protein and carbs, address overtraining or undereating, and get your thyroid checked',
      'Boron (3–6 mg/day) lowers SHBG modestly in small studies',
    ],
  },

  SHBG: {
    measures:
      'Sex Hormone Binding Globulin — the protein your liver makes that binds to testosterone and estrogen in blood, taking them out of circulation. Healthy 10–57 nmol/L.',
    importance:
      'SHBG decides how much of your testosterone is actually usable. High SHBG = more T locked up = lower free T = symptoms even when total T looks fine. Very low SHBG often signals insulin resistance.',
    hormonalImpact:
      'SHBG is the brake on hormonal availability. It rises with age, low calories, low carbs, and hyperthyroidism — and falls with insulin resistance, obesity, and fatty liver. Reading SHBG alongside total + free T tells you whether the problem is production or availability.',
    improve: [
      'If SHBG is high: eat more protein and carbs, address overtraining or undereating, check thyroid',
      'If SHBG is low: work on insulin sensitivity — walks after meals, less sugar, strength training, address fatty liver',
      'Both directions improve when sleep and stress get better',
    ],
  },

  'LH & FSH': {
    measures:
      'Luteinizing Hormone and Follicle-Stimulating Hormone — the two signals your pituitary gland sends to the testes. LH triggers testosterone production; FSH drives sperm production. Reported together because they’re always interpreted together.',
    importance:
      'These tell you WHERE in the HPG axis the problem sits. Low T with high LH/FSH = the testes are failing (primary hypogonadism). Low T with low/normal LH/FSH = the pituitary signal itself is weak (secondary). Two completely different diagnoses, two different treatments.',
    hormonalImpact:
      'LH and FSH are the middle stage of the HPG axis. They sit between hypothalamic GnRH and testicular T / sperm output. Reading them with Total T tells the whole pathway in a single snapshot.',
    improve: [
      'These aren’t numbers you "improve" directly — they’re the diagnostic compass',
      'If abnormal, the fix sits upstream or downstream: pituitary imaging, weight loss, treat sleep apnea, address opioid/alcohol use',
      'Talk to an endocrinologist before any hormone-therapy decision',
    ],
  },

  LH: {
    measures:
      'Luteinizing Hormone — the pituitary signal that tells your testes to make testosterone. Reported in mIU/mL. Best drawn in the morning alongside Total T.',
    importance:
      'LH is the diagnostic compass. Low T with HIGH LH = your testes are struggling to respond (primary hypogonadism). Low T with LOW or normal LH = the signal itself is weak (secondary, often pituitary or lifestyle-driven). Two completely different diagnoses, two different treatments.',
    hormonalImpact:
      'LH is the middle stage of the HPG axis — pituitary output that drives testicular testosterone production. Estrogen, prolactin, and obesity all suppress LH. Reading it alongside T tells you whether the brain or the testes is the bottleneck.',
    improve: [
      'Not directly "improvable" — it’s an indicator',
      'If suppressed by high estrogen or prolactin, address those first',
      'Weight loss + better sleep often raise LH back to normal',
      'Pituitary imaging if persistently low alongside low T',
    ],
  },

  FSH: {
    measures:
      'Follicle-Stimulating Hormone — the pituitary signal that drives sperm production. Reported in mIU/mL.',
    importance:
      'FSH is the fertility-side compass. Elevated FSH with low sperm count signals testicular failure. Low FSH usually points at the pituitary. Always read alongside LH and a semen analysis.',
    hormonalImpact:
      'FSH and LH share the same pituitary axis. Most things that suppress LH also suppress FSH — obesity, steroid use, poor sleep, chronic stress. Sperm production needs adequate FSH plus adequate testosterone in the testis itself.',
    improve: [
      'Address whatever is suppressing the pituitary axis — weight, sleep, alcohol, exogenous steroids',
      'Zinc and Vitamin D adequacy support spermatogenesis',
      'Heat exposure (saunas, long laptop-on-lap sessions) reduces output — minimise',
      'If considering fertility treatment, FSH + LH + semen analysis is the starting triad',
    ],
  },

  Prolactin: {
    measures:
      'A hormone made by the pituitary gland. Usually associated with breastfeeding in women, but men make it too. Healthy <15 ng/mL. Reported in ng/mL.',
    importance:
      'Elevated prolactin in men shuts down the entire testosterone system — it suppresses LH/FSH, which suppresses T, which causes low libido, ED, fatigue, and infertility. Often missed because doctors don’t routinely check it in men.',
    hormonalImpact:
      'High prolactin is one of the most common reversible causes of low T. The fix is usually identifying the cause (medication, pituitary microadenoma, chronic stress, hypothyroidism) and treating that. Once prolactin normalises, T usually follows on its own.',
    improve: [
      'Avoid blood draws right after sexual activity or strenuous exercise — both transiently raise it',
      'Review any medications: antipsychotics, antidepressants, and some anti-nausea drugs can raise prolactin',
      'Treat hypothyroidism if present — low thyroid raises prolactin',
      'If consistently elevated, a pituitary MRI is the next step — small benign prolactinomas are common and very treatable',
    ],
  },

  DHT: {
    measures:
      'Dihydrotestosterone — a more potent form of testosterone, converted by an enzyme called 5-alpha-reductase. Reported in ng/dL.',
    importance:
      'DHT is the main driver of male pattern hair loss. It’s also crucial for prostate growth and male sexual function in development. Genetic sensitivity matters more than absolute level — some men go bald at "normal" DHT.',
    hormonalImpact:
      'DHT is downstream of testosterone. When T → DHT conversion is high, you get hair loss and prostate enlargement. Drugs like finasteride block the conversion enzyme, which preserves hair at the cost of slightly lower libido for some men.',
    improve: [
      'Saw palmetto extract (320 mg/day) modestly inhibits 5-alpha-reductase',
      'Topical minoxidil targets follicles directly without affecting whole-body DHT',
      'Finasteride 1 mg/day — strongest evidence for hair retention; discuss side effects with a doctor first',
      'Lifestyle (zinc, Vitamin D, lower insulin) supports natural balance',
    ],
  },

  'Cortisol (AM)': {
    measures:
      'Your stress hormone, measured first thing in the morning when it naturally peaks. Healthy 6–23 µg/dL between 6–8 AM. Reported in µg/dL.',
    importance:
      'Cortisol that’s chronically high (or weirdly low — burned out) is one of the strongest disruptors of testosterone, sleep, mood, and metabolic health. Catching it here lets you address the stress driver before it tanks everything else.',
    hormonalImpact:
      'Cortisol and testosterone are inversely linked — chronic high cortisol suppresses T directly and via the pituitary. The brain prioritises survival over reproduction. Cortisol also worsens insulin resistance and disrupts the thyroid axis.',
    improve: [
      'Sleep 7–8 hours — single biggest cortisol-lowering lever',
      'Cut caffeine after 2 PM — extends cortisol into the evening',
      'Daily walks outdoors — sunlight helps reset the cortisol rhythm',
      'Strength training (not endurance) — endurance work raises cortisol; lifting lowers chronic levels',
      'Address the actual stressor — sleep apnea, chronic financial stress, undertreated anxiety — bigger leverage than any supplement',
    ],
  },

  'DHEA-S': {
    measures:
      'Dehydroepiandrosterone sulfate — the most abundant hormone in your body, produced by the adrenal glands. Acts as the precursor pool the body draws from to make testosterone and estradiol. Reported in µg/dL.',
    importance:
      'DHEA-S is your body’s stress buffer. It rises in your 20s, peaks around 30, then steadily declines. Chronic stress burns through it faster. Low DHEA-S in your 30s or 40s is a sign your stress system is depleted.',
    hormonalImpact:
      'DHEA-S sits at the top of the steroid hormone cascade — it can be converted into testosterone or estradiol depending on what the body needs. When DHEA-S is low and cortisol is high, you’re in the "burnt out" pattern: stressed but lacking the resilience hormones to handle it.',
    improve: [
      'Sleep — DHEA-S is restored during deep sleep',
      'Strength training (not chronic cardio) raises DHEA-S',
      'Address chronic stress at the source',
      'Some men benefit from short DHEA supplementation (25–50 mg/day) — discuss with a doctor; not casual',
    ],
  },

  'IGF-1': {
    measures:
      'Insulin-like Growth Factor 1 — the main mediator of growth hormone’s effects in the body. A stable proxy for growth hormone status because GH itself fluctuates too fast to measure usefully. Reported in ng/mL; age-adjusted reference ranges.',
    importance:
      'IGF-1 declines steadily after age 30 — that decline tracks with the loss of muscle, recovery, and skin/connective tissue quality men associate with "getting older." Catching the trend matters more than any single value.',
    hormonalImpact:
      'Growth hormone and IGF-1 interact with the HPG axis at every level. Low IGF-1 worsens insulin sensitivity and lowers testosterone bioavailability. The same lifestyle that supports T (sleep, training, lower body fat) also supports IGF-1.',
    improve: [
      'Sleep — most growth hormone is released during deep sleep',
      'Strength training, especially heavy compound lifts',
      'Adequate protein intake (1.6–2.0 g/kg)',
      'Avoid excess simple carbs late in the day — they blunt the nighttime GH pulse',
      'Don’t chase exogenous GH — risks outweigh benefits unless you have measured deficiency',
    ],
  },

  Zinc: {
    measures:
      'A trace mineral essential for testosterone production, immune function, hair growth, and over 300 enzyme reactions. Healthy 70–150 µg/dL. Reported in µg/dL.',
    importance:
      'Zinc deficiency directly lowers testosterone — small clinical trials show supplementation in deficient men raises T meaningfully. Also accelerates hair loss when low. Common in vegetarians and heavy sweaters.',
    hormonalImpact:
      'Zinc is a cofactor for the enzymes that make testosterone in the testes and that convert T → DHT. It also moderates aromatase (the T → estradiol enzyme). Adequate zinc keeps the whole male hormonal system running cleanly.',
    improve: [
      'Red meat, shellfish (especially oysters), pumpkin seeds, lentils',
      'If supplementing: 15–30 mg/day with food. Higher doses long-term can suppress copper',
      'Avoid taking zinc + iron + calcium in the same meal — they compete for absorption',
      'Vegetarians benefit most from a daily 15 mg dose',
    ],
  },

  'Magnesium (RBC)': {
    measures:
      'Magnesium measured inside red blood cells — a more accurate picture of tissue magnesium than the standard serum test, which can read normal while you’re actually depleted. Healthy 4.2–6.8 mg/dL.',
    importance:
      'Magnesium is the sleep + stress + muscle mineral. Deficiency causes restless sleep, leg cramps, anxiety, low energy, and disrupted blood sugar. Most men are short of it without realising — the standard serum test misses it.',
    hormonalImpact:
      'Magnesium is required for over 300 reactions including testosterone biosynthesis. It also regulates cortisol release and supports thyroid function. Low magnesium is associated with lower free testosterone in men.',
    improve: [
      'Pumpkin seeds, dark chocolate, leafy greens, almonds',
      'Magnesium glycinate 200–400 mg before bed — improves sleep + recovery',
      'Avoid magnesium oxide (poorly absorbed) and magnesium citrate (laxative effect)',
      'Re-test in 8 weeks of supplementation — RBC magnesium moves slowly',
    ],
  },

  CBC: {
    measures:
      'Complete Blood Count — measures red cells, white cells, platelets, and haemoglobin. The baseline blood test every adult should have on file.',
    importance:
      'Catches anaemia (low red cells), infection or inflammation (high white cells), and clotting issues (platelets). All three mimic or worsen hormonal symptoms — anaemia especially causes fatigue and brain fog that look exactly like low T or low thyroid.',
    hormonalImpact:
      'Testosterone stimulates red blood cell production — men on TRT often see haematocrit rise. Conversely, anaemia from any cause can suppress testosterone secondarily. A CBC alongside hormones tells you whether the fatigue is hormonal or hematologic.',
    improve: [
      'Most CBC issues need investigation, not lifestyle change — the value is in catching them',
      'Anaemia: address iron / B12 / folate / gut absorption',
      'Inflammation: identify the source (infection, autoimmune, undiagnosed condition)',
      'If on TRT, monitor haematocrit and donate blood if it climbs above 52%',
    ],
  },

  PSA: {
    measures:
      'Prostate-Specific Antigen — a protein made by the prostate gland that leaks into blood. Healthy <4 ng/mL, but trend over time matters more than absolute value. Reported in ng/mL.',
    importance:
      'PSA is the standard prostate screening tool from age 40 onward. Catches prostate enlargement and (more importantly) prostate cancer early, when it’s most treatable. A baseline in your 40s gives you a comparison point for the rest of your life.',
    hormonalImpact:
      'PSA rises with DHT levels and with prostate growth — both of which testosterone supports. TRT can raise PSA slightly; that’s expected, not a contraindication. The trajectory matters: a fast-rising PSA (even at "normal" values) deserves urological workup.',
    improve: [
      'Annual PSA from age 45 (40 if family history of prostate cancer)',
      'Avoid sexual activity for 48 hours before the draw — temporarily raises PSA',
      'Diet rich in tomatoes (lycopene) and cruciferous vegetables associates with lower prostate cancer risk',
      'Maintain healthy body weight — obesity is a stronger prostate cancer risk than most realise',
    ],
  },

  'Semen Analysis': {
    measures:
      'A separate laboratory test (not a blood draw) that measures sperm count, motility (how well they move), morphology (shape), and volume. Collected after 2–5 days of abstinence.',
    importance:
      'The output side of the fertility equation. Hormones (LH, FSH, T) tell you whether the signals are right; semen analysis tells you whether the production is working. Both can be normal while the other is off — that’s why fertility workups need both.',
    hormonalImpact:
      'Sperm production depends on testosterone INSIDE the testes (much higher than blood T) plus FSH stimulation. Anything that suppresses LH/FSH — including exogenous testosterone use — suppresses sperm production. A man on TRT will usually have very low sperm counts.',
    improve: [
      'Avoid heat: saunas, hot tubs, long sessions with laptop on lap, tight underwear',
      'Stop smoking and limit alcohol — both reduce sperm count and motility',
      'Antioxidant-rich diet — Vitamin C, E, zinc, selenium, CoQ10 all support sperm quality',
      'If trying to conceive while on TRT — switch to hCG or clomiphene to restart sperm production (with a doctor)',
      'Sperm production takes ~74 days — changes made today show up in a re-test 3 months later',
    ],
  },

  'Lipid Panel': {
    measures:
      'A bundled blood test measuring Total Cholesterol, LDL ("bad"), HDL ("good"), Triglycerides, and increasingly Apo-B. The standard cardiovascular risk panel. Drawn fasting.',
    importance:
      'Heart disease is India’s #1 cause of death, and the lipid panel is the most actionable single piece of cardiac risk information you can have. Every number on it responds visibly to lifestyle within 8–12 weeks.',
    hormonalImpact:
      'Lipid health and hormonal health are linked. The same lifestyle that improves lipids (movement, sleep, less alcohol, less refined carbs) improves testosterone. Cholesterol is also the raw material your body uses to make testosterone — so very low cholesterol can impair hormone production.',
    improve: [
      'Soluble fibre (oats, beans, psyllium) drops LDL fastest',
      'Daily 30-minute walk after dinner lowers triglycerides over weeks',
      'Two fistfuls of nuts daily for the long game',
      'Strength training raises HDL',
      'Re-test in 12 weeks if making changes — lipids respond visibly faster than weight does',
    ],
  },

  Estradiol: {
    measures:
      'The estrogen your body makes — yes, men make it too. Mostly converted from testosterone by an enzyme called aromatase, much of it in fat tissue. Reported in pg/mL.',
    importance:
      'A small amount of estradiol is healthy and necessary in men — for bone density, mood, libido, and joint health. Too much causes fatigue, water retention, gynecomastia, emotional flatness. Too little causes joint pain, low libido, brittle bones.',
    hormonalImpact:
      'Estradiol feeds back to the brain and pituitary and suppresses LH, which suppresses testosterone. High estradiol can drive low T even when raw production is fine. That’s why low T + high body fat is a self-reinforcing loop.',
    improve: [
      'Lose belly fat — fat tissue is the main site where T converts to estradiol',
      'Limit alcohol — alcohol increases aromatase activity',
      'Zinc adequacy (15–25 mg/day) supports natural aromatase regulation',
      'Address insulin resistance — estradiol and insulin track together',
    ],
  },

  /* -------------------------------- Metabolic -------------------------------- */

  HbA1c: {
    measures:
      'Glycated haemoglobin — your average blood sugar reading over the last 3 months. Healthy under 5.7%, pre-diabetic 5.7–6.4%, diabetic 6.5+. One of the most informative single numbers in any health panel.',
    importance:
      'Where fasting glucose shows one morning, HbA1c shows the trend. Catching pre-diabetes here gives you years of runway before complications start.',
    hormonalImpact:
      'Insulin resistance — which is what rising HbA1c signals — directly suppresses testosterone. The relationship is so tight that improving HbA1c alone often improves T without any hormonal intervention.',
    improve: [
      'Walk for 10 minutes after each meal — single biggest lever',
      'Strength training 2× a week — more muscle = better insulin sensitivity',
      'Cut sugar in drinks (chai, juice, soda) — fastest path down',
      'Eat protein and vegetables before carbs at each meal',
      'Sleep enough — one bad night reduces insulin sensitivity by ~25% the next day',
    ],
  },

  'Fasting Glucose': {
    measures:
      'Your blood sugar after 8–12 hours of not eating. Healthy under 100 mg/dL, pre-diabetic 100–125, diabetic 126+.',
    importance:
      'A snapshot — less informative than HbA1c on its own but cheap, and it catches morning insulin resistance early. Persistently borderline values point at insulin resistance years before HbA1c crosses the line.',
    hormonalImpact:
      'Same as HbA1c — chronically elevated glucose drives insulin resistance, which suppresses testosterone and increases the conversion of T to estradiol via belly fat.',
    improve: [
      'Last meal earlier — dinner before 7 PM lowers fasting glucose noticeably',
      'Walk after dinner specifically',
      'Caffeine in the morning raises it transiently — test without coffee',
      'Address sleep apnea if applicable — large effect',
    ],
  },

  'Fasting Insulin': {
    measures:
      'How much insulin your pancreas is making in the fasted state. Healthy 2–8 µIU/mL, ideal 2–5. Reported in µIU/mL.',
    importance:
      'This is the earliest metabolic warning marker — often elevated for 5–10 years before HbA1c moves. High insulin with normal sugar means your pancreas is working overtime to keep up. That’s a problem in motion.',
    hormonalImpact:
      'High insulin suppresses SHBG and increases aromatase (more T → estradiol). The result: lower free T plus higher estradiol — a hormonal bad mix that perpetuates the belly fat that started the problem.',
    improve: [
      'Walks after meals + strength training — same levers as HbA1c',
      'Protein at breakfast (≥30g) blunts the insulin curve all day',
      'Berberine (500 mg 2–3× daily) lowers fasting insulin — discuss with a doctor first',
      'Time-restricted eating (10-hour feeding window) helps for many people',
    ],
  },

  'HOMA-IR': {
    measures:
      'Homeostatic Model Assessment of Insulin Resistance — calculated from your fasting glucose and fasting insulin together. A single score for "how insulin-resistant are you?" Healthy under 1.0, borderline 1.0–2.0, insulin-resistant 2.0+.',
    importance:
      'Combines the two numbers into one easy interpretation. A HOMA-IR of 2.5 is metabolically meaningful even when HbA1c still looks fine. It’s the early-warning composite.',
    hormonalImpact:
      'Insulin resistance is hormonal damage. It suppresses testosterone, raises estradiol via belly fat, raises cortisol through poor sleep, and disrupts thyroid signalling. Almost every other hormonal marker is downstream of it.',
    improve: [
      'Every move that lowers fasting insulin lowers HOMA-IR',
      'Track this every 3 months when working on metabolic health — it moves before weight does',
    ],
  },

  /* --------------------------------- Lipid --------------------------------- */

  'Total Cholesterol': {
    measures:
      'All cholesterol particles in your blood combined: LDL + HDL + ~20% of triglycerides. Useful, but the breakdown matters more than the total.',
    importance:
      'A high total with high HDL and low triglycerides is much less concerning than a "normal" total with low HDL and high triglycerides. Always read it with the LDL, HDL, and triglyceride breakdown.',
    hormonalImpact:
      'Cholesterol is the raw material your body uses to make testosterone, cortisol, and estrogen. Extremely low total cholesterol (under 130) can actually impair hormone production. Most men’s problem is too much LDL, not too little total.',
    improve: [
      'Replace refined carbs with whole grains and legumes',
      'Soluble fibre (oats, psyllium, beans) directly lowers LDL',
      'Switch saturated fats (butter, ghee, coconut) for monounsaturated (olive, mustard)',
      'Strength training raises HDL',
      'Re-test in 12 weeks — lipids respond faster than most markers',
    ],
  },

  LDL: {
    measures:
      'Low-Density Lipoprotein cholesterol — the "bad" cholesterol that deposits in artery walls and drives atherosclerosis. Target under 100 mg/dL for general men, under 70 if cardiac risk is high.',
    importance:
      'The single strongest predictor of heart-attack risk we have. Heart disease is India’s #1 cause of death, and LDL is the most modifiable lever. The earlier you lower it, the more years of artery health you stack up.',
    hormonalImpact:
      'LDL isn’t a hormone, but the same lifestyle that raises it (refined carbs, alcohol, sedentary days) also raises insulin and estradiol and lowers T. Lower LDL almost always means better T as a side effect.',
    improve: [
      'Oats or millets for breakfast — soluble fibre is the most direct LDL drop',
      'Daily 30-minute walk after dinner',
      'Cut deep-fried, ultra-processed snacks (namkeen, biscuits, packaged sweets)',
      'Two fistfuls of nuts daily (almonds, walnuts) — clinically lowers LDL',
      'If lifestyle alone doesn’t move it in 12 weeks, ask about statins',
    ],
  },

  HDL: {
    measures:
      'High-Density Lipoprotein cholesterol — the "good" cholesterol that pulls LDL out of artery walls and back to the liver. Healthy above 40 mg/dL, ideal above 50.',
    importance:
      'A low HDL with normal LDL is still a heart-risk signal. HDL also tracks loosely with hormonal health — men with very low HDL often have low T and metabolic issues underneath.',
    hormonalImpact:
      'HDL rises with testosterone-supporting habits (strength training, healthy fats, alcohol moderation, lower body fat) — so it’s a useful proxy that those habits are actually landing.',
    improve: [
      'Strength train 3× a week — single biggest HDL raiser',
      'Healthy fats (olive oil, nuts, fatty fish) — not low-fat diets',
      'Lose visceral fat specifically',
      'Stop smoking if applicable — immediate HDL bump',
    ],
  },

  Triglycerides: {
    measures:
      'Fats circulating in your blood, mostly converted by your liver from carbs and alcohol. Healthy under 150 mg/dL, ideal under 100.',
    importance:
      'High triglycerides are usually the FIRST lipid number to rise when metabolic health declines — before LDL, before HbA1c. Catching them early is the easiest fix on the panel.',
    hormonalImpact:
      'Triglycerides reflect insulin resistance and excess carb/alcohol intake. Both directly suppress testosterone. High triglycerides almost always travel with low free T.',
    improve: [
      'Cut sugar in drinks and reduce alcohol — fastest move',
      'Reduce refined carbs (white rice, bread, biscuits)',
      'Omega-3 (1–2g EPA+DHA daily) — strong evidence',
      'Walk after meals',
      'Fix sleep — sleep deprivation directly raises triglycerides',
    ],
  },

  'Apo-B': {
    measures:
      'Apolipoprotein B — one Apo-B protein per "bad" cholesterol particle (LDL, VLDL, IDL). It counts the actual number of artery-damaging particles, which LDL on its own can underestimate.',
    importance:
      'A more accurate heart-risk predictor than LDL alone. Two men with the same LDL can have very different Apo-B and very different risk. Cardiologists increasingly treat Apo-B as the best single number.',
    hormonalImpact:
      'Same downstream story as LDL — insulin resistance and inflammation raise Apo-B. Better metabolic health → lower Apo-B → better hormonal environment.',
    improve: [
      'Identical to LDL improvements — soluble fibre, less refined carbs, more movement',
      'Tracks better than LDL when you’re making changes — retest in 12 weeks to see real progress',
    ],
  },

  /* --------------------------------- Thyroid --------------------------------- */

  TSH: {
    measures:
      'Thyroid-Stimulating Hormone — the signal from your pituitary to your thyroid gland. Healthy 0.4–4.0 mIU/L, optimal 1.0–2.5 for most men.',
    importance:
      'The single most sensitive thyroid screen. A high TSH means the thyroid is struggling to keep up. A low TSH means it’s overworking. Both mimic low-T symptoms almost exactly — fatigue, weight changes, low mood, brain fog.',
    hormonalImpact:
      'Thyroid and testosterone interact at every level. Low thyroid lowers free T and SHBG; high thyroid raises SHBG and lowers free T. Any man with "low T symptoms" should rule out thyroid first.',
    improve: [
      'Iodine adequacy (150 µg/day) from iodised salt, dairy, seafood',
      'Selenium (200 µg/day from brazil nuts) supports T4 → T3 conversion',
      'Manage stress — chronic cortisol suppresses thyroid function',
      'Sleep enough — thyroid hormones are released cyclically with sleep',
    ],
  },

  'Free T3': {
    measures:
      'Triiodothyronine, the active thyroid hormone your cells actually use. Free T3 is the unbound, bioavailable fraction. Reported in pg/mL.',
    importance:
      'T3 is what does the work — metabolism, energy, body temperature. Many men have normal TSH but low free T3, especially under stress, dieting, or chronic inflammation. The number that explains "I feel cold and tired even though my thyroid is fine."',
    hormonalImpact:
      'T3 is downstream of T4 (the inactive form). Conversion happens in the liver, gut, and tissues. Cortisol, low calories, and low selenium all impair the conversion, so low T3 with normal TSH and T4 usually means a conversion problem, not a thyroid problem.',
    improve: [
      'Don’t undereat — chronic calorie restriction tanks T3',
      'Selenium and zinc both support conversion',
      'Treat any chronic gut inflammation',
      'If consistently low despite normal TSH, ask about reverse T3 — sometimes the body diverts T4 into the inactive form under stress',
    ],
  },

  'Free T4': {
    measures:
      'Thyroxine, the inactive thyroid hormone the thyroid gland produces. Free T4 is the unbound fraction. Reported in ng/dL.',
    importance:
      'T4 is the storage form — your body converts it to T3 as needed. Low free T4 usually means the thyroid itself is under-producing. Normal T4 with low T3 usually means a conversion problem.',
    hormonalImpact:
      'Free T4 is the supply line. The picture is most informative when read with TSH and free T3 together: TSH tells the signal, T4 tells production, T3 tells delivery.',
    improve: [
      'Iodine and selenium adequacy',
      'Avoid extreme low-carb diets — they suppress thyroid hormone production',
      'If autoimmune thyroid (Hashimoto’s) is suspected, address diet, stress, and gut health',
    ],
  },

  /* -------------------------------- Vitamins -------------------------------- */

  'Vitamin D (25-OH)': {
    measures:
      '25-hydroxyvitamin D — the storage form of Vitamin D in your blood. Healthy ≥30 ng/mL, optimal 40–80, deficient under 20.',
    importance:
      'Vitamin D is more like a hormone than a vitamin. Drives bone strength, immune function, mood, and — in men — testosterone production. Most Indian men are deficient because indoor work + sunscreen + skin tone = less natural production.',
    hormonalImpact:
      'Receptors for Vitamin D exist in the testes — adequate D is required for testosterone production. Indian studies show men with low D have 2.6× higher odds of low T. Fixing D often raises T as a side effect.',
    improve: [
      'Sun on bare skin (arms, legs) for 15–20 min, 3–4× a week',
      'If deficient: 60,000 IU weekly for 8 weeks under medical supervision, then maintenance',
      'Pair with Vitamin K2 and magnesium for safe absorption',
      'Re-test in 8–12 weeks — aim for 50–80 ng/mL',
      'Salmon, sardines, egg yolks add a little but rarely enough alone',
    ],
  },

  'Vitamin B12': {
    measures:
      'Cobalamin — the vitamin your nerves, brain, and red blood cells run on. Healthy ≥300 pg/mL, optimal 500+.',
    importance:
      'Deficiency causes fatigue, brain fog, low mood, tingling in hands and feet, and memory issues. Common in vegetarians since B12 comes almost exclusively from animal sources. Often the missing piece in "I’m tired and can’t think clearly."',
    hormonalImpact:
      'B12 isn’t directly hormonal, but deficiency mimics low T and low thyroid almost perfectly. A man with low B12 will get treated for everything else first if no one tests it.',
    improve: [
      'Methylcobalamin 500–1000 µg sublingual daily if deficient',
      'Eggs, dairy, fish, meat for natural sources',
      'If vegetarian, supplementation is non-negotiable — 500 µg daily',
      'Address gut absorption issues — H. pylori, low stomach acid, metformin all reduce B12 absorption',
    ],
  },

  Ferritin: {
    measures:
      'The protein that stores iron in your body — a proxy for iron reserves. Healthy 30–400 ng/mL for men, optimal 70–150.',
    importance:
      'Low ferritin causes fatigue, hair loss, low exercise tolerance, restless legs. Men generally don’t lose iron, so low ferritin points to gut bleeding, poor absorption, or a vegetarian diet without adequate intake. High ferritin can signal inflammation or, rarely, iron overload.',
    hormonalImpact:
      'Iron is required for thyroid hormone synthesis and conversion. Low ferritin causes hypothyroid-like symptoms even when TSH is normal — fatigue, cold hands, hair loss.',
    improve: [
      'Red meat, liver, eggs for heme iron',
      'Pair plant iron sources (spinach, lentils) with Vitamin C to absorb it',
      'Avoid tea/coffee within 1 hour of iron-rich meals — they block absorption',
      'If low despite diet (especially over 40), get a colonoscopy or upper-GI workup — bleeding is the usual cause',
      'Supplement 25–50 mg elemental iron, not the higher 100 mg doses that wreck digestion',
    ],
  },

  /* ------------------------------ Liver / Kidney ------------------------------ */

  'ALT, AST': {
    measures:
      'Two liver enzymes that leak into the blood when liver cells are stressed or damaged. ALT is more liver-specific; AST is also found in muscle. Healthy ALT 7–56 U/L, AST 8–48 U/L.',
    importance:
      'Even mildly elevated ALT (40+) often signals fatty liver — extremely common in men, mostly silent, and a leading hidden driver of insulin resistance and low T. Catching this early is reversible; ignoring it leads to NASH and eventually cirrhosis.',
    hormonalImpact:
      'Fatty liver disrupts SHBG production and worsens insulin resistance — both lower free testosterone. Liver health is hormonal health, more than most men realise.',
    improve: [
      'Lose visceral fat — biggest single reverser of fatty liver',
      'Cut alcohol — even moderate intake stresses the liver',
      'Reduce refined carbs and sugar — fructose specifically loads the liver',
      'Daily walks and strength training',
      'Coffee (without sugar) protects the liver — 2–3 cups daily is associated with lower NAFLD risk',
    ],
  },

  GGT: {
    measures:
      'Gamma-Glutamyl Transferase — another liver enzyme that’s very sensitive to alcohol intake and medication load. Healthy under 50 U/L.',
    importance:
      'The most sensitive marker for alcohol-related liver stress. Often the first to rise. Also elevated by certain medications (statins, antiepileptics) and fatty liver.',
    hormonalImpact:
      'Elevated GGT often travels with elevated estradiol — the liver clears estrogens, and a stressed liver clears them poorly. So high GGT often means high estradiol → low free T.',
    improve: [
      'Cut alcohol — GGT drops within 4–6 weeks of abstinence',
      'Address any medications driving it up — discuss with your doctor',
      'Same fatty-liver levers as ALT/AST',
    ],
  },

  'Creatinine, eGFR': {
    measures:
      'Creatinine is a muscle waste product your kidneys filter out. eGFR (estimated glomerular filtration rate) is calculated from creatinine to estimate how well your kidneys are filtering — healthy ≥90, mild dysfunction 60–89, concerning under 60. Reported as a pair.',
    importance:
      'A silent test — kidney problems rarely have symptoms until they’re advanced. Diabetes and high blood pressure are the two biggest drivers, and Indian men have above-average rates of both. A 5-minute test that catches a 30-year problem early.',
    hormonalImpact:
      'Kidneys produce erythropoietin (red blood cell signal) and also clear hormones. Chronic kidney decline lowers testosterone and raises prolactin via several mechanisms.',
    improve: [
      'Control blood pressure under 130/80 — biggest single lever',
      'Control blood sugar (HbA1c under 6) — second biggest',
      'Stay hydrated — 2–3L daily',
      'Avoid chronic NSAID use (ibuprofen, diclofenac) — kidney damage is dose-dependent',
      'Annual creatinine if you have diabetes, hypertension, or family history',
    ],
  },

  Urea: {
    measures:
      'Also called BUN (Blood Urea Nitrogen) — a waste product from protein breakdown that kidneys clear. Healthy 15–40 mg/dL.',
    importance:
      'A secondary kidney marker — used alongside creatinine to confirm kidney function or to spot dehydration (urea rises before creatinine when you’re dry). High protein intake also temporarily raises it.',
    hormonalImpact:
      'Not directly hormonal, but very elevated urea (advancing kidney decline) suppresses testosterone and raises prolactin.',
    improve: [
      'Hydrate — most slightly-elevated urea is just dehydration',
      'If consistent and creatinine is also elevated, address kidney health (same levers as eGFR)',
      'Very-high-protein diets can transiently raise it; not concerning unless paired with abnormal creatinine',
    ],
  },
};

/**
 * Aliases for common name variants. The biomarker catalog uses fuller
 * names ("LDL Cholesterol") while markerInfo's keys are sometimes the
 * shorthand ("LDL") because that's how clinicians say them, and the
 * combined entries ("ALT, AST") cover two markers under one key. This
 * map keeps both sides honest without duplicating content.
 */
const KEY_ALIASES: Record<string, string> = {
  'LDL Cholesterol': 'LDL',
  'HDL Cholesterol': 'HDL',
  'Total Cholesterol': 'Total Cholesterol', // identity — listed for grep-ability
  ALT: 'ALT, AST',
  AST: 'ALT, AST',
  Creatinine: 'Creatinine, eGFR',
  eGFR: 'Creatinine, eGFR',
  'Iron / Ferritin': 'Ferritin',
  'T3 / T4': 'Free T3',
  LH: 'LH', // explicit — keeps the LH & FSH combined entry as dead code
  FSH: 'FSH',
};

export function getMarkerInfo(name: string): LearnMore | undefined {
  // Direct hit first, then aliased lookup. Lets the catalog use whatever
  // name is most natural at the call site without forcing markerInfo to
  // mirror every variant.
  return markerInfo[name] ?? markerInfo[KEY_ALIASES[name] ?? ''];
}
