import type { BiomarkerCategoryId } from '../../data/biomarkers';

export type Pathway = {
  id: string;
  name: string;
  categories: BiomarkerCategoryId[];
};

// The Vitals Strip groups every marker into one of these pathways.
//
// CRITICAL INVARIANT: this list must partition ALL BiomarkerCategoryId
// values — every category in exactly one pathway, none missing. The
// strip's per-tile "needs care" counts are supposed to sum to the hero's
// flagged count; when six categories (liver, kidney, blood, fertility,
// electrolytes, inflammation) were unmapped, their flagged markers were
// counted by the hero but dropped from every tile, so a report with
// "12 need care" showed tiles summing to 7. HomePage.pathways.test.ts
// asserts the partition stays complete and disjoint so this can't
// silently regress when a new category is added to the catalog.
//
// Order is severity-adjacent: the "system" reads (hormonal, metabolic,
// thyroid) lead; nutritional and the organ/blood panels follow.
export const PATHWAYS: Pathway[] = [
  { id: 'hormonal', name: 'Hormonal', categories: ['hormones', 'fertility'] },
  { id: 'metabolic', name: 'Metabolic', categories: ['metabolic', 'heart'] },
  { id: 'thyroid', name: 'Thyroid', categories: ['thyroid'] },
  { id: 'nutritional', name: 'Nutritional', categories: ['vitamins'] },
  { id: 'liver', name: 'Liver', categories: ['liver'] },
  { id: 'kidney', name: 'Kidney', categories: ['kidney'] },
  { id: 'blood', name: 'Blood', categories: ['blood'] },
  { id: 'electrolytes', name: 'Electrolytes', categories: ['electrolytes'] },
  { id: 'inflammation', name: 'Inflammation', categories: ['inflammation'] },
];
