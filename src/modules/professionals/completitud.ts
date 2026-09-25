// ═══ QUE LE FALTA AL PERFIL (2026-09-25) ═══
//
// MODULO PURO: recibe lo que hay y devuelve lo que falta. Existe aparte del indicador porque la lista de lo
// que falta es la parte util y la que hay que poder probar; el porcentaje es solo su forma corta.
//
// Y DEVUELVE LA LISTA, NO SOLO EL NUMERO, a proposito: un "60 %" sin decir de que no se puede accionar. La
// persona que lo ve tiene que poder saber, en el mismo sitio, que le falta por hacer.

export type DatosDeCompletitud = {
  // Tributaria
  personType: string | null;
  idNumber: string | null;
  rutUploaded: boolean;
  hasRut: boolean | null;
  rutVerified: boolean;
  // Bancaria
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolderDocument: string | null;
  // Identidad profesional
  license: string | null;
};

export type Completitud = {
  /** 0 a 100, redondeado. */
  porcentaje: number;
  /** Lo que falta, en palabras del integrante y en el orden en que conviene resolverlo. */
  faltantes: string[];
  /** Cuantos puntos de los que se miden estan resueltos, sobre el total. Para el rotulo "7 de 9". */
  resueltos: number;
  total: number;
};

export function completitudDelPerfil(d: DatosDeCompletitud): Completitud {
  // CADA PUNTO ES UNA COSA QUE ALGUIEN TIENE QUE HACER, no un campo de la tabla. Por eso el RUT cuenta como
  // un punto y su verificacion como otro: subirlo lo hace el integrante y verificarlo lo hace CNV, y mezclar
  // las dos le pediria al integrante algo que no depende de el.
  const puntos: { ok: boolean; falta: string }[] = [
    { ok: d.license != null && d.license.trim() !== "", falta: "Tu registro profesional (lo carga un administrador)" },
    { ok: d.personType != null, falta: "Si eres persona natural o jurídica" },
    { ok: d.idNumber != null, falta: "Tu documento de identidad" },
    { ok: d.hasRut != null, falta: "Decir si tienes RUT" },
    // El punto del RUT solo aplica a quien dice tener uno: a quien no lo tiene, exigirselo seria pedirle algo
    // imposible y dejarle el perfil incompleto para siempre.
    ...(d.hasRut === true
      ? [
          { ok: d.rutUploaded, falta: "Subir tu RUT en PDF" },
          { ok: d.rutVerified, falta: "La verificación de tu RUT (la hace CNV)" },
        ]
      : []),
    { ok: d.bankName != null, falta: "El banco de tu cuenta" },
    { ok: d.bankAccountNumber != null, falta: "El número de tu cuenta" },
    { ok: d.bankAccountHolderDocument != null, falta: "El documento del titular de la cuenta" },
  ];

  const resueltos = puntos.filter((p) => p.ok).length;
  return {
    porcentaje: Math.round((resueltos / puntos.length) * 100),
    faltantes: puntos.filter((p) => !p.ok).map((p) => p.falta),
    resueltos,
    total: puntos.length,
  };
}
