/**
 * Category → Default Scope mapping
 *
 * Rules (GHG Protocol):
 *   Scope 1 — direct combustion / fuel / refrigerants
 *   Scope 2 — purchased electricity / energy
 *   Scope 3 — upstream/downstream: travel, logistics, procurement, waste, water, materials, commuting
 *
 * Returns null when no clear default exists (user must choose manually).
 */

export type ScopeValue = '1' | '2' | '3';

const CATEGORY_SCOPE_MAP: Record<string, ScopeValue> = {
  energy: '2',            // purchased electricity → Scope 2
  refrigerants: '1',      // direct fugitive emissions → Scope 1
  transport: '3',         // upstream/downstream logistics → Scope 3
  business_travel: '3',   // Scope 3 category 6
  employee_commuting: '3',// Scope 3 category 7
  waste: '3',             // Scope 3 category 5
  water: '3',             // Scope 3 (water treatment)
  materials: '3',         // Scope 3 category 1 (purchased goods)
  // 'other' and 'unclassified' intentionally omitted → no default
};

/**
 * Returns the suggested scope for a given category, or null if no suggestion.
 */
export function getSuggestedScope(category: string): ScopeValue | null {
  return CATEGORY_SCOPE_MAP[category] ?? null;
}

/**
 * Returns true if the category has a known default scope.
 */
export function hasScopeDefault(category: string): boolean {
  return category in CATEGORY_SCOPE_MAP;
}
