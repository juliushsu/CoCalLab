# Next action

- UAT stays `7dccd5452152f2495d10ad1437d5d03215166065`; no merge/deployment.
- Export candidate PR #9 at `1e93fee...`; validation/guard PR #10 at `05916266...`: formatter/files tested, production export authority pending; actual browser saving unverified.
- Activity candidate: `codex/activity-detail-read-20261102`, base `4c34924b...`. Real scoped read-only detail replaces mock/fake verify. Frontend 64 tests + type/lint/build PASS; backend 16 PASS. Live RLS/authenticated React E2E unverified. See `ACTIVITY_DETAIL_DELIVERY_20261102.md`.
- Next: project statistics fields/units/errors, then draft confirmation contract. Existing stats queries nonexistent `co2e_total` and hides errors as zero.
- Next executable command from root: `node --test frontend/readdy-app/tests/*.test.ts` (existing Node 24.22.1 runtime on this PC).
- Session work is finite; no indefinite background agent is claimed.
