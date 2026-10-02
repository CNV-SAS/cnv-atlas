import { readdirSync, readFileSync } from "node:fs";
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
// ═══ Y EL CANDADO SE REESCRIBE, PORQUE CUBRIA EL CASO Y NO LA FORMA (bloqueo del 2026-10-02) ═══
//
// AL DIA SIGUIENTE DE ARREGLARLO, EL MISMO GUARD BLOQUEO OTRA VEZ, en la otra punta del mismo camino: la
// pagina de la consulta solo montaba la seccion de venta si `nutraceuticalDecision?.decision === "si"`. La
// venta no aparecia nunca y la frase mandaba a registrar "arriba" algo que ya no existe arriba.
//
// LO QUE FALLO NO FUE EL ARREGLO, FUE ESTE ARCHIVO. Los dos casos de abajo miraban UN archivo
// (`payments-service.ts`), que es donde el defecto habia dado la cara. Pasaban en verde con la pantalla
// rota, porque la pantalla no estaba en la lista. Un candado escrito sobre el sitio donde se vio el fallo
// solo protege ese sitio; el defecto vive en la REGLA, y una regla muerta puede estar en varias puertas.
//
// ASI QUE AHORA SE BARRE EL ARBOL ENTERO. Es el septimo defecto con esta forma, y el primero donde el
// candado que debia atraparlo existia y no lo atrapo.
describe("ninguna superficie exige la respuesta retirada", () => {
  // Todo el codigo de la aplicacion, menos los tests (que la nombran para vigilarla) y los tipos generados.
  // Se recorre a mano, como los demas barridos del proyecto (`capa-clinica-solo-veredictos`).
  function archivos(dir: string): string[] {
    const out: string[] = [];
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name).replace(/\\/g, "/");
      if (d.isDirectory()) {
        if (p.endsWith("/tests")) continue;
        out.push(...archivos(p));
      } else if (/\.tsx?$/.test(d.name) && d.name !== "database.generated.ts") {
        out.push(p);
      }
    }
    return out;
  }
  const FUENTES = archivos("src");

  it("hay fuentes que barrer (si esto falla, el barrido no esta mirando nada)", () => {
    // Sin este control, un glob que no casa nada dejaria los dos casos de abajo en verde para siempre.
    expect(FUENTES.length).toBeGreaterThan(200);
  });

  it("nadie compara la decision contra 'si': es una respuesta que ya nadie puede dar", () => {
    // LA REGLA, en una frase: al retirar la pregunta se decidio que el "si" SE DERIVA DE LA VENTA. Cualquier
    // comparacion contra "si" pide la consecuencia como condicion de la causa, y lo que produce no es un
    // error sino una pantalla o una accion que nunca se habilita. Por eso tsc no lo ve.
    const culpables: string[] = [];
    for (const f of FUENTES) {
      const src = sinComentarios(readFileSync(join(process.cwd(), f), "utf8"));
      // La comparacion, en sus formas: `decision === "si"`, `decision !== "si"`, y la version en SQL.
      if (/\bdecision\s*[!=]==?\s*["']si["']/.test(src) || /nutraceutical_decision\s*[!=]=?\s*'si'/.test(src)) {
        culpables.push(f);
      }
    }
    expect(
      culpables,
      `volvio el guard de la pregunta retirada en: ${culpables.join(", ")}. Nadie puede responder "si" desde que se quito el formulario, asi que esa condicion no se cumple nunca.`,
    ).toEqual([]);
  });

  it("ni usa el texto que manda a registrarla arriba", () => {
    // El mensaje es la otra mitad del defecto: aunque la condicion se arregle, una frase que manda a un sitio
    // que ya no existe deja al Integrante buscando un formulario retirado.
    const culpables = FUENTES.filter((f) => {
      const src = sinComentarios(readFileSync(join(process.cwd(), f), "utf8"));
      return src.includes("la venta se habilita") || src.includes("adquiere los nutracéuticos");
    });
    expect(culpables, `queda el mensaje de la pregunta retirada en: ${culpables.join(", ")}`).toEqual([]);
  });

  it("y la seccion de venta se monta con lo prescrito, no con una decision", () => {
    // El control positivo: sin el, borrar la seccion entera tambien dejaria los casos de arriba en verde.
    const pagina = sinComentarios(leer("src/app/(app)/ani-bis-e/[id]/page.tsx"));
    expect(pagina, "la pantalla dejo de montar la venta en consulta").toContain("<VentaEnConsultaSection");
    const i = pagina.indexOf("<VentaEnConsultaSection");
    // Lo que la habilita tiene que ser la PRESCRIPCION, en la misma condicion que la monta.
    expect(pagina.slice(Math.max(0, i - 400), i)).toContain("protocol.nutraceuticals.length > 0");
  });
});

describe("venta-en-consulta-sin-guard-retirado", () => {
  it("un 'no los adquiere por ahora' tampoco bloquea la venta", () => {
    // La compra es un hecho POSTERIOR que contradice esa foto, y es el dato mas nuevo. Bloquearla para
    // proteger la foto seria perder lo que de verdad paso. Y la PANTALLA tiene que hacer lo mismo: si
    // escondiera la venta mientras el servidor la permite, las dos partes dirian cosas opuestas.
    const servicio = sinComentarios(leer("src/modules/payments/services/payments-service.ts"));
    expect(servicio).not.toMatch(/decision === "no"[\s\S]{0,200}CheckoutError/);
    const pagina = sinComentarios(leer("src/app/(app)/ani-bis-e/[id]/page.tsx"));
    expect(pagina, "la pantalla volvio a esconder la venta por la decision").not.toMatch(
      /decision\s*===\s*"no"[\s\S]{0,200}VentaEnConsultaSection/,
    );
  });
});
