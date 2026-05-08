# Member Management UX Specification

> **Status**: Draft — Closed Beta Preparation  
> **Date**: 2026-05-08  
> **Purpose**: Define the complete workspace member management flow for CoCalLab closed beta

---

## 1. Scope

This document covers **Workspace-level member management** (L1). Legal entity-level signatory management (L2) is out of scope for closed beta and will be defined in a future sprint.

---

## 2. Role Definitions

| Role | Code | Permissions | Use Case |
|------|------|------------|----------|
| **Owner** | `owner` | Full access + billing + delete workspace + manage owners | Company founder, IT admin |
| **Admin** | `admin` | Manage members + all projects + subscription view | Department head, ESG manager |
| **Editor** | `editor` | CRUD on activities, documents, emission factors | Sustainability analyst, data entry |
| **Viewer** | `viewer` | Read-only access to all data | Auditor, executive, external consultant |

### 2.1 Permission Matrix

| Action | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| View all data | ✅ | ✅ | ✅ | ✅ |
| Create/edit activities | ✅ | ✅ | ✅ | ❌ |
| Upload documents | ✅ | ✅ | ✅ | ❌ |
| Manage emission factors | ✅ | ✅ | ✅ | ❌ |
| Generate reports | ✅ | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| View subscription | ✅ | ✅ | ❌ | ❌ |
| Upgrade plan | ✅ | ❌ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ | ❌ |
| Configure AI features | ✅ | ✅ | ❌ | ❌ |

---

## 3. Member Status Lifecycle

```
┌─────────────┐    invite     ┌─────────────┐    accept     ┌─────────────┐
│   INVITED   │ ────────────→ │   ACTIVE    │ ────────────→ │  (normal)   │
│  (email sent)│               │ (has access)│               │             │
└─────────────┘               └─────────────┘               └─────────────┘
        │                            │
        │ cancel                       │ deactivate
        ▼                            ▼
┌─────────────┐               ┌─────────────┐
│  CANCELLED  │               │   INACTIVE  │
│  (revoked)   │               │ (suspended) │
└─────────────┘               └─────────────┘
                                      │
                                      │ reactivate
                                      ▼
                                ┌─────────────┐
                                │   ACTIVE    │
                                └─────────────┘
```

---

## 4. Invitation Flow

### 4.1 Step-by-Step Flow

```
Step 1: Initiator clicks "新增成員" / "Add Member"
        └── Opens invitation modal

Step 2: Enter email address
        └── Validation: must be valid email format
        └── Check: not already a member

Step 3: Select role (dropdown)
        └── Options: Admin, Editor, Viewer
        └── Default: Viewer
        └── Help text shows permission summary

Step 4: [Staging only] Select mode
        └── Active: direct activation (for closed beta testing)
        └── Invited: normal invitation flow (production)

Step 5: Confirm
        └── Summary: "Invite user@example.com as Editor?"
        └── Send invitation
```

### 4.2 Invitation Modal UI

```
┌─ 新增成員 ──────────────────────────────┐
│                                         │
│  Email *                                │
│  ┌─────────────────────────────────┐   │
│  │ user@example.com                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  角色 *                                 │
│  ┌─────────────────────────────────┐   │
│  │ 👤 檢視者 (Viewer) — 僅可檢視       │   │
│  │ 👤 編輯者 (Editor) — 可上傳與編輯     │   │
│  │ 👤 管理員 (Admin) — 可管理成員與專案  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─ 角色權限說明 ─────────────────┐     │
│  │ 檢視者：僅能檢視所有資料          │     │
│  │ 編輯者：可上傳文件、建立活動、編輯資料 │     │
│  │ 管理員：以上全部 + 管理成員與專案    │     │
│  └────────────────────────────────┘     │
│                                         │
│  [封測模式] 直接啟用 (Active)           │
│  ☑️ 直接啟用 — 無需等待對方確認          │
│                                         │
│  [取消]        [發送邀請]               │
│                                         │
└─────────────────────────────────────────┘
```

### 4.3 Closed Beta Simplification

For **closed beta only**, the invitation flow is simplified:

| Mode | Behavior | Use Case |
|------|----------|----------|
| **Active** (staging default) | Member record created with `status='active'`. No email sent. | Internal team testing, demo accounts |
| **Invited** (production) | Email invitation sent. Recipient must accept to activate. | Real user onboarding (post-beta) |

> **Production readiness**: The Active mode will be **removed** for public launch. All invitations will go through the full email flow.

---

## 5. Member List Table

### 5.1 Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Member | Avatar + name + email | ✅ |
| Role | Badge (Owner/Admin/Editor/Viewer) | ✅ |
| Status | Badge (Active/Invited/Inactive) | ✅ |
| Joined | Date | ✅ |
| Actions | Edit role / Remove | ❌ |

### 5.2 Row States

```
┌─ Active Member ─────────────────────────┐
│  🟢 王小明 (you)                        │
│     owner@acme.com │ Owner             │
│     已加入 2024-01-15                   │
└─────────────────────────────────────────┘

┌─ Invited Member ──────────────────────┐
│  🟡 待確認                              │
│     analyst@acme.com │ Editor            │
│     邀請於 2024-05-08 · 7 天後過期       │
│     [重新發送] [取消邀請]                │
└─────────────────────────────────────────┘

┌─ Inactive Member ─────────────────────┐
│  ⚫ 張大同 (已停用)                      │
│     former@acme.com │ Viewer            │
│     停用於 2024-03-10                   │
│     [重新啟用]                          │
└─────────────────────────────────────────┘
```

---

## 6. Role Editing

### 6.1 Edit Role Flow

```
Initiator clicks "調整角色" on a member row
        └── Opens role selection dropdown
        └── Shows current role highlighted
        └── Lists available roles (cannot assign Owner)
        └── Selecting a role shows confirmation dialog
        └── On confirm: update role via API
```

### 6.2 Constraints

| Constraint | Rule |
|-----------|------|
| Owner count | Minimum 1 owner must remain at all times |
| Self-edit | Cannot downgrade yourself if you're the only owner |
| Role escalation | Only Owners can assign Admin; Admins cannot assign Admin |
| Owner assignment | Only existing Owners can promote to Owner |

---

## 7. Member Removal

### 7.1 Removal Flow

```
Initiator clicks "移除成員"
        └── Confirmation dialog:
            "確定要移除 {email} 嗎？此操作無法復原。
             該成員的所有資料將保留，但無法再存取此工作空間。"
        └── On confirm:
            └── If member has created content → show additional warning
            └── Call deactivate API
            └── Member moved to "Inactive" list
```

### 7.2 Data Handling on Removal

| Question | Answer |
|----------|--------|
| Do we delete the user's data? | No — all activities, documents remain |
| Do we reassign their content? | Optional — show "Reassign to..." dropdown |
| Can they be re-invited? | Yes — re-activation restores access |
| What about audit log? | Record who removed whom and when |

---

## 8. Empty States

### 8.1 No Members (Solo Workspace)

```
┌─ 成員管理 ──────────────────────────────┐
│                                         │
│         👤                              │
│                                         │
│    目前只有您一位成員                    │
│                                         │
│    邀請團隊成員共同管理碳盤查資料         │
│                                         │
│    [邀請成員]                            │
│                                         │
└─────────────────────────────────────────┘
```

### 8.2 Pending Invites Only

```
┌─ 成員管理 ──────────────────────────────┐
│                                         │
│  活躍成員：1  │  待確認邀請：3           │
│                                         │
│  ┌─ 待確認邀請 ─────────────────────┐   │
│  │  🟡 analyst@acme.com              │   │
│  │     邀請於 3 天前 · 4 天後過期      │   │
│  │     [重新發送] [取消]               │   │
│  └───────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 9. i18n Keys

```typescript
members: {
  title: '成員管理',
  subtitle: '管理工作空間成員與權限',
  addButton: '新增成員',
  inviteButton: '邀請成員',
  emptyTitle: '目前只有您一位成員',
  emptyDescription: '邀請團隊成員共同管理碳盤查資料',

  table: {
    member: '成員',
    role: '角色',
    status: '狀態',
    joined: '加入時間',
    actions: '操作',
  },

  roles: {
    owner: '擁有者',
    admin: '管理員',
    editor: '編輯者',
    viewer: '檢視者',
  },

  roleDescriptions: {
    owner: '完整權限，包含帳單與工作空間設定',
    admin: '可管理成員與所有專案',
    editor: '可上傳文件與編輯排放資料',
    viewer: '僅可檢視資料，無法編輯',
  },

  statuses: {
    active: '已啟用',
    invited: '待確認',
    inactive: '已停用',
  },

  invite: {
    modalTitle: '新增成員',
    emailLabel: 'Email',
    emailPlaceholder: '輸入成員 Email',
    roleLabel: '角色',
    modeLabel: '啟用模式',
    activeMode: '直接啟用 (封測用)',
    invitedMode: '發送邀請 (正式)',
    sendButton: '發送邀請',
    addActiveButton: '新增並啟用',
    cancelButton: '取消',
  },

  editRole: {
    modalTitle: '調整角色',
    currentRole: '目前角色',
    newRole: '新角色',
    confirmButton: '確認調整',
    cancelButton: '取消',
  },

  remove: {
    modalTitle: '確認移除成員',
    message: '確定要移除 {email} 嗎？此操作無法復原。',
    dataWarning: '該成員建立的資料將保留，但無法再存取此工作空間。',
    confirmButton: '確認移除',
    cancelButton: '取消',
  },

  errors: {
    invalidEmail: '請輸入有效的 Email 格式',
    duplicateEmail: '此 Email 已是成員',
    lastOwner: '不能移除最後一位擁有者',
    selfDemote: '不能降級自己的角色（需由其他擁有者操作）',
  },
}
```

---

## 10. Closed Beta Checklist

- [x] Member list table with role/status badges
- [x] Add member modal (Active mode for staging)
- [x] Role editing with constraints
- [x] Member removal with confirmation
- [ ] Email invitation flow (post-beta)
- [ ] Resend invitation
- [ ] Invite expiration (7 days)
- [ ] Role change audit log
- [ ] Bulk invite (CSV upload)

---

> **Next Step**: Review `REPORT_PREFLIGHT_VALIDATION_UI.md` for the report generation preflight check specification.