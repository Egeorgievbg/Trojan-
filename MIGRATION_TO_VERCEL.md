# Vercel Migration — Trojan 2027

## Source of truth
- AppDeploy app ID: `2027-9haq3i`
- Legacy live URL: https://2027-9haq3i.v2.appdeploy.ai/
- GitHub repository: https://github.com/Egeorgievbg/Trojan-
- Frontend: React 19 + Vite 6 + TypeScript
- Server code: `backend/index.ts`, `backend/v3.ts`, `backend/v4.ts` (currently **requires AppDeploy SDK**)
- Villa images: `public/resources/*.jpg` (six original images)
- Current export is **source and assets only**, not a database export.

## Blockers before Vercel production
1. Replace `@appdeploy/client` frontend requests with a Vercel-compatible API client.
2. Replace `@appdeploy/sdk` routing, authentication, database and AI services with Vercel-compatible implementations.
3. Create external persistent PostgreSQL database (e.g. Neon or Supabase), schema and migration scripts.
4. Export current guest responses, household identifiers, invitation/session state, shopping checks and event settings from AppDeploy by an authorized supported export method; **do not upload private data to this public GitHub repository**.
5. The guest access-code removal must be implemented with clear abuse protection. Household selection alone permits impersonation and modification of other households' answers; consider one-click household-specific invitation links with no typed code, scoped session authorization and revocation.
6. Keep organizer authentication/authorization; verify the admin identity on the server.
7. Configure AI keys and database connection as Vercel environment variables, never in source.
8. Test photo paths, family member ordering, child-safe drinks, 31 Dec to 2 Jan meal slots, shopping approvals, session recovery and mobile Viber browsing.
9. Cut over only after passing end-to-end tests; keep AppDeploy running as rollback until confirmed.

## Important
This repository is **public by the owner's choice**. No production database rows, tokens or secrets were exported with the source. The code contains hardcoded invitee names and the organizer email; review privacy before sharing the repository broadly.

### Current state
Source and six photos imported. Vercel runtime migration and data migration remain pending.
