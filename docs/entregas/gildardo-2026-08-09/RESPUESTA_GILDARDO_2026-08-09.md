# Respuesta de Gildardo a las 17 del paquete — 2026-08-09

> **Procedencia.** Registro de la respuesta de Gildardo a `PAQUETE_GILDARDO_2026-08-08.md`, **según la relató Santiago el 2026-08-09**. El `.md` original de Gildardo NO estaba en `docs/entregas/gildardo-2026-08-09/` al escribir esto (carpeta vacía); cuando llegue, se agrega junto a este registro (o lo reemplaza). Aquí queda el contenido para no reconstruirlo de memoria.

## Dos decisiones FIRMADAS que Gildardo corrige (enmiendas a D-002)

- **(a) El gasto se calcula sobre el PESO ACTUAL, no sobre el de referencia.** D-002 decía "Mifflin sobre el peso de referencia"; el motor ya usa `pesoAct`. Criterio de Gildardo: "el gasto basal es una medición del cuerpo que existe HOY; lo que debe salir del peso meta es el DÉFICIT, no el gasto." → corregir D-002.
- **(b) La salvaguarda de TCA NO bloquea.** La teníamos como requisito duro ("la cadena no se da por construida sin ella") y como "déficit a cero + normocalórica + remitir". Gildardo: **eso está MAL.** La salvaguarda genera **ALERTA**, y el **peso meta acordado sigue gobernando el cálculo**. El `pausadoTCA` que anula el cálculo es lo que hay que corregir, y él ya lo corrigió en el v8. → era requisito duro, **ahora es alerta**.
- **Nomenclatura:** TCA = Trastorno de la Conducta Alimentaria, **sin relación con ICA-BIS** (carga alostática). (Verificado 2026-08-09: no los mezclamos en docs/código.)

## C6 — desbloqueado, cifras verbatim

**PROTEÍNA (g/kg, SOBRE EL PESO META):** sin condición 1.0 · cáncer o desnutrición 1.25 · obesidad 1.3 · obesidad con sarcopenia 1.4 · sarcopenia sola 1.4 · ERC 0.7 (rango 0.6-0.8). **PRECEDENCIA: la ERC MANDA sobre la proteína alta.** ERC + sarcopenia → 0.7, no 1.4.

**ENERGÍA:** cáncer o desnutrición → 27.5 kcal/kg de PESO ACTUAL. Resto → GET − déficit. **Piso SOLO cuando hay déficit:** 1500 (H) / 1200 (M). El arranque 10-15 kcal/kg por realimentación es **NOTA CLÍNICA para el profesional**, no un cálculo del motor.

**GRASA:** 25% en dislipidemia (y saturada < 7%); 30% en el resto.

**SODIO** (tres vías, gana la más restrictiva): HTA 1500 + DASH · ERC 2000 · alteración hídrica 2000 solo si no hay otro límite.

**DM2:** no cambia cifras; agrega CHO controlados y bajo índice glucémico.

**Las condiciones NO salen solo del diagnóstico: se derivan de la composición.** Obesidad = IMC ≥ 30 **O** FMI > 6 (H) / 9 (M). Sarcopenia = FFMI 17/15 **O** ASMI < 7.0/5.5. Desnutrición = IMC < 18.5. Un paciente sin diagnóstico registrado puede activar el protocolo igual.

**EL CAMBIO GRANDE:** el DÉFICIT sale del PESO META, no de un valor fijo por fenotipo. El motor hoy aplica −500 en obesidad; se reemplaza por (peso actual − peso meta). El fenotipo puede sugerir un inicial, pero el peso meta lo reemplaza en cuanto está fijado.

## DEFECTO que Gildardo detectó en su propio código (nota 3 del punto 1) — LO MÁS IMPORTANTE

- **El peso meta tiene un DEFAULT (fórmula de Lorentz), y si el profesional no lo fija, se usa SIN QUE NADIE LO NOTE.** Como la proteína se calcula sobre ese peso, **la prescripción cambia en silencio.** Instrucción: **hacer el default visible en pantalla.**
- **`pesoAjust` se calcula y NO se usa** → "o se usa o se retira; hoy es código muerto que confunde."
- El default de Lorentz **solo aplica cuando el IMC está fuera de 18.5-25**; si no, usa el peso actual.

## Las otras respuestas

- **§2 (P2) — CERRADO:** no hay manual de nutracéuticos por ruta pendiente. El motor que produce la recomendación por ruta ES la referencia vigente. Si algo no cuadra al portarlo, se lleva como caso concreto.
- **§3 (referencias `MCA_ref`/`hidSG_ref`):** entrega la tabla por sexo y edad. Mientras tanto, salidas **VACÍAS, nunca degradadas**. Son dos de las siete constantes no aprobadas.
- **§6 (cita en el reporte):** la fecha de la cita **SÍ va al reporte del paciente**. "Si se le comunica un empeoramiento, tiene que ver cuándo va a ser revisado."
- **§7 (cirugías):** solo registro clínico, **no modifican el cálculo**.
- **§8 (encuesta incompleta):** **CUALQUIER dominio faltante suspende las TRES salidas** (edad bioeléctrica + índice contextual + rutas). Nada de mapa por dominio. El bioeléctrico sí se emite.
- **§9 (remisiones):** se **consolidan por DESTINATARIO**. El reporte no repite ruta por ruta: **una línea por profesión** con el resumen de todo lo que se le remite. (Rehace parte del display de D-009.)
- **§10 (nombres):** IFC = Índice de **FUNCIÓN** Celular (no "Funcionalidad"). PABU = Proporción Áurea Bioeléctrica **DE URIBE** (teníamos "Universal"). IEHH = Índice del **ESTADO** de Hidratación Humana (no "Espectro"). ISCM e IRC como están.
- **§11 (severidad):** Leve/Moderado/Alto, manda el clasificador. El IRC lo tenemos bien.
- **§12 (etnia):** **SÍ es necesaria** para el observatorio, pero **NO se captura hasta ampliar el consentimiento**. Los otros cinco sociodemográficos son solo caracterización.
- **§13 (ICEC/EB-BIS):** confirma nuestra lectura: μ y σ se recalculan junto con el mapeo, y la bandera queda en false hasta tener las constantes nuevas.
- **§14 (alcohol y contaminantes):** solo caracterización.
- **§15 (renombramiento):** estructura pasa a **E1-E9**, el mapa FyR se unifica en **A1-A9**, las rutas siguen **R1-R6**. **LOS DATOS SELLADOS NO SE REESCRIBEN: se traducen AL MOSTRAR.**
- **§16:** mantiene su HTML al día.

## Nota del proveedor (relatada por Santiago)

El proveedor **corrigió el export del Biody BIS**: la espectroscopía SÍ viene (confirmado por Gildardo). Pero pide **MANTENER el mecanismo de la foto como segunda opción** por si algún equipo no la trae. → afecta el plan de EA1 (la captura por foto NO se descarta; queda como fallback).
