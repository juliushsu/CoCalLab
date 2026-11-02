# Next action

- UAT stays `7dccd5452152f2495d10ad1437d5d03215166065`; no merge/deployment.
- Export candidate PR #9 at `1e93fee...`; validation/guard PR #10 at `05916266...`: formatter/files tested, production export authority pending; actual browser saving unverified.
- Activity candidate: `codex/activity-detail-read-20261102`, base `4c34924b...`. Real scoped read-only detail replaces mock/fake verify. Frontend 64 tests + type/lint/build PASS; backend 16 PASS. Live RLS/authenticated React E2E unverified. See `ACTIVITY_DETAIL_DELIVERY_20261102.md`.
- Statistics PR #12: `codex/project-statistics-20261102` at `57a76a63a94befcc8a001f5569c1d91e6464e65a`; 78 tests/type/lint/build PASS. See `PROJECT_STATISTICS_DELIVERY_20261102.md`.
- Manual review candidate: `codex/draft-review-contract-20261102`, based on PR #12. Real decision/overrides, exact pending/latest scope, working dialogs, canonical display, partial/uncertain result reread barrier; known mock drafts cannot be confirmed. Frontend 95/95/type/lint/build PASS; Chrome synthetic React checks PASS. Live persistence/RLS/UAT unverified. See `DRAFT_REVIEW_DELIVERY_20261102.md`.
- Next safe feature: real file upload/receipt separated from unavailable OCR/classification. Do not fix payloads into the current mock-only provider as formal success. Preserve document ID after upload if later work fails. Real provider spending/egress and server idempotency require CTO decisions; local details: `../evidence/draft-review/OWNER_DECISIONS.md`.
- Next command (repo root): `rg -n "uploadDocument|process-document|classify-document|provider_hint|model_hint" frontend/readdy-app/src/services/documentService.ts frontend/readdy-app/src/pages/admin/documents/DocumentUploadPage.tsx backend/src/providers/index.js backend/src/contracts/contracts.js`.
- Earlier local report browser harness is preserved in scoped Git stash `pc-export-browser-harness-preserved-20261102`; it is not production code.
- Session work is finite; no indefinite background agent is claimed.
