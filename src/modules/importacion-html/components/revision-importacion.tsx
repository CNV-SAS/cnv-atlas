"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { revisarArchivoAction, type RevisionState } from "../actions";
import type { RevisionDePaciente } from "../services/revisar-lote";

// LA REVISION DE UN LOTE DEL HTML (sesion 3). Sube el archivo que mando el profesional y muestra, por
// paciente, lo que hay que saber antes de importar. NO GUARDA NADA: se puede revisar las veces que haga falta.
//
// Estado de proceso, no veredicto clinico: los avisos van en ambar (algo que mirar), nunca en los colores de
// la capa clinica, que significan un resultado sobre el paciente.

const inicial: RevisionState = { error: null, resultado: null };

const ETIQUETA_CRUCE: Record<RevisionDePaciente["cruce"]["tipo"], string> = {
  nuevo: "Nuevo en Atlas",
  existe: "Ya existe en Atlas",
  parecido: "Se parece a otro paciente",
};

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-clinical-warning/40 bg-clinical-warning-bg px-2 py-0.5 text-xs text-clinical-warning">
      {children}
    </span>
  );
}

function Neutro({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground">{children}</span>;
}

function FichaDePaciente({ p }: { p: RevisionDePaciente }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{p.nombre || "Sin nombre"}</span>
        <span className="text-sm text-muted-foreground">{p.documento}</span>
        {p.cruce.tipo === "parecido" ? <Aviso>{ETIQUETA_CRUCE.parecido}</Aviso> : <Neutro>{ETIQUETA_CRUCE[p.cruce.tipo]}</Neutro>}
        {p.menorDeEdad ? <Aviso>Menor de edad al firmar</Aviso> : null}
        {p.fechaNacimientoImposible ? (
          <Aviso>Fecha de nacimiento imposible ({p.fechaNacimiento}): posterior a su primera consulta</Aviso>
        ) : null}
      </div>
      {p.cruce.tipo === "existe" ? (
        <p className="text-sm text-muted-foreground">
          Coincide con {p.cruce.nombre || "un paciente sin nombre"}. Al importar, el profesional confirma el orden de
          las consultas.
        </p>
      ) : null}
      {p.cruce.tipo === "parecido" ? (
        <p className="text-sm text-clinical-warning">
          No se une ni se crea nada hasta revisarlo. Parecido a:{" "}
          {p.cruce.candidatos.map((c) => `${c.nombre || "sin nombre"} (${c.documento})`).join("; ")}.
        </p>
      ) : null}
      {p.problemas.map((x) => (
        <p key={x} className="text-sm text-clinical-warning">
          {x}
        </p>
      ))}
      {p.informesEnviados.length ? (
        <p className="text-sm text-muted-foreground">
          {p.informesEnviados.length === 1 ? "Trae 1 informe enviado al paciente" : `Trae ${p.informesEnviados.length} informes enviados al paciente`}
          {" "}({p.informesEnviados.map((x) => `consulta del ${x.fechaConsulta ?? "(sin fecha)"}, enviado el ${x.fechaEnvio ?? "(sin fecha)"}`).join("; ")}). No
          es una consulta y no se importa: lo escribió el motor del HTML, con recomendaciones que Atlas ya no
          admite.
        </p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {p.consultas.map((c, i) => (
          <li key={`${c.fecha}-${i}`} className="flex flex-col gap-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground">Consulta del {c.fecha ?? "(sin fecha)"}</span>
              {/* INFORMATIVO (Santiago, 2026-09-22): muchos nombres se escribieron en pruebas, y algunos de
                  esos profesionales ni existen. La cuenta a la que va cada consulta la decide el admin al
                  importar; de aqui no sale ninguna sugerencia. */}
              {c.profesional ? (
                c.deOtroProfesional ? <Aviso>Hecha por {c.profesional}, no por quien exportó</Aviso> : <Neutro>Hecha por {c.profesional}</Neutro>
              ) : null}
              {c.consentimiento.firmado ? (
                <Neutro>
                  Firmada por {c.consentimiento.nombre}
                  {c.consentimiento.nombreDistinto ? " (un nombre distinto al del paciente)" : ""}
                </Neutro>
              ) : (
                <Aviso>Sin firma del consentimiento</Aviso>
              )}
              {!c.medicion.tiene ? (
                <Neutro>Sin medición BIS</Neutro>
              ) : c.medicion.faltan.length ? (
                <Aviso>A la medición le falta: {c.medicion.faltan.join(", ")}</Aviso>
              ) : (
                <Neutro>Medición completa</Neutro>
              )}
              {c.preguntasSinResponder > 0 ? <Neutro>{c.preguntasSinResponder} sin responder</Neutro> : null}
              {c.respuestasDeVersionAnterior > 0 ? (
                <Neutro>
                  {c.respuestasDeVersionAnterior === 1
                    ? "1 respuesta con el texto de una versión anterior de la encuesta"
                    : `${c.respuestasDeVersionAnterior} respuestas con el texto de una versión anterior de la encuesta`}
                </Neutro>
              ) : null}
            </div>
            {c.medicion.respaldo.length ? (
              <p className="text-muted-foreground">
                {c.medicion.respaldo
                  .map((x) => `${x.campo === "cintura" ? "La cintura" : "La cadera"} sale de ${x.fuente === "excel_guardado" ? "el Excel del Biody guardado" : "lo guardado a mano"} del paciente`)
                  .join("; ")}
                : es un solo valor por paciente, así que solo vale para su consulta más reciente.
              </p>
            ) : null}
            {c.respuestasQueNoCalzan.length ? (
              <p className="text-clinical-warning">
                Respuestas que no calzan con la encuesta de hoy:{" "}
                {c.respuestasQueNoCalzan.map((r) => `${r.clave}: ${r.valor}`).join("; ")}.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

export function RevisionImportacion() {
  const [state, action, pending] = useActionState(revisarArchivoAction, inicial);
  const r = state.resultado;
  const pacientes = r?.revision.pacientes ?? [];
  const consultas = pacientes.flatMap((p) => p.consultas);
  const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3">
        <label htmlFor="archivo-html" className="text-sm font-medium">
          Archivo que exportó el profesional (.json)
        </label>
        <Input id="archivo-html" name="archivo" type="file" accept=".json,application/json" required disabled={pending} />
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Revisando..." : "Revisar el archivo"}
        </Button>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      </form>

      {r ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <span className="font-medium text-foreground">
              {r.archivo.nombre} · {(r.archivo.tamano / 1024).toFixed(0)} KB · exportado el{" "}
              {r.revision.exportadoEn.slice(0, 10)}
            </span>
            <span className="text-muted-foreground">
              Declaración del profesional, versión {r.revision.declaracion.version}, aceptada el{" "}
              {r.revision.declaracion.aceptadaEn.slice(0, 10)}. Huella del archivo: {r.archivo.hash.slice(0, 16)}…
            </span>
            <span className="text-foreground">
              {cuenta(pacientes.length, "paciente", "pacientes")} · {cuenta(consultas.length, "consulta", "consultas")} ·{" "}
              {cuenta(pacientes.filter((p) => p.cruce.tipo === "existe").length, "ya existe", "ya existen")} ·{" "}
              {cuenta(pacientes.filter((p) => p.cruce.tipo === "parecido").length, "parecido", "parecidos")} ·{" "}
              {cuenta(consultas.filter((c) => !c.consentimiento.firmado).length, "consulta sin firma", "consultas sin firma")}
            </span>
            {r.revision.exportadoPor ? (
              <span className="text-muted-foreground">
                Lo exportó {r.revision.exportadoPor}. Profesionales que aparecen en las consultas:{" "}
                {r.revision.profesionalesDelArchivo.join(", ") || "ninguno"}. Es informativo: la cuenta a la que
                va cada consulta la eliges tú al importar.
              </span>
            ) : null}
            <span className="text-muted-foreground">Esta revisión no guarda nada.</span>
          </div>
          {r.revision.documentosRepetidosEnElArchivo.length ? (
            <p className="text-sm text-clinical-warning">
              El archivo trae el mismo documento más de una vez (puede venir de dos navegadores):{" "}
              {[...new Set(r.revision.documentosRepetidosEnElArchivo)].join(", ")}.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {pacientes.map((p, i) => (
              <FichaDePaciente key={`${p.documento}-${i}`} p={p} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
