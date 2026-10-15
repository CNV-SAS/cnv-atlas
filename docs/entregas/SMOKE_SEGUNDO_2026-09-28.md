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

**EL ORDEN DEFINITIVO DEL 2026-10-15 (corregido tres veces el mismo dia: la segunda cancelo los scripts de
inventario y la tercera cambio como se prueba):**

1. **Push y deploy.** Lo que pone /pagos en cero es el **codigo** (el filtro de prueba sin excepciones), no una
   migracion. La 0220 ya quedo aplicada; la **0221** es solo un comentario en la base y se puede aplicar antes
   o despues, sin riesgo:
   `node scripts/aplicar-migracion.mjs drizzle/0221_lo_de_prueba_vive_en_el_filtro_de_prueba.sql --commit`
2. **Verificar /pagos.** Del lado real tienen que quedar solo las **2 unidades de ADAPTO-STRESS en
   cuarentena**, que se cierran con los dos botones del panel. Las cinco ventas de prueba desaparecen solas,
   descartadas o no (seccion **F**). Los descartes que ya escribiste no estorban: cada uno nombra su propia
   venta y su propia huella.
3. **El paso 3 de la J**, que desbloquea a los seis menores.
4. **F, G, H**, luego **A a E**, con **gente real** y marcando al final (seccion **4j**, reescrita).
5. Al cerrar el smoke: **marcar a mano las ventas del smoke**, **marcar los dos perfiles**
   (`Profesional Prueba`, `Profesional demo 2`) y **decidir ADAPTO-STRESS** (seccion **4l**). No es opcional:
   es la condicion para montar las llaves de produccion, y ahora hay un guard que lo verifica.
6. El resto de la **J** y lo demas, despues.

**NO SE CORREN** `CARGAR_LA_BODEGA_AL_ARRANQUE` ni `CONCILIAR_EL_INVENTARIO_AL_ARRANQUE`: la bodega ya estaba
cargada con la primera tanda desde el 11 de septiembre, y ocho ubicaciones tienen producto fisico encima.
El porque esta en la seccion **I**.

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


#### ✅ AVERIGUADO EL 2026-10-15, CON EL SCRIPT YA COMITEADO: NO ERA EL DESPLIEGUE NI UN LECTOR SIN CUBRIR

Tu reporte: *"las 55 ventas estan marcadas, la fecha de arranque esta fijada, y ADMIN SIGUE VIENDO LO MISMO"*,
con tres hipotesis: (a) el deploy no subio, (b) quedo un lector sin cubrir, (c) cache de pagina.
**Ninguna de las tres.** Lo que medi:

- **(a) descartada.** `origin/main` y `main` estan en el mismo commit, 0 adelante y 0 atras. Todo esta
  desplegado, y el barrido de los lectores venia de varios push atras.
- **(b) descartada, lector por lector.** Los ocho reciben el interruptor y los ocho filtran. Dos filtran por
  otra cosa **a proposito y con su razon escrita** (0218): hablan de UNIDADES FISICAS, no de dinero.
- **(c) descartada.** La pantalla es dinamica (`requireUser`), no hay cache de ruta que invalidar.

**La base esta impecable:** 55 transacciones en total, **las 55 marcadas de prueba, CERO reales**, y
`fecha_de_arranque = 2026-10-15`. Por eso los cuatro paneles que leen dinero estan en cero de verdad: el
universo de ventas reales esta vacio, no hay nada que puedan mostrar.

**ENTONCES POR QUE VES CINCO.** Son las dos excepciones fisicas, y cuadran exactamente con lo que reportaste:

| Lo que ves | De donde sale | Es correcto |
|---|---|---|
| **5** ventas por revisar | 5 ventas `sin_saldo` de **producto real** sin marca a mano | si, es el descuadre fisico |
| **4 + 1 descartado** en pendientes sin salida | las **mismas** 5, por la misma funcion | si |
| **2** devueltas pendientes | 2 ADAPTO-STRESS **reales** parados en cuarentena | si, se cierra con los botones |
| 1 cobrada sin cerrar · 3 en el historial | ya no existen | **estaban en cero** |

Las cinco son: cuatro ADAPTO-STRESS de 107.100 (tres del 8-oct y una del 7-oct) y una LUVIA de 30.000 del
2026-01-02 registrada retroactivamente.

#### ⛔ Y EL DEFECTO QUE SI HABIA, QUE ES POR LO QUE PARECIA QUE NADA SURTIA EFECTO  → 0220

**La quinta, la LUVIA, YA ESTABA DESCARTADA** en la nube, con motivo *"Era una prueba (smoke final)"*. Es tu
*"1 descartado"*. Y seguia apareciendo arriba en "Ventas por revisar".

Porque el texto de esa bandeja dice, para cada una de esas filas: *"ese descuadre hay que cuadrarlo o
descartarlo abajo, en Pendientes sin salida"*, y **`listarVentasPorRevisar` no sabia nada del descarte.** La
condicion ("no revocado y con la huella vigente") vivia escrita a mano en el `where` del **otro** lector, y en
ningun otro sitio.

**Asi que la pantalla mandaba a hacer algo y no reconocia que se hizo.** Eso no se lee como dos reglas
distintas: se lee como que el sistema no guardo la accion, y entonces se deja de creerle al panel. Es el
**hazard 4 de CLAUDE.md** en su forma pura, dos partes de la pantalla diciendo cosas opuestas porque leen
fuentes distintas, y el arreglo es el de siempre: unir las fuentes.

La **0220** crea `public.el_pendiente_sigue_pidiendo_accion(kind, tx)` y la llaman los dos lectores. El
`lateral` del otro se queda, pero solo para MOSTRAR (motivo, autor, fecha, caducado); quien decide si la fila
sale es la funcion. Y aguanta algo que el lateral no: dos descartes sin revocar de la misma venta multiplicaban
la fila, el `EXISTS` no.

Tres detalles que importan:

- **El filtro del descarte NO cuelga del interruptor de prueba.** Son cosas distintas: la marca dice si el
  acto cuenta, el descarte dice si una persona ya juzgo ese hecho fisico. Colgarlo del interruptor haria
  reaparecer filas ya resueltas al encenderlo.
- **`fallido` no tiene camino de descarte**, y `huella_del_pendiente` **lanza** para un tipo sin huella
  definida. El `EXISTS` lo protege: para `fallido` no hay filas, asi que la huella no se evalua nunca.
- **La caducidad vale en los dos lados.** Si el hecho cambia despues del juicio, la fila vuelve a los dos
  paneles. Probado contra Postgres de verdad.

**QUE TIENES QUE HACER PARA DEJARLO EN CERO** (corregido el 2026-10-15, segunda vuelta: **ya no hay que
descartar nada**):

1. **Push y deploy.** Lo que vacia la pantalla es el codigo de la **0221**, no una migracion.
2. Recarga /pagos. Las **cinco** ventas desaparecen del lado real, descartadas o no, y el panel de
   "Pendientes sin salida" queda en **0 · 0**. Estan en el lado del interruptor de prueba, con su fila
   explicando por que la ves.
3. **Las 2 devueltas:** dos clics en el panel, *"dar de baja"* (son ADAPTO-STRESS de lotes de smoke). Eso es
   un juicio fisico, ningun script lo puede tomar, y no lo cambia ningun filtro de prueba: ese panel cuenta
   **unidades paradas en cuarentena**, no ventas.

#### ⛔ Y LA SEGUNDA VUELTA DEL MISMO PUNTO, QUE ES LA QUE LO CIERRA  → 0221

Descartaste las cinco con su motivo, el contador quedo en *"0 pendientes sin resolver · 5 descartados"*, y las
cinco **seguian listadas en el lado real**. Textual tuyo:

> *"Si son pruebas simplemente no deben aparecer en la pantalla de produccion, es asi de simple. NI SIQUIERA
> TENIA QUE HABERLAS DESCARTADO. La logica deberia ser simple: si algo esta marcado como prueba, aparece en el
> filtro de prueba."*

**Tienes razon, y la excepcion de la 0218 estaba mal calibrada.** Su argumento (si el producto es real, la
unidad salio de una vitrina real y el descuadre es real) **es cierto**, y aun asi no servia:

- el smoke se hace con **pacientes de prueba sobre vitrinas reales**, asi que cada venta que no alcanza saldo
  levanta un descuadre que nadie va a ir a contar;
- y **un aviso que sale por data que nadie puso se aprende a ignorar**. Ya se pago dos veces en esta misma
  pantalla (el aviso que acusaba a la vitrina equivocada, los siete pendientes inventados). El dia que salga
  un descuadre de verdad, nadie lo va a mirar.

**Lo que se hizo:** el filtro de prueba vuelve a ser **uno solo** y sin excepciones, en los dos lectores (las
tres ramas de la bandeja y las seis ramas de los avisos). `el_descuadre_fisico_es_real` queda **retirada**: no
la llama nadie, y la 0221 cambia su comentario en la base para que nadie la vuelva a cablear sin esta
conversacion. **No se borra** a proposito: un `DROP` dejaria /pagos llamando a una funcion que no existe entre
la migracion y el deploy, o sea un 500 en la pantalla entera.

**Donde quedo el hueco fisico:** donde vive, en un movimiento de **conciliacion** por ubicacion. Tu frase:
*"el hueco de inventario, si lo hay, se cuadra por conciliacion"*. Marcar nunca devolvio una unidad al
estante; lo que se movio es **donde se pide la cuenta**.

**Y los descartes que ya escribiste no estorban despues**, que es lo otro que pediste verificar: cada fila de
`pending_discards` nombra **una** transaccion y **una** huella del hecho. No puede callar otra venta, y si el
hecho de la suya cambia, **caduca** y vuelve a pedir accion. Hay un candado nuevo contra BD real que lo prueba
con dos ventas a la vez (*"un descarte calla SU hecho y ninguno mas"*).

Candados: `src/tests/los-dos-paneles-del-mismo-hecho-deciden-igual.test.ts` (12, renombrado porque la regla
que vigila cambio) y, contra BD real, `src/tests/lo-de-prueba-no-llega-a-pagos-db.test.ts` (9) y
`src/tests/descartar-un-pendiente-db.test.ts` (8).

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

#### ⛔ CORREGIDO EL 2026-10-15: LA BODEGA YA ESTABA CARGADA. NO SE CORRE NINGUNO DE LOS DOS SCRIPTS

**Esto se escribio al reves el 2026-10-14 y hay que decirlo claro.** Di por hecho que la central estaba vacia
porque tu dijiste *"Santiago NO PUEDE CONTAR FISICAMENTE HOY"*, y de ahi salieron el script de carga y la
conciliacion en cero. **Mire el saldo de la nube antes de correrlos y los dos sobran, y los dos harian daño.**

**La primera tanda entro el 2026-09-11**, con un movimiento `recepcion` por producto cuyo texto dice *"Carga
inicial: saldo en bodega central tras la primera entrega a Integrantes"*. Lotes y vencimientos reales
incluidos. Y cuadra **unidad por unidad** con lo que acabas de pasar:

| Producto | Lote | Declarado | En central hoy | En vitrinas | Suma |
|---|---|---|---|---|---|
| MULTI-CELL BASE | 19826 | 500 | 382 | 114 | **496** (4 vendidas) |
| OMEGA COMPLEX | 20226 | 500 | 385 | 113 | **498** (2 vendidas) |
| CURCUMIN BIOACTIV | 20526 | 426 | 312 | 114 | **426** ✓ |
| D3-K2 OSTEO | 19726 | 300 | 186 | 114 | **300** ✓ |
| LUVIA (tercero) | 04197232 | 84 | 14 | 70 | **84** ✓ |

Siete vitrinas de Integrantes reales tienen producto encima (Angela, Camilo, Diana, Katherine, Maria Camila,
Roberto y Valentina). **Total: 1.822 unidades de producto real.**

**POR QUE NO SE CORRE LA CARGA:** metia 1.810 unidades encima de las 1.822 que ya hay. La bodega quedaria con
**3.632** y nadie sabria cual mitad es inventada. El script no podia detectarlo: cargar una recepcion es una
operacion legitima, y un segundo envio del laboratorio se veria exactamente igual.

**POR QUE NO SE CORRE LA CONCILIACION EN CERO:** era tu propia condicion (*"confirma que eso no borra el saldo
de ninguna vitrina que de verdad tenga producto fisico encima. Si alguna lo tiene, dilo ANTES"*). **Ocho la
tienen**, y la bandera `llevar_a_cero_lo_no_listado` en `true` con el bloque (2) vacio habria borrado las
1.822, sin vuelta atras.

**Con la bodega asi, la prueba H pasa.** La reserva de la venta exige existencias y hay 385 OMEGA, 382
MULTI-CELL, 312 CURCUMIN, 186 D3-K2 y 14 LUVIA en la central. Era la otra cosa que pediste confirmar.

**Los dos scripts se quedan en `scripts/`**, sin correr, con su cabecera corregida: sirven para el **segundo**
envio del laboratorio, que es cuando la carga de verdad hara falta. Y las tres notas que salieron de tu dato
siguen valiendo para entonces: LUVIA son dos entregas (60 el 26 de agosto y 24 el 27), el modelo si distingue
el producto de tercero (`ownership = 'tercero'`, con su titular de marca), y los **NUT-00X son codigos de
Alegra, no lotes**.

#### LO QUE SI HAY QUE LIMPIAR, Y ES MUCHO MAS PEQUEÑO

No es el inventario: es **un producto y dos perfiles**.

**ADAPTO-STRESS tiene 16 unidades y ningun lote de verdad** (eran 18: las 2 de cuarentena se dieron de baja
el 15 a las 18:30). Sus lotes son `aaaaa`, `aaaaab`, `jkl-11`, `Lote 001`, `LOTE SMOKE ADPTS`, `LOTESMK1`,
`LOTESMK222` y `SMOKE (FINAL)`: nadie escribe `aaaaa` en un lote real. Y **no esta en la primera tanda del
laboratorio**. Reparto de las 16, las tres en cuentas de smoke: Profesional Prueba 6, Profesional demo 2 9,
Profesional Demo 1. **El camino para dejarlo en cero, con sus lineas exactas, esta en la seccion 4l.**

**Lo grave no es el saldo, es que esta en `en_consultorio`:** o sea que un Integrante real puede venderlo
mañana, y esa venta se factura en Alegra produccion con numeracion de la DIAN, de un producto que no esta en
ninguna bodega. Los otros cinco que CNV no tiene (BERBERINA METABO, GUT-IMMUNE PRO, HEPA-DETOX, MITO-Q10 PLUS,
SARCO-PROTECT) ya estan en `no_disponible`, que es lo que lo impide. **Decide tu:** si CNV no tiene
ADAPTO-STRESS, va a `no_disponible` como los otros cinco.

**Y dos perfiles de prueba estan marcados como REALES:** `Profesional Prueba` y `Profesional demo 2`. Solo
`Profesional Demo` y `Santi pruebas` tienen la marca. Por eso sus 15 ADAPTO-STRESS cuentan como inventario
real y sus ventas como ventas reales. Se arregla desde **/admin**, con la misma accion que marca un paciente
(`marcarProfesionalDePrueba`), y el trigger de la 0203 recalcula sus ventas hacia atras solo.

#### Y LO QUE PASARIA SI ARRANCARAS EN CERO SIN CARGAR (YA NO ES EL PLAN: queda anotado)

**No se va a hacer:** la bodega ya estaba cargada (arriba). Esto se queda porque la mitad de abajo sigue siendo
cierta y util, y porque el dia del segundo envio la pregunta vuelve.

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

**EL PASO 3 SI ES URGENTE Y VA ANTES QUE TODO**, porque es el que desbloquea a los seis pacientes que la
profesional tenia detenidos. El resto puede esperar a despues de F-I.

#### Lo que estaba pasando, que no era lo que yo reporte

Reporte que *"la atencion no se frena"*, y era falso: **habia un segundo muro, anterior a la pieza 2 y mas
abajo**. `checkConsentBranchConsistency` (el "segundo muro" de DELTA2 B3) frenaba la **CONFIRMACION DE
IDENTIDAD**, asi que la evaluacion se quedaba en `draft` y no se podia hacer nada. En la base local habia
**3 pacientes y 2 evaluaciones paradas**; en la nube son **6 pacientes**.

**Y el bloqueo no tenia salida**, que es lo que lo convierte en un defecto y no en un guard: su mensaje
mandaba a *"repetir el consentimiento con el representante legal"*, y para un paciente QUE YA EXISTE ese
camino **no esta construido**. El pase presencial con rama de menor (0216) solo crea pacientes NUEVOS, y el
camino remoto necesita un correo que estos pacientes no tienen, que es justo por lo que entraron por el QR.

**Lo que se cambio (2026-10-15):** ese muro ya no frena ese caso, y el gate de la pieza 2 tampoco. **El hecho
no se perdio**: lo marca el estado derivado, en la ficha y en la lista, con que hacer. Candado contra base
real: `el-menor-sin-representante-no-queda-detenido-db.test.ts`, que confirma identidad de un menor sin
representante y comprueba que avanza Y que queda marcado.

**Y queda pendiente la otra mitad, que es la que de verdad cierra el caso:** el camino para repetir el
consentimiento de un paciente **que ya existe** (seccion 4g).

**Que se construyo:** el estado derivado *"pendiente de regularizar"* del dictamen legal del 2026-10-09, su
freno en el gate y su aviso en pantalla. La prevencion ya existia (un consentimiento de menor sin
representante no se puede guardar desde el 2026-10-09); lo que faltaba es que **lo ya guardado se reconozca**.

**En la base local hay 3 casos**, uno de ellos de un paciente **real**: 13 años al firmar, por el camino del
correo, version 1.0, sin representante. Los otros dos son de prueba y tienen fecha de nacimiento imposible.
**Corre `scripts/CONSENTIMIENTOS_PENDIENTES_DE_REGULARIZAR.sql` contra la nube antes de probar**, para
saber a quien vas a ver marcado y cuantos son. Es de solo lectura y dice que hacer con cada caso. Y vale
para despues: hay que correrlo tras cualquier correccion de fecha de nacimiento. **Esa lista no puede
crecer** (la prevencion esta desde el 2026-10-09): solo se vacia.

1. Abre la **ficha** de uno de los seis. **Criterio:** arriba de las autorizaciones sale un bloque con el
   titulo *"Consentimiento de menor sin representante"*, dice **"(por revisar; no bloquea la atención)"**,
   dice **que hacer**, y dice que el consentimiento firmado **no se borra ni se invalida**. Las tres
   autorizaciones siguen apareciendo *"Vigente"* abajo, porque lo son.
2. En la **lista de pacientes**, ese paciente lleva su propia etiqueta con ese mismo texto. **Criterio:** NO
   dice *"Sin autorizacion vigente"*, porque no retiro ninguna.
3. **ESTE ES EL QUE DESBLOQUEA, Y VA PRIMERO.** Abrele una consulta nueva y **confirma su identidad**.
   **Criterio:** la confirmacion pasa y la evaluacion queda *en curso*. Antes se quedaba en borrador con el
   aviso *"repite el consentimiento con el representante legal antes de confirmar"*, y no habia forma de
   cumplirlo. **Que la profesional pueda atender a los seis es el criterio de aceptacion de hoy.**
4. **Un paciente con fecha de nacimiento imposible** sale marcado con *"Fecha de nacimiento imposible"*, en
   tono neutro y sin frenar nada. Corrige la fecha en la ficha: **criterio:** la marca desaparece sola. (En la
   nube no hay ninguno; en local hay dos, de prueba.)

**Lo que NO cubre, y es lo que sigue (seccion 4g):** repetir el consentimiento de un paciente **que ya
existe**. Mientras eso no exista, los seis quedan **marcados y atendidos**, que es lo que pedia el dictamen,
pero el consentimiento sigue sin regularizar. Y sigue sin construirse la exclusion de estos pacientes de los
**usos secundarios** (investigacion, estadistica comercializable): hoy no existe el filtro de dataset donde
engancharla, y darsela a esta pieza seria inventarle un mecanismo.

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
   ⚠ **La remesa, declarala de 1 unidad de MULTI-CELL BASE lote `19826`** (producto de bodega), no de
   ADAPTO-STRESS: desde el 15 la central no deja declarar lo que no tiene, y de ADAPTO-STRESS no tiene nada.
   El porque esta en la **seccion 2**.
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
ahora"* se posterga (mientras no exista, una rezagada que cruce de bimestre la factura admin a mano en Alegra,
y para que no se emita dos veces hace falta la pieza de la seccion 4i).

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

### DIMENSIONADO EL 2026-10-15 · Las tres formas, y cual recomiendo

Santiago propone ahora **descontar AL ENVIAR**: *"que apenas admin envie una remesa (se acepte o no)
inmediatamente se descuente desde la bodega central"*. Es distinto de lo que decidio el 12 (descontar **al
confirmar**), y conviene verlo junto porque las dos tienen un agujero simetrico.

**Lo primero, el mecanismo, porque de ahi sale todo el coste.** El saldo de una ubicacion NO es un dato que se
escriba: lo calcula un trigger como la **SUMA de los movimientos** de ese (ubicacion, producto, lote),
**excluyendo los de tipo `remesa`**. Y una remesa se declara **sobre la ubicacion del Integrante**, no sobre
la central. O sea que hoy la remesa no es un traslado: es un anuncio.

| | que pasa en el hueco | el riesgo |
|---|---|---|
| **(a) al enviar** | las unidades salieron de central y no estan en la vitrina | **no estan en ningun lado**: invisibles hasta que confirme |
| **(b) al confirmar** | la central sigue contandolas | **las cuenta dos veces en la practica**: admin puede vender desde la bodega lo que ya va en camino |
| **(c) como hoy** | nada sale de central nunca | el total **crece** con cada recepcion |

**La (b) no es mas segura que la (a), es insegura al revés.** Medido: una de las 14 remesas tardo **90 horas**
en confirmarse. Con la (b), durante esos cuatro dias la central dice que tiene unas unidades que ya van en una
mochila, y una venta a domicilio sale de ahi: se despacharia algo que no esta. Con la (a) el riesgo es no
verlas; con la (b) es venderlas dos veces.

#### RECOMIENDO LA (a), Y CON LA FORMA QUE YA EXISTE EN EL SISTEMA

**El transito no hay que inventarlo: es una UBICACION, igual que la cuarentena.** Ya existe una ubicacion
`cuarentena` que no es vendible (`sellable: false`) y sostiene unidades en limbo con un panel para resolverlas.
"En transito" es exactamente la misma figura:

- **al declarar:** dos movimientos, central **−x** y transito **+x**;
- **al confirmar:** transito **−y** y vitrina **+y**, con la `y` que el Integrante confirmo;
- **lo que sobra se queda en transito**, visible, hasta que alguien lo resuelva.

**El total nunca cambia**, que es lo que hoy no se cumple. Y responde tus tres preguntas sin piezas nuevas:

- **¿Donde se ve?** Donde ya se ven las ubicaciones: el tablero de Direccion agrupa el inventario por
  ubicacion y `kind`, y la pantalla de vencimientos lo agrupa por custodia. Una ubicacion nueva **aparece
  sola** en las dos, igual que aparecio la cuarentena. Mas el panel de remesas, que ya lista las pendientes.
- **¿Y si nunca confirma?** Hace falta un "volver a central", que es **el mismo escritor** que falta desde R14
  (*"admin debe poder registrar en central"*, verificado el 15: **no existe**; a la central solo entran
  unidades por una devolucion de un Integrante o una reincorporacion de cuarentena). O sea que esa mitad hay
  que construirla igual, y sirve para las dos cosas.
- **¿Y si confirma MENOS?** Hoy el saldo sube por el **minimo** entre lo declarado y lo reportado, asi que el
  faltante **desaparece sin dejar rastro**. Con transito, ese faltante **se queda en transito** y alguien
  tiene que decir si volvio a central o si se perdio. Es estrictamente mejor que hoy, y es el unico cambio
  que convierte la asimetria en algo visible en vez de silencioso.

#### PERO SI: ES EL MODULO GRANDE, Y LO DEJO ANOTADO OTRA VEZ

Lo que lo vuelve modulo y no parche es **quien puede escribir**. Hoy la confirmacion es **un solo insert bajo
la RLS del propio Integrante**, que solo puede escribir en SU ubicacion. Un traslado transito → vitrina pide
un movimiento **en una ubicacion que no es suya**, asi que la escritura tiene que pasar a una funcion
`SECURITY DEFINER` (o al cliente de servicio) con sus propias comprobaciones. Eso es cambiar el camino de
escritura de lo que mueve el inventario.

**El precedente mide el tamaño:** la cuarentena (que es la misma figura) costo **cuatro migraciones**
(0164 a 0167: la ubicacion nueva, su CHECK y tres tipos de movimiento), un escritor de **333 lineas** y su
panel. El transito es eso **mas** la entrada a central que falta **mas** el cambio del camino de escritura de
la confirmacion.

**Asi que se queda pospuesto**, como decidiste el 12 (*"esto va a hacer parte de todo el modulo de inventario
grande"*). Y la recomendacion es que cuando se haga, se haga **con la (a)**: la (b) cuesta casi lo mismo y
deja el riesgo de despachar desde la bodega algo que ya salio.

#### LO BARATO, CONSTRUIDO EL 2026-10-15 · La central no despacha lo que no tiene

De tu decision del 12 habia una mitad que **no** necesita el modulo: *"no deberia dejar cargar nutraceuticos
que no esten en central"*. Esa quedo hecha. El resto de la seccion (el transito, que la central BAJE) sigue
pospuesto.

**Lo que hace:** al declarar una remesa, si la bodega central no tiene esas unidades de ese lote, **se rechaza
antes de escribir nada** y el mensaje dice cuantas hay. Y el cuadro **"Disponible en la bodega central"**
aparece junto al formulario, en /faltantes, para que el numero este a la vista ANTES de teclear una cantidad.
Un freno sobre una cifra que no esta en la pantalla se lee como un defecto; con el cuadro al lado es una regla.

#### TU PREGUNTA CORRIGIO LA RESTA, Y ERA EL FONDO DEL ASUNTO

Yo habia dicho "el saldo menos **lo ya declarado SIN CONFIRMAR**". Tu pregunta: *"como hoy la confirmacion NO
descuenta de central, confirma que la resta NO SE SUELTA cuando el Integrante confirma. Si se suelta, la misma
unidad vuelve a estar disponible para una segunda remesa y la comprobacion solo tapa el caso de las remesas
simultaneas."*

**Tenias razon y estaba mal.** Con "sin confirmar", al confirmar la remesa salia del conjunto restado y la
central volvia a ofrecer unas unidades que ya iban en camino. Asi que se restan **TODAS las remesas de ese
(producto, lote), confirmadas o no**. Nada se suelta nunca, porque la confirmacion no devuelve nada a la
bodega.

El tercer caso del candado `la-central-no-despacha-lo-que-no-tiene-db.test.ts` **es esa pregunta**: declara
seis de diez, confirma, y exige que sigan quedando cuatro. Verificado en rojo con la version equivocada.

#### Y NO HIZO FALTA NINGUNA FECHA DE CORTE (medido, no supuesto)

Restar TODAS las remesas seria doble resta si alguna ya estuviera descontada del saldo. La condicion que hay
que cumplir es esta, y esta medida: **ninguna remesa de la historia salio de un lote que la central tuviera.**

Las 14 que existen son de **ADAPTO-STRESS** (129 unidades, un producto del catalogo que **todavia no existe
fisicamente**, asi que no esta marcado de prueba pero tampoco tiene bodega) y de **PRUEBA SMOKE**. De los
**cinco productos de bodega** (MULTI-CELL, OMEGA, CURCUMIN, D3-K2 y LUVIA) **no hay una sola remesa**: las 525
unidades de las siete vitrinas entraron antes de que existiera el mecanismo, y la carga de la central del
2026-09-11 ya se hizo con el remanente (*"saldo en bodega central tras la primera entrega a Integrantes"*).

Medido hoy, el disponible **coincide con el saldo** en los cinco:

| Producto | Lote | Saldo | Remesado | Disponible |
|---|---|---|---|---|
| MULTI-CELL BASE | 19826 | 382 | 0 | **382** |
| OMEGA COMPLEX | 20226 | 385 | 0 | **385** |
| CURCUMIN BIOACTIV | 20526 | 312 | 0 | **312** |
| D3-K2 OSTEO | 19726 | 186 | 0 | **186** |
| LUVIA | 04197232 | 14 | 0 | **14** |

Asi que no habia nada que indultar, y esto no necesita una constante de corte como `REMESA_LAUNCH_ISO`.

**Y la resta se mantiene sola despues:** una devolucion del Integrante entra a la central y sube el
disponible; una venta a domicilio lo baja; una conciliacion lo cuadra contra el conteo. Nada pide
mantenimiento.

#### DOS COSAS QUE HAY QUE SABER ANTES DE USARLO

**1 · El producto marcado de PRUEBA queda EXENTO del tope, y es a proposito.** Un producto de prueba **no
tiene bodega fisica que proteger**, y sus unidades existen solo para poder volver a probar. Con el tope puesto
se cerraria el unico camino para recargar una vitrina de prueba dentro de produccion, que existe por tu
decision del 2026-10-01.

> ⚠ **PERO ADAPTO-STRESS NO ESTA MARCADO DE PRUEBA** (medido: `is_test = false`, `en_consultorio`), asi que
> **NO queda exento**, y la central no tiene ninguno de sus lotes. **La prueba D del smoke** (*"Mi inventario
> con una remesa por confirmar"*) **ya no se puede hacer con ADAPTO-STRESS** en cuanto esto se despliegue.
>
> **Hazla con producto de bodega, que ademas es la prueba mejor:** declara **1 unidad de MULTI-CELL BASE, lote
> `19826`** (disponible 382) al Integrante que uses. Con eso aparece la remesa por confirmar, que es lo que la
> D mira. Si la confirmas, el total del sistema sube en 1 unidad (el hueco conocido de esta seccion); se
> cuadra con el script de conciliacion cuando cuentes en la oficina. Si no la confirmas, no se mueve nada.
>
> Y despues del smoke el punto desaparece solo: ADAPTO-STRESS pasa a `no_disponible`, y eso lo saca de la
> lista de la remesa.

**2 · La salida del freno, cuando el lote no esta en la central, es un script.** El mensaje dice *"hay que
registrar su entrada a la bodega antes de despacharlo"*, y eso hoy se hace con
`CARGAR_LA_BODEGA_AL_ARRANQUE_2026-10-15.sql`, **no hay pantalla**. Es el mismo escritor que falta desde R14
(*"admin debe poder registrar en central"*) y el mismo que pide el "volver a central" del transito. Con los
cinco lotes de bodega cargados no estorba; el dia que llegue el segundo envio del laboratorio, **primero se
carga la bodega y despues se despacha**, que es justo el orden que querias.

---

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

**Y el ORDEN en que se montan esta en la seccion 4l**, con el guard que lo verifica.

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

#### ⛔ CORRIO EL 2026-10-15 Y NO ALCANZO NINGUNA. SE QUEDA SIN ANOTAR, A PROPOSITO

Santiago lo corrio y salio *"CUENTAS PAGADAS ANTERIORES AL ARRANQUE: 0"*, que no cuadraba con la verificacion
del arranque (`cuentas_pagadas_que_quedan: 1`). **Su lectura era exacta:**

| | |
|---|---|
| El corte de esa cuenta | 2026-10-01 a **2026-10-15** |
| `fecha_de_arranque` | **2026-10-15** |
| La condicion del script | `corte_hasta < fecha_de_arranque` |

El 15 no es menor que el 15, asi que **queda fuera por diseno**. Medido en la nube, no deducido.

**Y la condicion NO se afloja a `<=`, por una razon mas fuerte que la que estaba escrita.** El comentario del
script decia que seria peor anotar como "de pruebas" una cuenta real del futuro. Con `<=` el caso no es
hipotetico: **el corte que termina exactamente el dia del arranque es el PRIMER corte real del periodo
nuevo** (el 01 al 15 de octubre cierra hoy). O sea que `<=` anotaria como periodo de pruebas justo la primera
cuenta real que CNV va a emitir.

**Y el proposito documental ya esta medio cubierto:** esa fila lleva `paid_note = 'smoke-recibido'`, escrita
cuando se registro el pago. No dice "periodo de pruebas" con esas palabras, pero cualquiera que la mire en
seis meses ve que salio de un smoke.

**Entonces queda escrito aqui por que existe esa cuenta**, que era el proposito original de la anotacion:

> El 2026-10-12, probando el bloque de Distribucion, se emitio una cuenta del corte 01 al 15 de octubre a un
> Integrante de prueba por 171.360 COP y se le registro el pago (`paid_note: smoke-recibido`). **Las dos cosas
> ocurrieron** y por eso no se retiran: el trigger `distribucion_statements_inmutable` (0215) lo impide en las
> dos direcciones, y un pago registrado contra un documento que dice no existir es peor que una cuenta mal
> emitida. **Sus ventas estan marcadas como de prueba** por el script de arranque, asi que no cuenta en
> ninguna cifra de dinero, no le suspende despachos y no le consume cupo a nadie.

**El script se queda en el repositorio** y sigue siendo correcto: el dia que aparezca una cuenta pagada de un
corte **anterior** al arranque, lo anota sin editarlo.

---

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

## 4g · LO QUE SIGUE · Repetir el consentimiento de un paciente QUE YA EXISTE

**Es la mitad que cierra el caso de los seis menores**, y hoy no existe por ningun camino:

- el **pase presencial con rama de menor** (0216) existe y funciona, pero `declararYCrearQrAction` llama al
  escritor con `mode: "inicial"` y `patientId: null`, o sea que **siempre crea un paciente nuevo**. Con uno
  que ya existe choca contra `patients_org_document_unique` y responde *"ese documento ya esta registrado"*;
- el **camino remoto** si puede re-consentir a un paciente existente (el escritor lo soporta con
  `mode: "seguimiento"`), pero necesita un **correo** para el codigo, y estos pacientes no lo tienen.

**La maquinaria esta casi toda puesta**, y por eso no es una pieza grande:

- la sesion presencial ya tiene columna `patient_id` (hoy se llena al crear el paciente; aqui se conoceria
  desde el principio);
- ya congela la fecha de nacimiento y **ya elige la rama** con ella (0216);
- el escritor ya sabe re-consentir: revoca la autorizacion vigente del mismo tipo e inserta la nueva;
- y el guard del menor sin representante ya protege el resultado.

**Lo que hay que construir:** que `crearSesionPresencial` acepte un `patientId` existente, un boton
*"Regularizar el consentimiento"* en la ficha del paciente (junto al bloque que ya lo anuncia), y que al
declarar se llame al escritor con `mode: "seguimiento"` y ese id en vez de crear. **Mas un candado contra base
real**, porque es el unico sitio donde se ve si el consentimiento viejo queda revocado y el nuevo vigente.

**Y por que no se construyo el 2026-10-15:** es la zona de los ocho hazards de formulario (dos pantallas y un
flujo de dos dispositivos), cuya unica verificacion real es un smoke humano en navegador, y el dia del
arranque no habia forma de correrlo. **El desbloqueo, que es lo urgente, ya esta hecho y verificado contra
base real.** Esto es lo que sigue.

**Cuando exista, hay una linea que volver a poner:** `frenaEvaluaciones: true` en el motivo
`menor_sin_representante` de `modules/consent/regularizacion`. Su candado lo dice y falla cuando se toque, que
es lo que impide que la exclusion que pide el dictamen se quede en nada para siempre.

## 4h · DECIDIDO POR CONTABILIDAD · El descuento comercial (la (b) de la venta de admin)

**Textual (2026-10-15):** *"es DESCUENTO COMERCIAL, no precio especial."* La especificacion completa, para
construirla despues del arranque:

- la linea **conserva el PVP sellado** desde el catalogo, como hoy;
- se agrega un **descuento por linea** (valor o %), aplicado **sobre la base SIN IVA**, y el **IVA se calcula
  sobre la base ya descontada**;
- en Alegra va como **descuento en la linea** del item, **no** como precio modificado;
- **motivo obligatorio, de lista cerrada:** `venta_institucional`, `colaborador_socio`, `proximo_vencer`,
  `cortesia_comercial`, `otro` (con texto libre obligatorio);
- **tope: no se permite el 100%.** *"Un producto sin cobro no es una venta, es un retiro de inventario y va
  por otra via"* (fuera de alcance por ahora);
- **se persiste:** `pvp_catalogo`, `descuento_valor`, `descuento_motivo`, `descuento_aplicado_por`;
- y el **tablero de Direccion** suma descuentos **por motivo y por periodo**.

**Y aceptan (a) y (c) y el no crear un "profesional CNV"**, que era la alternativa que yo recomendaba evitar.

**UNA NOTA SOBRE EL IVA, para que no se pierda:** hoy `armarFactura` manda la **base unitaria sin IVA**
(`baseFromTotal`) y deja que Alegra aplique el impuesto. Un descuento sobre esa base encaja sin tocar esa
aritmetica, pero **el cotejo contra lo cobrado** (`desgloseDeLaVenta`) tiene que descontar igual, o la venta y
la factura diran cifras distintas del mismo acto. Es el punto donde este cambio puede salir mal en silencio.

## 4i · Y LA PIEZA DE "YA FACTURADA POR FUERA" SIRVE PARA DOS CASOS, NO UNO

Contabilidad lo añade el 2026-10-15: *"las ventas que ya se hicieron desde la central se facturan a mano en
Alegra. Atlas necesita poder registrarlas como ya facturadas, igual que las rezagadas, para que no se emitan
dos veces."*

O sea que la misma pieza cubre **la rezagada que cruza de bimestre** y **la venta ya facturada a mano**. Eso la
hace mas facil de justificar y no cambia su tamaño: sigue siendo la superficie donde admin teclea el numero de
la factura y la fecha, con **motivo obligatorio**, porque es una afirmacion sobre un documento fiscal que Atlas
no emitio y que nadie mas puede verificar.

## 4j · CORREGIDO EL 2026-10-15 · EL SMOKE VA CON GENTE REAL, Y SE MARCA AL FINAL

**Decision de Santiago, y cambia la recomendacion que tenia esta seccion:** el smoke se hace con
**profesionales y pacientes reales**, y se marca como prueba **al terminar**. *"Es lo que necesita para probar
de verdad."* Lo que decia antes (hacerlo todo con pacientes de prueba) queda abajo, porque sigue siendo cierto
como alternativa y explica el mecanismo.

**Lo primero, que es lo que hace esto viable: lo que vuelve real una venta NO es la fecha.** Son dos filtros
distintos y trabajan por separado:

- **`cuenta_como_de_prueba`**, la marca por venta, con cuatro entradas (profesional, paciente, producto, y la
  marca a mano). La escribe un **trigger** en el momento del insert, y la **recalcula** cada vez que una de
  las cuatro entradas cambia, hacia atras. No sabe que existe el 15.
- **`fecha_de_arranque`**, la frontera de periodo, que usan la vista `ventas_reales` y las cifras de periodo.

Por eso marcar al final funciona: cuando marques la venta (o el perfil), el trigger recalcula y esa venta sale
de todas las cifras **sin que nadie vuelva a correr nada**.

### Las tres cosas que hay que saber antes de empezar

**1 · EL DINERO SE LIMPIA AL FINAL, Y HOY ES SEGURO.** La marca a mano exige admin y un motivo de 10
caracteres, deja su fila de auditoria, y **una venta marcada no se factura en ningun ambiente** (*"un
documento fiscal afirmaria un acto que ya se declaro que no ocurrio"*). Hoy Alegra esta en sandbox, asi que
nada se emite mientras pruebas. El dia que eso cambie, cambia todo: ver la seccion **4l**.

**2 · EL INVENTARIO NO SE LIMPIA SOLO, Y ESA ES LA PARTE QUE CUESTA.** Con cuentas reales el desplegable solo
ofrece **productos reales** (`catalogo-prescribible`: lo de prueba se ofrece unicamente a una cuenta marcada
`is_test`, verificado en el codigo). O sea que **cada venta del smoke saca unidades reales** de una vitrina
real o de la central, y marcar la venta despues **no devuelve la unidad**.

Dos salidas, y la primera prueba mas sistema:

- **La limpia:** despues de cada venta, registra la **devolucion del paciente** desde la fila de la venta, y
  en "Devueltas pendientes de verificacion" pulsa **"volver al lote"** eligiendo la ubicacion de donde salio.
  La unidad regresa y de paso queda probado el circuito completo de devolucion.
- **La aceptable:** hazlo con **1 unidad** por prueba y dejala ir. Cuando cuentes en la oficina, la
  conciliacion cuadra la diferencia, que es justo para lo que existe. Apunta cuantas fueron.

**3 · EL ORDEN DE LAS LLAVES ES UNA REGLA, NO UNA RECOMENDACION.** Seccion **4l**: las credenciales de
produccion no se montan hasta que el smoke termine y todo lo de prueba este marcado. Y ahora hay algo que lo
verifica, no solo un parrafo.

### La alternativa, que sigue siendo valida (la recomendacion anterior)

Hay **25 pacientes de prueba**. Una venta a uno de ellos nace marcada sola, al instante, y no requiere
limpieza posterior ni expone a nada. Lo que no te da es probar con la gente de verdad, que es lo que pediste.

Si quieres saldo en una vitrina de prueba: **admin hace una remesa** al profesional de prueba y **el confirma**
en *Mi inventario*. La remesa **no descuenta de la central** (hueco conocido, seccion 2), asi que la central
no se mueve ni una unidad.

### Lo que NO hace falta, en ningun caso

- Volver a correr el script de arranque. No se puede y no hace falta: el trigger recalcula solo.
- Mover `fecha_de_arranque`. Es la frontera del periodo y moverla para probar seria mentir sobre el periodo.

---

## 4k · RESPONDIDO, Y LA RECOMENDACION ES NO HACERLO · Poner las vitrinas en cero

Tu idea: *"poner en saldo a 0 a todos los profesionales, ya que hicimos algunos cambios: algunos devolvieron y
otros recibieron mas. La idea es que solo se quede el saldo de la bodega y se vaya descontando a medida que
admin vaya haciendole remesas."* Y tu propia duda: *"para descontarse efectivamente ellos tendrian que aceptar
la remesa, correcto?"*

### Tu duda es correcta, y hay una segunda que no habiamos visto

**SI: la remesa no entra al saldo hasta que el Integrante la confirma.** La declara admin, se guarda dirigida
a la ubicacion del Integrante y el trigger del saldo **la excluye**; lo que suma es la **recepcion** que
escribe el Integrante desde *Mi inventario*. Verificado en `remesa-service.ts`.

**Y LA SEGUNDA, QUE TUMBA EL PLAN: la remesa tampoco DESCUENTA de la bodega central.** Ni al declararla ni al
confirmarla. Hoy la central solo baja por dos vias: una **venta marcada "sale de la bodega"** (un domicilio) o
una **baja**. O sea que *"que la bodega se vaya descontando a medida que admin hace remesas"* **no es lo que
pasa hoy**: es el hueco conocido de la **seccion 2** de este documento, decidido y pospuesto. Poner las
vitrinas en cero no lo arregla; solo lo deja mas visible.

### Lo que implica, con las cifras de la nube de hoy

| | |
|---|---|
| Vitrinas con producto real | **7** (Angela 75, Camilo 70, Diana 60, Katherine 96, Maria Camila 74, Roberto 75, Valentina 75) |
| Unidades reales en vitrinas | **525** |
| Unidades reales en la central | **1.279** |
| Lineas (producto + lote) que habria que reponer | **33** |

Ponerlas en cero y volver a mandarlas son, en el mejor de los casos, **33 remesas declaradas por admin y 33
confirmaciones de siete personas distintas**, para acabar con las mismas 1.804 unidades donde ya estan. Con el
agravante de que la central **no se habria movido**, asi que el total subiria si alguien repone creyendo que
descuenta.

### Tus cuatro preguntas, una por una

**¿Cuanto tarda una confirmacion en la practica?** Medido, no estimado: de las **14 remesas** que existen en la
nube, **las 14 estan confirmadas**. Trece se confirmaron **en menos de una hora**; una tardo **90 horas** (casi
cuatro dias). Esa ultima es la que importa: con la vitrina en cero, ese Integrante habria estado **cuatro dias
sin poder vender**.

**¿Que ve un Integrante con la vitrina en cero mientras no confirma?** En *Mi inventario*, cero, y arriba la
**remesa pendiente** (es asi como se entera; no hay aviso aparte). **Puede atender con normalidad**: la
consulta, la evaluacion y la prescripcion no dependen del saldo, solo del consentimiento. Lo que **no puede es
registrar una venta**: el reservador lanza `InventarioDeVentaError` y la venta no se completa.

**¿Puede admin confirmar por el?** **No, y ese camino no existe.** Es deliberado (`can-declarar-remesa.ts`:
*"El integrante NO declara, el recibe"*), y la confirmacion resuelve el perfil del **usuario que la escribe**.
La razon de fondo es la asimetria que protege el saldo: si el Integrante reporta **menos** de lo declarado se
le cree a el, y si reporta **mas**, el excedente no infla el saldo. Admin confirmando por otro afirmaria que
alguien recibio algo que no ha visto, que es justo lo que esa asimetria evita. **Se podria construir** como
camino excepcional con auditoria, pero con 13 de 14 confirmaciones en menos de una hora, no hay caso que lo
pida.

**¿Queda legible en el historial que las unidades si estaban en el consultorio?** El movimiento de
`conciliacion` guarda su motivo y se ve en el historial de la ubicacion, asi que **si**. Pero ese motivo
tendria que decir que hubo un conteo, **y no lo hubo**. Es tu propia objecion del 15 (*"el que trae dice
'ajuste al conteo fisico' y no hubo conteo"*), y aqui aplica igual.

### LA RECOMENDACION: dejar los saldos como estan

Sale caro (66 operaciones y siete personas), no consigue lo que buscas (la central no se descuenta) y escribe
en el historial un ajuste sin conteo detras. **Lo que si resuelve el problema real** (*"algunos devolvieron y
otros recibieron mas"*) es lo que ya tenias previsto: **contar en la oficina y cuadrar contra el conteo**, con
`CONCILIAR_EL_INVENTARIO_AL_ARRANQUE`, que para eso esta escrito y es correcto cuando las cifras salen de un
conteo real.

Y si de verdad quieres el modelo de *"la bodega se descuenta con cada remesa"*, eso **no es una operacion, es
un cambio**: que la remesa descuente de la central al declararse (o al confirmarse). Esta en la seccion 2 y se
decidio posponerlo. Dimensionarlo es otra conversacion, pero no se resuelve poniendo saldos en cero.

---

## 4l · LA REGLA DE LAS LLAVES, Y LO QUE QUEDA PARA EL CIERRE DEL SMOKE

> ## ⚠ EL ORDEN DE LAS LLAVES, EN UNA FRASE
>
> **Las llaves de produccion se montan DESPUES de que el smoke termine y todo lo de prueba este marcado, y
> ANTES de la primera venta real de un Integrante.** Las dos mitades son limites, no recomendaciones, y cada
> una tiene su guardian construido.

**Confirmado por Santiago el 2026-10-15**, y el segundo limite lo fijo el mismo dia: *"No es 'despues del
smoke'. Es DESPUES DEL SMOKE Y ANTES DE LA PRIMERA VENTA REAL DE KATHERINE. Si ella vende manana en efectivo
con Alegra en sandbox, esa venta no se factura nunca."*

### POR QUE LA PRIMERA MITAD (no antes de terminar el smoke)

La marca a mano frena la factura, pero solo si llega **antes que la cola**. En el instante en que
`alegra_config` tiene su fila de produccion y Vercel apunta a la URL de produccion, **todo lo que estaba
esperando se emite con numeracion de la DIAN**. Una venta hecha DESPUES de montar las llaves, sobre un
paciente real, marcada cinco minutos tarde, ya no se arregla con una marca: se arregla con una **nota
credito** que tiene que hacer una persona.

> **Precision sobre esto, del 2026-10-15:** ese riesgo vale para las ventas creadas **despues** de montar la
> llave de Wompi. Las de hoy estan protegidas dos veces (la marca **y** el sello del ambiente, que las deja
> como pago de prueba). O sea que el peligro real es **seguir probando despues** de montar las llaves, no
> antes.

**Su guardian:** `scripts/config-alegra-produccion.sql` (el unico sitio por el que se pasa obligatoriamente
para montar las llaves) hace, **antes de escribir nada**:

1. **lista las ventas que la cola emitiria** en cuanto eso quede (fecha, monto, medio, Integrante y productos;
   sin datos del paciente, porque esa salida se pega en un chat);
2. y **ABORTA** mientras su bandeja `ventas_pendientes_revisadas` diga `<REVISAR>`.

La condicion es la de la cola **copiada letra por letra** (`LE_FALTA_ALGO`, `FACTURABLE`,
`LA_FACTURA_ES_DE_CNV`, la marca a mano y el tope de intentos), y el candado
`las-llaves-no-entran-con-ventas-sin-revisar.test.ts` compara los textos: si la cola cambia, se pone rojo
nombrando el script. Una condicion *parecida* seria peor que ninguna, porque diria que no hay nada que
facturar mientras la cola emite otra cosa.

**PARA VER LA LISTA HOY, SIN MONTAR NADA:** correr ese mismo script en **ensayo** (sin `--commit`) con los
`<LLENAR>` como estan. La lista se imprime antes de que se revise cualquier otra cosa. Eso es la *"lista de
ventas reales anteriores a hoy que nadie marco"* que pediste.

### POR QUE LA SEGUNDA MITAD (no despues de la primera venta real)

`wompi_env` se sella **al CREAR** la venta, y una venta sellada como prueba **no se factura nunca** en
produccion, ni cuando se monten las llaves. Vale para efectivo y transferencia tambien. El detalle y la
medicion estan en la **seccion 7**.

**Su guardian, construido el 2026-10-15:** un **aviso en /pagos**, que es tu peticion textual (*"¿Hay forma
de que Atlas AVISE si se registra una venta real mientras el ambiente esta en sandbox? Porque la ventana entre
que yo cierre el smoke y monte las llaves es justo cuando Katherine podria vender, y nadie estaria
mirando."*).

- **Mientras el ambiente este en pruebas**, la pantalla lo dice arriba: *"El sistema está en modo de pruebas.
  Una venta que se registre ahora queda marcada como pago de prueba y no se podrá facturar después..."*, con
  la nota de que aplica a efectivo y transferencia.
- **Lo ve todo el que puede cobrar**, no solo admin: el aviso sirve en la pantalla donde se crea la venta, y
  Katherine cobra desde ahi.
- **Y lleva la cifra** para quien ve los paneles: cuantas ventas de pacientes reales ya quedaron en ese
  estado. Hoy son **cero**.
- **Cuando las llaves ya esten puestas**, el aviso desaparece solo; y si quedo alguna venta atrapada, cambia
  de texto y dice la salida (registrarla como venta ya cobrada, o marcarla como prueba).

**ES UN AVISO, NO UN FRENO, y es deliberado:** frenar la venta dejaria a un Integrante sin poder cobrarle a un
paciente que tiene al frente, por una configuracion que el no puede cambiar. El sistema ya se equivoca hacia
el lado seguro (no factura); lo que faltaba era decirlo. La cifra sale de **los mismos tres predicados** de la
cola que usa el guard del script, asi que las dos superficies no pueden contar universos distintos. Candado:
`el-sello-del-ambiente-se-avisa-en-pagos-db.test.ts`.

### LO QUE HAY QUE HACER AL CERRAR EL SMOKE, EN ORDEN

1. **Marcar a mano las ventas del smoke** en /pagos (admin, motivo de 10 caracteres). Es lo que las saca de
   todas las cifras y lo que impide que se facturen.
2. **Marcar los dos perfiles como de prueba** en /admin: `Profesional Prueba` y `Profesional demo 2`. Hoy
   cuentan como **reales** a pesar del nombre, y con ellos se hizo el smoke. El trigger recalcula sus ventas
   **hacia atras**, asi que esto limpia de una vez lo que haya quedado suelto. (Santiago: *"con ellos hago el
   smoke, se marcan al final"*.)
3. **Correr el script de las llaves en ensayo** y revisar la lista. Lo que fue del smoke se marca; lo que es
   real se deja, y entonces su factura es correcta y tiene que salir.
4. **Decidir ADAPTO-STRESS** (abajo).
5. Y solo entonces: Vercel, `leer-alegra.mjs`, `config-alegra-produccion.sql` con la bandeja en `si`, y la
   cuenta puente de **transferencias**, que falta en los dos ambientes.
6. **Abrir /pagos y confirmar que el aviso amarillo del modo de pruebas DESAPARECIO.** Es la comprobacion de
   que las dos llaves quedaron puestas: si sigue ahi, la de Wompi no entro, y toda venta que se registre
   seguira naciendo sellada como prueba. Las dos van juntas, ademas: con Wompi en produccion y Alegra en
   sandbox, las ventas nacen reales y no se pueden facturar en ningun lado hasta que Alegra tambien pase.

### ⚠ PENDIENTE AL CERRAR EL SMOKE · ADAPTO-STRESS a cero (el camino, confirmado el 2026-10-15)

**Santiago hace el smoke CON el** (paciente real, Integrante real, producto real) **y al terminar lo deja en
cero**, *"ya que dicho producto todavia ni existe"*. Su lectura era que no hace falta un script: se pone en
`no_disponible` y las unidades se bajan por conciliacion. **Es correcta, y no hace falta escribir nada nuevo.**

**El estado medido en la nube (2026-10-15, despues de que diera de baja las dos de cuarentena):**

| Ubicacion | Lote | Unidades |
|---|---|---|
| Profesional Prueba | `SMOKE (FINAL)` | 6 |
| Profesional demo 2 | `Lote 001` | 9 |
| Profesional Demo | `LOTE SMOKE ADPTS` | 1 |
| **Total** | | **16** |

**Cuarentena quedo en cero** (las 2 unidades se dieron de baja a las 18:30 con sus motivos). Y las tres
ubicaciones son **cuentas de smoke**, no Integrantes reales: ningun Integrante real tiene ADAPTO-STRESS.

#### "Dar de baja" y "conciliar" NO son lo mismo, y aqui importa cual

- **`baja`** dice *"la unidad existia y se perdio o se destruyo"*. Es el boton del panel de devueltas, y
  **solo alcanza a las unidades en CUARENTENA**: ese panel lee esa ubicacion y ninguna otra. Es lo que uso
  para las 2, y era el camino correcto para ellas.
- **`conciliacion`** dice *"el saldo estaba mal y lo que hay es esto"*. No afirma que nada se destruyera, que
  es exactamente el caso de estas 16: **nunca existieron fisicamente**, salieron de pruebas.

Usar `baja` para las 16 afirmaria que CNV destruyo 16 frascos que nunca tuvo. Por eso van por conciliacion.

#### Los tres pasos, en este orden

**1 · El smoke primero.** Si se pone `no_disponible` antes, la venta del smoke **falla**: la disponibilidad se
comprueba en el servicio donde se decide la venta (`payments-service.ts`), no solo en la pantalla, y responde
*"no esta disponible para la venta"*.

**2 · `no_disponible` desde la pantalla**, en /nutraceuticos, editando el producto. No hace falta script.
Eso cierra las dos puertas de venta (el cobro y la remesa de admin, que solo ofrece `en_consultorio`).
**Lo que NO hace es esconderlo del catalogo de prescripcion:** un producto real "aun no disponible" se sigue
mostrando con su rotulo, a proposito (cotejo 2026-08-24: el profesional debe saber que el modelo lo
contempla).

**3 · `CONCILIAR_EL_INVENTARIO_AL_ARRANQUE_2026-10-15.sql`**, con la bandera
`llevar_a_cero_lo_no_listado` en **`false`** (como viene, asi no toca ninguna otra linea), el motivo cambiado
y el bloque (2) con estas tres lineas, que son las de hoy:

```sql
insert into _conteo values
  ('Profesional Prueba', 'ADAPTO-STRESS', 'SMOKE (FINAL)',    0),
  ('Profesional demo 2', 'ADAPTO-STRESS', 'Lote 001',         0),
  ('Profesional Demo',   'ADAPTO-STRESS', 'LOTE SMOKE ADPTS', 0);
```

Y el motivo del bloque (0), que el que trae habla de un conteo fisico que aqui no hubo:

```sql
'Cierre del smoke 2026-10-15: unidades de prueba de un producto que CNV no tiene en bodega'
```

**Ensayo primero** (sin `--commit`): el bloque (1) imprime el saldo de hoy y el (3) las diferencias, asi que
se ve exactamente lo que va a escribir antes de escribirlo. Si alguna de las tres cantidades cambio durante
el smoke, el ensayo lo muestra y basta con volver a copiar los nombres de la salida del bloque (1).

### ✅ CONFIRMADO · El producto de prueba NO hace falta limpiarlo

Santiago: *"el producto SMOKE no se limpia: es de prueba, se supone que solo aparece a las cuentas de
prueba."* **Es cierto, verificado en el codigo** (`catalogo-prescribible.ts`): al prescribir y al cobrar, una
cuenta **real** ve `is_test = false` y nada mas; los productos de prueba se ofrecen **solo** a una cuenta
marcada `is_test`. Hay **60 unidades** de `PRUEBA SMOKE BLOQUE 3` y sus variantes retiradas en la central, y
no estorban: ninguna cifra de dinero las cuenta y ninguna pantalla de venta las ofrece.

Dos matices, por si aparecen:

- **El inventario SI las muestra**, y es deliberado: esa pantalla existe para **contar**, y esconder unidades
  la haria contradecir el conteo fisico.
- **La remesa de admin tambien las ofrece**, marcadas y al final de la lista, para poder recargar una vitrina
  de prueba. Mandarselas por error a un Integrante real no le permite venderlas (el catalogo se lo impide),
  pero le ensucia el conteo.

---

## 5 · NO SE CONSTRUYO, Y SIGUE SIN CONSTRUIRSE

- **El cargo por un vencido a cargo del Integrante.** La alerta llega hasta la **propuesta** de quien asume.
  El cargo se cobra "al precio de facturacion", que es la cifra que esta en consulta
  (`DECISION_PRECIO_DEL_FALTANTE_2026-09-29.md`). Construirlo antes de esa decision seria construirlo dos
  veces.
- **La emision de la cuenta de Distribucion en Alegra.** La cuenta se arma, se objeta y se cobra en Atlas;
  emitir el documento fiscal necesita la configuracion de produccion, que esta en el checklist de arranque.
- **Desbloquear la venta bajo Distribucion.** El mecanismo del recaudo ya existe, asi que es una decision, no
  una falta de construccion. Hoy queda dentro del punto 3.

## 7 · ¿FALTA ALGO POR CONSTRUIR PARA ARRANCAR? · La lista, al 2026-10-15

Pregunta de Santiago: *"¿no queda faltando nada mas por construir, verdad? solo hacer smoke."*

**Para el smoke: nada.** Todo lo que las pruebas I, F, G, H y A a E recorren esta construido y con candados.

**Para que la operacion arranque de verdad hay UNA cosa, y no es una funcion que falte: son las llaves.** Y
tiene un filo que no habiamos nombrado.

### ⚠ LO QUE NADIE HABIA DICHO: una venta hecha ANTES de las llaves no se puede facturar DESPUES

`wompi_env` se sella en el momento de crear la venta, derivado de la llave publica de Wompi
(`pub_prod_` = produccion, cualquier otra cosa = `test`), **y vale para TODOS los medios de pago**: efectivo y
transferencia tambien. Medido: las 55 ventas de la nube son `wompi_env = test`, incluidas las 24 de efectivo.

Y la regla de ambiente (`motivoSiLaVentaNoEsDeEsteAmbiente`) dice: *"Es un pago de PRUEBA y Alegra esta en
produccion. No se emite: seria una factura fiscal por un pago que no movio dinero."* **No hay excepcion ni
boton de administrador.**

**La consecuencia practica:** si Katherine vende manana en efectivo, con las llaves todavia en sandbox, esa
venta **real** queda sellada como pago de prueba y **Atlas no la va a facturar nunca**, ni cuando se monten las
llaves. Se queda visible y quieta en "Ventas cobradas sin cerrar en contabilidad", con su motivo.

**El sistema se equivoca hacia el lado bueno** (prefiere no facturar a facturar un pago de juguete), y por eso
no es un defecto. Pero fija el orden de verdad:

> **Las llaves no van "despues del smoke": van ANTES de la primera venta real.** Entre el cierre del smoke y
> la primera venta de un Integrante no deberia haber ninguna venta registrada.

**La salida si pasa** (o para las ventas que CNV ya hizo a mano desde la central): registrarlas como **venta
retroactiva**, que es la via que ya existe para "esto se facturo por fuera". Pide el numero de la factura de
Alegra y la base lo exige (`tx_retroactiva_completa`: pagada, con numero y marcada emitida), y Atlas no
vuelve a facturarla. **Lo que NO existe** es convertir en "ya facturada" una venta **ya registrada** por el
camino normal: eso es la pieza de la seccion 1, y este caso es una razon mas para construirla.

### CONSTRUIDO EL 2026-10-15, DESPUES DE ESCRIBIR ESTA LISTA

Dos piezas que estaban aqui ya no estan pendientes:

- **El aviso del ambiente en /pagos.** Mientras las llaves esten en pruebas, la pantalla lo dice donde se
  crea la venta, y lleva la cuenta de las ventas reales que ya quedaron selladas como pago de prueba. Es el
  guardian de la segunda mitad de la regla de las llaves (**4l**).
- **La central no despacha lo que no tiene.** La mitad barata de la seccion 2: la remesa se rechaza si la
  bodega no tiene esas unidades, y el disponible se muestra junto al formulario. El transito sigue pospuesto.

**Y DEL PUNTO DE LAS LLAVES NO QUEDA NADA MAS POR CONSTRUIR.** Lo que falta de ahi no es codigo: las
credenciales de Alegra y Wompi, y la **cuenta puente de transferencias**, que falta en los dos ambientes. La
unica pieza de codigo emparentada es la numero 2 de la tabla ("ya facturada por fuera"), que es la salida si
alguna venta real alcanza a quedar sellada como prueba; hoy esa cuenta esta en cero, asi que no corre prisa.

### Lo que falta construir, por orden de urgencia

| | Que | Cuando |
|---|---|---|
| 1 | **El traslado automatico de rezagadas** (seccion 1) | **antes del 1 de noviembre**, por decision de contabilidad |
| 2 | **"Ya facturada por fuera"** sobre una venta ya registrada (seccion 1) | antes de la primera rezagada de otro bimestre, y es la salida del filo del sello |
| 3 | **El descuento comercial** con la especificacion de contabilidad (4h) | despues del arranque |
| 4 | **Repetir el consentimiento de un paciente que ya existe** (4g), y volver `frenaEvaluaciones` a `true` | no frena a nadie hoy; antes de que la lista de pendientes crezca |
| 5 | **El "Facturar ahora" del bimestre distinto** (seccion 1) | pospuesto, pide una decision de contabilidad primero |
| 6 | **Que la remesa MUEVA el saldo**, con la ubicacion de transito, y el escritor que falta para **registrar unidades en central** y **devolver a central** lo que nadie confirmo (seccion 2) | el modulo de inventario, pospuesto otra vez el 15. La mitad barata ya esta |
| 7 | **Paso 2 de la unificacion** del bloque de venta (3b) | despues, y con la decision de donde sale el dato de existencias |
| 8 | **La venta de admin sin profesional** (4f) y **la emision el ultimo dia del mes** (1b) | dimensionadas, esperan decision |

### Y lo que falta que NO es codigo (y de esto depende mas que de lo anterior)

- **Las llaves de Alegra y Wompi**, con la cuenta puente de **transferencias**, que falta en los dos
  ambientes. Es el gate real del arranque.
- **Los datos fiscales y bancarios de los Integrantes.** Medido hoy: de los trece perfiles reales,
  **ninguno** tiene los datos tributarios completos ni cuenta bancaria registrada (el unico completo es
  `Profesional Prueba`, que es una cuenta de smoke). **No frena atender ni vender:** nada en el codigo lo
  exige para una venta de Comision. Frena **pagarles** la comision del primer corte, y el RUT lo tiene que
  verificar CNV, asi que no se resuelve la noche anterior.
- **`tax_is_withholding_agent`** esta sin definir en los trece. Solo se lee al generar una cuenta de
  **Distribucion**, y hoy ningun Integrante real la tiene habilitada, asi que no afecta al primer corte de
  Comision. El dia que se habilite, hay que definirlo antes o la retencion saldra mal.

### ¿Falta algo para que KATHERINE pueda empezar? NO, en codigo

Medido en la nube: `Katherine Ruiz Velez`, nutricionista, **no** marcada de prueba, con su ubicacion de
inventario **activa y vendible** y **96 unidades** en vitrina (24 de MULTI-CELL, OMEGA, CURCUMIN y D3-K2),
sin remesas pendientes de confirmar y con comision del 20 %.

Puede **atender, evaluar, prescribir y registrar ventas** hoy mismo. Las dos salvedades son las de arriba y
ninguna es de codigo: **que sus ventas no se facturan hasta que esten las llaves** (y si las hace antes, no se
facturaran nunca por el sello del ambiente), y **que para pagarle la comision del primer corte hace falta su
informacion fiscal y bancaria**.

---

## 6 · SE PULE CON LA OPERACION, NO CON UN SMOKE

Santiago lo dijo de dos pantallas, y es una decision de ritmo, no un pendiente tecnico:

- **La pantalla de insights** (parte 15): *"la vamos puliendo poco a poco a medida que avance la operacion."*
- **El total de inventario y sus rotulos** (R15): *"esto lo vamos revisando poco a poco si sirve así o lo
  cambiamos."*
