# Next action

- RELEASE HOLD. UAT remains7dccd5452152f2495d10ad1437d5d03215166065; no main merge/deployment/cloud authorization.
- M1 SOURCE_DONE candidate: fixed code18c0894cf9da42eb341ce5835ba36fdc3a7bedc9, branch codex/commercial-m1-20261106, based on CTO43cbb102. Later commits documentation/evidence or CI dependency ordering only; PR15/16/17 preserved.
- Usable: original App/login/activity list/manual form -> scoped normal REST INSERT -> actual recalculate handler/RPC -> actual report handler/V2 -> saved report reload. 100kWh×synthetic0.5=50kg=.05t. Fixed-source Chrome screenshots/DOM and commands: COMMERCIAL_M1_DELIVERY_20261106.md.
- Validation: frontend163/163, backend17/17, SQL/HTTP214/214; tsc/lint/build PASS. Independent HTTP8+boundary9/manual3 are subsets, not added. Initial new audit-based request P1 fixed with service-only ledger+report scope fences; lost-response recovery P2 and UI P3s fixed. No real Supabase/Deno/JWT/Storage E2E.
- Product preview4195/login, dedicated API4194; README backend/tools/product-preview/README.md. Owned API exec8782, UI16996; only these may be stopped. Prior modes4192/4193 preserved. No other project or5432 changes.
- Next READY: M2 full synthetic preview scenarios/role and saved report context; do not fill unimplemented endpoints with success. Queue: COMMERCIAL_EXECUTION_PROGRESS_20261106.md.
- WAITING_CTO: fixed18c0894 ledger/RPC trust-boundary red-team question in M1 delivery; no auto-notification. General Scope mappings and M4 minimal manual-transcription contract await CTO; do not implement that endpoint before ruling.
- WAITING_OWNER: actual isolated environment, cloud migration/resource/data/restore/cost scope. M3 hash/receipt/delete integrity and full report anti-tamper remain OPEN. Source fixes do not authorize cloud application.
- Next command(repo root, local only): `$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path; node backend/tools/product-preview/run.js` (if4194 already running, use existing UI, do not start a duplicate or kill another service).
- Preserved stash pc-export-browser-harness-preserved-20261102. Finite session checkpoint, no claim of indefinite background execution.
