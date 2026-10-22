# Revisión de ATLAS v10 contra Atlas: qué ya existe, qué está superado y qué es nuevo

**Entrega:** `ATLAS_v10.html` (27 de septiembre de 2026, 23.310 líneas) + su documento
`ATLAS_v10_PENDIENTES_para_Santiago.md` · **Base:** v9, sin modificar
**Revisado:** 2026-10-22, contra el código de Atlas en `main` (`2cd84022`)
**Método:** se leyó el documento de cambios completo y se cotejó cada punto contra el código y el esquema
de Atlas. No se leyó el HTML entero (1,46 MB); donde el veredicto depende de su contenido, se dice.

---

## El veredicto en una línea

**v10 agrega UN módulo y nada más: Bodega CNV.** Gildardo lo dice él mismo: *"No se tocó ningún cálculo,
ninguna fórmula, ningún umbral clínico ni ningún flujo de guardado."* Y ese módulo es, en su mayor parte, el
inventario que Atlas **ya tiene y tiene mejor**, porque el prototipo corre sobre `localStorage` (el
inventario es el del computador donde se abrió el archivo) y Atlas corre sobre PostgreSQL con RLS.

**Lo que de verdad falta construir son tres cosas**, y una sola de ellas es barata y valiosa:

| | qué | tamaño |
|---|---|---|
| **A** | **Retiro por lote (recall) con su informe** | **barato, y es el que recomiendo**: el dato ya está completo, falta la pantalla |
| **B** | Mínimos y máximos por producto, con sus alertas | mediano |
| **C** | Compras / órdenes de compra con proveedor e IVA | el módulo grande; es contabilidad de compras, no inventario clínico |

Y una que **no es de Atlas**: el registro de las ventas de la tienda (§4), que vive en `cnv-corp`.

---

## 1 · Punto por punto, en la numeración de Gildardo

| § | Lo que pide v10 | Veredicto |
|---|---|---|
| 1 | Módulo `BODEGA` + `ModBodega`, baldosa de inicio, `modo = "bodega"` | **No aplica tal cual.** Es la arquitectura de un HTML de una sola página. En Atlas el inventario ya es un módulo con sus pantallas (`/nutraceuticos`, `/faltantes`, `/mi-inventario`), sus policies y su RLS |
| 2 | El catálogo partido en dos (`VITACELLEBIS_PRODUCTS` con los `-CELL` es código muerto) | **No aplica.** En Atlas el catálogo es **una** tabla (`nutraceuticals`), con registro sanitario. No hay segunda lista que reactivar |
| **2.1** | **Las tres grafías** (`MULTICELL BASE`, `HEPA DETOX`, `GUTIMMUNE PRO`) | **YA RESUELTO en Atlas, y con una corrección que le toca a él** (ver §2 abajo) |
| 3.2 | Autenticación de verdad (hoy PIN `1234` en el HTML) | **YA EXISTE.** Supabase Auth, roles y RLS. Y la afirmación de que es *"el mismo bloqueador que ya arrastra la encuesta por QR, donde el profesional no puede leer la cola"* **no es cierta en Atlas**: ese flujo funciona |
| 3.3 | Stock en tres columnas: Bodega · Profesionales · Total | **YA EXISTE.** Ubicación central + una por Integrante, con el saldo por `(ubicación, producto, lote)`. La consignación (el producto sigue siendo de CNV en la vitrina del Integrante) es el eje del modelo comercial, no una columna |
| 3.3 | Valorizado a costo promedio ponderado de compra | **NUEVO.** Atlas guarda PVP, no costo de compra. Va con la **C** |
| 3.4 | Alertas: por vencer y vencidos | **YA EXISTE Y SUPERADO.** 60 días de anticipación, y la alerta **no es un correo: es un registro** que decide **quién asume** el vencido (modelo comercial, §"Alerta de vencimiento"). Además sale por cron, así que el pendiente que v10 lista (*"que lleguen por correo sin que nadie abra la aplicación"*) ya está hecho |
| 3.4 | Alertas: agotados, bajo mínimo, sobre máximo, saldos negativos | **NUEVO en parte.** Agotado y negativo se ven; **mínimo y máximo no existen**. Es la **B** |
| 3.4 | **Rastreo por lote (retiro de producto) con informe imprimible** | **NUEVO, y es el que vale.** Ver §3 |
| 3.5 | Compras / OC: sugerencia por mínimos, orden numerada con proveedor, IVA y firmas, recepción contra la orden, anulación | **NUEVO entero.** Es la **C** |
| 3.6 | Remisiones bodega → profesional con FEFO | **YA EXISTE.** La remesa, y FEFO en `asignacion-por-lote.ts` (*"sale primero lo que vence primero"*), con una línea que puede salir de varios lotes, que v10 no contempla |
| 3.6 | *"La remisión se bloquea si no hay existencias vigentes"*, y el despacho al paciente sí se permite en descubierto | **YA EXISTE, y se construyó el 2026-10-15 por el camino contrario.** Dos diseños independientes llegaron a la misma asimetría, con el mismo argumento (*"la bodega es quien digita, la consulta no"*). Conviene nombrarlo: es una convergencia, no una coincidencia |
| 3.7 | Tienda virtual | **FUERA DE ATLAS.** Ver §4 |
| 3.8 | Kardex append-only, costeo, anulación por contrapartida, exportable | **YA EXISTE Y SUPERADO.** Los movimientos son **inmutables por trigger** en la base (migración 0040): no es una convención del motor, es que `UPDATE` y `DELETE` están bloqueados. Lo que falta de aquí es el **costeo** (va con la C) |
| 3.9 | Toma física: conteo contra saldo, ajuste valorizado, acta numerada | **YA EXISTE.** Conteo con su **ventana mensual** (se abre el 1 y cierra el 5, para que la pantalla diga *cuándo toca*), conciliación por movimiento con motivo, y el sobrante liga a la línea de conteo que lo originó. Lo que falta es el **ajuste valorizado** (C) |
| 3.10 | Informes por país, ciudad, profesional y línea | **PARCIAL.** Hay tablero de Dirección con insights de compra y cifras por producto e Integrante; **por país y ciudad no**. Y el pendiente que v10 declara (*"que el consolidado sea real"*) **no existe en Atlas**: el consolidado siempre fue real |
| 3.11 | Parámetros: empresa, proveedor, IVA, días de alerta, mín/máx/costos, saldo inicial, respaldo `.json` | **PARCIAL.** Lo que falta es proveedor, IVA, mín/máx y costos (B y C). El **respaldo a `.json` no aplica**: la base es la base, con sus copias |
| 3.12 | Decidir qué hacer con la pestaña «Inventario» del Administrador viejo, que no cuadra | **No aplica.** En Atlas no hay dos inventarios |
| 3.13 | Descuento automático al despachar, por lote y FEFO; `bodegaCompletarProf` rellena documento, ciudad y país | **YA EXISTE.** El despacho descuenta de la vitrina del Integrante por lote, y liga el movimiento al tratamiento (y por él, al paciente). El relleno de datos del profesional **no aplica**: en Atlas el Integrante es una fila con FK, no un nombre que haya que completar |
| 5.1 | `localStorage` es el bloqueador: migrar el kardex a Supabase | **NO APLICA, y es el motivo de que Atlas exista.** Nunca hubo `localStorage` para inventario |
| 5.2 | Supabase Auth, y las RLS que *"caen solas"* con él | **YA EXISTE**, y las tres políticas que describe son, con otras palabras, las que ya están escritas |
| 5.3 | Consecutivos: *"con dos computadores, los dos generarían OC-2026-0001"* | **NO APLICA.** Atlas no numera movimientos: usa uuid. La numeración que sí importa es la de la **factura**, y la da la DIAN vía Alegra |
| 5.4 | Qué NO cambiar al migrar: el kardex no se edita ni se borra; el anulado sigue contando; lote y vencimiento obligatorios en toda entrada | **YA SE CUMPLE, y por construcción**: append-only por trigger, y `lot_id` **obligatorio en todo movimiento** desde la 0121 |

---

## 2 · Las tres grafías: ya está resuelto, y hay algo que devolverle

Gildardo lo marca como *"esto sí es un defecto vivo"*: su motor emite `MULTICELL BASE`, `HEPA DETOX` y
`GUTIMMUNE PRO`, mientras la tabla de dosis y la tienda usan `MULTI-CELL BASE`, `HEPA-DETOX` y
`GUT-IMMUNE PRO`, así que esos tres salen con *"Según criterio clínico"* en vez de su dosis.

**En Atlas eso ya no pasa.** Hay un mapa de alias **explícito** (`nutraceuticals-recommendation.ts`,
2026-09-13) que traduce la grafía del motor a la del catálogo, con su candado. Es explícito a propósito: un
nombre nuevo del motor **no empareja por accidente**, cae a `no_en_catalogo` y se ve.

**Y lo que hay que devolverle, porque es al revés de lo que su documento asume:** en Atlas el catálogo decía
`MULTICELL BASE` porque se creyó que así lo escribía el registro INVIMA. **El registro RSA-3987-2026 dice
`MULTI-CELL BASE`, con guion** (verificado por Santiago, migración 0137). Así que la grafía canónica es la
del guion, y las tres sin guion del motor son las que están mal.

> **Pregunta para él:** ¿corrige el motor para que emita las tres con la grafía del registro sanitario? Es
> lo único de v10 que toca su capa clínica, y por la Regla 0 lo decide él. Mientras no lo haga, el alias de
> Atlas lo cubre y nadie ve el defecto.

---

## 3 · El retiro por lote: lo barato y lo que recomiendo

De todo v10, esto es lo único que **vale construir ya**, y es barato por una razón concreta: **el dato ya
está completo y no hay que modelar nada.**

- Todo movimiento lleva `lot_id` **obligatorio** desde la migración 0121.
- El despacho al paciente lleva `treatment_id`, y por él se llega al paciente y a su profesional.
- Las ventas llevan el lote en la reserva de inventario (`inventory_reservations.lot_id`), y una línea que
  salió de dos lotes dejó **un movimiento por lote**.

O sea que la cadena **lote → unidades → ubicación → paciente** ya es reconstruible entera. Lo que no existe
es **la pantalla que la pregunta**: "dame todo lo que salió del lote X, con quién lo tiene y a qué paciente
llegó", y su informe para firmar.

**Por qué importa más que lo demás:** es la única pieza de v10 que responde a una obligación regulatoria.
Si el laboratorio reporta un lote defectuoso, hoy la respuesta saldría de consultas a mano sobre la base.
Y la propia nota de Gildardo lo dice de otra forma: *"lote y vencimiento son obligatorios en toda entrada;
sin eso, un retiro de producto es imposible de ejecutar"*. En Atlas sí son obligatorios: lo que falta es
poder ejecutarlo.

**Lo que haría falta, dimensionado:** un lector (una consulta con tres joins), una pantalla de admin con el
lote como entrada, y la hoja imprimible, que reusa `HojaImprimible`, el componente que ya imprime la
historia clínica. **Sin migración.**

---

## 4 · La tienda (§4 de v10): no es de Atlas, y hay un filo

Los cinco archivos que Gildardo entregó (`ordenes_tienda.sql`, `ordenes.ts`, `wompi-webhook.ts`, el
checkout y el `.env.example`) están **en `cnv-corp`**, el repositorio del sitio web, sin commit y sin
desplegar. No tocan Atlas, y por `BOUNDARIES.md` no se importa código entre dominios de CNV.

**Lo que sí hay que saber desde Atlas, porque es la parte que se puede equivocar:**

1. **Son DOS proyectos de Supabase distintos.** Su §4.3 lo dice bien (*"el proyecto de la web, NO el de
   ATLAS"*), y conviene que siga así: una tabla de órdenes de la tienda en la base clínica mezclaría
   compradores con pacientes.
2. **El `WOMPI_EVENTS_SECRET` de la web es DISTINTO del secreto de integridad que usa Atlas.** Atlas ya
   tiene su propio webhook de Wompi (`/api/webhooks/wompi`) con su firma verificada. Son dos webhooks de
   dos pasarelas distintas; no se comparte el secreto.
3. **Su §4.4 (la decisión de privacidad) es correcta y conviene no deshacerla:** la vista expone solo
   referencia, fecha, producto y cantidad, porque la clave anónima va dentro del HTML y es pública.
4. **Y su §4.6 coincide con Atlas:** se descuenta **al despachar, no al pagar**. Es la misma regla que
   Atlas aplica a la remesa (anuncio) contra la recepción (saldo).

**Si algún día la tienda descuenta del inventario de Atlas**, el camino no es que el HTML lea la base: es
el escritor que ya falta para *"registrar unidades en central"* (sección 2 del smoke), más una venta de
admin desde la bodega, que también está dimensionada. No es trabajo nuevo: es el mismo pendiente.

---

## 5 · Lo que NO se hizo, a propósito

No se construyó nada. No se tocó el motor clínico. No se commiteó el HTML (son 1,46 MB y **trae la URL del
proyecto y una publishable key**: por eso el `.gitignore` se amplió hoy a `docs/entregas/**/ATLAS_*.html`).

**Y queda una pregunta de método para Santiago**, porque va a volver con v11 y v12: el documento de v10 está
escrito para *"portar Bodega CNV a producción"*, y el resultado de esta revisión es que casi nada de eso hay
que portarlo. Si Gildardo sabe que Atlas ya tiene inventario en PostgreSQL con RLS, kardex inmutable, FEFO,
lotes obligatorios y conteo con ventana, su próximo prototipo puede pedir **lo que falta** en vez de
reconstruir lo que hay. Eso ahorra el trabajo de los dos lados.

**Siguiente paso, cuando Santiago diga:** mismo ejercicio con **v11** (automatización, datos completos y
CNVResearch) y después con **v12** (lista de pacientes, control de calidad biológico, Diana en semáforo y
flujo guiado del nutricionista). De los tres, **v12 es el que más trabajo nuevo trae**, y dos de sus puntos
esperan números que Gildardo todavía no ha entregado.
