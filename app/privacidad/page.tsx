import Link from 'next/link'

// Aviso de Privacidad de Fiza — cumplimiento de la Ley Federal de Protección
// de Datos Personales en Posesión de los Particulares (LFPDPPP) y su
// Reglamento. Página pública estática.
//
// Si actualizas datos del responsable o transferencias a terceros, también
// bumpea LAST_UPDATED para que la fecha "última actualización" refleje el
// cambio.

const LAST_UPDATED = '8 de mayo de 2026'

export const metadata = {
  title: 'Aviso de Privacidad — Fiza',
  description: 'Cómo protegemos tus datos personales en Fiza.',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen fz-page-gradient-auth">
      <main className="max-w-3xl mx-auto px-5 py-10 fz-pad-safe-bottom">
        <header className="mb-8">
          <Link href="/" className="text-sm text-white/80 hover:text-white">
            ← Inicio
          </Link>
          <h1 className="font-bold text-3xl text-white mt-4">Aviso de Privacidad</h1>
          <p className="text-sm text-white/80 mt-1">Última actualización: {LAST_UPDATED}</p>
        </header>

        <article className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-brand-border flex flex-col gap-6 fz-prose">
          <section>
            <h2>1. Identidad del Responsable</h2>
            <p>
              <strong>Víctor Alonso Hernández González</strong> (en adelante &ldquo;Fiza&rdquo;,
              &ldquo;nosotros&rdquo;), persona física con actividad empresarial, con
              domicilio en Tecate, Baja California, México, es el responsable del
              tratamiento de tus datos personales. Para cualquier asunto relacionado
              con este Aviso, el medio de contacto es{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a>.
            </p>
            <p>
              Fiza opera la aplicación web <strong>fiza.mx</strong>, una herramienta para
              que pequeñas y medianas empresas (PyMEs) registren ingresos, gastos y
              compromisos financieros.
            </p>
          </section>

          <section>
            <h2>2. Datos personales que recopilamos</h2>
            <p>Para prestar el servicio recopilamos:</p>
            <ul>
              <li>
                <strong>Datos de cuenta:</strong> correo electrónico, nombre o nombre del
                negocio, contraseña (cifrada).
              </li>
              <li>
                <strong>Datos de perfil opcionales:</strong> ciudad, estado, giro o industria.
              </li>
              <li>
                <strong>Datos financieros que tú registras:</strong> montos, descripciones,
                fechas, categorías y tipos de movimientos (ingresos, gastos, pendientes).
                Estos datos los introduces tú; Fiza no los recopila de fuentes externas.
              </li>
              <li>
                <strong>Imágenes y documentos:</strong> fotos o PDFs de tickets/facturas
                que tú decidas subir para extracción automática. Las imágenes se procesan
                y descartan; los datos extraídos se guardan como movimientos.
              </li>
              <li>
                <strong>Datos técnicos y de uso:</strong> dirección IP, tipo de dispositivo,
                navegador, sistema operativo, páginas visitadas, eventos de uso del producto
                (clicks, exportaciones), país aproximado a partir de la IP.
              </li>
              <li>
                <strong>Datos de pago (Plan Pro):</strong> los procesa directamente Stripe;
                Fiza no almacena números de tarjeta. Recibimos solo identificadores de
                suscripción y estado del pago.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Finalidades del tratamiento</h2>
            <p>Tus datos los usamos para las siguientes finalidades primarias (necesarias para el servicio):</p>
            <ul>
              <li>Crear y administrar tu cuenta.</li>
              <li>Procesar y almacenar los movimientos financieros que tú registras.</li>
              <li>Generar reportes, resúmenes e insights derivados de tus datos.</li>
              <li>Procesar texto y/o imágenes con modelos de inteligencia artificial para extraer movimientos.</li>
              <li>Procesar pagos de la suscripción Pro y emitir comprobantes de pago.</li>
              <li>Brindar soporte y responder a tus solicitudes.</li>
              <li>Cumplir con obligaciones legales y fiscales.</li>
            </ul>
            <p>Y para las siguientes finalidades secundarias (no necesarias para el servicio):</p>
            <ul>
              <li>Análisis interno del uso del producto para mejorarlo.</li>
              <li>Comunicaciones eventuales sobre nuevas funciones (puedes oponerte en cualquier momento).</li>
            </ul>
            <p>
              Si no deseas que tus datos se traten para las finalidades secundarias, envía un
              correo a <a href="mailto:admin@fiza.mx">admin@fiza.mx</a> con el asunto
              &ldquo;Limitar uso&rdquo;.
            </p>
          </section>

          <section>
            <h2>4. Transferencias y proveedores</h2>
            <p>
              Para operar el servicio compartimos datos con los siguientes proveedores
              (encargados del tratamiento). Cada uno cumple con sus propias políticas de
              privacidad y estándares internacionales:
            </p>
            <ul>
              <li><strong>Supabase Inc.</strong> — almacenamiento y autenticación (Estados Unidos).</li>
              <li><strong>Vercel Inc.</strong> — hosting y entrega de la aplicación (Estados Unidos).</li>
              <li><strong>OpenAI L.L.C.</strong> — procesamiento de texto e imágenes con modelos de IA (Estados Unidos). Los datos enviados a OpenAI no se utilizan para entrenar modelos según su política comercial vigente.</li>
              <li><strong>Stripe, Inc.</strong> — procesamiento de pagos (Estados Unidos).</li>
              <li><strong>Resend, Inc.</strong> — envío de correos transaccionales (Estados Unidos).</li>
              <li><strong>Google LLC</strong> — autenticación con Google (cuando eliges entrar con Google).</li>
            </ul>
            <p>
              No vendemos ni rentamos tus datos a terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2>5. Derechos ARCO</h2>
            <p>Tienes derecho a:</p>
            <ul>
              <li><strong>Acceder</strong> a tus datos personales.</li>
              <li><strong>Rectificar</strong> tus datos cuando sean inexactos o incompletos.</li>
              <li><strong>Cancelar</strong> tus datos cuando consideres que no se requieren para alguna de las finalidades, o por las causas legales aplicables.</li>
              <li><strong>Oponerte</strong> al uso de tus datos para fines específicos.</li>
            </ul>
            <p>
              Para ejercer cualquiera de estos derechos, envía una solicitud a{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a> con tu nombre, correo
              registrado y descripción clara del derecho que quieres ejercer.
              Responderemos en un plazo máximo de 20 días hábiles.
            </p>
            <p>
              Adicionalmente, puedes editar la mayoría de tus datos directamente desde
              las pantallas de Perfil y Ajustes en la aplicación.
            </p>
          </section>

          <section>
            <h2>6. Revocación del consentimiento</h2>
            <p>
              Puedes revocar el consentimiento que nos hayas otorgado para el tratamiento
              de tus datos en cualquier momento, escribiendo a{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a>. Al revocar el
              consentimiento, eliminaremos tu cuenta y los datos asociados, salvo
              aquellos que debamos conservar por obligaciones legales o fiscales.
            </p>
          </section>

          <section>
            <h2>7. Conservación de datos</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Si solicitas la
              eliminación de tu cuenta, los datos se borran salvo aquellos que la
              normativa fiscal o contable nos obligue a conservar (típicamente 5 años
              para registros fiscales).
            </p>
          </section>

          <section>
            <h2>8. Medidas de seguridad</h2>
            <p>
              Implementamos medidas técnicas, físicas y administrativas para proteger
              tus datos contra acceso no autorizado, pérdida o alteración. Esto incluye
              cifrado en tránsito (TLS), cifrado en reposo en nuestra base de datos,
              control de acceso a nivel de fila (Row Level Security) y políticas de
              acceso restringido al equipo.
            </p>
            <p>
              Ningún sistema es 100% seguro. Si detectas o sospechas un incidente de
              seguridad relacionado con tus datos, escríbenos a{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a> de inmediato.
            </p>
          </section>

          <section>
            <h2>9. Cookies y tecnologías similares</h2>
            <p>
              Usamos cookies y almacenamiento del navegador (localStorage,
              sessionStorage) para mantener tu sesión iniciada, recordar preferencias
              y medir el uso del producto de forma agregada. No usamos cookies de
              terceros para publicidad. Puedes deshabilitar las cookies desde tu
              navegador, pero algunas funciones (como mantenerte logueado) dejarán de
              operar correctamente.
            </p>
          </section>

          <section>
            <h2>10. Datos de menores de edad</h2>
            <p>
              Fiza está dirigido a mayores de 18 años. No recopilamos conscientemente
              datos de personas menores de edad. Si crees que un menor ha proporcionado
              datos a Fiza, contáctanos y los eliminaremos.
            </p>
          </section>

          <section>
            <h2>11. Cambios al Aviso de Privacidad</h2>
            <p>
              Podemos actualizar este Aviso para reflejar cambios en nuestras prácticas
              o en la normativa aplicable. La versión vigente siempre estará disponible
              en <Link href="/privacidad">fiza.mx/privacidad</Link>. Si los cambios son
              materiales, te notificaremos por correo electrónico antes de que entren
              en vigor.
            </p>
          </section>

          <section>
            <h2>12. Contacto</h2>
            <p>
              Para cualquier duda relacionada con este Aviso o el tratamiento de tus
              datos personales, escríbenos a{' '}
              <a href="mailto:admin@fiza.mx">admin@fiza.mx</a>.
            </p>
            <p>
              Si consideras que tus derechos no han sido atendidos adecuadamente, puedes
              presentar una queja ante el Instituto Nacional de Transparencia, Acceso a
              la Información y Protección de Datos Personales (INAI) en{' '}
              <a href="https://www.inai.org.mx" target="_blank" rel="noopener noreferrer">www.inai.org.mx</a>.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
