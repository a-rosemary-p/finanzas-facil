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

  // Distinguir "sesión genuinamente inválida" de "error transitorio de Supabase".
  // Un 401/403 del endpoint /auth/v1/user significa que el JWT no vale (faltante,
  // expirado, firmado con otra key). Cualquier otra cosa (503, timeout, DNS, etc.)
  // es ruido operacional — NO debemos tratar al usuario como logged-out por eso,
  // porque provoca 401s falsos justo cuando Supabase tiene un hipo. El handler
  // de la ruta hará su propio getUser() y rechazará limpio si hace falta.
  const isGenuineAuthError =
    !!authError && (authError.status === 401 || authError.status === 403)
  const transientAuthError = !user && !!authError && !isGenuineAuthError

  if (transientAuthError) {
    console.error('[middleware] transient auth error — passing through', {
      path: pathname,
      status: authError?.status,
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
