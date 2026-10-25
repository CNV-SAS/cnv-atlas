"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cambiarAccesoDelIntegranteAction, type AccesoFormState } from "../actions";

const INICIAL: AccesoFormState = { error: null, success: null, warning: null };

// ═══ QUITARLE EL ACCESO A UN INTEGRANTE, SIN BORRAR SU CUENTA (Gildardo, 2026-10-25) ═══
//
// LA PANTALLA TIENE QUE DECIR LO QUE **NO** HACE, y eso es casi todo lo que hay aquí. Quitar el acceso no
// mueve a sus pacientes, no cancela lo que se le debe, no recoge su vitrina y no anula los enlaces que ya
// están en manos de pacientes. Si el botón no lo dice, lo razonable es dar por hecho que inactivar resuelve
// el offboarding completo, y entonces 25 pacientes se quedan sin quien los atienda sin que nadie lo note.
//
// SIN `<form>` PROPIO (hazard 7): esto se monta en una pantalla que ya tiene formularios, y un `<form>`
// dentro de otro lo descarta el navegador. Los campos van a mano, SIN `name` (hazard 8) y controlados; lo
// que viaja lo arma `ejecutarAccion`.
//
// EL MOTIVO ES OBLIGATORIO EN LOS DOS SENTIDOS, y la exigencia se rehace en el `disabled` del botón DICIÉNDOLO
// en el rótulo (hazard 8 otra vez): un botón muerto sin explicación es peor que un error claro.
export function AccesoDelIntegrante({
  usuarioId,
  professionalId,
  nombre,
  inactivo,
  inactivoDesde,
  motivoVigente,
  abierto,
}: {
  usuarioId: string;
  professionalId: string;
  nombre: string;
  inactivo: boolean;
  inactivoDesde: string | null;
  motivoVigente: string | null;
  abierto: {
    pacientesActivos: number;
    llegadosDespues: number | null;
    margenPendiente: number;
    unidadesEnCustodia: number;
    remesasPorConfirmar: number;
    faltantesAbiertos: number;
    enlacesVigentes: number;
  };
}) {
  const [state, action, pending] = useActionState(cambiarAccesoDelIntegranteAction, INICIAL);
  useFormToastAndRefresh(state);
  const [abiertoElBloque, setAbiertoElBloque] = useState(false);
  const [motivo, setMotivo] = useState("");

  const suficiente = motivo.trim().length >= 10;

  const enviar = (quitar: boolean) => {
    const fd = new FormData();
    fd.set("usuarioId", usuarioId);
    fd.set("professionalId", professionalId);
    fd.set("motivo", motivo);
    fd.set("quitar", quitar ? "true" : "false");
    ejecutarAccion(action, fd);
  };

  const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;
  const fecha = (iso: string) =>
    new Date(iso).toLocaleString("es-CO", {
      timeZone: "America/Bogota",
      dateStyle: "medium",
      timeStyle: "short",
    });

  // ── LO QUE QUEDA ABIERTO: la lista se arma con lo que de verdad hay, no con un texto fijo ──────────
  //
  // Un párrafo que enumera siempre las seis cosas se lee como letra pequeña y no se mira. Una lista de dos
  // líneas con cifras de ESTE integrante sí: "25 pacientes" es una frase que detiene a quien la lee.
  const abiertos: string[] = [];
  if (abierto.pacientesActivos > 0) {
    abiertos.push(
      `${abierto.pacientesActivos} ${abierto.pacientesActivos === 1 ? "paciente sigue" : "pacientes siguen"} asignados a él: hay que reasignarlos (el bloque de abajo lo hace).`,
    );
  }
  if (abierto.margenPendiente > 0) {
    abiertos.push(`Se le siguen debiendo ${pesos(abierto.margenPendiente)} de margen sin liquidar.`);
  }
  if (abierto.unidadesEnCustodia > 0) {
    abiertos.push(`${abierto.unidadesEnCustodia} unidades siguen en su vitrina, en su custodia.`);
  }
  if (abierto.remesasPorConfirmar > 0) {
    abiertos.push(
      `${abierto.remesasPorConfirmar} remesa(s) esperan su confirmación, y sin acceso no las podrá confirmar.`,
    );
  }
  if (abierto.faltantesAbiertos > 0) {
    abiertos.push(`${abierto.faltantesAbiertos} faltante(s) sin cerrar.`);
  }
  if (abierto.enlacesVigentes > 0) {
    abiertos.push(
      `${abierto.enlacesVigentes} enlace(s) y QR de encuesta siguen sirviendo: un paciente que ya los tiene puede seguir llenando, y llegará a su nombre.`,
    );
  }

  if (inactivo) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-attention bg-attention-bg p-3 text-sm">
        <p className="max-w-prose">
          <strong>No tiene acceso a Atlas.</strong> No puede iniciar sesión ni abrir ninguna historia clínica,
          y una sesión que tuviera abierta ya se cerró.
          {inactivoDesde ? ` Desde el ${fecha(inactivoDesde)}.` : ""}
        </p>
        {motivoVigente ? (
          <p className="max-w-prose text-muted-foreground">Motivo registrado: {motivoVigente}</p>
        ) : null}

        {/* LO QUE SIGUE SIENDO SUYO AUNQUE NO ENTRE. Es la parte que se olvida, y la que hace que un
            paciente se quede sin quien lo atienda. */}
        {abiertos.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="font-medium">Sigue abierto:</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {abiertos.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* LOS QUE LLEGARON DESPUES: el aviso que nadie puede deducir. Sus enlaces siguen sirviendo a
            propósito, así que el consultorio puede seguir produciendo pacientes que él no ve. */}
        {abierto.llegadosDespues !== null && abierto.llegadosDespues > 0 ? (
          <p className="max-w-prose rounded border border-attention bg-background p-2">
            <strong>
              {abierto.llegadosDespues}{" "}
              {abierto.llegadosDespues === 1 ? "paciente llegó" : "pacientes llegaron"} a su nombre después de
              quitarle el acceso
            </strong>
            , por un enlace o un QR suyo. Nadie los está atendiendo: reasígnalos.
          </p>
        ) : null}

        {!abiertoElBloque ? (
          <Button
            key="abrir-devolver-acceso"
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAbiertoElBloque(true)}
            className="self-start"
          >
            Devolverle el acceso
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="motivo-devolver-acceso" className="text-xs">
                Por qué se le devuelve el acceso
              </Label>
              <Input
                id="motivo-devolver-acceso"
                maxLength={300}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por ejemplo: vuelve a atender desde el 1 de noviembre"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                key="devolver-acceso"
                type="button"
                size="sm"
                disabled={pending || !suficiente}
                onClick={() => enviar(false)}
              >
                {pending
                  ? "Devolviendo..."
                  : suficiente
                    ? "Devolverle el acceso"
                    : "Escribe el motivo para devolverle el acceso"}
              </Button>
              <Button
                key="cancelar-devolver-acceso"
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setAbiertoElBloque(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!abiertoElBloque) {
    return (
      <Button
        key="abrir-quitar-acceso"
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAbiertoElBloque(true)}
        className="self-start"
      >
        Quitarle el acceso a Atlas
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
      <p className="max-w-prose text-sm">
        <strong>{nombre}</strong> dejará de poder entrar a Atlas. Su cuenta no se borra y nada de lo suyo se
        pierde: es reversible, y queda registrado quién lo hizo y por qué.
      </p>
      <p className="max-w-prose text-xs text-muted-foreground">
        Pierde el inicio de sesión y la sesión que tuviera abierta se cierra en el siguiente clic. Deja de ver
        historias clínicas, incluidas las de sus pacientes, y deja de recibir los correos de pendientes.
      </p>

      {abiertos.length > 0 ? (
        <div className="flex flex-col gap-1 rounded border border-attention bg-attention-bg p-2 text-xs">
          <p className="font-medium text-foreground">Esto NO lo resuelve quitarle el acceso:</p>
          <ul className="list-disc pl-5 text-foreground">
            {abiertos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <Label htmlFor="motivo-quitar-acceso" className="text-xs">
          Por qué se le quita el acceso
        </Label>
        {/* SIN `name`, a propósito: este bloque vive en una pantalla con formularios y un campo con nombre
            viajaría en ESE envío (hazard 8). */}
        <Input
          id="motivo-quitar-acceso"
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por ejemplo: termina su vinculación con CNV el 31 de octubre"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          key="quitar-acceso"
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending || !suficiente}
          onClick={() => enviar(true)}
        >
          {pending ? "Quitando..." : suficiente ? "Quitarle el acceso" : "Escribe el motivo para quitar el acceso"}
        </Button>
        <Button
          key="cancelar-quitar-acceso"
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setAbiertoElBloque(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
