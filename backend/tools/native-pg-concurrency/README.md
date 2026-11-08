# Opt-in native PostgreSQL concurrency evidence

Run from the repository root:

```powershell
node backend/tools/native-pg-concurrency/run.mjs
node backend/tools/native-pg-concurrency/run.mjs --probe
node backend/tools/native-pg-concurrency/run.mjs --run
node backend/tools/native-pg-concurrency/run.mjs --candidate da5a0990c8ec82d2b55064dd7e009b771409fa73
node --test backend/tools/native-pg-concurrency/guard.test.mjs
```

No flag prints help without reading credentials or connecting. `--probe` only
checks the dedicated cluster. `--run` creates a **new** `cocal_sql_race_*`
database and leaves it intact. This runner is not part of default unit tests.
It does not drop databases, reset a cluster, or stop PostgreSQL.

The Owner-authorized local runtime must already exist. Its restricted launch
metadata is located using `../tooling/native-pg17-20261108/ascii-runtime.json`.
The runner accepts only PostgreSQL 17.11, UTF8, `127.0.0.1:55439`, the dedicated
data directory, and `cocal_uat_admin`. It does not accept connection strings,
`.env` settings, cloud hosts, or port 5432. The credential is read in memory and
is never printed. The external driver must be exactly `pg@8.16.3`; installation,
when explicitly authorized, should use `npm install --save-exact pg@8.16.3` in
the external `tooling/native-pg17-20261108/driver` directory.

The baseline is pinned to `ed6ca9bbfbc5581cdcacf2969340575217fcb8c4`.
`--candidate` accepts only the explicitly approved fixed SHA above; it loads
44 schema migrations (47 tracked scripts minus 3 held fixture scripts). It
does not read migration SQL from the changing working tree.

`result.json` is written outside the repository beneath
`../tooling/native-pg17-20261108/runs/<run-name>/`. It includes fixed product SHA,
43 applied schema migration hashes, 3 omitted historical fixture scripts,
three independent backend PIDs, actual SQL, lock observations, assertions and
unverified areas. Synthetic SQL Auth/Storage catalogs are explicit fixtures;
they do not constitute managed Supabase, JWT, Storage HTTP or deployment proof.
Successfully applying `NOT VALID` constraints does not validate historic rows.

The named cases exercise same-request recalculation, stale prepared inputs,
both reference/deletion orderings, same-request draft confirmation and
competing activity replacements. Application-level reply discard followed by
lookup is tested; this is not network packet-loss simulation.

The final baseline case intentionally demonstrates the existing N4 lock
inversion using actual deletion/manual-create RPCs. A test-only trigger pauses
deletion before its late project lock. Its observer barrier is released before
the natural two-backend cycle is recorded. A real PostgreSQL `40P01` victim,
rollback, winner state and safe retry are required. The result explicitly says
`NATIVE_EVIDENCE_WITH_OPEN_FINDING`; exit 0 means the evidence assertions ran,
**not** that N4 is resolved or production is approved. Other combinations and
managed service acceptance remain outside this runner's proof.

Candidate mode uses the same barrier to show the second caller waiting on the
early project row lock. Releasing the barrier lets deletion commit and the
manual caller receives the existing deletion fence, with no `40P01` in this
named schedule. It also checks ordinary-role RPC refusal, wrong-actor lease
release, the original service actor's cleanup after membership revocation,
finalize/replay and a finalize/MANUAL lock wait. This is bounded regression
evidence; it does not prove every possible lock ordering is free of deadlocks.
