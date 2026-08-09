# Plan — lo que abre la respuesta de Gildardo (2026-08-09)

Ordenado por lo que MÁS cierra. Detalle de las respuestas en `entregas/gildardo-2026-08-09/`. **No construir aún; este es el mapa.**

## 1. La cadena calórica (C6 completo) — LO GRANDE, cierra media pantalla de Tratamiento

Es lo que más pesa: desbloquea el plan nutricional entero (fórmula, intercambios, menú), que estaba parado esperando C6. Ahora las cifras están firmadas. Piezas:

- **Re-portar el `motorTratNutri` corregido del v8** (frozen con DIFF, como los otros motores): incluye la corrección del `pausadoTCA` (la salvaguarda de TCA ahora ALERTA, no anula el cálculo) y el déficit desde el peso meta (no −500 fijo).
- **Cablear las cifras C6** (en D-002): Mifflin sobre PESO ACTUAL; déficit = (peso actual − peso meta); proteína g/kg por condición con la ERC mandando; energía/grasa/sodio/DM2; piso solo con déficit.
- **Condiciones derivadas de la COMPOSICIÓN**, no solo del diagnóstico (obesidad IMC≥30 o FMI>6/9; sarcopenia FFMI o ASMI; desnutrición IMC<18.5): un paciente sin diagnóstico activa el protocolo igual.
- **HACER VISIBLE EL DEFAULT DEL PESO META (defecto crítico, nota 3 de Gildardo).** El peso meta usa un default de Lorentz en silencio; como la proteína se calcula sobre él, la prescripción cambia sin que nadie lo note. Es la misma familia de defectos silenciosos que venimos cazando (import del BIS, toasts mudos, cliente→server-only). **Esta pieza va PRIMERO dentro del bloque**, incluso antes de las cifras: sin ella, el resto prescribe sobre un supuesto invisible. También: retirar `pesoAjust` (código muerto).
- **El plan alimentario detallado** (grupos de intercambio ICBF, DRI, validación ICN, distribución por tiempos, menú) — el display sobre la cadena. Es el grueso construible una vez firme la cadena.

Tamaño: GRANDE (frozen re-port + cifras + composición + el defecto del default + el plan alimentario). Slow-lane.

## 2. EA1 (derivación del Biody BIS) — continuar, cierra el uso con el equipo real

Ya está el checkpoint 1 (portadas las identidades + golden). Sigue el checkpoint 2 (cablearlas por composición faltante + icc/ict) y el gate honesto de las referencias. Novedades de la respuesta:
- **§3: Gildardo entrega la tabla `MCA_ref`/`hidSG_ref`** por sexo/edad. Cuando llegue, ISCM y las dos badges dejan de estar en null. Mientras tanto, **salidas VACÍAS, nunca degradadas** (confirma nuestro plan).
- **Mantener el mecanismo de la FOTO como segunda opción** (el proveedor corrigió el export, pero puede haber equipos sin espectroscopía). → el OCR/foto NO se descarta; queda como fallback (checkpoint posterior de EA1, no ahora).

## 3. El bloque de Encuesta + Diagnóstico (varios cierres del cotejo)

Ahora con las respuestas, se puede armar de una pasada (no tocar la encuesta dos veces):
- **§8 encuesta incompleta (D-007 Fase B):** CUALQUIER dominio faltante suspende las TRES salidas (todo-o-nada, sin mapa por dominio). El bioeléctrico se emite igual. Regla clara → construible.
- **§7 cirugías (`d6_qx`):** portar la pregunta que falta, SIN field_key (solo registro, no cambia cálculo).
- **§10 nomenclatura:** corregir en el registry IFC ("Función", no "Funcionalidad"), PABU ("de Uribe", no "Universal"), IEHH ("Estado", no "Espectro"). Como A10; requiere reseed dirigido (`db:check:cloud`/reseed).
- **Sociodemográficos (§12):** construir los 5 (educación/ocupación/estado civil/estrato/motivo); **etnia gateada** a ampliar el consentimiento (dato sensible; Gildardo confirma que la necesita el observatorio pero no se captura hasta lo legal).

## 4. Display: dos que rehacen/ajustan lo recién construido

- **§9 remisiones consolidadas por DESTINATARIO en el reporte** (una línea por profesión con el resumen, no ruta por ruta). **Rehace parte del display de D-009** que acabamos de construir. Es display, no toca el registro del acto (D-009 Parte A queda). Medio.
- **§6 la cita SÍ va al reporte del paciente** (cuando se comunica un empeoramiento, ve cuándo será revisado). Ajuste de display en el reporte. Chico.

## 5. El renombramiento (§15) — CUIDADO, toca datos sellados

Estructura → E1-E9; mapa FyR unificado → A1-A9; rutas siguen R1-R6. **Clave: los datos sellados NO se reescriben, se traducen AL MOSTRAR.** No es una migración de datos: es una **capa de traducción** sobre lo sellado (el snapshot guarda lo que guardó; la pantalla muestra la nomenclatura nueva). Merece cuidado (que ningún camino escriba la nomenclatura nueva en el registro, ni pierda la vieja) pero es acotado (display). Medio.

## Sin trabajo nuevo ahora
- **§13 ICEC/EB-BIS:** confirma nuestra lectura (μ/σ se recalculan con el mapeo; la bandera queda en false hasta las constantes). Sigue como está.
- **§16, §2, §11, §14:** sin acción nueva (P2 cerrado, severidad/IRC ya bien, alcohol/contaminantes solo caracterización).

## Recomendación de orden

**1) La cadena calórica** (lo grande; y su primera pieza, el default del peso meta visible, es un defecto silencioso que conviene cerrar ya). **2) Terminar EA1** (ya en curso, cierra el equipo real; la tabla de referencias de Gildardo lo remata). **3) El bloque Encuesta+Diagnóstico** (varios cierres del cotejo en una pasada). **4) Los dos de display** (§9 rehacer, §6 cita). **5) El renombramiento** (cuidado con lo sellado, pero display). Santiago decide el arranque; mi lectura es que la cadena calórica y EA1 son los dos que más cierran.
