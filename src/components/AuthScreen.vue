<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'

const { signIn, signUp, signInAsGuest } = useAuth()

const mode = ref('signin') // 'signin' | 'signup'
const email = ref('')
const password = ref('')
const busy = ref(false)
const notice = ref('')
const isErr = ref(false)

async function submit() {
  if (!email.value.trim() || !password.value) return
  busy.value = true
  notice.value = ''
  isErr.value = false
  try {
    if (mode.value === 'signin') {
      await signIn(email.value.trim(), password.value)
    } else {
      const { needsConfirm } = await signUp(email.value.trim(), password.value)
      if (needsConfirm) {
        notice.value = 'Check your email for a confirmation link, then sign in.'
        mode.value = 'signin'
      }
    }
  } catch (err) {
    isErr.value = true
    notice.value = err.message
  }
  busy.value = false
}

function switchMode() {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
  notice.value = ''
  isErr.value = false
}

async function guest() {
  busy.value = true
  notice.value = ''
  isErr.value = false
  try {
    await signInAsGuest()
  } catch (err) {
    isErr.value = true
    notice.value = err.message
  }
  busy.value = false
}
</script>

<template>
  <div class="auth">
    <div class="card">
      <h1>Price Book</h1>
      <p class="sub">Track flyer prices and spot real deals</p>

      <form @submit.prevent="submit">
        <label class="field">
          <span class="label">Email</span>
          <input v-model="email" type="email" autocomplete="email" required>
        </label>
        <label class="field">
          <span class="label">Password</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
            minlength="6"
            required
          >
        </label>

        <p v-if="notice" class="notice" :class="{ err: isErr }" role="status">{{ notice }}</p>

        <button class="primary" type="submit" :disabled="busy">
          {{ busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <button class="switch" @click="switchMode">
        {{ mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in' }}
      </button>

      <div class="divider" aria-hidden="true"><span>or</span></div>

      <button class="guest" :disabled="busy" @click="guest">
        Just browse prices as a guest
      </button>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  width: min(360px, 100%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: center;
}

h1 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.sub {
  font-size: 14px;
  color: var(--muted);
  margin-bottom: 18px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

input {
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

input:focus {
  outline: none;
  border-color: var(--hairline-strong);
  box-shadow: 0 0 0 3px var(--low-soft);
}

.notice {
  font-size: 13px;
  color: var(--muted);
}

.notice.err { color: var(--danger); }

.primary {
  margin-top: 4px;
  padding: 10px 18px;
  background: var(--ink);
  color: var(--bg);
  font-weight: 600;
  font-size: 14px;
  border-radius: var(--radius-sm);
  transition: opacity 0.15s ease;
}

.primary:hover:not(:disabled) { opacity: 0.85; }
.primary:disabled { opacity: 0.5; cursor: wait; }

.switch {
  margin-top: 14px;
  font-size: 13px;
  color: var(--muted);
  padding: 6px;
  border-radius: var(--radius-sm);
}

.switch:hover { color: var(--ink); }

.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
  color: var(--faint);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--hairline);
}

.guest {
  padding: 9px 18px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--hairline);
  font-weight: 600;
  font-size: 13.5px;
  border-radius: var(--radius-sm);
}

.guest:hover:not(:disabled) { border-color: var(--hairline-strong); }
.guest:disabled { opacity: 0.5; cursor: wait; }
</style>
