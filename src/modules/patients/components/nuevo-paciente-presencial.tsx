"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { buildResumeUrl } from "@/modules/evaluations/resume-url";
import {
  abrirEvaluacionEnConsultaAction,
  enlaceEncuestaPendienteAction,
} from "@/modules/evaluations/actions";
import { ConsultorioLink } from "@/modules/evaluations/components/consultorio-link";
import type { StartFollowupState } from "@/modules/evaluations/validations";

import { PaseQrPresencial } from "./pase-qr-presencial";
import { verificarDocumentoAction } from "../actions";
import type { VerificarDocumentoState } from "../types";

// CREAR UN PACIENTE EN CONSULTA · MODALIDAD 1 (dictamen legal 2026-09-08).
//
// EL ORDEN ES LO QUE HACE VALIDO EL ACTO, y por eso la pantalla es una secuencia y no un formulario:
// consentimiento PRIMERO, encuesta DESPUES. La Ley 1581 exige autorizacion previa a la recoleccion, asi
// que no se puede escribir una sola respuesta de salud antes de la firma.
//
// EL DOCUMENTO VA ANTES QUE TODO. No es una validacion mas: es lo que decide cual de los tres caminos
// aplica, y sin preguntarlo los tres terminan en un error de base de datos en la cara del profesional.
//
// Y LA ENCUESTA NO SE RESPONDE AQUI DENTRO. Al firmar se entrega el enlace publico para abrirlo aparte:
// el paciente va a tener el dispositivo en la mano, y dentro de la app autenticada ese dispositivo es la
// sesion del profesional, con acceso a la historia de todos sus pacientes. El enlace de reanudacion abre
// SU encuesta y nada mas.

const inicialDocumento: VerificarDocumentoState = {
  error: null,
  veredicto: null,
  documentType: null,
  documentNumber: null,
  patientId: null,
  evaluacionPendienteId: null,
};

const inicialSeguimiento: StartFollowupState = {
  error: null,
  resumeToken: null,
  revoked: false,
  reanudar: false,
};

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
];

export function NuevoPacientePresencial() {
  const [documento, verificar, verificando] = useActionState(
    verificarDocumentoAction,
    inicialDocumento,
  );
  // El paciente firmo aqui mismo, o se retomo/abrio una evaluacion de un paciente que ya era suyo. En los
  // tres casos lo que queda por hacer es lo mismo: pasarle el enlace de la encuesta.
  const [resumeToken, setResumeToken] = useState<string | null>(null);

  if (resumeToken) {
    return <ParaElPaciente resumeToken={resumeToken} />;
  }

  // ── EL DOCUMENTO ESTA LIBRE: UNA SOLA VIA, Y UNA SALIDA ──────────────────────────────────────────
  //
  // LA MODALIDAD 1 SE RETIRA (2026-09-09). Consistia en que el paciente marcara y digitara su codigo en
  // la pantalla del profesional. Lo verificamos y no aporta nada que el enlace del consultorio no de: la
  // cadena probatoria es la MISMA (el codigo llega a su correo y lo digita el), y el sello de canal
  // registraba DONDE estaba, que no forma parte de esa cadena y que ademas no puede registrar lo unico
  // que importaria, que es quien tenia el dispositivo.
  //
  // ASI QUE ESTA PANTALLA QUEDA PARA UN SOLO CASO: el paciente SIN correo. Y el que si tiene correo no se
  // queda en un callejon: se le dice que use el enlace del consultorio y se le da ahi mismo.
  if (documento.veredicto === "libre" && documento.documentNumber) {
    return (
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground">
            Documento libre: {documento.documentType} {documento.documentNumber}
          </p>
          <p className="text-sm text-muted-foreground">
            Nadie con ese documento está registrado en la organización, así que se puede crear.
          </p>
        </section>

        {/* LA SALIDA DEL QUE SI TIENE CORREO, con el enlace a mano. Antes esta pantalla lo mandaba a un
            aviso sin salida; y peor, ese aviso acabo tapando la via nueva. Aqui la via normal es la
            primera que se ofrece, porque es la que mas fuerza probatoria tiene. */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">Si el paciente tiene correo</h2>
            <p className="text-sm text-muted-foreground">
              Usa el enlace de consultorio, como siempre. Es la vía con más respaldo: el código le llega a
              su correo y lo digita él, y eso es lo que prueba que fue él quien autorizó. Ábrelo en otra
              pestaña y pásale el dispositivo, o pásale el enlace.
            </p>
          </div>
          <ConsultorioLink />
        </section>

        {/* Y LA VIA NUEVA, SOLO PARA QUIEN NO TIENE CORREO. El aviso del telefono no es un detalle: sin un
            dispositivo propio esta via tampoco sirve, y descubrirlo a mitad del acto es peor que saberlo
            antes. */}
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">Si el paciente no tiene correo</h2>
            <p className="text-sm text-muted-foreground">
              Puede autorizar desde su propio teléfono, escaneando un código de tu pantalla.
            </p>
            <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning/10 px-3 py-2 text-sm text-foreground">
              Necesita un teléfono propio con datos móviles. Que lo haga desde su dispositivo es lo que
              sostiene esta vía: si lo haces tú desde esta pantalla, deja de probar que fue él. Si no
              tiene teléfono, hoy no hay otra forma; el consentimiento en papel está dimensionado y aún no
              construido.
            </p>
          </div>
          <PaseQrPresencial
            documentType={documento.documentType ?? "CC"}
            documentNumber={documento.documentNumber}
            onCreado={setResumeToken}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviarSinReset(verificar)}>
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">
              Documento del paciente
            </h2>
            <p className="text-sm text-muted-foreground">
              Se verifica primero para saber si ya está registrado. Sin esto, un
              documento que ya existe termina en un error de la base al guardar.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                Tipo de documento
              </span>
              <select
                name="documentType"
                defaultValue="CC"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">
                Número de documento
              </span>
              <Input
                name="documentNumber"
                className="h-9"
                inputMode="numeric"
                autoComplete="off"
              />
            </label>
            <Button type="submit" disabled={verificando}>
              {verificando ? "Verificando..." : "Verificar documento"}
            </Button>
          </div>

          {/* EL DOCUMENTO AJENO. Caja NEUTRA, no destructiva: no se rompió nada y el profesional no hizo
              nada mal. Una caja roja diría "error" sobre un resultado que es correcto. */}
          {documento.veredicto === "ajeno" ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {documento.error}
            </p>
          ) : documento.error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {documento.error}
            </p>
          ) : null}
        </section>
      </form>

      {documento.veredicto === "propio" && documento.patientId ? (
        <PacientePropio
          patientId={documento.patientId}
          evaluacionPendienteId={documento.evaluacionPendienteId}
          onListo={setResumeToken}
        />
      ) : null}
    </div>
  );
}

// EL PACIENTE QUE YA ES SUYO. Las dos salidas son excluyentes y la pantalla muestra SOLO la que aplica:
// con encuesta a medias se retoma esa; sin ella se abre una nueva. Nunca se ofrecen las dos, porque
// "crear otra" existiendo una pendiente es justo el defecto (dos juegos de respuestas del mismo paciente,
// y quien diagnostique elige uno sin saber del otro).
function PacientePropio({
  patientId,
  evaluacionPendienteId,
  onListo,
}: {
  patientId: string;
  evaluacionPendienteId: string | null;
  onListo: (resumeToken: string) => void;
}) {
  const [pendiente, pedirEnlace, pidiendo] = useActionState(
    enlaceEncuestaPendienteAction,
    inicialSeguimiento,
  );
  const [nueva, abrir, abriendo] = useActionState(
    abrirEvaluacionEnConsultaAction,
    inicialSeguimiento,
  );
  const estado = evaluacionPendienteId ? pendiente : nueva;
  // El aviso al padre va en efecto, no en render: llamar a onListo mientras se renderiza seria un
  // setState de otro componente a mitad de render. Mismo patron que SignPhaseForm al firmar.
  const resumeToken = estado.resumeToken;
  useEffect(() => {
    if (resumeToken) onListo(resumeToken);
  }, [resumeToken, onListo]);
  if (resumeToken) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">
          Ya es tu paciente
        </h2>
        <p className="text-sm text-muted-foreground">
          {evaluacionPendienteId
            ? "Tiene una encuesta pendiente de responder. Se retoma esa: crear otra dejaría dos juegos de respuestas del mismo paciente."
            : "Ya firmó su consentimiento, así que no hace falta volver a firmarlo para esta evaluación."}
        </p>
      </div>

      {evaluacionPendienteId ? (
        <form onSubmit={enviarSinReset(pedirEnlace)}>
          <input
            type="hidden"
            name="evaluationId"
            value={evaluacionPendienteId}
          />
          <Button type="submit" disabled={pidiendo}>
            {pidiendo ? "Abriendo..." : "Retomar su encuesta pendiente"}
          </Button>
        </form>
      ) : (
        <form onSubmit={enviarSinReset(abrir)}>
          <input type="hidden" name="patientId" value={patientId} />
          <Button type="submit" disabled={abriendo}>
            {abriendo ? "Abriendo..." : "Abrir una evaluación nueva"}
          </Button>
        </form>
      )}

      {/* AUTORIZACION REVOCADA: el gate corrio ANTES de crear nada (regla dura 15). No es un fallo
          tecnico, y aqui el profesional TIENE al paciente delante, asi que la salida es concreta. */}
      {estado.revoked ? (
        <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning/10 px-3 py-2 text-sm text-foreground">
          Este paciente retiró alguna de las autorizaciones necesarias, así que
          no se le pueden crear evaluaciones. Si quiere continuar, tiene que
          autorizarlas de nuevo desde su ficha.
        </p>
      ) : null}
      {estado.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
    </section>
  );
}

// LO QUE QUEDA POR HACER, y es una sola cosa: pasarle el dispositivo al paciente con SU encuesta abierta.
// El enlace es el publico de reanudacion, el mismo que va por correo. Se abre en otra pestaña a proposito:
// dentro de la app autenticada, el dispositivo en manos del paciente es la sesion del profesional.
function ParaElPaciente({ resumeToken }: { resumeToken: string }) {
  const [url] = useState(() =>
    buildResumeUrl(
      resumeToken,
      typeof window !== "undefined" ? window.location.origin : null,
    ),
  );
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles: el campo queda seleccionable para copiar a mano.
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">
          Listo. Ahora la encuesta
        </h2>
        <p className="text-sm text-muted-foreground">
          Abre la encuesta y pásale el dispositivo al paciente. Si prefiere
          responderla en su casa, cópiale el enlace: también le llegó por
          correo, y guarda el avance.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Abrir la encuesta
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={copiar}
          disabled={!url}
        >
          {copiado ? "Copiado" : "Copiar enlace"}
        </Button>
      </div>
      <Input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="h-9 font-mono text-xs"
      />
    </section>
  );
}
