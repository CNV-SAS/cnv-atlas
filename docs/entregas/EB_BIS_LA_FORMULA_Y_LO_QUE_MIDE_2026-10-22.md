# La Edad Bioeléctrica en Atlas: la fórmula exacta y lo que da sobre 361 mediciones reales

**Para:** Gildardo de Jesús Uribe Gil, Dirección Científica CNV · **Vía:** Santiago
**Fecha:** 22 de octubre de 2026 · **Motor:** `1.0.0` (congelado, portado de `ATLAS_v7.html`)

---

## Lo primero, porque cambia qué hay que revisar

**El porte es exacto.** Se verificó en una fila real, término por término, y da el valor sellado al
decimal. Así que la incoherencia que usted ve **no está en nuestra implementación: está en la fórmula o en
su calibración**. Debajo está la fórmula tal cual corre, y después las tres cosas que la cohorte real
muestra y que explican el número entero.

**Y el resumen en una línea:** la EB-BIS **no lleva la edad cronológica en ningún término**, y el ICEC se
z-normaliza contra una media de 58,58 cuando la cohorte real marca **76,78**. Entre las dos cosas, la EB-BIS
sale con **media 29,9 años** frente a una edad real media de **42,9**, y el IAE sale **negativo en casi
todos** por construcción.

---

## 1 · La fórmula, tal como corre

Vive en `src/clinical-engine/frozen/engine.indices.js`, extraída verbatim del bloque L5695-L5721 de
`ATLAS_v7.html`. Marcada **NO EDITAR A MANO**; los golden tests suenan si se desalinea.

### 1.1 · EB-BIS v5 · Edad Biológica Celular

```
EB-BIS = 41,438
       + 1,082 · z(IFC ; mu = 4,0146  sd = 2,2669)
       + 2,837 · z(PABU; mu = 1,8303  sd = 0,7741)
       - 7,982 · z(ICEC; mu = 58,578  sd = 13,332)

con  z(v, mu, sd) = (v - mu) / sd      [sd > 0; si el valor no es numerico, z = 0]
```

Se redondea a **un decimal**. **Si el ICEC es nulo, devuelve `null`**: no se inventa una edad biológica, y
eso es deliberado y está escrito así en el código.

**Tres términos, y ninguno es la edad.** El 41,438 es la constante; no hay un `+ edad` ni un
`+ coef · edad` en ninguna parte.

### 1.2 · IAE · Índice de Aceleración del Envejecimiento

```
IAE = EB-BIS - edad cronologica        (un decimal)
```

### 1.3 · De dónde sale cada insumo

| insumo | fórmula | de dónde |
|---|---|---|
| **IFC** | `C / Rinf * 1000` | medición BIS (capacitancia de membrana y resistencia infinita) |
| **PABU** | `(Re + Ri) * k / (Rinf * C)`, con **k por sexo: H = 0,78 · M = 0,46** (sin sexo 0,9) | medición BIS |
| **ICEC** | `calcLE8(encuesta).total` = promedio simple de **ocho dominios** puntuados 0-100 | ENCUESTA |
| **edad** | años cumplidos desde la fecha de nacimiento del perfil | ficha del paciente |

Los ocho dominios del ICEC (cada uno 0-100, promedio simple, sin pesos): actividad física,
alimentación (el score del patrón alimentario), tabaco, sueño, glucosa, colesterol, presión arterial e
hidratación. Si falta **cualquiera** de los ocho insumos que lee, `calcLE8` devuelve `total = null` y con
eso la EB-BIS no sale (guarda autorizada por usted el 2026-08-13 §1, ampliada a ocho el 2026-09-06).

### 1.4 · La verificación del porte, en una fila real

Medición del 2026-09-23, hombre, 42 años:

```
Re = 465,8   Ri = 1059,2   Rinf = 323,525   C = 3,94   ICEC = 75

IFC  = 3,94 / 323,525 * 1000                      = 12,1783      (sellado: 12,1783)
PABU = (465,8 + 1059,2) * 0,78 / (323,525 * 3,94) =  0,93317      (sellado:  0,93317)

z(IFC)  = (12,1783 - 4,0146) / 2,2669 = +3,6012
z(PABU) = ( 0,9332 - 1,8303) / 0,7741 = -1,1589
z(ICEC) = (75      - 58,578) / 13,332 = +1,2318

EB-BIS = 41,438 + 1,082*(3,6012) + 2,837*(-1,1589) - 7,982*(1,2318)
       = 41,438 + 3,896 - 3,288 - 9,832
       = 32,21                                    (sellado: 32,2)   ✓
IAE    = 32,2 - 42 = -9,8                         (sellado: -9,8)   ✓
```

---

## 2 · Lo que da sobre la cohorte real

**361 mediciones**, filtradas como corresponde: sin pacientes ni profesionales de prueba, sin evaluaciones
reemplazadas ni retiradas. Todas con motor `1.0.0`.

### 2.1 · Las salidas

| | n | media | sd | mín | máx |
|---|---|---|---|---|---|
| **EB-BIS** | 361 | **29,89** | 6,47 | 17,2 | 56,9 |
| **edad cronológica** | 347 | **42,94** | 13,36 | 9 | 81 |
| **IAE** | 361 | **-11,65** | 19,30 | -208,1 | 41,8 |

### 2.2 · Los insumos: lo que la fórmula supone contra lo que hay

| insumo | la fórmula supone | la cohorte real | |
|---|---|---|---|
| **ICEC** | mu 58,578 · sd 13,332 | **mu 76,78 · sd 10,10** | **+18,2 de media**, y 24 % menos dispersión |
| **PABU** | mu 1,8303 · sd 0,7741 | mu 1,673 · sd 0,529 | -0,16 de media, 32 % menos dispersión |
| **IFC** | mu 4,0146 · sd 2,2669 | mu 3,863 · sd 2,060 | la media cuadra; **la sd no**, y por una razón de fondo (2.4) |

### 2.3 · Cuántos años mueve de verdad cada término

| término | coeficiente | aporte medio | sd del aporte | rango |
|---|---|---|---|---|
| IFC | +1,082 | **-0,07 años** | 0,98 | -1,5 a +3,9 |
| PABU | +2,837 | **-0,57 años** | 1,94 | -4,7 a +9,8 |
| **ICEC** | **-7,982** | **-10,90 años** | 6,05 | -22,4 a +13,6 |

**La cuenta cierra exactamente:** 41,438 - 10,90 - 0,57 - 0,07 = **29,90**, que es la media medida de
EB-BIS. **El 94 % del desvío sale del término del ICEC.**

### 2.4 · El IFC está partido por sexo, y la EB-BIS es el único sitio que lo ignora

| IFC | n | media | sd | p25 | p75 |
|---|---|---|---|---|---|
| hombres | 92 | **6,47** | 1,99 | 5,30 | 7,35 |
| mujeres | 269 | **2,97** | 1,11 | 2,29 | 3,46 |

**Las dos distribuciones casi no se solapan**, y eso coincide con sus propios cortes recalibrados sobre la
cohorte de 6.063 (hombres: bajo < 4,12 · normal 4,12-6,68 · alto > 6,68; mujeres: bajo < 2,08 · normal
2,08-3,28 · alto > 3,28).

**Y ahí está la asimetría:** el clasificador `cIFC` **sí** distingue sexo, y `calcPABU` **sí** usa una `k`
distinta por sexo (0,78 contra 0,46, un 70 % de diferencia). La **EB-BIS es el único punto de la cadena que
z-normaliza con una media y una desviación únicas**, agregando a hombres y mujeres.

El efecto: la sd 2,2669 que la fórmula usa es la **sd agregada**, inflada por la diferencia entre sexos. La
sd dentro de cada sexo es 1,99 y 1,11. Así que el término del IFC queda **comprimido casi a cero** (su
aporte tiene sd de 0,98 años sobre un rango teórico de ±7) y **la función celular, que es el corazón del
modelo, casi no mueve la edad biológica**.

---

## 3 · Lo que hace incoherente al IAE, y es estructural

**La EB-BIS no contiene la edad.** Su valor esperado para alguien promedio en los tres índices es 41,438
años, tenga 18 o 70. Así que el IAE, que es `EB-BIS - edad`, es **casi una función lineal de menos la
edad**. Medido: **r(IAE, edad) = -0,70**.

Por décadas:

| década | n | EB-BIS media | edad media | IAE medio |
|---|---|---|---|---|
| 0-9 | 1 | 31,9 | 9,0 | **+21,9** |
| 10-19 | 8 | 28,4 | 16,5 | **+11,9** |
| 20-29 | 51 | 29,3 | 25,2 | +4,1 |
| 30-39 | 85 | 28,8 | 35,5 | -6,8 |
| 40-49 | 100 | 29,4 | 44,2 | -13,9 |
| 50-59 | 62 | 29,9 | 54,6 | -24,7 |
| 60-69 | 32 | 33,8 | 63,7 | -29,9 |
| 70-79 | 7 | 34,8 | 75,9 | **-41,1** |
| 80-89 | 1 | 28,5 | 81,0 | **-52,5** |

**La EB-BIS es plana:** se mueve entre 28,4 y 34,8 a lo largo de setenta años de edad cronológica. En
consecuencia, **todo menor de ~41 sale "acelerado" y todo mayor de ~41 sale "desacelerado"**, con
independencia de sus células. Un paciente de 76 años sale con 41 años de desaceleración y uno de 16 con 12
de aceleración.

Esto no es un error de cálculo: es una propiedad de la fórmula tal como está escrita. Si la EB-BIS debe ser
una edad **comparable** con la cronológica, el modelo necesita o un término de edad, o una recalibración del
intercepto, o que el IAE se defina de otro modo. **Eso es decisión suya, no nuestra** (Regla 0: el archivo
manda en lo clínico; nosotros no corregimos su matemática, la reportamos).

---

## 4 · Tres cosas de datos que hay que saber antes de mirar el CSV

### 4.1 · Tres filas con una edad inválida, y su IAE es ficción

| evaluación | edad real hoy | la edad que entró al motor | IAE sellado |
|---|---|---|---|
| `a2ce960c` | 46 | **0** | +28,1 |
| `bcf91875` | 51 | **231** | **-208,1** |
| `be1a0288` | 49 | **0** | +41,5 |

Son los tres pacientes cuya fecha de nacimiento estaba mal digitada y se corrigió por script el 2026-10-09
(`1795-02-21`, `41980-04-19`, `51977-02-08`). El diagnóstico ya estaba sellado con la fecha mala, y
corregir la fecha **no rehace el diagnóstico** (eso va por el camino de corrección versionada).

**La causa técnica, y es nuestra, no suya:** la función que calcula la edad para el motor devuelve **0**
cuando la fecha no se puede leer, en vez de negarse. Con `41980-04-19` la fecha es ilegible, la edad entra
como 0, y el IAE sale igual a la EB-BIS entera: un número que **se lee perfectamente plausible** (+28,1
años de aceleración) y es pura invención. Con `1795-02-21` la fecha sí se lee, da 231 años y el IAE sale
-208,1.

Queda **reportado, no cambiado**: cambiarlo altera lo que el motor acepta y eso se decide, no se improvisa.
En el CSV esas tres filas van marcadas en la columna `aviso_edad`, y **se deben excluir** de cualquier
análisis.

### 4.2 · La edad se calcula al momento de DIAGNOSTICAR, no al de medir

La edad que entra al motor sale de la fecha de nacimiento contra **la fecha en que se corre el pipeline**.
Para una medición importada y diagnosticada meses después, es la edad de ese día, no la del día de la toma.
En el CSV van las dos (`edad_a_la_medicion` y `edad_que_uso_el_motor`) para que la diferencia se vea.

### 4.3 · El ICEC no se guarda como indicador

De los tres insumos de la EB-BIS, el ICEC es el único que **no** está en `indicator_values`: vive dentro del
snapshot del reporte (`dfi.le8Total`). El CSV lo trae de ahí. Se verificó por dos caminos independientes
(leerlo del snapshot y despejarlo de la propia fórmula) y los dos dan la misma distribución, lo que confirma
una vez más que el porte es fiel.

---

## 5 · Los archivos, y una advertencia sobre la muestra

Los genera `scripts/datos-eb-bis-para-gildardo.mjs`, que **solo lee**. Salen a `docs/entregas/dudas/`, que
está entero fuera de git.

| archivo | filas | contenido |
|---|---|---|
| `eb-bis-cohorte.csv` | **366** | seudonimizado, toda la cohorte real. **Es el único que sale por defecto** |
| `eb-bis-de-gildardo.csv` | 9 | identificado (nombre y documento), solo sus pacientes. Solo con `--identificado` |

> ⚠ **Nueve filas no alcanzan para ver el patrón de una fórmula.** Las nueve evaluaciones con diagnóstico
> asignadas a usted son muy pocas, y además la cohorte está concentrada: 306 de las 361 son de una sola
> integrante. El archivo que responde la pregunta es el de la cohorte, y al no llevar nombre ni documento se
> puede compartir con mucho menos riesgo. El enlace entre los dos archivos es el id de la evaluación.

**Actualización del 2026-10-24.** Usted pidió solo el archivo de cohorte, con cinco columnas más de
composición, y dijo que el identificado no hace falta. Así quedó:

- **El identificado dejó de generarse por defecto.** Ahora hace falta pasar `--identificado` a propósito.
  Un archivo con nombre y cédula que se escribe sin que nadie lo pida es un archivo que alguien encuentra
  después sin saber qué trae.
- **La cohorte subió de 361 a 366 filas.** Son cinco evaluaciones diagnosticadas entre el 22 y el 24 de
  octubre, con los mismos filtros. Las cifras del cuerpo de este informe son las de las 361; el orden de
  magnitud no se mueve (EB-BIS media 29,91 contra 29,90; ICEC 76,74 contra 76,78).

### 5.1 · Las cinco columnas de composición, y la que casi no existe

| columna | filas con dato | de 366 | distribución |
|---|---|---|---|
| `peso_kg` | **366** | completa | media 73,67 · sd 14,81 · 47,0 a 134,0 |
| `talla_cm` | **366** | completa | media 163,96 · sd 8,55 · 141,4 a 188,5 |
| `MLG_kg` | **366** | completa | media 50,05 · sd 9,84 · 34,11 a 84,99 |
| `ACT_L` | **366** | completa | media 35,71 · sd 7,28 · 24,89 a 61,68 |
| `masa_seca_sin_grasa_kg` | **366** | completa | media 14,34 · sd 2,73 · 7,99 a 23,30 |
| `fuerza_prensil_kgf` | **36** | ⚠ **330 vacías** | media 28,61 · sd 6,93 · 19,0 a 45,2 |

Tres cosas sobre esas columnas:

1. **El peso y la talla son los de LA MEDICIÓN, no los de la ficha de hoy, y no había manera de
   equivocarse.** `patient_profiles` no guarda peso ni talla: el único sitio donde existen es
   `bis_raw_values`, atado a la toma BIS. Si alguna vez se corrigió a mano (peso, estatura, cintura o
   cadera, y solo antes del diagnóstico), lo que va en el CSV es el valor vigente, y el crudo original del
   aparato queda aparte como evidencia.

2. **La masa seca sin grasa la guarda el equipo, así que va la del equipo y no la calculamos.** Usted
   ofreció calcularla como MLG − ACT por si no la teníamos. La tenemos, en las 366 filas. Y de paso
   verifiqué su cuenta contra la del aparato: coinciden en las 366, con una diferencia máxima de
   **0,001 kg**, que es el redondeo. O sea que su fórmula es exactamente la del equipo; lo que va en el CSV
   es el campo medido, no una cifra nuestra.

3. **La fuerza prensil la tienen 36 de 366 filas, y eso es un 10%.** No es un hueco de la base: es que la
   mide el profesional con dinamómetro, es opcional en la pantalla de entrada, y casi nadie la registra.
   **Con 36 filas no se sostiene un análisis**, y menos repartidas entre integrantes. Si la prensil va a
   entrar en la revisión de los indicadores, la conversación previa es otra: que deje de ser opcional, o
   que se mida en una cohorte a propósito. Como está, la columna sirve para mirar casos, no para medir.
   Con un detalle que apunta a lo mismo: **usted sí la registra.** De sus nueve filas diagnosticadas, siete
   traen prensil; de las 357 restantes, veintinueve. El dato no falta porque sea difícil de tomar.

### Diccionario de columnas

| columna | qué es |
|---|---|
| `evaluacion` | id de la evaluación (único; une los dos archivos) |
| `profesional` | letra anónima en el archivo de cohorte; nombre en el identificado |
| `tipo` | inicial / seguimiento |
| `sexo` | M / F (estricto; el motor no adivina) |
| `fecha_medicion` | fecha de la toma BIS |
| `edad_a_la_medicion` | años cumplidos a la fecha de la toma, desde el nacimiento de HOY |
| `edad_que_uso_el_motor` | despejada de `EB_BIS - IAE`: la que de verdad entró al cálculo |
| `edad_del_equipo` | la edad que traía el export del Biody (cotejo; es decimal) |
| `aviso_edad` | vacío = cuadra. Si trae algo, **el IAE de esa fila no es confiable** |
| `Re`, `Ri`, `Rinf`, `C` | resistencia extracelular, intracelular, infinita y capacitancia de membrana (nF) |
| `AF` | ángulo de fase a 50 kHz (grados) |
| `R50`, `Xc50`, `Fo` | resistencia y reactancia a 50 kHz, y frecuencia característica |
| `origen_crudos` | `medido` = lo trajo el equipo · `derivado` = lo reconstruyó la derivación de espectro |
| `peso_kg` | peso en kg **a la fecha de la medición** (columna `Peso kg` del export) |
| `talla_cm` | talla en cm a la fecha de la medición (columna `Altura cm`) |
| `MLG_kg` | masa libre de grasa, kg (columna `Masa sin grasa`, valor calculado del equipo) |
| `ACT_L` | agua corporal total, litros (columna `Agua total`, valor calculado del equipo) |
| `masa_seca_sin_grasa_kg` | kg, **la del equipo** (columna `Masa seca sin grasa`), no calculada por nosotros |
| `origen_composicion` | lo mismo que `origen_crudos`, para las cinco columnas de arriba |
| `fuerza_prensil_kgf` | Kgf del dinamómetro. **Vacío = no se midió** (es opcional), no "falta el dato" |
| `IFC`, `PABU` | sin redondear, como los selló el motor |
| `ICEC_LE8` | el total del LE8 (0-100) con el que se calculó la EB-BIS |
| `EB_BIS`, `IAE` | las dos salidas, con un decimal |
| `IRC`, `FMI`, `FFMI`, `ISCM`, `IEHH` | los demás índices de la misma evaluación, por si sirven de contexto |
| `version_motor`, `version_reglas` | constelación de versiones de ese sello (regla dura 7) |

---

## 6 · Las cuatro preguntas que le devuelvo

Son las que no podemos contestar de este lado, porque son suyas:

1. **¿La EB-BIS debe llevar un término de edad cronológica?** Tal como está, no lo lleva, y de ahí sale
   que el IAE sea casi `-edad`. Es lo que más explica la incoherencia que usted ve.
2. **Las medias y desviaciones de los tres z-scores (58,578 / 13,332 para el ICEC; 1,8303 / 0,7741 para la
   PABU; 4,0146 / 2,2669 para el IFC): ¿de qué cohorte salieron?** Porque la nuestra marca ICEC 76,78 y
   PABU 1,673, y ese desfase solo en el ICEC vale **-10,9 años** en todos los pacientes.
3. **¿La EB-BIS debería distinguir sexo, como ya lo hacen `cIFC` y la `k` de la PABU?** Hoy es el único
   punto de la cadena que no lo hace, y el efecto es que el término del IFC queda inerte.
4. **¿El ICEC debe pesar 7,4 veces más que el IFC?** Con los coeficientes actuales, ocho preguntas de
   estilo de vida mueven la edad biológica casi ocho veces más que la medición bioeléctrica.

Si de ahí sale una corrección de coeficientes o de calibración, **el camino para rehacer los 390
diagnósticos ya existe** y está dimensionado en `SMOKE_SEGUNDO_2026-09-28.md`, sección 9: crea una versión
nueva de cada evaluación sin sobrescribir nada, y la anterior queda legible como reemplazada. Falta una
condición de tres líneas y un script; son 10 a 20 minutos de corrida.
