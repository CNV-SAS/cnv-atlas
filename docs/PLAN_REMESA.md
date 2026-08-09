# Plan — Remesa / consignación CNV → integrante (E2, primer eslabón)

**Modelo (recordatorio, no se replantea).** El producto es de CNV, en la vitrina del integrante (consignación). La **remesa** es CNV declarando que envió; la **recepción** es el integrante confirmando que llegó. Una recepción sin remesa que la respalde es una **discrepancia** (mismo patrón que `superseded_at` sin su fila de corrección). El tipo `remesa` ya está reservado en el enum de movimientos, con el comentario que describe justo esto (`enums.ts:150-155`).

## Modelo de datos (usa lo reservado, no inventa)

- **Remesa = un movimiento `type='remesa'`** en `nutraceutical_stock_movements`: `professional_id` = integrante destino, `nutraceutical_id`, `delta` = cantidad declarada, `lote`, `created_by` = quien la declara (CNV). **NO mueve el saldo del integrante** (el trigger del saldo ya debe excluir `remesa`; hay que confirmarlo/ajustarlo). Es la declaración.
- **Recepción = el movimiento `type='recepcion'` (+N) que ya existe**, más una **columna nueva `remesa_id`** (FK auto-referencial nullable a la fila `remesa`). Es lo que SÍ mueve el saldo. `remesa_id` lleno = respaldada; **`remesa_id` NULL = recepción NO respaldada = discrepancia visible.**
- Ninguna tabla nueva: es una **columna** (`remesa_id`) + un ajuste al trigger del saldo + RLS. La maquinaria inmutable (append-only) ya está.

## Las cuatro preguntas

**a) ¿Quién declara la remesa? → Operaciones (soporte) + admin. NO el integrante.**
Declarar un envío es un acto de LOGÍSTICA de CNV, no de gobierno. "Operaciones" (el rol soporte) es literalmente el rol operativo, y ya VE el inventario por RLS (0040: `admin OR soporte OR dueño`). Admin también (alcance amplio). El integrante NO declara: él recibe. Espeja el modelo: recepción = receptor (integrante); remesa = emisor (CNV = Operaciones/admin). Se agrega una policy `can-declarar-remesa` = `has_role('soporte') OR has_role('admin')`.

**b) ¿Qué pasa con las recepciones que YA existen (del smoke, sin remesa)? → Se grandfatherean (históricas), NO se marcan como discrepancia.**
Fueron legítimas bajo el modelo viejo (no había remesa que exigir). Marcarlas retroactivamente como discrepancias sería ruido. **La lógica de "no respaldada" mira HACIA ADELANTE:** solo una recepción creada DESPUÉS de que exista el mecanismo puede ser discrepancia. Implementación: un corte por fecha (el lanzamiento del mecanismo / el `created_at` de la migración); las recepciones anteriores con `remesa_id NULL` se leen como "histórica (pre-remesa)", no como discrepancia. Cero backfill destructivo.

**c) ¿La recepción sigue libre, o ahora exige remesa? → SIGUE LIBRE, pero se marca "no respaldada" y visible para CNV. Coincido con tu lectura.**
Argumento: exigir remesa para recibir TRABARÍA a un integrante real que recibe producto que CNV no declaró (o declaró tarde). Bloquear la realidad física (el producto llegó) para imponer un orden de papeleo es al revés: el producto es real, el saldo tiene que reflejarlo. Y el hueco que se quería cerrar (una recepción libre tapa un faltante) **NO se cierra bloqueando, se cierra HACIÉNDOLO VISIBLE:** si toda recepción no respaldada se marca y se le muestra a CNV, una recepción-para-tapar-un-faltante ya no tapa nada, salta como "no respaldada" y CNV la investiga. Es la filosofía del inventario negativo (se permite, se avisa, no se oculta) y el patrón de `superseded_at` sin fila de corrección (el estado existe, marcado como discrepancia a resolver).

**d) ¿Y si remesa y recepción no coinciden (CNV manda 10, el integrante confirma 8)? → SEPARADO, va DESPUÉS. Agranda el bloque.**
Es una discrepancia de TRANSPORTE, y sí encaja como un CASO, reusando la maquinaria del faltante (casos + transiciones + cargo). Pero tiene una pregunta que el faltante no tiene: **¿quién responde por las 2 que se perdieron en tránsito?** El transportista de CNV, o el integrante. Esa es una decisión de negocio/responsabilidad, no de código. Meterla ahora **~duplicaría el bloque** (un tipo de caso nuevo + clasificación + reglas de cargo + la decisión de responsabilidad). **Recomendación: fase 2.** El núcleo (a/b/c) ya entrega el valor (cierra el hueco de la recepción no respaldada y habilita el lado de inventario de la liquidación); el caso de descuadre entra después, reusando el patrón de faltante, cuando esté decidida la regla de responsabilidad.

## Tamaño

- **Núcleo (a/b/c): bloque MEDIANO.** Migración (columna `remesa_id` + ajuste del trigger del saldo para excluir `remesa` + RLS: Operaciones/admin declara remesa, el integrante inserta recepción ligada a una remesa dirigida a él) · dominio (declarar remesa, confirmar recepción con o sin remesa) · lectores (CNV: remesas pendientes + recepciones no respaldadas; integrante: remesas dirigidas a él para confirmar) · UI (superficie CNV para declarar; el form de recepción del integrante gana un selector "¿de qué remesa?" o "sin remesa" → marca no respaldada) · policy `can-declarar-remesa`. Slow-lane (toca esquema): plan + diff + checkpoints.
- **Descuadre (d): bloque APARTE, tamaño similar al del faltante.** Duplicaría el total si entra ahora. Difiere; necesita antes la regla de responsabilidad (transporte).

## Orden de construcción del núcleo (checkpoints)

1. Migración: `remesa_id` + trigger del saldo (excluir `remesa`) + RLS. (Verificar el trigger actual del saldo: confirmar que ya ignora `remesa` o ajustarlo.)
2. Dominio + policy: declarar remesa (Operaciones/admin), confirmar recepción (integrante) con vínculo opcional.
3. Lectores: pendientes + no respaldadas (CNV), remesas por confirmar (integrante).
4. UI: superficie de declaración (CNV) + selector de remesa en la recepción + señal "no respaldada".
5. Aceptación: declarar → confirmar respaldada (saldo sube, remesa deja de estar pendiente); recibir sin remesa → saldo sube + marca visible; recepción histórica no se marca.
