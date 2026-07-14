# Graph Report - iglesiamzi  (2026-07-13)

## Corpus Check
- 210 files · ~121,797 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1033 nodes · 3486 edges · 45 communities (34 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a1f7887c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 43|Community 43]]

## God Nodes (most connected - your core abstractions)
1. `PermissionsGuard()` - 81 edges
2. `useAuth()` - 79 edges
3. `cn()` - 64 edges
4. `Button()` - 51 edges
5. `AuditInfo` - 50 edges
6. `db` - 40 edges
7. `useSecurityCheck()` - 39 edges
8. `Card()` - 35 edges
9. `CardContent()` - 35 edges
10. `useRealtime()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `verifyApiAuth()`  [EXTRACTED]
  app/api/send-email/route.ts → lib/api-auth.ts
- `Toaster()` --calls--> `useToast()`  [EXTRACTED]
  components/ui/toaster.tsx → hooks/use-toast.ts
- `POST()` --calls--> `verifyToken()`  [EXTRACTED]
  app/api/change-password/route.ts → lib/jwt.ts
- `POST()` --calls--> `verifyApiAuth()`  [EXTRACTED]
  app/api/cron-cumpleanos/route.ts → lib/api-auth.ts
- `POST()` --calls--> `notifyError()`  [EXTRACTED]
  app/api/db/route.ts → lib/error-notifier.ts

## Import Cycles
- None detected.

## Communities (45 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (116): ACTIONS, MODULES, RegisteredUser, SendResult, WAStatus, AttendanceDataMap, CellData, BautizoCenso (+108 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (63): metadata, Home(), AsistenciaContent(), BautizoContent(), CensoMDGContent(), CensoContent(), AdminRequerimientos(), getEstadoBadge() (+55 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (44): CumpleanosContent(), MESES_NOMBRES, generateCumpleanosPDF(), currentMonthEcuador(), currentYearEcuador(), MONTH_NAMES, nowEcuador(), nowEcuadorISO() (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (48): dependencies, bcryptjs, class-variance-authority, clsx, geist, jose, lucide-react, next (+40 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (9): CatalogManagerProps, CensoDetailViewProps, CensoFormProps, CensoSavedModalProps, censoMdgService, CatalogOption, CensoRecord, ConfiguracionesGlobales (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (22): MesViewClient(), MesViewPage(), PageProps, AsistenciaColumna, AsistenciaDato, AsistenciaDetalle, CensoConfiguraciones, CensoDatosIglesia (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (32): db, Filter, QueryResult, QueryState, InventoryItem, supabase, AttendanceColumn, AttendanceData (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (23): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (33): AuditLogTab(), AdministracionContent(), Module, ModuleGroup, SecurityKey, User, WhatsAppTab(), createUser() (+25 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (4): StorageAdapter, SupabaseAdapter, AuditInfo, PaymentFlowService

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (7): AsistenciaRecord, ControlAsistenciaServidores(), ControlAsistenciaServidoresProps, ESTADO_OPTIONS, getDomingosDelMes(), MESES, ServerUser

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (29): DiscipuladoCicloViewProps, BautizoPDFData, formatFechaLarga(), generateBautizoPDF(), MESES, parseFechaComponents(), downloadCertificados(), generateCertificadosPDF() (+21 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (3): CronogramaEventosGeneral(), CronogramaEventosGeneralProps, PermissionsGuard()

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (26): ADMIN_BIRTHDAY_NOTIFY_IDS, BIRTHDAY_AUDIO_PATH, generarHTMLEmail(), generarMensajeCumple(), GET(), notifyAdminsBirthdays(), POST(), sendBirthdayEmail() (+18 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (15): POST(), POST(), AuthResult, verifyApiAuth(), JWT_SECRET, SessionPayload, POST(), GET() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.10
Nodes (9): calcularDomingos(), Ciclo, CICLO_CONFIG, CicloAsistencia, CicloCompleto, CicloFecha, CicloParticipante, DiscipuladoCiclosService (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (7): app, upload, waService, AUTH_FOLDER, logger, WAStatus, WhatsAppService

### Community 26 - "Community 26"
Cohesion: 0.08
Nodes (23): dependencies, cors, express, multer, pino, qrcode, @types/multer, @whiskeysockets/baileys (+15 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (10): POST(), supabase, verifyToken(), DELETE(), POST(), supabase, GET(), PUT() (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (11): eliminarAtraso(), gestionarAtraso(), GestionAtrasado, getAtrasadosPorModulo(), getTodosLosAtrasados(), marcarNotificado(), notificarLiderAtraso(), registrarAtraso() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (11): DbRequest, getUserAdminForTable(), getUserEditForTable(), getUserModules(), permissionsCache, POST(), stripBlockedFields(), supabase (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.26
Nodes (11): buildEmailHtml(), emailService, EmailServiceParams, formatFechaLarga(), getEmailTitle(), getHeaderColor(), getHeaderEmoji(), getIntroText() (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.36
Nodes (4): authFetch(), getInternalHeaders(), PagoDiarioRecord, pagoDiarioService

### Community 32 - "Community 32"
Cohesion: 0.39
Nodes (7): signToken(), checkRateLimit(), clearRateLimit(), getClientIp(), loginAttempts, POST(), supabaseServer

### Community 33 - "Community 33"
Cohesion: 0.48
Nodes (5): getErrorKey(), isRateLimited(), notifyError(), recentErrors, POST()

## Knowledge Gaps
- **223 isolated node(s):** `supabase`, `supabase`, `BIRTHDAY_AUDIO_PATH`, `ADMIN_BIRTHDAY_NOTIFY_IDS`, `supabase` (+218 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `formatPhoneForWhatsApp()` connect `Community 20` to `Community 0`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `PermissionsGuard()` connect `Community 18` to `Community 0`, `Community 1`, `Community 2`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 5`, `Community 8`, `Community 41`, `Community 10`, `Community 19`, `Community 21`, `Community 28`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `verifyApiAuth()` connect `Community 22` to `Community 27`, `Community 20`, `Community 30`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `supabase`, `supabase`, `BIRTHDAY_AUDIO_PATH` to the rest of the system?**
  _223 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06940222897669707 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05238095238095238 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._