# AI Collaboration Guide

This repo is intended for three-way AI collaboration across product governance, backend implementation, and frontend/Readdy integration. Keep changes small, traceable, and grounded in the canonical docs.

## Ownership lanes

- Product/compliance AI: owns `docs/` proposals, report template governance, factor governance, and regulatory mapping.
- Backend AI: owns `backend/src`, `backend/supabase`, backend contracts, resolver logic, tests, and migrations.
- Frontend/Readdy AI: owns `frontend/readdy-app`, UI surfaces, DTO mapping, and user-facing workflow states.

## Canonical decision order

1. Regulatory and governance proposals in `docs/`.
2. Backend contracts and migrations in `backend/`.
3. Frontend DTOs and visual states in `frontend/readdy-app`.

When a frontend field disagrees with backend governance, update the mapping document first, then update implementation.

## Current high-priority concepts

- Factor governance is dual-axis: `source_type` and `data_level` are separate.
- `activity_data_level` and `factor_data_level` must not be merged.
- CFP_P_02 is an official product/service CFP source and is usually an official secondary factor source.
- Organization-owned monitoring, direct emissions, and organization-specific factors are separate models.
- Direct emissions data must not be double-counted through factor-based calculation for the same activity.
- Factor source updates are platform-managed; tenants should not be asked to maintain official source libraries.
- Reports must be generated from versioned templates and must retain factor/template snapshots for traceability.

## Working rules

- Do not commit secrets or local `.env` files.
- Keep report and factor governance changes versioned.
- Preserve old calculation/report snapshots for traceability.
- Add tests when resolver behavior, report payloads, or DTO contracts change.
- Use small commits with clear messages; mention the affected lane in the commit body when useful.
