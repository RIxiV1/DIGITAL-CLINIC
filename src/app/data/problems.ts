export type Problem = {
  id: string;
  title: string;
  summary: string;
  what: string;
  whyMatters: string;
  actions: { title: string; detail: string }[];
  retest: string;
  relatedMarkerIds: string[];
};

export const problems: Record<string, Problem> = {
  'low-testosterone': {
    id: 'low-testosterone',
    title: 'Low Testosterone',
    summary:
      'Your testosterone is in the low end of normal. Often felt as low drive, low energy, harder workouts, slower recovery.',
    what:
      'Testosterone is the main male hormone. It quietly powers your energy, mood, libido, muscle, and even sharp thinking. A “normal” lab range is wide — being at the bottom of normal often feels far from normal.',
    whyMatters:
      'In men, low testosterone is linked to weight gain, depressive mood, low confidence, poor sleep, and reduced sexual function. The good news: lifestyle changes lift it surprisingly well.',
    actions: [
      {
        title: 'Lift heavy, twice a week',
        detail:
          'Compound lifts — squats, deadlifts, presses — are the single biggest natural lever. Two sessions a week is enough.',
      },
      {
        title: 'Sleep 7+ hours',
        detail:
          'Most testosterone is made during deep sleep. Cutting sleep from 8 → 5 hrs drops testosterone by ~15%.',
      },
      {
        title: 'Get your Vitamin D up',
        detail:
          'Low D and low T travel together. If yours is low (it usually is), fixing it can shift both.',
      },
      {
        title: 'Cut alcohol where you can',
        detail:
          'Alcohol drops testosterone for 24–48 hrs after a heavy night. Cutting to weekends only often helps fast.',
      },
    ],
    retest: 'Re-test in 3 months. Always go in the morning — testosterone peaks then.',
    relatedMarkerIds: ['testosterone', 'free-t', 'vit-d'],
  },
  'low-vit-d': {
    id: 'low-vit-d',
    title: 'Low Vitamin D',
    summary:
      'Your vitamin D is below the healthy range. Very common, very easy to fix — but worth taking seriously.',
    what:
      'Vitamin D is more like a hormone than a vitamin. It’s involved in bone strength, immunity, mood, and hormone balance. Most Indian men are deficient because indoor work + sunscreen + skin tone = less natural production.',
    whyMatters:
      'Persistent fatigue, low mood, frequent colds, muscle aches, and even low testosterone are all linked to low D. It’s often the single biggest lever for how you feel day-to-day.',
    actions: [
      {
        title: 'Sun on bare skin, 15–20 min',
        detail:
          'Morning sun on arms and legs, a few times a week. The cheapest fix on the planet.',
      },
      {
        title: 'Supplement 60,000 IU weekly · 8 weeks',
        detail:
          'A standard correction plan. Confirm dose with a doctor — yours may differ.',
      },
      {
        title: 'Fatty fish or eggs',
        detail:
          'Salmon, sardines, and yolk pack a small but useful amount. Not enough alone — pair with sun or a supplement.',
      },
      {
        title: 'Re-test in 8–12 weeks',
        detail:
          'Aim for 50–80 ng/mL. Above that doesn’t add benefit.',
      },
    ],
    retest: 'Re-test in 8–12 weeks after supplementing.',
    relatedMarkerIds: ['vit-d', 'b12'],
  },
  'high-ldl': {
    id: 'high-ldl',
    title: 'High LDL Cholesterol',
    summary:
      'Your LDL — the cholesterol that builds up in artery walls — is higher than recommended.',
    what:
      'LDL particles carry cholesterol from the liver to your cells. When there’s too much, they slip into the wall of arteries and start a slow process of plaque buildup — the root cause of most heart attacks.',
    whyMatters:
      'Heart disease is the leading cause of death for Indian men. The earlier you lower LDL, the more years of artery health you stack up. Most of it is reversible with diet, movement, and sleep.',
    actions: [
      {
        title: 'Swap refined for whole grains',
        detail:
          'Oats and millets for breakfast, brown rice or quinoa for lunch. Soluble fibre traps LDL before it’s absorbed.',
      },
      {
        title: 'Daily 30-min walk after dinner',
        detail:
          'A short walk after meals lowers triglycerides and LDL over weeks. Easy, repeatable, effective.',
      },
      {
        title: 'Cut deep-fried, ultra-processed snacks',
        detail:
          'Namkeen, biscuits, packaged sweets. They’re the biggest hidden LDL drivers.',
      },
      {
        title: 'Re-check in 12 weeks',
        detail:
          'LDL responds within 8–12 weeks of consistent change. If it’s still high then, your doctor may suggest a statin.',
      },
    ],
    retest: 'Re-test lipid profile in 12 weeks.',
    relatedMarkerIds: ['ldl', 'total-chol', 'tg', 'hdl'],
  },
  'insulin-resistance': {
    id: 'insulin-resistance',
    title: 'Early Insulin Resistance',
    summary:
      'Your insulin is higher than it should be. A quiet, very early signal — and the most reversible one.',
    what:
      'Insulin is the hormone that moves sugar out of your blood. When cells stop listening, your pancreas pumps out more to compensate. HbA1c can still look fine for years while this is happening underneath.',
    whyMatters:
      'This is the soil in which type 2 diabetes, fatty liver, and stubborn belly weight grow. Caught here, it’s entirely reversible — usually within months.',
    actions: [
      {
        title: 'Walk after every meal',
        detail:
          '10 minutes is enough. Muscles act as a sugar sponge and pull glucose out without insulin.',
      },
      {
        title: 'Cut sugar in drinks',
        detail:
          'Sugar in liquid form is the fastest path to high insulin. Chai with 2 sugars × 4/day adds up.',
      },
      {
        title: 'Protein-first meals',
        detail:
          'Eat protein and vegetables before carbs. The same meal in this order spikes sugar much less.',
      },
      {
        title: 'Strength training 2× a week',
        detail:
          'More muscle = more places to park glucose. The most durable fix there is.',
      },
    ],
    retest: 'Re-test fasting insulin in 12 weeks.',
    relatedMarkerIds: ['insulin', 'glucose', 'hba1c'],
  },
};

export function getProblem(id: string): Problem | undefined {
  return problems[id];
}
