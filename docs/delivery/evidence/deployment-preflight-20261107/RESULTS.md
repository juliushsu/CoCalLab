# Native Deno static preflight — BLOCKED

Source: `ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`. Native Deno 2.9.8; Supabase CLI 2.122.1. No Node application shim is used for these checks.

Frozen lock SHA256: `af50efef97d0c17ba5507a026d87064e781b7bc8eb3ac9bf7d83c37e30c5e765`; unchanged after bundle: true; independently rehashed: true.

Checks: 0/14 passed. Static ESM bundles: 14/14. JS/map hashes rechecked: true. Bundle compilation does not type-check by default and is not Edge ESZIP or live acceptance.

| Function | Errors | Local | Remote | Codes |
|---|---:|---:|---:|---|
| adjustment-rule-result | 18 | 0 | 18 | TS2303: 18 |
| analytics-emissions | 18 | 0 | 18 | TS2303: 18 |
| classify-document | 18 | 0 | 18 | TS2303: 18 |
| confirm-draft | 18 | 0 | 18 | TS2303: 18 |
| create-organization | 29 | 0 | 29 | TS2304: 26, TS2552: 3 |
| delete-uploaded-document | 21 | 3 | 18 | TS2303: 18, TS2339: 3 |
| enforce-subscription-status | 18 | 0 | 18 | TS2303: 18 |
| export-report-snapshot | 18 | 0 | 18 | TS2303: 18 |
| generate-report | 21 | 3 | 18 | TS2303: 18, TS2322: 3 |
| manual-transcription | 18 | 0 | 18 | TS2303: 18 |
| process-document | 18 | 0 | 18 | TS2303: 18 |
| recalculate-project | 18 | 0 | 18 | TS2303: 18 |
| run-ai-audit | 18 | 0 | 18 | TS2303: 18 |
| verify-upload-receipt | 21 | 3 | 18 | TS2303: 18, TS2339: 3 |

Counts are diagnostic instances, not a count of unique defects. See failure-summary.json for local file/line/excerpts and remote dependency locations; check-*.txt retain the complete sanitized compiler diagnostics.

Shared SDK literals are 2.49.4. create-organization retains floating @2 in the fixed source and resolved to 2.119.0 in this observed lock. No source import is rewritten. Re-resolving original TS during deployment without the frozen lock/artifact is BLOCKED.

Local errors: generate-report TS2322 for workspace/legal_entity/site inference (3); verify-upload-receipt and delete-uploaded-document TS2339 for unknown caught-error properties (3 each). Third-party types also fail. No skipLibCheck, source casts or alternate Deno version were used to mask them.

Bundles retain node: built-ins (including fs/net/tls/http in SDK dependencies). Their managed Edge support is NOT_RUN. Reference edge-runtime v1.78.1 uses Deno 2.1.4/deno_core 0.324.0; this differs from the local build/check Deno 2.9.8. The managed actual runtime is UNKNOWN and cannot be pinned here. This reference was not executed.

Large fixed-source/cache/bundle/map artifacts stay under ../tooling/deployment-20261107. manifest.json maps fixed Git blobs/SHA256, each function/transitive local source, remote resolutions and JS/map hashes. No .env, credentials, business handler, Deno serve, Docker or Supabase project service was used. Publication HOLD.
