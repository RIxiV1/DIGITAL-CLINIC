/**
 * Cross-context types — shared by NavigationContext and QuizContext, plus
 * re-exported from AppContext.tsx for backward compatibility with the
 * existing import paths in pages/data.
 */

export type Page =
  | { type: 'landing' }
  | { type: 'quiz' }
  | { type: 'recommendedTests' }
  | { type: 'home' }
  | { type: 'healthMap' }
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'manualEntry' }
  // `view: 'details'` is the full marker explorer at /reports/:id/markers;
  // the default (undefined) is the calm Overview. Same page — the URL just
  // selects which layer of the progressive-disclosure the report shows.
  | { type: 'results'; reportId: string; view?: 'details' }
  // Side-by-side comparison of two reports. Both ids optional: `/compare`
  // with none opens the picker; `/compare/:aId/:bId` deep-links a pair.
  | { type: 'compare'; aId?: string; bId?: string }
  | { type: 'problem'; problemId: string }
  | { type: 'profile' }
  | { type: 'privacy' };

export type QuizAnswers = {
  age?: string;
  activity?: string;
  priorities: string[];
  symptoms: string[];
  /** Cardiometabolic red-flag comorbidities the user discloses (heart
   *  condition, high blood pressure, diabetes, nitrate/angina meds, or an
   *  explicit "none"). Drives the "see a doctor first" safety banner on
   *  the recommendations screen — sexual/energy symptoms alongside these
   *  conditions can be an early sign of cardiovascular disease, and some
   *  treatments are unsafe with them (e.g. nitrates). Optional/array so
   *  pre-existing persisted quizzes (no field) hydrate cleanly. */
  comorbidities: string[];
};
