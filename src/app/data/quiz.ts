export type QuizOption = {
  id: string;
  label: string;
  hint?: string;
  emoji?: string;
};

export type QuizStep = {
  id: string;
  sectionId: 'basics' | 'priorities' | 'symptoms';
  sectionLabel: string;
  title: string;
  subtitle: string;
  field: 'age' | 'activity' | 'priorities' | 'symptoms';
  multi: boolean;
  layout: 'cards' | 'pills';
  options: QuizOption[];
};

export const quizSteps: QuizStep[] = [
  {
    id: 'age',
    sectionId: 'basics',
    sectionLabel: 'Section 1 · About you',
    title: 'How old are you?',
    subtitle: 'We tailor recommendations to your life stage.',
    field: 'age',
    multi: false,
    layout: 'pills',
    options: [
      { id: '18-24', label: '18–24' },
      { id: '25-34', label: '25–34' },
      { id: '35-44', label: '35–44' },
      { id: '45-54', label: '45–54' },
      { id: '55+', label: '55+' },
    ],
  },
  {
    id: 'activity',
    sectionId: 'basics',
    sectionLabel: 'Section 1 · About you',
    title: 'How active is your week?',
    subtitle: 'Be honest — no judgement here.',
    field: 'activity',
    multi: false,
    layout: 'cards',
    options: [
      {
        id: 'sedentary',
        label: 'Mostly sitting',
        hint: 'Desk job, little movement',
        emoji: '💻',
      },
      {
        id: 'light',
        label: 'Light activity',
        hint: 'Walks, occasional workouts',
        emoji: '🚶',
      },
      {
        id: 'active',
        label: 'Active',
        hint: '3–5 workouts a week',
        emoji: '🏃',
      },
      {
        id: 'very-active',
        label: 'Very active',
        hint: 'Daily training, sport',
        emoji: '🏋️',
      },
    ],
  },
  {
    id: 'priorities',
    sectionId: 'priorities',
    sectionLabel: 'Section 2 · Your priorities',
    title: 'What matters most to you right now?',
    subtitle: 'Pick up to four. We focus your dashboard on what you choose.',
    field: 'priorities',
    multi: true,
    layout: 'pills',
    options: [
      { id: 'energy', label: 'Energy' },
      { id: 'weight', label: 'Weight & metabolism' },
      { id: 'sexual', label: 'Sexual health' },
      { id: 'heart', label: 'Heart health' },
      { id: 'sleep', label: 'Better sleep' },
      { id: 'mood', label: 'Mood & stress' },
      { id: 'muscle', label: 'Muscle & strength' },
      { id: 'focus', label: 'Sharper focus' },
      { id: 'longevity', label: 'Longevity' },
    ],
  },
  {
    id: 'symptoms',
    sectionId: 'symptoms',
    sectionLabel: 'Section 3 · How you feel',
    title: 'Anything you’ve been noticing?',
    subtitle: 'Tap whatever fits. Skip if nothing applies.',
    field: 'symptoms',
    multi: true,
    layout: 'pills',
    options: [
      { id: 'low-energy', label: 'Low Energy' },
      { id: 'foggy-mind', label: 'Foggy Mind' },
      { id: 'belly-fat', label: 'Belly Fat' },
      { id: 'low-libido', label: 'Low Libido' },
      { id: 'poor-sleep', label: 'Poor Sleep' },
      { id: 'low-mood', label: 'Low Mood' },
      { id: 'joint-pain', label: 'Joint Pain' },
      { id: 'hair-loss', label: 'Hair Loss' },
      { id: 'stress', label: 'Stressed Out' },
      { id: 'proactive', label: 'Just being proactive' },
    ],
  },
];

export const totalQuizSteps = quizSteps.length;
