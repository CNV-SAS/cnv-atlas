// Version interna del motor clinico. En B11 se porto el motor REAL de Gildardo (ciencia
// congelada verbatim + adaptador), reemplazando el stub, con golden tests que prueban
// paridad con ATLAS_v7.html (regla 6). Ya no lleva el prefijo "stub-": las salidas son
// clinicas. Todo registro clinico persiste este valor en engine_version (regla 7).
//
// HISTORIA DE VERSION (el numero es un contador; su significado vive aqui, asociado al codigo):
//  · 1.0.0: port inicial del motor real (B11), paridad con ATLAS_v7.html.
//  · 1.1.0 (2026-08-19): RE-PORT contra ATLAS_v8.html del 18 (swap de Gildardo). Cambia salidas del
//    motor: cPABU direccional (Q27, era 8 situaciones con rojo), cMMEM unificado EWGSOP2 (dormant),
//    banda cFMI "Alto SS" femenina, y PABU al Dominio 1 del DFI. Los diagnosticos sellados con 1.0.0
//    quedan con esa version (inmutabilidad, regla 7); un seguimiento que cruza 1.0.0 -> 1.1.0 lo avisa.
//    INCLUYE (mismo dia, aprobado por Gildardo el 19, RESPUESTA §1) el residuo del gate de sarcopenia:
//    el _smmwLow del DFI (engine.dfi, alimenta obSarc -> Dominio 2) baja mujer 24 -> 22, junto con el
//    gate del fenotipo (protocolo-fenotipo, que sube PROTOCOL a 2026-08-19b). Se folda en 1.1.0 porque
//    aun no hay despliegue: 1.1.0 = el re-port completo a la ciencia del 19 (18 + los tres residuos).
//  · 1.2.0 (2026-08-31): LA DINAMOMETRIA ENTRA AL MOTOR (Gildardo 2026-08-30 §6). Hasta aqui la fuerza
//    prensil se capturaba y no llegaba a `classifyFenotipo`, asi que `dxSarcopenia` devolvia "Ingrese
//    fuerza prensil" SIEMPRE, incluso con el dato registrado, y el disyunto `sarcoDx.k >= 2` nunca se
//    activaba. CAMBIA SALIDAS para todo paciente con la fuerza registrada: `sarcopenia` y
//    `obesidadSarcopenica` pueden voltear, y con ellas `structL`, la severidad del Dominio 2 del DFI, el
//    riesgo integrado y las rutas. Por eso sube la version y NO se folda: los diagnosticos sellados con
//    1.1.0 quedan marcados como emitidos con ciencia anterior, que es lo que hace que la comparacion de
//    bandas del §12b pueda dispararse y proponer la reemision donde corresponda.
//    Incluye tambien CA-6/CA-7 (el dominio sin dato no puntua; el adaptador deja de clasificar ceros
//    fabricados), que cambian severidades y el riesgo integrado por la misma via.
//  · 1.3.0 (2026-09-05): SE ENCIENDE EL LE8 (`LE8_MAPEO_CORREGIDO`, CA-8a/CA-8b). Instruccion de
//    Direccion Cientifica del 5 de septiembre, decision suya del 2: "el ICEC se activa tal cual se
//    envio". Hasta aqui DOS de los ocho dominios del LE8 leian campos que solo existen en el objeto DEMO
//    de su prototipo (d1_9/d1_10 y d1_16), asi que corrian CLAVADOS para todo paciente real:
//    Alimentacion en 30 e Hidratacion en 20, midiera lo que midiera la persona. Ahora Alimentacion sale
//    de `calcPatron` sobre los quince grupos de frecuencia e Hidratacion de `d7_agua`.
//    LAS CIFRAS QUE SE MUEVEN, y por eso NO se folda: el ICEC, y con el la EB-BIS, el IAE, los dominios
//    3 y 5 del DFI con su severidad, el riesgo integrado y las rutas R4/R5. Medido antes de aplicarlo
//    sobre la base local, aislando el efecto del interruptor: en los pacientes cuyos dos dominios se
//    apartan de las constantes viejas, la EB-BIS BAJA entre 0,6 y 5,4 anos (media 1,46), siempre hacia
//    abajo, dentro del rango que el anuncio ("entre 1 y 8"). Ver PLAN_LE8_ENCENDIDO.md §3.
//    Y SUBE PARA QUE LA COMPARACION DE BANDAS DE SU §12b PUEDA DISPARARSE: sin desfase de version,
//    `veredictoDeReemision` no corre y el cambio pasaria invisible en los diagnosticos ya emitidos.
//    Incluye la migracion 0100: los quince grupos y `d7_agua` pasan a `used_in_diagnosis = true`, porque
//    dejaron de ser display/tratamiento y son insumo del diagnostico. Sin eso, `dfi.complete` diria que
//    los insumos estan completos sobre respuestas que el paciente no dio.
//  · 1.3.1 (2026-09-05): PATCH, sin ciencia. El chip del PABU del Dominio 1 del DFI decia la
//    desviacion de φ CON SIGNO, y la fila ICA-BIS de la tabla la dice en MAGNITUD: la misma pantalla
//    con dos signos para el mismo concepto. La causa era una omision nuestra, no su matematica:
//    `computeDFIFromData` hace `num("ICA_BIS","icaBis") || (pabu - 1.618)` y la fila que le pasabamos
//    no traia el campo, asi que caia a la reserva con signo. Su aplicacion si lo llena (con el valor
//    absoluto) y por eso su pantalla dice "+0,42" donde la nuestra decia "-0,42".
//    SE LE ENTREGA EL INSUMO, no se le cambia la formula, y es el MISMO valor que el motor ya sella
//    (|PABU - phi|, ATLAS_v7 L5721), coherente con la referencia de la fila ("0.00-0.15 Zona φ", un
//    rango que empieza en cero solo tiene sentido para una magnitud) y con su cPABU (`Math.abs(raw)`).
//    QUE SE MUEVE: un TEXTO sellado en `dfi.domains[0].items`, solo en pacientes por DEBAJO de φ.
//    NINGUNA cifra, severidad, riesgo integrado ni ruta: `icaBis` se usa en UN sitio del DFI, ese
//    texto (engine.dfi.js:146). Por eso es patch y no minor. El golden no lo vio porque su donante
//    tiene PABU 1,9925, por encima de φ, donde los dos calculos coinciden; el candado nuevo
//    (`ica-bis-signo-del-chip.test.ts`) cubre justo el caso que al golden le falta.
//  · 1.4.0 (2026-09-06): MINOR. LA GUARDA DEL LE8 PASA DE SEIS INSUMOS A OCHO, que es lo que su propia
//    nota pedia y nadie hizo. El texto decia: "si algun dia se activa el mapeo, calcLE8 pasa a leer
//    d1_N_i (calcPatron) y d7_agua: esta lista debe revisarse ahi". El mapeo se activo con 1.3.0 y la
//    lista se quedo en seis, asi que el motor leia ocho campos y la guarda exigia seis.
//    LO QUE HACIA CON LOS DOS QUE NO EXIGIA: sin `d7_agua`, hidratacion puntuaba CERO (el peor valor
//    posible: un paciente que no contesto quedaba registrado como uno que no bebe agua); sin la matriz
//    de frecuencia, alimentacion caia a la base de 10, y con la matriz a medias bajaba en silencio
//    proporcional a cuantos grupos faltaran. Un dato ausente entrando al calculo como una respuesta,
//    que es justo lo que la guarda de 2026-08-13 vino a impedir para los otros seis.
//    QUE EXIGE AHORA: los seis de siempre, mas `d7_agua` y la matriz `d1_1_i..d1_15_i` COMPLETA (entera
//    y no en parte: `calcPatron` suma y resta por grupo, asi que un grupo ausente no da error, baja el
//    score). Y frena el LE8 ENTERO, no el dominio: el total es un compuesto y emitirlo con un dominio
//    en su default sesgaria el ICEC y con el la EB-BIS.
//    POR QUE MINOR Y NO PATCH: no se mueve ninguna cifra de lo ya emitido (medido abajo), pero cambia
//    lo que el motor PUEDE devolver: ahora se niega a emitir donde antes contestaba. Eso es
//    comportamiento sellado, no un texto.
//    MEDIDO ANTES DE APLICARLO, sobre la nube en solo lectura: de 120 respuestas, ONCE pasan los seis
//    de hoy y LAS ONCE pasan tambien los ocho. CERO evaluaciones cambian de comportamiento. El gate de
//    completitud de la encuesta es lo que lo hace improbable; la guarda cierra el hueco que se abriria
//    el dia que alguien conteste los seis y se salte el agua.
//    Y AL REGENERAR se corrigieron solos los TRES comentarios que describian el interruptor como
//    apagado: viven dentro del `newSlice`, asi que se rehacen cuando cambia el codigo que corre. Antes
//    no se tocaron a proposito, porque moverlos solos habria cambiado el SHA sin cambiar una cifra.
// ═══ 1.0.0: LA PRIMERA VERSION OFICIAL (2026-09-09) ═══
//
// QUE ES ESTE CAMBIO Y QUE NO ES. Es un RENOMBRE de frontera, no un cambio de ciencia: no se movio una
// sola cifra al hacerlo. Lo que hasta hoy se llamo `anibise-1.4.0` se llama `1.0.0` de aqui en adelante.
// El historial de arriba NO se borra: cada bump que trajo el motor hasta aqui sigue escrito, y la
// correspondencia entre los nombres viejos y este vive en `docs/VERSIONES.md`.
//
// POR QUE AHORA: la junta se salto el Hito 2 y hay pacientes reales en produccion. Gildardo pidio que
// todo quedara en la primera version oficial.
//
// LO QUE NO SE PUEDE HACER, y por eso esto es un renombre HACIA ADELANTE y no una reescritura: el sello
// dice CON QUE SE CALCULO. Los diagnosticos ya emitidos conservan `anibise-1.4.0` en su snapshot, y tiene
// que ser asi: reetiquetarlos haria que un diagnostico de agosto afirme que salio del motor de hoy.
//
// EL FORMATO, y por que se retira el prefijo: el campo ya se llama `engine_version`, asi que `anibise-`
// dentro del VALOR solo obligaba a parsear para comparar. Tres numeros (no dos ni cuatro): con dos no se
// puede corregir un decimal sin anunciar cambio de ciencia. Y nunca fechas: `2026-09-04` no ordena contra
// `1.4.0` y no dice si el cambio fue de fondo o de forma.
// ═══ 2.0.0: LA EB-BIS v7 (2026-10-28) ═══
//
// MAYOR, y el criterio no es nuestro: `docs/VERSIONES.md` dice *"Mayor = la ciencia cambia y lo emitido
// antes no es comparable"*. Aqui se cumplen las dos mitades, y la segunda es la que obliga.
//
// LA CIENCIA CAMBIA. La EB-BIS v5 (IFC, PABU e ICEC con intercepto fijo de 41,438 años) se RETIRA del
// motor y la sustituye la EB-BIS v7 con parametros 7.1.0 (entrega de Gildardo del 2026-10-26, §2: *"se
// retira del motor de ATLAS y se sustituye"*). No es la misma formula con otros numeros: cambian los
// INSUMOS (ahora Re, Ri, C, peso, MLG, ACT y FMI de la misma medicion, mas sexo y edad), cambia el
// esperado (curvo, con termino de edad²), y el ICEC SALE del calculo.
//
// Y LO EMITIDO ANTES NO ES COMPARABLE, que es lo que hace falta que esta version sea mayor y no menor:
// `sonComparables` (followups/eb-trajectory) refusa restar dos EB de MAYORES distintos, y esa resta es la
// que el paciente ve como "mejoro" o "empeoro". Con un bump menor, la banda habria restado una EB v7
// contra una v5 sellada y le habria mostrado al paciente el salto de ESCALA como si fuera su cambio.
// Ese freno se construyo el 2026-10-24 justo para este dia.
//
// QUE SE MUEVE, en concreto:
//  · La EB-BIS y el IAE de TODO paciente, con otra escala. Y el IAE alimenta la ruta R1 y el dominio 3 del
//    DFI, asi que las rutas y el riesgo integrado pueden voltear.
//  · La EB-BIS y el IAE pasan a emitirse SIN encuesta completa (su §2: el ICEC ya no entra). El DFI sigue
//    sin generarse hasta que este completa (su §5).
//  · Aparecen tres salidas nuevas que la v5 no tenia: la z de pares, el tope y la alerta de discordancia.
//  · Cada resultado sella `versionMotor` y `versionParametros` (su §6), porque los parametros pueden
//    cambiar sin que cambie la formula: ya paso entre el 24 y el 26 de octubre (7.0.0 a 7.1.0).
//  · Y la EDAD pasa a ser insumo de la formula, exigida ENTERA (años cumplidos). Un paciente sin fecha de
//    nacimiento deja de recibir una EB-BIS: recibe "pendiente" con su motivo. Es la correccion de sus
//    errores 3, 4 y 6, y es un caso REAL (13 evaluaciones calcularon con edad 0).
//
// LOS VALORES v5 YA CALCULADOS SE CONSERVAN, que es lo que pide su §6: viven en los snapshots sellados y
// no se reescriben nunca (regla 7). No hace falta un "campo historico" nuevo; el campo historico es el
// snapshot. Lo que si hay que hacer, y va aparte, es el RECALCULO de las evaluaciones limpias.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3.0.0 (2026-11-06) · EL DFI LEE LA EB-BIS DE LA v7 (CA-3)
//
// La 2.0.0 trajo la v7 al motor, PERO `analizarDFI` seguia calculando por dentro la EB-BIS de la **v5** y
// con ella resolvia el dominio 3, el riesgo integrado y la ruta R4. O sea que la 2.0.0 dejo la casa a
// medias: la pantalla y el informe en la v7, el diagnostico en la v5. Medido sobre las 422 consultas
// selladas con la v7, **70 se contradicen** y el freno de la contradiccion (0229) no las deja entregar.
//
// POR QUE ES MAYOR Y NO MENOR, que es la pregunta que decide: `docs/VERSIONES.md` dice *"Mayor = la
// ciencia cambia y lo emitido antes no es comparable"*. Aqui cambian LAS SEVERIDADES POR DOMINIO, el
// RIESGO INTEGRADO y las RUTAS ACTIVAS. Un seguimiento que restara un dominio 3 calculado con la v5
// contra uno calculado con la v7 le mostraria al paciente el salto de MODELO como si fuera su cambio, que
// es exactamente lo que `sonComparables` existe para impedir.
//
// QUE SE MUEVE, medido en el caso de referencia (el donante golden, 54 años):
//  · la EB-BIS que alimenta el DFI pasa de 29,9 a 58 y su IAE de -24,7 a +4;
//  · el dominio 3 sube de severidad 0 a 1 y el riesgo integrado de 25 a 30 (el NIVEL sigue MEDIO);
//  · los otros cuatro dominios, el veto y las rutas no se mueven.
//
// Y ALGO QUE NO ES UN MOVIMIENTO SINO UNA RECUPERACION: la v5 necesitaba el ICEC, asi que en una consulta
// con la encuesta a medias el dominio 3 se quedaba SIN PUNTUAR. La v7 no lo necesita. Esas consultas
// pasan a tener su dominio de envejecimiento, coincidiendo con el archivo de Gildardo.
//
// LO EMITIDO ANTES NO SE REESCRIBE (regla 7): vive en su snapshot con su version. El RECALCULO de las
// evaluaciones limpias va aparte, con su simulacion previa.
//
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3.1.0 (2026-11-06) · EL PUNTAJE DE ALIMENTACION DEL ICEC (su v16 §4.2)
//
// ═══ POR QUE NO VA DENTRO DE LA 3.0.0, QUE ES COMO SE ESCRIBIO PRIMERO ═══
//
// Se escribio como "la segunda mitad de la 3.0.0", con un argumento correcto: las dos mueven el mismo
// snapshot, las dos son del mismo motor, y el plan pedia un bump, un recalculo, un juego de goldens.
//
// LO QUE INVALIDA ESE ARGUMENTO ES UN HECHO, NO UNA OPINION: **la 3.0.0 YA SE EMPUJO** (Santiago, el
// 2026-11-06 a las 21:00; `git reflog show origin/main` lo tiene como "update by push"). Asi que desde ese
// momento la nube puede estar sellando consultas con `engine: "3.0.0"` y el `calcPatron` del v8. Dejar el
// re-porte dentro de la 3.0.0 haria que **una misma cadena de version cubriera dos matematicas**, y eso es
// exactamente lo que la constelacion de versiones (regla 7) existe para que no pase: un diagnostico de
// esta tarde no se podria describir entero.
//
// Un bump cuesta una linea. Averiguar despues cual de los dos calculos sello un snapshot no se puede.
//
// ═══ POR QUE MENOR Y NO MAYOR ═══
//
// `docs/VERSIONES.md`: *"Mayor = la ciencia cambia y lo emitido antes no es comparable"*. La ciencia
// cambia, si. Pero lo emitido antes SIGUE siendo comparable, y eso se puede sostener con la medicion:
//
//  · El ICEC se mueve UN PUNTO (simulacion del 2026-11-06, grupo del mayor 2: -1 exacto en las 62 de 62).
//  · El dominio 5, que es por donde el ICEC entra al diagnostico, no se movio en NINGUNA de esas 62.
//  · Y LO QUE LA COMPARABILIDAD PROTEGE DE VERDAD es la resta de dos EB-BIS, que es lo que el paciente lee
//    como "mejoro" o "empeoro" (`sonComparables`, followups/eb-trajectory). El ICEC **no entra** al calculo
//    de la v7 (su §1.2), asi que esta version no toca esa resta ni por un decimal.
//
// LO QUE SI QUEDA EXPUESTO, Y SE DICE: con el mayor igual, `sonComparables` dejara restar un dominio 5 de
// 3.0.0 contra uno de 3.1.0, calculados con dos ICEC distintos. Medido, la diferencia no movio ninguna
// severidad; si manana moviera alguna, el sitio de esa decision es este comentario y no un hallazgo.
//
// ─── QUE TRAE ───
//
// QUE PASO: una nutricionista reporto que la encuesta presentaba las carnes rojas y los embutidos como
// PROTECTORAS. Gildardo lo verifico en su HTML y en Atlas, la causa era la misma en los dos, y la corrige
// en su v16. `calcPatron` se RE-PORTO de su `ATLAS_v16.html` del 4 de noviembre (antes salia del v8 del 4
// de agosto). Las cuatro piezas: los siete protectores entran (los huevos no puntuaban) con la escala
// reescalada x 6/7 para que el maximo siga en 60 · los embutidos se penalizan DOBLE (-2, -8, -14, -20) ·
// las carnes rojas dejan de SUMAR por comerlas a menudo y pasan a restar · y con embutidos 3-4 dias o mas
// el puntaje se TOPA en 54, o sea "Mejorable", aunque los protectores esten completos.
//
// POR QUE TOCA EL DIAGNOSTICO Y NO SOLO UNA TARJETA: `LE8_MAPEO_CORREGIDO` esta en `true` desde el
// 2026-09-06, asi que el componente Alimentacion del ICEC ES este puntaje, y el ICEC alimenta el dominio 5
// del DFI. Lo que NO toca es la edad biologica: en la v7 el ICEC ya no entra al calculo (su §1.2), y eso es
// lo que hizo barato este cambio. En la v5 habria movido la EB-BIS de todos entre 1 y 8 años.
//
// QUE SE MUEVE, CON SUS SIETE CASOS: los valores esperados NO son nuestros. Su v16 §5 trae siete casos con
// su cifra (46, 40, 54, 70, 70, 65, 54) y el golden los corre tal cual. Y su columna del v15 (63, 60, 60,
// 67, 67, 69, 63) coincide con lo que daba nuestro porte del v8 en esos mismos siete, que es el control
// cruzado de que el porte anterior tambien era el suyo.
//
// LO QUE EL CASO DE REFERENCIA NO VE, y hay que decirlo porque un golden verde invita a creer lo
// contrario: en el donante golden la Alimentacion baja de 60 a 57, pero el ICEC total se queda en 80
// (637/8 = 79,625, y antes 640/8 = 80 exacto). O sea que el golden del DFI NO cubre este cambio: lo
// absorbe el redondeo. El tamaño real se mide sobre la cohorte, no aqui.
//
// Y ES RETROACTIVO EN UNA SUPERFICIE: la tarjeta del patron alimentario se calcula AL MOSTRAR, no se
// sella (`patron-view.ts`). Asi que el nivel que un profesional vio ayer en una consulta vieja puede
// leerse distinto hoy. Es la misma familia que el efecto sella-vs-computa de la Δ (CA-2 del registro de
// opcion B), y es aceptable por la misma razon: el que cambia es el que estaba mal, y es el defecto que
// Gildardo esta corrigiendo. El ICEC SELLADO de las consultas viejas no se toca.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 3.2.0 (2026-11-07) · EL BORDE DE ±5 DEL IAE SE CIERRA, EN LOS CUATRO SITIOS
//
// ═══ DE DONDE SALIO: LA SIMULACION DEL RECALCULO, CONTRA LA NUBE ═══
//
// La simulacion dijo que despues del recalculo UNA consulta seguia frenada (`0eebf4dd`) y OTRA quedaba
// frenada de nuevo (`fdb7e083`). Las dos con el IAE en **+5,0 exacto**. No era un dato raro: era Atlas
// contradiciendose consigo mismo en el borde, con CUATRO lectores y DOS cortes.
//
//   · `presentacion-eb-bis.ts` (lo que el PACIENTE lee) ..... >= 5  ->  "acelerado"
//   · `cIAE` del frozen (la CLASIFICACION del profesional) .. <= 5  ->  "Concordante"
//   · la condicion de R4 (lo que se PRESCRIBE) ............. >  5  ->  no activa
//   · la condicion de R1 .................................. >  5  ->  no activa
//
// Con un IAE de +5,0 el informe decia "envejecimiento acelerado estimado" arriba, la tabla decia "Acorde
// con sus pares", y el tratamiento no traia la ruta del envejecimiento. El freno hacia su trabajo: lo que
// detectaba era REAL y lo producia Atlas.
//
// ═══ QUIEN LO DECIDE ═══
//
// Gildardo. Su `cIAE` del v16 (L4568) cierra los dos bordes hacia el extremo, y las condiciones de R1 y
// R4 de su archivo dicen `>= 5` por lo mismo. Las tres piezas se RE-PORTARON byte a byte. Lo que habia en
// Atlas era un porte del v8 conviviendo con una capa de presentacion ya migrada.
//
// ═══ QUE SE MUEVE ═══
//
//  · La ETIQUETA SELLADA de la banda: +5,0 pasa de "Concordante" a "Acelerado" y -5,0 a "Desacelerado".
//    Por eso sube tambien `emission_versions.classification` a `cXXX-2026-11-07`.
//  · La SEVERIDAD del dominio 3: en +5,0 pasa de 1 (via `iae > 3`) a 2 (via la banda "Acelerado").
//  · Las RUTAS R1 y R4 se activan en +5,0 exacto, donde antes no.
//  · Y los tres textos de banda de su tabla 3 entran con el bloque (`t`). No se usan todavia.
//
// Medido sobre la nube el 2026-11-07: CUATRO consultas en los bordes (`fdb7e083` y `0eebf4dd` en +5,0 ·
// `58d6ec8a` y `84253510` en -5,0). Dos de ellas son exactamente las que la simulacion no destrababa.
//
// ═══ POR QUE MENOR, Y POR QUE VERSION PROPIA Y NO DENTRO DE LA 3.1.0 ═══
//
// MENOR: lo emitido antes sigue siendo comparable. Lo que la comparabilidad protege es la resta de dos
// EB-BIS (`sonComparables`), y esta version no toca la cifra de la EB-BIS ni del IAE: solo en que banda
// cae el valor exacto del borde.
//
// VERSION PROPIA porque la 3.1.0 YA SE EMPUJO (`git reflog show origin/main`, el 2026-11-07), igual que
// habia pasado con la 3.0.0. Es la segunda vez en dos dias, asi que conviene decirlo como regla y no como
// anecdota: **mientras el recalculo este sin aprobar, cada cambio de ciencia que se escriba despues de un
// push necesita su propia version**, porque la nube ya puede estar sellando con la anterior.
//
// LO QUE SIGUE ABIERTO: el Δ de su linea 15628 sigue con el corte ABIERTO en su archivo, asi que en +5,0
// su documento se contradice solo (la fila dice "acelerado" y el Δ de al lado dice "0,0"). Es su pregunta
// 36 y la decide el. Esta version cubre la BANDA, no el Δ.
//  · 3.3.0 (2026-11-11): EL ICA-BIS, CON SIGNO (v17 §4). Hasta aqui el motor sellaba
//    `icaBis = |PABU - 1,618|`, en magnitud, y el valor absoluto PIERDE LA DIRECCION del alejamiento de
//    φ, que es la mitad del significado: por encima de φ es deficit estructural y por debajo es exceso
//    de adiposidad. Textual de su v17: *"ICA-BIS = PABU - 1,618, con signo"*.
//
//    POR QUE SUBE **MINOR** Y NO MAYOR, que es la decision que importa: `sonComparables` compara la
//    version MAYOR, asi que un salto de mayor PARTE LA SERIE de todos los pacientes (hasta la segunda
//    consulta con la version nueva no hay delta ni tarjeta de respuesta). Eso se paga cuando cambia una
//    CLASIFICACION, y aqui no cambia ninguna: el `icaBis` no entra en ningun puntaje del DFI, ni en una
//    severidad, ni en el riesgo integrado, ni en una ruta. Lo que cambia es lo que se le DICE al
//    profesional, al paciente y a la IA. Partir la serie de 441 consultas por un rotulo seria cobrar el
//    precio del bump sin comprar nada.
//
//    Y NO HAY MIGRACION DE DATOS, a diferencia de lo que su documento pide para su aplicacion: ahi el
//    ICA-BIS es un campo almacenado que las pantallas leen, y aqui un informe sellado es INMUTABLE
//    (regla 7). El ICA-BIS es una funcion pura de la PABU, y la PABU sellada ya es correcta, asi que se
//    DERIVA al leer (`clinical-engine/ica-bis`) y el historico completo se ve bien sin tocar una fila.
//    Es, ademas, lo que su propio documento pide a las pantallas: *"cuando la PABU esta disponible, toda
//    pantalla calcula el ICA-BIS desde ella y no lee primero el valor guardado"*.
//
//    MEDIDO EN LA NUBE antes de aplicarlo: 245 de 441 consultas vigentes (55,6 %) tienen la PABU por
//    DEBAJO de φ, o sea que a mas de la mitad se les mostraba una desviacion positiva (que se lee como
//    deficit) teniendo exceso de adiposidad. No es un borde.
export const ENGINE_VERSION = "3.3.0";

// Version del CONJUNTO DE PROTOCOLO (motorProtocolo + cadena calorica + clasificador de fenotipo).
// Versiona aparte de ENGINE_VERSION porque es un conjunto de artefactos distinto. Se sella en cada
// protocol_suggested (regla 7); el resto de la constelacion se hereda via diagnosis_id.
// Bump 2026-08-02 (1.0.0 -> 2026-07-30, fechada al vigente): re-sync de la frontera de desnutrición
// del clasificador de fenotipo (protocolo-fenotipo.ts) contra el vigente. El fenotipo alimenta el
// protocolo (obesidadSarcopenica -> estrategia/proteína), así que el protocol_suggested puede moverse
// para pacientes en las franjas; por eso sube esta versión, además de emission_versions.structural_mccb.
// Bump 2026-08-03 (2026-07-30 -> 2026-08-03): primera MODIFICACION AUTORIZADA del frozen (CA-1/D-012,
// retirar el examen de telomeros del listado sugerido). El listado de examenes se sella en
// protocol_suggested, asi que el contenido sellado cambia para los protocolos con IAE>5; por eso sube
// la version. El que corre pasa a ser atlas-protocolo.authorized.js (generado = original + manifiesto).
// Bump 2026-08-19 (2026-08-03 -> 2026-08-19): RE-PORT contra el archivo del 18, punto 6 (objetivo
// calorico a 0). motorProtocolo retira los cinco deficits por fenotipo (deficit 0 + orientacion en
// texto); el contenido sellado en protocol_suggested cambia (deficit/label/perfil), por eso sube.
// Bump 2026-08-19b (mismo dia, 2a): residuo del 19 (RESPUESTA_GILDARDO §1). El gate de sarcopenia del
// fenotipo (protocolo-fenotipo.ts) baja mujer 24 -> 22 (barrido del umbral); el contenido sellado en
// protocol_suggested puede moverse para mujeres con SMM/W 22-24, por eso sube.
// Bump 2026-08-31 (2026-08-19b -> 2026-08-31): la dinamometria entra al motor. `classifyFenotipo` recibe
// `fuerzaPrensil` real, asi que `sarcopenia`/`obesidadSarcopenica` pueden voltear y con ellas la estrategia
// y la proteina del protocolo. El contenido sellado en protocol_suggested cambia para los pacientes con la
// fuerza registrada; por eso sube.
// Bump 2026-09-04 (2026-09-03 -> 2026-09-04): se porta su entrega del 3 de septiembre, confirmada en su
// respuesta del 4. Cambia LA CADENA ENTERA, no un detalle:
//   · GASTO BASAL: Mifflin-St Jeor sobre el peso meta. Es la TERCERA formula en cuatro dias
//     (500+22xFFM mal rotulado Cunningham -> Harris-Benedict -> Mifflin), y mueve el objetivo de TODOS
//     entre 55 y 104 kcal hacia abajo.
//   · PROTEINA: 0,8 g/kg plano y editable. Salen las cinco cifras por rama (1,5 desnutricion / 1,25
//     cancer / 1,3-1,4 obesidad / 1,4 sarcopenia / 0,7 ERC).
//   · GRASA: 30 % para todos; la dislipidemia ya no la baja a 25.
//   · OBJETIVO: una sola via (gasto menos restriccion). Sale la formula por patologia (27,5 x peso
//     actual) y el piso pasa a aplicar a todos.
//   · DESNUTRICION y SARCOPENIA separadas, por FFMI y ASMI en vez de por IMC y un OR.
// Todo el contenido sellado en protocol_suggested cambia; por eso sube.
// 1.0.0 (2026-09-09): el MISMO renombre de frontera que `ENGINE_VERSION` (ver alli el porque completo).
// Lo que hasta hoy se llamo `anibise-protocolo-2026-09-04` se llama `1.0.0`. NO cambia ningun artefacto:
// los SHA de abajo son los mismos, y el candado de version lo comprueba. Aqui el cambio de formato tiene
// ademas una razon propia: la fecha no ordena, asi que "esta version es posterior a aquella" no se podia
// responder comparando las dos cadenas.
export const PROTOCOL_ENGINE_VERSION = "1.0.0";

// Candado de version: SHA-256 POR ARCHIVO de los artefactos que producen el protocolo. Un test
// (protocol-version-lock.test.ts) recomputa y compara; si alguno cambia, FALLA y NOMBRA cual, para
// que la decision de subir PROTOCOL_ENGINE_VERSION se tome con informacion, no por olvido. Por
// defecto un cambio sube la version. NO editar estos hashes a mano sin leer el mensaje del test.
//
// EXENCION DE ARRANQUE: CERRADA (2026-07-29, con el sellado del protocolo en el pipeline).
// El pipeline ya sella protocol_suggested (pipeline-writer), asi que a partir de aqui YA NO aplica:
// cualquier cambio en los cuatro artefactos exige subir PROTOCOL_ENGINE_VERSION, SIN EXCEPCION (dos
// protocolos sellados con la misma version tienen que haber sido producidos por el mismo codigo).
// Se conserva el registro de la exencion para que nadie la reinterprete: era valida SOLO mientras
// ningun protocol_suggested existiera en la base con 1.0.0; se uso una vez (exponer `pal`, ver el
// SHA de protocolo-calorico.ts abajo) y se cerro. No se reutiliza.
export const PROTOCOL_ARTIFACTS_SHA: Record<string, string> = {
  // El que CORRE y se sella es el GENERADO (original + manifiesto de modificaciones autorizadas), no
  // el original. Se hashea el generado, no el manifiesto: el generado solo cambia cuando cambia el
  // CODIGO que corre (la prosa del manifiesto puede cambiar sin afectar la ciencia; el generado no).
  // El original (atlas-protocolo.js) queda como referencia byte-identica a Gildardo, guardada por su
  // DIFF-vs-fuente (frozen-protocolo-diff), no por este candado.
  // SHA actualizado (2026-08-19) CON subida de version: re-port del punto 6 (objetivo calorico a 0).
  "frozen/atlas-protocolo.authorized.js": "c832aab5fc7b1ed53c4f644c9425b24d3b9ab51d4ce0996a4d5c0245a1c78eb1",
  // SHA de la primera modificacion autorizada (CA-1/D-012, retirar telomeros). Antes se hasheaba el
  // original bajo la EXENCION DE ARRANQUE (cerrada); ahora se hashea el generado (el que se sella).
  // SHA actualizado (2026-09-02b) CON subida de version, y la razon vale la pena dejarla escrita: el
  // porte del GEB de esta manana (version 2026-09-02) dejaba que el GASTO MEDIDO por el equipo ganara
  // sobre el Harris-Benedict DENTRO de la cadena que fija la ingesta. Su motor dice lo contrario en el
  // comentario pegado a `_mtn.geb`: el medido es el basal de HOY (peso actual) y sirve para mostrarlo,
  // no para fijar la ingesta que lleva a la META. Era un defecto LATENTE (ningun caller pasaba el
  // medido) y por eso la version de la manana no sello cifras equivocadas; se sube igual porque la
  // cadena cambio y esta version es la que se sella de aqui en adelante.
  // SHA actualizado (2026-09-03) CON subida de version: LA PROTEINA LA PRESCRIBE EL MOTOR (su §9.6 punto
  // 4). La cadena deja de leer el `protMin` de motorProtocolo, que es un MINIMO poblacional (base 0,8), y
  // pasa a leer el `protKg` de motorTratNutri, que es una PRESCRIPCION (base 1,0; cancer 1,25,
  // desnutricion 1,5, obesidad 1,3, con sarcopenia 1,4, ERC 0,7). Medido antes de aplicarlo: de los 60
  // tratamientos de la base, 56 lo verian y NINGUNO esta aprobado, asi que ninguna prescripcion sellada
  // se mueve. El valor se SELLA en protocol_suggested.mtn; los snapshots anteriores lo reciben del caller
  // (cascada con `protFuente`), que es lo que impide que el defecto siga vivo justo en los que existen.
  "protocolo-calorico.ts": "70818fb92b219fe1006893af1e05192bf19991c8cccb4b13803d4687aa0fd28f",
  // SHA actualizado (2026-08-02) CON subida de versión: re-sync de los 3 cortes inferiores al vigente.
  // SHA actualizado (2026-08-19b): gate de sarcopenia del fenotipo, mujer 24 -> 22 (Gildardo §1 del 19).
  // SHA actualizado (2026-08-31) CON subida de version: la dinamometria entra al motor (§6 del 30). Lo que
  // cambia en ESTE archivo es la brecha declarada en su encabezado, que dejo de ser cierta; el efecto
  // clinico viene de que sus llamadores ya le pasan la fuerza.
  "protocolo-fenotipo.ts": "644af070a8b10014078781300663c0806d938d467617c0818b733a31d60498d1",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
