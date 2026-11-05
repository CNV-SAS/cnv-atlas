# Atlas · gobierno del dato de investigación: lo que hay, lo que falta y qué decidir

**Connected Nutrition Ventures · 5 de noviembre de 2026**
**Para:** el chat dedicado a manejo de datos
**De:** el equipo técnico de Atlas

> **Este documento no contiene ningún dato de paciente:** ni nombres, ni documentos, ni filas. Solo
> conteos, estructuras y decisiones.

---

## 0 · Para qué se pide esta guía

Atlas es la plataforma clínica de CNV. Su cohorte ya tiene volumen real (cifras de hoy abajo) y el modelo
de negocio incluye **vender información estadística anonimizada**. Dos piezas del gobierno del dato están
**dimensionadas y sin construir a propósito**, esperando criterio: la verificación de k-anonimato **fila a
fila** y la **custodia de la llave de seudonimización**. No se construyen hasta tener esta guía, porque
elegir mal el diseño de la llave es caro de deshacer: condiciona qué se puede entregar y qué se puede
responderle después a un paciente que pregunta.

**Las cifras de la cohorte, a hoy** (producción, contadas sobre evaluaciones distintas):

| | |
|---|---|
| Consultas vigentes de pacientes reales | 667 |
| De ellas, con autorización de investigación | ~584, de 346 pacientes distintos |
| Pacientes en total | 621 |
| Mediciones de bioimpedancia con sus valores crudos | 352 limpias (47.624 filas de valores) |
| Importadas de la herramienta anterior (HTML), sin casilla de investigación | 150 consultas |

---

## 1 · Lo que ya hay construido

### 1.1 · Dos vistas, y la frontera está en ellas

Todo lo de investigación sale de dos vistas de base de datos, no de las tablas clínicas:

- **`evaluaciones_vigentes`**: el universo clínico. Una fila por consulta hecha, de paciente real, no
  reemplazada por una corrección y no retirada.
- **`evaluaciones_para_investigacion`**: la anterior **filtrada por la autorización del paciente**
  (casilla opcional de investigación, vigente y no revocada), y además excluye las consultas cuya medición
  está repetida en otra historia clínica (control de calidad del dato: la misma toma física en dos
  consultas).

**Las dos vistas están revocadas a los roles de aplicación (`anon`, `authenticated`) a propósito.** Solo se
leen como propietario desde el servidor, y la autorización la pone una policy de la aplicación. No son una
puerta alrededor de los permisos por fila de las tablas clínicas.

**Qué columnas llevan y cuáles no:** llevan el `patient_id` (ver 1.3), el id de la consulta, la fecha, el
profesional, la versión del motor, los ids de medición y de diagnóstico, y banderas derivadas. **No llevan
nombre, documento, teléfono, correo ni texto libre del profesional.**

### 1.2 · Tres niveles, derivados y no escritos a mano

Cada salida se rotula con uno de tres niveles, y el rótulo **lo calcula una función** a partir de las
columnas que la salida lleva (si mañana una vista deja de llevar la llave, el rótulo cambia solo):

| Nivel | Qué significa aquí | Dónde aplica hoy |
|---|---|---|
| **Agregado** | Conteos y promedios por grupo. Ninguna fila de paciente cruza la frontera | La pantalla de investigación y el CSV que se descarga |
| **Seudonimizado** | Filas sin identificadores directos, pero con una llave estable que permite volver a la persona | Lo que sería un export fila a fila de la vista. **No existe: está cerrado** |
| **Anonimizado** | Sin llave y con los cuasi-identificadores tratados | **No existe todavía** |

### 1.3 · La llave de hoy es el `patient_id`, y es deliberado

La vista de investigación lleva `patient_id` **a propósito**: es lo que permite el análisis longitudinal
(unir las consultas de una misma persona a lo largo del tiempo), que es la razón científica por la que la
cohorte vale. Mientras nada salga fila a fila, esa llave no cruza ninguna frontera: la pantalla agrega y el
archivo lo construye un módulo que no la recibe.

### 1.4 · Lo que sale hoy, y cómo queda registrado

Una sola salida: **un CSV del resumen agregado**, descargable desde la pantalla de investigación por quien
tiene ese rol. Lleva las cifras de la cohorte y sus desgloses por cuatro ejes (país, ciudad, sexo,
profesional), con cinco columnas cada uno (consultas, pacientes, con bioimpedancia, con espectro, edad
media). **Sin filas de paciente**, y eso no es una promesa del comentario: el archivo lo construye un módulo
puro que solo recibe el resumen agregado.

**Cada descarga queda registrada** en una tabla de datasets, con su alcance en palabras (incluido el filtro
aplicado, si había), su nivel de anonimización, quién la pidió y cuándo, más un asiento en el registro de
auditoría clínica. El registro se escribe **antes** de entregar el archivo: si el registro falla, no sale
nada.

### 1.5 · La supresión de celdas pequeñas: construida el 3 y el 5 de noviembre

- **k ≥ 5 por celda.** Toda categoría de los cuatro desgloses con **menos de cinco pacientes** no se
  muestra por separado: se reúne en una fila rotulada, con sus cifras sumadas, para que las columnas sigan
  cuadrando con el total. El umbral se mide sobre **pacientes distintos**, no sobre consultas (una persona
  con cinco consultas es una persona).
- **Supresión secundaria.** Si al reunir las categorías pequeñas la fila reunida sigue por debajo de cinco,
  absorbe la categoría visible más pequeña hasta llegar al umbral; y si ni absorbiendo todas se llega, **la
  tabla entera no se publica** y se dice por qué.
- **Umbral de cohorte.** La pantalla permite filtrar (país, ciudad, sexo, profesional, rango de edad, rango
  de fechas, con bioimpedancia, con espectro). Un filtro estrecho puede dejar la cohorte **entera** en una
  persona, y entonces no hay categoría que suprimir porque la cohorte es la categoría: con menos de cinco
  pacientes se siguen mostrando los conteos, pero **las cifras de edad se anulan** y los desgloses no se
  publican. El archivo se niega a generarse.
- **Aplicado donde nace el dato**, no en cada pantalla: el lector entrega los datos ya suprimidos, así que
  ninguna superficie puede olvidarlo.

**Por qué era necesario y no preventivo:** el archivo traía celdas de **un** paciente, con su ciudad y su
edad media al lado. Una fila así no es una cifra agregada: es una persona descrita por dos
cuasi-identificadores.

---

## 2 · Las condiciones legales que ya tenemos

Dos consultas jurídicas, ya resueltas, y las dos están implementadas en el texto del consentimiento o en el
código:

### 2.1 · Decisión del 20 de octubre de 2026: la finalidad es ANONIMIZAR

El consentimiento declaraba como finalidad necesaria *"generar y comercializar información estadística
anonimizada"*. Eso dejaba la casilla atacable (el parágrafo del artículo 6 de la Ley 1581 prohíbe
condicionar un servicio a la entrega de datos sensibles) y, al compartir casilla con la evaluación, el
ataque alcanzaba a la casilla completa.

**Lo decidido:** la finalidad necesaria pasa a ser **el acto de anonimizar**, informando que lo anonimizado
puede comercializarse. El razonamiento: el dato verdaderamente anonimizado **no es dato personal**, así que
venderlo no requiere autorización de nadie; el único tratamiento del dato personal es el acto de
anonimizar, y ese sí necesita cobertura. Y anonimizar sirve al paciente de forma directa: construye las
referencias poblacionales con las que se interpretan sus propios resultados.

Está implementado como una versión nueva del consentimiento, marcada **no sustantiva**: quien firmó la
anterior conserva su autorización y nadie re-firma.

### 2.2 · Consulta del 3 de noviembre de 2026: la condición técnica, y es única

- *"Anonimizada"* no es *"sin nombre"*. Una salida comercializable exige **k-anonimato con k ≥ 5 y
  supresión de celdas pequeñas, aplicados TÉCNICAMENTE**, antes de la primera venta. Sin eso, el derivado
  sigue siendo dato personal por reidentificación y la finalidad declarada no lo cubre.
- **La condición es única e igual para todos los pacientes, sin filtro por origen.** Los 150 traídos de la
  herramienta anterior también entran en conjuntos anonimizados comercializables: su propia finalidad cubre
  el acto de anonimizar, y la promesa de no vender *"sus datos"* se lee referida a datos **personales**.
- **Lo que su consentimiento NO cubre es nada seudonimizado** (investigación con filas, control de
  calidad): eso queda fuera hasta que firmen el consentimiento actual. Hoy ocurre solo, porque no tienen
  esas autorizaciones.

---

## 3 · Lo que falta, en tres piezas

### Pieza 1 · El k-anonimato FILA A FILA

**Lo que está hecho:** el de celdas (punto 1.5). **Lo que falta:** el de un dataset con una fila por
consulta, que es el que una colaboración académica va a pedir.

**Lo dimensionado.** Los cuasi-identificadores de nuestra cohorte, con lo que hoy llevaría cada fila:

| Cuasi-identificador | Hoy | Problema |
|---|---|---|
| **Edad** | Entera, calculada a la fecha de la medición | Con ciudad y sexo, identifica en un municipio pequeño |
| **Sexo** | M / F | Divide la cohorte en dos: multiplica el riesgo de las demás |
| **Ciudad** | Texto libre tecleado al registrar | 621 pacientes repartidos en decenas de municipios; hay ciudades con un paciente |
| **Profesional** | Id del profesional que atendió | Es nuestro equipo, no el sujeto de estudio, pero **agrupa**: un profesional con pocos pacientes los identifica |
| **Fecha de la consulta** | Día exacto | Una fecha exacta más una ciudad es casi un identificador |
| **Las mediciones** | ~90 variables numéricas por consulta | No son cuasi-identificadores en el sentido clásico, pero una combinación de 90 números con muchos decimales es única por construcción |

**Las decisiones abiertas, que son las que pedimos:**

1. **Hasta dónde generalizar.** Lo estándar sería: edad en rangos de cinco años, ciudad a departamento o a
   región, fecha a mes o trimestre, y el profesional fuera o agrupado. **¿Es ese el nivel correcto para una
   cohorte de 600 personas, o hace falta más?**
2. **Qué hacer con las 90 variables numéricas.** Son el valor científico del dataset, y a la vez lo que lo
   vuelve único fila a fila. **¿Se entregan con todos sus decimales, se redondean, o el riesgo de
   reidentificación por ellas es despreciable sin un dataset externo con el que cruzarlas?**
3. **Qué modelo de privacidad.** k-anonimato es el que la consulta jurídica nombra, pero no protege de la
   inferencia por atributo (si las cinco personas de una celda comparten el diagnóstico, la celda lo
   revela). **¿Hace falta l-diversidad o algo más, o k ≥ 5 es suficiente para este caso y este tamaño?**
4. **Quién verifica y cómo se afirma.** Hoy el nivel lo calcula una función y el registro lo afirma. Para un
   dataset fila a fila, **¿la verificación tiene que ser un informe revisable por un tercero, o basta con
   que el sistema la aplique y la registre?**

### Pieza 2 · La supresión de celdas pequeñas

**Construida** (punto 1.5). Lo que queda son dos preguntas de criterio:

1. **El umbral.** Usamos k ≥ 5, que es lo que la consulta jurídica fija y la práctica internacional usa.
   **¿Hay razón para subirlo en una cohorte de este tamaño, o para bajarlo en algún eje?**
2. **Hasta dónde llega "toda salida".** Hoy se aplica en la pantalla y en el archivo. **¿Debe aplicarse
   también a lo que se muestra dentro de la propia organización** (el panel que ve la dirección científica),
   o ahí el límite es otro? Hoy lo aplicamos igual, por consistencia; es una decisión que conviene
   confirmar.

### Pieza 3 · La custodia de la llave de seudonimización

**Es la condición abierta más grande, y es la que bloquea el fila a fila.**

**Lo dimensionado, con su tamaño:**

| Pieza | Qué es | Tamaño |
|---|---|---|
| Un **id de investigación** por paciente, distinto del id interno | Un identificador sin significado, estable en el tiempo, que es el que viaja en el dataset | Columna, relleno y el cambio en la vista |
| La **tabla de correspondencia, separada** | id de investigación ↔ id del paciente, en su propio esquema, sin acceso desde la aplicación | Pequeña, pero exige decidir **quién** la puede abrir |
| **Rotación por dataset** | Un id distinto por entrega, derivado de la llave y del id del dataset, para que dos datasets entregados a terceros distintos no se puedan cruzar | Pequeña, una vez existe la llave |
| **El acto de reidentificar** | Cuándo se permite, quién lo aprueba y dónde queda registrado | Cabe en el mecanismo de accesos excepcionales que ya existe |

**Y la decisión que hay que tomar ANTES de construir nada, porque cambia las cuatro:**

> **¿La correspondencia se GUARDA o se DESTRUYE por dataset?**
>
> - **Guardarla** es seudonimización reversible: permite contestarle a un titular que pregunta, permite
>   avisarle de un hallazgo, y permite el análisis longitudinal entre entregas. Y mantiene el dato dentro
>   de la ley de datos personales.
> - **Destruirla** por dataset es anonimización irreversible: permite vender sin más condiciones, y
>   renuncia a volver atrás si hay que avisarle algo a alguien.
>
> **No son dos grados de lo mismo: son dos decisiones opuestas.** Nuestra lectura es que para la
> investigación científica (que es longitudinal) hace falta la primera, y que para una venta a un tercero
> hace falta la segunda, lo que implicaría **dos caminos distintos** y no uno. **¿Es correcto, o hay una
> forma de tener uno solo?**

**Nuestras preguntas concretas para este chat:**

1. **¿Dónde debe vivir la tabla de correspondencia?** Otro esquema de la misma base, otra base, o fuera de
   la nube. Hoy todo está en una sola base gestionada (Supabase, región Estados Unidos).
2. **¿Quién puede abrirla?** En una empresa pequeña las mismas personas cumplen varios roles, así que esto
   se resuelve con control técnico de acceso y no con organigrama. **¿Dos personas? ¿Una con registro
   auditado? ¿Un proveedor externo?**
3. **¿Cómo se deriva el id de investigación?** Un valor aleatorio guardado, o un hash con sal secreta del id
   interno. Lo segundo no necesita tabla si la sal se guarda bien; lo primero no se puede recomputar si la
   tabla se pierde. **¿Cuál prefieren, y por qué?**
4. **¿La rotación por dataset es exigible desde la primera entrega**, o es una mejora para cuando haya
   varias?

---

## 4 · Qué pedimos de este chat, en una línea

**Una guía de diseño para las piezas 1 y 3**, con las decisiones de los puntos de arriba tomadas o con el
criterio para tomarlas. Mientras no llegue, **no se construye ninguna de las dos**: la pantalla de
investigación entrega solo agregados con k ≥ 5, el fila a fila está cerrado con su razón escrita en la
propia pantalla, y ningún dataset se ha entregado todavía (la tabla de entregas tiene las descargas del
resumen y nada más).

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
