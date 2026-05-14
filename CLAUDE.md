# ProdeCaballito - Instrucciones para Claude Code

## Objetivo
Mejorar la app ProdeCaballito sin romper lo existente.

## Estilo
- Deportivo, argentino, competitivo.
- Inspiración ESPN / TyC / Mundial.
- No usar tono casino ni apuestas ilegales.

## Reglas técnicas
- Antes de modificar, revisar estructura actual.
- No inventar endpoints.
- No borrar archivos sin pedir confirmación.
- Mantener responsive desktop/mobile.
- Si falta información, crear TODO o backlog.

## Flujo de trabajo (Gitflow)

Seguimos **Gitflow Workflow** ([Atlassian Gitflow Guide](https://www.atlassian.com/es/git/tutorials/comparing-workflows/gitflow-workflow)):

### Ramas principales
- **`main`** - Código en producción. Protegida (solo PRs). Cada commit es release.
- **`develop`** - Rama de integración. Base para feature branches.

### Ramas de feature
- **`claude/feature-name-XXXXX`** - Crear desde `develop`, no `main`.
- Nombrar con prefijo `claude/` + descripción breve + ID único.
- Abrir PR hacia `develop` (no hacia `main`).
- Deletear después de mergear.

### Ramas de release & hotfix
- **`release/v*`** - Preparar release (ajustes menores).
- **`hotfix/v*`** - Bugfix urgente en producción.

### Paso a paso
1. **Crear feature branch:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b claude/tu-feature-Y7rEo
   ```

2. **Hacer cambios:**
   - Commits claros y atómicos.
   - Tests + build check antes de push.

3. **Abrir PR:**
   - Base: `develop` (no `main`).
   - Descripción: qué, por qué, test plan.
   - Esperar review + merge.

4. **Después del merge:**
   - `develop` → `main` es responsabilidad de release manager.
   - Solo release/hotfix branches mergean a `main`.

### Por qué Gitflow
- ✅ Separación clara: features vs producción.
- ✅ Protege `main` de cambios rotos.
- ✅ Permite múltiples features en paralelo.
- ✅ Release ordenado (staging → prod).

## Flujo de implementación (paso a paso)
1. Analizar archivos.
2. Proponer plan.
3. Implementar cambios mínimos y seguros.
4. Probar build.
5. Resumir cambios y crear PR.
