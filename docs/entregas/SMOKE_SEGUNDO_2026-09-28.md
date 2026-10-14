# Segundo smoke · LO QUE QUEDA ABIERTO

**Podado el 2026-10-12, a pedido de Santiago:** *"que CC revise que puntos están cerrados pasando los
criterios y los elimine del documento, que solo deje los puntos pendientes."*

Las partes 1 a 7, 9, 12, 16, 17, 18 y 20, y los arreglos R1 a R16, **pasaron sus criterios** y salieron de
aqui. Sus resultados, con las palabras de Santiago, estan en
`docs/entregas/RESULTADOS_SMOKE_Y_PROXIMOS_PASOS.md`; el guion completo que se corrio vive en el historial de
git de este mismo archivo (`git show ff4f4211:docs/entregas/SMOKE_SEGUNDO_2026-09-28.md`). Las partes 11, 13 y
14 se habian retirado el 2026-10-05 y las reemplazo la 17.

**El acta de la corrida NO se versiona** (`RESULTADOS_SMOKE_Y_PROXIMOS_PASOS.md`, en `.gitignore` desde el
2026-10-14, a pedido de Santiago): es donde quedan sus palabras tal cual mientras prueba, y por eso nombra
pacientes. Este archivo, el guion, si se versiona: no lleva nombres.

**EL ORDEN DE HOY (2026-10-14 por la noche, para el arranque del 15):** primero **F a I**, que es lo que
frenaba el arranque; despues **A a E**, que son los arreglos del 12. Nada mas: no el documento entero.

---

## ✅ LO DEL 2026-10-14, Y VA PRIMERO PORQUE ES LO QUE FRENABA EL ARRANQUE

**Cuatro pruebas**, todas en /pagos como admin. Son las que deciden si manana se puede empezar.

### F · ADMIN EN CERO: el barrido de los ocho lectores  → `fix(pagos)`

Lo que reportaste: *"ya puse los pacientes de prueba como prueba... y a pesar de eso aun aparece en admin
/pagos 2 devueltas pendientes, 5 ventas por revisar, 1 venta cobrada sin cerrar"*, y la frase que apuntaba al
defecto: *"aparece en lo real cosas que ya estan marcadas"*. Eran **cinco** lectores mal, no uno.

1. Corre el script de arranque (`scripts/ARRANQUE_A_PRODUCCION_2026-10-15.sql`), que es lo que marca como
   prueba todo lo anterior al 15. Lee los `select` ANTES de confirmar.
2. Entra a /pagos como admin, **sin** el interruptor de prueba.
3. **Criterio, y es el de tu frase:** las cuatro cifras en cero. Ninguna venta de prueba en el historial de
   transacciones (las tres de pacientes reales incluidas), ni en "ventas por revisar", ni en "pendientes sin
   salida" (**ni el descartado**), ni en "ventas cobradas sin cerrar". Y los **chips de dias** de arriba
   tienen que decir lo mismo que la lista de abajo: si un dia dice "(3)", al pulsarlo tienen que salir tres.
4. **Y el otro criterio, el del interruptor:** al encenderlo, aparece **todo** lo de prueba. Antes solo
   llegaba a cuatro de los ocho paneles, asi que encendido seguia escondiendo la mitad.
5. **Las devueltas pendientes son aparte** y hay que entenderlo: ese panel no lee ventas, cuenta **unidades
   paradas en cuarentena**. Las de producto de prueba ya no salen. Si queda alguna de producto **real**, no
   la quita ninguna marca: se cierra con los dos botones que el panel ya tiene (volver al lote, o dar de
   baja). Son dos clics y es un juicio fisico, no algo que un script pueda decidir.

### G · Que una venta de prueba NO se facture  → `fix(pagos)` (mismo commit)

Esto no lo reportaste: salio del barrido y era lo mas grave. El unico freno miraba al **paciente**, y la
marca por venta existe justo para el caso de paciente y profesional **reales**. Una venta marcada a mano se
iba a facturar en Alegra **produccion**, con numeracion de la DIAN.

1. Despues de correr el script, mira el panel "Ventas cobradas sin cerrar en contabilidad".
2. **Criterio:** ninguna de las ventas que el script marco intenta facturarse, ni sola (la cola) ni al pulsar
   "Reintentar". Si alguna aparece con estado *"No se factura aqui, por regla"*, eso es correcto: es el freno
   diciendo por que.
3. Candado: `pnpm vitest run --project db src/tests/lo-de-prueba-no-llega-a-pagos-db.test.ts`.

### H · La venta que salio de la bodega, registrada por admin  → `feat(pagos)`

Tu caso: *"un profesional hizo venta de productos que ya se le habian acabado en el consultorio... que exista
la opcion en admin de poner que esa venta salio desde la bodega y no desde el integrante"*.

1. /pagos como **admin**, elige un paciente de Katherine, medio efectivo o transferencia.
2. Aparece una casilla: **"El producto salio de la bodega de CNV, no de la vitrina del Integrante"**. Marcala.
3. **Criterio:** la venta se registra, se descuenta de la **bodega** (no de la vitrina de Katherine), le sale
   el aviso de *"pagada y sin entregar: hay que despacharlo"*, y **la comision sigue siendo de Katherine**
   (la venta es suya; lo que cambio es de donde salio el producto).
4. **Criterio al reves, y es el que importa:** entra como Integrante y comprueba que esa casilla **no esta**.
   A el no se le ofrece descontar de una bodega que no es suya; su pregunta vive en la consulta y aparece
   sola cuando su vitrina esta en cero.

### I · El inventario arranca cuadrado  → `feat(arranque)`

**Esta la haces tu con el conteo en la mano**, y es la unica de la lista que necesita algo que el sistema no
tiene.

1. Corre solo el **bloque (1)** de `scripts/CONCILIAR_EL_INVENTARIO_AL_ARRANQUE_2026-10-15.sql`: imprime el
   saldo de hoy con el nombre exacto de cada ubicacion, producto y lote.
2. Cuenta fisicamente. Llena el bloque (2) con lo **contado** (no con la diferencia).
3. Corre el script completo **tal cual**: termina en `rollback`, asi que no guarda nada y te muestra el cuadro
   *"LO QUE VA A PASAR"*.
4. **Criterio:** ese cuadro dice exactamente lo que esperas. Entonces, y solo entonces, cambias `rollback` por
   `commit`.
5. **La bandera `llevar_a_cero_lo_no_listado`:** ponla en `true` solo si el conteo esta **completo**. Es lo
   que hace cierta tu frase *"que la bodega de CNV inicie con todas las unidades"*, pero una linea olvidada se
   interpreta como "ahi no hay nada" y su saldo se borra. Y no se puede deshacer.

---

## ✅ LO QUE SE ARREGLO EL 2026-10-12, Y TAMBIEN HAY QUE VOLVER A CORRER

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

## 1 · DECIDIDO POR CONTABILIDAD, Y FALTA CONSTRUIR EL TRASLADO

**La decision ya existe (contabilidad, 2026-10-14) y es tajante:** *"nunca 'no se cobra'. Si el producto se
vendio, CNV tiene que facturarlo. Si no lo hace, pierde el ingreso, el inventario no cuadra y queda una venta
sin factura."* Las reglas:

- un corte **facturado o pagado es inmutable**: no se reabre ni se edita su factura;
- por defecto, la venta rezagada **entra al siguiente corte** del mismo Integrante, marcada como de un
  periodo anterior y visible en el detalle como *"ventas de periodos anteriores"*;
- **excepcion:** si la venta y la emision del siguiente corte caen en **bimestres de IVA distintos**
  (ene-feb, mar-abr, may-jun, jul-ago, sep-oct, nov-dic) o en años distintos, la pantalla ofrece **"Facturar
  ahora"** para emitir aparte antes de que cierre el bimestre de la venta, y **admin no debe poder
  ignorarla**.

**LA PANTALLA YA DICE LA REGLA** (cambiado el 2026-10-14): antes preguntaba lo que ya estaba respondido, que
es como cada quien improvisa una decision distinta. Ahora dice que esas ventas no quedan sin cobrar, que van
al corte siguiente, y **que hoy ese traslado hay que hacerlo a mano**.

### La prevencion: la de contabilidad (A) y la que esta construida (B) no conviven

Contabilidad recomienda que **el corte tome las ventas hasta el INSTANTE en que se genera**, no hasta la
fecha fin del periodo (su opcion A), y da como alternativa **bloquear la generacion hasta que el periodo
termine** (su opcion B). **Lo que esta construido es la B**, desde el 2026-10-12: solo se ofrecen cortes ya
cerrados. Son excluyentes: la A permite emitir a mitad de periodo y la B lo prohibe.

**La recomendacion es quedarse con la B**, y las razones son tres:

1. **Ninguna de las dos cierra el caso de verdad.** El hueco que queda es la venta **retroactiva**: admin
   registra el dia 20 una venta del dia 12, y cae dentro de un corte ya emitido. Con la A pasa igual (su
   fecha es anterior al instante de emision). Lo que cierra el caso es el **traslado al corte siguiente**, no
   la prevencion.
2. **La B conserva una sola definicion de corte.** Hoy el corte es una ventana de calendario
   (`corte_desde`/`corte_hasta`) que una sola funcion calcula, con candado, y el indice de "una cuenta viva
   por corte" cuelga de ella. La A la volveria variable por cuenta, y eso rompe el indice y la nocion de
   periodo que el Integrante espera.
3. **Y la B evita dos o tres facturas por periodo** al mismo Integrante, que es lo que la A permite.

**Hay que llevarle estas tres razones a contabilidad**, porque la decision final es suya. Si insiste en la A,
es una pieza mayor: la ventana del corte pasa a ser un dato de cada cuenta.

### Lo que falta construir, con su plazo real

- **El traslado automatico** (la regla por defecto). No es urgente **hasta que exista la primera cuenta
  pagada**, o sea hacia el 1 de noviembre: con el arranque el 15, hoy no hay ninguna. Y la buena noticia es
  que **no necesita columna nueva**: una linea cuya venta cae fuera de la ventana de su cuenta **es** una
  rezagada, asi que el rotulo *"de un periodo anterior"* se deriva de lo que ya se guarda.
- **El "Facturar ahora" del bimestre distinto.** Esta es la pieza grande: hoy una cuenta de Distribucion se
  emite **por corte**, y esto pide una factura **suelta**, fuera de corte, que no existe. Antes de
  construirla hay que decidir si esa factura es una cuenta de Distribucion con un corte de un dia o un
  documento de otra clase.

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

## 3b · ABIERTO · El bloque compartido de la venta (paso 2 de la unificacion)

**Santiago lo pidio el 2026-10-14** (*"de una vez que CC construya el paso 2 de la unificacion"*) y **no se
construyo esa noche, a proposito**, con la vispera del arranque encima. La razon y el tamaño, para que la
decision se pueda revisar:

**Lo que es:** hoy la venta se registra en **tres** formularios (el link de pago y la venta ya cobrada en
/pagos, y la venta en consulta), unas **1.600 lineas** entre los cuatro archivos. El paso 2 es que los tres
pregunten lo mismo con **un solo bloque**: los productos, el domicilio con los mismos campos, el despacho
desde la bodega, y las dos presentaciones del medio en linea (el QR que se muestra y el enlace que se manda).

**Por que no se hizo esa noche, y son dos razones:**

1. **Es la zona de los ocho hazards de formulario de CLAUDE.md**, los que solo se ven en un navegador real.
   Tocar los tres formularios la noche anterior al arranque pone en riesgo la unica pantalla que hacia falta
   al dia siguiente, y el smoke que lo atraparia es justo el que no se podia correr todavia.
2. **El bloque necesita un dato que /pagos no tiene.** El catalogo de /pagos es `{id, nombre, precio}`, sin
   existencias; el bloque de la consulta decide que mostrar con el disponible de la vitrina y el de la bodega.
   Traerlo es **una consulta mas** en una pantalla que ya se colgo dos veces por el numero de consultas (el
   pool tiene seis conexiones), asi que hay que decidir antes **de donde sale** esa cifra.

**Lo que si se adelanto:** la casilla de **"salio de la bodega"** para admin (prueba H), que era la mitad que
la operacion de esta semana necesitaba y el unico trozo cuyo camino estaba completo del servidor hacia abajo.

## 4 · EL ARRANQUE A PRODUCCION · Lo que falta es de Santiago, no de codigo

**La fecha es el 15** (Santiago, 2026-10-14: *"Fecha 15, manana iniciamos"*). Son **dos scripts**, y se
corren en este orden:

1. `scripts/ARRANQUE_A_PRODUCCION_2026-10-15.sql` · marca como prueba todo lo operado antes del 15 (con su
   motivo y su fila de auditoria **por venta**), anula las cuentas de Distribucion de los cortes de prueba, y
   fija la fecha de arranque. **No toca nada clinico**, y lo verifica comparando las cifras antes y despues.
   Ensayado contra la base local: 1.317 ventas reales antes del corte quedan en 0, lo clinico identico.
2. `scripts/CONCILIAR_EL_INVENTARIO_AL_ARRANQUE_2026-10-15.sql` · cuadra el inventario contra el conteo
   fisico. **Es la prueba I de arriba** y necesita el conteo.

**Queda UN parametro por revisar** (marcado `PARA_REVISAR` en los dos archivos): **el correo del actor**, que
es quien queda como autor de las marcas. El script **se niega a correr** si ese correo no existe, asi que no
hay forma de equivocarse en silencio.

**Y el aviso de "cobrada sin saldo" SI se oculta ahora** (cambiado por la 0218, el 2026-10-14). Era lo que
Santiago pidio: *"hagamos el esfuerzo a ver si marcamos cada caso como de prueba para que se oculten esta vez
si de verdad"*. La marca **manual** entro como insumo de la excepcion fisica, porque es la unica de las
cuatro que la pone una persona, con motivo y con auditoria, afirmando que el acto no ocurrio.

**Pero la unidad sigue sin estar en el estante.** Lo que la marca quita es el **aviso**, no el hueco. Por eso
el script sigue listando esas ventas una por una: ya no son la bandeja de pendientes de admin, son **la lista
con la que se cuenta el inventario**.

### Marcar MOVIMIENTOS de inventario: no se puede, y no hace falta hoy

Santiago lo propuso (*"a futuro, si llegamos a medir los movimientos de inventario, apareceran mezclados con
movimientos de prueba"*), y la preocupacion es correcta. Pero **no hay donde escribir esa marca**, y no por
descuido: `nutraceutical_stock_movements` es **append-only por trigger** desde la 0040, con el mensaje *"un
error se corrige con un movimiento inverso, no se edita ni se borra"*. Marcar una fila existente exigiria
apagar ese trigger, y apagarlo para escribir en el libro de custodia es justo lo que el libro existe para
impedir.

**Lo que si resuelve su preocupacion, y ya esta:**

- **hoy ninguna cifra suma movimientos**: las pantallas de inventario leen el **saldo**, que es lo que la
  conciliacion deja en cero. El reseteo que pidio lo da el script, no una marca;
- **y el dia que se midan, la frontera ya existe**: `fecha_de_arranque`. Un movimiento anterior a esa fecha es
  de la etapa de pruebas, y eso se **deriva** de su fecha sin escribir en una fila inmutable. **Esa es la
  condicion de ese reporte, y queda escrita aqui para que no se pierda.**

## 4b · ANOTADO POR LEGAL · Una fecha de nacimiento corregida puede dejar mal la rama declarada

**El hallazgo es del abogado (2026-10-14)** y es real: *"lo que determina el texto declarado es la fecha de
nacimiento tal como estaba al emitir el pase. Si esa fecha esta mal digitada y se corrige despues, el
consentimiento ya firmado quedo bajo la rama equivocada, y NADA LO VA A DETECTAR."* No es hipotetico: ya hubo
**tres** correcciones de fecha en este proyecto (las de la fecha imposible, 2026-10-09).

**No pide cambiar el diseño**, y hace bien: elegir la rama **una vez**, en la emision, es lo correcto, porque
la alternativa es que la rama cambie a mitad del acto.

**LA DETECCION YA ESTA:** `scripts/RAMA_DEL_CONSENTIMIENTO_CONTRA_LA_FECHA_DE_HOY.sql`. **Hay que correrlo
despues de cualquier correccion de fecha de nacimiento**, y de vez en cuando. Compara la fecha que la sesion
**congelo** contra la del paciente hoy, mide las dos edades **el dia del acto** (un menor que cumplio 18
despues firmo bien), y dice que hacer con cada caso, que no es lo mismo en los dos sentidos: declarar como
adulto a un menor deja el consentimiento **sin representante legal** y hay que rehacerlo; al reves, sobra un
representante pero el paciente si podia consentir.

Contra la base local devuelve **cero filas**, que tambien es una respuesta. La aritmetica tiene candado
(`declaracion-presencial-congelada`): si estuviera mal, el script diria "no hay nada" y seria peor que no
tenerlo.

**LO QUE FALTA ES LA SUPERFICIE QUE LO AVISE**, y es de la **pieza 2** del consentimiento (el estado de
"pendiente de revision"), que no esta construida. Darle un mecanismo propio a este caso seria un segundo
constructor del mismo insumo.

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
