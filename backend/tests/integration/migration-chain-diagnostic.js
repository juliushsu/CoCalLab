import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Diagnostic only: it stops at the first actual database error and exits nonzero.
// This deliberately does not provide Supabase Storage compatibility tables.
if (!process.env.PGLITE_RUNTIME_ROOT) throw new Error('PGLITE_RUNTIME_ROOT is required.');
const require = createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const migrations = new URL('../../supabase/migrations/', import.meta.url);
const db = new PGlite({ extensions: { citext, pgcrypto } });
const result = {
  runtime: null,
  bootstrap: 'Synthetic auth.uid and roles only; no Supabase Storage emulation.',
  migrationCount: 0,
  applied: [],
  firstBlocker: null,
};
try {
  result.runtime = (await db.query('select version()')).rows[0].version;
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated nologin nosuperuser nobypassrls;
    create role anon nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
  `);
  const files = (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort();
  result.migrationCount = files.length;
  for (const file of files) {
    const source = await readFile(new URL(file, migrations), 'utf8');
    const sha256 = createHash('sha256').update(source).digest('hex');
    try {
      await db.exec(source);
      result.applied.push({ migration: file, sha256 });
    } catch (error) {
      result.firstBlocker = { migration: file, sha256, code: error.code, message: error.message };
      break;
    }
  }
} finally {
  await db.close();
}
console.log(JSON.stringify(result, null, 2));
if (result.firstBlocker) process.exitCode = 1;
