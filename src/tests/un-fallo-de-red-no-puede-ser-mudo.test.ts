import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ UN FALLO DE RED EN EL TELEFONO DEL PACIENTE NO PUEDE SER MUDO (Sentry, 13 y 15 de octubre) ═══
//
// EL DEFECTO, que es de una clase que ni tsc ni lint ni jsdom ven, porque no es un error de codigo sino
// una RAMA QUE NADIE ESCRIBIO:
//
// Las acciones de servidor de las pantallas del paciente ya atrapan lo que falla EN EL SERVIDOR (un hipo
// del pooler, un 502 de Supabase) y devuelven un mensaje con palabras. Pero si el telefono pierde la red,
// la peticion NO LLEGA: la accion no corre, su `catch` tampoco, y lo que se rechaza es la promesa que
// despacha `useActionState`. Ese rechazo no pasa por ningun `fail()`, asi que el `error` del estado se
// queda en NULL y la pantalla no dice nada: el boton vuelve de "Enviando..." a "Enviar" y ahi se queda.
//
// LOS DOS EVENTOS REALES, los dos en el POST de /encuesta/:token desde un telefono:
//   · "TypeError: Load failed" (Safari, 15-oct), justo tras tocar el `select[name="sex"]`, que es de la
//     pantalla de FIRMAR;
//   · "NetworkError when attempting to fetch resource" (Firefox, 13-oct, 4 eventos), sobre un submit.
//
// Y EL RASTRO QUE DEJA CONFUNDE A TODOS: el autoguardado si alcanzo a escribir respuestas parciales, asi
// que la evaluacion queda esperando su encuesta CON datos dentro. El paciente cree que entrego y la
// profesional ve una encuesta a medias que no sabe de donde salio. Es el caso del 22-oct.
//
// POR QUE ESTE CANDADO ES DE CODIGO FUENTE: lo que hay que garantizar es que la rama EXISTA en cada una
// de las pantallas publicas. Simular un fetch caido dentro de `useActionState` en jsdom probaria React,
// no esto; y el defecto no era que la rama estuviera mal, era que no estaba. Lo que se exige de cada una:
// que envuelva sus acciones, que el catch produzca un mensaje para la persona, y que REPORTE a Sentry
// (atrapar el error lo saca del camino que lo reportaba solo, asi que taparlo en pantalla no puede
// costarnos la visibilidad).

const leer = (p: string) => readFileSync(p, "utf8");

/** Las pantallas que corren en el telefono de un paciente o de su representante. */
const PANTALLAS = [
  {
    nombre: "la encuesta (fase 2): enviar y autoguardar",
    archivo: "src/modules/evaluations/components/survey-phase-form.tsx",
    envoltorios: ["envioConRed", "guardadoConRed"],
    // Las cuatro combinaciones: paciente y profesional, enviar y guardar.
    acciones: [
      "ENVIAR_DEL_PACIENTE",
      "ENVIAR_DEL_PROFESIONAL",
      "GUARDAR_DEL_PACIENTE",
      "GUARDAR_DEL_PROFESIONAL",
    ],
  },
  {
    nombre: "la firma (fase 1): firmar, pedir el codigo y comprobarlo",
    archivo: "src/modules/evaluations/components/sign-phase-form.tsx",
    envoltorios: ["FIRMAR_CON_RED", "ENVIAR_CODIGO_CON_RED", "COMPROBAR_CODIGO_CON_RED"],
    acciones: ["FIRMAR_CON_RED", "ENVIAR_CODIGO_CON_RED", "COMPROBAR_CODIGO_CON_RED"],
  },
  {
    nombre: "el consentimiento presencial (QR): confirmar",
    archivo: "src/modules/consent/components/consentimiento-qr.tsx",
    envoltorios: ["CONFIRMAR_CON_RED"],
    acciones: ["CONFIRMAR_CON_RED"],
  },
] as const;

describe("un fallo de red no puede ser mudo en las pantallas del paciente", () => {
  for (const p of PANTALLAS) {
    describe(p.nombre, () => {
      it("cada accion que despacha pasa por un envoltorio, no cruda", () => {
        const src = leer(p.archivo);
        for (const envoltorio of p.envoltorios) expect(src).toContain(envoltorio);
        // NINGUNA accion del servidor entra DIRECTA en useActionState: ahi es donde se perdia el rechazo.
        const despachos = [...src.matchAll(/useActionState\(\s*([^,]+),/g)].map((m) => m[1].trim());
        expect(despachos.length, "esta pantalla tiene que despachar algo").toBeGreaterThan(0);
        for (const d of despachos) {
          const envuelta = p.acciones.some((a) => d.includes(a));
          expect(envuelta, `useActionState recibe "${d}" sin envolver`).toBe(true);
        }
      });

      it("el catch produce un mensaje para la persona y reporta a Sentry", () => {
        const src = leer(p.archivo);
        expect(src).toContain("reportClientError");
        // Tantos reportes como envoltorios: uno que atrape sin reportar nos deja ciegos justo ahi.
        // El import no cuenta: ahi el nombre va sin parentesis, asi que solo se cuentan las LLAMADAS.
        const reportes = src.split("reportClientError(").length - 1;
        expect(reportes, "falta reportar en algun catch").toBeGreaterThanOrEqual(
          p.envoltorios.length,
        );
        // Y EL MENSAJE HABLA DE LA CONEXION, no "error inesperado": en un telefono, decir que se cayo la
        // conexion es lo unico que lleva a la accion correcta (mirar el internet y volver a pulsar).
        expect(src).toMatch(/se cayó la conexión/);
        // SIN PROMETER LO QUE NO SE SABE: en el envio final NO se puede decir "ya quedo entregada".
        expect(src).toMatch(/vuelve a (pulsar|intentarlo)/);
      });
    });
  }

  it("el reportador de cliente existe aparte, porque el del servidor es server-only", () => {
    // Si alguien intenta reusar `report-error.ts` desde un componente cliente, rompe la frontera RSC (y
    // `pnpm check:rsc` lo caza). El hermano de cliente existe para que no haya que elegir entre reportar
    // y respetar la frontera.
    const cliente = leer("src/lib/observability/report-client-error.ts");
    // Como SENTENCIA, no como mencion: el comentario de ese archivo nombra "server-only" para explicar
    // por que existe, y eso no es un import.
    expect(cliente).not.toMatch(/^import "server-only"/m);
    expect(cliente).toContain("Sentry.captureException");
    expect(leer("src/lib/observability/report-error.ts")).toMatch(/^import "server-only"/m);
  });

  it("el aviso del envio de la encuesta se lleva a la vista, porque el boton esta abajo", () => {
    // El recuadro del error vive ARRIBA del formulario y "Enviar" esta al final de una seccion larga. Un
    // mensaje fuera de la pantalla no existe: el paciente pulsa, no ve nada, y se va. Ese fue el desenlace
    // del caso real.
    const src = leer("src/modules/evaluations/components/survey-phase-form.tsx");
    const efecto = src.slice(src.indexOf("if (state.error) scrollTop()"));
    expect(efecto.slice(0, 120)).toContain("state.error");
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(state\.error\) scrollTop\(\);/);
  });

  it("y las acciones del servidor siguen distinguiendo el redirect de un fallo", () => {
    // El exito de la encuesta es un `redirect`, que VIAJA COMO EXCEPCION. El envoltorio de cliente no lo
    // ve (el redirect lo resuelve el router, no un throw en el cliente), pero el del servidor si: si
    // alguien quitara ese guard, enviar bien se veria como un fallo. Candado de la forma, ya existente,
    // repetido aqui porque ahora hay DOS capas de catch sobre el mismo camino y se leen juntas.
    const src = leer("src/modules/evaluations/actions.ts");
    expect(src.split("if (esRedirectDeNext(e)) throw e;").length - 1).toBeGreaterThanOrEqual(2);
  });
});
