import { mock } from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { SignJWT } from 'jose';

const read = name => readFile(new URL('../sql/' + name, import.meta.url), 'utf8');

export async function isolatedEvent(origin = 'https://example.test') {
  const pg = new PGlite();
  const migration = await read('migrations/001-event-v2.sql');
  await pg.exec(await read('schema.sql'));
  await pg.exec(await read('seed.sql'));
  await pg.exec(migration);
  await pg.exec(migration);
  // Apply every additive release migration to the synthetic test database.
  for (const name of ['002-third-night.sql','003-communications.sql','004-ai-usage.sql']) {
    const step = await read('migrations/' + name);
    await pg.exec(step);
    await pg.exec(step); // All new migrations must be idempotent.
  }
  await pg.exec('UPDATE t27_settings SET enabled = true, fixture_only = true WHERE id = 1');
  mock.module('@neondatabase/serverless', { namedExports: { neon: () => {
    const query = (strings, ...values) => {
      const text = strings.reduce((sql, part, i) => sql + (i ? '$' + i : '') + part, '');
      const run = async client => (await client.query(text, values)).rows;
      return { run, then(resolve, reject) { return run(pg).then(resolve, reject); } };
    };
    query.transaction = queries => pg.transaction(async tx => {
      const result = [];
      for (const query of queries) result.push(await query.run(tx));
      return result;
    });
    return query;
  } } });
  process.env.DATABASE_URL = 'postgresql://local-test/isolated';
  process.env.SESSION_SECRET = randomBytes(48).toString('base64url');
  process.env.PUBLIC_BASE_URL = origin;
  process.env.ADMIN_EMAILS = 'organizer@example.test';
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_TARGET_ENV;
  const { default: handler } = await import('../api/index.js');
  const organizer = await new SignJWT({ email: process.env.ADMIN_EMAILS })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('troian-2027').setAudience('troian-admin')
    .setExpirationTime('1h').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  async function invitation(home, expires = null) {
    const invite = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(invite).digest('hex');
    await pg.query('INSERT INTO invitations(household_id, token_hash, expires_at) VALUES ($1, $2, $3) '
      + 'ON CONFLICT (household_id) DO UPDATE SET token_hash = $2, expires_at = $3', [home, hash, expires]);
    return invite;
  }
  return { pg, handler, organizer, invitation };
}
