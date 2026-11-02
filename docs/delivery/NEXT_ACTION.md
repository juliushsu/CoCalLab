# Next action

- UAT stays `7dccd5452152f2495d10ad1437d5d03215166065`; no merge/deployment.
- Export candidate PR #9 at `1e93fee...`; validation/guard PR #10 at `05916266...`: formatter/files tested, production export authority pending; actual browser saving unverified.
- Activity candidate: `codex/activity-detail-read-20261102`, base `4c34924b...`. Real scoped read-only detail replaces mock/fake verify. Frontend 64 tests + type/lint/build PASS; backend 16 PASS. Live RLS/authenticated React E2E unverified. See `ACTIVITY_DETAIL_DELIVERY_20261102.md`.
- Project statistics candidate: `codex/project-statistics-20261102`, based on PR #11. Scoped exact reads, latest active-included kg/t, explicit unknown/error/retry and stale-context handling. Frontend 78/78, type/full lint/build PASS. See `PROJECT_STATISTICS_DELIVERY_20261102.md`.
- Next unblocked feature: manual draft confirm/reject/batch contract. Do not duplicate PR #10 export validation or PR #11 activity detail. Export entitlement remains CTO decision; actual OS download unverified.
- Next command (repo root): `rg -n "confirm-draft|decision|overrides" frontend/readdy-app/src/pages/admin/documents/ExtractedDraftReviewPage.tsx backend/src/contracts.js backend/supabase/functions/confirm-draft/index.ts`.
- Earlier local report browser harness is preserved in scoped Git stash `pc-export-browser-harness-preserved-20261102`; it is not production code.
- Session work is finite; no indefinite background agent is claimed.
