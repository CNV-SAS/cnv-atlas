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

**EL ORDEN DE HOY (2026-10-15, el dia del arranque):** primero **F a I**, que es lo que
frenaba el arranque; despues **A a E**, que son los arreglos del 12. **J es de despues**: se construyo el 15,
no es del arranque y puede esperar. Nada mas: no el documento entero.

**Y antes de la I, lee su aviso:** si el inventario arranca en cero sin contar, la prueba **H** (la venta
desde la bodega) no puede pasar, porque no habria existencias en la central.

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

#### ⚠ SI ARRANCAS TODO EN CERO (tu plan del 2026-10-15), HAY QUE LEER ESTO ANTES

Tu plan es otro y es razonable: *"iniciar con todo en 0 y que admin vaya poniendo X nutraceuticos a tal
profesional... ya luego voy a la oficina, cuento y comparo."* O sea el bloque (2) **vacio** y la bandera en
`true`. Se puede, y la mayor parte de lo que necesitas sigue funcionando. **Dos cosas no.**

**LO QUE SIGUE FUNCIONANDO CON LA BODEGA EN CERO, y es la parte importante:** la **remesa no descuenta de la
central**. Se declara sobre la ubicacion del Integrante DESTINO, el trigger del saldo la excluye, y el saldo
sube cuando el Integrante confirma la recepcion. Asi que *"admin va poniendo X nutraceuticos a tal
profesional"* funciona hoy, tal cual, con la bodega en cero. El unico requisito es que **el Integrante
confirme** en *Mi inventario*: no hay forma de que admin le suba el saldo por el.

**LO QUE SE ROMPE:** todo lo que SALE de la bodega, porque la reserva de la venta exige existencias y lanza
*"No hay existencias de X para vender"*. Son dos casos:

- la **venta desde la bodega** de la prueba **H** de esta misma lista (la casilla nueva de /pagos), y
- cualquier venta de un paciente **sin Integrante asignado**, que sale de la central por definicion.

**Y NO HAY PANTALLA PARA CARGAR LA CENTRAL.** Hoy a la bodega solo entran unidades por una **devolucion de un
Integrante** o por una **reincorporacion desde cuarentena**. *"Admin debe poder registrar en central"* es el
punto 3 de **R14**, que tu mismo pospusiste al modulo grande de inventario (seccion 2 de este documento).

**LA SALIDA, y no necesita construir nada:** el bloque (2) del script **es** la via para cargar la central.
Lista ahi las lineas de `central` con las unidades con que quieres que arranque la bodega (las que recibiste),
deja fuera todo lo demas y pon la bandera en `true`. Eso es exactamente *"la bodega inicia con todas las
unidades y nadie mas tiene nada"*, y no exige contar las vitrinas: solo saber que hay en la bodega.

**Si prefieres arrancar de verdad en cero**, entonces **corre H antes que I** (mientras todavia hay saldo) y
cuenta con que la venta desde la bodega queda inutilizable hasta que exista la pantalla de R14. Dimelo y la
construyo: es una pantalla, un escritor y su candado, del tamaño de la seccion de devoluciones de /faltantes.

**Dos cosas mas que preguntaste, las dos confirmadas en el codigo:**

- **Los lotes sobreviven al cero.** El ajuste escribe un movimiento, no borra filas de `lots`. Un lote con
  saldo cero desaparece de la **lista** de /mi-inventario (a proposito: listarlo diria que hay producto que no
  queda), pero el campo de lote de la recepcion y de la remesa es **texto libre** y se resuelve por codigo, asi
  que volver a cargar ese mismo lote funciona escribiendolo igual. Y si el codigo no existiera, se crea.
- **El cero queda legible en el historial.** Cada ajuste es un movimiento `conciliacion` con
  `reason` = tu motivo + `(sistema N -> contado M)`. El motivo que trae el script ya dice *"Arranque a
  produccion 2026-10-15: ajuste al conteo fisico"*; **si arrancas en cero sin contar, cambialo**, porque esa
  frase afirmaria un conteo que no hubo. Algo como *"Arranque a produccion 2026-10-15: el inventario se declara
  en cero y se vuelve a cargar; no hubo conteo fisico"*.

### J · El consentimiento que existe y no alcanza (pieza 2)  → `feat(consentimiento)`

**Esta NO es del arranque y puede esperar a despues de F-I.** Va aqui porque se construyo el 2026-10-15 y su
superficie es nueva.

**Que se construyo:** el estado derivado *"pendiente de regularizar"* del dictamen legal del 2026-10-09, su
freno en el gate y su aviso en pantalla. La prevencion ya existia (un consentimiento de menor sin
representante no se puede guardar desde el 2026-10-09); lo que faltaba es que **lo ya guardado se reconozca**.

**En la base local hay 3 casos**, uno de ellos de un paciente **real**: 13 años al firmar, por el camino del
correo, version 1.0, sin representante. Los otros dos son de prueba y tienen fecha de nacimiento imposible.
**Corre `scripts/CONSENTIMIENTOS_PENDIENTES_DE_REGULARIZAR.sql` contra la nube antes de probar**, para
saber a quien vas a ver marcado y cuantos son. Es de solo lectura y dice que hacer con cada caso. Y vale
para despues: hay que correrlo tras cualquier correccion de fecha de nacimiento. **Esa lista no puede
crecer** (la prevencion esta desde el 2026-10-09): solo se vacia.

1. Abre la **ficha** de un paciente que firmo siendo menor sin representante. **Criterio:** arriba de las
   autorizaciones sale un bloque rojo con el titulo *"Consentimiento de menor sin representante"*, dice que no
   se le pueden crear evaluaciones nuevas, dice **que hacer**, y dice que el consentimiento firmado **no se
   borra ni se invalida**. Las tres autorizaciones siguen apareciendo *"Vigente"* abajo, porque lo son.
2. En la **lista de pacientes**, ese paciente lleva su propia etiqueta con ese mismo texto. **Criterio:** NO
   dice *"Sin autorizacion vigente"*, porque no retiro ninguna.
3. Intenta iniciarle un **seguimiento**. **Criterio:** no se crea nada y el aviso dice lo mismo que la ficha.
   **El criterio al reves, que es el que de verdad importa:** el profesional **sigue entrando a su historia**,
   viendo sus consultas anteriores y su reporte. Lo que se frena es crear evaluaciones NUEVAS, nada mas.
4. Firmale el consentimiento de nuevo con la rama que corresponda a su edad de hoy. **Criterio:** el bloque
   rojo desaparece y el seguimiento se puede iniciar, sin tocar nada a mano.
5. **Un paciente con fecha de nacimiento imposible** (de los dos de prueba) sale marcado con *"Fecha de
   nacimiento imposible"*, **en tono neutro y sin frenar nada**. Corrige la fecha en la ficha: **criterio:** la
   marca desaparece sola.

**Lo que NO cubre:** la pieza 4 (el *"consentimiento de regularizacion"* como documento propio) sigue sin
construirse, y la exclusion de estos pacientes de los **usos secundarios** (investigacion, estadistica
comercializable) tampoco: hoy no existe el filtro de dataset donde engancharla, y darsela a esta pieza seria
inventarle un mecanismo. Queda anotado aqui.

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

**CONTABILIDAD ACEPTO LAS TRES RAZONES (2026-10-15).** Queda cerrado asi: **se mantiene la B**, el traslado de
las rezagadas es **manual por ahora** y hay que **automatizarlo antes del 1 de noviembre**, y el *"Facturar
ahora"* se posterga (mientras no exista, una rezagada que cruce de bimestre la factura admin a mano en
Alegra).

### 1b · EL PUNTO NUEVO DE CONTABILIDAD: el corte que cierra bimestre se emitiria tarde

**Su observacion (2026-10-15):** *"con la B, el corte que cierra cada bimestre (fin de feb, abr, jun, ago, oct
y dic) se emitiria en el bimestre siguiente, y en diciembre en el año siguiente. Eso desplaza el IVA y el
ingreso de periodo en 6 de cada 24 cortes."* Y su propuesta: permitir emitir **esos** cortes el **ultimo dia
del mes**, antes de medianoche, con lo posterior entrando como rezagada.

**Preguntan: ¿choca con la funcion de la ventana? NO.** `corteDe(dia)` es aritmetica de calendario pura y **no
cambia nada**: la ventana del segundo corte sigue siendo del 16 al ultimo dia del mes. Lo que cambia es **una
comparacion**, `corteCerrado = corte.hasta < hoy`, que para esos seis cortes pasaria a `<=`. El indice de "una
cuenta viva por corte" cuelga de `corte_hasta`, que no se mueve, asi que tampoco se toca. **Es un cambio
pequeño y acotado.**

**Y tampoco revive el otro defecto que ese freno existe para evitar.** El viejo era emitir el dia 12 un corte
que cierra el 15: la factura vencia antes de que el corte existiera. Emitir **el ultimo dia** no hace eso,
porque el periodo ya esta completo y los plazos del Integrante cuelgan de la **emision**, no del corte.

**PERO SI CHOCA CON OTRA COSA, Y ES LA QUE HAY QUE DECIDIR PRIMERO.** La venta que se registre el dia 31
**despues** de emitir cae **DENTRO** de la ventana de un corte ya emitido, no fuera. Asi que la regla de
deteccion que les propuse (*"una linea cuya venta cae fuera de la ventana de su cuenta es una rezagada"*)
**no la ve**, y por el indice no se puede abrir una segunda cuenta del mismo corte: esa venta quedaria
invisible.

**La regla correcta es otra, y es mejor que la mia:** una rezagada es **una venta sin cuenta cuyo corte ya
tiene una cuenta viva**. Sigue sin necesitar columna nueva (`transactions.distribucion_statement_id` nulo mas
el corte derivado de su fecha), cubre el caso del dia 31 **y** cubre la venta retroactiva, que era el hueco de
fondo.

**Asi que el orden importa: primero el traslado automatico con esta regla, y despues la emision del ultimo
dia.** Al reves se abre un dia por bimestre en el que una venta no tiene donde vivir. Dicho de otro modo: su
propuesta es prevencion A por la puerta de atras para un dia de cada bimestre, y se puede, pero solo cuando el
traslado exista.

### Lo que falta construir, con su plazo real

- **El traslado automatico** (la regla por defecto), **antes del 1 de noviembre** por decision de
  contabilidad. La regla es la de 1b (*venta sin cuenta cuyo corte ya tiene una cuenta viva*), no la primera
  que propuse, y **no necesita columna nueva**: el rotulo *"de un periodo anterior"* se deriva de lo que ya se
  guarda.
- **Registrar una venta COMO YA FACTURADA por fuera** (lo piden contabilidad el 2026-10-15: *"necesito que eso
  se pueda marcar para que no se facture dos veces"*). **Dimensionado: es la mas pequeña de las tres.** La
  venta ya tiene las columnas del documento (`alegra_invoice_number`, `alegra_invoice_state`,
  `alegra_emitted_at`) y la cola de facturacion sale sola en cuanto el estado deja de pedir emision. Lo que
  hay que añadir es la **superficie** (admin teclea el numero de la factura de Alegra y la fecha) y **un
  motivo obligatorio**, porque es una afirmacion sobre un documento fiscal que Atlas no emitio y que nadie
  mas puede verificar. Del tamaño de la marca de prueba de la 0217: una migracion chica, un escritor, un
  formulario y su candado.
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

**VERIFICADO EL 2026-10-15, porque de esto depende arrancar en cero:** la mitad de *"admin debe poder
registrar en central"* **no existe**. A la bodega central solo entran unidades por una **devolucion de un
Integrante** (`devolucion-a-cnv-writer`) o por una **reincorporacion desde cuarentena**; no hay ninguna
pantalla donde admin diga *"entraron N unidades del lote X a la bodega"*. La consecuencia practica y lo que se
hace mientras tanto estan en la prueba **I** de arriba.

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

**LA SUPERFICIE QUE LO AVISA SE CONSTRUYO EL 2026-10-15**, dentro de la pieza 2 y no como mecanismo propio,
que era justo el riesgo: es otro **motivo** del mismo estado derivado (`rama_que_ya_no_corresponde`). Sale en
la ficha del paciente, en tono de revision y **sin frenar la atencion**, porque el consentimiento puede estar
bien y lo que hace falta es que alguien lo mire. Su smoke es el paso 5 de la prueba **J**.

**El script sigue sirviendo y no se retira:** barre la base entera de una vez, que es lo que hay que hacer
despues de corregir una fecha. La pantalla responde por un paciente; el script, por todos.

## 4c · RESPONDIDO · Las llaves reales de Alegra y Wompi NO enrutan por paciente

**La pregunta de Santiago (2026-10-15):** *"¿solo es montar las api keys reales de alegra y wompi, y ya con
eso si el paciente es de prueba se factura con alegra/wompi de prueba y si es real con el real? ¿El sistema
los reconoceria?"*

**No, y conviene tenerlo claro antes de montar las llaves. Hay UN solo juego de credenciales a la vez**, y el
ambiente lo decide `ALEGRA_BASE_URL` (se deduce de la URL a proposito, para que una variable no pueda decir
"produccion" mientras apunta al sandbox). **La marca de prueba no enruta: FRENA.**

- **Paciente de prueba, llaves de produccion:** no se factura. Se escribe el motivo en la venta y el panel lo
  dice. El sistema **si lo reconoce**, pero deteniendose, no desviandose.
- **Paciente real, llaves de sandbox:** tampoco se factura (su identidad no viaja a un ambiente de pruebas).
  Es simetrico a proposito.
- **Venta marcada a mano como de prueba:** no se factura **en ningun ambiente** (lo del 2026-10-14).

**Y montar las llaves NO alcanza.** Hay que correr `scripts/config-alegra-produccion.sql`, porque los ids de
Alegra son **por ambiente** y el item 7 del sandbox no es el 7 de produccion: sin esa fila, la primera venta
real falla con *"Items de otro ambiente"*. Lo que ese script pide son los ids de **produccion** de la
numeracion de factura, la de nota credito, el IVA, los dos centros de costo y las cuentas puente (se leen con
`scripts/leer-alegra.mjs` con las credenciales de produccion). Aborta sin escribir mientras quede un
`<LLENAR>`. Los **contactos de los pacientes** no hay que tocarlos: si el contacto guardado es de otro
ambiente, el servicio crea el de produccion solo.

**Se le añadio la cuenta de TRANSFERENCIAS (2026-10-15), que faltaba.** Sin ella, una venta pagada por
transferencia se factura y **el pago no se registra**: el paciente figura *"por cobrar"* en Alegra. El panel lo
dice, pero mientras nadie lo mire queda asi. **Tambien falta en la fila del sandbox**, asi que si quieres
probar ese caso antes, hay que llenarla ahi tambien.

## 4d · CONSTRUIDO · "Operacion real", con una sola definicion en la base

**La preocupacion de Santiago (2026-10-15):** *"el nucleo de CNV es la data, que puede que en algun futuro la
vendamos... entre mas facil sea acceder, organizar y cumplir con la calidad, mejor."* Y el riesgo que nombro es
el correcto: si cada consulta repite a mano las dos condiciones, tarde o temprano una se olvida.

**Se creo la vista `public.ventas_reales` (migracion 0219)**, con las dos condiciones dentro: no marcada como
de prueba, y del dia del arranque en adelante. Es **para consultar la base** (analisis, exportaciones), que es
donde no hay candado ni revision de codigo. Respeta la RLS de quien pregunta y esta revocada para `anon` y
`authenticated`.

**NO se metieron las pantallas dentro**, y es deliberado: ahi la frontera **no es la misma para todas**. La
fecha recorta las cifras de RESUMEN y **no** lo que se le debe a alguien ni el inventario (un saldo no es un
flujo). Una vista para todo habria metido la fecha donde no va.

**Y una correccion al enunciado, que vale mas que la vista: las dos condiciones son de lo COMERCIAL. La data
CLINICA tiene UNA sola**, no ser de prueba. Una consulta del 2 de octubre es una consulta de verdad, con su
medicion y su diagnostico, aunque la operacion comercial arranque el 15; el propio script de arranque las
preservo a proposito (509 consultas y 1.781 consentimientos intactos). Aplicarle la fecha a lo clinico borraria
del dataset pacientes reales medidos de verdad.

## 4e · RESPONDIDO · La cuenta de Distribucion pagada que quedo viva

**El caso:** el script de arranque dejo una cuenta viva, la **pagada**. Santiago confirma que es de una venta
de prueba y que *"no ha movido dinero real ni generado factura real"*.

**No se puede retirar, y no es una limitacion: es la regla.** `anularCuentaDistribucion` se niega con una
cuenta pagada, y el trigger `distribucion_statements_inmutable` (0215) lo impide por debajo en las dos
direcciones: no se puede retirar una pagada **ni** devolver `paid_at` a nulo. Su razon esta escrita ahi: *"un
pago registrado contra un documento que dice no existir es peor que una cuenta mal emitida."* **Eso se queda
como esta**: abrirle una puerta a esta fila le quitaria al mecanismo su unica garantia.

**Y no hace falta retirarla, porque no hace nada.** Verificado lector por lector:

- **el Integrante la ve como PAGADA**, no como algo que debe. Una fila en su historial de cuentas, con su
  fecha de pago;
- **no le suspende despachos ni le consume cupo:** las dos mitades del saldo pendiente excluyen las cuentas
  pagadas, y la mora se calcula solo sobre las **abiertas**;
- **no entra en /pagos** en absoluto: las cuentas de Distribucion viven en /comercial;
- **y sus ventas ya estan marcadas como de prueba** por el script de arranque, asi que no cuentan en ninguna
  cifra de dinero.

**Lo unico que falta es dejar escrito de que etapa es**, y para eso esta
`scripts/ANOTAR_LA_CUENTA_PAGADA_DEL_PERIODO_DE_PRUEBAS.sql`: anota la fila (`paid_note`) y deja una fila de
auditoria. **No niega el acto** (la cuenta se emitio y el pago se registro, y las dos cosas pasaron): dice que
fue del periodo de pruebas, para que en seis meses la pregunta se responda sola. Elige las cuentas **por la
fecha del corte**, no por un id pegado a mano, y si la fecha de arranque no esta fijada no alcanza a ninguna.
Termina en `rollback`.

## 4f · DIMENSIONADO, NO CONSTRUIDO · La venta de admin sin profesional, con otro precio y sin comision

**El caso de Santiago (2026-10-15):** *"hemos distribuido inventario incluso a pacientes que no son de ningun
integrante (con descuento)... que admin ponga esas ventas sin estar asociadas a un profesional, con un precio
diferente y sin porcentaje de comision (ejercicio de mercadeo y con familiares)."*

**Son tres cosas y conviene separarlas, porque dos ya existen:**

- **(a) Venta sin profesional: YA FUNCIONA, y esta previsto.** `ubicacionDeLaVenta` dice textualmente que una
  venta sin profesional (la crea un administrador para un paciente sin Integrante asignado) **sale de la
  central**, confirmado por Santiago el 2026-09-13. La columna `transactions.professional_id` es nulable. Lo
  que hay que verificar antes de usarlo en serio son **las lecturas que agrupan por profesional**: las del
  tablero de /direccion ya tratan el nulo a proposito (su comentario explica por que no usan un `!inner`,
  justo para no perder la venta sin profesional en silencio), pero la liquidacion y las cuentas **cuelgan del
  Integrante**, asi que una venta sin profesional simplemente no entra en ninguna, que es lo correcto: no hay
  a quien pagarle.
  **Y requiere saldo en la central**, o sea que depende de R14 (ver la prueba I).
- **(c) Sin comision: sale solo.** La comision se **sella** en la linea de la venta; sin profesional no hay
  porcentaje que aplicar, asi que queda en cero sin inventar nada.
- **(b) El precio distinto del de lista: ESTA es la pieza.** Hoy el PVP se **sella** al crear el checkout
  desde el catalogo, y eso es a proposito (es lo que impide que un cambio de precio reescriba una venta
  vieja). Un precio distinto pide una **entrada de precio con motivo obligatorio** y la decision contable de
  que es: ¿un descuento (misma base, menos valor) o un precio especial? **Esa decision es de contabilidad, no
  nuestra**, y de ella depende como queda el IVA y como se ve en la factura.

**Lo mas barato NO es permitir el nulo** (ya esta permitido). **Lo mas barato es (b) con su motivo**, y
preguntarle a contabilidad si es descuento o precio especial **antes** de construir. Un *"profesional CNV"*
con comision en cero seria peor: inventaria un Integrante que no existe, le crearia una ubicacion de
inventario propia y ensuciaria todas las agrupaciones por profesional para siempre.

**Es para despues del arranque**, como dijo Claude web.

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
