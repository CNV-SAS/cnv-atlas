# Las consultas sin medición: qué se cierra, cómo, y qué hay que preguntar

**Connected Nutrition Ventures · Atlas · 6 de noviembre de 2026**
**Medido en producción, solo lectura:** `scripts/CERRAR_LAS_CONSULTAS_SIN_BIS_2026-11-06.mjs`
**Antes:** `scripts/PROFESIONALES_SIN_BIS_2026-11-05.mjs` (el conteo por profesional)

673 consultas vivas, **194 sin medición**. Este documento no vuelve a contarlas: dice qué se puede cerrar,
con qué mecanismo, y las tres cosas que no puede decidir un dato.

**Y corrige tres cifras del reporte del 5 de noviembre**, que están señaladas donde aparecen: los 53
borradores de Gildardo no están marcados como prueba (ninguno lo está), Valentina tuvo once intentos
fallidos y no dos, y de los 61 "archivos equivocados" solo 20 lo eran de verdad.

---

## 1 · Gildardo: ninguna de sus 72 está marcada como de prueba

Él preguntó cuáles de sus borradores están marcadas como prueba y cuáles no. **La respuesta es que
ninguna**, y hay que decirlo así porque cambia lo que hay que preguntarle.

| | |
|---|---|
| Consultas vivas sin medición, suyas | **72** |
| De pacientes marcados `is_test` | **0** |
| De pacientes que cuentan como de prueba por derivación | **0** |
| De pacientes confirmados como reales | **0** |
| **Sin ninguna marca (ni prueba ni real)** | **72**, de **63 pacientes distintos** |
| Importadas del HTML en un lote | **0**. Las 72 nacieron en Atlas |
| Con encuesta respondida | **58 de 72** |
| Con diagnóstico emitido | **0** |

Por estado: 53 en borrador (46 iniciales y 7 seguimientos), 13 esperando encuesta, 6 en curso. Van del 14
de agosto al **5 de noviembre**, o sea que el caso está vivo, no es un residuo de agosto.

**Lo que esto significa, y es distinto de lo que yo reporté el 5 de noviembre.** Dije que 53 eran "draft:
importadas y de prueba". Las dos mitades estaban mal: ninguna se importó y ninguna está marcada. Para
Atlas, para las cifras de /obbia y para la cohorte de investigación, **esos 63 pacientes son pacientes
reales**, porque el perfil de Gildardo no es de prueba y la marca derivada sólo mira eso.

**Lo que hay que preguntarle, y es una sola pregunta:** de esos 63 pacientes, cuáles son pruebas suyas.
No se puede deducir del dato: una consulta en borrador con la encuesta respondida se ve igual si el
paciente es real y falta la medición, o si él estaba probando el flujo del QR.

**Y cómo se marcan las que sean pruebas, sin SQL.** La marca vive en el **paciente**, no en la consulta
(`patients.is_test`, con `cuenta_como_de_prueba` derivada por trigger y `es_real_confirmado` como su
opuesto, migraciones 0202 y 0203). Al marcar el paciente, sus consultas salen solas de la vista de
investigación y de las cifras. Son 63 pacientes, no 72 actos: el trabajo es menor de lo que parece.

---

## 2 · María Camila: las 26 se pueden cerrar hoy, y el mecanismo ya existe

Las 26 no son tomas que falten: la actividad se mostró sólo en el Biody Manager y nunca se subió. Verificado
lo que hacía falta para poder cerrarlas:

| | |
|---|---|
| Sin medición | **26**, de 26 pacientes distintos |
| Con diagnóstico emitido | **0** ← la única condición que lo impediría |
| Con encuesta respondida | **26 de 26** |
| Estados | 19 en curso, 7 en borrador |
| Intentos fallidos de importar | **0**. No hubo nada técnico de por medio |
| Fechas | del 10 de septiembre al 13 de octubre |
| Procedencia | 25 nacidas en Atlas, 1 importada del HTML |

**El mecanismo es `retirarEvaluacion` (migración 0212), y cumple las cuatro condiciones que se pidieron:**

1. **No borra nada.** Escribe `retirada_at`, `retirada_motivo` y `retirada_por`. El consentimiento firmado y
   la encuesta respondida se conservan: son actos reales de una persona.
2. **Exige el motivo**, mínimo cinco caracteres, con una frase que lo explica en vez del error de una
   restricción de la base.
3. **Deja auditoría**, `evaluation.retirada` con el motivo en el payload, inline en la transacción.
4. **Sale de las cifras y de investigación.** La vista `evaluaciones_para_investigacion` (0234) filtra
   `retirada_at IS NULL`, y los paneles de pendientes también.

**Sin SQL y sin nosotros:** el botón está en la historia clínica del paciente, en la fila de cada consulta,
y la policy lo permite al profesional dueño (`canRetirarConsulta`). María Camila puede cerrarlas ella misma,
escribiendo el motivo. Y es **reversible** (`deshacerRetiro`), con el traspaso de "quién es la inicial"
simétrico en las dos direcciones.

### Lo único que no encaja, y necesita tu palabra

**El botón dice "Esta consulta no ocurrió", y en estos 26 casos la consulta SÍ ocurrió.** El paciente vino,
firmó y respondió la encuesta completa: las 26 tienen respuestas. Lo que no ocurrió fue la subida de la
medición.

El motivo es texto libre, así que lo que queda escrito en la historia puede ser verdad ("la medición quedó
solo en el Biody Manager y no se subió"). Pero el rótulo del botón afirma otra cosa, y es un rótulo sobre un
acto clínico: 26 consultas reales quedarían archivadas bajo una frase que dice que no pasaron.

**Las tres salidas, y mi recomendación:**

| | Qué | Qué cuesta |
|---|---|---|
| **A** | Usarlo como está, con el motivo verdadero escrito | Cero. Pero el rótulo sigue afirmando algo falso |
| **B** *(recomendada)* | Cambiar el rótulo a uno que cubra los dos casos ("Esta consulta no debe contar"), y que el motivo diga cuál es | Una línea de copy y su candado. El mecanismo no cambia |
| **C** | Un estado nuevo, "atendida sin medición" | Migración, writer, pantalla y su sitio en las cifras. Para 26 casos |

**No lo cambié**, porque un rótulo que afirma algo sobre una consulta es contenido, no forma, y el pedido
era proponer. Si dices B, es una línea.

---

## 3 · Valentina: once intentos fallidos, y una sola consulta sigue bloqueada

El 5 de noviembre reporté "2 con fallo real de importación". **El número correcto es once intentos, sobre
cinco consultas**, y lo que importa es que **diez se resolvieron reintentando**:

| Fecha | Consulta | Qué falló | ¿Terminó con medición? |
|---|---|---|---|
| 11-sep (×5) | `45a539f0`, `8cf2d81d` | Faltaban cintura y cadera | **Sí** |
| 14-sep | `45a539f0` | El archivo traía 3 mediciones | **Sí** |
| 21-sep | `52c5d152` | El archivo traía 2 mediciones | **Sí** |
| 26-sep | `37bfe092` | Faltaban Rinf, FM, FFM y FFMI | **Sí** |
| 27-oct | `59dddf87` | Faltaban cintura y cadera | **Sí** |
| **19-oct (×2)** | **`a43d2deb`** | **Ángulo de fase de 0,6°, fuera del rango `[1, 30]`** | **No** |

**Esa es la única que sigue abierta por un fallo**, y es nuestro cinturón de rangos. Y hay una segunda del
mismo tipo, de Angela: una capacitancia de membrana de **−1.000.000.000 nF** el 8 de octubre, que también
quedó sin medición.

**Sobre el 0,6°, y corrijo mi lectura del 5 de noviembre:** lo conté como un freno injusto y no lo es. Un
ángulo de fase de 0,6° a 50 kHz no es una medición plausible: es casi con seguridad una toma mala, un
electrodo mal puesto o un contacto perdido, y **el freno acertó**. Lo que sigue en pie es otra cosa, y es la
pregunta 2: que el rango `[1, 30]` se eligió a ojo al portar el motor y **no tiene fuente**, así que no
sabemos si frena lo imposible o también lo improbable. El caso del 19 de octubre entra en esa pregunta
como argumento para **revisar en vez de rechazar** (que el profesional vea el valor, confirme y decida),
no como prueba de que el rango esté mal.

**Qué decirle a Valentina:** nada que ella hizo mal. Diez de sus once fallos los resolvió sola. El del 19
de octubre hay que mirarlo con ella: si en el Biody el ángulo de fase era 0,6°, la toma hay que repetirla.

---

## 4 · Los 82 intentos fallidos, por causa, y la corrección del "archivo equivocado"

El 5 de noviembre dije "61 son el archivo equivocado". **Son 20.** Los otros 41 son algo distinto y con
otro remedio: la medición llegó incompleta porque faltaban datos que el profesional escribe en el Biody
Manager antes de medir.

| Causa | Intentos | Vigente | Terminaron con medición |
|---|---|---|---|
| **Faltan datos obligatorios** (casi todos cintura y cadera) | **41** | **Sí, hasta el 3 de noviembre** | 29 de 41 |
| El archivo no trae hoja con mediciones | 12 | No desde el 25-sep | 12 de 12 |
| Es el export de "Exportar datos del paciente" | 8 | **Sí, hasta el 30 de octubre** | **8 de 8** |
| El archivo trae varias mediciones (3 o 2) | 9 | **No: la causa se eliminó el 6-oct** | 8 de 9 |
| El archivo no se pudo leer / no trae filas | 4 | No desde el 25-sep | 3 de 4 |
| Un valor fuera de rango (nuestro cinturón) | 6 | Sí | 4 de 6 |
| La fecha de medición falta o es inválida | 2 | No desde el 3-nov | 2 de 2 |

**La fila que más dice es la tercera.** El export de "datos del paciente" se intentó ocho veces y **las
ocho acabaron con medición**: su mensaje de error es el único que nombraba el export correcto y los pasos
para sacarlo. Las causas cuyo mensaje sólo decía qué estaba mal dejaron consultas abiertas.

### Lo que se cambió hoy

Los otros cuatro mensajes del parser ahora nombran el programa y la acción, igual que ese:

| Antes | Ahora dice, además |
|---|---|
| "El archivo no se pudo leer como un XLSX válido." | Que si lo guardó como CSV o lo abrió y lo volvió a guardar, hay que exportar de nuevo con "Exportar medidas" |
| "El archivo no contiene filas de datos." | Que el export salió vacío y hay que seleccionar la medición antes de exportar |
| "El archivo no tiene fila de encabezados." | Que hay que exportar de nuevo sin editar el archivo |
| "El archivo no trae una hoja con mediciones" | Los pasos concretos en el Biody Manager |

Con su candado: `src/tests/el-error-de-importacion-dice-que-hacer.test.ts` recorre los cuatro rechazos del
parser y exige que cada mensaje nombre "Biody Manager" y "Exportar medidas", y que ninguno le pida al
profesional saber cómo se llama una hoja de un archivo que no abrió.

**Y la guía de una página:** `docs/GUIA_PROFESIONALES_SUBIR_BIS.md`. Está ordenada por lo que más falla, no
por el orden del programa: primero la cintura y la cadera (41 de 82), después cuál export marcar (20),
después que varias mediciones ya están bien (9), después los valores fuera de rango (6), y al final qué
hacer con una medición que quedó en el Biody. Lista para que la mandes.

---

## 5 · Lo que no decide un dato, y espera tu palabra

1. **De los 63 pacientes de Gildardo sin marca, cuáles son pruebas suyas.** Hay que preguntárselo: el dato
   no lo dice. Al marcar el paciente, sus consultas salen de las cifras y de investigación.
2. **El rótulo del botón de retirar** (la salida B de la sección 2), para que María Camila pueda cerrar
   sus 26 sin que quede escrito que no ocurrieron.
3. **El rango del ángulo de fase**, que es la pregunta 2 de `PENDIENTES_CIENTIFICOS.md` y la contesta
   Gildardo. El caso del 19 de octubre entra ahí como argumento para revisar en vez de rechazar.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
