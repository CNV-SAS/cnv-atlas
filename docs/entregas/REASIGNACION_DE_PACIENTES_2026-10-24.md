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
