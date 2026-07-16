<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'

const { signIn, signUp } = useAuth()

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
</script>

<template>
  <form class="login" @submit.prevent="submit">
    <label class="field">
      <span class="flabel">Email</span>
      <input v-model="email" type="email" autocomplete="email" required>
    </label>
    <label class="field">
      <span class="flabel">Password</span>
      <input
        v-model="password"
        type="password"
        :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
        minlength="6"
        required
      >
    </label>

    <p v-if="notice" class="notice" :class="{ err: isErr }" role="status">{{ notice }}</p>

    <div class="actions">
      <button class="primary" type="submit" :disabled="busy">
        {{ busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account' }}
      </button>
      <button class="switch" type="button" @click="switchMode">
        {{ mode === 'signin' ? 'Create an account' : 'Have an account? Sign in' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flabel {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

input {
  padding: 9px 11px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  font-size: 13.5px;
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

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary {
  padding: 8px 16px;
  background: var(--ink);
  color: var(--bg);
  font-weight: 600;
  font-size: 13.5px;
  border-radius: var(--radius-sm);
  transition: opacity 0.15s ease;
}

.primary:hover:not(:disabled) { opacity: 0.85; }
.primary:disabled { opacity: 0.5; cursor: wait; }

.switch {
  font-size: 12.5px;
  color: var(--muted);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.switch:hover { color: var(--ink); }
</style>
