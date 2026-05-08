# Mock Dependency Matrix

> **Status**: Living Document — Updated per sprint  
> **Date**: 2026-05-08  
> **Purpose**: Trace every mock data source to its backend dependency and replacement status

---

## 1. Governance Rules

Every mock in CoCalLab MUST have:

1. **Source tag**: Where the mock lives (fixture file, inline, hardcoded)
2. **Fallback reason**: Why it's mock (backend not ready, Codex pending, staging-only)
3. **TODO backend dependency**: Exact API/endpoint/schema needed
4. **Replacement status**: `not_started` | `in_progress` | `ready` | `done`

---

## 2. Matrix by Page

### 2.1 Organization Pages

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `OrganizationListPage` | `organizationService.getOrganizations()` → Supabase query | ✅ Real data | `SELECT * FROM organizations` | ✅ Done |
| `CreateOrganizationPage` | `create-organization` Edge Function | ✅ Real write | RPC + RLS | ✅ Done |
| `EditOrganizationPage` | Hardcoded form fields | 🟡 UI scaffold | `UPDATE organizations` | 🔴 Not started |
| `OrganizationMembersPage` | `organization_members` table | ✅ Real data | `SELECT * FROM organization_members` | ✅ Done |
| `AddMemberModal` | `add_organization_member` RPC | ✅ Real write | RPC + RLS | ✅ Done |

---

### 2.2 Project Pages

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `ProjectListPage` | `projectService.getProjects()` → Supabase | ✅ Real data | `SELECT * FROM projects` with org join | ✅ Done |
| `ProjectOverviewPage` | `projectService.getProjectStatistics()` | ✅ Real data | Aggregated counts + calculations | ✅ Done |
| `CreateProjectPage` | `projectService.createProject()` | ✅ Real write | `INSERT INTO projects` | ✅ Done |
| `EditProjectPage` | Hardcoded form | 🟡 UI scaffold | `UPDATE projects` | 🔴 Not started |

---

### 2.3 Activity Pages

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `EmissionActivitiesListPage` | `activityService.getEmissionActivities()` | ✅ Real data | `SELECT * FROM emission_activities` | ✅ Done |
| `EmissionActivityDetailPage` | Hardcoded mock | 🔴 Needs Codex DTO | Full activity + calculation join | 🔴 Not started |
| `CreateActivityModal` | `emission_activities` table | ✅ Real write | `INSERT INTO emission_activities` | ✅ Done |

---

### 2.4 Document Pages

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `DocumentUploadPage` | `uploaded_documents` table + Storage | ✅ Real write | Supabase Storage + DB insert | ✅ Done |
| `UploadedDocumentListPage` | `documentService.fetchDocumentsByOrganization()` | ✅ Real data | `SELECT * FROM uploaded_documents` | ✅ Done |
| `ExtractedDraftReviewPage` | `extracted_document_drafts` table | ✅ Real data | `SELECT * FROM extracted_document_drafts` | ✅ Done |

---

### 2.5 Report Pages

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `ReportCenterPage` | `getCapabilityStatus()` — hardcoded | 🔴 Subscription API missing | `GET /api/capabilities` | 🔴 Not started |
| `ReportCenterPage` | `mockEmissionsSummary` fixture | 🔴 Carbon adjustments API | `GET /api/projects/:id/emissions-summary` | 🔴 Not started |
| `ReportGenerationHistoryPage` | `report_generations` table | ✅ Real data | `SELECT * FROM report_generations` | ✅ Done |
| `ReportPreviewPage` | `mockReport` + `mockSections` fixtures | 🔴 Report content generation | `generate-report` Edge Function | 🟡 In progress |
| `ReportPreviewPage` | `reportService.getReportData()` | ✅ Real data (partial) | `SELECT * FROM report_versions` | ✅ Done |

---

### 2.6 Carbon Adjustments

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `CarbonAdjustmentsPage` | `mockCarbonAdjustments` fixture | 🔴 Codex DTO pending | `carbon_adjustment_items` table + API | 🔴 Not started |
| `CarbonAdjustmentsPage` | `mockApplications` fixture | 🔴 Application flow pending | `adjustment_applications` table + API | 🔴 Not started |
| `CarbonAdjustmentsPage` | `mockRuleResults` fixture | 🔴 Rule engine not connected | Rule engine API | 🔴 Not started |
| `EmissionsSummaryPanel` | `mockEmissionsSummary` fixture | 🔴 Summary API pending | `GET /api/projects/:id/emissions-summary` | 🔴 Not started |

---

### 2.7 Emission Factors

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `EmissionFactorsPage` | Hardcoded mock data | 🔴 Factor registry API | `GET /api/emission-factors` | 🔴 Not started |
| `FactorSourcesPage` | Hardcoded mock sources | 🔴 Source whitelist API | `GET /api/factor-sources` | 🔴 Not started |
| `FactorSourcesPage` | Mock resolution tiers | 🔴 Resolution engine | Factor resolution API | 🔴 Not started |

---

### 2.8 Analytics

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `EmissionsAnalyticsPage` | `analyticsService.fetchAnalyticsEmissions()` | ✅ Real data | `SELECT ... FROM calculation_results` | ✅ Done |
| `EmissionsAnalyticsPage` | Mock dimension switching | 🟡 Chart data aggregation | `GET /api/analytics?dimension=...` | 🟡 Partial |

---

### 2.9 AI Governance

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `AIGovernancePage` | `ai_audit_results` table | ✅ Real data (partial) | `SELECT * FROM ai_audit_results` | ✅ Done |
| `AIGovernancePage` | Mock provider configs | 🔴 Provider config API | `GET /api/ai/providers` | 🔴 Not started |
| `AIGovernancePage` | Mock cost trends | 🔴 Cost tracking API | `GET /api/ai/costs` | 🔴 Not started |
| `AIGovernancePage` | Mock feature toggles | 🔴 Feature flag API | `GET /api/ai/features` | 🔴 Not started |

---

### 2.10 Product Carbon Footprint

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `ProductCarbonPage` | Hardcoded mock data | 🔴 CFP module not built | CFP calculation engine + schema | 🔴 Not started |
| `ProductCarbonPage` | Mock lifecycle stages | 🔴 LCA data model | ISO 14067 DTO from Codex | 🔴 Not started |

---

### 2.11 Subscription

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `SubscriptionManagementPage` | `subscriptions` table | ✅ Real data (partial) | `SELECT * FROM subscriptions` | ✅ Done |
| `SubscriptionManagementPage` | Mock plan comparison | 🔴 Plan catalog API | `GET /api/plans` | 🔴 Not started |
| `SubscriptionManagementPage` | Mock usage stats | 🔴 Usage aggregation | `GET /api/usage` | 🔴 Not started |

---

### 2.12 Homepage (Marketing)

| Page | Mock Source | Fallback Reason | Backend Dependency | Status |
|------|------------|----------------|-------------------|--------|
| `HeroSection` | Stable Diffusion image | ✅ Marketing asset | N/A | ✅ Permanent |
| `FeaturesSection` | Stable Diffusion images | ✅ Marketing asset | N/A | ✅ Permanent |
| `PricingSection` | Hardcoded plan cards | 🟡 Marketing copy | `GET /api/plans` (public) | 🟡 Can use real |

---

## 3. Summary by Status

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Done (Real data) | 18 | ~45% |
| ✅ Permanent (Marketing) | 2 | ~5% |
| 🟡 Partial / In Progress | 3 | ~7% |
| 🔴 Not Started (Mock) | 17 | ~43% |
| **Total** | **40** | **100%** |

---

## 4. Priority Queue for Backend Replacement

### 🔴 P0 — Blocks Closed Beta

1. `CapabilityGateStatus` — Subscription plan feature flags
2. `ReportPreviewPage` mock sections — Report content generation
3. `CarbonAdjustmentsPage` — Core adjustment flow

### 🟡 P1 — Required for Public Beta

4. `EmissionFactorsPage` — Factor registry
5. `FactorSourcesPage` — Source whitelist
6. `AIGovernancePage` provider configs — AI model management
7. `ProductCarbonPage` — CFP module

### 🟢 P2 — Post-Launch

8. `EditOrganizationPage` — Organization editing
9. `EditProjectPage` — Project editing
10. `AIGovernancePage` cost tracking — Cost analytics

---

## 5. Mock Tagging Convention

Every mock data file or inline mock MUST include this header comment:

```typescript
/**
 * MOCK DATA — {brief description}
 *
 * MOCK_SOURCE: {fixture_file | inline | hardcoded}
 * FALLBACK_REASON: {why this is mock}
 * TODO_BACKEND: {exact API/endpoint needed}
 * REPLACEMENT_STATUS: {not_started | in_progress | ready | done}
 * CODEX_DEPENDENCY: {yes/no — does this need Codex DTO?}
 */
```

---

## 6. Changelog

| Date | Change |
|------|--------|
| 2026-05-08 | Initial matrix created |

---

> **Next Step**: Review `CLOSED_BETA_UX_CHECKLIST.md` for the complete closed beta readiness checklist.