import type { Metadata } from "next"
import { ExternalLink, FileText } from "lucide-react"

export const metadata: Metadata = {
  title: "Condiciones del Servicio | Iglesia Regalo de Dios",
  description:
    "Condiciones del servicio para el uso del sistema de gestión IRDD y del canal de comunicación WhatsApp Business de la Iglesia Regalo de Dios.",
  robots: { index: true, follow: true },
}

export const dynamic = "force-static"

const LAST_UPDATED = "30 de julio de 2026"
const CONTACT_EMAIL = "jaimesalasortiz@hotmail.com"
const OFFICIAL_SITE = "https://iglesiaregalodedios.com/"

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-background text-foreground normal-case">
      <header className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-18">
          <div className="flex items-center gap-3 text-muted-foreground">
            <FileText aria-hidden="true" className="size-5" />
            <span className="text-sm font-semibold tracking-wide">Iglesia Regalo de Dios</span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Condiciones del Servicio</h1>
          <p className="mt-4 text-muted-foreground">Última actualización: {LAST_UPDATED}</p>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="space-y-10 text-base leading-7 text-foreground/90">

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">1. Aceptación de las condiciones</h2>
            <p className="mt-4">
              Al utilizar los servicios de comunicación de la <strong>Iglesia Regalo de Dios</strong> a través de
              WhatsApp Business, correo electrónico o el sistema de gestión interno (IRDD), aceptas las presentes
              condiciones. Si no estás de acuerdo, puedes dejar de utilizar el servicio en cualquier momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">2. Descripción del servicio</h2>
            <p className="mt-4">
              La Iglesia Regalo de Dios proporciona un sistema de gestión eclesial que permite:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Comunicación institucional mediante WhatsApp Business y correo electrónico.</li>
              <li>Envío de notificaciones, recordatorios de eventos y avisos generales.</li>
              <li>Gestión interna de membresía, asistencia y actividades.</li>
              <li>Administración de procesos financieros propios de la iglesia.</li>
            </ul>
            <p className="mt-4">
              El servicio se ofrece de forma gratuita para los miembros y asistentes de la iglesia. No constituye un
              servicio comercial.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">3. Uso aceptable</h2>
            <p className="mt-4">Al utilizar el servicio, te comprometes a:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Proporcionar información veraz y actualizada.</li>
              <li>No utilizar los canales de comunicación para fines ajenos a la iglesia.</li>
              <li>No enviar contenido ofensivo, ilegal o inapropiado a través de los canales institucionales.</li>
              <li>Respetar la privacidad de otros miembros y no compartir información de terceros sin autorización.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">4. Comunicaciones por WhatsApp</h2>
            <p className="mt-4">
              Al proporcionar tu número de teléfono y comunicarte con la iglesia a través de WhatsApp, consientes
              recibir mensajes institucionales incluyendo avisos, recordatorios y notificaciones. Puedes dejar de recibir
              mensajes en cualquier momento respondiendo &quot;DETENER&quot; o comunicándote con el administrador.
            </p>
            <p className="mt-4">
              El servicio de mensajería funciona sobre la plataforma de Meta Platforms, Inc. y está sujeto a las{" "}
              <a
                href="https://www.whatsapp.com/legal/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:decoration-primary"
              >
                Condiciones de WhatsApp
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">5. Propiedad intelectual</h2>
            <p className="mt-4">
              El sistema IRDD se distribuye bajo la Licencia Comunitaria de Software para Iglesias — Ecuador. El
              contenido, diseño y marca &quot;Iglesia Regalo de Dios&quot; son propiedad de la organización. El uso del
              sistema no otorga derechos de propiedad sobre el software ni sobre la marca.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">6. Limitación de responsabilidad</h2>
            <p className="mt-4">
              El servicio se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. La iglesia no garantiza
              la disponibilidad ininterrumpida del sistema ni se responsabiliza por:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Interrupciones temporales del servicio por mantenimiento o causas ajenas.</li>
              <li>Pérdida de mensajes debido a fallos en la plataforma de WhatsApp o del proveedor de correo.</li>
              <li>Daños derivados del uso indebido de la información por parte de terceros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">7. Modificaciones</h2>
            <p className="mt-4">
              La iglesia se reserva el derecho de modificar estas condiciones en cualquier momento. Los cambios se
              publicarán en esta página con la fecha de actualización correspondiente. El uso continuado del servicio
              después de una modificación constituye aceptación de las nuevas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">8. Terminación</h2>
            <p className="mt-4">
              Puedes dejar de utilizar el servicio en cualquier momento. La iglesia se reserva el derecho de suspender o
              restringir el acceso si se detecta un uso contrario a estas condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">9. Legislación aplicable</h2>
            <p className="mt-4">
              Estas condiciones se rigen por la legislación de la República del Ecuador. Cualquier controversia se
              resolverá ante los tribunales competentes de la ciudad de Machala, provincia de El Oro.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold tracking-tight">10. Contacto</h2>
            <p className="mt-4">
              Para consultas sobre estas condiciones, escríbenos a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-primary underline underline-offset-4 hover:decoration-primary"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              o visita nuestra{" "}
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
            <a className="underline underline-offset-4 hover:text-foreground" href="/privacidad">
              Política de privacidad
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
