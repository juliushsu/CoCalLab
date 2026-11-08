# Dedicated local native PostgreSQL recovery rehearsal

Run from the repository root, explicitly selecting a completed synthetic
candidate run:

```powershell
node backend/tools/native-pg-recovery/run.mjs
node --test backend/tools/native-pg-recovery/verifier.test.mjs
node backend/tools/native-pg-recovery/run.mjs --run --source-run 20261108060154015-4430f35e
```

No flag prints help without credential reads or connections. The supplied run
must be a `NAMED_NATIVE_CASES_PASS` receipt for fixed product
`da5a0990c8ec82d2b55064dd7e009b771409fa73`, 44 schema migrations and 3 held
fixture scripts. The dedicated native target guard verifies PostgreSQL 17.11,
UTF8, `127.0.0.1:55439`, current user and the exact dedicated data directory.
Port 5432, cloud resources, arbitrary connection strings and arbitrary database
names are not accepted.

The existing candidate database is read-only. With no active source connections,
the runner creates a fresh `cocal_recovery_source_*` database using TEMPLATE;
it never terminates sessions. It uses the real trusted calculation/report RPCs
and the fixed product's report builder to save a 60 kg completed, server-verified
report in this new clone, including a private proof and durable request. It also
adds an explicitly synthetic viewer membership for authorization checks.

Official ZIP-entry and actual binary SHA256 plus `--version` verify `pg_dump`
and `pg_restore` 17.11. Dump uses custom format to an exclusively created file;
restore uses `--exit-on-error` into a fresh `cocal_recovery_restore_*` target.
Child processes use argument arrays without a shell. Inherited `PG*` variables
are removed and credentials are passed only through the child environment.
No roles, passwords or cluster-global objects are restored.

The archive, complete row snapshots and private proof data remain under the
restricted dedicated runtime's new `recovery/<run>/` directory. Actual NTFS ACLs
must allow only the current owner and privileged SYSTEM/Administrators. Ordinary
user grants fail closed. Raw evidence metadata is written outside Git under
`../tooling/native-pg17-20261108/recovery-runs/<run>/`. Publish only redacted
counts/digests, never the full dump, row snapshots or private proof.

Before business probes, the verifier compares every full row in all
public/auth/storage/cocal private tables as sorted PostgreSQL JSONB text. It
preserves exact numeric values and timestamps. It also compares sequence state,
schema/table/column/function ownership and grants, RLS policies, function bodies
and configuration, triggers, constraints including NOT VALID, defaults,
indexes, views, enums, extensions, default privileges, sequence ownership and
partition/inheritance definitions. Stable names/definitions replace physical
OIDs. NULL default ACLs and explicit equivalent owner ACLs use `acldefault`
with the correct object type and sorted complete ACL items; privileges are not
discarded.

Probes check source fingerprints, verified report read, saved-request lookup,
same-request replay, calculation authority lookup and tenant/role/private-proof
denials. Full snapshots must remain unchanged after probes. Source clone,
original candidate and archive hash are compared again afterward.

A third fresh `cocal_recovery_partial_*` target is intentionally incomplete.
Schema-only restore must fail the full verifier. Restoring public data alone
there makes the tenant/member/report present while private proof remains absent;
verified read must explicitly reject `REPORT_SNAPSHOT_UNVERIFIED`. Only this
new negative target uses `pg_restore --disable-triggers` during public COPY;
it is never accepted as a recovered database.

All databases, archives and initial failures are retained. The runner never
drops/resets/overwrites an existing target. Storage contains synthetic SQL catalog
rows only: actual object bytes are neither backed up nor restored. This is not
managed Supabase/cloud, cross-cluster roles/secrets, JWT, Storage HTTP, Edge or
browser acceptance. NOT VALID remains unvalidated; successful restore does not
prove historical data valid or authorize production release.
