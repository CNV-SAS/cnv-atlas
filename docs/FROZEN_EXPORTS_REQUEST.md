# FROZEN_EXPORTS_REQUEST.md - solicitud consolidada a Gildardo

**Estado:** LISTA CERRADA (2026-07-18). La vista de Diagnóstico (ST4-ST7) quedó construida; la
lista dejó de crecer. Contiene las 4 cosas que Atlas necesita del lado de Gildardo. **Pendiente:
Santiago la revisa y arma el mensaje final para Gildardo y su CC antes de enviarla** (Atlas no la
envía). Consolida [[Q9]] y [[Q10]] más lo que apareció al pulir la vista (patrón alimentario,
rangos de referencia de indicadores).

## Para Gildardo (en breve)

Tu motor ya calcula varias cosas bien; el problema es que algunas quedan **"internas" a tus
funciones** y Atlas no puede alcanzarlas sin **modificar tus archivos**, cosa que por disciplina
**no hacemos** (para poder garantizar que la ciencia que corre es idéntica a la tuya, byte a byte).

Una analogía: es como una calculadora que hace la cuenta correcta pero no tiene el botón para
mostrar ese resultado. La cuenta ya existe adentro; solo falta "sacarla". Nosotros no le abrimos la
tapa a tu calculadora; te decimos exactamente qué botón agregar y tú nos entregas la versión con el
botón puesto.

Ejemplo concreto: la tarjeta "abordaje por profesión" del diagnóstico. Tu motor SÍ sabe qué debe
hacer cada profesión (Médico / Psicólogo / Deportólogo / Nutricionista) para cada estado; esa lógica
ya está escrita en tu paquete. Pero no está "publicada" hacia afuera, así que Atlas no la puede
mostrar. Lo mismo pasa con otras 3 cosas.

**Son 4, y para cada una hay dos formas de resolverlo, tú (o tu CC) eligen:**
1. **Abordaje por profesión** (el texto por rol de cada estado del diagnóstico).
2. **Diagnóstico por fila de la composición corporal** (masa muscular, hidratación, etc.).
3. **Diagnóstico de consumo alimentario** (el patrón: alimentos protectores / moderados / de riesgo).
4. **Rango esperado de cada uno de los 12 indicadores** (para que el profesional vea si un valor
   está dentro o fuera de lo normal, y cuánto se desvía).

Cada una se resuelve **exponiendo la función** (nos entregas el archivo con el "botón" agregado) o
**entregando los datos** (una tabla con los cortes/textos). Abajo, el detalle técnico para tu CC y,
en cada punto, **exactamente qué debe entregarnos**.

**Por qué una sola solicitud:** es el mismo tipo de bloqueo repetido. En vez de queries goteando, te
llegamos con la solución propuesta lista para que solo aprueben y produzcan el entregable.

## Regla de custodia (crítica, no negociable)

Atlas **NO edita el `.js` frozen ni se lo entrega modificado.** La propiedad verbatim (byte a byte
contra la ciencia de Gildardo) exige que el cambio **nazca del lado de Gildardo**, para preservar la
cadena de custodia de la ciencia. El flujo es:

1. Atlas propone EXACTAMENTE qué líneas agregar (abajo).
2. Gildardo / su CC lo aplican en **su** repo y nos entregan el `.js` nuevo.
3. Atlas hace el **swap limpio** del archivo y el **golden test** confirma que **nada más cambió**.

Esta solicitud dice **"les proponemos este cambio exacto para que lo apliquen de su lado"**, NO
"aquí está el archivo ya cambiado".

**Naturaleza del cambio:** en ningún caso se toca la LÓGICA de una función. O se **expone** (se
agregan nombres al `module.exports`, exactamente como ya se exponen `getDX`/`efrCompose`), o se
**entrega como datos** (una tabla de cortes/textos, sin código nuevo). El golden test verifica que
al hacer el swap del `.js` los valores no cambian; solo pasa a ser alcanzable desde el adaptador.

## Detalle técnico (para su CC)

### 1. `efrProf` — abordaje por profesión (de Q9)
- **Archivo:** `frozen/engine.core.js` (definida ~L807, no exportada).
- **Qué habilita:** la 6ª tarjeta de la Diana ("abordaje por profesión"), texto por rol
  (Médico / Psicólogo / Deportólogo / Nutricionista). Atlas congela el **conjunto de los 4 roles**
  en el snapshot al diagnosticar (para que un diagnóstico histórico muestre el abordaje del rol tal
  como el modelo lo tenía, sin acoplarse al rol ni al registry vivo).
- **Vía A (exponer la función):** agregar `efrProf` al `module.exports`.
- **Vía B (datos, quizá más natural para TEXTO):** entregar el abordaje como tabla
  `estado EFR × profesión → texto`, para poblarlo en el registry como el resto del contenido EFR.
  Para contenido de texto, esta vía puede ser más limpia. **Que su CC elija la vía.**
- **Entregable esperado:**
  - Si eligen Vía A: el **`engine.core.js` nuevo** con `efrProf` agregado al `module.exports`
    (línea exacta abajo), sin ningún otro cambio.
  - Si eligen Vía B: un **archivo de datos** (JSON/CSV) con una fila por `estado EFR × profesión`
    y el texto del abordaje (columnas: `efr_key`, `profesion`, `texto`).

### 2. Clasificadores de composición (de Q10)
- **Archivo:** `frozen/engine.core.js` (definidos, no exportados).
- **Funciones:** `cSMM`, `cMMEM`, `cASMI`, `cFFW`, `cEISG`.
- **Qué habilitan:** la columna de Diagnóstico de la tabla de composición (SMM/W, MMEM, ASMI,
  hidratación libre de grasa, balance E/I). `cASMI` además toca sarcopenia (Q5).
- **Vía recomendada (exponer la función):** para clasificadores (funciones de corte), exponer es más
  limpio que transcribir datos. Agregar los 5 al `module.exports`.
- **Nota `dAECMCA` (AEC/MCA):** es render-only (no está en el paquete congelado). Decidir si Gildardo
  la incorpora al paquete o si Atlas la trata como referencia de display (como los umbrales OMS).
- **Entregable esperado:** el **`engine.core.js` nuevo** con `cSMM`, `cMMEM`, `cASMI`, `cFFW`,
  `cEISG` agregados al `module.exports` (línea exacta abajo), sin otro cambio. **Decisión que
  necesitamos:** si `dAECMCA` se incorpora al paquete (y entonces también se expone) o si queda
  como referencia de display de Atlas.

### 3. Diagnóstico de consumo alimentario (D1-D8, patrón alimentario)
- **Origen:** NO está en el paquete congelado. El patrón alimentario (alimentos protectores /
  moderados / de riesgo, con su scoring por grupos) se computa en la **capa de render** del
  prototipo (`ATLAS_v7.html`: categorización de alimentos ~L587-686, funciones de scoring
  ~L2342 y ~L3234, `FREQ_GROUPS`). Es la misma familia que `calcularDominios`/`dAECMCA`:
  lógica de presentación que nunca se porto al motor.
- **Qué habilita:** la sección "Diagnóstico de encuesta" de la pestaña de Diagnóstico (hoy
  placeholder "Disponible proximamente"). Es análisis clínico de la encuesta D1-D8.
- **Por qué no se resuelve del lado de Atlas:** reimplementar la categorización y el scoring en
  TS sería reingeniería de la lógica clínica de Gildardo (prohibido); no se deriva fielmente de
  las respuestas crudas sin esa lógica.
- **Vías (que su CC elija):** (a) **incorporar la función al paquete congelado** y exponerla en
  `module.exports`, como el resto; o (b) **entregar la categorización + los cortes como datos**
  (mapa alimento -> categoría, y los umbrales/pesos del scoring por grupo), para poblarlos en el
  registry. Para contenido tan tabular, la vía de datos puede ser la más limpia.
- **Entregable esperado:**
  - Si eligen Vía A: el **`engine.core.js` nuevo** con la función del patrón alimentario
    incorporada al paquete y agregada al `module.exports`.
  - Si eligen Vía B: un **archivo de datos** con (1) el mapa `alimento -> categoría` (protector /
    moderado / de riesgo) y (2) las reglas de scoring por grupo (umbrales/pesos que convierten las
    frecuencias en el veredicto del patrón).

### 4. Rangos de referencia de los 12 indicadores (columnas Referencia y Δ)
- **Origen:** los cortes que definen el rango esperado de cada indicador viven DENTRO de los
  clasificadores congelados (`cIFC`, `cIRC`, `cPABU`, `cFMI`, `cFFMI`, `cISCM`, `cIEHH`, `cIAE`,
  `cAF`, `cIR`): p. ej. `cIFC(v, sexo)` usa `lo/hi` (hombres 4.12/6.68, mujeres 2.08/3.28), pero
  la funcion solo DEVUELVE `{ label, color, risk, k }`, no el `lo/hi`. El snapshot guarda
  `IndicatorClass = { label, k }`, sin rango. Los umbrales no estan expuestos como dato.
- **Qué habilita:** las columnas Referencia (rango esperado) y Δ (desviacion) en la tabla de los
  12 indicadores de la pestaña de Diagnostico, que es como el profesional lee el porque de la
  clasificacion. Hoy la tabla tiene 3 columnas (Indicador, Valor, Clasificacion); faltan esas dos.
- **Por qué no se resuelve del lado de Atlas:** transcribir los `lo/hi` de cada clasificador en TS
  duplicaria la ciencia congelada (drift si Gildardo recalibra), y viola la propiedad verbatim.
- **Vías (que su CC elija):** (a) **entregar los cortes como datos** (tabla indicador × sexo →
  `{ lo, hi, unidad }`), la mas natural para una columna de referencia; o (b) **exponer una
  funcion** que dado el indicador/sexo devuelva el rango.
- **Ojo con Δ:** la referencia es un RANGO (lo/hi), no un punto. Para una columna Δ hay que
  definir contra que se mide la desviacion (borde mas cercano del rango, punto medio, etc.). Esa
  definicion tambien la da Gildardo; Atlas no la inventa.
- **Entregable esperado:**
  - Si eligen Vía A (datos): un **archivo** con una fila por `indicador × sexo` y columnas
    `lo`, `hi`, `unidad`.
  - Si eligen Vía B (función): el **`engine.core.js` nuevo** con una función expuesta que devuelva
    el rango del indicador dado (indicador, sexo).
  - **Decisión que necesitamos (independiente de la vía):** contra qué punto del rango se mide Δ
    (borde más cercano, punto medio, u otro). Sin esa definición, la columna Δ no se puebla.

### Lista cerrada (fin de ST7). No se agregaron más al terminar la vista de Diagnóstico.

## Propuesta de línea exacta (para las vías que exponen función)

Aplica a las entradas que se resuelvan **exponiendo** (1 y 2, y la 3 si se elige incorporar la
función). Es la línea EXACTA que proponemos que agreguen; no tocamos nada más.

`frozen/engine.core.js`, `module.exports` actual:
```js
module.exports = { calcIFC, calcIRC, calcPABU, cIFC, cIRC, cPABU, cFMI, cFFMI, cISCM, cIEHH, cIAE, cAF, cIR, kl, DX, efrCompose, getDX, FYR_LABELS, STRUCT_LABELS };
```
Propuesta (agregar SOLO los nombres marcados, sin tocar lógica):
```js
module.exports = { calcIFC, calcIRC, calcPABU, cIFC, cIRC, cPABU, cFMI, cFFMI, cISCM, cIEHH, cIAE, cAF, cIR, kl, DX, efrCompose, getDX, efrProf, cSMM, cMMEM, cASMI, cFFW, cEISG, FYR_LABELS, STRUCT_LABELS };
```
(Si para el abordaje o el patrón alimentario se elige la vía de datos, esos no entran al export y en
su lugar se entrega el archivo de datos descrito en cada entrada. La entrada 4, si se elige función,
agrega además el nombre de esa función al export.)
