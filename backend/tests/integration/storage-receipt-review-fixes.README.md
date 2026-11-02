# Storage receipt review fixes: red/green SQL evidence

Scope: P2-S3 metadata binding, P3-a canonical new project paths, and P3-f source
compatibility drift detection from the fixed Claude review. Original migration
`202611020001_secure_upload_storage.sql` is unchanged. The correction is incremental
`202611020002_storage_receipt_review_fixes.sql`. No cloud connection, migration,
bucket creation, actual upload, production data, cost or deployment is authorized
or performed. Release remains HOLD.

## Reproduce the original defects (RED)

Run from the repository root in PowerShell with the pinned external runtime:

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/path/to/cocallab-sql-runtime'
$env:STORAGE_REVIEW_BASELINE='1'
node --test backend/tests/integration/storage-receipt-review-fixes.test.js
```

This intentionally fails; it loads the full prerequisite policy/schema chain and
001, omitting 002. Before writing 002, the run produced **9 failed defect subtests
(10 failures including their parent), exit code 1**:

- Own object `metadata={size:16,mimetype:application/pdf}` with receipt size 1:
  the receipt INSERT succeeded instead of raising 42501.
- Own PNG metadata with a PDF receipt, and NULL metadata: both INSERTs succeeded.
- New uppercase project prefix: object catalog INSERT succeeded instead of failing.
- Replacing an existing restrictive guard expression with true, replacing the
  trigger with AFTER UPDATE only, changing helper body, search_path or execution
  ACL: each capability probe incorrectly returned `can_write=true`.

The first four fail with “Missing expected rejection”; the five drift tests fail
with `true !== false`. They execute direct SQL with a non-superuser, non-BYPASSRLS
`authenticated` role and a synthetic subject, not a frontend validation stub.

## Corrected source (GREEN)

```powershell
Remove-Item Env:STORAGE_REVIEW_BASELINE -ErrorAction SilentlyContinue
node --test backend/tests/integration/storage-receipt-review-fixes.test.js
node --test backend/tests/integration/storage-upload-rls.test.js
```

The new suite loads all 30 prerequisite migrations, then actual 001 and 002 source.
Only the same three fixture-data migrations excluded by the original Storage suite
are omitted. Existing policies, tenant relationships and membership/subscription
helpers are not replaced. Original 001's suite remains independently runnable with
all its previous positive/negative cases and its historical metadata-free fixtures.

Observed locally on PostgreSQL 18.6 / PGlite 0.5.13: corrected review suite
**61/61 passed** (60 subtests plus parent). The original 001 Storage suite separately
passed **32/32** unchanged; no 001 acceptance is represented as a 002 test.

Both suites use only fresh in-memory engines, explicit minimal `storage.buckets`,
`storage.objects`, `storage.foldername`, synthetic `auth.uid()` and test roles.
The catalog stub has no object bytes or Storage HTTP behavior. Broad PUBLIC
permissive policies deliberately remain present when testing actual restrictive
guards and receipt triggers.

## Metadata contract and deliberate type choices

The new BEFORE INSERT receipt trigger applies to direct authenticated writes,
including callers that bypass the UI. The original identity, membership, writable
subscription, UUID/path, environment, initial state and object-owner guard remains
in force. Service maintenance remains supported. Existing history is not repaired
or forced through the new INSERT rule.

`storage.objects.metadata` must be a JSON object with:

- `size`: a JSON **number**, represented by JSONB as unsigned decimal integer
  digits, strictly positive, no larger than signed bigint, and exactly equal to
  `uploaded_documents.file_size_bytes`;
- `mimetype`: a string exactly one of `application/pdf`, `image/jpeg`, `image/png`,
  exactly equal to `uploaded_documents.mime_type`.

Missing metadata/fields, NULL, arrays/scalars, string sizes (even `"16"`), booleans,
negative/zero/fractional sizes, overflow, noncanonical/unknown MIME, and mismatches
all raise **42501**. Decimal-rendered JSONB `16.0` is intentionally rejected;
PostgreSQL may normalize exponent notation such as `1e1` into integer digits.
No whitespace/case/alias coercion is performed. Range/text checks precede the
bigint cast, so malformed sizes do not leak cast/overflow error codes. Raw-JSON
tests cover `16.0`, `9223372036854775808`, and `1e100`.

Real Storage metadata shape remains NOT_RUN. The service's MIME reflects the
uploaded Content-Type; consistency is not proof that the actual bytes are a valid
PDF/image. This change does not add a parser or server byte inspection.

## Canonical INSERT paths, preserved legacy access

002 changes only the new-document parser: the project's path segment must equal
its canonical lowercase UUID text. All three protected buckets reject uppercase
new INSERT paths under RLS; tests also verify no object catalog row was inserted.
The legacy project parser is unchanged. Synthetic old uppercase paths and legacy
basenames/hash/environment still permit authorized object/receipt SELECT and
DELETE. The tests do not claim when the real Storage HTTP service reads incoming
bytes relative to its catalog transaction; that ordering is NOT_RUN.

## Deployment fingerprint and its boundary

The scoped compatibility RPC now reports version **`20261102.2`**. A new client
must reject 001's `20261102` version before attempting a write. The preflight is
only a client/source compatibility check. RLS and receipt triggers independently
enforce each write; the RPC neither grants authority nor repairs a weakened policy.

002 installs an owner-only private baseline once, after its definitions and ACLs.
It compares both directions of current versus expected catalog tuples, including:

- all eight guard expressions (`polqual`/`polwithcheck`), command, roles and
  restrictive mode;
- both receipt triggers' definitions, function, enabled state, `tgtype`, timing,
  events and WHEN/argument clauses; explicit required row/BEFORE/INSERT/UPDATE bits
  are also checked;
- private helper bodies plus the public scoped RPC, existing membership/writable
  helper and platform `auth.uid()` definition; owners, ACLs, SECURITY DEFINER,
  volatility, leakproof flag and function configuration/search_path;
- related schema owners/ACLs and the baseline table's owner/ACL/RLS state.

NULL catalog fields are serialized explicitly or coalesced before hashing. Missing
rows and changed hashes are detected by set difference rather than nullable `<>`
comparisons. Neither application roles nor service_role receive baseline table or
catalog-probe execution grants. Tests prove healthy readiness true, app access
denied, each change false, and healthy readiness restored after disposable rollback.
Readiness additionally retains the private-bucket and affected-table RLS checks.

This is an **installation-time compatibility snapshot, not a security boundary
against a DDL/database owner**. The installer must review the original source and
live prerequisites before approved installation; a baseline cannot certify that a
preexisting deployment was trustworthy. A DDL owner can change the probe or baseline
itself. Probes never learn/rebaseline at runtime. Subsequent approved source or
platform upgrades require an explicit reviewed baseline update; a false result
stops compatible clients and requires diagnosis, not automatic acceptance of drift.

## OPEN: server SHA verification and hash-unique poisoning

SQL continues to check only lowercase 64-character SHA **format**. It cannot read
Storage object bytes to verify the claimed hash. A direct authorized caller can
still submit a format-valid forged SHA while matching object size/MIME, reserve the
`(project_id,sha256_hash)` unique key, and block another registration claiming that
hash. The suite explicitly accepts the first forged-hash receipt and verifies the
second insert fails with unique violation 23505. This is **OPEN**, not fixed by
metadata consistency, browser downloads, or the fingerprint.

Server-side byte/hash attestation requires a separately reviewed service path.
No new paid AI, worker, data transfer or cloud resource is introduced here.

## Still NOT_RUN / BLOCKED

Supabase Auth/JWT verification, PostgREST schema exposure, actual `current_user`,
Storage ownership/metadata and SDK HTTP semantics, real uploads/downloads, native
file chooser, concurrency in the actual services, target PostgreSQL compatibility,
cloud application/backup/restore and production deployment remain unverified.
The separate frontend recovery work is not tested or claimed by this SQL suite.
