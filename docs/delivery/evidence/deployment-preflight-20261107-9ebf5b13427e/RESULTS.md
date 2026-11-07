# Native Deno static preflight — STATIC_PREFLIGHT_PASS_NOT_RUNTIME_ACCEPTANCE

Source: `9ebf5b13427edf8d228659a24269ddaaf86a84f0`. Native Deno 2.9.8; Supabase CLI 2.122.1. No Node application shim is used for these checks.

Frozen lock SHA256: `5897f3dd1da8f61e76c7aa93463166ed5efd8bf2939e4efe222fd62698cd2725`; unchanged after bundle: true; independently rehashed: true.

Checks: 15/15 passed. Static ESM bundles: 15/15. JS/map hashes rechecked: true. Bundle compilation does not type-check by default and is not Edge ESZIP or live acceptance.

| Function | Errors | Local | Remote | Codes |
|---|---:|---:|---:|---|
| adjustment-rule-result | 0 | 0 | 0 |  |
| analytics-emissions | 0 | 0 | 0 |  |
| classify-document | 0 | 0 | 0 |  |
| confirm-draft | 0 | 0 | 0 |  |
| create-organization | 0 | 0 | 0 |  |
| delete-uploaded-document | 0 | 0 | 0 |  |
| enforce-subscription-status | 0 | 0 | 0 |  |
| export-report-snapshot | 0 | 0 | 0 |  |
| generate-report | 0 | 0 | 0 |  |
| manual-transcription | 0 | 0 | 0 |  |
| process-document | 0 | 0 | 0 |  |
| recalculate-project | 0 | 0 | 0 |  |
| run-ai-audit | 0 | 0 | 0 |  |
| save-manual-activity | 0 | 0 | 0 |  |
| verify-upload-receipt | 0 | 0 | 0 |  |

Counts are diagnostic instances, not a count of unique defects. See failure-summary.json for local file/line/excerpts and remote dependency locations; check-*.txt retain the complete sanitized compiler diagnostics.

SDK and Node declaration versions are taken from the explicit candidate source and frozen lock. Original ba2 failure evidence is preserved in the separate historical directory. This is native static checking, not a managed deployment.

No skipLibCheck, no-check, or broad error suppression is used. Successful static checking does not close the separate four security P2s or live-runtime acceptance.

Bundles retain node: built-ins (including fs/net/tls/http in SDK dependencies). Their managed Edge support is NOT_RUN. Reference edge-runtime v1.78.1 uses Deno 2.1.4/deno_core 0.324.0; this differs from the local build/check Deno 2.9.8. The managed actual runtime is UNKNOWN and cannot be pinned here. This reference was not executed.

Large fixed-source/cache/bundle/map artifacts stay under ../tooling/deployment-20261107. manifest.json maps fixed Git blobs/SHA256, each function/transitive local source, remote resolutions and JS/map hashes. No .env, credentials, business handler, Deno serve, Docker or Supabase project service was used. Publication HOLD.
