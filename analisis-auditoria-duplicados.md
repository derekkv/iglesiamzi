# Auditoría de duplicados — módulos financieros

Fecha: 2026-09-29
Alcance: todo el proyecto, con foco en tablas y flujos financieros.

## Parte A — Auditoría de datos (estado actual)

Escaneo de duplicados en las 11 tablas financieras (clave de negocio, ignorando id/created_at/updated_at):

| Tabla | Filas | Grupos duplicados |
|---|---|---|
| ingresos | 113 | 0 |
| egresos | 194 | 0 |
| diezmos | 49 | 0 |
| pago_diario | 156 | 0 |
| nomina | 57 | 0 |
| caja_chica_movimientos | 15 | 0 |
| caja_chica_arqueos | 7 | 0 |
| alfoli | 14 | 0 |
| pasivos | 42 | 0 |
| pasivos_abonos | 2 | 0 |
| ofrendas_celulas | 122 | 0 |

**Resultado: 0 duplicados en todas las tablas financieras.** (Los duplicados históricos ya se corrigieron en las tareas previas.)

Herramienta reutilizable para re-auditar cuando se quiera: `scripts/detectar-duplicados-financieros.mjs`.

## Parte B — Auditoría de código (patrón que causaba duplicados)

El bug de duplicación proviene de la combinación: **sincronización "consultar-si-existe y luego insertar" NO atómica + disparada de forma concurrente** (realtime global + sync fire-and-forget en cada carga). Revisión módulo por módulo:

| Módulo / servicio | Función que inserta | Riesgo original | Estado |
|---|---|---|---|
| eventos (`eventos-service`) | `_syncIngresoCreate`, `syncMissingIngresos` | **ALTO** (causó el storm de $4,050) | **Corregido**: idempotente + candado + filtro por mes + acote exacto |
| eventos (UI `EventoTabContent`) | sync en `loadData` + realtime global | **ALTO** | **Corregido**: sync 1 sola vez al abrir + realtime filtrado por `evento_id` |
| caja-chica (`caja-chica-service`) | `syncIngresosCajaChica` | **MEDIO-ALTO** (mismo patrón) | **Corregido**: candado anti-concurrencia |
| caja-chica (UI `caja-chica/page`) | sync fire-and-forget en cada `loadData` + realtime | **MEDIO-ALTO** | **Corregido**: sync 1 sola vez por mes (no en cada refresco) |
| pago-diario (`pago-diario-service`) | `_syncEgresoCreate`, `syncMissingEgresos` | **MEDIO** (UI ya usaba await + solo inicial) | **Endurecido**: candado anti-concurrencia |
| diezmos (`diezmos-service`) | `createDiezmo` inserta ingreso | **BAJO** (1 ingreso por diezmo; riesgo solo por doble-clic) | Recomendación (ver abajo) |
| caja-chica (`registrarGestionEfectivo`) | inserta ingreso | **BAJO** (1 por gestión) | Recomendación (ver abajo) |

### Otros flujos revisados (sin riesgo de duplicar)
- `resumen-mensual`: realtime sobre ingresos/egresos/nomina/pago_diario **solo re-lee** un resumen; no inserta. Seguro.
- `redil`, `somos-uno`, `asistencia`, `bautizo`, etc.: realtime con `filter` por id o solo lectura. Seguros.

## Correcciones aplicadas (código)

1. `lib/mod/eventos-service.ts` — `_syncIngresoCreate` idempotente; `syncMissingIngresos` con candado, filtro por `mes_id`, acote por sufijo exacto de evento y re-verificación antes de insertar.
2. `app/dashboard/eventos/EventoTabContent.tsx` — realtime acotado a `evento_id`; sync una sola vez al abrir.
3. `lib/mod/caja-chica-service.ts` — `syncIngresosCajaChica` con candado anti-concurrencia.
4. `app/dashboard/caja-chica/page.tsx` — sync una sola vez por mes (no en cada refresco/realtime).
5. `lib/mod/pago-diario-service.ts` — `syncMissingEgresos` con candado anti-concurrencia.

## Recomendaciones — estado

1. **Barrera dura en base de datos (índice único parcial)** — ✅ **Migración creada**: `migrations/2026-09-29_indice_unico_auto_evento.sql`.
   - Solo para `auto-evento` (regla: 1 ingreso por participante/mes). Verificado: 0 colisiones.
   - **NO** se indexan `auto-diezmo` ni `auto-caja-chica`: un mismo donante/responsable puede tener varias transacciones legítimas por mes (ej. ROBALINO $386.28 y $597; JAIME SALAS gestiones $10/$65/$65/$10). Un índice único ahí rechazaría registros válidos.
   - Egresos: sin índice único, porque `auto-pago-diario` admite pagos legítimos idénticos.
   - **Pendiente manual**: ejecutar el SQL en Supabase Studio (no hay acceso SQL directo desde aquí).

2. **Doble-clic en creaciones directas** — ✅ **Ya cubierto**: los botones de guardar en diezmos, caja-chica (gestión y arqueo) y pago-diario (crear y editar) ya usan `disabled={saving}`. Verificado.

3. **Actualizar detalle de ingresos al renombrar un evento** — ✅ **Implementado** en `eventos-service.ts` (`update` del tab): al cambiar el nombre, reescribe el sufijo `(viejo)` → `(nuevo)` en el `detalle` y la `observacion` de los ingresos `auto-evento`, evitando huérfanos.

4. **Desplegar a producción** — ✅ **Build verificado** (`npm run build` exit 0). El `pm2 reload iglesia` (recarga en vivo) queda para que lo ejecutes tú, ya que es una acción sobre producción.

## Cómo re-auditar en el futuro
```bash
SB_URL=... SB_KEY=... node scripts/detectar-duplicados-financieros.mjs
```
Reporta duplicados en ingresos/egresos y reconcilia auto-evento, auto-diezmo y auto-pago-diario contra su tabla de origen.
