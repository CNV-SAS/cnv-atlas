# LANZAMIENTO — Hitos y gates

**Qué es.** La lista que decide **cuándo se puede atender al primer paciente real** estaba dispersa en `BACKLOG.md` entre más de cien líneas. Este documento la consolida: **nombra cada gate y apunta al detalle**; el detalle sigue en `BACKLOG.md` (u otros docs).

**FUENTE ÚNICA DE VERDAD sobre gates.** Este documento es el único que declara, para cada gate: (a) **su estado** (abierto / cerrado), (b) **a qué hito pertenece**, y (c) **el conteo** de gates abiertos por hito. Ningún otro doc afirma esas tres cosas por su cuenta: los demás describen el TRABAJO de un gate (qué hace, cómo se construye) y, si necesitan referirse a su estado o su hito para leerse solos, **citan explícitamente a este documento** ("ver `LANZAMIENTO.md` gate N"). Motivo: el mismo hecho vivía duplicado en cinco docs y actualizar uno dejaba cuatro mintiendo (se repitió 7 veces). Supera a `MVP.md` y a cualquier tabla de estado de `PLAN_ETAPAS.md`/`BACKLOG.md`/`MAPA.md` para esto.

**Dos ejes (no una lista):** **qué rol** (profesional → admin → soporte → dirección → ObBIA) y **qué hito**. Los hitos son compuertas; cada rol tiene un mínimo distinto en cada una (la matriz rol × hito se completa aquí conforme se decida por rol; hoy el eje que aprieta es el del profesional).

| Hito | Qué es | Estado |
|---|---|---|
| **Hito 1** | Producto completo y pulido para el Integrante (sandbox de pagos, **sin pacientes reales**) | EN CURSO |
| **Hito 2** | Revisión de Integrantes (prueban en la nube, dan visto bueno) | pendiente |
| **Hito 3** | Operación con **pacientes reales** | pendiente |

> Regla: **cada gate se cierra antes de pasar su hito.** Un gate abierto en el Hito 3 significa que NO se puede atender al primer paciente real.

---

## Gates del Hito 1 (producto completo para el Integrante)

1. **Flujo de corrección post-diagnóstico** (versionar evaluación/diagnóstico/reporte sin sobrescribir). **CONSTRUIDO (2026-08-11, CP1-CP3 de `PLAN_S2_CORRECCION.md`), pendiente smoke de Santiago.** Alcance = corrección de ENCUESTA (crea versión nueva, no sobrescribe; historial de la cadena con motivo; gate de versión de encuesta como estado). Tests: `correct-evaluation.test.ts` + `correction-chain.test.ts`. Fuera de este gate (bloque aparte, `BACKLOG.md` "Cerrar una evaluación CON diagnóstico"): el "Biody del paciente equivocado", que se resuelve cerrando y rehaciendo, no corrigiendo la medición.
2. **Bug D8 de la encuesta (CERRADO 2026-08-02, arreglo verificado por smoke).** El auto-envío al entrar a la última sección era la acción por defecto del clic sobre un botón reusado sin `key`; arreglado con `key` distintas. Santiago verificó los cinco casos (avanzar, retroceder, responder completo, no autoenvío, vista del profesional). Queda como follow-on (no gate) un e2e del wizard, única red que atrapa su reaparición (`BACKLOG.md`). `BACKLOG.md`.
2bis-a. **`dfi.complete` mide completitud REAL (CERRADO 2026-08-02).** Antes `complete = hay al menos un campo`, así que cualquier encuesta parcial se sellaba como completa en el snapshot inmutable de `reports`. Ahora `complete = todos los field_key que declara la versión de la encuesta están respondidos` (regla 7, definición aprobada por Gildardo/Santiago). Implementado en `engine.ts` (Opción A: la lista viaja en el `EngineInput`, anclada a `survey_version_id` sellado en el snapshot; fail-loud si no se puede obtener, nunca default silencioso). Sella `missingFieldKeys` para poder decir qué falta. Regresión en `clinical-engine.test.ts` (parcial ya no se marca completo). **Nota:** una encuesta a medias produce una edad bioeléctrica mayor, un nivel de riesgo más alto y a veces rutas que no corresponden (el bug D8 real solo tiraba el dominio D8, que no alimenta la EB-BIS, así que el efecto medido fue pequeño, +0.6; el efecto grande, +20.9, era un caso 3/13 sintético; ver la corrección en `BACKLOG.md`). Aun así un parcial cambia riesgo y rutas, por eso importa marcarlo.
2bis-b. **CAMBIO DE NATURALEZA (Gildardo 2026-08-13 §1): el sistema BLOQUEA generar un diagnóstico con encuesta incompleta (CONSTRUIDO 2026-08-13, commit `27eeacb`; pendiente smoke de Santiago).** Antes (2026-08-11/12) el sistema SUSPENDÍA lo que depende de la encuesta cuando `complete=false` y dejaba emitir el diagnóstico marcado. Gildardo 2026-08-13 §1 lo cambió: el profesional completa/edita la encuesta con el paciente ANTES de generar; un diagnóstico con encuesta incompleta ya no se sella. El gate vive al GENERAR, en `run-pipeline.ts` (inicial) y `correct-evaluation.ts` (regeneración), con el predicado `dfi.complete` (los field_key del diagnóstico; el mismo que cubre la guarda de calcLE8, cuyos 6 insumos son subconjunto, así que si pasa el gate el LE8 no se anula). El guardado por partes del paciente (intake) es otro flujo y NO se toca; el gate es solo al generar. **La suspensión Q28 (No evaluable / provisional / radar oculto) queda como RED**, solo alcanzable por snapshots sellados ANTES del gate (el gate hace imposible sellar uno nuevo incompleto; el seed no crea diagnósticos). **Corolario invertido:** el corolario anterior ("exigir encuesta completa para diagnosticar contradice esta decisión; no se implementa") queda SIN efecto; ahora SÍ se exige.

   **Smoke de Santiago (REEMPLAZA al de suspensión, que ya no se alcanza porque el bloqueo impide llegar ahí):**
   1. Llenar una encuesta a medias (dejar sin responder alguna pregunta que usa el diagnóstico).
   2. Intentar generar el diagnóstico.
   3. Verificar que NO deja: el aviso dice CUÁNTAS faltan ("Encuesta incompleta: faltan N de M respuestas que usa el diagnóstico", verificado en `engine.ts`), y aparece el enlace "Completar la encuesta con el paciente".
   4. Completar la encuesta y verificar que ahora SÍ genera.
3. **Los cuatro bloques de pulido de fidelidad** (encuesta, evaluación, diagnóstico, tratamiento), cada uno con comparación crítica contra el HTML. **Avance (2026-08-12):** el PASE DE INSTRUMENTO de la encuesta está HECHO (encuesta v3): ECA1 cirugías, ECA2 porciones + intro D1, ECA3 nombres de grupos, rótulos, todo verbatim de v8; sociodemográficos (4 al perfil + motivo); nombres de indicadores (P-18). ECA4a (texto libre en "Otra") separado por implicación de motor → pregunta a Gildardo (ECA4b). Queda el COTEJO VISUAL con ojos de las cuatro pantallas (comparación forma-a-forma). `COTEJOS_VISUALES.md` / `MAPA.md` / `BACKLOG.md`.

   **DECISION DE SANTIAGO (2026-08-29): el cotejo visual se hace UNA SOLA VEZ, contra lo definitivo, y
   por eso espera a que cierre todo lo científico.** El motivo es el del propio gate: cotejar contra una
   versión que aún va a cambiar obliga a cotejar dos veces, y la segunda vez el riesgo no es repetir el
   esfuerzo sino que quede una mezcla de las dos versiones sin que nadie lo note.

   **Estado de lo científico (2026-08-29, cerrado):** aplicados el piso calórico, los cortes del IRC (motor
   y texto), el orden de la matriz con sus tres encabezados, el punto 4 (ISCM sin MCA), el `cAF` que
   pintaba de ámbar un ángulo de fase normal, las quince alertas portadas con su corrección de campos, la
   separación de la cadena calórica en dos bloques, los dos resúmenes separados con los tres párrafos por
   profesión que faltaban, las observaciones del profesional en la historia clínica, y la reemisión
   obligatoria por cambio de banda.

   **CERRADO TODO LO CIENTÍFICO SIN BLOQUEO (2026-08-29).** La unificación del menú era la última: la IA
   dejó de componer y pasa a ADAPTAR el ciclo de 21 días, solo entra si hay restricciones, devuelve solo
   las sustituciones con su motivo, y el profesional las acepta cambio por cambio. Contrato `menu.v4` con
   clave de prompt propia (`menu.adapt`).

   **QUEDAN DOS SMOKES EN NAVEGADOR REAL, que Santiago hace en UNA sola pasada:**
   1. **Los tres encabezados de la encuesta** (toca el formulario del paciente: la familia de defectos que
      ni tsc ni jsdom distinguen de la versión rota).
   2. **El panel de tratamiento**, con la cadena en dos bloques y el menú unificado.

   **Y EL COTEJO VISUAL SE PUEDE HACER YA**, que era la decisión de Santiago: una sola vez, contra lo
   definitivo.

   **EL COTEJO ESTA EN CURSO (2026-08-31), subpestaña del Nutricionista.** Santiago va reportando por
   zonas y se construye por tandas, cada una con su smoke. **Tanda 1 (items 1-2, commit `6ebe698`):**
   fuera las guías dietarias y el fenotipo tecleado a mano; el bloque de objetivo con la forma de su
   pantalla (título dinámico, chips de la prescripción, notas, alerta de antecedentes) y el PAL como
   desplegable con sus cinco niveles. **Tanda 2 (items 3-6):** el peso meta como un solo dato (la
   superficie de la entrada existía y NO LA LEIA NADIE), la poda de las ayudas que repetían la pantalla,
   la cadena dispuesta como una cuenta vertical, y la confirmación de los dos recálculos.
   **Tanda 3 (unificacion del peso meta, migracion 0095):** un solo sitio de guardado, el del paciente,
   conservando de cual de las dos superficies salio el numero.
   Su estado no se afirma aquí: lo dicen `peso-meta-una-sola-fuente`, `ayudas-que-son-garantias`,
   `recalculo-dos-actos`, `cadena-dos-bloques` y `protocol-concurrency` (BD real).

   **LA SUBPESTAÑA DE RUTAS: SU TANDA SÍ SE HIZO (corregido el 2026-09-03).** Esta línea decía "falta la
   subpestaña de Rutas", y se leía como si nunca se hubiera cotejado. No es así:
   `COTEJO_TRATAMIENTO_2026-08-24.md` Parte 1 la cotejó inventario contra inventario, clasificó las cuatro
   piezas (R1↔A1 mismo motor de rutas · R2↔A2 nutracéuticos · R3↔A4 remisiones · R4 el botón de imprimir,
   solo en el HTML) y cierra con **"Sin clasificar: nada."**

   **Lo que falta es una PASADA DE OJOS, y por una razón concreta:** el 2026-08-27 los bloques de Rutas y
   remisiones se reescribieron al sistema de tres niveles, así que "que se vean como el v8" dejó de ser el
   criterio y `COTEJOS_VISUALES.md` los volvió a marcar `[OJOS]`. Lo que se mira es el orden de las tres
   secciones, los textos de las rutas activadas, y las dosis y prioridades de los nutracéuticos.

   **Y esa pasada queda ABSORBIDA por el cotejo final** (decisión de Santiago, 2026-09-03): cuando llegue
   la entrega de Gildardo se hace un paciente nuevo en los tres sitios y se coteja contra lo definitivo,
   una sola vez. Así que el gate 3 no espera trabajo nuestro: espera esa entrega.

   **Lo que NO es parte de este gate:** LUVIA y los otros productos. Es construcción diferida (fuera del
   MVP, `PLAN_CONSIGNACION_TERCEROS.md`, nada construido), no un hueco del cotejo.

   **Tanda 4 (smoke del 2026-09-01):** desbloqueo del panel (el peso meta paso a `evaluations`, migracion
   0096, porque la fila del intake es OPCIONAL y 41 de 60 tratamientos no la tenian), la correccion de una
   evaluacion dejo de perder motivo, sociodemograficos, peso meta y condiciones de la toma, y seis defectos
   de pantalla, de los cuales DOS eran clinicos: los multi-select llegaban al motor de nutricion como texto
   crudo (todas las comorbilidades en falso para todos los pacientes) y ningun caller pasaba el peso ni el
   objetivo al motor. Candados: `peso-meta-una-sola-fuente` y `motor-nutri-conectado`.

   **Tanda 5 (2026-09-01):** los cuatro campos de la cadena juntos en el bloque de la meta, como su
   pantalla los agrupa, con el PAL y el deficit repetidos dentro de la cuenta y UN solo estado detras; el
   deficit pasa a editable (migracion 0097, aprobado porque el valor del modelo es 0 para todos y abrirlo
   no elige de que motor sale nada). Y el candado que faltaba: los argumentos clinicos de
   `getPrescripcionNutricional` son OBLIGATORIOS, asi que tsc marca a todos los callers el dia que se
   agrega uno. Era lo que dejaba pasar que una pieza se quedara sin su ultimo cable.

   **REPORTES (2026-09-01):** retirados del PDF del paciente los indices del modelo (su §7.1 del 26-ago,
   que llevaba seis dias aplicada a medias por un congelamiento vencido en la cola), y anadida la linea del
   derecho a la historia clinica. Estado: `report-render`. (Esta linea decia que el PLAN del paciente y la HC
   imprimible seguian sin construir; se escribio antes de construirlos ESE MISMO DIA, y quedo contradicha
   por los dos parrafos de abajo. Corregida el 2026-09-02.)

   **ENTREGA DE GILDARDO DEL 1-SEP, cruzada (2026-09-01):** de sus nueve cambios, SEIS ya los teniamos y
   dos con la correccion mas adelantada que su archivo. Re-portado `motorTratNutri` del HTML nuevo (peso
   meta por FMI+FFMI) con bump de PROTOCOL_ENGINE_VERSION. **Su correccion NO gobierna todavia**: nuestra
   cadena le pasa el peso meta desde `motorProtocolo`, cuya formula por IMC el no cambio. Preguntado
   (punto 11.1 de la ronda). Estado: `peso-meta-composicion`.

   **EL PLAN DEL PACIENTE (2026-09-01, COMPLETO el 2026-09-03):** los SIETE bloques de su §7.1, dentro del
   reporte que el paciente ya recibe, con el diagnostico primero. El septimo (la lista de intercambio
   recortada a la region del paciente) entro el 3 de septiembre: su mapa existia desde el 2 pero llego
   SUELTO en la carpeta de la entrega, fuera del HTML donde su documento decia que estaba. Estado: corren
   `plan-paciente.test.ts` e `intercambio-region.test.ts`.

   **HISTORIA CLINICA IMPRIMIBLE + DFI EN LENGUAJE DE PACIENTE (2026-09-01):** la HC se imprime y se
   guarda como PDF desde la pantalla del profesional, con sello de consentimiento (mitad legal del derecho
   de acceso); y el DFI vuelve al reporte del paciente TRADUCIDO con el mapa de Gildardo. Estado:
   `hc-imprimible` y `dfi-paciente`. **Enviar la HC al paciente NO esta construido**: necesita una decision
   de arquitectura (adjunto contra enlace firmado), en BACKLOG.

   **APROBAR EL TRATAMIENTO (2026-09-02):** el barrido de cables encontro que la vertical entera de
   aprobar (policy, servicio, writer, trigger 0026 y dos suites) existia SIN NINGUNA PANTALLA que la
   invocara. No habia forma de aprobar un tratamiento, asi que **todo plan que le llegaba a un paciente
   salia de una prescripcion en BORRADOR**. Construido el boton, y con el se activaron el bloqueo de
   edicion, el aviso de reemplazo y la reapertura, que eran inalcanzables. Estado:
   `aprobar-protocolo-cableado`.

   **Y EL REPORTE YA NO SE EMITE SIN LA PRESCRIPCION APROBADA** (decision de Santiago): un plan emitido
   desde el borrador no es reconstruible, porque los `adj_*` se pueden mover despues. El REENVIO no lo
   exige: reenvia el archivo que ya salio. Estado: `send-report`.

   **CHECK DE CABLES (2026-09-02):** `pnpm check:cables`, dentro de `verify`. Ninguna server action puede
   quedarse sin pantalla que la invoque; las dos excepciones llevan su razon y su fuente dentro del script.
   Sin dependencia nueva, en la familia de `check-rsc-boundaries`.

   **EL AUTO-RESET DE REACT 19, EN TODA LA APP (2026-09-02):** el candado miraba un modulo y la regla es de
   React. Habia 36 formularios con la prop `action` y DOCE con select o checkbox, entre ellos el modo de
   envio del reporte al paciente. Migrados los 36. Estado: `form-action-no-resetea`.

   **EL SALTO AL INICIO (2026-09-02):** causa encontrada en el Next instalado. Invocar una server action
   navega con `ScrollBehavior.Default` y scrollea a los segmentos nuevos al montar; `router.refresh()` usa
   `NoScroll` y nunca fue el culpable, asi que quitar los `revalidatePath` no podia arreglarlo del todo.
   Estado: `preservar-scroll`.

   **LA CAPACITANCIA, CABLEADA (2026-09-02):** la tabla estaba portada con su candado desde el 26 de agosto
   y ninguna raiz la alcanzaba. La tarjeta de Seguimiento ya dibuja la mediana del grupo. Estado:
   `capacitancia`.

   **OJO AL DESPLEGAR: la 0095, la 0096 y la 0097 son migraciones con DATOS o con columnas nuevas.** Copia `treatments.adj_peso_meta` al registro
   del paciente y falla a proposito si algun tratamiento con peso meta no tiene fila de intake. Correr
   `pnpm db:check:cloud` antes de dar el push por terminado.

   **Esperan respuesta las de `RONDA_GILDARDO_2026-08-29.md`, y NINGUNA bloquea el cotejo.** Solo dos
   bloquean construcción futura: el puente frecuencia-porciones con el omega-3 (que enciende las diez
   alertas de consumo) y el ICEC.

   **Queda:** la tabla de intercambio (ya desbloqueada), las superficies de LISTA (/pacientes,
   /pacientes/[id], /evaluaciones/[id]), y la barra lateral, los componentes y el layout general, que van
   al final a propósito: si se rediseñan antes, se vuelven a tocar cuando cambie el contenido. **La historia
   clínica queda fuera** por ser documento imprimible con su cotejo propio (`BRAND.md`).

## Gates del Hito 2 (revisión de Integrantes en la nube)

5. **Despliegue a la nube — CERRADO (2026-08-07/08, Santiago).** `atlas.cnvsystem.com` en producción: Supabase nube, dominio propio, Resend, y el pago probado end-to-end con Wompi sandbox. La nube nació limpia (sembrada con `SEED_DEMO=false`, `patients` vacía verificada). `DEPLOY_GUIA_NUBE.md`.
6. **Captura de la profesión al invitar + `profession` NOT NULL — CERRADO (2026-08-05).** `createUserSchema` la exige (superRefine), columna NOT NULL (migración 0036). Falta aparte (no gate): EDITAR la profesión. `BACKLOG.md`.
7. **Q19/Q20 — clasificación y fenotipo consistentes** (F1-F12 en Diagnóstico; y cuál clasificador manda, `cXXX` vs `dXXX`). Gildardo dijo "antes de abrirle Atlas a los integrantes". `GILDARDO_QUERIES.md`.
8. **Rótulo de la EB-BIS** ("no leer como edad fisiológica", indicación de Gildardo). `BACKLOG.md`.
9. **Aviso a los Integrantes del paso de confirmación del diagnóstico** (Atlas lo añade, el prototipo no lo tiene). `BACKLOG.md`.
10. **Seed no destructivo — CERRADO (2026-08-07).** Interruptor `SEED_DEMO` en `supabase/seed.ts`; la nube se siembra sin datos demo. Pendiente menor (no gate): que el seed sea UPSERT idempotente para re-siembras. `DEPLOY_GUIA_NUBE.md`.
10bis. **"Olvidé mi clave" self-service — CERRADO (bloque de auth).** Enlace en la pantalla de acceso (`forgot-password`) + correo de recuperación + cambio de clave con segundo factor (`set-password-mfa-form`), probado en la nube. No era un gate numerado; se registra aquí para que no reaparezca como pendiente. `src/modules/auth`.
11. **Gate de aprobación de Gildardo para los cambios de opción B** (él aprueba ANTES de producción = antes de que un Integrante lo vea en la nube del Hito 2). **Movido de Hito 3 a Hito 2 (2026-08-01):** los cambios de opción B que se COMPUTAN al mostrar (la Δ, CA-2) llegan a pantalla sin sellarse, así que un Integrante los vería en su revisión del Hito 2; si Gildardo no aprobó antes, se pierde el sentido de su condición. `docs/entregas/CAMBIOS_AUTORIZADOS.md`.

## Gates del Hito 3 (pacientes reales)

12. **Q8 — firma del modelo de índices** (Gildardo confirma que la EB-BIS v5 vigente es la definitiva). `GILDARDO_QUERIES.md`. **CERRADA** (respondió), pendiente solo su OK formal.
13. **Q14 — modelo calórico vigente** (el tercero: peso meta + estrategia por condición + fórmula P1). `GILDARDO_QUERIES.md`. **CERRADA** en decisión; el re-port depende de P1.
14. **P0 — presentación de la edad biológica** (Gildardo decidió, 2026-08-01). Verificación concreta, no una intención: **el reporte del paciente NO contiene la cifra de EB-BIS, ni la de IAE, ni la expresión "edad biológica".** Parte 1 HECHA (EB/IAE fuera del reporte + marca de calibración provisional para el profesional), con test que lo ancla (`report-render.test.ts`). Resta la Parte 2 (cambio en tres bandas desde la 2ª medición). `GILDARDO_QUERIES.md`.
15. **Supabase Pro + PITR** y backups externos (antes de datos clínicos reales). `BACKLOG.md` / `DEPLOY.md`.
16. **Separación operativo/clínico completa** (cerrar el `admin`-amplio sobre todo el contenido clínico identificado, mecanismo de grants). `BACKLOG.md` / `SECURITY.md` / `DATA_GOVERNANCE.md`.
17. **Cierre legal de `SECURITY.md` y `DATA_GOVERNANCE.md`** (consentimiento, retención, residencia, plazos SIC). `BACKLOG.md`.
18. **Verificación de residencia / DPA de Supabase** frente a la regulación colombiana de dato de salud. `BACKLOG.md`.
19. **El reporte del paciente entrega la LECTURA FUNCIONAL de los indicadores, no sigla + número crudo (P0, movido de BACKLOG 2026-08-01).** Cita textual de Gildardo (P0, 2026-07-30): *"el reporte del paciente lleva la lectura funcional de los indicadores con su clasificación y su interpretación en lenguaje llano"*. HOY lleva **sigla y número crudo** (IFC 5.26 · IRC 2.03 · …), sin las tres cosas. Qué falta: (a) la **clasificación** ya está sellada en el diagnóstico → barato; (b) la **referencia** existe (`indicator-ranges.ts`) → barato (IFC/IRC/FMI en "-" hasta Q20); (c) la **interpretación en lenguaje llano** la genera una **IA** en el HTML (no es texto estático), así que necesita construir el resumen IA para el paciente (infra B12/B14, apta-paciente y PII-free) + su muestra de estilo. Parte de la Parte 1 de P0 solo QUITÓ lo peligroso (EB/IAE); el documento aún no es el que Gildardo describió. `BACKLOG.md` (item T4 original, ahora apunta aquí).

20. **Reseteo de versiones en la limpieza de staging → produccion (registrado 2026-08-19).** Al limpiar los datos de staging antes de produccion, los diagnosticos de prueba se van con TODO; ahi el motor queda sin nada sellado y es LEGITIMO renumerar `ENGINE_VERSION` 1.1.0 → 1.0.0. Contexto: hoy hay **22 diagnosticos de prueba sellados con `anibise-1.0.0`** (motor viejo, pre-re-port) y 1 con 1.1.0. **NO se borran a mano** (son inmutables por diseño; borrarlos a mano romperia la regla que protege la historia clinica, la misma razon por la que no corrimos SQL sobre la evaluacion mal atribuida). La salida limpia es que se vayan con la limpieza de staging; recien ahi el reset a 1.0.0 es honesto. Incluye ademas: (a) renumerar la version de ENCUESTA si aplica (los ids llevan la version, `surveyVersionId`; renumerar antes romperia el vinculo con lo respondido); (b) la limpieza de datos de prueba. El consentimiento ya quedo en 1.0. Dejar 1.1.0 hasta entonces.

## Ya cerrados (registro)

- **B15** — pulido/seguridad final del MVP de código (rate limit de grants, scrub PHI, checklist de seguridad + DPA, headers). `b15-status`.
- **Gate 2 · Bug D8** (2026-08-02) — autoenvío arreglado con `key` distintas, smoke de Santiago pasado. Follow-on abierto: e2e del wizard (no gate).
- **Gate 2bis-a · `dfi.complete` mide completitud real** (2026-08-02) — Opción A implementada, `missingFieldKeys` sellado, fail-loud, regresión verde. La mitad que ACTÚA (2bis-b) sigue abierta, espera Q28.
- **Gate 5 · Despliegue a la nube** (2026-08-07/08) — `atlas.cnvsystem.com` en producción, pago end-to-end en Wompi sandbox, nube limpia.
- **Gate 6 · Profesión al invitar + NOT NULL** (2026-08-05) — migración 0036.
- **Gate 10 · Seed no destructivo** (2026-08-07) — `SEED_DEMO=false`, nube sin datos demo.
- **Gate 10bis · "Olvidé mi clave" self-service** — enlace + correo + cambio con MFA, probado en la nube.

---

**Conteo de gates abiertos: Hito 1 = 4 · Hito 2 = 4 · Hito 3 = 8.** De los 4 del Hito 1, DOS están CONSTRUIDOS y solo esperan el smoke de Santiago (gate 1 corrección, gate 2bis-b bloqueo por encuesta incompleta, ver la naturaleza nueva arriba); los otros dos (gate 3 cotejo visual, gate 4 diseño gráfico) están abiertos de trabajo; el 4 con la mayor parte HECHA desde el 2026-08-27 (ver su avance), a falta de lo que espera a Gildardo y del layout general. (El 2026-08-02 se cerraron el gate 2/bug D8 y 2bis-a; el 2026-08-11/12 se CONSTRUYÓ 2bis-b, la suspensión Q28. Q8/Q14/P0 cerradas en decisión, pendientes de OK/re-port/trabajo; el gate de opción B se movió de Hito 3 a Hito 2; el gate 19, la lectura funcional del reporte, se movió de BACKLOG.) **Total ~19.** La matriz rol × hito se completa aquí cuando se decida por rol.

---

## Qué falta para atender a un paciente real (mapa del 2026-09-03)

**La pregunta que este bloque responde, y que no estaba escrita en ningún sitio:** llevamos semanas
construyendo y no había forma de ver de un golpe cuánto falta para el primer paciente real, ni qué de lo
que queda lo IMPIDE y qué es pulido.

**La respuesta corta: la ruta crítica no pasa por el código.** Atender a un paciente real es el Hito 3, y
de sus ocho gates **solo dos son construcción**.

| Naturaleza | Gates | Estado |
|---|---|---|
| **Legal** | 17 (cierre de `SECURITY.md` y `DATA_GOVERNANCE.md`) · 18 (residencia y DPA de Supabase frente a la regulación colombiana de dato de salud) | **No empezados**, y no dependen de escribir código |
| **Infraestructura** | 15 (Supabase Pro + PITR y backups externos) | No empezado. Es presupuesto y una tarde |
| **Operativo** | 20 (reseteo de versiones al limpiar staging → producción) | Definido; se ejecuta en la limpieza |
| **Código** | 16 (separación operativo/clínico completa) · 19 (lectura funcional de los indicadores en el reporte) | Abiertos |
| **De Gildardo** | 12 y 13 cerradas en decisión · 14 con la Parte 1 hecha | Casi |

**Lo que IMPIDE atender: los dos gates legales y el de infraestructura.** Ninguno de los tres es
construcción, y ninguno ha empezado. Conviene arrancarlos en paralelo: lo que queda de código cabe en el
tiempo que ellos tomen.

**Lo que es MEJORA** (no impide atender a nadie; hace que el producto esté pulido para el Integrante, que
es el Hito 1): el cotejo de Rutas, el diseño gráfico, el pase de diseño de los tres documentos
imprimibles, y la deuda de infraestructura.

### Lo que sigue abierto de nuestro lado (verificado el 2026-09-04)

**ESTA TABLA SE VERIFICÓ CONTRA EL CÓDIGO, no se copió de la versión anterior.** Listaba tres bloques
abiertos y **dos y medio ya estaban hechos**, cerrados por commits que están en este mismo repositorio. Y
no es la primera vez: el commit que cerró la deuda de los tests (`a9a7aa5`) ya decía "es la cuarta entrada
seguida que estaba hecha", y aun así esta tabla volvió a listarla. Fue **la quinta**.

**La causa está localizada y es de este archivo:** LANZAMIENTO es la fuente única del estado, así que
cuando se cierra algo y no se actualiza aquí, el desfase no se queda en un rincón: se convierte en la
respuesta que se da cuando alguien pregunta qué falta. Por eso las filas de abajo **citan un test o un
commit** en vez de afirmar; una aserción a mano envejece y un puntero a algo que corre, no.

| Bloque | Estado, derivado | Tamaño |
|---|---|---|
| **Cotejo de Rutas** (cierra el gate 3) | La tanda **se hizo el 2026-08-24** (`COTEJO_TRATAMIENTO_2026-08-24.md`, sección B "Rutas y remisiones (cerradas)"). Lo que queda es **la pasada de ojos de Santiago sobre la pantalla**, no construcción | **Chico.** Es mirar, no construir |
| **Diseño de los tres documentos** | ABIERTO de verdad. El plan del paciente, la HC imprimible y el reporte funcionan y no pasaron por `BRAND.md` | **Medio.** No toca lógica. El riesgo es de impresión (saltos de página), que solo se ve imprimiendo |
| **Diseño de la encuesta del paciente** | ABIERTO. Es lo único de diseño con capturas de referencia ya entregadas (`cotejo-visual/encuesta atlas pacientes`) | **Medio** |

**La deuda, con su estado verificado:**

- **CERRADA · La siembra no destructiva** (gate del Hito 2). Commit `f6741cc`; el estado lo sostiene
  `seed-no-destructivo.test.ts`, que además falla en voz alta si una pregunta retirada ya tiene respuestas.
- **CERRADA · Los tests de integración no limpiaban.** Commit `a9a7aa5`, cerrado con la verificación
  **medida** (contar filas, correr la suite, contar otra vez): cero crecimiento en las seis tablas. La
  acumulación local que se veía era histórica, anterior a los cleanups.
- **ABIERTA · El flake de `db` corriendo junto a `unit`.** Es distinto de lo anterior y sigue vivo:
  `fileParallelism:false` serializa solo DENTRO del proyecto `db`. **Chica.**
- **El resto es infraestructura futura** (bus durable, jobs en background, E2E con Playwright, chequeo de
  configuración al arranque). **Grande, y nada de eso hace falta para atender.**

### Lo que espera a Gildardo, y qué bloquea

**RESPONDIÓ LA RONDA DEL 2026-09-04, con archivo y no con documento, y con una instrucción de cierre:**
*"No más cambios, lo que envié quedé tal cual lo envié"*. **Los cinco puntos que traían cambio están
portados** (verificados ejecutando su archivo, no leyendo su mensaje): las nueve etiquetas de los sectores
(P-103), la caída campo por campo de `getDX` que borra los 21 estados con raya (P-102), Tumaco y Cartago
en una sola región (P-100), diez alimentos al núcleo con los que **ningún grupo prescrito se queda sin
lista** (P-101) y las nueve ocurrencias de sus cuatro erratas (P-105). `generarAlertas` no se borra y su
sitio ya era el correcto en Atlas, así que no hubo nada que mover (P-104). La proteína queda en 0,8
editable y su rango se MUESTRA en el panel de referencia, ya cableado a la pantalla (P-99).

El estado lo sostienen los tests, no esta frase: `intercambio-region.test.ts` (22 casos, incluido "ningún
grupo prescrito se queda sin lista" sobre diez regiones y cinco objetivos calóricos),
`efr-81-estados.test.ts` (los 405 campos contra su archivo, cero diferencias) y `asesoria-macro.test.ts`
(20 casos, seis de ellos sobre el SITIO DE LLAMADA del panel).

**QUEDA UNA COSA ABIERTA Y ES LA MÁS SERIA: el interruptor del LE8 (P-92).** Su archivo lo tiene
encendido y **el comentario que él mismo escribió tres líneas más arriba dice que debe quedar apagado**
hasta recalibrar dos constantes; su respuesta del 4 confirma que esa recalibración **hoy es imposible**
por ausencia de dato. Portarlo encendido baja la edad bioeléctrica de todos los pacientes entre 1 y 8
años (sus palabras) con constantes que él mismo dice que no tienen origen documentado; dejarlo apagado
mantiene dos de los ocho dominios del LE8 clavados para todo el mundo. **No se tocó**, y las dos opciones
con su efecto están en `PENDIENTES_CIENTIFICOS.md`, punto 1.

**Y los tres colores de los sectores siguen contradiciendo su etiqueta.** Él los dejó así a propósito
("el color es contenido de esta Dirección y va firmado aparte"). Es la pregunta más barata que queda:
son tres códigos de color. `PENDIENTES_CIENTIFICOS.md`, punto 2.

**El resto está en `docs/PENDIENTES_CIENTIFICOS.md`, en lenguaje no técnico**, y son CUATRO cosas de las
que solo dos son preguntas: el LE8, los tres colores, dos correcciones que él prometió "para la próxima
entrega" y no llegaron (el "(≥30 min)" de la P23 y el lenguaje de la P44), y el porte pendiente de las
opciones de ejercicio, que es trabajo NUESTRO y necesita bump de la encuesta.

**Ese documento nació con NUEVE puntos y seis ya estaban contestados**, algunos desde el 3 de septiembre;
uno de ellos llevaba una recomendación que contradecía una instrucción directa suya. Es la quinta vez con
esa forma, así que el documento deja el barrido escrito en su primera sección en vez de borrarlo. La señal
que lo destapó es la de siempre: **cuando un documento nuestro dice "él no ha contestado X", ir a buscar
si lo contestó.** Es para Santiago, no para Gildardo.

**De la ronda del 2026-09-03 respondió los ocho.** Dos de sus respuestas cerraron bloqueos: el mapa de
regiones llegó completo (el séptimo bloque del plan ya está construido) y la correspondencia de los 18
grupos con los 21 subgrupos "no va, y no es que falte: es que no debe existir" (su punto 3). De rondas
anteriores siguen bloqueando el puente frecuencia-porciones con el omega-3 (enciende las diez alertas de
consumo) y el ICEC.
