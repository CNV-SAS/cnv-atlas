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

describe("2 · el documento se escribe, y se compara en el servidor", () => {
  it("la comparacion vive en la transaccion, contra la fila", () => {
    // v12: *"no basta un «Aceptar»: hay que escribir el numero de documento"*. Comparado en la pantalla se
    // salta llamando a la accion; comparado aqui, no.
    const resolver = WRITER.slice(
      WRITER.indexOf("export async function resolverLaEliminacion"),
      WRITER.indexOf("export async function restituirAlPaciente"),
    );
    expect(resolver).toContain("input.documento.trim() !== p.documento");
    expect(resolver).toContain("document_number as documento");
    // Y EL ORDEN IMPORTA: la comparacion va ANTES del update, no despues.
    expect(resolver.indexOf("input.documento.trim() !== p.documento")).toBeLessThan(
      resolver.indexOf("set deleted_at = now()"),
    );
  });

  it("solo al EJECUTAR, no al negar", () => {
    // Negar deja todo como estaba: pedir el documento ahi seria un tramite sobre la salida segura, y eso
    // empuja a confirmar por no escribir.
    const resolver = WRITER.slice(
      WRITER.indexOf("export async function resolverLaEliminacion"),
      WRITER.indexOf("export async function restituirAlPaciente"),
    );
    expect(resolver.indexOf("if (input.confirmar)")).toBeLessThan(
      resolver.indexOf("input.documento.trim() !== p.documento"),
    );
  });

  it("y el boton de eliminar esta apagado mientras no se haya escrito", () => {
    expect(PANTALLA).toContain('disabled={pending || escrito === ""}');
    // UN BOTON APAGADO DICE POR QUE lo esta: uno muerto sin explicación es peor que un error claro.
    expect(PANTALLA).toContain("Escribe el documento para poder eliminar");
  });

  it("el documento NO se muestra junto al campo donde se escribe", () => {
    // Si estuviera al lado, escribirlo seria copiarlo y el paso dejaria de comprobar nada. La bandeja
    // muestra el nombre y el motivo, que es con lo que se decide.
    const bandeja = PANTALLA.slice(
      PANTALLA.indexOf("export function ResolverEliminaciones"),
      PANTALLA.indexOf("export function PacientesEliminados"),
    );
    expect(bandeja).toContain("{p.nombre}");
    expect(bandeja, "la bandeja pinta el documento al lado del campo").not.toContain("{p.documento}");
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
    expect(PANTALLA).toContain('key="eliminar"');
    expect(PANTALLA).toContain('key="negar"');
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
