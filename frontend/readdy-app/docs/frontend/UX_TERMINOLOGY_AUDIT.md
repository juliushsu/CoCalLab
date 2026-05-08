# CoCalLab Frontend — UX Terminology Audit

> **Status**: Draft — Stabilization Sprint v62  
> **Date**: 2026-05-08  
> **Owner**: Frontend Team  
> **Blocked by**: Codex canonical model DTO (see "Requires Codex Decision" sections)

---

## 1. Executive Summary

CoCalLab's frontend currently conflates **5 distinct entity concepts** into a single `Organization` abstraction. This audit documents every instance where these concepts are mixed, mislabeled, or used inconsistently across all frontend pages, i18n strings, type definitions, and URL structures.

---

## 2. The Five-Layer World Model

| Layer | Concept | Canonical English | Canonical Chinese | What It Represents |
|-------|---------|------------------|-------------------|-------------------|
| **L1** | **Workspace** | `workspace` | 工作空間 | SaaS tenant / billing unit / the entity that pays CoCalLab |
| **L2** | **Legal Entity** | `legal_entity` | 法人 | The registered company being inventoried (has tax ID, country code) |
| **L3** | **Site / Facility** | `site` | 據點 / 設施 | Physical location (factory, office, warehouse) |
| **L4** | **Project / Inventory Boundary** | `project` | 專案 / 盤查邊界 | GHG Protocol defined boundary + reporting period |
| **L5** | **Activity** | `activity` | 排放活動 | Individual emission source within a project |

> **Current State**: L1, L2, and partially L3 are all stuffed into the `organizations` table and labeled "Organization" in the UI. This is the root cause of all terminology confusion.

---

## 3. Per-Page Terminology Audit

### 3.1 Organization List Page (`/admin/organizations`)

| UI Element | Current Wording | Problem | Suggested Wording | Risk Level |
|-----------|------------------|---------|------------------|------------|
| Page title | "組織管理" / "Organization Management" | "Organization" = L1+L2 mixed | **TBD by split strategy** | 🔴 High |
| Create button | "建立組織" / "Create Organization" | Same | **TBD** | 🔴 High |
| Table header | "組織名稱" / "Name" | Same | **TBD** | 🔴 High |
| Filter | "依組織篩選" / "Filter by Organization" | Same | **TBD** | 🔴 High |
| Breadcrumb | "組織" / "Organizations" | Same | **TBD** | 🔴 High |

**Root Issue**: This page is actually a **tenant/workspace selector** (L1), but the DB table is `organizations` which also carries `legal_name` and `tax_id` (L2). Users think they're managing "their company" when they're actually managing "their SaaS account."

---

### 3.2 Create Organization Page (`/admin/organizations/create`)

| Field | Current Label | Semantic Layer | Problem |
|-------|--------------|----------------|---------|
| `legal_name` | "法定名稱" / "Legal Name" | L2 | ✅ Correct — but it's being collected at L1 creation time |
| `display_name` | "顯示名稱" / "Display Name" | L1 | ✅ Correct — but same form as L2 |
| `tax_id` | "統一編號" / "Tax ID" | L2 | ⚠️ Should be on Legal Entity, not Workspace |
| `country_code` | "國家 / 地區" / "Country" | L2 | ⚠️ Same |
| `timezone` | "時區" / "Timezone" | L1 | ✅ Workspace-level setting |

**Root Issue**: A single form conflates L1 (workspace settings) and L2 (legal entity data). For single-tenant users this feels natural. For multi-entity users, this becomes confusing — "I need to create a new subsidiary, not a new workspace."

---

### 3.3 Project Pages (`/admin/projects/*`)

| UI Element | Current Wording | Problem | Suggested Wording |
|-----------|------------------|---------|------------------|
| "所屬組織" / "Organization" in project list | Shows `organization_name` | L1/L2 mixed; no site concept | **TBD — needs L2 + L3 display** |
| "組織邊界" / "Organizational Boundary" in create form | Boundary type selector | Actually L4, not L3 | ✅ Keep as "盤查邊界" / "Inventory Boundary" |
| Project creation wizard | Steps: name → org → boundary → dates | Missing L2 selection and L3 selection | See `PROJECT_CREATION_WIZARD.md` |

**Root Issue**: Projects currently skip the Legal Entity (L2) and Site (L3) layers. A user cannot create "Acme Corp Taiwan Factory — 2024 GHG Inventory" because there's no place to select "Taiwan Factory" as a site.

---

### 3.4 Activity Pages (`/admin/activities`)

| UI Element | Current Wording | Problem | Suggested Wording |
|-----------|------------------|---------|------------------|
| `organizationId` query param | Hidden in URL | Redundant — activity already has `project_id` | Remove from URL; derive from project |
| `organization_id` in `EmissionActivity` type | DB column | Redundant normalization | Mark as deprecated in canonical model |

**Root Issue**: Activities have both `organization_id` and `project_id` in the type. The `organization_id` is a DB normalization convenience that leaks into the frontend query interface.

---

### 3.5 Document Pages (`/admin/documents/*`)

| UI Element | Current Wording | Problem | Suggested Wording |
|-----------|------------------|---------|------------------|
| `organization_id` in query params | Hidden in URL | Documents are project assets, not org assets | Remove; derive from project |
| "所屬專案" / "Project" in document list | ✅ Correct | Documents belong to projects | ✅ Keep |

**Root Issue**: `uploaded_documents` table has `organization_id` which is redundant. Documents only make sense within a project boundary.

---

### 3.6 Carbon Adjustments (`/admin/carbon-adjustments`)

| UI Element | Current Wording | Problem | Suggested Wording |
|-----------|------------------|---------|------------------|
| `target_type` values | `organization / project / product / facility` | This is actually the **only** page that correctly distinguishes L2/L3/L4/L5! | ✅ Keep |
| `org_id` query param | Hidden in URL | Alongside `project_id` — which one filters? | Clarify: `org_id` = target scope filter, not workspace filter |

**Root Issue**: This page has the right conceptual model (`target_type`) but the query params don't communicate which level is being filtered. Both `projectId` and `organizationId` are passed, creating ambiguity.

---

### 3.7 Subscription Page (`/admin/subscription`)

| UI Element | Current Wording | Problem | Suggested Wording |
|-----------|------------------|---------|------------------|
| "訂閱管理" / "Subscription Management" | Page title | Actually L1 (Workspace) billing | Should be under **Workspace** settings, not standalone |
| `organization_id` in `Subscription` type | DB foreign key | Actually points to L1 (tenant) | Should be `workspace_id` in canonical model |

**Root Issue**: Subscription is clearly a Workspace (L1) concept, but it's labeled using "organization" terminology.

---

### 3.8 AI Governance (`/admin/ai-governance`)

| UI Element | Current Wording | Problem | Suggested Wording |
|-----------|------------------|---------|------------------|
| `org_id` in feature toggles | "組織層級" / "Organization Level" | Could mean L1 or L2 | Clarify: this is **Workspace-level** (L1) |
| "系統全域" / "System-wide" | Feature toggle scope | ✅ Correct | ✅ Keep |

**Root Issue**: The `org_id` in AI governance toggles is actually workspace-level. For multi-entity workspaces, this means "all legal entities under this workspace share the same AI settings" which may or may not be the intended behavior.

---

## 4. i18n Key Audit (zh/cocal.ts, en/cocal.ts, ja/cocal.ts)

### 4.1 `organizations.*` namespace

| Key Path | Current zh | Current en | Semantic Target | Correct? |
|----------|-----------|-----------|-----------------|----------|
| `organizations.title` | 組織管理 | Organization Management | L1+L2 mixed | 🔴 No |
| `organizations.create_title` | 建立組織 | Create Organization | L1+L2 mixed | 🔴 No |
| `organizations.fields.legal_name` | 法定名稱 | Legal Name | L2 | ✅ Yes |
| `organizations.fields.display_name` | 顯示名稱 | Display Name | L1 | ✅ Yes |
| `organizations.fields.tax_id` | 統一編號 | Tax ID | L2 | ✅ Yes |
| `organizations.members.title` | 成員管理 | Member Management | L1 | ⚠️ Ambiguous |

### 4.2 `projects.*` namespace

| Key Path | Current zh | Current en | Semantic Target | Correct? |
|----------|-----------|-----------|-----------------|----------|
| `projects.fields.organization` | 所屬組織 | Organization | L1/L2 | 🔴 No |
| `projects.fields.boundaryType` | 組織邊界 | Organizational Boundary | L4 | ⚠️ Should be "盤查邊界" |
| `projects.boundaryTypes.operationalControl` | 營運控制 | Operational Control | L4 | ✅ Yes |
| `projects.create_title` | 建立專案 | Create Project | L4 | ✅ Yes |

### 4.3 `carbonAdjustments.*` namespace

| Key Path | Current zh | Current en | Semantic Target | Correct? |
|----------|-----------|-----------|-----------------|----------|
| `carbonAdjustments.targetType.organization` | 組織層級 | Organization Level | L2 (Legal Entity) | ⚠️ Ambiguous |
| `carbonAdjustments.targetType.project` | 專案層級 | Project Level | L4 | ✅ Yes |
| `carbonAdjustments.targetType.facility` | 設施層級 | Facility Level | L3 | ✅ Yes |

---

## 5. URL / Route Audit

| Current Route | Concept Shown | Layer | Issue |
|--------------|--------------|-------|-------|
| `/admin/organizations` | "Organizations" | L1+L2 | Should split into `/admin/workspaces` and `/admin/legal-entities` |
| `/admin/organizations/:id/members` | Members | L1 | Actually workspace members (billing-level access) |
| `/admin/projects` | Projects | L4 | Missing L2 and L3 in hierarchy |
| `/admin/activities?projectId=xxx` | Activities | L5 | ✅ Correct — project-scoped |
| `/admin/activities?organizationId=xxx` | Activities | L5 | ⚠️ Redundant param |

> **Decision**: Per sprint directive, **do NOT change route paths** unless CTO explicitly requests.

---

## 6. Type Definition Audit

| File | Type/Interface | Fields | Issue |
|------|-------------|--------|-------|
| `src/types/organization.ts` | `Organization` | `legal_name`, `display_name`, `tax_id`, `country_code` | L1+L2 mixed |
| `src/types/project.ts` | `Project` | `organization_id` | Should eventually point to L2 (Legal Entity), not L1 |
| `src/types/activity.ts` | `EmissionActivity` | `organization_id` + `project_id` | Redundant; `project_id` is sufficient |
| `src/types/document.ts` | `UploadedDocument` | `organization_id` + `project_id` | Redundant |
| `src/types/subscription.ts` | `Subscription` | `organization_id` | Actually `workspace_id` |

---

## 7. Recommendations (Prioritized)

### 🔴 P0 — Requires Codex Decision First

1. **Split `organizations` table** into `workspaces` (L1) + `legal_entities` (L2) — or confirm it stays combined
2. **Add `site` / `facility` table** (L3) and link `projects` to it
3. **Confirm `project.organization_id` semantics** — should it point to L1 or L2?

### 🟡 P1 — Can Proceed After Codex Decision

4. Rename i18n `organizations.*` namespace → `workspace.*` + `legalEntity.*`
5. Update `Project` type to reference `legal_entity_id` + `site_id`
6. Remove redundant `organization_id` from Activity and Document types
7. Move Subscription page under "Workspace Settings" conceptually

### 🟢 P2 — Cosmetic / Label Changes (Safe Now)

8. Change `projects.fields.boundaryType` label from "組織邊界" → "盤查邊界" / "Inventory Boundary"
9. Add clarifying subtitles on Organization pages explaining the L1/L2 distinction

---

## 8. Blocked Items (Waiting for Codex)

| Item | Blocked By | Estimated Unblock |
|------|-----------|------------------|
| Table schema split | Codex canonical model DTO | Unknown |
| `site`/`facility` entity | Codex DTO | Unknown |
| `projects` FK update | Codex schema decision | Unknown |
| i18n namespace rename | Codex terminology approval | Unknown |

---

## 9. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-05-08 | Initial audit created | Frontend Team |

---

> **Next Step**: Review `WORKSPACE_LEGAL_ENTITY_SPLIT.md` for the proposed UI split strategy.