# Reasignar los pacientes del 13 de octubre: las listas, el filo del `status` y el costo

**Fecha:** 2026-10-24 · **Para:** Santiago · **Estado:** DIMENSIONADO, NO CONSTRUIDO.

> **Este documento no identifica a ningún paciente, a propósito.** Solo lleva conteos y el diseño. Las dos
> listas con hora, documento y nombre están en `docs/entregas/dudas/LISTAS_13_OCTUBRE_2026.md`, que queda
> fuera de git (`.gitignore:82`) y no se sube a ninguna parte.

---

## 1 · Las dos listas: la (a) tiene 25 y la (b) está vacía

El día completo del 2026-10-13 en hora Bogotá (de 05:00Z del 13 a 05:00Z del 14, porque Colombia no cambia
de hora) tiene **31 evaluaciones**, repartidas entre cuatro profesionales:

| profesional | evaluaciones | antes de las 12:00 | después |
|---|---|---|---|
| **Gildardo Uribe** | **25** | 22 | 3 (14:09, 14:55, 15:18) |
| María Teresa Aragón Herrera | 4 | 2 | 2 |
| Angela Marin Ramirez | 1 | 1 | 0 |
| Valentina Ramírez Huertas | 1 | 0 | 1 |

**La lista (b), los que entraron por el enlace de Maria Camila, está VACÍA.** Ningún paciente entró por su
enlace ese día. Lo verifiqué por el otro lado también: Maria Camila Aristizábal Foronda existe, está activa,
y tiene **11 evaluaciones propias**, ninguna del 13 de octubre (la más cercana es del 8 y la siguiente del
16). Es coherente con lo que pasó: ella no atendió ese día, Gildardo cubrió sus citas, y los pacientes
usaron el enlace de él.

**Y el corte de las 12 no se perdió a nadie.** Las 25 son exactamente las mismas que le pasé el 22: 22 antes
del mediodía más 3 por la tarde. El corte dejaba fuera a esos tres, pero yo los había listado aparte, así
que la lista que tiene en la mano ya está completa. Las 25 son todas `inicial`, todas con encuesta, y
**una sola está sellada**, con diagnóstico y reporte en borrador (cuál es, en el archivo de la carpeta
`dudas`).

**Lo que necesito de usted:** cotejar esas 25 contra su listado y decirme **cuáles** son de Maria Camila. No
asumo que sean las 25: las otras tres integrantes atendieron ese día, y puede que Gildardo también haya
atendido a algunos suyos.

---

## 2 · Lo que hay que mover, y son dos cosas, no una

| qué | tabla | qué gobierna | si no se mueve |
|---|---|---|---|
| **El acceso** | `patient_professional_relationships` | Las policies RLS de `patients`, `patient_profiles`, `patient_consents`, `evaluations` y las demás, vía `is_patient_of` | Maria Camila **no puede abrir la ficha** |
| **La atribución** | `evaluations.professional_id` | Quién figura como el profesional de esa evaluación: lo leen el guard de editar la encuesta, el flujo de corrección y la comisión | La evaluación **sigue siendo de Gildardo** aunque ella la vea |

Mover solo la primera da acceso sin atribución; mover solo la segunda da atribución sin acceso. Las dos
siempre, en la misma transacción.

---

## 3 · El filo del `status`, y la medición lo vuelve barato

**El filo:** `is_patient_of` (migración 0106) es la **única** definición de "este paciente es de este
profesional", y su cuerpo es exactamente esto:

```sql
select exists(
  select 1 from public.patient_professional_relationships ppr
  where ppr.patient_id = p_patient_id and ppr.professional_id = p_professional_id
)
```

**No mira `status`.** Así que poner la fila de Gildardo en `inactiva` **no le quita el acceso**: seguiría
viendo la historia clínica completa de un paciente que ya no atiende. Y su inclinación, enseñarle `status` a
la función en vez de borrar la fila, es la correcta: el hecho de que Gildardo atendió a esa paciente tiene
que seguir en la base, no solo en auditoría.

### La medición que cambia el costo

Medido hoy en producción:

| | |
|---|---|
| Relaciones en total | **551** |
| Con `status = 'active'` | **551** (el 100%) |
| Con cualquier otro estado | **0** |
| Pacientes con más de un profesional | **0** |

**Agregar la condición del `status` hoy es un cambio que no le cambia el resultado a nadie.** No hay una
sola fila que la condición excluya, así que no hay acceso que se pueda romper. La condición empieza a tener
efecto el día que se escriba el primer `status` distinto de `active`, que es justamente el día de la
reasignación. Esa ventana es la que la vuelve barata: **primero la condición, después el movimiento.** Al
revés (mover primero) habría un rato en que Gildardo conserva el acceso y nadie lo nota.

Y la restricción única es `(patient_id, professional_id)`, no `(patient_id)`, así que **un paciente puede
tener dos filas**: Gildardo con su estado histórico y Maria Camila activa. No hay que borrar nada.

### Los otros dos sitios que leen la misma tabla, y lo que pasa con cada uno

Esto es lo que hay que barrer antes de dar la condición por puesta, porque la regla también vive en otros
sitios:

1. **`patient_professional_anexo3_current` (migración 0018)** lee la relación **directo, sin `status`**, para
   contestar si el paciente tiene algún profesional con el Anexo 3 vigente. **Hoy está inerte:** verifiqué
   que **nadie ha firmado el Anexo 3**, así que la función devuelve `false` para todos. Pero el día que
   empiecen las firmas, la misma divergencia aparece ahí: un paciente seguiría pasando ese gate por la firma
   de un profesional que ya no lo atiende. **Hay que ponerle la condición en la misma pasada**, no después.

2. **El trigger `relaciones_recomputan_marca` (migración 0202)** recalcula la marca de paciente de prueba a
   partir de las relaciones, **y ese sí ya filtra `status = 'active'`**. O sea que el repositorio ya tiene
   las dos lecturas y ya divergieron: la que decide si un paciente es de prueba mira el estado, y la que
   decide **quién puede ver su historia clínica** no. Puesto así, la asimetría se lee sola.

3. **Las tres policies de `ppr` (migración 0003)** resuelven por `auth.uid()` contra
   `professional_profiles`, no por el estado de la relación. No cambian.

---

## 4 · El costo real de correr la suite de RLS, medido

Lo corrí hoy, solo los archivos del proyecto `db` que tocan la relación, `is_patient_of` o
`is_patient_professional`:

```
Test Files  11 passed (11)
     Tests  100 passed (100)
  Duration  59.15s
```

**Un minuto.** Los 11 archivos son: `rls`, `clinical-access`, `survey-intake`,
`marca-de-profesional-db`, `paciente-derivado-de-prueba-db`, `firma-presencial-db`,
`el-retiro-libera-el-puesto-db`, `nutraceuticals`, `encuesta-registrada-por-profesional-db`,
`completar-la-encuesta-que-nunca-hubo-db` y `el-menor-sin-representante-no-queda-detenido-db`.

Para el commit haría falta además la suite de BD completa, que son **5 minutos** (102 archivos, 642 tests).
Ese es el costo de verdad, y no es el obstáculo: **el obstáculo es decidir, no correr los tests.**

---

## 5 · El consentimiento NO hay que repetirlo, y esto lo sostiene el esquema

Lo verifiqué contra el esquema, no contra una impresión:

- **`patient_consents` no tiene columna de profesional.** El consentimiento es del paciente con CNV y con
  quien lo atienda, no con una persona nombrada.
- **El `document_hash` es sobre la PLANTILLA**, no sobre un documento con el nombre de nadie dentro.
- La cláusula §2.1 dice *"El profesional de salud que le atiende es el Responsable del tratamiento"*, en
  genérico. Cambia el profesional, la frase sigue siendo cierta.
- De los 25 del 13 de octubre, **19 firmaron por `remoto_otp`**, que no nombra a nadie; **6 por
  `presencial_qr`**, que sí lleva `declared_by` con el id de Gildardo.

**Esos 6 NO se tocan.** `declared_by` registra un hecho que ocurrió: Gildardo declaró, ese día, que el
paciente firmó delante de él. Reescribirlo sería falsificar la evidencia del acto. El consentimiento sigue
vigente y la reasignación no lo afecta; lo que cambia es quién atiende de aquí en adelante.

> **Lo único que queda para jurídica, y es una pregunta, no un problema:** la copia que se le envió por
> correo al paciente **sí** nombra al profesional. Si el paciente vuelve a leerla, va a ver un nombre que
> no es el de quien lo atiende. Mi lectura es que no invalida nada (el consentimiento es con CNV y la
> cláusula es genérica), pero lo decide el abogado, no yo.

---

## 6 · Las evaluaciones a medias siguen al paciente, y hay una que no

Las 25 tienen encuesta respondida y ninguna está reemplazada ni retirada, así que todas viajan con el
paciente sin nada que reparar. **Menos una, la que está sellada**, con diagnóstico y reporte en borrador.

Una evaluación sellada **no se reatribuye**: su diagnóstico se calculó, se firmó y lleva su constelación de
versiones. Lo que corresponde es que esa evaluación **se quede como está, atribuida a Gildardo**, que es lo
que de verdad pasó, y que Maria Camila siga desde el seguimiento. Mover la atribución de un diagnóstico ya
emitido sería decir que lo hizo alguien que no lo hizo.

---

## 7 · El orden, cuando usted diga cuáles

1. **La condición del `status`** en `is_patient_of` y en `patient_professional_anexo3_current`, en una
   migración nueva (forward-only). Hoy no excluye ninguna fila, así que no rompe acceso.
2. **La suite de BD completa.** 5 minutos.
3. **El movimiento**, en una transacción por paciente: la fila de Gildardo a su estado histórico, la de
   Maria Camila activa, `evaluations.professional_id` a ella en las evaluaciones **no selladas**, y un
   registro en `clinical_audit_log` inline (regla dura 8), que es lo que deja contestar después quién movió
   qué y cuándo.
4. **La sellada no se mueve.** Queda de Gildardo, con su diagnóstico.

**Lo que falta para arrancar es solo su lista.**

---
---

# Segunda parte (2026-10-24, tarde): **CONSTRUIDA**

Santiago cotejó la lista y decidió: **los 25 del 13 de octubre por el enlace de Gildardo, mañana y tarde,
incluida la que tiene diagnóstico, pasan todos a María Camila.** Con sus cuatro precisiones, que cambian una
cosa de lo que yo había recomendado arriba.

## Lo que se construyó, y es una pieza, no un script

| | |
|---|---|
| La condición del `status` | **migración 0223**, en `is_patient_of` **y** en `patient_professional_anexo3_current`, más un CHECK que cierra el vocabulario del estado |
| La pieza | `modules/patients/data/reasignacion-writer.ts`, transaccional, con motivo obligatorio y rastro inline |
| Quién puede | solo **admin** (`can-reassign-patient.ts`) |
| Desde dónde | `/admin/integrantes/[id]`, en la lista "Sus pacientes", una fila por paciente con el destino y el motivo |
| El candado | `src/tests/la-reasignacion-mueve-el-acceso-db.test.ts` (5 pruebas, suite de BD) |
| La suite de RLS | **entera**: 103 archivos, 647 pruebas, 344 s, exit 0 |

**Por qué una pieza y no un script, con su argumento:** la regla dura 14 dice *"Ninguna cuenta clínica se
recicla. Offboarding = desactivar y reasignar"*. La primera mitad existía desde siempre (desactivar un
integrante); **la segunda no existía en ninguna parte del sistema.** Así que al desactivar a alguien, sus
pacientes se quedaban con el acceso del que ya se fue, o sin nadie que pudiera abrirlos. Esto cierra la
regla, y el caso del 13 de octubre es su primer uso, no su motivo.

## Lo que mueve, y lo que deliberadamente no

| | se mueve | por qué |
|---|---|---|
| `patient_professional_relationships` | la activa pasa a **`reasignada`**, la nueva queda **`active`** | es el **acceso**: lo lee `is_patient_of`, que gobierna las policies de patients, patient_profiles, patient_consents y evaluations |
| `evaluations.professional_id` | **sí, todas las vigentes**, incluida la diagnosticada | es la **atribución**: quién atiende esa consulta |
| `diagnoses.confirmed_by` | **no** | quién firmó un diagnóstico es un hecho que ocurrió. Decisión de Santiago, y es la correcta: reescribirlo diría que lo firmó alguien que no lo firmó |
| `patient_consents.declared_by` (los 6 de QR presencial) | **no** | registra que ese profesional declaró, ese día, que el paciente firmó delante de él. Es evidencia de un acto |
| El consentimiento | **no se repite** | no tiene columna de profesional, el `document_hash` es sobre la plantilla, y la cláusula §2.1 habla del profesional "que le atiende" en genérico |

**Donde cambié de opinión, y conviene decirlo:** arriba recomendé que la evaluación sellada **no** se moviera.
Santiago decidió que sí, y separó las dos cosas que yo tenía juntas: `professional_id` dice **quién atiende**
y `confirmed_by` dice **quién firmó**. Son dos preguntas distintas y el esquema ya tiene una columna para
cada una. Su lectura es mejor que la mía: con la mía, María Camila vería una consulta de su paciente que
sigue figurando como de otro profesional, y el guard de corregirla se lo impediría.

**Y la fila vieja no se borra, que era su condición.** Pasa a `reasignada` y se queda, con su `assigned_at`
original. El candado de BD exige las dos cosas a la vez: que el acceso se haya ido **y** que la fila siga ahí.

## Un detalle del `status` que no estaba dimensionado y ahora está cerrado

El `status` era `text not null default 'active'` **sin ninguna restricción**, y de él depende el acceso a una
historia clínica. Un `'Active'` con mayúscula, o un `'activa'` en español, dejaría al paciente **invisible
para su propio profesional sin un solo error**. La 0223 cierra el vocabulario a `active` y `reasignada`, con
su prueba. Es un cinturón de lo imposible (un valor que ningún camino del código escribe), no de lo
improbable.

## Lo que falta para que los 25 se muevan de verdad, y no es una decisión más

**Las migraciones 0222, 0223 y 0224 están aplicadas en local, NO en producción.** Y el orden importa, por lo
que ya está escrito arriba: **primero la condición, después el movimiento.** Si los 25 se movieran hoy,
Gildardo conservaría el acceso a sus 25 historias clínicas hasta que la 0223 llegue a la nube, porque
`is_patient_of` todavía no mira el estado allí. Ese rato es exactamente la ventana que la condición existe
para cerrar.

**Así que el orden real es:**

1. **Push y `pnpm db:migrate` contra producción** (0222, 0223, 0224). Son forward-only y ninguna excluye una
   fila existente: las 551 relaciones están en `active`.
2. **Comprobar que nadie perdió acceso**, que es barato: las 551 siguen activas, así que la cifra de
   pacientes de cada integrante tiene que salir igual que antes.
3. **Los 25, desde `/admin/integrantes/[id]` de Gildardo**, eligiendo María Camila y escribiendo el motivo.

**Sobre el paso 3 hay una pregunta suya que contesto por adelantado:** son 25 filas, con su motivo cada una.
La pantalla es por paciente **a propósito** (el motivo pertenece a cada movimiento, no al lote), pero si
prefiere no teclearlo 25 veces, puedo correr los 25 en una pasada con el mismo motivo usando la misma pieza,
no un script aparte. Dígame cuál prefiere; las dos dejan el mismo rastro.

## Y lo que queda anotado para el abogado, sin construir

La copia del consentimiento que se le envió por correo al paciente **sí nombra al profesional**. Si el
paciente vuelve a leerla, verá un nombre que no es el de quien lo atiende. Mi lectura sigue siendo que no
invalida nada (el consentimiento es con CNV y la cláusula es genérica), pero lo decide el abogado. **Anotado,
no construido**, como usted pidió.
