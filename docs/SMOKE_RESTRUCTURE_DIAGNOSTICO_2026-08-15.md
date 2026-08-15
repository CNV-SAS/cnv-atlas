# Smoke fila por fila: Wang con diagnóstico + referencias (bloque completo, 2026-08-15)

**Para:** Santiago, con las capturas del HTML al lado. **Objetivo:** que la tabla quede prácticamente igual al HTML.
El bloque grande está hecho: ahora casi todas las filas tienen **diagnóstico** y **referencia**.

---

## Esta pasada es CONFIRMACION, no exploración (fix de raíz aplicado)

Se reescribió la tabla para que Referencia, Δ y Diagnóstico salgan de UNA fuente por fila
(`wangRowDx`), en vez de escribirse a mano al lado del clasificador. Se agregó un candado
(`composition-cells.test.ts`, 34 tests) que verifica que **ninguna fila con clasificador y dato
disponible quede sin las tres celdas**. Por eso:

- **Si vuelves a ver una celda vacía con el dato disponible, el candado falló: repórtalo para
  revisarlo** (no es "otra fila más que llenar a mano", es un defecto de la fuente única).

### a) Filas que estaban vacías y AHORA salen completas
- **IMC**: referencia "18.5–24.9" (antes vacía).
- **Cintura**: referencia + clasificación.
- **NHLBI** (clasificación IMC + cintura): antes sin valor; ahora Valor = la clase, Δ = estado de
  cintura, Diagnóstico = "Sobrepeso · riesgo aumentado".
- **FFW (agua libre de grasa)**: valor + referencia (antes ambos en guion).
- **Agua extra/intracelular SIN GRASA (ECW_sg / ICW_sg)**: valor + referencia + diagnóstico.

### b) Filas que quedan en guion A PROPÓSITO (no es hueco)
Las **masas crudas en kg** sin clasificador normativo: peso, estatura, cadera, masa grasa (kg),
MLG, SMM, MMEM, GEB/GET, minerales no óseos. Se contrastan contra la referencia del equipo pero no
tienen un diagnóstico propio, **igual que en tu HTML**. El % de grasa sí clasifica (dFMpct); la kg no.

---

## Lo transversal (el patrón que encontraste)
- **Casi todas las filas llevan diagnóstico coloreado** (semáforo), como el HTML. Antes solo número.
- **Las referencias vacías se llenan** con REF_POB (se derivan de peso/talla/sexo cuando el equipo no las trae). Las que dependen de las 5 constantes que Gildardo no validó llevan un **asterisco "*"** discreto + nota al pie ("en validación, no significa que el dato esté mal"). Las 2 que él sí validó (hidratación 73,2%, MCA 52,4%) van **sin** asterisco.
- **"Sobrepeso" ahora sale ámbar** (era verde, arreglado).

## Nivel V · Cuerpo entero
- IMC, cintura: referencia OMS + clasificación coloreada.
- **NHLBI (nuevo):** "Clasificación IMC + cintura" → diagnóstico "Sobrepeso · riesgo aumentado" (ámbar), referencia "IMC 18.5-24.9 · CC ≤102 cm".
- ICC, ICT: referencia OMS + clasificación.
- Peso/Estatura/Cadera/GET: "-" (genuinamente sin referencia, no se inventa). GEB con referencia del equipo.

## Nivel IV · Tejidos
- Masa grasa (kg/%), MG hidratación constante, MLG, SMM, MMEM: valor + referencia del equipo (o "*" si REF_POB).
- **Masa grasa (%)**: ahora con diagnóstico "Normal/Sobrepeso adiposo/..." (dFMpct).
- FFMI: rango completo **17-25** + clasificación. FMI: rango **3-6** (del motor, no el 6-9 stale) + clasificación.
- **ASMI (nuevo):** valor (MMEM/talla²), referencia ≥7.0, "Normal/Riesgo de Sarcopenia".
- **SMM/W (nuevo):** valor, referencia ≥27%, "Sarcopenia/Normal/Óptimo".

## Nivel III · Celular
- MCA, sólidos EC, masa seca, AEC/MCA: valor + referencia (REF_POB con "*" donde aplica) + diagnóstico
  ("Déficit matriz — considerar colágeno", "Ganancia real", "En/Por debajo de la referencia"...).
- AEC/AIC (con/sin grasa, L y %): **descolapsadas** (ya no hay desplegable) + diagnóstico ("Equilibrio normal", "Hidratación celular adecuada"...).
- **AF e IR (movidos aquí):** referencia 6.5-7.0 / <0.78 + clasificación del motor.
- **E/I con/sin grasa (nuevo):** valor (ECW/ICW), referencia 0.35-0.40, "Equilibrio hídrico óptimo / Sobrecarga extracelular/inflamación".
- **Mapa AFxIR (nuevo):** diagnóstico "Perfil de Salud Celular adecuado" (según AF e IR).

## Nivel II · Molecular
- ACT (agua total), FFW, hidratación sin grasa: valor + referencia (REF_POB con "*") + diagnóstico.
- **ACT/MLG (nuevo):** referencia 71-74%, "Normal/Deshidratación relativa".
- Proteínas, minerales: valor + referencia REF_POB (con "*", derivadas de constantes no validadas).

## Bioeléctrico (Cole-Cole)
- Ya NO aparece en Diagnóstico (solo en Evaluación). El ángulo de fase se fue a Nivel III.

---

## Lo que NO se hizo (para que no lo reportes como bug)
- **Fenotipo MCCB (FFMI×FMI):** el estado ya sale en la franja de veredicto y el detalle EFR; no se duplicó como fila. Si lo quieres en la tabla, se agrega.
- **Grasa total (Lípidos Wang) en Nivel II:** es el mismo valor que "Masa grasa (%)" del Nivel IV (que ya lleva el clasificador dFMpct). No se duplicó.
- **Las 5 constantes REF_POB no validadas:** se muestran con "*", y la pregunta a Gildardo (confirmar la marca) queda en la cola para la ronda siguiente.

## Cómo reportar
Por fila: "coincide" / "FALTA X" / "SOBRA X" / "el número no cuadra". Con las capturas al lado.
