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
  | { type: 'upload' }
  | { type: 'processing' }
  | { type: 'results'; reportId: string }
  | { type: 'problem'; problemId: string }
  | { type: 'profile' };

export type QuizAnswers = {
  age?: string;
  activity?: string;
  priorities: string[];
  symptoms: string[];
};
