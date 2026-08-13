# Inventario de Diagnóstico: mapa Atlas vs HTML v8

**Método:** no es cotejo pantalla-contra-pantalla (el mapeo no es uno a uno). Es un INVENTARIO por bloque, en cuatro categorías. Fuente: capturas de ambos lados en `docs/entregas/cotejo-visual/`.

**Advertencia (registrada):** las capturas son de PACIENTES DISTINTOS (HTML: "Santi arroyave 22a"; Atlas: "Smoke uno Completo"). Por eso este cotejo es de **estructura, texto y disposición**, NO de ciencia: **ninguna diferencia de VALOR se clasifica como hallazgo.** El cotejo de valores con el MISMO paciente (misma encuesta, mismo BIS) lo hace Santiago en el Hito 2.

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
| **Composición corporal (niveles de Wang)** | En los dos, **coteja OK** (captura expandida ya disponible). Misma estructura de niveles (V cuerpo entero, IV tejidos, III celular, II molecular). Atlas añade un bloque **Bioeléctrico (Cole-Cole)** con Re/Ri/R∞/C/AF crudos que el HTML no muestra (transparencia, deliberado). | Estructura coincide. La única divergencia de fondo es la ubicación de los índices ANI-BIS-E (ver categoría 2). Reasignaciones menores de variables entre niveles (ICC/ICT, GEB/GET). Referencia de MCA aplazada (§9). |

**Divergencias dentro del DFI y el radar:**
- **Rótulos de severidad por dominio: RESUELTO, lo nuestro es lo correcto.** Gildardo lo respondió el 9 de agosto (11a, verbatim): *"Severidad por dominio: Leve / Moderado / Alto. Manda el clasificador, coherente con D-015. Descarten 'Vigilancia / Crítico'."* Atlas ya usa Óptimo / Leve / Moderado / Alto (fuente única `severity-labels.ts`, sev0 = Óptimo). Su HTML ("Vigilancia / Crítico") está desactualizado ahí. **Es la TERCERA divergencia por archivo viejo** (con el 52,4 de MCA y las carnes rojas). Conservar lo nuestro.
- **Radar, escala: Atlas lo unificó al de dominio; la granularidad va a la ronda.** Atlas usa la MISMA escala (4 niveles) en radar y tarjetas, por diseño (fuente única, "no pueden divergir", decisión V0-b). El HTML tiene un radar de 5 niveles (Excepcional / Muy bien / En la norma / A vigilar / A tratar) que su 11a NO nombró (habla de severidad por dominio). **Añadido a la ronda abierta** (§6): confirmar si el radar usa la escala de dominio (4) o las 5 gradaciones. Es solo forma.
- **Radar, forma.** HTML: zonas concéntricas de color (5 anillos). Atlas: polígono lleno. → ligado a la pregunta de granularidad de arriba.
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

## 4 · ESTÁ EN ATLAS Y ÉL NO LO TIENE: TODAS DELIBERADAS (registrado, no reabrir)

Las cinco de abajo son decisiones nuestras deliberadas, no cosas agregadas sin registrar. Quedan CONSERVADAS; este registro es para que no se reabran en un cotejo futuro.

| Bloque | ¿Deliberado? | Recomendación |
|---|---|---|
| **Criterio del profesional** (interpretación clínica, historial interno) | **Sí, deliberado.** No es cálculo; es la nota clínica del profesional, no se envía al paciente. | Conservar. Registrado. |
| **Confirmar el diagnóstico** (gate que habilita el tratamiento) | **Sí, deliberado.** Es la decisión clínica que habilita prescribir. | Conservar. Registrado. |
| **¿Un dato quedó mal? / Corregir la evaluación** | **Sí, deliberado.** Mecanismo de versionado/corrección. | Conservar. Registrado. |
| **Historial de correcciones** (arriba) | **Sí, deliberado.** Versionado. | Conservar. Registrado. |
| **Nota de calibración provisional de EB/IAE** | **Sí, deliberado.** Honestidad P0 (sin población de referencia). | Conservar. Registrado. |

---

## Lo que falta para cerrar el inventario
1. **Composición expandida: LISTA** (capturas ya disponibles, estructura coincide).
2. **La subpestaña Encuesta D1-D8** se coteja en la ronda de Encuesta (al final); Atlas espera el análisis D2-D8 de Gildardo (ya registrado como pendiente).

Con eso, el inventario de Diagnóstico queda cerrado salvo la Encuesta (al final). **El trabajo real que queda es decidir las cuatro de la categoría 2.**

## La decisión de fondo del vocabulario: RESUELTA
El vocabulario de severidad ya estaba respondido por Gildardo (11a, 9-ago): Leve/Moderado/Alto, descartar Vigilancia/Crítico. Atlas ya es correcto; su HTML está desactualizado (tercera divergencia por archivo viejo). La única cola es la granularidad del radar (4 vs 5), que fue a la ronda.
