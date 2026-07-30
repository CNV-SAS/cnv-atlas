# Respuestas de la dirección científica · segunda ronda

**Fecha:** 30 de julio de 2026
**De:** Dirección Científica CNV · Gildardo de Jesús Uribe Gil
**Para:** equipo Atlas

Van resueltas las cinco preguntas nuevas y los dos puntos de proceso. Al final queda listado lo que sigue de mi lado.

---

## 1. Mi archivo actual

Confirmado: la copia que tienen es anterior a mi versión de trabajo. Envío la versión actual, la misma desde la que escribí el documento de decisiones, de modo que las referencias de línea de C1 a C13 caigan sobre el código que describen.

La corrección del campo de cintura (punto 4.3 de este documento) va incluida en ese envío.

Apliquen la prueba de identidad que propusieron antes de tocar nada: si las líneas 14077, 14088, 6529 y 12828 no caen sobre lo descrito, no apliquen los trece cambios y me lo devuelven.

## 2. Acuerdo de envíos

De acuerdo. A partir de ahora cada actualización del HTML va acompañada de una lista breve de lo que cambió, una línea por cambio. Nada formal, pero sin ese par archivo más lista, cualquier número de línea que yo cite no es verificable de su lado.

---

## 3. Preguntas nuevas

### 3.1 · Fuerza prensil en el criterio de sarcopenia

**La prensil se conecta.** No debe quedar fuera del criterio: es una de las dos ramas del diagnóstico y sin ella el criterio queda incompleto.

Puntos de corte: EWGSOP2, fuerza prensil baja por debajo de 27 kg en hombres y de 16 kg en mujeres. Coherente con el mismo consenso que ya se usa para el ASMI.

Regla para dato ausente: si no hay medición de prensil, la rama no se activa y el diagnóstico se sostiene con masa muscular esquelética apendicular y ángulo de fase, como opera hoy. Ningún paciente pierde diagnóstico porque el consultorio no disponga de dinamómetro. Lo que no debe ocurrir es que un valor de respaldo en cero se interprete como fuerza baja.

Recordar que se mantiene como riesgo de sarcopenia y presarcopenia, no como diagnóstico confirmado, porque el ASMI es estimado por BIS.

### 3.2 · Cáncer activo y cáncer en remisión

**Se parte la opción de la encuesta en dos:** cáncer activo y cáncer en remisión. Son dos situaciones clínicas distintas y no pueden compartir protocolo.

Conducta: la remisión no activa la estrategia hipercalórica. El paciente en remisión sigue la estrategia que le corresponda por su condición clínica y por su estado funcional, y conserva una marca visible de antecedente oncológico para el profesional y para el seguimiento longitudinal.

### 3.3 · Campo de cintura

**Se corrige en mi archivo.** El campo debe leer la circunferencia medida del paciente, no la columna del umbral de referencia de la OMS.

La divergencia que ya introdujeron de su lado es la correcta. Con la corrección en mi archivo, las dos copias vuelven a coincidir.

### 3.4 · Peso meta

**El peso meta es el del módulo de antropometría, ingresado manualmente por el profesional en la consulta.** No lo propone el sistema y no lo declara el paciente.

Obligatoriedad: sin peso meta registrado, Atlas entrega el diagnóstico completo pero no emite la prescripción calórica ni la de proteína, y avisa al profesional que registre el peso meta en antropometría. Sin respaldo silencioso al peso medido. Un respaldo invisible produce una prescripción calórica cuya base nadie sabe cuál fue.

### 3.5 · Fenotipo F1 a F12 en la pantalla de Diagnóstico

**Opción 1: se muestran los dos.**

Aclaración de origen, porque las dos clasificaciones se confunden con facilidad. El F1 a F12 pertenece al **mapa estructural (FMI × FFMI)**, es decir bandas antropométricas de grasa y de músculo. No es el mapa funcional ni el integrado.

| Mapa | Ejes | Qué entrega |
|---|---|---|
| Estructural | FMI × FFMI | Fenotipo F1 a F12 |
| Funcional | IFC × IRC | Estado funcional bioeléctrico |
| Integrado | EFR | Sector del mapa |

Los dos primeros responden preguntas distintas: el estructural dice cuánta grasa y cuánto músculo hay; el funcional dice en qué estado están la membrana celular y el equilibrio entre compartimentos. Dos pacientes con el mismo F7 pueden tener IFC de 6,2 y de 2,8, y la conducta terapéutica no es la misma.

Rotulación en pantalla, para que no se lean como lo mismo:

- Fenotipo estructural (FMI × FFMI): F7, normopeso sarcopénico
- Estado funcional bioeléctrico (IFC × IRC)
- Sector EFR

Los puntos de corte exactos de las doce bandas están en mi HTML, así que quedan cubiertos con el envío del punto 1.

---

## 4. Pendiente de mi lado

| | Qué | Estado |
|---|---|---|
| P0 | Presentación de la edad biológica en Atlas | Reviso la propuesta de las dos pantallas y decido. Es lo primero que cierro. |
| P1 | Fórmula de gasto basal sobre el peso meta | Decido entre las tres opciones. Mientras tanto implementen el resto del punto 8. |
| P2 | Tabla de nutracéuticos por ruta | Registrado, sin fecha. Sigue operando la vía por estado funcional. |
| P3 | Las tres secciones del manual de tratamiento | Registrado, sin fecha. |

---

## 5. Resumen de decisiones

| | Decisión |
|---|---|
| Archivo | Envío la versión actual, con la corrección de cintura incluida |
| Acuerdo | Cada envío futuro va con archivo y lista de cambios |
| 4.1 | La prensil se conecta al criterio. Cortes EWGSOP2 (27 kg / 16 kg). Sin medición, la rama no se activa |
| 4.2 | Se parte en dos. La remisión no activa la estrategia hipercalórica; conserva marca de antecedente |
| 4.3 | Se corrige en mi archivo |
| 4.4 | Peso meta manual del profesional en antropometría. Obligatorio para la prescripción calórica, sin respaldo silencioso |
| 4.5 | Opción 1: se muestran el fenotipo estructural F1 a F12 y el estado bioeléctrico, rotulados |
