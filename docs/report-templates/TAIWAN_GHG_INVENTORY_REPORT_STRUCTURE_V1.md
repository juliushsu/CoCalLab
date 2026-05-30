# Taiwan GHG Inventory Report Structure V1

Date: 2026-05-30
Canonical baseline: `24881a800792a3d389e3432b630cac733e49fb76`

Status: canonical report-structure specification for staging preview. This is not a legal opinion, not a compliance certification, and not a claim that CoCalLab output is acceptable for official filing or third-party verification.

## Reference Basis

This structure is derived from Taiwan Ministry of Environment public guidance and regulation pages, plus CoCalLab's current canonical world model.

Primary references:
- 環境部事業溫室氣體排放量資訊平台，盤查作業指引: https://ghgregistry.moenv.gov.tw/epa_ghg/GuideAndCalculation/GuideAndCalculation.aspx
- 溫室氣體排放量盤查登錄及查驗管理辦法: https://oaout.moenv.gov.tw/Law/LawContent.aspx?id=GL005954
- 溫室氣體排放量盤查作業指引 113 年版: https://ghgregistry.moenv.gov.tw/upload/Tools/%E6%BA%AB%E5%AE%A4%E6%B0%A3%E9%AB%94%E6%8E%92%E6%94%BE%E9%87%8F%E7%9B%A4%E6%9F%A5%E4%BD%9C%E6%A5%AD%E6%8C%87%E5%BC%95113%E5%B9%B4%E7%89%88.pdf

Regulatory anchors:
- The regulation requires annual inventory list and inventory report submission through the designated platform for covered entities.
- The report content includes basic company data, source diagrams/flows for relevant industries, source/unit/process and GHG types, fuel/material data, reduction measures, source changes, calculation methods, parameters, data sources, testing methods/dates, and emissions by direct and energy-indirect sources.
- The guidance emphasizes data-quality management records such as emission-source identification, activity-data management, emission-factor management, source evidence, and transparent exclusions.

## Canonical Report Type

Initial canonical report type:

`taiwan_ghg_inventory_preview`

Allowed positioning:

- Staging-only preview.
- Internal inventory workflow review.
- Evidence-to-report completeness check.
- Draft narrative and table renderer for guided beta.

Forbidden positioning:

- Official filing report.
- Third-party verified report.
- ISO 14064 certified output.
- Ministry of Environment compliant filing package.
- GHG Protocol compliant assurance package.

Required watermark:

`非正式申報 / 非第三方查驗 / Staging Preview Only`

## Canonical Section Structure

| Order | Canonical Section | Purpose | Minimum Data Needed | Current CoCalLab Status | Blocker |
| ---: | --- | --- | --- | --- | --- |
| 1 | 基本資料 | Identify reporting subject, workspace/project, contact basics, report version | Workspace label, project name/code, reporting entity label, address/tax ID if available, version, generated time | Partial | Legal entity/site UI and renderer do not fully expose snapshots |
| 2 | 盤查目的 | Explain why inventory is prepared | Purpose enum/label, intended use, internal/external disclaimer | Partial | Purpose exists as `claim_purpose` for adjustments, not full inventory purpose |
| 3 | 盤查邊界 | Define organizational and operational boundary | Workspace, legal entity, site/facility, boundary type, inclusion/exclusion rules | Partial | Boundary engine is compatibility-level; legal entity/site still gated |
| 4 | 盤查期間 | Define inventory time range | `reporting_period_start`, `reporting_period_end`, project period | Supported | Already persisted in `report_generations` |
| 5 | 排放源鑑別 | List source categories, units/processes, GHG types, inclusion status | Activities, category/subcategory, scope, included/excluded/pending, source docs | Partial | Source-unit/process/GHG type detail is not complete for formal reporting |
| 6 | 排放量計算方法 | Explain calculation methods and formulas | Calculation results, formula version, method type, units, CO2e conversion | Partial | Formula/method text renderer missing; calculation method taxonomy incomplete |
| 7 | 活動數據來源 | Tie activity data to documents/drafts/evidence | Uploaded docs, extracted drafts, activity records, appendix mappings | Partial | Evidence links exist conceptually; report renderer does not expose document traceability |
| 8 | 排放係數來源 | Show factor source, version, reference, URL, quality tier | `factor_sources` / `factor_sources_used`, factor snapshot | Partial | Stored in payload/factor snapshots but not rendered in Preview |
| 9 | 數據品質管理 | Describe completeness, checks, data gaps, review status | Pending/excluded counts, warnings, data gap flags, QA notes | Partial | `data_gaps_and_warnings` exists; quality scoring/management tables not canonical |
| 10 | 不確定性 / 保守性說明 | Explain uncertainty handling and conservative choices | Data-quality level, estimation method, uncertainty notes, conservative assumptions | Missing | No canonical uncertainty DTO/schema/API |
| 11 | 查證資訊 | State verification scope, verifier, assurance level, verification statement | Verification status, verifier, assurance level, dates, statement | Missing | No verification schema/API; must not be simulated |
| 12 | 附件 / 憑證 / 圖說 | Provide evidence, diagrams, certificates, source mappings | Document list, activity mapping, factor references, adjustment certificates, charts | Partial | Attachments/certificates exist in adjacent modules; report appendix renderer missing |

## CoCalLab Section Detail

### 1. 基本資料

Required renderer content:
- Report title.
- Report version.
- Generated timestamp.
- Workspace label.
- Reporting entity label if snapshot exists.
- Site/facility label if snapshot exists.
- Project name and code.
- Reporting period.
- Preview disclaimer.

Current support:
- Project and version are supported.
- Workspace/legal entity/site snapshots may exist for generated rows.
- Preview does not render all snapshot fields.

Status: partial.

### 2. 盤查目的

Required renderer content:
- Inventory objective.
- Intended use.
- Whether it is internal management, Taiwan carbon fee preparation, ESG note, or other claim purpose.
- Non-formal disclaimer.

Current support:
- `claim_purpose` exists for report generation and adjustment claim context.
- It is not the same as a full inventory-purpose narrative.

Status: partial.

### 3. 盤查邊界

Required renderer content:
- Organizational boundary.
- Operational boundary method/label.
- Included/excluded entities/sites/facilities.
- Exclusion rationale.

Current support:
- `boundary_type` and `boundary_snapshot` exist.
- Full boundary engine is not implemented.
- Legal entity/site are not production-ready flows.

Status: partial; blocked by schema/API and governance.

### 4. 盤查期間

Required renderer content:
- Start date.
- End date.
- Report generation date.
- Version immutability note.

Current support:
- `reporting_period_start` and `reporting_period_end` are persisted.

Status: supported.

### 5. 排放源鑑別

Required renderer content:
- Source category table.
- Emission activity name/code.
- Scope/category/subcategory.
- Inclusion status.
- Direct / energy indirect classification.
- GHG type where available.

Current support:
- Activities include category/subcategory/scope and inclusion status.
- Formal source unit/process and GHG type detail is incomplete.

Status: partial.

### 6. 排放量計算方法

Required renderer content:
- Calculation method by source.
- Formula and unit conversion.
- Factor version.
- Activity data quantity and units.
- CO2e output.

Current support:
- Backend uses calculation results and factor snapshots to build payload summaries.
- Preview only shows totals.

Status: partial; blocked by UI renderer.

### 7. 活動數據來源

Required renderer content:
- Source document name/type.
- Draft extraction link.
- Manual edits/review status.
- Activity-to-document appendix mapping.

Current support:
- Backend payload includes appendix mappings from activities to drafts/documents/calculation results.
- UI renderer does not expose this in report preview.

Status: partial; blocked by UI renderer.

### 8. 排放係數來源

Required renderer content:
- Factor source name.
- Factor reference/version.
- Source URL/reference.
- Quality tier.
- Applied activity/categories.

Current support:
- `factor_sources_used` exists in backend payload.
- `factor_sources` exists in `report_generations`.
- Report Preview does not render factor-source sections.

Status: partial; blocked by UI renderer.

### 9. 數據品質管理

Required renderer content:
- Data gap list.
- Pending items.
- Excluded items with rationale.
- Calculation warnings.
- Review completeness.

Current support:
- Pending/excluded counts and warnings exist.
- No formal quality table or uncertainty scoring.

Status: partial.

### 10. 不確定性 / 保守性說明

Required renderer content:
- Whether uncertainty was quantified.
- Conservative assumptions.
- Data quality basis.
- Estimation limitations.

Current support:
- No canonical uncertainty field.

Status: missing; blocked by schema/API.

### 11. 查證資訊

Required renderer content:
- Verification body.
- Assurance level.
- Verification dates.
- Verification statement.
- Verification conclusion.

Current support:
- None.

Status: missing; blocked by schema/API and policy.

### 12. 附件 / 憑證 / 圖說

Required renderer content:
- Source documents/evidence list.
- Activity appendix table.
- Factor reference appendix.
- Adjustment/certificate appendix where applicable.
- Diagrams only when real data exists.

Current support:
- Documents, activities, factor snapshots, and adjustment certificates exist across modules.
- Report appendix renderer does not exist.

Status: partial; blocked by UI renderer.

## Status Vocabulary

Use these exact values in future report-template audits:

- `supported`: Data exists, API/read path exists, renderer can show it without mock.
- `partial`: Some data exists, but renderer/API/schema coverage is incomplete.
- `mock`: UI uses fixture/fallback data.
- `missing`: No real implementation.
- `blocked by schema/API`: Required data model or endpoint does not exist.
- `blocked by UI renderer`: Data exists somewhere, but report preview/PDF cannot render it.

## Minimum Staging Preview Template

The smallest acceptable staging preview renderer should include:

1. Watermarked cover/header.
2. Basic data.
3. Inventory purpose with non-formal disclaimer.
4. Boundary summary.
5. Reporting period.
6. Scope/category totals.
7. Included/excluded/pending activity counts.
8. Factor-source summary.
9. Data gaps/warnings.
10. Appendix mapping table.

It must not include:

- Verification statement.
- Official compliance conclusion.
- Third-party assurance wording.
- Ministry filing language.
- ISO/GHG Protocol compliance claim.

## Readdy Rules

Allowed next UI work:

- Renderer-only report preview layout.
- Empty/partial/mock states.
- Watermark and disclaimer hierarchy.
- Section navigation/toc.
- Snapshot provenance labels.
- Print-friendly HTML preview scaffolding.

Forbidden next UI work:

- New report entity model.
- New `report_sections` assumptions.
- New compliance workflow.
- PDF export implementation.
- Verification UI that implies third-party assurance.
- New CBAM/Product CFP reporting workflow.

Required Readdy input URL:

https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/TAIWAN_GHG_INVENTORY_REPORT_STRUCTURE_V1.md

