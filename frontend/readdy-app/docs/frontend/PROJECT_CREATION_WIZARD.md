# Project Creation Wizard Refactor Proposal

> **Status**: Draft — Pending Codex canonical model  
> **Date**: 2026-05-08  
> **Prerequisite**: `WORKSPACE_LEGAL_ENTITY_SPLIT.md`  
> **Blocked by**: Codex `site` entity and `projects` schema update

---

## 1. Current Flow (Problems)

```
Step 1: Project Name
Step 2: Select Organization (dropdown)  ← L1/L2 mixed, no site
Step 3: Boundary Type (operational/financial/equity)
Step 4: Reporting Period (dates)
Step 5: Currency + Description
```

**Problems**:
1. "Organization" dropdown doesn't distinguish workspace vs legal entity
2. No site/facility selection — user can't scope to a specific factory
3. Boundary type is presented as "Organizational Boundary" which sounds like L2, not L4
4. No preview of what will be included/excluded in the inventory

---

## 2. Proposed Flow (Target)

```
Step 1: Project Identity
         ├── Name
         ├── Project code (optional)
         └── Description (optional)

Step 2: Reporting Entity
         ├── Select Legal Entity (dropdown)
         └── [If only 1 entity: auto-select with note]

Step 3: Site Selection
         ├── Select Site / Facility (dropdown)
         ├── [Or: "All sites under this entity"]
         └── [Future: multi-select sites]

Step 4: Boundary Configuration
         ├── Boundary Type: Operational / Financial / Equity
         ├── [If Equity]: Equity percentage slider
         └── Consolidation preview (see BOUNDARY_VISUALIZER_UX.md)

Step 5: Reporting Period
         ├── Start date
         ├── End date
         └── [Validation: max 12 months for annual, etc.]

Step 6: Review & Create
         ├── Summary card
         ├── Included entities/sites preview
         └── Create button
```

---

## 3. Per-Step Specification

### Step 1: Project Identity

| Field | Required | Validation |
|-------|----------|------------|
| Project name | ✅ | Min 2 chars, max 100 |
| Project code | ❌ | Alphanumeric + hyphen, max 20 |
| Description | ❌ | Max 500 chars |

**UI**: Single-column form. Staging mode shows `[TEST]` prefix preview.

---

### Step 2: Reporting Entity (Legal Entity Selection)

| Field | Required | Behavior |
|-------|----------|----------|
| Legal entity | ✅ | Dropdown of L2 entities in current workspace |

**Auto-select logic**:
- If workspace has **1 legal entity** → auto-select, show "✓ 已自動選取唯一法人"
- If workspace has **0 legal entities** → show empty state with CTA to create entity
- If workspace has **2+ entities** → require manual selection

**Empty state**:
```
┌─────────────────────────────────────────┐
│  🏛️ 尚無法人資料                         │
│                                         │
│  建立專案前，請先建立至少一個法人資料。    │
│                                         │
│  [建立法人資料]  [返回專案列表]            │
└─────────────────────────────────────────┘
```

---

### Step 3: Site Selection

| Field | Required | Behavior |
|-------|----------|----------|
| Site | ✅ | Dropdown of L3 sites under selected L2 |
| "Include all sites" | toggle | Alternative to single site selection |

**Site dropdown shows**:
- Site name
- Site type (factory / office / warehouse)
- Address (truncated)

**Future enhancement**: Multi-site selection with checkboxes.

---

### Step 4: Boundary Configuration

| Field | Required | Options |
|-------|----------|---------|
| Boundary type | ✅ | `operational_control`, `financial_control`, `equity_share` |
| Equity percentage | conditional | Only for `equity_share`, slider 1-100% |

**Boundary type helper cards**:

```
┌─────────────────────────────────────────┐
│  🎛️ 營運控制 (Operational Control)      │
│  ─────────────────────────────────────  │
│  納入：您有權力導入營運政策的設施        │
│  排除：無營運控制權的子公司/合資        │
│  常見：總部、自有工廠                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 財務控制 (Financial Control)        │
│  ─────────────────────────────────────  │
│  納入：您有權力導入財務與營運政策的設施  │
│  排除：無財務控制權的投資               │
│  常見：全資子公司                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  📊 股權比例 (Equity Share)              │
│  ─────────────────────────────────────  │
│  納入：依持股比例計算排放                 │
│  適用：合資企業、部分持股子公司          │
│  需設定：持股比例 %                      │
└─────────────────────────────────────────┘
```

**Consolidation Preview** (lightweight version):
```
📋 盤查邊界預覽
├── 納入：台北總部 (營運控制)
├── 納入：台中工廠 (營運控制)
└── 排除：新加坡分公司 (非營運控制)
```

---

### Step 5: Reporting Period

| Field | Required | Validation |
|-------|----------|------------|
| Start date | ✅ | Not in future |
| End date | ✅ | Must be after start date |

**Period presets**:
- "2024 年度" → auto-fill 2024-01-01 to 2024-12-31
- "2024 Q1" → auto-fill 2024-01-01 to 2024-03-31
- "自訂" → manual entry

**Validation**:
- End date must be > start date
- Period > 12 months → show warning (most GHG inventories are annual)
- Period < 1 month → show warning

---

### Step 6: Review & Create

**Summary card**:
```
┌─────────────────────────────────────────┐
│  📋 專案設定摘要                         │
│  ─────────────────────────────────────  │
│  名稱：2024 年度碳盤查                   │
│  法人：Acme Corp Taiwan (12345678)       │
│  據點：台北總部、台中工廠 (2 處)          │
│  邊界：營運控制                          │
│  期間：2024-01-01 ~ 2024-12-31           │
│  貨幣：TWD                               │
│  ─────────────────────────────────────  │
│  納入據點：2  │  排除據點：1              │
└─────────────────────────────────────────┘
```

---

## 4. Type Definition Changes

### 4.1 `CreateProjectInput` (Target)

```typescript
interface CreateProjectInput {
  // L4 — Project identity
  name: string;
  project_code?: string;
  description?: string;

  // L2 — Reporting entity
  legal_entity_id: string;     // NEW: replaces organization_id

  // L3 — Site scope
  site_ids: string[];          // NEW: array for multi-site support
  site_scope_mode: 'single' | 'all' | 'selected';  // NEW

  // L4 — Boundary configuration
  boundary_type: BoundaryType;
  equity_percentage?: number;    // NEW: conditional

  // L4 — Reporting period
  reporting_start_date: string;
  reporting_end_date: string;

  // Other
  base_currency?: string;
  status?: ProjectStatus;
}
```

### 4.2 `Project` Type (Target)

```typescript
interface Project {
  id: string;

  // L2 reference
  legal_entity_id: string;
  legal_entity_name?: string;

  // L3 reference
  site_ids: string[];
  sites_summary?: string;      // "台北總部, 台中工廠"

  // L4 fields
  project_code: string;
  name: string;
  description?: string;
  boundary_type: BoundaryType;
  equity_percentage?: number;
  reporting_start_date: string;
  reporting_end_date: string;
  status: ProjectStatus;
  base_currency: string;

  // Metadata
  created_at: string;
  updated_at: string;
}
```

---

## 5. i18n Key Additions Needed

```typescript
// New namespace
projects: {
  // Step labels
  step_identity: '專案身分設定',
  step_legal_entity: '選擇盤查法人',
  step_site: '選擇盤查據點',
  step_boundary: '設定盤查邊界',
  step_period: '設定報告期間',
  step_review: '確認與建立',

  // Site selection
  siteSelection: '據點選擇',
  siteScopeSingle: '單一據點',
  siteScopeAll: '全部據點',
  siteScopeSelected: '指定據點',
  noSitesAvailable: '此法人尚無據點資料',
  createSiteFirst: '請先建立據點',

  // Boundary
  boundaryPreview: '盤查邊界預覽',
  includedSites: '納入據點',
  excludedSites: '排除據點',
  equityPercentage: '持股比例',

  // Review
  reviewSummary: '設定摘要',
  reviewIncludedCount: '納入據點數',
  reviewExcludedCount: '排除據點數',
}
```

---

## 6. Backward Compatibility

| Change | Compatibility Strategy |
|--------|----------------------|
| `organization_id` → `legal_entity_id` | Keep `organization_id` as deprecated alias for 2 sprints |
| New `site_ids` field | Default to empty array for existing projects |
| New wizard steps | Show full wizard for new projects; existing projects show read-only summary |
| Route changes | No route changes — still `/admin/projects/create` |

---

## 7. Mock Structure (Safe to Implement Now)

Even though the DB schema isn't ready, we can implement the **UI structure** with mock data:

```typescript
// Mock legal entities (L2)
const mockLegalEntities = [
  { id: 'le-001', workspace_id: 'ws-001', legal_name: 'Acme Corp Taiwan', tax_id: '12345678', country_code: 'TW' },
  { id: 'le-002', workspace_id: 'ws-001', legal_name: 'Acme Corp Singapore', tax_id: 'SG-XXX', country_code: 'SG' },
];

// Mock sites (L3)
const mockSites = [
  { id: 'site-001', legal_entity_id: 'le-001', name: 'Taipei HQ', type: 'office', address: '...' },
  { id: 'site-002', legal_entity_id: 'le-001', name: 'Taichung Factory', type: 'factory', address: '...' },
  { id: 'site-003', legal_entity_id: 'le-002', name: 'Singapore Office', type: 'office', address: '...' },
];
```

> **Note**: These mocks must be tagged with `TODO: replace with Codex API` and `MOCK_SOURCE: frontend_staging`.

---

## 8. Open Questions

1. Should the wizard support **multi-entity projects**? (e.g., group-level inventory spanning multiple legal entities)
2. Should `site_ids` be stored on `projects` or in a junction table `project_sites`?
3. For "all sites" mode, should we store `site_ids: ['*']` or resolve at query time?
4. Should existing projects without site data show a "migrate" prompt?

---

> **Next Step**: Review `BOUNDARY_VISUALIZER_UX.md` for the consolidation preview component specification.