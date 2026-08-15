# Smoke fila por fila: restructure de Diagnóstico (2026-08-15)

**Para:** Santiago, con las capturas del HTML al lado. **Foco:** ¿ahora sí coincide, fila por fila?
Lista de lo que cambió en cada sitio, qué se agregó/quitó, y qué deberías ver.

---

## Colores (ya confirmaste que quedaron)
- Badges del DFI: semáforo (verde Bajo / ámbar Leve / naranja Moderado / rojo Alto). Sin azul.
- Radar: como `radar-antiguo.png` (centro blanco, anillos sólidos azul/verde/amarillo/rojo, polígono oscuro).

## Estructura (movimientos)
- **La tabla de índices ANI-BIS-E ya no está en Funcional: está en Composición**, debajo de la tabla de Wang. En Funcional quedan los índices inline por dominio (las tarjetas del DFI).
- **El bloque Bioeléctrico (Cole-Cole) ya no está en Diagnóstico**: solo en la pestaña Evaluación (son valores crudos del equipo).

## Tabla de indicadores ANI-BIS-E (ahora en Composición)
- **FMI y FFMI ya NO están aquí** (se movieron a Wang, Nivel IV). Quedan: IFC, IRC, PABU, ICA-BIS, ISCM, IEHH, IAE, EB, AF, IR.
- **EB-BIS**: ahora muestra referencia (edad cronológica), Δ (IAE) y clasificación ("Envejecimiento acelerado"), no "N/D".
- **ICA-BIS**: ahora muestra su clasificación de desviación ("Desviación leve"), no "N/D".

## Tabla de Wang, nivel por nivel

**Nivel V · Cuerpo entero.** Debe verse:
- Peso, Estatura: valor, referencia "-", Δ "-" (genuinamente sin referencia; no se inventa).
- IMC: referencia 18.5-24.9 (OMS), clasificación coloreada (Sobrepeso ámbar, Normal verde).
- Cintura: referencia <94/<80 (OMS), clasificación coloreada.
- Cadera: valor, "-" (sin referencia).
- **ICC (nuevo)**: valor, referencia <0.90/<0.85 (OMS, del HTML L10726), Δ, "Normal" verde.
- **ICT (nuevo)**: valor, referencia <0.50, Δ, "Saludable" verde.
- GEB: referencia del equipo + Δ. GET: "-" (se conservan aunque el HTML no los tenga, DIV-9).

**Nivel IV · Tejidos.** Debe verse:
- Masa grasa (kg y %), MG hidratación constante, MLG, MME-SMM, MMEM: valor + referencia del equipo + Δ.
- FFMI: referencia del equipo, clasificación coloreada (semáforo).
- **FMI (nuevo)**: valor derivado, referencia **3-6/5-9** (del MOTOR, no el 6-9 del HTML display, que es stale), clasificación coloreada.

**Nivel III · Celular.** Igual que antes (MCA, sólidos EC, masa seca, AEC/MCA, agua EC/IC con grasa) + el desplegable de agua. Sin cambios de esta ronda.

**Nivel II · Molecular.** Igual (ACT, FFW, hidratación, proteínas, minerales). Sin cambios.

**Bioeléctrico:** ya NO aparece en Composición de Diagnóstico (se fue a Evaluación).

## Encima de la tabla
- **Los 3 chips (IMC/cintura/ICT) YA NO ESTÁN**: sus valores viven ahora en la tabla (Nivel V) con referencia y clasificación. La nota OMS se movió al pie de la tabla.

---

## Lo que NO se hizo (y por qué), para que no lo reportes como bug
- **NHLBI (clasificación IMC + cintura combinada):** el HTML tiene una fila "Clasificación IMC + cintura (NHLBI)". No se agregó todavía: es un clasificador COMBINADO que necesita su propia procedencia (como exigimos con el ICC). Pendiente de verificar en su archivo o marcar OMS. Va con la ronda si hace falta.
- **ASMI, SMM/W, ratios E/I:** derivados que su tabla diagnóstica lista y composición no. Van a la ronda de Gildardo (no los decidimos solos).
- **Rangos de referencia por fila estilo su Tabla 2:** decidido que la referencia del equipo (poblacional) se conserva donde existe; el rango del clasificador solo llena donde no hay del equipo.

## Cómo reportar
Por cada fila: "coincide", "FALTA X", "SOBRA X", o "el número no cuadra". Con las capturas al lado.
