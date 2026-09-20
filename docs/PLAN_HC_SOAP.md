# Plan: la historia clínica en formato SOAP, con la encuesta redactada (2026-09-19)

**De dónde sale.** Es la observación (g) de la lista de Gildardo, partida. Santiago pide adelantar **lo que
no depende de él**: la historia clínica en **SOAP**, con las respuestas de la encuesta redactadas de corrido
("paciente de tantos años, con tales antecedentes..."), **sin la parte de alertas**, que espera a que
Gildardo termine de caracterizarlas en semáforo. Se lo pide una integrante, con urgencia.

**Veredicto corto: es viable, y casi todo el dato ya está.** Lo nuevo es la redacción de la encuesta y el
orden SOAP. Hay una decisión que sí hay que tomar antes de escribir código, y va al final.

---

## 1. Qué es SOAP y dónde encaja lo que ya tenemos

SOAP son cuatro apartados: **S**ubjetivo (lo que el paciente refiere), **O**bjetivo (lo que se mide),
**A**nálisis (la interpretación del profesional) y **P**lan (lo que se va a hacer).

La historia clínica de Atlas **ya tiene todas las piezas**; lo que no tiene es esa distribución:

| Apartado | Qué va | De dónde sale hoy | ¿Existe? |
|---|---|---|---|
| **S** · Subjetivo | Motivo de consulta, antecedentes, y **la encuesta redactada** | `motivos`, `antecedentes`, `getSurveyAnswersForEvaluation` | Los dos primeros sí; la redacción **es lo nuevo** |
| **O** · Objetivo | Peso, talla, composición corporal, índices ANI-BIS-E alterados | `composicion`, `indices`, `pesoKg`, `tallaCm` | **Sí, entero** |
| **A** · Análisis | Diagnóstico funcional en párrafo, resumen del profesional, meta terapéutica | `dfiParrafo`, `resumenProfesional`, `metaTerapeutica` | **Sí, entero** |
| **P** · Plan | Prescripción nutricional, rutas, remisiones (exigidas y registradas), observaciones, próxima cita, entregas | `plan`, `rutas`, `remisionesExigidas`, `remisiones`, `observaciones`, `proximaCita`, `entregas` | **Sí, entero** |

**O sea: tres de los cuatro apartados son reordenar lo que ya se lee.** El trabajo de verdad está en la S.

---

## 2. Lo único que hay que construir: la encuesta redactada

Hoy las respuestas se muestran **pregunta por pregunta** (en la pantalla de la encuesta y en el CSV). Lo que
se pide es un párrafo por dominio.

Hay tres formas de hacerlo, y no son intercambiables:

| Forma | Cómo | Coste | Riesgo |
|---|---|---|---|
| **A · Plantilla por pregunta** | Una frase escrita para cada una ("refiere **3** comidas al día") | **Alto**: son ~60 preguntas, y cada plantilla es una decisión de redacción | Bajo, pero es redacción clínica nuestra sobre 60 ítems |
| **B · Párrafo por dominio (recomendada)** | Un párrafo por dominio que enhebra las respuestas: *"En alimentación refiere 3 comidas al día, 2 porciones de fruta, consumo de bebidas azucaradas 1 al día..."* | **Medio-bajo**: una plantilla por dominio (8) más el enhebrado | Bajo: son sus respuestas, en orden, sin interpretar |
| **C · Redactada por IA** | El prompt recibe las respuestas (variables clínicas, sin PII) y devuelve la narrativa | Bajo de código, **alto de gobierno** | Es un prompt clínico nuevo: versionado, y una narrativa de historia clínica escrita por IA es una decisión que no es nuestra |

**Recomiendo la B**, y la razón no es el coste: **es lo único que no nos convierte en autores de contenido
clínico.** La B ordena y enhebra lo que el paciente respondió; la A escribe una frase por ítem (60 decisiones
de redacción) y la C se lo encarga a un modelo. Con la B, cada afirmación del párrafo es trazable a una
respuesta concreta, que es lo que un documento probatorio necesita.

**Y lo que NO lleva, en ninguna de las tres:** ni alertas, ni semáforo, ni cruces entre respuestas. Eso es
exactamente lo que espera a Gildardo, y es la mitad que Santiago apartó.

---

## 3. La decisión que hay que tomar ANTES de escribir código

**¿El SOAP REEMPLAZA la historia clínica actual, o es un documento aparte?**

No es una preferencia de formato: la estructura de la historia clínica **es de Gildardo** (su §8, los catorce
bloques), y reordenarla es cambiar un documento clínico suyo. La Regla 0 dice que el software representa su
archivo, y que cuando algo parece faltar la pregunta es "¿por qué no está?", no "¿lo construimos?".

Las dos salidas:

| | Qué implica | Duplicación | Qué hay que preguntarle a Gildardo |
|---|---|---|---|
| **(a) SOAP como documento APARTE** (recomendada) | Una hoja más, con su botón de imprimir, derivada de **los mismos lectores**. La HC actual no se toca | Sí, a propósito: son dos arreglos del mismo contenido, para dos usos | **Nada, para empezar.** Se le avisa y se le enseña |
| **(b) SOAP REEMPLAZA la HC** | Los catorce bloques se reorganizan en cuatro | Ninguna | **Sí, antes de tocar nada**: es su documento |

**Recomiendo (a)**, y no por prudencia formal: el SOAP y su HC sirven a lectores distintos. Su HC está
ordenada por **origen del dato** (lo que mide el equipo, lo que dice el modelo, lo que decide el profesional),
que es como se audita; el SOAP está ordenado por **acto clínico**, que es como se lee en consulta y como lo
piden las EPS. Cerrar uno para tener el otro es perder información de lectura, no ganar orden.

**Sobre "quitar bloques para no duplicar":** con (a) no hace falta quitar nada, porque son dos documentos
distintos. Si más adelante se decide (b), lo que se retira no son bloques sueltos: es la estructura entera,
y esa conversación es con él.

---

## 4. Qué se construye, en orden

1. **El lector del SOAP** (`hc-soap-reader`): compone los cuatro apartados **llamando a los lectores que ya
   existen**, sin consultar por su cuenta. Es la misma regla que ya siguen el plan del paciente y el informe:
   dos formas de armar el mismo insumo es como se termina con dos verdades.
2. **La redacción de la encuesta** (`encuesta-redactada`, puro): las respuestas de un dominio entran, sale el
   párrafo. Puro y sin BD, así que se prueba con casos escritos a mano (incluidos los feos: sin responder,
   "Otra" con texto, respuesta múltiple).
3. **La hoja imprimible** (`HojaImprimible`, el andamiaje que ya usan el plan, las rutas y el diagnóstico),
   con su encabezado y su registro de entrega (`scope` = `soap`, migración chica sobre el CHECK de 0148).
4. **El PDF**, reusando el documento de la HC (mismos estilos), para poder enviarlo.
5. **Los candados**: que el SOAP salga de los mismos lectores (no de una segunda consulta), que no lleve
   alertas ni semáforo, y que una respuesta sin contestar se diga y no se omita.

**Tamaño: una tanda**, con el párrafo por dominio (forma B) y el SOAP como documento aparte (salida a).
Con la forma A o con la salida (b), es otra conversación y otro tamaño.

---

## 5. Lo que hay que decir de entrada, aunque no lo pregunten

- **La historia clínica no se le manda al paciente por defecto** (criterio de Gildardo). El SOAP hereda eso:
  es documento del profesional, y su entrega pasa por el mismo freno y el mismo registro que la HC.
- **Una consulta sin diagnóstico no tiene A ni P.** El documento saldrá con la S y la O y dirá por qué
  faltan las otras dos, en vez de omitirlas: un apartado ausente sin explicación, en un documento
  probatorio, se lee como que no se evaluó.
- **La encuesta redactada es tan buena como la encuesta respondida.** Si el paciente dejó la mitad sin
  contestar, el párrafo lo dirá; no se rellena con supuestos.

---

# Adiciones al plan (Santiago, 2026-09-20)

## 6. El apartado libre del profesional: sí es lo normal, con una diferencia importante

**Lo que hacen los demás.** En la práctica hay dos cosas distintas, y conviene no mezclarlas:

1. **Texto libre del clínico por apartado**: es el estándar. SOAP nació justamente para dar estructura a una
   nota que antes era narrativa libre, y los sistemas lo implementan como campos discretos (S, O, A, P)
   donde el clínico escribe.
2. **Editar la narrativa autogenerada**: también es lo habitual **cuando la narrativa es una transcripción**.
   Los "AI scribes" generan el SOAP a partir de la conversación y el clínico **revisa y edita antes de
   firmar**; el patrón defendible añade además una sección de *audit trail* que deja constancia de que hubo
   IA, y las correcciones se hacen como **anexos que no alteran el original**, nunca reescribiendo.

**Y aquí está la diferencia que decide el diseño:** nuestra narrativa **no es una transcripción, es un
dato**. Cada frase sale de una respuesta que el paciente marcó. Editarla no sería corregir una
interpretación: sería **cambiar lo que el paciente respondió** en un documento probatorio. Así que la
reserva de Santiago aplica, y con más fuerza de la que él le daba.

**Lo que se construye, entonces:**

- **Texto libre SÍ, en su propio bloque**, debajo de lo generado y con su rótulo: *"Escrito por {profesional}
  el {fecha}"*. Nunca intercalado.
- **Lo generado NO se edita.** Si el profesional no está de acuerdo con lo que dice una respuesta, lo dice en
  su bloque; corregir la respuesta es el flujo de corrección de la encuesta, que versiona.
- **Append-only**, como las observaciones de la consulta: corregirse es escribir otra, y las dos quedan.
  Es lo mismo que ya decidió Gildardo para `treatment_notes` (§8) y coincide con el patrón defendible de
  los anexos.

**Y una cosa que salió al mirarlo: solo hace falta UN campo nuevo, no cuatro.**

| Apartado | Texto del profesional | ¿Existe hoy? |
|---|---|---|
| **S** | Lo que el paciente contó en consulta y no estaba en la encuesta (la anamnesis suya) | **No. Es el único que falta** |
| **O** | No lo necesita: lo objetivo lo produce el equipo | — |
| **A** | El resumen del diagnóstico, que él escribe | **Sí** (`resumenProfesional`) |
| **P** | El objetivo del tratamiento y las observaciones de la consulta | **Sí** (`objetivoTratamiento`, `observaciones`) |

El campo nuevo se guarda con el mismo mecanismo que las observaciones (append-only, con autor y fecha) y
lleva un marcador de apartado, para que el bloque de observaciones de la historia clínica siga mostrando lo
suyo y no se dupliquen.

## 7. Copiar y pegar

Un integrante usa la historia clínica copiándola. El SOAP lo tiene que permitir **igual o mejor**: lleva un
botón **Copiar** que pone el documento entero en el portapapeles **como texto plano**, con sus cuatro
apartados rotulados. Texto plano y no HTML a propósito: lo que se pega va a un correo, a un WhatsApp o a
otro sistema, y ahí el formato estorba más de lo que ayuda.

## 8. Simplificación: el caso "sin A ni P" no ocurre

El plan decía que un documento sin diagnóstico saldría con la S y la O y explicando por qué faltan las otras
dos. **Santiago tiene razón y está verificado:** la pestaña de Reporte/HC no ofrece nada mientras no haya
diagnóstico (muestra el aviso de `EtapaReporte`), y el diagnóstico no se genera con la encuesta incompleta
(gate D-007). El SOAP vive donde vive la historia clínica, así que cuando existe, existen los cuatro
apartados. **Se retira esa rama del plan.**

## 9. En dos pasos, por la migración

1. **Ahora:** el documento SOAP completo con lo que ya hay (los cuatro apartados, la encuesta redactada, el
   botón de copiar y su hoja imprimible).
2. **Cuando Santiago aplique la migración del campo nuevo:** el bloque de texto libre del apartado S.

Se parte así porque leer una columna que todavía no existe rompe la pantalla en producción, y el resto del
documento no depende de ella.
