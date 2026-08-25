// HISTORIA CLINICA de la consulta (bloques 1 a 3 de catorce). Modulo NEUTRO: presentacional puro, lo
// renderiza la page server. Porte de la HC del v8 (capturas 2026-08-24), con las divergencias anotadas
// donde ocurren.

import type { HcAntecedenteResuelto } from "../data/hc-antecedentes-map";

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
        const filas = g.filas.filter((f) => !f.ausente);
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

export function HcObjetivoTratamiento({ texto }: { texto: string | null }) {
  return (
    <Tarjeta>
      <TituloSeccion>Objetivo del tratamiento</TituloSeccion>
      {texto && texto.trim() !== "" ? (
        <p className="text-base font-semibold text-primary">{texto}</p>
      ) : (
        // "No se registró" y no "no aplica": el objetivo SIEMPRE deberia estar en una consulta con
        // prescripcion; si falta, falta de verdad.
        <p className="text-sm text-muted-foreground">{SIN_DATO}</p>
      )}
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
  geb: number | null;
  get: number | null;
  kcalObjetivo: number | null;
  proteinaG: number | null;
  proteinaGKg: number | null;
  carbohidratosG: number | null;
  grasasG: number | null;
  actividadFisica: string | null;
};

export function HcPlanNutricional({ plan }: { plan: HcPlanNutricional | null }) {
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
        <Dato etiqueta="Grasas" valor={plan.grasasG == null ? SIN_DATO : `${Math.round(plan.grasasG)} g/día`} />
        {/* SODIO: pendiente A PROPOSITO, y se dice. El limite lo fija el motor de prescripcion que aun no
            se porta, y ese porte lo CAMBIA (2.300 -> 1.500 mg en el hipertenso). Imprimir hoy un valor que
            el porte va a contradecir, en un documento clinico, es peor que dejarlo pendiente. Se distingue
            del guion de "no aplica" con la palabra: el suyo sale vacio cuando el paciente no es hipertenso;
            el nuestro sale asi para TODOS, y por otra razon. */}
        <div className="flex flex-col gap-0.5 rounded-md border border-dashed border-border bg-muted/20 p-2.5">
          <span className="text-[11px] text-muted-foreground">Sodio</span>
          <span className="text-sm font-semibold text-muted-foreground">Pendiente</span>
        </div>
        <Dato etiqueta="Actividad física" valor={plan.actividadFisica ?? SIN_DATO} />
      </div>
      <p className="text-xs text-muted-foreground">
        El límite de sodio se emitirá cuando se incorpore el motor de prescripción nutricional. No es que
        este paciente no lo tenga: todavía no se calcula.
      </p>
    </Tarjeta>
  );
}

// Bloque 11: RECOMENDACIONES. Bloques condicionales por diagnostico; los que aun dependen del motor de
// prescripcion aparecen CON SU TITULO diciendo que esperan. La seccion existe y se ve que le falta algo,
// en vez de parecer completa.
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
              Pendiente: se emite con el motor de prescripción nutricional.
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
