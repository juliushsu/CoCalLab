# Workspace / Legal Entity UI Semantic Split Proposal

> **Status**: Draft — Pending Codex canonical model  
> **Date**: 2026-05-08  
> **Prerequisite**: `UX_TERMINOLOGY_AUDIT.md`  
> **Blocked by**: Codex `organizations` table split decision

---

## 1. Problem Statement

Currently, the `organizations` table and `/admin/organizations` pages serve **two masters**:

| Master | Needs | Current UI |
|--------|-------|-----------|
| **SaaS Tenant (Workspace)** | Billing, members, subscription, settings | "Organization Management" |
| **Legal Entity** | Tax ID, regulatory subject, reporting identity | Same page, same form |

This creates confusion:
- User creates "Acme Corp" → thinks they created a company record
- Actually they created a **workspace** that happens to carry company metadata
- When multi-entity support arrives, they'll need to create subsidiaries under the same workspace

---

## 2. Proposed Split Strategy

### 2.1 Conceptual Split

```
┌─────────────────────────────────────────┐
│  Workspace (L1)                         │
│  ├── subscription_plan: 'professional'    │
│  ├── billing_email: 'finance@acme.com'    │
│  ├── max_projects: 10                     │
│  └── members: [owner, admin, editor...] │
│                                         │
│  └── Legal Entities (L2) [1..n]         │
│      ├── legal_entity: 'Acme Corp TW'   │
│      │   ├── tax_id: '12345678'          │
│      │   ├── country_code: 'TW'          │
│      │   └── sites: [Taipei HQ, Factory] │
│      │                                   │
│      └── legal_entity: 'Acme Corp SG'    │
│          ├── tax_id: 'SG-XXX'            │
│          └── sites: [Singapore Office]   │
└─────────────────────────────────────────┘
```

### 2.2 UI Navigation Split

**Current (Single "Organizations")**:
```
Sidebar
├── Organizations
│   ├── List
│   ├── Create
│   ├── Edit
│   └── Members
```

**Proposed (Split into Workspace + Legal Entities)**:
```
Sidebar
├── Workspace                    ← L1 (was "Organizations")
│   ├── Overview
│   ├── Members                  ← moved here from org members
│   ├── Subscription
│   ├── Billing
│   └── Settings
│
├── Legal Entities               ← L2 (new)
│   ├── List
│   ├── Create
│   └── Edit
│
├── Sites / Facilities           ← L3 (new)
│   ├── List
│   └── Create
│
└── Projects                     ← L4
    └── ...
```

---

## 3. Workspace Page (L1) Specification

### 3.1 Workspace Overview

| Section | Content |
|---------|---------|
| **Workspace Identity** | Display name, slug, timezone, created_at |
| **Subscription Card** | Current plan, status, renewal date, usage bars |
| **Members Summary** | Total members, pending invites, role distribution |
| **Legal Entities** | Count, quick links to entity list |

### 3.2 Workspace Members

**This is the current "Organization Members" page, relabeled.**

| Role | Permissions | Billing Access? |
|------|------------|----------------|
| `owner` | Full access + can delete workspace | ✅ Yes |
| `admin` | Manage members + all projects | ❌ No billing |
| `editor` | CRUD on activities, documents, factors | ❌ No billing |
| `viewer` | Read-only all data | ❌ No billing |

> **Key distinction**: Workspace members control **who can access the SaaS account**. Legal entity members (future) control **who can sign off on regulatory reports**.

### 3.3 Workspace Settings

| Setting | Scope |
|---------|-------|
| Display name | Workspace branding |
| Timezone | Default for all projects |
| Language preference | Default for reports |
| Data retention policy | Workspace-level |
| AI feature toggles | Workspace-level (was "org-level") |

---

## 4. Legal Entity Page (L2) Specification

### 4.1 Legal Entity List

| Column | Source |
|--------|--------|
| Legal name | `legal_name` |
| Tax ID | `tax_id` |
| Country | `country_code` |
| Sites count | Join from `sites` table |
| Projects count | Join through `sites` → `projects` |

### 4.2 Legal Entity Detail

| Tab | Content |
|-----|---------|
| **Info** | Legal name, tax ID, address, registration info |
| **Sites** | List of facilities/ offices under this entity |
| **Projects** | GHG inventory projects for this entity |
| **Regulatory** | Compliance status, filing history, certifications |

### 4.3 Relationship to Workspace

```
Workspace "Acme Global"
├── Legal Entity "Acme Corp Taiwan" (tax_id: 12345678)
│   └── Site "Taipei HQ"
│   └── Site "Taichung Factory"
│
└── Legal Entity "Acme Corp Singapore" (tax_id: SG-XXX)
    └── Site "Singapore Office"
```

> **Rule**: A workspace can have **many** legal entities. A legal entity belongs to **one** workspace.

---

## 5. Site / Facility Page (L3) Specification

### 5.1 Site List

| Column | Example |
|--------|---------|
| Site name | "Taipei Headquarters" |
| Type | `office` / `factory` / `warehouse` / `data_center` |
| Address | Full address |
| Legal entity | Parent L2 |
| Active projects | Count |

### 5.2 Site Types

| Type | Description |
|------|-------------|
| `office` | Administrative office |
| `factory` | Manufacturing facility |
| `warehouse` | Storage / distribution |
| `data_center` | IT infrastructure |
| `retail` | Store / branch |
| `mixed_use` | Multiple functions |

---

## 6. Impact on Existing Pages

| Page | Current Behavior | After Split |
|------|-----------------|-------------|
| `/admin/organizations` | Lists L1+L2 combined | Becomes `/admin/workspace` overview |
| `/admin/organizations/create` | Creates L1+L2 at once | Moves to `/admin/workspace/settings` + separate `/admin/legal-entities/create` |
| `/admin/organizations/:id/members` | Workspace members | Moves to `/admin/workspace/members` |
| `/admin/projects/create` | Selects "organization" | Selects **Legal Entity** → then **Site** → then Boundary |
| Project list filter | "Filter by Organization" | "Filter by Legal Entity" + "Filter by Site" |
| Subscription page | Standalone | Integrated into Workspace settings |

---

## 7. Migration Path (Staged)

### Phase 1: Documentation & i18n Prep (This Sprint)
- Create all proposal docs (this doc + related)
- Add new i18n keys under `workspace.*` and `legalEntity.*` namespaces
- Keep old keys for backward compatibility

### Phase 2: UI Skeleton (Next Sprint)
- Add "Workspace" sidebar section with placeholder pages
- Add "Legal Entities" sidebar section (read-only list from `organizations` table)
- Add explanatory banners: "This page is being restructured. Learn more."

### Phase 3: DB Migration (When Codex Ready)
- Codex splits `organizations` → `workspaces` + `legal_entities`
- Frontend updates type definitions
- Frontend updates service layer

### Phase 4: Full Cutover
- Remove old `/admin/organizations` routes (or redirect)
- Full UI cutover to new navigation

---

## 8. Open Questions for Codex

1. Should `workspaces` and `legal_entities` be **separate tables** or **views on the same table**?
2. Should the `slug` field belong to workspace or legal entity?
3. For single-entity users (most current users), should we **auto-create** a legal entity matching the workspace?
4. What is the canonical name for L3: `sites`, `facilities`, or `locations`?
5. Should `projects` FK to `legal_entity_id` or `site_id` or both?

---

## 9. UI Mock — Navigation Sidebar (Target State)

```
┌─ CoCalLab ───────────────┐
│  📊 Dashboard             │
│  ───────────────────────  │
│  🏢 WORKSPACE             │
│     Overview              │
│     Members               │
│     Subscription          │
│     Settings              │
│  ───────────────────────  │
│  🏛️ LEGAL ENTITIES        │
│     All Entities          │
│     Create Entity         │
│  ───────────────────────  │
│  🏭 SITES                 │
│     All Sites             │
│  ───────────────────────  │
│  📁 PROJECTS              │
│     All Projects          │
│     Create Project        │
│  ───────────────────────  │
│  📎 DOCUMENTS             │
│  ⚡ ACTIVITIES            │
│  📊 ANALYTICS             │
│  📈 REPORTS               │
│  🌱 CARBON ADJUSTMENTS    │
│  ⚙️ EMISSION FACTORS      │
│  🤖 AI GOVERNANCE         │
└───────────────────────────┘
```

---

> **Next Step**: Review `PROJECT_CREATION_WIZARD.md` for the updated project creation flow incorporating the L1→L2→L3→L4 hierarchy.