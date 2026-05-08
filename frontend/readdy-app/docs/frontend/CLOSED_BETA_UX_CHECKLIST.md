# Closed Beta UX Checklist

> **Status**: Draft — Sprint v62  
> **Date**: 2026-05-08  
> **Purpose**: Ensure CoCalLab frontend is ready for closed beta launch with real users

---

## 1. Onboarding

### 1.1 First-Time User Flow

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | User receives invitation email with magic link | 🔴 | Needs email service integration |
| 2 | User clicks link → auto-authenticated | 🔴 | Needs Supabase auth + redirect |
| 3 | Landing on workspace with pre-populated data | 🟡 | Organization auto-created on invite |
| 4 | Guided tour / tooltip walkthrough | 🔴 | Not built |
| 5 | "Create your first project" CTA | ✅ | Exists on empty state |
| 6 | Help / documentation link available | 🟡 | Links to external docs placeholder |

### 1.2 Empty State Coverage

| Page | Empty State Exists | CTA Action | Status |
|------|-------------------|------------|--------|
| Organization list | ✅ | Create org | ✅ |
| Project list | ✅ | Create project | ✅ |
| Activity list | ✅ | Create activity / Upload doc | ✅ |
| Document list | ✅ | Upload document | ✅ |
| Report history | ✅ | Generate report | ✅ |
| Carbon adjustments | ✅ | Add adjustment | ✅ |
| Members list | ✅ | Add member | ✅ |
| Factor sources | ✅ | Add source | ✅ |

---

## 2. Invitation Flow

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Owner can invite by email | ✅ | AddMemberModal exists |
| 2 | Role selection with descriptions | ✅ | Dropdown + help text |
| 3 | Staging: Active mode (no email) | ✅ | For internal testing |
| 4 | Production: Email invitation | 🔴 | Needs email service |
| 5 | Invitation expiration (7 days) | 🔴 | Not implemented |
| 6 | Resend invitation | 🔴 | Not implemented |
| 7 | Cancel pending invitation | 🔴 | Not implemented |
| 8 | Accept invitation page | 🔴 | Not built |

---

## 3. Loading States

| Page / Component | Loading State | Skeleton? | Status |
|-----------------|--------------|-----------|--------|
| Dashboard / Overview | ✅ | ❌ Spinner only | 🟡 |
| Organization list | ✅ | ❌ | 🟡 |
| Project list | ✅ | ❌ | 🟡 |
| Activity table | ✅ | ❌ | 🟡 |
| Document list | ✅ | ❌ | 🟡 |
| Report preview | ✅ | ❌ | 🟡 |
| Analytics charts | ✅ | ❌ | 🟡 |
| Modal forms | ✅ | ✅ Button spinner | ✅ |

> **Recommendation**: Add skeleton screens for tables and cards to reduce perceived loading time.

---

## 4. Error States

| Error Type | UI Component | Retry Action | Status |
|-----------|-------------|-------------|--------|
| Network error | ErrorState banner | ✅ Retry button | ✅ |
| 403 Forbidden | ErrorState + redirect | ❌ No specific | 🟡 |
| 404 Not found | NotFound page | ✅ Back button | ✅ |
| 500 Server error | ErrorState banner | ✅ Retry button | ✅ |
| Validation error | Inline field errors | ✅ Fix + resubmit | ✅ |
| Session expired | IdleWarningModal | ✅ Re-login | ✅ |
| Rate limited | ErrorState banner | ⏱️ Auto-retry countdown | 🔴 |

---

## 5. Fallback States

| Scenario | Fallback Behavior | Status |
|---------|-------------------|--------|
| Supabase disconnected | Show connection warning + limited mode | 🟡 Banner exists |
| Data fetch empty | Show EmptyState with CTA | ✅ |
| Partial data load | Show what loaded + error for failed | 🔴 Not handled |
| Slow network | Show loading + timeout warning | 🟡 Basic timeout |
| Browser offline | Show offline banner | 🔴 Not built |

---

## 6. Permission Denied

| Action | Role Required | Denied UI | Status |
|--------|--------------|-----------|--------|
| Create project | Editor+ | Button disabled + tooltip | ✅ |
| Delete project | Admin+ | Hidden action | ✅ |
| Invite member | Admin+ | Hidden button | ✅ |
| Edit member role | Admin+ | Hidden action | ✅ |
| Remove member | Admin+ | Hidden action | ✅ |
| Upload document | Editor+ | Button disabled + tooltip | ✅ |
| Generate report | Editor+ | Button disabled + tooltip | ✅ |
| Manage subscription | Owner | Readonly banner | ✅ |
| Delete workspace | Owner | Hidden in settings | 🟡 |

---

## 7. Expired Session

| # | Check | Status |
|---|-------|--------|
| 1 | Idle timeout detection (30 min) | ✅ |
| 2 | Warning modal at 25 min | ✅ |
| 3 | Auto-logout at 30 min | ✅ |
| 4 | "Stay logged in" button resets timer | ✅ |
| 5 | Post-logout redirect to login | ✅ |
| 6 | Preserve unsaved form data | 🔴 Not implemented |

---

## 8. Unsupported Workflows

| Workflow | Current Behavior | Target Behavior | Status |
|----------|---------------|----------------|--------|
| Mobile device | Responsive layout | Mobile-optimized | 🟡 Desktop-first responsive |
| Tablet | Responsive layout | Tablet-optimized | 🟡 Same as mobile |
| IE11 | Not tested | Not supported | ✅ React 19 doesn't support |
| Safari | Should work | Verified | 🟡 Not explicitly tested |
| Print report | Not supported | PDF export | 🔴 |
| Bulk upload (>100 files) | Not tested | Pagination + progress | 🔴 |
| Large file (>10MB) | Error message | Chunked upload | 🔴 |

---

## 9. UX Polish Checklist

### 9.1 Navigation

| # | Check | Status |
|---|-------|--------|
| 1 | Sidebar shows active page highlight | ✅ |
| 2 | Breadcrumbs on detail pages | ✅ |
| 3 | Browser back button works correctly | ✅ |
| 4 | Deep links work (e.g., `/admin/activities?projectId=xxx`) | ✅ |
| 5 | 404 page has helpful navigation | ✅ |
| 6 | Page titles update per route | 🟡 Partial |

### 9.2 Forms

| # | Check | Status |
|---|-------|--------|
| 1 | Field validation on blur | ✅ |
| 2 | Error messages are specific and actionable | ✅ |
| 3 | Form submission shows loading state | ✅ |
| 4 | Success feedback (toast/notification) | 🔴 Not consistent |
| 5 | Unsaved changes warning on navigate | 🔴 Not implemented |

### 9.3 Data Display

| # | Check | Status |
|---|-------|--------|
| 1 | Dates formatted to local timezone | 🟡 Partial |
| 2 | Numbers formatted with locale | 🟡 Partial |
| 3 | Currency displayed with symbol | ✅ |
| 4 | Empty values show "—" not blank | 🟡 Partial |
| 5 | Long text truncated with ellipsis | ✅ |
| 6 | Tooltips on abbreviations | 🔴 Not consistent |

---

## 10. Closed Beta Readiness Score

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Onboarding | 3/6 | 20% | 10% |
| Invitation | 3/8 | 15% | 5.6% |
| Loading States | 6/9 | 10% | 6.7% |
| Error States | 6/7 | 15% | 12.9% |
| Fallback States | 3/5 | 10% | 6% |
| Permission Handling | 8/9 | 10% | 8.9% |
| Session Management | 5/6 | 10% | 8.3% |
| UX Polish | 10/16 | 10% | 6.3% |
| **Total** | **44/66** | **100%** | **~64%** |

---

## 11. Blockers for Closed Beta

| # | Blocker | Impact | Owner | ETA |
|---|---------|--------|-------|-----|
| 1 | Email invitation service | Cannot invite external beta users | Backend | Unknown |
| 2 | Invitation accept flow | Invitees cannot join | Backend | Unknown |
| 3 | Report content generation | Core feature incomplete | Codex | Unknown |
| 4 | Carbon adjustments API | Core feature incomplete | Codex | Unknown |
| 5 | Emission factor registry | Core feature incomplete | Codex | Unknown |

---

## 12. Sprint v62 Action Items

- [ ] Document all empty states (this checklist)
- [ ] Add skeleton screens to slow-loading pages
- [ ] Implement offline detection banner
- [ ] Add success toast notifications consistently
- [ ] Add unsaved changes warning
- [ ] Test Safari compatibility
- [ ] Improve date/number formatting consistency
- [ ] Add tooltips to all abbreviations

---

## 13. Changelog

| Date | Change |
|------|--------|
| 2026-05-08 | Initial checklist created |

---

> **End of Governance Sprint v62 Documentation.**

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `UX_TERMINOLOGY_AUDIT.md` | Terminology alignment analysis |
| `WORKSPACE_LEGAL_ENTITY_SPLIT.md` | L1/L2 conceptual split proposal |
| `PROJECT_CREATION_WIZARD.md` | Updated project creation flow |
| `BOUNDARY_VISUALIZER_UX.md` | Boundary preview component spec |
| `MEMBER_MANAGEMENT_UX.md` | Member invitation & role management |
| `REPORT_PREFLIGHT_VALIDATION_UI.md` | Report generation readiness checks |
| `MOCK_DEPENDENCY_MATRIX.md` | Mock data traceability |