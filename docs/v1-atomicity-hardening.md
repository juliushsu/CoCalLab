# CaCalLab V1 Atomicity Hardening

## Scope
Hardening target flows:
1. `confirm-draft`
2. `recalculate-project`
3. `generate-report`
4. `run-ai-audit`

Each flow now uses a PostgreSQL RPC function (PL/pgSQL). Each RPC call is one transaction boundary.
If any statement fails, the whole RPC is rolled back by PostgreSQL.

## Atomic RPC Functions
Defined in:
- `/Users/chishenhsu/Desktop/Codex/CaCalLab/supabase/migrations/202603160002_v1_hardening_atomic_rpc.sql`

Functions:
1. `confirm_draft_atomic(...)`
2. `recalculate_project_atomic(...)`
3. `generate_report_atomic(...)`
4. `run_ai_audit_atomic(...)`

## Rollback Strategy Per Flow

### confirm-draft
Atomic writes inside one RPC:
- update `extracted_document_drafts` status/review fields
- insert `emission_activities` (when confirmed)
- insert `calculation_results` (when confirmed)
- insert `audit_logs`

Rollback guarantee:
- if calculation insert fails, activity insert is rolled back
- if activity insert fails, draft status update is rolled back

Compensating logic:
- none needed; transaction rollback is full.

### recalculate-project
Atomic writes inside one RPC:
- set previous `calculation_results.is_latest=false` for affected activities
- insert all new `calculation_results`
- insert `audit_logs`

Rollback guarantee:
- no partial latest-flag updates without new rows
- no partial subset insert of recalculation batch

Compensating logic:
- none needed; transaction rollback is full.

### generate-report
Atomic writes inside one RPC:
- validate payload exists and is object
- insert `report_generations`
- insert `audit_logs`

Rollback guarantee:
- no report row when payload validation or audit insert fails
- no payload-missing report rows

Compensating logic:
- none needed; transaction rollback is full.

### run-ai-audit
Atomic writes inside one RPC:
- validate `summary_text` contains `zh_tw/en/ja`
- insert `ai_audit_results`
- insert `audit_logs`

Rollback guarantee:
- no audit row with invalid i18n summary
- no partial write without matching audit log

Compensating logic:
- none needed; transaction rollback is full.

## Edge Function Failure Handling

Edge functions now:
- perform all reads + in-memory calculations first
- execute a single RPC write call for atomic persistence
- return unified error envelope on failure with `error.code`

This prevents multi-step write sequences from leaving inconsistent state.
