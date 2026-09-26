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

describe("lo clinico, que no se podia perder", () => {
  const clinica = leer("src/modules/treatment/components/descartar-por-razon-clinica.tsx");

  it("el descarte clinico existe y escribe la contraindicacion del paciente", () => {
    expect(clinica).toContain('value="profesional_clinica"');
    // Y se le DICE al profesional que lo que escribe viaja a la historia del paciente. Pedir un dato que va a
    // la HC sin avisar es peor que no pedirlo; la frase viene de la pantalla que esto reemplaza.
    expect(clinica).toContain("contraindicación del paciente");
  });

  it("MANDA EL PRODUCTO, que es lo que la pantalla vieja no hacia", () => {
    // Sin esto la contraindicacion queda "General" y el siguiente profesional lee "no se lo recomiendo" sin
    // saber de que producto.
    expect(clinica).toContain('name="contraindicationFor"');
  });

  it("y el schema sigue exigiendo el motivo cuando la razon es clinica", () => {
    const sinMotivo = saveNutraDecisionSchema.safeParse({
      evaluationId: "11111111-1111-1111-1111-111111111111",
      decision: "no",
      reason: "profesional_clinica",
      note: null,
      contraindicationFor: "22222222-2222-2222-2222-222222222222",
    });
    expect(sinMotivo.success).toBe(false);
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
