# Respuesta a la ronda del 2026-08-24 · Parte 1

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 26 de agosto de 2026

Van **las cuatro que bloquean el porte**, para que arranquen hoy. El resto de la ronda —el 3.1, el 7.1,
el 8.5 y lo demás— va en un segundo documento; no quiero que esperen a que yo despache veinticinco
puntos para portar el motor.

**Y el 1.2 lo agarraron ustedes, no yo.** Iba a hacer que un paciente comiera 900 kcal por debajo de su
mantenimiento sin que nadie lo hubiera prescrito. Lo detallo abajo porque conviene que quede escrito
cómo pasó.

---

## 1.1 · La casilla de porciones va en el nivel 1: los 12 grupos

**Los 12.** Era vocabulario, como sospechaban: cuando digo «número de porciones por grupo» me refiero al
grupo —Harinas, Lácteos, Carnes—, no al subgrupo.

**Muevan la casilla del nivel 2 al nivel 1.** Sí, eso los aleja de mi archivo, y está bien: mi archivo
tiene la casilla en el subgrupo y eso es lo que hay que cambiar.

**Lo que decide este cambio, y por eso lo pregunto una sola vez:** con la casilla en el grupo, la
distinción **entera contra descremada, magra contra grasa** deja de decidirla el nutricionista y pasa a
la selección por ciudad, que es el P-26. El nutricionista prescribe «3 porciones de lácteos» y la IA
resuelve cuáles, con los alimentos representativos de donde vive el paciente.

Es coherente con lo que ya les dije: la representatividad local es de la IA, la cantidad es del
profesional. Si el nutricionista quiere una leche concreta, la escribe en las guías del plan.

Los 350 alimentos siguen desplegándose dentro del grupo para consultarlos. No llevan casilla.

## 1.2 · El déficit queda en CERO. Manda el peso meta

**Tienen razón y el error era mío.** El gasto calculado sobre el peso meta **ya es** la ingesta que
lleva a ese peso: el déficit está dentro del número. Pedirles además que le resten 500 aplicaba un
segundo descuento sobre el primero.

Lo verifiqué con un caso: hombre de 40 años, 100 kg, 175 cm, peso meta 69 kg.

| | Gasto | Menos 500 |
|---|---|---|
| Sobre peso actual (como estaba) | 2.611 | 2.111 |
| **Sobre peso meta** | **2.185** | 1.685 |

Pasar el cálculo al peso meta ya le quita **426 kcal**. Restarle 500 encima lo deja **926 kcal por debajo
de su mantenimiento real**. En este paciente el piso de 1.500 no se activa; en una mujer con obesidad y
talla baja sí, porque su peso meta es menor y su piso es 1.200. Habría llegado al piso **por dos vías
sumadas**, no porque alguien lo prescribiera.

**Entonces:**

- **`deficit = 0`.** El objetivo calórico es el gasto sobre el peso de referencia, sin más descuentos.
- **El peso meta es el único que fija el objetivo.** Es la palanca, y es la que el profesional mueve:
  si acuerda con el paciente un peso meta menos ambicioso, el objetivo sube solo. Eso es más honesto
  que un déficit suelto, porque el profesional ve la meta que está prescribiendo en kilos y no en un
  número de calorías desconectado.
- **El piso de 1.500 / 1.200 se conserva** como red de seguridad. Con el déficit en cero casi nunca
  debería activarse; si se activa, es señal de que el peso meta quedó demasiado bajo y hay que revisarlo.

**Cómo pasó, para que no se repita:** yo di dos instrucciones correctas por separado —calcular sobre el
peso de referencia, y conservar el déficit como sugerencia— sin ver que juntas se sumaban. Ustedes lo
vieron al ponerlas en la misma cadena. **Cuando dos correcciones mías caigan sobre el mismo número,
súmenlas antes de aplicarlas y díganme el resultado**, como hicieron aquí.

## 1.3 · Separen la rama. El desnutrido conserva 1,5–2,0 g/kg

**Sepárenla.** Cáncer y desnutrición no son la misma indicación proteica y hoy comparten línea:

```js
if (hasCancer || desnutricion) { protKg = 1.25; }
```

**El desnutrido conserva el rango alto: 1,5 a 2,0 g/kg.** No es una cifra que invente ahora — es la que
mi propio archivo ya asigna a los fenotipos **F7 y F10** en `motorProtocolo`. La rama que se separa
recupera el rango que esa población siempre tuvo.

**Cáncer queda en 1,25** por la decisión del 23, y sigue anotado como el punto donde el motor que
gobierna es el menos actualizado. Lo reviso en su ronda.

**Y noten que el motor ya las trataba como distintas en todo menos en el número:** el texto, los
atributos y las referencias ya se bifurcan —GLIM/ESPEN/ASPEN para desnutrición, ESPEN 2021 y ESMO para
cáncer—, y la nota de realimentación (fosfato, potasio, magnesio; iniciar a 10–15 kcal/kg si hay riesgo)
solo sale en la rama de desnutrición. Lo único compartido era `protKg`. Separarlo termina algo que
estaba a medio hacer, no inventa una distinción nueva.

**Vigilen que la nota de realimentación siga viajando con la rama** al separarla. Es lo que protege al
paciente más frágil de los dos.

## 1.4 · ECM/BCM no se estratifica, y queda declarado

**Se queda sin estratificar en 1,4 para ambos sexos, y esto es una excepción declarada, no un descuido.**

La razón: el ECM/BCM **no tiene puntos de corte por sexo establecidos**, a diferencia del FFMI, el ASMI
o el FMI, donde sí hay tablas. Darles dos números habría sido inventar un umbral clínico, que es
justamente lo que ustedes se negaron a hacer. Hicieron bien en no tocarlo.

### La regla del 23 se corrige, entonces

Dije: «toda la composición corporal se estratifica por sexo; si encuentran uno que no lo hace, es un
defecto». **Estaba mal enunciada.** Queda así:

> **Se estratifica por sexo todo umbral de composición corporal para el que exista un punto de corte
> por sexo publicado.** Cuando no exista, el umbral se queda único **y se declara como tal en la
> trazabilidad**, con el motivo.

La diferencia entre un umbral único **declarado** y uno que nadie miró es toda. Lo primero es una
decisión; lo segundo es el defecto que encontramos en SMM/W y en el bloque de sarcopenia.

**Anoten `ECM/BCM > 1,4` como el primer umbral único declarado**, con la razón. Si aparece otro,
tráiganmelo con la misma pregunta: no lo estratifiquen por analogía.

**Y sobre `MCA_dif < −1`:** de acuerdo con su lectura, no hace falta. Es un residuo contra `MCA_ref`, y
el equipo entrega esa referencia por sexo y edad, así que la estratificación ya está dentro del
comparador. No lo toquen.

---

## Sobre su Parte 2 · salud celular

Recibido, y con eso cierro mi pregunta. Salió de mi archivo, de la línea 17126, dentro de la subpestaña
del nutricionista. **No hubo interpretación de su parte y no hay más piezas movidas de sitio**, que era
lo que quería descartar. El cambio a Diagnóstico es mío.

---

## Resumen

| # | Decisión |
|---|---|
| 1.1 | **Nivel 1: los 12 grupos.** La casilla se mueve del subgrupo al grupo. Entera/descremada la resuelve la IA por ciudad |
| 1.2 | **`deficit = 0`.** El peso meta es el único que fija el objetivo. El piso 1.500/1.200 se conserva como red |
| 1.3 | **Separar la rama.** Desnutrición **1,5–2,0 g/kg** (el rango de F7/F10 de mi archivo); cáncer 1,25. La nota de realimentación viaja con desnutrición |
| 1.4 | **Sin estratificar, y declarado.** La regla del 23 queda corregida: se estratifica donde exista corte por sexo publicado; donde no, umbral único **declarado** |

**Pueden portar `motorTratNutri`.** Las tres correcciones del 23 siguen en pie con el 1.2 sustituido:
déficit en **cero** (no 500 editable), gasto sobre **peso de referencia**, y la proteína **separada** por
rama.

**El resto de la ronda va en un segundo documento.** No esperen a que llegue para arrancar con esto.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
