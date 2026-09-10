// HISTORIA CLINICA de la consulta (bloques 1 a 3 de catorce). Modulo NEUTRO: presentacional puro, lo
// renderiza la page server. Porte de la HC del v8 (capturas 2026-08-24), con las divergencias anotadas
// donde ocurren.

import type { HcAntecedenteResuelto } from "../data/hc-antecedentes-map";
import { etiquetaDeVia } from "../vias-de-entrega";
import {
  lineaDeReemplazo,
  observacionesVigentes,
} from "@/modules/reports/data/observaciones-vigentes";

// Encabezado de seccion: mayusculas espaciadas, como en su HC.
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">{children}</section>
  );
}

// Celda etiqueta/valor. El valor en negrita, como en su HC.
function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2.5">
      <span className="text-[11px] text-muted-foreground">{etiqueta}</span>
      <span className="text-sm font-semibold text-foreground">{valor}</span>
    </div>
  );
}

export type HcDatosPaciente = {
  paciente: string;
  edad: number | null;
  sexo: string | null;
  pesoKg: number | null;
  tallaCm: number | null;
  fecha: string;
  profesional: string;
  ocupacion: string | null;
};

const SIN_DATO = "No se registró";
// DISTINTO DE `SIN_DATO`, y la diferencia importa en un documento probatorio (cotejo punto 30): "no se
// registró" dice que faltó registrar algo, y "no aplica" dice que el modelo no lo emite para este
// paciente. El sodio salia con el primero, y no era cierto: el motor solo prescribe limite de sodio
// cuando hay condicion que lo pida (HTA, ERC, alteracion hidrica). Su archivo pone un guion ahi; se usa
// la palabra en vez del guion porque un guion en una historia clinica se lee como dato perdido.
const NO_APLICA = "No aplica";

export function HcDatosDelPaciente({ datos }: { datos: HcDatosPaciente }) {
  const edadSexo = [
    datos.edad != null ? `${datos.edad}a` : null,
    datos.sexo === "F" ? "Femenino" : datos.sexo === "M" ? "Masculino" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const pesoTalla = [
    datos.pesoKg != null ? `${datos.pesoKg} kg` : null,
    datos.tallaCm != null ? `${datos.tallaCm} cm` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tarjeta>
      <TituloSeccion>Datos del paciente</TituloSeccion>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta="Paciente" valor={datos.paciente || SIN_DATO} />
        <Dato etiqueta="Edad / Sexo" valor={edadSexo || SIN_DATO} />
        <Dato etiqueta="Peso / Talla" valor={pesoTalla || SIN_DATO} />
        <Dato etiqueta="Fecha" valor={datos.fecha} />
        <Dato etiqueta="Profesional" valor={datos.profesional || SIN_DATO} />
        <Dato etiqueta="Ocupación" valor={datos.ocupacion || SIN_DATO} />
      </div>
    </Tarjeta>
  );
}

export function HcMotivoDeConsulta({ motivos }: { motivos: string[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Motivo de consulta</TituloSeccion>
      {motivos.length > 0 ? (
        // DIVERGENCIA deliberada: su HTML concatena las opciones SIN separador ("Control de
        // pesoRendimiento deportivo"). Se unen con coma; es un defecto de su prototipo, no un formato.
        <p className="text-sm text-foreground">{motivos.join(", ")}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{SIN_DATO}</p>
      )}
    </Tarjeta>
  );
}

// Aviso de PROCEDENCIA. No es un error del sistema y no debe leerse como tal: es informacion sobre de
// donde viene el dato. Por eso va en tono neutro (borde y fondo de la superficie, no ambar ni rojo) y
// dice las dos mitades: el paciente lo declaro, y el diagnostico no lo uso.
function AvisoProcedencia() {
  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      Los datos marcados con <ProcedenciaMarca /> los declaró el paciente en la encuesta y están
      registrados, pero el diagnóstico no los tuvo en cuenta: hoy no alimentan el motor clínico. Tenlos
      presentes al prescribir.
    </p>
  );
}

function ProcedenciaMarca() {
  return (
    <span className="rounded border border-border bg-background px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
      solo registro
    </span>
  );
}

export function HcAntecedentes({
  grupos,
}: {
  grupos: { titulo: string; filas: HcAntecedenteResuelto[] }[];
}) {
  const hayMarcados = grupos.some((g) => g.filas.some((f) => f.declaradoNoConsumido && !f.ausente));
  return (
    <Tarjeta>
      <TituloSeccion>Antecedentes personales</TituloSeccion>
      {grupos.map((g) => {
        // Una fila AUSENTE (la pregunta no existe en esta version de la encuesta) no se pinta: pintarla
        // vacia diria "no se registró" de algo que nunca se preguntó. Un grupo que queda sin filas
        // desaparece entero.
        // AUSENTE: la pregunta no existe en esta version. SOLO-NINGUNA: su guarda (una seccion que solo
        // diria "Ninguna" no se pinta). Un grupo que se queda sin filas desaparece entero.
        const filas = g.filas.filter((f) => !f.ausente && !f.soloNinguna);
        if (filas.length === 0) return null;
        return (
          <div key={g.titulo} className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {g.titulo}
            </span>
            {filas.map((f) =>
              f.comoLista ? (
                <div key={f.id} className="flex flex-wrap items-center gap-1.5">
                  {f.valores.length > 0 ? (
                    f.valores.map((v) => (
                      <span
                        key={v}
                        className="rounded border border-border bg-muted/60 px-2 py-0.5 text-xs text-foreground"
                      >
                        {v}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">{SIN_DATO}</span>
                  )}
                  {f.declaradoNoConsumido ? <ProcedenciaMarca /> : null}
                </div>
              ) : (
                <div key={f.id} className="flex flex-col gap-0.5 rounded-md bg-muted/40 p-2.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {f.etiqueta}
                    {f.declaradoNoConsumido ? <ProcedenciaMarca /> : null}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {f.valores.length > 0 ? f.valores.join(", ") : SIN_DATO}
                  </span>
                </div>
              ),
            )}
          </div>
        );
      })}
      {hayMarcados ? <AvisoProcedencia /> : null}
    </Tarjeta>
  );
}

// Bloques 5 a 7: los tres parrafos del diagnostico. NO se recalculan aqui: los deriva la pagina del
// snapshot sellado (dfiNarrativeFromOutput) y del parrafo de dieta, que es lo mismo que ve el
// Diagnostico. La HC los REUNE, no los vuelve a producir.
//
// Cuando no se pueden emitir (snapshot anterior al porte, o encuesta incompleta), se muestra el MOTIVO en
// vez de un vacio mudo: la seccion aparece con su titulo y dice por que esta vacia. Omitirla haria que el
// documento pareciera completo cuando le falta algo.
function Parrafo({ texto, motivo }: { texto: string | null; motivo: string | null }) {
  if (texto && texto.trim() !== "") {
    return <p className="text-sm leading-relaxed text-foreground">{texto}</p>;
  }
  return <p className="text-sm italic text-muted-foreground">{motivo ?? "No se registró"}</p>;
}

export function HcResumenDiagnostico({
  profesionLabel,
  texto,
  motivo,
}: {
  profesionLabel: string;
  texto: string | null;
  motivo: string | null;
}) {
  return (
    <Tarjeta>
      {/* La PROFESION va en el titulo, como en su HC: el resumen es del profesional que atiende, no uno
          solo. Sale del dato que ya tenemos, nunca cableado. */}
      <TituloSeccion>Resumen diagnóstico · {profesionLabel}</TituloSeccion>
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <Parrafo texto={texto} motivo={motivo} />
      </div>
    </Tarjeta>
  );
}

export function HcDiagnosticoFuncional({ texto, motivo }: { texto: string | null; motivo: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Diagnóstico funcional integrado (DFI)</TituloSeccion>
      <Parrafo texto={texto} motivo={motivo} />
    </Tarjeta>
  );
}

export function HcMetaTerapeutica({ texto, motivo }: { texto: string | null; motivo: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Meta terapéutica</TituloSeccion>
      <Parrafo texto={texto} motivo={motivo} />
    </Tarjeta>
  );
}

// Bloques 8, 9, 13 y 14. Los cuatro salen de datos ya sellados o ya leidos; ninguno recalcula.

// EL OBJETIVO DEL TRATAMIENTO SON DOS PIEZAS, no una (cotejo punto 29, 2026-09-06).
//
// Hasta aqui este bloque mostraba SOLO el texto libre del profesional, asi que en una consulta donde no
// escribio nada la historia clinica decia "No se registró" justo donde su documento encabeza con
// "Dieta Normocalórica de 2408 kcal/día". Y ese renglon no es texto libre: lo calcula el motor, ya sale
// en el panel de tratamiento encima del campo, y es LA PRESCRIPCION. Un documento probatorio no puede
// decir que no se registro un objetivo que el sistema calculo y mostro.
//
// Van los dos, en el orden en que se leen: primero lo que se prescribio, despues lo que el profesional
// añadio. Y "No se registró" queda para el caso en que no hay NINGUNO de los dos, que es cuando de
// verdad falta.
export function HcObjetivoTratamiento({
  modelo,
  texto,
}: {
  modelo: string | null;
  texto: string | null;
}) {
  return (
    <Tarjeta>
      <TituloSeccion>Objetivo del tratamiento</TituloSeccion>
      {modelo ? <p className="text-base font-semibold text-primary">{modelo}</p> : null}
      {texto && texto.trim() !== "" ? (
        <p className="text-sm leading-relaxed text-foreground">{texto}</p>
      ) : null}
      {!modelo && (!texto || texto.trim() === "") ? (
        // "No se registró" y no "no aplica": el objetivo SIEMPRE deberia estar en una consulta con
        // prescripcion; si falta, falta de verdad. Ahora solo aparece cuando faltan LOS DOS.
        <p className="text-sm text-muted-foreground">{SIN_DATO}</p>
      ) : null}
    </Tarjeta>
  );
}

export type HcRuta = { id: string; label: string; activacion: string; prioritaria?: boolean };

export function HcRutasActivadas({ rutas }: { rutas: HcRuta[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Rutas de intervención activadas</TituloSeccion>
      {rutas.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rutas.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-muted/40 p-3">
              <span className="text-sm font-semibold text-primary">
                {r.id} — {r.label}
              </span>
              <p className="text-xs text-muted-foreground">Indicador: {r.activacion}</p>
            </div>
          ))}
        </div>
      ) : (
        // Aqui SI es "no aplica": ninguna ruta activada es un resultado clinico valido, no un hueco.
        <p className="text-sm text-muted-foreground">
          No se activó ninguna ruta de intervención en esta evaluación.
        </p>
      )}
    </Tarjeta>
  );
}

// OBSERVACIONES DEL PROFESIONAL, por instruccion suya (§8.3, 2026-08-26 Parte 2): "Deben aparecer en la
// historia. Y POR CONSULTA, NO POR PACIENTE".
//
// Lo que el diagnostico en su archivo: "notas_profesional aparece UNA SOLA VEZ en todo el archivo,
// ESCRIBIENDO. Nadie la lee, y con onConflict: 'documento' cada control borra el anterior. Lo que el
// profesional escribe hoy se pierde DOS VECES: se sobrescribe y no se muestra".
//
// EN ATLAS SOLO PASABA LA MITAD, y esa mitad estaba viva: las notas SI se guardan bien (tabla propia por
// tratamiento, append-only, con auditoria; no se sobrescriben), pero NO SE MOSTRABAN en ninguna parte
// fuera del panel de tratamiento. O sea que no se perdian, pero tampoco llegaban al documento que es
// probatorio. La otra mitad de su defecto, la del onConflict, nunca la tuvimos.
//
// POR CONSULTA se cumple por construccion: cuelgan del tratamiento de ESTA evaluacion, no del paciente.
export type HcObservacion = {
  id: string;
  note: string;
  /** Fecha ya formateada, para mostrar. La hora NO va: es un documento clinico, no un log. */
  fecha: string;
  /** El instante real (ISO). Decide cual es la vigente; `fecha` solo se muestra. */
  creadaEn: string;
  // LA PROFESION FALTABA EN LA PANTALLA Y ESTABA EN EL PDF, que es una divergencia entre dos superficies
  // del MISMO documento: el PDF decia con que rol se escribio y la pantalla no. Y desde que la vigente es
  // POR PROFESION (su §8), sin ella "vigente" no significa nada: no se sabe vigente de quien.
  profesion: string | null;
};

// SOLO LA VIGENTE DE CADA PROFESION, CON UNA LINEA DE RASTRO (Santiago, 2026-09-08).
//
// LA DECISION Y SU CONTRAPESO. Yo habia puesto TODAS, porque un documento probatorio que enseña solo la
// version corregida esconde que hubo correccion. Santiago prefirio la vigente, con el historico en
// Seguimiento, y resolvio mi objecion con una linea en vez de descartarla.
//
// LA LINEA ES LO QUE HACE QUE EL DOCUMENTO NO MIENTA. Sin ella, un solo parrafo bajo "Observaciones del
// profesional" AFIRMA que eso fue todo lo que se escribio. Con ella, el documento dice que hubo mas,
// cuantas, desde cuando y donde estan, y apunta a un almacen APPEND-ONLY que nadie puede editar despues.
//
// LA REDUCCION NO SE HACE AQUI: viene de `observacionesVigentes`, el mismo modulo que usa el PDF. Dos
// superficies del mismo documento no pueden decidir por separado cual es la vigente.
export function HcObservaciones({ observaciones }: { observaciones: HcObservacion[] }) {
  const vigentes = observacionesVigentes(
    observaciones.map((o) => ({
      id: o.id,
      note: o.note,
      fecha: o.fecha,
      creadaEn: o.creadaEn,
      profesion: o.profesion,
    })),
  );
  return (
    <Tarjeta>
      <TituloSeccion>Observaciones del profesional</TituloSeccion>
      {vigentes.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {vigentes.map((o) => {
            const rastro = lineaDeReemplazo(o);
            return (
              <li key={o.id} className="border-l-2 border-border pl-3">
                <p className="whitespace-pre-line text-sm text-foreground">{o.note}</p>
                <p className="pt-1 text-xs text-muted-foreground">
                  {o.fecha}
                  {o.profesion ? ` · ${o.profesion}` : ""}
                </p>
                {/* EL RASTRO, en el propio documento y no en una nota al pie: quien lea esta observacion
                    tiene que enterarse ahi mismo de que hubo anteriores. */}
                {rastro ? <p className="pt-1 text-xs italic text-muted-foreground">{rastro}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        // No dice "sin observaciones" a secas: en un documento probatorio, un bloque vacio sin explicar
        // deja la duda de si el profesional no escribio nada o si el sistema no lo trajo.
        <p className="text-sm text-muted-foreground">
          El profesional no registró observaciones en esta consulta.
        </p>
      )}
    </Tarjeta>
  );
}


export function HcProximaConsulta({ fecha }: { fecha: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Próxima consulta</TituloSeccion>
      {fecha ? (
        <p className="text-xl font-bold tabular-nums text-primary">{fecha}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin fecha registrada</p>
      )}
    </Tarjeta>
  );
}

/**
 * QUE SE LE ENTREGO AL PACIENTE Y CUANDO (2026-09-09).
 *
 * ES LA PREGUNTA QUE EL CANDADO CONTESTABA MAL. Antes, la prescripcion se bloqueaba al aprobar y eso
 * hacia de constancia por accidente; el precio eran un boton que parecia un tramite, una prescripcion
 * cerrada y una reapertura con motivo para corregir una coma. Ahora la prescripcion sigue abierta y lo
 * que queda registrado es cada SALIDA, que es lo unico que de verdad importaba.
 *
 * Y EL CASO SIN ENTREGA SE DECLARA, no se calla: sin emision, las cifras del documento son las de HOY y
 * pueden cambiar mañana. Un bloque vacio en un documento probatorio se lee como que no habia nada que
 * decir.
 */
/**
 * LAS CIFRAS SELLADAS EN UNA ENTREGA, para distinguirla de otra del mismo dia.
 *
 * NO SE AFIRMA QUE DOS SEAN IGUALES aunque coincidan: el menu, las restricciones o el reparto pudieron
 * cambiar sin mover el objetivo calorico. Se muestran los datos; la conclusion la saca quien lee.
 */
function cifrasDeLaEntrega(e: { kcal: number | null; proteina: number | null }): string {
  return [e.kcal != null ? `${e.kcal} kcal` : null, e.proteina != null ? `${e.proteina} g de proteína` : null]
    .filter(Boolean)
    .join(" · ");
}

export function HcEntregas({
  entregas,
  sinEmitir,
}: {
  entregas: { fecha: string; via: string; kcal: number | null; proteina: number | null }[];
  sinEmitir: boolean;
}) {
  return (
    <Tarjeta>
      <TituloSeccion>Documentos entregados al paciente</TituloSeccion>
      {entregas.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {/* CON HORA Y CON LAS CIFRAS DE ESA SALIDA (2026-09-10). Dos entregas del mismo dia salian como
              dos lineas identicas, y este bloque existe justamente para contestar QUE recibio el paciente.
              La mas reciente va primera y se marca: es la que tiene en la mano. */}
          {entregas.map((e, i) => (
            <li key={e.fecha + e.via} className="flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
              <span className="tabular-nums">{e.fecha}</span>
              <span>· {etiquetaDeVia(e.via)}</span>
              {cifrasDeLaEntrega(e) ? (
                <span className="tabular-nums text-muted-foreground">· {cifrasDeLaEntrega(e)}</span>
              ) : null}
              {i === 0 && entregas.length > 1 ? (
                <span className="text-xs font-medium text-foreground">(la última entregada)</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No consta que se haya entregado ningún plan en esta consulta.
        </p>
      )}
      {sinEmitir ? (
        <p className="text-xs text-muted-foreground">
          Las cifras de esta historia son las vigentes hoy, no las de una entrega: el plan aún no se ha
          entregado y puede cambiar.
        </p>
      ) : null}
    </Tarjeta>
  );
}

export function HcFirmaYFecha({ profesional, fecha }: { profesional: string; fecha: string }) {
  return (
    <Tarjeta>
      <TituloSeccion>Firma y fecha</TituloSeccion>
      {/* Linea EN BLANCO para firmar en papel, como en su HC: no es firma grafica ni acto de firma con
          marca de tiempo, es el pie de un documento que se imprime. */}
      <div className="h-8 border-b border-border" />
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">{profesional || "Profesional de salud"}</span>
        {/* DIVERGENCIA deliberada: su archivo usa la fecha de IMPRESION (new Date()). Una historia clinica
            impresa tres meses despues quedaria fechada tres meses tarde, junto a datos de otra consulta.
            Aqui va la fecha de la EVALUACION. */}
        <span className="text-xs text-muted-foreground">{fecha}</span>
      </div>
    </Tarjeta>
  );
}

// Bloque 10: PLAN NUTRICIONAL. Las ocho celdas de su HC. Siete salen del protocolo sellado; el SODIO no.
export type HcPlanNutricional = {
  /** Limite de sodio del motor de prescripcion. null = el paciente no tiene condicion que lo pida. */
  sodioMax?: number | null;
  geb: number | null;
  get: number | null;
  kcalObjetivo: number | null;
  proteinaG: number | null;
  proteinaGKg: number | null;
  carbohidratosG: number | null;
  grasasG: number | null;
  /** El % que FIJA el profesional; los gramos son su consecuencia. Ver `hc-composicion`. */
  grasasPct: number | null;
  actividadFisica: string | null;
};

export function HcPlanNutricional({
  plan,
  desviaciones = [],
}: {
  plan: HcPlanNutricional | null;
  /**
   * Cifras prescritas fuera de lo que sugiere el diagnostico (P-109). Vacio = no hubo, o no se pudo
   * comparar. Por defecto vacio para que un llamador que no las pase no rompa, pero el candado del
   * SITIO DE LLAMADA verifica que los dos documentos las pasen: el defecto aqui seria la omision.
   */
  desviaciones?: { macro: string; cifra: string; texto: string }[];
}) {
  if (!plan) {
    return (
      <Tarjeta>
        <TituloSeccion>Tratamiento · plan nutricional</TituloSeccion>
        <p className="text-sm text-muted-foreground">
          Esta evaluación todavía no tiene una prescripción nutricional.
        </p>
      </Tarjeta>
    );
  }
  const n = (v: number | null, u: string) => (v == null ? SIN_DATO : `${Math.round(v)} ${u}`);
  return (
    <Tarjeta>
      <TituloSeccion>Tratamiento · plan nutricional</TituloSeccion>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="GEB (Mifflin)" valor={n(plan.geb, "kcal")} />
        <Dato etiqueta="GET" valor={n(plan.get, "kcal")} />
        <Dato etiqueta="Objetivo" valor={plan.kcalObjetivo == null ? SIN_DATO : `${Math.round(plan.kcalObjetivo)} kcal/día`} />
        <Dato
          etiqueta="Proteínas"
          valor={
            plan.proteinaG == null
              ? SIN_DATO
              : `${Math.round(plan.proteinaG)} g/día${plan.proteinaGKg != null ? ` (${plan.proteinaGKg} g/kg)` : ""}`
          }
        />
        <Dato etiqueta="Carbohidratos" valor={plan.carbohidratosG == null ? SIN_DATO : `${Math.round(plan.carbohidratosG)} g/día`} />
        {/* Los gramos Y el porcentaje: el % es la decision y los gramos su consecuencia. */}
        <Dato
          etiqueta="Grasas"
          valor={
            plan.grasasG == null
              ? SIN_DATO
              : `${Math.round(plan.grasasG)} g/día${plan.grasasPct == null ? "" : ` (${plan.grasasPct} %)`}`
          }
        />
        {/* SODIO: YA SE CALCULA. Estuvo en "Pendiente" con un texto que decia "se emitira cuando se
            incorpore el motor de prescripcion nutricional", cierto cuando se escribio y falso desde el
            2026-08-31, cuando ese motor se conecto. Nadie volvio a esta linea: la misma forma que el
            congelamiento vencido de P-50, y la razon por la que un texto que AFIRMA UN ESTADO tiene que
            derivarlo y no declararlo.
            Sin valor va NO_APLICA y no SIN_DATO: el motor solo prescribe limite de sodio cuando hay
            condicion que lo pida (HTA, ERC, alteracion hidrica), asi que su ausencia no es un olvido.
            El comentario ya decia "el guion de no aplica" mientras la linea ponia "No se registró":
            corregir el comentario y dejar la pantalla diciendo lo viejo son DOS sitios, no uno. */}
        <Dato
          etiqueta="Sodio"
          valor={plan.sodioMax == null ? NO_APLICA : `< ${plan.sodioMax.toLocaleString("es-CO")} mg/día`}
        />
        <Dato etiqueta="Actividad física" valor={plan.actividadFisica ?? SIN_DATO} />
      </div>
      {/* CONSTANCIA DE LAS CIFRAS FUERA DE LA REFERENCIA (P-109, porte de su bloque de la HC).
          Su punto 3 del 3-sep: "lo que se escriba fuera del rango queda en la historia clínica con el
          rango, la condición y la razón. No bloquea y no alarma: deja constancia de que fue una decisión."

          POR ESO VA EN `attention` Y NO EN LA CAPA CLINICA: el eje aquí es OPERATIVO, no un veredicto
          sobre el paciente. Pintarlo de rojo clínico diría que la prescripción está mal, y no lo está:
          la cifra la decide el profesional y esto solo registra que la decidió apartándose de lo
          sugerido. Es el mismo criterio del panel de asesoría y del aviso de ciencia anterior. */}
      {desviaciones.length > 0 ? (
        <div className="mt-3 rounded-lg border border-attention bg-attention-bg p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-attention">
            Decisión del profesional: cifras fuera de la referencia
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {desviaciones.map((d) => (
              <li key={d.macro} className="text-xs text-foreground">
                <span className="font-medium">
                  {d.macro} {d.cifra}:
                </span>{" "}
                {d.texto}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Tarjeta>
  );
}

// Bloque 11: RECOMENDACIONES. Bloques condicionales por diagnostico; el que todavia no se puede emitir
// aparece CON SU TITULO diciendo que espera. La seccion existe y se ve que le falta algo, en vez de
// parecer completa.
//
// EL MOTIVO SE CORRIGIO (barrido del 2026-09-01, segundo hallazgo de la misma forma en tres dias): decia
// "se emite con el motor de prescripcion nutricional", y ese motor lleva conectado desde el 31. Al
// arreglarlo la primera vez se corrigio el COMENTARIO del codigo y no el TEXTO DE PANTALLA, que es el que
// alguien lee. Lo que de verdad espera es cual formula de gasto manda (P-32/P-35): su bloque imprime un
// objetivo calorico, y los dos motores calculan uno distinto.
export type HcRecomendacion = { titulo: string; items: string[]; pendiente?: boolean };

export function HcRecomendaciones({ bloques }: { bloques: HcRecomendacion[] }) {
  return (
    <Tarjeta>
      <TituloSeccion>Recomendaciones</TituloSeccion>
      {bloques.map((b) => (
        <div key={b.titulo} className="flex flex-col gap-1">
          <span className="text-sm font-bold text-primary">{b.titulo}</span>
          {b.pendiente ? (
            <span className="text-xs italic text-muted-foreground">
              Pendiente: este bloque cita un objetivo calórico, y los dos motores calculan uno distinto.
              Se emite cuando la Dirección Científica defina cuál manda.
            </span>
          ) : (
            <ul className="ml-4 list-disc text-sm text-foreground">
              {b.items.map((i) => (
                <li key={i} className="leading-relaxed">
                  {i}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Tarjeta>
  );
}

// Bloque 12: REMISIONES Y DERIVACIONES. Las de ESTA consulta. Los examenes solicitados NO son seccion
// aparte: viajan dentro del texto de la remision ("Estudios sugeridos: ...").
//
// LA RAZON DE ARRIBA ERA MEDIA VERDAD, y el cotejo del punto 30 saco la otra mitad. Su HC tiene LAS DOS
// COSAS: los estudios dentro de la frase de la remision (12b) Y un bloque aparte "EXAMENES SOLICITADOS"
// (12c) alimentado por una seleccion del profesional. Concluir "no hay seccion" de la primera era un
// argumento que se sentia como verificacion.
//
// LO QUE SI CIERRA LA PREGUNTA: ese bloque suyo NUNCA SE DIBUJA. Su fuente es
// `localStorage['atlas:examenes_sel:<doc>']`, que su archivo LEE en una sola linea (v8 L15242) y no
// ESCRIBE en ninguna. El objeto sale siempre vacio, `totalExamenesSelec` siempre 0 y la guarda
// `> 0` nunca pasa. Es codigo vivo sobre un dato muerto, como su lista `plan-print-only`.
//
// Asi que no falta nada, pero por otro motivo del que estaba escrito: no es que el bloque no exista en
// su archivo, es que no se renderiza nunca. Si algun dia manda la pantalla que lo alimenta, esto es una
// seccion nueva y no un renglon.
/** Remision que el MODELO exigio (de las rutas activas), con si el profesional la registro o no. La
 *  compone `remisionesExigidas` en `hc-composicion`; el tipo vive aqui, con el resto de los tipos de
 *  bloque, igual que `HcPlanNutricional`. */
export type HcRemisionExigida = {
  /** Rotulo del destinatario, el de las rutas ("Médico", "Educador físico, entrenador, deportólogo"). */
  destino: string;
  /** Urgencia VERBATIM de la ruta; la mas alta si varias rutas remiten al mismo destino. */
  urgencia: string;
  indicaciones: string[];
  /** true si hay un registro del profesional hacia ESE destinatario en esta consulta. */
  registrada: boolean;
};

export type HcRemision = {
  id: string;
  destino: string;
  motivo: string;
  fecha: string;
  retorno: string | null;
};

export function HcRemisiones({
  exigidas,
  remisiones,
}: {
  exigidas: HcRemisionExigida[];
  remisiones: HcRemision[];
}) {
  return (
    <Tarjeta>
      <TituloSeccion>Remisiones y derivaciones</TituloSeccion>

      {/* LO QUE EL MODELO EXIGIO (bloque DERIVADO). Va primero porque no lo decidio nadie: sale del
          diagnostico, y consta aunque el profesional no haya hecho nada. Hasta el 2026-09-06 esto no
          estaba, y la historia clinica de un paciente con una remision OBLIGATORIA activa decia que no
          se habia registrado ninguna: no omitia la derivacion, afirmaba que no la hubo. */}
      {exigidas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Lo que el modelo exigió
          </p>
          {exigidas.map((r) => (
            <div key={r.destino} className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{r.destino}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {/* La urgencia va VERBATIM como la escribe la ruta: es texto clinico, no una etiqueta
                      nuestra. Se resalta la obligatoria, que es la que cambia lo que hay que hacer. */}
                  <span
                    className={
                      /obligatoria/i.test(r.urgencia)
                        ? "rounded-full bg-attention/15 px-2 py-0.5 text-xs font-semibold text-attention-foreground"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {r.urgencia}
                  </span>
                  {/* EL ESTADO ES LO QUE DE VERDAD SE LEE: no "habia que remitir", sino "habia que
                      remitir y no consta que se hiciera". Se DERIVA del registro por destinatario, no
                      es un flag aparte que pueda desincronizarse. */}
                  <span className="text-xs text-muted-foreground">
                    {r.registrada ? "Registrada" : "Sin registrar"}
                  </span>
                </span>
              </div>
              {r.indicaciones.length > 0 ? (
                <ul className="mt-1 list-disc pl-5">
                  {r.indicaciones.map((ind: string) => (
                    <li key={ind} className="text-sm leading-relaxed text-foreground">
                      {ind}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* LO QUE EL PROFESIONAL REGISTRO (bloque REGISTRO), con su fecha y su retorno. */}
      {remisiones.length > 0 ? (
        <div className="flex flex-col gap-2">
          {exigidas.length > 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Lo que el profesional registró
            </p>
          ) : null}
          {remisiones.map((r) => (
            <div key={r.id} className="rounded-md border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{r.destino}</span>
                <span className="text-xs text-muted-foreground">
                  {r.retorno ? `Regresó el ${r.retorno}` : "Sin retorno registrado"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{r.motivo}</p>
              <span className="text-xs text-muted-foreground">Remitido el {r.fecha}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* SOLO CUANDO NO HAY NI LO UNO NI LO OTRO, y ahora la frase puede afirmar las dos cosas porque
          las dos se miraron. Antes decia lo mismo sin haber mirado la primera. */}
      {exigidas.length === 0 && remisiones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          El modelo no exigió remisiones y el profesional no registró ninguna en esta consulta.
        </p>
      ) : null}
    </Tarjeta>
  );
}
// EL TIPO SE QUEDA, EL COMPONENTE SE FUE (Santiago, 2026-09-10). `HcIndicesAniBise` pintaba estos indices
// en una TABLA APARTE debajo de la de Wang, con su propia banda gris y sin padding: se leian como dos
// tablas apiladas que no se parecen. Ahora entran DENTRO de la tabla de Wang como un nivel mas, que es
// como los tiene el archivo de Gildardo, via la prop `bloqueFinal` de `CompositionSection`.
//
// El tipo sigue vivo porque lo produce el reader y lo consume la pagina para armar ese bloque.
//
// Se aplican los MISMOS dos filtros que el resto de la tabla: solo lo alterado (sev >= 1) y nada sin valor.
export type HcIndiceAni = {
  codigo: string;
  nombre: string | null;
  referencia: string;
  valor: string;
  clasificacion: string;
  sev: number;
};

