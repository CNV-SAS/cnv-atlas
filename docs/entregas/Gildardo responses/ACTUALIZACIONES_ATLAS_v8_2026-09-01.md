# Actualizaciones de ATLAS_v8.html

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 1 de septiembre de 2026

---

Este documento describe los cambios del `ATLAS_v8.html` que va con esta entrega. Van agrupados por lo
que corrigen, y los cuatro primeros son defectos que ustedes reportaron o que salieron al revisarlos.

---

## 1. Las variables que el BiodyManager no calcula ya se derivan siempre

**Era el defecto de fondo, y explica de una sola vez lo que veníamos discutiendo en tres puntos
distintos.**

La sección de derivaciones colgaba de una condición: `if (!espectroCompleto(row))`. Es decir, solo se
ejecutaba cuando el export **no** traía Cole-Cole. Con un export espectroscópico —que sí lo trae— la
sección entera se saltaba, y quedaban vacías el agua libre de grasa, el AEC y el AIC sin grasa, la masa
celular activa, la hidratación sin grasa, el AEC/MCA y los ratios.

Son dos cosas distintas: que venga el Cole-Cole no dice nada sobre si vienen las variables de
composición. **El equipo no las calcula en ningún caso.** Verificado sobre un export real del ZMIII: de
sus 91 columnas, ninguna es "sin grasa" y ninguna es de masa celular activa.

**Ahora la derivación corre siempre.** Es seguro: la regla de precedencia no cambia —un valor que venga
en el Excel nunca se sobrescribe—, así que con un export completo no altera nada de lo que ya llegaba.

Con esto se cierran también:

- **Su punto 5 del 29 de agosto**, las siete filas "sin grasa" que salían iguales a su contraparte con
  grasa. No era el mapeo de encabezados: era que la derivación no llegaba a aplicarse.
- **Su punto 4**, el MCA ausente que entraba al ISCM como desviación 0. El MCA se deriva
  (`MCA = 1,0162 × AIC + MPM`) y su referencia sale de la estimación poblacional.

Comprobado contra datos reales: FFW 41,95 · AEC sin grasa 15,30 · AIC sin grasa 26,65 · MCA 38,82 ·
hidratación sin grasa 70,33 · E/I sin grasa 0,574.

## 2. La circunferencia de cintura vuelve a registrarse

El lector de la cintura exigía que el encabezado contuviera `REFERENCEESTIMEEEXPORT` o
`VALEURCALCULEEEXPORT`. En el export del ZMIII la columna se llama **Waist Size cm**, sin sufijo, así
que no la alcanzaba ninguna de las dos vías y la cintura entraba nula. **Sin cintura no hay ICC ni ICT**,
y con ellos se caían sus clasificaciones.

Se le dio el mismo tercer respaldo que ya tenía la cadera. Verificado que sigue descartando los ratios:
una columna "Waist to hip ratio" no se confunde con la circunferencia.

## 3. El peso meta sale del FMI y del FFMI, no del IMC

`motorTratNutri` decidía **la estrategia** mirando composición corporal, pero **el peso meta** —que es la
palanca de toda la cadena calórica— mirando solo el IMC. Dos criterios distintos sobre el mismo paciente,
dentro del mismo motor.

El IMC no distingue grasa de músculo. El resultado:

| Caso | Estrategia que emitía | Peso meta que usaba | Objetivo |
|---|---|---|---|
| Obesidad sarcopénica, IMC 24,2 | Hipocalórica + hiperproteica | 74 kg, su peso actual | **mantenimiento** |
| Deportista, IMC 27,2 | Normocalórica | 73 kg | recorte de **15 kg que no son grasa** |

**Ahora el peso meta sale de la identidad peso = (FMI + FFMI) × talla²:** cada índice se lleva a su
rango normal y el resto se deja como está. El FMI al límite si se pasa o si no llega (3–6 en hombres,
5–9 en mujeres) y el FFMI al mínimo solo si está por debajo (17 y 15). Cuando los dos ya están en rango,
meta y peso actual coinciden por la propia identidad.

Sin composición corporal se conserva el criterio por IMC: sin BIS no hay de dónde sacarlo.

**Una decisión que quiero que quede explícita:** el FFMI lleva piso. Empecé conservando siempre el medido
—la masa magra se protege, no se promete—, y con eso la meta de un paciente desnutrido salía **por debajo
de su peso actual**: al conservar un FFMI deficitario, la meta heredaba la desnutrición. Con el piso, la
meta apunta a recuperar la masa magra que falta, que es lo que el propio motor prescribe en ese perfil
con proteína alta y fuerza.

## 4. El peso meta es un solo dato, en las dos pantallas

El peso meta que el nutricionista escribía en **mod antropometría** no llegaba al motor del tratamiento:
se guardaba en el navegador y ahí se quedaba. El tratamiento seguía usando su propio cálculo aunque el
profesional ya lo hubiera fijado.

**Ahora viaja con el paciente y la cadena está cerrada en los dos sentidos.** La precedencia:

1. El ajuste hecho en el tratamiento.
2. **Lo escrito en mod antropometría.** No es otro peso meta: es el mismo, escrito antes.
3. El calculado por FMI/FFMI.
4. El criterio por IMC, sin composición corporal.

Y si se ajusta en el tratamiento, se escribe en el registro de antropometría del paciente y esa pantalla
se pone al día sola. Es un dato con dos superficies de edición, como quedó dicho el 28 de agosto.

---

## 5. Correcciones de la tabla de composición

**El IRC.** Los cortes son los del artículo (`Articulo_IRC_vs_IR`, Tabla 3, cohorte n=6.063), por sexo:
hombres <1,7 bajo · 1,7–2,1 normal · >2,1 alto; mujeres <2,3 · 2,3–2,8 · >2,8. Y **no se multiplica por
diez al mostrarlo**, porque el ×10 ya está dentro de la fórmula `IRC = (Re/(Ri×C))×10`. Ahí estaba el
16,222 en rojo que contradecía a la tarjeta verde sobre el mismo número. Se retiró el clasificador
duplicado de la tabla —que además comparaba sin sexo— y se retiraron los cortes 2,0–2,8, 1,68/2,11 y
2,27/2,85 de todas partes: tarjeta, tabla, referencias por sexo y el texto que se le entrega a la IA.

**La columna Δ del ISCM y del IAE.** Repetían el valor en vez de la diferencia. El ISCM contra ≤−1 da
−0,75, como calcularon. El IAE da la distancia al límite del rango que se cruzó, y cero mientras esté
dentro de −5 a +5.

**El rescate del MCA_dif.** La desviación teórica del MCA no la rescataba nadie por búsqueda tolerante
—esa línea solo existía para el `FFW_dif`—, de modo que un export que la trajera con el encabezado en
otro idioma la habría perdido igual.

---

## 6. Las remisiones van por profesional, no por ruta

**A un profesional se le remite una vez.** Si varias rutas activas lo requieren, no son varias
remisiones: es una sola, y las rutas son el porqué.

La sección 3 del tratamiento emitía una tarjeta por cada par ruta × profesional, así que un paciente con
tres rutas que piden médico veía "Remisión a: Médico" tres veces. La historia clínica ya agrupaba bien
desde antes; eran dos implementaciones distintas y solo una estaba corregida.

Ahora, con tres rutas activas:

```
ANTES: 4 tarjetas            AHORA: 2 tarjetas

→ Remisión a: Psicólogo/a   [R7] · OBLIGATORIA
   Motivo: Conducta alimentaria

→ Remisión a: Médico   [R2] [R4] [R7] · ALTA
   Motivos: Inflamación celular · Riesgo cardiometabólico · Conducta alimentaria
```

Se conserva la urgencia **más alta** de todas sus rutas —no la de la primera que se encuentre— y las
indicaciones se unen sin repetir. El orden: primero el más urgente; a igual urgencia, el que más rutas lo
piden.

---

## 7. El motor de IA: de cinco minutos a ocho segundos

**Tres problemas encadenados, y ninguno era del archivo.**

El proxy respondía que la `GROQ_API_KEY` no estaba configurada. Ya está puesta en Vercel y desplegada.

Después apareció que **la cuenta no tiene acceso a los modelos Llama**: los dos responden 404 «does not
exist or you do not have access to it», aunque Groq los liste como activos. Eso dejaba como única opción
de texto a Qwen, que es un modelo de **razonamiento**: escribe su borrador antes de responder y gasta ahí
la mayor parte del tiempo. El diagnóstico completo tardaba **cinco minutos**, que es más de lo que un
profesional puede esperar con el paciente delante.

Se habilitaron los GPT-OSS en el proxy (`cnvsystem.com`, commit `e34f1b3`) y ATLAS usa el **20B**: va a
1.000 tokens/s contra los 280 del Llama 70B y no razona en voz alta. Medido contra el mismo caso:

| Modelo | Tiempo | Contenido |
|---|---|---|
| Qwen | ~5 min | truncado tras razonar |
| **GPT-OSS 20B** | **4,1 s** | 4.585 caracteres |
| GPT-OSS 120B | 6,1 s | 6.717 caracteres |

Los cuatro pasos del diagnóstico completan en **7,9 s**, incluida una espera por el tope de la cuenta.

**Y tres cosas más en esa misma cadena:**

- **El modelo se define en un solo sitio**, y lo usan el diagnóstico y la adaptación del menú. Cambiarlo
  es una línea.
- **Reintento ante el tope por minuto.** La cuenta tiene 8.000 tokens por minuto y el diagnóstico son
  cuatro llamadas seguidas. Cuando se roza, Groq dice cuántos segundos hay que esperar: ATLAS espera y
  reintenta. No es un fallo, es una cola. Antes se le mostraba al profesional el mensaje crudo del
  proveedor en inglés y el diagnóstico se perdía.
- **Presupuesto escalonado.** Se empieza bajo —amable con ese tope— y se repite con más solo si la
  respuesta quedó vacía o cortada a mitad de frase.

## 8. El texto del diagnóstico va en prosa

**Debe parecer escrito por una persona.** Estaba dicho desde el principio y el modelo nuevo lo rompía: el
GPT-OSS escribe en markdown por defecto, con `**negritas**`, `##` en los títulos, `---` entre párrafos y
tablas de barras verticales.

Corregido por los dos lados, porque uno solo no basta. **En el prompt**, un bloque de formato explícito:
prohibidos los asteriscos, las almohadillas, las líneas de guiones, las tablas, las comillas encerrando
títulos, las viñetas y los emoji; los dominios se nombran dentro de la frase y los números van en la
redacción. **Y a la salida**, un filtro que limpia esos marcadores por si el modelo desobedece, que es lo
que hacen. Se aplica solo al texto narrativo: los pasos intermedios devuelven JSON y no se tocan.

## 9. Retirado el panel DEBUG

Había un botón fijo abajo a la derecha que desplegaba un panel con **todos los campos crudos del
paciente**, `enc` y `bis`, clave por clave. Servía para revisar datos durante el desarrollo, pero no debe
estar en una consulta: ocupa una esquina de la pantalla en todo momento y con un clic le muestra al
paciente su propio documento, sus diagnósticos y sus antecedentes en bruto. Retirado.

---

## Resumen

| # | Cambio | Qué corrige |
|---|---|---|
| 1 | **Las derivaciones corren siempre**, no solo con espectro incompleto | AEC, AIC, FFW, MCA y ratios ya no salen vacíos. Cierra sus puntos 4 y 5 |
| 2 | Tercer respaldo para la **cintura** (`Waist Size cm`) | Se registra, y con ella el ICC, el ICT y sus clasificaciones |
| 3 | **Peso meta desde FMI y FFMI**, no desde el IMC | El objetivo calórico deja de contradecir al DFI |
| 4 | **Peso meta cerrado en los dos sentidos** | Un solo dato entre antropometría y tratamiento |
| 5 | **IRC** con los cortes del artículo y sin el ×10 duplicado · **Δ** del ISCM y del IAE · rescate del MCA_dif | Un solo veredicto por paciente en las dos pantallas |
| 6 | **Remisiones por profesional**, con sus motivos | Una remisión por profesional, no una por ruta |
| 7 | **Motor de IA**: modelo, reintentos y presupuesto | De cinco minutos a ocho segundos |
| 8 | **Diagnóstico en prosa**, sin marcadores de formato | Texto que parece escrito por una persona |
| 9 | **Retirado el panel DEBUG** | Datos crudos del paciente fuera de la pantalla de consulta |

**Fuera de ATLAS, en cnvsystem.com:** la `GROQ_API_KEY` quedó configurada y el proxy admite ahora los
modelos GPT-OSS (commit `e34f1b3`, desplegado).

© Connected Nutrition Ventures SAS, 2026. Documento interno.
