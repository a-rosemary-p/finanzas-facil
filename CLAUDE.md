@AGENTS.md

## Idioma del proyecto (regla a nivel proyecto)

**Todo se hace en español.** Esto incluye:

- **Toda la comunicación con el usuario** en chat: respuestas, explicaciones,
  preguntas, resúmenes de lo que hiciste, propuestas de plan. No mezclar idiomas
  ni traducir términos técnicos universales (ej: "build", "deploy", "commit",
  "push", "merge", "type", "endpoint" se quedan en inglés porque ese es su
  nombre real — pero las oraciones que los rodean van en español).
- **Mensajes de commit**: en español. Subject line corto y claro, body con
  bullets si hay varios cambios. Los términos técnicos que ya están en inglés
  en el código (nombres de archivos, funciones, tipos) se quedan tal cual.
- **Comentarios en código** (`//` y `/* */`): en español. Los `JSDoc`/docstrings
  de funciones también. Los nombres de variables, tipos, funciones siguen siendo
  en inglés (convención del lenguaje).
- **Documentación markdown** dentro del repo (READMEs, specs, notas): en español.
- **Mensajes de error y UI**: en español, ya es el caso por convención del
  producto. Mantener.
- **Changelog file** (ver sección de abajo): en español, como ya está.

**Por qué:** el dueño del proyecto es hispanohablante; mezclar idiomas genera
ruido y obliga a re-leer. Mantener español consistente reduce ambigüedad y
hace que cuando alguien busque algo en logs/diffs/comentarios, encuentre el
término que esperaba.

Excepciones razonables:
- Logs técnicos hacia consola (`console.error`, `console.warn`) pueden quedar
  en inglés porque van a herramientas que no son user-facing.
- Texto de error que viene de librerías third-party se queda como viene.
- Mensajes de commit con prefijos de convención (ej: `fix:`, `feat:`) si los
  hubiera — no aplican aquí pero por si en el futuro.

---

## Protocolo de changelog (regla a nivel proyecto)

Hay un **archivo de changelog fuera del repo** en:

```
C:\Users\arome\Documents - Local\App Finanzas Pymes\Fiza_CHANGELOG.md
```

**Hay que actualizarlo** cada vez que se shipea un cambio relevante al producto
o al spec. "Relevante" = cualquier cosa que valdría la pena mencionar si un
compañero de equipo preguntara "qué cambió desde la semana pasada?". Bug fixes
que mueven el comportamiento user-visible cuentan. Fixes de typo puro no.

Cuándo escribir:
- Después de aterrizar una feature o refactor (después de push está bien;
  antes de push también).
- Cuando se está iterando en algo que sigue WIP, append al bloque de la
  versión en progreso. No esperar al final del bump de spec para registrar
  entradas — el changelog es la memoria corriente.
- Al bumpear el spec a una nueva versión, finalizar el bloque en progreso y
  empezar uno nuevo para la siguiente versión.

Formato:
- Arriba del archivo se muestra la versión publicada actual del spec + la
  versión en progreso (si hay).
- Cada versión tiene sub-bloques por área (Navegación, Charts, Endpoints
  de IA, etc.).
- Bullets concisos. Referenciar paths de archivos y nombres de features;
  no re-explicar decisiones que ya están en mensajes de commit o en el spec.
- No commitear este archivo. Vive en la máquina del usuario y deliberadamente
  no está tracked. El path está fuera del repo para que `git add` no lo recoja
  por default; mantenerlo así.

Por qué vive fuera del repo: es memoria interna del proyecto para el ingeniero
+ agente, no producto. Mezclarlo al repo confundiría a futuros contribuidores
haciéndoles pensar que es un documento público de release notes.

---

## Arquitectura de docs (regla a nivel proyecto)

Este proyecto tiene **5 capas de documentación** con propósitos distintos.
Antes de escribir o editar cualquier `.md`, identifica en qué capa cae y
escribe SOLO ahí. Duplicar info entre capas genera bloat, tech debt de docs,
y eventualmente contradicciones cuando una capa se actualiza y la otra no.

### Mapa de capas

| # | Archivo | Ubicación | Audiencia | Cuándo se actualiza |
|---|---|---|---|---|
| 1 | `Fiza_APP_SPEC v1.0. 260526.md` | out-of-repo (`App Finanzas Pymes/`) | Humano + agente para deep-dive | Solo en bumps mayores del spec (raro) |
| 2 | `Fiza_CHANGELOG.md` | out-of-repo (`App Finanzas Pymes/`) | Humano + agente | **Cada cambio relevante** — feature, bug fix user-visible, refactor |
| 3 | `AGENT_BRIEF.md` | in-repo (`finanzas-facil/`) | Agente cold-start | Cuando cambian reglas operativas o se hace version bump |
| 4 | `CLAUDE.md` + `AGENTS.md` | in-repo (`finanzas-facil/`) | Agente | Cuando cambian protocolos / reglas de trabajo |
| 5 | `android-keystore/README.md` | out-of-repo (`App Finanzas Pymes/android-keystore/`) | Humano + agente operando builds | Cuando cambia workflow de build / sign / version bump del TWA |

### Qué va en cada capa (anti-duplicación)

**1 — Spec mayor (`Fiza_APP_SPEC`)** — la "biblia" del producto.
- Decisiones de diseño profundas (por qué cada feature existe, qué problema resuelve).
- Arquitectura técnica (esquemas DB, flow de auth, modelo de datos).
- Comportamiento esperado de cada feature.
- NO va: changelog de cada cambio (eso es capa 2), comandos shell (eso es capa 5).
- Update: solo en bumps mayores del spec. Si solo cambió código menor, no toques esto.

**2 — Changelog (`Fiza_CHANGELOG`)** — la memoria corriente.
- Cada cambio relevante por versión, en bullets concisos.
- Referencias a paths/funciones afectados.
- Bloque "en progreso" arriba con dos sub-secciones: (A) pendientes técnicos must-do, (B) ideas a evaluar.
- NO va: re-explicación de decisiones que ya están en el spec, reglas de trabajo (eso es capa 4).
- Update: cada vez que se shipea algo. No esperar al final del bump de spec.

**3 — Agent brief (`AGENT_BRIEF.md`)** — TL;DR para cold-start.
- Resumen ultra condensado del estado actual del producto (1-2 párrafos por versión reciente).
- Cheatsheet operativo: reglas de Next 16 quirks, no emojis, catálogo de categorías, etc.
- Pointers a los otros docs (spec gordo, changelog, README de TWA).
- NO va: detalles profundos (eso es capa 1), changelog por commit (eso es capa 2), comandos shell de build (eso es capa 5).
- Update: cuando un agente cold-start ya no podría empezar sin saber X. Si tienes que añadir más de 2 párrafos a este archivo, considera si el contenido pertenece al spec gordo en su lugar.

**4 — Reglas de agente (`CLAUDE.md` + `AGENTS.md`)** — cómo trabajar.
- Protocolos: idioma, changelog, commits, formato de respuesta.
- Arquitectura de docs (esta sección).
- Decisiones de framework que afectan TODO el código (ej. "Next.js 16 tiene breaking changes").
- NO va: estado del producto, lista de features, comandos one-off.
- Update: solo cuando cambian las reglas de trabajo, no cuando cambia el producto.

**5 — README de TWA (`android-keystore/README.md`)** — operación del build Android.
- Workflow paso a paso para rebuild + sign del .aab.
- Variables de entorno requeridas (JAVA_HOME, ANDROID_HOME).
- Datos del keystore + backups.
- Troubleshooting de builds.
- NO va: cambios del producto web (capa 2), decisiones de UX del app (capa 1).
- Update: cuando el workflow cambia (env vars distintas, paths nuevos, pasos extra).

### Reglas anti-bloat

1. **Una idea, un lugar.** Si una decisión vive en capa 1, no la repitas en 3.
   Pointer cruzado sí ("ver Fiza_APP_SPEC sección X"), copy-paste no.

2. **Si dudas dónde escribir, escribe en capa 2 (changelog).** Es la capa más
   barata de mantener. Si después se vuelve canónica, promuévela al spec.
   Mejor un changelog largo que un spec contradictorio.

3. **No agregues archivos nuevos sin razón.** Si vas a escribir `NOTES.md`,
   `TODO.md`, `PLAN.md`, `IDEAS.md`, etc. — para. Esa info cabe en una sección
   del changelog (bloque "en progreso") o del agent brief.

4. **Renombrar > borrar.** Si un archivo se vuelve obsoleto, evalúa renombrarlo
   con un prefijo `OLD_` o moverlo a `archive/` antes de borrar. La historia
   importa.

5. **Cuando agregas info nueva a una capa, revisa si invalida algo en otra.**
   Ejemplo: si cambias el workflow de build (capa 5), checa si el agent brief
   (capa 3) cita el workflow viejo en algún lado.

### Reglas anti-stale

1. **Version bump → barrido obligatorio.** Cuando bumpeas versión del producto
   (ej. v1.0 → v1.1), revisa las 5 capas: actualiza la versión actual en
   spec + agent brief, mueve pendientes resueltos del changelog "en progreso"
   a la sección de esa versión.

2. **Si descubres un detalle operativo nuevo (ej. una env var que faltaba en
   un README), actualiza el doc INMEDIATAMENTE.** Si te dices "luego lo
   apunto", garantizado que el siguiente tú lo va a redescubrir.

3. **Las versiones actuales NO viven en múltiples lugares.** El agent brief
   cita "v1.0.3 — en testing" en su header. El spec dice "v1.0 publicada".
   Esos dos pueden coexistir porque marcan cosas distintas (release shipped vs
   spec doc version). Pero NO debe haber 3 archivos diciendo "la versión
   actual es X" con valores distintos.

### Excepciones razonables

- Scripts one-off (`generate-assets-vX.py`) pueden tener su propio doc inline
  en el header del archivo. No necesitan README aparte.
- Migraciones SQL pueden tener un comentario `-- Por qué este migration:` arriba
  en vez de un doc separado.
