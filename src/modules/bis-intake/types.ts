// Tipos de la captura de condiciones de la toma BIS (Parte 2 de la pestana Evaluacion).
// El catalogo es versionado (tabla bis_conditions); cada captura sella la version que respondio.

export type BisFieldType = "boolean" | "number" | "text";
export type BisConditionScope = "general" | "mujeres";
export type BisConditionKind = "calidad" | "contraindicacion" | "advertencia";

// Una condicion del catalogo activo (fila de bis_conditions).
export type BisCondition = {
  key: string;
  label: string;
  scope: BisConditionScope;
  kind: BisConditionKind;
  inputType: BisFieldType;
  requiresDetail: boolean;
  detailLabel: string | null;
  detailType: BisFieldType | null;
  orderIndex: number;
};

// El catalogo activo = version + sus condiciones (ordenadas por order_index).
export type BisConditionCatalog = {
  versionId: string;
  versionNumber: number;
  conditions: BisCondition[];
};

// Respuesta sellada a una condicion. value segun input_type (booleano o numero); detail
// opcional (texto o numero); acknowledgedAt sella el reconocimiento del profesional para las
// advertencias (embarazo). Es la forma que vive en el JSONB condition_answers.
export type BisConditionAnswer = {
  value: boolean | number;
  detail?: string | number;
  acknowledgedAt?: string; // ISO; solo advertencias reconocidas
};

export type BisConditionAnswers = Record<string, BisConditionAnswer>;

// Captura ya persistida (lectura para la UI y para el gate del import).
export type BisIntakeRecord = {
  versionId: string;
  answers: BisConditionAnswers;
  contraindicated: boolean;
  gripStrengthKg: number | null;
  weightGoalKg: number | null;
  updatedAt: string;
};
