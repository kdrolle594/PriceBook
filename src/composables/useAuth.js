import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'

const session = ref(null)
const profile = ref(null)
const ready = ref(false) // true once the initial session check finishes

async function fetchProfile() {
  if (!session.value) {
    profile.value = null
    return
  }
  const { data } = await supabase
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', session.value.user.id)
    .single()
  profile.value = data
}

let initialized = false
function init() {
  if (initialized || !supabase) return
  initialized = true
  supabase.auth.getSession().then(async ({ data }) => {
    session.value = data.session
    await fetchProfile()
    ready.value = true
  })
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    // Supabase calls must not run inside this callback (it deadlocks) —
    // defer the profile fetch a tick.
    setTimeout(fetchProfile, 0)
  })
}

export function useAuth() {
  init()

  const user = computed(() => session.value?.user || null)
  const isAdmin = computed(() => profile.value?.is_admin === true)

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    // With "Confirm email" enabled there's no session until the link is clicked
    return { needsConfirm: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { session, user, profile, isAdmin, ready, signIn, signUp, signOut }
}
