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
