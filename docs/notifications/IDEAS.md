# Notificaciones — Inventario y oportunidades

Documento para tener a mano una **vista única** de qué notificaciones ya envía el sistema y qué otras tendría sentido sumar. Pensado para decidir el próximo backlog.

Para el detalle funcional de cada una, ver [FUNCTIONAL.md](./FUNCTIONAL.md). Para el cómo está implementado, [TECHNICAL.md](./TECHNICAL.md).

---

## Parte 1 — Lo que tenemos hoy

| # | Notificación | Trigger | Canales | A quién |
|---|--------------|---------|---------|---------|
| 1 | **Recordatorio de cierre del torneo** | 20-40 min antes del cierre | Push + SMS + in-app | Usuarios con pronósticos pendientes |
| 2 | **Recordatorio antes del partido** (opt-in) | N min antes del kickoff (configurable por usuario: 5/10/15/30/60) | Push + SMS + in-app | Usuarios que activaron el check al cargar la apuesta |
| 3 | **Arranque del partido** | `start_time` del partido | Push + SMS + in-app | Todos los que apostaron a ese partido |
| 4 | **Segundo tiempo** | `start_time + 45min + halftime` | Push + SMS + in-app | Idem arranque |
| 5 | **Resultado publicado — personal** | Admin publica resultado | Email + SMS + in-app | Cada usuario con apuesta en ese partido |
| 6 | **Resultado publicado — broadcast** | Idem | Push (a todos los subscriptos) | Todos |
| 7 | **Cambio de posición en ranking** | Recálculo post-resultado | Email + in-app | Cada usuario cuya planilla cambió de posición |
| 8 | **Nuevo líder del ranking** | Cambia el #1 | Email + Push + SMS + in-app | El nuevo líder |
| 9 | **Ganador de la fecha** | Se cierra una fecha completa | Email + WhatsApp template | Todos (con destaque al ganador) |
| 10 | **Resumen semanal** | Cron semanal | Email | Todos |
| 11 | **Broadcast WhatsApp manual** | On-demand admin | WhatsApp | Todos los que dieron consent |

**Total: 11 notificaciones distintas.**

---

## Parte 2 — Lo que podríamos agregar

### Tier 1 — Alto valor, esfuerzo bajo/medio

#### A. Te pasaron en el ranking
> *"⚠️ Juan te pasó. Ahora estás #4."*

- **Trigger:** Recálculo de ranking post-resultado, cuando alguien baja porque otro lo superó.
- **Canales:** Push + in-app. Sin SMS (no es urgente).
- **Por qué:** Genera competencia directa entre usuarios. Es el opuesto del "subiste" y muchas veces más motivador.
- **Esfuerzo:** Bajo. La data del snapshot prev/new ya existe en `actualizarRanking`. Detectar "me pasaron" = `prev.position` mejoró pero ahora `new.position` empeoró + identificar quién está en `prev.position` ahora.

#### B. Recordatorio "mañana arranca el torneo"
> *"🏁 Mañana 20hs arranca Mundial 2026. Tenés N partidos sin pronosticar."*

- **Trigger:** Cron, 24h antes del primer partido de un torneo activo.
- **Canales:** Push + SMS + in-app.
- **Por qué:** El cutoff actual (20-40 min antes) llega demasiado tarde para muchos. Un aviso con un día de margen captura otra ventana.
- **Esfuerzo:** Bajo. Mismo patrón que `cutoff_reminder` con otra ventana temporal.

#### C. Cambio de fecha/hora de partido
> *"📅 ARG vs BRA reprogramado para mañana 21hs."*

- **Trigger:** Admin edita `start_time` desde el panel.
- **Canales:** Push + SMS + in-app.
- **Por qué:** Es la notificación más urgente operacionalmente. Hoy si un partido se reprograma el usuario no se entera (más allá de ver la app).
- **Esfuerzo:** Bajo. Hook en el `PUT /matches/:id` cuando cambia `start_time`. Notificar a usuarios con bet en ese partido.

#### D. Resumen post-fecha
> *"🏁 Fecha 1 cerrada — Hiciste 8 pts. Estás #5 del ranking. Top performer: Juan con 12 pts."*

- **Trigger:** Al cerrarse una fecha completa (todos los partidos finalizados).
- **Canales:** Email + push.
- **Por qué:** El resumen semanal es muy genérico. Uno por fecha cierra la narrativa del torneo y refresca el ranking.
- **Esfuerzo:** Medio. Hay que armar el template de email + decidir qué incluir.

#### E. Pago de planilla pendiente
> *"💸 Tu planilla "Mi Equipo" todavía no está paga. Sin pago no entrás al ranking."*

- **Trigger:** Cron diario, planillas con `precio_pagado=false` cuyo torneo asociado arranca en <7 días.
- **Canales:** Email + push.
- **Por qué:** Recupera ingreso. Operacional. Hoy el usuario carga pronósticos pero su planilla no cuenta hasta que pague.
- **Esfuerzo:** Bajo-medio. Nuevo cron simple.

### Tier 2 — Engagement / gamification

#### F. Récord personal de puntos en una fecha
> *"🔥 ¡Récord! 14 pts en Fecha 3, tu mejor performance."*

- **Trigger:** Al cerrarse una fecha, si el puntaje del usuario supera su máximo histórico.
- **Canales:** Push + in-app.
- **Por qué:** Refuerzo positivo. Refresca el interés del usuario que tuvo una buena fecha.
- **Esfuerzo:** Medio. Query sobre `scores` agregado por usuario + fecha.

#### G. Streak de aciertos exactos
> *"🎯 ¡3 exactos seguidos! Sos imparable."*

- **Trigger:** Al recalcular scores, detectar racha de aciertos color rojo (3+ pts) consecutivos.
- **Canales:** Push + in-app.
- **Por qué:** Premia la consistencia. Gamification clásica.
- **Esfuerzo:** Medio. Lógica de "streak" cruzando `scores` con orden cronológico.

#### H. Cerca del podio
> *"🎯 Estás a 2 pts del puesto #3. La próxima fecha podés entrar al podio."*

- **Trigger:** Tras un recálculo de ranking, si la planilla está fuera del top 3 pero a <5 pts del #3.
- **Canales:** Push + in-app.
- **Por qué:** Motivación dirigida a quienes están al alcance de un premio.
- **Esfuerzo:** Bajo. Comparación simple en `actualizarRanking`.

### Tier 3 — Social

#### I. Comentario en tu apuesta / planilla
> *"💬 Juan comentó tu apuesta de ARG vs BRA"*

- **Trigger:** Otro usuario comenta sobre una apuesta tuya.
- **Canales:** Push + in-app.
- **Por qué:** Engagement social. Lleva al usuario de vuelta a la app.
- **Esfuerzo:** Bajo si ya existe `comments`. La función `generarNotificacionNuevoComentario` se había borrado por no usarse — habría que reimplementar el hook en la creación del comment.

#### J. Mensaje nuevo en el chat
> *"💬 Tenés un mensaje nuevo de Juan"*

- **Trigger:** `messages` insert.
- **Canales:** Push + in-app.
- **Por qué:** Hoy el chat interno no avisa nada — si no entrás a la app no sabés que te escribieron.
- **Esfuerzo:** Bajo. Hook en `POST /messages/:id`.

### Tier 4 — Especulativas / costosas

#### K. Goles en vivo
> *"⚽ ¡Gol de Argentina! ARG 1-0 BRA — vas bien con tu 2-1"*

- **Trigger:** Live data del partido (no la tenemos).
- **Esfuerzo:** Alto. Requiere integración con API deportiva en tiempo real.
- **Costo:** Latencia + costo de la API + alta volumetría.

#### L. Final del partido
> *"🏁 Final: ARG 2-1 BRA. Tu pronóstico fue 2-1 — ¡exacto!"*

- **Trigger:** Idem K. Aunque se puede simular cuando se publica el resultado, en cuyo caso ya tenemos #5.

#### M. Aniversario / hitos del usuario
> *"🎉 Cumpliste 1 año en ProdeCaballito"*

- **Trigger:** Cron diario chequeando `users.created_at`.
- **Por qué:** Fidelización. Bajo costo, bajo impacto.
- **Esfuerzo:** Bajo.

---

## Parte 3 — Priorización sugerida

Si tuviéramos que armar el siguiente backlog, mi recomendación:

| Prioridad | Notificación | Razón |
|-----------|--------------|-------|
| 🔴 Alta | **C. Cambio de fecha/hora** | Operacionalmente crítica. Sin esto, el usuario llega tarde. |
| 🔴 Alta | **A. Te pasaron en el ranking** | Engagement competitivo directo. Reusa snapshot existente. |
| 🟠 Media | **B. Mañana arranca el torneo** | Captura usuarios que no entran a la app seguido. |
| 🟠 Media | **D. Resumen post-fecha** | Cierra la narrativa de cada fecha. |
| 🟠 Media | **E. Pago pendiente** | Impacto en ingresos. |
| 🟡 Baja | F, G, H, I, J | Engagement, fáciles individualmente pero suman ruido si no se piensa en throttling. |
| ⚪ Postergada | K, L | Requiere live data. |
| ⚪ Postergada | M | Bajo impacto. |

---

## Parte 4 — Consideraciones transversales antes de sumar más

A medida que crece el catálogo, hay tres cosas que conviene resolver antes de seguir agregando notificaciones:

1. **Preferencias por tipo:** hoy el usuario solo puede apagar SMS/push *en general*. Falta un panel "qué tipos de notificación quiero recibir" (por canal). Si no, sumar notificaciones aumenta el riesgo de unsubscribe.
2. **Throttling / agrupación:** si un usuario tiene 5 planillas, al publicar un resultado recibe 5 notificaciones de cambio de ranking + 5 de resultado + 1 de nuevo líder + 1 broadcast. Agrupar por usuario daría una experiencia más limpia.
3. **Quiet hours:** hoy un push o SMS podría llegar a las 3 AM si el partido fue tarde. Sumar un horario "no molestar" por usuario (default 23:00-08:00) evita malestar.

Estos 3 puntos son **infraestructura**, no notificaciones nuevas — pero sin ellos, el sistema se vuelve ruidoso a partir de la notif #15.
