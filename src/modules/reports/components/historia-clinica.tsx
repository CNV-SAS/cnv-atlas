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
