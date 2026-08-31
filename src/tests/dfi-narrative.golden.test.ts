import { describe, expect, it, vi } from "vitest";

import { runEngine } from "@/clinical-engine";
import {
  dfiCategoriesFromOutput,
  dfiNarrative,
  dfiNarrativeFromOutput,
  type DfiNarrativeInput,
} from "@/clinical-engine/dfi-narrative";
import { normalizeHeader } from "@/modules/bis/services/header-map";
import { buildEngineInput } from "@/modules/clinical-pipeline/services/build-engine-input";

// GOLDEN DIFERENCIAL de la narrativa del DFI (parrafo + metas), pieza 1a.1.
//
// El modulo `dfi-narrative` reconstruye parrafo/metas que el frozen `engine.dfi` dejo sin portar. Este golden
// prueba la PARIDAD contra la PROPIA FUNCION de Gildardo ejecutandose (computeDFI), no contra una lectura del
// codigo ni un texto leido de una captura: se corre el reference y se asserta byte-identico.
//
// REFERENCIA VIGENTE (cuidado a): NO se usa el atlas-dfi.js de la carpeta gildardo-2026-07 (es del 07-23,
// ciencia vieja, y ademas su extracto NO define _DFI_RISK, con lo que la rama de veto ni siquiera corre). Se
// usa `fixtures/reference/dfi-vigente.js`, extraido VERBATIM del ATLAS_v8.html vigente (2026-08-19, L12863-13010).
// computeDFI lee idx.*.l directo (sin clasificadores externos), asi que el extracto es self-contained y redacta
// sobre ciencia vigente.
//
// APPLES-TO-APPLES: el idx que se le pasa al reference se arma con las categorias del vocabulario INTERNO del
// frozen (parseadas de sus cadenas de dominio via dfiCategoriesFromOutput), NO con o.classifications (otro
// vocabulario). Asi el reference recomputa las MISMAS severidades que el frozen y la comparacion de narrativa
// es valida. El test lo verifica explicitamente (assert (1)).

vi.mock("server-only", () => ({}));

import { computeDFI as refComputeDFI } from "./fixtures/reference/dfi-vigente.js";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

const NOW = new Date("2026-06-22T00:00:00Z");
const MODEL = { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" };

function bisRawFromFixture(): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [k, v] of Object.entries(biodyJson as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) raw[normalizeHeader(k)] = v;
  }
  return raw;
}

type RefIdx = Record<string, unknown>;
type RefDfi = {
  domains: { id: string; sev: number; veto?: boolean }[];
  riesgo: { l: string };
  veto: boolean;
  parrafo: string;
  metas: { nutricion: string; medicina: string; ejercicio: string; psicologia: string };
};

const o = runEngine(
  buildEngineInput(
    { sex: "M", birthDate: "1971-11-05", surveyAnswers: [], expectedFieldKeys: ["d2_19"], bisRaw: bisRawFromFixture() },
    MODEL,
    NOW,
  ),
);

// idx para el reference, con las categorias del vocabulario del frozen (mismo origen que el adaptador de la app).
function refIdx(): RefIdx {
  const cat = dfiCategoriesFromOutput(o);
  return {
    ifc: o.indicators.ifc,
    irc: o.indicators.irc,
    iehh: o.indicators.iehh,
    iscm: o.indicators.iscm,
    iae: o.indicators.iae,
    ebBis: o.indicators.eb,
    icaBis: o.indicators.icaBis,
    ifcCl: { l: cat.ifcL },
    ircCl: { l: cat.ircL },
    iehhCl: { l: cat.iehhL ?? "-" },
    iscmCl: { l: cat.iscmL ?? "-" },
    iaeCl: { l: cat.aeL ?? "-" },
    structL: cat.fen,
  };
}

function inputFromRef(ref: RefDfi, idx: RefIdx): DfiNarrativeInput {
  const sevOf = (id: string) => ref.domains.find((d) => d.id === id)?.sev ?? 0;
  const dom4 = ref.domains.find((d) => d.id === "d4");
  const label = (x: unknown) => (x as { l?: string })?.l ?? null;
  return {
    domSev: { d1: sevOf("d1"), d2: sevOf("d2"), d3: sevOf("d3"), d4: sevOf("d4"), d5: sevOf("d5") },
    dom4Veto: Boolean(dom4?.veto),
    veto: ref.veto,
    nivelLabel: ref.riesgo.l,
    ifcL: label(idx.ifcCl) ?? "",
    ircL: label(idx.ircCl) ?? "",
    iehhL: label(idx.iehhCl),
    iscmL: label(idx.iscmCl),
    fen: (idx.structL as string) ?? "",
    aeL: label(idx.iaeCl),
    iae: (idx.iae as number | null) ?? null,
  };
}

describe("DFI narrativa: golden diferencial contra la funcion vigente de Gildardo", () => {
  it("A · fixture real: reference y frozen coinciden en severidades, y la narrativa es byte-identica", () => {
    const idx = refIdx();
    const ref = refComputeDFI({
      idx,
      dv: { fmi: o.indicators.FMI, ffmi: o.indicators.FFMI },
      pt: { edad: 54 },
      icec: { total: o.dfi.le8Total, cl: { l: "-" } },
      perc: {},
      soc: {},
      epi: {},
    }) as RefDfi;

    // (1) apples-to-apples: el reference (redactando sobre las categorias del frozen) produce las MISMAS
    // severidades que el frozen. Si divergen, la comparacion de narrativa no seria valida (otra ciencia).
    //
    // CON UNA EXCEPCION, Y ES LA UNICA AUTORIZADA (CA-6, Gildardo 2026-08-30 §4): donde el frozen ahora
    // devuelve `null` porque el dominio NO SE MIDIO, el reference sigue devolviendo el numero viejo. En
    // este fixture pasa en d5 (ICEC null): el reference da 1 y nosotros ya no puntuamos.
    //
    // NO se relaja la asercion, se ACOTA con su razon, y ademas se aprieta: donde nosotros damos null,
    // el reference tiene que dar EXACTAMENTE el valor que CA-6 sustituyo. Asi el verde no dice "no
    // comparamos ese dominio", dice "la unica diferencia es la que Gildardo autorizo". Si mañana el
    // frozen anulara un dominio por otra razon, o si el reference cambiara ese valor, esto truena.
    // Los valores que CA-6 sustituye, por dominio. d3 es 2 y NO 1, y esa diferencia cuenta una historia
    // que conviene tener fijada: en `computeDFI` un dominio 3 sin clasificación cae al `else` y devuelve
    // 2 ("envejecimiento acelerado"). Hasta CA-7 esa rama era inalcanzable, porque el adaptador fabricaba
    // un IAE de 0 y lo clasificaba "Concordante" (severidad 0, lectura favorable). O sea que el defecto
    // vivo era el 0, y aplicar CA-7 SOLO lo habría convertido en el 2. CA-6 corta los dos.
    const CA6_SUSTITUYE: Record<string, number> = { d1: 1, d2: 1, d3: 2, d5: 1 };
    const refSev = new Map(ref.domains.map((d) => [d.id, d.sev]));
    let anulados = 0;
    for (const d of o.dfi.domains) {
      if (d.sev == null) {
        anulados++;
        expect(
          refSev.get(d.id),
          `${d.id} quedó sin puntuar y el reference no da el valor que CA-6 sustituye`,
        ).toBe(CA6_SUSTITUYE[d.id]);
      } else {
        expect(refSev.get(d.id), `${d.id} diverge fuera de CA-6`).toBe(d.sev);
      }
    }
    // CONTROL: si la anulacion dejara de ocurrir, el bucle de arriba pasaria verde comparando cinco
    // numeros y nadie notaria que CA-6 dejo de aplicarse en el unico fixture que la ejercita.
    expect(anulados, "este fixture ya no ejercita CA-6 en los dos dominios que la ejercitaban").toBe(2);

    // (2) el porte reproduce byte-a-byte el parrafo y las cuatro metas del reference, CON la misma
    // excepcion de CA-6 y ninguna mas: el segmento del dominio que no se midio.
    //
    // No basta con anular la severidad: la prosa la vuelve a afirmar. Con el ICEC ausente, el reference
    // dice "la carga contextual y de estilo de vida es moderada" sobre un dominio que nadie midio, y si
    // solo hubieramos puesto sev=null habria dicho "baja (entorno favorable)", que es peor. Suprimir una
    // cifra no basta si lo derivado sigue visible.
    const mine = dfiNarrativeFromOutput(o);
    const COLA = "El perfil configura un riesgo integrado";
    const cuerpo = (t: string) => t.slice(0, t.indexOf(COLA)).replace(/[.][ ]*$/, "").split("; ");
    const segRef = cuerpo(ref.parrafo);
    const segMio = cuerpo(mine.parrafo);
    const ORDEN = ["d1", "d2", "d3", "d4", "d5"]; // el parrafo lleva un segmento por dominio, en ese orden
    expect(segMio.length, "el parrafo cambio de estructura: revisa este corte").toBe(ORDEN.length);
    expect(segRef.length).toBe(ORDEN.length);

    const sevMia = new Map(o.dfi.domains.map((d) => [d.id, d.sev]));
    for (let k = 0; k < ORDEN.length; k++) {
      if (sevMia.get(ORDEN[k]) == null) {
        // Donde el dominio no se midio, la prosa TIENE que decirlo, y la suya TIENE que seguir afirmando.
        // La segunda mitad es la que da valor: prueba que la divergencia es el defecto que se corrigio y
        // no una diferencia de redaccion nuestra.
        expect(segMio[k], `${ORDEN[k]}: nuestra prosa no dice que no se evaluo`).toContain("no se evaluó");
        expect(segRef[k], `${ORDEN[k]}: el reference dejo de afirmar sobre el vacio`).not.toContain(
          "no se evaluó",
        );
      } else {
        expect(segMio[k], `${ORDEN[k]} diverge fuera de CA-6`).toBe(segRef[k]);
      }
    }
    // LA COLA (riesgo y rutas) TAMBIEN DIVERGE, y esta es la consecuencia CLINICA de CA-6, no un detalle
    // de redaccion: el reference activa la "Ruta 4 (Desaceleración del Envejecimiento)" porque su d3 sin
    // dato vale 2. Nosotros no la activamos, y es lo correcto: no se prescribe desacelerar el
    // envejecimiento de un paciente al que nadie le calculo la edad biologica. Se afirma en las dos
    // direcciones para que ninguna de las dos pueda cambiar sin que esto truene.
    const colaRef = ref.parrafo.slice(ref.parrafo.indexOf(COLA));
    const colaMia = mine.parrafo.slice(mine.parrafo.indexOf(COLA));
    expect(colaRef, "el reference dejo de activar R4 sobre el vacio").toContain("Ruta 4");
    expect(colaMia, "activamos una ruta sobre un dominio no medido").not.toContain("Ruta 4");
    // Y quitando esa ruta, el resto de la cola es byte a byte la suya (mismo nivel de riesgo incluido).
    expect(colaMia).toBe(colaRef.replace("; Ruta 4 (Desaceleración del Envejecimiento), complementaria", ""));
    // Y lo que su prosa afirmaba sobre los dos vacios, para que quede escrito lo que se corrigio:
    expect(ref.parrafo).toContain("su envejecimiento biológico está acelerado (0 años");
    expect(ref.parrafo).toContain("la carga contextual y de estilo de vida es moderada");
    // LAS METAS heredan la misma consecuencia, y aqui es donde mas pesa: la R4 fabricada le ponia a las
    // CUATRO profesiones un objetivo de envejecimiento, y a nutricion y ejercicio ademas una meta medible
    // a 24 semanas ("reducción del IAE de al menos 2 años") sobre un IAE que no existe. Se le estaba
    // prescribiendo trabajo clinico contra un indice no medido.
    const ROLES = ["nutricion", "medicina", "ejercicio", "psicologia"] as const;
    for (const rol of ROLES) {
      const suya = ref.metas[rol];
      const mia = mine.metas[rol];
      // La PRIMERA clausula (la que viene de la R1, que si esta medida) es identica.
      // Sin el punto final: la nuestra cierra ahí y la suya sigue con ";", y esa diferencia es de
      // puntuación, no de contenido.
      const prim = (t: string) => t.split(";")[0].replace(/\.$/, "");
      expect(prim(mia), `${rol}: divergimos en la meta que si corresponde`).toBe(prim(suya));
      // Y la meta MEDIBLE a 24 semanas, que era la peor: "reducción del IAE de al menos 2 años" sobre un
      // IAE que no existe. Solo la llevan nutricion y ejercicio.
      expect(mia, `${rol}: seguimos poniendo una meta medible sobre el IAE`).not.toContain("24 semanas");
      // Y la nuestra trae UNA clausula donde la suya trae DOS: la segunda es la de la R4 fabricada, y
      // cada profesion la redacta distinto ("derivación a geriatría", "sostener hábitos"), asi que se
      // cuenta en vez de buscar una palabra, que dejaria fuera a medicina y psicologia.
      expect(mia.split(";").length, `${rol}: arrastramos la meta del dominio no medido`).toBe(1);
      expect(suya.split(";").length, `${rol}: el reference dejo de prescribir sobre el vacio`).toBe(2);
    }
  });

  it("B · rama de veto conductual: la rama SE EJECUTA (ref.veto true) y la narrativa coincide", () => {
    // Fuerza el veto por conducta: metodos compensatorios (tokens de _DFI_RISK) + perdida de control. Enciende
    // dom4.veto -> _acts R3 pr 0 (critica) y la rama especial de _metaDe (nutricion sin restriccion). Se arma
    // idx desde el fixture y se le agrega la percepcion de riesgo, sin depender de una captura de este escenario.
    const idx = refIdx();
    const ref = refComputeDFI({
      idx,
      dv: { fmi: o.indicators.FMI, ffmi: o.indicators.FFMI },
      pt: { edad: 54 },
      icec: { total: null, cl: { l: "-" } },
      perc: { bodyImage: "muy_delgado", methods: ["vomito", "laxantes"], lossControl: "frecuente", satisfaction: "muy_insatisfecho" },
      soc: {},
      epi: {},
    }) as RefDfi;

    // cuidado (b): la rama de veto realmente se enciende. Si no, el caso no cubriria lo que queremos.
    expect(ref.veto).toBe(true);
    expect(ref.metas.nutricion).toContain("sin restricción ni control del peso");

    const mine = dfiNarrative(inputFromRef(ref, idx));
    expect(mine.parrafo).toBe(ref.parrafo);
    expect(mine.metas).toEqual(ref.metas);
  });
});
