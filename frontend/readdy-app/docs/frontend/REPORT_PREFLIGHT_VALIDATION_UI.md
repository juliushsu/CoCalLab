# Report Preflight Validation UI Specification

> **Status**: Draft — Closed Beta Preparation  
> **Date**: 2026-05-08  
> **Purpose**: Define the UI that validates project readiness before allowing report generation

---

## 1. Problem Statement

Users can currently click "Generate Report" at any time, even when:
- Activities are missing emission factors
- Drafts are pending review
- Calibration data is expired
- Required attachments are missing
- Methodology choices are unresolved
- Carbon adjustments have pending items

This produces **incomplete or incorrect reports** that waste computation resources and erode user trust.

---

## 2. Validation Checklist

### 2.1 Required Checks (Blocking)

| # | Check | Severity | Blocks Report? |
|---|-------|----------|---------------|
| 1 | **Missing Factor** | 🔴 Critical | ✅ Yes |
| 2 | **Pending Activity** | 🔴 Critical | ✅ Yes |
| 3 | **Expired Calibration** | 🟡 Warning | ❌ No (warn + allow override) |
| 4 | **Missing Attachment** | 🟡 Warning | ❌ No (warn + allow override) |
| 5 | **Unresolved Methodology** | 🟡 Warning | ❌ No (warn + allow override) |
| 6 | **Unresolved Adjustment** | 🟡 Warning | ❌ No (warn + allow override) |

### 2.2 Check Definitions

#### 1. Missing Factor (CRITICAL)

```
❌ 缺少排放係數
─────────────────────────────────────────
以下活動尚未分配排放係數，無法計算 CO₂e：

• 辦公室電費 (2024-01-15) — 類別：電力
• 員工差旅 (2024-01-20) — 類別：交通運輸

[前往係數管理]  [暫時略過 (不建議)]
```

**Logic**: Any activity with `inclusion_status = 'included'` but no `emission_factor_id` or `co2e_amount` is null.

---

#### 2. Pending Activity (CRITICAL)

```
❌ 有待確認活動
─────────────────────────────────────────
以下活動的納入狀態為「待確認」，需先完成審核：

• 辦公用品採購 (2024-01-25) — 等待分類確認
• 快遞運輸 (2024-02-01) — 等待範疇確認

[前往活動列表]  [批次確認]
```

**Logic**: Any activity with `inclusion_status = 'pending'` within the reporting period.

---

#### 3. Expired Calibration (WARNING)

```
⚠️ 過期校正資料
─────────────────────────────────────────
以下自家監測來源的校正已過期，可能影響數據品質：

• 電表 A-102 — 上次校正：2023-08-15 (已過期 258 天)
• 瓦斯表 B-201 — 上次校正：2023-11-20 (已過期 169 天)

[前往校正管理]  [仍產生報告]
```

**Logic**: Any `monitoring_source` with `calibration_valid_until < today`.

---

#### 4. Missing Attachment (WARNING)

```
⚠️ 缺少佐證文件
─────────────────────────────────────────
以下活動缺少佐證文件（發票、收據等）：

• 辦公室電費 (2024-01-15) — 無附件
• 員工差旅 (2024-01-20) — 無附件

[上傳文件]  [仍產生報告]
```

**Logic**: Any activity with `source_document_id = null` AND `source_draft_id = null` AND created manually.

---

#### 5. Unresolved Methodology (WARNING)

```
⚠️ 未確認方法學
─────────────────────────────────────────
以下計算項目尚未確認方法學選擇：

• Scope 2 計算方式 — 未選擇「市場基礎法」或「位置基礎法」
• 廢棄物處理 — 未選擇計算方法

[前往方法學設定]  [仍產生報告]
```

**Logic**: Any `calculation_methodology_choice` that is null or `"unresolved"`.

---

#### 6. Unresolved Adjustment (WARNING)

```
⚠️ 碳調整項目待審核
─────────────────────────────────────────
以下碳調整項目尚未完成審核，不會納入報告：

• VCS-2024-TW-00123 — 狀態：待審核 (500 tCO₂e)
• PURO-2024-BIO-789 — 狀態：驗證中 (200 tCO₂e)

[前往碳調整]  [仍產生報告]
```

**Logic**: Any `carbon_adjustment_item` with `approval_status != 'approved'` that would affect the claimable result.

---

## 3. Preflight UI Component

### 3.1 Full Preflight Modal

```
┌─ 產報前檢查 ────────────────────────────┐
│                                         │
│  📋 專案：2024 年度企業碳盤查             │
│  📅 期間：2024-01-01 ~ 2024-12-31       │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                         │
│  ❌ 關鍵問題 (2) — 必須修正後才能產報      │
│                                         │
│  ┌─ ❌ 缺少排放係數 ─────────────────┐  │
│  │  • 辦公室電費                       │  │
│  │  • 員工差旅                         │  │
│  │  [前往係數管理]                      │  │
│  └────────────────────────────────────┘  │
│                                         │
│  ┌─ ❌ 有待確認活動 ─────────────────┐  │
│  │  • 辦公用品採購                     │  │
│  │  • 快遞運輸                         │  │
│  │  [前往活動列表]                      │  │
│  └────────────────────────────────────┘  │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                         │
│  ⚠️ 警告 (3) — 可略過，但建議先處理       │
│                                         │
│  ┌─ ⚠️ 過期校正資料 ─────────────────┐  │
│  │  • 電表 A-102 (過期 258 天)          │  │
│  │  [前往校正管理]                      │  │
│  └────────────────────────────────────┘  │
│                                         │
│  ┌─ ⚠️ 缺少佐證文件 ─────────────────┐  │
│  │  • 辦公室電費                       │  │
│  │  • 員工差旅                         │  │
│  │  [上傳文件]                          │  │
│  └────────────────────────────────────┘  │
│                                         │
│  ┌─ ⚠️ 碳調整待審核 ─────────────────┐  │
│  │  • VCS-2024-TW-00123 (待審核)        │  │
│  │  [前往碳調整]                        │  │
│  └────────────────────────────────────┘  │
│                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│                                         │
│  [取消]              [強制產報 (不建議)] │
│                      [產生報告] ← disabled │
│                                         │
└─────────────────────────────────────────┘
```

### 3.2 Inline Preflight Badge (Compact)

For the report center page, show a compact status:

```
📊 報告中心

┌─ 碳排放報告書 ──────────────────────────┐
│                                         │
│  ✅ 已就緒 — 所有檢查通過                │
│  [產生報告]                              │
│                                         │
└─────────────────────────────────────────┘

┌─ ESG 報告書 ────────────────────────────┐
│                                         │
│  ⚠️ 2 項警告 — 仍可產報                  │
│  [檢視詳情]  [仍產生報告]                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 4. Component Specification

### 4.1 Props

```typescript
interface PreflightValidationProps {
  projectId: string;
  reportingPeriod: { start: string; end: string };
  mode: 'modal' | 'inline' | 'silent';  // silent = run in background, show on issues
  onGenerate: () => void;
  onFixIssue: (issueType: PreflightIssueType, itemIds: string[]) => void;
}

interface PreflightIssue {
  type: 'missing_factor' | 'pending_activity' | 'expired_calibration'
      | 'missing_attachment' | 'unresolved_methodology' | 'unresolved_adjustment';
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  items: PreflightIssueItem[];
  actionLabel: string;
  actionRoute: string;
}

interface PreflightIssueItem {
  id: string;
  name: string;
  detail?: string;
  date?: string;
}

type PreflightResult = {
  pass: boolean;
  criticalCount: number;
  warningCount: number;
  issues: PreflightIssue[];
};
```

### 4.2 Service Interface

```typescript
// Service function (will call Edge Function or RPC)
async function runPreflightCheck(
  projectId: string,
  period: { start: string; end: string }
): Promise<PreflightResult>;
```

---

## 5. i18n Keys

```typescript
preflight: {
  title: '產報前檢查',
  subtitle: '專案：{projectName} · {period}',

  sections: {
    critical: '關鍵問題 ({count}) — 必須修正後才能產報',
    warning: '警告 ({count}) — 可略過，但建議先處理',
    passed: '所有檢查通過 ✓',
  },

  issues: {
    missing_factor: {
      title: '缺少排放係數',
      description: '以下活動尚未分配排放係數，無法計算 CO₂e',
      action: '前往係數管理',
    },
    pending_activity: {
      title: '有待確認活動',
      description: '以下活動的納入狀態為「待確認」',
      action: '前往活動列表',
    },
    expired_calibration: {
      title: '過期校正資料',
      description: '以下監測來源的校正已過期',
      action: '前往校正管理',
    },
    missing_attachment: {
      title: '缺少佐證文件',
      description: '以下活動缺少佐證文件',
      action: '上傳文件',
    },
    unresolved_methodology: {
      title: '未確認方法學',
      description: '以下計算項目尚未確認方法學',
      action: '前往方法學設定',
    },
    unresolved_adjustment: {
      title: '碳調整項目待審核',
      description: '以下調整項目尚未核准，不會納入報告',
      action: '前往碳調整',
    },
  },

  actions: {
    generate: '產生報告',
    generateAnyway: '強制產報 (不建議)',
    cancel: '取消',
    goFix: '前往修正',
  },

  empty: {
    noIssues: '所有檢查通過，可以產生報告',
  },
}
```

---

## 6. Mock Data (For UI Development)

```typescript
export const mockPreflightResult: PreflightResult = {
  pass: false,
  criticalCount: 2,
  warningCount: 2,
  issues: [
    {
      type: 'missing_factor',
      severity: 'critical',
      title: '缺少排放係數',
      description: '2 個活動缺少排放係數',
      items: [
        { id: 'act-001', name: '辦公室電費', detail: '電力', date: '2024-01-15' },
        { id: 'act-002', name: '員工差旅', detail: '交通運輸', date: '2024-01-20' },
      ],
      actionLabel: '前往係數管理',
      actionRoute: '/admin/emission-factors',
    },
    {
      type: 'pending_activity',
      severity: 'critical',
      title: '有待確認活動',
      description: '2 個活動狀態為待確認',
      items: [
        { id: 'act-004', name: '辦公用品採購', detail: '待分類', date: '2024-01-25' },
      ],
      actionLabel: '前往活動列表',
      actionRoute: '/admin/activities',
    },
    {
      type: 'expired_calibration',
      severity: 'warning',
      title: '過期校正資料',
      description: '1 個監測來源校正過期',
      items: [
        { id: 'cal-001', name: '電表 A-102', detail: '過期 258 天' },
      ],
      actionLabel: '前往校正管理',
      actionRoute: '/admin/monitoring-sources',
    },
    {
      type: 'unresolved_adjustment',
      severity: 'warning',
      title: '碳調整項目待審核',
      description: '1 個調整項目尚未核准',
      items: [
        { id: 'adj-003', name: 'PURO-2024-BIO-789', detail: '驗證中 · 200 tCO₂e' },
      ],
      actionLabel: '前往碳調整',
      actionRoute: '/admin/carbon-adjustments',
    },
  ],
};
```

> **Mock tagging**: `MOCK_SOURCE: preflight_v1` | `TODO_BACKEND: preflight-check Edge Function`

---

## 7. Closed Beta Scope

| Feature | Status | Notes |
|---------|--------|-------|
| Preflight modal UI | ✅ Design ready | Can implement with mock data |
| Missing factor check | ⚠️ Mock only | Needs real factor assignment API |
| Pending activity check | ✅ Can implement | Has `inclusion_status` field |
| Expired calibration | 🔴 Blocked | Needs `monitoring_sources` table |
| Missing attachment | ✅ Can implement | Has `source_document_id` field |
| Unresolved methodology | 🔴 Blocked | Needs methodology choices schema |
| Unresolved adjustment | ✅ Can implement | Has `approval_status` field |

---

> **Next Step**: Review `MOCK_DEPENDENCY_MATRIX.md` for the complete mock data traceability report.