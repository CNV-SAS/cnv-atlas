// ═══ LAS FORMAS EN QUE EL HTML GUARDA LO MISMO QUE ATLAS (barrido del 2026-09-23) ═══
//
// El patron alimentario no era un caso aislado: el HTML y Atlas guardan VARIOS datos en formas distintas, y
// copiarlos tal cual los pierde o, peor, los cambia. Este archivo reune las traducciones, con la linea del
// HTML que demuestra cada una, para que no queden repartidas por el importador.
//
// LA REGLA COMUN: lo que no se pueda traducir NO se inventa, se deja fuera o crudo, para que la revision lo
// marque. Un dato plausible y falso es peor que uno ausente, porque las guardas de ausencia no lo ven.

/**
 * El sexo. EL HTML GUARDA LA PALABRA ("Masculino"/"Femenino"), ATLAS LA LETRA ("M"/"F").
 *
 * Su modulo BIS lo reescribe asi al guardar cada consulta (v9 L7305 y L7340:
 * `sexo: pt.sexo === "M" ? "Masculino" : "Femenino"`); la conversion a letra es interna suya y no se
 * persiste. Los tres archivos reales lo confirman: el 100 % de las consultas trae la palabra.
 *
 * SIN ESTA TRADUCCION EL DAÑO ERA DOBLE. Ruidoso: el motor exige el sexo y ningun paciente importado podia
 * diagnosticarse. Y silencioso, que es el que importa: dos lectores que no pasan por el normalizador caen a
 * masculino cuando el sexo es nulo (`!(sex ?? "").startsWith("f")`), asi que UNA PACIENTE IMPORTADA SE
 * CLASIFICABA Y SE TRATABA COMO HOMBRE, sin que nada lo dijera.
 */
export function sexoDeAtlas(valor: unknown): "M" | "F" | null {
  const v = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (v === "m" || v.startsWith("masculino")) return "M";
  if (v === "f" || v.startsWith("femenino")) return "F";
  return null;
}

/**
 * El tipo de documento. EL HTML GUARDA LA ETIQUETA COMPLETA, ATLAS EL CODIGO (v9 L1288).
 *
 * Antes se comparaba en mayusculas contra los codigos, asi que "Cédula de ciudadanía" no calzaba y TODO
 * entraba como CC por defecto. Hoy acierta por casualidad (en la muestra real todos son cedula), pero un
 * pasaporte entraria como cedula con el mismo numero, y la llave unica del paciente es
 * (organizacion, tipo, numero): el dia que alguien lo cree con su tipo real, queda duplicado.
 *
 * "Otro" no tiene destino en Atlas y no se fuerza a ninguno: devuelve null y lo resuelve quien importa.
 */
const POR_ETIQUETA: Record<string, "CC" | "CE" | "TI" | "PA"> = {
  "cedula de ciudadania": "CC",
  "cedula de extranjeria": "CE",
  "tarjeta de identidad": "TI",
  pasaporte: "PA",
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function tipoDeDocumentoDeAtlas(valor: unknown): "CC" | "CE" | "TI" | "PA" | "NIT" | null {
  const bruto = typeof valor === "string" ? valor.trim() : "";
  if (!bruto) return null;
  const codigo = bruto.toUpperCase();
  if (["CC", "CE", "TI", "PA", "NIT"].includes(codigo)) return codigo as "CC" | "CE" | "TI" | "PA" | "NIT";
  return POR_ETIQUETA[sinTildes(bruto.toLowerCase())] ?? null;
}

/**
 * El texto libre de "Otra". EL HTML LO GUARDA EN UN CAMPO APARTE (`<clave>_otro`), ATLAS EN EL MISMO VALOR
 * con la convencion "Otra: <texto>", que es la que sus pantallas y sus lectores saben descomponer.
 *
 * Sin fusionarlos se guardaba "Otra" pelada y el texto desaparecia. En d5_39 (diagnosticos) eso pesa: es una
 * pregunta que alimenta el Factor de Estres Metabolico y el prompt del criterio, asi que un diagnostico
 * escrito a mano se perdia. En d6_43 (alergias) la restriccion no llegaba ni al profesional ni al menu.
 *
 * Cubre las cuatro flexiones ("Otra", "Otras", "Otro", "Otros"), como ya hacen los widgets de Atlas.
 */
const ES_OTRA = /^otr[oa]s?$/i;

export function conElTextoDeOtra(valor: string, textoLibre: unknown): string {
  if (!ES_OTRA.test(valor.trim())) return valor;
  const texto = typeof textoLibre === "string" ? textoLibre.trim() : "";
  return texto ? `${valor.trim()}: ${texto}` : valor;
}
