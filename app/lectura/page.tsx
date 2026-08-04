import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import { ExternalLink, FileCode2, Globe2, LockOpen, Scale } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Biblioteca documental | Iglesia Regalo de Dios",
  description:
    "Documentación pública del sistema IRDD: uso, configuración, contribución, base de datos, replicación y licencia.",
  robots: {
    index: true,
    follow: true,
  },
}

export const dynamic = "force-static"

const REPOSITORY_URL = "https://github.com/derekkv/IRDD"
const OFFICIAL_SITE_URL = "https://iglesiaregalodedios.com/"

type DocumentKind = "markdown" | "plain"

type DocumentDefinition = {
  id: string
  fileName: string
  filePath: string
  category: string
  description: string
  audience: string
  kind: DocumentKind
}

const documents = [
  {
    id: "licencia",
    fileName: "LICENSE",
    filePath: "LICENSE",
    category: "Marco legal",
    description:
      "Define las condiciones de uso, modificación y distribución del software, junto con sus límites, atribuciones y garantías.",
    audience: "Iglesias, administradores, desarrolladores y organizaciones que utilicen o adapten el sistema.",
    kind: "plain",
  },
  {
    id: "aviso-legal",
    fileName: "NOTICE",
    filePath: "NOTICE",
    category: "Marco legal",
    description:
      "Resume la titularidad, las atribuciones y la relación entre los servicios profesionales, las contribuciones y la licencia principal.",
    audience: "Toda persona que reciba, publique o distribuya una copia del proyecto.",
    kind: "plain",
  },
  {
    id: "presentacion",
    fileName: "README.md",
    filePath: "README.md",
    category: "Introducción",
    description:
      "Presenta el propósito del sistema, sus funciones principales, la arquitectura técnica y las instrucciones generales de instalación.",
    audience: "Personas que conocen el proyecto por primera vez y equipos técnicos que preparan el entorno.",
    kind: "markdown",
  },
  {
    id: "guia-de-uso",
    fileName: "GUIA_DE_USO.md",
    filePath: "GUIA_DE_USO.md",
    category: "Operación",
    description:
      "Explica paso a paso el ingreso, el panel, los permisos, los módulos, las comunicaciones y las tareas habituales del sistema.",
    audience: "Usuarios, líderes, servidores y administradores de la iglesia.",
    kind: "markdown",
  },
  {
    id: "contribuciones",
    fileName: "CONTRIBUTING.md",
    filePath: "CONTRIBUTING.md",
    category: "Colaboración",
    description:
      "Establece cómo proponer cambios, preparar pull requests y contribuir de forma segura, legal y respetuosa.",
    audience: "Desarrolladores y colaboradores que quieran mejorar el código o la documentación.",
    kind: "markdown",
  },
  {
    id: "whatsapp-email",
    fileName: "CONFIGURACION-WHATSAPP-EMAIL.md",
    filePath: "docs/CONFIGURACION-WHATSAPP-EMAIL.md",
    category: "Integraciones",
    description:
      "Reúne los requisitos y procedimientos para configurar WhatsApp, correo SMTP/IMAP, plantillas, cron y comprobaciones operativas.",
    audience: "Administradores técnicos responsables de comunicaciones e integraciones.",
    kind: "markdown",
  },
  {
    id: "base-de-datos",
    fileName: "ESQUEMA-BASE-DE-DATOS.md",
    filePath: "docs/ESQUEMA-BASE-DE-DATOS.md",
    category: "Referencia técnica",
    description:
      "Documenta el modelo de acceso y el inventario de tablas que sostienen los diferentes módulos del sistema.",
    audience: "Desarrolladores, administradores de Supabase y responsables de seguridad de datos.",
    kind: "markdown",
  },
  {
    id: "replicacion",
    fileName: "REPLICACION.md",
    filePath: "docs/REPLICACION.md",
    category: "Implementación",
    description:
      "Describe el proceso completo para reproducir la solución: arquitectura, requisitos, servicios, variables, despliegue e integraciones.",
    audience: "Equipos técnicos que necesiten instalar una instancia propia o preparar producción.",
    kind: "markdown",
  },
] as const satisfies readonly DocumentDefinition[]

type LoadedDocument = (typeof documents)[number] & { content: string }

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function getTextContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(getTextContent).join("")
  }

  if (value && typeof value === "object" && "props" in value) {
    return getTextContent((value as { props?: { children?: unknown } }).props?.children)
  }

  return ""
}

function resolveDocumentLink(href: string, currentDocument: LoadedDocument) {
  if (href.startsWith("#")) {
    return `#${currentDocument.id}-${slugify(href.slice(1))}`
  }

  if (/^(https?:|mailto:)/i.test(href)) {
    return href
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//")) {
    return "#"
  }

  const [relativePath, hash] = href.split("#", 2)
  const normalizedPath = path.posix.normalize(
    path.posix.join(path.posix.dirname(currentDocument.filePath), relativePath),
  )
  const linkedDocument = documents.find(
    (document) => document.filePath.toLowerCase() === normalizedPath.toLowerCase(),
  )

  if (linkedDocument) {
    return hash ? `#${linkedDocument.id}-${slugify(hash)}` : `#${linkedDocument.id}`
  }

  const repositoryPath = normalizedPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")
  const repositoryHref = `${REPOSITORY_URL}/blob/main/${repositoryPath}`

  return hash ? `${repositoryHref}#${encodeURIComponent(hash)}` : repositoryHref
}

function markdownComponents(document: LoadedDocument): Components {
  const heading = (level: 1 | 2 | 3 | 4 | 5 | 6, className: string) => {
    const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

    return function MarkdownHeading({ children }: { children?: React.ReactNode }) {
      const id = `${document.id}-${slugify(getTextContent(children))}`
      return (
        <Heading id={id} className={`scroll-mt-6 font-semibold tracking-tight ${className}`}>
          <a href={`#${id}`} className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {children}
          </a>
        </Heading>
      )
    }
  }

  return {
    h1: heading(1, "mt-10 text-3xl first:mt-0"),
    h2: heading(2, "mt-10 border-b border-border pb-3 text-2xl"),
    h3: heading(3, "mt-8 text-xl"),
    h4: heading(4, "mt-6 text-lg"),
    h5: heading(5, "mt-6 text-base"),
    h6: heading(6, "mt-6 text-sm"),
    p: ({ children }) => <p className="my-4 leading-7 text-foreground/90">{children}</p>,
    ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-4 border-primary/30 bg-muted/60 px-5 py-1 text-muted-foreground">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-10 border-border" />,
    a: ({ href = "", children }) => {
      const resolvedHref = resolveDocumentLink(href, document)
      const isExternal = /^https?:/i.test(resolvedHref)

      return (
        <a
          href={resolvedHref}
          className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      )
    },
    pre: ({ children }) => (
      <pre className="my-6 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm leading-6 [&>code]:bg-transparent [&>code]:p-0">
        {children}
      </pre>
    ),
    code: ({ className, children }) => (
      <code className={`${className ?? ""} rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]`}>
        {children}
      </code>
    ),
    table: ({ children }) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
    tr: ({ children }) => <tr className="divide-x divide-border">{children}</tr>,
    th: ({ children }) => <th className="px-4 py-3 font-semibold text-foreground">{children}</th>,
    td: ({ children }) => <td className="px-4 py-3 align-top leading-6 text-foreground/85">{children}</td>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  }
}

async function loadDocuments(): Promise<LoadedDocument[]> {
  return Promise.all(
    documents.map(async (document) => ({
      ...document,
      content: await readFile(path.join(process.cwd(), document.filePath), "utf8"),
    })),
  )
}

export default async function LecturaPage() {
  const loadedDocuments = await loadDocuments()

  return (
    <main className="min-h-screen bg-background text-foreground normal-case">
      <header className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
          <div className="max-w-4xl">
            <p className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">
              Iglesia Regalo de Dios · Documentación pública
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Biblioteca documental de IRDD</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              Consulta las guías funcionales y técnicas, las condiciones legales y los procedimientos para usar,
              mantener, contribuir o replicar el sistema de gestión de la iglesia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
                  <FileCode2 aria-hidden="true" />
                  Ver código en GitHub
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={OFFICIAL_SITE_URL} target="_blank" rel="noopener noreferrer">
                  <Globe2 aria-hidden="true" />
                  Visitar página oficial
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section aria-labelledby="informacion-acceso" className="border-b border-border">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-2 lg:px-8">
          <div className="flex gap-4">
            <LockOpen aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 id="informacion-acceso" className="font-semibold">
                Acceso libre
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Esta biblioteca es pública y no requiere iniciar sesión. Los documentos corresponden a los archivos
                versionados con el proyecto.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Scale aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Uso responsable</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Para conocer los permisos y restricciones aplicables, consulta primero LICENSE y NOTICE. El contenido
                técnico no sustituye una revisión de seguridad antes de desplegar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8">
        <aside aria-label="Índice de documentos" className="lg:sticky lg:top-6 lg:h-fit">
          <h2 className="text-sm font-semibold text-foreground">Documentos disponibles</h2>
          <nav className="mt-4 border-l border-border" aria-label="Navegación documental">
            <ul>
              {documents.map((document) => (
                <li key={document.id}>
                  <a
                    href={`#${document.id}`}
                    className="block border-l-2 border-transparent py-2 pl-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block font-medium text-foreground">{document.fileName}</span>
                    <span className="mt-0.5 block text-xs">{document.category}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          {loadedDocuments.map((document, index) => (
            <section
              id={document.id}
              key={document.id}
              aria-labelledby={`${document.id}-title`}
              className={`scroll-mt-6 ${index === 0 ? "" : "mt-20 border-t border-border pt-16"}`}
            >
              <div className="mb-10">
                <p className="text-sm font-semibold text-muted-foreground">{document.category}</p>
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 id={`${document.id}-title`} className="text-3xl font-bold tracking-tight sm:text-4xl">
                      {document.fileName}
                    </h2>
                    <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                      {document.description}
                    </p>
                  </div>
                  <a
                    href={`${REPOSITORY_URL}/blob/main/${document.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Ver archivo fuente
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                </div>
                <p className="mt-5 border-l-2 border-border pl-4 text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-foreground">Dirigido a:</span> {document.audience}
                </p>
              </div>

              <article className="min-w-0" aria-label={`Contenido de ${document.fileName}`}>
                {document.kind === "markdown" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents(document)}
                    skipHtml
                  >
                    {document.content}
                  </ReactMarkdown>
                ) : (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/50 p-5 font-sans text-sm leading-7 text-foreground/90 sm:p-7">
                    {document.content}
                  </pre>
                )}
              </article>
            </section>
          ))}
        </div>
      </div>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>Documentación pública del sistema IRDD · Iglesia Regalo de Dios</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="underline underline-offset-4 hover:text-foreground" href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              Repositorio
            </a>
            <a className="underline underline-offset-4 hover:text-foreground" href={OFFICIAL_SITE_URL} target="_blank" rel="noopener noreferrer">
              Página oficial
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
