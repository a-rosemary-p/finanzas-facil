// Layout para rutas públicas (login, registro).
// No incluye navbar — el root layout ya provee fuente y body.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
