# Segundo smoke · LO QUE QUEDA ABIERTO

**Podado el 2026-10-12, a pedido de Santiago:** *"que CC revise que puntos están cerrados pasando los
criterios y los elimine del documento, que solo deje los puntos pendientes."*

Las partes 1 a 7, 9, 12, 16, 17, 18 y 20, y los arreglos R1 a R16, **pasaron sus criterios** y salieron de
aqui. Sus resultados, con las palabras de Santiago, estan en
`docs/entregas/RESULTADOS_SMOKE_Y_PROXIMOS_PASOS.md`; el guion completo que se corrio vive en el historial de
git de este mismo archivo (`git show ff4f4211:docs/entregas/SMOKE_SEGUNDO_2026-09-28.md`). Las partes 11, 13 y
14 se habian retirado el 2026-10-05 y las reemplazo la 17.

**Lo que sigue no son pasos por correr: son cosas abiertas**, cada una con lo que falta para cerrarla.

---

## 1 · DEFECTO · La segunda cuenta del mismo corte revienta contra la base

**Lo que paso en el smoke:** Santiago emitio la cuenta del corte 01-15, registro otra venta el mismo dia, y al
emitir otra vez salio *"No se pudo emitir la cuenta"* y en Sentry `duplicate key ·
distribucion_statements_una_viva_por_corte`.

**La causa, verificada (2026-10-12), son DOS y la segunda es la de fondo:**

1. **La pantalla ofrece emitir un corte que todavia esta ABIERTO.** `cortesPorEmitir(hoy)` usa `corteDe(hoy)`,
   que es el corte que CONTIENE hoy, mientras su propio comentario dice *"en el corte que acaba de cerrar"*. El
   modelo da dos dias habiles DESPUES del corte para emitir (`emitirHasta`), asi que emitir el 12 un corte que
   cierra el 15 no deberia ofrecerse: garantiza ventas posteriores que ya no caben en ninguna cuenta, y produce
   una factura que vence el 15 por un periodo que termina el 15.
2. **`replaced_by_id` no lo escribe NADIE.** El indice unico es parcial (`WHERE replaced_by_id IS NULL`) y la
   migracion 0188 lo explica: *"un corte re-emitido tras una objecion tiene dos filas, y solo una sigue
   viva"*. Pero ninguna ruta del codigo pone esa columna. O sea que **el corte no se puede re-emitir por
   ningun camino**, y eso incluye el que el modelo exige: `resolverObjecion('corregida')` libera las ventas
   *"para que el corte se pueda volver a emitir"* y deja la fila vieja viva, asi que la re-emision choca con
   la misma llave.

**Y de ahi sale el dato que importa:** el **paso 6 de la parte 10** (objetar, "darle la razon y rehacerla")
**iba a fallar igual**, y no se corrio porque el smoke se topo antes con el paso 4. No es un hueco del borde:
es el mecanismo de objecion del modelo, hoy inalcanzable.

**Lo que falta:** ofrecer solo cortes cerrados (y mostrar el abierto como "en curso", sin boton); escribir
`replaced_by_id` al re-emitir, devolviendo las lineas de la cuenta reemplazada al pozo para que la nueva
cargue el corte completo; y cuando la cuenta vieja ya esta PAGADA, decir con una frase que esa venta no entra
y por que, en vez de reventar. Hoy el error cae en el `catch` generico de `emitirCuentaDistribucionAction`.

---

## 2 · DEFECTO · La alerta de vencimiento no aparece el mismo dia

**Lo que paso:** Santiago marco un lote que vence en ~15 dias y no salio en ninguna pantalla.

**Verificado (2026-10-12):** la ventana **no es el problema**, son **60 dias**
(`DIAS_DE_ALERTA_POR_DEFECTO`, configurable en `commercial_config`), asi que 15 esta dentro de sobra. Lo que
pasa es que **las dos pantallas leen filas de `lot_expiry_alerts`, no los lotes**, y esas filas las crea la
tarea diaria de Vercel Cron (`/api/cron/vencimientos`, 8:30 a. m. de Colombia). Un lote que entra en la
ventana hoy no tiene fila hasta la mañana siguiente.

**Y la fila no se puede derivar al vuelo** sin romper algo: esa fila es lo que decide **quien asume** un
vencido (lleva `generada_el`, `dias_de_anticipacion` y `vista_el`), y el servicio la borra si el correo no
sale, justamente para no afirmar que se aviso a quien no se entero.

**Lo que falta decidir:** si la pantalla muestra TAMBIEN los lotes en ventana que aun no tienen alerta
registrada (marcados como "sin avisar todavia", sin propuesta de quien asume), o si basta con que el aviso sea
de un dia para otro. Con 60 dias de ventana, un dia no cambia nada operativo; lo que cambia es que hoy
**parece que el sistema no vio el lote**.

---

## 3 · DEFECTO · La liquidacion le habla al Integrante en la pantalla de admin

En /comercial como admin sale *"si no estas de acuerdo, escribe a admin@cnvsystem.com"*, y admin es quien
recibe ese correo. En la pantalla del profesional esta bien.

**Causa:** `FilaLiquidacion` es la misma fila en las dos pantallas y ese aviso no mira `puedePagar`.
**Lo que falta:** una condicion. El canal de reclamo es del que reclama.

---

## 4 · PRESENTACION · Dos bloques sin fondo de tarjeta

Los dos estan sobre el gris del layout mientras sus vecinos son tarjetas blancas, y por eso se leen como si
estuvieran apagados o escondidos:

- **"Remesas por confirmar"** en Mi inventario (`confirmar-remesa-section.tsx`).
- **"Tus cuentas de Distribucion"** en /comercial del Integrante (`mis-cuentas-distribucion.tsx`), justo al
  lado de las liquidaciones, que si llevan `bg-card`.

**Lo que falta:** el fondo de tarjeta donde el bloque es de primer nivel. **No es un barrido a ciegas:** hay
36 bloques con borde y sin fondo y la mayoria estan DENTRO de otra tarjeta, donde el fondo seria el error.

---

## 5 · VIGILAR · Los dos errores de Sentry del smoke

- **`Failed to connect to database: {:error, :timeout}` en /mi-inventario** (una vez, recargo y paso). Es el
  pooler de Supabase, no una consulta lenta: el cliente tiene `connect_timeout: 10` y `max: 6` desde el
  incidente del 2026-09-15. Abierto: si conviene **reintentar una vez** los fallos de conexion (clase 08) en
  las LECTURAS, que es seguro porque no corrio nada, y si esa pantalla necesita su `error.tsx` en vez de caer
  con un 500.
- **`TypeError: Failed to fetch` en /encuesta de un paciente real.** Es el **autoguardado**, no el envio: la
  peticion no llego a salir, asi que no hay evento de servidor. **No se perdio nada** y es por diseño (el
  guardado no bloquea, el siguiente cambio reintenta y el envio final manda todo de nuevo). Es distinto de la
  20.2, que arreglo el fallo del SERVIDOR: aqui el fallo es la red del paciente. Abierto solo si se vuelve
  ruido recurrente en Sentry.

---

## 6 · DECIDIDO Y POSPUESTO · La recepcion no descuenta de la bodega central

**La decision de Santiago (2026-10-12), del punto 3 de R14:** *"apenas un integrante declare que aceptó X
cantidad de X nutraceutico, se descuente de central... no deberia dejar cargar nutraceuticos que no estén en
central. Y admin debe poder registrar en central."* Es la salida (a) de las dos que estaban planteadas.

**Y lo pospuso a proposito:** *"esto va a hacer parte de todo el modulo de inventario grande que nos falta
organizar."* Mientras no se construya, el total de inventario de /direccion **crece con cada recepcion**,
porque suma lo que sale de la bodega y lo que entra a la vitrina.

---

## 7 · ABIERTO POR DECISION · Distribucion y el domicilio

**Textual de Santiago (2026-10-12), parte 19:** *"hay que pensar y planear muy bien el tema de distribucion.
Entonces de momento no hagamos cambios y dejamos esto y todo lo de distribucion como pendiente como está (ya
que hoy si se pueden registrar ventas)."*

La pregunta que lo tiene abierto es suya y es buena: el profesional vende, factura y entrega su propio
producto, asi que una venta con domicilio no deberia existir; pero si su paciente necesita un producto que el
no tiene en vitrina, **tecnicamente si deberia poder venderse a domicilio**.

---

## 8 · NO SE CONSTRUYO, Y SIGUE SIN CONSTRUIRSE

- **El cargo por un vencido a cargo del Integrante.** La alerta llega hasta la **propuesta** de quien asume.
  El cargo se cobra "al precio de facturacion", que es la cifra que esta en consulta
  (`DECISION_PRECIO_DEL_FALTANTE_2026-09-29.md`). Construirlo antes de esa decision seria construirlo dos
  veces.
- **La emision de la cuenta de Distribucion en Alegra.** La cuenta se arma, se objeta y se cobra en Atlas;
  emitir el documento fiscal necesita la configuracion de produccion, que esta en el checklist de arranque.
- **Desbloquear la venta bajo Distribucion.** El mecanismo del recaudo ya existe, asi que es una decision, no
  una falta de construccion. Hoy queda dentro del punto 7.

---

## 9 · SE PULE CON LA OPERACION, NO CON UN SMOKE

Santiago lo dijo de dos pantallas, y es una decision de ritmo, no un pendiente tecnico:

- **La pantalla de insights** (parte 15): *"la vamos puliendo poco a poco a medida que avance la operacion."*
- **El total de inventario y sus rotulos** (R15): *"esto lo vamos revisando poco a poco si sirve así o lo
  cambiamos."*
