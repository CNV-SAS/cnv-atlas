# Consulta legal: acceso del personal de CNV a historias clínicas

**Para:** el área jurídica.
**De:** el equipo de Atlas (Connected Nutrition Ventures).
**Asunto:** definir hasta dónde puede el personal de CNV ver el contenido clínico de pacientes que no atiende directamente.

Ninguna de las preguntas de abajo bloquea el desarrollo de hoy. Sí bloquean el momento de invitar a los primeros profesionales a operar en la plataforma: antes de eso necesitamos la decisión, porque cambia quién puede ver qué, y ese permiso es difícil de estrechar una vez concedido.

---

## a) El contexto en cinco líneas

Atlas guarda las historias clínicas de los pacientes. A cada paciente lo atiende un profesional de la salud independiente (nutricionista, médico, etc.), que usa la plataforma como su herramienta de trabajo. Cada profesional ve las historias de sus propios pacientes, no las de los demás. La pregunta de esta consulta es distinta: qué puede ver el **personal de CNV** (la empresa que opera la plataforma) de esas historias.

## b) Lo que pasa hoy

Hoy el rol administrativo de la plataforma puede leer el contenido clínico completo de cualquier paciente (mediciones, diagnósticos, tratamientos, notas), sin restricción y sin que quede registro de que lo hizo. Es una capacidad heredada del arranque del proyecto, no una decisión deliberada. Vamos a cerrarla; la pregunta es hasta dónde.

## c) Lo que ya existe (y funciona)

Para una parte del contenido, las **notas clínicas** que el profesional escribe en texto libre, ya construimos un mecanismo más estricto: el personal de CNV no las ve por defecto. Si necesita ver una, tiene que **pedir un permiso puntual, escribiendo el motivo**, que **otra persona aprueba**, con **vigencia limitada en el tiempo**, y **cada acceso queda registrado**. Queremos extender ese mismo mecanismo al resto del contenido clínico. Las tres preguntas siguientes definen los bordes de esa extensión.

## d) Las tres preguntas

**Pregunta 1 · Datos clínicos "sin nombre".**
Para los datos clínicos estructurados (una medición de peso, un diagnóstico, un plan de tratamiento), ¿tiene sentido ofrecer un nivel de acceso "sin identificar" (ver el dato pero no el nombre del paciente), o conviene que **todo** acceso del personal a ese contenido sea identificado y quede registrado?

> **Nuestra lectura:** siempre identificado y registrado. Quitar el nombre no protege a nadie cuando en la misma ficha quedan el peso, la talla, la edad y el sexo, y la red es de pocos pacientes por profesional: con esos datos se reconoce a la persona igual. Un nivel "sin identificar" daría una falsa sensación de anonimato. Preferimos no ofrecerlo.

**Pregunta 2 · El personal administrativo.**
¿El personal administrativo de CNV debe conservar alguna forma de ver contenido clínico como parte de su función, o pierde ese acceso y, cuando lo necesite, pide un permiso puntual como cualquiera?

> **Nuestra lectura:** pierde el acceso permanente. Un rol operativo que puede leer la historia clínica de cualquier paciente es justamente lo que este cambio busca cerrar. Si en un caso concreto necesita ver algo, lo pide con motivo y aprobación, igual que soporte.

**Pregunta 3 · Lo que ve soporte técnico.**
El personal de soporte técnico ve hoy el **número de documento** de un paciente (sin nombre y sin contenido clínico), para poder identificar de qué caso le está hablando un profesional cuando pide ayuda. ¿Es aceptable que conserve ese dato mínimo?

> **Nuestra lectura:** sí. Un documento, sin nombre ni contenido clínico, es lo mínimo para saber de qué paciente se habla. Estrecharlo más haría el soporte impracticable sin ganar protección real.

## e) Una pregunta que ustedes pueden responder y nosotros no

¿Qué exige la normativa colombiana de protección de datos de salud sobre el acceso del personal de una plataforma tecnológica a historias clínicas de pacientes que no son suyos? Puede haber requisitos, de registro, de finalidad, de autorización del titular, de tiempos de conservación, que no hemos considerado y que deberían fijar el piso de las tres decisiones anteriores. Si la ley pide más de lo que proponemos, manda la ley.

---

## Anexo técnico (para el equipo, no requiere lectura jurídica)

El diseño técnico que implementa lo anterior, con el inventario exacto de qué se cierra, qué superficies se afectan y en qué fases, está en `docs/PLAN_GRANTS.md`. Las tres preguntas de la sección (d) se corresponden una a una con las "tres decisiones" de ese documento. El plan no se ejecuta hasta tener la respuesta de esta consulta.
