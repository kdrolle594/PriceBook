// RLS smoke test — verifies the security boundary from outside the app:
//   anonymous requests can read prices but not profiles, write nothing,
//   and the RPCs refuse.
// Usage: node scripts/check-rls.mjs
// Reads SUPABASE_URL/key from env vars or .env.local.
import { readFileSync } from 'node:fs'

function loadEnv() {
  const env = { ...process.env }
  try {
    for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.+?)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2]
    }
  } catch { /* no .env.local — rely on process env */ }
  return env
}

const env = loadEnv()
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!URL_ || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / key (env vars or .env.local)')
  process.exit(2)
}

const headers = { apikey: KEY, 'Content-Type': 'application/json' }
let failures = 0

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}`)
  if (!ok) failures++
}

// 1a. Price data is publicly readable (browsing needs no account)
for (const table of ['flyers', 'items', 'price_entries']) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, { headers })
  const body = await r.text()
  check(`anon read ${table} succeeds`, r.status === 200,
    `HTTP ${r.status}: ${body.slice(0, 120)}`)
}

// 1b. Profiles stay private — anonymous reads see nothing
{
  const r = await fetch(`${URL_}/rest/v1/profiles?select=*&limit=1`, { headers })
  const body = await r.text()
  check('anon read profiles is empty', r.status === 200 && body.trim() === '[]',
    `HTTP ${r.status}: ${body.slice(0, 120)}`)
}

// 2. Anonymous writes are rejected
{
  const r = await fetch(`${URL_}/rest/v1/items`, {
    method: 'POST', headers,
    body: JSON.stringify({ canonical: 'rls-smoke-test', display: 'RLS Smoke Test' }),
  })
  check('anon insert into items is rejected', r.status === 401 || r.status === 403,
    `HTTP ${r.status}`)
}

// 3. Admin-only RPCs refuse anonymous callers
for (const [fn, body] of [
  ['delete_flyer', { fid: '00000000-0000-0000-0000-000000000000' }],
  ['merge_items', { source: '00000000-0000-0000-0000-000000000000', target: '00000000-0000-0000-0000-000000000000' }],
]) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  })
  const text = await r.text()
  check(`rpc ${fn} refuses non-admin`, !r.ok && text.includes('admin only'),
    `HTTP ${r.status}: ${text.slice(0, 120)}`)
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll RLS checks passed')
process.exit(failures ? 1 : 0)
