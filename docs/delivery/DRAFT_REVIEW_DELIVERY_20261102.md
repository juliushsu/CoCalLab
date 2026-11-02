# Manual draft review delivery — 2026-11-02

Candidate: `codex/draft-review-contract-20261102`, based on PR #12 at `57a76a63a94befcc8a001f5569c1d91e6464e65a`.
UAT remains `7dccd5452152f2495d10ad1437d5d03215166065`; release HOLD. No merge, deployment or cloud writes.

## Delivered behavior

- Pending/latest drafts are read through the existing user-JWT client, with explicit organization/project/document filters and returned-identity validation. Invalid aliases, denied/failed/malformed reads remain errors; a real empty array is empty.
- Confirm, reject and batch dialogs actually open. Writes use the existing `confirm-draft` contract: organization/project/draft IDs, `decision`, nested `overrides`. Success requires the matching saved draft/status and a saved activity identifier for confirmation. Rejection does not create an activity.
- The displayed quantity/unit/date come from the same normalized payload used by the backend. Missing/invalid values cannot become a default zero activity; valid zero remains valid. Scope/category/note edits use existing supported fields.
- Known Mock/fixture/synthetic extraction is labeled and excluded from confirmation; rejection remains available. Missing extraction provenance is explicitly unknown, never described as real OCR. This UI guard is not a server authorization or provenance guarantee.
- Scope/session changes discard late UI results and stop subsequent batch requests. Already sent requests may still commit. Successful batch entries are removed individually; uncertain entries remain visible, with submission locked until a successful fresh pending/latest read. Refresh also prunes obsolete selection.
- Existing document-to-review links retain organization/project and exact document identity. Outgoing review links retain tenant/project context. Unscoped lists remain read-only.

## Actual verification

Frontend **95/95 PASS**, including 17 draft-review cases; full app type-check, full ESLint with zero warnings, Vite build and `git diff --check` PASS.

Commands from `frontend/readdy-app`:

```powershell
node --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json
node node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
node node_modules/vite/bin/vite.js build
```

Tests import the actual backend input validator and intercept the installed Supabase SDK to verify JSON/JWT/filter serialization, exact document scope, 403/503/network errors, canonical display conflicts, missing data, contradictory responses, cross-scope rows, batch partial results and delayed context changes. Fixtures are test-only.

Chrome mounted the actual React page/dialogs/router at the explicit local synthetic harness `http://127.0.0.1:4188/`:

| Operation | Actual result |
| --- | --- |
| Single confirm, then reject | Both dialogs opened; requests 1 then 2; saved notices; pending 2 → 1 → 0 and empty state |
| Conflicting legacy values | Canonical `0 kWh`, `2026-11-02` displayed instead of legacy `900 kg`, `2000-01-01` |
| Batch one saved / one denied | Two requests, one pending entry retained; submit/selection disabled until refresh |
| Saved then response lost | One request; uncertain warning, no success, direct resubmit disabled; refresh removed saved row with request count still 1 |
| Known mock extraction | Source/warning visible; confirm and batch selection disabled; zero requests |
| Read failure | Explicit error/retry, no empty success; zero writes |
| One document selected among two | Actual page forwards the selected document ID; only its draft is rendered; no foreign-document error |

Harness auth/read/write/subscription/layout are explicit synthetic test substitutes, not real service acceptance. The harness is under `tests/browser/draft-review` and is not imported by production. Start it with:

```powershell
node node_modules/vite/bin/vite.js --config tests/browser/draft-review/vite.config.mjs
```

Local evidence outside Git: `../evidence/draft-review/` relative to repository root, containing `lost-response.png`, accessibility snapshots and `OWNER_DECISIONS.md`.

## Boundaries and next work

Not verified: live Supabase persistence/RLS/roles/subscription enforcement, real browser sessions, storage, concurrent server confirmations or UAT. The frontend reread barrier reduces direct same-screen resubmission; it does not establish server idempotency or prevent multi-tab/reload/delayed-commit duplicates. Backend/schema were unchanged. CTO server-write review is required before release.

Real extraction/classification remains unavailable: the current provider factory implements only mocks. Existing upload requests also use the wrong document/draft contract. Do not merely repair payloads and thereby activate mock-to-formal processing. Next feature: separate real file upload/receipt from extraction, make unavailable processing explicit, and preserve the saved document ID on downstream failure. Follow-up read-only source review found a Storage tenant-boundary prerequisite; expanded upload writes are BLOCKED pending scoped CTO/Claude review. The concrete source-only plan and recovery boundaries remain local in `../evidence/draft-review/UPLOAD_STORAGE_CTO_DECISION.md`. No partial upload implementation was left. Real provider spending/egress and server write changes require separate decisions.

Export stays on PR #9/#10's separate candidate line: production export authority pending, actual OS download unverified. Activity detail PR #11 and statistics PR #12 are reused unchanged.
