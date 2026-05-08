# Boundary Visualizer UX Proposal

> **Status**: Draft — CoCalLab Core UX  
> **Date**: 2026-05-08  
> **Prerequisite**: `PROJECT_CREATION_WIZARD.md`  
> **Purpose**: Define the visual component that shows users exactly what is included/excluded in their GHG inventory boundary

---

## 1. Why This Matters

The boundary visualizer is **CoCalLab's core differentiator**. GHG Protocol requires organizations to clearly define their inventory boundary using one of three approaches:

1. **Operational Control** — include facilities where you have authority to implement policies
2. **Financial Control** — include facilities where you have financial/operational authority
3. **Equity Share** — include a proportional share of emissions

Users currently select a boundary type from a dropdown with no feedback on what that choice means for their specific organization structure. This leads to:
- Incorrect inventory scopes
- Auditing failures
- Regulatory non-compliance

---

## 2. Visualizer Types

### 2.1 Type A: Inline Preview (Lightweight)

**Location**: Step 4 of project creation wizard  
**Purpose**: Quick sanity check before creating project

```
┌─ 盤查邊界預覽 ───────────────────────┐
│                                       │
│  法人：Acme Corp Taiwan               │
│  邊界類型：營運控制                     │
│                                       │
│  ✅ 納入 (2)                          │
│  ├── 台北總部 [office]                 │
│  │   └── 納入原因：直屬營運管理          │
│  └── 台中工廠 [factory]                │
│      └── 納入原因：直屬營運管理          │
│                                       │
│  ⛔ 排除 (1)                          │
│  └── 新加坡分公司 [office]            │
│      └── 排除原因：非營運控制權           │
│                                       │
│  📊 預估納入比例：67% 據點               │
│                                       │
└───────────────────────────────────────┘
```

---

### 2.2 Type B: Full Boundary Editor (Advanced)

**Location**: Standalone page `/admin/projects/:id/boundary`  
**Purpose**: Detailed boundary configuration and override

```
┌─ 盤查邊界設定 ─────────────────────────┐
│                                       │
│  [營運控制] [財務控制] [股權比例 ▼]     │
│                                       │
│  ┌─ 據點清單 ──────────────────────┐  │
│  │                                   │  │
│  │  ☑️ 台北總部                        │  │
│  │     類型：office │ 控制權：✅        │  │
│  │     [納入] [排除] [僅揭露]          │  │
│  │                                   │  │
│  │  ☑️ 台中工廠                        │  │
│  │     類型：factory │ 控制權：✅        │  │
│  │     [納入] [排除] [僅揭露]          │  │
│  │                                   │  │
│  │  ☐ 新加坡分公司 (其他法人)           │  │
│  │     類型：office │ 控制權：❌        │  │
│  │     [────── 不可選 ──────]          │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                       │
│  ┌─ 納入摘要 ───────────────────────┐  │
│  │  納入據點：2                      │  │
│  │  排除據點：1                      │  │
│  │  僅揭露：0                        │  │
│  │  預估排放占比：待定 (尚無活動資料)   │  │
│  └───────────────────────────────────┘  │
│                                       │
└─────────────────────────────────────────┘
```

---

### 2.3 Type C: Consolidation Preview (Report-Level)

**Location**: Report generation step, report preview page  
**Purpose**: Show how boundary choices affect final report

```
┌─ 合併報表預覽 ─────────────────────────┐
│                                       │
│  報告期間：2024-01-01 ~ 2024-12-31     │
│  盤查邊界：營運控制                     │
│                                       │
│  ┌─ 排放彙總 (依邊界納入) ─────────┐  │
│  │                                   │  │
│  │  台北總部        45.2 tCO₂e      │  │
│  │  台中工廠       120.5 tCO₂e      │  │
│  │  ─────────────────────────────    │  │
│  │  合計           165.7 tCO₂e      │  │
│  │                                   │  │
│  │  [排除：新加坡分公司  23.1 tCO₂e]  │  │
│  │  [僅揭露：無]                      │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                       │
│  📋 邊界說明：                          │
│  本報告採營運控制法，納入 Acme Corp    │
│  Taiwan 直屬管理的台北總部與台中工廠。   │
│  新加坡分公司因非直屬營運控制，未納入    │
│  盤查範圍，僅於附錄揭露。                │
│                                       │
└─────────────────────────────────────────┘
```

---

## 3. Component Specification

### 3.1 Props Interface

```typescript
interface BoundaryVisualizerProps {
  // Input data
  legalEntity: LegalEntity;
  sites: Site[];
  selectedBoundaryType: BoundaryType;
  equityPercentage?: number;

  // Mode
  mode: 'preview' | 'editor' | 'report';

  // For editor mode
  onSiteToggle?: (siteId: string, inclusion: 'included' | 'excluded' | 'disclosure_only') => void;
  overrides?: Record<string, 'included' | 'excluded' | 'disclosure_only'>;

  // For report mode
  emissionsBySite?: Record<string, number>;
}

interface SiteInclusionInfo {
  site: Site;
  defaultInclusion: 'included' | 'excluded' | 'disclosure_only';
  reason: string;
  override?: 'included' | 'excluded' | 'disclosure_only';
}
```

### 3.2 Inclusion Logic (Per Boundary Type)

| Boundary Type | Default Inclusion Rule | Override Allowed? |
|--------------|----------------------|-------------------|
| `operational_control` | Include sites where `operational_control = true` | Yes — with audit note |
| `financial_control` | Include sites where `financial_control = true` | Yes — with audit note |
| `equity_share` | Include all owned sites × equity_percentage | No — proportional by design |

### 3.3 Visual States

| State | Visual Treatment |
|-------|-----------------|
| **Included** | Green left border ✅, solid background |
| **Excluded** | Gray left border ⛔, muted background |
| **Disclosure only** | Yellow left border 👁️, outlined |
| **Override active** | Orange warning icon, tooltip shows original decision |

---

## 4. i18n Keys Needed

```typescript
boundaryVisualizer: {
  title: '盤查邊界預覽',
  titleEditor: '盤查邊界設定',
  titleReport: '合併報表預覽',

  includedSection: '納入',
  excludedSection: '排除',
  disclosureOnlySection: '僅揭露',

  inclusionReason: {
    operational_control: '直屬營運管理',
    financial_control: '直屬財務管理',
    equity_share: '持股比例 {pct}%',
    no_control: '無控制權',
    other_entity: '屬於其他法人',
  },

  overrideWarning: '已手動覆寫 ({original} → {current})',
  overrideAuditNote: '審核註記必填',

  summary: {
    includedCount: '納入據點',
    excludedCount: '排除據點',
    disclosureCount: '僅揭露',
    estimatedCoverage: '預估納入比例',
  },

  actions: {
    include: '納入',
    exclude: '排除',
    disclosureOnly: '僅揭露',
    resetOverride: '重置為預設',
  },

  empty: {
    noSites: '此法人尚無據點資料',
    allExcluded: '警告：所有據點均被排除，盤查範圍為空',
  },
}
```

---

## 5. Integration Points

| Integration | Location | Mode |
|------------|----------|------|
| Project creation wizard | Step 4 | `preview` |
| Project settings page | `/admin/projects/:id/settings/boundary` | `editor` |
| Report generation | Pre-generation confirmation | `preview` |
| Report preview | Report header | `report` |
| Audit / verification | Auditor view | `report` (read-only) |

---

## 6. Mock Data Requirements

```typescript
// Mock site control flags (for boundary calculation)
interface SiteControlFlags {
  site_id: string;
  legal_entity_id: string;
  operational_control: boolean;
  financial_control: boolean;
  equity_percentage: number;  // 0-100
}

const mockSiteControlFlags: SiteControlFlags[] = [
  { site_id: 'site-001', legal_entity_id: 'le-001', operational_control: true, financial_control: true, equity_percentage: 100 },
  { site_id: 'site-002', legal_entity_id: 'le-001', operational_control: true, financial_control: true, equity_percentage: 100 },
  { site_id: 'site-003', legal_entity_id: 'le-002', operational_control: false, financial_control: false, equity_percentage: 60 },
];
```

> **Mock tagging**: All mock data must include `MOCK_SOURCE: boundary_visualizer_v1` and `TODO_BACKEND: site_control_flags_API`.

---

## 7. Accessibility Requirements

- Color is not the only indicator — icons + text always present
- Screen reader: "Taipei HQ, office, included in inventory, reason: direct operational control"
- Keyboard navigable: tab through sites, space to toggle inclusion

---

## 8. Future Enhancements (Post-MVP)

1. **Map view**: Show sites on a map with color-coded inclusion status
2. **Emissions overlay**: Show estimated emissions per site in the visualizer
3. **Scenario compare**: Compare "what if we used financial control instead?"
4. **Audit trail**: Log all boundary changes with timestamp and user

---

> **Next Step**: Review `MEMBER_MANAGEMENT_UX.md` for the workspace member invitation flow.