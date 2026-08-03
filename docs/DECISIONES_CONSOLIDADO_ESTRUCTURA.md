# Documento consolidado de decisiones clínicas: propuesta de ESTRUCTURA (2026-08-03)

**Qué es esto.** La propuesta de CÓMO se estructura el documento único, numerado y firmado que pidió Gildardo, para revisión antes de llenarlo con contenido. Resuelve su decisión de método: un solo lugar con todo lo decidido, y la regla de entrada "antes de preguntar, revisar si ya está".

## El documento: `docs/DECISIONES_ANIBISE.md` (nombre propuesto)

La FUENTE NORMATIVA de la ciencia del modelo. Lo firma Gildardo (Dirección Científica), lo mantenemos nosotros. Por la nueva regla de autoridad (ARCHITECTURE), este documento manda sobre el archivo prototipo: donde discrepen, manda el documento.

### Numeración: una sola secuencia `D-NNN`

- Cada DECISIÓN cerrada es una entrada `D-001`, `D-002`, … Número ESTABLE (no se reordena; si una decisión se revisa, se emite una nueva que cita a la anterior, como el flujo de corrección: no se sobrescribe).
- Una entrada = una decisión, no una pregunta. Las preguntas abiertas viven en `GILDARDO_QUERIES.md` (ver abajo); solo entran aquí cuando se RESUELVEN.
- Los prefijos actuales (Q1-Q28, C1-C13, P0-P3) se ABSORBEN: cada uno que ya esté resuelto se vuelve un `D-NNN` y la entrada cita su origen ("origen: Q28, C11"). No se mantienen dos numeraciones en paralelo.

### Campos de cada entrada

```
D-NNN · <título corto>
  Decisión:   <el qué, textual, como lo firmó Gildardo>
  Estado:     firmado | pendiente-de-cifra (C6) | implementado | implementado-y-divergente
  Origen:     <Q/C/P que lo generó, o "nuevo">
  Afecta:     <frozen: archivo.js:linea | tabla | pantalla | pipeline | ninguno>
  Divergencia: <si Atlas se aparta del archivo prototipo por esta decisión, se anota aquí>
  Implementación: <commit/bloque en Atlas, o "pendiente">
```

El campo **Divergencia** es la pieza de la nueva regla de autoridad: cuando el archivo dice X y la instrucción dice Y, Atlas hace Y y se registra aquí, sin abrir ronda.

### Categorías (etiqueta, no numeración aparte)

Para poder filtrar, cada `D-NNN` lleva una etiqueta: `ciencia-frozen` (cambia el motor congelado) · `pipeline` · `pantalla/UX` · `producto` · `dato/tabla`. La lista de "modificaciones autorizadas del frozen" es simplemente el FILTRO `Afecta=frozen` sobre este documento, no un documento aparte.

## Relación con los documentos actuales

| Documento | Rol después del consolidado |
|---|---|
| **`DECISIONES_ANIBISE.md`** (nuevo) | La FUENTE única de decisiones cerradas. Firmado. Manda sobre el archivo. |
| **`GILDARDO_QUERIES.md`** | Pasa a ser el BUZÓN de preguntas ABIERTAS (donde se redactan y se rastrean las que faltan). Cuando una se resuelve, su resolución entra como `D-NNN` y la entrada de la query apunta a ese número ("→ D-NNN, cerrada"). El histórico se conserva como archivo. |
| **`CAMBIOS_AUTORIZADOS.md`** | NO se crea como archivo separado. Es una VISTA del consolidado (las `D-NNN` con `Afecta=frozen`). Evita una tercera fuente que se desincronice. Cada modificación autorizada del frozen ES una `D-NNN` etiquetada `ciencia-frozen`, con su bump de versión y re-ancla de golden anotados en Implementación. |
| **`BACKLOG.md`** | Sigue igual: el trabajo por hacer. Un `D-NNN` que exige construcción genera una entrada de BACKLOG que lo cita. |

## La regla de entrada (de Gildardo), operacionalizada

Antes de preguntarle algo a Gildardo:
1. Buscar en `DECISIONES_ANIBISE.md`. ¿Está?
   - **Sí** → implementar, citando el `D-NNN`.
   - **Sí, y no sirve** → citar el `D-NNN` y decirle qué no funciona (no re-preguntar de cero).
   - **No** → preguntar. La respuesta entra como `D-NNN` nuevo.
2. Esto reemplaza la regla actual "antes de preguntar, leer si su archivo ya responde": el archivo deja de ser la referencia; el consolidado lo es.

## Qué pasa con "los tres" (lo que preguntaste)

- Los tres bloques de tratamiento faltantes NO son decisiones pendientes de Gildardo: ya están decididos (existen en su archivo, instrucción de portarlos). Entran como UNA `D-NNN` ("portar los cuatro bloques por profesión") con `Afecta=pantalla/pipeline`, estado `firmado`, y su BACKLOG asociado. No ocupan tres entradas de decisión: es una sola decisión de port.

## Siguiente paso (si apruebas la estructura)

Poblar `DECISIONES_ANIBISE.md` con las decisiones ya cerradas (esta ronda + las Q/C/P resueltas), numerándolas `D-001`… y marcando cada query resuelta con su `→ D-NNN`. Es trabajo de consolidación, no de decisión; se hace de una vez y se le pasa a Gildardo para firma.
