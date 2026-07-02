# Graph Report - .  (2026-07-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 422 nodes · 1356 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5945b09a`
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

## God Nodes (most connected - your core abstractions)
1. `cn()` - 64 edges
2. `AuditInfo` - 38 edges
3. `useAuth()` - 33 edges
4. `SupabaseAdapter` - 27 edges
5. `Button()` - 26 edges
6. `useSecurityCheck()` - 23 edges
7. `Input()` - 21 edges
8. `DialogContent()` - 19 edges
9. `DialogHeader()` - 19 edges
10. `DialogTitle()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `CatalogManagerProps` --references--> `CatalogOption`  [EXTRACTED]
  app/dashboard/censo/components/CatalogManager.tsx → lib/mod/censo-service.ts
- `CensoDetailViewProps` --references--> `CensoRecord`  [EXTRACTED]
  app/dashboard/censo/components/CensoDetailView.tsx → lib/mod/censo-service.ts
- `LoginPage()` --calls--> `useAuth()`  [EXTRACTED]
  app/login/page.tsx → contexts/auth-context.tsx
- `Home()` --calls--> `useAuth()`  [EXTRACTED]
  app/page.tsx → contexts/auth-context.tsx
- `SecurityKeyDialog()` --calls--> `useSecurityCheck()`  [EXTRACTED]
  components/SecurityKeyDialog.tsx → contexts/security-context.tsx

## Import Cycles
- None detected.

## Communities (18 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (56): ACTIONS, AuditLogTab(), MODULES, Module, SecurityKey, User, AttendanceDataMap, CatalogManager() (+48 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (34): AdministracionContent(), Home(), AsistenciaContent(), BautizoContent(), CensoContent(), CloseMonthModal(), CreateMonthModal(), EditMonthModal() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (27): ChangePasswordModal(), ModulePermission, ATTENDANCE_OPTIONS, FinancialRecord, getUserPermissions(), DEFAULT_CONFIG, getGlobalConfig(), GlobalConfig (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (43): dependencies, bcryptjs, class-variance-authority, clsx, geist, lucide-react, next, next-pwa (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (17): CatalogManagerProps, CensoDetailViewProps, CensoFormProps, CloseMonthModalProps, CreateMonthModalProps, EditMonthModalProps, CatalogOption, CensoRecord (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (22): MesViewClient(), MesViewPage(), PageProps, AsistenciaColumna, AsistenciaDato, AsistenciaDetalle, CensoConfiguraciones, CensoDatosIglesia (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (18): InventoryItem, StorageAdapter, supabase, AttendanceData, AuditLog, AuditLogInput, AuditQueryParams, auditService (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (22): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (16): metadata, SecurityKeyDialog(), AuthProvider(), MonthContext, MonthContextType, MonthData, MonthProvider(), SecurityCheckContext (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.47
Nodes (5): DiscipuladoData, AttendanceRecord, DiscipuladoData, DiscipuladoDate, Participant

## Knowledge Gaps
- **100 isolated node(s):** `MODULES`, `ACTIONS`, `User`, `Module`, `SecurityKey` (+95 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuditInfo` connect `Community 10` to `Community 1`, `Community 6`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `SupabaseAdapter` connect `Community 9` to `Community 10`, `Community 6`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 0` to `Community 2`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `MODULES`, `ACTIONS`, `User` to the rest of the system?**
  _100 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06846846846846846 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08019323671497584 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13140096618357489 - nodes in this community are weakly interconnected._