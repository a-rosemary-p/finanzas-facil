import { redirect } from 'next/navigation'

// El proxy (proxy.ts) redirige a /dashboard si hay sesión activa.
// Si no hay sesión, aterrizamos en /login.
export default function RootPage() {
  redirect('/login')
}
