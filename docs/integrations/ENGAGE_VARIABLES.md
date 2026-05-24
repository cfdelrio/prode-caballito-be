# Engage — Variables disponibles en templates

Esta doc lista **qué variables puede usar cada template en Engage** según lo que
ProdeCaballito envía en cada `sendEvent`. Mantenerla actualizada cada vez que
se agrega o modifica un trigger.

## Estructura común del payload a Engage

Todo evento de PC tiene esta estructura:

```js
{
  type: 'prode.xxx',
  userId: '<uuid del user>',
  idempotencyKey: '<key dedupe>',
  payload: {
    business_context: { /* datos específicos del evento */ },
  },
  metadata: {
    user_contact: { /* canal + consent + idioma */ },
    user_profile: { /* atributos del perfil para personalización */ },
  },
}
```

En **templates de Engage**, podés referenciar cualquier campo de estos 3
nodos. La convención típica es:

- `{{nombre}}` o `{{user_contact.nombre}}` — atributos de contacto
- `{{tema_equipo}}` o `{{user_profile.tema_equipo}}` — atributos de perfil
- `{{puntos}}` o `{{business_context.puntos}}` — datos del evento

> Confirmar con el equipo Engage la sintaxis exacta de resolución de variables
> (flat vs nested). Esta doc asume nested con prefijo.

---

## Variables siempre disponibles (en TODOS los eventos)

Estos campos los manda `buildEngageMetadata(user)` en `utils/engageHelpers.js`:

### `metadata.user_contact`

| Variable | Tipo | Descripción |
|---|---|---|
| `nombre` | string\|null | Nombre del user |
| `email` | string\|null | Email (PII) |
| `phone` | string\|null | WhatsApp E.164 (`+549...`) |
| `whatsapp_consent` | boolean | Si autorizó WhatsApp |
| `idioma_pref` | string | `'es-AR'` (default) o `'pt-BR'` |

### `metadata.user_profile`

| Variable | Tipo | Descripción |
|---|---|---|
| `tema_equipo` | string\|null | Equipo favorito (river, boca, etc) |
| `foto_url` | string\|null | URL del avatar |
| `fecha_registro` | ISO 8601\|null | `created_at` del user |
| `rol` | string | `'usuario'`, `'moderator'`, `'admin'` |
| `planilla_nombre` | string\|null | Nombre de la planilla activa |
| `planilla_id` | string\|null | UUID de la planilla |
| `tournament_name` | string\|null | Torneo en el que participa |
| `estado_pago` | boolean\|null | Si pagó la planilla |
| `current_streak` | number | Racha actual de exactos |
| `best_streak` | number | Mejor racha histórica |
| `badges_count` | number | Cantidad de logros desbloqueados |
| `ranking_position` | number\|null | Posición en ranking |
| `puntos_totales` | number\|null | Puntos totales acumulados |

> **No todos los call sites llenan todos los campos de `user_profile`.** Los
> campos derivados (planilla, ranking, streak) solo aparecen en eventos donde
> esa info está cargada. Cuando no se pasa, el campo es `null` o `0`.

---

## Variables específicas por evento (`business_context`)

### 📧 `prode.verification_code`

Trigger: signup, reenvío de código.

| Variable | Tipo | Descripción |
|---|---|---|
| `code` | string | Código de 6 dígitos |
| `expiresIn` | number | Segundos hasta expirar (900) |

### 👋 `prode.welcome`

Trigger: registro completo.

Sin `business_context` específico — solo usa `metadata.user_profile`.

### 🏆 `prode.new_leader`

Trigger: cambio de líder en ranking tras publicar resultado.

| Variable | Tipo | Descripción |
|---|---|---|
| `puntos` | number | Puntos del nuevo líder |
| `prev_leader_nombre` | string\|null | Nombre del líder anterior |
| `match.local` | string | Equipo local |
| `match.away` | string | Equipo visitante |
| `match.goles_local` | number | Goles local |
| `match.goles_visitante` | number | Goles visitante |

**Plus en `user_profile`:** `planilla_nombre`, `planilla_id`, `ranking_position`, `puntos_totales`.

### 📊 `prode.result_published.individual`

Trigger: resultado publicado, una por bet.

| Variable | Tipo | Descripción |
|---|---|---|
| `match.{local,away,goles_local,goles_visitante}` | mixed | Datos del partido |
| `bet.{goles_local,goles_visitante,puntos_obtenidos}` | mixed | Datos de la apuesta del user |
| `ranking_after.position` | number | Posición después del recálculo |
| `outcome` | string\|null | `'exacto'`, `'resultado'`, o `null` |

**Plus en `user_profile`:** `planilla_nombre`, `current_streak`, `best_streak`, `ranking_position`, `puntos_totales`.

### 📧 `prode.weekly_digest`

Trigger: cron semanal.

| Variable | Tipo | Descripción |
|---|---|---|
| `week_date` | string | Fecha formateada |
| `ranking_position` | number | Posición |
| `total_players` | number | Total jugadores |
| `points` | number | Puntos del user |
| `best_round` | string\|null | Texto "Fecha N" o null |
| `best_round_points` | number | Pts en mejor jornada |
| `diferencia_puntos` | number | Distancia al top 5 |
| `pending_bets` | number | Apuestas pendientes |
| `tight_match` | object\|null | Partido más reñido |
| `upcoming_matches` | array | Próximos 3 partidos |

### 📣 `prode.broadcast_manual`

Trigger: admin dispara desde Admin → tab WhatsApp.

| Variable | Tipo | Descripción |
|---|---|---|
| `message` | string | Mensaje libre del admin |

### 🎙️ `prode.voice_nuevo_lider`

Trigger: igual que `new_leader` pero por canal voice.

| Variable | Tipo | Descripción |
|---|---|---|
| `template` | string | `'Nuevo Lider Prode'` |
| `nuevo_lider` | string | Nombre del nuevo líder (= user) |
| `puntos` | number | Puntos |
| `prev_leader` | string\|null | Líder anterior |
| `match_name` | string | `"Local vs Away"` |

### 💥 `prode.voice_perfect_score`

Trigger: usuario acertó exacto.

| Variable | Tipo | Descripción |
|---|---|---|
| `template` | string | `'Exacto Prode'` |
| `home_team`, `away_team` | string | Equipos |
| `goles_local`, `goles_visitante` | number | Resultado |
| `puntos` | number | Puntos sumados (4) |
| `ranking_pos` | number | Posición después |

### 📊 `prode.voice_weekly_summary`

Trigger: bundle paralelo al weekly digest.

| Variable | Tipo | Descripción |
|---|---|---|
| `template` | string | `'Weekly Summary Prode'` |
| `week_date` | string | Fecha |
| `leader_nombre`, `leader_puntos` | mixed | Datos del líder |
| `ranking_position` | number | Posición del user |
| `total_players` | number | Total jugadores |
| `pending_bets` | number | Apuestas pendientes |

---

## Cómo cargar un template en Engage

1. Buscar el `event_type` exacto (ej `prode.new_leader`)
2. Decidir el canal (WhatsApp, Email, Voice, etc)
3. Usar **solo las variables listadas arriba** para ese evento + las de
   `metadata.user_contact` y `metadata.user_profile` que se mandan en todos
4. Probar con un user de test y verificar la sustitución

## Ejemplo de template WhatsApp para `prode.new_leader`

```
👑 *¡Sos el nuevo líder, {{nombre}}!*

Le sacaste el #1 a *{{prev_leader_nombre}}* con
_{{match.local}} {{match.goles_local}}–{{match.goles_visitante}} {{match.away}}_.

🔥 Tenés *{{puntos}} pts* en tu planilla _{{planilla_nombre}}_.

{{#if tema_equipo}}Como hincha de {{tema_equipo}}, sabés lo que es la presión.{{/if}}

¡No lo sueltes! 👉 https://prodecaballito.com/ranking
```

---

## Mantenimiento de esta doc

Cuando agregás un nuevo `sendEvent` o modificás un `business_context`,
actualizá la sección correspondiente. La doc es la fuente de verdad para
saber qué variables están disponibles antes de cargar un template en Engage.
