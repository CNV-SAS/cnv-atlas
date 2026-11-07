# El recálculo del motor 3.0.0 · la simulación, y la decisión que falta

**Connected Nutrition Ventures · Atlas · 6 de noviembre de 2026**
**Para:** Santiago · **Estado:** **la simulación está construida y corrida en local. NADA se ha ejecutado.**

---

## En una línea

El motor subió a **3.0.0** con dos cambios que mueven el diagnóstico. Lo ya emitido **no se reescribe**
(regla 7): se reemite, y reemitir toda la cohorte es un acto que tú apruebas. Esta simulación dice a
cuántos pacientes toca y qué se les mueve, **sin escribir nada**.

---

## Qué hay construido, y qué no

| | |
|---|---|
| **La simulación** (`src/tests/simulacion-del-recalculo-db.test.ts`) | **Hecha.** Solo lectura: recomputa con `simularConCienciaDeHoy`, que no persiste, y compara contra el snapshot sellado |
| **La corrida en local** | **Hecha.** Las cifras están abajo |
| **La corrida contra la nube** | **Falta, y es tuya.** No tengo la `DATABASE_URL` de producción (en `.env.production.local` solo hay la URL de Supabase y la service role), y las lecturas de producción están bloqueadas en esta sesión. El comando está abajo |
| **El ejecutor del recálculo** | **NO construido**, a propósito. No existe ningún camino que reemita en masa |
| **La pantalla `/admin/recalibracion`** | **NO construida** |
| **El aviso al profesional cuando le cambian las rutas sugeridas** | **NO construido** |

**Manda la nube.** Los datos locales están sembrados y pueden caer justo sobre los valores viejos: ya pasó
al encender el LE8 (35 de 42 en local no se parecían a la nube). Una medición local **no decide** sobre
datos de la nube.

---

## El comando, para que corras la simulación contra la nube

Es **solo lectura**: no emite, no sella, no reemite.

```powershell
$env:DATABASE_URL = "<la cadena de conexión de producción>"
npx vitest run --project db --reporter=verbose src/tests/simulacion-del-recalculo-db.test.ts
```

Busca en la salida la línea que empieza con **`SIMULACION_300`**: es un JSON con todo. Pásamelo y sigo.

> **Ojo con un detalle del archivo:** hace `process.loadEnvFile(".env.local")`, igual que la medición del
> bump. Si tu `.env.local` trae `DATABASE_URL`, puede pisar la variable que pusiste en la sesión. Si la
> salida dice `consultasConInforme: 360` y los ids empiezan por `a0000000-…`, estás mirando local.

---

## Lo que dio en local (360 consultas con informe, 344 recomputables)

**La tabla que decide es la del mayor 2.** Comparar contra un snapshot del mayor 1 mezcla *todos* los
bumps desde entonces (el encendido del LE8 de septiembre, la EB-BIS v7 de octubre y los dos cambios de
hoy); solo en el grupo del mayor 2 el delta es **únicamente** de la 3.0.0.

| | mayor 1 (280) | **mayor 2 (62)** |
|---|---|---|
| Dominio 3 (envejecimiento) cambia de severidad | 274 | **62 de 62** |
| Dominio 5 (epigenético-contextual) cambia | 5 | **0** |
| ICEC total cambia | 279 | **62 de 62** |
| Nivel de riesgo integrado cambia | 6 | **0** |
| Rutas activas cambian | 6 | **0** |

**Cuánto se mueve el ICEC, que es lo que el conteo no dice:** en el grupo del mayor 2, **−1 punto exacto en
las 62**. En el mayor 1, promedio −0,94, entre −1 y +9, y **271 de 274 bajan**. La dirección es la
esperada: el puntaje de alimentación del v16 penaliza más de lo que premia.

**El envejecimiento, que es el punto de CA-3:** 5 consultas **dejan de estar aceleradas** y **ninguna pasa
a estarlo**. Esas cinco son la aceleración fabricada por la v5.

**Las rutas:** solo 6 consultas cambian, y el detalle dice lo que esperábamos. **Sale la R4 en 5** (la ruta
de desaceleración del envejecimiento que la v5 activaba sin motivo) y la R5 en 3; **entra la R6 en 3**.

**Las que el recálculo no va a poder tocar: 16.** Quedan "pendiente", nunca mostrando el v5, que es lo que
su §1.4 decide.

**El borde de ±5: en local, cero.** Ninguna consulta cae a menos de 0,05 de ±5,0, así que la pregunta 36
(donde su propio archivo se contradice) no toca a nadie aquí. **Esta cifra hay que mirarla en la nube**: ahí
sí había casos.

**El freno de la contradicción: en local, cero consultas frenadas**, porque la contradicción necesita
snapshots del mayor 2 con las dos lecturas discrepando y los datos sembrados no la tienen. **Lo medido en
la nube el 6 de noviembre: 70 consultas frenadas, 45 del tipo peor, 0 enviadas.**

---

## Un defecto que la simulación destapó, y ya está arreglado

**El freno no se soltaba nunca.** Su consulta decía:

```sql
where ... and snapshot->'versions'->>'engine' like '2.%'
order by created_at desc limit 1
```

En SQL el filtro va **antes** del orden y del límite, así que eso no traía "el último informe de esta
consulta": traía **el último informe 2.x**. Y un snapshot sellado no se reescribe nunca (regla 7), así que
el recálculo no corrige el informe viejo: **emite otro**, con el motor 3.0.0. El informe 2.x seguía ahí, y
la consulta **habría quedado frenada para siempre** con el documento nuevo ya emitido y sin contradecirse.

**Desde la pantalla nadie lo habría visto:** la profesional reemite, el documento nuevo está bien, y el
aviso sigue saliendo sin explicación posible. Son las 70 de hoy.

Arreglado: se trae el último informe sin condición de versión y la versión se mira después. Candado en
`la-contradiccion-del-envejecimiento.test.ts`, con el porqué escrito.

---

## Lo que hay que aprobar, en orden

1. **Correr la simulación contra la nube** (el comando de arriba). Es solo lectura.
2. **Mirar tres cifras antes de autorizar nada:**
   - `freno.frenadasNuevas` **tiene que ser 0.** Si aparece una sola consulta que hoy se puede entregar y
     después del recálculo se contradiría, **el recálculo no se ejecuta** hasta entender por qué: con las
     dos lecturas saliendo de la v7 no puede haber contradicción nueva.
   - `freno.seDestraban` contra `freno.frenadasHoy`: es el número que de verdad importa, porque son
     profesionales que hoy no pueden enviar un informe.
   - `bordeDeLos5.diferencia`: a cuántos pacientes les cambia la etiqueta según el corte, que es lo que
     hace urgente o irrelevante la pregunta 36 de Gildardo.
3. **Decidir si se ejecuta**, y con eso construyo el ejecutor, la pantalla de `/admin/recalibracion` y el
   aviso al profesional cuando le cambien las rutas sugeridas.

**Mientras tanto no hay nada que deshacer:** el motor está cambiado en el árbol de trabajo, con sus
goldens y su versión, y **nada se ha empujado ni ejecutado**.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
