# Respuesta a la ronda del 2026-08-14

**De:** Gildardo Uribe — Dirección Científica CNV
**Para:** Equipo Atlas
**Fecha:** 15 de agosto de 2026

Respondo las cinco. Empiezo por un fallo mío, porque es la causa del punto 5 y ustedes lo detectaron sin saberlo.

---

## 0. La divergencia del punto 5 era un defecto de mi archivo

Ustedes reportan dos discrepancias de valor —la FFW y, por ella, el IEHH— y suponen que hay dos criterios de derivación en discusión. **No los hay. El criterio es uno y es el suyo; mi archivo lo estaba incumpliendo.**

Mi `derivarFaltantes`, el bloque verificado sobre los 5.073 registros, contiene desde el principio:

```js
poner('FFW',    ACT - 0.15   * FM, 'FFW = ACT − 0,15 × FM');
poner('ECW_sg', AEC - 0.1125 * FM, 'AEC_sg = AEC − 0,1125 × FM');
poner('ICW_sg', AIC - 0.0375 * FM, 'AIC_sg = AIC − 0,0375 × FM');
poner('MCA',    1.0162 * AIC + MPM, 'MCA = 1,0162 × AIC + MPM');
```

Son **exactamente** las que ustedes aplican.

**El defecto:** en agosto añadí al import otra derivación de la FFW —`FFW = MLG × hidratación`— y un reparto proporcional para las aguas sin grasa. Quedaron en la línea 6547, y `derivarFaltantes` se invoca en la 6746. Como `poner` solo rellena lo que está vacío, **mis fórmulas se adelantaban y las canónicas no llegaban a aplicarse nunca.**

Esa es toda la diferencia entre su 41,95 y mi 44,8. Ustedes tenían el valor correcto; mi archivo, no.

**Corregido el 15-ago-2026.** Retiré las tres derivaciones que se adelantaban y moví los porcentajes sin grasa a después de la llamada, que es donde sus litros ya existen. Comprobado sobre un caso: `AEC_sg + AIC_sg = FFW` exacto, que es la prueba de coherencia interna.

La regla, para que no vuelva a pasar: **donde `derivarFaltantes` tenga fórmula, manda esa. Ninguna aproximación debe adelantarse a una fórmula del modelo.**

---

## 1. El veto conductual · es un AVISO

Se le muestra al profesional la instrucción completa —las dos cadenas que ya portaron— y la ruta conductual queda como prioritaria. **El sistema no bloquea.** No construyan la barrera dura.

Es la misma regla que gobierna todo lo demás y que ya enunciamos para el texto libre de diagnósticos: **el motor propone, el profesional dispone.** Un candado le quitaría al clínico una decisión que es suya, y hay casos legítimos en que una restricción moderada acompañada de abordaje psicológico es lo indicado.

Que hayan portado las cadenas exactas está bien y era necesario: tienen razón en que un badge que dice "Veto activo" sin decir qué significa no orienta a nadie.

---

## 2. El riesgo integrado · esta ya está cerrada, dos veces

No hace falta decidir nada aquí, y quiero señalarlo para que no siga ocupando cola.

**Primero:** el §6 de mi respuesta del 13 ya la respondió — no se suspende; se calcula con los dominios que se pudieron evaluar, indicando cuáles no entraron. Esa respuesta corrigió expresamente mi §8 del 9 de agosto.

**Y segundo, que es lo que la vuelve irrelevante:** el §1 de esa misma respuesta estableció que **la encuesta incompleta no debe existir**. El profesional no puede atender a ningún paciente sin la encuesta completa y el consentimiento firmado; si falta algo, lo llena con el paciente delante antes de empezar.

Con ese bloqueo no hay escenario en que el riesgo integrado se calcule sobre datos ausentes. La pregunta deja de tener caso.

Lo que sí les pedí en esa misma respuesta y sigue en pie es la guarda en `calcLE8`: que deje de rellenar con ceros en silencio. No para manejar la encuesta parcial —que no debe llegar—, sino porque el cálculo no debería depender de que la interfaz funcione.

---

## 3. Etnia · dos preguntas separadas

**Adopto la recomendación del asesor.** Dos preguntas, ambas opcionales, con las listas que proponen:

- **Pertenencia étnica (DANE):** Indígena · Gitano o Rrom · Raizal · Palenquero · Negro, mulato, afrodescendiente o afrocolombiano · Ninguno de los anteriores · Prefiero no responder.
- **Ascendencia:** Predominantemente indígena · Predominantemente europea · Predominantemente africana · Mezcla de dos o más de las anteriores · No sé · Prefiero no responder, precedida de "Independientemente de lo anterior".

Su análisis es correcto y el diagnóstico del problema también: le estábamos pidiendo a una casilla que respondiera dos preguntas distintas. Por eso "mestizo" no cabía en el DANE, y añadirlo habría roto la exclusividad de las categorías.

### Sobre la advertencia científica

Es pertinente y la recojo. No la descarto: la incorporo como límite de uso.

**La ascendencia autodeclarada entra al observatorio como variable de caracterización y de exploración, nunca como coeficiente de corrección.** Ningún índice del sistema —ni el IFC, ni el IRC, ni el ISCM, ni la edad bioeléctrica— se ajusta por ascendencia. Esa es exactamente la práctica que la nefrología retiró en 2021 con el coeficiente racial de la filtración glomerular, y la que la espirometría está retirando ahora. No vamos a reintroducirla por la puerta de atrás.

Lo que sí permite es **describir** la composición de nuestra cohorte y explorar si hay señal, con la heterogeneidad interna declarada como limitación. Si alguna vez esa señal existiera y quisiéramos publicarla, la objeción del revisor que anticipan es la correcta y habría que responderla con ancestría medida, no autodeclarada.

**Y me interesa su alternativa.** Región de origen o de residencia prolongada, y altitud, capturan mejor lo que importa para composición corporal y no arrastran ese problema. **Añádanlas.** La altitud sobre todo: en Colombia la variación es enorme y tiene efecto fisiológico documentado sobre el hematocrito y el agua corporal, que es justo nuestro terreno.

---

## 4. La opción "Otro" · las nueve, como aprobé

Las **nueve**: d2_21, d3_25, d4_34, d4_35, d5_38, d5_42, d6_43, d6_44 y d8_59. Las dos que ya encontraron implementadas —d4_35 y d6_43— no son un subconjunto deliberado: son las únicas que alcancé a poner en el prototipo. La aprobación del 13 cubría las nueve.

### En d5_38 y d6_44, que alimentan el motor

**El mismo criterio que d5_39: el texto libre alimenta el motor, y todo lo que resulte lo puede cambiar el profesional.**

Una sola regla para todo el instrumento, sin excepciones por pregunta. El reconocimiento por coincidencia de texto es frágil —ya les advertí que "sin enfermedad renal" contiene la palabra renal— pero el remedio no es bloquear la entrada: es que nada de lo que produce el motor quede congelado.

---

## 5. La MCA y la FFW · derívenlas, es lo que dice mi propio archivo

**Sí: la MCA debe derivarse cuando el equipo no la trae, y entrar al ISCM. Están haciendo lo correcto.**

No es una decisión nueva, es lo que mi archivo ya prescribe en dos sitios independientes:

1. `derivarFaltantes` incluye `MCA = 1,0162 × AIC + MPM`.
2. `computeISCM` ya trae el respaldo: si no hay `MCA_dif` del export, usa `MCA − MCA_ref`.

Que mi HTML mostrara "—" no era criterio, era el efecto de que el export corto no trae la columna del desvío y de que hasta hace poco tampoco existía `MCA_ref`.

**La FFW: manda `ACT − 0,15 × FM`**, la suya. Ver §0: la divergencia era un defecto mío, ya corregido.

### Una precisión sobre el ISCM que conviene dejar por escrito

Al derivar `MCA_dif = MCA − MCA_ref`, ese término pasa a depender de **nuestra** referencia poblacional —52,4 % de la masa libre de grasa, la que fijamos el 12 de agosto— y no del valor teórico que calcula el equipo. Son dos referencias distintas y pueden no coincidir.

No es un problema, pero sí algo que hay que documentar: el ISCM de un paciente medido con export completo y el de uno con export corto **no usan la misma referencia de masa celular**. Anótenlo en la trazabilidad del índice.

Tienen razón además en que aquí los dos valores clasifican igual y el profesional ve lo mismo, pero en un paciente con déficit celular el término sí podría mover la clase. Por eso importa que quede escrito.

---

## Confirmación

**El radar:** correcto, lo dan bien por resuelto. Mide lo mismo que la severidad por dominio, y en el archivo del 13 ya quedó con los cuatro niveles y sin la banda "Excepcional", que era inalcanzable.

---

## Resumen

| Punto | Decisión |
|---|---|
| §0 | La divergencia de la FFW era un defecto mío. **Corregido**: las canónicas vuelven a aplicarse |
| §1 | Veto conductual: **aviso**, no candado |
| §2 | Riesgo integrado: **ya cerrada**, y sin caso por el bloqueo de encuesta incompleta |
| §3 | Etnia: **dos preguntas separadas**. Nunca como coeficiente de corrección. Añadir región y altitud |
| §4 | "Otro" en las **nueve**; en d5_38 y d6_44 alimenta el motor y es editable |
| §5 | **Derivar la MCA y meterla al ISCM.** La FFW manda la canónica. Documentar la referencia del ISCM |

© Connected Nutrition Ventures SAS, 2026. Documento interno.
