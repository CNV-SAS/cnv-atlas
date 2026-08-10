// Capa de INSTANCIA del consentimiento (B7, presentacion). La PLANTILLA (consent-v1.7.ts) es el
// documento CONGELADO sobre el que se calcula el hash y es lo que se firma; NO se toca aqui. La
// INSTANCIA es lo que el paciente VE y RECIBE: la misma plantilla con los placeholders del profesional
// rellenos, las rayas de firma con su nombre y documento, la fecha real, y SOLO la rama (mayor/menor)
// que aplica.
//
// Distincion que se registra donde se vea: PLANTILLA = lo que se firma e integridad (hash);
// INSTANCIA = lo que se ve y se entrega. Filtrar la rama SOLO esconde la rama que no aplica; nunca
// recorta contenido que el titular acepto.
//
// Reglas de esta capa (las tres pedidas en la revision de B7):
//  - Dato vacio => se OMITE su segmento (nunca un placeholder crudo ni una raya en blanco), igual que
//    la licencia. La pantalla pasa un texto "pendiente" (no vacio) para lo que aun no se escribio, asi
//    se muestra como pendiente en vez de omitirse.
//  - La fecha es el UNICO campo cuyo null es "pendiente" (siempre existira), no "omitir".
//  - Robustez: si un ancla no aparece (la plantilla cambio y no se corrio el golden), la funcion NO
//    revienta: devuelve la plantilla lo mas intacta posible (feo pero completo, nunca en blanco). El
//    golden (consent-instance.test.ts) es la red que atrapa el drift en CI, antes de produccion.
//
// El ACOPLAMIENTO a substrings exactos de la plantilla esta declarado y cubierto por el golden. El bump
// de v1.0 (renumeracion al lanzamiento) migrara a marcadores explicitos ({{firma_nombre}} y
// delimitadores de rama), que eliminan esta clase entera de fragilidad; registrado en BACKLOG.

export type ConsentInstanceData = {
  branch: "mayor" | "menor";
  patient: { name: string; document: string }; // en pantalla puede venir un texto "pendiente" (no vacio)
  professional: { fullName: string; profession: string; license: string | null };
  representative?: { name: string; document: string; relationship: string; email: string } | null;
  // applies=true SOLO para 14-17 (el asentimiento). Un menor de 14 tiene representante pero NO
  // asentimiento: applies=false y el bloque entero se quita (no queda un asentimiento vacio).
  assent?: { applies: boolean; minorName: string } | null;
  acceptedAt: number | null; // epoch-ms; null => fecha pendiente (pantalla, aun sin firmar)
};

const clean = (v: string | null | undefined): string => (v ?? "").trim();

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Fecha y hora legible en Colombia (America/Bogota), huso fijo del pais (no el del proceso).
function formatAcceptedAt(epochMs: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

// Rellena un campo de firma "- <label>: `____`". value vacio => OMITE la linea entera (regla de dato
// faltante). Anclado por la etiqueta + backtick-rayas-backtick (tolerante a la longitud de las rayas).
// Si el ancla no existe, no toca nada (robustez).
function fillOrDropField(text: string, label: string, value: string): string {
  const re = new RegExp(`- ${escapeRe(label)}: \`_+\`\\n`);
  if (!re.test(text)) return text;
  const v = clean(value);
  if (!v) return text.replace(re, ""); // vacio => se omite el segmento
  return text.replace(re, `- ${label}: \`${v}\`\n`);
}

// Quita un bloque desde startAnchor hasta el final de la LINEA que contiene endLineContains, mas la
// linea en blanco que le sigue. Anclas por substrings estables (nunca por las rayas, cuya longitud
// varia). Si algun ancla no aparece, devuelve el texto SIN cambios (robustez).
function dropBlock(text: string, startAnchor: string, endLineContains: string): string {
  const s = text.indexOf(startAnchor);
  if (s < 0) return text;
  const a = text.indexOf(endLineContains, s);
  if (a < 0) return text;
  let eol = text.indexOf("\n", a);
  if (eol < 0) eol = text.length;
  let end = eol;
  while (end < text.length && text[end] === "\n") end++;
  return text.slice(0, s) + text.slice(end);
}

// Bloque del profesional (numeral 2): reconstruye la linea con los segmentos que existen y quita la nota
// interna de auto-relleno. Dato vacio => se omite su segmento (nombre, profesion o registro).
function fillProfessionalBlock(text: string, prof: ConsentInstanceData["professional"]): string {
  const segs: string[] = [];
  if (clean(prof.fullName)) segs.push("`" + clean(prof.fullName) + "`");
  if (clean(prof.profession)) segs.push("`" + clean(prof.profession) + "`");
  if (clean(prof.license)) segs.push("Registro profesional No. `" + clean(prof.license) + "`");
  const line = "> **Profesional:** " + segs.join(" — ");
  // Reemplaza la linea del profesional Y la nota interna que la sigue (dos lineas) por la linea armada.
  const re = /> \*\*Profesional:\*\*[^\n]*\n> \*\(Este bloque se rellena[^\n]*\n/;
  if (!re.test(text)) return text;
  return text.replace(re, line + "\n");
}

function transform(template: string, data: ConsentInstanceData): string {
  let text = template;

  // 1. Bloque del profesional (numeral 2): rellenar + quitar la nota de auto-relleno.
  text = fillProfessionalBlock(text, data.professional);

  // 2. Filtro de rama en el numeral 11.
  if (data.branch === "mayor") {
    // Quita el bloque del menor entero, conservando la declaracion de mayoria (que va ANTES) y el
    // parrafo "ATLAS determina automaticamente..." (que va DESPUES).
    text = dropBlock(
      text,
      "**Si el paciente es menor de 18 años**",
      "- [ ] El menor (14 a 17 años) otorga su asentimiento en los términos anteriores.",
    );
  } else {
    // Menor: quita solo la declaracion de mayoria; conserva el bloque del representante.
    text = dropBlock(
      text,
      "**Si el paciente es mayor de 18 años**",
      'en nombre propio."',
    );
    // Menor de 14: representante SI, asentimiento NO. Quita el bloque de asentimiento entero.
    if (!data.assent?.applies) {
      text = dropBlock(
        text,
        "**Asentimiento del menor**",
        "- [ ] El menor (14 a 17 años) otorga su asentimiento en los términos anteriores.",
      );
    }
  }

  // 3. Filtro de rama en el numeral 13 (firma).
  if (data.branch === "mayor") {
    text = dropBlock(
      text,
      "**Si el paciente es menor de edad**, firma su representante",
      "- Número de documento del representante:",
    );
  } else {
    text = dropBlock(
      text,
      "**Si el paciente es mayor de edad**, firma el propio paciente",
      "- Número de documento:",
    );
  }

  // 4. Quita las instrucciones de autoria entre parentesis (scaffolding, no contenido del paciente).
  text = text
    .replace(" *(solo si el paciente es menor de edad; se completa antes de continuar)*", "")
    .replace(" *(obligatorio cuando el paciente tiene entre 14 y 17 años)*", "");

  // 5. Rellena las rayas de firma con los datos reales (o las omite si el dato falta).
  if (data.branch === "mayor") {
    text = fillOrDropField(text, "Nombre completo", data.patient.name);
    text = fillOrDropField(text, "Número de documento", data.patient.document);
  } else {
    const rep = data.representative ?? { name: "", document: "", relationship: "", email: "" };
    // Numeral 11: datos del representante.
    text = fillOrDropField(text, "Nombre completo", rep.name);
    text = fillOrDropField(text, "Tipo y número de documento", rep.document);
    text = fillOrDropField(text, "Parentesco o calidad", rep.relationship);
    text = fillOrDropField(text, "Correo electrónico", rep.email);
    // Numeral 13: firma del representante.
    text = fillOrDropField(text, "Nombre completo del representante", rep.name);
    text = fillOrDropField(text, "Número de documento del representante", rep.document);
    // Asentimiento (14-17): rellena el nombre del menor en la cita y marca la casilla.
    if (data.assent?.applies) {
      const minor = clean(data.assent.minorName) || "el/la menor evaluado/a";
      text = text.replace(/> "Yo, `_+`, he sido/, `> "Yo, \`${minor}\`, he sido`);
      text = text.replace(
        "- [ ] El menor (14 a 17 años)",
        "- [x] El menor (14 a 17 años)",
      );
    }
  }

  // 6. Fecha (numeral 13): quita la nota interna y pone la fecha real, o "pendiente" en pantalla.
  text = text.replace(" *(generada automáticamente por ATLAS)*", "");
  const fecha =
    data.acceptedAt != null ? formatAcceptedAt(data.acceptedAt) : "(se generará al confirmar)";
  text = text.replace(/\*\*Fecha:\*\* `_+`/, `**Fecha:** \`${fecha}\``);

  return text;
}

// Construye la INSTANCIA personalizada del consentimiento a partir de la plantilla congelada. Nunca
// muta la plantilla (opera sobre una copia) ni revienta: ante cualquier fallo, devuelve la plantilla.
export function buildConsentInstance(template: string, data: ConsentInstanceData): string {
  try {
    return transform(template, data);
  } catch {
    return template; // robustez: peor caso, la plantilla cruda (feo pero completo, nunca en blanco)
  }
}
