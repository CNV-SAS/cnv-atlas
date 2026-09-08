"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { ConsentDocumentCollapsible } from "@/modules/consent/components/consent-document-collapsible";
import { checkboxClass } from "@/modules/evaluations/components/survey-form-shared";

import { abrirSesionQrAction, confirmarSesionQrAction, type ConfirmacionQrState } from "../actions.qr";

// LA PANTALLA DEL PACIENTE · MODALIDAD 2 (QR). Corre en SU telefono, no en el del profesional.
//
// LO QUE ESCRIBE EL PACIENTE, y por que es el nombre y el documento y no todo lo demas: el dictamen pide
// que el acto sea "una manifestacion suya y no solo una aceptacion de datos que otro registro". Con
// escribir quien es basta para eso; pedirle ademas ciudad, sexo y fecha en un telefono ajeno a la consulta
// alargaria el acto sin añadir nada a lo que se esta probando. El resto de la identidad la lleva la
// pantalla del profesional, que ya la tenia.
//
// Y EL ORDEN IMPORTA: primero escribe quien es, DESPUES marca. Marcar autorizaciones antes de haberse
// identificado seria aceptar en abstracto.

const inicial: ConfirmacionQrState = { error: null, estado: "pendiente", declarado: null };

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
];

export function ConsentimientoQr({
  token,
  consentText,
}: {
  token: string;
  consentText: string;
}) {
  const [estado, confirmar, enviando] = useActionState(confirmarSesionQrAction, inicial);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [documento, setDocumento] = useState("");
  const [marcadas, setMarcadas] = useState({
    servicio: false,
    datos_sensibles: false,
    aceptacion_medio_electronico: false,
  });

  // SELLA LA APERTURA al montarse, y solo aqui: es el instante en que el paciente de verdad abrio esto en
  // su telefono. La pagina (servidor) no puede hacerlo porque se re-renderiza, y entonces la marca de
  // tiempo dejaria de significar "cuando lo abrio".
  useEffect(() => {
    void abrirSesionQrAction(token);
  }, [token]);

  const identidadLista =
    nombres.trim().length > 1 && apellidos.trim().length > 1 && documento.trim().length >= 3;
  const necesariasListas =
    marcadas.servicio && marcadas.datos_sensibles && marcadas.aceptacion_medio_electronico;

  if (estado.estado === "confirmada") {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Listo, gracias</h2>
        <p className="text-sm text-muted-foreground">
          Ya quedó registrada tu autorización. Devuélvele el teléfono a tu profesional o dile que
          terminaste; él continúa desde su pantalla.
        </p>
      </section>
    );
  }

  if (estado.estado === "discrepancia") {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-clinical-warning/50 bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Revisemos tu documento</h2>
        {/* NO SE LE ENSEÑA EL DOCUMENTO QUE ESCRIBIO EL PROFESIONAL: seria darle la respuesta, y entonces
            "coinciden" dejaria de significar nada porque bastaria con copiarla. Se le enseña LO SUYO, que
            es lo que puede corregir, y se les manda a mirarlo juntos. */}
        <p className="text-sm text-muted-foreground">
          El documento que escribiste no coincide con el que tu profesional registró. No es un error tuyo:
          puede ser un dígito de más en cualquiera de los dos.
        </p>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          Tú escribiste: <span className="font-medium">{estado.declarado}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Muéstrale tu documento a tu profesional y revísenlo juntos. Él puede empezar de nuevo desde su
          pantalla en un momento.
        </p>
      </section>
    );
  }

  if (estado.estado === "no_disponible") {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Este código ya no sirve</h2>
        <p className="text-sm text-muted-foreground">{estado.error}</p>
      </section>
    );
  }

  return (
    <form onSubmit={enviarSinReset(confirmar)} className="flex w-full flex-col gap-5">
      <input type="hidden" name="token" value={token} />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Primero, ¿quién eres?</h2>
          <p className="text-sm text-muted-foreground">
            Escribe tu nombre y tu documento como aparecen en tu cédula. Lo escribes tú: es lo que hace
            que esta autorización sea tuya y no un dato que alguien registró por ti.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Nombres</span>
          <Input name="firstName" value={nombres} onChange={(e) => setNombres(e.target.value)} autoComplete="given-name" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Apellidos</span>
          <Input name="lastName" value={apellidos} onChange={(e) => setApellidos(e.target.value)} autoComplete="family-name" />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Tipo de documento</span>
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
            <span className="text-xs font-medium text-muted-foreground">Número de documento</span>
            <Input
              name="documentNumber"
              inputMode="numeric"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* EL DOCUMENTO ENTERO, disponible antes de marcar nada. Lo mismo que ve quien firma desde su casa:
          la modalidad cambia el canal, no lo que se le presenta al paciente. */}
      <ConsentDocumentCollapsible text={consentText} />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Tus autorizaciones</h2>
        <p className="text-sm text-muted-foreground">
          Las tres primeras son necesarias para poder atenderte. Las de abajo son opcionales y no afectan
          tu atención.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="servicio"
            className={checkboxClass}
            checked={marcadas.servicio}
            onChange={(e) => setMarcadas((s) => ({ ...s, servicio: e.target.checked }))}
          />
          <span>
            Autorizo el tratamiento de los datos personales para las finalidades necesarias del servicio,
            y declaro conocer el tratamiento internacional, el uso de sistemas automatizados y mis
            derechos como titular.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="datos_sensibles"
            className={checkboxClass}
            checked={marcadas.datos_sensibles}
            onChange={(e) => setMarcadas((s) => ({ ...s, datos_sensibles: e.target.checked }))}
          />
          <span>
            Autorizo el tratamiento de los datos sensibles de salud, de forma voluntaria, para la
            evaluación.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="aceptacion_medio_electronico"
            className={checkboxClass}
            checked={marcadas.aceptacion_medio_electronico}
            onChange={(e) =>
              setMarcadas((s) => ({ ...s, aceptacion_medio_electronico: e.target.checked }))
            }
          />
          <span>
            Acepto dar esta autorización por medios electrónicos, desde mi propio dispositivo, con plena
            validez (Ley 527 de 1999).
          </span>
        </label>

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="investigacion" className={checkboxClass} />
            <span>
              Autorizo el uso de mis datos seudonimizados para investigación científica del modelo.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="comunicaciones_continuidad" className={checkboxClass} />
            <span>
              <strong>Continuidad asistencial.</strong> Autorizo que CNV me contacte para asegurar la
              continuidad de mi proceso en salud dentro de la red.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="comunicaciones_comerciales" className={checkboxClass} />
            <span>
              <strong>Publicidad.</strong> Autorizo recibir comunicaciones comerciales del ecosistema CNV.
            </span>
          </label>
        </div>
      </section>

      {estado.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={!identidadLista || !necesariasListas || enviando} className="self-start">
        {enviando ? "Enviando..." : "Confirmar mi autorización"}
      </Button>
      {!identidadLista ? (
        <p className="text-xs text-muted-foreground">Escribe tu nombre y tu documento para continuar.</p>
      ) : !necesariasListas ? (
        <p className="text-xs text-muted-foreground">
          Marca las tres autorizaciones necesarias para continuar.
        </p>
      ) : null}
    </form>
  );
}
