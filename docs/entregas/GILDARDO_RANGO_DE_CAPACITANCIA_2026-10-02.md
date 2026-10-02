# Gildardo: una capacitancia de 16,22 nF, y quién fija su límite

**Para que Santiago se la lleve.** Es una pregunta de ciencia, no de software: el límite que hoy frena esa
medición **lo pusimos nosotros**, no sale de tu archivo, y por eso la decisión es tuya.

---

## El caso

Una paciente (documento terminado en 8834) tiene una medición con **capacitancia de membrana C = 16,22 nF**.
Atlas no deja generar su diagnóstico y ya lleva varios intentos.

**La medición no parece mal tomada:** Santiago la revisó y el valor sale igual.

---

## El límite que lo frena es NUESTRO, y conviene decirlo primero

Atlas tiene un rango de cordura para los insumos del motor, y para C es **0,3 a 8 nF**. No sale de tu archivo:
lo escribimos nosotros como cinturón de seguridad contra un export con la columna o la unidad equivocada, para
que un dato corrupto no produjera un diagnóstico plausible pero falso. Está en el código con ese mismo
comentario desde que se portó el motor.

**Tu archivo no fija ningún límite para C.** La usa directamente en las tres fórmulas, sin comprobar nada
antes.

Así que la pregunta no es "tu rango está mal". Es: **¿cuál es el rango que tú consideras fisiológico para la
capacitancia de membrana, y de dónde sale?**

---

## El único dato tuyo que tenemos sobre C

Tu HTML (v9, línea 7121) calcula un z-score de la capacitancia contra una referencia poblacional:

```
_zBis(bis.C, 1.8294, 0.7719)      // media 1,8294 nF · desviación 0,7719
```

Contra esa referencia:

| | Valor | A cuántas desviaciones |
| --- | --- | --- |
| La medición de esta paciente | 16,22 nF | **+18,6 DE** |
| Nuestro techo actual | 8 nF | +8,0 DE |
| Tu media poblacional | 1,83 nF | 0 |

**16,22 es 8,9 veces tu media.** Y nuestro techo de 8 ya es muy permisivo frente a tu propia referencia: deja
pasar hasta 8 desviaciones.

---

## Qué pasa si ese valor entra al motor

La capacitancia alimenta **tres de los índices primarios**, y en direcciones opuestas:

| Índice | Fórmula | Efecto de una C inflada |
| --- | --- | --- |
| **IFC** | `C / R∞ × 1000` | **Sube** en la misma proporción |
| **IRC** | `Re / (Ri · C) × 10` | **Baja** en la misma proporción |
| **PABU** | `(Re + Ri) · k / (R∞ · C)` | **Baja** en la misma proporción |

Y los tres entran a la clave del estado EFR. Para una mujer, con los cortes de tu archivo:

- **IFC**: alto es mejor (>3,28 = "Función óptima"). Una C nueve veces mayor multiplica el IFC por nueve: lo
  empuja a **función óptima**.
- **IRC**: bajo es mejor (<2,3 = "Bajo riesgo"). Una C nueve veces mayor divide el IRC entre nueve: lo empuja a
  **bajo riesgo**.
- **PABU**: igual, se desploma.

**El punto que importa para decidir: una capacitancia inflada no produce una alarma falsa, produce un "todo
bien" falso.** Los tres índices se mueven hacia el extremo sano a la vez. Si el valor es un artefacto y lo
dejamos pasar, la paciente sale clasificada mejor de lo que está, y nadie lo va a notar porque el informe no se
contradice consigo mismo.

Por eso lo frenamos. Pero por eso también, si **16,22 es un valor que tú consideras posible**, frenarlo tiene
su propio costo: esa paciente se queda sin diagnóstico.

---

## Lo que necesitamos de ti, en tres preguntas

1. **¿Cuál es el rango fisiológico de la capacitancia de membrana en tu modelo, y de dónde sale** (artículo,
   cohorte, el manual del equipo)?
2. **¿Ese límite es igual para hombres y mujeres**, o depende del sexo, la edad o algo más? Los otros cortes de
   tu archivo (IFC, IRC, PABU) sí dependen del sexo; este no sabemos.
3. **Y si 16,22 es posible**: ¿qué significa clínicamente una capacitancia así, y hay que decir algo en el
   informe cuando aparece?

**Mientras tanto no tocamos nada.** El rango se queda como está y esa consulta sigue sin diagnóstico: preferimos
una medición frenada a un diagnóstico que diga que está mejor de lo que está.

---

## Para Santiago: cuántas hay

Antes de llevar esto, corre:

```powershell
$env:DATABASE_URL="<cadena de la nube>"; pnpm tsx scripts/mediciones-fuera-de-rango.mjs
```

**Si sale una sola**, es un caso raro y la pregunta es la de arriba. **Si salen varias**, el rango está mal
fijado o el equipo mide distinto de lo que supusimos, y entonces esta pregunta pesa mucho más: hay que llevarle
la lista. El script además marca las que **ya tienen diagnóstico**: esas se sellaron antes de que la puerta
existiera, y su resultado se calculó con un valor que hoy el sistema no dejaría entrar.
