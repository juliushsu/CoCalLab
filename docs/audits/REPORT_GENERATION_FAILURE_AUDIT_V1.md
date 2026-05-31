# Report Generation Failure Audit V1

Date: 2026-05-31

Canonical commit inspected: `50aa47ac70dcde529a9814293bbdcdac27a2dd2d`

Scope: audit only. No code change, no schema change, no feature change.

Failure under investigation:

```text
Failed to send a request to the Edge Function
```

## Summary

The Report Center generate flow calls the Supabase Edge Function named `generate-report`.

The Edge Function exists in the canonical repository under:

```text
backend/supabase/functions/generate-report/index.ts
```

The frontend route/function name is consistent with that folder name, but the request payload sent by the Report History generate dialog does not satisfy the canonical backend contract.

Primary confirmed frontend/backend mismatch:

| Required by backend | Sent by Report History dialog | Status |
| --- | --- | --- |
| `organization_id` | Not sent | Missing |
| `project_id` | Sent as `selectedProjectId` | Present |
| `report_version` | Not sent | Missing |
| `claim_purpose` | Not sent | Optional |
| `request_id` | Not sent | Optional |

If the deployed Edge Function is reachable and runs the current backend validator, the first concrete backend validation error for the current Report History payload is:

```text
organization_id must be a non-empty string
```

If `organization_id` is added but `report_version` remains missing, the next validator error is:

```text
report_version must be positive integer
```

The observed UI message `Failed to send a request to the Edge Function` is different from the backend validation envelope. That message usually means the Supabase client received an invocation/fetch-level error before a usable function response body was parsed. The current `EdgeFunctionService` does not expose HTTP status or response body when Supabase returns an invocation error; it only surfaces `error.name`, `error.message`, and `originalError`.

## Inspected Chain

### 1. UI Entry

Report Center itself is a capability/gating landing page. The available carbon inventory card navigates to report history:

```text
frontend/readdy-app/src/pages/admin/reports/ReportCenterPage.tsx
```

The actual generate modal is in:

```text
frontend/readdy-app/src/pages/admin/reports/ReportGenerationHistoryPage.tsx
```

Relevant call:

```tsx
const response = await EdgeFunctionService.invoke({
  functionName: 'generate-report',
  payload: {
    project_id: selectedProjectId,
    language: reportLanguage,
    report_type: 'annual',
  },
});
```

Source: `ReportGenerationHistoryPage.tsx:110-117`.

### 2. Frontend Service

All Edge Function calls go through:

```text
frontend/readdy-app/src/services/edgeFunction.ts
```

The service calls:

```ts
supabase.functions.invoke(functionName, {
  body: payload,
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
});
```

Source: `edgeFunction.ts:31-38`.

Important audit finding: when `supabase.functions.invoke` returns `error`, the service wraps only:

```ts
code: error.name || 'EDGE_FUNCTION_ERROR'
message: error.message || 'Edge Function invocation failed'
details: { originalError: error }
```

Source: `edgeFunction.ts:40-49`.

It does not extract or display:

- HTTP status
- Edge Function response body
- `meta.request_id`
- Supabase function region/URL

Therefore, from the current UI code alone, the exact HTTP status/body for a deployed runtime failure cannot be recovered unless the browser console/network tab or Supabase function logs are inspected.

### 3. Edge Function Route

Frontend function name:

```text
generate-report
```

Repo function folder:

```text
backend/supabase/functions/generate-report/index.ts
```

This route name is correct if the backend Supabase functions folder is deployed.

Deployment caveat found in repo layout:

```text
frontend/readdy-app/supabase/functions/create-organization/index.ts
```

Only `create-organization` exists under the frontend app's local `supabase/functions` folder. The full function set, including `generate-report`, lives under `backend/supabase/functions`. If deployment tooling is pointed at `frontend/readdy-app/supabase` instead of `backend/supabase`, `generate-report` would not be deployed from that path. This audit did not query the live Supabase project, so deployed status is not proven by local files alone.

### 4. Backend Contract / DTO

Canonical backend contract:

```js
GENERATE_REPORT_CONTRACT.input.required = [
  'organization_id',
  'project_id',
  'report_version',
]
```

Source: `backend/src/contracts/contracts.js:99-103`.

Validator:

```js
assertUuid(input.organization_id, 'organization_id');
assertUuid(input.project_id, 'project_id');
if (!Number.isInteger(input.report_version) || input.report_version < 1) {
  throw new Error('report_version must be positive integer');
}
```

Source: `backend/src/contracts/contracts.js:189-200`.

Direct validator result using the current Report History payload shape:

```text
organization_id must be a non-empty string
```

Direct validator result after adding only `organization_id` but still omitting `report_version`:

```text
report_version must be positive integer
```

### 5. Edge Function Behavior

The Edge Function starts with:

```ts
const input = validateGenerateReportInput(await parseJson(request));
const supabase = createServiceRoleClient();
const actor = await requireOrganizationWriteAccess(request, supabase, input.organization_id);
```

Source: `backend/supabase/functions/generate-report/index.ts:38-42`.

Expected backend envelope for generic validation failure:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "GENERATE_REPORT_FAILED",
    "message": "organization_id must be a non-empty string"
  },
  "meta": {
    "status": "failed",
    "warnings": []
  }
}
```

HTTP status from code path: `400`.

Source: `backend/supabase/functions/generate-report/index.ts:298-309`.

Expected backend authz failures after payload validation:

| Condition | Code | HTTP |
| --- | --- | --- |
| Missing Authorization header | `AUTH_REQUIRED` | 401 |
| Invalid JWT | `INVALID_JWT` | 401 |
| Active member missing or role not owner/admin/editor | `FORBIDDEN_ROLE` | 403 |

Source: `backend/supabase/functions/_shared/authz.ts:22-48`.

Expected subscription block after authorization:

| Condition | Code | HTTP |
| --- | --- | --- |
| Subscription cannot generate reports | `SUBSCRIPTION_REPORT_BLOCKED` | 403 |

Source: `backend/supabase/functions/generate-report/index.ts:55-65`.

Expected project mismatch/not-found:

| Condition | Code | HTTP |
| --- | --- | --- |
| Project not found under `organization_id + project_id` | `PROJECT_NOT_FOUND` | 404 |

Source: `backend/supabase/functions/generate-report/index.ts:68-78`.

Expected atomic insert/RPC failure:

| Condition | Code | HTTP |
| --- | --- | --- |
| `generate_report_atomic` fails, including duplicate `(project_id, report_version)` | `GENERATE_REPORT_ATOMIC_FAILED` | 409 |

Source: `backend/supabase/functions/generate-report/index.ts:230-234`.

### 6. Backend Response Shape

Successful canonical backend response data:

```ts
{
  report_generation_id,
  status,
  claim_purpose,
  gross_emissions_snapshot,
  adjustment_summary,
  claim_results,
  adjustment_manifest,
  legal_entity_snapshot,
  site_snapshot,
  boundary_snapshot,
  payload,
  warning_count,
}
```

Source: `backend/supabase/functions/generate-report/index.ts:280-297`.

The Report History dialog only checks `response.success`; it does not parse success payload. Therefore, DTO drift does not block the History dialog success path once the backend request contract is satisfied.

However, `ReportPreviewPage.tsx` contains an unused `handleGenerateReport` path that expects a different response DTO:

```ts
{
  report_version_id,
  project_id,
  version_number,
  total_sections,
  completed_sections,
  report_status,
  sections,
  statistics,
  message,
}
```

That shape is not returned by the current backend `generate-report` function. If this preview generation path is wired later, it will need DTO alignment rather than only payload fixes.

## Request Payload Audit

### Report History Generate Dialog

File:

```text
frontend/readdy-app/src/pages/admin/reports/ReportGenerationHistoryPage.tsx
```

Actual payload:

```json
{
  "project_id": "<selectedProjectId>",
  "language": "zh|en|ja",
  "report_type": "annual"
}
```

Missing:

- `organization_id`
- `report_version`

Extra / ignored by backend validator:

- `language`
- `report_type`

Impact:

- The backend validator fails before authz, DB reads, RLS, subscription checks, payload building, or atomic insert.

### Report Preview Generate Handler

File:

```text
frontend/readdy-app/src/pages/admin/reports/ReportPreviewPage.tsx
```

Actual payload in handler:

```json
{
  "project_id": "<projectId>",
  "report_type": "full",
  "include_statistics": true,
  "include_charts": true,
  "language": "zh-TW"
}
```

Missing:

- `organization_id`
- `report_version`

Extra / ignored by backend validator:

- `report_type`
- `include_statistics`
- `include_charts`
- `language`

Additional finding:

- `handleGenerateReport` is defined but not currently invoked by any button in `ReportPreviewPage.tsx`.
- `handleRegenerateSection` calls `regenerate-section`, but no such Edge Function exists in the canonical backend function set. This is adjacent report-surface drift, not the current Report Center generate failure.

## Schema / Persistence Audit

`report_generations` table requires:

```sql
organization_id uuid not null,
project_id uuid not null,
report_version integer not null,
payload jsonb not null,
payload_hash text not null,
reporting_period_start date not null,
reporting_period_end date not null
```

Source: `backend/supabase/migrations/202603160001_v1_core_schema.sql:352-377`.

The unique index is:

```sql
create unique index report_generations_project_version_uniq
  on report_generations (project_id, report_version);
```

Source: `backend/supabase/migrations/202603160001_v1_core_schema.sql:379-380`.

Implication:

- Frontend cannot safely hardcode `report_version = 1` after one report already exists for a project.
- A minimal canonical fix needs a deterministic version strategy, such as fetching latest report version per project and sending next version, or moving version allocation into the Edge Function/RPC contract.

## RLS / Authz Audit

The Edge Function uses a service-role client for DB reads/writes, but it validates the caller via request-scoped JWT and `organization_members`:

```ts
requireOrganizationWriteAccess(request, supabase, input.organization_id)
```

Source: `backend/supabase/functions/generate-report/index.ts:40-42`.

RLS policies still exist on `report_generations`:

```sql
create policy report_generations_select_policy
  on report_generations for select
  using (is_active_org_member(organization_id));

create policy report_generations_write_policy
  on report_generations for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );
```

Source: `backend/supabase/migrations/202603160001_v1_core_schema.sql:581-583` and `634-640`.

Conclusion:

- The current confirmed failure is not RLS, because the request fails validation before DB access when `organization_id` is absent.
- RLS/authz can still block later after payload is fixed if the caller is not an active owner/admin/editor in the target workspace.
- Subscription can also block later with `SUBSCRIPTION_REPORT_BLOCKED` if report generation is not allowed.

## Direct Answers

### A. Edge Function 是否存在？

Repo-local answer: yes.

Path:

```text
backend/supabase/functions/generate-report/index.ts
```

Deployment answer: not proven by local audit. There is a repo layout risk because `frontend/readdy-app/supabase/functions` contains only `create-organization`, while `generate-report` lives under `backend/supabase/functions`.

### B. Route 是否正確？

Code-level route name is correct:

```text
generate-report
```

It matches the backend function folder name. If the live Supabase project has not deployed `backend/supabase/functions/generate-report`, runtime invocation may still fail before a backend envelope is returned.

### C. 需要哪些欄位？

Required:

- `organization_id`: UUID
- `project_id`: UUID
- `report_version`: positive integer

Optional:

- `claim_purpose`: one of `taiwan_carbon_fee`, `voluntary_claim`, `ifrs_s2_note`, `esg_note`, `internal_management`
- `request_id`: string

### D. 是否缺 project_id？

No for the Report History dialog. It sends `project_id: selectedProjectId`.

Potential caveat: if `selectedProjectId` is empty, UI stops before invoking the function.

### E. 是否缺 organization_id？

Yes. This is the first confirmed contract failure for the current Report History generate payload.

### F. 是否缺 report DTO？

Yes, in two ways:

1. Request DTO mismatch: frontend does not send `organization_id` or `report_version`.
2. Response DTO drift exists in `ReportPreviewPage.tsx`: it expects report sections/statistics fields that the canonical backend does not return from `generate-report`.

The History dialog success path is less affected by response DTO drift because it only checks `response.success`.

### G. 是否被 RLS 擋住？

Not for the currently inspected payload failure. Missing `organization_id` fails validation before RLS/authz/DB logic.

RLS/authz may become the next blocker after fixing the payload if:

- no Authorization header/JWT is sent,
- the JWT cannot resolve a user,
- the user is not active owner/admin/editor for `organization_id`,
- organization subscription is readonly/suspended for report generation.

## Confirmed Error Messages

From direct execution of the canonical backend validator with the current frontend History payload shape:

```text
organization_id must be a non-empty string
```

From direct execution after adding only `organization_id` but still omitting `report_version`:

```text
report_version must be positive integer
```

From the current UI/service layer, the reported message:

```text
Failed to send a request to the Edge Function
```

means the frontend is receiving a Supabase invocation-level error. The current code does not preserve HTTP status or response body in user-visible error state, so the live HTTP status/body cannot be confirmed from repository files alone.

## Likely Failure Order

Based on inspected code only:

1. If live `generate-report` is not deployed or unreachable, frontend shows `Failed to send a request to the Edge Function`; no backend envelope is available.
2. If live `generate-report` is deployed and reachable, current History payload fails backend validation with HTTP 400 and `GENERATE_REPORT_FAILED`.
3. After adding `organization_id`, it fails with `report_version must be positive integer` until versioning is provided.
4. After adding `organization_id` and `report_version`, authz/subscription/project lookup/RPC can become later blockers.

## Minimal Fix Direction For Next Sprint

No code was changed in this audit. The minimum future implementation plan should be:

1. Confirm deployment path: ensure `backend/supabase/functions/generate-report` is deployed to the same Supabase project used by `VITE_PUBLIC_SUPABASE_URL`.
2. Update frontend generate request contract to include `organization_id`.
3. Decide canonical `report_version` allocation:
   - frontend computes next version from existing `report_generations`, or
   - backend accepts no `report_version` and allocates atomically.
4. Remove or align unsupported request fields:
   - `language`
   - `report_type`
   - `include_statistics`
   - `include_charts`
5. Align frontend report generation response types with canonical backend output.
6. Preserve visible staging/beta warning: generated reports are internal preview only, not formal compliance output.

## Risk Rating

| Finding | Risk | Beta impact |
| --- | --- | --- |
| Missing `organization_id` | P0 | Report generation fails before backend work starts. |
| Missing `report_version` | P0 | Report generation still fails after org is added. |
| Possible deployment path mismatch | P0 | Produces invocation-level failure with no backend body. |
| Preview response DTO drift | P1 | Future preview generation path breaks or renders wrong assumptions. |
| Error service hides HTTP status/body | P1 | Debugging is slow; testers only see generic failure. |
| `regenerate-section` function referenced but absent | P2 | Adjacent report preview action is not production-like. |

