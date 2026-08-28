# Respuesta a la ronda del 2026-08-26

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 27 de agosto de 2026

Antes de las respuestas van dos reglas. De ellas dependen la mitad de las preguntas de esta ronda, y
varias de las que iban a venir.

---

## 0. Qué es este software, y qué no es

**Esto no es un software clínico para médicos. Es un software para aplicar el modelo ANI BIS-E.**

Es una ayuda para el profesional, y su objetivo es la aplicación del modelo. No es un sistema de soporte
a la decisión clínica, ni un verificador de seguridad alimentaria, ni un tamizador de patologías. Cuando
una propuesta lleve a construir contenido clínico que el modelo no necesita, la respuesta es que no.

**No se compliquen la vida.**

### Y la regla que sale de ahí: el software representa el archivo, literalmente

**No puede tener más, no puede tener menos.** No se añaden datos que el archivo no captura, ni secuencias
distintas de las que el archivo tiene, ni instrumentos que el archivo no incluye. **Ni ustedes ni la
herramienta con la que yo trabajo pueden atribuirse cambios en ningún elemento del software clínico**: la
encuesta, y los módulos de antropometría, diagnóstico con sus submódulos, rutas de tratamiento y
reporte/HC.

El archivo está hecho de la manera en que se requiere para desarrollar el modelo. Si algo parece
faltarle, la pregunta correcta no es «¿lo construimos?», es «¿por qué no está?», y me la hacen a mí.

**Déjenlo tal cual lo hice.**

---

## 1. La clave de Groq · escanearon un archivo viejo, y el problema es mayor

**El archivo que se reparte no tiene ninguna clave.** `ATLAS_v8.html` da cero. La línea 11858 que citan
pertenece a **`ATLAS_v7_backup_20260714_biaQC.html`**, un respaldo del 14 de julio. Escanearon una copia
antigua, no la entrega.

**Pero tienen razón en el fondo, y es peor de lo que reportan.** Lo verifiqué: la misma clave está en
**168 archivos** de mi carpeta de trabajo y, lo que importa de verdad, **también en
`ATLAS_paciente.html`**, que es la app del paciente y esa sí se distribuye.

Así que la rotación hace falta. Va por mi cuenta, con lo de los 168 archivos.

Gracias por el barrido. Háganlo siempre a lo que entre, y cuando encuentren algo **díganme de qué
archivo exacto**: es lo que permite saber si es la entrega o un respaldo.

## 2. El piso calórico · corregido, y el error era mío

**Tienen toda la razón, y encontraron exactamente lo que les pedí que buscaran.** Al pasar el déficit a
cero no miré de qué colgaba el piso, y lo dejé sin activarse nunca. Es la misma clase de suma que les
encargué vigilar en el 1.2, cometida por mí en el paso siguiente.

Reproduje su caso: mujer de 60 años, 150 cm, 60 kg, sedentaria. GET sobre peso meta 1.172 kcal, piso
1.200. Y la paradoja que señalan: con déficit 300 el objetivo **subía** a 1.200.

**Ya está corregido en el archivo adjunto:**

```js
if(!hasCancer && !desnutricion){ var piso = sexoM?1500:1200; kcalObjetivo = Math.max(piso, kcalObjetivo); }
```

**Con una salvedad que hay que respetar al portarlo: la rama de cáncer y desnutrición queda FUERA del
piso, a propósito.** Su fórmula es 27,5 kcal × peso actual y su nota indica iniciar a 10-15 kcal/kg si hay
riesgo de realimentación. Un piso de 1.200-1.500 empujaría a ese paciente por encima de lo que ese
protocolo permite.

## 3. El DFI clavado en 30 y 20 · enciendan el mapeo

**Enciendan `LE8_MAPEO_CORREGIDO`.** El defecto es real, está documentado en mi propio archivo desde el
28 de julio, y el campo correcto es `d1_9_i`, no `d1_9`.

**Sobre lo ya evaluado: recalcular, y que quede anotado en la historia que el DFI cambió de versión.**
Recalcular en silencio borra el rastro; no recalcular deja en pie diagnósticos que sabemos mal.

## 4. El 3.1 rehecho y la numeración · recibidos

La columna que faltaba era la suya: **si el dato llega**. Cero de veinticinco. Que el patrón alimentario
y las alergias sean la misma pieza y no dos tareas es la mejor noticia de la ronda.

Sobre la numeración: **manda el código, nunca la posición.** Gracias por verificar hacia atrás las doce
citas antes de contármelo. Anotado lo de las dos preguntas con `num: 56`.

---

## 5. La proteína · es una recomendación, y decide el profesional

Esta me la han preguntado varias veces, así que la dejo cerrada:

**El software propone y quien decide la cantidad es el profesional. No existe techo y no existe piso.
Existe una recomendación, y punto.**

El 1,5 es lo que el motor recomienda. Si el profesional prescribe 1,2 o 2,0, prescribe 1,2 o 2,0. No hay
nada que validar, ni que limitar, ni que advertir.

Es la regla de siempre —el motor propone, el profesional dispone— aplicada a un número más. **No me la
vuelvan a preguntar indicador por indicador**: vale para toda la prescripción nutricional.

## 6. Los 0,1 nF · son de la capacitancia

Me preguntaron por la capacitancia y contesté de la capacitancia. **No toca a los demás indicadores.**

## 7. La apnea · no se construye, y el error viene de mi lado

**No la construyan. Retiren la tarea.**

**El tamizaje de apnea no está en el cuestionario, y no está porque yo no lo puse.** No hay instrumento
que darles porque nunca hubo instrumento.

**Y lo digo entero: esa propuesta salió de mi lado, no del suyo.** Apareció en un análisis que se me
entregó de lo que «debería aparecer en el diagnóstico de cada profesional», la aprobé en bloque sin
mirar que estaba inventando un instrumento clínico que el archivo no tiene, y ustedes quedaron
pidiéndome puntos de corte de algo que no existe. Por eso el punto 0 está escrito como está.

**Lo mismo aplica al resto de aquella lista.** Antes de construir cualquier contenido diagnóstico por
profesión, verifiquen que **el dato ya esté en la encuesta y el criterio ya esté en el archivo**. Lo que
no cumpla las dos cosas, me lo devuelven.

## 8. Las carnes rojas · el orden es deliberado y es clínico

**Está en la encuesta, no en la lista de intercambio.** Y no es un descuido.

`FREQ_GROUPS` **no está ordenado por número de pregunta porque está ordenado por categoría clínica**:

| Posición | Categoría |
|---|---|
| 1 a 7 | **Protector** — verduras, frutas, leguminosas, pescado, grasas saludables, lácteos, huevos |
| 8 a 11 | **Neutro** — cereales integrales, raíces y tubérculos, carnes blancas, **carnes rojas** |
| 12 a 15 | **Riesgo** — harinas refinadas, embutidos, azúcares, ultraprocesados |

Las carnes rojas llevan `n = 15` porque ese es **el identificador de su campo** (`d1_15_i`), no su
posición. Están entre los neutros porque **clínicamente son neutras**, y separarlas de los embutidos es
una distinción que importa.

**Su candado hizo lo que debía.** Rotular por posición habría llamado ultraprocesados a las carnes
rojas. Fijo la regla: **nunca rotulen por posición, siempre por `n`.** Y la agrupación que ve el paciente
es esa misma: **el orden es el mensaje.**

## 9. La capacitancia · el artículo dice que subir no es mejorar

**Mejorar es acercarse a la mediana de su grupo, no subir.**

No es criterio mío suelto: está en el artículo de referencia, que es lo nuevo y lo que valida cualquier
cosa que digamos de este parámetro. Los puntos de corte son los de `CAP_REF`, y el propio artículo
muestra por qué el extremo alto no es bondad:

| Lo que discrimina la capacitancia | AUC |
|---|---|
| Masa muscular reducida (ESPEN) | 0,890 |
| Masa celular baja (P10) | 0,747 |
| **Obesidad por IMC (OMS)** | **0,734** |
| **Obesidad por FMI** | **0,696** |

**Discrimina las dos cosas: masa muscular baja por abajo y obesidad por arriba.** Y sube con el IMC —de
1,27 nF con IMC bajo 18,5 a 2,87 con 30 o más—. Un paciente que sube de 2,40 a 4,00 nF puede estar
ganando adiposidad, no integridad de membrana.

**Para la tarjeta de Seguimiento:** se retira el texto «mayor capacitancia = mejor integridad celular,
verde si mejora». Acercarse a la mediana es mejorar; alejarse, en cualquier dirección, no lo es. Por
encima de P95, seguir subiendo es una señal, no una mejoría.

**Y esto vale para todo lo demás: este es un software científico que se alimenta de los datos del propio
sistema.** Los ajustes salen de nuestros resultados y de nuestros artículos, no de lo que parezca
razonable.

---

## 10. Las alergias · déjenlo tal cual está

**Nada de tablas de alérgenos, ni de equivalencias, ni de filtros. Retiren las dos tablas.**

Lo que el sistema tiene que hacer es que **aparezca que el paciente tiene alergias alimentarias**, tal
como la encuesta lo capturó. **El profesional indagará cuáles en la consulta y verá cómo las trata.** Esa
es su función, no la del software.

Ustedes mismos escribieron el motivo por el que las tablas no sirven: *«si marcamos de más, el
nutricionista ve avisos falsos, y a la tercera vez aprende a ignorarlos»*. Un mecanismo que se equivoca
seguido deja de proteger el día que acierta.

**Y por el punto 0: esas tablas son contenido clínico que ustedes redactaron y que mi archivo no tiene.**
Traducir «Mariscos» a camarón, langostino, langosta y calamar es exactamente lo que este software no
debe hacer.

**Se cae con esto todo lo que colgaba de ahí:** el filtro en código, el bloqueo del menú y el mecanismo
de descartar avisos con motivo del 10.4. No hay nada que descartar si no se emite nada.

Lo mismo para el patrón alimentario: se muestra lo que el paciente declaró, y ya. Sin tabla de
exclusiones y sin que nadie decida qué es keto.

### Sobre la validez del dato, para que no quede duda

**Quien declara si tiene alergias es el paciente, respondiendo la encuesta.** Firmó el consentimiento
informado y su identidad se verificó con el código enviado al correo. **Con eso, todas sus respuestas son
válidas para procesarse.** Ese es el sentido del consentimiento y del código: no hace falta que nadie las
revalide después.

Lo único que les pido es que **la pantalla no diga que el menú fue verificado contra las alergias**,
porque no lo será. El plan lo revisa el profesional antes de entregarlo, como cualquier documento que él
firma.

## 11. El alcohol · privilegien la lógica

**El alcohol se toma como referencia en el DFI.** Y en el tratamiento profesional entra en el **resumen
de las condiciones del paciente**.

Su mecanismo —`field_key` de tratamiento y no de diagnóstico, con un candado que prueba efecto cero en
el diagnóstico— resuelve bien la tensión con lo que dije en julio. **Confirmado.**

**Y con eso, la instrucción sobre cómo se compone ese resumen:** son **las alertas de la encuesta, más
las de la composición corporal, más las autodeclaradas**. Un resumen, **no una lista de mercado**. Si el
bloque se convierte en un inventario de todo lo que el paciente marcó, deja de servir para lo que
existe.

## 12. Los cinco defectos de mi archivo · corregidos

Los cinco están en el archivo adjunto:

- **Los `undefined`** no eran un problema de rótulo: la historia clínica leía `.label` y los objetos
  traen `.nombre`. Corregido en fenotipo y en PBI.
- **El motivo de consulta** llegaba como arreglo y se concatenaba sin separador. Ahora va con comas.
- **La fecha de la firma** usa la de la evaluación. Tienen razón en que era el único no cosmético: una
  historia clínica es un documento probatorio.
- **El gráfico de convergencia** lleva `viewBox`.
- **`cAF`** ya no devuelve «Normal» con el color de alerta.

## 13. Los tres que quedaban · resueltos por el punto 0

- **Suplementos y medicación (5.5):** se muestran **literal** al profesional. Pasarlos a opciones
  cerradas cambiaría la encuesta, y la encuesta es la que es.
- **La casilla de porciones (11):** **se queda en el subgrupo**, como está en mi archivo. Con eso
  desaparece el problema del cuadre calórico: no hacen falta alimentos representantes, ni rangos, ni
  tocar la validación de nutrientes. **Retiro mi instrucción del 26** de moverla al grupo.
- **El factor de actividad (12):** manda `motorTratNutri`, **pero el factor sigue siendo una propuesta
  editable del profesional.** No puede pasar de ser un ajuste suyo a un cálculo del sistema: eso
  invierte la regla de que el motor propone y el profesional dispone.

**Con eso queda contestada la ronda completa.**

---

## Resumen

| # | Decisión |
|---|---|
| 0 | **No es un software clínico para médicos: es para aplicar el modelo ANI BIS-E.** Y representa el archivo literalmente. **No se compliquen la vida** |
| 1 | La clave: **escanearon un respaldo del 14 de julio**. La entrega está limpia. Pero está en 168 archivos y en la app del paciente: la roto yo |
| 2 | **Piso corregido**, fuera de la condición del déficit. Cáncer y desnutrición quedan fuera a propósito |
| 3 | **Enciendan el mapeo del LE8.** Lo ya evaluado: **recalcular y anotar el cambio de versión** |
| 4 | 3.1 y numeración: recibidos. **Manda el código, nunca la posición** |
| 5 | **La proteína es una recomendación. No hay techo ni piso. Decide el profesional.** Vale para toda la prescripción |
| 6 | Los **0,1 nF** son de la **capacitancia**, de ningún otro indicador |
| 7 | **Apnea: no se construye.** La propuesta salió de mi lado y la retiro |
| 8 | **Carnes rojas: el orden es deliberado y clínico.** El `n` es el id del campo. El orden es el mensaje |
| 9 | **Mejorar en capacitancia es acercarse a la mediana, no subir.** Retirar el texto de Seguimiento |
| 10 | **Alergias: nada de tablas.** Que aparezca que las tiene; el profesional indaga en consulta. El dato del paciente es **válido y se procesa** |
| 11 | **Alcohol: confirmado.** Referencia en el DFI y resumen de condiciones en tratamiento. **Un resumen, no una lista de mercado** |
| 12 | Los **cinco defectos** de mi archivo, corregidos y adjuntos |
| 13 | Suplementos **literal** · casilla **en el subgrupo** · factor de actividad **editable por el profesional** |

**Va el `ATLAS_v8.html` de hoy**, con el piso corregido y los cinco defectos.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
