import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refresca la sesión de Supabase en cada request y maneja redirecciones de auth.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no agregar lógica entre createServerClient y getUser().
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Distinguir "no hay sesión" (estado normal de logged-out) de "Supabase tiene un hipo".
  //
  // supabase-js devuelve distintos errores:
  //   - Sin cookie: AuthSessionMissingError, status 400
  //   - JWT inválido/expirado: 401/403
  //   - Otros 4xx: tratar igual que logged-out (defense-in-depth)
  //   - 5xx o sin status (network/fetch error): transient — pasar sin bloquear
  //
  // Solo pasamos sin bloquear en el último caso, para no dejar pasar un user
  // genuinamente deslogueado a una ruta protegida cuando supabase-js devuelve
  // 400 porque no hay cookie.
  const authStatus = authError?.status
  const isTransientServerError =
    !!authError &&
    (typeof authStatus !== 'number' || authStatus >= 500)

  if (!user && isTransientServerError) {
    // Supabase momentáneamente no respondió bien — no bloqueamos al usuario.
    // El handler hará su propio getUser() y fallará limpio si de verdad no hay sesión.
    console.error('[middleware] transient Supabase error — passing through', {
      path: pathname,
      status: authStatus,
      message: authError?.message,
    })
    return supabaseResponse
  }

  // Rutas públicas que no requieren sesión.
  // Exact match para páginas fijas; los prefixes son segment-anchored
  // (terminan en `/`) para que `/login-admin` o `/logins` no cuenten como públicas.
  const PUBLIC_EXACT = new Set(['/', '/login', '/reset-password', '/og', '/og.png', '/robots.txt', '/sitemap.xml'])
  const PUBLIC_PREFIXES = ['/login/', '/reset-password/', '/auth/', '/api/webhooks/']

  const isPublicRoute =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))

  // Usuario no autenticado
  if (!user && !isPublicRoute) {
    // /api/* recibe 401 JSON en lugar de redirect a /login — un API client
    // no espera HTML de una página de login. Además evita filtración del
    // "chain de redirect" a endpoints que existen pero están protegidos.
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Usuario autenticado en página de landing/login → redirige a /dashboard
  if (user && (pathname === '/' || pathname === '/login' || pathname.startsWith('/login/'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
