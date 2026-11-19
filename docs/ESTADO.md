# Estado de Atlas

**Al 19 de noviembre de 2026.** Para que una sesión nueva arranque sin depender de una conversación
larga. Una o dos páginas, y se mantiene así: lo que crezca se va a su documento propio.

> **Cómo se mantiene:** al final de cada turno con cambios, se actualiza este archivo. Cada decisión
> nueva es una línea en `DECISIONES.md`. Está escrito también en `CLAUDE.md`, para que no dependa de que
> alguien se acuerde.

> **Qué NO está aquí:** los gates del lanzamiento (`LANZAMIENTO.md`, fuente única), el backlog
> (`BACKLOG.md`), las reglas de arquitectura (`ARCHITECTURE.md`) y lo que espera a Gildardo, pregunta por
> pregunta (`PENDIENTES_CIENTIFICOS.md`). Este documento no los repite: los nombra.

---

## El motor clínico en producción

**`ENGINE_VERSION = "4.0.0"`** (`src/clinical-engine/version.ts`), más `PROTOCOL_ENGINE_VERSION = "1.0.0"`
para la cadena calórica. Cada versión, en una línea; el porqué completo vive en los comentarios de ese
archivo, que es la fuente.

| | Fecha | Qué cambió |
|---|---|---|
| 1.0.0 | | Port inicial, paridad con su `ATLAS_v7.html` |
| 1.1.0 | 2026-08-19 | Re-port contra su `ATLAS_v8.html` |
| 1.2.0 | 2026-08-31 | La dinamometría entra al motor (su §6 del 30 de agosto) |
| 1.3.0 / 1.3.1 | 2026-09-05 | Se enciende el LE8; patch del chip del PABU, sin ciencia |
| 1.4.0 | 2026-09-06 | La guarda del LE8 pasa de seis insumos a ocho |
| 2.0.0 | 2026-10-28 | La EB-BIS v7 entra al motor |
| 3.0.0 | 2026-11-06 | El DFI lee la EB-BIS de la v7 (su v15 §1.4) |
| 3.1.0 | 2026-11-06 | El puntaje de Alimentación del ICEC (su v16 §4.2) |
| 3.2.0 | 2026-11-07 | El borde de ±5,0 del IAE se cierra, en los cuatro sitios nuestros |
| 3.3.0 | 2026-11-11 | El ICA-BIS, con signo, y su referencia por percentiles (su v17 §4) |
| 4.0.0 | 2026-11-12 | La Diana se mueve: sus cortes MCCB y el sector (su v17 §2.3 y §2.4) |

**El histórico ya está recalculado con la v17:** **481 consultas quedaron en 4.x** y **71 no se pudieron
reemitir**, cada una con su motivo (34 de prueba; de las 37 reales: 20 con la medición
repetida, 13 sin fecha de nacimiento legible y 4 fuera del rango de calibración de la EB-BIS v7). Se
mide con `scripts/las-que-no-se-reemitieron.mjs`.

## Base de datos

**247 migraciones aplicadas**, la última `drizzle/0246_los_rotulos_para_el_paciente.sql`. Forward-only:
una migración aplicada no se modifica nunca, se crea otra. El control es `scripts/check-migrations.mjs`.

## Interruptores de activación

| Constante | Valor | Qué significa |
|---|---|---|
| `CNVS_ACTIVA` | `true` | La Encuesta CNV-S de seguimiento se aplica a **todos** los pacientes, reales incluidos. Encendida el 2026-11-16 |
| `CNVS_EN_PRUEBAS` | `true` | Se deja en `true` para conservar el estado anterior (solo pacientes de prueba) si alguna vez se apaga la de arriba |
| `VENTAS_HISTORICAS_CARGADAS` | `false` | Mientras sea `false`, las tres pantallas de inventario avisan de que el sistema **muestra más unidades de las que hay**, porque las ventas de antes del arranque entran después por el xlsx. **Se pone en `true` en el mismo commit que carga el xlsx**, antes del 30 de noviembre |

Las dos primeras viven en `src/modules/evaluations/instrumento.ts`; la tercera, en
`src/modules/nutraceuticals/carga-de-ventas-historicas.ts`. Las tres con su candado.

**Y hay un cuarto freno que no es un interruptor sino una regla:** la venta de un **paciente menor** no se
factura en ningún ambiente mientras no se pueda emitir a nombre de su representante legal
(`motivoSiElMenorNoSePuedeFacturar`). No se apaga: desaparece solo cuando se construya el mecanismo
completo. Apagar `CNVS_ACTIVA`
devuelve el sistema a pacientes de prueba sin tocar nada más.

### Y el tercero, que no es una constante sino un dato: desde cuándo cuentan las cifras

`commercial_config.fecha_de_arranque` (migración 0198). **Hoy dice `2026-10-15`, que es una fecha en la
que NO se arrancó**: se fijó el 11 de septiembre para un arranque que se aplazó tres veces.

**Desde el 2026-11-17 ese valor tiene tres estados** (`src/modules/payments/arranque.ts`), y es el acto
que enciende las cifras:

| Valor | Qué hacen las pantallas de cifras |
|---|---|
| sin fecha | dicen *"todavía no se ha arrancado"* y **no cuentan nada** |
| fecha en el futuro | dicen para cuándo está fijado el arranque, y **no cuentan nada** |
| fecha de hoy o anterior | cuentan desde ese día |

#### ⚠ Y SON DOS FECHAS, NO UNA (Santiago, 2026-11-18)

| | Qué es | Valor | Cómo se expresa |
|---|---|---|---|
| **El corte de pruebas** | el día del arranque: lo registrado antes es de prueba | **2026-11-20** | la marca `cuenta_como_de_prueba` de cada venta, **no** una fecha |
| **El inicio de la operación** | desde cuándo cuentan las cifras | **2026-08-08**, la primera venta real | `commercial_config.fecha_de_arranque` |

**No hace falta migración:** los dos mecanismos ya estaban separados en el sistema (los lectores de cifras
miran la marca por su cuenta, en `esOperacion`). Lo que estaba confundido era el **nombre** de la columna,
que guarda "desde cuándo cuentan las cifras" y no "el día del arranque".

**Por qué el inicio es el 8 de agosto:** las ventas atrasadas del xlsx tienen fechas de agosto a noviembre.
Con la ventana empezando el 20 **no contaría ninguna**.

**Falta ponerla**, y es una escritura en producción: la hace
`scripts/ARRANQUE_A_PRODUCCION_2026-11-20.sql`, paso 2 del checklist. **No recorta el inventario ni lo que
se le debe a alguien**, y las dos reglas tienen candado.

## En curso

### ⚠ EL ARRANQUE COMERCIAL ES EL VIERNES 20 DE NOVIEMBRE DE 2026, y no pasa de ese día

Ese día quedan **las credenciales reales de Wompi y de Alegra**, con todo funcionando. Es la única cosa
con fecha en todo el proyecto.

| Día | Qué |
|---|---|
| **miércoles 19** | el **smoke completo** (A, B, C y D) y el **video**, en sandbox |
| **viernes 20** | **el arranque**, por el checklist |
| **lunes 30** | el **xlsx de ventas atrasadas** cargado, antes del cierre del mes (contabilidad) |
| **5.º día hábil de diciembre** | la **conciliación de inventario** (contabilidad) |

**Lo comercial vive en `docs/SMOKE_COMERCIAL_FINAL.md`:** el smoke, el checklist de 11 pasos, los
comandos exactos en orden y la lista de pendientes con su fecha. **Lo que va después del arranque** (las
ventas históricas y la conciliación de inventario) está en `docs/PLAN_VENTAS_HISTORICAS_XLSX.md`.

**NO SE PODA NI SE BORRA NINGÚN DOCUMENTO** (Santiago, 2026-11-18), ni después del 20.

**Las modalidades reales:** **Katherine** en **Distribución** desde el 2026-11-18 (persona jurídica, única
en Distribución); **Zoraida** y los demás en **Comisión**.

### Lo que fijó contabilidad el 2026-11-18 (C1 a C5)

| | Qué |
|---|---|
| **C1** | La factura de un **paciente menor** va a nombre de su **representante legal**, con su cédula y su correo. **Nunca los datos del menor en un documento tributario**, y nada de "consumidor final" por defecto. Sin representante: la venta se registra, queda **pendiente de facturar** y no se emite |
| **C2** | La **tabla del art. 383** como alternativa al 10 % para persona natural, con su depuración y sus topes. La contadora la valida antes del primer pago |
| **C3** | **UVT 2026 = 52.374** (confirmada). La retención del 2,5 % que Katherine le practica a CNV **la calcula ella**: Atlas solo **REGISTRA** lo que efectivamente retuvo |
| **C4** | Las dos cuentas de smoke se **marcan como prueba el 20**; la **anulación formal** de los cinco documentos ("anulada - prueba", sin borrar) va **antes del cierre de noviembre** |
| **C5** | **Conciliación de inventario** antes del 5.º día hábil de diciembre, y desde diciembre el total por producto de Atlas tiene que ser igual al de Alegra en cada cierre mensual |

**El 19 de noviembre se construyó el FRENO de C1**, no el mecanismo completo: la factura a nombre del
representante necesita el **tipo** de documento del representante, que no existe en la base y que Alegra
exige. Hasta entonces, la venta de un menor **se registra y no se emite**, con su motivo visible.

- **Nada clínico abierto de nuestro lado.** Lo científico se cerró con la v17 aplicada, el histórico
  reemitido y la CNV-S encendida.

## Lo que espera a alguien

| Espera a | Qué | Dónde está |
|---|---|---|
| **Gildardo** | Las **50 preguntas abiertas** del 16 de noviembre (siete solo piden confirmar lo ya aplicado). Tres frenan trabajo: la **37**, la **1** y la **2** | `docs/PENDIENTES_CIENTIFICOS.md`, y el `.docx` del 16 en `docs/entregas/` (fuera de git) |
| **Ángela** | Las correcciones de la cohorte: los grupos de **medición repetida**, **15 pacientes sin fecha de nacimiento** y **2 fechas que no cuadran** | `scripts/PARA_COORDINAR_CON_ANGELA_2026-11-07.mjs` arma el mensaje en `docs/entregas/dudas/` (gitignoreado) |
| **Una profesional (`4d2a74e0`)** | Reportó un error en "Antrop. y BIS" y quedó en reintentar. Si vuelve a verlo, se corre el script de abajo con su identidad | `scripts/los-lectores-con-su-identidad.mjs` |
| **La contadora** | **Confirmar** la UVT 2026 (52.374) y la base mínima de retefuente por compras (27 UVT = 1.414.098), y **los rangos de la tabla del art. 383**. La tarifa de comisión ya la fijó el 2026-11-18: natural 10 % (u 11 % sobre 3.300 UVT), jurídica 11 % | `docs/SMOKE_COMERCIAL_FINAL.md`, "La retención por integrante" |
| **Santiago** | **Cargar en Atlas el RUT y los datos bancarios** de cada Integrante. Ya los entregaron; el Integrante los llena en **/perfil** y CNV verifica el RUT en **/verificaciones**. Sin los tres campos del RUT el sistema **no liquida** | `/perfil` y `/verificaciones` |

## Los próximos pasos

1. **Smoke comercial de punta a punta**, con un integrante de Comisión y uno de Distribución. El guion
   completo, paso por paso y con su resultado esperado, está en **`docs/SMOKE_COMERCIAL_FINAL.md`**.
2. **El video** del flujo comercial para los Integrantes, todavía en sandbox.
3. **El arranque**, por el checklist de diez pasos del mismo documento: marcar lo de prueba, fijar la
   fecha, cargar el inventario, las variables de Vercel, el webhook de Wompi, los ids del Alegra real,
   redesplegar, la primera venta real vigilada, qué mirar en Sentry, y cómo volver atrás.
4. Lo demás, por prioridad, en `BACKLOG.md` y `LANZAMIENTO.md`.

## Los scripts de solo lectura

Todos leen la nube y **no escriben nada en ella**. Se corren con
`node --env-file=.env.production.local scripts/<nombre>`, e imprimen cuentas e ids abreviados a ocho
caracteres, nunca nombres ni documentos.

| Script | Qué mide |
|---|---|
| `las-que-no-se-reemitieron.mjs` | Qué consultas quedaron sin reemitir con la v17, y por qué cada una |
| `los-veredictos-de-la-hc-contra-el-dfi.mjs [id...]` | Qué dice cada superficie de cada índice sobre el mismo sello. Sin ids, barre y resume |
| `hombres-con-el-ica-bis-alterado.mjs` | Qué consultas de hombre traen la fila del ICA-BIS alterada (para verificarla en la HC, que solo muestra lo alterado) |
| `EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs` | El catálogo y el saldo de cada vitrina contra lo que esa persona recibió, si las ventas de prueba descontaron, y la **simulación** de la carga al arranque, por persona y por producto |
| `el-item-de-nutraceuticos-contra-la-vigente.mjs` | El pendiente del cierre contra la prescripción vigente: cuántas tienen solo producto externo |
| `el-omega-en-la-cohorte.mjs` | Dónde sugiere el omega el modelo y en cuántas consultas se prescribió |
| `los-pendientes-de-verdad.mjs` | Los pendientes que la franja del cierre cuenta de verdad, con las condiciones reales |
| `mediciones-fuera-de-rango.mjs` | Mediciones con insumos fuera de rango fisiológico |
| `repasar-el-seguimiento.mjs <id>` | Qué le quedó a una consulta de seguimiento |
| `revisar-respuestas-de-la-consulta.mjs <id>` | Qué le quedó a una consulta después de un guardado que falló (acepta el prefijo que imprime Sentry) |
| `los-lectores-con-su-identidad.mjs` | Corre los lectores de "Antrop. y BIS" con la identidad de una profesional, para reproducir su error |
| `encuesta-de-los-importados.mjs` | Cuántos pacientes importados del HTML tienen la encuesta incompleta |
| `que-trajo-el-html-en-otra.mjs` · `cotejo-de-las-opciones-otra.mjs` | Qué trajo el HTML en el texto libre de "Otra", y en cuántas preguntas se escribe distinto |
| `datos-eb-bis-para-gildardo.mjs` | Los datos de la edad bioeléctrica para la dirección científica |
| `simular-v17.mjs` | Simula una versión del motor sobre la cohorte sin escribir (es como se midió la v17 antes de aplicarla) |
| `PARA_COORDINAR_CON_ANGELA_2026-11-07.mjs` | Arma lo que Santiago necesita para coordinar las correcciones con Ángela |
| `cotejo-alegra.mjs` · `leer-alegra.mjs` · `sondeo-wompi-consulta.mjs` | Cotejan el catálogo y las cuentas de Alegra, y sondean las transacciones de Wompi |

**Y las puertas, que corren en local y no tocan la nube:** `npx tsc --noEmit` · `pnpm lint` ·
`pnpm check:rsc` · `pnpm check:cables` · `node scripts/check-secrets.mjs` ·
`node scripts/check-entregas.mjs` · `npx vitest run --project unit` · `npx vitest run --project db`.

**Los scripts que SÍ escriben** (`aplicar-migracion`, `normalize-patient-sex`, `adoptar-factura-alegra`,
`reseed-indicator-defs`, `seed-golden`, `limpiar-fixtures-de-la-suite`, y los `gen-*`) no se corren contra
producción sin que Santiago lo pida en ese turno.

**Y los tres SQL del día del arranque**, que escriben y por eso vienen en modo ensayo (terminan en
`rollback`; se cambia por `commit` después de leer sus cuadros):

| Script | Qué hace |
|---|---|
| `ARRANQUE_A_PRODUCCION_2026-11-20.sql` | **Lista y luego marca** como prueba lo operado antes del **corte** (2026-11-20), anula las cuentas de Distribución anteriores no pagadas, y pone `fecha_de_arranque` en el **inicio de la operación** (2026-08-08). Para si las dos fechas están intercambiadas |
| `CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-20.sql` | Deja el saldo de cada vitrina en lo que esa persona recibió, por conciliación, con su evento auditado. **Calcula** el neto esperado y dice CUADRA o NO CUADRA contra la primera tanda (500/500/426/300/84) |
| `config-alegra-produccion.sql` | La fila de producción de `alegra_config` y los ids de los cinco productos en el Alegra real. Aborta mientras quede un `<LLENAR>` |

**El de octubre (`ARRANQUE_A_PRODUCCION_2026-10-15.sql`) NO se vuelve a correr**: volvería a poner la
fecha equivocada. Se conserva como el registro de lo que se hizo ese día.
