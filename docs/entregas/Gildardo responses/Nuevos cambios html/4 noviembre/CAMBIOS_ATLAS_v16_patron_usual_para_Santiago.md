# ATLAS v16: clasificación del patrón usual de consumo (D1)

**Archivo de referencia:** `ATLAS_v16.html` (25.466 líneas · 1,61 MB) · **Base:** `ATLAS_v15.html`, sin modificar
**Fecha:** 2 de noviembre de 2026 · **Para:** Equipo ATLAS (Santiago)
**De:** Gildardo Uribe, Dirección Científica CNV

---

Santiago: una nutricionista reportó que los resultados de la encuesta presentan como protectoras las carnes rojas y los embutidos. Lo verificamos en ATLAS CNV y en el HTML: la causa es la misma en los dos. La encuesta guarda bien las respuestas; el error está en cómo se resumen. v16 corrige la clasificación y la deja en un solo criterio. Frente a v15 hay **114 líneas agregadas y 35 retiradas**, todas en la clasificación de D1. ATLAS CNV debe quedar igual.

No se tocaron la EB-BIS v7, la Encuesta CNV-S, los demás dominios del ICEC, los cinco dominios del DFI, los indicadores bioeléctricos, Bodega ni CNVResearch.

---

## Resumen

| # | Cambio | Estado en v16 | Lo que te toca |
|---|---|---|---|
| 1 | Clasificador único del patrón usual, grupo por grupo | **Hecho** | Portar `d1Clasificar` y usarlo en todas las pantallas |
| 2 | Puntaje de alimentación del ICEC: huevos incluidos, carnes rojas y embutidos penalizados | **Hecho** | Portar `calcPatron` y versionar el ICEC |
| 3 | Dominio alimentario, resumen y párrafos por profesión | **Hecho** | Mismos textos y niveles |
| 4 | Vista D1 con la categoría de cada grupo | **Hecho** | Misma vista |
| 5 | La IA recibe la clasificación ya hecha | **Hecho** | Misma línea en el texto que se envía a la IA |
| 6 | Encuesta del QR con los 15 grupos de D1 | No aplica al HTML | Separar carnes rojas de embutidos y migrar |
| 7 | Motor congelado: Alimentación fija en 30 | No aplica al HTML | Leer el puntaje de `calcPatron` |

---

## 1 · El problema

Un paciente que come bien los grupos protectores (5 a 6 días por semana), embutidos 5 a 6 días por semana y carne roja todos los días recibía en v15:

| Dónde | Resultado en v15 |
|---|---|
| Resumen del diagnóstico | «se encontraron alimentos **protectores**» |
| Dominio alimentario | **Óptimo** |
| Puntaje de alimentación del ICEC | 63, **Adecuado**, más alto que si no comiera carne roja (60) |

Tenía cuatro causas:

1. **Promedio de los grupos de riesgo.** El resumen y el dominio alimentario promediaban los cuatro grupos de riesgo. Embutidos 5 a 6 días con los otros tres en «nunca» da 0,75, por debajo del corte de 1.
2. **Las carnes rojas no se contaban.** El grupo 15 no entraba ni al resumen ni al dominio alimentario.
3. **En el ICEC, comer carne roja sumaba.** El grupo 15 estaba con cereales integrales, tubérculos y carnes blancas, y ese grupo sumaba 3 puntos con 3 días o más por semana. Los huevos no puntuaban.
4. **La vista D1 no mostraba la categoría.** El verde significaba «frecuencia adecuada para su grupo», y «Carnes rojas: Nunca» en verde se leía como «protector».

En ATLAS CNV se suman dos causas propias, que van en las secciones 6 y 7.

---

## 2 · Lo que dice la literatura

Ninguna fuente revisada clasifica las carnes rojas ni las procesadas como alimentos protectores. La evidencia separa los dos grupos:

**Carnes procesadas (embutidos).** La IARC las clasificó como carcinógeno del grupo 1, y la carne roja como probablemente carcinógena, grupo 2A.¹ La asociación con enfermedad cardiometabólica es consistente:

- 50 g/día de carne procesada se asociaron con 42 % más riesgo de enfermedad coronaria (RR 1,42; IC 95 % 1,07 a 1,89) y 19 % más de diabetes (RR 1,19; 1,11 a 1,27).²
- Una porción diaria adicional se asoció con mayor mortalidad total, HR 1,20 (1,15 a 1,24).³
- En un metaanálisis dosis-respuesta, la misma porción diaria se asoció con más mortalidad total y cardiovascular, RR 1,15 en ambas.⁴
- Comparando el consumo más alto con el más bajo, el riesgo relativo de mortalidad total fue 1,23 (1,17 a 1,28).⁵

**Carnes rojas sin procesar.** La asociación es más débil y menos consistente:

- No se asociaron con enfermedad coronaria (RR 1,00 por 100 g/día).²
- La asociación con mortalidad total no fue significativa comparando el consumo más alto con el más bajo, RR 1,10 (0,98 a 1,22).⁵
- En las cohortes de salud de Harvard, una porción diaria se asoció con HR 1,13 (1,07 a 1,20) de mortalidad total. Mantener el consumo por debajo de media porción al día (unos 42 g) habría evitado entre 7,6 % y 9,3 % de las muertes.³
- En diabetes tipo 2, el análisis federado de 31 cohortes de 20 países (1,97 millones de adultos, 12 cohortes de las Américas) encontró:⁶
  - HR 1,10 (1,06 a 1,15) por 100 g/día de carne roja sin procesar;
  - HR 1,15 (1,11 a 1,20) por 50 g/día de carne procesada.
- Un metaanálisis de 15 cohortes encontró 15 % más riesgo de diabetes con carne roja sin procesar y 27 % con procesada.⁷
- Una revisión de cohortes resume riesgos de 11 % a 19 % por 100 g/día de carne roja y de 4 % a 32 % por 50 g/día de procesada, según el desenlace.⁸

**Evidencia en contra.** Las revisiones del consorcio NutriRECS calificaron como de certeza baja a muy baja el efecto de reducir 3 porciones por semana sobre la mortalidad y el cáncer.⁹ Con base en eso sugirieron, como recomendación débil, no cambiar el consumo actual.¹⁰ Esa recomendación discute cuánto beneficio se espera al reducir, no si el alimento protege; no respalda llamarlo protector. Por eso v16 trata las carnes rojas como un grupo **a limitar**, con un umbral menos estricto que el de las procesadas.

**Recomendaciones:**

| Fuente | Carnes rojas | Carnes procesadas |
|---|---|---|
| WCRF/AICR, Tercer Informe¹¹ | No más de unas 3 porciones por semana (350 a 500 g cocidos) | Poco o nada |
| AHA 2021¹² | Si se consume carne, cortes magros y formas no procesadas | Preferir formas no procesadas |
| EAT-Lancet¹³ | 0 a 28 g/día (referencia 14 g/día, unos 98 g por semana) | No incluidas en la dieta de referencia |
| MEDAS (PREDIMED)¹⁴ | Puntúa el consumo de menos de 1 porción al día de carne roja, hamburguesa o embutidos | Igual |

El ICEC parte del constructo Life's Essential 8, donde la alimentación es uno de los ocho componentes.¹⁵

---

## 3 · El criterio de v16

La escala de D1 va de 0 a 4: nunca, 1 a 2 días, 3 a 4 días, 5 a 6 días y todos los días. La porción de referencia de la encuesta es el «tamaño de su celular», unos 90 g.

| Grupo | Adecuado | A moderar | Exceso | Base |
|---|---|---|---|---|
| Protectores 1 a 7 | 5 a 6 días o más | 3 a 4 días (a mejorar) | Déficit: 2 días o menos | Sin cambio frente a v15 |
| Carnes procesadas y embutidos (12) | Nunca | 1 a 2 días | 3 a 4 días o más | IARC grupo 1; WCRF «poco o nada» |
| Refinados, azúcares añadidos, ultraprocesados (11, 13, 14) | 2 días o menos | No aplica | 3 a 4 días o más | Ya no se promedian |
| Carnes rojas (15) | 2 días o menos (hasta unos 180 g) | 3 a 4 días (270 a 360 g, en el límite del WCRF) | 5 días o más (450 g o más) | WCRF/AICR, EAT-Lancet |
| Cereales integrales, tubérculos, carnes blancas (8, 9, 10) | Sin señal de riesgo | No aplica | No aplica | Sin cambio |

**Patrón global:**

- **De riesgo:** cualquier grupo en exceso, y el texto lo nombra.
- **Con aspectos por mejorar:** sin excesos, pero con algún grupo a moderar, algún protector en déficit o un promedio de protectores menor de 3.
- **Protector:** ninguno de los anteriores.

Las carnes rojas y las procesadas nunca se describen como protectoras.

**Dominio alimentario:**

- dos o más grupos en exceso: «crítico»;
- uno en exceso: «alerta»;
- patrón protector: «óptimo»;
- el resto: «normal».

---

## 4 · Cambios en v16

### 4.1 · Clasificador único

`d1EstadoGrupo`, `d1Clasificar`, `d1Lista` y `d1TextoPatron` (líneas 1400 a 1458) son la única fuente de la clasificación. `d1Clasificar(enc, conRespaldo)` devuelve:

- `grupos`: cada grupo con su frecuencia y su estado (ok, mejorar, déficit, moderar, exceso, neutro);
- `exceso`, `moderar` y `deficit`;
- `protAvg`;
- `patron`: riesgo, moderado o protector;
- `respondidos`.

Con `conRespaldo = true` lee también las claves sin sufijo `_i` de los registros antiguos, como lo hacían el resumen y el dominio alimentario de v15.

Texto de salida para el caso del reporte:

> Al evaluar el patrón usual de consumo de alimentos se encontró un patrón de riesgo, con consumo elevado de carnes rojas (todos los días) y carnes procesadas y embutidos (5 a 6 días por semana).

### 4.2 · Puntaje de alimentación del ICEC

Es `calcPatron`, línea 3129; lo usa `calcLE8` en la línea 8874. Cambian cuatro cosas:

- **Protectores:** entran los 7 grupos, huevos incluidos. Se usa la misma escala por grupo (10, 8, 5 y 2 puntos), reescalada para que el máximo siga siendo 60.
- **Embutidos** (línea 3156): la penalización se duplica: −2, −8, −14 y −20 para 1 a 2, 3 a 4, 5 a 6 días y consumo diario. Además, con embutidos 3 a 4 días por semana o más, el puntaje no pasa de 54, que es «Mejorable» (línea 3171). Así un consumo frecuente de embutidos nunca queda en «Adecuado», aunque los protectores estén completos.
- **Carnes rojas** (línea 3164): suman 3 puntos con 2 días o menos por semana. Restan 4 con 5 a 6 días y 7 con consumo diario. Con 3 a 4 días no suman ni restan.
- **Resto sin cambio:** el bono de 3 puntos para cereales integrales, tubérculos y carnes blancas, la penalización de refinados, azúcares añadidos y ultraprocesados (−1, −4, −7 y −10) y la base de 10.

El máximo sigue en 82 y los cortes de nivel no cambian (Óptimo ≥ 75, Adecuado ≥ 55, Mejorable ≥ 35). Los puntos de las carnes rojas y de los embutidos, y el tope de 54, son una calibración de ATLAS sobre la escala que ya existía, no valores tomados de la literatura; la literatura fija el orden (procesadas más que rojas) y los umbrales de frecuencia.

El puntaje cambia el componente Alimentación del ICEC y, por esa vía, el dominio Epigenético-Contextual del DFI. **El ICEC debe quedar versionado**, porque los pacientes con carne roja frecuente pueden cambiar de nivel.

### 4.3 · Dominio alimentario, resumen y párrafos

| Lugar | Línea | Cambio |
|---|---|---|
| `calcularDominios` | 10549 | `nivelAlim` sale de `d1Clasificar`; el indicador lista los grupos en exceso |
| Resumen narrativo del Diagnóstico | 14699 | `d1TextoPatron` reemplaza la frase «se encontraron alimentos …» |
| `_resumenNutriParrafo` | 14168 | Bajo consumo, consumo elevado y consumo a moderar, con la frecuencia de cada grupo |
| `_resDietaCoarse` | 14211 | Cuenta déficits y excesos del clasificador |

### 4.4 · Vista Diagnóstico › Encuesta › D1

- Las tarjetas de riesgo y de grupos a moderar se leen por el peor grupo, no por el promedio (línea 15310). Los cereales integrales, tubérculos y carnes blancas conservan su lectura por promedio.
- Cada grupo de la lista lleva su categoría: Protector, Moderar, Limitar (carnes rojas) o Riesgo (línea 15336).
- Debajo de la lista hay una nota fija: el color indica si la frecuencia es adecuada para el grupo, no si el alimento es protector.
- La frase del patrón aparece al pie de la vista.

### 4.5 · Texto que recibe la IA

El texto que se envía para el diagnóstico integral (línea 15055) listaba las 15 frecuencias sin categorías, y la IA podía describir la carne roja como protectora. Ahora lleva además:

- la frase del patrón;
- la categoría de cada grupo;
- la instrucción de no describir las carnes rojas ni las procesadas como protectoras.

---

## 5 · Casos de prueba

Base de los casos: protectores en 5 a 6 días; cereales integrales, tubérculos y carnes blancas en 3 a 4 días; refinados, azúcares y ultraprocesados en «nunca».

| Caso | Embutidos | Carnes rojas | Patrón v16 | Dominio | ICEC alim. v15 | ICEC alim. v16 |
|---|---|---|---|---|---|---|
| A | 5 a 6 días | Diario | Riesgo | Crítico | 63 | 46 |
| B | Diario | Diario | Riesgo | Crítico | 60 | 40 |
| C | 5 a 6 días | Nunca | Riesgo | Alerta | 60 | 54 |
| D | Nunca | Nunca | Protector | Óptimo | 67 | 70 |
| E | Nunca | 1 a 2 días | Protector | Óptimo | 67 | 70 |
| F | 1 a 2 días | 3 a 4 días | Con aspectos por mejorar | Normal | 69 | 65 |
| G | 3 a 4 días | 1 a 2 días | Riesgo | Alerta | 63 | 54 |

Con embutidos 3 a 4 días o más (casos A, B, C y G) el puntaje queda en «Mejorable» o por debajo. Sin embutidos (D y E) sube 3 puntos, porque ahora cuentan los huevos y el consumo bajo de carne roja.

Verificación hecha sobre el archivo:

- los 3 bloques de código compilan;
- los 7 casos de la EB-BIS v7 siguen dando lo esperado;
- la vista D1 se revisó en el navegador con un paciente de prueba local, sin escribir en Supabase.

---

## 6 · ATLAS CNV: la encuesta del QR

La encuesta del QR (`supabase/seed.ts`, líneas 161 a 175) tiene 14 grupos en D1 y no coincide con el HTML:

| Clave | ATLAS CNV hoy | v16 |
|---|---|---|
| `d1_10_i` | Carnes magras (pollo sin piel, cerdo lomo, res magra) | Carnes blancas (pollo, pavo, aves sin piel) |
| `d1_12_i` | Carnes rojas y procesadas (res, cerdo, embutidos, salchicha, chorizo, tocineta) | Carnes procesadas y embutidos (salchicha, chorizo, jamón, tocineta, mortadela, enlatados) |
| `d1_15_i` | No existe | Carnes rojas (res, cerdo magro, cordero; vísceras 1 vez por semana) |

Lo que debe hacerse:

1. **Igualar D1 a los 15 grupos de v16**, con los mismos textos y porciones de `FREQ_GROUPS` (línea 1350): separar `d1_12_i`, crear `d1_15_i` y dejar `d1_10_i` solo para aves.
2. **Versionar el instrumento de D1.** Los registros anteriores no se pueden separar entre carne roja y embutidos.
   - Su `d1_12_i` se conserva y se clasifica con el umbral de carnes procesadas, que es el más estricto.
   - En pantalla se rotula «carnes rojas y procesadas (instrumento anterior)».
   - `d1_15_i` queda vacío en esos registros.
3. En los registros anteriores, `d1_10_i` incluía res y cerdo magros: se clasifica como carnes blancas y se marca con la misma versión del instrumento.

---

## 7 · ATLAS CNV: el motor congelado

En `src/clinical-engine/frozen/engine.dfi.js`, línea 40, el componente Alimentación del ICEC todavía usa la fórmula del recordatorio de 24 horas. Lee `d1_9` y `d1_10`, claves sin sufijo `_i` que la encuesta actual no guarda. El resultado es 30 para todos los pacientes: el ICEC y el dominio Epigenético-Contextual del DFI no reflejan la alimentación.

Lo que debe hacerse:

- reemplazar esa fórmula por `calcPatron` de v16, igual que hace el HTML con `LE8_MAPEO_CORREGIDO = true` (línea 8874);
- registrar la nueva versión del motor;
- recalcular el ICEC de las evaluaciones guardadas, conservando el valor anterior como histórico, igual que se hizo con la EB-BIS v5.

---

## Referencias

1. Bouvard V, Loomis D, Guyton KZ, Grosse Y, Ghissassi FE, Benbrahim-Tallaa L, et al. Carcinogenicity of consumption of red and processed meat. Lancet Oncol. 2015;16(16):1599-600. doi:10.1016/S1470-2045(15)00444-1
2. Micha R, Wallace SK, Mozaffarian D. Red and processed meat consumption and risk of incident coronary heart disease, stroke, and diabetes mellitus: a systematic review and meta-analysis. Circulation. 2010;121(21):2271-83. doi:10.1161/CIRCULATIONAHA.109.924977
3. Pan A, Sun Q, Bernstein AM, Schulze MB, Manson JE, Stampfer MJ, et al. Red meat consumption and mortality: results from 2 prospective cohort studies. Arch Intern Med. 2012;172(7):555-63. doi:10.1001/archinternmed.2011.2287
4. Wang X, Lin X, Ouyang YY, Liu J, Zhao G, Pan A, et al. Red and processed meat consumption and mortality: dose-response meta-analysis of prospective cohort studies. Public Health Nutr. 2016;19(5):893-905. doi:10.1017/S1368980015002062
5. Larsson SC, Orsini N. Red meat and processed meat consumption and all-cause mortality: a meta-analysis. Am J Epidemiol. 2014;179(3):282-9. doi:10.1093/aje/kwt261
6. Li C, Bishop TRP, Imamura F, Sharp SJ, Pearce M, Brage S, et al. Meat consumption and incident type 2 diabetes: an individual-participant federated meta-analysis of 1·97 million adults with 100 000 incident cases from 31 cohorts in 20 countries. Lancet Diabetes Endocrinol. 2024;12(9):619-30. doi:10.1016/S2213-8587(24)00179-7
7. Zhang R, Fu J, Moore JB, Stoner L, Li R. Processed and unprocessed red meat consumption and risk for type 2 diabetes mellitus: an updated meta-analysis of cohort studies. Int J Environ Res Public Health. 2021;18(20):10788. doi:10.3390/ijerph182010788
8. Wolk A. Potential health hazards of eating red meat. J Intern Med. 2017;281(2):106-22. doi:10.1111/joim.12543
9. Han MA, Zeraatkar D, Guyatt GH, Vernooij RWM, El Dib R, Zhang Y, et al. Reduction of red and processed meat intake and cancer mortality and incidence: a systematic review and meta-analysis of cohort studies. Ann Intern Med. 2019;171(10):711-20. doi:10.7326/M19-0699
10. Johnston BC, Zeraatkar D, Han MA, Vernooij RWM, Valli C, El Dib R, et al. Unprocessed red meat and processed meat consumption: dietary guideline recommendations from the Nutritional Recommendations (NutriRECS) Consortium. Ann Intern Med. 2019;171(10):756-64. doi:10.7326/M19-1621
11. Clinton SK, Giovannucci EL, Hursting SD. The World Cancer Research Fund/American Institute for Cancer Research Third Expert Report on Diet, Nutrition, Physical Activity, and Cancer: impact and future directions. J Nutr. 2020;150(4):663-71. doi:10.1093/jn/nxz268
12. Lichtenstein AH, Appel LJ, Vadiveloo M, Hu FB, Kris-Etherton PM, Rebholz CM, et al. 2021 Dietary guidance to improve cardiovascular health: a scientific statement from the American Heart Association. Circulation. 2021;144(23):e472-87. doi:10.1161/CIR.0000000000001031
13. Willett W, Rockström J, Loken B, Springmann M, Lang T, Vermeulen S, et al. Food in the Anthropocene: the EAT-Lancet Commission on healthy diets from sustainable food systems. Lancet. 2019;393(10170):447-92. doi:10.1016/S0140-6736(18)31788-4
14. Schröder H, Fitó M, Estruch R, Martínez-González MA, Corella D, Salas-Salvadó J, et al. A short screener is valid for assessing Mediterranean diet adherence among older Spanish men and women. J Nutr. 2011;141(6):1140-5. doi:10.3945/jn.110.135566
15. Lloyd-Jones DM, Allen NB, Anderson CAM, Black T, Brewer LC, Foraker RE, et al. Life's Essential 8: updating and enhancing the American Heart Association's construct of cardiovascular health: a presidential advisory from the American Heart Association. Circulation. 2022;146(5):e18-43. doi:10.1161/CIR.0000000000001078

## Bitácora bibliográfica

**Base:** PubMed, por el conector, el 2 de noviembre de 2026.

**Cadena principal:** `(red meat[Title] OR processed meat[Title]) AND (cardiovascular OR type 2 diabetes OR mortality) AND (meta-analysis[Title]) AND dose-response`, desde 2014, con 8 resultados.

**Búsquedas dirigidas:**
- por autor y título: IARC, Life's Essential 8, EAT-Lancet, AHA 2021 y MEDAS;
- por cita: Micha 2010, Pan 2012, NutriRECS 2019, WCRF/AICR 2020, InterConnect 2024 y Wolk 2017.

**Resultado:** 15 referencias verificadas en PubMed por PMID y DOI, ninguna retractada. La evaluación en Scite queda pendiente porque el conector no está autenticado en esta sesión.

*© Connected Nutrition Ventures SAS, 2026. Documento interno.*
