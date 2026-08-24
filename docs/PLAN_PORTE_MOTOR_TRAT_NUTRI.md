# Plan del porte de `motorTratNutri` (preparado, NO construido)

**Estado:** listo para arrancar **en cuanto lleguen las cuatro respuestas de la Parte 1 de la ronda del 24**. Este documento es el mapa, no el trabajo.

**Por qué espera:** las cuatro preguntas cambian **qué** se porta, no cómo. La del "por grupo" cambia la forma del dato guardado; la del déficit doble y la de la proteína del desnutrido cambian dos de las nueve filas; el par de ECM/BCM es un dato que falta.

---

## 1. Qué gobierna a partir del porte

Gildardo (2026-08-23): **`motorTratNutri` gobierna la prescripción nutricional**, con tres correcciones. `motorProtocolo` **no desaparece**: sigue produciendo el fenotipo, el peso de cálculo, los exámenes, la suplementación, el resumen clínico, la alerta de realimentación y los flags. Lo que cambia de dueño es **la cadena calórica y las restricciones**.

### Las nueve filas, con su origen nuevo

| Fila | Hoy (`motorProtocolo` / `protocolo-calorico`) | Tras el porte |
|---|---|---|
| Sodio (HTA) | < 2.300 mg | **< 1.500 mg** |
| Sodio (ERC) | no fija | **2.000 mg** (gana el más restrictivo) |
| Proteína en cáncer | 1,5-2,0 g/kg | **1,25 g/kg** *(pendiente 1.3: ¿aplica también a desnutrición?)* |
| Peso base de la proteína | peso de cálculo | **peso de referencia (meta)** |
| GEB | Cunningham si hay FFM | **Mifflin siempre** *(él pide no cambiarlo ahora, y anotarlo)* |
| Factor de actividad | 1,375 por defecto | **el sugerido por el motor de ejercicio** |
| Déficit | 0 siempre | **sugerido y editable** *(pendiente 1.2: ¿sigue en 500?)* |
| Objetivo en cáncer o desnutrición | GET de mantenimiento | **27,5 kcal × peso actual** |
| Grasa en dislipidemia | 30 % siempre | **25 % + saturada < 7 %** |

Y llegan piezas que hoy no tenemos: `tipoEnergia`, los **atributos de la dieta** (hiposódica, DASH, nefroprotectora, hiperproteica), `grasaSatMax`, las notas, las referencias, los chips y la etiqueta ("Dieta Hipocalórica de N kcal/día").

### Las tres correcciones

1. **Déficit como sugerencia editable**, no impuesto. Sale del motor propone / profesional dispone.
2. **Gasto sobre el peso de referencia**, no sobre el actual. Él lo llama inconsistencia interna de su motor: la proteína ya sale del peso meta y la energía no.
3. **Proteína en cáncer a 1,25**, anotada en la trazabilidad como el único punto donde el motor que gobierna es el menos actualizado.

**Las tres se aplican por el mecanismo de MODIFICACIONES AUTORIZADAS**, no editando el frozen: el original conserva su byte-identidad con el archivo de Gildardo y su DIFF sigue verde; el generador produce el `*.authorized.js` que corre. Cada una con su `caId` y su instrucción verbatim. Regla 16.

---

## 2. Cómo se porta

1. **Extracto verbatim por script** de `motorTratNutri` desde la entrega vigente (2026-08-19) a `frozen/atlas-trat-nutri.js`. No se teclea.
2. **Test DIFF byte a byte** contra la fuente, como los otros cuatro motores.
3. **Las tres correcciones al manifiesto** de modificaciones autorizadas, con su instrucción citada; regenerar el `.authorized.js`.
4. **Golden diferencial contra su propia función**: se extrae `motorTratNutri` a un fixture de referencia y se compara salida contra salida con casos que cubran las ramas (sano, obesidad, obesidad+sarcopenia, sarcopenia sola, ERC, cáncer, desnutrición, dislipidemia, HTA, alteración hídrica, TCA). **Paridad exacta salvo en las tres correcciones**, que llevan su propia aserción diciendo en qué difieren y por qué.
5. **Cablear**: `protocolo.ts` deja de llamar a `computeProtocoloCalorico` para la cadena y llama al motor nuevo; `computeProtocoloEfectivo` recompone el set efectivo sobre los mismos inputs sellados.
6. **`peso-meta.ts`** ya tiene portado el default de Lorentz; entra aquí como el "peso de referencia" de la corrección 2.
7. **Dependencia declarada:** el factor de actividad sale de `motorTratEjercicio.faRec`, que **ya está portado**. Si lanza, cae a "ligera" (1,375), que es el valor de hoy.

---

## 3. El efecto en cadena, que es lo que hace grande al porte

El objetivo calórico **no es una cifra más**: es el insumo del resto del plan.

```
objetivo calórico  →  porciones del intercambio  →  distribución por tiempos  →  validación (% y ICN)
                   →  proteína y grasa objetivo  →  menú
```

Si el objetivo se mueve, **se mueve todo lo de abajo**. Consecuencias concretas:

- **Los planes guardados quedan desfasados.** El intercambio guarda `objetivoBase` justo para esto: el aviso de desfase ya existe y se disparará solo (DIV-11: avisa, no recalcula por su cuenta). **Hay que verificar que ese aviso se vea también cuando lo que cambió fue el motor**, no solo cuando el profesional movió un ajuste.
- **La validación de nutrientes cambia dos veces**: por el objetivo nuevo y por P-27 (los micronutrientes se ajustan por patología). Van juntas.
- **El menú**: su prompt lleva el objetivo y la proteína, así que cambia lo que se le pide a la IA. Se hace **después**, en la pieza 4, no dentro de este porte.

---

## 4. Qué pasa con lo ya emitido

Esta es la parte que hay que decidir antes de portar, no después.

### Lo que el mecanismo YA resuelve

- **`protocol_suggested` es write-once**, sellado al diagnosticar, con su `protocolEngineVersion` dentro. Sube `PROTOCOL_ENGINE_VERSION` (bump a la fecha del porte) y **los diagnósticos nuevos se sellan con la nueva; los viejos conservan la suya**. Es exactamente para lo que existe el campo. No se reescribe nada.
- **`protocol_approved` está congelado por trigger** y ya sella **las dos versiones** (la del sugerido y la de la aprobación) más `versionMismatch`. Un tratamiento aprobado antes del porte queda identificable como emitido con la ciencia anterior.
- **La inmutabilidad es la conducta correcta**, no un problema: un registro clínico no se reescribe cuando la ciencia cambia. Se deja constancia de con qué se emitió.

### El hueco real, y no es nuevo

**Un tratamiento aprobado con el motor viejo sigue prescribiendo ciencia que ya no rige, y no hay forma de reemitirlo.** El mecanismo de **sucesión de versiones / reemisión no existe** (registrado en `BACKLOG.md`, junto al flujo de corrección post-diagnóstico y a la recalibración de la EB-BIS, que es el otro caso previsto). Este porte es el **segundo caso concreto** que lo necesita.

**Mitigación honesta mientras no exista:** el sodio del hipertenso pasa de 2.300 a 1.500. Para un paciente ya aprobado, eso no se corrige solo. **La salida clínica es la que ya existe: una evaluación nueva**, que emite un diagnóstico y un protocolo nuevos con la ciencia vigente. Hay que decirlo en el sitio donde se ve un protocolo aprobado con versión anterior, no dejar que se descubra.

### Un hueco pequeño que este porte SÍ debe cerrar

El aviso de cruce de versiones del seguimiento (`comparison-reader.ts:142`) compara **solo `versions.engine`** (el motor de diagnóstico). **No mira `PROTOCOL_ENGINE_VERSION`.** Así que un seguimiento que cruce este porte **no avisará**, porque el motor de diagnóstico puede no haberse movido. Es chico y va dentro del porte: si cambia el motor de la prescripción, un seguimiento que lo cruce tiene que decirlo.

---

## 5. Orden de subtareas

| # | Subtarea | Depende de |
|---|---|---|
| 1 | Extracto verbatim + DIFF | nada |
| 2 | Golden diferencial contra su función, con las once ramas | 1 |
| 3 | Las tres correcciones al manifiesto + regenerar | respuestas 1.2 y 1.3 |
| 4 | Bump de `PROTOCOL_ENGINE_VERSION` + su entrada de historia | 3 |
| 5 | Cablear la cadena (`protocolo.ts`, `computeProtocoloEfectivo`) | 3 |
| 6 | El aviso de cruce mira también la versión del protocolo | 5 |
| 7 | Verificar que el desfase del intercambio se dispara por cambio de motor | 5 |
| 8 | P-27: micronutrientes ajustados por patología | 5 |
| 9 | Recomendaciones por diagnóstico (P-33/P-34 ya respondidas: FMI 6/9 y FFMI 17/15 con sexo) | 5 |

**Lo que NO entra aquí:** la pieza 4 del menú (espera la Parte 3 de la ronda), la lista de intercambio por ciudad (proxy caído), y el cambio de Cunningham a Mifflin queda **anotado, no discutido**: él pidió no cambiarlo ahora.

---

## 6. Lo que hay que verificar al terminar

- Los golden del motor de diagnóstico **siguen verdes**: este porte no toca `motorProtocolo` ni el DFI.
- Un protocolo aprobado **antes** del porte no cambia ni un decimal (test explícito: se leen, no se recomputan).
- El paciente demo de realimentación (F10) sigue disparando su aviso, y su proteína **cambia** si 1.3 se resuelve a favor de 1,25: es el caso donde se ve.
