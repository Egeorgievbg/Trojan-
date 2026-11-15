# Троян 2027 · production application

## Текущ статус

TROJAN 2027 се изпълнява като vanilla frontend от `public/` и serverless API от
`api/index.js`, публикувани във Vercel чрез `scripts/build.mjs`. Production
данните се съхраняват в Neon PostgreSQL. React/Vite и `backend/` са наследен
код и не участват в текущия build.

- Гостите получават личен household invitation link от организатора.
- Данните се изолират server-side по домакинство и се пазят с optimistic versioning.
- Organizer достъпът използва Google OAuth със server-side allowlist.
- Публичната начална страница показва само обобщени бройки; имена и отговори не се връщат от `/api/public`.
- AppDeploy е тестова историческа среда и не е production source of truth.
- В production runtime няма AppDeploy import или migration workflow.

## Neon и Vercel настройки

Използваната база е Neon project `snowy-star-04842795`, database `troian_2027`.
Vercel трябва да има следните environment variables:

`DATABASE_URL`, `SESSION_SECRET` (минимум 32 символа), `PUBLIC_BASE_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`; опционално
`OPENAI_API_KEY`.

Не публикувайте стойности в GitHub или чат. Google OAuth callback трябва да бъде:
`<PUBLIC_BASE_URL>/api/auth/callback`.

## Локална проверка

Използвайте Node 22 или по-нов:

```bash
npm ci
npm test
npm run check
npm audit --omit=dev
```

API тестовете използват изолирана PGlite база и fixtures. Те не се свързват към
production Neon, Vercel или AppDeploy и не използват реални participant records.

## Release checklist

1. Настройте environment variables във Vercel без да записвате секрети в repository.
2. Изпълнете локалните проверки и preview deployment от тествания commit.
3. Проверете `/api/health` и изискайте `databaseReachable: true`.
4. Влезте като organizer и генерирайте личните покани.
5. Изпълнете поканения flow през Viber/mobile browser: присъствие, дни, предпочитания, алергии, общи отговорности, review и повторно отваряне.
6. Проверете organizer менюто, порциите, shopping list, bought markers и CSV.
7. Публикувайте production само ако release gates са PASS и deployed commit съвпада с тествания commit.

## Безопасност и privacy

Това е публично GitHub repository. Никога не добавяйте invitation tokens,
guest sessions, реални отговори, алергии или credentials. Не се прави импорт на
AppDeploy test data и не се създава migration workflow за него.

## Production адреси

- Application: https://trojan-nu-liard.vercel.app/
- Health: https://trojan-nu-liard.vercel.app/api/health
- Vercel environment settings: https://vercel.com/egeorgievbgs-projects/trojan/settings/environment-variables
