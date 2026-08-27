# Plan de la Sección 2 (nutracéuticos, otros productos y cobro)

**Estado: PROPUESTA. No se ha construido nada.**
Es superficie de dinero, así que se planea entera y se construye una vez.

---

## 0 · Lo que hay hoy, y los tres defectos

La sección tiene hoy **tres actos en tres bloques separados**:

1. **Recomendados del modelo**, cada uno con botón "Agregar".
2. **Selector libre del catálogo** ("Abajo agregas los que prescribes; son tu decisión, distinta de la
   recomendación del modelo") con botón "Agregar".
3. **"¿El paciente adquiere los nutracéuticos?"** con tres opciones y "Registrar decisión".
4. **"Entrega de nutracéuticos"**, que aparece condicionalmente.

Y los tres defectos que encontró Santiago, ya diagnosticados contra el código:

**D1 · El bloque de entrega desaparece sin decir por qué.** No lee mal: lee `protocol.nutraceuticals`
(lo prescrito) y filtra por `commercialAvailability === "en_consultorio"`. Si no queda ninguno, devuelve
`null` y **el bloque entero no se renderiza**. La frase que lo explicaría ("los productos de solo tienda
no aparecen aquí") **vive dentro del bloque que no se muestra**.

Un bloque ausente no distingue tres situaciones distintas:
- no prescribiste nada,
- prescribiste algo que no se entrega aquí (solo tienda / no disponible),
- prescribiste pero **no guardaste** (el bloque lee del servidor; "Agregar" solo cambia estado local).

**D2 · Desagregar deja el bloque.** Por lo mismo: el bloque depende de lo GUARDADO, no de lo que está
en pantalla. Quitar un producto sin guardar no lo quita del servidor.

**D3 · "Sí adquiere" es marcable sin haber prescrito nada.** Adquirir *qué*.

---

## 1 · Cómo lo organiza Gildardo (capturas del 2026-08-27)

Su Sección 2 se llama **"VITACELLEBIS RECOMENDADO"** y es **un solo acto**:

- Los recomendados (P1, P2) **cada uno con una casilla**.
- **OTROS PRODUCTOS** al final, con LUVIA, su casilla y un campo de **unidades** al lado.
- Un botón **"Registrar despacho (N)"** con el conteo en vivo y el resumen al lado (`1×LUVIA`).

**Lo que su diseño NO tiene:** ni selector libre del catálogo, ni pregunta de "¿adquiere?", ni bloque de
entrega aparte. **La casilla ES la selección de despacho.**

### Qué resuelve su orden, y qué no podemos copiar

**Resuelve tres cosas de un plumazo, y por eso lo adoptamos como base:**
- No hay bloque que aparezca y desaparezca (D1 y D2 se disuelven: la lista siempre está).
- No se puede "despachar" sin marcar nada: el botón cuenta lo marcado (D3 se disuelve).
- Las unidades viven junto a la casilla, donde se deciden.

**Lo que NO podemos copiar tal cual, y la razón:**
- **Su prototipo no tiene inventario ni pagos.** Nuestro despacho descuenta consignación real y hay
  dinero de por medio; el suyo solo registra.
- **Su lista es solo la recomendada.** Nosotros necesitamos el selector libre, porque el profesional
  prescribe por criterio propio lo que el modelo no recomendó, y eso es decisión clínica suya (está
  dicho en la propia pantalla).
- **Nos falta su distinción de disponibilidad:** en nuestro catálogo un producto puede ser
  `en_consultorio`, `solo_tienda` o `aún no disponible`, y eso cambia **quién lo entrega**.

---

## 2 · El flujo propuesto: tres actos, cada uno visible solo cuando tiene sentido

### Acto 1 · PRESCRIBIR (decisión clínica)

**Una sola lista, siempre visible**, con los recomendados arriba y el selector libre debajo, como hoy.
Cada ítem prescrito muestra **su disponibilidad** (ya se muestra en el selector; pasa también a la lista
de prescritos, que es donde se lee después).

- Es el único acto que existe si no hay nada prescrito.
- **Guardar es explícito** y sigue como está.

### Acto 2 · ¿ADQUIERE? (información clínica)

**No aparece hasta que hay al menos un prescrito GUARDADO.** Hoy aparece siempre, y de ahí D3.

Y conserva las tres opciones, por la distinción que importa:

| Situación | Qué significa | ¿Es información clínica? |
|---|---|---|
| No prescribí nada | no hay indicación | **No.** Por eso la pregunta ni aparece |
| Prescribí y **sí** adquiere | va a tomarlo | Sí |
| Prescribí y **no** adquiere | **hay indicación que no se cumple** | **Sí, y es la que más importa** |
| Prescribí y **aún no decide** | pendiente de su decisión | Sí |

**Por eso "no agregar nada" y "marcar que no" no son lo mismo**, y el flujo no los puede colapsar: el
segundo es un hecho clínico (el paciente no va a tomar lo indicado) y el primero no es nada.

### Acto 3 · ENTREGAR (acto de inventario y dinero)

**Aparece cuando hay prescritos y la respuesta del acto 2 es "sí adquiere".** Hoy aparece por tener
prescritos entregables, sin mirar la respuesta.

Y **nunca desaparece en silencio**: ver la sección 3.

---

## 3 · Los tres estados del bloque ausente, cada uno con su frase

El bloque de entrega **siempre se renderiza** cuando el acto 2 dice "sí adquiere". Lo que cambia es qué
dice dentro. Es la lección de *ausencia contra fila vacía*: un bloque que no está no informa.

| Estado | Qué se ve |
|---|---|
| Hay prescritos `en_consultorio` | la lista de entrega, como hoy |
| Prescribió, pero **todo es `solo_tienda`** | "Lo que prescribiste se compra en la tienda, no se entrega en consultorio." Con la lista de esos productos, para que se vea cuáles |
| Prescribió, pero **todo es `aún no disponible`** | "Lo que prescribiste todavía no está disponible para entrega." |
| **Hay cambios sin guardar** | "Guarda la prescripción para poder entregar." Es el caso que hoy se lee como defecto |

El último exige que la sección sepa si hay cambios pendientes. Ya existe el mecanismo: la firma de
remonte del panel compara lo guardado con lo que está en pantalla.

---

## 4 · OTROS PRODUCTOS (LUVIA)

Va **al final de la sección**, después de los nutracéuticos, como en su archivo.

**Su forma es distinta a propósito y hay que respetarla:** LUVIA **no se indica por diagnóstico**, así
que no tiene "recomendado" ni pasa por el acto 1. El profesional lo ofrece por criterio.

- **Casilla + campo de unidades** que aparece al marcarla, como en su captura.
- El texto va verbatim del archivo: la posología (1 scoop de 15 g en un vaso con agua · Polvo · 600 g),
  la composición, el **aviso de alérgenos** (contiene avena, gluten) y el registro INVIMA.
- **Botón propio de entrega.** Esto es lo que Santiago señaló y es correcto: si el paciente no tiene
  nutracéuticos indicados, hoy no existe ningún camino para entregarle LUVIA. Con el botón propio, la
  sección de otros productos funciona sola.

**El aviso de alérgenos NO se cruza automáticamente contra las alergias declaradas.** Es la instrucción
explícita de Gildardo ("el alérgeno se avisa pero no se cruza") y se respeta. Pero **ahora tenemos el
cruce construido** para el menú, así que queda como pregunta para él: si un paciente declaró alergia al
gluten y se le ofrece LUVIA, ¿el sistema debería avisar? **No se construye sin su respuesta.**

---

## 5 · El checkout, dimensionado

**Sí va aquí**, porque es donde se cobra. Hoy vive en `/pagos`, separado del acto que genera el cobro.

Lo que ya existe: `createCheckoutAction` (enlace de pago Wompi), `registerCashSaleFormAction` (venta en
efectivo), y la pantalla `/pagos`.

Lo que falta, y es lo que hay que decidir antes de construir:

**a · Descontar contra el pago confirmado, no contra la entrega.** Hoy la entrega descuenta el
inventario en el acto. Si el paciente paga por enlace y no paga, el inventario ya se descontó. El acuerdo
es descontar contra el pago confirmado, así que **la entrega y el descuento dejan de ser el mismo
evento**, y el sistema necesita un estado intermedio ("entregado, pendiente de pago").

**b · El saldo cobrado que no existe.** No hay estructura para lo que el profesional cobró y todavía no
liquidó contra la consignación. Es una cuenta, no un campo.

**c · El pago mixto.** Parte en efectivo y parte por enlace, que es lo que pasa en consultorio.

**d · Y una pregunta de alcance:** ¿el cobro es por la entrega (lo que sale del consultorio) o por la
prescripción completa (incluida la parte que compra en tienda)? Son dos negocios distintos y cambian
qué se cobra aquí.

**Los cuatro son de dinero, así que ninguno se construye sin decisión escrita.** El resto del plan
(actos 1 a 3, los tres estados, LUVIA) **no depende de esto** y se puede construir antes.

---

## 6 · Orden de construcción propuesto

| | Qué | Depende de |
|---|---|---|
| 1 | Los tres estados del bloque ausente, con su frase | nada. Es el defecto que se ve hoy |
| 2 | El acto 2 no aparece sin prescritos guardados | nada |
| 3 | El acto 3 depende de la respuesta del acto 2 | 2 |
| 4 | OTROS PRODUCTOS (LUVIA) con casilla, unidades y botón propio | nada |
| 5 | El aviso de alérgenos de LUVIA cruzado | **respuesta de Gildardo** |
| 6 | El checkout en la sección | **las cuatro decisiones de dinero** |

Del 1 al 4 se puede construir ya. El 5 y el 6 esperan.
