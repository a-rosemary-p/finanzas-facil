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
        .select('id, email, display_name, plan, subscription_status, movements_today')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile({
          id: data.id as string,
          email: data.email as string,
          displayName: (data.display_name as string) || (data.email as string).split('@')[0],
          plan: data.plan as Profile['plan'],
          subscriptionStatus: data.subscription_status as Profile['subscriptionStatus'],
          movementsToday: data.movements_today as number,
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
