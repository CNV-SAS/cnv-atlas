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
