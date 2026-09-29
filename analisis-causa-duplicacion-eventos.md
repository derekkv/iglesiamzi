# Análisis forense: duplicación y mezcla en eventos de matrimonio

Fecha del análisis: 2026-09-29
Fuente: tablas `eventos_tabs`, `evento_participantes`, `ingresos`, `audit_logs` (producción).

## Conclusión corta

Hubo **dos problemas distintos con causas distintas**:

1. **La mezcla** (los participantes del "Curso de Matrimonio 2" aparecen dentro del "Curso de Matrimonios 1") = **acción de la persona** (una importación con destino equivocado).
2. **La duplicación de ingresos** ($4,050 en 102 ingresos repetidos) = **error del sistema (bug)**, disparado por esa importación. No fue culpa del usuario.

## Línea de tiempo (con evidencia de `audit_logs`)

| Fecha/hora | Usuario | Acción | Efecto |
|---|---|---|---|
| 2026-08-26 20:35 | joycevera98 | Crea tab **"CURSO DE MATRIMONIOS"** (evento id=6) | Agrega 18 parejas; sus abonos ($40) generan 18 ingresos con detalle "...(CURSO DE MATRIMONIOS)" |
| 2026-09-15 16:54:24 | joycevera98 | Edita tab id=6 → lo **renombra a "CURSO DE MATRIMONIOS 1"** | El nombre del evento cambia; los ingresos viejos quedan con el nombre anterior |
| 2026-09-15 16:54:49 | joycevera98 | Crea tab **"CURSO DE MATRIMONIO 2"** (evento id=7) | Nuevo curso; agrega 24 parejas entre 09-15 y 09-29 |
| 2026-09-24 18:56–19:01 | joycevera98 | **Importa 23 participantes del evento #7 → evento #6** | Las 23 parejas del Curso 2 se copian dentro del Curso 1 (abono=0, `importado_de_evento_id=7`) |
| 2026-09-24 19:00:06–19:00:53 | (automático) | Se crean **102 ingresos duplicados** | Storm de duplicados de las 18 parejas originales del Curso 1 |
| 2026-09-24 19:01:24 | joycevera98 | (audit) "Importados 23 participantes desde evento #7 a evento #6" | Confirma la importación |

## Problema 1 — La mezcla (ACCIÓN DE LA PERSONA)

El evento 6 ("CURSO DE MATRIMONIOS 1") tiene **41 participantes**: 18 propios + **23 importados del evento 7**. Los 23 tienen `importado_de_evento_id=7` y `abono=0`.

- Registro de auditoría: `joycevera98@gmail.com — Importados 23 participantes desde evento #7 a evento #6`.
- Es decir, se usó la función **"Importar desde evento"** eligiendo origen = Curso 2 y destino = Curso 1.
- La función de importación **trabajó como está diseñada** (copió los datos, puso abono en 0, marcó la trazabilidad). No hay bug aquí.
- **Conclusión:** la mezcla fue una importación con destino/origen equivocado (error humano de operación), no un fallo del sistema.

## Problema 2 — La duplicación de ingresos (ERROR DEL SISTEMA)

Las 18 parejas originales del Curso 1 recibieron entre 4 y 14 ingresos repetidos de $40 cada una, todos creados el 2026-09-24 entre las 19:00:06 y 19:00:53 — **exactamente durante la importación** de los 23 participantes.

### Cadena técnica que lo provocó

1. **Suscripción realtime a TODA la tabla** (`app/dashboard/eventos/EventoTabContent.tsx`):
   ```tsx
   useRealtimeMultiple(["evento_participantes"], loadData)
   ```
   Escucha cualquier cambio en `evento_participantes` (de cualquier evento), no solo el evento abierto. Al insertar los 23 participantes uno por uno, `loadData` se disparó ~23 veces en pocos minutos.

2. **Sincronización automática disparada en cada carga, sin `await`**:
   ```tsx
   // dentro de loadData()
   eventoParticipantesService.syncMissingIngresos(evento.id).catch(() => {})
   ```
   Cada `loadData` lanza `syncMissingIngresos` en segundo plano. Con ~23 disparos casi simultáneos, se ejecutaron **muchas copias en paralelo**.

3. **El renombrado previo dejó "huérfanos" y engañó al sincronizador**:
   `syncMissingIngresos` busca ingresos existentes con `ilike '%CURSO DE MATRIMONIOS 1%'`. Como los ingresos de agosto tenían el nombre viejo "(CURSO DE MATRIMONIOS)", **no coincidían** con el filtro. El sincronizador concluyó que las 18 parejas "no tenían ingreso" y procedió a crearlos.

4. **Condición de carrera (race condition)**: `syncMissingIngresos` hace "consultar-si-existe y luego insertar", pero **no es atómico**. Varias ejecuciones paralelas leyeron el mismo estado (sin ingreso) y **todas insertaron**. Las parejas evaluadas primero quedaron "faltantes" durante más ejecuciones solapadas → recibieron más copias (14, 12, 11...), y las últimas menos (4, 2). Ese patrón decreciente es la huella típica de una carrera por concurrencia.

5. **Sin barrera anti-duplicados**: ni `_syncIngresoCreate` ni el `insert` de `syncMissingIngresos` verificaban de forma atómica; y la tabla `ingresos` no tiene índice único que lo impida.

### Veredicto
La persona solo hizo una importación. El sistema, por la combinación de (realtime global + sync sin await + renombrado que orfana ingresos + inserción no atómica), **multiplicó los ingresos**. **Es un bug del sistema.**

## Estado de los datos hoy

- Los 102 ingresos duplicados **ya fueron eliminados** (respaldo en `respaldo-duplicados-ingresos-*.txt`).
- Quedan **18 ingresos "huérfanos"** ($720) del nombre viejo "(CURSO DE MATRIMONIOS)" — ver `analisis-auto-evento.md`.
- La mezcla de 23 participantes del Curso 2 dentro del Curso 1 **sigue presente** (pendiente de decisión).

## Recomendaciones (medidas de seguridad)

1. **Ya aplicado:** `_syncIngresoCreate` ahora es idempotente (busca antes de insertar).
2. **Pendiente sugerido — endurecer `syncMissingIngresos`:**
   - Filtrar ingresos existentes por `mes_id` + participante (no por `ilike` del nombre, que se rompe al renombrar).
   - Evitar ejecuciones concurrentes (un "lock" o `await` con guarda; no lanzarlo fire-and-forget en cada `loadData`).
3. **Pendiente sugerido — realtime:** suscribir solo a los cambios del evento abierto (filtrar por `evento_id`) para no recargar en cada cambio de cualquier evento.
4. **Pendiente sugerido — barrera dura:** índice único parcial en `ingresos` para filas `auto-evento` sobre (`concepto`, `mes_id`, `detalle`) que impida físicamente el duplicado (requiere consolidar antes el caso MURILLO).
5. **Operación:** al renombrar un evento con ingresos ya generados, actualizar el `detalle` de los ingresos existentes (o vincular por id en vez de por texto) para no dejar huérfanos.
