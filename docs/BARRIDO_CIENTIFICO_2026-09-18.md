# Barrido del lado científico, verificado CONTRA EL CÓDIGO (2026-09-18)

**Por qué existe.** Al listar lo que quedaba abierto del modelo, la lista salió de documentos que envejecieron: `ESTADO.md` se declara atrasado desde el 22 de agosto, y varios planes de agosto fueron superados por construcción posterior. Santiago pidió lo correcto: **verificar contra el código, no contra los documentos**, y corregirlos con lo que saliera.

**Este documento manda sobre lo que digan `BACKLOG.md`, `PENDIENTES_CIENTIFICOS.md`, `ESTADO.md` y los `PLAN_*.md` de agosto** en los puntos que toca. Lo demás de esos documentos sigue vigente.

**Dato que cambia el cuadro:** Gildardo ya revisó el modelo con pacientes reales y lo vio bien. Lo que queda no son fallas del modelo, son mejoras.

---

## Lo que YA ESTÁ HECHO, y los documentos daban por pendiente

| Lo que decía el documento | La realidad en el código |
|---|---|
| "Otra" con texto vacío pasa el gate de encuesta completa | **HECHO.** `isBareFreeTextOther` (`survey-completeness.ts:16`) caza el token pelado en sus cuatro flexiones, en opción única y dentro de respuesta múltiple. El intake lo permite y lo cuenta como hueco; el gate clínico bloquea antes de correr el motor, y lo mismo al regenerar |
| Faltan las opciones "Otra" en nueve preguntas | **HECHO, 9 de 9** (12 en total) en la encuesta v6, que es la activa (`0099_encuesta_v6.sql`) |
| Guardar el borrador de la encuesta | **HECHO, en servidor.** Autoguardado cada 1,2 s y al cambiar de sección, con token de reanudación que devuelve al paciente a su sección |
| Enviar la historia clínica al paciente | **HECHO.** Compone, renderiza, envía y **solo si el correo sale** registra la entrega en `hc_deliveries`, con auditoría inline. Candado: `hc-pdf-entrega.test.ts` |
| P-109: la constancia de las cifras fuera de referencia no llega a la HC | **HECHO en los dos.** La comparación se hace una sola vez en el composer y los dos documentos la pintan. Candado: `documentos-coherentes.test.ts` |
| El reporte del paciente entrega sigla y número crudo | **RESUELTO POR RETIRADA (2026-09-01).** Los índices salieron del PDF del paciente; queda lenguaje llano por dominio. Un candado prohíbe que las siglas vuelvan. La versión con sigla, rango y severidad vive en la HC del profesional |
| El prompt de IA es el corto de ~120 palabras | **HECHO (v4).** La v3 portó el sysprompt de Gildardo con los cinco dominios del DFI, cortes por sexo y reglas de PABU y ángulo de fase; la v4 añadió las alertas |
| Los cuatro bloques de Seguimiento sin construir | **HECHOS los cuatro** y montados, con candados |
| El cierre de la consulta: nadie pone "completed" | **HECHO.** Acto explícito con quién y cuándo, reversible, con lista de pendientes que informa sin bloquear |
| Diagnóstico antropométrico sin mostrar | **HECHO** (IMC, cintura, ICC, ICT clasificados con su rango). Falta solo el índice de conicidad, que **no existe en el repo** |
| Inmutabilidad del plan tras aprobar, solo de UI | **YA NO APLICA.** El 2026-09-09 se decidió que la prescripción queda siempre abierta; lo inmutable es **la emisión**, y eso sí lo impone la base con triggers |

## Lo que está a MEDIAS

| Qué | Qué falta exactamente |
|---|---|
| **Diseño del intake del paciente** | Hechos: progreso por preguntas respondidas, tamaño táctil de 44 px, chips de sección, iconos, intro por sección, referencia de porción. **Faltan:** la matriz de Alimentación (18 filas, hoy una a una), una columna en pantalla estrecha, la estimación de tiempo, una portada de bienvenida y la explicación del guion de los contadores |
| **Pase de diseño de los documentos** | La HC **en pantalla** ya tiene jerarquía y el plan imprimible tiene CSS de impresión serio. Lo que sigue abierto es **la pasada tipográfica de los dos PDF**, y el propio archivo lo dice en su cabecera |
| **Grants sobre el contenido clínico** | El mecanismo está construido y probado, y **cerró el acceso del admin a las notas**. Sigue abierto para evaluaciones, diagnósticos, tratamientos y reportes: ahí el admin lee sin grant ni registro |

## Lo que FALTA de verdad

| Qué | Por qué importa |
|---|---|
| **El nutricionista no ve exámenes ni suplementación** | El panel solo se los pasa a la rama médico. Es brecha de contenido: el modelo los produce y quien prescribe la dieta no los ve |
| **El archivo Biody no se coteja contra el paciente** | El nombre y la fecha de nacimiento del export se descartan como PII antes de validar, así que no hay con qué comparar identidad. La única defensa es humana, y el propio código admite que importar el archivo del paciente equivocado no se corrige |
| **Corregir medición, condiciones BIS, peso o talla después del diagnóstico** | El motor de corrección por versión nueva existe y funciona, pero su entrada cubre **solo la encuesta**. Lo demás queda sellado sin vía |
| **Exportar las respuestas de la encuesta** | No existe como función. El lector y los moldes de descarga ya existen; falta el serializador (no hay ni una línea de CSV en el repo), la procedencia, la ruta y la auditoría. **DESBLOQUEADO (Santiago, 2026-09-18):** es para que cada profesional conserve las respuestas **de sus propios pacientes**, no para Himed ni para un tercero, así que la pregunta legal que lo frenaba no aplica |

## Un punto que cambió de nombre

**"Recomendación con IA" en el Criterio del profesional** sigue sin construirse, pero **el Criterio del profesional ya no existe**: el 2026-09-08 se sustituyó por el **"Resumen del diagnóstico"**, generado por IA y no editable. Hay botón de IA, pero es otro acto. Antes de construir nada hay que decidir si esa recomendación sigue teniendo sentido en la pantalla nueva.

## Las contradicciones entre documentos, resueltas

1. `ESTADO.md` está atrasado desde agosto: sus dos listas no se usan para planear.
2. `PLAN_QUINTA_PESTANA_REPORTE.md` dice "sin construir": **la pestaña existe** desde el 2026-09-09. Lo abierto es contenido.
3. `PLAN_DISENO_INTAKE.md` dice "sin construir": está **a medias**, con lo listado arriba.
4. `PLAN_SEGUIMIENTO.md` dice "sin construir": **los cuatro bloques están**.
5. `LANZAMIENTO.md` afirma que no queda ninguna pregunta abierta con Gildardo, y `PENDIENTES_CIENTIFICOS.md` tiene **17 sin respuesta**. Manda el segundo.

---

## Lo que se construyó DESPUÉS de este barrido (mismo día, 2026-09-18)

El barrido se hizo por la mañana. Esto es lo que se cerró después, en el orden que acordamos, y **actualiza
las filas de arriba que toca**.

| Qué | Estado |
|---|---|
| **El diagnóstico nace firmado** | **HECHO.** `pipeline-writer` sella `confirmed_by`, `confirmed_at` y `confirmed_profession` al generar el diagnóstico. Antes la firma se ponía al aprobar el reporte, así que un diagnóstico generado y nunca aprobado quedaba sin responsable: había **23 así en producción**, y el script de respaldo los firmó con quien los generó (auditoría) o con el profesional de la evaluación. Quedaron **0** |
| **El plan impreso, en el orden de Gildardo** | **HECHO.** Profesional (con profesión) → paciente (con documento) → plan → porciones → lista de intercambios → **menú al final**. La paridad entre el papel y el PDF del correo la fija `plan-paciente.test.ts` |
| **Las rutas de atención se imprimen** | **HECHO** (`HojaImprimible`, andamiaje compartido) |
| **El diagnóstico funcional se imprime** | **HECHO**, con sus mapas |
| **Una hoja a la vez en el papel** | **HECHO.** Con dos bloques imprimibles montados salían los dos en el mismo papel; `data-hoja-activa` marca la hoja que se manda a imprimir y el CSS esconde las demás |
| **El registro de entregas dice QUÉ se entregó** | **HECHO** (migración 0148: `hc_deliveries.scope`). Cada documento deja su propia constancia, y cada pantalla lee la suya |
| **El reporte es una hoja más** | **HECHO.** Se retiraron la aprobación, las notas del reporte y los tres modos de envío. Se ve, se imprime, se envía. `/reportes` salió del menú (la ruta queda como registro) y el contador del tablero se retiró |
| **El freno del cambio desfavorable** | **MUDADO, no retirado.** Vivía dentro de aprobar; ahora vive en la **entrega** (`freno-de-trayectoria`), donde además alcanza a la impresión, que se lo saltaba. Frena el **reporte** y la **historia clínica**; **no** frena el plan ni las rutas, que dicen qué hacer y no cómo le va. Candados: `freno-entrega-empeoro.test.ts` y el caso de BD real en `report-trajectory-seal` |

**Lo que sigue abierto de este frente:** el smoke de Santiago en un solo recorrido
(`docs/entregas/SMOKE_REPORTES_POR_PANTALLA.md`), la exportación de respuestas (ya desbloqueada) y la lista
de mejoras de Gildardo cuando llegue.
