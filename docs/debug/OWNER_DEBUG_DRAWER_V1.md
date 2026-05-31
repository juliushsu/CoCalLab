# Owner Debug Drawer V1

Status: canonical governance specification only. No code, no schema, no route implementation, no backend change.

Date: 2026-05-31

Canonical source:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/debug/OWNER_DEBUG_DRAWER_V1.md
- Related failure audit: https://github.com/juliushsu/CoCalLab/blob/main/docs/audits/REPORT_GENERATION_FAILURE_AUDIT_V1.md
- Related payload fix: https://github.com/juliushsu/CoCalLab/commit/3296224b8375f23e8c3b979afb60c14d3b8531be

## Purpose

The Owner Debug Drawer is a restricted troubleshooting surface for guided staging and carefully gated production support.

It helps owners and platform administrators diagnose failed requests, feature-gate state, mock/real-data confusion, and report/document workflow failures without exposing secrets, tokens, full payloads, uploaded content, OCR text, report content, or unnecessary personal data.

Core rule:

```text
Debug visibility must improve support speed without increasing data exposure.
```

## Non-Goals

This specification does not authorize:

- New backend APIs.
- Schema changes.
- Public debug routes.
- Full request/response payload capture.
- Token inspection.
- OCR/report/document content display.
- Production default enablement.
- Any bypass of RLS, role checks, subscription gates, or feature gates.

## Access Model

The drawer must be available only to:

- Workspace `owner`.
- `platform_admin`.

It must not be visible to:

- Viewer.
- Editor.
- Consultant.
- Auditor.
- Accounting-firm user unless that user is also workspace owner.
- Anonymous user.
- Any user outside the active workspace.

Direct URL rule:

- The drawer must not be implemented as a standalone route.
- A direct URL must not open it.
- If a route is ever introduced later for internal tooling, it must return `NotFound` or an explicit blocked state for all non-owner/platform-admin users.

## Environment Policy

| Environment | Default | Requirement |
| --- | --- | --- |
| Staging | Visible for owner/platform_admin | Allowed by default for guided closed beta support. |
| Production | Off | Requires explicit feature flag and owner/platform_admin role. |
| Local development | Visible to authenticated owner/platform_admin test users | Must still redact secrets and payloads. |

Production enablement requires a feature flag such as:

```text
owner_debug_drawer_enabled
```

The feature flag must be evaluated before rendering the drawer entry point.

## Allowed Information

The drawer may display the following fields after redaction rules are applied.

### App / Runtime Context

| Field | Example | Notes |
| --- | --- | --- |
| `environment` | `staging`, `production`, `local` | Must come from trusted app config. |
| `app_version` | `0.0.0` | Package/app version if available. |
| `commit_hash` | `3296224` | Short hash is enough. |
| `current_route` | `/admin/reports/history` | Query params must be redacted if they contain sensitive values. |
| `timestamp` | ISO datetime | Drawer render timestamp and trace timestamps. |

### Current Actor Context

| Field | Example | Redaction |
| --- | --- | --- |
| `user_email_masked` | `jo***@example.com` | Do not show full email. |
| `user_id_masked` | `a123...9f00` | First 4 and last 4 characters only. |
| `role` | `owner` | Current workspace role only. |
| `workspace_id` / `organization_id` | UUID or masked UUID | Prefer masked display in production. |

Allowed masking examples:

```text
julius@example.com -> ju***@example.com
a1111111-1111-4111-8111-111111111111 -> a111...1111
```

### Selection Context

| Field | Notes |
| --- | --- |
| `selected_project_id` | Allowed, preferably masked in production. |
| `selected_legal_entity_id` | Allowed if present, preferably masked in production. |
| `selected_site_id` | Allowed if present, preferably masked in production. |
| `workspace_label` | Allowed if not sensitive. |
| `project_label` | Allowed if not sensitive. |

### Feature / Data-State Context

Allowed:

- Feature flags.
- Beta flags.
- Staging flags.
- Readonly/subscription status.
- Mock/real data indicators.
- Capability status such as `available`, `coming_soon`, `hidden`, `disabled`.

Examples:

```json
{
  "environment": "staging",
  "beta_flags": {
    "closed_beta": true,
    "report_preview_only": true
  },
  "mock_real_data": {
    "report_snapshot": "real",
    "adjustment_rule_result": "mock"
  }
}
```

### Last Edge Function Calls

The drawer may show the most recent 20 redacted Edge Function traces.

Allowed trace fields:

| Field | Required | Notes |
| --- | --- | --- |
| `function_name` | Yes | Example: `generate-report`. |
| `http_status` | Yes if available | Example: `400`, `403`, `500`. |
| `backend_error_code` | Yes if available | Example: `GENERATE_REPORT_FAILED`. |
| `backend_error_message` | Yes if available | Validation/support message only. |
| `request_id` | Yes if available | From backend `meta.request_id` or generated client request id. |
| `timestamp` | Yes | ISO datetime. |
| `duration_ms` | Yes if measured | Rounded integer. |
| `route_at_call_time` | Recommended | Redacted route. |
| `workflow` | Recommended | Example: `report_generation`, `document_upload`. |
| `redaction_status` | Yes | Example: `redacted`. |

Example safe trace:

```json
{
  "function_name": "generate-report",
  "http_status": 400,
  "backend_error_code": "GENERATE_REPORT_FAILED",
  "backend_error_message": "report_version must be positive integer",
  "request_id": "req-abc123",
  "timestamp": "2026-05-31T08:30:00.000Z",
  "duration_ms": 842,
  "route_at_call_time": "/admin/reports/history",
  "workflow": "report_generation",
  "redaction_status": "redacted"
}
```

## Forbidden Information

The drawer must never display, store in copyable debug bundles, or persist in local debug logs:

- Access token.
- Refresh token.
- API key.
- Supabase anon key.
- Supabase service role key.
- Authorization header.
- Full request headers.
- Cookies.
- Session object.
- Full raw request payload.
- Full raw response payload.
- Uploaded file content.
- Uploaded file binary.
- Full OCR text.
- OCR raw payload.
- Full report content.
- Full report section content.
- Full document text.
- Full raw LLM prompt.
- Full raw LLM response.
- Personal data beyond masked email/id.
- Customer tax ID unless explicitly masked.
- Legal entity registration number unless explicitly masked.
- Any secret-like string.

Secret-like strings include:

- JWT-looking values.
- `sbp_`, `sk_`, `pk_`, `eyJ`, or similar token/key prefixes.
- Long base64/base64url strings.
- Bearer tokens.
- Values from `Authorization`, `apikey`, or cookie headers.

## Redaction Rules

All traces and bundles must pass through redaction before display or copy.

### Required Redaction

| Input type | Required output |
| --- | --- |
| Email | Mask local part, keep domain if acceptable: `jo***@example.com`. |
| UUID | Mask middle: `a111...1111`. |
| Request headers | Drop entirely. |
| Authorization value | Drop entirely; never mask/display. |
| Tokens/API keys | Replace with `[REDACTED_SECRET]`. |
| Full request body | Do not capture. |
| Full response body | Do not capture. |
| OCR/report/document content | Do not capture. |
| Error message | Allow only backend validation/support message. |

### Payload Summary Instead Of Payload

The drawer may show a payload summary, never the full payload.

Allowed payload summary example:

```json
{
  "payload_keys": ["organization_id", "project_id", "report_version", "language", "claim_purpose", "request_id"],
  "required_fields_present": true,
  "missing_required_fields": []
}
```

Forbidden payload example:

```json
{
  "raw_payload": {
    "ocr_text": "...",
    "report_content": "...",
    "Authorization": "Bearer ..."
  }
}
```

## UI Behavior

### Entry Point

Recommended:

- Small debug icon/button in admin shell footer or support menu.
- Visible only after role and environment/feature-flag checks pass.
- Hidden by default for all non-owner/platform-admin users.

Do not:

- Add sidebar navigation item.
- Add public route.
- Add marketing/help page entry.
- Show in mobile-only public surfaces.

### Drawer Layout

Suggested sections:

1. App Context
2. Current Actor
3. Current Workspace / Project
4. Feature Flags
5. Mock vs Real Data
6. Last Edge Function Calls
7. Copy Redacted Debug Bundle
8. Clear Local Debug Logs

### Trace Retention

Rules:

- Keep only the most recent 20 Edge Function traces.
- Store client-side only unless a future canonical backend logging design is approved.
- Clear logs on user logout.
- Provide a `Clear local debug logs` action.
- Each trace must have `redaction_status: "redacted"`.
- Trace retention must not include full payload or headers.

### Copy Debug Bundle

The drawer may include a `Copy redacted debug bundle` action.

The bundle must include:

- Environment.
- App version / commit hash.
- Current route.
- Masked user email/id.
- Role.
- Workspace/project context.
- Feature/beta flags.
- Mock/real indicators.
- Last 20 redacted Edge Function traces.

The bundle must not include:

- Tokens.
- Headers.
- Cookies.
- Full payloads.
- Full OCR text.
- Full report content.
- Uploaded file content.
- Full personal data.

Bundle top-level example:

```json
{
  "bundle_version": "owner_debug_drawer_v1",
  "environment": "staging",
  "commit_hash": "3296224",
  "current_route": "/admin/reports/history",
  "actor": {
    "email": "jo***@example.com",
    "user_id": "a123...9f00",
    "role": "owner"
  },
  "workspace": {
    "organization_id": "a111...1111"
  },
  "selection": {
    "project_id": "a333...1111",
    "legal_entity_id": null,
    "site_id": null
  },
  "feature_flags": {
    "owner_debug_drawer_enabled": true,
    "closed_beta": true
  },
  "traces": []
}
```

## Integration Points

### EdgeFunctionService

Purpose:

- Capture redacted trace metadata for every Edge Function call.
- Preserve function name, HTTP status, backend error code/message, request id, timestamp, and duration.
- Never capture headers, tokens, or full payloads.

Trace sources:

- Supabase function name.
- Response status from invocation error context if available.
- Backend envelope fields:
  - `error.code`
  - `error.message`
  - `meta.request_id`
- Client-generated request id when backend request id is absent.

### Report Generation

Relevant workflows:

- Report Center generate report.
- Report History generate dialog.
- Report Preview generate handler if used later.

Must display:

- `generate-report` trace.
- `project_id` masked.
- `organization_id` masked.
- `report_version`.
- Payload summary keys, not payload values except non-sensitive version/language/claim purpose.

Must not display:

- Report payload.
- Full report content.
- Full report sections.

### Document Upload

Relevant workflows:

- Upload document.
- `process-document`.
- `classify-document`.

Must display:

- Function name.
- HTTP status.
- Error code/message.
- Request id.
- Uploaded file metadata only if safe:
  - filename may be sensitive; prefer redacted or basename truncated.
  - MIME type allowed.
  - file size allowed.

Must not display:

- Uploaded file content.
- Storage signed URL.
- Full OCR text.
- OCR raw payload.

### Draft Review

Relevant workflows:

- `confirm-draft`.
- Draft approve/reject.

Must display:

- Draft id masked.
- Function name.
- Error code/message.
- Request id.

Must not display:

- Full normalized payload.
- Full raw OCR payload.
- Full extracted text.

### Activity Creation

Relevant workflows:

- Activity create.
- Confirm draft to activity.
- Recalculate project.

Must display:

- Function name.
- Activity id masked if available.
- Project id masked.
- Error code/message.

Must not display:

- Full activity detail payload if it contains vendor, notes, or document-derived personal data.

### Analytics Calls

Relevant workflows:

- Analytics read.
- `analytics-emissions`.

Must display:

- Function name.
- Query dimension.
- HTTP status.
- Error code/message.
- Request id.

Must not display:

- Full analytics raw result if it could expose customer-level operational data.

### AI Explanation Future Calls

Relevant workflows:

- Draft Review Explanation.
- Missing Data Explanation.
- Factor Explanation.
- Report Executive Summary if approved later.

Must display:

- AI touchpoint name.
- Governance level.
- Request id.
- Model/provider label if approved.
- Redacted source identifiers.
- Human review requirement.

Must not display:

- Full prompt.
- Full completion.
- Full OCR text.
- Full report section.
- Tokens/API keys.
- Provider secret configuration.

## Data Classification

| Data | Classification | Drawer treatment |
| --- | --- | --- |
| Environment | Low sensitivity | Show. |
| Route | Low/medium | Show redacted route. |
| User email | Personal data | Mask. |
| User id | Internal identifier | Mask. |
| Workspace/project id | Internal identifier | Mask in production; allowed in staging if still redacted in copy bundle. |
| Edge function name | Low sensitivity | Show. |
| HTTP status | Low sensitivity | Show. |
| Backend error message | Medium | Show validation/support message only. |
| Request id | Low/medium | Show. |
| Payload keys | Low/medium | Show. |
| Full payload | High | Forbidden. |
| OCR/report/upload content | High | Forbidden. |
| Tokens/secrets | Critical | Forbidden. |

## Acceptance Criteria

The implementation is acceptable only if all criteria are met:

- Non-owner users cannot see the drawer entry point.
- Non-owner users cannot open the drawer by direct URL, keyboard shortcut, dev-only route, or local state manipulation.
- `platform_admin` access is explicitly gated and auditable.
- Staging owner access works by default.
- Production access is off by default and requires feature flag.
- No access token leakage.
- No refresh token leakage.
- No API key leakage.
- No Supabase anon key or service role key leakage.
- No Authorization header leakage.
- No full request headers.
- No full request payload.
- No uploaded file content.
- No full OCR text.
- No full report content.
- No secret-like strings in displayed traces or copied bundle.
- Debug bundle is redacted before copy.
- Clear local debug logs action works.
- At most 20 traces are retained.
- Every trace includes `redaction_status`.
- Edge function trace includes function name, timestamp, and duration if measurable.
- Failed Edge Function trace includes HTTP status/error code/message/request id when available.
- Build passes.
- Type-check passes.

## Manual Review Checklist

Before shipping the drawer:

| Check | Expected result |
| --- | --- |
| Viewer login | Drawer not visible. |
| Editor login | Drawer not visible. |
| Owner login in staging | Drawer visible. |
| Owner login in production without flag | Drawer not visible. |
| Owner login in production with flag | Drawer visible. |
| Direct URL attempt | No drawer page opens. |
| Failed `generate-report` call | Redacted trace appears. |
| Copy bundle | Bundle contains no token/header/full payload. |
| Clear logs | Trace list clears locally. |
| Secret scan on copied bundle | No JWT/API key/Authorization/cookie-like value. |

## Readdy Implementation Prompt

Use this exact prompt for Readdy:

```text
Please implement the CoCalLab Owner Debug Drawer according to the canonical specification:

https://github.com/juliushsu/CoCalLab/blob/main/docs/debug/OWNER_DEBUG_DRAWER_V1.md

Strict limits:
- Do not add backend APIs.
- Do not add schema or migrations.
- Do not add a public route.
- Do not expose access tokens, refresh tokens, API keys, Supabase keys, Authorization headers, cookies, full request headers, full request payloads, uploaded file content, full OCR text, full report content, or personal data beyond masked email/id.
- Do not capture full raw payloads from EdgeFunctionService.
- Do not show the drawer to viewer/editor/consultant/auditor roles.
- Production must be off by default and require a feature flag.

Allowed implementation scope:
- Owner/platform_admin-only drawer UI.
- Redacted client-side debug trace store with max 20 Edge Function traces.
- Copy redacted debug bundle.
- Clear local debug logs.
- Integrate with existing EdgeFunctionService trace metadata only.
- Show environment, app version/commit hash, current route, masked user context, workspace/project context, feature/beta flags, mock/real indicators, and redacted Edge Function traces.

Acceptance:
- Non-owner cannot see or open the drawer.
- Direct URL cannot open it.
- No token/secret-like string appears in UI or copied bundle.
- No full payload/content appears in UI or copied bundle.
- npm run type-check and npm run build pass.
- npm run lint may report existing warnings only; do not refactor unrelated hooks.
```

