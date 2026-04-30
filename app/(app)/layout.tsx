// Layout para rutas protegidas. El proxy.ts ya verifica la sesión
// antes de que el usuario llegue aquí.
//
// Monta `PageViewTracker` para registrar `page_viewed` events con
// user_id de la sesión cada vez que el user cambia de ruta. Esto da
// visibilidad real (en Vercel logs solo se ven IPs anónimos).
import { PageViewTracker } from '@/components/analytics/page-view-tracker'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PageViewTracker />
      {children}
    </>
  )
}
