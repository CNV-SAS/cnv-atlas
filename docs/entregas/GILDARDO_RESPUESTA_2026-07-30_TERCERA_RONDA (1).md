# Respuesta de la Dirección Científica, tercera ronda

**De:** Gildardo de Jesús Uribe Gil. Nutricionista-Dietista, MSc, PhD.
Dirección Científica, Connected Nutrition Ventures (CNV).
**Para:** Santiago y equipo Atlas.
**Fecha:** 30 de julio de 2026.
**Documento previo:** GILDARDO_RESPUESTA_2026-07-30_SEGUNDA_RONDA.md (puntos 4.1 a 4.5).

---

## 1. Corrección de terminología: edad bioeléctrica

El sistema ANI BIS-E **no mide edad biológica**. Mide **edad bioeléctrica**. La diferencia
no es de estilo: la edad biológica es un constructo que se define por comparación con la
edad cronológica, y ese no es el objeto de la medición. Lo que el EB-BIS estima es la
edad del sistema derivada de sus propiedades bioeléctricas.

**Decisión:** el indicador se llama **EB-BIS, Edad Bioeléctrica**. La sigla no cambia.
La expresión "edad biológica" no se usa en ningún contenido del sistema: ni en pantalla,
ni en reportes, ni en documentos científicos, ni en material de formación.

**Dónde hay que corregirlo:**

| Lugar | Texto actual | Texto correcto |
|---|---|---|
| Manual de Tratamiento DFI, tabla de indicadores | EB-BIS (Edad Biológica por Espectroscopía) | EB-BIS (Edad Bioeléctrica) |
| Contexto Maestro, Nivel 3 | Edad Biológica Celular (EB-BIS) | Edad Bioeléctrica (EB-BIS) |
| Atlas, pantalla de resultados y reportes al profesional | edad biológica | edad bioeléctrica |
| Skill `anibise-scientific-writing` | Edad Biológica por Espectroscopía | corregido el 30-07-2026 |

Es un cambio de rótulo y de redacción. No toca el cálculo.

---

## 2. P0, presentación del EB-BIS: cerrado

**Decisión: la fórmula se deja tal como está.** No se ajusta, no se atenúa y no se
recorta el valor que produce. Cuando exista la población necesaria para una calibración
propia, se recalibra el modelo y se reemiten los registros.

**Consecuencia que el equipo debe conocer y no corregir por su cuenta:** con la
calibración provisional vigente, un paciente de mayor edad con buen puntaje de estilo de
vida puede recibir un valor de EB-BIS llamativamente bajo. Se muestra tal cual. Ningún
desarrollador introduce topes, suavizados ni redondeos correctivos sobre esa cifra.

**Se mantiene el requisito C2b:** cada registro de EB-BIS queda etiquetado con la versión
de calibración con la que fue emitido, para poder reemitirlo cuando la calibración cambie.

---

## 3. P1, gasto energético basal sobre el peso de referencia: cerrado

**Decisión: fórmula de Mifflin-St Jeor, aplicada sobre el peso de referencia del módulo
antropométrico**, el que el profesional registra manualmente.

Razón: Cunningham requiere masa magra medida, y a peso de referencia esa masa no existe
como dato medido. Mifflin-St Jeor opera sobre peso, talla, edad y sexo, que sí están
disponibles en el escenario proyectado.

Esto no modifica el cálculo sobre peso medido, donde el motor sigue usando Cunningham
cuando hay masa libre de grasa disponible. Son dos escenarios distintos y conviven.

---

## 4. Columna Δ, definición única para todo el sistema

Existían tres definiciones en circulación: la distancia al borde más cercano del rango
(descripción escrita), el borde clínicamente relevante según el indicador (lo que hace el
archivo HTML) y la diferencia contra la referencia de normalidad. Tener tres produce
cifras distintas en la misma pantalla.

**Decisión: una sola definición, para todas las fórmulas y todos los indicadores.**

> **Δ = valor obtenido − referencia de normalidad.**
> Cuando la referencia es un rango con dos bordes, la referencia es el **promedio del rango**.
> Cuando la referencia es un corte único, sin segundo borde, la referencia es **el corte**.

Ejemplo del segundo caso: el IFC es óptimo si es mayor o igual a 5,0 y el FFMI tiene
mínimo sin máximo. En esos indicadores no hay dos bordes que promediar, de modo que la
referencia es el punto de corte y Δ se calcula contra él.

**Nota para el equipo:** esta regla sustituye el comportamiento del archivo HTML. Es una
divergencia deliberada y debe quedar documentada como tal, no corregida hacia el archivo.
Cambia números en pantalla respecto de la versión anterior; en particular, un paciente
dentro de rango pero por debajo del promedio pasa a mostrar Δ negativo donde antes
mostraba cero. Conviene una prueba de regresión sobre el caso de referencia antes de
publicar.

---

## 5. Profesión habilitada para aprobar el protocolo nutricional

**El protocolo nutricional lo aprueba el nutricionista.** Esto no es una definición nueva:
está en la lógica del sistema desde el inicio. El tipo de profesional queda determinado
en el momento en que el paciente escoge quién lo va a atender, y el módulo nutricional
solo se presenta a los profesionales de nutrición.

Los roles administrativos son operativos y no ejecutan actos clínicos.

---

## 6. Punto abierto que genera esta misma corrección

El **IAE, Índice de Aceleración del Envejecimiento**, está definido hoy como
`IAE = EB-BIS − edad cronológica`. Esa resta es precisamente la comparación contra la
edad cronológica que la corrección del punto 1 retira del marco conceptual.

No se toca hasta que la Dirección Científica se pronuncie. Las dos salidas posibles son:
mantener el IAE tal cual y entender que la corrección afecta solo la nomenclatura del
EB-BIS, o redefinir el IAE. Mientras tanto el indicador queda como está y no se
renombra.

---

## 7. Estado de los pendientes de la Dirección Científica

| Ítem | Qué es | Estado |
|---|---|---|
| Archivo HTML vigente | Entrega del archivo con los cambios ya aplicados | **Bloqueo activo.** Sin él no se pueden aplicar los cambios C1 a C13 |
| IAE | Definición frente a la corrección de terminología | Abierto, sin fecha |
| P2 | Tabla de nutracéuticos por ruta | Autoría, sin fecha |
| P3 | Secciones 4, 5 y 6 del Manual de Tratamiento DFI | Autoría, sin fecha |
| P0 | Presentación del EB-BIS | **Cerrado** en este documento |
| P1 | Fórmula de gasto basal sobre peso de referencia | **Cerrado** en este documento |
| Δ | Definición de la columna de diferencia | **Cerrado** en este documento |
| Profesión que aprueba el protocolo | Regla de autorización | **Cerrado** en este documento |

---

## 8. Resumen operativo para el equipo

1. Reemplazar "edad biológica" por "edad bioeléctrica" en Atlas, en el Manual de
   Tratamiento DFI y en el Contexto Maestro. La sigla EB-BIS se mantiene.
2. No modificar la fórmula del EB-BIS ni acotar sus valores. Mantener el etiquetado por
   versión de calibración.
3. Implementar Mifflin-St Jeor sobre el peso de referencia del módulo antropométrico.
   Cunningham sigue vigente sobre peso medido.
4. Unificar la columna Δ contra el promedio del rango, y contra el corte cuando el rango
   tiene un solo borde. Documentar la divergencia respecto del archivo HTML y correr la
   regresión.
5. No abrir tarea sobre el IAE hasta que la Dirección Científica se pronuncie.
