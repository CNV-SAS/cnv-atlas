# Gildardo: una capacitancia de 16,22 nF

**Dos partes, y la segunda puede esperar.** La **Parte 1** es el caso de una paciente que hoy está sin
diagnóstico: es lo urgente y tiene respuesta corta. La **Parte 2** es una tabla para confirmar o corregir los
otros límites, cuando puedas. No hace falta contestar las dos a la vez.

---

# Parte 1 · La paciente que está sin diagnóstico

**Una pregunta de ciencia, corta.** Una paciente tiene una medición con **capacitancia de membrana
C = 16,22 nF**. Atlas la frenó y no generó su diagnóstico.

**La medición no parece mal tomada:** se revisó y el valor sale igual. Y es **la única**: de 12.434 valores
crudos de bioimpedancia en la base, este es el único fuera de lo esperado. Ninguna otra medición, y ninguna de
las ya diagnosticadas, tiene un valor así.

---

## Por qué se frenó, que es lo que hace la pregunta urgente

La capacitancia alimenta **tres de los índices primarios**, y en direcciones opuestas:

| Índice | Fórmula | Efecto de una C inflada |
| --- | --- | --- |
| **IFC** | `C / R∞ × 1000` | **Sube** en la misma proporción |
| **IRC** | `Re / (Ri · C) × 10` | **Baja** en la misma proporción |
| **PABU** | `(Re + Ri) · k / (R∞ · C)` | **Baja** en la misma proporción |

Los tres entran a la clave del estado EFR. Con los cortes de tu archivo para mujer:

- **IFC**: alto es mejor (>3,28 = *Función óptima*). Una C varias veces mayor multiplica el IFC: lo empuja hacia
  **función óptima**.
- **IRC**: bajo es mejor (<2,3 = *Bajo riesgo*). Una C varias veces mayor divide el IRC: lo empuja hacia **bajo
  riesgo**.
- **PABU**: igual, se desploma.

**El punto: una capacitancia inflada no produce una alarma falsa, produce un "todo bien" falso.** Los tres
índices se mueven hacia el extremo sano a la vez, y el informe no se contradice consigo mismo, así que nadie lo
notaría. Por eso se prefirió frenar antes que emitir.

**Pero frenar también tiene su costo:** esa paciente está hoy sin diagnóstico, y si el valor es posible, la
estamos dejando sin resultado por nada.

---

## Lo único tuyo que tenemos sobre C

Tu archivo (v9, línea 7121) estandariza la capacitancia contra una referencia poblacional, igual que hace con
FMI y FFW en las líneas de al lado:

```js
const cZ2 = _zBis(bis.C, 1.8294, 0.7719);   // media 1,8294 · desviación 0,7719
```

Si esa media y esa desviación son de tu cohorte, **16,22 queda muy lejos: unas 18 desviaciones por encima, casi
nueve veces la media.** Es el único punto de comparación que encontramos en tu archivo, y por eso preguntamos en
vez de decidirlo.

---

## Las cuatro preguntas

1. **¿Cuál es el rango fisiológico de la capacitancia de membrana en tu modelo, y de dónde sale** (artículo,
   cohorte, el manual del equipo)?
2. **¿Ese límite es igual para hombres y mujeres**, o depende del sexo, la edad o algo más? Tus cortes de IFC,
   IRC y PABU sí dependen del sexo; de este no sabemos.
3. **Y si 16,22 es un valor posible**: ¿qué significa clínicamente, y hay que decir algo en el informe cuando
   aparece?
4. **Y qué hacemos con esta paciente.** Si el valor sirve, ¿se desbloquea su medición **tal cual** y se genera
   su diagnóstico con ella, o hay que **repetir la toma igual** antes de emitir nada? Son dos cosas distintas:
   en la primera su consulta se destraba sola en cuanto nos digas; en la segunda hay que llamarla y citarla.

**Mientras tanto no se toca nada.** La medición sigue frenada y esa consulta sin diagnóstico: preferimos eso a
emitir un resultado que diga que la paciente está mejor de lo que está.

---

## De dónde sale el límite que la frenó

Por si lo preguntas, y para que la respuesta sea útil: **el rango que hoy la frena (0,3 a 8 nF) lo pusimos
nosotros al portar el motor**, como cinturón contra un export con la columna o la unidad equivocada. No sale de
tu archivo, que no fija ningún límite para C: la usa directamente en las tres fórmulas.

Lo decimos porque cambia lo que te estamos pidiendo. **No es "revisa tu rango": es "danos el tuyo",** y
sustituimos el nuestro por el que digas, con su fuente escrita al lado.

---
---

# Parte 2 · Los otros ocho rangos, para cuando puedas

**Esto NO es urgente y no bloquea a nadie hoy.** Es la lista completa de los límites que Atlas usa para
rechazar una medición antes de dejarla entrar al modelo. **Los pusimos nosotros al portar el motor**, por la
misma razón que el de la capacitancia: que un archivo mal exportado no produjera un diagnóstico plausible pero
falso.

**Lo que te pedimos: confirmarlos o corregirlos**, con la fuente de cada uno. La columna de la derecha está
vacía a propósito.

| Insumo | Rango de Atlas hoy | **El tuyo** | Qué pasa si alguien lo cruza |
| --- | --- | --- | --- |
| **FFMI** · índice de masa libre de grasa | 8 – 40 kg/m² | | **Frenaría a un paciente real.** Un FFMI por debajo de 8 es posible en caquexia o sarcopenia severa, que es justo la población que el modelo existe para medir. Hoy esa persona se quedaría sin diagnóstico |
| **Talla** | 120 – 230 cm | | **Frenaría a un paciente real.** Deja fuera a una persona con talla baja o acondroplasia. El piso sirve para atrapar la talla escrita en metros (1,75), pero paga ese precio |
| **C** · capacitancia de membrana | 0,3 – 8 nF | | **Ya frenó a una paciente real:** su medición dio 16,22 nF, por encima del techo de 8, y está sin diagnóstico. Es el caso de la Parte 1; si lo respondes allá, esta fila queda contestada |
| **Ri** · resistencia intracelular | 400 – 4000 Ω | | Dudoso: un paciente muy deshidratado podría acercarse al techo. No sabemos si 4000 es alcanzable |
| **Re** · resistencia extracelular | 200 – 1200 Ω | | Solo atraparía un export corrupto |
| **R∞** · resistencia infinita | 150 – 1000 Ω | | Solo atraparía un export corrupto |
| **Peso** | 25 – 350 kg | | Solo atraparía un export corrupto. **Y uno que no atrapa: las libras.** 75 kg y 165 lb caen los dos dentro, así que un equipo configurado en imperial pasaría sin que nada avise |
| **FM** · masa grasa | 1 – 200 kg | | Solo atraparía un export corrupto |
| **FFM** · masa libre de grasa | 20 – 200 kg | | Solo atraparía un export corrupto |

**Los tres primeros son los que importan.** Los otros son tan anchos que solo atrapan basura, y si los dejas
como están no pasa nada. Pero FFMI y talla pueden dejar a un paciente real sin diagnóstico, y todavía no ha
pasado solo porque no ha llegado ese paciente.

**Si prefieres no fijar un número para alguno, dilo también**: lo ponemos tan ancho que solo atrape lo
imposible (una unidad cambiada, un cero de más) y dejamos escrito que no hay corte clínico para ese insumo.
