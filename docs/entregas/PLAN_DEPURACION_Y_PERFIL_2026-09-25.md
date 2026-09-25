# Dos planes · depurar pacientes y el perfil del integrante

**Para Santiago, 2026-09-25.** Los dos dimensionados, con lo que verifiqué contra el código antes de
proponer. Lo que no necesita decisión lo estoy construyendo mientras revisas; está marcado al final.

---

# A · Depurar pacientes de prueba

## a) Qué se puede borrar de verdad

Lo verifiqué en el esquema, y la respuesta es **depende de hasta dónde llegó el paciente**. No es una
política nuestra: son seis llaves que dicen `ON DELETE restrict` y cuatro triggers que bloquean el `DELETE`.

**Lo que se va con el paciente (cascade), sin drama:** su PII (`patient_profiles`, `patient_contacts`), sus
consentimientos, su relación con el profesional, sus respuestas de encuesta y lo importado del HTML.

**Lo que BLOQUEA el borrado (restrict):** evaluaciones, contraindicaciones, seguimientos, remisiones y
reportes. Y encima de eso, los triggers de inmutabilidad, que bloquean `DELETE` y no solo `UPDATE`:

| Si el paciente tiene | Se puede borrar |
| --- | --- |
| Solo encuesta y consentimiento | **Sí** |
| Evaluación sin diagnóstico confirmado | Sí, borrando primero la evaluación |
| **Diagnóstico confirmado** | **No.** `Un diagnostico confirmado es inmutable (firma clinica)` |
| Reporte aprobado o tratamiento emitido | **No**, misma razón |
| Remisión enviada | **No**, `referrals` es inmutable completa |

Es exactamente el muro que nos paró con los lotes, y está bien que esté: **la firma clínica es el producto
del sistema.** Un paciente con diagnóstico confirmado no es un paciente de prueba que estorba, es un acto
clínico firmado por un profesional.

Hay una vía de escape (`SET LOCAL session_replication_role = replica`) que los propios triggers documentan
como **solo para demo/pre-producción sin registros clínicos reales**. No la propongo como mecanismo: usarla
desde la aplicación sería construir una puerta para saltarse la firma clínica, y eso no se construye.

## b) Marcar o borrar: mi lectura, y el costo que no se ve

**Coincido contigo: marcar es más seguro y resuelve lo mismo.** Pero hay un dato que cambia el tamaño del
trabajo, y lo verifiqué: **`patients.is_test` hoy se respeta en UN SOLO SITIO.** Gatea la facturación (que un
paciente de prueba no se facture desde producción y uno real no se facture contra sandbox). Nada más.

O sea que un paciente marcado de prueba **hoy sigue contando** en todo lo demás: en los conteos de la
pantalla de Dirección, en la pantalla nueva de admin por integrante, en lo que salga hacia `research_datasets`,
en las listas clínicas. Marcar no excluye: **marcar solo excluye donde alguien escribió que excluya.**

Así que el trabajo real de la opción "marcar" no es la casilla, es **barrer todos los sitios que agregan
datos de pacientes**. Es la misma lección que ya nos costó dos veces: una regla también vive en varios
sitios, y la mitad aplicada se lee como aplicada.

**Lo que arrastra cada opción, dicho completo:**

| | Marcar y excluir | Borrar de verdad |
| --- | --- | --- |
| Alcance | Todos los pacientes, incluidos los de diagnóstico firmado | Solo los que no firmaron nada clínico |
| Reversible | Sí, se desmarca | No |
| Trabajo | Barrer cada lectura que agrega | El mecanismo de solicitud + el borrado |
| Riesgo de error | Un sitio sin barrer sigue contándolo | Borrar el paciente equivocado, sin vuelta |
| Deja la data limpia | Sí, si el barrido es completo | Sí, pero solo para una parte de los casos |
| La firma clínica | Intacta | Se respeta porque la base no deja |

**Mi recomendación: los dos, en este orden, y el primero resuelve el problema que planteaste.**

1. **Ahora: que `is_test` sea de verdad.** El profesional o el admin marca un paciente como de prueba, y un
   único lugar decide qué significa eso, aplicado en todas las lecturas que agregan. Con esto la data queda
   limpia **para todos los casos**, incluidos los que nunca se van a poder borrar.
2. **Después, si hace falta: borrar los borrables**, con el mecanismo de solicitud. Pero ojo con la
   expectativa: solo aplica al paciente que no pasó de la encuesta. Un profesional que se creó a sí mismo
   como paciente y corrió un diagnóstico completo (que es justo el caso de prueba más común) **cae en el
   grupo que no se puede borrar.** Así que si construimos solo el borrado, el problema queda a medias.

## c) Qué pasa con sus ventas, su inventario y sus facturas

Las tres tienen respuesta distinta y ninguna se resuelve borrando al paciente:

- **La factura de Alegra.** Es un documento fiscal y no se deshace por borrar a nadie en Atlas: se corrige
  con nota crédito. Lo bueno: `is_test` ya impide que un paciente de prueba se facture desde producción, así
  que el caso solo existe **hacia atrás** (pacientes creados como reales y descubiertos después como
  prueba). Para esos, el camino es el que ya existe.
- **El inventario que movió una venta de prueba.** Los movimientos son append-only e inmutables por trigger.
  Borrar al paciente no los deshace: el saldo se corrige con un movimiento en sentido contrario, que es el
  camino que ya existe.
- **La venta misma.** `transactions.patient_id` es `ON DELETE set null`, así que borrar al paciente deja **una
  factura sin paciente**. Eso es peor que dejarla: una cifra de ingreso que ya no se puede explicar.
- **Y el contacto en Alegra.** El paciente guarda su `alegra_contact_id`. Borrarlo en Atlas deja el contacto
  huérfano en Alegra para siempre, que es justo la basura que ese campo existe para evitar.

## El mecanismo: ya existe uno con esa forma exacta

Antes de diseñar el flujo de "pedir con motivo y que admin apruebe", busqué si ya teníamos algo así. **Sí:**
`clinical_access_grants`, del bloque de auditoría. Su forma es literalmente la que describiste:

- quién solicita, y el **rol que debe aprobar calculado al solicitar** (soporte → admin; admin → dirección),
- **el aprobador nunca es el solicitante**, y eso es explícito y auditable,
- **motivo obligatorio** (`reason` es `NOT NULL`) más una categoría de motivo,
- estado `pending → approved / denied / revoked`, con vencimiento que **no es un estado** (se evalúa por
  fecha, para que no haya dos fuentes de "sigue vigente"),
- y los tres eventos (solicitado, decidido, usado) van a `clinical_audit_log` **inline**, no por el bus.

**Se reutiliza la FORMA, no la tabla.** Sus enums son de acceso a notas narrativas, y su solicitante es
admin o soporte, no el profesional. Copiar esa forma nos ahorra volver a resolver la separación
solicitante/aprobador, que es la parte delicada.

## Dimensionamiento

**Carril 1 · que `is_test` sea de verdad** (lo que recomiendo hacer primero)

1. Un módulo único que diga qué significa "de prueba", y el barrido de **todas** las lecturas que agregan
   datos de pacientes, con un candado que falle si aparece una nueva sin el filtro. Sin ese candado, el
   barrido se desarma solo en la siguiente pantalla.
2. Marcar y desmarcar: el profesional propone, admin confirma (misma asimetría que pediste para el borrado,
   y por el mismo motivo: no queremos que un profesional pueda sacar de las cifras un paciente real).
3. En la pantalla de admin por integrante y en la de Dirección, que se vea **cuántos de prueba tiene**. Un
   conteo escondido vuelve a ensuciar sin que nadie lo note.

**Carril 2 · el borrado con solicitud** (después, y solo si el carril 1 no basta)

4. La tabla de solicitudes con la forma de `clinical_access_grants`, apuntando al paciente, con motivo
   obligatorio.
5. El gate que decide si **se puede**: la solicitud se niega sola, con el motivo exacto, cuando el paciente
   tiene un diagnóstico confirmado, un reporte aprobado, una remisión, una venta facturada o inventario
   movido. Esto es lo primero que hay que construir, porque sin él admin aprueba borrados que la base va a
   rechazar después.
6. El borrado, en una transacción, con su evento en `clinical_audit_log`, y con lo que NO se borra dicho en
   pantalla (la factura sigue, el movimiento de inventario sigue).

**Lo que necesito de ti:** solo la decisión de orden. Si dices "carril 1", arranco por ahí y el borrado
queda dimensionado para cuando haga falta.

---

# B · El perfil del integrante

Con la captura como referencia de **estructura**, no de estilo. La regla que ya fijamos: una referencia
visual es punto de partida; donde resuelva bien se adopta, donde tengamos algo mejor se defiende.

## Qué se ve en la referencia, y qué vale la pena adoptar

**Lo que resuelve bien y adoptamos:**

- **Cabecera de identidad** con avatar, nombre, rol y estado. Hoy nuestra pantalla no dice de quién es.
- **Tres indicadores arriba**, antes del detalle. Contesta "¿estoy completo? ¿cuánto he ganado?" sin leer.
- **Pestañas que separan asuntos distintos.** Es lo que más nos sirve: hoy todo cuelga de un solo panel con
  dos fieldsets, y un integrante que solo quiere cambiar su banco tiene que atravesar lo tributario.
- **Rótulo arriba, valor en caja.** Un dato que no se edita se ve como dato, no como campo vacío.

**Lo que no adoptamos:** su paleta y su densidad. Nuestros colores y espaciado se quedan, y la capa clínica
(`--clinical-*`) no se toca, porque aquí no hay veredicto clínico que colorear.

## Qué existe hoy y qué no (verificado en el esquema)

| Dato | ¿Existe? | Dónde |
| --- | --- | --- |
| Nombre, correo, estado | **Sí** | `profiles.full_name`, `email`, `status` |
| Profesión / especialidad | **Sí**, lista cerrada de 4 | `professional_profiles.profession` |
| **Registro profesional** | **Sí, ya existe** | `professional_profiles.license` |
| Documento de identidad | **Sí, pero es el tributario** | `tax_id_type` + `tax_id_number` + `tax_id_dv` |
| Datos tributarios | Sí, completos | `professional_profiles` (10 columnas) |
| Cuenta bancaria | Sí, completa | `professional_profiles` (5 columnas) |
| Documentos firmados | **Sí, tabla propia** | `professional_document_signatures` |
| Certificaciones | Sí, tabla propia (sin pantalla) | `professional_certifications` |
| **Celular** | **NO existe** | habría que crearlo |
| **Ubicación del consultorio** | **NO existe** | habría que crearlo |
| **Historial de RUT** | **NO existe: solo el último** | `rut_path` es una sola ruta |

**Tres cosas que conviene que sepas de esa tabla:**

1. **El registro profesional ya está** y `/admin` ya lo muestra (incluido el "sin registro" en ámbar). No hay
   que crearlo, hay que traerlo al perfil.
2. **El documento de identidad no es un dato aparte.** El que tenemos es el tributario, que el integrante
   declara para su retención. Si lo ponemos también en la pestaña 1 como campo editable, quedan **dos
   fuentes del mismo número** y van a divergir. Propongo mostrarlo en la pestaña 1 **de solo lectura**,
   diciendo que se edita en la tributaria. Es el mismo criterio que arregló el "(opcional)" del lote: si dos
   partes de la pantalla dicen cosas distintas, es que leen fuentes distintas.
3. **"Documentos firmados" hoy solo puede ser 0 o 1.** El enum de tipos de documento tiene **un solo valor**
   (`anexo3`). El indicador es honesto pero va a decir "1 de 1" hasta que exista la gestión documental
   completa (que ya está en el backlog como bloque propio). Lo pongo, con el rótulo diciendo de qué documento
   se trata, no un número suelto.

## Las cuatro pestañas

**1 · Sus datos.** Nombre, correo, profesión y registro profesional **de solo lectura**, con el aviso de a
quién contactar. Documento de identidad, de solo lectura, tomado de lo tributario. Celular y ubicación del
consultorio, **editables** (columnas nuevas).

**2 · Tributaria.** Lo que ya existe, más el modelo de consignación con las dos cards de la §13. Ver la
decisión 1, abajo.

**3 · Bancaria.** Lo que ya existe, separado.

**4 · Adjuntos.** El RUT vigente y los anteriores. Ver la decisión 2.

**Y un hallazgo técnico de separar la 2 de la 3, que resuelvo yo pero que tiene consecuencia:** hoy lo
tributario y lo bancario son **un solo formulario con un solo envío**, y ese envío es el que marca
`tax_status_completed_at`, que es **el gate que deja liquidar la comisión**. Si los separo sin cuidado, un
integrante guarda lo tributario, queda "completo" sin cuenta bancaria, y la liquidación lo deja pasar hacia
un giro que no tiene a dónde ir. Lo separo en dos formularios pero **la marca de completo sigue exigiendo
las dos mitades**, y el candado lo fija.

## Los tres indicadores, y la palabra que buscabas

1. **Documentos firmados.** Del `professional_document_signatures` (hoy, el Anexo 3).
2. **Completitud del perfil.** Sobre los campos reales, con la lista de lo que falta al pasar el cursor. Que
   diga **qué** falta, no solo un porcentaje: un 60 % sin decir qué es no se puede accionar.
3. **Tu margen.** Y esta es la respuesta a tu pregunta, y la da el documento, no mi gusto: **la §13 del
   modelo comercial usa "margen"**, textual, *"ambas modalidades dejan al Integrante el mismo margen del
   20 %"*. Y hay una razón de fondo para preferirla: en Modalidad Comisión lo que recibe **es** una comisión,
   pero en Distribución es un **descuento comercial** (y el modelo insiste en que por eso no lleva retención).
   **"Margen" es la única palabra verdadera en las dos modalidades.** "Comisión" sería falsa en una de ellas,
   justo en la que cambia el tratamiento tributario.

   Sugerencia de rótulo: **"Tu margen"**, con la cifra acumulada y, debajo, "pendiente de liquidar".

## Las dos decisiones que necesito de ti

**Decisión 1 · Qué significa elegir la modalidad.** Verifiqué el código: la columna `modality` existe en la
línea de venta, pero **el escritor la sella siempre como `"comision"`**. Distribución no existe en el código:
la columna es un espacio reservado. Así que hay dos caminos y son de tamaño muy distinto:

- **(i) Las cards informan y admin registra la modalidad.** Se ve, queda escrito quién la asignó y cuándo, y
  el reparto sigue funcionando como hoy. Barato, honesto, y no miente **si el texto dice claramente que la
  operación de Distribución todavía no está en Atlas**.
- **(ii) La modalidad gobierna de verdad.** Eso es el flujo entero de Distribución: el integrante factura al
  paciente, CNV le factura quincenalmente, cupo de crédito que al agotarse suspende despachos, y sin
  retención sobre su margen. **Es un bloque propio, no una pestaña**, y toca facturación y liquidación.

**Mi recomendación: (i) ahora**, con el texto siendo explícito. Porque una card que dice "usted cobra y
factura al paciente" junto a un sistema que sigue cobrando por el link de CNV es una promesa que el software
no cumple, y eso se descubre con un paciente real en el consultorio.

**Decisión 2 · El historial de RUT.** Hoy solo se guarda el último: subir uno nuevo **pisa la ruta del
anterior** en la base (el archivo viejo puede quedar en el bucket, pero nada lo relaciona ni lo lista). Para
que la pestaña 4 tenga un historial hay que crearlo, y ahí hay una elección:

- **Solo el RUT**, con su fecha de documento, quién lo verificó y el motivo si se rechazó. Pequeño y resuelve
  lo que pediste.
- **Una tabla de adjuntos del integrante** que sirva para el RUT hoy y para el resto de la gestión documental
  después (que ya está en el backlog). Un poco más de trabajo ahora, y no hay que migrar de nuevo luego.

**Mi recomendación: la segunda**, por la misma razón por la que `professional_document_signatures` se hizo
genérica desde el principio aunque solo usara `anexo3`.

## Dimensionamiento

1. **Una migración** con lo que falta: celular, ubicación del consultorio, la modalidad con quién la asignó
   y cuándo, y la tabla de adjuntos. **Es cambio de esquema en tablas ya migradas, así que no la corro sin
   tu OK** (es forward-only, columnas nuevas y anulables, nada que reescriba lo existente).
2. **La cabecera y los tres indicadores.** Sin decisiones pendientes: lo construyo ya.
3. **La pestaña 1**, con lo de solo lectura y su aviso. Los campos nuevos quedan listos y se encienden con
   la migración.
4. **Partir el formulario en las pestañas 2 y 3**, conservando el gate de completitud. Con su candado.
5. **Las dos cards de la §13**, con el texto del modelo, y la asignación por admin.
6. **La pestaña 4**, según la decisión 2.

---

# Lo que estoy construyendo mientras revisas

Lo que no necesita ninguna decisión tuya, porque los datos ya existen y la estructura la definiste:

- La **cabecera de identidad** y las **cuatro pestañas** de `/perfil`.
- La **pestaña 1** con nombre, correo, profesión, registro profesional y documento, todo de solo lectura, con
  el aviso de a quién contactar para cambiarlos.
- Los **tres indicadores**, con **"Tu margen"** como rótulo.
- El **corte del formulario** en tributaria y bancaria, con la marca de completo exigiendo las dos mitades y
  el candado que lo fija.

Lo que **no** toco hasta que respondas: la migración (celular, consultorio, modalidad, adjuntos), las dos
cards, la pestaña 4, y todo el carril de depuración de pacientes.
