# Segundo smoke · LO QUE QUEDA ABIERTO

**Podado el 2026-10-12, a pedido de Santiago:** *"que CC revise que puntos están cerrados pasando los
criterios y los elimine del documento, que solo deje los puntos pendientes."*

Las partes 1 a 7, 9, 12, 16, 17, 18 y 20, y los arreglos R1 a R16, **pasaron sus criterios** y salieron de
aqui. Sus resultados, con las palabras de Santiago, estan en
`docs/entregas/RESULTADOS_SMOKE_Y_PROXIMOS_PASOS.md`; el guion completo que se corrio vive en el historial de
git de este mismo archivo (`git show ff4f4211:docs/entregas/SMOKE_SEGUNDO_2026-09-28.md`). Las partes 11, 13 y
14 se habian retirado el 2026-10-05 y las reemplazo la 17.

---

## ✅ LO QUE SE ARREGLO EL 2026-10-12, Y SOLO ESTO HAY QUE VOLVER A CORRER

No el documento entero: **cinco pruebas cortas**, que son las unicas superficies que cambiaron.

### A · La segunda cuenta del mismo corte  → `fix(distribucion)`

1. En /comercial como admin, mira el bloque de Distribucion. Ahora **el corte en curso sale sin boton**, con
   la fecha en que cierra. Un corte solo se puede facturar cuando ya cerro.
2. Para probar la re-emision hace falta un corte CERRADO con ventas sin facturar. Si no hay, se ve en el
   candado: `pnpm vitest run --project db src/tests/rehacer-la-cuenta-de-distribucion-db.test.ts`, que corre
   el caso del smoke (emitir, vender, emitir) **y el paso 6 de la parte 10**, el de objetar y rehacer, que
   nunca se habia podido correr.
3. **Criterio:** emitir dos veces no revienta; la segunda dice *"Cuenta rehecha... reemplaza a la
   anterior"*, lleva el corte COMPLETO, y en la pantalla del Integrante queda **una sola** cuenta viva.

### B · La alerta de vencimiento el mismo dia  → `fix(vencimientos)`

1. Marca un lote que venza dentro de los proximos 60 dias.
2. **Criterio:** aparece **el mismo dia**, en Mi inventario y en /faltantes, con el borde punteado y el
   rotulo *"sin avisar todavia"*, diciendo que el correo sale mañana a las 8:30 y que hasta entonces el
   vencido lo asume CNV. **Y mañana por la mañana** esa misma fila pasa al bloque de siempre, ya con su
   alerta registrada y su boton de "lo vi".

### C · La liquidacion en la pantalla de admin  → `fix(vencimientos)` (mismo commit)

1. /comercial como admin, una liquidacion con cargo por faltante sin girar.
2. **Criterio:** NO sale *"si no estas de acuerdo, escribe a admin@cnvsystem.com"*. En la pantalla del
   profesional **si sigue saliendo**: las dos hay que mirarlas, porque es la misma fila.

### D · Los bloques sin fondo  → `style(inventario,comercial)`

1. Mi inventario con una remesa por confirmar; /comercial del Integrante con una cuenta de Distribucion.
2. **Criterio:** los dos son tarjeta blanca con sombra, con la tesela de icono azul y la cifra grande, y se
   leen igual de "vivos" que las liquidaciones de al lado. Tambien cambiaron: las cuentas del lado de CNV,
   los lotes por vencer de /faltantes y el bloque de tus faltantes.

### E · Que /mi-inventario no se caiga  → `fix(db,app)`

1. No se puede provocar a mano (era el pooler de Supabase ocupado un instante).
2. **Criterio** de lo que si se puede ver: si alguna pantalla falla, ahora **la barra lateral se queda en
   pie** y se puede ir a otra pantalla sin recargar, en vez de la pantalla completa con el logo.
3. El reintento de las lecturas tiene candado: `pnpm vitest run --project unit src/tests/reintento-solo-si-no-corrio.test.ts`.

### Y lo que NO es del smoke pero se construyo el mismo dia

**El pase presencial de un menor** (pieza 3 del consentimiento). Es un flujo nuevo y Santiago ya lo tenia
anotado como smoke propio: la fecha de nacimiento se pide **al mostrar el codigo**, y si es menor, el
telefono le pide los datos al representante legal (con el correo **opcional**) y el asentimiento si tiene 14
o mas. El profesional ve el texto de declaracion que le toca (1.0, 1.1-a o 1.1-b).

---

## Lo que sigue abierto

**Lo que sigue no son pasos por correr: son cosas abiertas**, cada una con lo que falta para cerrarla.

## 1 · ABIERTO POR DECISION · La venta que quedo fuera de una cuenta ya PAGADA

Salio al arreglar la segunda cuenta, y es el unico borde que el arreglo **no** resuelve: si la cuenta de un
corte ya se pago y aparece una venta de ese mismo corte sin facturar, la cuenta no se puede reemplazar (la
plata ya se movio) y la venta no puede entrar en el corte siguiente, porque por su fecha pertenece al
anterior.

**Hoy la pantalla lo DICE** y no ofrece boton: *"La cuenta de este corte ya se pagó... Estas ventas quedan sin
facturar: hay que decidir con contabilidad si se facturan aparte."* Eso es correcto y no revienta, pero no
cierra el caso.

**Lo que falta decidir, y es de contabilidad, no de codigo:** si una venta asi se factura en un documento
aparte (una factura complementaria del mismo corte) o si se asume que no se cobra. Con cortes cerrados
ofrecidos solo tras su cierre, el caso se vuelve raro: hace falta una venta registrada despues de que se
pagara la cuenta de un corte ya cerrado.

## 2 · DECIDIDO Y POSPUESTO · La recepcion no descuenta de la bodega central

**La decision de Santiago (2026-10-12), del punto 3 de R14:** *"apenas un integrante declare que aceptó X
cantidad de X nutraceutico, se descuente de central... no deberia dejar cargar nutraceuticos que no estén en
central. Y admin debe poder registrar en central."* Es la salida (a) de las dos que estaban planteadas.

**Y lo pospuso a proposito:** *"esto va a hacer parte de todo el modulo de inventario grande que nos falta
organizar."* Mientras no se construya, el total de inventario de /direccion **crece con cada recepcion**,
porque suma lo que sale de la bodega y lo que entra a la vitrina.

## 3 · ABIERTO POR DECISION · Distribucion y el domicilio

**Textual de Santiago (2026-10-12), parte 19:** *"hay que pensar y planear muy bien el tema de distribucion.
Entonces de momento no hagamos cambios y dejamos esto y todo lo de distribucion como pendiente como está (ya
que hoy si se pueden registrar ventas)."*

La pregunta que lo tiene abierto es suya y es buena: el profesional vende, factura y entrega su propio
producto, asi que una venta con domicilio no deberia existir; pero si su paciente necesita un producto que el
no tiene en vitrina, **tecnicamente si deberia poder venderse a domicilio**.

## 4 · EL ARRANQUE A PRODUCCION · Lo que falta es de Santiago, no de codigo

El script esta escrito y ensayado: `scripts/ARRANQUE_A_PRODUCCION_2026-10-14.sql`. Marca como prueba todo lo
operado antes de la fecha de corte (con su motivo y su fila de auditoria por venta), anula las cuentas de
Distribucion de los cortes de prueba, y fija la fecha de arranque. No toca nada clinico.

**Las tres cosas que hay que revisar antes de correrlo**, marcadas con `PARA_REVISAR` dentro del archivo:

- **la fecha** (hoy dice 2026-10-14; Santiago dijo *"14 o 15, depende de como avancemos"*);
- **el correo del actor**, que es quien queda como autor de las marcas;
- y **el conteo fisico del inventario**, que el script NO puede inventar. Marcar una venta como prueba no
  devuelve la unidad al estante (los movimientos de inventario son inmutables porque describen algo que
  paso), asi que el saldo se cuadra con un ajuste de conciliacion por ubicacion, con las cifras que el
  cuente de verdad. El script imprime el saldo de hoy para cotejar.

**Y una cosa va a seguir pidiendo accion a proposito:** el aviso *"cobrada sin saldo"*. Esa rama mira el
PRODUCTO y no la marca, porque habla de UNIDADES FISICAS y las unidades no entienden de marcas: si el
producto era real, la vitrina esta descuadrada de verdad. Lo cierra el ajuste de conciliacion, o descartar
el pendiente con su motivo. El script las lista una por una.

## 5 · NO SE CONSTRUYO, Y SIGUE SIN CONSTRUIRSE

- **El cargo por un vencido a cargo del Integrante.** La alerta llega hasta la **propuesta** de quien asume.
  El cargo se cobra "al precio de facturacion", que es la cifra que esta en consulta
  (`DECISION_PRECIO_DEL_FALTANTE_2026-09-29.md`). Construirlo antes de esa decision seria construirlo dos
  veces.
- **La emision de la cuenta de Distribucion en Alegra.** La cuenta se arma, se objeta y se cobra en Atlas;
  emitir el documento fiscal necesita la configuracion de produccion, que esta en el checklist de arranque.
- **Desbloquear la venta bajo Distribucion.** El mecanismo del recaudo ya existe, asi que es una decision, no
  una falta de construccion. Hoy queda dentro del punto 3.

## 6 · SE PULE CON LA OPERACION, NO CON UN SMOKE

Santiago lo dijo de dos pantallas, y es una decision de ritmo, no un pendiente tecnico:

- **La pantalla de insights** (parte 15): *"la vamos puliendo poco a poco a medida que avance la operacion."*
- **El total de inventario y sus rotulos** (R15): *"esto lo vamos revisando poco a poco si sirve así o lo
  cambiamos."*
