# Analisis auto-evento (ingresos) vs evento_participantes

Fecha: 2026-09-29T12:46:00.734Z

## Resumen

| Metrica | Valor |
|---|---|
| Ingresos auto-evento | 67 |
| Detalles (participantes) distintos con ingreso | 66 |
| Participantes con abono>0 (esperado 1 ingreso c/u) | 48 |
| Participantes con MAS de 1 ingreso (duplicado real) | 1 |
| Ingresos HUERFANOS (sin participante activo) | 18 |
| Participantes con abono>0 SIN ingreso | 0 |
| Ingresos con monto != abono actual | 1 |

## Ingresos auto-evento por evento

| Evento | # ingresos |
|---|---|
| ENCUENTRO | 24 |
| (desconocido) | 18 |
| CURSO DE MATRIMONIOS 1 | 18 |
| PRESENTACION DE NIÑOS | 5 |
| CURSO DE MATRIMONIO 2 | 2 |

## Participantes con MAS de 1 ingreso (duplicados reales a consolidar)

| detalle | # ingresos | montos | ids | abono actual |
|---|---|---|---|---|
| Abono evento - MURILLO MENENDEZ JUAN PABLO (ENCUENTRO) | 2 | $25, $15 | 76, 77 | $25 |

## Ingresos HUERFANOS (participante ya no existe o abono=0) -> candidatos a eliminar

| id | detalle | monto | fecha | mes_id |
|---|---|---|---|---|
| 130 | Abono evento - JAMIL MACHUCA Y NICOLE VELA (CURSO DE MATRIMONIOS) | $40 | 2026-08-26 | 2026-8 |
| 131 | Abono evento - CARLOS BRIONES Y RUTH VELEZ  (CURSO DE MATRIMONIOS) | $40 | 2026-08-26 | 2026-8 |
| 132 | Abono evento - JUAN PABLO MURILLO Y ANGELA CEDEÑO  (CURSO DE MATRIMONIOS) | $40 | 2026-08-26 | 2026-8 |
| 133 | Abono evento - WASHINGTON MIELES Y SARA QUIROZ  (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 134 | Abono evento - DIEGO MENDOZA Y MERLY ANCHUNDIA  (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 135 | Abono evento - CARLOS MEDRANDA Y CAROLINA ZAMBRANO  (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 136 | Abono evento - GUILLEMRO BARRIOS Y RUZZETH TORRES  (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 137 | Abono evento - RAFAEL TERREROS Y GEMA REYES (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 138 | Abono evento - JAVIER ALCIVAR Y ARIANA MENDOZA (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 139 | Abono evento - LUIS MARCILLO Y VALERIA ESCOBAR (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 140 | Abono evento - CRISTHIAN MENDOZA Y KATTY GOMEZ (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 141 | Abono evento - ESTUARDO ROBALINO Y CATALINA LOPEZ (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 142 | Abono evento - CARLOS SAENZ Y NATALIA GUIDOTI (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 143 | Abono evento - MIGUEL ROCA Y ALEJANDRA BERMUDEZ (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 145 | Abono evento - LIDER MEDRANDA Y EDITA MOREIRA  (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 146 | Abono evento - JAIME SALAS Y VICKY MOREIRA (CURSO DE MATRIMONIOS) | $40 | 2026-08-27 | 2026-8 |
| 159 | Abono evento - JESUS MENDOZA Y LUCIA AVILA  (CURSO DE MATRIMONIOS) | $40 | 2026-09-04 | 2026-9 |
| 160 | Abono evento - JOHANA CARREÑO Y ESPOSO (CURSO DE MATRIMONIOS) | $40 | 2026-09-04 | 2026-9 |

## Participantes con abono>0 SIN ingreso (faltantes)

_Ninguno._

## Ingresos con monto != abono actual (desincronizados)

| id | detalle | monto ingreso | abono actual |
|---|---|---|---|
| 77 | Abono evento - MURILLO MENENDEZ JUAN PABLO (ENCUENTRO) | $15 | $25 |