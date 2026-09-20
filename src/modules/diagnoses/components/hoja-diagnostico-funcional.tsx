"use client";

import { Printer } from "lucide-react";

import { EncabezadoImpreso, type EncabezadoDeHoja } from "@/components/shared/hoja-imprimible";
import { imprimirHoja } from "@/components/shared/imprimir-hoja";
import { Button } from "@/components/ui/button";
import type { DfiPaciente } from "@/clinical-engine";

// ═══ EL DIAGNOSTICO FUNCIONAL, COMO DOCUMENTO Y NO COMO CAPTURA (Santiago, 2026-09-19) ═══
//
// LO QUE HABIA: la pestaña se envolvia entera en una hoja imprimible, asi que el papel salia con la
// pantalla de trabajo dentro. Se taparon los botones (`no-print`) y con eso dejo de verse como una
// captura, pero su lectura de fondo seguia en pie: *"una cosa es imprimir la pagina tal cual y otra
// imprimir algo que le sirva al paciente"*.
//
// LO QUE SALE AHORA: el diagnostico EN SU LENGUAJE. Mismo mapa que el informe que recibe por correo
// (`dfiParaPaciente`, porte del de Gildardo): CRITICO pasa a Prioritario, el dominio conductual con
// severidad alta se sustituye por una frase de acompañamiento que no menciona TCA, y ningun indice del
// modelo aparece (§7.1). Y las rutas, ya traducidas por el lector del informe.
//
// ES LA MISMA FUENTE QUE EL CORREO, no una segunda redaccion: el paciente puede tener las dos cosas
// delante (la hoja de la consulta y el correo de despues), y dos versiones del mismo diagnostico se leen
// como dos diagnosticos.
//
// EN PANTALLA SOLO SE VE EL BOTON, como en el plan: el profesional ya tiene arriba toda esta informacion
// en su forma de trabajo, con sus mapas y sus cifras. Repetirla alargaria la pantalla sin aportarle nada.

export type RutaParaElPaciente = { titulo: string; indicaciones: string[]; frecuencia: string | null };

export function HojaDiagnosticoFuncional({
  encabezado,
  dfi,
  rutas,
}: {
  encabezado: EncabezadoDeHoja;
  /** El DFI ya traducido. null = el diagnóstico está incompleto y no se emite nada (D-007). */
  dfi: DfiPaciente | null;
  rutas: RutaParaElPaciente[];
}) {
  // SIN DFI NO HAY HOJA, y no es un descuido: con la encuesta incompleta el modelo no emite el DFI
  // (decisión de Gildardo, D-007), y una hoja a medias en la mano del paciente es peor que ninguna.
  if (!dfi) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">Imprimir el diagnóstico para entregarlo</h3>
          <p className="max-w-prose text-xs text-muted-foreground">
            La hoja que el paciente se lleva: su diagnóstico en lenguaje claro, sin índices ni códigos. Es
            el mismo que le llega en el informe.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={(e) => imprimirHoja(e.currentTarget)}
        >
          <Printer className="size-4" aria-hidden />
          Imprimir el diagnóstico
        </Button>
      </div>

      {/* EL DOCUMENTO: vive en el DOM, invisible en pantalla, y es lo único que sale al imprimir. */}
      <div className="solo-impresion imprimible flex-col gap-5">
        <EncabezadoImpreso titulo="Tu diagnóstico funcional" encabezado={encabezado} />

        <section className="flex flex-col gap-2 break-inside-avoid">
          <h3 className="text-sm font-semibold text-foreground">Cómo estás</h3>
          <p className="text-sm text-foreground">
            <span className="font-semibold">{dfi.riesgo}.</span> {dfi.enfoque}
          </p>
          {/* CADA DOMINIO CON SU LECTURA, que es la frase que el mapa de Gildardo escribe para el
              paciente. El nivel solo, sin la frase, es una etiqueta que no dice que hacer con ella. */}
          {dfi.dominios.map((d) => (
            <p key={d.id} className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{d.dominio}</span>
              {d.nivel ? ": " + d.nivel : ""}. {d.lectura}
            </p>
          ))}
          {dfi.acompanamiento ? (
            <p className="text-sm text-muted-foreground">{dfi.acompanamiento}</p>
          ) : null}
        </section>

        {rutas.length > 0 ? (
          <section className="flex flex-col gap-2 break-inside-avoid">
            <h3 className="text-sm font-semibold text-foreground">Lo que vas a trabajar</h3>
            {rutas.map((r) => (
              <div key={r.titulo} className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">{r.titulo}</p>
                {r.indicaciones.map((i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    · {i}
                  </p>
                ))}
                {r.frecuencia ? (
                  <p className="text-sm text-muted-foreground">Control: {r.frecuencia.toLowerCase()}.</p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
