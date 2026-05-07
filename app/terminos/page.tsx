import Link from 'next/link'

// Términos y Condiciones de Fiza. Página pública estática.
//
// Si actualizas precios, plazos de cancelación o jurisdicción, también
// bumpea LAST_UPDATED para que la fecha "última actualización" refleje
// el cambio.

const LAST_UPDATED = '8 de mayo de 2026'

export const metadata = {
  title: 'Términos y Condiciones — Fiza',
  description: 'Reglas de uso del servicio Fiza.',
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen fz-page-gradient-auth">
      <main className="max-w-3xl mx-auto px-5 py-10 fz-pad-safe-bottom">
        <header className="mb-8">
          <Link href="/" className="text-sm text-white/80 hover:text-white">
            ← Inicio
          </Link>
          <h1 className="font-bold text-3xl text-white mt-4">Términos y Condiciones</h1>
          <p className="text-sm text-white/80 mt-1">Última actualización: {LAST_UPDATED}</p>
        </header>

        <article className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-brand-border flex flex-col gap-6 fz-prose">
          <section>
            <h2>1. Aceptación de los términos</h2>
            <p>
              Al crear una cuenta o usar fiza.mx (el &ldquo;Servicio&rdquo;), aceptas estos
              Términos y Condiciones (los &ldquo;Términos&rdquo;) y nuestro{' '}
              <Link href="/privacidad">Aviso de Privacidad</Link>. Si no estás de acuerdo
              con alguno de ellos, no uses el Servicio.
            </p>
            <p>
              El Servicio lo opera <strong>Víctor Alonso Hernández González</strong>,
              persona física con actividad empresarial, RFC <strong>HEGV940308881</strong>,
              con domicilio en Tecate, Baja California, México (en adelante &ldquo;Fiza&rdquo;).
            </p>
          </section>

          <section>
            <h2>2. Descripción del Servicio</h2>
            <p>
              Fiza es una herramienta para que pequeñas y medianas empresas registren
              ingresos, gastos y compromisos financieros mediante texto, voz, foto o
              archivo PDF, con extracción automática usando modelos de inteligencia
              artificial.
            </p>
            <p>
              <strong>Fiza no es un servicio de contabilidad ni de asesoría financiera o
              fiscal.</strong> No sustituye la asesoría de un contador o asesor profesional.
              Los resultados que produce el Servicio son una ayuda informativa; tú eres
              responsable de verificar la exactitud de los datos antes de tomar
              decisiones o presentar declaraciones a cualquier autoridad.
            </p>
          </section>

          <section>
            <h2>3. Cuenta y elegibilidad</h2>
            <ul>
              <li>Debes tener al menos 18 años para usar el Servicio.</li>
              <li>
                Eres responsable de mantener la confidencialidad de tu contraseña y
                de toda la actividad que ocurra en tu cuenta.
              </li>
              <li>
                Te comprometes a proporcionar información veraz y a mantenerla
                actualizada.
              </li>
              <li>
                Una sola cuenta por persona o entidad. Tienes derecho a un (1) periodo
                de prueba del Plan Pro por cuenta.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Plan Base y Plan Pro</h2>
            <p>
              Fiza ofrece dos planes:
            </p>
            <ul>
              <li>
                <strong>Plan Base (gratis):</strong> hasta 10 movimientos por día,
                historial de los últimos 30 días, exportación de reporte mensual en PDF
                y funciones básicas.
              </li>
              <li>
                <strong>Plan Pro ($49 MXN al mes):</strong> movimientos ilimitados,
                historial sin límite, exportación a Excel, rangos personalizados, análisis
                comparativo con IA y todas las funciones disponibles.
              </li>
            </ul>
            <p>
              <strong>Periodo de prueba (trial):</strong> ofrecemos 30 días gratis del
              Plan Pro, una sola vez por cuenta. Al terminar el trial, la suscripción
              se renueva automáticamente al precio vigente del Plan Pro mensual a menos
              que la canceles antes.
            </p>
            <p>
              <strong>Renovación automática:</strong> el Plan Pro se cobra mensualmente
              y se renueva automáticamente. Puedes cancelar la renovación en cualquier
              momento desde Ajustes &rarr; Suscripción &rarr; Gestionar suscripción
              (portal de Stripe).
            </p>
            <p>
              <strong>Política de reembolsos:</strong> los pagos no son reembolsables,
              salvo cuando lo exija la legislación aplicable. Si cancelas, mantienes
              acceso a las funciones Pro hasta el final del periodo ya pagado.
            </p>
            <p>
              <strong>Cambios de precio:</strong> podemos modificar los precios.
              Cualquier cambio se notificará por correo electrónico con al menos 30 días
              de anticipación y aplicará al siguiente ciclo de cobro.
            </p>
          </section>

          <section>
            <h2>5. Procesamiento de pagos</h2>
            <p>
              Los pagos del Plan Pro los procesa Stripe, Inc. Fiza no almacena datos
              completos de tarjetas. Al suscribirte aceptas también los términos del
              procesador de pagos.
            </p>
          </section>

          <section>
            <h2>6. Uso aceptable</h2>
            <p>Te comprometes a no:</p>
            <ul>
              <li>Usar el Servicio para actividades ilegales, fraudulentas, lavado de dinero o evasión fiscal.</li>
              <li>Intentar acceder a cuentas de otros usuarios o vulnerar la seguridad del Servicio.</li>
              <li>Hacer scraping, ingeniería inversa o sobrecargar deliberadamente la infraestructura.</li>
              <li>Abusar de los modelos de inteligencia artificial generando volumen anormal de solicitudes con la finalidad de extraer el modelo o forzar costos.</li>
              <li>Subir contenido que infrinja derechos de terceros o que sea ilícito.</li>
            </ul>
            <p>
              Podemos suspender o cancelar tu cuenta sin previo aviso si detectamos un
              uso indebido del Servicio.
            </p>
          </section>

          <section>
            <h2>7. Propiedad de los datos</h2>
            <p>
              Tus datos son <strong>tuyos</strong>. Fiza solo los almacena y procesa
              para prestarte el Servicio. Puedes exportar tus movimientos en formato
              PDF o Excel desde la sección Reportes en cualquier momento.
            </p>
            <p>
              Al usar el Servicio nos otorgas una licencia limitada, no exclusiva, para
              almacenar, procesar y mostrarte tus datos con el propósito exclusivo de
              hacer funcionar el Servicio.
            </p>
          </section>

          <section>
            <h2>8. Propiedad intelectual</h2>
            <p>
              La marca Fiza, el logotipo, el código de la aplicación, el diseño y todos
              los contenidos producidos por Fiza son propiedad de Víctor Alonso
              Hernández González. No puedes copiar, modificar ni distribuir ninguno de
              estos elementos sin autorización expresa por escrito.
            </p>
          </section>

          <section>
            <h2>9. Limitación de responsabilidad</h2>
            <p>
              El Servicio se ofrece &ldquo;tal cual&rdquo;. Hacemos esfuerzos razonables
              para que funcione, pero no garantizamos que esté libre de errores, fallos
              o interrupciones. La extracción automática con inteligencia artificial puede
              equivocarse; <strong>tú debes revisar y confirmar cada movimiento antes
              de guardarlo</strong>.
            </p>
            <p>
              En la medida que lo permita la ley aplicable, Fiza no será responsable
              por daños indirectos, incidentales, especiales, lucro cesante o pérdida
              de datos, derivados del uso o la imposibilidad de usar el Servicio. La
              responsabilidad total acumulada de Fiza por cualquier reclamo relacionado
              con el Servicio se limita al monto que hayas pagado a Fiza en los 12 meses
              anteriores al hecho que dio origen al reclamo.
            </p>
            <p>
              Fiza no es responsable de errores u omisiones en declaraciones fiscales
              u otros trámites realizados por el usuario con base en los datos del
              Servicio.
            </p>
          </section>

          <section>
            <h2>10. Terminación</h2>
            <p>
              Puedes cerrar tu cuenta en cualquier momento solicitándolo a{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a>. Fiza puede suspender o
              cerrar tu cuenta si incumples estos Términos, si hay riesgos de seguridad,
              o si se discontinúa el Servicio. Los datos se conservarán o eliminarán
              de acuerdo con el Aviso de Privacidad.
            </p>
          </section>

          <section>
            <h2>11. Modificaciones</h2>
            <p>
              Podemos actualizar estos Términos. La versión vigente siempre estará en{' '}
              <Link href="/terminos">fiza.mx/terminos</Link>. Si los cambios son
              materiales te notificaremos por correo. El uso continuado del Servicio
              después de la fecha efectiva del cambio constituye aceptación de los
              nuevos Términos.
            </p>
          </section>

          <section>
            <h2>12. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.
              Para cualquier controversia, las partes se someten expresamente a la
              jurisdicción de los tribunales competentes de Tecate, Baja California,
              renunciando a cualquier otra jurisdicción que pudiera corresponderles.
            </p>
          </section>

          <section>
            <h2>13. Contacto</h2>
            <p>
              Cualquier duda, escribe a{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a>.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
