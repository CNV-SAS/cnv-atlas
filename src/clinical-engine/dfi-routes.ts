// Mapeo ruta -> origen (BIS vs encuesta), para la SUSPENSION por encuesta incompleta (Q28, decision de
// Gildardo: con encuesta incompleta se emite el diagnostico bioelectrico pero se suspenden las salidas
// que dependen de la encuesta). Verificado contra la ciencia congelada `frozen/engine.dfi.js:195-200`:
//   R1 · Restauracion Celular      <- dom1 (IFC/IRC/IEHH)         -> BIS
//   R2 · Reduccion Cardiometabolica<- dom2 (ISCM/fenotipo/FMI/FFMI)-> BIS
//   R3 · Conductual                <- dom4 (percepcion)            -> encuesta
//   R4 · Desaceleracion Envejec.   <- dom3 (EB-BIS/IAE via ICEC)   -> encuesta
//   R5 · Contextual                <- dom5 (ICEC/famHx/contexto)   -> encuesta
//   R6 · Mantenimiento             <- "no hace falta ruta"         -> requiere encuesta completa
// Con encuesta incompleta se conservan R1/R2 (salen de la medicion, validos) y se suspenden R3/R4/R5/R6.
// Esto NO toca el frozen: es la capa que CONSUME la que suspende (Gildardo decide QUE, la glue el COMO).

export const BIS_DERIVED_ROUTE_CODES = ["R1", "R2"] as const;

// Una ruta es BIS-derivada si su codigo (prefijo "Rn") esta en la lista. Las rutas vienen como
// "R1 · Restauracion Celular"; se matchea por el codigo al inicio, con separador (espacio o ·) para no
// confundir R1 con un hipotetico R10.
export function isBisDerivedRoute(ruta: string): boolean {
  return BIS_DERIVED_ROUTE_CODES.some((c) => ruta === c || ruta.startsWith(`${c} `) || ruta.startsWith(`${c}·`));
}

// Filtra las rutas dejando solo las BIS-derivadas. Idempotente: aplicarla a una lista ya filtrada no
// cambia nada (por eso sirve tambien como gate de render sobre snapshots viejos ya sellados incompletos).
export function suspendSurveyRoutes(rutas: string[]): string[] {
  return rutas.filter(isBisDerivedRoute);
}
