# Asset & Inventory Management System

Production-oriented MERN web platform for office asset tracking.

## Workspace Layout

```text
client/   React web dashboard
server/   Express API, MongoDB models, BullMQ workers
```

## Backend Highlights

- Strict Mongoose schemas with soft deletes and ObjectId references
- MongoDB multi-document transactions for asset state changes and audit logging
- Counter-based asset code generation (`DEV-0001`) designed to avoid race conditions
- QR generation and S3 upload flow for asset onboarding
- BullMQ + Redis queue for CSV bulk import processing
- Offline sync endpoint for mobile action replay

## Frontend Highlights

- React dashboard for KPIs, asset search, setup masters, creation, and action workflows
- Clean API adapter layer so the web app and future mobile app can share the same contracts

## API Outline

```text
GET    /api/health
GET    /api/dashboard/summary

GET    /api/setup/bootstrap
POST   /api/setup/categories
POST   /api/setup/products
POST   /api/setup/locations
POST   /api/setup/users

GET    /api/assets
POST   /api/assets
GET    /api/assets/:id/audit-logs
POST   /api/assets/:id/action

POST   /api/imports/assets
POST   /api/sync/offline-actions
```

## Local Setup

1. Copy `server/.env.example` to `server/.env` and fill in MongoDB, Redis, and AWS S3 settings.
2. Copy `client/.env.example` to `client/.env` if your API URL differs from `http://localhost:4000/api`.
3. Install dependencies in the workspace root or per package.
4. Start the API with `npm run dev:server`.
5. Start the website with `npm run dev:client`.

## Next Step

This turn implements the website and backend foundation first. The React Native app can be added on top of the same API surface in the next phase.
