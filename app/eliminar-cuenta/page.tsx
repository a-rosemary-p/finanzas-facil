/**
 * /eliminar-cuenta (público, sin login) — v1.0.
 *
 * URL pública requerida por Google Play Store para procesar solicitudes de
 * eliminación de cuenta. Este URL va al form del listing de Play Console.
 *
 * Dos caminos:
 *  1. Si puedes entrar a la app: instrucciones para usar Ajustes → Eliminar.
 *  2. Si NO puedes entrar (perdiste acceso, problema técnico): form de
 *     contacto que envía a aleo@fiza.mx con el email del usuario para que
 *     procesemos el delete manual desde admin.
 *
 * Diseño consistente con /privacidad y /terminos (tipografía simple,
 * fondo blanco, sin AppHeader).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { EliminarCuentaForm } from './form'

export const metadata: Metadata = {
  title: 'Eliminar tu cuenta · Fiza',
  description: 'Cómo eliminar tu cuenta de Fiza y todos tus datos asociados.',
  robots: { index: true, follow: false },
}

export default function EliminarCuentaPage() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-10 fz-pad-safe-bottom flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-xs font-medium text-brand-mid">← Volver a Fiza</Link>
        <h1 className="font-bold text-2xl text-brand">Eliminar tu cuenta</h1>
        <p className="text-sm text-brand-mid leading-relaxed">
          Aquí te explicamos cómo borrar tu cuenta de Fiza y todos los datos asociados.
        </p>
      </header>

      <section className="bg-white border border-brand-border rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-bold text-base text-brand">Opción 1 — Desde la app (recomendado)</h2>
        <p className="text-sm text-brand leading-relaxed">
          Si todavía puedes acceder a tu cuenta:
        </p>
        <ol className="text-sm text-brand pl-5 list-decimal flex flex-col gap-1.5 leading-relaxed">
          <li>Abre Fiza e inicia sesión.</li>
          <li>Ve al menú <strong>Ajustes</strong>.</li>
          <li>Baja hasta el final y toca <strong>&ldquo;Eliminar mi cuenta&rdquo;</strong>.</li>
          <li>Confirma escribiendo <code className="bg-brand-chip px-1 py-0.5 rounded text-xs">ELIMINAR</code> en mayúsculas.</li>
        </ol>
        <p className="text-sm text-brand-mid leading-relaxed mt-2">
          El borrado es <strong>inmediato e irreversible</strong>. Se eliminan:
        </p>
        <ul className="text-sm text-brand-mid pl-5 list-disc flex flex-col gap-1 leading-relaxed">
          <li>Tu cuenta y datos de perfil (correo, nombre, giro).</li>
          <li>Todos tus movimientos, proyectos, pendientes y recurrentes.</li>
          <li>Categorías personalizadas.</li>
          <li>Eventos de uso (analytics) asociados a ti.</li>
          <li>Si tienes suscripción Pro activa, se cancela al final del período pagado.</li>
        </ul>
      </section>

      <section className="bg-white border border-brand-border rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-bold text-base text-brand">Opción 2 — No puedes acceder a tu cuenta</h2>
        <p className="text-sm text-brand leading-relaxed">
          Si perdiste acceso (olvidaste contraseña, problema técnico, cambiaste correo),
          escríbenos y procesaremos el borrado manualmente en un plazo máximo de 7 días.
        </p>
        <EliminarCuentaForm />
      </section>

      <section className="bg-paper-2 rounded-2xl p-5 flex flex-col gap-2">
        <h2 className="font-bold text-sm text-brand-mid uppercase tracking-wide">Política de retención</h2>
        <p className="text-xs text-brand-mid leading-relaxed">
          Después de eliminar tu cuenta, tus datos se borran inmediatamente de
          nuestra base de datos principal. Las copias de seguridad
          encriptadas pueden retener tu información hasta <strong>30 días</strong>
          antes de ser purgadas automáticamente. Después de ese plazo, ningún rastro
          de tus datos permanece en nuestros sistemas.
        </p>
        <p className="text-xs text-brand-mid leading-relaxed">
          Los registros de facturación con nuestros proveedores de pago (Stripe) se
          conservan por requisitos fiscales mexicanos hasta 5 años, pero no contienen
          datos de uso de la app — solo cargos, montos y fechas.
        </p>
      </section>

      <footer className="text-xs text-brand-mid text-center pt-2">
        <Link href="/privacidad" className="underline mr-3">Aviso de privacidad</Link>
        <Link href="/terminos" className="underline">Términos</Link>
      </footer>
    </main>
  )
}
