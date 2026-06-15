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

**Azul de marca (acción, CNV Data)** — primario:
| Token | Hex | Uso |
|---|---|---|
| blue-50 | `#EEF2FF` | Fondos suaves, badges |
| blue-100 | `#DCE4FF` | Hover de fondos |
| blue-500 | `#205DFD` | **Color de marca**, botones, focus, acento CNV Data |
| blue-600 | `#1A4ED6` | Hover de botones |
| blue-700 | `#1640AD` | Texto y links azules sobre blanco (AA) |
| blue-800 | `#123286` | Énfasis fuerte, hero |

`#205DFD` se reserva para botones y elementos grandes; para texto/link en azul sobre blanco se usa `blue-700` (contraste).

**Ink (estructura, foreground)** — neutros fríos derivados del casi-negro:
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
| Óptimo / normal | `#10B981` | `#ECFDF5` | Banda buena, confirmaciones |
| Alerta / riesgo | `#F59E0B` | `#FFFBEB` | Advertencias, riesgo moderado |
| Crítico | `#DC2626` | `#FEF2F2` | Riesgo alto, alertas clínicas críticas |

Como el azul es la acción primaria, "info/secundario" no se pinta de azul (chocaría); se resuelve con neutros o con el estado correspondiente.

### Implementación técnica (shadcn v4 + CSS vars)
Los tokens semánticos son **CSS variables** en `src/app/globals.css` (no clases Tailwind crudas). Se overridean los vars de shadcn con `--primary` = azul de marca, `--foreground` = ink, neutros derivados del ink, y `--ring` = azul. La capa clínica vive como tokens propios (`--clinical-optimal`, `--clinical-warning`, `--clinical-critical`) o clases explícitas, separada del sistema de marca. Preferir tokens semánticos (`bg-background`, `text-foreground`, `border-border`) sobre crudos.

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
