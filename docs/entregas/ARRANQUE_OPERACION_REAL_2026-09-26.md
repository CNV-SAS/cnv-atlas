# Arranque de operación real · checklist

**Para Santiago, 2026-09-26.** Reconstruido y verificado contra el código, no de memoria. Lo que ya estaba
planeado vive en `LANZAMIENTO.md` (bloque "antes del primer Integrante"); esto lo completa con lo que apareció
al revisarlo y con las decisiones nuevas.

**Las decisiones ya tomadas, que no se relitigan aquí:** se arranca ya, **sin separar ambientes** (lo que
protege ya existe: `wompi_env` y `alegra_env` por venta), **el segundo factor no se activa todavía**, y la
modalidad Distribución queda para después (Katherine anota sus ventas por fuera mientras tanto).

---

## Antes de que entre el primer Integrante real

Ocho cosas. Las dos primeras son de dinero, las cinco siguientes de configuración, y la última es la única
que necesita trabajo nuestro.

### 1 · Vercel Pro · INDISPENSABLE, y la razón es de licencia

No es capacidad: **el plan Hobby prohíbe el uso comercial**, y Atlas le cobra a pacientes, factura y reparte
comisiones. No hay margen de interpretación.

Y hay una segunda razón que muerde el mismo día: **los avisos de ventas salen de tareas programadas**, y en
Hobby cada tarea corre una vez al día con hasta 59 minutos de desfase (el correo de las 7 a. m. puede llegar a
las 7:59). En Pro corren a la hora exacta.

### 2 · Supabase Pro · INDISPENSABLE

25 USD/mes. Trae backups diarios con 7 días de retención.

**Y la trampa que ya está anotada, porque se redescubre:** al contratar Pro, **el proyecto sigue en la
instancia Nano** aunque se cobre como Micro. Hay que subirla a mano en *Settings → Compute and Disk* (menos de
2 minutos de caída). Después: que la app abra, `pnpm db:check:cloud`, y mirar en los reportes de un día normal
que el disco y la memoria no toquen techo.

**PITR sigue siendo NO.** 100 USD/mes por cada 7 días de ventana, más un add-on de cómputo obligatorio (unos
130 en total), **reemplaza los backups diarios en vez de sumarse**, y **está excluido del tope de gasto**. La
condición que lo cambia, escrita para no volver a discutirla: *entra cuando perder una jornada de trabajo
clínico cueste más que su precio.*

### 3 · Wompi a producción

- `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` → la llave `pub_prod_...`
- `WOMPI_PRIVATE_KEY` → la `prv_prod_...`
- `WOMPI_EVENTS_SECRET` y `WOMPI_INTEGRITY_SECRET` → los de producción (son distintos de los del sandbox)

**Lo que decide el ambiente de una venta es el prefijo de la llave pública** (`pub_prod_` = producción, todo lo
demás = prueba), y se sella EN la venta. Así que las ventas viejas se quedan marcadas como prueba para siempre,
que es lo correcto: no se pueden facturar de verdad y el panel dice por qué.

**Y el webhook:** la URL de eventos en el panel de Wompi de producción tiene que apuntar a Atlas. Es la que
confirma los pagos; sin ella, un paciente paga y la venta se queda en pendiente.

### 4 · Alegra a producción · y aquí hay MÁS de lo que parece

**(a) La variable.** `ALEGRA_BASE_URL` sin "sandbox" en la URL, y `ALEGRA_API_KEY` la de producción. El
ambiente **se deduce de la URL a propósito**, no de una variable aparte: una variable podría decir
"producción" mientras la URL apunta al sandbox, y esa contradicción no la ve nadie hasta que sale una factura
de prueba con numeración real.

**(b) La fila de configuración, que NO existe todavía.** `alegra_config` solo tiene la fila `sandbox`
(migración 0130). Hacen falta, leídos de la API de producción:

| Dato | Qué es | Si se equivoca |
| --- | --- | --- |
| `invoice_template_id` | La numeración electrónica autorizada | La factura sale sin consecutivo válido |
| `iva_tax_id` | El impuesto IVA 19 % | **Sale al 0 % sin que nada falle** |
| `cost_center_propio_id` | Centro de costo de producto propio | La contabilidad no separa propio de tercero |
| `cost_center_tercero_id` | Centro de costo de tercero (LUVIA) | Lo mismo |

Sin esa fila, la facturación se para diciendo *"No hay configuración de Alegra para el ambiente produccion"*.
Es un freno explícito, no un fallo silencioso, pero es un freno.

**(c) Los items de los productos.** `alegra_items` lleva una fila **por ambiente** (migración 0144), así que
configurar producción no deja al sandbox sin items. Pero hay que crear las de producción: los **cinco**
productos. Un producto sin fila en ese ambiente **se rechaza por su nombre**, así que el error dice cuál falta.

> **Cuidado documentado:** el item 3 es D3-K2 OSTEO y el 4 es LUVIA. Van seguidos y son de líneas distintas;
> cruzarlos facturaría un producto de tercero como propio.

**(d) La cuenta puente de transferencias** (`alegra_config.bank_account_transferencia_id`, migración 0174)
sigue nula. Mientras lo esté, **una venta por transferencia se registra bien y su factura espera**, con el
motivo a la vista. No bloquea el arranque; bloquea facturar ese medio.

### 5 · `ATLAS_FASE=lanzamiento`

Cambia el aviso de arriba de "Entorno de pruebas. Nada de lo que registres aquí es real" a la advertencia de
operación real.

**Esto se construyó hoy porque no se podía hacer solo con configuración:** el aviso colgaba de
`ATLAS_MFA_RELAXED`, o sea del segundo factor. Y como el segundo factor **sigue relajado** y **no hay dos
proyectos**, Atlas habría seguido diciéndoles "nada de lo que registres aquí es real" a profesionales
atendiendo pacientes de verdad. Ahora son dos hechos separados.

**Sin la variable no se muestra ningún aviso**, y el defecto por omisión es ese a propósito: callar es
molesto, pero decir "es de prueba" sobre datos reales invita a registrar basura y eso no se deshace.

### 6 · Las migraciones

**184 en el repo, 184 aplicadas.** Al día. `pnpm db:check:cloud` lo confirma, y el conteo es el único control
que no miente (drizzle imprime "applied successfully" igual cuando se salta una).

### 7 · Marcar los pacientes de prueba que ya están en producción

Hay **5** marcados y **59** sin marca. Al pasar Alegra a producción, los 5 marcados dejan de facturarse solos
(con su motivo), que es lo correcto. Lo que hay que revisar es **al revés**: si alguno de los 59 "reales" es en
realidad una prueba, ahora se le emitiría una factura fiscal de verdad.

El mecanismo está construido: el profesional lo propone con motivo y admin confirma, en `/admin`.

### 8 · El dump externo · lo único que pide trabajo nuestro

Es lo que cubre lo que **ni el backup nativo ni el PITR** cubren: perder el proyecto o la cuenta, porque los
dos viven **dentro** de Supabase. Unas horas de trabajo, y una restauración probada (un backup que nunca se
restauró no es un backup).

---

## La regla de facturación: **no hay que quitarla**

Santiago escribió: *"para arrancar habría que quitar la regla de que solo se factura a los profesionales que
tienen identidad de prueba"*, por este mensaje:

> *El paciente NO está marcado como de prueba y se está facturando contra sandbox. No se emite: su identidad
> viajaría a un ambiente de pruebas.*

**La regla no dice lo que parece, y quitarla haría daño.** No filtra por profesional ni exige identidades de
prueba. Lo que hace es **negarse a mandar la identidad de un paciente real al ambiente de pruebas de Alegra**,
que es un tercero. Es la regla que tú mismo pusiste el 2026-09-12 (*"a sandbox no van datos de pacientes
reales, aunque sean solo identificación y contacto"*) convertida en mecanismo.

Quitarla mandaría el nombre, el documento y el correo de pacientes reales al sandbox de un proveedor, **y la
venta saldría bien: nadie se enteraría.** Ese es exactamente el caso que la regla existe para cerrar.

**Lo que falta no es la regla, es el punto 4:** Alegra está en sandbox. En cuanto apunte a producción, ese
paciente se factura solo, sin tocar una línea de código. Y la regla sigue protegiendo en la otra dirección: un
paciente de prueba no genera un documento fiscal real a nombre de alguien que no existe.

---

## Lo que NO se hace ahora, y por qué

| | Decisión |
| --- | --- |
| **Segundo factor (MFA)** | **No se activa.** Decisión de Santiago: falta organizarlo con correo y hay cosas más urgentes. **La exposición se acepta a sabiendas:** hay PII clínica real y las cuentas con rol obligatorio siguen sin segundo factor. La relajación solo PAUSA la exigencia; al quitarla, todas caen al enrolamiento en el siguiente login y ninguna quedó exenta. |
| **Separar ambientes** | **No.** Lo que protege ya existe y es por venta (`wompi_env`, `alegra_env`), no por proyecto. Separar es tiempo que no hay, y el riesgo que cubriría ya está cubierto. |
| **Modalidad Distribución** | Construida como mecanismo (el cambio manda y el sellado la obedece), **sin el lado del recaudo**. Mientras tanto los caminos de venta la bloquean con el motivo dicho. Katherine anota por fuera. |
| **PITR** | No, con su condición escrita arriba. |

---

## El orden de la mañana del arranque

1. Contratar **Vercel Pro** y **Supabase Pro**, y **subir la instancia** de Nano a Micro.
2. Crear la fila de `alegra_config` de producción y los 5 `alegra_items`, leídos de la API de producción.
3. Cambiar las variables en Vercel: Wompi (4), Alegra (2), `ATLAS_FASE=lanzamiento`. **Redesplegar**, porque
   las variables no se recargan solas.
4. Apuntar el **webhook de Wompi** de producción a Atlas.
5. **Una venta real de prueba, propia, de valor bajo**, con el ciclo completo: link, pago, factura emitida con
   consecutivo, pago registrado en Alegra, inventario descontado. Es lo único que prueba que las cuatro piezas
   se hablan; y si algo falla, falla con una venta tuya y no con un paciente.
6. Revisar los 59 pacientes sin marca, por si alguno es una prueba.
7. Recién entonces, dar el primer acceso.
