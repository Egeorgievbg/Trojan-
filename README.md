# Троян · Нова година 2027

Vite/React frontend hosted on Vercel; the existing AppDeploy backend is used **temporarily** through a Vercel proxy.

## Current migration state
- Vercel frontend builds without importing `@appdeploy/client`.
- Guest invitation access is by one-click household link. No typed family access code is shown.
- Six villa photos are provided by `public/resources/*.jpg`.
- The **database, AI, original guest records and organizer login are not migrated**. Requests to `/api/*` are proxied to the original AppDeploy app.
- The organizer button goes to the original AppDeploy administrator view, which still requires authentication.
- Do **not** distribute new Vercel family invitations until the API proxy and family flow are tested.
- Do not turn off AppDeploy; it is the current source of truth and rollback target.
- This repository is public. Never commit guest responses, private invitation tokens, passwords or API keys.

## Local dev
```bash
npm install
npm run build
```

## Next migration phase
1. Set up a dedicated private PostgreSQL database and create the Vercel API routes.
2. Export original AppDeploy data through the authorized admin API, map users and data, import and reconcile.
3. Move organizer authentication to Vercel with a server-side email allowlist.
4. Remove the API rewrite only after backend parity, mobile verification and successful data migration.
