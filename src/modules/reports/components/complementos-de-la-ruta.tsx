import type { InformeDelPaciente } from "../data/reports-view-types";

// LO QUE LA HOJA DE RUTAS LE DICE AL PACIENTE ADEMAS DE LAS RUTAS (Santiago, 2026-09-19).
//
// SU PEDIDO, literal: que la hoja muestre *"nutraceuticos (que recomienda el modelo y que recomienda el
// profesional) y remisiones (que recomienda el modelo y que recomienda el profesional). En caso de que el
// profesional no recomiende, no se ponen recomendaciones del profesional sino que solo se dejan las
// recomendaciones del modelo."*
//
// ES LA MISMA FUENTE QUE EL INFORME que se envia por correo (`getInformeDelPaciente`), a proposito: el
// papel que el paciente se lleva de la consulta y el correo que recibe despues no pueden decir cosas
// distintas de la misma consulta. Con un solo lector no hay nada que sincronizar.
//
// LOS DOS ORIGENES SE ROTULAN, y esa es la mitad que importa: el modelo SUGIERE y el profesional DECIDE.
// Un listado que los mezclara le haria creer al paciente que su profesional le indico algo que no.

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Lista({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc text-sm text-muted-foreground">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export function ComplementosDeLaRuta({ informe }: { informe: InformeDelPaciente }) {
  const { suplementos, remisiones, seguimiento } = informe;
  const hayAlgo =
    suplementos.delModelo ||
    suplementos.delProfesional.length ||
    remisiones.delModelo.length ||
    remisiones.delProfesional.length ||
    seguimiento.proximaCita;
  if (!hayAlgo) return null;

  return (
    <div className="flex flex-col gap-5">
      {suplementos.delModelo || suplementos.delProfesional.length ? (
        <Bloque titulo="Tus suplementos">
          {suplementos.delModelo ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Lo que sugiere el modelo: </span>
              {suplementos.delModelo}
            </p>
          ) : null}
          {/* SI EL PROFESIONAL NO INDICO NINGUNO, este bloque no aparece: un titulo con una lista vacia se
              lee como un olvido suyo, y lo que hubo fue una decision de no indicar. */}
          {suplementos.delProfesional.length ? (
            <>
              <p className="text-sm font-medium text-foreground">Lo que te indicó tu profesional:</p>
              <Lista
                items={suplementos.delProfesional.map(
                  (s) =>
                    `${s.nombre}${s.dosis ? `: ${s.dosis}` : ""}${
                      s.duracionDias ? ` durante ${s.duracionDias} días` : ""
                    }`,
                )}
              />
            </>
          ) : null}
        </Bloque>
      ) : null}

      {remisiones.delModelo.length || remisiones.delProfesional.length ? (
        <Bloque titulo="Otros profesionales que te pueden acompañar">
          {remisiones.delModelo.length ? (
            <>
              <p className="text-sm font-medium text-foreground">Lo que sugiere el modelo:</p>
              <Lista
                items={remisiones.delModelo.map(
                  (r) => `${r.destino}${r.urgencia ? ` (valoración ${r.urgencia.toLowerCase()})` : ""}`,
                )}
              />
            </>
          ) : null}
          {remisiones.delProfesional.length ? (
            <>
              <p className="text-sm font-medium text-foreground">A quién te remitió tu profesional:</p>
              <Lista items={remisiones.delProfesional.map((r) => r.destino)} />
            </>
          ) : null}
        </Bloque>
      ) : null}

      {seguimiento.proximaCita ? (
        <Bloque titulo="Tu próxima consulta">
          <p className="text-sm text-muted-foreground">{seguimiento.proximaCita}</p>
        </Bloque>
      ) : null}
    </div>
  );
}
