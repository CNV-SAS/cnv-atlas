# ATLAS v12 contra Atlas · punto por punto

**Fecha:** 2026-10-26 · **Para:** Santiago y Gildardo · **Fuente:** `CAMBIOS_ATLAS_v12_para_Santiago.md`
(12 de octubre) verificado contra el código de Atlas y contra la nube en solo lectura.

**Mismo ejercicio que con v11:** ciencia contra software, y de cada punto si **ya existe**, está
**superado**, **choca** con una decisión que ya tomamos, o es **nuevo**. Lo que espera números de Gildardo
va marcado y no se construye.

---

## Lo primero, porque cambia cómo se lee el resto

**v12 toca el motor calórico, y eso mueve la prescripción de todos los pacientes.** No es como v11, del
que se pudo decir tres veces seguidas que nada obligaba a recalcular. Aquí sí: cambiar Mifflin por
Harris-Benedict y sumar un 10 % de termogénesis mueve el objetivo calórico de **toda la cohorte**, así que
entra por el mecanismo de versión del motor, con sus golden tests, o no entra.

**Y hay un choque que es de él consigo mismo, no nuestro.** Su entrega del 2 de septiembre (§9.6) decía:
*"manda el gasto basal del equipo... calcularlo con una fórmula propia es sustituir una medición por una
estimación"*, y lo había medido sobre once mediciones reales. v12 prescribe con una fórmula. **Lo resuelve
él mismo en el propio documento** (*"el Biody Xpert calcula su TMB sobre el peso actual... el plan no se
prescribe con ellos"*), y esa resolución es correcta: el gasto medido es del peso de hoy y el plan lleva al
peso meta. Conviene que conste, porque la frase del 2 de septiembre está citada en nuestro código.

---

## El cuadro completo

**Ciencia (C) = decide Gildardo, Regla 0. Software (S) = decidimos nosotros.**

| # | Frente de v12 | Capa | Veredicto en Atlas |
|---|---|---|---|
| 1.1 | Lista por último evaluado | S | **Ya existe**, con conmutador. Lo que cambia es el orden por defecto. §A1 |
| 1.2 | Eliminar perfil (borrado lógico) | C+S | **La columna existe y no la escribe nadie.** Y el borrado duro ya está cerrado por nuestro propio documento legal. §B1 |
| 1.3 | Eliminar toma de BIS | S | **Superado estructuralmente**, y su lista de 134 campos no aplica. §B2 |
| 2 | Control de calidad biológico | C | **Mitad nueva, mitad ya existe.** Las identidades imposibles NO están; los rangos sí, y son otros. **Percentiles calculados y listos.** §A2 |
| 3 | Se retira la pantalla intermedia | S | **No aplica** (no existe `ModEncuestaEstado`). Pero su movimiento de las condiciones de la toma **choca** con dónde las tiene Atlas. §B3 |
| 4 | Diana en colores de semáforo | C | **Nuevo, y el defecto que describe está en Atlas igual.** Espera sus cortes. §A3 |
| 5 | Todo se calcula solo al subir el Excel | S | **Choca con el acto de generar.** §B4 |
| 6.1 | Harris-Benedict sobre peso meta + 10 % | C | **Nuevo, y es el cambio grande.** Además habría DOS Harris-Benedict distintos. §A4 |
| 6.2 | Flujo guiado del nutricionista | S | **Nuevo**, y choca en una pieza con el guardado único. §B5 |
| 6.3 | La impresión sale igual · "no unifiques los dos bloques" | S | **Ya está así**, y por su mismo argumento. §B6 |
| 8.1 | El menú se sortea en cada redibujado | S | **Superado** (semilla persistida) |
| 8.2 | Dos motores opinando sobre realimentación | C | **Está en Atlas igual.** §A5 |
| 8.3 | `guardarEnPC` escribe `ATLAS_v7` | S | **No aplica** (no hay exportación a archivo local) |

---

# Parte A · Lo que es CIENCIA (decide Gildardo)

## A2 · Control de calidad biológico: los percentiles ya están, y dicen algo incómodo

**Lo que Atlas tiene hoy** es `SANITY`, nueve rangos en el borde del import. Y arrastra el caso que fijó la
regla de los umbrales: frenó una capacitancia de **16,22 nF** de una paciente real (rango nuestro 0,3-8) y
la dejó sin diagnóstico. Al buscar el origen de esos nueve rangos no había ninguno: se eligieron a ojo al
portar el motor.

**Lo que v12 trae de nuevo, y es lo que más vale:** las **identidades imposibles**. Esas no están en Atlas
y no dependen de ningún umbral (Re ≤ R∞, reactancia del centro positiva, Rc fuera del arco, la impedancia
subiendo con la frecuencia, masa grasa ≥ peso, agua total ≥ masa sin grasa, las sumas que no cuadran). Es
una comprobación **física**, no una estadística, y por eso no hay nada que firmar. **Son once reglas y las
once se pueden construir sin esperar a nadie.**

### Los percentiles que pidió, sobre la cohorte limpia

**Cohorte:** 352 mediciones. Son las de consultas vigentes de pacientes reales, **menos las 23 de huella
repetida** (la misma toma física en dos historias: contarla dos veces le da doble peso a un cuerpo justo en
la cola, que es donde viven estos percentiles). El cero y el vacío se tratan como *sin dato*, que es la
primera regla de diseño que v12 pide no deshacer.

| variable | n | mín | p0,5 | p1 | p99 | p99,5 | máx | límite de v12 | ¿rechaza a alguien real? |
|---|---|---|---|---|---|---|---|---|---|
| talla (cm) | 352 | 119 | 139,75 | 143,24 | 185,49 | 187,25 | 188,5 | 100-230 | no |
| peso (kg) | 352 | **22** | 42,59 | 47,51 | 116,96 | 122,81 | 134 | 25-300 | **sí: 1** |
| IMC (kg/m²) | 352 | 15,01 | 16,46 | 18,69 | 38,29 | 39,78 | 41,36 | 10-80 | no |
| cintura (cm) | 352 | 48 | 53,51 | 58 | 116,98 | 129,24 | 133 | 40-220 | no |
| cadera (cm) | 352 | 60 | 63,02 | 80 | 124,47 | 130,08 | 139 | 50-220 | no |
| Re (Ω) | 352 | 426,7 | 465,75 | 478,07 | 906,89 | 942,92 | 1017,9 | 200-1500 | no |
| Ri (Ω) | 352 | 1010,1 | 1030,12 | 1057,24 | 3020,92 | 3203,86 | 4098,6 | 300-5000 | no |
| R∞ (Ω) | 352 | 314,65 | 323,09 | 333,92 | 684,09 | 707,69 | 761,61 | 100-1200 | no |
| C (nF) | 352 | 0,54 | 0,67 | 0,73 | 3,91 | 4 | **16,22** | 0,3-10 | **sí: 1** |
| Fo (kHz) | 352 | **4,84** | 24,9 | 25,64 | 59,65 | 60,74 | 66,41 | 10-150 | **sí: 1** |
| AF (°) | 352 | 2,8 | 3,28 | 3,65 | 7,5 | 7,85 | 8,1 | 2-12 | no |
| grasa (%) | 345 | **−15,6** | 7,05 | 12,35 | 44,04 | 44,57 | 45,77 | 2-70 | **sí: 2** |
| hidratación MLG (%) | 352 | 63,01 | 63,79 | 63,92 | 74,71 | 75,22 | 77,43 | 60-85 | no |
| fuerza prensil (kgf) | 36 | 13,9 | 14,79 | 15,69 | 44,64 | 44,92 | 45,2 | 1-90 | no |

> Script: `scripts/PERCENTILES_PARA_EL_QC_BIOLOGICO_2026-10-26.mjs`, solo lectura, re-corrible.

### Las tres cosas que hay que decirle CON la tabla

**1 · Sus límites provisionales ya rechazarían cinco mediciones reales**, y una de ellas es **la
capacitancia de 16,22 nF**: el mismo caso que nos costó una paciente sin diagnóstico volvería a quedar
fuera con 0,3-10. Las otras: un peso de 22 kg, una Fo de 4,84 kHz y dos grasas negativas.

**2 · Una grasa de −15,6 % es imposible, y su lista de imposibles no la atrapa.** Hay al menos dos
mediciones con porcentaje de grasa negativo. Eso no es un rango ancho o estrecho: es un valor que no puede
existir, así que le corresponde la lista de identidades y no `QC_BIO_LIMITES`. **Propuesta nuestra para su
lista: "masa grasa o porcentaje de grasa ≤ 0".**

**3 · Y la advertencia de método, que es suya de decidir pero nuestra de decir:** adoptar p0,5 y p99,5 como
**cortes duros** rechaza por construcción cerca del **1 %** de las mediciones reales (medio por cola). Para
un filtro que existe para atrapar un error de digitación, eso es al revés: sacaría de la cohorte a
pacientes que midieron bien. Por eso la tabla trae el mínimo y el máximo observados al lado. **La banda de
percentiles sirve para decir "mira esta medición"; el corte que FRENA debería caer fuera del mínimo y del
máximo reales.** Con n = 352, además, el p0,5 lo deciden las dos mediciones más bajas.

## A3 · La Diana: el defecto que describe está en Atlas igual

Atlas pinta las 81 celdas con el **gradiente de riesgo**, portado verbatim de su `rc()` de ATLAS_v7. O sea
que el defecto que v12 corrige (*"los estados leves caían en verde lima y se leían como bien"*) **es
nuestro también**, y por la misma causa: es su gradiente.

**Nuevo para Atlas, y se puede construir en cuanto él firme los tres cortes** (0,19 · 0,45 · 0,62). Son
tres números en una función. Lo que no se puede es elegirlos nosotros: el color de un veredicto clínico
sale de su clasificador, no de nuestro criterio (es la frontera que CLAUDE.md llama capa clínica).

**Un detalle que conviene que decida con esto:** v12 deja el radar de cinco dominios y las tarjetas del DFI
con sus colores actuales, y dice que igualarlos sería cambiar un color. En Atlas son los tokens
`--clinical-*`, cuyos hexadecimales salen de sus clasificadores. Si la Diana pasa a amarillo y el radar se
queda en ámbar, **el mismo nivel de severidad tendrá dos colores en la misma pantalla**.

## A4 · El motor calórico: el cambio grande, y DOS Harris-Benedict

**Lo que Atlas prescribe hoy:** Mifflin-St Jeor sobre el peso meta, que es lo que devuelve su `_mtn.geb`
desde la entrega del 3 de septiembre. Atlas lo **lee del motor** y no lo recalcula, a propósito: aquí vivió
un `500 + 22 × FFM` mal rotulado "Cunningham" con 205 kcal de diferencia sobre el mismo paciente, y la
lección fue no tener una segunda fuente de la misma cifra.

**Lo que v12 pide:** Harris-Benedict sobre el peso meta, **× factor de actividad, + 10 %** de termogénesis.

**Y aquí está el hallazgo que importa: serían dos Harris-Benedict distintos en el mismo sistema.**

| | coeficientes | de dónde |
|---|---|---|
| `atlas-geb.js` (Atlas, portado el 2026-09-02) | 66,473 / **655,0955** | Harris-Benedict **original de 1919** |
| `gebHarris` (v12) | 88,362 / **447,593** | revisión de **1984** (Roza & Shizgal) |

Él mismo lo anota en v12 (*"`gebHarris` trae los coeficientes de la revisión de 1984, no los originales de
1919"*) y dice que lo confirma. **Lo que hay que decirle es que Atlas ya tiene la de 1919 en producción**,
como respaldo del gasto del equipo. Si v12 entra tal cual, el mismo concepto tendría dos fórmulas: una para
el respaldo del basal medido y otra para la prescripción. Es exactamente el defecto que él diagnosticó en
septiembre.

**La cifra, con su propio ejemplo verificado** (mujer, 40 años, 160 cm, peso meta 62 kg, actividad ligera):

| | TMB | × actividad | + 10 % |
|---|---|---|---|
| v12 (HB 1984) | 1.343 | 1.847 | **2.032** |
| HB 1919 (la que Atlas tiene) | 1.357 | 1.866 | 2.052 |
| Mifflin sobre peso meta (lo que Atlas prescribe hoy) | 1.259 | 1.731 | no aplica |

**Son +301 kcal/día** sobre lo que Atlas prescribe hoy para esa paciente: **+116 por cambiar de fórmula**
(1.731 a 1.847) y **+185 por el 10 %**. **Eso mueve a toda la cohorte**, así que es bump de `ENGINE_VERSION` con golden tests, y el
recálculo versionado de los diagnósticos ya emitidos es una decisión aparte (la misma conversación que la
EB-BIS v7).

**Lo que decide él, y no se construye hasta entonces:** cuál de las dos Harris-Benedict manda (y si la otra
se retira), y si el 10 % se aplica sobre TMB × actividad o sobre la TMB.

## A5 · El defecto 8.2 de su lista está en Atlas, idéntico

v12 lo anota y no lo corrige: *"el aviso de síndrome de realimentación lo emite `motorProtocolo`, el motor
viejo, no `motorTratNutri`. Dos motores opinando sobre el mismo paciente."*

**Verificado en Atlas:** `alertaSindRealim` sale de `atlas-protocolo.authorized.js`, que es ese mismo motor
viejo, con la condición `['F7','F10'].includes(fenotipo) && GEB < 1200 && IMC < 18.5`. Es el porte fiel de
su archivo, así que el defecto viajó con él. **Lo decide él**, y cuando lo decida es una línea.

---

# Parte B · Lo que es SOFTWARE (decidimos nosotros)

## B1 · Eliminar perfil: la columna existe, no la escribe nadie, y el borrado duro ya está cerrado

**Su instrucción:** *"Constrúyelo como borrado lógico (una marca de eliminado con fecha y autor) hasta que
yo lo confirme: así sirve para cualquiera de las dos respuestas."*

### Lo que Atlas ya tiene, y es la mitad del trabajo

**`patients.deleted_at` existe desde el principio y OCHO lectores la filtran** (la lista, la ficha, la
búsqueda por documento, la resolución de identidad, el import, la revocación de consentimiento, las vistas
de investigación). Lo que no existe es **nadie que la escriba**: ni acción, ni política, ni pantalla, ni
auditoría.

**Es el mismo defecto que acabamos de cerrar con `profiles.status`**: media pieza construida, que se lee
como construida. Un `UPDATE` a mano es hoy el único camino, igual que lo era inactivar a un profesional.

### El choque que hay que resolver ANTES de construirlo, y no es técnico

**Nuestro propio documento ya cerró la pregunta que él dice que va a decidir.** `DATA_GOVERNANCE.md`:

> *"**Derecho al olvido / supresión:** se atiende por **anonimización o desvinculación de identidad**, no
> destruyendo evidencia clínica sujeta a retención legal."*

Y la tabla de retención: **historia clínica, 15 años desde la última atención** (Resoluciones 1995/1999 y
839/2017). Más: *"revocar una autorización necesaria bloquea evaluaciones nuevas, pero no borra la historia
ya capturada: la obligación legal de conservar 15 años manda sobre la revocación"*.

**O sea que la opción "borra de verdad" no está abierta**, al menos en Colombia y al menos mientras ese
documento diga esto. CLAUDE.md es explícito sobre qué hacer aquí: el documento gana y el conflicto se
reporta en vez de ajustarse el código. **Lo que queda es exactamente lo que él pidió: borrado lógico.** La
diferencia es que no es un paso intermedio hasta decidir, es la respuesta.

### Las seis cosas con las que choca, cada una con lo que implica

| choca con | qué pasa |
|---|---|
| **La custodia al terminar el contrato** | Al terminar la relación hay que **exportar las historias** al Integrante en 10 días hábiles. Un perfil borrado lógicamente tiene que seguir exportándose, así que el export NO puede filtrar `deleted_at` |
| **"Esta consulta no ocurrió"** (`retirada_at`, 0212) | Son dos niveles distintos y **no se pisan**: una retira UNA consulta que no pasó; la otra retira al PACIENTE. Pero el pendiente de la lista ya ignora las retiradas, y tendría que ignorar también las del paciente borrado, o aparecería trabajo pendiente de alguien que ya no está |
| **Inactivar al profesional** (0229, de ayer) | Ninguno arrastra al otro, y está bien: su profesional se va y el paciente sigue siendo de CNV. Lo que hay que mirar es el orden del aviso: un paciente borrado no debería contar en "lo que queda abierto" del integrante |
| **El `clinical_audit_log`** | Es append-only e inmutable, y no se borra por una solicitud de supresión. Así que el rastro de quién borró sobrevive al borrado, que es lo que v12 pide. **Nada que construir** |
| **Las facturas** | Una venta facturada es un **documento fiscal** con 10 años de retención propia. Borrar al paciente no puede tocarla, y v12 ya lo dice para Bodega. En Atlas las ventas viven en `transactions` y no cascadean desde `patients`: se cumple solo |
| **El freno de la medición repetida** (0225/0230, y el aviso de hoy) | Este es el sutil: los dos filtran `deleted_at is null`, así que **borrar a un paciente libera la huella de su medición** y un duplicado podría volver a entrar. Hay que decidirlo: o la huella sigue contando (y entonces el freno mira también a los borrados), o se acepta |

### Lo que recomendamos construir, cuando él lo diga

Tres columnas con el mismo criterio que la 0229 (`deleted_at` ya está; faltan **quién** y **por qué**,
amarradas por CHECK para que no quepa un borrado sin motivo), la política solo para el profesional dueño y
la dirección científica, el asiento inline, y **la confirmación escribiendo el documento del paciente**,
que es la pieza de v12 que vale la pena portar tal cual: un "Aceptar" no distingue un clic de una decisión.

**Lo que NO recomendamos:** la marca local `atlas:_eliminados`. En Atlas no hace falta (no hay sincronización
que devuelva el perfil) y sería estado en el navegador para un hecho clínico.

## B2 · Eliminar toma de BIS: superado por la estructura

v12 necesita una lista de **134 campos** (`ATLAS_CAMPOS_BIS`) y una advertencia: *"si agregas un campo a la
importación, tiene que entrar en esa lista, o sobrevivirá al borrado"*.

**En Atlas esa lista no puede existir ni hace falta**, y no por mérito nuestro: es la consecuencia de que
el crudo viva en filas (`bis_raw_values`) colgadas de `bis_measurements`. Borrar la toma es borrar filas;
no hay 134 campos que enumerar y no hay campo nuevo que acordarse de añadir. **La clase entera de defecto
que su advertencia previene es estructuralmente imposible.**

**Y lo que Atlas hace en su lugar es mejor para lo que él mismo señala.** Su nota: *"el análisis de IA se
conserva, y se escribió con la toma que se acaba de borrar... conviene marcarlo como «generado con una toma
anterior»"*. En Atlas no hay nada que marcar: corregir **versiona**. La versión vieja queda legible como el
registro de lo que se emitió, con su firma, y la nueva nace sin medición pidiendo "Montar BIS". Es el mismo
razonamiento que él usó ayer para mover la corrección a Antropometría, llevado hasta el final.

**Lo que sí es nuevo y pequeño:** hoy el camino es *reemplazar* la medición (volver a importar) o la
corrección versionada. No hay un "borrar la toma y dejar la consulta sin medición" directo. Si lo quiere,
es una acción nueva; conviene decidir si no es ya lo que hace la corrección del caso 6.

## B3 · La pantalla intermedia: no aplica, pero su movimiento SÍ choca

`ModEncuestaEstado` no existe en Atlas, así que no hay nada que retirar. Las tres cosas que esa pantalla
hacía: las preguntas pendientes ya están en el encabezado de la encuesta (y desde el 19 de septiembre cada
una enlaza a sí misma), y "buscar paciente" es la lista.

**La tercera choca, y es un control de seguridad, así que conviene mirarla.** v12 mueve la **verificación de
condiciones de la toma** (placas, prótesis, marcapasos, ayuno, ejercicio, diurético, embarazo, ciclo) a
**Antropometría, encima de la importación**. En Atlas vive en **Encuesta**, y el botón de importar la exige
(sin condiciones capturadas no deja pasar).

**Su argumento es bueno y es el mismo de ayer:** *"se verifica justo antes de subir la bioimpedancia"*. El
nuestro también: la secuencia de Atlas es Encuesta → Antrop. & BIS, y las condiciones son parte de lo que
entra **antes** de medir. **Lo decide Santiago**, y es gratis: es mover un bloque de pestaña. Lo que no se
puede es tenerlo en las dos, porque entonces hay dos sitios donde se capturan las mismas respuestas.

## B4 · "Todo se calcula solo": choca con el acto de generar

En Atlas, subir el Excel **no** genera el diagnóstico: hay un botón *Generar diagnóstico*, y la columna de
pendientes de la lista está construida sobre esa secuencia ("Montar BIS" → "Registrar condiciones" →
"Generar diagnóstico").

**La regla de v12 es razonable y en su mayor parte Atlas ya la cumple**: la cadena calórica, la tabla de
Wang, los índices, el intercambio, la validación con ICN y la distribución se recalculan solos al cambiar
sus insumos, sin botón. No hay botones de "calcular" repartidos.

**Lo que no se puede volver automático sin decidirlo es el SELLO.** Generar escribe el snapshot con su
constelación de versiones (regla dura 7) y queda como el diagnóstico de esa consulta. Hay dos cosas que
mirar antes:

1. **Su propia decisión del 2026-08-13 §1:** *"el sistema BLOQUEA generar un diagnóstico con encuesta
   incompleta... el profesional completa la encuesta con el paciente ANTES de generar"*. Un sello automático
   al subir el Excel no lo rompe (el gate seguiría frenando), pero deja la consulta en un estado nuevo: con
   medición y sin diagnóstico porque la encuesta falta, sin que nadie haya pulsado nada.
2. **Quién consta como autor.** Hoy el sello tiene un actor. Si lo dispara el import, el actor es quien
   importó, que normalmente es el mismo profesional; conviene que sea una decisión y no una consecuencia.

**Recomendación:** adoptar la regla para todo lo DERIVADO (ya está) y dejar el sello como acto. Si Gildardo
lo quiere automático, es una línea en el import y hay que escribir en el audit que lo disparó el archivo.

## B5 · El flujo guiado del nutricionista: nuevo, y una pieza choca

Los seis pasos con revelación progresiva son nuevos para Atlas, y el argumento es bueno (el panel actual
muestra todo a la vez). Lo que hay que resolver antes de portarlo:

- **Las "tres aprobaciones" chocan con el guardado único.** Atlas tiene UN botón de guardar al pie, con la
  barra pegajosa que nombra las secciones cambiadas. Fue una decisión explícita contra el guardado por
  partes. Tres aprobaciones vuelven a partirlo, salvo que sean *avances de paso* y no *guardados*, que es
  probablemente lo que son. Hay que mirarlo con el archivo delante.
- **"Al cambiar el peso meta o el factor de actividad, se suelta la cifra manual de calorías."** Esto sí es
  un acierto que Atlas no tiene: hoy un `adj_kcalObj` fijado a mano deja el plan clavado aunque el gasto
  cambie. Es un defecto real nuestro y se puede arreglar aparte del flujo, con su enlace para volver a la
  cifra calculada.
- **"Resumen clínico y meta terapéutica ya no salen en pantalla; siguen en la impresión."** En Atlas los dos
  están en pantalla (bloque "Lectura del diagnóstico") y en los documentos. Retirarlos de pantalla es
  decisión de Santiago.

## B6 · La impresión: ya está como él pide, y por su mismo argumento

> *"No unifiques los dos bloques. Parece duplicación y no lo es: es lo que permite reordenar la pantalla sin
> mover una coma del impreso."*

**Atlas está así desde el 24 de octubre**, y llegamos por el mismo camino: el taller del nutricionista son
3.500 líneas de campos en vivo, así que lo imprimible es una hoja aparte (`hoja-del-protocolo.tsx`) armada
con lo **guardado**, y el taller va `no-print`. Ayer eso se extendió a las nueve superficies. **Nada que
hacer, y conviene decírselo:** el riesgo que su nota previene ya está cubierto por construcción.

---

## Lo que se puede construir sin esperar a nadie

1. **Las once identidades imposibles del QC biológico** (§A2). No dependen de un umbral. Y con ellas,
   nuestra propuesta de una docena: grasa ≤ 0.
2. **El borrado lógico del paciente** (§B1), que es lo que él pidió y además lo único que nuestro documento
   legal permite. Falta su decisión sobre el freno de la huella.
3. **Soltar la cifra manual de calorías al cambiar el peso meta** (§B5). Es un defecto nuestro.
4. **Mover las condiciones de la toma a Antropometría** (§B3), si Santiago quiere.

## Lo que espera a Gildardo

1. Los **cortes de `QC_BIO_LIMITES`**, con la advertencia de método de §A2 delante.
2. Los **tres cortes de la Diana**, y si el radar y el DFI se igualan a ella.
3. **Cuál Harris-Benedict manda** (1919 o 1984), y sobre qué se aplica el 10 %.
4. Si el **recálculo versionado** de los diagnósticos ya emitidos entra con el bump del motor.
5. El **aviso de realimentación**, que sale del motor viejo (§A5).

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
