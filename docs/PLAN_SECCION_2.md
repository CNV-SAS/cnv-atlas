# Plan de la Sección 2 (nutracéuticos, otros productos y cobro)

**Estado (2026-08-27): los puntos 1 a 3 CONSTRUIDOS.** El resto sigue en propuesta y espera.

Y al construirlos aparecio que **el acto 3 YA dependia del acto 2**: la entrega solo se montaba con la
decision en "si", con su razon escrita en la pagina. Lo que faltaba de verdad era mas chico y mas
preciso que lo que el plan suponia.
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

**CAMBIO DE FORMA (2026-08-27, dato de Santiago): LUVIA VA EN CONSIGNACIÓN**, igual que los
nutracéuticos. Se le envía inventario al integrante y se puede agotar. Así que no es una casilla con
unidades: **tiene saldo, se descuenta y se liquida.**

Eso la mueve al bloque de dinero, y el punto 4 **deja de ser construible ya**.

### (a) ¿Catálogo propio o el existente? El existente, y encaja sin forzar

Su documento planteaba un catálogo aparte (`OTROS_PRODUCTOS`, extensible), pero eso era cuando LUVIA
solo se registraba. Con consignación, la tabla `nutraceuticals` ya tiene **todo** lo que necesita:
`name`, `unit`, `unitPrice`, `indication`, `composition`, `presentation`, `servingSize`,
`commercialAvailability` y hasta `sanitaryRegistration`, que es donde va su INVIMA RSA-0019736-2022.

**Faltan dos cosas, y son chicas:**
- **Un discriminador.** Sin él, LUVIA aparecería en el selector libre de prescripción, y no se prescribe
  por diagnóstico. Basta una columna (`indicado_por_diagnostico`, o un `tipo`) que la UI use para
  ponerla en OTROS PRODUCTOS en vez de en la lista de prescripción.
- **El campo de alérgenos.** El aviso "Contiene avena (gluten)" no tiene dónde guardarse hoy.

**Una tabla aparte sería peor**, y no por gusto: obligaría a duplicar inventario, movimientos, despacho,
faltantes y liquidación. Ver (b).

### (b) El movimiento de inventario: es el mismo mecanismo, sin replicar nada

`nutraceutical_inventory` y `nutraceutical_stock_movements` se llavean por `(professional_id,
nutraceutical_id)`. **Si LUVIA es una fila de `nutraceuticals`, el despacho, el saldo, los faltantes y
la liquidación funcionan tal cual, sin una línea nueva.**

Esa es la razón de peso para no darle tabla propia: la consignación no es un CRUD, son cinco piezas
acopladas, y duplicarlas es duplicar sus defectos.

### (c) Comisión: la genera automáticamente, y NO hay forma de darle otra tarifa

La comisión **no es por producto**: `commission_rate` vive en `professional_profiles` (0,20 por defecto,
editable por admin) y se calcula **sobre el monto de la transacción**. Así que si LUVIA se cobra por el
mismo flujo de pago, **genera comisión al integrante a su misma tarifa, sin que haya que hacer nada**.

**Y eso es justo lo que hay que confirmar**, porque el sistema no puede expresar lo contrario: si LUVIA
debiera pagar una tarifa distinta, o ninguna, **hoy no hay estructura para eso** y habría que
construirla. Es decisión de negocio, no técnica.

### CAMBIO MAYOR (2026-08-27, soporte de entrega): LUVIA NO ES DE CNV

Viene en consignación de un TERCERO (Centro de Nutrición Integral Katherine Ruiz), 60 unidades, PVP
90.000 con IVA incluido. **La cadena es de TRES eslabones, no de dos:** el consignante nos la da,
nosotros al profesional, el profesional al paciente. Y el dinero vuelve por el mismo camino, menos
márgenes.

Verificado contra el modelo, y las tres respuestas son las que hacen que esto NO se pueda construir aún.

**(a) El inventario NO distingue lo propio de lo ajeno.** `nutraceutical_inventory` es
`(professional_id, nutraceutical_id, stock_quantity)`: quién tiene cuánto, sin dueño. Y los tipos de
movimiento codifican la cadena de DOS explícitamente: `remesa` es *"CNV envía al integrante"*,
`recepcion` es *"el integrante reconoce que recibió en custodia"*. **No hay tipo para "el consignante
nos entregó a nosotros"**, ni saldo que represente lo que CNV custodia sin ser suyo.

El catálogo tampoco: `nutraceuticals.organization_id` ata el producto a UNA organización, así que hoy
LUVIA quedaría registrada como producto de CNV, que es justo lo que no es.

**(b) Sí hace falta distinguirlo, y no por prolijidad contable.** Hay un caso concreto donde el modelo
actual da la respuesta equivocada: **el faltante**. Hoy, si a un integrante le falta una unidad, se
materializa un cargo contra él y el asunto se cierra entre CNV y el integrante. Con un producto ajeno,
**CNV le debe esa unidad al consignante pase lo que pase con el integrante**. Son dos obligaciones
distintas y hoy solo existe una.

Lo mismo con la conciliación tras conteo físico: un ajuste negativo sobre stock propio es una pérdida
nuestra; sobre stock ajeno es una deuda.

**(c) Sí: es una SEGUNDA LIQUIDACIÓN que no existe.** Hoy la cadena económica es una sola: se cobra al
paciente y se liquida la comisión al integrante. Con un tercero aparece otra, en el otro sentido: **CNV
le debe al consignante por cada unidad vendida**, y esa liquidación no tiene ni tabla ni concepto.

Y encima **cambia el margen**: hoy la comisión sale sola sobre el monto de la transacción a la tarifa
del integrante (0,20). Con un producto ajeno hay que repartir entre tres, no entre dos. Ahí es donde
pega lo que ya habíamos anotado: **el sistema no puede expresar una tarifa distinta por producto**, y
con un producto de tercero eso deja de ser hipotético.

**NO SE CONSTRUYE NADA DE ESTO** hasta que Santiago tenga las respuestas de contabilidad y legal. Son
ellas las que definen si el stock ajeno se registra como propio con una marca, si va en un circuito
aparte, y contra quién se liquida. Cualquier cosa que construyamos antes habría que rehacerla.

### Lo que sigue en pie del diseño de la sección

Casilla, campo de unidades al marcarla, botón propio de entrega (para el paciente sin nutracéuticos
indicados), y el texto verbatim de su archivo con la posología, la composición, el aviso de alérgenos y
el INVIMA. Eso no cambia: lo que cambia es que ahora **entra al mismo circuito de inventario y cobro**.

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

**c · El pago mixto YA ESTA RESUELTO, y me equivoque al listarlo como pendiente.** Esta decidido y
construido: se modela como **dos transacciones, una por medio de pago** (`payment_method` = `wompi` |
`efectivo`), no como una con dos pagos. La comision de cada una va sobre su monto, asi que la del total
es la suma, y el efectivo solo define cuanto custodia el integrante. Esta escrito en el enum y
`registerCashSaleFormAction` existe.

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
| 4 | OTROS PRODUCTOS (LUVIA) | **YA NO es libre.** Va en consignación: entra al bloque de dinero |
| 5 | El aviso de alérgenos de LUVIA cruzado | **respuesta de Gildardo** |
| 6 | LUVIA en el catálogo, con discriminador y campo de alérgenos | **contabilidad y legal**: es de un TERCERO, no de CNV |
| 7 | El checkout en la sección | **las tres decisiones de dinero que quedan** |

**Del 1 al 3 se puede construir ya**, y son los tres defectos que Santiago ve hoy. Del 4 en adelante
espera: LUVIA porque entra a consignación, el 5 a Gildardo, el 6 a la confirmación de comisión, y el 7
a las decisiones de dinero.

---

## Nota: por qué "Meta kg" NO se construyó en la entrada (2026-08-27)

Su archivo tiene un campo **"Meta kg"** en la fila de Peso, y decidimos **no portarlo**. La razón, para
que no se reabra al volver a ver la captura:

**Sería una segunda fuente para un concepto que ya tiene una.** El peso meta de Atlas **no lo escribe
nadie: lo calcula el motor congelado** (`atlas-protocolo.authorized.js`), a partir del peso, el IMC, el
peso ideal y las comorbilidades. Y el profesional puede sobrescribirlo con `adj_peso_meta`, que **entra
a toda la cadena calórica**.

Un campo editable en la entrada crearía **dos pesos meta**: el escrito antes del diagnóstico y el
calculado después. **Es exactamente el problema de los dos objetivos calóricos**, que ya nos costó una
reversión y que Gildardo hizo colapsar en el checkpoint 2 ("el objetivo sale de la cadena, fuente
única").

**Y hay un obstáculo concreto encima:** `adj_peso_meta` vive en `treatments`, que **no existe antes del
diagnóstico**. Habría que inventar un segundo almacén para el mismo dato.

**Su archivo lo tiene porque allí TODO el bloque es editable y no hay motor que lo calcule. Nosotros sí
lo tenemos.** Esa es la diferencia, y es la que decide.
