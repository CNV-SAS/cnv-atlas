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

## Responsive y accesibilidad
- Target principal desktop, pero usable en móvil: sidebar a hamburguesa en `<lg`, formularios apilados en `<md`, tablas con scroll horizontal.
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
