# ATLAS v10 — Bodega CNV: qué está hecho, qué falta y cómo se pone en línea

**Archivo:** `ATLAS_v10.html` (23.310 líneas · 1,46 MB) · **Base:** `ATLAS_v9.html`, sin modificar
**Sitio:** repositorio `CNV-SAS/cnv-corp` · **Fecha:** 27 de septiembre de 2026
**Para:** Equipo ATLAS — Santiago

---

Santiago: v10 agrega **un módulo nuevo y nada más**. El diff completo contra v9 son seis
cambios y están enumerados en la sección 1. No se tocó ningún cálculo, ninguna fórmula,
ningún umbral clínico ni ningún flujo de guardado.

El módulo es **Bodega CNV**: inventario de nutracéuticos con kardex, lotes, mínimos y
máximos, órdenes de compra e informes. Funciona hoy, pero funciona **sobre
`localStorage`**, es decir: el inventario es el del computador donde se abrió el archivo.
Ese es el trabajo que queda, y es el grueso de este documento.

---

## Resumen

| # | Frente | Estado | Quién |
|---|---|---|---|
| 1 | Módulo Bodega CNV en el HTML | **Funciona** | hecho |
| 2 | Descuento automático desde la consulta | **Funciona** | hecho |
| 3 | Registro de ventas de la tienda (sitio web) | Código listo, **sin desplegar** | Santiago |
| 4 | Tabla `ordenes_tienda` en Supabase de la web | **Sin crear** | Santiago |
| 5 | Webhook de Wompi + `WOMPI_EVENTS_SECRET` | **Sin configurar** | Santiago |
| 6 | Kardex en `localStorage` → Supabase | **Pendiente, es el bloqueador real** | Santiago |
| 7 | Autenticación (hoy PIN `1234` en el HTML) | **Pendiente** | Santiago |
| 8 | Consecutivos únicos entre equipos | **Pendiente** | Santiago |
| 9 | Pestaña «Inventario» duplicada en Administrador | **Sin resolver, a propósito** | decisión de Gildardo |

---

## 1 · Qué cambió respecto de v9

Seis cambios, verificados con `difflib` contra `ATLAS_v9.html`:

| Dónde | Qué |
|---|---|
| línea 4 | El `<title>` pasa a `ATLAS v10 · ANI BIS-E · CNV` |
| línea 17330 → 19857 | **Inserción** de 2.527 líneas: motor `BODEGA` + componente `ModBodega` |
| línea 20077 | `registrarDespacho` llama a `bodegaRegistrarSalida` |
| línea 20186 | `registrarEnvio` llama a `bodegaRegistrarSalida` |
| línea 22164 | Baldosa «Bodega CNV» en la pantalla de inicio |
| línea 22705 | Rama `if (modo === "bodega")` antes de `modo === "admin"` |

Los dos enganches son **aditivos**: van dentro de un `try/catch` propio y no alteran nada de
lo que esos métodos ya hacían. Si el inventario fallara, el despacho clínico se registra
igual. Eso es deliberado: no se le puede frenar la consulta a un profesional porque bodega
no digitó una entrada.

**Anclas para leer el código:**

| Qué | Línea |
|---|---|
| `BODEGA_DOCS_ADMIN` — documentos con acceso total | 17369 |
| `var BODEGA = (function () {` — el motor | 17379 |
| `bodegaRegistrarSalida(...)` — puente consulta → inventario | 18411 |
| `function ModBodega({ onGoInicio })` — la interfaz | 18528 |

---

## 2 · Un hallazgo que hay que conocer antes de tocar nada

**El catálogo de productos de ATLAS estaba partido en dos y nadie lo había notado.**

`VITACELLEBIS_PRODUCTS` (línea 15123) lista diez nombres terminados en `-CELL`:
`CARDIO-CELL`, `HEPATO-CELL`, `NEURO-CELL`… Esa lista **es código muerto**: hoy solo la
consumen el módulo Administrador viejo y ella misma.

El motor clínico despacha otros nombres, que son los reales y los mismos de la tienda:

> `OMEGA COMPLEX`, `BERBERINA METABO`, `CURCUMIN BIOACTIV`, `MITO-Q10 PLUS`, `HEPA-DETOX`,
> `ADAPTO-STRESS`, `MULTI-CELL BASE`, `SARCO-PROTECT`, `GUT-IMMUNE PRO`, `D3-K2 OSTEO`

Bodega se construyó sobre el catálogo correcto. **Si alguien reactiva la lista `-CELL` va a
descontar de frascos que nadie entrega.**

### 2.1 · Tres grafías para el mismo frasco (esto sí es un defecto vivo)

El motor de diagnóstico emite, en `getDX` (línea 4836 y siguientes):

| Emite | Pero la tabla de dosis y la tienda dicen |
|---|---|
| `MULTICELL BASE` | `MULTI-CELL BASE` |
| `HEPA DETOX` | `HEPA-DETOX` |
| `GUTIMMUNE PRO` | `GUT-IMMUNE PRO` |

Consecuencia hoy, **anterior a v10**: `NUTR_DOSIS` está indexada con guion, así que esos
tres productos salen en pantalla con el texto por defecto «Según criterio clínico» en vez de
su dosis real.

**No se corrigió** porque Gildardo pidió expresamente no tocar nada clínico. Queda anotado
para que lo decida él. Bodega, por su lado, ya es inmune: normaliza el nombre al escribir el
movimiento (función `canonico`, dentro del motor), quitando el prefijo `VITACELLEBIS`, los
acentos y todo lo que no sea letra o número. Por eso `MULTICELL BASE` y `MULTI-CELL BASE`
caen en un solo saldo.

---

## 3 · Qué falta en cada pantalla

### 3.1 · Pantalla de inicio

Nada pendiente. Cuarta baldosa, «🏭 Bodega CNV», `modo = "bodega"`.

### 3.2 · Bodega CNV — ingreso

| Estado | Detalle |
|---|---|
| Funciona | PIN `1234` → responsable de bodega, acceso total |
| Funciona | Cédula del propietario (`BODEGA_DOCS_ADMIN`, línea 17369) → acceso total |
| Funciona | Últimos 4 dígitos del documento de un integrante → solo su propio stock |
| **Falta** | **Autenticación de verdad.** El PIN está escrito en el HTML y además impreso en la pantalla de ingreso. Cualquiera que abra el archivo lo ve. Ver sección 5.2 |

### 3.3 · 📦 Stock

Completo. Tres columnas que **no son lo mismo** y conviene no confundir al portarlo:

- **Bodega** — lo que está físicamente en la bodega central.
- **Profesionales** — lo entregado por remisión que todavía no llega al paciente. Sigue
  siendo propiedad de CNV y por eso suma al inventario.
- **Total** — lo que la contabilidad reconoce como inventario.

Valorizado a costo promedio ponderado de compra, **no** a precio de venta.

### 3.4 · 🔔 Alertas

Completo: agotados, bajo mínimo, sobre máximo, saldos negativos, próximos a vencer,
vencidos, y el rastreo por lote (retiro de producto) con el informe imprimible.

**Falta**, si se quiere en línea: que las alertas de vencimiento lleguen por correo sin que
nadie tenga que abrir la aplicación. Hoy solo se ven al entrar.

### 3.5 · 🛒 Compras / OC

Completo: sugerencia de pedido según mínimos, orden de compra numerada con proveedor, IVA y
firmas, recepción contra la orden (es ahí donde entra el stock, con lote y vencimiento
obligatorios), y anulación.

| **Falta** | Cargar los datos del proveedor de Bogotá en Parámetros. Sin NIT, la orden no sirve de soporte |

### 3.6 · 🚚 Remisiones

Completo. Bodega → profesional, con FEFO (sale primero el lote que vence antes) y remisión
imprimible con la cláusula de consignación.

Nota de diseño: **la remisión se bloquea si no hay existencias vigentes**, mientras que el
despacho al paciente sí se permite en descubierto (queda el saldo en rojo y se avisa). La
asimetría es a propósito: la bodega es quien digita, la consulta no.

### 3.7 · 🛒 Tienda ← **aquí está el trabajo del sitio web**

La pestaña existe y funciona, pero **no tiene qué leer todavía**. Ver sección 4 completa.

| **Falta** | Crear la tabla en Supabase, desplegar el webhook y pegar credenciales en Parámetros |

### 3.8 · 📒 Kardex

Completo. Libro append-only, costeo por promedio ponderado permanente, anulación por
contrapartida (nada se borra: el original queda tachado y a la vista), exportable a Excel.

### 3.9 · 🧮 Toma física

Completo. Conteo contra saldo del sistema, ajuste valorizado al promedio y acta numerada
para firmar.

### 3.10 · 📈 Informes

Completo: por país, ciudad, profesional y línea; y la tienda como canal propio.

| **Falta** | **Que el consolidado sea real.** Hoy el informe «por país» solo refleja lo registrado en ESE computador. Ver sección 5.1 |

### 3.11 · ⚙️ Parámetros

Completo: empresa, proveedor, IVA, días de alerta, mínimos/máximos/costos por línea, saldo
inicial de apertura, respaldo y restauración del kardex en `.json`.

### 3.12 · Módulo Administrador (el viejo)

**Sin tocar, a propósito.** Su pestaña «📦 Inventario» (línea 22714 en adelante) sigue
calculando el stock por su cuenta con la lista `-CELL`, así que va a mostrar cifras que **no
cuadran** con Bodega CNV. No se retiró porque Gildardo no lo pidió. Es una decisión suya,
no un olvido.

### 3.13 · Rutas de atención (consulta)

Funciona el descuento automático. Cuando un profesional registra un despacho, sale de **su**
stock en consignación, por lote y con FEFO, y el total de la compañía baja en ese instante.

Si la sesión clínica solo trae el nombre del profesional, `bodegaCompletarProf` rellena
documento, ciudad y país desde `atlas:admin:integrantes`. Sin eso el saldo caía en una
ubicación distinta de la que recibió la remisión, y el informe por ciudad salía vacío.

---

## 4 · Ventas de la tienda — lo que hay que desplegar

### 4.1 · El problema que resuelve

Hasta hoy, `src/pages/api/checkout-wompi.ts` recalculaba el precio, firmaba y redirigía a
Wompi. **No guardaba la orden en ninguna parte.** `src/pages/tienda/gracias.astro` solo vacía
el carrito y no hay webhook. Resultado: en el tablero de Wompi queda la referencia y el
monto, pero **no qué frascos se vendieron**. Sin ese dato no hay nada que descontar.

### 4.2 · Archivos entregados en `cnv-corp`

Están en el árbol de trabajo, **sin commit y sin desplegar**:

| Archivo | |
|---|---|
| `supabase/ordenes_tienda.sql` | nuevo · tablas, índices, RLS y la vista que lee ATLAS |
| `src/lib/ordenes.ts` | nuevo · guarda y actualiza órdenes por REST, sin SDK |
| `src/pages/api/wompi-webhook.ts` | nuevo · confirma el pago y verifica la firma |
| `src/pages/api/checkout-wompi.ts` | **modificado**, aditivo |
| `.env.example` | **modificado** · documenta `WOMPI_EVENTS_SECRET` |

El checkout es el único archivo en funcionamiento que hubo que tocar, porque **es el único
momento en que se sabe qué hay en el carrito**. El registro va sin bloquear el retorno y con
su propio `catch`: si Supabase está caído, el comprador llega igual a la pasarela.

### 4.3 · Pasos, en este orden

1. **Correr `supabase/ordenes_tienda.sql`** en el proyecto de Supabase **de la web** — el
   mismo de `comentarios.sql`, **no** el de ATLAS. SQL Editor → New query → pegar → Run.
2. **En Wompi** → Desarrolladores → Eventos: registrar la URL
   `https://cnvsystem.com/api/wompi-webhook` y copiar el **secreto de eventos** (distinto del
   de integridad).
3. **En Vercel** → Settings → Environment Variables: agregar `WOMPI_EVENTS_SECRET`.
4. **Desplegar** (push a `master`). Antes de los pasos 1 y 2 no rompe nada —la venta sigue
   funcionando igual— pero cada compra registraría un error en el log sin guardar la orden.
5. **En ATLAS** → Bodega → Parámetros → «Tienda virtual»: pegar `PUBLIC_SUPABASE_URL` y
   `PUBLIC_SUPABASE_ANON_KEY` del proyecto de la web.

### 4.4 · Decisión de privacidad, para que no la deshagas sin querer

La vista `ordenes_tienda_bodega` expone **solo** referencia, fecha, `producto_id`, nombre y
cantidad. Nombre, correo y teléfono del comprador **no salen de ahí**.

El motivo: la clave anónima que ATLAS lleva dentro del HTML es pública, y cualquiera que
abra el archivo la puede leer. Exponer datos de compradores por esa vía sería un problema de
Ley 1581, no un detalle de diseño. Los datos del comprador se consultan desde el panel de
Supabase, con la clave de servicio.

### 4.5 · Por qué no hace falta tabla de equivalencias

`producto_id` en `ordenes_tienda_items` es el slug del catálogo
(`cnv-corp/src/data/nutraceuticos.ts`), y el catálogo de Bodega usa **ese mismo `id`**. Si
algún día llega un id desconocido, el renglón sale marcado en rojo y **bloquea el despacho**
en vez de descontar el frasco equivocado.

### 4.6 · Cuándo se descuenta

**Al despachar, no al pagar.** Entre una cosa y la otra pasan días, y descontar al pagar
dejaría el saldo peleado con lo que hay en el estante. La orden sale de la bodega central,
con su lote, igual que cualquier otra salida. La referencia de la orden es el número del
documento en el kardex, y por eso el propio libro impide despacharla dos veces.

### 4.7 · Verificación de la firma del webhook

El checksum es `SHA256(valores_de_signature.properties + timestamp + WOMPI_EVENTS_SECRET)`,
comparado en tiempo constante. Probado contra: evento legítimo, evento firmado con otro
secreto, monto rebajado, `DECLINED` cambiado a `APPROVED` a mano, timestamp movido, cuerpo
vacío y checksum de otra longitud. **Sin esta comprobación, cualquiera que conozca la URL
podría marcar órdenes como pagadas y sacar mercancía de la bodega.**

---

## 5 · Poner el inventario en línea — el trabajo de fondo

### 5.1 · `localStorage` es el bloqueador

Hoy todo Bodega vive en cinco claves del navegador:

| Clave | Contenido |
|---|---|
| `atlas:bodega:movimientos` | el kardex completo |
| `atlas:bodega:ordenes` | órdenes de compra |
| `atlas:bodega:tomas` | actas de toma física |
| `atlas:bodega:parametros` | empresa, proveedor, mínimos/máximos, credenciales de la tienda |
| `atlas:bodega:consecutivos` | numeración por tipo y año |

Esto significa que **el inventario es el de ese computador**. Un despacho que registre un
profesional en Medellín, en su equipo, no llega nunca al de la bodega. El informe «por país»
parece nacional pero no lo es. Gildardo eligió `localStorage` sabiéndolo, para arrancar; el
módulo lo advierte en pantalla y por eso trae respaldo a `.json`.

**Para ponerlo en línea, la migración es casi mecánica**, y el motor se diseñó para eso: el
kardex es append-only y todos los saldos se calculan del libro. No hay ningún saldo guardado
aparte que pueda desincronizarse.

Esquema propuesto, en el Supabase **de ATLAS**:

```sql
create table public.bodega_movimientos (
  id            text primary key,          -- el mismo _uid() del motor
  ts            timestamptz not null,
  fecha         date not null,
  tipo          text not null,             -- entrada|traslado|salida|devolucion|ajuste|baja
  producto      text not null,             -- ya viene normalizado por canonico()
  lote          text not null default 'SIN-LOTE',
  vence         date,
  cant          numeric not null,          -- con signo solo en 'ajuste'
  origen        text,                      -- null | 'BODEGA' | 'PROF:<doc>'
  destino       text,
  costo_unit    numeric not null default 0,
  doc_tipo      text, doc_num text,
  canal         text,                      -- '' | 'tienda'
  prof          jsonb, paciente jsonb, cliente jsonb,
  usuario       text, nota text,
  anulado       boolean not null default false,
  anula_a       text references public.bodega_movimientos(id)
);
```

Más `bodega_ordenes`, `bodega_tomas` y `bodega_parametros` (una fila).

**Puntos de corte en el código**, todos dentro del motor y en un solo sitio cada uno:

- `_get` / `_set` — las dos únicas funciones que hablan con `localStorage`. Reemplazarlas
  por llamadas a Supabase es el 80 % del trabajo.
- `movimientos()` — lectura del libro.
- `registrar()` y `registrarLote()` — las dos únicas escrituras de movimientos.

Todo lo demás (`saldos`, `stockPorLinea`, `planFEFO`, `kardexProducto`, `alertas`, `recall`,
`informe`) es cálculo puro sobre el arreglo de movimientos y **no hay que tocarlo**.

### 5.2 · Autenticación

Hoy: PIN `1234` escrito en el HTML, más la cédula del propietario, más los últimos cuatro
dígitos del documento de cada integrante. Sirve para arrancar; no sirve en línea.

Falta **Supabase Auth** — que además es el mismo bloqueador que ya arrastra la encuesta por
QR, donde el profesional no puede leer la cola. Conviene resolverlo una sola vez para todo
ATLAS, no módulo por módulo. Con Auth puesto, las políticas RLS caen solas:

- responsable de bodega → lee y escribe todo;
- integrante → lee y escribe solo los movimientos donde `origen` o `destino` es su ubicación;
- nadie borra: `delete` sin política, que es como ya se comporta el motor.

### 5.3 · Consecutivos: ojo con esto al migrar

`siguienteNumero()` lee y escribe `atlas:bodega:consecutivos` en el navegador. Genera
`OC-2026-0001`, `REM-…`, `DESP-…`, `ENT-…`, `DEV-…`, `BAJA-…`, `ACTA-…`, `SI-…`.

**Con dos computadores conectados, los dos generarían `OC-2026-0001`.** Al migrar hay que
pasarlo a una secuencia en la base —una función `rpc` que haga el `update … returning` en
una sola transacción— antes de que haya más de un puesto trabajando. Una orden de compra con
consecutivo repetido no es soporte de nada.

### 5.4 · Qué NO hay que cambiar al migrar

- **El kardex no se edita ni se borra.** Anular escribe la contrapartida y marca el original;
  ambos quedan en el libro y por eso el saldo cuadra. Si alguien «optimiza» esto con un
  `delete`, se pierde la trazabilidad y el soporte del inventario.
- **El movimiento anulado sigue contando** en `saldos()`. Es correcto: su contrapartida ya lo
  neutraliza. Saltarlo *además* de escribir la contrapartida restaría dos veces — es el error
  que se encontró y se corrigió durante el desarrollo.
- **Lote y vencimiento son obligatorios en toda entrada.** Sin eso, un retiro de producto es
  imposible de ejecutar.

---

## 6 · Lo que se probó

| Frente | Cobertura |
|---|---|
| Motor de inventario | 80 comprobaciones en Node: costeo promedio ponderado, FEFO, dos niveles, alertas, retiro por lote, toma física, anulación, respaldo, normalización de nombres y ventas de tienda |
| Firma del webhook | 13 comprobaciones, incluidas las que intentan aprobar un pago rechazado o rebajar el monto |
| Interfaz | Recorrido en Chrome de las ocho pestañas, sin errores de consola |
| Sitio | Compila completo. Falla solo el último paso del adaptador de Vercel creando *symlinks* en Windows: es una limitación local, no del código |
| Tipos | Sin errores en los archivos nuevos. Los dos que reporta `tsc` son preexistentes, en `DFIPentagon.tsx` |

**No verificado:** el recorrido visual de la pestaña «Tienda» contra datos reales, porque
todavía no existe la tabla. Su lógica sí quedó probada.

---

## 7 · Orden sugerido de trabajo

1. Correr el SQL y configurar el webhook (sección 4.3). Es lo único que hoy hace falta para
   que una venta deje rastro, y sirve aunque después cambie todo lo demás.
2. Resolver **Supabase Auth** para todo ATLAS, no solo para Bodega (sección 5.2).
3. Migrar el kardex a Supabase (sección 5.1) y, en la misma pasada, los consecutivos
   (sección 5.3).
4. Decidir con Gildardo qué se hace con la pestaña «Inventario» del Administrador viejo
   (sección 3.12).
5. Decidir con Gildardo las tres grafías del motor clínico (sección 2.1).

Los puntos 4 y 5 son decisiones suyas, no tareas técnicas. No los ejecutes sin su visto
bueno.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
