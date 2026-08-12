# Respuesta a la ronda del 2026-08-10

**De:** Gildardo Uribe — Dirección Científica CNV
**Para:** Equipo Atlas
**Fecha:** 12 de agosto de 2026

Respondo las dos bloqueantes, las cuatro preguntas y las dos confirmaciones. Ninguna queda abierta. Y cierro además el punto de la Parte 3 que tenían anotado como pendiente de mi entrega: no lo estaba.

Dos avisos antes de entrar:

- **La pregunta 1 (la fórmula del déficit) no tiene la respuesta que esperan**, y por eso llevaba varias rondas sin cerrarse. No hay fórmula que portar. Ver §1.
- **El punto 4 corrige lo que respondí el 9 de agosto.** Lo señalo expresamente para que no queden las dos versiones circulando. Ver §6.

---

## 1. BLOQUEANTE · La fórmula del déficit

**No hay fórmula. No la hay porque no debe haberla.**

Quien decide cuántas calorías subir o bajar es **el nutricionista**, en la consulta y con el paciente delante. El sistema no debe derivar ese número de nada: ni de un ritmo de pérdida, ni del gasto al peso meta, ni de una tabla por magnitud. Las tres candidatas que proponen se descartan.

Lo que sí hace el sistema es **ofrecer el peso de referencia que el profesional coloca**, y calcular a partir de ahí lo que corresponda.

**Y aquí está lo importante para portarlo: el código ya lo soporta.** En `motorTratNutri` existe:

```js
if (edit.deficit !== undefined && String(edit.deficit) !== "" && !isNaN(Number(edit.deficit)))
  deficit = Number(edit.deficit);
```

El déficit que escribe el profesional ya manda sobre todo lo demás. **Lo que sobra es el valor que el fenotipo impone cuando el profesional no ha escrito nada** (`deficit = 500` en obesidad). Eso es lo que hay que quitar.

No hay conversión de kilogramos a calorías que portar. Hay un campo que llena el nutricionista y un valor por defecto que hay que retirar.

Tienen razón en que mi corrección a D-002 daba la dirección sin la aritmética. La aritmética no existe, y eso es la respuesta.

---

## 2. BLOQUEANTE · `pesoAjust`

**Manda el peso de referencia que coloca el profesional. El ajustado automático solo actúa cuando no hay ninguno escrito.**

Con esa regla, la preocupación que plantean se disuelve: **ningún paciente que ya tenga peso de referencia registrado ve cambiar su prescripción**. El ajustado deja de ser la base de cálculo y pasa a ser lo que siempre debió ser, un valor inicial mientras el profesional no decide.

Sobre la discrepancia que señalan: tienen razón y no hay contradicción. En `ATLAS_v8.html`, dentro de `motorTratNutri`, `pesoAjust` se calcula y se devuelve pero **no entra en ningún cálculo** — ahí es código muerto, y por eso pedí retirarlo. En su `atlas-protocolo.js` **sí se usa** como peso de cálculo. Las dos observaciones son correctas sobre archivos distintos. Buena captura.

---

## 3. Conducta propia — no hay texto que redactar

Preguntan por mi redacción exacta. **No hace falta ninguna: esa línea sobra y hay que suprimirla.**

Si el profesional que atiende es el nutricionista, **no debe aparecer ninguna remisión al nutricionista en las rutas**. ¿Qué sentido tiene remitir al paciente a quien lo está atendiendo en ese momento? Lo mismo con cada profesión.

Así que no es cuestión de cambiar el texto por otro más suave. **La línea del destinatario que coincide con quien atiende no se muestra.** El resto de destinatarios se consolidan como quedó en el §9 del documento anterior: una línea por profesión, con el resumen de lo que se le remite.

Retiren el placeholder. No lo reemplacen por nada.

---

## 4. La figura del ejercicio

No es una cuarta figura. Son **las personas que trabajan con el ejercicio**, y el rótulo debe recogerlas a todas:

> **Educador físico, entrenador, deportólogo**

Ese es el destino del componente de ejercicio. Sustituyan "Entrenador/Fisioterapeuta" por esa denominación.

---

## 5. Las dos rarezas del grupo "carnes rojas"

**No era deliberado: era un descuido, y ya está corregido en el prototipo.**

Lo verifiqué en el código antes de responder. Las carnes rojas están declaradas como `cat: "neutro"` en `FREQ_GROUPS`, así que sí entraban en `calcPatron`. Pero la tarjeta de pantalla tenía la lista de grupos escrita a mano —`grupos:[8,9,10]`— y no se actualizó cuando el grupo 15 se añadió en julio.

Lo segundo también era real: el código solo invertía la lógica de color para la categoría de riesgo, de modo que los moderados heredaban la de los protectores. Más frecuencia, más verde.

**Ambas cosas corregidas:**

- El grupo 15 entra en el promedio de "Moderados".
- Los moderados tienen ahora **su propia lógica**: en ellos más no es mejor. El óptimo está abajo, y la frecuencia alta deja de pintarse en verde.

| Frecuencia | Antes | Ahora |
|---|---|---|
| 0–2 · de nunca a semanal | verde | verde |
| 3 · varias veces por semana | verde | ámbar |
| 4 · casi a diario | **verde** | **rojo** |

El caso que describen —carne roja 5 o 6 días por semana— pasa de mostrarse como adecuado a mostrarse como elevado, que es lo correcto.

---

## 6. El riesgo integrado del DFI · **esto corrige mi respuesta del 9 de agosto**

Lo señalo con claridad porque el §8 anterior ya está en sus manos y quiero que quede una sola versión.

**No se suspende nada. Se aplica la fórmula que está en el archivo.**

El DFI tiene **cinco dominios**. Cuando falta encuesta, se calcula con los dominios que sí se pudieron evaluar, **indicando cuáles no entraron**. No se oculta el resultado ni se le retira el nivel al profesional.

**Y hay algo que conviene aclarar, porque creo que ahí está el malentendido de fondo:** mi ecuación EB-BIS v5 ya resuelve sola el caso de encuesta incompleta.

```js
let eb = null;
if (_icecVal != null) { eb = 41.438 + 1.082·z(IFC) + 2.837·z(PABU) − 7.982·z(ICEC) }
const iae = (eb != null) ? (eb − edadCronológica) : null;
```

**Sin ICEC, la fórmula devuelve `null`.** No calcula con supuestos: no calcula. De modo que "aplicar la fórmula" y "no emitir la edad bioeléctrica cuando falta encuesta" **son la misma cosa**, no dos posiciones opuestas. No hacía falta construir un mecanismo de suspensión por encima: la fórmula ya lo hace.

Lo que no debe hacerse es extender esa suspensión a salidas que la fórmula sí puede producir. El riesgo integrado es una de ellas.

---

## 7. Las 63 preguntas del intake

**Todas las variables de la encuesta se requieren tal como están.** No hay lugar a poda, a sugerencias ni a interpretaciones sobre cuáles son prescindibles.

El DFI depende de ellas, y por esa misma razón **también deben tomarse todas en el seguimiento**, no solo en la primera consulta. Un seguimiento con menos variables que el intake no permite comparar.

Entiendo la observación del asesor legal sobre la extensión del instrumento, y es razonable como preocupación de forma. Pero la respuesta de contenido es que el instrumento está completo y así se aplica.

---

## 8. Confirmaciones

**C1 · El renombre del eje. Aprobado.** El rótulo **"Sectores E1-E9"** es correcto, y "Anillos A1-A9" para el eje funcional.

Sobre su observación de que no hizo falta traducción: es cierta en su código y no contradice mi instrucción. En su Atlas el prefijo se deriva al pintar y **nunca se guarda**, así que no hay nada que traducir. En mi `ATLAS_v8.html` sí se persiste —`radioId` viaja dentro de cada consulta guardada— y por eso allí sí hizo falta una función de traducción al mostrar. Las dos soluciones son correctas para su respectivo código.

**C2 · Las etiquetas del patrón. Confirmadas.** Usen las de `catLabel`:

- Alimentación Real protectora
- Alimentación Real energética (moderar)
- Procesados y ultraprocesados (PCBU)

---

## 9. `MCA_ref` y `hidSG_ref` — resueltas, y no hacía falta esperar una tabla mía

Aquí hubo un malentendido que corrijo: **ninguna de las dos es un valor propio de CNV que yo tuviera que producir. Son parámetros internacionales publicados.** Levanten la marca de "pendiente de entrega" y cablearlas ya.

### Hidratación de la masa libre de grasa — es la constante clásica

| Fuente | Valor |
|---|---|
| Pace y Rathbun (1945), medición original | 72,4 % ± 2,1 |
| Wang y cols., revisión en AJCN | **73,2 %** — el valor de referencia establecido |
| Medición moderna en adultos | Hombres 72,1–72,3 % · Mujeres 71,8–72,2 % |

**No se estratifica por sexo:** la diferencia es menor al 1 %. Varía con la edad solo en el extremo pediátrico (80 % al nacer, 73 % en el adulto), irrelevante para nuestra población.

**Valor a usar: 73,2 %, sin distinción.**

### Masa celular activa — se deriva de una referencia que sí existe

Sean precisos aquí, porque el matiz importa: **no existe una constante internacional de MCA sobre MLG**. La literatura advierte explícitamente que ese cociente varía entre individuos y desciende con la edad.

Lo que sí es referencia establecida en bioimpedancia es el cociente **ECM/MCA, con rango normal 0,85–1,00**. Y como ECM = MLG − MCA, se despeja directamente:

```
ECM/MCA = r     →     MCA/MLG = 1 / (1 + r)
```

| ECM/MCA | MCA como % de la MLG |
|---|---|
| 0,85 · límite bajo del rango | 54,1 % |
| **0,91 · media publicada** | **52,4 %** |
| 1,00 · límite alto del rango | 50,0 % |

**Valor a usar: 52,4 % de la MLG.**

### La estratificación existe pero NO la apliquen todavía

Los datos por sexo (H 54,3 % · M 51,3 %) y por edad (menores de 65: 53,5 % · 65–75: 52,4 % · mayores de 75: 49,0 %) provienen de una cohorte de 158 adultos **de 51 a 89 años**. Su grupo "menor de 65" es en realidad 51–64.

Aplicarla a un paciente de treinta años extrapolaría fuera de la cohorte y **subestimaría su masa celular**. Queda anotada en el código para cuando exista una cohorte que cubra adultos jóvenes.

### Ya está aplicado en el prototipo

En `ATLAS_v8.html` las dos constantes quedaron marcadas como **REFERENCIADAS**, con su procedencia en el código, separadas de las que siguen pendientes de validación clínica. El valor anterior de MCA era 50 %, que es el extremo peor del rango y subestimaba la referencia de forma sistemática.

Comprobación de coherencia: con una MLG de referencia de 58,5 kg, el sistema produce MCA_ref 30,65 kg y ACT_ref 42,82 L, lo que implica un ECM/MCA de **0,909** — dentro del rango normal y coincidente con la media publicada. Las dos constantes son consistentes entre sí.

### Referencias

- *Hydration of fat-free body mass: review and critique of a classic body-composition constant* — American Journal of Clinical Nutrition
- *Hydration of fat-free body mass: new physiological modeling approach* — American Journal of Physiology, Endocrinology and Metabolism
- *Evaluation of fat-free mass hydration in athletes and non-athletes* — European Journal of Applied Physiology
- *Extracellular mass to body cell mass ratio association to nutritional and functional status in middle-aged and older adults* — Frontiers in Nutrition
- *Body cell mass: model development and validation at the cellular level of body composition* — American Journal of Physiology, Endocrinology and Metabolism

---

## 10. Grafías de nutracéuticos

Tomo nota. Cuando actualice el archivo unifico los nombres para que no tengan que sostener el mapa.

---

## Resumen de lo que cambia para ustedes

| Punto | Efecto |
|---|---|
| §1 Déficit | **No hay fórmula que portar.** Retirar el valor por fenotipo; el campo del profesional ya manda |
| §2 `pesoAjust` | Manda el peso del profesional; el ajustado queda como valor inicial. Nadie con peso escrito cambia |
| §3 Conducta propia | **Suprimir la línea**, no reformularla |
| §4 Figura del ejercicio | "Educador físico, entrenador, deportólogo" |
| §5 Carnes rojas | Corregido en el prototipo. Replicar: entra al promedio y color propio |
| §6 Riesgo integrado | **Corrige el §8 del 9 de agosto.** No suspender; calcular con lo evaluable e indicar qué faltó |
| §7 Encuesta | Sin poda. Todas las variables, también en el seguimiento |
| §8 C1 y C2 | Aprobados |
| §9 `MCA_ref` y `hidSG_ref` | **Ya no esperan entrega mía.** Son parámetros publicados: 73,2 % y 52,4 % de la MLG. Cablearlas |

© Connected Nutrition Ventures SAS, 2026. Documento interno.
