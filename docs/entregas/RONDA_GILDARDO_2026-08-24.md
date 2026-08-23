# Ronda para Gildardo · 2026-08-24

**De:** Equipo Atlas · **Para:** Gildardo Uribe, Dirección Científica CNV

> **Esta ronda no reemplaza a la del 23**, que sigue esperando respuesta y donde lo que bloquea es cuál de los dos motores gobierna la prescripción. Esta trae ocho puntos **nuevos**, que salieron de construir y probar el plan alimentario. **Ninguno contradice lo que preguntamos allí**; dos son primos de preguntas que ya te hicimos y lo decimos donde corresponde, para que no respondas dos veces.

**Cómo leer esta ronda.** Casi todo lo que sigue son **propuestas nuestras**, no reportes de defectos de tu archivo. Cuando decimos "tu prototipo no hace X" no estamos señalando un error: estamos diciendo que al construirlo sobre una base de datos, con el plan guardado y con un profesional distinto usándolo cada día, aparecen conexiones que en un prototipo no tienen por qué estar. Tú decides cuáles valen.

---

# Parte 1 · El menú no mira cuatro cosas que quizá debería

Esta parte va primera porque **bloquea construcción**: estábamos por rehacer el generador de menús (que hoy produce texto libre) para que **adapte** el menú base según las restricciones, como hace el tuyo. Antes de escribir ese prompt necesitamos saber qué debe mirar, porque cada versión del prompt queda registrada y no queremos versionarlo dos veces.

**Lo que el menú mira HOY en Atlas**, para que la lista esté completa:

> objetivo calórico · proteína objetivo · restricciones del modelo · restricciones que escribe el profesional · fenotipo estructural · sector funcional · rutas de atención priorizadas

## 1.1 · Las alergias y las intolerancias no llegan (esto es seguridad)

**El hallazgo:** un paciente que declaró alergia a los mariscos **puede recibir un menú con mariscos**, salvo que el profesional la teclee a mano en el campo de restricciones.

La encuesta las captura bien, con opciones cerradas y todo: *"¿Alergias alimentarias diagnosticadas?"* (leche, huevo, maní, trigo, soya, pescado, mariscos) y *"¿Intolerancias alimentarias?"* (lactosa, gluten, fructosa).

**Verificamos qué hace tu archivo con ellas:** las lee **en un solo sitio**, para el párrafo clínico (*"presenta ... alergia a X ... intolerancia a Y"*). En toda el área del plan y del menú no aparecen. Así que **no es que nosotros las hayamos perdido: tampoco llegan al menú en tu prototipo**. Es muy probable que sea una conexión que no se pensó, no una que se descartara.

**Nuestra propuesta:** que viajen al menú **en un bloque propio y por encima de todo lo demás**. Una restricción médica se puede matizar; una alergia declarada, no. Y un menú generado es exactamente donde el olvido se materializa, porque nadie revisa plato por plato.

**Lo que necesitamos de ti:** ¿lo apruebas? ¿Y quieres que la intolerancia se trate igual de dura que la alergia, o con un matiz (la lactosa admite grados, el maní no)?

## 1.2 · El menú no sabe cuántas porciones lleva cada comida

**El hallazgo:** el desayuno del menú **no refleja las porciones que la distribución le asignó al desayuno**. La cadena va objetivo → intercambio → distribución → menú, y **se corta en el último eslabón**: el menú se arma del ciclo, por su cuenta.

**Verificado también en tu archivo:** rastreamos todos los usos de la distribución (`interDist`) y solo la lee su propia tabla. Ningún código del menú la toca. **Hueco de los dos.**

**Nuestra propuesta:** que el prompt lleve, por tiempo de comida, las porciones y las calorías que la distribución le asignó, para que el desayuno propuesto se parezca a lo que el plan dice que ese desayuno debe aportar. Hoy el profesional reparte con cuidado y el menú lo ignora.

**Lo que necesitamos de ti:** ¿te parece que deben conectarse? Y si sí, ¿el menú debe **respetar** ese reparto o solo **tenerlo en cuenta**?

**Relacionado con P-25**, que ya te preguntamos en la ronda del 23 (si los porcentajes por tiempo son fijos del modelo o un valor que el profesional ajusta). No hace falta que la respondas dos veces: si contestas P-25, esto se apoya en esa respuesta.

## 1.3 · El contexto del paciente: acceso e inseguridad alimentaria

**Planteado por Santiago:** un paciente con inseguridad alimentaria o acceso limitado a alimentos frescos **no debería recibir un menú con salmón**.

**El dato ya existe y ya lo usas:** tu propio párrafo del resumen dice *"presenta inseguridad alimentaria frecuente"* o *"con acceso fácil a alimentos frescos y saludables"*. Lo portamos tal cual. Lo que no ocurre es que eso llegue al menú.

**Esto no lo proponemos: te lo preguntamos.** Que un menú se module por la situación socioeconómica del paciente es criterio clínico y toca cómo se le presenta el plan a una persona. No es nuestra decisión.

**Lo que necesitamos de ti:** ¿el menú debe considerarlo? Y si sí, ¿cómo lo dirías sin que el paciente lea un plan que le recuerda lo que no puede comprar?

## 1.4 · Y la pregunta de fondo: ¿qué más?

Las tres de arriba aparecieron **buscando otra cosa**. Eso es lo que nos preocupa: si tres salen solas, probablemente haya más que no vemos porque no sabemos qué buscar.

**Lo que necesitamos de ti:** con la lista de lo que hoy viaja (arriba, al inicio de esta parte), **¿qué falta?** Es la pregunta más abierta de la ronda y probablemente la más valiosa.

---

# Parte 2 · Una comida activa y vacía dice dos cosas contradictorias

Hoy se puede dejar el desayuno **activo** y repartirle **cero** porciones a todos los alimentos. El plan queda diciendo dos cosas a la vez: la casilla dice que el paciente desayuna y la tabla dice que no come nada en el desayuno.

**Verificamos tu archivo:** la fila de la distribución compara la suma **por alimento** (que las porciones repartidas igualen las del intercambio), y eso está bien. Pero **no hay ninguna verificación por tiempo de comida**, así que una comida activa y vacía pasa sin marca. En Atlas ya mostramos los totales por tiempo, así que teníamos el dato delante y tampoco avisábamos.

**Lo que ya hicimos** (por eso esto es aviso, no pregunta abierta): avisamos en vivo y **no bloqueamos**, igual que con el descuadre por alimento. El texto dice cuál es la salida correcta: *"El desayuno está activo pero no tiene porciones asignadas. Si el paciente no hace esa comida, apaga la casilla."*

El modelo mental que aplicamos, y que queremos que confirmes: **las casillas mandan, la tabla reparte dentro de lo que ellas definen, y el menú usa esos mismos tiempos.**

**Lo que necesitamos de ti:** ¿te parece bien avisar? ¿O prefieres que no se avise, o que se impida? Si dices que no hace falta, se quita en una línea.

**Primo de P-30** (ronda del 23), donde te preguntamos si un reparto que **no cuadra** debe poder guardarse. **Son casos distintos:** aquel es un alimento cuyo reparto no suma; este es una comida entera sin nada. Pueden tener la misma respuesta, pero no son el mismo caso.

---

# Parte 3 · Alcance: tres cosas que encontramos mirando tu archivo

Ninguna requiere que hagas nada hoy. Van porque cambian **qué tenemos que construir**, y preferimos que lo sepas antes de que lo construyamos.

## 3.1 · Tu plan tiene dos caras, y no lo habíamos visto

Al portar la lista de intercambio del paciente, Santiago notó que **no aparece en sus capturas**. Y tiene razón: su contenedor está marcado como "solo impresión", así que **no se ve en pantalla y solo sale al imprimir**.

Al mirarlo completo apareció una división deliberada:

| | En pantalla | Al imprimir |
|---|---|---|
| Resumen clínico · Objetivo · Necesidades · Plan por grupos · Distribución · Menú | sí | sí |
| **Fórmula sintética · Tabla de intercambio del profesional · Validación** | sí | **no** |
| **Lista de intercambio del paciente** | **no** | sí |

**Lo que se imprime excluye lo técnico y deja lo que el paciente usa.** Nos parece una decisión buena y no la habíamos modelado: Atlas no tiene todavía una superficie de impresión ni de envío del plan, así que esa lista quedó en pantalla. La moveremos cuando construyamos el envío.

## 3.2 · Cuatro salidas al paciente, y no envían lo mismo

Inventariamos los sitios de tu archivo que imprimen o envían:

| Dónde | Qué sale |
|---|---|
| "Imprimir plan" | El plan con el filtro de arriba |
| El botón de correo | Una sola línea de texto, sin adjunto: *"Plan Nutricional — Nombre · VCT: N kcal..."* |
| "Enviar informe al paciente" | La **composición corporal**, a una app donde el paciente entra con su documento y fecha de nacimiento |
| "Imprimir / Guardar PDF" | La pestaña de tratamiento completa |

Son **tres documentos distintos por dos canales**. Nos sirve para ordenar el bloque de envío antes de construirlo, en vez de hacer "un botón de enviar" y descubrir después que eran tres cosas.

## 3.3 · La historia clínica

Tu archivo tiene una **historia clínica de once secciones** (datos del paciente, motivo de consulta, antecedentes, tabla por niveles de Wang, resumen diagnóstico con meta y objetivo, rutas activadas, tratamiento, recomendaciones, remisiones, exámenes solicitados, próxima cita y firma). **Nuestro reporte en PDF trae seis.**

No es una pregunta: es alcance que no teníamos dimensionado, y probablemente sea una pestaña propia. Lo decimos porque **reabre una decisión nuestra**: dejamos el reporte dentro de Tratamiento porque no había dónde ponerlo; si construimos esa pestaña, eso cambia.

---

# Resumen

| # | Qué | Tipo |
|---|---|---|
| 1.1 | **Alergias e intolerancias al menú** | **Propuesta, seguridad, bloquea** |
| 1.2 | El menú debería saber las porciones de cada comida | Propuesta, bloquea |
| 1.3 | ¿El menú debe considerar el acceso a alimentos? | **Pregunta, criterio tuyo** |
| 1.4 | **¿Qué más debería alimentar el menú?** | Pregunta abierta |
| 2 | Avisar de una comida activa y vacía | Aval de algo ya hecho |
| 3.1 | Tu plan tiene dos caras (pantalla / impresión) | Informativo |
| 3.2 | Cuatro salidas al paciente, tres documentos | Informativo |
| 3.3 | La historia clínica de once secciones | Alcance |

**Lo que bloquea es la Parte 1**, y no arrancamos el generador de menús hasta tenerla. Mientras tanto seguimos con el resto del plan, que no depende de estas respuestas.

**Y sigue abierta la ronda del 23**, cuyo punto 1 (cuál de los dos motores gobierna la prescripción, con el sodio del hipertenso a 2.300 o a 1.500) es lo más urgente de las dos rondas juntas.
