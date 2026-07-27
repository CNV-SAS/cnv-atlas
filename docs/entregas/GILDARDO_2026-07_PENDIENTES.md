# Pendientes para Gildardo (extracto, 2026-07-27)

Gildardo: esto es un **extracto** de lo que quedó abierto de nuestro lado y depende de una decisión tuya. No es el archivo completo de la bitácora: **todo lo que respondiste en las rondas anteriores (julio) ya está cerrado y no requiere acción tuya**, no hace falta releerlo.

Está **ordenado por esfuerzo**, de lo que respondes en minutos a lo que te exige sentarte a decidir. Al final hay dos pedidos de autoría (ciencia nueva) y un pendiente de datos.

**Solo dos cosas bloquean atender al primer paciente real:** la confirmación del punto 5 (firma del modelo vigente) y la decisión del punto 9 (cuál modelo calórico es el vigente). El resto no bloquea nada; se puede lanzar la revisión de los profesionales sin ellas. Marcadas abajo con **[BLOQUEA]**.

Cada punto es "para ti" (breve, la decisión). El detalle técnico para tu equipo va aparte, en el anexo al final.

---

## 1. La casilla "total" del plan por grupos no cuadra con el objetivo calórico

En el plan por grupos de alimentos, las nueve columnas de porciones suman bien, pero la casilla de kcal de la fila TOTAL muestra el objetivo calórico exacto (2976), mientras que las filas de alimentos suman 3134 kcal. O sea: nueve celdas son sumas reales y la décima es una meta; la matriz de porciones se pasa del objetivo por 158 kcal (5.3%). ¿Es una limitación aceptada de trabajar con porciones enteras, o la matriz debería reconciliar con el objetivo? ¿Qué debe mostrar esa celda?

## 2. Los porcentajes por tiempo de comida suman 95% al desactivar un tiempo

Con Merienda desactivada, los tiempos muestran 25 + 10 + 30 + 10 + 20 = 95%. El texto dice "las porciones se redistribuyen automáticamente", pero ese 5% no se reasignó. Al desactivar un tiempo, ¿los porcentajes deben renormalizarse a 100% entre los activos, o el porcentaje del tiempo desactivado se pierde a propósito?

## 3. Alcohol: confirmación de la acción tomada

En una ronda anterior definiste que el consumo de alcohol es registro clínico y no debe pesar en el puntaje de estilo de vida (LE8). Ya lo aplicamos: el alcohol dejó de entrar al cálculo, la pregunta sigue en la encuesta como registro. Solo confirma que eso es lo que querías; si en realidad debía pesar en el LE8, dinos con qué peso y lo incorporamos.

## 4. Alimentación e hidratación del LE8: ¿fórmula o quedan por defecto?

Hoy dos de los ocho dominios del estilo de vida (Alimentación e Hidratación) corren con valores por defecto, porque la encuesta captura frecuencias de consumo y vasos de agua, no "porciones" en el formato que espera la fórmula. Para el arranque los dejamos por defecto (fiel a tu prototipo, que hace lo mismo). Si quieres que esos dos dominios usen los datos reales del paciente, necesitamos de ti la fórmula que convierte las frecuencias y el agua en el puntaje. No urge; sin ella el diagnóstico funciona con los otros seis dominios y el resto del modelo con datos reales.

## 5. [BLOQUEA] Firma de que el modelo de índices vigente es el definitivo

Verificamos que los coeficientes de la edad biológica (EB-BIS) que tenemos congelados son idénticos, dígito a dígito, a los del `ATLAS.html` que entregaste (es la versión 5, no la vieja). Nuestra verificación técnica ya está hecha; falta tu **confirmación formal por escrito** de que esa versión 5 es tu modelo de índices definitivo. Es rápido si estás de acuerdo, pero bloquea: sin esa firma no sabemos si lo que calculamos es tu ciencia actual.

## 6. ¿Cuál cálculo del patrón alimentario es el correcto?

El patrón alimentario (clasificar la dieta en protectora / moderada / de riesgo) se calcula distinto entre dos de tus artefactos, y dan puntajes distintos: uno suma el bonus de "neutros" incluyendo las carnes rojas como grupo extra, el otro no. No es diferencia de textos, es el puntaje. Y la encuesta está congelada de nuestro lado. ¿Cuál de los dos es el correcto?

## 7. ¿Cuál de tus artefactos manda, pieza por pieza?

Los siete módulos que entregaste dicen "extraído de ATLAS_v7", pero el `ATLAS.html` que también entregaste es otro archivo: más nuevo en unas cosas (el modelo calórico) y más viejo en otras (la lista de intercambio de alimentos y el resumen clínico están en los módulos pero no en ese HTML). No hay un artefacto único que sea "el más nuevo" para todo. Para portar bien cada pieza necesitamos que confirmes, pieza por pieza (índices, patrón alimentario, DFI, resumen clínico, lista de intercambio, menú), cuál artefacto representa tu modelo vigente.

## 8. ¿Cuál regla decide la ruta R2?

Dentro del modelo hay dos reglas distintas que activan la ruta R2 (reducción de riesgo cardiometabólico), y no son dos copias: son dos criterios diferentes. Uno la decide por la severidad del dominio metabólico del árbol de diagnóstico (es la que el sistema usa de verdad). El otro la decide por umbrales de composición y metabolismo en combinación. Para un caso real dan respuestas distintas: el **caso de referencia BIS-01** (hombre, 54 años, IMC 27.5, IR 0.798, ICT 0.544, FMI 6.37) queda dentro de la ruta por un criterio y fuera por el otro. ¿Cuál de las dos reglas representa tu modelo actual? (Aclara también si tu confirmación de julio sobre que la vía de "rutas por condición" no es la autoritativa aplica a todas las rutas R1-R6, no solo a R5.)

## 9. [BLOQUEA] ¿Cuál de los dos modelos calóricos es el vigente?

Hay dos formas distintas, ambas tuyas, de calcular las calorías y la proteína que se le prescriben a un paciente, y para el mismo paciente dan resultados distintos:
- Una vive dentro de `ATLAS.html` (es la que dibuja la pantalla del protocolo): usa Cunningham (a partir de la masa magra) y elige la estrategia por fenotipo.
- La otra vive en el módulo de motores de tratamiento: usa Mifflin sobre el peso medido, la proteína sobre el peso ideal, y elige la estrategia por condición clínica. Su encabezado dice "Reemplazan el modelo calórico por Mifflin".

"Reemplazan" suena a decisión, no a extracción, así que el módulo podría ser tu pensamiento más nuevo aunque venga de una versión anterior. Se le prescriben calorías y proteína a una persona: la procedencia no puede quedar en disputa entre dos artefactos tuyos. ¿Cuál representa tu modelo vigente? Bloquea el primer paciente real.

---

## Pedidos de autoría (ciencia nueva, no una pregunta de sí/no)

## 10. Función de rangos de referencia por indicador y sexo

Para mostrarle al profesional, junto a cada indicador, su rango normal y qué tan lejos está el paciente de él, necesitamos los valores de referencia (mínimo y máximo) por indicador y por sexo. No los podemos derivar nosotros: es autoría clínica tuya. Sin ellos, la tabla de indicadores va sin la columna de referencia ni el delta.

## 11. Fórmula del indicador AEC/MCA (dAECMCA)

El indicador de agua extracelular sobre masa celular activa que usa tu prototipo vive solo dentro del dibujo de la pantalla, no como una función con su fórmula aislada. Para incorporarlo necesitamos la fórmula como tal.

## 12. Datos de priorización de nutracéuticos (P1/P2/P3) por perfil

Dejamos lista en el código la estructura para mostrar los nutracéuticos en orden de prioridad (primero, segundo, tercero) según el perfil del paciente, pero sin los datos: qué producto va en cada posición para cada perfil. Necesitamos esa tabla para poblarla.

---

## Anexo técnico (para el equipo de Gildardo)

Referencias a archivo:línea sobre nuestro repositorio; sin datos de pacientes.

- **1 (total del plan):** matriz de porciones del apartado E del Nivel IV. Fuera de alcance del bloque actual (T2); se construye en el bloque Plan alimentario.
- **2 (95%):** el código inline sí normaliza los tiempos activos a 100%, así que la captura podría ser estado viejo. Se registra sin resolver.
- **3 (alcohol):** `d3_31` estaba marcada como campo del motor pero `calcLE8` la asignaba a una variable no usada. Acción tomada: se quitó su `field_key`; efecto cero en el diagnóstico. Sin frozen delta.
- **4 (LE8):** `calcLE8` lee `d1_9`/`d1_10`/`d1_16`; la encuesta captura `d1_*_i` (frecuencias) y `d7_agua`. No se inventa mapeo. Dominios Alimentación e Hidratación con default (30/20).
- **5 (firma v5):** `engine.indices.js` `computeEBBIS` L34-41 es byte-idéntico en coeficientes a `ATLAS.html` L5706-5729 (constante 41.438, IFC +1.082, PABU +2.837, ICEC/LE8 -7.982). Verificación técnica cerrada; falta la firma formal.
- **6 (patrón):** `calcPatron` neutro `[8,9,10,15]` (módulo `:72`) vs `[8,9,10]` (`ATLAS.html:2324`); `FREQ_GROUPS` 15 vs 14 grupos. Cambia el score. Encuesta congelada.
- **7 (versión):** auditoría de fidelidad de los seis módulos vs `ATLAS.html`: índices coinciden verbatim; patrón diverge en score (punto 6); DFI coincide el motor pero agrega metas a 24 semanas de un spec externo; resumen clínico y lista de intercambio no aparecen en el HTML; menú coincide en alimentos con unidades convertidas.
- **8 (R2):** regla autoritativa `computeDFI` (`engine.dfi.js:153`, severidad del dominio 2) vs `RUTA_COND.R2` (`engine.indices.js:56`, OR de umbrales FMI/ISCM/ICC/ICT/IR). Hoy solo la primera alimenta el resultado; la segunda no llega a la pantalla. Caso BIS-01 = donante del fixture golden.
- **9 (calórico):** GEB inline `ffm>0 ? 500+22*ffm : Mifflin`, estrategia por fenotipo; módulo Mifflin sobre peso medido, estrategia por condición, encabezado "Reemplazan..." (L3). Portamos el inline (reproduce la pantalla al dígito). Revertir = un archivo congelado + su golden.
- **10-11 (autoría):** función de rangos y `dAECMCA` no llegaron en la entrega y siguen siendo render-only o inexistentes en los módulos; exigen autoría, no un export.
- **12 (nutracéuticos):** el orden P1/P2/P3 sale de `getDX` (ciencia real) pero sin la tabla de qué producto por posición y perfil.
