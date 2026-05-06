// Layout para rutas protegidas. El proxy.ts ya verifica la sesión
// antes de que el usuario llegue aquí.
//
// Nota (v0.292): el `PageViewTracker` se movió al ROOT layout
// (`app/layout.tsx`) para cubrir también landing y login. Antes vivía
// aquí cuando solo tracking de rutas autenticadas era suficiente.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
