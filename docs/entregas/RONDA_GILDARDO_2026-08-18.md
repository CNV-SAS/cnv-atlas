# Ronda para Gildardo (borrador para revisión de Santiago) - 2026-08-18

**De:** Equipo Atlas · **Para:** Dirección Científica (Gildardo Uribe)

Tu respuesta del 17 cerró los seis puntos y trajo correcciones. Ya aplicamos todo lo aplicable (lo
listamos abajo para que conste). Esta ronda es corta: quedan **dos bordes que no están en tu tabla**, **un
dato que nos pediste y no podemos calcular sin los registros**, y **el archivo del 15**, sin el cual no
re-sincronizamos el motor. Ordenada por cuánto bloquea.

---

## Lo que necesitamos de vuelta (resumen, para que no se pierda entre lo demás)

1. **El `ATLAS_v8.html` del 15-ago** (la entrega vigente). Sin él no re-portamos el motor.
2. **Un export de los 5.073 registros con AEC, ACT y sexo** (para fijar el agua EC 42% con dato propio).
3. Confirmar **dos bordes** (FM_pct e IAE) que no venían en tu tabla del §2.

---

## Ya aplicado de tu respuesta del 17 (no requiere nada, solo lo listamos)

- **Δ contra el borde (§2):** portamos tu tabla de límites por fila tal cual. El Δ mide contra el límite
  que decide la clasificación (IMC 24,9; FFMI 17/15; FMI 6/9; ASMI 7,0/5,5; AEC% 40; AIC% 65; E/I 0,40;
  AF 6,5/6,0; IR 0,78/0,82; AEC/MCA 0,45; ACT/MLG 74). En la tabla de Antropometría, donde hay valor de
  referencia, el Δ sigue siendo valor − referencia: no mezclamos los criterios.
- **FMI mujeres:** ya estaba correcto en nuestro motor (`cFMI` mujeres normal 5-9); habíamos portado el
  clasificador, no el display stale 9-13. Sin cambio.
- **"Manda el motor" como principio general (§3):** registrado como procedimiento. Ante una divergencia
  display-vs-motor: manda el clasificador del motor, se corrige la tabla (etiqueta y rango) y se reporta en
  el resumen, no como pregunta. SMM/W ya emite "Óptimo".
- **Las tres constantes (§5):** quitamos la marca "en validación" a proteína total 19,4%, CMO 5,6% y
  mineral no óseo 1,2% (las citamos como reparto de Wang, cierran en 99,4%). Siguen marcadas agua EC 42% y
  proteína activa 70%; la masa proteica metabólica y los sólidos extracelulares heredan la marca del 70%.
- **Fuerza prensil (§6):** el campo ya existía en las condiciones de la toma BIS. Lo conectamos al
  diagnóstico de sarcopenia (cortes EWGSOP2 27/16 Kgf) y agregamos tu protocolo como texto de ayuda junto
  al campo (mano dominante, sentado, codo a 90°, después de cintura y cadera y antes del BIS, mejor de tres,
  no promedio, Kgf con un decimal).
- **Las dos tablas reorganizadas:** Evaluación muestra lo medido y crudo (con el bioeléctrico repartido en
  su nivel); Diagnóstico muestra lo clasificado. La grasa total % queda en Nivel IV (no se duplica).

---

## 1. Borde del FM_pct (grasa corporal en %)

Tu tabla del §2 no incluye la grasa en porcentaje. Hoy su Δ lo medimos contra el **punto medio** del rango
normal (H 10-22, M 18-32), a la espera de tu criterio. No lo elegimos nosotros: es un corte clínico.

**Pregunta:** ¿cuál es el límite que decide la clasificación de la grasa en %? (Suponemos el borde
superior, H 22 / M 32, por ser el lado del riesgo, pero es tu decisión.)

## 2. Borde del IAE (índice de aceleración de edad)

Mismo caso. Su rango es −5 a +5, y hoy el Δ va contra el punto medio (0). El límite que decide "acelerado"
parece ser **+5**, pero preferimos confirmarlo antes que asumirlo.

**Pregunta:** ¿el Δ del IAE va contra **+5** (el borde superior, "acelerado"), o contra otro límite?

## 3. La distribución del agua extracelular: necesitamos los registros

Nos pediste calcular la distribución real del agua extracelular sobre los 5.073 registros (mediana e
intervalo intercuartílico, estratificada por sexo) para fijar la constante del 42% con dato propio.
**Verificamos: esos registros no están en el repositorio de Atlas.** Solo tenemos las filas donantes
anonimizadas de los golden tests, no la cohorte.

**Petición concreta:** un export de los 5.073 registros con tres columnas, **AEC, ACT y sexo** (anonimizado,
sin identificadores). Con eso el cálculo es de una tarde y te devolvemos la mediana y el IQR por sexo.
Es lo único que nos pediste, y es lo único que no podemos hacer sin los datos.

## 4. El archivo del 15-ago (entrega vigente para el motor)

Confirmaste que el `ATLAS_v8.html` del **2026-08-15** es la entrega vigente (retira las derivaciones que se
adelantaban a `derivarFaltantes`), no la del 13. **No lo tenemos.** Sin él no re-sincronizamos el motor, que
son los diez puntos de tu delta (PABU al Dominio 1, vocabulario de severidad, radar de 4 zonas, R1-R9 → E1-E9
como traducción, salvaguarda TCA, objetivo calórico en 0, hábitos moderados, bandera ICEC apagada, cPABU y
cMMEM con M 5,5).

**Petición:** envíanos el `ATLAS_v8.html` del 15-ago. Con él re-sincronizamos una sola vez, con golden tests.

---

## Menor (para tus registros, no bloquea)

- **SMM/W en mujeres: una incoherencia dentro de tu carta.** Tu tabla del §2 da el borde inferior en **24**
  para mujeres, pero el clasificador `cSMM` del motor usa **22** (sarcopenia < 22 · 22-28 normal · > 28
  óptimo). Como el principio es "manda el motor", dejamos **22** para el Δ y la clasificación, y te lo
  reportamos con el número (como pediste para los casos donde el motor y el display divergen). ¿Confirmas 22,
  o el motor debía ser 24?
