import type { Metadata } from "next"
import { ExternalLink, Shield } from "lucide-react"

export const metadata: Metadata = {
  title: "Política de Privacidad | Iglesia Regalo de Dios",
  description:
    "Política de privacidad del sistema de gestión IRDD y del canal de comunicación WhatsApp Business de la Iglesia Regalo de Dios.",
  robots: { index: true, follow: true },
}

export const dynamic = "force-static"

const LAST_UPDATED = "30 de julio de 2026"
const CONTACT_EMAIL = "jaimesalasortiz@hotmail.com"
const OFFICIAL_SITE = "https://iglesiaregalodedios.com/"

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-background text-foreground normal-case">
      <header className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-18">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield aria-hidden="true" className="size-5" />
            <span className="text-sm font-semibold tracking-wide">Iglesia Regalo de Dios</span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Política de Privacidad</h1>
          <p className="mt-4 text-muted-foreground">Última actualización: {LAST_UPDATED}</p>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="space-y-10 text-base leading-7 text-foreground/90">

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">1. Responsable del tratamiento</h2>
            <p className="mt-4">
              La <strong>Iglesia Regalo de Dios</strong>, con domicilio en Machala, El Oro, Ecuador, es responsable del
              tratamiento de los datos personales recopilados a través de su sistema de gestión interno (IRDD) y de su
              canal de comunicación en WhatsApp Business.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">2. Datos que recopilamos</h2>
            <p className="mt-4">Podemos recopilar y tratar los siguientes datos personales:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Nombre completo y fecha de nacimiento.</li>
              <li>Número de teléfono móvil y/o correo electrónico.</li>
              <li>Mensajes enviados y recibidos a través de WhatsApp Business.</li>
              <li>Información proporcionada voluntariamente en formularios internos (dirección, estado civil, datos familiares).</li>
              <li>Registros de asistencia y participación en actividades de la iglesia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">3. Finalidad del tratamiento</h2>
            <p className="mt-4">Los datos personales se utilizan exclusivamente para:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Gestionar la comunicación interna de la iglesia mediante WhatsApp y correo electrónico.</li>
              <li>Enviar recordatorios de eventos, actividades, cumpleaños y avisos institucionales.</li>
              <li>Administrar la membresía, asistencia y participación en programas eclesiales.</li>
              <li>Facilitar procesos administrativos internos (diezmos, ofrendas, inventario).</li>
            </ul>
            <p className="mt-4">
              No vendemos, alquilamos ni compartimos datos personales con terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">4. Base legal</h2>
            <p className="mt-4">
              El tratamiento se fundamenta en el consentimiento del titular, el interés legítimo de la organización
              religiosa para gestionar a sus miembros y la Ley Orgánica de Protección de Datos Personales del Ecuador
              (LOPDP).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">5. Uso de WhatsApp Business</h2>
            <p className="mt-4">
              Utilizamos la API de WhatsApp Business proporcionada por Meta Platforms, Inc. para enviar mensajes
              institucionales. Al comunicarte con nosotros a través de WhatsApp, tus mensajes son procesados por Meta
              conforme a su propia{" "}
              <a
                href="https://www.whatsapp.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:decoration-primary"
              >
                Política de Privacidad de WhatsApp
              </a>
              .
            </p>
            <p className="mt-4">
              Los mensajes pueden incluir notificaciones, recordatorios y respuestas a consultas. Puedes optar por no
              recibir mensajes en cualquier momento respondiendo &quot;DETENER&quot; o solicitándolo al administrador.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">6. Conservación de datos</h2>
            <p className="mt-4">
              Los datos personales se conservan mientras exista una relación activa con la iglesia o mientras sean
              necesarios para cumplir obligaciones legales. Puedes solicitar la eliminación de tus datos en cualquier
              momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">7. Seguridad</h2>
            <p className="mt-4">
              Implementamos medidas técnicas y organizativas razonables para proteger los datos personales contra acceso
              no autorizado, pérdida o alteración, incluyendo cifrado en tránsito, control de acceso por roles y
              almacenamiento seguro en infraestructura protegida.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">8. Derechos del titular</h2>
            <p className="mt-4">Como titular de los datos, tienes derecho a:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar información inexacta o incompleta.</li>
              <li>Solicitar la eliminación de tus datos.</li>
              <li>Oponerte al tratamiento en cualquier momento.</li>
              <li>Revocar el consentimiento otorgado.</li>
            </ul>
            <p className="mt-4">
              Para ejercer tus derechos, escríbenos a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary underline underline-offset-4 hover:decoration-primary"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">9. Cambios en esta política</h2>
            <p className="mt-4">
              Nos reservamos el derecho de actualizar esta política. Los cambios se publicarán en esta misma página con
              la fecha de actualización correspondiente.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">10. Contacto</h2>
            <p className="mt-4">
              Si tienes preguntas sobre esta política, puedes escribirnos a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary underline underline-offset-4 hover:decoration-primary"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              o visitar nuestra{" "}
              <a
                href={OFFICIAL_SITE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:decoration-primary"
              >
                página oficial
              </a>
              .
            </p>
          </section>

        </div>
      </article>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>Iglesia Regalo de Dios · Machala, Ecuador</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="underline underline-offset-4 hover:text-foreground" href="/terminos">
              Condiciones del servicio
            </a>
            <a
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              href={OFFICIAL_SITE}
              target="_blank"
              rel="noopener noreferrer"
            >
              Página oficial <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
