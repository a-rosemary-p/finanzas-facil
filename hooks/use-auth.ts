'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function useAuth() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(supabase: ReturnType<typeof createClient>, userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, plan, subscription_status, movements_today, movements_today_date')
      .eq('id', userId)
      .single()

    if (data) {
      // toISOString() siempre da YYYY-MM-DD en UTC, igual que CURRENT_DATE de Postgres
      const today = new Date().toISOString().slice(0, 10)
      const countIsFromToday = data.movements_today_date === today
      const effectiveMovementsToday = countIsFromToday ? (data.movements_today as number) : 0

      setProfile({
        id: data.id as string,
        email: data.email as string,
        displayName: (data.display_name as string) || (data.email as string).split('@')[0],
        plan: data.plan as Profile['plan'],
        subscriptionStatus: data.subscription_status as Profile['subscriptionStatus'],
        movementsToday: effectiveMovementsToday,
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

      await loadProfile(supabase, user.id)

      // Fallback si el perfil no existe aún
      setProfile(prev => prev ?? {
        id: user.id,
        email: user.email ?? '',
        displayName: (user.email ?? '').split('@')[0],
        plan: 'free',
        subscriptionStatus: 'none',
        movementsToday: 0,
      })
      setLoading(false)
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function refreshProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadProfile(supabase, user.id)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return { profile, loading, logout, refreshProfile }
}
