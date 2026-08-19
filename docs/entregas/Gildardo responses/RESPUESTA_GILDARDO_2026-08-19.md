# Respuesta al reporte de re-sincronización del 2026-08-19

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 19 de agosto de 2026

Recibido y aprobado el re-port. Respondo la pregunta del SMM/W, cierro los tres residuos que
encontraron en mi archivo —va otra vez el `ATLAS_v8.html`— y les mando la spec del DFI, que sí existe.

---

## 1. El gate del fenotipo · 22, y tenían razón en preguntar

**Tienen razón y yo me equivoqué.** En mi §3 del 18 escribí que el 24 «no salía de ningún clasificador».
De un clasificador no sale, pero de `motorDiagnostico` sí: la línea del gate decía
`(sexoM ? smmW < 27 : smmW < 24)`. Ustedes lo encontraron, no lo tocaron por fidelidad a mi archivo, y
preguntaron. Es exactamente el procedimiento correcto.

**El gate va a 22.** El argumento está en la propia línea, y por eso no necesito consultarlo con nadie:
**el umbral masculino de ese mismo gate es 27, que es el de `cSMM` clavado.** Si el 24 femenino viniera
de ASPEN/ESPEN —como sugiere el rótulo de «sarcopenia ASPEN/ESPEN» dos líneas más abajo— tendría que
diferir en los dos sexos, no solo en mujeres. Un criterio distinto no coincide con el nuestro en hombres
y se aparta solo en mujeres. Era un resto, no una decisión.

Es el mismo caso que `cMMEM` con 5,7: el mismo hecho clínico clasificado con dos varas. Una mujer con
SMM/W de 23 salía «Normal» por `cSMM` y «sarcopénica» por el fenotipo, en la misma pantalla.

**Corregido en el archivo que va adjunto**, con el porqué en el comentario. El rótulo de ASPEN/ESPEN de
la línea siguiente queda como está por ahora, pero anótenlo: si el criterio que aplicamos es EWGSOP2 en
todo el sistema, esa atribución habrá que revisarla en su propia ronda.

## 2. El texto de la salvaguarda de TCA · matizo su diagnóstico

Encontraron bien el texto, pero **la conclusión que sacan de él no es correcta, y la diferencia importa.**

Escriben que «esa corrección no ha llegado a tu archivo». Sí llegó. `motorTratNutri` tiene la corrección
del 9-ago completa: `pausadoTCA` se conserva en `false`, el déficit sigue partiendo del peso meta
acordado y lo único que hace el sistema es levantar la alerta y marcar remisión. **Nuestros motores ya
coincidían; no había divergencia de comportamiento.**

Lo que quedó viejo es **solo la frase** de `motorPsico`, que seguía anunciando que «el módulo nutricional
PAUSA la restricción calórica automática».

**Y eso es peor que un texto desactualizado.** No es que el sistema bloquee: es que le **dice** al
profesional que bloquea cuando no bloquea. Un clínico que lea esa frase va a creer que el plan está
frenado y va a actuar en consecuencia —o va a desconfiar del resto de lo que lee—. Un texto que describe
mal el motor es un defecto de seguridad, no de redacción.

**Corregido.** La frase nueva dice lo que el motor hace: avisa, marca remisión, no pausa, el déficit
sigue partiendo del peso meta y la decisión de restringir es del profesional. Se conserva la advertencia
clínica, que sigue siendo cierta.

Hicieron bien en mantener su versión por mi instrucción escrita en vez de seguir mi archivo. **Cuando el
texto y el motor de mi archivo se contradigan, manda el motor** —es el mismo principio de «manda el
motor» del §3 del 17, aplicado ahora a la prosa— y repórtenmelo, como hicieron.

## 3. La etiqueta del display · cerrada

Cierto también: `H:≥27% / M:≥24%` era residuo de la corrección del 18, donde arreglé la fila del Nivel IV
y se me pasó esta otra. **Corregida a 22.** Ya no queda ningún 24 de SMM/W en el archivo; lo verifiqué
buscándolos todos.

Los tres residuos son de la misma familia y conviene que quede dicho: **corregí `cSMM` y su fila, pero no
busqué los demás sitios que dependían de ese número.** Para la próxima, cuando yo cambie un umbral,
ustedes búsquenlo entero y repórtenme lo que quede suelto, sin esperar a tropezárselo.

---

## 4. Lo que aprueban sin cambios

- **`cMMEM` dormido: bien hecho.** Cablearlo duplicaría la señal de `cASMI`, que es el que corre. Un
  clasificador correcto y sin cablear es mejor que dos clasificadores compitiendo por lo mismo. Déjenlo
  así y anótenlo en la trazabilidad para que nadie lo «arregle» más adelante.
- **El criterio con que portaron la banda «Alto SS» femenina del FMI queda como norma:** si tiene
  procedencia clara —fecha y motivo— se porta y se registra; si es material, se reporta. No me pregunten
  pieza por pieza lo que ya tiene fecha y firma.
- **Los siete puntos que ya estaban alineados:** bien verificarlos uno por uno en vez de darlos por
  buenos. Es lo que hace que este reporte sirva.
- **La constelación de versiones y la inmutabilidad** de los diagnósticos ya emitidos: correcto. El aviso
  discreto en los seguimientos que cruzan versiones es exactamente la solución.

## 5. La spec del DFI · la tienen desde julio, va adjunta

`ATLAS_DFI_y_Metas_Terapeuticas_por_Profesional`, versión 1.0, del 20 de julio. **Va con este paquete.**

No hacía falta esperar a la etapa de Tratamiento para pedirla. Y sobre su criterio de dejar el DFI en
párrafo y las metas por profesional para cuando construyan Tratamiento: **de acuerdo, es la decisión
correcta.** Traerlas ahora las dejaría computadas sin que nadie las mire, que es la peor de las
situaciones —código vivo sin lector—. Pero tengan la spec ya, para que el diseño de esa etapa se haga
sabiendo a dónde va.

## 6. Su reproducción del §0 · coincide, con un detalle

Coincide en lo que sostiene la conclusión, y con eso me basta para escribir sobre la AEC. Gracias por
hacerla independiente y en otro lenguaje: eso vale más que si hubieran corrido mi mismo script.

**Un detalle antes de que alguno de los dos cite cifras absolutas.** Sus medianas del contraste por edad
dan 42,65 % y 40,55 %; las mías, 42,79 % y 40,69 %. **Las dos desplazadas exactamente 0,14 puntos.** Un
desplazamiento idéntico en ambos grupos no es ruido: es un filtrado ligeramente distinto —algún criterio
de exclusión que uno aplica y el otro no—.

No cambia nada: la diferencia entre grupos, que es lo que prueba el punto, sale idéntica (2,10 en los dos
cálculos) y los 97 casos de menores de 35 coinciden exactos. Pero **la diferencia es publicable y las
medianas absolutas todavía no.** Cuando tengan un rato, encuentren de dónde salen esos 0,14 y me lo
dicen; hasta entonces, en cualquier documento que salga de aquí van la diferencia y el n, no las medianas
sueltas.

---

## Resumen

| Punto | Decisión |
|---|---|
| §1 | Gate del fenotipo a **22**. Tenían razón: el 24 sí se usaba y mi §3 lo negó. El umbral masculino del propio gate (27 = `cSMM`) prueba que era un resto |
| §2 | Texto de TCA **corregido**. Pero el motor ya estaba bien desde el 9-ago: solo mentía la frase. Regla nueva: **cuando el texto y el motor se contradigan, manda el motor** |
| §3 | Etiqueta del display a **22**. No queda ningún 24 de SMM/W |
| §4 | `cMMEM` dormido, criterio de porte y versionado: **aprobados sin cambios** |
| §5 | **Va la spec del DFI v1.0.** De acuerdo con dejar su implementación para la etapa de Tratamiento |
| §6 | Reproducción **válida**. Publicable la diferencia (2,10) y el n; las medianas absolutas no, hasta explicar el desfase de 0,14 |

**Adjuntos:** `ATLAS_v8.html` (19-ago) · `ATLAS_DFI_y_Metas_Terapeuticas_por_Profesional.txt` (v1.0)

**Lo que espero de vuelta:** nada urgente. Sigan con Tratamiento; el origen del 0,14 cuando puedan.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
