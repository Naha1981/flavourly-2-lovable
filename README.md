# Flavourly — independent NahaLabs platform

Flavourly is being separated from AppDeploy into a conventional React + Node.js + PostgreSQL application.

## Current independent foundation

- React 19 + TypeScript + Vite customer, restaurant, driver and NahaLabs workspaces.
- Express API with PostgreSQL persistence for orders.
- Server-sent events for live order updates, with browser auto-reconnect.
- Server-calculated order totals and illustrative allocations.
- Docker Compose for a repeatable local deployment.
- Helmet security headers and API rate limiting.

## Run locally (Node.js 22+)

1. Install Docker Desktop and start it.
2. Copy `.env.example` to `.env` and set a private database password.
3. Start PostgreSQL: `docker compose up -d db`
4. In a terminal: `npm ci`
5. Start API and Vite: `npm run dev:full`
6. Open http://localhost:5173

The API runs on port 3001 and Vite proxies `/api` requests to it.

## Run as one container

`docker compose up --build -d`

Open http://localhost:3001

## API

- `GET /api/health`
- `GET /api/orders`
- `POST /api/orders`
- `PUT /api/orders/:id`
- `GET /api/events` (Server-Sent Events)

## Important: pilot/staging only

This is an independent deployment foundation, not yet safe for public production or live transactions.

Before inviting real customers or restaurants, implement and test:
- Authentication, role-based authorisation and tenant isolation for customers, merchants, drivers and NahaLabs operators.
- Real restaurant/menu/catalogue data instead of the current illustrative in-app sample data.
- Driver identity, availability, dispatch acceptance, location permissions, GPS and proof of delivery.
- Paystack live approval, signed webhook verification, idempotency, refunds, reconciliation and actual split-settlement confirmation.
- Delivery-zone pricing, taxes, privacy/POPIA workflows, backups, monitoring and operational support.

The allocation shown is a business-model illustration, not a Paystack settlement instruction. Paystack compliance remains pending. No payment is collected by this code.

## Source history

Original UI and visual design were exported from AppDeploy app `flavourly-21tzty`. AppDeploy-specific SDK imports have been removed from the frontend and backend.
