import type { ErrorEvent } from "@sentry/nextjs";

// Scrubbing de PHI/PII antes de enviar cualquier evento a Sentry.
// Regla de SECURITY.md: nunca salen nombres, documento, contacto ni payloads
// clinicos. Ante la duda se redacta: es preferible perder contexto de debug que
// filtrar dato de salud. Este modulo es puro (solo type-import de Sentry), asi
// que se puede testear sin levantar el SDK.

export const REDACTED = "[redacted-phi]";

// Coincidencia por substring, en minusculas, espanol e ingles. Cubre
// identificadores directos, cuasi-identificadores de contacto y variables
// clinicas. Se evitan patrones demasiado cortos (ej. "age") que generarian
// falsos positivos sobre claves benignas.
const PHI_KEY_PATTERNS: readonly string[] = [
  "nombre", "apellido", "fullname", "full_name", "first_name", "firstname",
  "last_name", "lastname", "given_name", "family_name",
  "documento", "cedula", "dni", "nit", "identificacion", "document_number",
  "correo", "email", "e_mail",
  "celular", "telefono", "phone", "movil", "whatsapp", "contacto",
  "direccion", "address", "nacimiento", "birth", "fecha_nac",
  "paciente", "patient",
  "diagnostico", "diagnosis", "tratamiento", "treatment",
  "indicador", "indicator", "evaluacion", "evaluation", "encuesta", "survey",
  "biody", "diana",
  "password", "secret", "token", "authorization", "api_key", "apikey", "cookie",
];

// Contextos estandar de Sentry: no contienen PHI por diseno, se preservan para
// no perder informacion util de debug (os, navegador, runtime, etc.).
const STANDARD_CONTEXTS: readonly string[] = [
  "trace", "runtime", "os", "browser", "device", "app", "culture",
  "cloud_resource", "response", "otel", "react",
];

function keyLooksLikePhi(key: string): boolean {
  const k = key.toLowerCase();
  return PHI_KEY_PATTERNS.some((p) => k.includes(p));
}

// Redacta recursivamente cualquier valor cuya clave parezca PHI. Tope de
// profundidad para evitar ciclos y costo excesivo.
function redactDeep(value: unknown, depth = 0): unknown {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = keyLooksLikePhi(k) ? REDACTED : redactDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

// beforeSend de Sentry: limpia el evento de PHI antes de que salga del proceso.
export function scrubPhiFromEvent(event: ErrorEvent): ErrorEvent {
  // 1. Usuario: conservar solo un id seudonimo; fuera email, username, ip y geo.
  if (event.user) {
    const id = event.user.id;
    event.user =
      typeof id === "string" || typeof id === "number" ? { id } : {};
  }

  // 2. Request: fuera cookies y cuerpo (puede traer payload clinico); redactar
  //    query_string (tokens/identificadores) y headers sensibles.
  if (event.request) {
    delete event.request.cookies;
    delete (event.request as { data?: unknown }).data;
    if (event.request.query_string) event.request.query_string = REDACTED;
    if (event.request.headers) {
      const sensitive = ["cookie", "authorization", "x-forwarded-for", "x-real-ip"];
      for (const h of Object.keys(event.request.headers)) {
        if (sensitive.includes(h.toLowerCase())) delete event.request.headers[h];
      }
    }
  }

  // 3. extra y tags: redaccion recursiva por nombre de clave.
  if (event.extra) event.extra = redactDeep(event.extra) as ErrorEvent["extra"];
  if (event.tags) event.tags = redactDeep(event.tags) as ErrorEvent["tags"];

  // 4. contexts: preservar los estandar; redactar el contenido de los demas.
  if (event.contexts) {
    const ctx = event.contexts;
    for (const name of Object.keys(ctx)) {
      if (!STANDARD_CONTEXTS.includes(name)) {
        ctx[name] = redactDeep(ctx[name]) as (typeof ctx)[string];
      }
    }
  }

  // 5. breadcrumbs: redactar su data (los mensajes no deben construirse con PHI).
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) =>
      b.data ? { ...b, data: redactDeep(b.data) as typeof b.data } : b,
    );
  }

  return event;
}
