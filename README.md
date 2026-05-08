# CoCalLab

CoCalLab is the shared collaboration repo for the CaCalLab carbon accounting project. It currently collects the backend reference implementation, the Readdy frontend export, and canonical governance documents so multiple AI agents can work from the same source of truth.

## Repository map

- `docs/`: canonical product, compliance, factor governance, staging, and frontend integration documents.
- `backend/`: CaCalLab V1 backend services, Supabase functions, migrations, seeds, and tests.
- `frontend/readdy-app/`: Readdy Vite/React frontend export, with local environment files intentionally excluded.

## Start here

1. Read [AI_COLLABORATION.md](AI_COLLABORATION.md) for collaboration rules and ownership boundaries.
2. Read [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the current system map.
3. Treat these governance docs as canonical unless superseded by a newer committed proposal:
   - [docs/cfp-p02-dual-axis-governance-proposal.md](docs/cfp-p02-dual-axis-governance-proposal.md)
   - [docs/org-owned-monitoring-custom-factor-proposal.md](docs/org-owned-monitoring-custom-factor-proposal.md)
   - [docs/factor-source-lifecycle-and-report-template-governance-proposal.md](docs/factor-source-lifecycle-and-report-template-governance-proposal.md)
   - [docs/CaCalLab-V1-Frontend-Integration-Contract.md](docs/CaCalLab-V1-Frontend-Integration-Contract.md)

## Local commands

Backend:

```sh
cd backend
npm test
```

Frontend:

```sh
cd frontend/readdy-app
npm install
npm run type-check
npm run build
```

## Security note

Do not commit `.env`, Supabase `.temp`, local credentials, service-role keys, or downloaded private exports that are not meant to be shared.
