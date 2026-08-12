# Inventario de Diagnóstico: mapa Atlas vs HTML v8

**Método:** no es cotejo pantalla-contra-pantalla (el mapeo no es uno a uno). Es un INVENTARIO por bloque, en cuatro categorías. Fuente: capturas de ambos lados en `docs/entregas/cotejo-visual/`.

**Advertencia:** las capturas son de PACIENTES DISTINTOS (HTML: "Santi arroyave 22a"; Atlas: "Smoke uno Completo"). Por eso se coteja **estructura, disposición, rótulos y orden**, NO los valores.

**Estructura de cada lado:**
- **HTML:** Diagnóstico tiene 4 subpestañas: (1) Encuesta D1-D8, (2) Composición Corporal, (3) Diagnóstico Funcional (DFI + Diana + Radar + detalle EFR), (4) Resumen del Diagnóstico (IA + enviar al paciente).
- **Atlas:** Diagnóstico es un scroll: DFI → Mapas (Diana + Radar) → Detalle EFR → Indicadores ANI-BIS-E → Composición corporal → Confirmar → Diagnóstico de encuesta → Criterio del profesional → Corregir.

---

## 1 · ESTÁ EN LOS DOS, MISMO LUGAR (coteja forma y orden)

| Bloque | Estado | Recomendación |
|---|---|---|
| **DFI: riesgo integrado + 5 dominios** | En los dos, arriba. Coincide la estructura (card de riesgo + 5 tarjetas de dominio). | Coteja OK. Ver divergencias abajo (rótulos de severidad, subtítulo, ruta inline, cortes inline). |
| **Diana EFR (81 estados)** | En los dos, tras el DFI. Coincide: 9 anillos × 9 sectores, gradiente, posición del estado (#4 de 81). | **Conservar lo nuestro** en el rename: HTML usa "R1-R9" para los sectores; Atlas "Sectores E1-E9" (rename aprobado por Gildardo, C1). El resto coincide. |
| **Radar funcional (5 dominios)** | En los dos, junto a la Diana. | Coteja, pero hay divergencia de forma (abajo). |
| **Detalle del estado EFR (6 tarjetas)** | En los dos, tras la Diana. **Coincide EXACTO:** enfermedades, mecanismos, biomarcadores, riesgos, VITACELLEBIS nutracéuticos, abordaje por profesión. Mismo orden. | **Portar/conservar: ya coincide.** Nada que decidir. |
| **Composición corporal (niveles de Wang)** | En los dos. HTML: subpestaña completa. Atlas: sección colapsada. | **Falta captura:** Atlas Composición EXPANDIDA para cotejar filas. Pídesela a Santiago. La referencia de MCA va aplazada (§9). |

**Divergencias dentro del DFI y el radar (decidir):**
- **Rótulos de severidad.** HTML tarjetas: **Óptimo / Vigilancia / Crítico**. HTML radar: **Excepcional / Muy bien / En la norma / A vigilar / A tratar** (5 niveles). Atlas: **Óptimo / Leve / Moderado / Alto** (4 niveles). → **Decidir el vocabulario** (portar el suyo, conservar el nuestro, o unificar). Es la divergencia más de fondo: aparece en tarjetas y radar.
- **Radar, forma.** HTML: zonas concéntricas de color (5 anillos). Atlas: polígono lleno. → decidir.
- **Subtítulo del DFI.** HTML: "5 dominios · síntesis ANI BIS-E". Atlas: sin subtítulo. → menor; probablemente portar.
- **Título.** HTML: "Diagnóstico Funcional Integr**ado**". Atlas: "Integr**al** (DFI)". → menor; decidir.

---

## 2 · ESTÁ EN LOS DOS, EN LUGARES DISTINTOS (decidir si mover)

| Bloque | HTML | Atlas | Recomendación |
|---|---|---|---|
| **Índices ANI-BIS-E** (IFC, IRC, PABU, ICA-BIS, EB, IAE, ISCM) | DENTRO de la tabla de Wang (Composición), al final ("Índices bioeléctricos integrados") | Tabla SEPARADA "Indicadores ANI-BIS-E" | Decidir: ¿fundir en la composición (suyo) o tabla aparte (nuestro)? La tabla aparte es más legible; su enfoque los ancla al nivel de Wang. |
| **Cortes/rangos de los indicadores** | Inline en cada tarjeta de dominio (IFC 6.98 con "corte H: <4.12 bajo · normal · alto") | En la columna Referencia de la tabla de indicadores | Decidir si además se muestran inline en las tarjetas (más contexto donde se lee el dominio). |
| **Ruta prioritaria** | Badge inline en el riesgo integrado ("R4 · Desaceleración Envejecimiento") | En la pestaña Tratamiento (Rutas) | Decidir: ¿mostrar la ruta prioritaria también en Diagnóstico, o mantener toda ruta en Tratamiento? |
| **Diagnóstico Integrado (IA)** | Subpestaña "Resumen del Diagnóstico" (botón Análisis IA) | En el **Reporte** (`reports-writer.ts`), no en la pestaña Diagnóstico | Decidir dónde vive la narrativa IA: ¿en Diagnóstico como resumen, o solo en el Reporte? |
| **Enviar informe al paciente** | Subpestaña Resumen | Flujo de Reporte (report-card) | Conservar en Reporte (nuestro flujo con aprobación/firma). |

---

## 3 · ESTÁ EN EL HTML Y NOS FALTA (contenido de Gildardo)

| Bloque | Detalle | Recomendación |
|---|---|---|
| **Análisis por dominio D2-D8** | HTML: análisis completo por dominio en la subpestaña Encuesta D1-D8. Atlas: D1 (patrón) está; **D2-D8 dicen "Disponible próximamente"**. | **Esperando a Gildardo:** su análisis por dominio no se ha entregado. No es un olvido nuestro; está registrado como pendiente. Cuando lo entregue, se porta. (La Encuesta se coteja al final.) |
| **(posible) más filas de Wang** | Verificar contra Atlas Composición expandida (falta la captura). | Pendiente de la captura expandida. |

*Nota: hasta ahora NO apareció contenido clínico de Gildardo que estuviéramos ignorando sin saberlo; lo que falta (D2-D8) ya estaba registrado como pendiente de su entrega. Se confirma cuando llegue la Composición expandida.*

---

## 4 · ESTÁ EN ATLAS Y ÉL NO LO TIENE (verificar deliberado)

| Bloque | ¿Deliberado? | Recomendación |
|---|---|---|
| **Criterio del profesional** (interpretación clínica, historial interno) | **Sí, deliberado.** No es cálculo; es la nota clínica del profesional, no se envía al paciente. | Conservar. Registrado. |
| **Confirmar el diagnóstico** (gate que habilita el tratamiento) | **Sí, deliberado.** Es la decisión clínica que habilita prescribir. | Conservar. Registrado. |
| **¿Un dato quedó mal? / Corregir la evaluación** | **Sí, deliberado.** Mecanismo de versionado/corrección. | Conservar. Registrado. |
| **Historial de correcciones** (arriba) | **Sí, deliberado.** Versionado. | Conservar. Registrado. |
| **Nota de calibración provisional de EB/IAE** | **Sí, deliberado.** Honestidad P0 (sin población de referencia). | Conservar. Registrado. |

---

## Lo que falta para cerrar el inventario
1. **Captura de Atlas: Composición corporal EXPANDIDA** (en la captura vino colapsada) para cotejar las filas de Wang y confirmar que no falta ninguna.
2. **La subpestaña Encuesta D1-D8** se coteja en la ronda de Encuesta (al final), pero ya sabemos que Atlas espera el análisis D2-D8 de Gildardo.

## La decisión de fondo que sale del mapa
El vocabulario de severidad (Óptimo/Vigilancia/Crítico + el radar de 5 niveles vs nuestro Óptimo/Leve/Moderado/Alto) es la única divergencia que atraviesa varios bloques. Conviene decidirla PRIMERO, porque define tarjetas de dominio + radar a la vez.
