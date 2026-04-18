// Layout para rutas protegidas. El proxy.ts ya verifica la sesión
// antes de que el usuario llegue aquí.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
