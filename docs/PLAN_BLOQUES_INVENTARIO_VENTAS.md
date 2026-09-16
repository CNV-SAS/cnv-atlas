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
| **2a** · Alegra reescrito, en SANDBOX | **HECHO (2026-09-13)** | Smoke A–F pasado en sandbox: factura DIAN aprobada con sus líneas reales, pago registrado contra la cuenta puente, contacto reusado, medio de pago con los cuatro códigos verificados, instrumento de Wompi guardado, reintento idempotente. Candados: `ambiente-de-la-venta`, `venta-rechazada-no-gasta-intentos`, `reclamo-factura-concurrente`, `medio-de-pago`, `facturacion` |
| **A** · Avisos (antes del 2b) | **HECHO Y CERRADO (2026-09-16), smoke pasado** (`SMOKE_BLOQUE_A_AVISOS.md` y `SMOKE_BLOQUE_A_RETOMA.md`). Migracion 0145. Tres defectos salieron en el smoke y quedaron corregidos: un envio fallido quedaba como "ya enviado", el formulario de "en gestion" no se cerraba al guardar, y la llave de idempotencia de Resend (dia y franja) hacia que un reenvio del mismo dia NO saliera mientras Atlas decia "enviado"; ahora la llave lleva el id de la corrida. Necesita Vercel Pro para salir a produccion | Resumen puro (`avisos-resumen`), servicio y ruta programada, aviso al Integrante, marcas en administracion, "en gestion", franja y soporte en /pagos. Candados: `avisos-resumen`, `avisos-db`, `avisos-pantalla` | Correo diario solo si hay algo que requiere accion, franja en cualquier pantalla y correo inmediato al Integrante. Sin reintento automatico |
| **2b** · Paso a producción | **PREPARADO, ESPERA** (guía en `docs/entregas/`). Santiago, 2026-09-14: primero se cierran todos los bloques y se confirma que el flujo funciona; después 2b, después Supabase Pro, y al final los Integrantes | Primero una venta real pequeña y controlada. Credenciales, cinco ítems, centros de costo y cuentas puente en producción, fila de `alegra_config`. Numeración compartida: sin trámite. El gate de ambiente ya está (0135) |
| **R** · Reconstrucción del Integrante que ya vendía | Pendiente, sin bloquear | Ver su apartado |
| **3** · La venta nace en Tratamiento | **HECHO (2026-09-15), migraciones 0138-0144.** Sesiones 1 y 2, pasos 5 a 8 y el titular de marca verificado en una factura de sandbox. Smoke de cierre pasado, incluido el filtro por día. **Anotado (2026-09-15): cada filtrado se siente lento** con pocas ventas; cada "Ver ese día" rehace la página entera (tres tandas de consultas en serie, la lista completa de transacciones sin límite y todos los pacientes), aunque solo cambia una consulta. Por medir antes de tocar: ver 3.8 | Sesión 1: servicio de venta. Sesión 2: venta en Tratamiento, anular, entrega auditada, revisión con su soporte y el efectivo no recibido. Candados: `venta-inventario`, `venta-anulacion-y-revision-db`, `payments-service`, `plazo-de-revision`, `cobro-reconocido-db`. Smokes: `SMOKE_BLOQUE_3_SESION_1.md` y `_SESION_2.md` |
| 3b · Reversa | **EN CURSO. Sesion 3 CONSTRUIDA (2026-09-16), falta su smoke; siguen la 1 y la 2** (orden de contabilidad: 3 -> 1 -> 2). Las cinco decisiones, respondidas. Empieza con el sondeo de la consulta de Wompi, que la documentacion no confirma | Registrar y sacar de las cifras, la devolucion fisica y el cotejo con Wompi. La nota credito se queda manual |
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

**D5. ~~La tabla de alérgenos se construye pero NO se enciende en producción hasta que Gildardo firme las
equivalencias. Y mientras tanto LUVIA no se habilita para venta.~~** **Superada (2026-09-12):** Gildardo
decidió sin equivalencias y LUVIA habilitada (0126); el asesor legal pidió yuxtaponer las dos
declaraciones (0127). Ver "Los alérgenos".

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

## Bloque 2a · Alegra reescrito, probado en sandbox

**Decisión de Santiago, 2026-09-11: no se va a producción todavía.** Primero el flujo entero contra Alegra
y Wompi de prueba. La razón es la que el propio modelo señala como **causa número uno de facturas mal
emitidas: cambiar de ambiente sobre código que nunca facturó bien.**

### Lo que hay hoy, verificado en el código antes de planear

`tryCreateAlegraInvoice` manda a Alegra, para toda venta y todo producto:

- el **mismo cliente** (`ALEGRA_DEFAULT_CLIENT_ID`), sea quien sea el paciente;
- **un ítem genérico** (`ALEGRA_DEFAULT_ITEM_ID`) con `quantity: 1` y el total de la venta como precio;
- y la deja en **borrador** a propósito: nunca manda `status: 'open'`, así que **nunca recibe consecutivo**.

O sea: la factura no dice a quién se le vendió ni qué se le vendió, y no es un documento fiscal. Y
`transaction_items` **sí** tiene las líneas de verdad, con producto, cantidad y precio unitario: **el dato
existe en Atlas y se descarta al facturar.**

### Y tres cosas que no estaban escritas en ninguna parte

1. **Si Alegra falla, nada lo vuelve a intentar.** El `catch` manda el error a Sentry y sigue. El
   comentario del servicio decía *"se reintenta (Wompi reenvía) o queda para un job post-MVP"*, y las dos
   mitades son falsas: **Wompi solo reintenta si NO le respondimos 200**, y le respondemos 200 porque el
   pago sí se selló; y **el job nunca se construyó**. Un pago cobrado sin documento se queda así para
   siempre y no lo detecta nadie salvo que alguien mire Sentry.
2. **`api/webhooks/alegra/` es una carpeta vacía.** Tampoco llega nada de vuelta: Atlas nunca se entera del
   consecutivo, ni de si la DIAN la aceptó.
3. **`alegra_invoice_id IS NULL` significa tres cosas a la vez** (nunca se intentó / se intentó y falló /
   no aplica). Un nulo que responde tres preguntas no responde ninguna.

### Modelo de datos · HECHO (migración 0129)

| Dónde | Qué | Por qué |
|---|---|---|
| `transactions` | `alegra_invoice_state` (`pendiente`/`borrador`/`emitida`/`fallida`) | Separa las tres cosas que decía el nulo. **Borrador no es emitida**: sin consecutivo no es documento fiscal |
| `transactions` | `alegra_invoice_number`, `alegra_emitted_at` | El **consecutivo** es lo que la DIAN reconoce y el paciente ve. `alegra_invoice_id` es el id interno: eran dos cosas guardadas como una |
| `transactions` | `alegra_attempts`, `alegra_last_attempt_at`, `alegra_last_error` | Sin contador, un reintento automático contra un error permanente (un ítem que no existe) es un bucle silencioso |
| índice parcial | `transactions_factura_pendiente_idx` | **La cola es una consulta, no una tabla.** Una tabla aparte sería una segunda fuente del mismo hecho, capaz de desincronizarse de la transacción que dice representar |
| `patients` | `alegra_contact_id` + `alegra_env` | El contacto es de la **persona**, no de la venta: se crea una vez y se reusa, para que Alegra no acumule duplicados con el mismo documento |
| `nutraceuticals` | `alegra_env` (junto al `alegra_item_id` de la 0120) | **Un id de sandbox no existe en producción.** Sin esta columna, el paso a 2b facturaría contra ítems y contactos inexistentes: exactamente el error que 2a viene a evitar |

### Lo que falta construir en 2a

1. **Contacto del paciente en Alegra**: buscar por documento o crear, guardar el id con su ambiente. Solo
   viajan **nombre, documento y correo** (principio 7: a contabilidad solo van datos de identificación).
2. **Las líneas de verdad**: una por `transaction_item`, con su ítem de Alegra, su cantidad y su precio
   base sin IVA, en vez del ítem genérico con cantidad 1.
3. **Emitir, no dejar en borrador**: `status: 'open'`, y guardar el **consecutivo** que devuelve Alegra.
4. **La cola de reintento**, con su tope de intentos y el error de la última vez, más el reporte de
   **ventas sin documento fiscal, que debe estar en cero al cierre del día** (decisión D2 de contabilidad).
5. **Y que el ambiente sea explícito**: si un contacto o un ítem son de otro ambiente, no se usan.

### Lo que añade contabilidad al alcance, y lo que se verificó de cada cosa

**1. Registrar el PAGO, no solo emitir.** Es el hueco más importante y no estaba en el plan. Una venta a
paciente **ya está pagada** cuando se factura (Wompi cobró antes), así que el pago se registra en Alegra en
el mismo acto. Si solo se emite, la contabilidad acumula cuentas por cobrar de pacientes que ya pagaron y
bancos nunca cuadra. **La única que sí queda por cobrar es la quincenal al Integrante bajo Distribución**,
que es del Bloque 5.

*Verificado:* el endpoint `/payments` del sandbox responde y está vacío. Y las facturas existentes tienen
`totalPaid: 0` y `balance` igual al total, o sea la deuda que contabilidad describe, ya visible.

**2. Centro de costo en el payload.** No estaba en el mapeo. Sin él no se puede medir rentabilidad por
línea, que es justo la pregunta abierta del margen del 10%.

*Verificado, y con un matiz que importa:* **el centro de costo no se hereda del ítem.** Los cinco ítems
del sandbox salen con `costCenter` vacío, y la factura lo trae como campo propio (`costCenter: null` en
las que hay). Así que va en el payload de la factura, producto a producto, derivado de `ownership`:
`propio` → Vitacellebis, `tercero` → Productos de Terceros. Por eso el mapa guarda los dos ids y no uno.

**3. Probar la nota crédito en sandbox.** Saber ahora si su numeración funciona por API y cómo se enlaza a
la original. Descubrirlo con ventas reales es caro.

*Y aquí hay un hallazgo que bloquea la prueba:* **la numeración de nota crédito del sandbox no es
electrónica** (`isElectronic: false`), y la factura que emitimos **sí** lo es (plantilla 16, prefijo SETP).
Una nota crédito no electrónica contra una factura electrónica no es lo que la DIAN espera. `/credit-notes`
responde y está vacío, así que el endpoint sirve; lo que falta es la numeración. **Santiago tiene que
habilitar una numeración electrónica de nota crédito en el sandbox.** Hasta entonces
`credit_note_template_id` queda **nulo a propósito**, para que el código pueda decir "no está configurada"
en vez de emitir con la que no sirve.

**4. Probar el contacto que YA existe.** Un paciente que compra dos veces tiene que reusar su contacto, no
duplicarlo: Alegra rechaza documentos duplicados y ahí es donde se rompe.

*Verificado:* el sandbox tiene **un solo contacto**, "consumidor final" con documento 222222222222, que es
el `ALEGRA_DEFAULT_CLIENT_ID` actual. O sea: hoy **todas** las facturas van a ese contacto. El caso de la
segunda compra nunca se ha ejercido. Entra al criterio de aceptación como caso propio: dos ventas al mismo
paciente producen **un** contacto y **dos** facturas.

### El webhook de Alegra: no hace falta, y se difiere

**La respuesta de la factura YA trae lo que se necesita.** Leída una emitida del sandbox, el objeto
`stamp` contiene:

- `cufe` (el identificador único que la DIAN reconoce),
- `legalStatus` (`STAMPED_AND_ACCEPTED_WITH_OBSERVATIONS` en la que hay),
- `barCodeContent` con el QR hacia el catálogo de la DIAN,
- y hasta las `warnings` que la DIAN devolvió.

Así que Atlas puede leer el estado **preguntando**, y no hace falta que Alegra le avise. Se difiere el
webhook, con una condición escrita: **el sellado es asíncrono**, así que si `stamp` viene vacío al emitir,
la transacción queda en `emitida` sin CUFE y una relectura posterior lo completa. Eso es una consulta más,
no una ruta pública nueva.

**Y una advertencia que salió de esa misma lectura:** la factura de prueba fue aceptada *con
observaciones*, y la observación es `FAZ09: debe existir el grupo de información de identificación del bien
o servicio`. Es porque el ítem genérico "PRUEBA" no tiene código de producto. Los cinco ítems reales
deberían llevar su `productKey`; conviene verificarlo antes de producción, porque en producción una
observación de esas se acumula factura a factura.


### El pago va contra CUENTAS PUENTE, nunca contra el banco

Cuando Atlas registra el pago **la plata todavía no está en el banco**: está en el bolsillo del Integrante
o retenida en Wompi. Registrarla contra Bancolombia diría que llegó cuando no ha llegado, y el banco
dejaría de cuadrar contra su extracto.

| Canal de la venta | Cuenta destino |
|---|---|
| Efectivo | **Efectivo en poder de Integrantes** (cuenta 5) |
| Pasarela (Wompi) | **Wompi por liquidar** (cuenta 6) |
| Factura quincenal al Integrante (Distribución) | **Ninguna**: queda por cobrar de verdad |

**Siempre por el valor BRUTO.** La comisión de la pasarela es un gasto de CNV y no se descuenta de la
factura al paciente: restarla ahí haría que la factura dijera que el paciente pagó menos de lo que pagó.

**Y el alcance de Atlas termina ahí.** El traslado a Bancolombia (cuando el Integrante consigna o Wompi
desembolsa) lo registra contabilidad en Alegra.

**Eso habilita dos conciliaciones que valen porque cruzan fuentes independientes** (van al Bloque 4):

- saldo de *Efectivo en poder de Integrantes* en Alegra **contra** el pendiente de consignar según Atlas;
- saldo de *Wompi por liquidar* en Alegra **contra** lo cobrado sin desembolsar según Atlas.

Dos sistemas que no se copian entre sí y que tienen que dar lo mismo.

### La política de redondeo, cerrada antes de que haya volumen

**La fuente de verdad es la BASE sin IVA**, no el PVP. Tres razones y ninguna es de gusto: es lo que
Alegra guarda en el ítem, es sobre lo que se calcula **todo** el reparto (principio 1 del modelo), y es la
única de las dos que no depende de una política de redondeo.

**Todo en pesos enteros.** Se redondean la **base** y el **IVA**, cada uno al peso, y el total es su
**suma**. No al revés: redondear el total y repartirlo dejaría con centavos la base o el IVA, y el IVA es
justo la cifra que la DIAN concilia.

```
base = redondeo(PVP / 1,19)     IVA = redondeo(base × 0,19)     total = base + IVA
```

Con los cinco productos eso devuelve **exactamente** los PVP publicados:

| PVP | base | IVA | |
|---|---|---|---|
| 107.100 | 90.000 | 17.100 | 19% exacto |
| 166.600 | 140.000 | 26.600 | 19% exacto |
| 90.000 | 75.630 | 14.370 | el 19% de 75.630 son 14.369,70; el redondeo al peso da 14.370 |

**LUVIA es el único donde el IVA no es el 19% exacto de su base, y esa diferencia de 0,30 tiene que caer
en algún sitio: cae en el IVA y NO en el total**, para que el paciente pague un número redondo y la
factura diga ese mismo número. Contabilidad ya lo había escrito así para LUVIA en la migración 0124; esto
es la misma regla, generalizada.

**Lo que había antes:** los helpers redondeaban a **dos decimales**, así que Atlas calculaba base 75.630,**25**
contra los 75.630 del ítem de Alegra. Veinticinco centavos por unidad que no significan nada y que, con
volumen, aparecen como un descuadre sin causa.

### Y cuál es la fuente de verdad del precio

El candado de vitest compara el catálogo de Atlas contra una tabla escrita **en el propio test**, y esa
tabla es una **tercera transcripción a mano**: protege contra que Atlas cambie, y no puede ver que Alegra
cambió. Un candado que compara contra una copia no ve moverse al original.

Por eso existe **`scripts/cotejo-alegra.mjs`**: lee Alegra por API y compara contra la base. Un test
unitario no debe llamar a una API externa, así que la comprobación contra la fuente de verdad se corre a
propósito. **Cuándo:** cuando alguien toque un precio en cualquiera de los dos lados, y **siempre antes
del paso a producción**. Contra la nube se corre exportando su `DATABASE_URL`.


### El smoke corre en el dominio de PRODUCCIÓN, y lo que eso implica

Santiago no usa preview: `NEXT_PUBLIC_APP_URL` es `https://atlas.cnvsystem.com` y el webhook de Wompi de
prueba apunta ahí. Es el dominio real, con la base real y sus 73 pacientes.

**La protección que ya existe, y conviene que sea deliberada y no un accidente feliz:** el mapa de Alegra
vive en `alegra_config`, **una fila por ambiente**, y hoy **solo existe la de `sandbox`**. El servicio
resuelve el ambiente desde `ALEGRA_BASE_URL` y busca su fila; si el ambiente fuera `produccion` **no hay
fila**, así que escribe *"No hay configuración de Alegra para el ambiente produccion"* y **no llama a
Alegra**.

**Consecuencia: hoy Atlas no puede emitir un documento fiscal real, pase lo que pase en Vercel.** No es
suerte: es lo que se gana al poner el mapa en la base por ambiente en vez de en variables de entorno. Con
variables, un valor cambiado a mano habría bastado para emitir de verdad.

**La segunda protección es natural:** las credenciales y la URL tienen que ser del mismo lado o la
autenticación falla. Una URL de producción con llave de sandbox da 401, ruidosamente.

**Y la que NO está cubierta por ninguna de las dos, porque no es de Alegra:** si las llaves de **Wompi**
en Vercel son de producción, un checkout de prueba **cobraría de verdad** a una tarjeta real. Eso hay que
mirarlo antes del smoke, y se ve a simple vista: las de prueba empiezan por `pub_test_` y `prv_test_`.

**Lo que hay que comprobar en Vercel (entorno Production) antes de nada:**

| Variable | Tiene que | Si no |
|---|---|---|
| `ALEGRA_BASE_URL` | contener `sandbox` | nada se emite; toda venta queda `fallida` con ese motivo |
| `ALEGRA_EMAIL` / `ALEGRA_API_KEY` | ser las del sandbox | 401 en cada intento |
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` | empezar por `pub_test_` / `prv_test_` | **un checkout de prueba cobra de verdad** |
| `WOMPI_EVENTS_SECRET` | ser el del panel de pruebas | el webhook llega y se rechaza por firma: "el pago se hizo y Atlas no se enteró" |


### Criterio de aceptación

En sandbox, de punta a punta:

1. Se crea el checkout de un paciente en modalidad Comisión y **Wompi de prueba lo paga**.
2. El webhook sella el pago, **se crea el contacto del paciente en Alegra** (o se reusa el suyo).
3. Sale **una factura EMITIDA con consecutivo** (`SETP9902147xx`), cuyas líneas son los productos realmente vendidos, con su cantidad, su precio base y su **IVA al 19%**, y con su **centro de costo** según la propiedad del producto.
4. **El pago queda registrado contra la cuenta PUENTE que corresponde al canal**, por el valor bruto: `totalPaid` igual al total y `balance` en cero. Una factura emitida con saldo pendiente es el defecto que este punto viene a evitar, y una registrada contra el banco es el otro.
5. **Una venta de TRES productos distintos produce TRES líneas**, cada una con su ítem, su cantidad, su precio base y su IVA. Es el caso más común en una consulta real y **es el que nunca se ha ejercido**: con el ítem genérico toda factura tiene una sola línea con cantidad 1.
6. **Una segunda venta al MISMO paciente reusa su contacto**: un contacto, dos facturas. Alegra rechaza documentos duplicados y ahí es donde se rompe el patrón buscar-o-crear. Hoy el sandbox tiene **un solo contacto** ("consumidor final"), así que este caso tampoco se ha ejercido nunca.
7. **Una nota crédito sobre una factura emitida sale con la numeración electrónica (NTC) y CON REFERENCIA a la factura original.** La referencia no es opcional: en este flujo una nota crédito sin referencia significaría que algo se rompió, no que se emitió suelta.
8. **Y la validación previa RECHAZA emitir si alguna línea no trae impuesto.** Es el blindaje del hallazgo del IVA al 0%: sin él la factura sale validada por la DIAN, solo que sin IVA, y en producción eso es IVA no cobrado que CNV asume de su margen. Falla en silencio, así que el control tiene que ser previo y no una revisión posterior.
9. Una venta a la que se le fuerce un fallo de Alegra queda en `fallida` con su motivo, aparece en la cola, y el reintento la emite.
10. Y el **reporte de ventas sin documento fiscal está en cero** al terminar (decisión D2 de contabilidad).

**Fuera de este criterio:** nada. La numeración electrónica de nota crédito quedó habilitada el 2026-09-12 (plantilla 17, prefijo NTC).

---

## Bloque 2b · Paso a producción

**2a pasó su criterio el 2026-09-13.** El 2b va el 2026-09-14, de último en el día (decisión de Santiago).

### PRIMER PASO: la primera factura de producción es una venta ELEGIDA, no la primera que caiga

**Decisión de contabilidad, 2026-09-13.** Una venta real, **de bajo monto y controlada**: un comprador que
sabe que es la primera, cuyo correo es conocido, y con alguien mirando la factura en Alegra en cuanto sale.

**Por qué:** si algo quedó mal mapeado (un ítem, el IVA, el centro de costo, la cuenta puente, el medio de
pago), conviene descubrirlo en **una** factura de 90.000 que se corrige con **una** nota crédito, y no en un
día con diez ventas, diez facturas mal emitidas y diez notas crédito.

**Consecuencia operativa:** entre el cambio de credenciales y esa venta **no se cobra nada más**. Solo
cuando esa factura se coteja completa (líneas, IVA, centro de costo, consecutivo FE, CUFE, pago contra la
cuenta puente, medio de pago, y el correo recibido) se abre la venta normal.

### LA NUMERACIÓN SE COMPARTE (contabilidad, 2026-09-13)

Contabilidad revisó su propia recomendación de prefijos diferenciados (modelo comercial, "Numeración
compartida"): **el choque de consecutivos no existe**, porque Alegra asigna el número en los dos casos, y el
volumen manual es de seis facturas. **Atlas continúa la numeración que ya existe:** en producción hay FE1 a
FE6 y NC1 y NC2 emitidas a mano, y la primera de Atlas será la siguiente que Alegra asigne.

**Así que el trámite de numeración NO hace falta.** Lo que sí se lee por API antes de insertar la fila de
producción: que esa numeración sea electrónica, que esté vigente y que le quede rango.

### Lo que hace falta, reducido

1. **Credenciales de Alegra de producción** (`ALEGRA_EMAIL`, `ALEGRA_API_KEY`, `ALEGRA_BASE_URL`), y las de Wompi de producción.
2. **Crear los cinco ítems en Alegra de producción** (MULTICELL, OMEGA, CURCUMIN, D3-K2, LUVIA), con su precio base y su IVA del 19%. Los ítems del sandbox no valen: la columna `alegra_env` (0129) impide usarlos por error.
3. **Centros de costo y las dos cuentas puente** en producción ("Efectivo en poder de Integrantes", "Wompi por liquidar").
4. **La fila de producción de `alegra_config`** con los ids leídos por API (plantillas FE y NC, IVA, centros de costo sin invertir, cuentas puente) y el mapeo de ítems. Antes de encender, `scripts/cotejo-alegra.mjs` contra producción.
5. **La venta pequeña** del primer paso.

### PREPARADO el 2026-09-13, sin credenciales

**La guía paso a paso:** `docs/entregas/GUIA_2B_PASO_A_PRODUCCION.md`. Comprobaciones previas, ventana,
venta controlada con su lista de revisión, y vuelta atrás.

| Pieza | Qué hace | Ensayada |
|---|---|---|
| `scripts/leer-alegra.mjs` | Lista numeraciones (vigencia y rango), IVA, centros, cuentas e ítems con sus ids; solo GET | Contra el sandbox |
| `scripts/config-alegra-produccion.sql` | Fila `produccion` de `alegra_config` y los cinco productos a sus ítems; aborta con un `<LLENAR>`, ids repetidos, centros o cuentas iguales, o un producto vendible fuera de la lista | En local: sin llenar, lleno, ítem repetido, centros iguales, producto faltante, dos veces seguidas |
| `scripts/vuelta-atras-alegra-sandbox.sql` | Desde la 0144, COMPRUEBA que los ítems del sandbox siguen (y repone el que falte); ya no hace falta devolverlos | En local, ensayado el 2026-09-14 |
| `scripts/cerrar-checkouts-pendientes.sql` | Cierra los checkouts pendientes antes de cambiar de ambiente | En local |
| `scripts/cotejo-alegra.mjs` (corregido) | Ahora coteja la fila del ambiente de la URL, compara **nombres**, detecta un producto vendible sin mapear, revisa vigencia y rango de la numeración, y pagina | Control: con OMEGA y MULTICELL cruzados en local, falla por nombre; restaurado, limpio |

**Dos hallazgos de la preparación, y lo que se hace con cada uno:**

1. **El mapa de ítems es de UN ambiente por producto** (`nutraceuticals.alegra_item_id` + `alegra_env`).
   Pasar a producción sobrescribe los ids del sandbox, así que la vuelta atrás necesita su propio script, y
   entre aplicar la configuración y redesplegar no se puede facturar nada. **Mañana:** se cubre con la
   ventana y el script de vuelta atrás. **Después:** un mapa por (producto, ambiente) en el Bloque 3, que
   ya reescribe las líneas de venta. **HECHO (migración 0144, 2026-09-14):** `alegra_items`, una fila por
   producto y ambiente; configurar producción ya no toca el sandbox, y la vuelta atrás de ítems quedó como
   comprobación.
2. **`wompi_env` se fija al CREAR el checkout y la llave con que se cobra la pone la página al ABRIRSE.** Un
   link creado antes del cambio y pagado después cruza de ambiente: dinero real marcado como prueba (nunca
   se factura), o, tras una vuelta atrás, dinero de prueba marcado como real (se le emitiría factura al
   volver). **Mañana:** se cierran los checkouts pendientes antes de cambiar (B1 y F2 de la guía).
   **Después del 2b:** sellar el ambiente desde el evento de Wompi, que trae `environment`, y rechazar la
   venta si contradice la fila. No se hace hoy porque es código de pagos y va a producción mañana.

### Hallazgo del smoke del Bloque 3 (2026-09-14): la factura que se emite y no vuelve

La emisión (con el sellado DIAN en la misma llamada) tardó más que el timeout de 15 s: Alegra emitió SETP990214715, Atlas la dio por `fallida` sin id y **un reintento habría emitido una segunda**. La idempotencia cubría los intentos simultáneos y los reintentos después de guardar el id; **no este caso**.

**Arreglado:** la factura lleva la referencia de la venta en `observations` (verificado en el PDF: no se imprime; `anotation` sí), se **busca y adopta antes de emitir** y otra vez si la emisión se corta, la emisión espera **60 s** (medido: 12,9 s en el sandbox), y las funciones que facturan declaran `maxDuration = 180`. La fecha de la factura pasa a ser la de **Colombia** (era UTC). Para las facturas sin referencia: `scripts/adoptar-factura-alegra.mjs`. Candados: `factura-huerfana-db`, `factura-sin-respuesta`.

**Qué hacer en la ventana si pasa con la venta controlada:** guía, **F1b**.

**Barrido de las demás escrituras externas:** el contacto ya se buscaba por documento, y el pago se encuentra por el saldo de la factura releída (probado con un corte en el pago). **Pendiente, fuera de pagos:** los correos de Resend. Su timeout corta la espera sin cancelar el envío, así que un reintento puede mandar el mismo correo dos veces. El arreglo ahí es otro: Resend acepta una clave de idempotencia por envío.

### El correo al cliente

**En producción Alegra lo manda solo.** Su ayuda para Colombia dice que al emitir un documento electrónico
se envía automáticamente al correo registrado en el contacto, que el envío automático se activa al
habilitar la facturación electrónica, y que solo se envían los documentos aceptados o aceptados con
observaciones. Atlas no tiene que llamar a nada: el contacto ya viaja con el correo del paciente.

**En el sandbox, no está verificado.** La documentación no dice nada del sandbox, y la API **no expone** si
se envió un correo: la factura trae `client.email` y ningún campo de envío (leído en SETP990214712 a 714).
Por eso la venta pequeña de producción incluye "el correo llegó" en su cotejo.

### Conciliación y comisión: lo que respondió contabilidad (2026-09-13)

**La comisión de Wompi va en DOS CAPAS que no se confunden.**

| Capa | Para qué | Cuándo |
|---|---|---|
| **Estimada, por venta** | Gestión. Es la que **desbloquea el reporte del margen de LUVIA** | Al sellar la venta, con la tarifa de Wompi por instrumento |
| **Real, al desembolso** | Contabilidad, con la factura de Wompi | Cuando Wompi liquida |

Y una **verificación periódica** que compare la acumulada estimada contra la real. **Si divergen, la tarifa
está mal**, y es la única forma de saberlo.

**Tres reportes, no dos, y como PANTALLAS CONSULTABLES, no reportes programados:**

1. **Pendiente de consignar por Integrante, CON ANTIGÜEDAD.** *"200.000 de hace tres días es normal; de hace
   cinco semanas es un problema."* Sin la columna de días, los dos se ven igual.
2. **Cobrado por Wompi sin desembolsar.**
3. **Composición del desembolso**: qué ventas componen el depósito que entró hoy. **Es el que faltaba, y
   sin él conciliar el extracto es imposible.**

### LO QUE NINGUNO VIO: la retención en la fuente de Wompi

Wompi es de Bancolombia, así que **es probable que practique retención en la fuente**. Si la practica, lo
que llega al banco no es *bruto − comisión* sino ***bruto − comisión − retención***.

**Y el tratamiento es opuesto:** la comisión es **gasto**; la retención es **anticipo de renta a favor de
CNV**, recuperable con su certificado. **Tratarlo todo como comisión sería registrar como gasto un activo.**

**Verificado en el código: el webhook de Wompi NO trae esa información, y no por un descuido nuestro.** El
evento de transacción informa el cobro (monto, estado, instrumento), no la liquidación. La comisión y la
retención aparecen en el **desembolso**, así que se leen del reporte de liquidación de Wompi y de su
certificado de retención, no del webhook. Consecuencia para el reporte 3 (composición del desembolso):
tiene que separar **tres** cifras por depósito, no dos, y la retención va a una cuenta de activo.

**Pendiente de confirmar con Wompi o con la primera liquidación real:** si practica retención, a qué
tarifa, y sobre qué base (bruto o neto de comisión).

### El medio de pago en la factura

**HECHO el 2026-09-13.** Es **informativo**: no cambia impuestos ni valores. La tabla final, con los códigos
de Alegra verificados leyendo facturas del sandbox y el número DIAN confirmado por contabilidad:

| Medio | Wompi | Alegra | DIAN |
|---|---|---|---|
| Tarjeta crédito | `CARD` + `CREDIT` | `CREDIT_CARD` | 48 |
| Tarjeta débito | `CARD` + `DEBIT` | `DEBIT_CARD` | 49 |
| Transferencia débito | PSE, Nequi, transferencia Bancolombia | `DEBIT_TRANSFER` | 46 |
| Efectivo | (venta en efectivo) | `CASH` | 10 |

El 46 es "Transferencia Débito Interbancario", que Alegra abrevia como "Transferencia débito"; el 47
("Transferencia débito bancaria") es otra opción y no se usa. Confirmado en real: la venta de LUVIA con Visa
de prueba (SETP990214714) salió con "Tarjeta crédito". Detalle y evidencia en
`src/modules/payments/medio-de-pago.ts`; candado en `medio-de-pago.test.ts`.

### GATE DE 2b: las ventas del smoke viven en la base de producción, y no saben de qué ambiente son

**RESUELTO el 2026-09-13 con la salida recomendada** (migración 0135: `wompi_env` y `alegra_env` en
`transactions`, estado `rechazada` que no gasta intentos). Candados: `ambiente-de-la-venta` y
`venta-rechazada-no-gasta-intentos`. El análisis se conserva porque explica por qué existen.

**Encontrado el 2026-09-13 al analizar la venta del paciente real que el guard rechaza.** No se arregla
antes de 2b porque en sandbox no hace daño; se arregla ANTES de cambiar las credenciales, o el cambio
emite documentos fiscales reales.

**El guard de `is_test` cubre QUÉ PACIENTE, no QUÉ PAGO.** La venta del smoke de 107.100 es un pago con
tarjeta de PRUEBA de Wompi a un paciente REAL:

- En sandbox el guard la rechaza (paciente real contra sandbox), y está bien.
- **Al pasar a producción, paciente real contra producción queda PERMITIDO.** La cola, que la tiene en 3 de
  5 intentos, la reclamaría y **emitiría una factura electrónica real, con consecutivo real, por un pago que
  nunca movió dinero**, y registraría 107.100 en "Wompi por liquidar" que no van a llegar.

**Y hay un segundo caso, peor.** `transactions.alegra_invoice_id` guarda el id interno de la factura, que
**es de un ambiente concreto**, y la transacción **no registra de cuál**. La venta SETP990214706 está
`emitida_sin_sellar` con la factura 7 del sandbox. En producción seguiría siendo reclamable, y el reintento
**leería la factura 7 de PRODUCCIÓN**, que es otro documento de otra persona, y podría registrarle un pago.

**La causa es de las que ya conocemos:** `patients` y `nutraceuticals` tienen `alegra_env` justo para que
un id de un ambiente no se use en otro. `transactions`, que es la que guarda el id de la factura, **se quedó
sin la suya**. Es una regla que vive en varios sitios y se aplicó en dos de tres.

**Las dos salidas, antes de 2b:**

| | |
|---|---|
| **Recomendada** | `transactions.alegra_env` (y el ambiente de Wompi del pago), escritos al emitir y al sellar. El reclamo solo toca ventas de SU ambiente. Es el mismo mecanismo que ya tienen pacientes y productos |
| Alternativa | Purgar las ventas del smoke antes de cambiar credenciales, como la purga del Bloque 0. Funciona, pero es un paso manual de un solo uso que se olvida, y no protege a la siguiente tanda de pruebas |

**Y el contenido anterior de este bloque se conserva abajo**, porque su análisis sigue siendo válido; lo que cambió es que se parte en dos.

### (análisis original del Bloque 2, escrito el 2026-09-10)

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
- ~~Prefijo propio, distinto del de la facturación manual.~~ **Revisado por contabilidad el 2026-09-13: numeración compartida** (ver arriba).
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

> **PLAN DE EJECUCIÓN DEL 2026-09-13, APROBADO POR SANTIAGO EL MISMO DÍA.** Escrito después de verificar el
> estado real del código (inventario, Tratamiento, pagos, tableros y RLS). Donde contradice el "Modelo de
> datos" original de más abajo, **manda este plan**; el original se conserva como historia.
>
> **Las cinco decisiones, cerradas (Santiago, 2026-09-13):**
>
> 1. **Extender `transactions`**, no reemplazarla.
> 2. **Purgar las ventas de prueba** después de la venta controlada: `scripts/purga-ventas-de-prueba.sql`
>    (paso D de la guía del 2b), ensayado con fixtures y con control de aborto.
> 3. **Sin conteos hasta el Bloque 3**, y toda venta en consulta con su entrega registrada. Va **por
>    escrito**: `docs/entregas/AVISO_INTEGRANTES_VENTAS_Y_ENTREGAS.md`.
> 4. **Una venta pagada sin saldo se sella igual y avisa.** El dinero es de CNV pase lo que pase con el
>    inventario.
> 5. **Muestras y cortesías no existen:** no se construyen. **Pagos mixtos: una sola factura por el total,
>    aunque sean dos cobros** (decidido antes: `PLAN_FACTURACION.md`, `BACKLOG.md`). No era una pregunta
>    abierta y se listó como tal sin buscarla. **Lo que sí es trabajo:** el código actual no tiene flujo
>    mixto, y si alguien cobrara una venta en dos transacciones hoy saldrían dos facturas. El servicio de
>    venta del Bloque 3 (3.4, paso 3) lo implementa como una venta con dos cobros y un documento.
>
> **Adelantado del 3.4 al 2026-09-13, con candados de base real y control:**
>
> - **Paso 5, el reparto con el proveedor** (commit `94ecf611`), subido de prioridad por Santiago: LUVIA
>   registraba 60.504 de ingreso de CNV por venta en vez de 7.563. Se cablearon `repartir` y
>   `revenue_splits`, que existían sin usarse. Queda para el 3 sellar el reparto **en la línea**.
> - **Paso 1, las tres lecturas de saldo por lote** (commit `dd67a041`).

### 3.0 · La decisión de fondo: `transactions` NO se reemplaza, se extiende

El plan original decía *"`sales` reemplaza a `transactions` como raíz"*. Se escribió el 2026-09-10, **antes**
de que el 2a endureciera `transactions`: estado de factura, reclamo con arriendo, intentos, ambiente de
Wompi y de Alegra, instrumento de pago, CUFE y pago registrado. Mañana eso va a producción.

**Lo que hoy cuelga de `transactions`** (120 referencias en 18 archivos): la facturación entera, el
webhook de Wompi, la venta en efectivo, el link de pago, el panel de reintento, tres tableros
(`getDireccionDashboard`, `getTablero`, `getTaxStatusView`), cuatro políticas RLS de lectura de las que
dependen `/pagos`, el tablero del profesional y su banner tributario, y los índices parciales de 0133 y 0134.

**Lo que el Bloque 3 necesita de una "venta"** (tratamiento, ubicación, forma de entrega, fecha de
operación; y por línea: lote, IVA sellado, reparto sellado, modalidad) **cabe en columnas de
`transactions` y `transaction_items`**. Ninguna pieza del Bloque 3 exige una tabla raíz nueva.

**Y el argumento que decide:** `transactions` hoy funde tres cosas: la **venta**, el **pago** y el
**documento fiscal**. De las tres, **la que de verdad es una por fila es la venta**. Las que se van a
separar son las otras dos:

- el **pago**, si una venta se paga mitad efectivo y mitad Wompi (hoy son dos transacciones);
- el **documento**, en Distribución (Bloque 5), donde **una** factura quincenal cubre **muchas** ventas, y
  en la reversa (3b), donde una nota crédito referencia una factura.

Así que la fila que se queda como raíz es la correcta, y lo que saldrá de ella algún día es
`fiscal_documents` (y quizá `payments`), **no** `sales`. Reemplazarla hoy sería reescribir la facturación
recién probada para mover lo único que no hace falta mover.

| | **Recomendado: extender** | Reemplazar por `sales` |
|---|---|---|
| Datos existentes | Se quedan donde están | Se copian 1 a 1 a `sales`/`sale_lines`, con FK repuntadas en comisión e ingreso |
| Facturación del 2a | No se toca (salvo 3.7) | Se reescribe: sus 31 referencias leen de otra tabla |
| RLS y tableros | Siguen igual | Cuatro políticas y tres lectores nuevos |
| Riesgo al desplegar | Migraciones solo aditivas | Ventana de doble escritura o corte en frío |
| Lo que deja pendiente | El nombre (`transactions` es "la venta") y la separación del documento en el Bloque 5 | Nada de nombre; el documento sigue igual de fundido |

**Si se aprueba "extender"**, en adelante "la venta" es una fila de `transactions`, y el plan lo dice así.

### 3.1 · Qué pasa con las ventas existentes

**Hay dos clases, y no se tratan igual.**

**Las de PRUEBA del smoke (`wompi_env = 'test'`).** Viven en la base de producción, **después de la fecha
de corte** del Bloque 0, que dice *"a partir de ella, todo registro es real"*. **Hoy ya contaminan**
(verificado en el código, sin filtro de prueba en ninguno):

- `getDireccionDashboard`: cobrado bruto, ingreso de CNV y comisiones, desde siempre.
- `getTablero`: ventas y comisión del mes del profesional.
- **`getTaxStatusView`: la comisión pendiente del profesional, que alimenta su banner tributario.** Si el
  smoke le asignó comisión a un Integrante real, su acumulado ya está inflado.

**Decisión que se pide (D-3a):**

| | |
|---|---|
| **Recomendada: purgarlas** con un script de un solo uso (solo filas `wompi_env = 'test'`, con su comisión, su ingreso y sus eventos), **después de la venta controlada del 2b y antes de la primera liquidación** | Es lo que dice la fecha de corte. Y desde el 2b ya no nacen ventas de prueba en producción: las llaves son reales |
| Alternativa: filtrarlas en cada lector | Son tres lectores hoy y los del Bloque 4 mañana. Es la regla que vive en varios sitios y se olvida en uno |

Las facturas del sandbox que referencian no se afectan: son de otro sistema.

**Las REALES, desde mañana hasta que el Bloque 3 se despliegue.** Se quedan como están, con las columnas
nuevas en nulo. **No se les descuenta inventario hacia atrás**, y la razón es concreta: mientras tanto el
Integrante registra la entrega por separado (`despacho` en Tratamiento), así que descontar la venta
**restaría dos veces** las mismas unidades. La fecha de despliegue del Bloque 3 queda escrita como el corte
entre "venta que no mueve inventario" y "venta que lo mueve".

### 3.2 · Cómo se migra: no hay migración de datos

> **LO QUE QUEDÓ CONSTRUIDO EN LA SESIÓN 1 (2026-09-13), y en qué se aparta de lo escrito abajo:**
>
> - **`0138`** agrega el tipo `venta`. **`0139`** agrega a `transactions` `treatment_id`, `location_id`,
>   `delivery_mode`, `operated_at` y además **`stock_state` y `stock_last_error`**, que no estaban
>   escritos: el descuento es un estado propio de la venta (reservado, pendiente, descontado, sin_saldo,
>   fallido, liberado) porque corre **después** del pago y puede fallar sin deshacerlo. Agrega el vínculo
>   movimiento-línea con su CHECK y la tabla `inventory_reservations`.
> - **El CHECK compara `type::text`**, no el literal del enum: drizzle aplica juntas las migraciones
>   pendientes, y nombrar `venta` como enum en la misma corrida daría 55P04. Ensayado aplicando las dos
>   juntas.
> - **Diferido, a propósito:** `sale_fulfillment` pasa a la **sesión 2**, que es la que diseña la entrega;
>   y las columnas selladas de la línea (`vat_rate`, `commission_rate`, `supplier_share`, `modality`)
>   van con el **paso 5**. Crearlas hoy sin quien las escriba sería una columna declarada sin escritor.
> - **La reserva vence con el link** (`CHECKOUT_TTL_MS`, la misma constante), y una reserva vencida no
>   necesita limpieza: deja de contar.
> - **CONFIRMADO por Santiago (2026-09-13):** una venta sin profesional (la crea un administrador para un
>   paciente sin Integrante asignado) sale de la **bodega central**: ese paciente no tiene de dónde
>   descontar, y la central es de CNV.

**Solo DDL aditivo, sin backfill:**

1. **Migración A, sola:** `ALTER TYPE nutraceutical_movement_type ADD VALUE 'venta'`. Va sola porque un valor
   nuevo de enum no se puede usar en la misma transacción que lo crea (el 55P04 que ya mordió en 0133).
2. **Migración B:**
   - `transactions` (+): `treatment_id` (nulo permitido, porque `/pagos` sin evaluación es legítimo),
     `location_id`, `delivery_mode`, `operated_at`.
   - `transaction_items` (+): `lot_id`, `vat_rate`, `commission_rate`, `supplier_share`, `modality`, todos
     sellados al vender.
   - `nutraceutical_stock_movements` (+): `transaction_item_id`, con CHECK `type <> 'venta' OR
     transaction_item_id IS NOT NULL`. Una línea puede salir de **varios** lotes, así que el vínculo va
     del movimiento a la línea y no al revés.
   - Tablas nuevas: `inventory_reservations` (línea, ubicación, lote, cantidad, vence, liberada, consumida)
     y `sale_fulfillment` (una por venta: pendiente, entregado en consulta, despachado, entregado).
3. El CHECK de 0118 (`despacho` exige tratamiento) **se conserva**: hay despachos reales de mañana a
   Bloque 3 y la regla sigue siendo cierta para ellos. Lo que cambia es que **deja de escribirse `despacho`**.

**Orden de despliegue:** migraciones primero (`db:check` en la nube), código después. Todas son nulas o
nuevas, así que el código viejo sigue funcionando con ellas aplicadas; al revés no.

### 3.3 · Qué se rompe mientras tanto

#### Lo que ya está vivo desde mañana, antes del Bloque 3

Nada de esto lo introduce el Bloque 3: existe hoy y **empieza a importar mañana**, porque hay dinero real.

1. **Vender y entregar no se hablan.** La venta (`/pagos`) no mueve inventario; la entrega (`despacho` en
   Tratamiento) sí, y no sabe de la venta. Con plata real:
   - una venta **sin** su despacho deja el saldo del Integrante **alto** (tiene menos de lo que Atlas
     cree);
   - un despacho **sin** venta es producto entregado sin factura, y el reporte de ventas sin documento
     **no lo ve**, porque no hay venta;
   - y el **paciente que vuelve solo a comprar** no puede tener despacho, porque el despacho exige
     tratamiento, así que esa venta **nunca** baja el saldo.

   **Consecuencia: un conteo físico antes del Bloque 3 abre faltantes por ventas legítimas**, con el PVP
   sellado y un plazo en días hábiles. Es el caso del Bloque R, extendido a los siete.
   **Decisión que se pide (D-3b):** hasta el Bloque 3, **no se corren conteos** (es un formulario al que
   hay que ir a propósito y solo cada Integrante cuenta lo suyo, igual que en R), y cada venta en consulta
   se acompaña de su despacho. Se ofrece una **consulta de lectura diaria** que cruce ventas pagadas contra
   despachos por paciente y producto, para que contabilidad vea los descuadres antes de que se acumulen.

2. **Tres errores de lectura de saldo desde la 0121, latentes.** El saldo pasó a ser por lote y tres
   lectores siguen leyendo una fila por (profesional, producto):
   - `getOwnInventory` y `getOwnStockByIds` arman un `Map`, así que **el último lote pisa al anterior** en
     vez de sumarse (`/mi-inventario` y "Tu saldo" en la entrega);
   - `recordDespacho` relee el saldo con `.maybeSingle()`, que **falla con dos lotes** y hace que la
     pantalla avise de saldo negativo sin que lo haya.

   **Hoy no se ven** porque la carga creó un solo lote por producto. **Aparecen con la primera remesa de un
   lote nuevo.** Van primero en el bloque (3.4, paso 1) y pueden adelantarse sin tocar pagos.

3. **LUVIA cuenta como ingreso de CNV lo que es del proveedor.** `sealAccounting` lee la tasa **viva** de
   `professional_profiles.commission_rate` e ignora `revenue_splits`, que existe con vigencia desde la 0119
   y **no lo lee nadie**. La factura está bien; lo inflado es el tablero de Dirección (`cnv_revenue` =
   base − comisión, sin descontar el 70% del proveedor). Se corrige en 3.4, paso 5.

4. **Soporte no ve `transactions`** (la RLS de 0003 admite admin, dirección y el profesional dueño). Anotado,
   no bloquea.

#### Lo que se rompería durante el cambio, y cómo se evita

| Riesgo | Cómo se evita |
|---|---|
| **Dos caminos de venta** (Tratamiento y `/pagos`) con reglas distintas | **Un solo servicio de venta** que reserva, sella y descuenta. `/pagos` pasa a ser solo una pantalla que lo llama con `treatment_id` nulo. Los dos caminos cambian **en el mismo despliegue**, así que no hay ventana con uno viejo y otro nuevo |
| **El webhook sella el pago y ahora también mueve inventario**; los triggers del movimiento pueden lanzar error (lote de otro producto, ubicación incoherente) y un error **deshace el sellado del pago** | El pago se sella **siempre primero y solo**. El movimiento va después, y si falla queda en una cola visible, igual que la factura. **Una venta pagada nunca se pierde por un problema de inventario** |
| **Checkouts creados antes del despliegue** no tienen reserva | Se cierran al desplegar con `scripts/cerrar-checkouts-pendientes.sql`, el mismo del 2b |
| **Pago que llega cuando la reserva ya venció** (el link vale 24 h, el paciente paga a las 23:59 y el evento llega a las 00:01), o sin saldo | **Decisión que se pide (D-3c):** se sella igual y se descuenta de lo que haya, con alerta si no alcanza. Bloquear una venta ya pagada no es opción. Falta verificar si el trigger de coherencia admite saldo negativo por lote; se comprueba en 3.4, paso 2 |
| **`despacho` escrito a mano en tres sitios** (`getDespachosForTreatment`, la etiqueta de `/mi-inventario`, un test) | "Entregas a este paciente" lee `despacho` **y** `venta`; la etiqueta de `venta` se agrega. No se renombra nada |
| **El ambiente de Wompi se fija al crear el checkout** (hallazgo del 2b) | Se corrige aquí, porque el sellado se reescribe igual: el ambiente se toma del evento de Wompi (`environment`) y la venta se rechaza si contradice la fila |

### 3.4 · Sub-tareas, en orden (un commit cada una)

1. **HECHO (`dd67a041`).** Los tres errores de lectura de saldo por lote.
2. **HECHO (sesión 1).** Migraciones A y B, con test contra base real: un movimiento `venta` sin línea se
   rechaza, y el saldo por lote se mueve.
3. **HECHO (sesión 1), smokeado el 2026-09-14.** El servicio de venta: reserva al crear el checkout, descuenta al sellar (FEFO por lote, varios lotes
   si hace falta), libera al vencer, el pago primero y el inventario después, y el ambiente desde el
   evento. `/pagos` (checkout y efectivo) pasa a usarlo. Tests de base real para cada regla.
   **Queda para la sesión 2:** el aviso EN PANTALLA de las ventas `sin_saldo` y `fallido` (hoy quedan en la
   venta y en Sentry, y el botón de reintentar ya reintenta el descuento).
4. **HECHO y smokeado (sesión 2, 2026-09-14; ver 3.6).** **Tratamiento:** "¿lo adquiere?" → forma de entrega → QR en pantalla, **reemplazando** a la sección de
   despacho. La entrega queda en `clinical_audit_log` (Decisión 3 del plan; hoy **nada** de pagos, entrega
   ni inventario escribe auditoría). La yuxtaposición de alérgenos ya está en la selección (D1).
5. **A MEDIAS: el cálculo ya lee `revenue_splits` (`94ecf611`); falta SELLARLO en la línea.** Reparto sellado por línea desde `revenue_splits` y `professional_commission_rates` con vigencia,
   reemplazando la tasa viva. La parte del proveedor queda sellada en la línea; su cuenta por pagar es del
   Bloque 4.
6. **El reporte de ventas sin documento, consultable por día.** El panel ya existe; le falta el filtro
   por fecha.
7. **La factura muestra el titular de marca** (criterio de aceptación). **Es lo único que toca la
   facturación del 2a.** Decía "va último, cuando producción lleve días estable"; con el orden de Santiago (2026-09-14: 2b después de cerrar todos los bloques), se hace y se prueba en **sandbox**, antes del 2b.
8. **Mapa de ítems por (producto, ambiente)** (hallazgo del 2b). Opcional dentro del bloque: no bloquea
   nada y quita el paso de vuelta atrás de ítems.

### 3.5 · Lo que dejó el smoke de la sesión 1 (2026-09-14), para decidir antes de la sesión 2

**Verificado en real:** reserva por FEFO en varios lotes, sin existencias no hay checkout, "Generar de todos modos", descuento al pagar, venta pagada sin saldo que no toca la reserva viva de otra venta, y la adopción de una factura cuya respuesta se perdió.

**1. Un rechazo en la página de pago no avisa, y el link retiene sus unidades 24 horas.** En el sandbox, la tarjeta que declina se rechaza dentro de la página de Wompi **sin crear transacción** (la API de Wompi no muestra ninguna rechazada), así que no hay evento. El link sigue pagable, y por eso su reserva sigue viva: eso es correcto. **Lo que importa en producción:** un link abandonado inmoviliza inventario real hasta que vence. Y el caso de consulta es concreto: la tarjeta del paciente no pasa, paga en efectivo, y **la venta en efectivo no encuentra las unidades porque el link muerto las tiene reservadas**; queda `sin_saldo` sin serlo. Opciones para decidir:
   - **(a)** Un botón "Anular link" en `/pagos` que cierra el checkout y libera (hoy solo existe `cerrar-checkouts-pendientes.sql`, que cierra todos).
   - **(b)** Al registrar en efectivo un producto que el mismo paciente tiene en un link pendiente, avisar y anular ese link, usando sus unidades.
   - **(c)** Acortar la vida del link. Cambia el TTL de 24 h que dice SECURITY.md.
   **DECIDIDO por Santiago (2026-09-14): (b), con (a) como respaldo.** Va en la sesión 2.

**2. DECIDIDO (Santiago, 2026-09-14): sellar también desde `failed` cuando llega un pago aprobado.** Va en la sesión 2, con su test.

   **Verificado con Wompi:** su soporte dice que *"La referencia que envía debe ser única para cada transacción"* (artículo "La referencia ya ha sido usada"). Así que un rechazo y un aprobado **en el mismo link** no deberían darse: el segundo intento con la misma referencia se rechaza. No dice explícitamente si vale después de un rechazo, y no se pudo provocar uno en el sandbox (la 4111 no crea transacción). **No sube a urgente por esa vía.**

   **Pero sigue haciendo falta, por otra:** un link cerrado (a mano, o con la opción (a)/(b) de arriba) mientras el paciente ya tiene abierta la página de Wompi con los datos cargados. Si paga, el `APPROVED` llega sobre una venta `failed` y no se sella. **Anular links hace este caso más probable**, así que las dos cosas van juntas.

   Análisis original: Si Wompi SÍ crea una transacción rechazada (con otra tarjeta u otro medio) y deja reintentar en el mismo checkout, el evento `DECLINED` marca la venta `failed`; el `APPROVED` siguiente ya no la sella, porque el sellado exige `pending`. **Dinero real cobrado y sin registrar.** Lo mismo pasaría con un link cerrado a mano que alguien paga igual. Dos cosas: comprobar con Wompi si su checkout permite reintentar con la misma referencia, y en todo caso **sellar también desde `failed` cuando llega un APPROVED** (el dinero se movió; decisión 4), volviendo el inventario a `pendiente`. Es cambio en el sellado del pago, con su test.

### 3.6 · Plan de la sesión 2 (APROBADO por Santiago el 2026-09-14)

> **Aprobado con sus tres decisiones:** (1) pago sobre link anulado: se sella, no se descuenta ni se factura, y va a "Revisar" con alerta; se cierra con contabilidad con `docs/entregas/CONSULTA_CONTABILIDAD_PAGO_SOBRE_LINK_ANULADO.md`. (2) Pago mixto fuera de la sesión 2. (3) El conteo muestra dos cifras: saldo, y unidades pagadas sin entregar.
>
> **Y la regla que enmarca todo (Santiago, 2026-09-14):** los Integrantes no mueven inventario ni ventas hasta que todo esté listo y bien organizado. No hay instrucciones de transición.

**El riesgo de doble descuento que se señaló al proponer este plan, resuelto sin código.** El aviso a Integrantes pedía registrar la entrega por cada venta, y desde la sesión 1 la venta ya descuenta. **Santiago no lo había enviado**, y los Integrantes no operan hasta que todo esté listo. El aviso se reescribió (`docs/entregas/AVISO_INTEGRANTES_VENTAS_Y_ENTREGAS.md`): uno de espera, por si reciben acceso antes, y el de arranque, que espera a esta sesión y al 2b. Verificado en la nube, solo lectura: cero movimientos `despacho` y cero ventas reales.

#### Qué entra en la sesión 2 y qué no

| Entra | Queda para después, y por qué |
|---|---|
| Anular link (a) y efectivo que anula el link pendiente (b) | **Pago mixto** (decisión 5): separa el cobro de la venta y toca la facturación; es su propia sesión. Mientras tanto, una venta se paga con un solo medio |
| Sellar desde `failed` cuando llega un APPROVED | **Paso 5, reparto sellado en la línea:** no toca Tratamiento; va con los pasos 6 y 7 |
| Estado de entrega de la venta, y la entrega auditada | **Paso 6** (reporte por día), **paso 7** (titular de marca), **paso 8** (mapa de ítems) |
| La venta en Tratamiento, reemplazando la sección de despacho | **Forma de entrega a domicilio:** es del Bloque 6 |
| Avisos en pantalla de `sin_saldo`, `fallido` y pago sobre link anulado | **Idempotencia de Resend** |
| El vencimiento de la página de Wompi (`expiration-time`) | ~~El reintento automático de la lectura del link~~: los logs dicen que tapa, no ayuda (abajo) |

#### Regla 0: lo que tiene el archivo de Gildardo, cotejado (`ATLAS_v8.html` del 4 de septiembre)

- **Sección 2 · VITACELLEBIS:** una casilla por producto recomendado (P1, P2...) y por "OTROS PRODUCTOS", cantidad por producto, y **un botón "Registrar despacho"** que guarda producto, cantidad, paciente y semana como consignación `pendiente_envio` para el módulo administrativo.
- Hay un **segundo bloque** (salida de inventario más comisión, por profesional) **definido y nunca renderizado**: código muerto en su archivo.
- **No tiene cobro, ni QR, ni forma de entrega.** Su archivo no modela pagos.
- **Lo que se mantiene literal:** qué se entrega (lo prescrito) y cuántas unidades. **Lo que cambia es comercial** (cobro, inventario, factura), que no gobierna su archivo sino contabilidad y Santiago.
- **Recomendación:** Santiago le **informa** a Gildardo que el botón pasa a cobrar y entregar; no se le pide decisión clínica porque no hay ninguna.
- **Hueco que ya existía, no de esta sesión:** sus "OTROS PRODUCTOS" (fuera de diagnóstico, en el mismo registro) no están en Atlas. No se amplía el alcance; se anota para preguntarle.

#### El flujo en pantalla (pestaña Tratamiento)

Aparece donde hoy está la entrega, con el mismo gate: prescripción entregada, decisión "sí", y quien mira es profesional.

1. **Productos:** los prescritos que son `en_consultorio`, con cantidad (1 por defecto) y **disponible** (saldo menos reservas vivas). Un producto sin disponible se muestra con la razón, no se esconde.
2. **Forma de entrega: no se pregunta en esta sesión.** Hoy la única es en consulta, y una pregunta con una sola respuesta es ruido. El selector llega con el domicilio (Bloque 6), que es lo que su `pendiente_envio` representa.
3. **Cobro, con dos botones:**
   - **"Cobrar con QR"** crea el checkout (reserva, aviso de duplicado igual que en `/pagos`). Muestra el QR, el link copiable, cuánto le queda y "Esperando el pago". La pantalla se actualiza sola cada 5 s durante 10 min, y tiene "Actualizar" y "Anular link".
   - **"Cobrar en efectivo"** registra la venta ya pagada.
4. **Pagada:** "Pago recibido" y el botón **"Entregar"**. Si el inventario quedó `sin_saldo`, la entrega **se permite igual** (el Integrante tiene el producto en la mano; lo que está mal es el saldo de Atlas) y el aviso va a Dirección.
5. **Entregada:** pasa a "Entregas a este paciente", que lee las ventas entregadas **y** los `despacho` históricos.

Varias ventas por tratamiento están permitidas (el paciente vuelve por más). Cambiar la decisión a "no" **no anula** una venta hecha: la reversa es del 3b.

**El QR** se genera en el servidor con `qrcode` (ya aprobado, lo usa MFA) como `data:` en un `<img>`. Nunca SVG insertado como HTML: la regla prohíbe `dangerouslySetInnerHTML`.

#### Modelo de datos: migración 0140, solo aditiva

- **`sale_fulfillment` NO se crea como tabla.** Es una por venta, así que va en columnas de `transactions`, como `stock_state` en la sesión 1 y por la decisión 1: `fulfillment_state` (`pendiente` | `entregado`), `delivered_at`, `delivered_by`. **Se aparta del plan escrito**, que decía tabla; los estados `despachado` y `entregado a domicilio` llegan con el Bloque 6.
- **`cancelled_at`, `cancelled_by`** en `transactions`: un link anulado queda `failed` como hoy, pero **distinguible** de un rechazo de Wompi. El sellado desde `failed` necesita esa diferencia (abajo).
- Sin backfill: las ventas existentes son del smoke y las borra la purga.

#### Decisión (b) + (a): anular el link

- **"Anular link"** en `/pagos` y en Tratamiento. En una transacción: `failed`, `cancelled_at`/`cancelled_by`, reservas liberadas, `stock_state = liberado`. La página del link deja de mostrarse (ya pasa con todo lo que no está `pending`).
- **Efectivo con link pendiente del mismo paciente:**
  - **Si comparten producto,** avisa con el monto y los productos, y el único camino es "Anular el link y cobrar en efectivo". Todo va en **una sola transacción**, para que las unidades liberadas sean las que usa la venta en efectivo.
  - **Si no comparten producto,** solo avisa.
  - El botón de confirmación viaja con el `submitter` (hazard 5).
- **VERIFICADO en la documentación de Wompi (2026-09-14): la firma admite vencimiento.** El Web Checkout recibe `expiration-time` (ISO 8601 en UTC), y la firma pasa a ser `<Referencia><Monto><Moneda><FechaExpiracion><SecretoIntegridad>`. **Se construye en esta sesión:** la página de Wompi vence cuando vence el link (creación + `CHECKOUT_TTL_MS`), así que una página abierta ya no cobra después de las 24 horas. **No resuelve la anulación** (un link anulado a las 2 horas sigue cobrable en una página abierta hasta que venza), y por eso sigue haciendo falta lo siguiente.

#### Decisión: sellar desde `failed`

- **`failed` por rechazo de Wompi y llega APPROVED:** se sella, `stock_state` pasa de `liberado` a `pendiente`, se descuenta y se factura. Es la decisión 4: el dinero se movió.
- **`failed` por link ANULADO y llega APPROVED: es casi seguro un cobro doble** (el paciente pagó en efectivo y la página de Wompi abierta cobró también).
  - **DECIDIDO (Santiago, 2026-09-14):** sellar el pago (es dinero real) pero **no descontar ni facturar** automáticamente. La venta queda en "Revisar: pago sobre link anulado", con alerta a Sentry y en pantalla.
  - Si se factura sola, sale una factura validada por la DIAN que solo se deshace con nota crédito (3b, sin construir).
  - Quien revisa decide: si **devuelve** el pago en Wompi, no se factura nada; si es **una segunda compra real**, "Reintentar" descuenta y factura.
  - **Cómo se registra el dinero mientras se revisa, y quién resuelve, lo responde contabilidad:** `docs/entregas/CONSULTA_CONTABILIDAD_PAGO_SOBRE_LINK_ANULADO.md`.
- Tests de base real para las tres ramas: rechazo seguido de aprobado, anulado seguido de aprobado, y el control.

#### La entrega auditada

- `registrarEntrega(ventaId)`: solo sobre una venta `paid` y `pendiente`, y solo el profesional de la venta (o admin). En la misma transacción: `fulfillment_state = entregado` y `clinical_audit_log`, con evento `nutraceutical.delivered`, entidad la venta, y payload `{ treatmentId, items: [{ nutraceuticalId, quantity }] }`. **Sin nombre ni documento.**
- Las ventas de `/pagos` (paciente que vuelve solo a comprar) se entregan con el mismo botón en la lista de `/pagos`, con `treatmentId` nulo en el payload. Así **ninguna venta queda sin camino de entrega**, que es lo que la instrucción 2 del aviso no podía cumplir.
- **El inventario NO se mueve al entregar:** se movió al sellar (D2). La entrega es estado. Consecuencia para los conteos: una unidad vendida y no entregada está físicamente en el consultorio y ya no en el saldo. Lo físico es saldo más ventas `pagadas y pendientes de entrega`, y el conteo debe mostrar las dos cifras.

#### Retiro del despacho

- `DespachoSection`, `DespachoForm` y la acción `recordDespacho` **se retiran**. El tipo `despacho` y su CHECK se quedan: son historia.
- Con eso se cumple "no existe camino para entregar sin venta".

#### Sub-tareas, en orden (un commit cada una) · CONSTRUIDAS el 2026-09-14, falta el smoke

Estado verificable: `venta-anulacion-y-revision-db.test.ts` (19, base real, con controles), `efectivo-con-link-pendiente.test.ts`, `can-deliver-sale.test.ts`, `payments-service.test.ts`, `wompi-signatures.test.ts` y `luvia-y-alergenos.test.ts`.

1. **HECHO (`0c68a65c`).** Migración 0140. **La aplica Santiago** antes del push (paso 0 del smoke).
2. **HECHO (`991159ad`).** Anular link, sellado desde `failed` (con la rama del link anulado) y el vencimiento de la página de Wompi. `cerrar-checkouts-pendientes.sql` marca `cancelled_at`.
3. **HECHO (`35947164`).** Efectivo que anula el link pendiente, y "Anular link" en `/pagos`.
4. **HECHO (`bcef2d61`).** Entrega auditada, y su botón en `/pagos`.
5. **HECHO (`6d48aac3`).** La venta en Tratamiento (QR, efectivo, estado, entrega) y el retiro del despacho.
6. **HECHO (`7d5daf34`).** Panel "Ventas por revisar": pago sobre link anulado (con sus dos salidas), `sin_saldo` y `fallido`.
7. **HECHO.** `docs/entregas/SMOKE_BLOQUE_3_SESION_2.md`. **El paso 6 (Tratamiento) espera** a que Santiago diga con qué cuenta profesional de prueba se hace. Verificado en la nube: ningún administrador tiene perfil profesional, y el paciente de prueba no tiene tratamiento.

**Al cerrar la sesión:** el aviso de arranque (borrador en `AVISO_INTEGRANTES_VENTAS_Y_ENTREGAS.md`) se ajusta a los nombres reales de las pantallas. Se envía cuando pasen el smoke de esta sesión y la venta controlada del 2b.

#### Los 502 y 504 de la API de Supabase (logs de Santiago, 2026-09-14)

**Los eventos (hora de Bogotá):** 07:20:00, 07:20:03, 07:20:03, 07:51:00, 07:56:02 y 08:39:47 dan 504 en `/auth/v1/user`; 08:32:16 da 502 en `/auth/v1/user`; 08:32:18 da 502 en `/rest/v1/transactions`; 08:38:09 da 504 en `/rest/v1/transactions`. **Sentry tiene una sola incidencia**, porque los fallos de `/auth/v1/user` vienen del proxy de sesión, donde `getUser` devuelve error en vez de lanzar: **nunca llegan a Sentry**. Solo la lectura del link lanzaba.

**Lectura:**

- **No es una consulta nuestra.** Dos servicios distintos (Auth y PostgREST) fallan en la misma franja, con 502 (la puerta no alcanzó el servicio) y 504 (tardó demasiado) mezclados.
- **No es volumen.** Actividad de escritura en la nube, de 05:00 a 09:30: una reserva a las 07:51, una venta a las 07:56, dos a las 08:07 y tres cierres a las 08:45. **Antes de las 07:51 no hay ninguna escritura de la aplicación**, así que los errores de las 07:20 no coinciden con ninguna. Y los tests de base real van a la base local (127.0.0.1), no a la nube.
- **No es una pausa del proyecto.** Una pausa falla todo y de forma continua. Aquí las peticiones entre un error y otro funcionaron (el smoke selló ventas a las 07:56 y a las 08:07).
- **Los scripts que desactivan triggers no lo explican bien.** Bloquean la tabla de movimientos mientras dura su transacción, no `auth.users`, y en Postgres una lectura por id no espera a un bloqueo de fila. Lo que sí podría dejar huella es consumo de disco en ráfaga (abajo), y eso lo dicen las métricas, no los logs.
- **Encaja con el plan gratuito.** `DEPLOY.md` dice "Plan: Free para MVP". Free corre en **Nano**: hasta 0,5 GB de memoria, CPU compartida, y disco con una línea base de 250 IOPS y ráfagas. Según la documentación de Supabase, agotada la ráfaga el rendimiento vuelve a la línea base, y con el presupuesto de disco agotado el proyecto puede dejar de responder. Eso da justo esta mezcla, en los dos servicios, con un solo usuario.

**Lo que lo confirma o lo descarta (Santiago, en el panel de Supabase, reportes u observabilidad de la base, de hoy 07:00 a 09:00):** "Disk IO % consumed", memoria y CPU. Si el disco o la memoria tocan el techo en la franja, está confirmado. Si están tranquilos, no es de recursos y hay que abrir un ticket con Supabase con estos nueve eventos.

**Pro:** empieza en **Micro** (1 GB, 2 núcleos compartidos, el doble de línea base de disco), y ya está en lo de "antes del primer Integrante". Esto lo refuerza, con una condición: **si las métricas muestran que el techo lo tocó algo nuestro**, Pro lo aplaza, no lo arregla.

**El reintento automático: TAPA, no ayuda. No se construye.**

- Con una causa de recursos, reintentar **agrega carga justo cuando la instancia está saturada**.
- En un 504 el paciente ya esperó hasta el plazo (10 s); un reintento lo lleva a 20.
- **Y borra la señal:** el reintento que funciona no llega a Sentry, así que el problema seguiría y el conteo bajaría.
- El botón manual se queda: el paciente reintenta a su ritmo, cada fallo se cuenta, y la solución va donde está la causa.
- **Se reconsidera solo si, ya en Pro, quedan 502 aislados**; entonces sería un único reintento, solo en 502 y reportando cada intento.

#### Respuestas de contabilidad sobre el pago que llega a un link anulado (2026-09-14), y lo que quedó verificado

1. **No se factura hasta resolver.** La factura lleva la **fecha de resolución**. Plazo operativo: **5 días hábiles**, y antes del corte si se acerca fin de bimestre.
   *Hoy:* la factura se emite al resolver, con la fecha de Colombia de ese día. Cumple. El plazo no se ve en ningún lado.
2. **El dinero va contra la cuenta puente de Wompi, como PASIVO** (anticipo pendiente de aplicación), no como ingreso. **La venta no cuenta en reportes de ingreso mientras esté en revisión.**
   *Verificado en el código:*
   - no cuenta en el ingreso de CNV ni en comisiones: el sellado de la revisión no escribe `cnv_revenue` ni `professional_revenue`, así que tampoco toca el banner tributario;
   - **SÍ cuenta en dos cifras que suman `transactions` pagadas**: el *cobrado bruto* del tablero de Dirección (`getDireccionDashboard`) y las *ventas del mes* del tablero del profesional (`getTablero`).
3. **La comisión de Wompi la asume CNV y no se reintegra.** La retención se recupera. El costo de un cobro doble devuelto es solo la comisión.
4. **Lo resuelve Dirección**, con el Integrante aportando el hecho: marcar "segunda compra" le da comisión. **Soporte mínimo:** quién resolvió, cuándo, qué versión dio el Integrante y el comprobante si hubo devolución.
   *Hoy:* resuelven admin **y** dirección, y solo queda quién y cuándo.
5. **El caso al revés es más grave:** una factura por un efectivo que nunca se recibió.
   - Mientras no exista nota crédito en Atlas: **nota crédito manual en Alegra**.
   - Y un "efectivo registrado que no se recibió" tiene que **alertar distinto y escalar si se repite con el mismo Integrante**. Es el control contra un fraude con cincuenta Integrantes.
   - *Hoy:* no existe esa salida en la revisión.

**Su recomendación de fondo, "hacerlo imposible", verificada contra la documentación de Wompi (2026-09-14):**

- **Web Checkout (lo que usa Atlas): no hay forma documentada de invalidar una sesión abierta.** Lo único es `expiration-time`, que va firmado y se fija al abrir la página.
- **Links de pago por API:** documenta crear (con `expires_at` y `single_use`) y consultar. **No documenta desactivar**, ni qué pasa con una página ya abierta.
- **Anular (`POST /v1/transactions/{id}/void`):**
  - existe, pero **solo para tarjeta**, para "ciertos estados" que no especifica, y sin plazos documentados;
  - PSE y Nequi no se anulan;
  - y es **después** de aprobado: no impide el cobro, lo reversa.
- **Conclusión:** con lo documentado, el cobro doble **no se puede hacer imposible**, y la revisión sigue haciendo falta. Lo que falta saber lo responde el **soporte de Wompi**: si un link de pago se puede desactivar por API y si eso bloquea una página abierta, y los plazos y la comisión de una anulación.

**Aprobadas por Santiago el 2026-09-14, con admin y dirección resolviendo (como estaba). Construidas el mismo día:**
- **Hecho (`dc17b6a7`).** La revisión fuera del cobrado bruto de Dirección y de las ventas del mes del profesional.
- **Hecho (`b41c250b`, `dfd4f16e`, migración 0141).** Resolver exige la versión del Integrante, y "devuelto" exige el comprobante. Queda quién escribió la versión y cuándo.
- **Hecho (`dfd4f16e`).** El plazo en pantalla: 5 días hábiles, o antes del cierre del bimestre si el corte llega antes.
- **Hecho (`b900c157`).** El mínimo de Wompi: no se crea un checkout de menos de $1.500, y las dos pantallas lo avisan antes de pulsar.
- **Hecho (`32d46b11`).** Los productos de prueba retirados salen del desplegable, la etiqueta dice "se vende en consultorio" y el retiro pone la hora de Bogotá.
- **Se queda "Fue una segunda compra"** (Santiago: da a entender que está comprando otra vez, que es lo que pasa).
- **El soporte de Wompi no se contacta:** con lo documentado basta, y la revisión se queda.

#### DISEÑO PROPUESTO, no construido: la salida "el efectivo no se recibió"

**El caso.** Un pago aprobado sobre un link anulado entra en revisión. La versión del Integrante, o la averiguación de Dirección, dice que el efectivo **no** se recibió: el paciente pagó solo con tarjeta, y la venta en efectivo que anuló el link no ocurrió. Así que hay:
- una **factura emitida** por un efectivo que no entró;
- una **comisión** sellada al Integrante por esa venta;
- y un **pago real en Wompi** que no tiene factura.

**Lo que hace falta y hoy no existe:** saber **qué venta en efectivo anuló el link**. La anulación dentro de la venta en efectivo no lo guarda. Sin ese vínculo, Dirección tendría que adivinar cuál venta es la falsa.

**Lo que haría la resolución, en una transacción:**

1. **La venta de Wompi pasa a ser la venta.**
   - Se sella su contabilidad: comisión e ingreso de CNV.
   - Se pide su factura, con fecha de resolución.
   - **No se descuenta inventario:** el producto ya salió con la venta en efectivo. Su inventario queda `en_otra_venta`, apuntando a la venta en efectivo.
   - Su entrega toma la de la venta en efectivo, si ya estaba entregada.
2. **La venta en efectivo queda marcada "efectivo no recibido"**, con quién y cuándo.
   - Sale de toda cifra de cobro, igual que la revisión.
   - Su comisión se **revierte con una fila negativa**, no se borra. Es la forma que ya dice el 3b ("si ya se liquidó, se descuenta en la siguiente").
   - Sus movimientos de inventario se quedan: el producto sí salió.
3. **La nota crédito manual en Alegra** queda **pendiente en el panel** hasta que Dirección escriba su número. La hace contabilidad sobre la factura del efectivo, como la NC1.
4. **La alerta es distinta a la de la revisión.**
   - Sentry nivel **error** (no warning), con el Integrante.
   - Un bloque aparte en el panel: **"Efectivo registrado que no se recibió"**.
   - El profesional ve en su venta "Anulada por CNV: el efectivo no se recibió".
5. **La escalada, por Integrante.**
   - Se cuentan sus casos en los últimos 90 días.
   - Desde el **segundo**, el bloque se marca en rojo con el conteo ("2 casos en 90 días"), y la alerta de Sentry lo dice.

**Migración (0142, aditiva):**
- En el link: `cancelled_by_sale_id`, la venta en efectivo que lo anuló.
- En la venta en efectivo: `cash_not_received_at`, `cash_not_received_by` y `credit_note_manual_number`.
- En la venta de Wompi: `stock_covered_by_sale_id`, más el valor `en_otra_venta` en el CHECK de `stock_state`.
- El valor `efectivo_no_recibido` en el CHECK de `review_resolution`.

**Tres preguntas antes de construir:**

1. **¿Solo cuando las dos ventas coinciden** (mismos productos y cantidades)? Recomiendo **sí**. Si la venta en efectivo llevaba algo más, una parte pudo ser real, y separarla es otra decisión. En ese caso el botón no aparece y dice "resuélvelo con contabilidad".
2. **¿La escalada desde el segundo caso en 90 días**, y qué es escalar? Recomiendo el bloque en rojo más la alerta de Sentry. Un correo a Dirección sería un paso más.
3. **¿La comisión se revierte con fila negativa?** Recomiendo **sí**: el rastro de que existió y se revirtió es parte del control.

**~~Preguntas que siguen abiertas~~ Cerradas el 2026-09-13:** muestras y cortesías no existen (no se
construyen); el pago mixto ya estaba decidido (una factura por el total). Ver las cinco decisiones arriba.

### 3.4 bis · Los pasos 5 a 8, construidos el 2026-09-14 (falta el smoke de cierre)

- **Paso 5, HECHO (`556b8ebc`, 0143).** El reparto sellado en cada línea: tasas de IVA, del Integrante y del proveedor, modalidad, y los montos. La tasa del Integrante sale de su vigencia.
- **Paso 6, HECHO (`6b39b978`).** Ventas sin documento consultables por día de Colombia, con los días de los últimos 30 que tienen alguna.
- **Paso 7, HECHO y VERIFICADO (`74cb2862`).** La línea de un producto de tercero lleva "Titular de marca: ...", y un tercero sin titular no se factura. **Alegra lo imprime:** factura de sandbox SETP990214726 (2026-09-15, con permiso de Santiago), cuyo PDF dice "PRUEBA(Titular de marca: TITULAR DE PRUEBA S.A.S.)": Alegra pone la descripción entre paréntesis junto al nombre del ítem.
- **Paso 8, HECHO (`d04b1f00`, 0144).** El mapa de ítems por producto y ambiente.
- **Smoke de cierre:** `docs/entregas/SMOKE_BLOQUE_3_CIERRE.md`.

### 3.7 · Bloque A, AVISOS: controles que no dependen de que alguien entre a /pagos (va ANTES del 2b)

> **DECISIONES DE SANTIAGO (2026-09-15):**
> - **a) NO hay reintento automático.** Ojo humano antes de reintentar, para saber por qué falló. Consecuencia que se resuelve abajo: el correo no puede traer siempre lo mismo.
> - **b) Correo diario, con la marca en el usuario.** La marca se puede poner a **admin, dirección y soporte**, que son los roles internos que existen hoy (`app_role`: admin, direccion, soporte, obbia, professional). "Operador" no existe como rol.
> - **c) 7 a. m. y 5 p. m.**
> - **d) Correo inmediato al Integrante** cuando un pago de su venta entra en revisión.
> - **Es un bloque propio, antes del 2b.**
>
> **Aprobado por Santiago el 2026-09-15, con la marca de escalamiento para lo vencido y 5 días hábiles para la nota crédito. La marca va a admin, dirección y soporte; "operador" no se crea.**
>
> **Para que el correo no se aprenda a ignorar:**
> 1. **Nuevo contra lo que ya estaba.** El correo abre con lo NUEVO desde el anterior, y debajo, "sigue pendiente", con cuántos días lleva.
> 2. **Lo viejo sube de tono con el plazo, no solo con los días.** Cada tipo tiene el suyo:
>    - la revisión, 5 días hábiles (contabilidad);
>    - la venta sin documento, el cierre del día;
>    - la nota crédito manual, 5 días hábiles (propuesto).
>    Vencido, el asunto lo dice ("1 vencida") y va también a quien tenga la marca de **escalamiento**.
> 3. **"Lo estoy gestionando, avísame el ...".** Quien lo mira lo marca en gestión, con una nota de por qué y una fecha. Sale del correo hasta esa fecha o hasta su plazo, lo que llegue primero. Es el ojo humano de la decisión a): queda escrito quién lo vio y qué está pasando, y el correo deja de repetirse. Si la fecha pasa sin resolverse, vuelve marcado.
> 4. **Agrupado por causa.** Doce facturas que fallan por el mismo motivo ("falta el ítem en Alegra") son UNA línea con su número: se arregla una vez.
> 5. **Si no hay nada nuevo, nada vencido, y lo demás está en gestión, no llega correo.**

**(Lo que sigue es la propuesta original del 2026-09-14, que las decisiones de arriba ajustan: el punto 1, el reintento automático, NO va.)**

**El problema (Santiago, 2026-09-14):** hoy nadie entra a `/pagos` a diario, y con más de 50 Integrantes y cientos de pedidos es inviable esperar que alguien lo mire. Un control que depende de que alguien entre no es un control.

**El principio: Atlas avisa, no espera a que lo miren. Y antes de avisar, resuelve solo lo que no necesita a una persona.**

1. **Primero se arregla solo lo que no necesita a nadie.** Hoy "Reintentar las pendientes" es un botón: facturas sin emitir, pagos no registrados en Alegra, descuentos de inventario fallidos. Un cron diario los reintenta antes de avisar. Lo que queda después es lo que de verdad pide a alguien.
2. **(a) Lo que necesita acción humana, en una sola consulta:**
   - efectivo registrado que no se recibió, con la nota crédito pendiente y la escalada por Integrante;
   - pagos en revisión sin la versión del Integrante, o con el plazo por vencer o vencido;
   - ventas sin documento que siguen así después del reintento automático (los intentos agotados primero).
3. **(b) Lo que puede esperar:** ventas sin saldo (van al conteo), descuentos que se reintentan solos, lo ya resuelto. Queda en pantalla o en un resumen semanal.
4. **Canal 1: un correo diario, SOLO SI HAY ALGO.**
   - Vercel Cron, que ya estaba previsto para lo agendado (ARCHITECTURE, "Background jobs"). En el plan Hobby corre una vez al día por tarea, con ±59 minutos de precisión (documentación de Vercel).
   - Dos tareas: **7 a. m.** (el día anterior y los plazos) y **5 p. m.** (lo que sigue sin documento antes del cierre contable). La de la tarde solo si queda algo.
   - El asunto dice cuántas y cuáles están vencidas. Si no hay nada, no llega nada.
5. **Canal 2: una franja en cualquier pantalla de Atlas**, para quien resuelve: "3 cosas necesitan tu acción", con enlace. Sirve a quien entra por otra cosa. Complementa el correo, no lo reemplaza.
6. **Canal 3: al Integrante, lo suyo y en el momento.** Cuando un pago de su venta entra en revisión, un correo: "Cuéntale a CNV qué pasó". La versión llega sin que Dirección tenga que perseguirla.
7. **A quién: por marca en el usuario, no por nombre.**
   - Una marca "Recibe los pendientes de ventas" que el administrador activa en Atlas. Hoy la tiene Santiago; con 50 Integrantes, otra persona, con un clic y sin tocar código ni variables.
   - Cuando haya dos responsables, la marca se parte por tipo (el efectivo no recibido a Dirección, las ventas sin documento a contabilidad).
   - **Si nadie tiene la marca**, Sentry nivel error y la franja a los administradores: un control sin destinatario es el mismo problema.

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

### 3.8 · Pendiente anotado: la lentitud de /pagos al filtrar (2026-09-15)

Santiago, en el smoke de cierre: "funciona, solo que es algo lento". Con 10 ventas ya se nota; con volumen real sera peor.

**Lo que dice el codigo (sin medir en la nube):** `router.push` con otro `?dia=` vuelve a ejecutar la pagina completa en el servidor. Son tres tandas en serie: (1) todas las transacciones, **sin limite**, y el perfil; (2) los cinco paneles; (3) si puede crear checkout, **todos los pacientes seleccionables** y el catalogo. Solo una consulta depende del dia (`listarVentasSinDocumento`).

**Como distinguir consulta de render, una sola vez:** en el navegador, pestaña Network, la peticion que sale al pulsar "Ver ese día". Si casi todo es **Waiting (TTFB)**, es el servidor (las consultas). Si es **Content Download** grande, es lo que viaja (la lista completa).

**Arreglo probable, cuando se mida:** las tres tandas en una sola en paralelo; la lista de transacciones paginada (las ultimas N, con "ver más"); y los selectores de paciente y producto cargados solo cuando se abre el formulario.

---

## Bloque 3b · Reversa

**Tamaño: medio.** Va **inmediatamente después** del Bloque 3 (D4).

**Alcance mínimo:**

- **CONTRACARGOS** (añadido por contabilidad el 2026-09-13): un pago que Wompi aprobó y **reversa después**. La factura ya está validada por la DIAN, así que no se puede anular: **la salida es nota crédito**, con referencia a la factura original y numeración electrónica (plantilla NTC, ya configurada). Y la venta tiene que volver a la cola del panel, porque el pago que la cerraba dejó de existir.
- **CONCILIACIÓN CON WOMPI (anotado el 2026-09-16, salió del incidente de la base).** Wompi reintenta su webhook 3 veces en 24 horas y después deja de intentar. Durante el incidente un pago de prueba se perdió: Atlas respondió 500 a todos los intentos y esa venta quedó sin sellar, sin factura y sin aviso, con el pago hecho. En pruebas no costó nada; en producción es plata cobrada que Atlas no ve. Hace falta un cotejo contra la API de Wompi (las aprobadas de los últimos N días que en Atlas no están pagadas) que las selle por la misma ruta idempotente. Va en este bloque porque es la misma familia: un pago que llega tarde, o al revés.
- Anulación por error.
- Devolución con **reingreso al lote de origen**.
- **Nota crédito en Alegra enlazada a la factura original.**
- **Y CON LA REGLA DE LAS ESCRITURAS SIN RESPUESTA (2026-09-14):** la nota crédito es un POST que puede completarse en Alegra y perder la respuesta, igual que la factura del smoke del Bloque 3 (SETP990214715). Lleva la referencia de la reversa de Atlas en `observations` (que no se imprime) y **se busca antes de emitir**, con la misma forma que `buscarFacturaPorReferencia`. No se construye sin eso. La regla está escrita una vez, en la cabecera de `lib/alegra/client.ts`.
- **Reversión de la comisión**; si ya se liquidó, se descuenta en la siguiente liquidación.
- Para **producto de tercero**, el reingreso va a la **consignación del proveedor**, no al inventario de
  CNV (el producto nunca fue de CNV).

**Fuera de alcance:** el retracto de venta a distancia, que depende de que existan domicilios (Bloque 6).

### Alcance cerrado por Santiago (2026-09-16)

- **Solo la mitad (a): registrar y sacar de las cifras.** Atlas se entera, revierte y avisa.
- **La nota crédito se queda MANUAL en Alegra**, con Dirección registrando el número, en la misma cola con plazo que ya existe para el efectivo no recibido. Emitirla desde Atlas es un acto contable que pide un contador, no un botón, y con este volumen no se paga.
- **Las devoluciones físicas SÍ entran**, por el reingreso al lote.
- **El `VOIDED` sobre una venta pagada deja de ignorarse.** Hoy el webhook lo marca procesado y no hace nada: la factura sigue viva, el inventario descontado y la comisión sellada, sin aviso.
- **El cotejo contra Wompi entra aquí**, y es lo que más vale.

### Las tres sesiones

| Sesión | Qué trae | Migración | Smoke en navegador |
|---|---|---|---|
| **1 · La reversa se registra y sale de las cifras** | La reversa como caso con estados, el `VOIDED` que deja de ignorarse, las filas negativas de ingreso y comisión, el panel y el correo | Sí (`sale_reversals`, más el tipo nuevo en la cola de pendientes) | Sí |
| **2 · La devolución física** | El reingreso de la unidad, ligado a la línea de venta, con su tipo de movimiento propio | Sí (tipo de movimiento nuevo y su CHECK) | Sí |
| **3 · El cotejo con Wompi** | **CONSTRUIDA (2026-09-16), falta el smoke** (`SMOKE_3B_SESION_3_COTEJO_WOMPI.md`). Migración 0146. Candados: `cotejo-wompi`, `cotejo-wompi-db` | Sí (0146, el rastro de cada corrida) | Sí |

**Sesión 1.** Una reversa NO es un campo más en la venta: es un caso que dura días y cambia de estado (abierta → ganada o perdida), así que va en su tabla, como el faltante. Dirección la abre con la referencia de Wompi. Solo al **perderse** se revierten el ingreso y la comisión, con filas negativas que apuntan a las originales (la forma de la 0142, ya construida), y queda pendiente la nota crédito manual. Un `VOIDED` sobre una venta pagada abre la reversa solo y avisa.

**Sesión 2.** **Ojo con el tipo de movimiento:** el `devolucion` que existe significa "el Integrante devuelve a CNV", no "el paciente devuelve el producto". Reusarlo mezclaría dos hechos distintos en el saldo, así que la devolución de una venta lleva su propio tipo, ligado a la línea de venta. El destino de la unidad depende de la decisión D-3b-3 de abajo.

**Lo que el sondeo dejo confirmado (2026-09-16), y que la sesion 1 usa:**

- **El listado de Wompi SI trae las rechazadas y las anuladas**, no solo las aprobadas (`{"DECLINED":1,"APPROVED":23}`). Asi que un `VOIDED` sobre una venta que Atlas tiene pagada se puede detectar por el cotejo diario, sin consultar venta por venta. Es justo lo que hace falta cuando el aviso NO llega; cuando llega, el webhook ya lo marca solo.
- **El campo `disbursement` viene VACIO en las 24 transacciones del sandbox.** Se llena cuando Wompi desembolsa, y en sandbox probablemente nunca. **Queda por verificar en produccion**, con una venta ya desembolsada: si trae la comision y la retencion, ahorra el reporte de liquidacion de Wompi. **El calculo del margen NO se diseña contando con el hasta comprobarlo.**

**Sesión 3 (la primera que se construye).** Wompi reintenta su webhook 3 veces en 24 horas y después no más; hoy no hay nada que recupere un pago perdido así (pasó en el smoke del Bloque A, con plata de prueba). El cotejo pregunta a Wompi por las aprobadas de los últimos días, encuentra las que en Atlas no están pagadas y las sella por la misma ruta del webhook, que ya es idempotente. Se dispara solo (una tarea más, que Vercel Pro ya cubre) y también a mano desde /pagos.

**Y antes de construirlo, un sondeo** (`scripts/sondeo-wompi-consulta.mjs`, lo corre Santiago contra el SANDBOX). La documentación de Wompi confirma que consultar transacciones va con la llave **privada** y que hay un listado paginado, pero **no documenta el filtro por referencia**, y hay reportes de que no filtra. De eso depende la forma del cotejo: si el filtro sirve, se pregunta venta por venta; si no, se recorre el listado reciente y se compara en Atlas, que es la forma que ya usa `buscarFacturaPorReferencia` con Alegra. El sondeo solo LEE y no imprime datos de nadie.

### RESPUESTAS DE CONTABILIDAD (2026-09-16). Mandan sobre las preguntas de abajo

- **D-3b-1 · El contracargo separa la CAJA del RESULTADO**, que es la forma que ya se usó con el pago sobre link anulado. **Al abrir** la disputa, el débito del banco se registra contra una cuenta de **"contracargos en disputa"** (activo, porque puede volver) y **el ingreso no se toca**. **Al ganar**, se cancela esa cuenta y el ingreso nunca se movió. **Al perder**, nota crédito, reversión del ingreso y de la comisión, y esa cuenta se cancela contra la reversión. **La nota crédito SOLO al perder:** emitirla al abrir sería anular una factura que sigue siendo válida mientras la disputa vive.
- **D-3b-2 · La comisión ya liquidada se descuenta en la siguiente liquidación.** Si el Integrante ya no está, es **cuenta por cobrar al exintegrante**, con un **umbral** por debajo del cual se castiga como pérdida. **Necesita cláusula en el Anexo 2** (CNV puede descontar de liquidaciones futuras, y sin ellas el Integrante reintegra): sin cláusula no hay con qué exigirlo. Lo lleva Santiago.
- **D-3b-3 · Una unidad devuelta NO vuelve al lote vendible**, y la razón es sanitaria antes que contable: es alimento registrado ante INVIMA, y una unidad que salió del control de CNV no tiene cadena de custodia. Va a una **ubicación de "devueltas pendientes de verificación", no vendible**. Alguien la inspecciona: sellada, íntegra y sin vencer, **puede** reincorporarse al lote **con registro de quién verificó**; abierta, dañada o con duda, se da de baja contra gasto. **La reincorporación es una decisión humana registrada, nunca automática.** Producto de tercero: vuelve a la consignación del proveedor, y si el proveedor no la recibe, la asume CNV (por eso entra al acuerdo de LUVIA).
- **D-3b-4 · Los plazos son distintos.** Devolución normal: 5 días hábiles desde que se acepta. Contracargo: el plazo lo marca la disputa con el banco, y la nota crédito va **dentro de los 5 días hábiles siguientes a la resolución en contra**, no antes. **Advertencia de corte:** si la resolución cae cerca de fin de bimestre, la nota crédito se emite **antes del corte**, porque el ajuste del IVA entra en el bimestre de la nota, no en el de la factura original.
- **D-3b-5 · El buzón de disputas es URGENTE, y el motivo es peor que "no enterarse": las disputas tienen plazo de respuesta y quien no responde a tiempo PIERDE automáticamente.** Se pierde por silencio. Va al buzón de facturación, con alguien que lo revise. Lo configura Santiago.

**Y dos cosas que nadie había visto (contabilidad, 2026-09-16):**

- **Contracargo sobre producto de TERCERO.** Si un paciente disputa una venta de LUVIA, CNV pierde los 90.000 y **ya le pagó al proveedor sus 63.000**. Sin cláusula, CNV asume la pérdida completa sobre un producto donde solo ganaba 7.563. **Va a los seis puntos del acuerdo de LUVIA.**
- **La retención de Wompi en un contracargo.** Si Wompi practicó retención sobre esa venta y luego se revierte, hay que verificar si la ajusta en el desembolso o si queda a favor de CNV. **Se pregunta junto con lo de la retención.**

**EL ORDEN LO CAMBIA CONTABILIDAD: 3 → 1 → 2.** La sesión 3 recupera pagos que HOY se pierden de verdad, no depende de ninguna decisión, y lo recuperado es dinero real desde el primer día; las otras dos protegen contra algo que todavía no ha pasado.

### Lo que necesitaba decisión de contabilidad (ya respondido arriba)

Cinco preguntas. Las tres primeras cambian el código; las dos últimas, no.

1. **D-3b-1 · ¿Cuándo sale de las cifras un contracargo?** El banco **debita al abrirse** la disputa, y CNV puede ganarla. ¿El ingreso se revierte al abrir (y se repone si se gana) o solo al perder? Afecta el cierre del mes y el bimestre.
2. **D-3b-2 · La comisión de una venta revertida que YA se liquidó.** El plan dice descontarla en la siguiente liquidación. ¿Lo confirman, y qué pasa si el Integrante ya no está?
3. **D-3b-3 · Una unidad devuelta, ¿vuelve a ser vendible?** Si vuelve a su lote, se vende otra vez; si no, hace falta una ubicación de "devueltas", que no es vendible. Y para **producto de tercero**: ¿la unidad vuelve a la consignación del proveedor, y quién asume si el proveedor no la recibe?
4. **D-3b-4 · El plazo de la nota crédito** de un contracargo o una devolución: ¿los mismos 5 días hábiles del efectivo no recibido?
5. **D-3b-5 · El correo de disputas de Wompi** tiene que llegar a Dirección o a contabilidad (Wompi permite indicar un buzón propio para eso). Es operativo, no código, pero sin eso nadie se entera de la disputa y el bloque no sirve.

**Criterio de aceptación:** una devolución de una unidad de producto de tercero reingresa al lote de
origen en la consignación del proveedor, genera la nota crédito enlazada a la factura original, y revierte
la comisión del Integrante.

---

## Bloque R · Reconstrucción del Integrante que ya vendía

**Abierto el 2026-09-11.** Uno de los siete ya vendía con el HTML antes de que Atlas existiera para lo
comercial, y esas ventas **se facturaron a mano, por fuera**. Su saldo cargado dice **lo que recibió**, no
lo que tiene.

### Lo que hace falta, y el orden importa

1. **Importar sus pacientes desde el HTML.** Sin paciente no hay venta que registrar, y sin evaluación no
   hay a qué colgarla. Es también resolución de identidad: alguno puede existir ya en Atlas.
2. **Registrar las ventas retroactivas con su FECHA REAL**, no la de carga. Una venta con fecha de hoy
   contradice la factura que ya se emitió con otra fecha, y ese desacuerdo es el que mira una auditoría.
3. **Cuadrar contra las facturas emitidas a mano**, que es el punto que nadie más va a levantar: **esas
   facturas existen en Alegra y Atlas no las conoce.** Si Atlas registra esas ventas y vuelve a facturar,
   el mismo hecho queda con dos documentos. Así que el registro retroactivo tiene que poder decir *"esta
   venta YA está facturada, con este número"* y no emitir nada. Hoy no existe esa forma: el flujo asume
   que la factura la crea Atlas.

### Lo que se decidió mientras tanto, con sus tres opciones evaluadas

**El saldo NO se toca hasta tener las cifras.** Santiago ya le pidió que use solo la parte clínica y no
mueva nada comercial ni de inventario.

| Opción | Veredicto |
|---|---|
| **(a)** Marcar su inventario como *no conciliado* para que un conteo no abra faltantes | **No.** Sería construir una bandera nueva, y honrarla, dentro del camino que decide dinero (`recordCount`), para una persona y un estado temporal. El riesgo de tocar ese código supera al que evita |
| **(b)** Un movimiento de ajuste con su razón, cuando haya cifras | **No como interino, y es el que parece más sensato.** Un ajuste ahora y la reconstrucción después **restarían dos veces** el mismo producto. El ajuste solo sería válido si la reconstrucción no registrara las ventas, y entonces se pierde la historia, que es justo lo que se quiere recuperar |
| **(c)** No correr conteos hasta entonces | **Sí, y basta.** Ver abajo por qué la instrucción escrita es aquí un control completo y no una promesa |

**Por qué la instrucción basta, verificado en el código y no supuesto:**

- **Solo ella puede contar su propio inventario.** `recordCountFormAction` exige `canLoadOwnStock` y
  `recordOwnCount` resuelve el profesional **desde la sesión**: no hay ruta de administrador, ni masiva,
  ni de otro profesional. Nadie puede disparar un conteo en su nombre.
- **Nada la empuja a contar.** No hay alerta, recordatorio ni tarea pendiente de conteo en ninguna
  pantalla; es un formulario al que hay que ir a propósito, en `/mi-inventario`.

**Y lo que pasaría si se corriera igual**, para que se sepa el tamaño: un conteo con físico menor que el
saldo abre **un caso de faltante por producto**, con el **PVP sellado** al momento del conteo y un plazo
en días hábiles. Es decir, una deuda a su nombre por producto que vendió legítimamente, y deshacerla es un
procedimiento de dos personas, no un borrado.

---

## Bloques 4, 5 y 6

**4 · Liquidaciones (grande).** `/comercial`, la pantalla de comisiones del Integrante, la liquidación con
IVA y retención según perfil. **Y la retención que PRACTIQUE un Integrante que sea agente retenedor** (recordado por contabilidad el 2026-09-13, ya estaba en el modelo): cuando el Integrante le paga a CNV y retiene, lo que llega es menos que lo facturado, y esa diferencia es **anticipo de renta de CNV**, no un faltante ni un descuento. `tax_is_withholding_agent` ya existe en el perfil desde la migración 0123; falta que la liquidación la use (**con acumulado anual que se reinicia por año calendario**, adición d), los
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

> **SUPERADO (nota del 2026-09-13).** Esta sección es el diseño de 2026-09-10 y ya no describe lo que hay.
> Gildardo decidió habilitar LUVIA y retirar las equivalencias (migraciones 0126 y 0127: se borraron y se
> eliminó `allergen_relations`), y el asesor legal pidió **yuxtaponer** lo que declaró el paciente y lo que
> declara el producto, sin cruzarlos (`src/modules/nutraceuticals/yuxtaposicion-alergenos.ts`). Fuentes:
> `DECISIONES_LEGALES.md` y `MODELO_COMERCIAL_NUTRACEUTICOS_ATLAS.md` §7.7. Se conserva como historia.

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
| ~~La firma de Gildardo sobre las equivalencias~~ | **Cerrado: decidió sin equivalencias y LUVIA habilitada (0126).** Ya no bloquea |
| ~~Numeración de Atlas en Alegra~~ | **Decidida el 2026-09-13: compartida.** Ya no bloquea |
| Credenciales de Alegra y Wompi de producción | Bloque 2b |
| Perfil tributario de cada Integrante | Bloque 4 |
| ~~¿Existen muestras o cortesías?~~ | **Cerrado 2026-09-13: no existen.** No se construye |
| ~~El nombre de MULTI-CELL BASE según el registro RSA-3987-2026~~ | **Cerrado 2026-09-13: con guion** (verificado en INVIMA). Catálogo corregido en la 0137 y #16 de DATA_GOVERNANCE corregida |
| Anexo 2 actualizado y un Integrante habilitado | Bloque 5 |
