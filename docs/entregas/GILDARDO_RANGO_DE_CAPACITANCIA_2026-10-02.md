# Gildardo: una capacitancia de 16,22 nF

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

## Las tres preguntas

1. **¿Cuál es el rango fisiológico de la capacitancia de membrana en tu modelo, y de dónde sale** (artículo,
   cohorte, el manual del equipo)?
2. **¿Ese límite es igual para hombres y mujeres**, o depende del sexo, la edad o algo más? Tus cortes de IFC,
   IRC y PABU sí dependen del sexo; de este no sabemos.
3. **Y si 16,22 es un valor posible**: ¿qué significa clínicamente, y hay que decir algo en el informe cuando
   aparece?

**Mientras tanto no se toca nada.** La medición sigue frenada y esa consulta sin diagnóstico: preferimos eso a
emitir un resultado que diga que la paciente está mejor de lo que está.

---

## De dónde sale el límite que la frenó

Por si lo preguntas, y para que la respuesta sea útil: **el rango que hoy la frena (0,3 a 8 nF) lo pusimos
nosotros al portar el motor**, como cinturón contra un export con la columna o la unidad equivocada. No sale de
tu archivo, que no fija ningún límite para C: la usa directamente en las tres fórmulas.

Lo decimos porque cambia lo que te estamos pidiendo. **No es "revisa tu rango": es "danos el tuyo",** y
sustituimos el nuestro por el que digas, con su fuente escrita al lado.
