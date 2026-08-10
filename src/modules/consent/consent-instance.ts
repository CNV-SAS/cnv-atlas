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
  // Solo PANTALLA: en la rama menor, antes de que se escriban los datos del representante, en vez de
  // omitir los campos vacios (dejando un encabezado "Datos del representante legal:" huerfano) se muestra
  // esta linea (markdown, p. ej. cursiva). En la COPIA no se pasa: alli los datos siempre existen.
  representativePending?: string;
  // Ids de las autorizaciones del numeral 12 efectivamente marcadas (incluye
  // aceptacion_medio_electronico). Las marcadas van [x] y las NO marcadas quedan [ ]: la distincion
  // "no marco" vs "no se sabe" importa (las no marcadas prueban que las opcionales se ofrecieron).
  granted: readonly string[];
  acceptedAt: number | null; // epoch-ms; null => fecha pendiente (pantalla, aun sin firmar)
};

// Casillas del numeral 12: id de autorizacion -> ancla unica de su linea.
const AUTH_CHECKBOXES: { id: string; anchor: string }[] = [
  { id: "servicio", anchor: "Autorizo el tratamiento de mis datos personales para las finalidades necesarias" },
  { id: "datos_sensibles", anchor: "Autorizo el tratamiento de mis datos sensibles de salud" },
  { id: "internacional_ia", anchor: "He sido informado/a del tratamiento internacional" },
  { id: "aceptacion_medio_electronico", anchor: "Acepto que este consentimiento se otorga por medios electrónicos" },
  { id: "investigacion", anchor: "Autorizo el uso de mis datos seudonimizados para investigación" },
  { id: "comunicaciones_continuidad", anchor: "Autorizo recibir comunicaciones de continuidad" },
  { id: "comunicaciones_comerciales", anchor: "Autorizo recibir comunicaciones comerciales" },
];

// Parentesco: valor del formulario -> etiqueta del campo + casilla a marcar en la declaracion del
// representante (numeral 11). Refleja la lista de RELATIONSHIPS del formulario de intake.
const RELATIONSHIP: Record<string, { label: string; box: string }> = {
  padre: { label: "Padre", box: "padre" },
  madre: { label: "Madre", box: "madre" },
  tutor: { label: "Tutor legal", box: "tutor legal" },
  curador: { label: "Curador", box: "curador" },
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
// interna de auto-relleno. Dato vacio => se omite su segmento (nombre, profesion o registro). Sin guion
// largo (se lee mal en pantallas angostas): nombre y profesion con coma, el registro como frase aparte.
function fillProfessionalBlock(text: string, prof: ConsentInstanceData["professional"]): string {
  const name = clean(prof.fullName);
  const profession = clean(prof.profession);
  const license = clean(prof.license);
  const nameProf = [name, profession].filter(Boolean).join(", ");
  let line = "> **Profesional:** " + nameProf;
  if (license) line += `${nameProf ? ". " : ""}Registro profesional No. ${license}`;
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

  // 4b. Numeral 12: marca [x] las autorizaciones otorgadas; las no otorgadas quedan [ ] (la copia dice
  // "el texto integro que aceptaste"; con todo en blanco no probaria lo que autorizo, y las no marcadas
  // prueban que las opcionales se ofrecieron y se declinaron).
  const grantedSet = new Set(data.granted);
  for (const c of AUTH_CHECKBOXES) {
    if (grantedSet.has(c.id)) text = text.replace(`- [ ] ${c.anchor}`, `- [x] ${c.anchor}`);
  }

  // 5. Rellena las rayas de firma con los datos reales (o las omite si el dato falta).
  if (data.branch === "mayor") {
    text = fillOrDropField(text, "Nombre completo", data.patient.name);
    text = fillOrDropField(text, "Número de documento", data.patient.document);
  } else {
    const rep = data.representative ?? { name: "", document: "", relationship: "", email: "" };
    const repEmpty =
      !clean(rep.name) && !clean(rep.document) && !clean(rep.relationship) && !clean(rep.email);
    if (repEmpty && data.representativePending) {
      // Pantalla, antes de escribir los datos: una sola linea pendiente (no per-campo, para no repetir
      // el mensaje) en vez de un encabezado huerfano. Colapsa los 4 campos del numeral 11 y los 2 de la
      // firma del numeral 13. Se resuelve reactivo en cuanto se escribe algo (repEmpty pasa a false).
      text = text.replace(
        /- Nombre completo: `_+`\n- Tipo y número de documento: `_+`\n- Parentesco o calidad: `_+`\n- Correo electrónico: `_+`\n/,
        `${data.representativePending}\n`,
      );
      text = text.replace(
        /- Nombre completo del representante: `_+`\n- Número de documento del representante: `_+`\n/,
        `${data.representativePending}\n`,
      );
    } else {
      const rel = RELATIONSHIP[clean(rep.relationship)];
      // Numeral 11: datos del representante. El parentesco se muestra con su etiqueta y ademas se marca
      // su casilla en la declaracion (que el dato salga abajo pero la casilla quede en blanco es incoherente).
      text = fillOrDropField(text, "Nombre completo", rep.name);
      text = fillOrDropField(text, "Tipo y número de documento", rep.document);
      text = fillOrDropField(text, "Parentesco o calidad", rel?.label ?? clean(rep.relationship));
      text = fillOrDropField(text, "Correo electrónico", rep.email);
      if (rel) text = text.replace(`☐ ${rel.box}`, `☑ ${rel.box}`);
      // Numeral 13: firma del representante.
      text = fillOrDropField(text, "Nombre completo del representante", rep.name);
      text = fillOrDropField(text, "Número de documento del representante", rep.document);
    }
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
