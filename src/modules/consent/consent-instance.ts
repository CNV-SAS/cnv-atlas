// Capa de INSTANCIA del consentimiento (presentacion). La PLANTILLA (consent-v1.0.ts) es el documento
// CONGELADO sobre el que se calcula el hash y es lo que se firma; NO se toca aqui. La INSTANCIA es lo que
// el paciente VE y RECIBE: la misma plantilla con los marcadores rellenos, SOLO la rama (mayor/menor) que
// aplica, y la fecha real.
//
// v1.0: MARCADORES EXPLICITOS (reemplazo mecanico), no anclaje por substring. Dos clases:
//  - RELLENOS {{...}}: se reemplazan por su valor; un relleno de LINEA con valor vacio DROPEA su linea
//    (nunca deja una raya en blanco ni un marcador crudo). La fecha es el unico cuyo vacio es "pendiente".
//  - RAMAS <!--RAMA_MAYOR-->...<!--/RAMA_MAYOR--> / <!--RAMA_MENOR--> / <!--ASENTIMIENTO-->: se CONSERVA la
//    que aplica (se le quitan los delimitadores) y se ELIMINA la otra (con delimitadores). Los delimitadores
//    son comentarios HTML: en la instancia final NO queda ninguno (se quitan siempre), asi que ni el
//    conversor a correo ni el de pantalla los imprimen.
//
// GARANTIA (documento legal): la instancia VERIFICA que no quede NINGUN marcador ni delimitador sin
// resolver. Un marcador visible ({{firma_nombre}}) o un comentario de rama en un consentimiento es peor
// que una raya: si algo quedara, se REPORTA (server) y se elimina, nunca se muestra. El golden
// (consent-instance.test.ts) es la red que atrapa un corte de rama mal hecho aunque los rellenos sean
// exactos (baja de necesario a conveniente, pero se conserva).

export type ConsentInstanceData = {
  branch: "mayor" | "menor";
  patient: { name: string; document: string }; // en pantalla puede venir un texto "pendiente" (no vacio)
  professional: { fullName: string; profession: string; license: string | null };
  representative?: { name: string; document: string; relationship: string; email: string } | null;
  // applies=true SOLO para 14-17 (el asentimiento). Un menor de 14 tiene representante pero NO
  // asentimiento: applies=false y el bloque entero se quita (no queda un asentimiento vacio).
  assent?: { applies: boolean; minorName: string } | null;
  // Solo PANTALLA: en la rama menor, antes de que se escriban los datos del representante, en vez de dropear
  // sus lineas (dejando un encabezado huerfano) se muestra esta linea. En la COPIA no se pasa (siempre hay
  // datos).
  representativePending?: string;
  // Ids de las autorizaciones del numeral 12 efectivamente marcadas. Las marcadas van [x], las NO marcadas
  // [ ]: la distincion "no marco" vs "no se sabe" importa (las no marcadas prueban que se ofrecieron).
  granted: readonly string[];
  acceptedAt: number | null; // epoch-ms; null => fecha pendiente (pantalla, aun sin firmar)
};

// Casillas del numeral 12: marcador de plantilla -> id de la autorizacion. Marcada [x] si esta en granted.
// v1.0: SEIS casillas (revision legal). internacional_ia se absorbio en servicio; la etnia se fundio en
// investigacion (no es casilla propia). El acuse de medio electronico es la 3a necesaria.
const CHECKBOX_MARKERS: { marker: string; id: string }[] = [
  { marker: "casilla_servicio", id: "servicio" },
  { marker: "casilla_datos_sensibles", id: "datos_sensibles" },
  { marker: "casilla_medio_electronico", id: "aceptacion_medio_electronico" },
  { marker: "casilla_investigacion", id: "investigacion" },
  { marker: "casilla_continuidad", id: "comunicaciones_continuidad" },
  { marker: "casilla_comerciales", id: "comunicaciones_comerciales" },
];

// Parentesco: valor del formulario -> etiqueta + marcador de la casilla a marcar en la declaracion (num 11).
const RELATIONSHIP: Record<string, { label: string; boxMarker: string }> = {
  padre: { label: "Padre", boxMarker: "box_padre" },
  madre: { label: "Madre", boxMarker: "box_madre" },
  tutor: { label: "Tutor legal", boxMarker: "box_tutor" },
  curador: { label: "Curador", boxMarker: "box_curador" },
};
const ALL_BOX_MARKERS = ["box_padre", "box_madre", "box_tutor", "box_curador"];

const clean = (v: string | null | undefined): string => (v ?? "").trim();

function formatAcceptedAt(epochMs: number): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

// Reemplaza TODAS las apariciones de {{marker}} por value (literal, sin interpretar regex).
function put(text: string, marker: string, value: string): string {
  return text.split(`{{${marker}}}`).join(value);
}

// Relleno de LINEA: si value tiene contenido, reemplaza {{marker}}; si esta vacio, DROPEA la linea entera
// que lo contiene (nunca deja una raya). El marcador vive en una linea "- Etiqueta: {{marker}}".
function fillLineOrDrop(text: string, marker: string, value: string): string {
  const v = clean(value);
  if (v) return put(text, marker, v);
  return text.replace(new RegExp(`^.*\\{\\{${marker}\\}\\}.*\\n?`, "m"), "");
}

// Conserva una rama: quita SOLO sus delimitadores, deja el contenido.
function keepBranch(text: string, name: string): string {
  return text.split(`<!--${name}-->`).join("").split(`<!--/${name}-->`).join("");
}

// Elimina una rama entera: contenido + delimitadores. Non-greedy; los delimitadores no se anidan con el
// mismo nombre, asi que el primer cierre es el correcto.
function removeBranch(text: string, name: string): string {
  return text.replace(new RegExp(`<!--${name}-->[\\s\\S]*?<!--/${name}-->`, "g"), "");
}

function transform(template: string, data: ConsentInstanceData): string {
  let text = template;

  // 1. Bloque del profesional (numeral 2): sin em-dash, segmentos vacios omitidos.
  const name = clean(data.professional.fullName);
  const profession = clean(data.professional.profession);
  const license = clean(data.professional.license);
  const nameProf = [name, profession].filter(Boolean).join(", ");
  let profLine = "**Profesional:** " + nameProf;
  if (license) profLine += `${nameProf ? ". " : ""}Registro profesional No. ${license}`;
  text = put(text, "bloque_profesional", profLine);

  // 2. Ramas (numerales 11 y 13).
  if (data.branch === "mayor") {
    text = keepBranch(text, "RAMA_MAYOR");
    text = removeBranch(text, "RAMA_MENOR"); // arrastra el ASENTIMIENTO anidado
  } else {
    text = removeBranch(text, "RAMA_MAYOR");
    // Menor de 14: representante SI, asentimiento NO. Se quita el bloque de asentimiento.
    text = data.assent?.applies ? keepBranch(text, "ASENTIMIENTO") : removeBranch(text, "ASENTIMIENTO");
    text = keepBranch(text, "RAMA_MENOR");
  }

  // 3. Casillas del numeral 12 (rellenos, no dropean).
  const grantedSet = new Set(data.granted);
  for (const c of CHECKBOX_MARKERS) {
    text = put(text, c.marker, grantedSet.has(c.id) ? "[x]" : "[ ]");
  }

  // 4. Rellenos de firma segun rama.
  if (data.branch === "mayor") {
    text = fillLineOrDrop(text, "firma_nombre", data.patient.name);
    text = fillLineOrDrop(text, "firma_documento", data.patient.document);
  } else {
    const rep = data.representative ?? { name: "", document: "", relationship: "", email: "" };
    const repEmpty =
      !clean(rep.name) && !clean(rep.document) && !clean(rep.relationship) && !clean(rep.email);
    // Casillas de parentesco (numeral 11): la elegida ☑, el resto ☐.
    const chosen = RELATIONSHIP[clean(rep.relationship)];
    for (const b of ALL_BOX_MARKERS) text = put(text, b, chosen?.boxMarker === b ? "☑" : "☐");
    if (repEmpty && data.representativePending) {
      // Pantalla, antes de escribir los datos: una sola linea pendiente en vez de encabezados huerfanos.
      text = text.replace(
        /- Nombre completo: \{\{rep_nombre\}\}\n- Tipo y número de documento: \{\{rep_documento\}\}\n- Parentesco o calidad: \{\{rep_parentesco\}\}\n- Correo electrónico: \{\{rep_correo\}\}\n/,
        `${data.representativePending}\n`,
      );
      text = text.replace(
        /- Nombre completo del representante: \{\{firma_rep_nombre\}\}\n- Número de documento del representante: \{\{firma_rep_documento\}\}/,
        data.representativePending,
      );
    } else {
      text = fillLineOrDrop(text, "rep_nombre", rep.name);
      text = fillLineOrDrop(text, "rep_documento", rep.document);
      text = fillLineOrDrop(text, "rep_parentesco", chosen?.label ?? clean(rep.relationship));
      text = fillLineOrDrop(text, "rep_correo", rep.email);
      text = fillLineOrDrop(text, "firma_rep_nombre", rep.name);
      text = fillLineOrDrop(text, "firma_rep_documento", rep.document);
    }
    // Asentimiento (14-17): nombre del menor + casilla marcada.
    if (data.assent?.applies) {
      text = put(text, "asentimiento_menor_nombre", clean(data.assent.minorName) || "el/la menor evaluado/a");
      text = put(text, "casilla_asentimiento", "[x]");
    }
  }

  // 5. Fecha (numeral 13): real, o "pendiente" en pantalla (su vacio nunca dropea).
  text = put(
    text,
    "fecha",
    data.acceptedAt != null ? formatAcceptedAt(data.acceptedAt) : "(se generará al confirmar)",
  );

  // 6. Normaliza el espaciado que dejan los cortes de rama (nunca 3+ lineas en blanco seguidas).
  text = text.replace(/\n{3,}/g, "\n\n");

  return text;
}

// Patron de cualquier marcador de relleno o delimitador de rama sin resolver.
const LEFTOVER = /\{\{[^}]+\}\}|<!--\s*\/?\s*(RAMA_MAYOR|RAMA_MENOR|ASENTIMIENTO)\s*-->/g;

// Construye la INSTANCIA personalizada. GARANTIA: nunca deja un marcador ni un delimitador visible. Si por
// un drift de plantilla quedara alguno, se REPORTA (server) y se ELIMINA (una raya es preferible a un
// {{marcador}} visible en un documento legal). Nunca revienta el flujo del paciente.
export function buildConsentInstance(template: string, data: ConsentInstanceData): string {
  let text: string;
  try {
    text = transform(template, data);
  } catch {
    text = template; // robustez (no deberia pasar); el barrido de abajo limpia cualquier marcador.
  }
  const leftover = text.match(LEFTOVER);
  if (leftover) {
    // Reporte server-side: un marcador sin resolver es un defecto de plantilla/instancia que hay que ver.
    console.error(
      `consent-instance: marcadores sin resolver (${data.branch}): ${[...new Set(leftover)].join(", ")}`,
    );
    text = text.replace(LEFTOVER, "").replace(/\n{3,}/g, "\n\n");
  }
  return text;
}

// Vista COMPLETA de la plantilla para consulta interna (/consentimiento): muestra AMBAS ramas (mayor y
// menor) y los campos como rotulos entre corchetes, para que se lea el texto vigente ENTERO (un revisor
// necesita ver las provisiones del menor, que la instancia de un paciente filtra). No es la instancia de
// nadie: no rellena datos ni marca casillas. Quita los delimitadores de rama conservando ambas.
export function buildConsentFullPreview(template: string): string {
  let text = template
    .split("{{bloque_profesional}}")
    .join("**Profesional:** [nombre, profesión y registro del profesional asignado]")
    .replace(/\{\{(?:casilla_[a-z_]+|box_[a-z_]+)\}\}/g, "☐")
    .replace(/\{\{fecha\}\}/g, "[fecha de la firma]")
    .replace(/\{\{(?:firma_nombre|firma_rep_nombre|rep_nombre|asentimiento_menor_nombre)\}\}/g, "[nombre]")
    .replace(/\{\{(?:firma_documento|firma_rep_documento|rep_documento)\}\}/g, "[documento]")
    .replace(/\{\{rep_parentesco\}\}/g, "[parentesco]")
    .replace(/\{\{rep_correo\}\}/g, "[correo]")
    // Quita SOLO los delimitadores de rama, conservando el contenido de AMBAS ramas.
    .replace(/<!--\/?(?:RAMA_MAYOR|RAMA_MENOR|ASENTIMIENTO)-->/g, "");
  // Barrido de cualquier marcador que se haya escapado (nunca mostrar {{...}} crudo).
  text = text.replace(/\{\{[^}]+\}\}/g, "");
  return text.replace(/\n{3,}/g, "\n\n");
}
