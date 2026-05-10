# Azure Deployment Plan (HWPL)

## Target Architecture (PaaS-first)

- Frontend: Azure Static Web Apps
- Backend API: Azure Functions (Node.js/TypeScript)
- Database: Azure SQL Database
- Identity and roles: Microsoft Entra ID
- Optional export archive: Azure Blob Storage
- Monitoring: Application Insights + Log Analytics

## Environments

- Development: local runtime preferred
- Production: Azure
- If local runtime is unavailable, create both dev and prod on Azure with separate resource groups.

Suggested resource groups:
- rg-hwpl-dev
- rg-hwpl-prod

## Core API Surface

- GET /api/stats/players
- GET /api/stats/teams
- GET /api/stats/leagues
- POST /api/admin/players
- PUT /api/admin/players/{id}
- DELETE /api/admin/players/{id}
- POST /api/admin/teams
- PUT /api/admin/teams/{id}
- DELETE /api/admin/teams/{id}
- POST /api/admin/leagues
- PUT /api/admin/leagues/{id}
- DELETE /api/admin/leagues/{id}
- POST /api/admin/matches
- GET /api/exports/dupr?date=YYYY-MM-DD

## Security Model

- Anonymous or authenticated read access for user stats views (your choice)
- Admin operations require Entra role claim (for example: hwpl-admin)
- Use managed identity from Functions to Azure SQL

## Data Entities

- leagues: id, name, season, is_active
- teams: id, name, league_id
- players: id, first_name, last_name, email, dupr_id, default_team_id
- matches: id, league_id, match_date, team_a_id, team_b_id, score_a, score_b
- match_participants: id, match_id, player_id, team_side, team_id

This model allows players to play outside their default team while preserving team-based stats.

## Deployment Sequence

1. Create resource groups (dev/prod)
2. Create Azure SQL and apply schema migrations
3. Create Function App and deploy API
4. Create Static Web App and connect to repository
5. Configure environment variables and connection strings
6. Configure Entra app registration and role mappings
7. Validate persona permissions and export endpoint

## What I Can Do Next

- Build the Azure Functions backend in this repository
- Wire the frontend to the API instead of in-memory data
- Generate infrastructure-as-code templates (Bicep) for dev/prod
- Prepare a safe deployment checklist for running with your credentials
