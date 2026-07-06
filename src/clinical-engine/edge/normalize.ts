// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZACIÓN DE BORDE — convierte valores crudos (encuesta o Biody) al
// contrato canónico que el motor congelado entiende. Falla en voz alta.
//
// PORQUÉ EXISTE: el motor clasifica por sexo con `sexo === 'M' || 'Masculino'`.
// El export real del Biody trae Género = "Male". Sin esta capa, "Male" cae
// silenciosamente a la rama femenina/por-defecto → cortes equivocados →
// fenotipo, ruta y nutracéutico equivocados. Este es el bug que causa el caos.
// ─────────────────────────────────────────────────────────────────────────────

export type SexoCanonico = 'M' | 'F';

const SEXO_MAP: Record<string, SexoCanonico> = {
  m: 'M', masculino: 'M', male: 'M', hombre: 'M', h: 'M', man: 'M', varon: 'M', 'varón': 'M',
  f: 'F', femenino: 'F', female: 'F', mujer: 'F', w: 'F', woman: 'F',
};

/** Devuelve 'M' | 'F' o LANZA. Nunca adivina ni cae a un default silencioso. */
export function normalizeSexo(raw: unknown): SexoCanonico {
  if (raw == null || raw === '') {
    throw new ClinicalInputError('SEXO_AUSENTE', 'El sexo es obligatorio para clasificar por cortes; ningún índice puede calcularse sin él.');
  }
  const key = String(raw).trim().toLowerCase();
  const s = SEXO_MAP[key];
  if (!s) {
    throw new ClinicalInputError('SEXO_DESCONOCIDO', `Valor de sexo no reconocido: ${JSON.stringify(raw)}. Esperado M/F/Masculino/Femenino/Male/Female.`);
  }
  return s;
}

/** Número seguro: coincide con nv() del prototipo (parseFloat, null si NaN). */
export function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

/** Fecha Biody 'DD-MM-YYYY HH:MM' → ISO 'YYYY-MM-DD'. El Biody NO usa formato US. */
export function parseBiodyDate(raw: unknown): string | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export class ClinicalInputError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ClinicalInputError';
    this.code = code;
  }
}
