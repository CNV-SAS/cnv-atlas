// Reglas PURAS del estado tributario del integrante (retencion). Modulo NEUTRO: sin server-only ni
// cliente, para que lo usen el formulario (validacion), la verificacion de CNV y el writer. Testeable sin
// BD ni navegador (por eso se construye primero: se verifica sola).

// Pesos del digito de verificacion del NIT colombiano (algoritmo DIAN), de derecha a izquierda.
const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

// Digito de verificacion de un NIT (0-9). null si no hay digitos o excede el rango de los pesos (>15).
export function computeNitDv(nit: string): number | null {
  const digits = nit.replace(/\D/g, "");
  if (!digits || digits.length > NIT_WEIGHTS.length) return null;
  const rev = digits.split("").reverse();
  let sum = 0;
  for (let i = 0; i < rev.length; i++) sum += Number(rev[i]) * NIT_WEIGHTS[i];
  const y = sum % 11;
  return y > 1 ? 11 - y : y;
}

// Validacion cruzada de lo que el integrante DECLARA (tipo de persona, RUT, documento, DV). Devuelve un
// mensaje de error o null. Ataca el combo imposible del smoke (juridica sin RUT) y verifica el DV del NIT.
export type TaxIdentityInput = {
  personType: "natural" | "juridica";
  hasRut: boolean;
  idType: string; // CC, CE, TI, PA, NIT
  idNumber: string;
  idDv: string | null;
};

export function validateTaxIdentity(i: TaxIdentityInput): string | null {
  if (i.personType === "juridica") {
    // Toda persona juridica en Colombia tiene NIT y RUT: el combo "juridica sin RUT" es imposible, y su
    // documento es un NIT (con digito de verificacion).
    if (!i.hasRut) {
      return "Una persona jurídica siempre tiene RUT y NIT. Revisa el tipo de persona o la respuesta del RUT.";
    }
    if (i.idType !== "NIT") return "Una persona jurídica se identifica con NIT.";
    const dv = computeNitDv(i.idNumber);
    if (dv === null) return "El NIT no es válido.";
    if (String(dv) !== String(i.idDv ?? "").trim()) {
      return `El dígito de verificación del NIT no coincide (debería ser ${dv}).`;
    }
  } else if (i.idType === "NIT") {
    // Natural no se identifica con NIT (es cedula o cedula de extranjeria).
    return "Una persona natural se identifica con cédula o cédula de extranjería, no con NIT.";
  }
  return null; // natural: sin DV; que tenga o no RUT lo declara el integrante (lo sabe)
}

// Vigencia del RUT (revision contable): si la fecha del documento es de hace mas de un año, se pide uno
// actualizado (el RUT cambia; una clasificacion vieja retiene mal y ante la DIAN responde CNV). Sin fecha
// (null) tambien pide actualizar: no hay como confiar en su vigencia. `now` se inyecta (testeable).
export function rutNeedsRenewal(documentDate: string | null, now: Date): boolean {
  if (!documentDate) return true;
  const d = new Date(documentDate);
  if (Number.isNaN(d.getTime())) return true;
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return d < oneYearAgo;
}

// El titular de la cuenta bancaria debe ser el integrante: se compara por DOCUMENTO, no por nombre
// (revision contable). Natural: su cedula; juridica: el NIT de la juridica (no el representante). El
// documento del titular debe coincidir con el del integrante.
export function bankHolderMatchesIntegrante(integranteIdNumber: string, holderDocument: string): boolean {
  const norm = (s: string) => s.replace(/\D/g, "");
  const a = norm(integranteIdNumber);
  return a.length > 0 && a === norm(holderDocument);
}
