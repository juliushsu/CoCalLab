# Next action

- Release HOLD; fixed UAT `7dccd5452152f2495d10ad1437d5d03215166065`. No merge/main, cloud, deployment or cost authorization.
- Current branch `codex/scoped-document-library-20261104`, implementation `6a0f76bafb2864a436209d1b4e9c0d3651f9dffe`, based on PR #16 `e737bc4b9f19cf6ce04bd13fe80e6bf3eeed03f3`. Subsequent commits docs/evidence only; PR #15 N1/N2 preserved.
- Done: scoped document library, explicit failures, authenticated original byte preview/download, original controls/source navigation retained; indirect reference/path/subscription scope+late refresh/grace-period guards. No schema or broad refactor.
- Actual: frontend160/160; backend16/16; tsc/lint/build pass. Independent26/26 is a subset of160. Fixed-source Chrome: original home/login, project-only A document scope, private original dialog, A->B selector/role/row replacement. Synthetic transport only. Native download observation timed out; not verified.
- Preservation diff, operating steps and evidence: FEATURE_PRESERVATION_20261104.md, SCOPED_DOCUMENT_LIBRARY_20261104.md, frontend/readdy-app/tools/local-preview/README.md. Ports4192/4193 loopback; restart commands in README. No other resources/5432 touched.
- OPEN: Storage/receipt deletion atomicity/races; server hash/content attestation; production non-Mock document-to-draft entry; real JWT/RPC/Storage/tenant/export/revocation/backup/restore/representative UAT. True environment BLOCKED; see REAL_TENANT_ACCEPTANCE_20261104.md. Preview does not close these.
- Next local task: verify the existing manual activity-create -> calculate -> saved report contract without fixture fallback; preserve visible entries and explicitly identify unsupported endpoints. Full product document-transcription semantics stay a separate CTO decision.
- Next command (repo root, no port/cloud): `$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path; node backend/tools/local-workflow/run.js --run`.
- Preserved unrelated stash `pc-export-browser-harness-preserved-20261102`; session ends with this checkpoint, no indefinite background agent claim.
