# El omega en el modelo y en las consultas

**Connected Nutrition Ventures · Atlas · 11 de noviembre de 2026 · Para Santiago, para pasarle al gerente**

---

## El párrafo, para pasarlo tal cual

> **El omega no es una recomendación ocasional del sistema: es la base de casi toda la Diana.** El modelo
> ANI BIS-E clasifica cada consulta en uno de 81 estados (el cruce de la función celular y el riesgo
> celular con la masa muscular y la masa grasa), y **en 67 de esos 81 estados el modelo sugiere OMEGA
> COMPLEX**. Los 14 estados donde no lo sugiere tienen todos una cosa en común: son los de **masa muscular
> baja sin señal inflamatoria**, donde la prioridad estructural es recuperar músculo y hueso, así que la
> lista la encabezan SARCO-PROTECT, D3-K2 OSTEO y MULTI-CELL BASE. Es decir: el omega entra cuando hay algo
> que corregir en la función o en el riesgo celular, y cede el puesto solo cuando lo urgente es la masa.
>
> **Y una distinción que conviene tener clara para leer cualquier cifra de ventas:** el sistema **sugiere**,
> el profesional **prescribe**. Las dos cosas se registran por separado en Atlas, así que la diferencia
> entre "en cuántas consultas el modelo lo sugirió" y "en cuántas se prescribió" no es un error del
> sistema: es la decisión clínica de cada profesional, consulta por consulta.

> **Y las cifras de la casa, medidas el 11 de noviembre sobre las consultas reales:** de las **497**
> consultas vigentes con tratamiento, **434** tienen informe sellado, y en **las 434 el modelo sugirió
> OMEGA COMPLEX** (el 100 %). Se prescribió en **322 de las 497** (65 %). Donde el modelo lo sugirió y
> hay con qué comparar, se prescribió en **291 de 434** (67 %).

---

## Las cifras de la cohorte, y cómo leerlas sin equivocarse

Corrida por Santiago contra la nube el 11 de noviembre de 2026.

| | Consultas |
| --- | --- |
| Vigentes **con tratamiento** (el denominador que pidió el gerente) | **497** |
| De ellas, con informe de paciente sellado (hay con qué comparar) | 434 |
| El modelo lo **sugirió** | **434 de 434** (100 %) |
| El profesional lo **prescribió** | **322 de 497** (64,8 %) |
| Sugerido **y** prescrito | 291 |
| Sugerido y **no** prescrito | 143 |
| Prescrito **sin informe con el que comparar** | 31 |

**Tres lecturas que conviene hacer, y una que NO hay que hacer:**

1. **El 100 % no es un redondeo: en esta cohorte ninguna consulta cayó en los 14 estados que no lo
   sugieren.** Los catorce tienen masa muscular baja, y entre 434 consultas no hay ninguna ahí. O sea
   que la base de la que habla el párrafo de arriba no es teórica: hoy aplica a todos.
2. **De las 434 donde el modelo lo sugirió, se prescribió en 291.** Las otras 143 son decisión clínica,
   no un fallo: el motor propone y el profesional dispone. Es un dato para conversar con los
   profesionales, no para corregirles.
3. **Los 31 "prescritos sin que el modelo lo sugiriera" NO son profesionales apartándose del modelo.**
   Así los rotulaba la primera versión del script, y era un error de redacción con consecuencias: son
   consultas **con tratamiento y sin informe sellado**, o sea que no hay snapshot con el que comparar.
   La aritmética lo demuestra: el modelo lo sugirió en el 100 % de las que SÍ tienen informe, así que
   una consulta prescrita que no aparece en "sugerido" solo puede ser una de las 63 sin informe. El
   script ya las cuenta aparte y las rotula *"sin informe para comparar"*.

**Y LA QUE NO HAY QUE HACER:** estas cifras son de la ciencia de HOY. La v17 de la Dirección Científica
mueve el estado de la Diana de dos de cada tres consultas, y la lista de nutracéuticos sugeridos se mueve
con el estado. **El "67 de 81" del párrafo no cambia** (es el mapa del modelo, que la v17 no toca), pero
las cifras de la cohorte sí van a moverse cuando el histórico se recalcule. Si el gerente va a usar estos
números para una proyección, conviene decirle la fecha de la medición.

---

## De dónde sale cada cifra

**Los 81 estados y el producto exacto** salen del motor clínico congelado, no de una estimación: se
recorren las 81 combinaciones y se lee la lista de nutracéuticos que el modelo asocia a cada una. El
nombre exacto del producto en el catálogo es **OMEGA COMPLEX**.

**Los 14 estados que no lo sugieren** (número de estado, anillo·sector y por qué):

| Estado | Anillo·Sector | IFC | IRC | FFMI | FMI | Lo que sugiere en su lugar |
| --- | --- | --- | --- | --- | --- | --- |
| #7 | A1·S7 | Alto | Bajo | Bajo | Bajo | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE |
| #8 | A1·S8 | Alto | Bajo | Bajo | Normal | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE |
| #9 | A1·S9 | Alto | Bajo | Bajo | Alto | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE |
| #16 | A2·S7 | Alto | Normal | Bajo | Bajo | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE |
| #17 | A2·S8 | Alto | Normal | Bajo | Normal | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE |
| #18 | A2·S9 | Alto | Normal | Bajo | Alto | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE |
| #25 | A3·S7 | Normal | Bajo | Bajo | Bajo | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS |
| #26 | A3·S8 | Normal | Bajo | Bajo | Normal | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS |
| #27 | A3·S9 | Normal | Bajo | Bajo | Alto | SARCO-PROTECT, D3-K2 OSTEO, MULTI-CELL BASE, MITO-Q10 PLUS |
| #34 | A4·S7 | Normal | Normal | Bajo | Bajo | SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE |
| #35 | A4·S8 | Normal | Normal | Bajo | Normal | SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE |
| #36 | A4·S9 | Normal | Normal | Bajo | Alto | SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE |
| #57 | A7·S3 | Bajo | Bajo | Normal | Bajo | MITO-Q10 PLUS, SARCO-PROTECT, MULTI-CELL BASE, D3-K2 OSTEO |
| #62 | A7·S8 | Bajo | Bajo | Bajo | Normal | SARCO-PROTECT, MITO-Q10 PLUS, D3-K2 OSTEO, MULTI-CELL BASE |

**Trece de los catorce tienen FFMI bajo** (masa muscular baja). El único que no es el **#57**, donde todo
está en la banda baja menos la masa muscular: ahí la lista prioriza el soporte mitocondrial. **Y en los
catorce el IRC no está alto**, que es la otra mitad de la regla: en cuanto hay señal de riesgo celular, el
omega vuelve a entrar.

**Las dos cifras de la cohorte** salen de `scripts/el-omega-en-la-cohorte.mjs` (solo lectura, sin ningún
dato de paciente), que hay que correr contra la nube:

```
node --env-file=.env.production.local scripts/el-omega-en-la-cohorte.mjs
```

Y mide tres cosas distintas, que no hay que confundir:

- **sugerido**: la lista que el motor **selló en el informe** de esa consulta (`snapshot.nutraceuticos`).
  Es una propiedad del estado de la Diana, no la decisión de nadie;
- **prescrito**: lo que el profesional **firmó en la ruta de atención** (`treatment_nutraceuticals`);
- y el cruce de las dos, incluido **lo prescrito sin que el modelo lo sugiriera**, que también existe y es
  legítimo: la Regla 0 del proyecto dice que *el motor propone y el profesional dispone*.

El denominador que pidió el gerente es **las consultas vigentes con tratamiento**, no todas las consultas:
una consulta sin ruta de atención no tuvo ocasión de prescribir nada.
