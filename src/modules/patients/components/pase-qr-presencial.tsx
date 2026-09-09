"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import {
  abandonarSesionQrAction,
  emitirSesionQrAction,
  estadoSesionQrAction,
  type SesionQrState,
} from "@/modules/consent/actions.qr";
import type { EstadoSesion } from "@/modules/consent/data/sesion-presencial";

// EL PASE POR QR EN LA PANTALLA DEL PROFESIONAL · MODALIDAD 2.
//
// ═══ EL ESTADO ENTRE DOS DISPOSITIVOS, que es lo nuevo de esta modalidad ═══
//
// SONDEO, Y ES UNA DECISION. El evento que se espera ocurre UNA vez por consulta, con la pantalla abierta
// delante de una persona. Una suscripcion en vivo traeria una dependencia nueva, una conexion que
// mantener y un modo de fallo MUDO (se cae y la pantalla se queda esperando para siempre) a cambio de
// ahorrar unos segundos. El sondeo falla ruidoso: si no responde, se dice.
//
// Y SE DETIENE SOLO, que es la otra mitad del cuidado: para en cuanto el estado es terminal, y para
// tambien cuando se acaba la paciencia (el paciente se fue con el telefono, o simplemente se fue). Una
// pantalla que sondea indefinidamente porque nadie va a confirmar es el defecto a evitar, no la latencia.
const CADA_MS = 3000;
const HASTA_MIN = 50; // algo mas que la ventana de lectura: si vencio, ya no va a llegar nada.

export type PaseQrProps = {
  documentType: string;
  documentNumber: string;
  /** Se llama cuando el paciente confirmo: el profesional pasa a declarar y a crear. */
  onConfirmado: (sessionId: string, estado: EstadoSesion) => void;
};

const inicial: SesionQrState = { error: null, token: null, sessionId: null };

export function PaseQrPresencial({ documentType, documentNumber, onConfirmado }: PaseQrProps) {
  const [sesion, emitir, emitiendo] = useActionState(emitirSesionQrAction, inicial);
  const [estado, setEstado] = useState<EstadoSesion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [agotado, setAgotado] = useState(false);
  // EL PASE ANULADO, por token y no por booleano: asi un pase nuevo se distingue solo del anulado y no
  // hace falta acordarse de limpiar la bandera. Antes el boton llamaba a la accion y no cambiaba nada en
  // pantalla: el pase seguia ahi, el sondeo seguia corriendo, y como no habia respuesta visible se podia
  // pulsar una y otra vez (en el smoke quedaron CUATRO eventos de anulacion del mismo pase).
  const [tokenAnulado, setTokenAnulado] = useState<string | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [origen] = useState(() => (typeof window !== "undefined" ? window.location.origin : ""));
  const desde = useRef<number>(0);

  const anulado = sesion.token !== null && sesion.token === tokenAnulado;
  const url = sesion.token ? `${origen}/consentimiento/${sesion.token}` : null;

  const sondear = useCallback(async (sessionId: string) => {
    try {
      const e = await estadoSesionQrAction(sessionId);
      setFallo(null);
      return e;
    } catch {
      // RUIDOSO: no se traga el fallo. Si la red se cayo, el profesional tiene que saber que lo que ve
      // puede estar viejo, en vez de leer "esperando" indefinidamente y creerselo.
      setFallo("No pudimos consultar el estado. Reintentando...");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!sesion.sessionId) return;
    if (desde.current === 0) desde.current = Date.now();
    let vivo = true;
    const id = setInterval(async () => {
      if (!vivo) return;
      if (Date.now() - desde.current > HASTA_MIN * 60_000) {
        setAgotado(true);
        clearInterval(id);
        return;
      }
      const e = await sondear(sesion.sessionId!);
      if (!vivo || !e) return;
      setEstado(e);
      // ESTADOS TERMINALES: se deja de preguntar. Confirmada la recoge el padre; discrepancia y
      // abandonada no van a cambiar solas.
      if (
        e.estado === "confirmada" ||
        e.estado === "discrepancia" ||
        e.estado === "abandonada"
      ) {
        clearInterval(id);
        if (e.estado === "confirmada") onConfirmado(sesion.sessionId!, e);
      }
    }, CADA_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [sesion.sessionId, sondear, onConfirmado]);

  // Sin pase, o con el pase anulado: se vuelve a ofrecer el boton de emitir. El anulado deja su aviso
  // encima, para que el profesional vea que la anulacion SI ocurrio.
  if (!sesion.token || anulado) {
    return (
      <form onSubmit={enviarSinReset(emitir)}>
        <input type="hidden" name="documentType" value={documentType} />
        <input type="hidden" name="documentNumber" value={documentNumber} />
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">Sin correo: pase por código</h2>
            <p className="text-sm text-muted-foreground">
              Se muestra un código en tu pantalla. El paciente lo escanea con su teléfono, escribe su
              nombre y su documento, y autoriza desde ahí. Su teléfono es lo que hace válida esta vía: no
              lo hagas tú desde este dispositivo.
            </p>
          </div>
          {anulado ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              Ese pase quedó anulado: el código anterior ya no sirve. Genera uno nuevo cuando quieras.
            </p>
          ) : null}
          {sesion.error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {sesion.error}
            </p>
          ) : null}
          <Button type="submit" disabled={emitiendo} className="self-start">
            {emitiendo ? "Generando..." : "Mostrar el código al paciente"}
          </Button>
        </section>
      </form>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Pásale el teléfono al paciente</h2>
        <p className="text-sm text-muted-foreground">
          Que lo escanee con SU teléfono. Escribe él su nombre y su documento, y marca él las
          autorizaciones: eso es lo único que sostiene esta modalidad.
        </p>
      </div>

      {/* El enlace en claro, ademas del QR: un telefono viejo sin camara util, o una camara que no lee,
          no pueden dejar al paciente fuera. */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Enlace del paciente
        </span>
        <code className="break-all text-xs text-foreground">{url}</code>
      </div>

      <Espera estado={estado} fallo={fallo} agotado={agotado} />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={anulando}
          onClick={async () => {
            if (!sesion.sessionId || !sesion.token) return;
            setAnulando(true);
            // SE ESPERA LA RESPUESTA antes de dar el pase por anulado. Marcarlo en pantalla sin esperar
            // diria que el codigo ya no sirve cuando podria seguir sirviendo, que es peor que no decir
            // nada: el profesional se iria creyendo que lo cerro.
            const r = await abandonarSesionQrAction(sesion.sessionId);
            setAnulando(false);
            if (!r.error) setTokenAnulado(sesion.token);
          }}
        >
          {anulando ? "Anulando..." : "Anular este pase"}
        </Button>
      </div>
    </section>
  );
}

function Espera({
  estado,
  fallo,
  agotado,
}: {
  estado: EstadoSesion | null;
  fallo: string | null;
  agotado: boolean;
}) {
  if (agotado) {
    return (
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
        Dejamos de esperar: pasó demasiado tiempo sin que el paciente confirmara. Si sigue contigo, genera
        un código nuevo.
      </p>
    );
  }
  if (estado?.estado === "discrepancia") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-clinical-warning/50 bg-clinical-warning/10 px-3 py-3 text-sm">
        <p className="font-medium text-foreground">El documento no coincide</p>
        {/* LOS DOS VISIBLES Y NINGUNO PISADO: es lo que permite ver DONDE esta la diferencia. La pantalla
            no elige por ellos, porque elegir seria decidir en el dato que identifica a la persona. */}
        <p className="text-foreground">
          Tú registraste otro número; el paciente escribió{" "}
          <span className="font-medium">{estado.declaradoDocumentNumber}</span>
          {estado.declaradoNombres ? ` (${estado.declaradoNombres} ${estado.declaradoApellidos ?? ""})` : ""}.
        </p>
        <p className="text-muted-foreground">
          Revísenlo juntos con la cédula delante. Corrige el documento arriba si el equivocado era el tuyo,
          y genera un código nuevo.
        </p>
      </div>
    );
  }
  if (estado?.openedAt) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
        El paciente ya lo abrió. Esperando a que lea y confirme.
        {fallo ? <span className="block text-xs text-muted-foreground">{fallo}</span> : null}
      </p>
    );
  }
  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      Esperando a que el paciente lo escanee.
      {fallo ? <span className="block text-xs">{fallo}</span> : null}
    </p>
  );
}
