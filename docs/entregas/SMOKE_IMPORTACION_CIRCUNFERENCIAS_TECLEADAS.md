# Smoke · El recuadro de cintura y cadera de un paciente importado

**Para Santiago. Con el archivo sintético, no con los reales.** Los archivos de verdad traen historias
clínicas de pacientes reales; para probar que el recuadro funciona no hace falta ninguna.

**El archivo:** `docs/distribucion/exportador-html/ejemplo-sintetico.json`. Si no está o quedó viejo, se
regenera con `pnpm tsx scripts/exportador-html/ejemplo-sintetico.mjs`.

**Lo que se prueba, en una frase:** que la cintura y la cadera se puedan teclear **solo** en una consulta
importada a la que le falten, que al guardarlas Atlas recalcule ICC e ICT, y que ese recuadro **no exista**
en una evaluación normal de Atlas, donde esos datos vienen del equipo.

**Por qué es una excepción y no una función nueva:** esos tamizajes se hicieron hace meses y no hay forma de
repetirlos. Por eso se permite teclearlos, y por eso queda marcado que fueron tecleados y no medidos.

---

## Antes de empezar

- Migraciones al día (0163 en adelante).
- Entra como **admin** (la importación es solo de admin).

## 1 · Importar el archivo sintético

1. Ve a **/admin/importar-html**.
2. Sube `ejemplo-sintetico.json`.
3. En la revisión, **elige el profesional** al que quedan asignados los pacientes (Atlas no lo deduce del
   archivo, a propósito).
4. Pulsa **Importar**.

**Qué tiene que verse:** el resumen de lo importado, con los pacientes creados y sus consultas.

## 2 · El recuadro aparece donde debe

El paciente del caso es **Sintético Uno**, que queda con **dos consultas**: una del **4 de septiembre** y otra
del **13 de agosto**. La cintura no viene en ninguna de las dos, pero el HTML guarda un respaldo por PACIENTE
(lo tecleado a mano), y ese respaldo es el ÚLTIMO valor, así que Atlas se lo aplica solo a la consulta **más
reciente**: ponérselo a la vieja sería darle una cintura de otro día.

1. Entra a la consulta del **13 de agosto** de Sintético Uno.
2. Ve a generar el diagnóstico.

**Qué tiene que verse:** Atlas **no deja generar** y dice que falta la cintura. Y aparece el recuadro para
escribirla, con la explicación de que es una consulta importada.

**Y el control, que es lo que de verdad prueba la regla:** el recuadro pide **solo la cintura**, no la cadera.
La cadera ya vino en el archivo (106) y por eso no se pregunta. Si te pide las dos, avísame.

## 3 · Teclear la cintura

1. Escribe la cintura (por ejemplo **84**) y guarda.

**Qué tiene que verse:**

- El recuadro se cierra o deja de pedir el dato.
- **Atlas ya deja generar el diagnóstico.**
- En el diagnóstico, **ICC e ICT tienen valor**. ICC es cintura dividido cadera; ICT es cintura dividido
  talla. Con 84 de cintura y 106 de cadera, el ICC da **0,792**; con la talla de 177, el ICT da **0,475**.
- El dato queda marcado como **tecleado**, no como medido. Es la diferencia que importa: nadie debe creer
  dentro de seis meses que esa cintura salió del equipo.

**Y el segundo control:** la **cadera** que ya venía del archivo **sigue marcada como venía**, no como
tecleada. Solo se marca lo que escribiste ahora.

## 4 · Y que NO exista donde no debe

1. Abre una evaluación **normal** de Atlas (no importada), de un paciente cualquiera de prueba.

**Qué tiene que verse:** **el recuadro no existe.** Ahí la cintura y la cadera vienen del equipo, y poder
teclearlas sería poder inventar una medición.

---

## Qué reportar

De cada paso: lo que viste, y sobre todo lo que **no** viste. Si algo se ve distinto de lo escrito arriba,
mándame la pantalla tal cual, sin arreglarlo: el texto de esta guía es la afirmación que se está probando, y
si la realidad no coincide, puede estar mal la guía y no el código.

## Al terminar: la limpieza, en el orden que sí funciona

**Este smoke genera un diagnóstico, y un lote con diagnóstico NO se deja deshacer.** La guía decía
"deshaz el lote" sin más, así que cada corrida dejaba un lote atascado; se corrigió el 2026-09-24.

El orden correcto:

1. **Primero se borra el diagnóstico** que acabas de generar. Va por SQL, a propósito: un diagnóstico es un
   registro sellado y Atlas no tiene (ni debe tener) un botón para borrarlo.
   ```sql
   delete from diagnoses d
    using evaluations e, html_import_batches b
    where d.evaluation_id = e.id and e.import_batch_id = b.id and b.reverted_at is null;
   ```
2. **Después, Deshacer** desde la pantalla de importación. El deshacer es todo o nada: revierte el lote
   completo, que es como se decidió.

El procedimiento completo, con las consultas para ver antes qué se va a borrar, está en
`DESATASCAR_LOTE_CON_DIAGNOSTICO.md`.
