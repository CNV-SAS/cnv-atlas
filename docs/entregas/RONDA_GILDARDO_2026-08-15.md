# Ronda para Gildardo (borrador para revisión de Santiago) - 2026-08-15

**De:** Equipo Atlas · **Para:** Dirección Científica (Gildardo Uribe)

Esta ronda queda **corta**: tu respuesta del 15 (a la ronda del 14) cerró casi todo. Abajo va solo lo
que sigue genuinamente abierto, ordenado por cuánto bloquea, y con lo que ya nos respondiste marcado
para no repetírtelo.

---

## Ya cerrado con tu respuesta del 15 (no requiere nada más, solo lo listamos para que conste)

- **FFW, aguas sin grasa (L), E/I sin grasa (§0):** era un defecto de tu archivo (una derivación
  aproximada se adelantaba a `derivarFaltantes`); nuestros valores eran los canónicos. Ya lo corregiste.
- **IEHH (0,81 vs 0,885):** arrastraba la FFW mal derivada (`computeIEHH` usa `FFW`); nuestro 0,81 es
  el bueno. Cerrado, no lo incluimos como pregunta.
- **Veto = aviso (§1); riesgo integrado (§2); MCA al ISCM (§5):** recibidos, sin pregunta pendiente.

---

## 1. Criterio del Δ en la tabla de composición (lo que más bloquea)

Es **un solo tema** que explica casi todas las diferencias que vio Santiago fila por fila. Tu tabla
mide el Δ contra el **borde** del rango; nosotros contra el **punto medio**. Los dos tienen sentido:

| Fila | Valor | Rango | Tu Δ (borde) | Nuestro Δ (medio) |
|---|---|---|---|---|
| IMC | 25,66 | 18,5–24,9 | +0,8 (vs 24,9) | +3,96 (vs 21,7) |
| FFMI | 19,90 | 17–25 | +2,90 (vs 17) | −1,10 (vs 21) |
| FMI | 5,76 | 3–6 | (contra borde) | +1,26 (vs 4,5) |
| AEC/AIC % (con y sin grasa) | — | 35–40 / 60–65 | contra borde | contra medio |
| Ángulo de fase | 6,70 | 6,5–7,0 | +0,2 (vs 6,5) | −0,05 (vs 6,75) |
| E/I | 0,634 | 0,35–0,40 | +0,234 (vs 0,40) | +0,26 (vs 0,375) |
| ACT/MLG | 71,60 | 71–74 | −2,4 (vs 74) | −0,90 (vs 72,5) |

**Pregunta:** ¿el Δ va contra el **borde** del rango (tu tabla) o contra el **punto medio** (nosotros)?
Nuestra lectura es que la tuya es más útil clínicamente ("pasa 0,8 del límite" dice más que "está 3,96
del centro"), pero es tu decisión y la aplicamos en un solo lugar. (CA-2, pendiente de tu aprobación
desde el inicio.)

## 2. SMM/W, y el principio general de "manda el motor"

En SMM/W tu tabla de display dice **"Normal"**; el clasificador de tu motor (`cSMM`, hombre >33 →
"Óptimo") emite **"Óptimo"**. Es el mismo tipo de divergencia display-vs-motor que ya resolviste para
el FMI (donde nos dijiste "corrijan la tabla contra el motor para IFC, IRC y FMI").

**Pregunta que cierra la clase entera (para no preguntarte clasificador por clasificador):** ese
principio de **"manda el motor"** ¿aplica a **todos** los clasificadores de la tabla, o solo a los
tres que nombraste (IFC, IRC, FMI)? Si es general, SMM/W (y cualquier otro) sigue el motor y no
volvemos a preguntar.

## 3. Re-sincronización del motor a tu entrega del 13-ago (PABU en el Dominio 1)

Tu HTML del 13 **añadió la PABU al Dominio 1** del DFI ("La PABU faltaba en el dominio pese a estar
declarada"). Nuestro motor DFI está sincronizado a una versión **anterior** (05-ago), así que el
Dominio 1 nos sale con IFC/IRC/IEHH, sin PABU. Es cambio de **motor congelado**, va por el mecanismo
de modificaciones autorizadas.

**Pregunta:** ¿confirmas la entrega **2026-08-13** como la vigente para re-portar el motor? Y para
re-sincronizar **una sola vez** (no pieza por pieza): ¿además de la PABU en el Dominio 1, qué más
cambió en el 13 que debamos traer (p. ej. `cPABU`/`cMMEM`, que teníamos retenidos a propósito por Q27)?

## 4. Las 5 constantes poblacionales de la MLG (P-10)

Para llenar las referencias que el equipo no trae, tu bloque REF_POB usa constantes de reparto de la
masa libre de grasa. **Dos ya validadas** (hidratación 73,2 %, MCA 52,4 %) van sin marca. **Cinco sin
validar** las mostramos con un asterisco "en validación" (no que el dato esté mal): agua EC 42 %,
proteína 19,4 % de la MLG, proteína activa 70 % de la total, CMO 5,6 %, mineral no óseo 1,2 %.

**Pregunta:** ¿las confirmas (y les quitamos la marca), o las dejamos marcadas hasta que las valides?
Tu propio archivo las usa; solo pedimos el visto bueno para presentarlas sin la advertencia.

---

## Menores (baja prioridad, confirmación)

- **(5) Δ del Agua total:** tu archivo pre-fix mostraba −1,05 con valor 44,66 y ref 48,55; nosotros
  −3,89 (= valor − ref, exacto). Creemos que tu fix del §0 ya lo alinea (tu FFW y ACT ya no comparten
  valor). Solo confírmanos que el Δ del ACT es valor − ref.
- **(6) Cola del Nivel II:** en las últimas filas tu tabla y la nuestra difieren: "Grasa corporal
  total (% - Lípidos Wang)" es la misma Masa grasa % que ya mostramos arriba (no la duplicamos); el
  IEHH lo tenemos en la tabla de índices, no en Wang; y donde tu HTML dice "sin dato" (Masa proteica
  metabólica) nosotros la derivamos. ¿Dejamos las nuestras (más completas) o las ajustamos a tu orden?

---

## 7. Región/altitud: ¿residencia actual o residencia prolongada? (del bump de encuesta §3)

Pediste "región **de origen o de residencia prolongada**", y altitud. Hoy la encuesta captura la
ciudad de **residencia actual**, de la que podemos derivar departamento, región y altitud sin
preguntarle nada más al paciente (una tabla ciudad → altitud; ya la estamos construyendo).

**El problema:** la residencia actual no es lo mismo que la prolongada, y el efecto fisiológico que
buscas (adaptación a la altura: hematocrito, agua corporal) viene de **vivir años en altura**, no de
dónde está hoy. Alguien nacido en Bogotá que se mudó a Cartagena hace un año conserva la adaptación;
alguien que llegó a Bogotá el mes pasado, no. Derivar de la residencia actual capturaría **otra cosa**,
y podría ser peor que no capturarla: un dato que parece medir adaptación a la altura y no la mide.

**Pregunta:** ¿derivamos de la residencia **actual** (cero preguntas extra, con la limitación anotada),
o agregamos **una pregunta** de dónde vivió la mayor parte de su vida (y de ahí derivamos altitud y
región)? La infraestructura (tabla de ciudades con altitud + selector nuevo) sirve para las dos
respuestas; lo único que esperamos es si se agrega la pregunta de origen.
