import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

import type { CurrentUser } from "@/modules/auth/roles";
import {
  canConfirmPatientDeletion,
  canProposePatientDeletion,
} from "@/modules/patients/policies/can-delete-patient";

// ═══ CANDADO DE "ELIMINAR EL PERFIL" (v12 §1.2, migracion 0233, 2026-10-30) ═══
//
// LO QUE ESTE CANDADO PROTEGE no es que la pieza exista: es que no se pueda simplificar hacia el acto de
// un solo clic, que es la forma en la que este acto se vuelve peligroso. Son cuatro propiedades y cada una
// se puede perder sola:
//
//   1 · la ASIMETRIA (el profesional pide, otro ejecuta), que es la de la 0180;
//   2 · el DOCUMENTO escrito, comparado en el servidor y no en la pantalla;
//   3 · que eliminar NO BORRE nada, y que la pantalla lo diga en la misma frase;
//   4 · y que siga siendo REVERSIBLE y alcanzable (un eliminado no sale en ninguna pantalla).

const WRITER_SRC = readFileSync(
  "src/modules/patients/data/eliminacion-del-paciente-writer.ts",
  "utf8",
);
const WRITER = sinComentarios(WRITER_SRC);
const ACCIONES = sinComentarios(readFileSync("src/modules/patients/actions.ts", "utf8"));
const PANTALLA = sinComentarios(
  readFileSync("src/modules/patients/components/eliminar-perfil.tsx", "utf8"),
);
const MIGRACION = readFileSync("drizzle/0233_el_perfil_se_elimina_con_rastro.sql", "utf8");
const FRENO = sinComentarios(
  readFileSync("src/modules/bis/data/medicion-duplicada-reader.ts", "utf8"),
);

const usuario = (roles: CurrentUser["roles"]): CurrentUser => ({
  id: "00000000-0000-0000-0000-000000000001",
  email: "quien@cnv",
  fullName: "Quien Sea",
  organizationId: "00000000-0000-0000-0000-0000000000ff",
  status: "active",
  roles,
});

describe("1 · la asimetria: quien pide no ejecuta", () => {
  it("el profesional PIDE y no ejecuta", () => {
    // Es la razon de ser de las dos policies, y viene de la 0180: eliminar saca al paciente de las cifras
    // y de la cohorte, asi que quien se beneficia de la exclusion no puede autorizarla.
    expect(canProposePatientDeletion(usuario(["professional"]))).toBe(true);
    expect(canConfirmPatientDeletion(usuario(["professional"]))).toBe(false);
  });

  it("y un administrador ejecuta", () => {
    expect(canConfirmPatientDeletion(usuario(["admin"]))).toBe(true);
  });

  it("soporte no hace ninguna de las dos", () => {
    // Ve pacientes para acompanar, no decide sobre ellos.
    expect(canProposePatientDeletion(usuario(["soporte"]))).toBe(false);
    expect(canConfirmPatientDeletion(usuario(["soporte"]))).toBe(false);
  });

  it("la PETICION no escribe `deleted_at`: el paciente sigue en la lista", () => {
    // Si la peticion lo escribiera, la asimetria seria un adorno de la pantalla.
    const pedir = WRITER.slice(
      WRITER.indexOf("export async function pedirLaEliminacionDelPaciente"),
      WRITER.indexOf("export async function resolverLaEliminacion"),
    );
    expect(pedir.length, "no se encontró la función de pedir").toBeGreaterThan(200);
    expect(pedir, "la petición escribe deleted_at").not.toContain("deleted_at =");
    expect(pedir).toContain("eliminacion_pedida_at = now()");
  });

  it("y la base sostiene la asimetria: no hay `deleted_at` sin peticion", () => {
    // EL CHECK ES LO QUE LA HACE INSALTABLE. Sin el, un UPDATE a mano (o un camino nuevo de la aplicacion
    // que olvide la regla) dejaria un paciente eliminado que nadie pidio eliminar.
    expect(MIGRACION).toContain("patients_eliminacion_coherente");
    expect(MIGRACION).toContain(
      'AND ("deleted_at" IS NULL OR "eliminacion_pedida_at" IS NOT NULL)',
    );
    // Y la peticion completa o inexistente: media peticion (fecha sin motivo) obliga a adivinar a quien
    // ejecuta, y es el caso que aparece cuando alguien agrega la columna y olvida el campo del formulario.
    expect(MIGRACION).toContain("patients_peticion_de_eliminacion_completa");
  });

  it("y con la clave publica no se escribe, aunque el paciente sea suyo", () => {
    // `patients_update` (0003) deja al profesional dueno escribir su fila, asi que sin este trigger la
    // asimetria se salta con una llamada directa a la API. Y el trigger NO puede ser `SECURITY DEFINER`:
    // dentro de una funcion definer, `current_user` es el dueno de la funcion y la comparacion pasaria
    // siempre.
    expect(MIGRACION).toContain("CREATE TRIGGER");
    expect(MIGRACION).toContain("IF current_user IN ('anon', 'authenticated')");
    const fn = MIGRACION.slice(
      MIGRACION.indexOf("CREATE OR REPLACE FUNCTION public.la_eliminacion_del_paciente"),
      MIGRACION.indexOf("DROP TRIGGER"),
    );
    expect(fn, "el trigger quedó SECURITY DEFINER y no frena nada").not.toContain("SECURITY DEFINER");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// 2 · LA BANDEJA SON DOS BOTONES, Y NO SE TECLEA NINGUNA CEDULA  ·  Santiago, 2026-11-05
//
// *"Fuera la cedula tecleada: era para un acto irreversible, y este se deshace. La bandeja queda con dos
// botones: Aprobar y Rechazar."*
//
// ═══ ESTE BLOQUE MEDIA LO CONTRARIO, Y SE DA VUELTA ═══
//
// Afirmaba que la cedula se escribia y se comparaba dentro de la transaccion, con su orden y su boton
// apagado. Era un porte fiel de v12 (*"no basta un «Aceptar»: hay que escribir el numero de documento"*) y
// EL SUPUESTO DE ESA FRASE ES FALSO EN ATLAS: eliminar escribe `deleted_at`, no borra ninguna fila, y
// `restituirAlPaciente` lo deshace.
//
// LO QUE SE AFIRMA AHORA son las dos mitades de la decision: que el tramite no vuelva, y que lo que de
// verdad protege este acto siga en pie. Lo segundo es lo que importa: quitar un freno obliga a comprobar
// que el acto no se quedo sin ninguno.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("2 · la bandeja son dos botones, y no se teclea ninguna cedula", () => {
  it("el writer ya no compara ningun documento, ni lo lee de la fila", () => {
    const resolver = WRITER.slice(
      WRITER.indexOf("export async function resolverLaEliminacion"),
      WRITER.indexOf("export async function restituirAlPaciente"),
    );
    expect(resolver, "volvio la comparacion del documento tecleado").not.toContain("input.documento");
    expect(
      resolver,
      "el resolver vuelve a leer el documento del paciente, que es PII que nadie usa",
    ).not.toContain("document_number");
  });

  it("y la bandeja ofrece Aprobar y Rechazar, con su dato en el boton (hazard 5)", () => {
    const bandeja = PANTALLA.slice(
      PANTALLA.indexOf("export function ResolverEliminaciones"),
      PANTALLA.indexOf("export function PacientesEliminados"),
    );
    expect(bandeja, "la bandeja perdio el boton de aprobar").toContain("Aprobar");
    expect(bandeja, "la bandeja perdio el boton de rechazar").toContain("Rechazar");
    // SIN CAMPO DE TEXTO: ni el input ni su estado por peticion.
    expect(bandeja, "volvio el campo del documento").not.toContain('name="documento"');
    expect(bandeja, "volvio el estado del documento por peticion").not.toContain("setDocumentos");
    // LOS DOS BOTONES CON `key` DISTINTA (hazard 1) y su valor en `name`/`value` (hazard 5, que solo
    // viaja porque `enviarSinReset` pasa el submitter). Las dos cosas valen igual con dos botones que con
    // tres, y son las que dejarian al servidor decidiendo por la persona.
    expect(bandeja).toContain('key="aprobar"');
    expect(bandeja).toContain('key="rechazar"');
    expect(bandeja).toContain('name="confirmar"');
    expect(bandeja).toContain("enviarSinReset(action)");
  });

  it("Y LA BANDEJA DICE LO QUE DEJA DE CONTAR, o se aprueba sin ver la consecuencia", () => {
    // ═══ EL HUECO, Y POR QUE IMPORTA (Santiago, 2026-11-08) ═══
    //
    // La bandeja mostraba nombre, motivo y quien lo pidio. Con eso no se puede ver que ese paciente
    // tiene tres consultas diagnosticadas y dos en la cohorte de investigacion: aprobar no borra nada,
    // pero las saca de las pantallas y de la cohorte, o sea que el "n" de un articulo cambia por un acto
    // administrativo que nadie relaciono con el. Quien aprueba tiene que verlo ANTES.
    const bandeja = PANTALLA.slice(
      PANTALLA.indexOf("function LoQueDejaDeContar"),
      PANTALLA.indexOf("export function PacientesEliminados"),
    );
    expect(bandeja, "la bandeja dejo de pintar las consecuencias").toContain(
      "<LoQueDejaDeContar p={p} />",
    );
    expect(bandeja).toContain("consultas diagnosticadas");
    expect(bandeja).toContain("informes enviados");
    expect(bandeja).toContain("en la cohorte de investigación");
    // SIN CIFRAS SE DICE QUE NO HAY: un hueco se leeria como que no se pudo averiguar.
    expect(bandeja).toContain("No tiene consultas diagnosticadas");
    // Y NO SE PROMETE UN BORRADO QUE NO OCURRE, que es la mitad que la palabra "eliminar" no dice.
    expect(bandeja).toContain("Nada de eso se borra");

    // LAS TRES CIFRAS SALEN DE LA BASE, y la cohorte se le pregunta A LA VISTA: reconstruir aqui sus
    // tres condiciones seria una segunda definicion de quien esta en la cohorte.
    const WRITER_ = readFileSync(
      "src/modules/patients/data/eliminacion-del-paciente-writer.ts",
      "utf8",
    );
    expect(WRITER_).toContain("public.evaluaciones_para_investigacion");
    // CONSULTAS diagnosticadas, no filas de diagnostico: una reemision añade fila y no añade consulta.
    expect(WRITER_).toContain("count(distinct e.id)");
    expect(WRITER_).toContain("r.sent_at is not null");
  });

  it("aprobar NO es rojo: lo que hace es sacarlo de las pantallas, no perder su historia", () => {
    // Mismo criterio que el boton de reemplazar la medicion BIS, el mismo dia: el rojo de `destructive`
    // significa un acto que QUITA algo, y aqui la historia clinica se conserva por ley.
    const bandeja = PANTALLA.slice(
      PANTALLA.indexOf("export function ResolverEliminaciones"),
      PANTALLA.indexOf("export function PacientesEliminados"),
    );
    const aprobar = bandeja.slice(bandeja.indexOf('key="aprobar"'), bandeja.indexOf("Aprobar"));
    expect(aprobar, "el boton de aprobar volvio a ser rojo").not.toContain("destructive");
  });

  it("y los dos botones DICEN que hacen: 'Aprobar' solo no dice sobre que", () => {
    const bandeja = PANTALLA.slice(
      PANTALLA.indexOf("export function ResolverEliminaciones"),
      PANTALLA.indexOf("export function PacientesEliminados"),
    );
    expect(bandeja, "la bandeja no dice que hace aprobar").toContain("lo saca de todas las pantallas");
    expect(bandeja, "la bandeja no dice que hace rechazar").toContain("deja todo como está");
  });

  it("CONTROL · lo que de verdad frena este acto sigue en pie", () => {
    // ES EL CASO QUE JUSTIFICA HABER QUITADO EL TRAMITE. Sin esto, el bloque de arriba solo diria que un
    // freno desaparecio.
    const resolver = WRITER.slice(
      WRITER.indexOf("export async function resolverLaEliminacion"),
      WRITER.indexOf("export async function restituirAlPaciente"),
    );
    // 1 · SIN PETICION NO SE ELIMINA: es la asimetria (quien se beneficia de la exclusion no la autoriza).
    expect(resolver, "se puede eliminar sin que nadie lo haya pedido").toContain("p.pedido == null");
    // 2 · NO SE ELIMINA DOS VECES.
    expect(resolver).toContain("p.eliminado != null");
    // 3 · Y EL ACTO QUEDA EN EL AUDIT, con su evento y su actor.
    expect(resolver).toContain("paciente.eliminado");
    expect(resolver).toContain("paciente.eliminacion_negada");
  });

  it("el asiento dice el motivo Y QUIEN LO PIDIO (Santiago, 2026-11-05)", () => {
    // *"La auditoria dice motivoPedido. Que diga tambien quien lo pidio y, si se rechaza, quien lo
    // rechazo."*
    //
    // QUIEN LO PIDIO ERA EL HUECO: al RECHAZAR se limpia la peticion entera de la fila, asi que despues de
    // un rechazo ese nombre no estaba junto al rechazo en ningun sitio legible.
    //
    // QUIEN LO RESOLVIO YA ESTABA, y es el ACTOR del evento (`actorId` / `actorEmail` de esta misma fila
    // del log). Se afirma aqui para que nadie lo anada otra vez al payload: seria el mismo dato en dos
    // campos que pueden divergir, y el de la columna es el que no se puede falsear.
    const resolver = WRITER.slice(
      WRITER.indexOf("export async function resolverLaEliminacion"),
      WRITER.indexOf("export async function restituirAlPaciente"),
    );
    expect(resolver, "el asiento dejo de decir por que se pidio").toContain("motivoPedido: p.motivo");
    expect(resolver, "el asiento no dice quien lo pidio").toContain("pedidoPor: p.pedido_por");
    expect(resolver, "se dejo de registrar quien resolvio").toContain("actorId: input.actorId");
  });
});

describe("3 · eliminar no borra, y la pantalla lo dice", () => {
  it("el writer solo escribe `deleted_at`: ningun DELETE", () => {
    // La historia clinica se conserva 15 anos (DATA_GOVERNANCE, Resoluciones 1995/1999 y 839/2017) y el
    // derecho al olvido se atiende por anonimizacion. O sea que un DELETE aqui seria ilegal, no agresivo.
    expect(WRITER).not.toMatch(/\bdelete\s+from\b/i);
    expect(WRITER).toContain("set deleted_at = now()");
  });

  it("y las tres superficies dicen que la historia se conserva", () => {
    // La palabra "eliminar" es la suya y se conserva; lo que no puede pasar es que se diga sola, porque en
    // cualquier otro sistema significa que la fila desaparece.
    expect(PANTALLA).toContain("su historia clínica se\n        conserva");
    expect(ACCIONES).toContain("su historia clínica se conserva y se puede restituir");
  });

  it("y el acto queda en el audit log, los tres", () => {
    // Regla dura 8: inline en la transaccion, nunca por el bus. Los tres eventos, porque el que falta es
    // justo el que no se puede reconstruir despues.
    expect(WRITER).toContain('event: "paciente.eliminacion_pedida"');
    expect(WRITER).toContain('"paciente.eliminado"');
    expect(WRITER).toContain('"paciente.eliminacion_negada"');
    expect(WRITER).toContain('event: "paciente.restituido"');
    // Y DENTRO de la transaccion: `recordAudit(tx, ...)`, no `recordAudit(db, ...)`.
    expect(WRITER).not.toContain("recordAudit(db");
  });

  it("el freno del import NO filtra a los eliminados, y eso es a proposito", () => {
    // ERA LA DUDA DE §B1 DEL 26-OCT, y la respuesta estaba en el codigo: si el freno filtrara
    // `deleted_at`, eliminar a un paciente LIBERARIA la huella de su medicion y la misma toma fisica
    // podria volver a entrar. No la filtra. Eliminar el perfil no desmide su cuerpo.
    expect(FRENO).not.toContain("deleted_at");
    expect(FRENO).not.toContain("deletedAt");
  });
});

describe("4 · sigue siendo reversible, y alcanzable", () => {
  it("restituir existe y limpia tambien la peticion", () => {
    // Una peticion viva sobre un paciente restituido volveria a ofrecer su eliminacion sin que nadie la
    // pidiera de nuevo.
    const restituir = WRITER.slice(WRITER.indexOf("export async function restituirAlPaciente"));
    expect(restituir).toContain("set deleted_at = null, eliminado_por = null");
    expect(restituir).toContain("eliminacion_pedida_at = null");
  });

  it("y hay una pantalla donde encontrar a los eliminados", () => {
    // SIN ESTA LISTA, RESTITUIR NO SERIA ALCANZABLE: un eliminado no sale en ninguna otra pantalla (once
    // lectores lo filtran), asi que habria que conocer su id. Es la diferencia entre reversible en el
    // codigo y reversible de verdad.
    expect(WRITER).toContain("export async function pacientesEliminados");
    const ADMIN = sinComentarios(readFileSync("src/app/(app)/admin/page.tsx", "utf8"));
    expect(ADMIN).toContain("<PacientesEliminados eliminados={eliminados} />");
    expect(ADMIN).toContain("<ResolverEliminaciones peticiones={peticionesDeEliminacion} />");
  });

  it("y restituir lo resuelve quien ejecuta, no quien pide", () => {
    const accion = ACCIONES.slice(ACCIONES.indexOf("export async function restituirAlPacienteAction"));
    expect(accion).toContain("canConfirmPatientDeletion(user)");
  });
});

describe("y las reglas de la casa que estos formularios tienen que cumplir", () => {
  it("las acciones NO revalidan: refresca la pantalla", () => {
    // `refresco-una-sola-vez`: con los dos, el formulario se desmonta antes de que se vea el aviso.
    const nuevas = ACCIONES.slice(ACCIONES.indexOf("export async function pedirEliminacionDelPacienteAction"));
    expect(nuevas).not.toContain("revalidatePath");
  });

  it("y la pantalla envia con `enviarSinReset`, nunca con la prop `action`", () => {
    // Hazard 2: la prop resetea los inputs no controlados, asi que un error borraria el motivo escrito.
    // Hazard 5: el `name`/`value` del boton solo viaja porque `enviarSinReset` pasa el submitter, y aqui
    // ese dato es el que dice si se elimina o se niega.
    expect(PANTALLA).not.toMatch(/<form[^>]*\saction=\{/);
    // Los TRES formularios del archivo: pedir, resolver y restituir.
    expect((PANTALLA.match(/onSubmit=\{enviarSinReset\(action\)\}/g) ?? []).length).toBe(3);
    expect(PANTALLA).toContain('name="confirmar"');
    // LAS `key` DISTINTAS son el hazard 1: con la misma, React reutiliza el nodo DOM y el botón cambia de
    // papel bajo el dedo. Se renombraron el 2026-11-05 con los botones ("Aprobar" y "Rechazar"), y lo que
    // se vigila no es el nombre: es que sean DOS y DISTINTAS.
    const claves = [...PANTALLA.matchAll(/key="([a-z]+)"/g)].map((m) => m[1]);
    expect(claves.length, "los dos botones de la bandeja perdieron su `key`").toBeGreaterThanOrEqual(2);
    expect(new Set(claves).size, "dos botones de envío comparten su `key` (hazard 1)").toBe(
      claves.length,
    );
  });

  it("y ningun `<form>` de este archivo contiene otro", () => {
    // Hazard 7: el navegador descarta el de adentro, sus campos viajan en el envio de afuera y su boton
    // ejecuta la accion equivocada. Aqui cada peticion abre su formulario dentro de un `<li>`, no de otro
    // formulario. El PAR entre archivos (un componente con form renderizado dentro del form de otro) lo
    // barre `formularios-no-anidados.test.ts` sobre el arbol entero; esto mira adentro de este.
    for (const m of PANTALLA.matchAll(/<form[\s>]/g)) {
      const region = PANTALLA.slice(m.index, PANTALLA.indexOf("</form>", m.index));
      expect(region.match(/<form[\s>]/g)?.length ?? 0, "un <form> dentro de otro").toBe(1);
    }
  });
});
