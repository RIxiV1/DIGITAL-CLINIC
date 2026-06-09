/**
 * Quiz flow.
 *
 * Now three screens (was four), reordered to lead with symptoms — the most
 * engaging "yes, that's me" moment — and to bury the demographic survey
 * questions at the end:
 *
 *   Screen 1 · Symptoms       (was Step 4)
 *   Screen 2 · Priorities     (reframed around hormonal pathways)
 *   Screen 3 · A few details  (age + activity merged onto one screen)
 *
 * Every priority and symptom now maps cleanly to a hormonal pathway, so the
 * recommendation engine can't be handed an option it doesn't know what to
 * do with.
 */

export type QuizOption = {
  id: string;
  label: string;
  hint?: string;
  emoji?: string;
};

/**
 * Optional thematic grouping for a step's options. When present, the
 * renderer shows a small uppercase label above each cluster of pills
 * (e.g. "Energy & sleep" → 3 pills, "Sexual & fertility" → 3 pills…).
 * The screen this matters on is symptoms — 11 flat pills is a wall
 * that strains chunking (Miller's Law); 4-5 small clusters reads as
 * "pick from each area that applies." `label` is optional so a final
 * opt-out option ("Nothing specific") can sit on its own without a
 * pseudo-heading.
 */
type QuizOptionGroup = {
  label?: string;
  options: QuizOption[];
};

/**
 * A sub-question inside a compound step (e.g. age + activity on one screen).
 */
type QuizSubStep = {
  field: 'age' | 'activity';
  question: string;
  layout: 'pills' | 'cards';
  options: QuizOption[];
};

export type QuizStep = {
  id: string;
  sectionId: 'symptoms' | 'priorities' | 'basics';
  sectionLabel: string;
  title: string;
  subtitle: string;

  /* --- Simple step fields --- */
  field?: 'age' | 'activity' | 'priorities' | 'symptoms';
  multi?: boolean;
  layout?: 'cards' | 'pills';
  /** Flat option list. Mutually exclusive with `optionGroups`. */
  options?: QuizOption[];
  /** Grouped option list. When present, the renderer shows each
   *  group's `label` (if any) as a small uppercase section header
   *  above the pill cluster. `options` should be undefined when this
   *  is set. */
  optionGroups?: QuizOptionGroup[];

  /* --- Compound step (multiple sub-questions on one screen) --- */
  subSteps?: QuizSubStep[];
};

/** Flatten a step's options regardless of grouping. Existing helpers
 *  (`findOptionLabel`, `buildLabelMap`) and the recommendation engine
 *  shouldn't care whether the data is grouped or flat. */
export function getStepOptions(step: QuizStep): QuizOption[] {
  if (step.optionGroups) {
    return step.optionGroups.flatMap((g) => g.options);
  }
  return step.options ?? [];
}

export const quizSteps: QuizStep[] = [
  /* --------------- SCREEN 1 · Symptoms (was Step 4) ---------------- */
  {
    id: 'symptoms',
    sectionId: 'symptoms',
    sectionLabel: 'Section 1 · How you feel',
    title: 'What have you been noticing?',
    subtitle: 'Tap all that apply. Skip if nothing specific.',
    field: 'symptoms',
    multi: true,
    layout: 'pills',
    // Symptoms used to render as one flat row of 11 pills — a wall
    // the eye couldn't chunk. Grouping by life-area gives the user
    // 4 small clusters of 2-3 each (plus a standalone proactive opt-
    // out), which scans as "pick from each area that applies" instead
    // of "read all 11 and decide."
    //
    // IDs are preserved exactly — the recommendation engine and any
    // persisted user answers still resolve. Only the visual grouping
    // is new.
    optionGroups: [
      {
        label: 'Energy & sleep',
        options: [
          { id: 'low-energy', label: 'Low Energy' },
          { id: 'brain-fog', label: 'Brain Fog' },
          { id: 'poor-sleep', label: 'Poor Sleep' },
        ],
      },
      {
        label: 'Sexual & fertility',
        options: [
          { id: 'low-libido', label: 'Low Libido' },
          { id: 'difficulty-in-bed', label: 'Difficulty in bed' },
          { id: 'fertility-concerns', label: 'Fertility concerns' },
        ],
      },
      {
        label: 'Body & hair',
        options: [
          { id: 'hair-loss', label: 'Hair Loss' },
          { id: 'belly-fat', label: 'Belly Fat' },
        ],
      },
      {
        label: 'Mood & stress',
        options: [
          { id: 'low-mood', label: 'Low Mood' },
          { id: 'stress', label: 'Stressed Out' },
        ],
      },
      // Standalone opt-out — no group label so the chip floats below
      // the four thematic clusters and reads as "or, none of these."
      {
        options: [{ id: 'proactive', label: 'Nothing specific' }],
      },
    ],
  },

  /* --------------- SCREEN 2 · Priorities (reframed) ---------------- */
  {
    id: 'priorities',
    sectionId: 'priorities',
    sectionLabel: 'Section 2 · Your priorities',
    title: 'What matters most right now?',
    subtitle: 'Pick up to four. This shapes your recommendations.',
    field: 'priorities',
    multi: true,
    layout: 'pills',
    options: [
      { id: 'sexual', label: 'Sexual performance' },
      { id: 'hair-scalp', label: 'Hair & scalp health' },
      { id: 'energy', label: 'Energy & stamina' },
      { id: 'fertility', label: 'Fertility' },
      { id: 'weight', label: 'Weight & body shape' },
      { id: 'sleep', label: 'Sleep & recovery' },
      { id: 'mood', label: 'Mood & stress' },
      { id: 'hormonal', label: 'Overall hormonal health' },
    ],
  },

  /* --------------- SCREEN 3 · Compound: Age + Activity ------------- */
  {
    id: 'details',
    sectionId: 'basics',
    sectionLabel: 'Section 3 · A few quick details',
    title: 'A few quick details.',
    subtitle: 'Helps us calibrate recommendations to your life stage.',
    subSteps: [
      {
        field: 'age',
        question: 'How old are you?',
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
        field: 'activity',
        question: 'How active is your week?',
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
    ],
  },
];

export const totalQuizSteps = quizSteps.length;

/**
 * Walks both top-level steps AND compound subSteps to find the human label
 * for a given option id. Used by surfaces that show the user's selections
 * back to them (Profile, Home priority cards) without caring how the quiz
 * is structured internally.
 */
export function findOptionLabel(
  field: 'age' | 'activity' | 'priorities' | 'symptoms',
  id: string,
): string | undefined {
  for (const step of quizSteps) {
    if (step.field === field) {
      // getStepOptions transparently flattens grouped steps (symptoms
      // now lives in optionGroups). Previous code only looked at
      // step.options and silently missed every grouped id.
      const hit = getStepOptions(step).find((o) => o.id === id);
      if (hit) return hit.label;
    }
    if (step.subSteps) {
      for (const sub of step.subSteps) {
        if (sub.field === field) {
          const hit = sub.options.find((o) => o.id === id);
          if (hit) return hit.label;
        }
      }
    }
  }
  return undefined;
}

/**
 * Returns a flat id → label map across every option in the quiz (simple
 * steps + compound substeps). Cheap to call once per page since the data
 * is static.
 */
export function buildLabelMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const step of quizSteps) {
    for (const o of getStepOptions(step)) map.set(o.id, o.label);
    if (step.subSteps) {
      for (const sub of step.subSteps) {
        for (const o of sub.options) map.set(o.id, o.label);
      }
    }
  }
  return map;
}
