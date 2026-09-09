// Seed idempotente de las condiciones de la toma BIS (Parte 2 de captura, pestana Evaluacion).
//
// INDEPENDIENTE del seed principal (supabase/seed.ts): NO borra respuestas de encuesta ni nada
// mas. Vive aparte a proposito, para no acoplar este catalogo al seed destructivo de la encuesta
// (BACKLOG.md, "El seed principal es destructivo con las respuestas de encuesta").
//
// Como se corre:
//   Local:  pnpm db:seed:bis   (lleva --env-file=.env.local escrito dentro)
//   Nube:   node --env-file=.env.production.local supabase/seed-bis-conditions.ts   (Santiago)
//
// EL ATAJO `pnpm db:seed:bis` NO SIRVE PARA LA NUBE: el --env-file esta en el script de package.json y no
// se puede sobrescribir desde fuera. Y ojo, medido el 2026-09-07: `--env-file` NO pisa una variable ya
// puesta en el entorno (gana el entorno), asi que exportar las dos variables tambien funciona; lo que no
// funciona es exportar solo una. Por eso el camino documentado es el otro fichero de entorno, entero.
//
// PARA DESPLEGAR UN CAMBIO DE CATALOGO, el camino es la MIGRACION generada
// (scripts/gen-bis-conditions-migration.mjs), no correr esto a mano contra la nube: una migracion la
// aplica el despliegue y queda registrada; un comando manual depende de que alguien se acuerde.
// Idempotente: UUIDs derivados de la clave + upsert por (version, key). Recorrerlo no duplica.
//
// La lista es fiel al HTML de Gildardo (ATLAS.html L10444-10480): 8 generales + 3 femeninas.
// Divergencias documentadas (INVENTARIO.md punto 3a): embarazo agrega "mes de gestacion" (mejora
// v3 (2026-09-10, reunion con Gildardo): +discapacidad (general, con "cual"), +anticonceptivo (con
// "cual") y +menopausia, las dos ultimas debajo de la semana del ciclo, que es donde las pidio.
//
// EL BUMP NO ES OPCIONAL: los ids son deterministas sobre la version (uuidFromKey(`${VERSION_NUMBER}:...`)),
// asi que añadir condiciones sin subir la version reescribiria las filas de la v2 en vez de crear una v3.
// Y las tomas ya registradas apuntan a las condiciones de SU version, que siguen existiendo.
//
// nuestra, informativa, no altera calculos); menstruacion captura "dia del periodo"; semana_ciclo
// es numerico 1-6 siempre visible (sin Si/No). El ciclo menstrual NO alimenta el motor (registro
// clinico, verificado en INVENTARIO.md punto 4).

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "../scripts/lib/base-anunciada.mjs";

// El mensaje NO nombra .env.local: este seed se puede apuntar a la nube con otro fichero de entorno, y
// decir "en .env.local" mandaria a buscar el fallo en el sitio equivocado.
function requerido(nombre: string, valor: string | undefined): string {
  if (!valor || valor.trim() === "") {
    throw new Error(`Falta ${nombre}. Pasa el fichero de entorno con --env-file (o ponla en el entorno).`);
  }
  return valor;
}
const SUPABASE_URL = requerido("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
const SERVICE_ROLE_KEY = requerido("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

// Service role: bypass RLS para sembrar el catalogo (mismo criterio que supabase/seed.ts).
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// UUID deterministico desde una clave estable (md5 -> formato v4). Asi el seed es idempotente sin
// hardcodear UUIDs a mano.
const uuidFromKey = (key: string): string => {
  const h = createHash("md5").update(`bis-condition:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// VERSION 2 (2026-09-07). NO se editan las filas de la v1 en sitio: las respuestas de una evaluacion
// viven en `condition_answers` (JSONB por clave) SELLADAS contra su version, y la vista de solo lectura
// saca los rotulos del catalogo de esa version. Borrar en sitio dejaria a las evaluaciones ya emitidas
// mostrando respuestas sin su pregunta. El catalogo activo es el de mayor `published_at`
// (`getActiveBisConditionCatalog`), asi que publicar la v2 basta y la v1 queda intacta para lo viejo.
const VERSION_NUMBER = 3;
const VERSION_ID = uuidFromKey(`version:${VERSION_NUMBER}`);

type FieldType = "boolean" | "number" | "text";
type Cond = {
  key: string;
  label: string;
  scope: "general" | "mujeres";
  kind: "calidad" | "contraindicacion" | "advertencia" | "validez";
  inputType: FieldType;
  requiresDetail: boolean;
  detailLabel: string | null;
  detailType: FieldType | null;
  // true si responder "si" compromete la validez del resultado (se sella un caveat en el
  // diagnostico). Data-driven: lo llevan las condiciones validez y el embarazo. Default false.
  compromisesValidity?: boolean;
};

// Orden = posicion en este arreglo (order_index = i + 1). Fiel al HTML.
const CONDS: Cond[] = [
  // ── 8 generales ──
  { key: "placas_metalicas", label: "¿Cuenta con placas metálicas?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "protesis_manos_pies", label: "¿Tiene prótesis de manos o pies?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  // Unica contraindicacion: la corriente de la BIA puede danar el dispositivo. Bloqueo DURO.
  { key: "marcapasos", label: "¿Tiene marcapasos o equipos de soporte vital?", scope: "general", kind: "contraindicacion", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "cafe_alimentos_3h", label: "¿Tomó café o alimentos hace menos de 3 horas?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "bano_previo", label: "¿Fue al baño antes de ingresar a la consulta?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "ejercicio_intenso_4h", label: "¿Hizo ejercicio intenso hace menos de 4 horas?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "diuretico", label: "¿Consume algún medicamento diurético?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cuál?", detailType: "text" },
  { key: "accesorios_metalicos_retirados", label: "¿Se retiraron los accesorios metálicos en contacto con la piel antes de la BIA?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  // ── VALIDEZ (general): la medicion es SEGURA pero el RESULTADO no es confiable. NO bloquea ni exige
  // reconocimiento; se mide "con la reserva correspondiente" y se sella un caveat.
  //
  // ERAN TRES Y QUEDA UNA (v2, 2026-09-07). Gildardo, cotejo punto 3: *"quitar estas preguntas que no se
  // porque se pusieron, si yo nunca dije que estuvieran alli"*. Verificado: ni "anasarca" ni "febril"
  // existen en su HTML; las tres las anadimos nosotros como "tabla ampliada de contraindicaciones". El
  // nombro DOS y se quitan DOS: la amputacion se queda y va DECLARADA como divergencia (DIVERGENCIAS.md),
  // porque retirarla sin que la senale seria decidir por el en el otro sentido. ──
  { key: "amputacion", label: "¿Tiene amputación de algún segmento corporal?", scope: "general", kind: "validez", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null, compromisesValidity: true },
  // ── DISCAPACIDAD (reunion con Gildardo, 2026-09-10) ──
  // General, no femenina. Con "cual" porque el tipo cambia lo que la toma significa: una amputacion ya
  // tiene su condicion propia y COMPROMETE la validez; una discapacidad sensorial o cognitiva no toca la
  // medida pero si el acompañamiento. Sin el detalle, la respuesta no dice ninguna de las dos cosas.
  //
  // NO marca `compromisesValidity`: no todas la comprometen, y marcarlas todas sellaria un caveat falso
  // en diagnosticos donde no aplica. Lo que compromete la validez ya esta capturado aparte (amputacion).
  { key: "discapacidad", label: "¿Tiene alguna discapacidad diagnosticada?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cuál?", detailType: "text" },
  // ── 5 femeninas (solo mujeres) ──
  // Embarazo: advertencia (NO bloquea; alerta seria + reconocimiento del permiso del comite de etica).
  // Ademas COMPROMETE la validez (el modelo no esta validado en gestacion) -> sella caveat en el dx.
  // "Mes de gestacion" es mejora nuestra sobre el HTML: informativa, no altera calculos.
  { key: "embarazo", label: "¿Está en embarazo?", scope: "mujeres", kind: "advertencia", inputType: "boolean", requiresDetail: true, detailLabel: "Mes de gestación", detailType: "number", compromisesValidity: true },
  { key: "menstruacion", label: "¿Está menstruando?", scope: "mujeres", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "Día del periodo", detailType: "number" },
  // Semana del ciclo: numero directo 1-6, siempre visible, sin Si/No. Solo registro clinico. OPCIONAL
  // (el dato puede no estar disponible, a diferencia de las si/no que siempre se pueden responder).
  { key: "semana_ciclo", label: "¿En qué semana de su ciclo se encuentra?", scope: "mujeres", kind: "calidad", inputType: "number", requiresDetail: false, detailLabel: null, detailType: null },
  // ── Las dos que pidio DEBAJO de la semana del ciclo (reunion 2026-09-10). El orden es suyo: van juntas
  // porque las tres describen el estado hormonal del momento de la toma, que es lo que puede mover agua.
  //
  // ANTICONCEPTIVOS con "cual": el dispositivo importa. Uno hormonal y uno de cobre no hacen lo mismo, y
  // la respuesta si/no sola no distingue entre los dos.
  { key: "anticonceptivo", label: "¿Usa algún dispositivo anticonceptivo?", scope: "mujeres", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cuál?", detailType: "text" },
  // MENOPAUSIA sin detalle: es un estado, no un dispositivo. El "desde cuando" no lo pidio y añadirlo
  // seria construir contenido que su archivo no tiene (Regla 0).
  { key: "menopausia", label: "¿Está en menopausia?", scope: "mujeres", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
];

async function main() {
  // ANTES DE ESCRIBIR NADA: contra que base. Ver scripts/lib/base-anunciada.mjs para el porque.
  const host = anunciarBase(SUPABASE_URL, "Siembra el catalogo de condiciones de la toma BIS.");

  // 1. Version del catalogo (activa = la de mayor published_at; en v1 hay una sola).
  const v = await supabase.from("bis_condition_versions").upsert(
    {
      id: VERSION_ID,
      version_number: VERSION_NUMBER,
      notes: "v2 (2026-09-07): se retiran las dos condiciones de validez que Gildardo senalo en el cotejo (edema_anasarca, febril_deshidratacion). No estaban en su HTML. Quedan 8 generales + 1 validez (amputacion, declarada como divergencia) + 3 femeninas. La v1 se conserva intacta: las evaluaciones ya emitidas la tienen sellada.",
    },
    { onConflict: "id" },
  );
  if (v.error) throw v.error;

  // 2. Las condiciones (upsert por version + clave; order_index por posicion). Reemplazo en sitio.
  const rows = CONDS.map((c, i) => ({
    id: uuidFromKey(`${VERSION_NUMBER}:${c.key}`),
    bis_condition_version_id: VERSION_ID,
    key: c.key,
    label: c.label,
    scope: c.scope,
    kind: c.kind,
    input_type: c.inputType,
    requires_detail: c.requiresDetail,
    detail_label: c.detailLabel,
    detail_type: c.detailType,
    compromises_validity: c.compromisesValidity ?? false,
    order_index: i + 1,
  }));
  // Reemplazo EN SITIO: borrar las condiciones de esta version y reinsertarlas. Idempotente y
  // robusto ante reordenamientos/altas/bajas (el upsert por clave no maneja cambios de order_index).
  // Seguro: evaluation_bis_intake referencia la VERSION, no filas de bis_conditions (no hay FK); y
  // los intakes demo se limpian antes de un cambio de contenido (ver ARCHITECTURE.md, excepcion).
  const del = await supabase
    .from("bis_conditions")
    .delete()
    .eq("bis_condition_version_id", VERSION_ID);
  if (del.error) throw del.error;
  // `.select()` NO es decorativo: sin el, supabase-js devuelve `data: null` y el unico numero que
  // podriamos imprimir seria `rows.length`, que es el ARREGLO QUE MANDAMOS, no lo que la base acepto.
  // Un mensaje que cuenta la intencion y no el resultado es exactamente el defecto que este seed tuvo.
  const r = await supabase.from("bis_conditions").insert(rows).select("key");
  if (r.error) throw r.error;

  const insertadas = r.data?.length ?? 0;
  if (insertadas !== rows.length) {
    throw new Error(
      `se mandaron ${rows.length} condiciones y la base acepto ${insertadas}: no se declara sembrado a medias`,
    );
  }
  console.log(`Sembradas ${insertadas} condiciones BIS (version ${VERSION_NUMBER}) en ${host}.`);
}

// SIN `process.exit(0)`, y esto se midio antes de quitarlo (2026-09-07).
//
// EL DEFECTO: `process.exit(0)` disparaba mientras un socket keep-alive estaba a medio cerrar, y libuv
// abortaba con `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`. El proceso moria con el codigo
// de aborto de Windows (3221226505 = 0xC0000409) DESPUES de haber sembrado bien. El comentario que habia
// aqui lo llamaba "benigna", y lo era PARA EL DATO; no para el codigo de salida, que es lo que mira
// cualquier despliegue automatizado.
//
// MEDIDO, mismo script cambiando una linea:  con exit(0) -> assertion y salida 3221226505 contra la base
// local, salida 0 contra la nube (la assertion es del socket a localhost).  Sin exit(0) -> salida 0 en
// las dos, y NO se cuelga: 0,2 s contra local y 0,7 s contra la nube. El miedo que justificaba el
// `exit(0)` (que el keep-alive dejara el bucle abierto) no se materializa.
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
