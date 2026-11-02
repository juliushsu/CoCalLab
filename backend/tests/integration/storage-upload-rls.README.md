# Secure upload Storage and receipt SQL validation

This is **source and isolated SQL evidence only**. No cloud migration, bucket creation,
real file upload, database connection, or production resource operation is authorized
or performed by this test. Production release remains HOLD.

## Source contract and compatibility

`202611020001_secure_upload_storage.sql` is an incremental migration. It requires
the checked-in core schema, staging columns and Storage buckets, and retains the
existing membership/subscription helpers and tenant relationship constraints.
Existing rows and objects are not moved, deleted, rewritten, or validated as history.

| Bucket | Existing readable/deletable project path | New INSERT path |
| --- | --- | --- |
| `staging-receipts` | `staging/{projectUUID}/{legacyFilename}` | `staging/{projectUUID}/{documentV4UUID}.{pdf\|jpg\|jpeg\|png}` |
| `staging-attachments` | `staging/{projectUUID}/{legacyFilename}` | `staging/{projectUUID}/{documentV4UUID}.{pdf\|jpg\|jpeg\|png}` |
| `documents` | `{projectUUID}/{legacyFilename}` | `{projectUUID}/{documentV4UUID}.{pdf\|jpg\|jpeg\|png}` |

Legacy filenames must be one nonempty basename, excluding `.` and `..`. Paths with
additional directory levels, malformed project IDs, or historical fixture prefixes
such as `staging/fixtures/` are hidden rather than guessed into a tenant. No objects
are deleted by this change; Owner inventory is needed for such unmatched history.
Legacy project UUIDs need not be v4. New document basenames are lowercase v4 UUIDs
with a standard variant and a lowercase permitted extension. Clients use canonical
lowercase project UUIDs and `upsert:false`.

Reads require an active organization and active membership, including viewers.
INSERT and DELETE require owner/admin/editor and the existing
`organization_is_writable` helper; readonly/expired subscriptions do not permit
writes. The existing helper's accepted subscription semantics are unchanged.
Legacy DELETE is retained for these authorized writers. All client Storage UPDATE
operations are denied, including metadata overwrite, object rename, bucket moves
out of a protected bucket, and upsert of an existing object. Moving an unrelated
object into a protected bucket also fails. Policies for unrelated buckets are not
removed or changed.

Restrictive policies apply to PUBLIC and AND with the existing permissive chain.
The test deliberately adds broad PUBLIC permissive policies for both tables to
verify that permissive OR composition cannot bypass these guards. Anonymous roles
are denied even if the synthetic subject setting is populated. Helper schema usage
and execution ACLs allow evaluation; tests assert actual row filtering or policy
denials, rather than counting missing helper privileges as tenant isolation.

Private boolean lookup helpers use a fixed empty search path, qualified table and
function references, and SECURITY DEFINER only for project/organization reads.
They do not return project rows or replace/expose any public lookup RPC. Application
roles receive neither table ownership nor BYPASSRLS. Existing service-role
maintenance remains possible.

## Receipt writes

For a new authenticated `uploaded_documents` INSERT, the trigger requires:

- a current user matching `uploaded_by_user_id`, and a project belonging to the
  supplied organization with active writable membership;
- the pre-generated row UUID matching the v4 filename, matching project prefix,
  one of the protected buckets, and an existing readable Storage object;
- object ownership matching the current uploader, using `owner_id` or the legacy
  `owner` catalog field; missing ownership fails closed;
- `ocr_status=pending`, `status=active`, no archive timestamp, a positive byte
  count, a nonempty original filename, and a lowercase 64-character SHA256 value;
- staging bucket rows explicitly marked `env=staging,is_test=true`; documents
  rows explicitly marked `env=production,is_test=false`.

Clients cannot UPDATE receipt rows, including identity, environment, metadata, or
OCR status. This is intentionally stricter than only freezing identity: upload-only
does not authorize client claims that OCR succeeded. Service maintenance can update
OCR state. Authorized writers can DELETE receipt rows; legacy receipt SELECT is
preserved without forcing new receipt validation on existing history.

Legacy receipt SELECT and DELETE also require that `project_id` actually belongs
to `organization_id` and that the protected bucket/path resolves to that same
project. This private fixed-search-path binding helper is needed because existing
NOT VALID tenant constraints do not attest historical rows. It does not require
new v4 basenames, a current hash/environment format, a surviving object, or current
object ownership for legacy reads/deletes. A row with an unknown bucket, malformed
path, mixed project/organization, or a different project in its path is hidden and
cannot be deleted by application roles; the row is retained unchanged for approved
Owner inventory. No historical repair or object migration is performed.

### Versioned pre-upload capability probe

`public.upload_intake_contract(p_project_id uuid)` is a read-only SECURITY DEFINER
RPC with a fixed empty search path. PUBLIC and anon have no execution grant;
authenticated callers receive at most one row for the requested project, only
while an active member of its active organization. Cross-tenant, inactive, unknown
and inaccessible projects return no rows. The row has `project_id`,
`organization_id`, `contract_version='20261102'`, and `can_write`.

`can_write` combines the existing project/member/subscription write rule with all
three buckets being private, RLS enabled on both affected tables, all eight named
guards present as restrictive PUBLIC policies for their expected commands, and the
receipt trigger present and enabled. Viewers and readonly subscribers may read the
scoped row but receive false. The underlying deployment probe has no application
execution grant. The RPC does not create resources or change any row.

Clients must obtain and validate this exact version and scope before sending any
bytes. A deployment missing the migration has no RPC and must fail closed rather
than fall back to the old broadly permitted Storage policy. This readiness probe
does not certify that an administrator has not altered function bodies or guard
expressions, nor does it replace per-operation server enforcement or live E2E.

The database checks SHA256 **format**, not its correspondence to object bytes.
The caller/Storage API must compute and persist actual file size/hash. Catalog
ownership behavior must be verified against the real Storage service version.

Storage object creation and receipt insertion are separate operations. This does
not make them atomic or stop a later authorized delete from leaving an unreadable
file reference. Lost responses require reading the fixed attempt UUID and scope
back before retry; an uncertain receipt must not cause blind object deletion.
This test does not validate client recovery or complete file lifecycle behavior.

## Bucket deployment preflight and recovery

The source migration defines a private `documents` bucket when absent. **Actual
cloud creation or migration application remains unauthorized until Owner approval.**
Both staging buckets must already exist. Any existing protected bucket whose
public flag is not false aborts the entire migration; it is not silently made
private. The missing-documents and each public-drift case are tested in fresh
disposable engines. Public drift, catalog differences, existing paths outside the
supported format, and unmatched uploader metadata require a concrete Owner review.

Before an approved deployment, record the fixed source SHA, target project,
PostgreSQL/Storage versions, existing bucket flags and policy chain, catalog owner
fields, and representative legacy paths. Confirm that application roles cannot
create policies, assume privileged roles, or mutate the private helper schema.
Verify real authenticated HTTP upload, receipt save, private download/preview,
DELETE, invalid/expired JWTs, concurrent/lost responses and cross-tenant attempts
in an explicitly authorized isolated environment. No such live evidence is claimed.

Migration failure inside the transaction rolls back the source changes. After
successful application, recovery should preserve the restrictive guards while an
approved forward fix is prepared. Dropping them would restore broad legacy access;
do not offer that as a safe automatic rollback. No bucket or object deletion is
part of rollback. New upload clients can be disabled without exposing objects.

## Isolated command and evidence

PowerShell, from the repository root, using the external pinned runtime:

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/path/to/cocallab-sql-runtime'
node --test backend/tests/integration/storage-upload-rls.test.js
```

The test creates an in-memory PGlite database with explicitly synthetic `auth.uid`,
non-superuser/non-BYPASSRLS app roles, and minimal `storage.buckets`,
`storage.objects`, and `storage.foldername` catalog stubs. It loads all 30 checked-in
prerequisite schema/policy migrations in order, omitting only these fixture-data
files: `202603160008_v1_frontend_fixture_seed.sql`,
`202603180007_v1_staging_fixture_alignment.sql`, and
`202604070005_v1_adjustment_fixture_seed.sql`. Core tables, organization helpers,
existing Storage policies, tenant constraints and the migration under test are
actual source SQL. Synthetic fixture grants are deliberately broad so RLS is
tested independently from table ACLs.

Tests cover all three buckets; legacy reads/deletes; owner/admin/editor/viewer,
inactive/invited/outsider/readonly/archived/suspended cases; dual-tenant membership;
malformed/cross-tenant paths; UUID version/variant/extension checks; anonymous
access with a populated synthetic subject; UPDATE/upsert/rename; unrelated buckets;
receipt identity/environment/uploader/OCR/object ownership; membership revocation;
service maintenance; restrictive policy catalog and private/public bucket drift.
Historical mismatch coverage temporarily disables FK triggers only while the
synthetic in-memory database owner inserts explicitly invalid history, then restores
them before non-BYPASSRLS application SELECT/DELETE assertions. The raw owner query
confirms all invalid rows remain unchanged; valid legacy filename/hash/environment
receipts still support authorized reads/deletes. No production trigger is disabled.
The scoped capability RPC also covers ACL, role/scope/version, each missing/public
bucket, either table with RLS disabled, every missing guard, a permissive replacement
guard, and a disabled receipt trigger. Each drift case is rolled back only inside
the disposable engine, with healthy readiness rechecked afterward.

Runtime: PostgreSQL 18.6 / PGlite 0.5.13. This is **not** Supabase Auth/JWT,
Storage HTTP or browser E2E, migration acceptance on the live PostgreSQL version,
object-byte/hash verification, or a test of deployment/backup/restore.
