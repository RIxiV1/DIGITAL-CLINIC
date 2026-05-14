import type { QuizAnswers } from '../AppContext';

export type RecommendedTest = {
  id: string;
  name: string;
  short: string;
  whyTemplate: (q: QuizAnswers) => string;
  includes: { name: string; about: string }[];
  fasting: boolean;
  turnaround: string;
  priorityKeys: string[];
  symptomKeys: string[];
  alwaysRecommend?: boolean;
};

export const allTests: RecommendedTest[] = [
  {
    id: 'hormone',
    name: 'Male Hormone Panel',
    short: 'Testosterone & friends',
    whyTemplate: (q) =>
      q.priorities.includes('sexual') || q.symptoms.includes('low-libido')
        ? 'You flagged sexual health or low libido — testosterone and related hormones often sit behind it.'
        : q.priorities.includes('muscle') || q.priorities.includes('energy')
          ? 'Energy and muscle response are closely tied to testosterone and thyroid hormones.'
          : 'A baseline hormone picture is the single most useful test for men over 30.',
    includes: [
      { name: 'Total Testosterone', about: 'Your primary male hormone — drives energy, libido, muscle.' },
      { name: 'Free Testosterone', about: 'The portion of testosterone your body can actually use.' },
      { name: 'SHBG', about: 'A carrier protein that decides how much testosterone is available.' },
      { name: 'LH & FSH', about: 'Pituitary signals that tell your body to make testosterone.' },
      { name: 'Estradiol', about: 'A small amount of estrogen is healthy — too much causes issues.' },
    ],
    fasting: true,
    turnaround: '24 hrs',
    priorityKeys: ['sexual', 'muscle', 'energy', 'mood'],
    symptomKeys: ['low-libido', 'low-mood', 'low-energy'],
  },
  {
    id: 'metabolic',
    name: 'Metabolic Health Panel',
    short: 'Sugar, insulin, weight',
    whyTemplate: (q) =>
      q.symptoms.includes('belly-fat')
        ? 'Belly weight that won’t budge usually has insulin in the story.'
        : q.priorities.includes('weight') || q.priorities.includes('energy')
          ? 'Stable energy and weight start with how your body handles sugar and insulin.'
          : 'Catches early signs of insulin resistance — years before a diabetes diagnosis.',
    includes: [
      { name: 'HbA1c', about: 'Average blood sugar over the last 3 months.' },
      { name: 'Fasting Glucose', about: 'A snapshot of your blood sugar this morning.' },
      { name: 'Fasting Insulin', about: 'How hard your pancreas is working to keep sugar in check.' },
      { name: 'HOMA-IR', about: 'A simple score for insulin resistance.' },
    ],
    fasting: true,
    turnaround: '24 hrs',
    priorityKeys: ['weight', 'energy'],
    symptomKeys: ['belly-fat', 'low-energy', 'foggy-mind'],
  },
  {
    id: 'lipid',
    name: 'Heart Health Panel',
    short: 'Cholesterol & lipids',
    whyTemplate: (q) =>
      q.priorities.includes('heart') || q.priorities.includes('longevity')
        ? 'You picked heart or longevity as a priority. This is the standard panel cardiologists use.'
        : 'Heart disease is the #1 killer of Indian men. Worth checking yearly from 30.',
    includes: [
      { name: 'Total Cholesterol', about: 'All the cholesterol in your blood combined.' },
      { name: 'LDL', about: '“Bad” cholesterol — the type that builds up in artery walls.' },
      { name: 'HDL', about: '“Good” cholesterol — clears the bad kind out.' },
      { name: 'Triglycerides', about: 'Fats in your blood. High = sugar/alcohol overload.' },
      { name: 'Apo-B', about: 'A more accurate predictor of heart risk than LDL alone.' },
    ],
    fasting: true,
    turnaround: '24 hrs',
    priorityKeys: ['heart', 'weight', 'longevity'],
    symptomKeys: [],
    alwaysRecommend: true,
  },
  {
    id: 'thyroid',
    name: 'Thyroid Function',
    short: 'TSH, T3, T4',
    whyTemplate: (q) =>
      q.symptoms.includes('low-energy') || q.symptoms.includes('belly-fat')
        ? 'Unexplained tiredness or weight changes? Always rule out the thyroid first.'
        : 'A quick check for the gland that sets your metabolic pace.',
    includes: [
      { name: 'TSH', about: 'The main signal from the brain to the thyroid.' },
      { name: 'Free T3', about: 'The active thyroid hormone your cells use.' },
      { name: 'Free T4', about: 'The inactive form, converted into T3 as needed.' },
    ],
    fasting: false,
    turnaround: '24 hrs',
    priorityKeys: ['energy', 'weight'],
    symptomKeys: ['low-energy', 'belly-fat', 'low-mood'],
  },
  {
    id: 'vitamins',
    name: 'Vitamin & Mineral Check',
    short: 'D, B12, iron',
    whyTemplate: (q) =>
      q.symptoms.includes('low-energy') || q.symptoms.includes('foggy-mind')
        ? 'Low energy and foggy mind are most often a vitamin D or B12 deficiency.'
        : 'Vitamin D deficiency is near-universal in Indian men. Cheap to test, easy to fix.',
    includes: [
      { name: 'Vitamin D (25-OH)', about: 'Drives bone, mood, and immune function.' },
      { name: 'Vitamin B12', about: 'Fuels nerves and clear thinking.' },
      { name: 'Ferritin', about: 'Your iron stores — low iron drains energy.' },
    ],
    fasting: false,
    turnaround: '24 hrs',
    priorityKeys: ['energy', 'focus', 'mood'],
    symptomKeys: ['low-energy', 'foggy-mind', 'low-mood'],
    alwaysRecommend: true,
  },
  {
    id: 'liver-kidney',
    name: 'Liver & Kidney Check',
    short: 'Filter health',
    whyTemplate: () =>
      'Silent problems often. Worth a baseline so you can spot drift early.',
    includes: [
      { name: 'ALT, AST', about: 'Liver enzymes that rise when the liver is strained.' },
      { name: 'GGT', about: 'Sensitive to alcohol and medication load.' },
      { name: 'Creatinine, eGFR', about: 'How well your kidneys are filtering.' },
      { name: 'Urea', about: 'A waste product kidneys clear out.' },
    ],
    fasting: false,
    turnaround: '24 hrs',
    priorityKeys: ['longevity'],
    symptomKeys: [],
    alwaysRecommend: true,
  },
];

export function recommendTestsFor(q: QuizAnswers): RecommendedTest[] {
  const scored = allTests.map((t) => {
    const priorityHits = t.priorityKeys.filter((k) =>
      q.priorities.includes(k),
    ).length;
    const symptomHits = t.symptomKeys.filter((k) =>
      q.symptoms.includes(k),
    ).length;
    const score = priorityHits * 2 + symptomHits + (t.alwaysRecommend ? 1 : 0);
    return { test: t, score };
  });

  const filtered = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.test);

  if (filtered.length >= 4) return filtered;
  const ids = new Set(filtered.map((t) => t.id));
  const fillers = allTests.filter((t) => !ids.has(t.id));
  return [...filtered, ...fillers].slice(0, Math.max(4, filtered.length + 1));
}
