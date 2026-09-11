# Inventario y ventas: plan de implementación por bloques

**Estado:** aprobado por Santiago el 2026-09-11, con cinco decisiones cerradas por contabilidad.
**Se actualiza bloque a bloque.** Cada bloque marca su estado aquí al cerrarse, en el mismo commit que lo
cierra (regla de `CLAUDE.md`: un documento de estado que no se actualiza al terminar queda stale y hace
que algo ya hecho se vuelva a planear).

**Fuentes, en orden de autoridad:**

1. `MODELO_COMERCIAL_NUTRACEUTICOS_ATLAS.md` — reglas de negocio, contables y tributarias. Pasó revisión
   contable y legal. **Si algo contradice el modelo, gana el modelo.**
2. `PLAN_INVENTARIO_Y_VENTAS_ATLAS.md` — decisiones y fases.
3. Este documento — cómo se construye, y el único sitio donde vive el estado de cada bloque.

---

## Estado de los bloques

| Bloque | Estado | Cierra con |
|---|---|---|
| 0 · Purga y corte de arranque | **HECHO (2026-09-11)** | Cerrado. Ver abajo |
| 1 · Cimientos | **HECHO (2026-09-11)** | La carga inicial corrió en la nube: 1.810 unidades en 8 ubicaciones, cotejadas |
| 2 · Alegra de verdad | **SIGUIENTE** | Una venta emite factura real con consecutivo de Alegra |
| 3 · La venta nace en Tratamiento | Pendiente | — |
| 3b · Reversa | Pendiente | — |
| 4 · Liquidaciones | Pendiente | — |
| 5 · Distribución | Pendiente | — |
| 6 · Domicilio | Pendiente | — |

---

## Una sola numeración

El plan y el modelo llamaban "Fase 0" a cosas distintas (la purga y los cimientos). **De aquí en adelante
solo hay bloques**, y la correspondencia con los dos documentos anteriores es esta:

| Bloque | Modelo §11.2 | Plan §5 |
|---|---|---|
| 0 · Purga y corte | — | Fase 0 |
| 1 · Cimientos | Fase 0 | — |
| 2 · Alegra de verdad | parte de Fase 0 y Fase 1 | Fase 0 |
| 3 · La venta nace en Tratamiento | Fase 1 | Fase 1 |
| 3b · Reversa | — | — |
| 4 · Liquidaciones | Fase 2 | Fase 2 |
| 5 · Distribución | Fase 3 | Fase 3 |
| 6 · Domicilio | Fase 4 | — |

**Se parte de la Fase 0 del modelo** (cimientos). La purga no es una fase del modelo: es su precondición.

---

## Las cuatro objeciones técnicas, aceptadas

Se levantaron antes de planear y Santiago las aceptó. Ninguna contradice el modelo: son **cómo cumplirlo**.

**1. `treatment_id NOT NULL` rompe el inventario.** Esa columna vive en
`nutraceutical_stock_movements`, que también guarda recepciones, remesas y conciliaciones, y ninguna tiene
tratamiento. Un `NOT NULL` plano haría imposible recibir mercancía. Se resuelve con un **CHECK
condicional** (Bloque 0) y, al aplicarse la Decisión 1, el vínculo correcto pasa a ser
**movimiento → venta → tratamiento**.

**2. Alegra no es un re-mapeo de identificadores: es una reescritura.** Hoy toda factura se emite contra
`ALEGRA_DEFAULT_CLIENT_ID` (un cliente fijo para todos los pacientes), `ALEGRA_DEFAULT_ITEM_ID` (un ítem
genérico para todos los productos) y un `ALEGRA_IVA_TAX_ID` forzado desde Atlas. El modelo exige lo
contrario en los tres puntos. **Énfasis de contabilidad: una factura que no identifica al adquirente ni al
producto no cumple los requisitos de la factura electrónica.** Cambiar los identificadores de sandbox a
producción sobre este código emitiría facturas igual de incorrectas, solo que en producción.

**3. El principio 8 del modelo ("todo movimiento contra un lote") choca con el esquema actual.** Hoy
`lote` es texto libre que no gobierna el saldo, y `nutraceutical_inventory` está indexado por
(profesional, producto) sin lote. Que el lote mande exige cambiar la llave del saldo y su proyección.

**4. La Decisión 1 solo es barata porque la purga va primero.** Los movimientos son inmutables por
trigger, así que los `despacho` históricos no se podrían reclasificar. Con la purga da igual. Queda
escrito para que nadie reordene los dos bloques.

---

## Las cinco decisiones de contabilidad

**D1. El alérgeno se dispara AL PRESCRIBIR, no al vender.** Si el profesional recomienda LUVIA a un
celíaco y este lo compra en otro sitio, el daño es el mismo. El control va cuando se selecciona el
nutracéutico en Tratamiento, **antes** de preguntar si lo adquiere. Consecuencia técnica: queda
desacoplado de `sales` y se puede construir en cuanto exista el Bloque 1.

**D2. El inventario se descuenta AL SELLAR LA VENTA, no al emitir la factura.** El hecho económico es la
venta; la factura lo evidencia, no lo causa. Inventario movido sin documento es transitorio y aceptable;
lo inaceptable es lo contrario. **Dos condiciones que lo hacen sostenible:** cola de reintento visible con
alerta, y un **reporte de ventas sin documento fiscal que debe estar en cero al cierre de cada día**.

**D3. El checkout pendiente RESERVA inventario, y al caducar lo libera.** Un enlace vivo es una unidad
comprometida. Hoy esto no está escrito en ninguna parte y no existe.

**D4. Entra un bloque de REVERSA (3b), inmediatamente después del de venta.** No es hipotético: CNV ya
emitió una factura con cantidad equivocada y la corrigió con nota crédito.

**D5. La tabla de alérgenos se construye pero NO se enciende en producción hasta que Gildardo firme las
equivalencias.** Y mientras tanto **LUVIA no se habilita para venta**.

---

## Las cuatro adiciones

**a) Contactos de Alegra.** Patrón buscar-por-documento-o-crear, con `alegra_contact_id` persistido en el
paciente. Solo viajan **nombre, documento y correo** (principio 7 del modelo: a la contabilidad solo van
datos de identificación).

**b) La purga es SOLO de Atlas.** En Alegra producción hay facturas reales emitidas a mano (ventas en
firme a dos Integrantes y sus notas crédito). **No se tocan**, y el inventario inicial del Bloque 1 tiene
que partir de que **esas unidades ya salieron**.

**c) `sale_lines` sella más que el reparto:** también la **tarifa de IVA** aplicada y la **modalidad
vigente del Integrante** en el momento de la venta.

**d) El acumulado anual de retención se reinicia por año calendario.**

---

## Bloque 0 · Purga y corte de arranque

**Tamaño: chico.** **Estado: HECHO el 2026-09-11.**

**Verificado contra la nube en solo lectura tras correrlo:** las siete tablas comerciales en **0**
(transacciones, items, comisiones, ingreso CNV, eventos de pasarela, movimientos y saldos), y las clínicas
intactas: 73 pacientes, 85 evaluaciones, 16 diagnósticos, 16 tratamientos, 16 reportes, 13 emisiones.

**Y los siete Integrantes existen.** Santiago creó los seis que faltaban el mismo día, por `/admin`. Sus
ids están pegados en `scripts/carga-inventario-inicial.sql`, que además comprueba que cada uno exista de
verdad antes de insertar: un uuid bien formado pero ajeno cargaría inventario a nombre de nadie, y eso no
se vería hasta que alguien buscara su stock y no lo encontrara.

**La fecha de corte es el 2026-09-11.**

### Qué construye

Un script SQL de purga, la migración del CHECK condicional, y el acta que documenta el corte.

**Al terminar:** la base queda sin ningún dato comercial de prueba, con los 73 pacientes y sus 85
evaluaciones intactos, y con la garantía de que ninguna entrega futura puede quedar sin paciente.

### Qué se purga

| Tabla | Por qué |
|---|---|
| `transaction_items` | Línea de una venta de prueba |
| `transactions` | 23 filas de prueba (13 pagadas, 10 pendientes) |
| `professional_revenue`, `cnv_revenue` | Reparto de esas ventas |
| `payment_webhook_events` | Eventos de la pasarela en sandbox |
| `nutraceutical_stock_movements` | 13 movimientos de prueba |
| `nutraceutical_inventory` | Saldo proyectado de esos movimientos, incluido el −1 |
| `nutraceutical_count_lines`, `nutraceutical_count_sessions` | Conteos (0 filas hoy) |
| `nutraceutical_faltante_transitions`, `nutraceutical_faltante_cases` | Faltantes (0 filas hoy) |

### Qué NO se purga, y se verifica

**Las nueve tablas clínicas deben salir con el MISMO conteo antes y después.** Si alguna cambia, el script
aborta y se hace `rollback`.

`patients` · `evaluations` · `diagnoses` · `treatments` · `reports` · `survey_responses` ·
`survey_answers` · `prescription_emissions` · `nutraceutical_usage`

**`nutraceutical_usage` está en esa lista a propósito**, aunque su nombre suene comercial: guarda lo que
el tratamiento PRESCRIBIÓ (producto y cantidad por tratamiento). Es dato clínico. Hoy tiene 0 filas, y el
guard existe igual: un conteo que hoy es cero seguirá siendo cero, y el día que no lo sea, protege.

Tampoco se toca el **catálogo** (`nutraceuticals`, 10 productos): es contenido, no operación.

### Modelo de datos

Sin tablas nuevas. Una migración:

```sql
ALTER TABLE nutraceutical_stock_movements
  ADD CONSTRAINT nutra_movement_despacho_exige_tratamiento
  CHECK (type <> 'despacho' OR treatment_id IS NOT NULL);
```

**Condicional y no `NOT NULL`**, por la objeción 1: recepciones, remesas y conciliaciones no tienen
tratamiento y un `NOT NULL` plano impediría recibir mercancía.

El **script de purga no es una migración**: es operación. Se entrega en `scripts/purga-comercial.sql` y lo
corre Santiago, como el de la limpieza de Demo.

### Cómo está hecho el script

Hereda el patrón de `limpieza-demo.sql`, y la herencia no es de estilo: **`nutraceutical_stock_movements`
tiene un trigger append-only**, así que borrar obliga a desactivarlo y volverlo a activar. Eso, en
Postgres, solo es seguro dentro de una transacción, porque el DDL es transaccional y un fallo a mitad
devuelve los triggers solos.

1. **Una sola transacción, con el `commit` incluido en el mismo bloque.** El SQL Editor de Supabase no
   sostiene una transacción entre ejecuciones: partirlo la pierde en silencio.
2. **Conteo ANTES** de las tablas comerciales y de las nueve clínicas.
3. **Verificación que aborta** con `raise exception` si alguna tabla clínica cambiaría, o si el conjunto a
   borrar toca algo que no es comercial.
4. **Conteo DESPUÉS**, con el estado de los triggers listado.
5. Es **idempotente**: correrlo dos veces es seguro.

### Depende de / bloquea

- **Depende de:** el conteo físico inicial (lo está haciendo Santiago). Ver "la fecha de corte" abajo.
- **Bloquea a:** todos los demás bloques.

### Criterio de aceptación

Las cifras del ANTES están medidas contra la nube el 2026-09-11, en solo lectura. Si alguna difiere al
correr el script, es que entró operación entre medias y **hay que mirarlo antes de confirmar**.

| Tabla | ANTES (medido) | DESPUÉS (esperado) |
|---|---|---|
| `transactions` · `transaction_items` | 23 · 23 | **0 · 0** |
| `professional_revenue` · `cnv_revenue` | 13 · 13 | **0 · 0** |
| `payment_webhook_events` | 1 | **0** |
| `nutraceutical_stock_movements` | 13 | **0** |
| `nutraceutical_inventory` | 4 | **0** |
| `count_sessions` · `count_lines` | 0 · 0 | **0 · 0** |
| `faltante_cases` · `faltante_transitions` | 0 · 0 | **0 · 0** |
| `patients` | 73 | **73** |
| `evaluations` | 85 | **85** |
| `diagnoses` · `treatments` · `reports` | 16 · 16 · 16 | **16 · 16 · 16** |
| `survey_responses` · `survey_answers` | 81 · 4681 | **81 · 4681** |
| `prescription_emissions` | 13 | **13** |
| `nutraceutical_usage` | 0 | **0** |
| `nutraceuticals` (catálogo) | 10 | **10** |

Y además:

1. Los triggers `nutra_movement_append_only_trg` y `nutra_faltante_transition_append_only_trg` quedan en
   `O` (activos) en la fila DESPUÉS. Si un nombre de trigger estuviera mal escrito, el `disable` **falla y
   aborta la transacción**, que es el comportamiento seguro.
2. Un `INSERT` de un movimiento `despacho` **sin** `treatment_id` falla nombrando el CHECK.
3. Un `INSERT` de un movimiento `recepcion` sin `treatment_id` **sigue funcionando**. Es la comprobación
   que distingue el CHECK condicional de un `NOT NULL`, y sin ella el Bloque 1 no podría cargar el
   inventario inicial.

### La fecha de corte

**Es el día en que se corre la purga.** No hay historia que separar. Queda en un **acta** con la fecha,
quién la corrió y la fila de conteos que el propio script produce (ANTES y DESPUÉS en pares, en una sola
fila: el editor de Supabase muestra solo el último resultado).

**La condición de "purga y carga el mismo día" no se puede cumplir**, y conviene decirlo antes de
correr nada: la carga completa necesita bodega central, lotes que gobiernen el saldo y LUVIA bien
modelado, que son **Bloque 1**. Ver `scripts/carga-inventario-inicial.sql`.

**Y el riesgo que esa condición quería evitar ya existe hoy**, que es lo que la desactiva: Atlas nunca
reflejó la operación real (108 unidades de un profesional de pruebas contra 500 recibidas y 114
entregadas entre siete Integrantes), y tampoco podría registrar hoy una venta correcta, porque no hay
lote, ni bodega central, ni factura al paciente de verdad. **Quedar en cero no quita una capacidad que se
tenga: quita una ficción.**

**Orden real:** purga → migración 0118 → crear los seis Integrantes → Bloque 1 → carga inicial → acta.
La fecha de corte sigue siendo la de la purga.

### El inventario inicial, primera tanda

Recibido del laboratorio y repartido, verificado aritméticamente el 2026-09-11:

| Producto | Alegra | Lote | Vence | Recibido | A Integrantes | Queda central |
|---|---|---|---|---|---|---|
| MULTICELL BASE | NUT-001 | 19826 | 2028-07-18 | 500 | 114 | **386** |
| OMEGA COMPLEX | NUT-002 | 20226 | 2028-07-22 | 500 | 114 | **386** |
| CURCUMIN BIOACTIV | NUT-003 | 20526 | 2028-07-25 | 426 | 114 | **312** |
| D3-K2 OSTEO | NUT-004 | 19726 | 2028-07-17 | 300 | 114 | **186** |
| LUVIA (tercero) | — | 04197232 | 2028-07-10 | 84 | 70 | **14** |

**1.284 unidades quedan en bodega central** y hoy no tienen dónde vivir. La cifra queda aquí para que no
se pierda entre la purga y el Bloque 1.

Los **PVP ya están correctos en el catálogo** (107.100 y 166.600, IVA 19% incluido → base 90.000 y
140.000, exactas). **El de LUVIA es 90.000 con IVA** (base 75.630, IVA 14.370), confirmado por
contabilidad con el proveedor: viene de redondear 89.990.

### Los siete Integrantes: falta crear seis

Verificado contra la nube. Atlas tiene cuatro perfiles profesionales y **solo uno es de esta lista**:

| Perfil en Atlas | Es Integrante de la lista |
|---|---|
| Valentina Ramírez Huertas | **Sí** |
| Gildardo Uribe | No (Dirección Científica) |
| Santi pruebas | No (prueba) |
| Profesional Demo | No (prueba; es quien tiene el inventario ficticio) |

**Faltan seis:** Katherine, Diana, María Camila, Ángela, Camilo y Roberto Jarava. Se crean **por la
aplicación**, no por SQL: un perfil profesional arrastra cuenta, rol y perfil tributario, y crearlo a mano
deja las tres cosas a medias. **Bloquea la carga inicial más que el conteo físico, y no depende de él.**

### Cómo se crean, verificado en el código

**La pantalla es `/admin`.** Pide **correo**, **nombre completo** y **rol** (hay que elegir
`professional`); al elegirlo aparecen **profesión** (obligatoria) y **tarjeta profesional** (opcional, se
puede añadir después).

**El correo automático SALE SIEMPRE, y no se puede evitar.** `createUser` usa
`inviteUserByEmail`, que envía la invitación en el acto. La API de Supabase sí tiene un `createUser` que
no manda nada, pero Atlas no la usa. **No existe "crear sin enviar el enlace".**

**Crear ahora y dar acceso después SÍ es viable**, con esta secuencia: se crea, el correo sale, el enlace
de invitación caduca si nadie lo usa, y la cuenta queda creada sin contraseña. Cuando llegue el momento de
que entren, **"Forzar cambio de contraseña"** desde `/admin` manda un correo de recuperación, que es la
puerta de entrada real. No hay acción de reenviar la invitación; la de recuperación cumple esa función.

**El correo tiene que ser el real del Integrante desde el principio.** No es preferencia:
`auth.users.email` y `profiles.email` son **dos copias del mismo dato**, y el audit `user.created` guarda
el correo en su payload. Cambiarlo por SQL después desincroniza las dos copias y deja el rastro de
auditoría apuntando a un correo que ya no existe.

### Qué más hace falta, además del perfil

| Pieza | Cómo queda al crear |
|---|---|
| **Rol** | Lo asigna el formulario, en la misma transacción |
| **Perfil profesional** | Se crea solo, con la profesión |
| **Comisión** | `professional_profiles.commission_rate` nace en 0,20. **Está por profesional, no por organización** |
| **Perfil tributario** | **Lo llena el propio Integrante** al entrar, y luego admin verifica el RUT. Requiere que entre |
| **Ubicación de inventario** | No existe todavía; hoy el inventario cuelga directo del profesional. Nada extra para la carga |

**El perfil tributario es el único que exige que el Integrante entre**, y **no bloquea la carga de
inventario**: bloquea el Bloque 4 (liquidaciones), porque sin él no se sabe qué documento emitir ni qué
retención practicar.

**Y una que conviene ver ahora, no en el Bloque 4:** `commission_rate` vive en el profesional y el reparto
de LUVIA vive en el producto (20% Integrante / 10% CNV / 70% proveedor). `revenue_splits` tiene que poder
convivir con ese campo sin que se contradigan, y decidir cuál manda. Hoy solo existe el del profesional.

### Y al crearlos, cerrar la declaración libre de recepciones

Hoy un profesional puede declarar desde `/mi-inventario` que recibió N unidades **sin nada que lo
respalde**. Con un solo perfil real eso era inocuo. Con siete, significa que siete personas pueden inventar
existencias y el saldo de apertura deja de significar algo el mismo día que se carga.

El mecanismo correcto ya existe: **CNV declara la remesa y el Integrante confirma cuánto llegó**, que puede
diferir. La recepción sin remesa queda entonces como lo que es, una discrepancia que `/faltantes` lista.
**Cerrar el camino libre va junto con crear los seis perfiles, no después.**

---

## Bloque 1 · Cimientos

**Tamaño: grande.** Corresponde a la Fase 0 del modelo.

**Al terminar:** se puede registrar un producto de tercero con su reparto, recibirlo por lote en una
bodega y consultar el saldo por ubicación.

### Lo que ya está hecho (2026-09-11, migración 0119)

**El reparto, con vigencia y con piso.** Tres tablas, un trigger y una vista:

| Pieza | Qué garantiza |
|---|---|
| `professional_commission_rates` | La tasa del Integrante **con vigencia**. Índice único parcial: una sola vigente |
| `revenue_splits` | La participación del **proveedor** por producto, con vigencia y **su umbral de aviso** |
| `commercial_config` | El umbral global por defecto. Fila única, como `ai_config` |
| `reparto_residuo_cnv_valido()` | **Trigger en las dos tablas.** Bloquea el residuo negativo |
| `combinaciones_bajo_umbral` | Vista: lo que está sobre cero pero bajo la política |
| `modules/payments/reparto.ts` | La aritmética pura del sellado, con 17 casos de candado |

**El umbral va por producto** (decisión de Santiago, y tiene razón): un producto propio deja a CNV el 80%
y uno de tercero el 10%, así que con un umbral único el propio no avisaría nunca y LUVIA avisaría desde el
primer día. Cuesta una columna anulable y un `coalesce`; ponerlo después sería migrar configuración viva.

**Y el candado destapó un defecto que no habría visto nadie:** en coma flotante `1 - 0.8 - 0.2` da
**−5,5e-17**, o sea negativo. Un reparto 80/20 perfectamente legítimo habría disparado el bloqueo de "CNV
no puede pagar por vender" por un error de la decimosexta cifra. Y el reverso: `1 - 0.7 - 0.2` da
0,10000…3, mayor que 0,1, así que el umbral del 10% no se habría disparado **nunca** justo en el caso para
el que se escribió. Se redondea a seis decimales, que además alinea la comparación con la de la base,
donde `numeric` es decimal exacto y el problema no existe.

### Lo que falta

| Tabla | Notas |
|---|---|
| `suppliers` | Proveedor externo con perfil tributario (documento + DV, responsable de IVA, agente de retención) |
| `nutraceuticals` (+) | `ownership` (`propio`/`tercero`), `brand_owner`, `supplier_id`, `alegra_item_id` |
| `revenue_splits` | Reparto configurable **por producto y proveedor**, sobre base sin IVA. Ningún porcentaje en código (principio 2) |
| `inventory_locations` | Bodega central + una por Integrante |
| `lots` | Producto, número, vencimiento, titularidad |
| `nutraceutical_inventory` (⚠ cambia) | La llave pasa a **(ubicación, producto, lote)** |
| `professional_tax_profiles` | Los campos de §9 del modelo, con validaciones cruzadas |
| `allergens`, `allergen_relations`, `nutraceutical_allergens`, `survey_option_allergens` | Ver el apartado de alérgenos |

### La bandera de disponibilidad, verificada

**Existe:** `nutraceuticals.commercial_availability` con `en_consultorio` / `solo_tienda` /
`no_disponible`. Así que **LUVIA se puede cargar como `no_disponible` y no podrá entregarse**:
`recordDespacho` lo bloquea explícitamente.

**Pero tiene un hueco, y hay que cerrarlo en este bloque antes de cargar LUVIA:** el checkout de `/pagos`
filtra el catálogo **solo por `unit_price != null`**, no por disponibilidad. Un producto marcado
`no_disponible` con precio **se puede vender hoy desde esa pantalla**. La bandera gatea la entrega y no la
venta.

Y falta lo que el modelo §7.10 pide de verdad: **disponibilidad por modalidad y por canal**, para
restringir un producto de tercero a modalidad Comisión y sin domicilio durante el piloto. El enum actual
no lo expresa.

### Criterio de aceptación · CUMPLIDO 2026-09-11, con dos partes que cambiaron de enunciado

Se escribió el 2026-09-10 y **dos de sus tres partes quedaron obsoletas por decisiones posteriores**. Se
conserva entero porque un criterio que se reescribe sin decirlo deja de ser un criterio.

| Lo que pedía | Estado |
|---|---|
| `saldo(ubicación, producto, lote)` devuelve la cifra correcta | **CUMPLE.** Cotejado contra la nube tras la carga: 38 filas de saldo, 8 ubicaciones, 1.284 en central y 526 repartidas, y lo recibido por producto cuadra con lo que entregó el laboratorio |
| `alergenosDe(LUVIA)` resuelve a `gluten` partiendo de `avena` | **RETIRADO, no incumplido.** Esa función no existe ni debe existir: Dirección Científica y el asesor legal descartaron la inferencia, cada uno por su razón. Lo que se construyó es la yuxtaposición |
| **LUVIA no aparece como vendible en ninguna pantalla** | **REVERTIDO.** LUVIA está habilitada desde el 2026-09-11: la retención colgaba de una firma que nadie había pedido |

**Lo que SÍ sobrevivió de esa tercera parte, y es lo que importaba:** el hueco del checkout era real y está
cerrado. `/pagos` filtraba solo por "tiene precio", así que un producto `no_disponible` con precio se podía
vender. Ahora lo gatea el **servicio** (`resolveSale`), no solo la pantalla, que es donde una acción recibe
ids arbitrarios. Eso protege a los seis productos que todavía no se han maquilado.

### Lo único que queda abierto del Bloque 1, y va al 5

**Disponibilidad por MODALIDAD y por CANAL** (§7.10 del modelo): restringir un producto de tercero a
modalidad Comisión y sin domicilio durante el piloto. El enum actual (`en_consultorio` / `solo_tienda` /
`no_disponible`) no lo expresa. **No bloquea nada hoy** porque no hay Integrantes en modalidad Distribución
ni domicilio activo; se construye en el Bloque 5, que es donde nacen las dos cosas que restringe.

---

## Bloque 2 · Alegra de verdad

**Tamaño: medio-grande.** Es una **reescritura** del documento, no un re-mapeo (objeción 2).

**Al terminar:** una venta emite **una** factura, al paciente, con el producto real, IVA heredado de
Alegra, con su CUFE y su estado DIAN guardados; y si Alegra no responde, la venta se sella igual y la
factura queda en una cola visible.

### Modelo de datos

| Tabla | Notas |
|---|---|
| `fiscal_documents` | Tipo (§10.2), venta, `alegra_id`, número, **CUFE**, estado DIAN, prefijo, intentos, último error |
| `invoice_queue` | Pendientes de emisión, con reintentos y alerta |
| `alegra_identifier_map` | Producto / impuesto / numeración / bodega / centro de costo → id de Alegra, **por ambiente** |
| `patients` (+) | `alegra_contact_id` (adición a) |

### Lo que cambia del código actual

- **Cliente = el paciente.** Patrón buscar-por-documento-o-crear; se persiste `alegra_contact_id`. Solo
  viajan nombre, documento y correo.
- **Ítem = el producto**, con su código de identificación (evita la observación FAZ09 de la DIAN).
- **Sin `taxes` forzado desde Atlas:** el IVA se hereda de la configuración del producto en Alegra.
- **Prefijo propio**, distinto del de la facturación manual.
- `paymentForm` según el medio de pago, no fijo en `CASH`.
- **Idempotencia:** una venta, un documento, ante timeout, reintento o doble confirmación de la pasarela.
- **Estados DIAN:** `"aprobada con observaciones"` es válida y **no se reintenta**; solo `"rechazada"`
  obliga a corregir y reemitir.
- **El consecutivo lo asigna Alegra.** Atlas nunca genera números.

### Criterio de aceptación

Una emisión de prueba en producción contra un contacto controlado sale validada por la DIAN con el
adquirente y el producto identificados y su IVA correcto; un reintento del mismo pago **no** crea un
segundo documento; con Alegra caída, la venta se sella y aparece en la cola con su alerta.

---

## Bloque 3 · La venta nace en Tratamiento

**Tamaño: grande.** No se fragmenta.

### Dónde vive dentro del flujo ANI-BIS-E

**En la pestaña Tratamiento de la evaluación, después de los indicadores y de la prescripción**, como
continuación del acto clínico. No es un módulo de ventas paralelo: es el paso siguiente a recomendar.
`/pagos` se conserva **solo** para el paciente que vuelve a comprar sin evaluación en curso.

Secuencia: seleccionar el nutracéutico → **control de alérgeno (D1)** → ¿lo adquiere? → forma de entrega →
validación de inventario → QR en pantalla → venta que **descuenta inventario al sellarse (D2)** → entrega
como estado de cumplimiento.

### Modelo de datos

| Tabla | Notas |
|---|---|
| `sales` | Reemplaza a `transactions` como raíz: tratamiento, paciente, Integrante, ubicación, canal, forma de entrega, **fecha de operación** (distinta de la de facturación), municipio |
| `sale_lines` | Producto, **lote**, cantidad, precio base, **tarifa de IVA sellada**, reparto sellado, **modalidad vigente del Integrante** (adición c) |
| `sale_fulfillment` | Estado: pendiente / entregado en consulta / despachado / entregado |
| `inventory_reservations` | **D3:** el checkout pendiente reserva; al caducar, libera |
| `nutraceutical_stock_movements` (+) | `sale_line_id`; el tipo `despacho` pasa a `venta` |

### Producto de tercero

La marca `ownership` gobierna aquí de verdad: identificación con el **titular de marca** en ficha, reporte
y factura; inventario **sin valor contable propio**; y alerta diferenciada de faltante.

### Criterio de aceptación

Una venta descuenta el lote correcto de la ubicación correcta **al sellarse**; no existe camino para
entregar sin venta; un checkout pendiente reserva la unidad y al caducar la libera; la entrega queda en
`clinical_audit_log`; la factura muestra el titular de marca; y el **reporte de ventas sin documento
fiscal** existe y se puede consultar por día.

---

## Bloque 3b · Reversa

**Tamaño: medio.** Va **inmediatamente después** del Bloque 3 (D4).

**Alcance mínimo:**

- Anulación por error.
- Devolución con **reingreso al lote de origen**.
- **Nota crédito en Alegra enlazada a la factura original.**
- **Reversión de la comisión**; si ya se liquidó, se descuenta en la siguiente liquidación.
- Para **producto de tercero**, el reingreso va a la **consignación del proveedor**, no al inventario de
  CNV (el producto nunca fue de CNV).

**Fuera de alcance:** el retracto de venta a distancia, que depende de que existan domicilios (Bloque 6).

**Criterio de aceptación:** una devolución de una unidad de producto de tercero reingresa al lote de
origen en la consignación del proveedor, genera la nota crédito enlazada a la factura original, y revierte
la comisión del Integrante.

---

## Bloques 4, 5 y 6

**4 · Liquidaciones (grande).** `/comercial`, la pantalla de comisiones del Integrante, la liquidación con
IVA y retención según perfil (**con acumulado anual que se reinicia por año calendario**, adición d), los
faltantes con su máquina de estados, y la **conciliación Atlas ↔ Alegra**. El faltante nunca es una venta:
no genera factura, ni IVA, ni comisión (principio 6).

**Y el reporte del piloto, que es lo que permite renegociar el 10%.** Por producto de tercero y por
período: unidades vendidas, margen bruto de CNV, comisión de pasarela pagada, fletes si los hubo, y margen
neto. Se anota aquí porque cruza ventas, liquidación y costos de transacción, que es lo que este bloque
arma. **Depende de un dato que hay que capturar antes:** la comisión que cobra la pasarela por
transacción, que hoy Atlas no guarda. Sin ese campo el reporte sale incompleto y el margen neto no se
puede calcular, así que el campo entra en el Bloque 3 aunque el reporte sea de este.

### El reparto de LUVIA es de piloto, y eso cambia el modelo de datos

Contabilidad acepta el **10% para CNV solo durante el piloto**, no como estructura permanente. Las tres
condiciones quedan escritas:

1. **Se renegocia antes de un segundo lote.**
2. **No hay domicilio de LUVIA durante el piloto** (ya estaba en §11.3 del modelo).
3. **Hay que medir el costo real de servirlo.**

**Consecuencia para `revenue_splits` (Bloque 1): necesita VIGENCIA POR FECHA**, y cada venta **sella el
reparto vigente en el momento en que ocurrió**.

El principio de sellado ya lo permitía. Lo que cambia es que **este es el primer caso donde sabemos de
antemano que el reparto va a moverse**, así que el modelo tiene que EXPRESARLO y no solo admitirlo: un
`revenue_splits` sin vigencia obliga a editar la fila el día de la renegociación, y editarla reescribiría
lo que ya se liquidó. Con vigencia, se añade una fila nueva y el pasado queda donde está.

**5 · Distribución (medio)** y **6 · Domicilio (grande)** siguen el modelo §11.2 Fases 3 y 4. No arrancan
sin decisiones que no son técnicas: Distribución depende del Anexo 2 actualizado y de al menos un
Integrante habilitado; Domicilio, de las ciudades habilitadas y la tarifa de flete. Su modelo de datos se
prepara en el Bloque 1 sin encender la operación.

---

## Los alérgenos

### Lo que hay hoy, verificado

- **P43 `d6_43`** — alergias diagnosticadas. Opciones: Ninguna, Leche, Huevo, Maní, **Trigo**, Soya,
  Pescado, Mariscos, **Otra** (texto libre).
- **P44 `d6_44`** — intolerancias. Opciones: Ninguna, **Lactosa (leche y lácteos)**, **Gluten (trigo, pan,
  pasta)**, Fructosa (frutas, miel), **Otra** (texto libre).

Se guardan como **arreglo de las etiquetas** y el motor las lee crudas. LUVIA declara **avena**. Ninguna
cadena contiene a la otra: **cotejar cadenas no sirve**, y es el mismo fallo que "lactosa" contra
"lácteos" en el menú, con una consecuencia peor.

### El modelo de datos, con el matiz de la avena

La primera propuesta era una equivalencia binaria (`avena → gluten`) y **no admite el matiz correcto**: la
avena por sí sola no tiene gluten, pero arrastra contaminación cruzada con trigo salvo que esté
certificada. Así que la relación no es una igualdad, es una **implicación condicionada**:

| Tabla | Campos |
|---|---|
| `allergens` | El alérgeno canónico: `gluten`, `lactosa`, `mani`… |
| `allergen_relations` | `origen`, `destino`, **`tipo`** ∈ (`directa`, `por_contaminacion_cruzada`), nota |
| `nutraceutical_allergens` | Producto, alérgeno declarado **verbatim del fabricante**, y **`certificacion_ausencia`** (p. ej. "avena sin gluten certificada") |
| `survey_option_allergens` | Opción de encuesta → alérgeno |

**La regla de resolución:** una relación `directa` siempre implica el alérgeno destino. Una
`por_contaminacion_cruzada` lo implica **salvo que el producto declare la certificación de ausencia**. Si
la ficha de LUVIA no dice "avena sin gluten certificada", se trata como gluten.

### Dos condiciones del diseño

**Se ancla al id de la opción, con su versión de encuesta**, no a la etiqueta. Si Gildardo reescribe
"Gluten (trigo, pan, pasta)", el bloqueo no puede apagarse en silencio.

**"Otra" (texto libre) nunca se puede cotejar.** Si el paciente respondió "Otra" y el producto declara
algún alérgeno, **se exige la misma confirmación que si hubiera coincidencia**. Un dato que no se puede
descartar no es un dato favorable: es la conducta que Gildardo fijó en CA-7.

### Se construye, no se enciende

El mecanismo entero se construye y la tabla se propone, pero **nada se activa en producción hasta que
Gildardo firme las equivalencias**. La razón es dura: si un celíaco recibe LUVIA porque la tabla decía que
la avena no implica gluten, el problema es de CNV, que lo prescribió y lo facturó. **Mientras tanto LUVIA
no se habilita para venta.**

La consulta está en `docs/entregas/CONSULTA_GILDARDO_ALERGENOS.md`.

---

## Lo que bloquea desde fuera del equipo

| Qué | Bloquea |
|---|---|
| Conteo físico inicial por producto, lote y ubicación | Bloque 0 (la fecha de corte) y Bloque 1 |
| **La firma de Gildardo sobre las equivalencias** | Encender el bloqueo, y con él la venta de LUVIA |
| Numeración de Atlas en Alegra (prefijo propio o compartido) | Bloque 2 |
| Perfil tributario de cada Integrante | Bloque 4 |
| ¿Existen muestras o cortesías? | Bloque 3 (si no existen, no se construye) |
| Anexo 2 actualizado y un Integrante habilitado | Bloque 5 |
