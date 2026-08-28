# Pendiente 11b · Las dos reglas de `generarAlertas` que leen el grupo equivocado

**Estado: LISTO PARA APLICAR, NO APLICADO.** Espera la respuesta de Gildardo a la pregunta 11b de la
ronda del 2026-08-28.

**No se aplica todavia por dos razones, y la segunda es la que manda:**

1. `generarAlertas` **no esta portada**, porque en su archivo no la llama nadie (punto 11a). Si el decide
   que quedo fuera a proposito, no hay nada que corregir.
2. Y si decide conectarla, **cual de los dos arreglos quiere es suyo**: corregimos al portar, o portamos
   literal y el corrige su archivo. La segunda deja las dos copias iguales, que para un porte fiel vale
   mas de lo que parece.

---

## El defecto

Su `FREQ_GROUPS` (archivo del 26, L1258-1306) define:

| `n` | Grupo |
|---|---|
| 13 | **Azucares añadidos y bebidas azucaradas** (gaseosas, jugos de caja, dulces, postres) |
| 14 | Ultraprocesados (PCBU) |
| 15 | Carnes rojas |

Y `generarAlertas` (L2716-2829) lee:

| Regla | Nivel | Lee | Deberia leer | Consecuencia |
|---|---|---|---|---|
| "Riesgo glucemico critico" | **critico** | `enc.d1_15` (carnes rojas) | `enc.d1_13` | Un diabetico con alto consumo de bebidas azucaradas NO dispara la alerta; uno que come carne roja, si |
| "Estres alto + azucares elevados" | moderado | `enc.d1_14` (ultraprocesados) | `enc.d1_13` | La alerta se llama de azucares y mide otra cosa |

El texto de la primera lo delata solo: dice *"N porciones de **bebidas azucaradas** con DM2"* mientras lee
carnes rojas.

## El cambio, si responde que si

```diff
-  if (dx.includes("Diabetes tipo 2") && (Number(enc.d1_15) || 0) >= 2) al.push({
+  if (dx.includes("Diabetes tipo 2") && (Number(enc.d1_13) || 0) >= 2) al.push({
     niv: "crítico",
     ico: "🔴",
     t: "Riesgo glucémico crítico",
-    txt: `${Number(enc.d1_15)} porciones de bebidas azucaradas con DM2.`,
+    txt: `${Number(enc.d1_13)} porciones de bebidas azucaradas con DM2.`,
     dom: "D1+D5"
   });
```

```diff
-  if (enc.d3_29 >= 7 && (Number(enc.d1_14) || 0) >= 2) al.push({
+  if (enc.d3_29 >= 7 && (Number(enc.d1_13) || 0) >= 2) al.push({
     niv: "moderado",
     ico: "🟡",
     t: "Estrés alto + azúcares elevados",
```

## Lo que hay que verificar AL PORTAR, ademas del campo

Dos cosas que no se ven en el diff y que ya nos han mordido:

1. **La FORMA del valor.** Su codigo hace `Number(enc.d1_13)`. En Atlas los campos `d1_N` guardan el
   TEXTO de la frecuencia ("3-4 veces/semana"), no el indice 0-4; el indice vive en `d1_N_i`. Un
   `Number()` sobre el texto da `NaN`, que con `|| 0` se vuelve 0 y **la regla no dispara nunca, en
   silencio**. Es exactamente el defecto de [[porte-que-lee-encuesta-verificar-forma-del-enc]]. Al portar,
   verificar contra la BD cual de los dos campos hay que leer.
2. **Si la forma correcta es `d1_13_i`**, entonces el umbral `>= 2` esta en la escala del indice
   (0=Nunca .. 4=Todos los dias), no en porciones. El texto de la alerta dice "N porciones", asi que ese
   texto tambien habria que preguntarlo: no es lo mismo "2 porciones" que "indice 2 = 3-4 veces/semana".

## Candado que debe ir con el porte

Un test que, para cada una de las dos reglas, **dispare con el grupo correcto y NO dispare con el que
leia antes**. Sin la segunda mitad el candado no distingue el arreglo del defecto.
