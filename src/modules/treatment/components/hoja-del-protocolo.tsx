import { EncabezadoImpreso, type EncabezadoDeHoja } from "@/components/shared/hoja-imprimible";

import type { PrescripcionNutricional, TreatmentProtocol } from "../data/treatment-view-types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA HOJA DEL PANEL DEL NUTRICIONISTA  ·  V11-3, primer panel (Santiago, 2026-10-24)
//
// *"El boton si, panel por panel, empezando por la subpestana de Nutricionista."*
//
// ═══ POR QUE UN DOCUMENTO Y NO LA PANTALLA MARCADA COMO IMPRIMIBLE ═══
//
// Era el aviso de la dimension (V11-3): *"la regla de impresion NO quita los controles: si una pestaña de
// trabajo se marca imprimible tal cual, en el papel salen los desplegables, los campos de texto y los
// botones, vacios y sin borde"*. El panel del nutricionista es el caso extremo: es un taller de 3.500
// lineas con campos en vivo, grillas editables y barras pegadas al borde. Imprimirlo tal cual no da un
// documento, da una captura de pantalla con los bordes mal.
//
// Asi que lo imprimible es ESTO: los mismos datos, en forma de documento. El panel de trabajo queda
// `no-print` y esta hoja `solo-impresion`, que es el patron que ya usa el archivo de Gildardo con la lista
// de intercambio (`plan-print-only`): en pantalla queda solo el boton, y el documento se ve al imprimirlo.
//
// ═══ ES LA PRESCRIPCION DEL PROFESIONAL, NO EL PLAN DEL PACIENTE ═══
//
// Son dos documentos distintos y los dos existen a proposito. El PLAN (`PlanImprimible`) es lo que el
// paciente se lleva: que comer, cuanto y cuando. ESTO es la prescripcion para la historia clinica: sobre
// que peso se calculo, que energia se fijo, que macros, que limites impuso el modelo y que ya recibio el
// paciente. Un nutricionista que archiva su consulta necesita el segundo; el paciente no.
//
// ═══ LO QUE DICE AL PIE, Y POR QUE NO ES UN DETALLE ═══
//
// Dice que refleja la prescripcion GUARDADA. Y el boton que la imprime esta apagado mientras haya cambios
// sin guardar, diciendolo en su rotulo: un documento clinico que saliera con lo que hay en pantalla pero
// no en la base afirmaria algo que no consta en ningun sitio. Es el hazard 4 de CLAUDE.md (dos partes de
// la pantalla leyendo fuentes distintas) en su version mas caras: en papel, y firmado.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <p className="text-sm text-foreground">
      <span className="text-muted-foreground">{rotulo}:</span> {valor}
    </p>
  );
}

function Lista({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-foreground">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

export function HojaDelProtocolo({
  protocol,
  prescripcion,
  encabezado,
}: {
  protocol: TreatmentProtocol;
  prescripcion: PrescripcionNutricional | null;
  encabezado: EncabezadoDeHoja;
}) {
  // EL PESO META: el fijado manda sobre el calculado, que es la regla de la cadena (migracion 0095, un
  // solo sitio). Y se dice DE DONDE salio, porque no es lo mismo el acordado en la consulta que uno
  // ajustado despues al armar el plan.
  const pesoMeta =
    protocol.pesoMetaFijado != null
      ? `${protocol.pesoMetaFijado} kg (fijado${
          protocol.pesoMetaOrigen === "entrada"
            ? " en la entrada de la consulta"
            : protocol.pesoMetaOrigen === "tratamiento"
              ? " al armar el plan"
              : ""
        })`
      : protocol.pesoCalculo != null
        ? `${protocol.pesoCalculo} kg (el calculado, nadie lo fijó)`
        : "No consta";

  // LOS AJUSTES DEL PROFESIONAL SE DICEN SOLO SI LOS HAY. Una lista de "null" en un documento clinico
  // obliga a leer cinco lineas para enterarse de que no hay nada que leer.
  const ajustes = [
    protocol.adjGeb != null ? `GEB fijado en ${protocol.adjGeb} kcal` : null,
    protocol.adjPal != null ? `PAL fijado en ${protocol.adjPal}` : null,
    protocol.adjKcalObj != null ? `Energía objetivo fijada en ${protocol.adjKcalObj} kcal` : null,
    protocol.adjProtGkg != null ? `Proteína fijada en ${protocol.adjProtGkg} g/kg` : null,
    protocol.adjFatPct != null ? `Grasa fijada en ${protocol.adjFatPct} % de la energía` : null,
    protocol.adjDeficit != null ? `Déficit fijado en ${protocol.adjDeficit} kcal` : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className="solo-impresion space-y-5">
      <EncabezadoImpreso titulo="Prescripción nutricional" encabezado={encabezado} />

      <Bloque titulo="Objetivo del tratamiento">
        <p className="whitespace-pre-line text-sm text-foreground">
          {protocol.objetivoTexto?.trim() || "No se registró un objetivo escrito."}
        </p>
      </Bloque>

      <Bloque titulo="Cadena calórica">
        <Dato
          rotulo="Peso de cálculo"
          valor={
            protocol.pesoCalculo != null
              ? `${protocol.pesoCalculo} kg${
                  protocol.pesoCalculoLabel ? ` · ${protocol.pesoCalculoLabel}` : ""
                }`
              : "No consta"
          }
        />
        <Dato rotulo="Peso meta" valor={pesoMeta} />
        <Dato
          rotulo="Energía objetivo"
          valor={protocol.kcalObjetivo != null ? `${protocol.kcalObjetivo} kcal/día` : "No consta"}
        />
        <Dato
          rotulo="Proteína"
          valor={
            protocol.proteinaGramos != null
              ? `${protocol.proteinaGramos} g/día${
                  prescripcion ? ` · ${prescripcion.protKg} g/kg` : ""
                }`
              : "No consta"
          }
        />
        {protocol.kcalSugerido != null ? (
          <Dato rotulo="Gasto energético medido por el equipo" valor={`${protocol.kcalSugerido} kcal`} />
        ) : null}
        {ajustes.length > 0 ? (
          <>
            {/* LOS AJUSTES DEL PROFESIONAL, SEPARADOS DE LO QUE CALCULO EL MOTOR: en un documento clinico
                importa quien decidio cada cifra. Lo que no se nombra aqui lo puso el modelo. */}
            <p className="mt-1 text-xs text-muted-foreground">Fijado por el profesional:</p>
            <Lista items={ajustes} />
          </>
        ) : null}
      </Bloque>

      {prescripcion && prescripcion.atributos.length > 0 ? (
        <Bloque titulo="Atributos de la prescripción">
          <Lista items={prescripcion.atributos} />
        </Bloque>
      ) : null}

      {prescripcion && prescripcion.filas.length > 0 ? (
        <Bloque titulo="Metas y límites del modelo">
          <ul className="flex flex-col gap-0.5 text-sm text-foreground">
            {prescripcion.filas.map((f) => (
              <li key={f.nombre}>
                {f.nombre}: {f.valor} <span className="text-muted-foreground">({f.ref})</span>
              </li>
            ))}
          </ul>
        </Bloque>
      ) : null}

      {prescripcion && prescripcion.notas.length > 0 ? (
        <Bloque titulo="Notas clínicas del modelo">
          <Lista items={prescripcion.notas} />
        </Bloque>
      ) : null}

      <Bloque titulo="Restricciones del profesional">
        {protocol.restricciones.length > 0 ? (
          <Lista items={protocol.restricciones} />
        ) : (
          <p className="text-sm text-foreground">Ninguna registrada.</p>
        )}
      </Bloque>

      {/* QUE YA RECIBIO EL PACIENTE: es lo que convierte la hoja en un registro y no en una propuesta. Si
          cambia lo que come y ya tenia una version, hay que avisarle (Gildardo §12c), y eso se decide
          mirando esta lista. */}
      <Bloque titulo="Entregas registradas">
        {protocol.emisiones.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-sm text-foreground">
            {protocol.emisiones.map((e, i) => (
              <li key={`${e.fecha}-${i}`}>
                {e.fecha} · {e.via}
                {e.kcal != null ? ` · ${e.kcal} kcal` : ""}
                {e.proteina != null ? ` · ${e.proteina} g de proteína` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground">Esta consulta no ha entregado nada todavía.</p>
        )}
      </Bloque>

      {prescripcion && prescripcion.referencias.length > 0 ? (
        <Bloque titulo="Referencias">
          <Lista items={prescripcion.referencias} />
        </Bloque>
      ) : null}

      <p className="border-t border-border pt-2 text-xs text-muted-foreground">
        Refleja la prescripción guardada en Atlas. El plan que el paciente se lleva es otro documento.
      </p>
    </div>
  );
}
