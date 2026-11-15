# TROJAN 2027 · архитектурна бележка

Този файл е запазен само като историческа бележка за преноса към Vercel.
Текущият production source of truth е:

- `public/app.js` и `public/styles.css` за потребителския интерфейс;
- `api/index.js` за serverless API;
- Neon PostgreSQL database `troian_2027`;
- `scripts/build.mjs` и `vercel.json` за build/deployment.

`src/`, `backend/` и AppDeploy runtime файловете не участват в текущия
production build. Не ги използвайте за паралелна имплементация.

AppDeploy app `2027-9haq3i` съдържа тестова история и не е източник на
production данни. Тестовите му отговори умишлено не се мигрират, не се
анализират и не се записват в Neon. Production приложението няма endpoint,
организаторски екран или скрит workflow за AppDeploy import.

Всички реални participant responses започват в текущата Neon схема чрез
защитени household invitation links. При бъдеща промяна на схемата се изискват
отделен migration file, изолиран тест и rollback plan; не се изпълнява
destructive SQL срещу production.
