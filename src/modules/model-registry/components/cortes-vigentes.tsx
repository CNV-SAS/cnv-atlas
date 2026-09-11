import { TituloSeccion } from "@/components/shared/titulo-pantalla";
import { tabla, td, th, theadTr, tr } from "@/components/shared/tabla";

import { cortesVigentes } from "../motor-vigente";

// ═══ LOS CORTES VIGENTES, LOS DOCE DE UNA VEZ ═══
//
// HOY SOLO SE VEN DE UNO EN UNO Y DENTRO DE UN PACIENTE: la tabla de indices del Diagnostico muestra la
// referencia de cada indicador junto a SU valor. Para responder "contra que se clasifica el IRC" hay que
// abrir a alguien, y si ese alguien es mujer solo se ve la mitad.
//
// DOS COLUMNAS Y NO UNA, porque son dos cosas distintas y confundirlas ya costo una entrega:
//   · REFERENCIA es el texto verbatim de SU historia clinica: el umbral que el imprime al lado del valor.
//   · BANDAS son los cortes COMPLETOS del clasificador que corre, re-encodados por nosotros y con candado
//     contra el frozen (`indicator-ranges.test.ts` prueba cada frontera).
// Cuando las dos dicen lo mismo, la de bandas solo añade los tramos intermedios. Cuando NO dicen lo mismo
// hay algo que mirar, y ponerlas juntas es lo que lo hace visible: asi se encontro, el dia que se monto
// esta pantalla, que la referencia del IRC llevaba doce dias citando los cortes de antes del 2026-08-29.
//
// NO TODOS TIENEN BANDAS, y la ausencia es correcta, no un hueco: el PABU y el ICA-BIS son referencia de
// PUNTO (φ y la coherencia 0), y la EB-BIS se compara con la edad cronologica de cada persona. Se dice en
// la propia celda en vez de dejarla vacia, que se leeria como dato que falta.

export function CortesVigentes() {
  const cortes = cortesVigentes();

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <TituloSeccion>Los cortes vigentes</TituloSeccion>
        <p className="text-muted-foreground">
          Contra qué se clasifica cada indicador, por sexo. Es lo que el motor aplica hoy; dentro de un
          paciente se ve lo mismo, pero solo el suyo.
        </p>
      </header>

      <div className="overflow-x-auto border border-border bg-card">
        <table className={tabla}>
          <thead>
            <tr className={theadTr}>
              <th className={th}>Indicador</th>
              <th className={th}>Referencia (hombre)</th>
              <th className={th}>Referencia (mujer)</th>
              <th className={th}>Bandas del clasificador</th>
            </tr>
          </thead>
          <tbody>
            {cortes.map((c) => (
              <tr key={c.codigo} className={tr}>
                <td className={td}>
                  <span className="font-medium text-foreground">{c.codigo}</span>
                  {c.nombre ? (
                    <span className="ml-2 text-muted-foreground">{c.nombre}</span>
                  ) : null}
                </td>
                <td className={td}>{c.referenciaH ?? "—"}</td>
                <td className={td}>{c.referenciaM ?? "—"}</td>
                <td className={td}>
                  {c.bandasH == null ? (
                    <span className="text-muted-foreground">Referencia de punto, sin bandas</span>
                  ) : c.bandasH === c.bandasM ? (
                    c.bandasH
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      <span>H: {c.bandasH}</span>
                      <span>M: {c.bandasM}</span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
