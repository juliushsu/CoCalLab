# CoCalLab Project Overview

Last updated: 2026-05-08

## What is in this repo

This repository consolidates three working surfaces:

- CaCalLab backend reference: services, contracts, Supabase functions, migrations, seeds, and tests.
- Readdy frontend export: Vite/React application files downloaded from Readdy.
- Canonical governance docs: factor governance, organization-owned monitoring, lifecycle/versioning, compliant reports, staging fixtures, and frontend integration.

## Current architecture

Backend flow:

`organizations -> projects -> uploaded_documents -> extracted_document_drafts -> emission_activities -> calculation_results -> report_generations / ai_audit_results`

Frontend flow:

`Readdy app -> typed services -> Supabase / edge function contracts -> report and calculation payloads`

Governance flow:

`factor source -> source version -> emission factor/custom factor -> resolver trace -> calculation snapshot -> report template version -> report generation`

## Canonical docs

- `v1-backend-design.md`: backend schema and service overview.
- `CaCalLab-V1-Frontend-Integration-Contract.md`: frontend/API integration contract.
- `cfp-p02-dual-axis-governance-proposal.md`: CFP_P_02 and dual-axis factor governance.
- `org-owned-monitoring-custom-factor-proposal.md`: organization monitoring, direct emissions, and custom factor model.
- `factor-source-lifecycle-and-report-template-governance-proposal.md`: source lifecycle and compliant report template governance.
- `canonical-seed-pack.md`: staging fixture governance.

## Immediate collaboration targets

- Align Readdy factor/source UI with canonical `data_level` mapping.
- Implement `emission_factor_sources` and source version lifecycle tables.
- Add organization monitoring/direct emissions/custom factor migrations.
- Extend resolver traces with data levels, source lifecycle, and direct emission mode.
- Version report templates and map generated reports to Taiwan compliance sections.

## Known import notes

- Readdy `.env` was intentionally excluded from this repo.
- Supabase local `.temp` was intentionally excluded from this repo.
- Existing backend proposals are documentation-first and still need staging migrations before production use.
