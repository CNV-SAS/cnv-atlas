# Guía de marca de Atlas (CNV)

**Versión:** 1.0

## Identidad y storytelling
Atlas es la plataforma clínica de CNV. Su tono visual es **técnico, claro y riguroso**: cerca de la seriedad de Linear, Notion o Vercel, lejos de apps de wellness o fitness. Comunica que aquí se toman decisiones de salud sobre datos.

> **Atlas convierte señal en sentido.** La bioimpedancia y los datos de la persona entran como medidas crudas; al atravesar el modelo ANI-BIS-E (la capa azul, CNV Data) se vuelven función, riesgo y dirección clínica. Lo que entra disperso, sale claro.

El símbolo (cuadrados negros que entran, atraviesan los paneles y salen en azul condensándose en un círculo) es esa transformación: dato rígido a información organizada y lista para decidir. El **azul** es claridad e inteligencia (el momento del insight, CNV Data); el **casi-negro** es la estructura (lo sólido, lo riguroso).

## Paleta
Dos capas separadas a propósito.

### Capa de marca (identidad, navegación, acciones)
Dos anclas, todo lo demás derivado (como el esmeralda del LMS). Valores aproximados; se afinan al implementar con verificación de contraste WCAG AA.

**Azul de marca (acción, CNV Data)**: primario:
| Token | Hex | Uso |
|---|---|---|
| blue-50 | `#EEF2FF` | Fondos suaves, badges |
| blue-100 | `#DCE4FF` | Hover de fondos |
| blue-500 | `#205DFD` | **Color de marca**, botones, focus, acento CNV Data |
| blue-600 | `#1A4ED6` | Hover de botones |
| blue-700 | `#1640AD` | Texto y links azules sobre blanco (AA) |
| blue-800 | `#123286` | Énfasis fuerte, hero |

`#205DFD` se reserva para botones y elementos grandes; para texto/link en azul sobre blanco se usa `blue-700` (contraste).

**Ink (estructura, foreground)**: neutros fríos derivados del casi-negro:
| Token | Hex | Uso |
|---|---|---|
| ink (`--foreground`) | `#15161A` | Texto principal, headings, paneles oscuros |
| ink-600 (`--muted-foreground`) | `#565B6A` | Subtítulos, descripciones |
| ink-400 | `#9AA0AF` | Labels, captions |
| ink-200 (`--input`) | `#DEE1E8` | Bordes de inputs |
| ink-100 (`--border`) | `#EDEFF3` | Separadores, bordes de cards |
| ink-50 (`--muted`) | `#F6F7F9` | Fondos de áreas |
| white (`--background`, `--card`) | `#FFFFFF` | Fondo base y de cards |

### Capa clínica / semántica (funcional, NO decorativa)
Estos colores codifican riesgo y estado. Son inequívocos y accesibles, y **nunca se reemplazan por el azul de marca**. Los valores definitivos salen de los mapas del modelo (los clasificadores ya devuelven un `color` por banda); estos son defaults a armonizar:
| Estado | Color | Fondo | Uso |
|---|---|---|---|
| Excelente / bajo (DFI) | `#0EA5E9` | `#F0F9FF` | Banda MEJOR de la escala de 4 del DFI (sev 0 "Bajo", radar). Azul clínico propio (sky), NO el de marca |
| Óptimo / normal | `#10B981` | `#ECFDF5` | Banda buena, confirmaciones |
| Alerta / riesgo | `#F59E0B` | `#FFFBEB` | Advertencias, riesgo moderado |
| Crítico | `#DC2626` | `#FEF2F2` | Riesgo alto, alertas clínicas críticas |

Como el azul es la acción primaria, "info/secundario" no se pinta de azul (chocaría); se resuelve con neutros o con el estado correspondiente. El azul **clínico** (`#0EA5E9`, sky) es la única excepción y no choca con esa regla: es un token de ESCALA (la banda mejor del DFI, con su etiqueta y su posición), distinto del azul de acción (`#205DFD`) a propósito, y solo aparece en la escala de severidad. El resto de superficies clínicas siguen con la escala de 3 (óptimo/alerta/crítico); la de 4 es del DFI (radar y tarjetas), que tiene 4 bandas de severidad (Bajo/Leve/Moderado/Alto).

**Matiz de reserva del color de riesgo (2026-07).** El color que *codifica riesgo* (verde óptimo, ámbar alerta, rojo crítico) se reserva para los elementos **clínicos**: clasificaciones, severidades y veredictos (badges de banda, puntos de riesgo, zonas de la Diana y del radar). En todo lo demás (marca, estructura de la interfaz, encabezados de sección o de nivel de tabla, navegación) hay libertad de paleta y se usan neutros o el azul de marca. La consecuencia práctica: los headers estructurales (por ejemplo, las filas de nivel de la tabla de composición) van con **fondo neutro**, no con color de riesgo, para no insinuar una severidad donde solo hay estructura. El principio es que el color de riesgo signifique siempre riesgo y nunca decore.

### Implementación técnica (shadcn v4 + CSS vars)
Los tokens semánticos son **CSS variables** en `src/app/globals.css` (no clases Tailwind crudas). Se overridean los vars de shadcn con `--primary` = azul de marca, `--foreground` = ink, neutros derivados del ink, y `--ring` = azul. La capa clínica vive como tokens propios (`--clinical-excellent`, `--clinical-optimal`, `--clinical-warning`, `--clinical-critical`) o clases explícitas, separada del sistema de marca. Preferir tokens semánticos (`bg-background`, `text-foreground`, `border-border`) sobre crudos.

## Tipografía
**Inter para todo** (titulares y cuerpo). El carácter técnico/arquitectónico del wordmark se logra con peso y tracking, no con otra fuente. Fallback `system-ui, sans-serif`.

| Elemento | Tamaño | Peso | Tracking |
|---|---|---|---|
| Hero h1 | `text-5xl`/`text-6xl` | `font-black` (900) | `tracking-tighter` |
| Sección h2 | `text-3xl`/`text-4xl` | `font-extrabold` (800) | `tracking-tight` |
| Subsección h3 | `text-xl`/`text-2xl` | `font-bold` (700) | `tracking-tight` |
| Card heading h4 | `text-lg` | `font-bold` | normal |
| Body | `text-base` | `font-normal` (400) | normal |
| Body pequeño | `text-sm` | `font-normal` | normal |
| Label / caption | `text-xs` | `font-bold` uppercase | `tracking-widest` |
| Botón | `text-sm` | `font-semibold` (600) | `tracking-wide` |

`font-black` solo en titulares y labels uppercase, nunca en bloques largos.

## Radios, espaciado, sombras
- **Radios:** `rounded-lg` (8, inputs/badges), `rounded-xl` (12, botones), `rounded-2xl` (16, cards), `rounded-3xl` (24, destacados), `rounded-[2rem]` (32, modales/hero). Máximo 40px. Atlas es software clínico: nada de radios "concept art".
- **Espaciado:** base 4px. Padding estándar `p-6`; secciones `p-10`/`p-12`; hero `p-16`.
- **Sombras:** `shadow-sm` (cards en reposo), `shadow-md` (elevados), `shadow-lg` (modales), `shadow-xl` con tinte azul (`shadow-blue-100`) para botones primarios destacados.

## Iconografía
Única librería: **lucide-react**. Tamaños `w-4` (inline) a `w-12` (hero). No mezclar con otras librerías.

## Componentes
Toda la primitiva de **shadcn/ui v4** (Button, Input, Label, Textarea, Card, Dialog, Sheet, Dropdown, Avatar, Badge, Alert, Toast vía sonner, Progress, Tabs, Select, Form, Skeleton, Table). Lo complejo se compone de primitivas, no se descarga aparte.

## La Diana (visualización insignia)
El gráfico polar de 81 estados es la imagen característica de Atlas. Reglas: usa la **capa clínica** de color (no la de marca); **no depende solo del color** para comunicar riesgo (también etiqueta y posición), por accesibilidad; se renderiza como SVG. Es un componente custom, no una librería de charts genérica.

## Tono de voz
- Tuteo en español neutro (usted en documentación legal).
- Sin signos de exclamación (salvo bienvenida puntual), sin emojis en UI, sin exageraciones ("súper", "increíble").
- Mensajes orientados al usuario: "Has completado la evaluación", no "Evaluation completed".
- **Tono clínico, factual, no alarmista.** Al mostrar riesgo o un estado crítico, el copy es descriptivo y sobrio, nunca dramático. El profesional interpreta; el reporte al paciente es descriptivo, no interpretativo.
- **Sin em-dash en texto de cara al usuario** (UI, correos, reportes, PDFs). Coma, punto, paréntesis o punto y coma.

| Bueno | Malo |
|---|---|
| Has completado la evaluación | ¡Listo! Completaste todo 🎉 |
| Indicador en zona de riesgo | ¡Cuidado! Tu salud está en peligro |
| Cargando resultados | Loading... |
| Tu sesión expiró, vuelve a iniciar | Oops! Algo salió mal |

## Logo
- Dos lockups: símbolo solo (favicon, espacios reducidos) y símbolo + wordmark "ATLAS". Archivos SVG en `public/brand/`.
- Espacio de respeto alrededor; no deformar, no recolorear fuera de las variantes definidas (ink sobre claro; versión clara sobre fondos oscuros).
- Favicon: el símbolo.

## Layout
- Sidebar: `w-72`/`w-80`, `bg-background`, borde derecho `border-border`, items `rounded-xl`.
- Header: `h-16`/`h-20`, fondo blanco, border-bottom sutil, avatar con dropdown a la derecha.
- Páginas: contenido `max-w-7xl` centrado; padding lateral `px-6` (móvil) / `px-10` (desktop); vertical `py-10`.

## Bloques de una pantalla clínica: los tres niveles

**Decisión de sistema, no de pantalla.** Un bloque se ve igual en Diagnóstico, en Tratamiento y en
Seguimiento, y lo decide un solo sitio: `src/components/shared/bloque.tsx`. Antes cada superficie tenía
su propio dialecto (líneas divisorias en el panel del nutricionista, recuadro con acento en Rutas,
`Card` en Diagnóstico, y tres tokens de fondo sin criterio), y el profesional **cambiaba de idioma
visual al cruzar de una etapa a otra**.

El nivel dice **qué es** el bloque, no cuánto ocupa:

| Nivel | Qué es | Cómo se ve | Ejemplos |
|---|---|---|---|
| `decision` | Lo que el **profesional** decide y queda sellado | superficie elevada (`bg-card`, sombra), título `text-base` | objetivo del tratamiento, cadena calórica, restricciones, lista de intercambio, tiempos de comida, confirmar el diagnóstico, próximo control |
| `derivado` | Lo que el **sistema** calcula o propone a partir de esa decisión | superficie plana (`bg-background`, borde suave), título `text-sm` | DFI, radar, Diana, validación del plan, distribución por tiempos, menú semanal, menú IA, comparación de seguimiento |
| `registro` | Lo que se **escribe** y acompaña al plan | sin superficie, título `text-sm` | guías dietarias, notas del tratamiento, criterio del profesional |

**Por qué "decisión" y no "prescripción".** Fue el primer nombre y no sirvió: en Tratamiento el
profesional prescribe, pero en Diagnóstico **confirma** y en Seguimiento **agenda**. Lo común no es
prescribir, es decidir. Un nombre que solo describe una pantalla obliga a forzarlo en las otras, y un
nivel forzado se aplica mal.

**El nivel `registro` baja el peso VISUAL, no la importancia.** Las restricciones alimentan el filtro de
alérgenos del menú y las notas son documento clínico. Por eso se distingue **por ausencia de
superficie** y conserva el tamaño de texto del cuerpo, **no** por un gris que lo apague. Polaris usa el
fondo apagado para "menos importante", y ese es justo el matiz que aquí no queremos: si alguien
"arregla" esto poniéndole gris, lo empeora.

### Jerarquía, nunca navegación interna

En las pantallas del **profesional** no se usan anclas, pasos ni pestañas internas para partir una
pantalla larga. La razón no es de gusto: **el instrumento del paciente y el panel del profesional son
dos clases de superficie con reglas opuestas.**

GOV.UK lo separa de forma explícita. Su regla de *una cosa por pantalla* es para **servicios al
público**, que la gente usa una vez y no conoce, y por eso **sí** se aplica al intake del paciente. Para
**interfaces de trabajo** escriben lo contrario: *"puedes asumir que el personal conoce el proceso y
optimizar para la velocidad, lo que probablemente significa poner más de una cosa por pantalla"*. El
nutricionista vive en su panel todos los días; partirlo le cobraría navegación en cada consulta.

No unificar el criterio entre las dos clases: la regla correcta de una es la equivocada de la otra.

### Lo que el componente NO hace

No mueve nada de sitio, no funde secciones, no acorta títulos y no cambia contenido. Solo decide la
superficie. **Varios títulos van verbatim del archivo de Gildardo y no se pueden acortar**, porque la
referencia es parte del dato (`titulos-tablas-plan.test.ts` lo bloquea). Para decir de qué depende un
bloque o qué gobierna está la línea `sub`, que es aditiva.

Si al aplicar el componente una pantalla necesitara mover algo de sitio, eso ya no es un ajuste de
estilo: se para y se reporta.

### La historia clínica va aparte, a propósito

`historia-clinica.tsx` **no usa estos niveles y no se le deben aplicar por uniformidad.** Es un
documento **imprimible y probatorio**, con dos caras deliberadas (lo que va a pantalla y lo que va al
papel, con sus `no-print` y `print-only`), y su aspecto se cotejó contra el documento de referencia.
Uniformarla con las pantallas de trabajo rompería ese cotejo.

## Decimales de una cifra clínica: el CORTE pone un techo, no un objetivo

**Regla (Santiago, 2026-09-06; matizada el mismo día tras el barrido del punto 30).** Tiene **dos
mitades, y hacen falta las dos**:

> **1. Nunca menos precisión de la que el corte exige.**
> **2. Y nunca menos de la que el valor necesita para ser útil.**

**La primera mitad** es de donde nació la regla: la precisión mostrada tiene que **alcanzar para
distinguir del corte**. Si el corte del IR es 0,78 y la distancia del paciente es 0,018, dos decimales
convierten ese 0,018 en 0,02 y borran justo lo que la cifra venía a decir.

**Su ejemplo es el AF.** Va a **un** decimal por instrucción de Gildardo (D-016), y eso manda sobre
cualquier razonamiento nuestro. Cuando las dos capas de display discreparon sobre él (una con uno, otra
con dos), no había discusión posible: la que decía dos estaba mal.

**La segunda mitad se añadió porque la primera, sola, se lee al revés.** *El corte pone un techo, no un
objetivo.* Que un corte sea entero **no** significa que el valor deba mostrarse entero: el corte del
FFMI es 17, y un **FFMI sin decimales no sirve** (17 y 17,9 son pacientes distintos y la banda entera se
aplastaría a nueve pasos). Lo mismo con la cintura (94), el SMM/W (27), el % de grasa (22) o el ACT/MLG
(71-74): sus cortes son enteros y sus valores siguen yendo a dos decimales.

**Cómo se aplica, entonces:** la primera mitad SUBE decimales cuando el corte los pide; la segunda
impide que se BAJEN por debajo de lo que el dato necesita. El default de Atlas (dos) es el suelo, no el
punto de partida de una negociación.

**De la primera mitad salen dos criterios para SUBIR, y sólo dos:**

1. **El corte lleva tres decimales → el indicador lleva tres.**
2. **El indicador vive en un rango menor a una unidad → lleva tres.** A dos decimales, toda su escala
   clínica cabría en veinte pasos.

**Todo lo demás va a DOS, que es el estándar.** No se decide caso por caso y no se copia del HTML: su
archivo no tiene una regla de decimales, tiene la que quedó en cada sitio (2 en unos, 3 en otros, 4 en
otros), y copiarla importa su desorden.

### El barrido de los doce indicadores (2026-09-06)

| Indicador | Su corte | Decimales | Por qué |
| --- | --- | --- | --- |
| **PABU** | φ = **1,618** | **3** | El corte tiene tres. Con dos, la Δ no distingue del corte |
| **IR** | 0,78 / 0,82 | **3** | Recorre 0,70-0,90: **menos de una unidad** |
| IFC | 6,68 / 3,28 | 2 | |
| IRC | 1,70 / 2,30 | 2 | |
| FMI | 6 / 9 | 2 | |
| FFMI | 17 / 15 | 2 | |
| ICA-BIS | 0 (zona φ ≤ 0,15) | 2 | |
| ISCM | −1 | 2 | |
| IEHH | 0 | 2 | Bajó de 3: su corte es un entero |
| **AF** | 6,5 / 6,0 | **1** | **Instrucción suya** (D-016): *"dos sugieren una exactitud que el equipo no tiene"* |
| **EB** | edad cronológica | **1** | Está en **años**: convención de unidad, no precisión de corte |
| **IAE** | −5 a +5 | **1** | Está en **años** |

### Y la parte que no es la tabla: UNA sola fuente

El defecto que originó la regla no fue elegir mal un número. Fue que **el valor, su Δ y la historia
clínica tenían cada uno el suyo**, y por eso el mismo renglón llegó a decir **0,42** en la columna del
valor y **0,4157** en la de la Δ, que son la misma cifra.

Los decimales viven en **`decimalesDe()`** (`modules/diagnoses/data/indicator-ranges.ts`) y sus
consumidores la llaman. **Ninguna superficie escribe un número de decimales a mano.** Con una tabla, que
coincidan no es disciplina: es que no hay dos números que puedan discrepar. Candado:
`decimales-los-fija-el-corte.test.ts`, que además comprueba fila por fila que el valor y su Δ traen los
mismos decimales.

**Y eran CUATRO capas, no tres (cotejo punto 30, 2026-09-06).** El párrafo de arriba decía "los tres
consumidores" y contaba el valor de Diagnóstico, la Δ y la historia clínica. Faltaba la **tabla de
composición de Wang** (`composition-map.ts`), que es otra capa de display y no consultaba la tabla: el
**AF** salía ahí con **dos** decimales y aquí con **uno**, y el **IR** con **dos** allí y **tres** aquí.
No era una diferencia con su archivo: eran **nuestras dos capas discrepando sobre una instrucción suya**.

Arreglado **por construcción y no por acuerdo**: `composition-map` pregunta `esIndicadorAni(clave)` y, si
lo es, toma `decimalesDe(clave)`. Una fila nueva cuya clave sea uno de los doce hereda el número correcto
sin que nadie se acuerde. Candado: `decimales-las-dos-capas.test.ts`, que compara las dos tablas.

**El IMC no es indicador ANI y lleva su decimal declarado en la fila** (`{ decimals: 1 }`): su corte es
18,5-24,9 y con dos salía 25,66 al lado de esa referencia. Esa vía queda para las filas de composición
que no son indicadores; las que sí lo son no la usan.

**Y la coma decimal es de la misma familia:** todo lo que ve un profesional va con **coma**, incluida la
historia clínica. Hasta el 2026-09-06 su tabla de índices mostraba la referencia con coma (nuestra) y el
valor con punto (formato suyo copiado), en la misma fila.

## Responsive y accesibilidad
- Target principal desktop, pero usable en móvil: sidebar a hamburguesa en `<lg`, formularios apilados en `<md`, tablas con scroll horizontal.

### Tablas densas: las TRES piezas, o no se desplaza

Una tabla clínica dentro de `overflow-x-auto` necesita las tres, y con dos no funciona:

1. **`overflow-x-auto` en el contenedor.** Solo, no hace nada: si la tabla puede encogerse, se encoge.
2. **`min-w-[Nrem]` en la TABLA.** Sin esto el navegador APRIETA las columnas hasta partir los números,
   y el desplazamiento nunca llega a activarse. El scroll horizontal no es el defecto: es la solución.
   Valores en uso: 32rem (4-5 columnas), 38rem (8 columnas), 42rem (menú semanal).
3. **`min-w-0` en el ANCESTRO que sea flex item, y OBLIGATORIO si es un `<fieldset>`.** Un fieldset trae
   de fábrica `min-inline-size: min-content` y se niega a encogerse; con la tabla ancha estira el
   fieldset, el fieldset desborda la tarjeta y la tarjeta recorta. Se ve una tabla **partida**, con la
   barra de scroll flotando fuera, y hasta el texto que está fuera del contenedor sale cortado.

Caso real (2026-08-27): las tres tablas de Diagnóstico funcionaban con 1 y 2 porque no viven dentro de
un fieldset; las cuatro de Tratamiento, que sí, se partían. Esa era toda la diferencia.

### Qué forma tiene una lista: si busca, densidad; si compara, columnas

No es preferencia: **se deriva de qué hace el profesional con esa lista.**

| Qué hace | Forma | Por qué |
|---|---|---|
| **Busca** uno entre muchos, N sin techo | **Fila de dos líneas** + buscador | La línea concatenada (`documento · 34a · 3 consultas · Última: 12/08`) mete cuatro datos en el ancho de uno, así que cabe en un teléfono sin desplazar. Y el buscador es lo único que evita que la lista crezca sin techo |
| **Compara** entre filas, N acotado | **Tabla densa** | Las columnas alineadas son lo que deja ver una trayectoria. Una línea concatenada la pierde |

Clasificación actual: `/pacientes` **busca** (dos líneas); `/pacientes/[id]` **compara** (tabla, 2-20
evaluaciones por paciente); `/ani-bis-e` **busca**, y ya son filas agrupadas por estado.

**Corrección del 2026-08-28: "busca" no significa dos líneas SIEMPRE, significa dos líneas EN ESTRECHO.**
La fila de dos líneas resuelve el teléfono, pero en 1900 píxeles deja la mitad derecha vacía y la lista se
lee como bandeja de correo. Lo que la clasificación decide es la forma **en el ancho escaso**; en el ancho
sobrado, los mismos datos van en columnas. `fila-lista.tsx` lo hace: **un solo DOM, un solo contenido, dos
disposiciones**.

Y las otras dos formas de lograr lo mismo están descartadas, con su razón, porque las tres se ven igual:

- **Renderizar las dos disposiciones y ocultar una con CSS** duplica el contenido en el DOM, y un lector de
  pantalla anuncia cada fila dos veces. Solo lo nota quien use lector: el smoke visual pasa.
- **Elegir la disposición en JavaScript** según el ancho rompe la hidratación (el servidor no sabe el ancho)
  y la primera pintura sale con la disposición equivocada.

**Y la distinción que lo hace seguro, porque no siempre lo es:** lo que descartamos en la matriz de
frecuencia eran **dos contenidos distintos** según el ancho, y ahí sí se puede enviar una cosa y mostrar
otra. Esto es **un contenido repartido**. Lo fija `fila-lista.test.tsx`: cada campo aparece exactamente una
vez en la fila.

**El subtítulo dice lo que la pantalla NO muestra, y casi siempre eso es una garantía o una consecuencia.**
Formulacion salida de propagar el patron a las 24 pantallas (2026-08-29). Lo que CAE es casi siempre lo
mismo: la enumeracion de las secciones que hay debajo, que el usuario tiene delante. Lo que QUEDA son
cosas que la pantalla no puede enseñar: que el registro es append-only, que la aprobacion la hace un
tercero y nunca tu mismo, que el acceso vence solo, que los datasets nunca llevan datos personales, que
sin la verificacion no se paga la comision, que un reporte enviado ya no se deshace. Dos pantallas se
quedaron SIN subtitulo, y es correcto: su titulo ya lo decia todo.

Y dos reglas de densidad que salen de lo mismo:

- **Un chip solo cuando dice algo excepcional.** El estado "Activo" no lleva chip; "Inactivo" sí. Gastar
  ancho en lo que casi siempre es igual es lo contrario de hacer una lista escaneable.
- **La acción idéntica en todas las filas no es una columna:** es la fila entera. Una acción que VARÍA
  según el estado sí se gana su columna.

### Y la cuarta, para las filas de acciones: `flex-wrap`

Una fila de botones es el mismo problema en otro sitio: **una fila que no encoge dentro de su
contenedor**. Dos botones con texto largo ("Guardar distribución" + "Recalcular desde el objetivo") no
caben en un teléfono, y sin `flex-wrap` el segundo se sale por el borde en vez de bajar a la línea
siguiente.

**Regla: toda fila de acciones va `flex flex-wrap gap-2`.** El `flex-wrap` no cuesta nada donde sobra
espacio (no cambia nada en escritorio) y es lo único que evita el desborde donde falta. Barrido del
2026-08-27: las cuatro filas de acciones del panel de tratamiento lo necesitaban; las demás de la app
tienen un solo botón o botones cortos.
- Contraste WCAG AA; focus visible en todo lo interactivo; alt text en imágenes informativas; labels asociados (no solo placeholder); `aria-label` en botones de solo ícono. El riesgo clínico nunca se comunica solo por color.

## Animaciones
Sutiles y breves: `transition-all duration-200`, `animate-pulse` para loading, fade-in 300ms al cambiar de página. Sin parallax ni animaciones largas.

## Lo que NO se debe hacer
- Mezclar fuentes (solo Inter) o librerías de íconos.
- Pintar un estado clínico de riesgo con el azul de marca.
- Comunicar riesgo solo por color.
- Radios mayores a 40px en componentes regulares.
- Emojis o signos de exclamación múltiples en UI.
- Em-dash en texto de cara al usuario.
- Copy dramático o alarmista en lo clínico.
- Gradientes llamativos, sombras de neón, imágenes stock genéricas.

---

## Qué se cierra por pantalla y qué es global

Distinción para no rediseñar dos veces. **"Diseño" nombra dos cosas**: la ESTRUCTURA (qué forma tiene una
lista, dónde va cada dato, si es tabla o filas) y la DECORACIÓN (color, tipografía, espaciado, layout).

**Se cierra por pantalla**, porque vive dentro del sistema que este documento ya fija:

- espaciado interno y ritmo vertical de la superficie
- jerarquía de superficie (los tres niveles de `components/shared/bloque`)
- uso del color clínico (semáforo, chips de estado)
- densidad de fila, alineación, cifras tabulares
- estados vacíos y textos de ayuda
- qué acciones se muestran y dónde

**Es global**, porque si se fija mal en una pantalla hay que cambiarlas todas:

- **tipografía**: familia, escala de tamaños, pesos
- **layout general**: ancho máximo del contenido, relación sidebar/contenido, dónde vive el título de
  página
- **escala de espaciado base**: si el ritmo cambia, cambia todo
- **ampliaciones de la paleta** (un color nuevo para un rol nuevo)
- **el patrón de fila de lista**: parece de pantalla y no lo es. Si cada lista inventa su fila, divergen,
  que es lo que pasó con los bloques antes de `bloque.tsx`

**Y el orden que sale de ahí:** lo global va AL FINAL, a propósito. La tipografía y el layout **se juzgan
con superficies terminadas**; fijarlos con dos pantallas hechas es fijarlos a ciegas y volver a tocarlos
en la quinta.

**El camino, con precedente en la casa:** construir en una superficie real y **subir el patrón a
componente compartido en cuanto la segunda lo necesite**. Es lo que hizo `bloque.tsx`: nació resolviendo
el panel del nutricionista y al turno siguiente subió a componente sobre 21 superficies. Ni diseñar en
abstracto, ni dejarlo suelto en una pantalla.
