'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function useAuth() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, email, display_name, plan, subscription_status, movements_today, movements_today_date')
        .eq('id', user.id)
        .single()

      if (data) {
        // El trigger solo resetea movements_today cuando se inserta un movimiento.
        // Si movements_today_date es de otro día, el contador real hoy es 0.
        // en-CA devuelve YYYY-MM-DD en zona horaria local (coincide con CURRENT_DATE de Postgres)
        const today = new Date().toLocaleDateString('en-CA')
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
      } else {
        // Perfil no encontrado (cuenta nueva o trigger demorado) — perfil mínimo
        // para que el dashboard cargue y loadData se dispare
        setProfile({
          id: user.id,
          email: user.email ?? '',
          displayName: (user.email ?? '').split('@')[0],
          plan: 'free',
          subscriptionStatus: 'none',
          movementsToday: 0,
        })
      }
      setLoading(false)
    }

    load()
  }, [router])

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return { profile, loading, logout }
}
