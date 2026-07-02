# Loop de mejora continua — Meta Ads

> Bitácora del loop dedicado (sesión propia, `/loop`) que revisa el desempeño de
> Meta Ads y lo cruza con ventas reales. Cada ciclo LEE este archivo antes de
> proponer algo nuevo (para no repetir lo mismo) y AGREGA su entrada al final.

## Reglas de autonomía (definidas con Jorge, 2026-07-02)

- **Nivel 2: SOLO PROPONE.** El loop nunca pausa campañas, cambia presupuesto,
  ni edita nada — solo analiza y deja recomendaciones esperando aprobación de
  Jorge. (Ya existe capacidad de escritura real vía Graph API — `internal/meta/write.go`
  — pero este loop NO debe usarla mientras siga en Nivel 2.)
- **⚠️ NUNCA basar una recomendación en "conversiones" reportadas por la
  plataforma (Meta/Google).** Ya se comprobó que fallan (el reporte de Google
  mostró 0 conversiones con ventas reales ocurriendo). Usar SIEMPRE el puente
  de ventas reales: `GET /ventas/api/aremko-cli/bookings/family-combinations-range/`
  (Django, ver H-053/H-053b en `docs/HANDOFFS.md` del repo Django) vía
  `bookings.GetFamilyCombinationsRange` (cliente Go ya existe en este repo).
- Programas activos a rastrear: Ritual del Río (`cabanas_tinas_masajes_1n`),
  Refugio (`_2n`), Pausa junto al río (`tinas_masajes`), Noche de Aguas
  Calientes (`cabanas_tinas_1n`, ver H-055). Campañas Meta correspondientes se
  descubren por nombre (`findCampaignByName` en `internal/api/handlers/brief.go`).

## Qué hacer en cada ciclo

1. Leer la última entrada de este archivo (qué se propuso, si Jorge respondió algo).
2. Traer desempeño Meta Ads de los últimos 7-14 días (gasto, CTR, alcance) por campaña.
3. Cruzar con ventas reales del mismo período (bridge de arriba) — NO usar conversiones de plataforma.
4. Comparar contra el ciclo anterior: ¿cambió algo? ¿se implementó la recomendación pasada?
5. Producir 1-3 recomendaciones NUEVAS y concretas (no repetir un reporte completo).
6. Agregar una entrada nueva abajo con fecha, snapshot corto, y las recomendaciones.
7. Presentar a Jorge un resumen breve en el chat, dejando explícito que no se ejecutó nada.

---

## Bitácora de ciclos

_(vacío — la primera corrida del loop agrega la primera entrada acá)_
