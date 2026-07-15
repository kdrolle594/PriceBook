# Price Book

Track supermarket flyer prices over time and spot which "sales" are actually the
lowest price. Scan a flyer photo and Claude extracts every item and price; each
price is stored with its sale window so you can see what's still valid, what's
about to end, and what an item has really cost across weeks and stores.

Vue 3 + Vite single-page app backed by Supabase (Postgres + auth + row-level
security). Everyone signed in can browse prices — including one-click guests —
but only admins can scan flyers, edit items, or delete data.

## Features

- **Flyer scanning** — drop a photo/screenshot; items, prices, and the sale's
  start/end dates are extracted automatically (Anthropic API via a Supabase
  Edge Function — the key never reaches a browser)
- **Review before saving** — fix names, prices, and dates or discard the flyer
  before anything enters the book
- **Flyer log** — every scan is listed and can be deleted along with all the
  prices it contributed
- **Price history** — per-store price chart, historic-low and price-change
  chips, sale-validity badges ("ends in 3 days", "expired")
- **Item management** — rename, fix single prices, merge AI-duplicated items
- **Manual entry** — record a price you saw in-store, no flyer needed
- **Backup** — JSON export/restore

## Setup

1. `npm install`
2. Create a free [Supabase](https://supabase.com) project and run
   `supabase/schema.sql` in its SQL editor
3. Copy `.env.example` to `.env.local` and fill in the project URL and
   publishable (or anon) key from Project Settings → API
4. `npm run dev`, sign up in the app, then make yourself admin in the SQL
   editor:
   `update profiles set is_admin = true where email = 'you@example.com';`
5. Deploy the extraction function with the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):
   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy extract-flyer
   ```

Run `npm test` for the unit tests and `npm run check:rls` to verify the
database security boundary from outside the app.

Optional: enable **Authentication → Sign In / Up → Allow anonymous sign-ins**
so visitors can browse prices as guests without an account.

## Deploying

Any static host works. For Vercel: import the repo, keep the detected Vite
settings, and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as
environment variables.
