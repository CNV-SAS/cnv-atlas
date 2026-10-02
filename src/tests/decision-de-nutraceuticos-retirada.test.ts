import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";
import { saveNutraDecisionSchema } from "@/modules/treatment/validations";

// ═══ LA PREGUNTA DE TRES OPCIONES SE RETIRO, Y LO CLINICO NO SE FUE CON ELLA (2026-09-26) ═══
//
// Se quito "¿El paciente adquiere los nutraceuticos?" (si / no / pendiente, con seis razones). De las seis, CINCO
// eran comerciales y Santiago confirmo que se pueden perder; UNA era clinica y se guarda como CONTRAINDICACION
// DEL PACIENTE, visible a cualquier profesional que lo atienda despues.
//
// LO QUE ESTE CANDADO VIGILA ES ESO: que al quitar la pregunta no se haya ido el unico camino clinico. Y una cosa
// mas que es facil de romper sin notarlo: que el descarte clinico mande el PRODUCTO, porque en la pantalla vieja
// no lo mandaba y la contraindicacion quedaba "General".

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("la pregunta retirada", () => {
  it("la pantalla de la pregunta ya no se renderiza en ningun sitio", () => {
    // El componente puede seguir en el arbol de archivos, pero nadie lo monta. Si alguien lo volviera a montar,
    // habria dos sitios pidiendo la misma decision.
    const pagina = sinComentarios(leer("src/app/(app)/ani-bis-e/[id]/page.tsx"));
    expect(pagina).not.toContain("<NutraDecisionSection");
  });

  it("y las cinco razones comerciales ya no se ofrecen", () => {
    const seccion = sinComentarios(leer("src/modules/treatment/components/nutraceuticals-section.tsx"));
    for (const razon of ["costo", "lo_piensa", "ya_toma_otros"]) {
      expect(seccion, `todavia se ofrece "${razon}"`).not.toContain(razon);
    }
  });
});

describe("el descarte por razon clinica, retirado el 2026-09-28", () => {
  // SE QUITO A PEDIDO DE SANTIAGO, y su razon es buena: no tiene sentido que el profesional AGREGUE un producto
  // y en la misma linea diga que no lo recomienda. Si no lo recomienda, no lo agrega.
  //
  // PERO ERA EL UNICO ESCRITOR DE patient_contraindications, y eso hay que dejarlo dicho para que nadie lo
  // reintroduzca aqui creyendo que falta: el registro de contraindicaciones se queda SIN NINGUNA superficie que
  // lo escriba. La tabla estaba vacia (0 filas), asi que no se perdio nada registrado; lo que se perdio es la
  // capacidad, y su sitio propio ya esta previsto en el enum de origenes: 'observacion_clinica', que es una
  // contraindicacion del paciente independiente de prescribir. Eso es lo que hay que construir cuando se
  // retome, no volver a poner el boton en la linea del producto.
  it("ya no se ofrece en la linea del producto", () => {
    const seccion = sinComentarios(leer("src/modules/treatment/components/nutraceuticals-section.tsx"));
    expect(seccion).not.toContain("DescartarPorRazonClinica");
  });

  it("y el aviso de contraindicaciones del paciente SIGUE, para cuando vuelva a haber quien las escriba", () => {
    // El bloque que las muestra no se toca: si se quitara tambien, el dia que exista el registro habria que
    // rehacer la pantalla, y las contraindicaciones de origen antiguo dejarian de verse.
    const seccion = leer("src/modules/treatment/components/nutraceuticals-section.tsx");
    expect(seccion).toContain("ContraindicacionesAviso");
  });
});

describe("el 'no' del paciente", () => {
  const boton = leer("src/modules/treatment/components/no-los-adquiere-form.tsx");

  it("se guarda sin migracion: decision 'no' con razon 'otra' y el motivo en la nota", () => {
    expect(boton).toContain('value="no"');
    expect(boton).toContain('value="otra"');
    expect(boton).toContain('name="note"');
  });

  it("y el schema lo acepta asi", () => {
    const r = saveNutraDecisionSchema.safeParse({
      evaluationId: "11111111-1111-1111-1111-111111111111",
      decision: "no",
      reason: "otra",
      note: "Lo va a pensar hasta el mes entrante",
      contraindicationFor: null,
    });
    expect(r.success).toBe(true);
  });

  it("registrado una vez, no se vuelve a ofrecer el boton", () => {
    // Ofrecerlo otra vez invita a escribir dos motivos para lo mismo, y el segundo pisaria al primero.
    expect(boton).toContain("yaRegistrado != null");
  });
});

// ═══ Y NINGUN GUARD PUEDE SEGUIR EXIGIENDO LA RESPUESTA RETIRADA (bloqueo del 2026-10-01) ═══
//
// LO QUE PASO: al quitar la pregunta quedo en el servicio de cobro un `t.decision !== "si"` que respondia
// "Registra primero que el paciente adquiere los nutracéuticos". Como el formulario de si / no / pendiente ya
// no existe, NADIE PUEDE PONER "si": el guard pedia una respuesta imposible y bloqueaba toda venta atada a
// una consulta creada despues del 26 de septiembre. Santiago no pudo cobrar nada.
//
// Y NO SE REPONE DE OTRA FORMA, porque seria circular: al retirar la pregunta se decidio que el "si" SE
// DERIVA DE LA VENTA. Exigirlo antes de vender es pedir la consecuencia como condicion de la causa.
//
// ES LA MISMA FAMILIA QUE LA VALVULA DE LO PRESCRITO: un guard correcto en su contexto que, al cambiar el
// contexto, se vuelve un bloqueo sin salida. Y la unica forma de atraparlo es un caso que mire si el guard
// volvio, porque tsc lo compila y los tests de servicio no pasan por ahi.
describe("venta-en-consulta-sin-guard-retirado", () => {
  it("el cobro no exige que alguien haya respondido que SI los adquiere", () => {
    const servicio = sinComentarios(leer("src/modules/payments/services/payments-service.ts"));
    expect(servicio, "volvio el guard que pide una respuesta que ya nadie puede dar").not.toContain(
      'decision !== "si"',
    );
    expect(servicio).not.toContain("adquiere los nutracéuticos");
  });

  it("y un 'no los adquiere por ahora' tampoco bloquea la venta", () => {
    // La compra es un hecho POSTERIOR que contradice esa foto, y es el dato mas nuevo. Bloquearla para
    // proteger la foto seria perder lo que de verdad paso.
    const servicio = sinComentarios(leer("src/modules/payments/services/payments-service.ts"));
    expect(servicio).not.toMatch(/decision === "no"[\s\S]{0,200}CheckoutError/);
  });
});
