# Readdy Next Sprint Recommendation V1

Date: 2026-05-30

Basis:
- GitHub canonical repo commit `b89a99baa6514ff1342edd0ba0baf39ae99a33d4`
- Ver65 Readdy package audit
- Closed-beta target: narrow, guided, staging-only

Mode:
- Recommendation only.
- Do not merge Ver65 directly.
- Do not add schema, backend assumptions, CBAM, Product CFP, or formal compliance claims.

## 1. Must Do

### P0. Package Hygiene

Remove from any merge candidate:
- Root `.env`
- Any generated or local-only secret-bearing files

Acceptance:
- Readdy handoff package must not contain `.env`.
- GitHub canonical repo must not receive secret-bearing package artifacts.

### P0. Fix Closed-Beta Sidebar Gating

Required:
- Documents sidebar must not point to missing `/admin/documents`.
- Product CFP must be hidden or coming soon, not active.
- Factor Sources / Source Governance must be hidden, internal-only, or unmistakably mock/demo.
- AI Governance must be platform-only at route level, not just sidebar level.
- Activity Detail must be hidden/disabled or clearly marked mock-only until real read/write path exists.

Acceptance:
- A closed-beta tester cannot reach active Product CFP, CBAM, Self Monitoring, Methodology, AI Governance, Factor Sources, or mock Activity Detail through normal navigation.

### P0. Close Core Raw Keys

Required prefixes:
- `documents.*`
- `activities.*`
- `reports.*`
- `projects.*`
- user-visible `organizations.*`

Acceptance:
- No raw key appears in the guided journey:
  - login
  - workspace
  - project
  - document upload
  - draft review
  - activity list/create
  - analytics
  - report history/preview

### P0. Report Reality Copy

Required:
- Report Preview must say staging preview / draft / not formal compliance.
- Report Validation must remain preview/preflight only.
- Export must be hidden or clearly unavailable if backend export is not deployed.
- AI audit must be described as preflight support, not validation.

Acceptance:
- No user-facing copy claims formal EPA Taiwan, ISO 14064, or GHG Protocol compliance.

## 2. Forbidden

Readdy must not independently add:
- New entity model
- New DTO
- New database schema
- New migration
- CBAM workflow
- Product CFP workflow
- Governance engine
- New report compliance template
- New route ownership
- Backend capability assumptions
- Public signup
- Production rollout copy

Readdy must not rename canonical concepts without approval:
- `workspace`
- `legal_entity`
- `site`
- `project`
- `report_boundary`
- `report`
- `methodology`
- `platform`

Readdy must not present mock data as:
- verified
- official
- compliant
- production
- source of truth

## 3. Features That Should Be Hidden

Hide from closed-beta tenant testers:
- Product CFP
- CBAM
- Self Monitoring
- Methodology
- AI Governance
- Factor Sources / Source Governance
- Report Validation as formal validation
- Activity Detail mock route
- Export report, unless export endpoint is confirmed
- Product / supply chain section

Keep visible only if clearly disabled:
- Legal Entity placeholder
- Site / Facility placeholder
- Report boundary placeholder
- Coming soon capability cards

## 4. Features That Should Be Corrected

| Feature | Required Correction | Priority |
| --- | --- | --- |
| Documents sidebar | Route to upload/list/drafts decision, not missing `/admin/documents` | P0 |
| Members sidebar | Route to an actual workspace member page or hide until workspace context exists | P0 |
| Report Preview | Remove raw keys and formal-report implication | P0 |
| Activity Detail | Hide/disable or label as mock-only | P0 |
| Product CFP | Hide or convert to non-clickable coming soon | P0 |
| AI Governance | Add route-level platform-only guard or remove route from beta build | P0 |
| Factor Sources | Hide or mark internal demo only | P1 |
| Analytics hotspot | Hide or explicitly label mock/unsupported | P1 |
| Carbon Adjustments | Keep as preview/internal unless rule engine and tables are fully real | P1 |
| Brand metadata | Replace `seq=cacallab-*` identifiers and keep visible brand as `CoCalLab` / `碳計算實驗室` / `コカラボ` | P2 |

## 5. Features That Should Wait for Canonical API

Wait for canonical backend/schema/API before productizing:
- Report sections persistence
- Report export endpoint
- Formal report validation endpoint
- Capability / entitlement API
- Factor source governance API
- Factor source resolution provenance API
- Carbon adjustment rule engine final result API
- Product CFP data model and workflow
- CBAM workflow
- AI governance provider/cost/audit API
- Workspace legal entity / site full management model

## 6. Readdy UI Task Priority 1-10

1. Remove `.env` from merge candidate and establish "no package secrets" handoff rule.
2. Fix broken Documents sidebar route.
3. Hide Product CFP from closed-beta navigation.
4. Hide or internalize Factor Sources / Source Governance.
5. Route-gate AI Governance as platform-only or remove from beta build.
6. Hide or mock-label Activity Detail until real read/write path exists.
7. Complete core i18n for Documents, Activities, Reports, Projects.
8. Strengthen Report Preview copy: draft, staging, snapshot, no compliance claim.
9. Keep Analytics GHG/ISO visible but hide or mock-label hotspot sections.
10. Clean brand hygiene in Readdy image sequence identifiers and any remaining deprecated naming.

## 7. Sprint Sequencing

### Sprint 1: Beta Safety and Navigation

Goal:
- Prevent testers from reaching broken, off-scope, or misleading routes.

Work:
- Package hygiene check.
- Sidebar route gating.
- Documents route fix.
- Product CFP/CBAM/Self Monitoring/Methodology visibility cleanup.
- AI Governance route-level protection.
- Activity Detail gating.

Expected duration:
- 3-5 engineering days.

### Sprint 2: Trust and Translation

Goal:
- Make the guided value chain credible enough for external testers.

Work:
- Core raw key cleanup.
- Report preview disclaimers.
- Data-origin badges on visible mock/fallback areas.
- Success states and next-step cues for document -> draft -> activity -> analytics -> report.

Expected duration:
- 5-7 engineering days.

### Sprint 3: Report/Analytics Stabilization

Goal:
- Make reports and analytics safe as staging-only value moments.

Work:
- Report History source labeling.
- Snapshot vs mock summary labeling.
- Disable export if not deployed.
- Hide unsupported analytics dimensions.
- Carbon adjustment preview gating.

Expected duration:
- 5-7 engineering days.

## 8. Merge Recommendation

Do not merge Ver65 wholesale.

Recommended approach:
- Cherry-pick allowed UI governance/value-chain components.
- Apply P0 route and i18n corrections before any broader merge.
- Keep off-scope features hidden until canonical API/schema exists.
- Treat report surfaces as staging preview only.

Next canonical handoff to Readdy:
- Provide `READDY_ALIGNMENT_PACK_V1` first.
- Then provide this `READDY_NEXT_SPRINT_RECOMMENDATION_V1`.
- Do not give Readdy authority to invent DTOs, entity ownership, Product CFP, CBAM, or report compliance flows.
