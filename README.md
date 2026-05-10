# Hiram Walker Pickleball League Web App

A React + TypeScript web app for managing and viewing league statistics.

## Features

- Persona views: regular user and admin
- Admin CRUD workflows for players, teams, and leagues
- Player profile fields: first name, last name, email, DUPR ID, default team
- Match entry by admin with validation
- Player, team, and league statistics tables
- CSV export for all matches on a selected date (current format is a placeholder for final DUPR schema)

## Run locally

1. Install Node.js 20+ (includes npm).
2. Install dependencies:
   `npm install`
3. Start the development server:
   `npm run dev`
4. Build for production:
   `npm run build`

## Project scripts

- `npm run dev`: start local development server
- `npm run build`: run TypeScript compile and Vite production build
- `npm run preview`: preview production build locally

## Club Logo And Color Theme

1. Put your official logo image at `public/brand/hwpl-logo.png`.
2. The app will render this logo in the hero area automatically.
3. Update the color tokens in `src/styles.css` to match your logo palette:

```css
:root {
   --logo-primary: #0f6d5f;
   --logo-secondary: #154f45;
   --logo-accent: #e4a75a;
   --logo-highlight: #f3d4a8;
}
```

Use your exact brand hex values here once you have them from the logo.

## Azure PaaS Deployment Blueprint

Recommended production architecture:

- Frontend hosting: Azure Static Web Apps
- API layer: Azure Functions (HTTP APIs for players, teams, leagues, matches, exports)
- Data store: Azure SQL Database (relational model with leagues, teams, players, matches, match_participants)
- Identity: Microsoft Entra ID (admin role claims + public read policy)
- File exports: Azure Blob Storage (optional, for archived CSV exports)

Environment strategy:

- Option A (preferred): run locally for development, deploy one production environment to Azure.
- Option B: if local runtime is unavailable, use two Azure environments (dev and prod) with separate resources and config.

## Data Model Notes

- Players have a default team but can participate in matches for any team.
- Team statistics are calculated from matches where players represented that team.
- Export endpoint should support: all matches for a specific date in your final DUPR CSV format.

## Next Implementation Milestones

1. Add persistent backend API (Azure Functions) and move mock state to server-backed state.
2. Add authentication and role-based authorization (user vs admin).
3. Implement finalized DUPR CSV schema once provided.
4. Add CI/CD to Azure using GitHub Actions.
