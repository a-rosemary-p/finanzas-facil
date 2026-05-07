'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TIMEZONE_MAP } from '@/lib/constants'
import { getAppToday } from '@/lib/cdmx-date'
import type { Profile, ProfileUpdate, SettingsUpdate } from '@/types'

export function useAuth() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  // Lista de identity providers vinculados al user (v0.3, OAuth + email).
  //   ['email']           — signup tradicional con password.
  //   ['google']          — solo entra con Google, no tiene password seteado.
  //   ['email','google']  — ambos disponibles (auto-link verified, o user
  //                          configuró password después de entrar con Google).
  // Lo usa /ajustes para decidir si los cards de Cuenta/Contraseña permiten
  // edit (necesitan password) o si muestran flow alternativo "Configurar
  // contraseña" / "Gestiona en Google".
  const [identities, setIdentities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  async function loadProfile(supabase: ReturnType<typeof createClient>, userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, plan, subscription_status, movements_today, movements_today_date, total_movements, giro, ciudad, estado, timezone, moneda_preferida, mostrar_inversiones, mostrar_pendientes, trial_used, onboarded_at, profile_prompt_seen_at')
      .eq('id', userId)
      .single()

    if (data) {
      // "Hoy" en CDMX, no en UTC ni en la TZ del browser. Si el contador
      // fue actualizado en un día CDMX distinto al actual, lo tratamos como 0
      // hasta que el cron de reset (cada hora) actualice la fila.
      const today = getAppToday()
      const countIsFromToday = data.movements_today_date === today
      const effectiveMovementsToday = countIsFromToday ? (data.movements_today as number) : 0

      setProfile({
        id: data.id as string,
        email: data.email as string,
        displayName: (data.display_name as string) || (data.email as string).split('@')[0],
        plan: data.plan as Profile['plan'],
        subscriptionStatus: data.subscription_status as Profile['subscriptionStatus'],
        movementsToday: effectiveMovementsToday,
        totalMovements: (data.total_movements as number) ?? 0,
        giro: data.giro as string | undefined,
        ciudad: data.ciudad as string | undefined,
        estado: data.estado as string | undefined,
        timezone: (data.timezone as string) || 'America/Mexico_City',
        monedaPreferida: (data.moneda_preferida as 'MXN' | 'USD') ?? 'MXN',
        mostrarInversiones: (data.mostrar_inversiones as boolean) ?? false,
        mostrarPendientes: (data.mostrar_pendientes as boolean) ?? true,
        trialUsed: (data.trial_used as boolean) ?? false,
        onboardedAt: (data.onboarded_at as string | null) ?? null,
        profilePromptSeenAt: (data.profile_prompt_seen_at as string | null) ?? null,
      })
    }
  }

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      // user.identities es Identity[] o undefined (depende del SDK version
      // y de si la sesión incluyó identities). Mapeamos a string[] de providers
      // únicos, ordenados para que la UI sea determinista.
      const providers = Array.from(
        new Set((user.identities ?? []).map(i => i.provider))
      ).sort()
      setIdentities(providers)

      await loadProfile(supabase, user.id)

      setProfile(prev => prev ?? {
        id: user.id,
        email: user.email ?? '',
        displayName: (user.email ?? '').split('@')[0],
        plan: 'free',
        subscriptionStatus: 'none',
        movementsToday: 0,
        totalMovements: 0,
        monedaPreferida: 'MXN',
        mostrarInversiones: false,
        mostrarPendientes: true,
        trialUsed: false,
      })
      setLoading(false)
    }

    load()

    // Recargar perfil cuando Supabase confirma cambios (email change, etc.)
    // También re-leer identities para reflejar identity nueva (ej. agregar
    // password a una cuenta que solo era Google → aparece 'email' en la lista).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) {
        loadProfile(supabase, session.user.id)
        const providers = Array.from(
          new Set((session.user.identities ?? []).map(i => i.provider))
        ).sort()
        setIdentities(providers)
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function refreshProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadProfile(supabase, user.id)
  }

  async function updateProfile(update: ProfileUpdate) {
    if (!profile) throw new Error('No hay perfil cargado')
    const supabase = createClient()

    const patch: Record<string, unknown> = {}
    if (update.displayName !== undefined) patch.display_name = update.displayName || null
    if (update.giro !== undefined)        patch.giro         = update.giro || null
    if (update.ciudad !== undefined)      patch.ciudad       = update.ciudad || null
    if (update.estado !== undefined) {
      patch.estado   = update.estado || null
      patch.timezone = update.estado
        ? (TIMEZONE_MAP[update.estado] ?? 'America/Mexico_City')
        : 'America/Mexico_City'
    }

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)

    if (error) throw error

    setProfile(prev => prev ? {
      ...prev,
      displayName: update.displayName
        ? update.displayName
        : (update.displayName === '' ? (prev.email.split('@')[0]) : prev.displayName),
      giro:    update.giro    !== undefined ? (update.giro    || undefined) : prev.giro,
      ciudad:  update.ciudad  !== undefined ? (update.ciudad  || undefined) : prev.ciudad,
      estado:  update.estado  !== undefined ? (update.estado  || undefined) : prev.estado,
      timezone: update.estado
        ? (TIMEZONE_MAP[update.estado] ?? 'America/Mexico_City')
        : prev.timezone,
    } : prev)
  }

  async function updateSettings(update: SettingsUpdate) {
    if (!profile) throw new Error('No hay perfil cargado')
    const supabase = createClient()

    const patch: Record<string, unknown> = {}
    if (update.monedaPreferida  !== undefined) patch.moneda_preferida    = update.monedaPreferida
    if (update.mostrarInversiones !== undefined) patch.mostrar_inversiones = update.mostrarInversiones
    if (update.mostrarPendientes  !== undefined) patch.mostrar_pendientes  = update.mostrarPendientes

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)

    if (error) throw error

    setProfile(prev => prev ? { ...prev, ...update } : prev)
  }

  // Verificar contraseña actual y actualizar email
  async function updateEmail(newEmail: string, currentPassword: string) {
    if (!profile) throw new Error('No hay perfil cargado')
    const supabase = createClient()

    // Verificar identidad con contraseña actual
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    })
    if (authError) throw new Error('wrong_password')

    // Actualizar email — Supabase enviará confirmación al nuevo correo
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw error
    // El email en profiles no cambia hasta que el usuario confirme desde su bandeja
  }

  async function updatePassword(currentPassword: string, newPassword: string) {
    if (!profile) throw new Error('No hay perfil cargado')
    const supabase = createClient()

    // Re-autenticar para verificar contraseña actual
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    })
    if (authError) throw new Error('wrong_password')

    // Cambiar a la nueva contraseña
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error

    // Tras cambiar contraseña, invalidar cualquier otra sesión activa
    // (otro browser, otro dispositivo). La sesión actual sigue viva.
    await supabase.auth.signOut({ scope: 'others' })
  }

  async function logout() {
    const supabase = createClient()
    // scope: 'global' invalida todas las sesiones del usuario en todos los
    // dispositivos, no solo la cookie local. Si un token fue robado, cerrar
    // sesión aquí también lo revoca en el atacante.
    await supabase.auth.signOut({ scope: 'global' })
    router.replace('/login')
  }

  // Helper para enviar magic link de "configurar contraseña" cuando el
  // user entró con Google y no tiene password seteado. Reusa el flow de
  // resetPasswordForEmail — al confirmar, cae en /reset-password donde
  // setea su nueva contraseña, y a partir de ahí queda con identity 'email'
  // adicional al 'google' que ya tenía.
  async function sendPasswordSetupEmail() {
    if (!profile) throw new Error('No hay perfil cargado')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(
      profile.email,
      { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` }
    )
    if (error) throw error
  }

  return {
    profile,
    identities,
    loading,
    logout,
    refreshProfile,
    updateProfile,
    updateSettings,
    updateEmail,
    updatePassword,
    sendPasswordSetupEmail,
  }
}
