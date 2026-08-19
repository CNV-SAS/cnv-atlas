# PLAN: re-port del motor contra ATLAS_v8.html del 18

**Estado: PROPUESTA, pendiente de aprobacion de Santiago. NO ejecutar hasta el OK.**

Este documento planea la re-sincronizacion del motor congelado (`src/clinical-engine/`) contra
`docs/entregas/Gildardo responses/ATLAS_v8.html` (el "del 18", credenciales ya barridas, la matematica
byte por byte). No cambia una sola linea del motor todavia: es el plan para aprobar antes de tocar el frozen.

## Reglas que gobiernan este trabajo (no negociables)

- El frozen cambia SOLO por una modificacion autorizada (ARCHITECTURE.md regla 5-6; `CAMBIOS_AUTORIZADOS.md`).
- Los golden prueban PARIDAD con el HTML, no correccion clinica. Ni un decimal cambia mas alla de lo que
  dicta el archivo del 18. Si algo del HTML parece raro, se reporta, no se "corrige".
- Ningun registro clinico sin su constelacion de versiones (regla 7). El `engine_version` sube en este bloque.
- Forward-only. Las migraciones no se despliegan solas.
- Los saltos de linea del HTML son CRLF (nota de Gildardo). Irrelevante para la matematica parseada; se anota
  para que el diff contra su respaldo salga limpio.

## Los DIEZ puntos del delta (17-ago, lineas 90-99 de RESPUESTA_GILDARDO_2026-08-17), verbatim en sentido

1. **PABU al Dominio 1.** Entra la PABU al DFI Dominio 1 (faltaba pese a estar en la estructura). Se emite con
   su clasificacion y, cuando hay ICA-BIS, con la desviacion de phi. `cPABU` se porta TAL CUAL, sin graduar
   (marcador direccional; k por sexo H 0.78 / M 0.46 / sin sexo 0.9). ES EL PUNTO QUE MAS CAMBIA SALIDAS.
2. **Vocabulario de severidad del DFI:** ["Bajo","Leve","Moderado","Alto"] (antes Optimo/Vigilancia/Moderado/Critico).
3. **Radar de cuatro zonas,** misma escala y vocabulario que las tarjetas de dominio. Fuera la banda
   "Excepcional" (inalcanzable; la zona solo devuelve 1 a 4).
4. **R1-R9 -> E1-E9** (codigo de estructura FFMI x FMI). Traduccion SOLO al mostrar, NUNCA migracion del dato
   guardado: las consultas anteriores al 9-ago se traducen al render, para que un reporte viejo y uno nuevo se
   lean igual.
5. **Salvaguarda TCA: avisa, no bloquea.** El deficit sigue partiendo del peso meta acordado; el sistema
   levanta alerta y marca remision (antes ponia el deficit en cero y forzaba normocalorica).
6. **Objetivo calorico en 0.** El sistema ya no deriva el objetivo. Se retiran los cinco deficits por fenotipo
   (-300, -500, -600, -300, mantenimiento). El deficit queda en 0 y la orientacion del fenotipo se conserva como
   texto sin cifra en el campo perfil. Lo decide el nutricionista.
7. **Habitos moderados con el optimo en el medio.** Dejan de seguir la logica de los protectores: mas
   frecuencia no es mejor, el optimo esta en el medio y la frecuencia alta ya no se pinta en verde.
8. **Bandera del ICEC APAGADA (false), y asi se queda.** Se porta con el comentario COMPLETO: activarla sola
   bajaria la edad bioelectrica de todos los pacientes entre 1 y 8 años (mas cuanto mas sano). No se activa sin
   recalcular mu y sigma del ICEC en el mismo acto. D-006 vigente.
9. **Bloque REF_POB revisado el 12-ago** (colores moderados, MCA, reparto de Wang; ver §5 del 17 y lo ya hecho
   en `computeRefPob`). Verificar que el motor del 18 coincide con lo que ya portamos.
10. **§0 del 15-ago (orden de derivacion):** retiradas `FFW = MLG x hidratacion` y el reparto proporcional de
    las aguas sin grasa; los porcentajes sin grasa se calculan DESPUES de `derivarFaltantes`. Cambia valores de
    composicion; se golden-testea contra el pipeline completo (no sobre la fila cruda, ver leccion
    verificar-por-camino-real).

### Tres correcciones que Gildardo aplico al archivo del 18 (§4 del 18)

- **cMMEM femenino 5.7 -> 5.5** (unifica en EWGSOP2; antes AWGS2019 chocaba con ASMI/REF_POB.asmi/sarcopenia).
- **Fila FMI:** banda 6-9 / 9-13 -> **3-6 / 5-9**, y el Delta contra 6 (H) y 9 (M).
- **Fila SMM/W:** borde femenino 24 -> **22** (§3; el 24 era error de transcripcion suyo).

### Capa display (fuera del frozen, pero parte del mismo bloque)

- **FM_pct:** borde superior H 22 / M 32 (§1; nuestra suposicion era correcta, su archivo ya media asi).
- **IAE:** el Delta se deja en **"—"** (decision Santiago 2026-08-19; Gildardo prefiere "el dato que manda es
  el valor, no el Δ"). Se conserva la referencia "-5 a +5 años" y el valor con su signo.
- **REGLA GENERAL DE DOS COLAS (registrar aunque el IAE no muestre su Delta):** cualquier clasificador de dos
  colas mide el Delta contra el borde DEL LADO DEL SIGNO (>= 0 contra +borde; < 0 contra -borde). Queda escrita
  para el proximo clasificador de dos colas, sin volver a preguntar.
- **Fila FMI:** Delta contra 6 (H) / 9 (M), coherente con la banda nueva.

## Esqueleto de seis pasos

1. **MEDICION ANTES-DESPUES (va PRIMERO, condicion Santiago 2026-08-19).** Capturar las salidas del motor del 18
   en casos representativos (= el "despues") y correr el frozen ACTUAL sobre las mismas entradas (= el "antes");
   medir el delta en estado EFR, zonas del radar, severidades del DFI (sobre todo Dominio 1 con la PABU), EB/IAE,
   diagnostico de sarcopenia y objetivo calorico. NO toca el frozen (solo lee). Da el "que esperar" ANTES de
   portar: al terminar, el delta medido debe COINCIDIR con el previsto; si no, algo salio distinto de lo planeado
   y se para. Estas mismas salidas del 18 son los fixtures golden de paridad (sirven doble: baseline y golden).
2. **Diff frozen vs 18.** Localizar en `src/clinical-engine/` cada uno de los diez puntos + las tres
   correcciones. Marcar cuales ya estan portados (varios del REF_POB y el §0 del 15 ya se trabajaron) y cuales
   faltan. Salida: una tabla punto-por-punto (portado / falta / parcial), sin escribir codigo aun.
3. **Portar cada cambio con paridad, UN golden test por cambio.** EMPEZAR por las tres correcciones acotadas
   (cMMEM, FMI, SMM/W), en el orden de la tabla de abajo. Cada sub-tarea: diff + golden verde + checkpoint antes
   de comitear.
4. **Capa display:** FM_pct H22/M32; IAE en "—" con la regla de dos colas registrada; Delta FMI contra 6/9.
5. **Constelacion de versiones + aviso de Seguimiento.** Subir `engine_version`, sellarlo en cada diagnostico
   nuevo y dejarlo VERIFICABLE (ver adicion b). Y el **AVISO DE CRUCE DE VERSION EN SEGUIMIENTO entra CON este
   bloque** (condicion Santiago 2026-08-19; BACKLOG L69): un profesional que compara dos evaluaciones a traves
   del borde de version tiene que saber que cruzan versiones del motor, para no leer un salto de version como
   cambio clinico del paciente. No despues: con esto.
6. **Golden + suite completa** (`pnpm vitest run`), incluido el barrido RSC si se tocaron componentes cliente, y
   verificar que el delta medido coincide con el previsto del paso 1.

## Adicion (a): que tan distinto se ve un paciente antes y despues [VA PRIMERO]

Los diez puntos cambian SALIDAS del motor. Los diagnosticos sellados quedan con su version anterior (regla 7,
inmutabilidad, correcto). Hay que MEDIR cuanto cambia el mismo paciente, y esa medicion es el PASO 1 del bloque
(condicion Santiago 2026-08-19): se corre ANTES de portar nada, para saber que esperar.

- **Paso:** correr el motor viejo (frozen actual) y el nuevo (salidas capturadas del 18) sobre un set de
  entradas representativas (mismos BIS + encuesta) y medir el delta en las salidas clave: numero de estado EFR,
  zonas del radar, severidades del DFI (sobre todo Dominio 1 con la PABU entrando), EB/IAE, diagnostico de
  sarcopenia, objetivo calorico.
- **Lectura esperada:** el cambio NO es cosmetico. La PABU entrando al Dominio 1 mueve la severidad y el radar
  de ese dominio; el vocabulario de severidad y el radar de 4 zonas cambian rotulos; R1-R9 -> E1-E9 cambia el
  codigo mostrado. Un paciente re-evaluado despues del re-port se vera distinto de su diagnostico sellado antes.
- **Cierre:** al terminar el port, el delta medido debe COINCIDIR con el previsto de este paso. Si no coincide,
  algo salio distinto de lo planeado y se para a revisar antes de cerrar.
- **Gate de decision: RESUELTO (Santiago 2026-08-19).** El cambio no es cosmetico, asi que el **aviso de cruce
  de version en Seguimiento** (BACKLOG L69) ENTRA CON este bloque, no despues (ver paso 5).

## Adicion (b): el bump de version, sellado y verificable

- Subir la constante `engine_version` al valor que corresponda a esta re-sincronizacion.
- Sellarlo en cada diagnostico NUEVO junto al resto de la constelacion (`survey_version_id`, `model_version_id`,
  `rules_version`).
- **Verificable:** un test que emite un diagnostico nuevo y ASERTA el `engine_version` sellado (no una
  afirmacion a mano; un test que no envejece). Los fixtures golden del paso 1 se capturan bajo la version nueva.

## Adicion (c): orden de los diez puntos dentro del re-port

Coincido con la lectura de Santiago: las correcciones acotadas primero (calentamiento), la PABU al final. Orden
propuesto, de lo mas acotado a lo que mas cambia salidas, con el porque:

| # | Punto | Por que en esta posicion |
|---|---|---|
| 1 | Correccion cMMEM M<5.5 | Un umbral, un clasificador. Golden aislado trivial. Calentamiento. |
| 2 | Correccion FMI 3-6/5-9 + Delta 6/9 | Bandas de un clasificador + su display. Acotado. |
| 3 | Correccion SMM/W 22 | Un borde. Acotado. |
| 4 | R1-R9 -> E1-E9 (traduccion display) | No cambia el dato guardado; solo el render. Sin riesgo de valor. |
| 5 | ICEC bandera en false + comentario | Se queda en false: no cambia salida, solo se porta la guarda y el comentario. |
| 6 | Vocabulario de severidad DFI | Relabel de las severidades. Cambia rotulos, no numeros. |
| 7 | Radar de cuatro zonas | Quita "Excepcional"; la zona ya devolvia 1-4. Cambia display de zonas. |
| 8 | Objetivo calorico en 0 + retiro de los 5 deficits | Cambia salida de tratamiento (deficit -> 0). Acotado a esa cadena. |
| 9 | Salvaguarda TCA avisa-no-bloquea + habitos moderados optimo-medio | Cambian comportamiento del deficit y el scoring de moderados. Mas superficie. |
| 10 | §0 orden de derivacion (aguas sin grasa tras derivarFaltantes) + REF_POB | Cambia valores de composicion. Golden por el pipeline COMPLETO. |
| 11 | **PABU al Dominio 1** | Agrega un indicador clasificado al Dominio 1: mueve severidad y radar de ese dominio. LO QUE MAS CAMBIA SALIDAS, al final, con el resto ya estable. |

(Son 11 filas porque las tres correcciones se listan sueltas; los diez puntos del delta son 1 a 10 en la seccion
de arriba, y la PABU es el #1 de esa lista, portado el ultimo aqui por su impacto.)

## Trazabilidad a anotar durante el bloque

- La limitacion conocida del reparto AEC/ACT (LC-01, agua EC dependiente de la edad): comentario junto al
  codigo del umbral `_aecPct > 44` cuando se llegue a esa parte (consecuencia b de LC-01).
- cMMEM 5.5: anotar la unificacion EWGSOP2 (Gildardo pidio anotarlo; el corte quedo en nuestro archivo antes que
  en el suyo).

## Criterio de aceptacion del bloque

- Golden capturados del 18 verdes (paridad).
- `tsc --noEmit` 0, `pnpm lint` 0, `pnpm vitest run` verde (incluidos golden).
- Test que aserta el `engine_version` nuevo sellado.
- Medicion antes/despues corrida y su decision sobre el aviso de Seguimiento tomada.
- Estado del bloque actualizado en el mismo commit que lo cierra.
