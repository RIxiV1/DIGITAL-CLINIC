/**
 * Panel-level educational content for the "Learn More" modal on the
 * Recommended Tests page. Plain English, no jargon — keyed by the
 * panel category id from the recommendation engine in `tests.ts`.
 */

import type { LearnMore } from './markerInfo';

const testInfo: Record<string, LearnMore> = {
  foundational: {
    measures:
      'The six numbers every man should know: testosterone (total and the active part), the protein that carries it (SHBG), Vitamin D, the thyroid signal (TSH), and morning blood sugar. Done first thing in the morning, on an empty stomach — that’s when testosterone is naturally highest.',
    importance:
      'This is your starting line. If you only ever run one set of tests, run these. Without them, every other test result is just numbers floating in space. With them, you have a baseline you can compare against for the rest of your life.',
    hormonalImpact:
      'These six numbers tell you whether your testosterone is low, why it might be low, and whether something else — your thyroid, your blood sugar, your Vitamin D — is the actual cause. You can’t address one without checking the others.',
    improve: [
      'Just getting tested is the action — you can’t improve what you haven’t measured',
      'Always test in the morning, before eating, so re-tests are comparable',
      'Re-test in 12 weeks if you change something big — your sleep, training, diet, or a supplement',
    ],
  },

  hormonal: {
    measures:
      'The signals from your brain to your testes (LH and FSH), the other hormones in the system (prolactin, estrogen, DHT), and your stress hormones (cortisol, DHEA). Basically, everything that talks to testosterone or shuts it down.',
    importance:
      'These tell you WHERE the problem is. Low testosterone with high signals from the brain means your testes are tired. Low testosterone with low signals means your brain isn’t pushing hard enough. High prolactin or cortisol means something else is shutting the whole system down. You can’t address what you haven’t found.',
    hormonalImpact:
      'Your brain talks to your testes through a chain of signals. This panel measures every step in that chain — plus your stress hormones, which interrupt it constantly. The quickest path to a real diagnosis when something’s clearly off but the basics didn’t explain why.',
    improve: [
      'Sleep 7–8 hours — most hormone repair happens during deep sleep',
      'Lift weights 2–3 times a week — moves testosterone up, stress down',
      'Tackle the things stressing you out — sleep apnea, money, relationships — at the source',
      'Lose belly fat — it directly lowers testosterone and raises estrogen',
      'Treat an underactive thyroid first, if you have one — it drags everything else down',
    ],
  },

  metabolic: {
    measures:
      'Long-term blood sugar (HbA1c), insulin levels, how well your body listens to insulin (HOMA-IR), cholesterol and fats, and a growth-hormone marker (IGF-1). Catches problems years before a standard sugar test would.',
    importance:
      'When your body stops listening to insulin, your testosterone drops too. It’s one of the biggest hidden causes of low energy and low sex drive in men today — and you can catch it years before it becomes diabetes. The earlier you spot it, the easier it is to reverse.',
    hormonalImpact:
      'Sugar control and hormone health aren’t separate problems. Belly fat actively converts your testosterone into estrogen, so the more you carry, the lower your T runs. Fixing your insulin often raises testosterone more than any hormone treatment.',
    improve: [
      'Walk for 10 minutes after every meal — the single biggest lever',
      'Strength training 2× a week — muscle absorbs sugar instead of leaving it in your blood',
      'Cut sugary drinks — sweet chai, soda, juice, sweetened coffee',
      'Eat protein first at every meal — protein and veg before rice or roti',
      'Eat dinner earlier — finishing by 7 PM noticeably lowers morning sugar',
    ],
  },

  nutritional: {
    measures:
      'Iron stores (ferritin), Vitamin B12, zinc, and magnesium — the four shortages that quietly cause symptoms that LOOK hormonal. Tired? Foggy? Hair falling? Sleeping badly? It’s often one of these, not your hormones.',
    importance:
      'Cheap to check, often manageable. Many men get treated for low testosterone or thyroid problems when the actual cause is one of these four shortages. Rule these out before assuming the problem is hormonal.',
    hormonalImpact:
      'You need Vitamin D to make testosterone. You need zinc to make testosterone. You need iron for your thyroid to work. You need magnesium to handle stress. Cover the basics first — a lot of "hormone problems" ease once you do.',
    improve: [
      'Vitamin D: get sunlight + take a supplement if needed; aim for a level between 40 and 80',
      'B12: take methylcobalamin if you’re vegetarian or your level is on the low side',
      'Iron: pair plant iron with Vitamin C; don’t drink tea with iron-rich meals',
      'Zinc: 15 mg a day with food if low; otherwise oysters, red meat, pumpkin seeds',
      'Magnesium: glycinate form, 200–400 mg before bed — also helps you sleep',
    ],
  },

  screening: {
    measures:
      'A full thyroid check (T3 and T4 on top of TSH), a general blood count, and a prostate marker (PSA, for men 40+). Routine checks that catch problems before symptoms show up.',
    importance:
      'These aren’t for addressing what’s wrong — they’re for spotting what could go wrong before it does. Catches thyroid problems the basic test misses, blood disorders, and early prostate changes.',
    hormonalImpact:
      'Thyroid problems and low testosterone feel almost identical — tired, slow, low sex drive — but the approach is different for each. Anaemia (from any cause) also drags testosterone down. PSA gives you a personal baseline for prostate health.',
    improve: [
      'These tests are early-warning systems — the action is just running them',
      'Once a year is right for most men over 40',
      'For PSA: skip sex for 48 hours before the draw (it temporarily raises the reading)',
      'For thyroid: enough iodine and selenium in your diet keeps it running smoothly',
    ],
  },

  fertility: {
    measures:
      'A sperm test — a separate appointment, not a blood draw. Measures how many sperm you have, how well they swim, what shape they’re in, and how much fluid is there. Collected after 2–5 days of no sex.',
    importance:
      'Fertility runs on two parallel tracks: the hormones telling your testes what to do, and the actual sperm those testes produce. Both can look fine while the other is broken — which is why a real fertility check needs both.',
    hormonalImpact:
      'Inside your testes, testosterone levels are much higher than in your blood — and that’s what makes sperm. Anything that shuts down the brain signals (including taking testosterone as therapy) shuts down sperm production. The good news: it’s usually reversible.',
    improve: [
      'Avoid heat — saunas, hot tubs, laptop on your lap, tight underwear',
      'Antioxidants — Vitamin C, E, zinc, selenium, CoQ10 — help sperm quality',
      'Stop smoking and cut alcohol',
      'If you’re on testosterone therapy and want to conceive, talk to a doctor about switching to hCG or clomiphene — they restart sperm production',
      'Sperm take about 74 days to make — anything you change today shows up in a test 3 months from now',
    ],
  },
};

export function getTestInfo(id: string): LearnMore | undefined {
  return testInfo[id];
}
