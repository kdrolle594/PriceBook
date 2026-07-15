import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
// Supabase issues either a legacy anon JWT or a new sb_publishable_… key —
// both fill the same role; accept whichever name the dashboard suggested.
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Missing config renders a setup notice instead of crashing (see App.vue).
export const isConfigured = Boolean(url && anonKey)
export const supabase = isConfigured ? createClient(url, anonKey) : null
