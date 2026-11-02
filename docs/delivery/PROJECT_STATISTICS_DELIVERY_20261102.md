# Project statistics delivery — 2026-11-02

Feature branch: `codex/project-statistics-20261102`, based on PR #11 at `3b008d1bd421b1a14eb800734c0df199d592274d`.
UAT stays `7dccd5452152f2495d10ad1437d5d03215166065`. No merge/deployment/cloud writes.

## Behavior
- Replaces nonexistent co2e_total query and error-as-zero fallback with exact user-JWT/RLS project/org reads.
- Validates URL scope aliases and returned identities. Paginated activities/current calculations advance by actual rows to exact visible count; missing counts, truncation, duplicates, changed counts and wrong scopes fail explicitly.
- Totals only active included activities with latest successful valid co2e_kg snapshots. Missing/failed/pending calculation makes the total unknown. Complete true zero is zero; kg converts once to tonnes; tiny positive numbers remain nonzero.
- Explicit loading, inaccessible/empty, error/retry and unknown/partial states. Project/query/session/retry context prevents stale results from painting as current.
- Inclusion ratio is explicitly not business completion; canonical boundary_type replaces nonexistent project_type. Action links preserve tenant/project context.

## Actual checks
Frontend **81/81 PASS** (14 statistics cases plus 3 localization cases); full type-check, full ESLint zero warnings, Vite build and diff check PASS.
Tests use installed Supabase SDK with intercepted synthetic fetch: JWT/filters/GET/HEAD, exact counts/latest fields, zero/unknown/partial, all-read 403/503/network errors, cross-scope results, capped/changing/repeated pages and stale context. Fixtures remain in tests. Independent source review findings were fixed.
GitHub's localization P2 is fixed: all new overview labels, loading/error/empty/retry states, boundaries and explanatory text resolve through zh/en/ja resources. Error state stores a reason, so a locale change translates it without refetching; raw service diagnostics are not shown as untranslated product text. Numeric/date presentation follows the selected locale and retains tiny positive values. The activity shortcut also uses the destination's actual legacy parameter names to retain project/tenant scope.
Localization tests cover every new key in all three languages, interpolation, runtime language changes and unknown/zero/tiny numeric display. Mounted multilingual project UI is still unverified.
Backend/SQL unchanged; no new backend/SQL count claimed.

Not verified: mounted React/browser, live authenticated RLS, customer data/UAT. REST multi-table/multi-page reads are non-atomic; count/duplicate checks cannot detect all same-count concurrent updates.

## Deduplication and next
PR #10 `059162660c588346e3cf36aec6ae1ca7dd8f1d39` already contains export validation and pending CTO export-entitlement decision; real OS saving remains unverified. PR #11 supplies real activity detail and was not rewritten.
Earlier uncommitted browser harness is preserved in scoped Git stash `pc-export-browser-harness-preserved-20261102`, not production.
Next feature: manual draft confirm/reject/batch scope/payload/response contract. Real OCR/provider spending/egress and export entitlement remain separate decisions.

