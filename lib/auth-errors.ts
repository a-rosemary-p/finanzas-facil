/**
 * Traducción de errores de Supabase Auth a mensajes en español
 * que el user pueda accionar.
 *
 * Para LOGIN, los errores sensibles ("invalid credentials", "email not
 * confirmed", "user not found") se colapsan en un solo mensaje genérico
 * para evitar enumeración de correos. El resto se traduce literalmente.
 *
 * Para REGISTER y RESET, queremos ser específicos — el user necesita
 * saber por qué no se aceptó la contraseña (corta, débil, comprometida,
 * etc.) para poder elegir otra.
 */

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

export function translateAuthError(rawMsg: string, mode: AuthMode): string {
  const m = rawMsg.toLowerCase()

  // ── Errores de contraseña — específicos siempre ─────────────────────────
  // Supabase puede mandar varios shapes según política activa:
  //   "Password should be at least 6 characters"
  //   "Password should contain at least one character of each ..."
  //   "Password is too weak"
  //   "Password is found in a list of compromised passwords"
  if (m.includes('password should be at least') || m.includes('password must be at least')) {
    // El número exacto (6, 10, etc.) viene en el mensaje original — lo
    // mostramos con nuestro mínimo de la app (10) que es más estricto.
    return 'La contraseña debe tener al menos 10 caracteres.'
  }
  if (m.includes('password should contain') || m.includes('password must contain')) {
    return 'La contraseña debe incluir mayúsculas, minúsculas, números y símbolos.'
  }
  if (
    m.includes('password is too weak') ||
    m.includes('weak_password') ||
    m.includes('weak password')
  ) {
    return 'Esa contraseña es muy fácil de adivinar. Intenta una más larga o con más variedad.'
  }
  if (
    m.includes('compromised') ||
    m.includes('pwned') ||
    m.includes('leaked') ||
    m.includes('breached')
  ) {
    return 'Esa contraseña aparece en bases de datos públicas de filtraciones. Elige una distinta para mantener tu cuenta segura.'
  }
  if (m.includes('same password') || m.includes('different password') || m.includes('new password should be different')) {
    return 'La nueva contraseña debe ser distinta a la anterior.'
  }

  // ── Errores de email ────────────────────────────────────────────────────
  if (m.includes('unable to validate email') || m.includes('valid email') || m.includes('invalid email')) {
    return 'El formato del correo no es válido.'
  }
  if (mode === 'register' && (m.includes('user already registered') || m.includes('already exists'))) {
    // En register sí podemos decirlo — no exponemos info sensible (cualquiera
    // puede intentar registrar un email y descubrirlo de otra forma).
    return 'Ya existe una cuenta con este correo. Intenta entrar en lugar de registrarte.'
  }

  // ── Rate limiting ───────────────────────────────────────────────────────
  if (m.includes('security purposes') || m.includes('over_email_send_rate_limit') || m.includes('email rate limit')) {
    return 'Demasiados intentos. Espera 60 segundos e intenta de nuevo.'
  }
  if (m.includes('rate limit') || m.includes('too many requests') || m.includes('too many')) {
    return 'Demasiados intentos. Espera un momento.'
  }

  // ── Conectividad ────────────────────────────────────────────────────────
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  }

  // ── Configuración ───────────────────────────────────────────────────────
  if (m.includes('signup') && m.includes('disabled')) {
    return 'El registro no está habilitado en este momento.'
  }

  // ── Login: colapsamos por seguridad anti-enumeración ────────────────────
  if (mode === 'login') {
    return 'Correo o contraseña incorrectos. Si apenas creaste tu cuenta, revisa tu bandeja para confirmarla.'
  }

  // ── Fallback genérico para otros modos ──────────────────────────────────
  return 'Ocurrió un error. Intenta de nuevo.'
}
