# Real read-only activity detail — local source candidate

## Fixed baseline and independence

Input `4c34924bdd23b5a3ec4cb07d25c3eaa91000ed71` on `codex/saas-o1-log-read-boundary-20261031` was rechecked against GitHub. Feature branch: `codex/activity-detail-read-20261102`. This independent candidate does not depend on report-export PR #10's pending authorization decision. Report export remains PR #9 / `1e93fee26e6d07a28e85089325ae5afa75d36160`, with validation/guard proposal PR #10 / `059162660c588346e3cf36aec6ae1ca7dd8f1d39`.

UAT remains `7dccd5452152f2495d10ad1437d5d03215166065`; the existing clean UAT checkout and other work were preserved. No merge, deployment, cloud writes/schema/permissions, seed or runtime activation.

## Usable behavior

- `/admin/activities/:activityId` now uses the actual route parameter. It reads the selected saved activity, then only that activity's current calculation snapshot, with the existing user-JWT client and RLS.
- Optional selected organization and project aliases must agree and be UUIDs. They constrain reads and are checked against returned activity/project/snapshot identities. No inferred first tenant, service-role client or mock fallback.
- Loading, inaccessible/missing row, configuration error, permission/network/server failure, malformed result and retry are distinct. Before effects run, an old activity/scope/session/retry context cannot paint as the new result; late results are ignored.
- Canonical activity lifecycle, inclusion, suggested/final scope and calculation status are separate. Zero quantity/emissions remain zero. Saved `co2e_kg` displays kg plus tonnes divided once by 1000. Missing, pending, failed, superseded or invalid latest results do not use an earlier success or fabricate zero.
- Factor/input details come from the saved calculation snapshot. No live factor lookup reconstructs history.
- Removed the hard-coded sample activity, fake verifier and local-only verification success. Verification/edit/recalculation controls truthfully say unavailable. This feature performs no write.

Existing list navigation uses `projectId` / `organizationId`, so the detail's back link preserves those supported aliases. The pre-existing list service's unconfigured-empty behavior is outside this narrowly scoped feature.

## Actual validation

Windows, Node 24.22.1, existing package-lock dependencies:

- Frontend: **64/64 tests PASS**, including 12 new detail tests.
- Actual Supabase SDK serialization with intercepted synthetic fetch: user JWT, GET, exact scope and `is_latest=true`, no unrelated read after denial/mismatch. No network or cloud database used.
- Zero/missing/invalid values, unavailable latest calculation, duplicate latest rows, 403/500/network failures, wrong tenant/project/activity, invalid URL scope and request-context replacement tested.
- Full frontend type-check, full ESLint (zero warnings), Vite build and `git diff --check` PASS. Vite ran on the host because sandbox ancestor-directory reads are restricted; no security settings were changed.
- Unchanged backend unit suite: **16/16 PASS**; this does not establish new backend behavior.

Not verified: mounted React/browser E2E, live authenticated Supabase/RLS denial, real cloud records or customer acceptance. Fixture objects stay in tests; no data was substituted into application reads. No Docker/WSL retries.

## Next unblocked feature

Project statistics currently asks for nonexistent `calculation_results.co2e_total`, ignores returned query errors and displays them as zero tonnes. Fix its real fields, single kg/t conversion, current-calculation scope, unknown/error states and stale project/session handling. Then address the existing manual-draft decision payload contract; real OCR/LLM and report-export authorization remain separate decisions.
