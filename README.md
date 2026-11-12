# Flavourly — AppDeploy source snapshot

This branch contains the source snapshot exported from AppDeploy app `flavourly-21tzty` (snapshot version `1794501693937`).

## Project
- React 19 + TypeScript + Vite frontend
- TypeScript API backend and realtime order updates
- Customer, restaurant, driver and NahaLabs operations workspaces
- Demonstration order workflow and illustrative transaction allocations

## Important status
- This is the AppDeploy source snapshot; it does not mean production payments are enabled.
- Paystack approval and live split settlements remain pending.
- The backend/frontend import `@appdeploy/sdk` and `@appdeploy/client`, which are AppDeploy runtime packages. A standalone deployment requires replacing/adapting those integrations and configuring a compatible database and realtime service.
- Demo orders and displayed allocations must not be treated as real financial settlements.

## Frontend
```bash
npm install
npm run dev
```

## Source origin
https://flavourly-21tzty.v2.appdeploy.ai/
