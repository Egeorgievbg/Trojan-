# Троян 2027 · независима Vercel миграция

## Текущ статус
- Преносим frontend и Vercel API без `@appdeploy/*` зависимости. Използва Neon PostgreSQL.
- Снимките на вилата са копирани при build от `public/resources/` към `dist/images/`.
- **Няма код за въвеждане от гостите**. Администраторът изпраща защитен личен линк за всяко семейство.
- Администраторският вход използва Google OAuth (server-side allowlist).
- AppDeploy `2027-9haq3i` е старият източник на данни и остава непокътнат.
- ВАЖНО: **историческите AppDeploy отговори не са импортирани**. Не изпращайте покани, преди да проверите миграцията и автентикацията.

## Свързана Neon база
- Dedicated Neon project: `snowy-star-04842795`.
- Database: `troian_2027`, регион `aws-eu-central-1`.
- Таблиците са създадени и 14 участници в 4 домакинства са импортирани като празна основа.

## Настройки на Vercel
Създайте Project Environment Variables в правилния Vercel проект:
`DATABASE_URL`, `SESSION_SECRET` (минимум 32 символа), `PUBLIC_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`; опционално `OPENAI_API_KEY`.
Не публикувайте стойностите в GitHub. В Google OAuth настройте callback: `<PUBLIC_BASE_URL>/api/auth/callback`.

## Следващи действия
1. Във Vercel настройте environment variables (без изпращане на пароли в чат).
2. Изпълнете build и посетете `/api/health`.
3. Проверете Google organizer login и генерирайте 4 лични линка.
4. Експортирайте AppDeploy историята през разрешен администраторски достъп, проверете структурата и импортирайте чрез защитения admin/import маршрут.
5. Проверете реален RSVP, детски напитки, менюто, покупките и снимките през мобилен браузър.
6. Едва тогава прекратете временната експлоатация на AppDeploy.

**Безопасност:** GitHub хранилището е публично; никакви лични покани, сесии, медицински данни или credentials не бива да се записват в него.

## Vercel production address and readiness
- Production URL: https://trojan-nu-liard.vercel.app/
- Health: https://trojan-nu-liard.vercel.app/api/health (HTTP 503 until Neon DATABASE_URL is present and reachable).
- Environment Settings: https://vercel.com/egeorgievbgs-projects/trojan/settings/environment-variables
- After adding DATABASE_URL from Neon, deploy again and check databaseReachable=true before distributing links.

## Safe import workflow
- Export the historical dataset with authorized AppDeploy admin permissions; keep it off this public repository.
- In the Vercel organizer admin panel open **Миграция**, choose the export JSON and review the preview counts.
- Import requires confirmation plus a matching SHA-256 digest; existing preferences, attendance and shared responses are never overwritten.
- The complete source snapshot is stored in private Neon `migration_archives` for reconciliation. Historical shopping and event settings remain archived (not silently activated).
- Imported child drinks are filtered against the alcohol denylist.


## Verified maintenance checks
Run `npm ci`, `npm test`, and `npm run check` with Node 22 or newer (Node 24 tested).
The executable API tests run the actual handler against an isolated PGlite PostgreSQL
instance with the Neon transport replaced. They never contact production or AppDeploy.
`tests/tests.json` is a historical AppDeploy checklist, not the current API test suite.

The migration endpoint requires an authorized export, a preview digest, and explicit
confirmation. Source export and a pre-import backup of attendance, preferences, and
household shared answers are archived in the same transaction as the insert-only import.
The response includes expected and inserted record counts for reconciliation. A mismatch
requires review (for example, another device may have inserted an answer after preview).
No historical answers have been imported by the test suite.

### External setup still required
The existing Neon project is not exposed as a connectable native Marketplace resource
in this Vercel team. Do not provision a replacement. The owner must set `DATABASE_URL`
for database `troian_2027` from the existing project through a secure Vercel variable entry.
Google login also requires real `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, with the
production `/api/auth/callback` URL authorized in Google Cloud. Never put those values
in issues, source, PRs, or chat. Health intentionally remains HTTP 503 without a reachable database.
