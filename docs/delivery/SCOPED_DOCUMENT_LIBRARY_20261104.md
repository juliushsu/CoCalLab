# Scoped document library delivery

Release HOLD. UAT baseline stays `7dccd5452152f2495d10ad1437d5d03215166065`.
Fixed implementation: `6a0f76bafb2864a436209d1b4e9c0d3651f9dffe`, branch `codex/scoped-document-library-20261104`, stacked on PR #16 `e737bc4b9f19cf6ce04bd13fe80e6bf3eeed03f3`. Later commits add documentation/evidence only. No main merge, deployment, cloud operation, new cost or schema change.

## Usable behavior

- Original document list now reads explicit organization/project/document scope, validates returned scope, follows exact-count pagination, and exposes loading/empty/permission/network/incomplete-read failures. Missing scope never silently chooses the first organization. Project-only links resolve organization from the authorized project.
- Private original preview/download re-reads the exact receipt under the current user, then uses authenticated Storage byte download. No public/signed URL fallback. Size and a valid saved SHA256 are checked locally; PDF/PNG/JPEG preview requires matching MIME/signature. Unsupported legacy path/type is explicit; binary download preserves bytes. This is not server hash/content attestation.
- Search, project/status/type filters, upload, draft review, delete confirmation and readonly banner remain. Activity detail source-document and source-draft-list links restored with scope; confirmed draft detail is not invented. Original App/router/AdminLayout/home/login remain.
- Context changes discard old responses and clear original-file URLs; same-user normal token refresh uses existing auth continuity. Resolved organization drives strict subscription presentation; old refresh callbacks cannot cancel a newer scope, unknown status fails closed, legal backend grace_period remains writable. Actual mutation authority stays in DB/Storage/RPC.
- Existing delete is retained and tightened: writer/preflight, direct and all-version draft-mediated references, exact counts, authenticated Storage result, exact receipt delete. Missing/denied/unconfirmed stages do not claim success. Known reference checks run organization-wide to cover legal cross-project references.

## Actual validation

| Version / environment | Command / operation | Actual result / evidence | Unverified |
| --- | --- | --- | --- |
| Fixed source; Windows existing Node24 + installed SDK | frontend `node --test tests/*.test.ts` | 160/160; new tests26 are a subset. Type-check, lint and production build pass | True service/JWT/RLS not executed |
| Same checkout; actual backend helper | backend `node --test backend/tests/*.test.js` | 16/16; backend unchanged | Provider tests include explicitly Mock fixtures, not a real OCR delivery |
| Independent agent; fixed SHA | documentLibrary22 + fence2 + locales1 + subscription contract1, tsc, diff check | 26/26 PASS, all a subset of160. Initial findings fixed: indirect draft reference, project-only subscription, URL ambiguity including trailing SP, locale key, late refresh/unmount guard, grace-period and nonstring statuses | No independent Chrome, full React lifecycle or native download proof |
| Fixed source on loopback4192, original UI + service unconfigured | Chrome original home and login | Home rendered; login explicitly unconfigured/disabled. `evidence/document-library-20261104/original-home.*` | Original home contains inherited marketing claims, not acceptance evidence; remote decorative assets blocked |
| Fixed source on loopback4193, explicitly synthetic SDK transport | Original login shared account -> project-only A library -> private original dialog -> project selector B | A rows only, readonly status/delete disabled; blob dialog opened; B viewer and B row replace A. Screenshots/text in same evidence folder | Transport is a fixture; no real tenant/JWT/Storage isolation claim |
| Working-tree version before pin (same download implementation) | Native download event observation | BLOCKED: browser observation timed out/reset; no saved native download result or bytes confirmed | SDK byte-read tests pass; actual Chrome download remains UNVERIFIED |

Frontend commands from `frontend/readdy-app`:

```powershell
node --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json
node node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
node node_modules/vite/bin/vite.js build
```

Reproduce previews: [local-preview README](../../frontend/readdy-app/tools/local-preview/README.md). Frontend at `http://127.0.0.1:4192/`, synthetic backend UI at `http://127.0.0.1:4193/login`; two separate Vite configurations, cache directories and loopback strict ports. Existing 5432/other projects/stash preserved, no Docker/WSL retry. Preview processes were started in this session; commands are authoritative if processes later end.

## Limits and next work

Storage removal and receipt deletion are NOT atomic. Concurrent/hidden legacy references or a later permission/service failure can still leave a receipt with a missing file; the UI reports uncertainty and preserves identity. Frontend preflight is compatibility/error prevention, not permission control. Do not interpret these guards as closing cross-service atomic deletion.

Server SHA/content proof, real A/B direct API/file/export/revocation/logout acceptance, cloud drift/migration/bucket/backup/restore and representative user acceptance remain OPEN/NOT_RUN. See [real tenant acceptance matrix](REAL_TENANT_ACCEPTANCE_20261104.md); no new environment capabilities were obtained.

The PR #16 local receipt->manual review->calculation->report demonstration remains intact. Production non-Mock document-to-draft entry and activity manual edit/verify/recalculate remain explicitly incomplete; no OCR or fake success was added. Next local work should test the existing manual activity creation/calculation/report entry while preserving the separate decision on a production document-transcription workflow. Do not replace missing source-draft semantics with a fixture.
