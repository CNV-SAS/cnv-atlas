import { pgEnum } from "drizzle-orm/pg-core";

// Enums centrales como tipos PostgreSQL (DATABASE.md, seccion Enums).
// Los valores se portan tal cual del documento; no se traducen ni se reordenan.

export const appRole = pgEnum("app_role", [
  "admin",
  "direccion",
  "soporte",
  "obbia",
  "professional",
]);

export const documentType = pgEnum("document_type", ["CC", "CE", "TI", "PA", "NIT"]);

// Tipos de documento que un Integrante firma (gestion documental por profesional).
// Hoy solo se usa 'anexo3' (precondicion del Nivel b); los demas se anexan al final
// con ALTER TYPE ADD VALUE cuando llegue el sistema documental completo, sin recrear
// el tipo. Futuros: 'contrato_marco', 'anexo4', etc.
export const professionalDocumentType = pgEnum("professional_document_type", ["anexo3"]);

// Profesion clinica del profesional (T2 A1). Lista cerrada que reemplaza el antiguo texto
// libre professional_profiles.specialty. Las claves son coherentes con el substring-match de
// efrProf en el motor congelado (engine.core.js:807): "med" -> medico, "psic" -> psicologo,
// "deport" -> deportologo, y el resto (nutricionista) cae al else. Gobierna el abordaje por
// profesion del diagnostico y que subpestana ve el profesional en Tratamiento.
export const professionalProfession = pgEnum("professional_profession", [
  "medico",
  "psicologo",
  "deportologo",
  "nutricionista",
]);

// Procedencia de un valor crudo BIS (EA1). El export corto del Biody no trae toda la composicion;
// las identidades congeladas de Gildardo (clinical-engine/frozen/derivar-composicion.js) la
// reconstruyen a partir de lo que si viene. 'derivado' marca lo reconstruido para que el profesional
// lo distinga de lo MEDIDO por el equipo: un valor derivado NUNCA se muestra como si fuera medido, y
// un valor medido JAMAS se sobrescribe (la derivacion solo rellena huecos).
export const bisValueOrigin = pgEnum("bis_value_origin", ["medido", "derivado"]);

export const patientStatus = pgEnum("patient_status", ["active", "inactive"]);

export const profileStatus = pgEnum("profile_status", ["active", "inactive"]);

export const evaluationType = pgEnum("evaluation_type", ["inicial", "seguimiento"]);

export const evaluationStatus = pgEnum("evaluation_status", [
  "draft",
  "in_progress",
  "completed",
]);

export const fieldDataClass = pgEnum("field_data_class", [
  "identifier",
  "quasi_identifier",
  "clinical",
]);

export const indicatorClassification = pgEnum("indicator_classification", [
  "normal",
  "riesgo",
  "critico",
]);

export const modelStatus = pgEnum("model_status", ["draft", "active", "retired"]);

export const deviceStatus = pgEnum("device_status", [
  "available",
  "in_use",
  "maintenance",
  "out_of_service",
  "lost",
  "retired",
]);

export const assignmentStatus = pgEnum("assignment_status", [
  "active",
  "completed",
  "breach",
]);

export const reportStatus = pgEnum("report_status", ["draft", "approved", "sent"]);

// Estado de aprobacion del protocolo de tratamiento (T2 A2). draft: en construccion, el
// set efectivo se recomputa libre; approved: el profesional prescribio, se sella
// protocol_approved y se congela por trigger. ESTE ENUM NO CRECE con el flujo de correccion:
// el diseno landeo distinto (ver docs/PLAN_FLUJO_CORRECCION.md). La vigencia NO vive por
// entidad ni como estado del tratamiento; vive en la EVALUACION (evaluations.superseded_at,
// el hub del que cuelga todo) y la relacion old->new vive UNA vez en clinical_corrections.
// diagnoses/treatments/reports heredan vigencia por el FK a la evaluacion; no ganan ni puntero
// ni estado. Corregir un protocolo = corregir la evaluacion -> version nueva de toda la cadena.
export const treatmentStatus = pgEnum("treatment_status", ["draft", "approved"]);

// Disparador de una correccion post-diagnostico (flujo de correccion, gate del Hito 1). El
// mecanismo de sucesion es agnostico al disparador (ver PLAN_FLUJO_CORRECCION.md (g)):
// correccion_profesional = el profesional corrige un dato mal digitado (hubo un fallo);
// completar_profesional = el profesional agrega una respuesta que faltaba, tipico cuando el paciente
//   dejo la encuesta a medias y se termina en consulta (la consulta siguio su curso, no hubo fallo);
// recalibracion_ciencia = la reemision poblacional que preve Gildardo (misma maquinaria, otro
// disparador). Corregir y completar son actos CLINICAMENTE distintos: al auditar la cadena de
// versiones de un paciente hay que poder distinguir "aqui hubo errores" de "aqui la encuesta se
// completo en varias consultas". El servicio DERIVA cual de los dos (correccion/completar) segun si
// el cambio toca una respuesta existente o agrega una que faltaba. Extensible.
export const correctionTriggerType = pgEnum("correction_trigger_type", [
  "correccion_profesional",
  "recalibracion_ciencia",
  "completar_profesional",
]);

export const transactionStatus = pgEnum("transaction_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const aiSuggestionStatus = pgEnum("ai_suggestion_status", [
  "success",
  "timeout",
  "parse_failed",
  "provider_error",
]);

export const consentType = pgEnum("consent_type_enum", [
  "servicio",
  "datos_sensibles",
  "internacional_ia",
  "investigacion",
  "comunicaciones_continuidad",
  "comunicaciones_comerciales",
  // Menores de edad (DELTA2 A1). Se anexan al final para que Postgres emita
  // ALTER TYPE ADD VALUE y no recree el tipo (destructivo por las FK/columnas).
  "representante_legal",
  "asentimiento_menor",
  // Firma electronica (B7, dictamen 2026-08-09): aceptacion EXPRESA del titular de que su
  // consentimiento se otorga por medios electronicos (numeral 12 casilla necesaria de v1.7). Se anexa
  // al final (ALTER TYPE ADD VALUE). Es una autorizacion NECESARIA nueva, distinta de informar la
  // validez: la valida el paciente, no CNV. Su base es el texto v1.7 (aun no efectivo; ver PLAN_B7_FIRMA).
  "aceptacion_medio_electronico",
]);

// Auditoria/control de calidad: mecanismo unico de permisos temporales (grants)
// para acceder a las notas narrativas. grant_type distingue el nivel de acceso;
// status es el ciclo de vida (la expiracion NO es un estado: se evalua por
// expires_at). reason_category separa la finalidad, ambas cubiertas por el
// numeral 4 del Consentimiento de ATLAS v1.6 (autorizacion del titular) y las
// Clausulas 3 y 17 del Anexo 3 v1.0 (instruccion del Responsable y auditoria).
export const accessGrantType = pgEnum("access_grant_type", [
  "notes_pseudonymous", // Nivel (b): narrativa seudonimizada, sin identidad
  "notes_identified", // Nivel (c): identificado, por paciente puntual
]);

// Disponibilidad COMERCIAL del nutraceutico (dato del PRODUCTO, no del stock). Distinto de
// nutraceutical_inventory.stock_quantity (cantidad): un producto puede ser en_consultorio con stock 0.
export const nutraceuticalAvailability = pgEnum("nutraceutical_availability", [
  "en_consultorio", // el nutricionista lo tiene fisico para entregar
  "solo_tienda", // solo se compra en la tienda de CNV (el paciente lo adquiere online)
  "no_disponible", // aun no disponible (para el futuro)
]);

// Tipo de movimiento de inventario en CONSIGNACION (el producto es de CNV, en custodia del integrante).
// El saldo es la suma de los deltas; cada movimiento es inmutable (trigger). remesa queda RESERVADA
// para cuando exista el eslabon CNV->integrante (hoy no existe): entonces una recepcion sin remesa que
// la respalde sera una discrepancia (misma logica que superseded_at sin su fila de correccion).
export const nutraceuticalMovementType = pgEnum("nutraceutical_movement_type", [
  "remesa", // CNV envia al integrante (RESERVADO, sin eslabon aun; no mueve el saldo del integrante)
  "recepcion", // el integrante reconoce que recibio en custodia (+)
  "despacho", // el integrante entrega a un paciente, ligado al tratamiento (-)
  "conciliacion", // ajuste tras conteo fisico (+/-)
  "devolucion", // el integrante devuelve a CNV (-)
]);

// Estado del CASO de faltante (T3b-3). El faltante NO es un ajuste: es un caso con estados y consecuencia
// economica. El estado es un CACHE proyectado desde la ultima transicion (append-only, como los
// movimientos); no se escribe directo. Flujo: reportado -> en_revision (integrante justifica) ->
// justificado / venta_no_registrada (cierres sin cargo) o injustificado_pendiente (admin propone) ->
// injustificado (SOLO tras confirmar direccion; ahi se materializa el cargo). "Atlas no cobra automatico"
// se extiende a "ni un solo administrativo cobra solo": el cargo exige dos personas.
export const nutraceuticalFaltanteStatus = pgEnum("nutraceutical_faltante_status", [
  "reportado", // detectado en el conteo; corre la ventana de justificacion (5 dias habiles)
  "en_revision", // el integrante envio categoria + referencia; espera clasificacion de CNV
  "justificado", // CNV acepto la justificacion; SIN cargo
  "venta_no_registrada", // cierre por "salio por una venta"; SIN cargo, rotulo de DOS HECHOS (falta registrar la venta)
  "injustificado_pendiente", // admin propone injustificado; espera CONFIRMACION de direccion
  "injustificado", // direccion confirmo; se materializa el cargo (pendiente de liquidacion)
]);

// Categoria de justificacion que ENVIA el integrante. Cada una exige referencia (no basta afirmar la
// perdida): numero de denuncia, guia de transporte, o el id del movimiento de correccion en Atlas.
export const nutraceuticalFaltanteJustification = pgEnum("nutraceutical_faltante_justification", [
  "hurto_denuncia", // hurto/robo con denuncia ante autoridad
  "transporte_documentado", // dano/perdida en transporte documentado
  "venta_no_registrada", // una venta hecha y no registrada (se corrige en Atlas)
  "devolucion_guia", // devolucion a CNV con guia de transporte
]);

// Estado del cargo economico del caso. Se materializa (pendiente_liquidacion) SOLO al confirmar
// injustificado. liquidado queda para el bloque de Liquidacion (futuro).
export const nutraceuticalFaltanteCharge = pgEnum("nutraceutical_faltante_charge", [
  "sin_cargo",
  "pendiente_liquidacion",
  "liquidado", // RESERVADO: lo cierra el bloque de Liquidacion
]);

export const accessGrantStatus = pgEnum("access_grant_status", [
  "pending",
  "approved",
  "denied",
  "revoked",
]);

export const accessReasonCategory = pgEnum("access_reason_category", [
  "auditoria_calidad",
  "soporte_tecnico",
]);

// Condiciones de la toma BIS (Parte 2 de captura, pestana Evaluacion).
// scope separa el bloque general del femenino; kind gobierna el efecto de la respuesta.
export const bisConditionScope = pgEnum("bis_condition_scope", ["general", "mujeres"]);

// Cuatro tipos (gobiernan el EFECTO de la respuesta; el sellado del caveat de validez es aparte,
// data-driven via compromises_validity):
//   - calidad: informativa (cafe, bano, ejercicio...). No bloquea.
//   - contraindicacion: bloqueo DURO del import. Solo el marcapasos. Riesgo fisico (la
//     corriente puede danar el dispositivo); nunca se hace la medicion.
//   - advertencia: NO bloquea, pero muestra una alerta seria y exige reconocimiento del
//     profesional. El embarazo (permiso del comite de etica). La medicion procede.
//   - validez: la medicion es SEGURA para el paciente pero el RESULTADO no es confiable (el
//     modelo no esta validado, o los fluidos estan distorsionados). NO bloquea ni exige
//     reconocimiento; Gildardo permite medir "con la reserva correspondiente". Amputacion,
//     edema/anasarca, estado febril/deshidratacion.
export const bisConditionKind = pgEnum("bis_condition_kind", [
  "calidad",
  "contraindicacion",
  "advertencia",
  "validez",
]);

// Como se captura una respuesta (o su detalle) de una condicion BIS. El modelo NO es
// solo booleano: la semana del ciclo es un numero directo (sin Si/No), el diuretico pide
// texto libre ("¿cual?") y varios detalles son numericos (dia del periodo, mes de gestacion).
//   - boolean: Si/No (la mayoria de las condiciones).
//   - number: numerico directo (semana del ciclo 1-6; o detalles como dia/mes).
//   - text: texto libre (el "¿cual?" del diuretico).
export const bisConditionFieldType = pgEnum("bis_condition_field_type", [
  "boolean",
  "number",
  "text",
]);

// Destinatario de una remision (D-009). Estructurado con las CUATRO profesiones del modelo + "otro"
// con texto libre, para poder CONTAR a quien se remite (texto libre puro no se cuenta) sin perder las
// especialidades fuera de las cuatro (endocrino, psiquiatria, fisioterapia) que van en "otro".
export const referralTarget = pgEnum("referral_target", [
  "medico",
  "psicologo",
  "deportologo",
  "nutricionista",
  "otro",
]);
