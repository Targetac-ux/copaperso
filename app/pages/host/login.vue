<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({ title: 'Acceso host', robots: 'noindex' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const router = useRouter()
const { loadStaff } = useStaff()

const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')

if (route.query.error === 'sin-acceso') {
  error.value = 'Esa cuenta existe, pero no está dada de alta como host.'
}

watchEffect(() => {
  if (user.value && !error.value) router.push('/host')
})

async function submit() {
  pending.value = true
  error.value = ''

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })

  if (authError) {
    error.value =
      authError.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : authError.message
    pending.value = false
    return
  }

  const staff = await loadStaff(true)
  if (!staff) {
    await supabase.auth.signOut()
    error.value = 'Esa cuenta existe, pero no está dada de alta como host.'
    pending.value = false
    return
  }

  await router.push('/host')
}
</script>

<template>
  <div class="login">
    <form class="login__card" @submit.prevent="submit">
      <AppLogo :size="52" :wordmark="false" class="login__logo" />
      <h1>Acceso host</h1>
      <p class="login__sub">Panel de organización del torneo</p>

      <p v-if="error" class="alert alert--error">{{ error }}</p>

      <div class="field">
        <label for="email">Correo</label>
        <input id="email" v-model="email" type="email" autocomplete="username" required>
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        >
      </div>

      <button class="btn btn--primary login__submit" type="submit" :disabled="pending">
        {{ pending ? 'Entrando…' : 'Iniciar sesión' }}
      </button>

      <p class="login__note">Acceso restringido · no hay registro público</p>
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(620px 380px at 50% 0%, rgba(123, 92, 255, 0.16), transparent 65%),
    var(--ink);
}

.login__card {
  width: 100%;
  max-width: 380px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 32px 30px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login__logo {
  align-self: center;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin: 0;
}

.login__sub {
  margin: -10px 0 6px;
  text-align: center;
  color: var(--dim);
  font-size: 13.5px;
}

.login__submit {
  margin-top: 6px;
}

.login__note {
  margin: 0;
  text-align: center;
  font-family: var(--f-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--dim);
}
</style>
