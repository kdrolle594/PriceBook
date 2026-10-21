# Shelf Check

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
- **Item photos** — the same scan marks where each product's picture is on the
  flyer and cuts it out as a thumbnail; fix a bad crop by dragging a new box
  during review, or swap/remove a photo later from the item (admins)
- **Review before saving** — fix names, prices, dates, and photos or discard the
  flyer before anything enters the book
- **Flyer log** — every scan is listed and can be deleted along with all the
  prices it contributed
- **Shelf check** — every item shows where today's price sits between the
  lowest and highest ever seen, with a plain verdict ("Lowest price seen",
  "Higher than usual")
- **Price history** — per-store price chart and sale-validity tags
  ("ends in 3 days", "expired")
- **Item management** — rename, fix single prices, merge AI-duplicated items
- **Manual entry** — record a price you saw in-store, no flyer needed
- **Backup** — JSON export/restore (prices and items; photo files stay in
  Supabase Storage)

## Upgrading to item photos

Existing projects: run `supabase/upgrades/2026-10-21-item-photos.sql` in the
SQL editor (adds `items.photo_path` and the public `item-photos` storage
bucket with admin-only writes), then redeploy the scan function:
`supabase functions deploy extract-flyer`. Scanned photos only fill items that
have none; a photo fixed by hand during review always replaces the old one.

