# El omega en el modelo y en las consultas

**Connected Nutrition Ventures · Atlas · 11 de noviembre de 2026, con las cifras de la cohorte corregidas el 15 · Para Santiago, para pasarle al gerente**

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

> **Y las cifras de la casa, medidas el 15 de noviembre sobre las consultas reales:** de las **532**
> consultas vigentes con tratamiento, el modelo sugirió OMEGA COMPLEX en **530** (el 99,6 %). Se
> prescribió en **346** (65 %). De las 530 donde el modelo lo sugirió, se prescribió en **346** y no se
> prescribió en **184**. Y en **ninguna** consulta se prescribió sin que el modelo lo sugiriera.

---

## Las cifras de la cohorte, y cómo leerlas sin equivocarse

Corrida por Santiago contra la nube el **15 de noviembre de 2026**.

> **Estas cifras reemplazan las del 11 de noviembre, que estaban cortadas.** La medición pedía las
> tablas enteras sin paginar, y PostgREST devuelve como máximo mil filas **sin decirlo**: no hay error
> ni aviso, la respuesta llega completa en apariencia. Así que la corrida del 11 midió la parte de la
> cohorte que cabía en mil filas y calculó porcentajes sobre ella como si fueran de todas. El script se
> arregló el 12 (pagina de mil en mil, con un orden estable) y esta corrida es la completa.

| | Consultas |
| --- | --- |
| Vigentes **con tratamiento** (el denominador que pidió el gerente) | **532** |
| El modelo lo **sugirió** | **530 de 532** (99,6 %) |
| El profesional lo **prescribió** | **346 de 532** (65 %) |
| Sugerido **y** prescrito | **346** |
| Sugerido y **no** prescrito | **184** |
| Prescrito **sin que el modelo lo sugiriera** | **0** |

**Tres lecturas que conviene hacer, y una que NO hay que hacer:**

1. **El 99,6 % no es el 100 %, y la diferencia son dos consultas.** La corrida cortada decía 100 %, y
   con la cohorte entera aparecen **2 consultas en alguno de los 14 estados que no lo sugieren** (los
   catorce tienen masa muscular baja). O sea que el mapa del modelo no es teórico ni en la excepción:
   la regla del párrafo de arriba se cumple en 530 de 532, y donde no se cumple es porque el estado de
   esa persona es uno de los catorce.
2. **De las 530 donde el modelo lo sugirió, se prescribió en 346.** Las otras 184 son decisión clínica,
   no un fallo: el motor propone y el profesional dispone. Es un dato para conversar con los
   profesionales, no para corregirles.
3. **En NINGUNA consulta se prescribió sin que el modelo lo sugiriera.** La corrida cortada mostraba 31
   ahí, y hubo que explicarlas dos veces. La primera redacción del script las rotulaba *"prescrito sin
   que el modelo lo sugiriera"*, que se lee como profesionales apartándose del modelo; se corrigió a
   *"sin informe para comparar"* razonando que, si el modelo lo sugería en el 100 % de las que tienen
   informe, una prescrita que no apareciera en "sugerido" solo podía ser de las que no tenían informe.
   **El razonamiento daba el resultado correcto por una causa equivocada:** esas 31 consultas SÍ tenían
   su informe sellado en la base, y lo que pasaba es que el script no lo leía, porque la lectura de
   informes se cortaba en la fila mil. Con la cohorte entera no son 31 ni 63: son **cero**. Lo que no
   cambia, y es lo que le importa al gerente, es la conclusión: **nadie prescribió OMEGA COMPLEX en una
   consulta donde el modelo no lo sugiriera.**

**Y LA QUE NO HAY QUE HACER:** estas cifras son de la ciencia de HOY. La v17 de la Dirección Científica
mueve el estado de la Diana de dos de cada tres consultas, y la lista de nutracéuticos sugeridos se mueve
con el estado. **El "67 de 81" del párrafo no cambia** (es el mapa del modelo, que la v17 no toca), pero
las cifras de la cohorte sí van a moverse cuando el histórico se recalcule. Si el gerente va a usar estos
números para una proyección, conviene decirle la fecha de la medición.

**Y la lección de las dos corridas, que vale más que cualquiera de las dos cifras:** una medición
incompleta no se parece a una medición incompleta. Se parece a una medición. Las cifras del 11 eran
creíbles, cuadraban entre sí y daban un 100 % redondo que invitaba a usarlo como titular. Lo único que
las delató fue que una de ellas (los 31) exigía una explicación demasiado rebuscada.

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
