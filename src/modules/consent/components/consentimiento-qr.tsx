"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { ConsentDocumentCollapsible } from "@/modules/consent/components/consent-document-collapsible";
import { checkboxClass } from "@/modules/evaluations/components/survey-form-shared";
import { LEGAL_REP_RELATIONSHIPS } from "@/modules/consent/validations";

import { reportClientError } from "@/lib/observability/report-client-error";

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

// LA RED, COMO EN LAS OTRAS DOS PANTALLAS DEL PACIENTE (ver `sign-phase-form` y `survey-phase-form`).
// Si la peticion no llega, la accion no corre, su `catch` del servidor tampoco, y `estado.error` se
// queda en null: el paciente ve el boton volver a la normalidad y nada mas. Aqui ademas esta con la
// profesional al lado esperando a que su pantalla cambie, asi que un fallo mudo los deja a los dos sin
// saber que hacer. Se reporta a Sentry al atraparlo para no quedarnos ciegos al taparlo.
const CONFIRMAR_CON_RED = async (
  prev: ConfirmacionQrState,
  form: FormData,
): Promise<ConfirmacionQrState> => {
  try {
    return await confirmarSesionQrAction(prev, form);
  } catch (e) {
    reportClientError("consentimiento-qr.confirmar-sin-red", e);
    return {
      error:
        "Parece que se cayó la conexión y no pudimos enviar tus datos. No se perdió nada de lo que escribiste: revisa tu internet y vuelve a pulsar el botón.",
      estado: "pendiente",
      declarado: null,
    };
  }
};

// Los mismos parentescos que el camino del enlace: dos listas del mismo dato es como las dos vias
// acaban admitiendo cosas distintas del mismo representante.
const PARENTESCOS = LEGAL_REP_RELATIONSHIPS.map((p) => ({
  value: p,
  label: p.charAt(0).toUpperCase() + p.slice(1),
}));

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
];

export function ConsentimientoQr({
  token,
  consentText,
  esDeMenor = false,
  pideAsentimiento = false,
}: {
  token: string;
  consentText: string;
  /**
   * EL PACIENTE ES MENOR DE EDAD, así que quien está en este teléfono es su representante legal (0216).
   * Lo decide la SESIÓN, con la fecha que el profesional leyó del documento al emitir el pase: no es una
   * opción que esta pantalla ofrezca, porque entonces sería elegible por quien tiene el teléfono.
   */
  esDeMenor?: boolean;
  /** El menor tiene entre 14 y 17: además de la autorización, hace falta su asentimiento. */
  pideAsentimiento?: boolean;
}) {
  const [estado, confirmar, enviando] = useActionState(CONFIRMAR_CON_RED, inicial);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [documento, setDocumento] = useState("");
  const [rep, setRep] = useState({ nombre: "", documento: "", parentesco: "" });
  const [asentimiento, setAsentimiento] = useState(false);
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
  // EL BLOQUE DEL REPRESENTANTE, cuando el paciente es menor. El correo NO entra en esta cuenta: es
  // opcional a propósito, porque esta vía existe precisamente porque la familia no tiene correo.
  const representanteListo =
    !esDeMenor ||
    (rep.nombre.trim().length > 1 &&
      rep.documento.trim().length >= 3 &&
      rep.parentesco !== "" &&
      (!pideAsentimiento || asentimiento));

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

      {/* ═══ CUANDO EL PACIENTE ES MENOR, AQUÍ NO ESTÁ EL PACIENTE (0216) ═══
          Lo primero es decir a quién le habla esta pantalla, antes de pedirle un solo dato. Sin esta
          frase, el representante lee "escribe tu nombre" junto a un documento de identidad y no sabe si
          le piden el suyo o el del menor, que es justo el dato que esta vía tiene que poder probar. */}
      {esDeMenor ? (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-5">
          <h2 className="text-base font-semibold text-foreground">
            Esta autorización la da el representante legal
          </h2>
          <p className="text-sm text-muted-foreground">
            El paciente es menor de edad, así que la autorización la otorga su padre, madre o
            representante legal. Primero se identifica <strong>al menor</strong>, que es el paciente, y
            después <strong>a ti</strong>, que eres quien autoriza.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">
            {esDeMenor ? "Primero, los datos del menor" : "Primero, ¿quién eres?"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {esDeMenor
              ? "Escribe el nombre y el documento del menor como aparecen en su documento de identidad. Es el paciente, y es lo que tiene que coincidir con lo que registró el profesional."
              : "Escribe tu nombre y tu documento como aparecen en tu cédula. Lo escribes tú: es lo que hace que esta autorización sea tuya y no un dato que alguien registró por ti."}
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

      {/* ═══ Y DESPUÉS, QUIÉN AUTORIZA (0216) ═══
          LOS ESCRIBE ÉL, igual que el paciente adulto escribe los suyos, y por la misma razón: el dictamen
          pide que el acto sea "una manifestación suya y no la aceptación de datos que otro registró".
          Para un menor, quien manifiesta es el representante.

          EL CORREO ES OPCIONAL, y es la única diferencia con el camino del enlace. Allí es obligatorio
          porque por ahí va el código de verificación, y ahí el código ES la verificación de identidad.
          Aquí la identidad la verifica el profesional contra el documento, con la persona delante, y esta
          vía existe precisamente porque la familia no tiene correo: exigirlo cerraría la única puerta que
          tiene un menor sin correo. */}
      {esDeMenor ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">Ahora, ¿quién autorizas tú?</h2>
            <p className="text-sm text-muted-foreground">
              Tus propios datos, como aparecen en tu documento. El profesional los verifica contra tu
              documento y contra tu calidad de representante legal del menor.
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Tu nombre completo</span>
            <Input
              name="representanteNombre"
              value={rep.nombre}
              onChange={(e) => setRep((s) => ({ ...s, nombre: e.target.value }))}
              autoComplete="name"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Tu número de documento</span>
              <Input
                name="representanteDocumento"
                inputMode="numeric"
                value={rep.documento}
                onChange={(e) => setRep((s) => ({ ...s, documento: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Tu relación con el menor</span>
              <select
                name="representanteParentesco"
                value={rep.parentesco}
                onChange={(e) => setRep((s) => ({ ...s, parentesco: e.target.value }))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecciona</option>
                {PARENTESCOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Tu correo (opcional, si tienes)
            </span>
            <Input name="representanteEmail" type="email" inputMode="email" autoComplete="email" />
            <span className="text-xs text-muted-foreground">
              No hace falta para autorizar. Si lo escribes, CNV puede enviarte una copia de esta
              autorización.
            </span>
          </label>
        </section>
      ) : null}

      {/* EL DOCUMENTO ENTERO, disponible antes de marcar nada. Lo mismo que ve quien firma desde su casa:
          la modalidad cambia el canal, no lo que se le presenta al paciente. */}
      <ConsentDocumentCollapsible text={consentText} />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">
          {esDeMenor ? "Las autorizaciones que otorgas" : "Tus autorizaciones"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {esDeMenor
            ? "Las tres primeras son necesarias para poder atender al menor. Las de abajo son opcionales y no afectan su atención."
            : "Las tres primeras son necesarias para poder atenderte. Las de abajo son opcionales y no afectan tu atención."}
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

        {/* ═══ EL ASENTIMIENTO DEL MENOR DE 14 A 17 (0216) ═══
            NO ES UNA AUTORIZACIÓN MÁS: la autorización la da el representante, y esto es el acto del
            MENOR, que el modelo registra aparte. Solo sale cuando el menor tiene 14 o más, porque la
            declaración del profesional afirma haberlo presenciado y para un menor de 14 esa frase no
            aparece en el texto (si no ocurrió, no se declara). */}
        {pideAsentimiento ? (
          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <input
              type="checkbox"
              name="asentimiento_menor"
              className={checkboxClass}
              checked={asentimiento}
              onChange={(e) => setAsentimiento(e.target.checked)}
            />
            <span>
              <strong>Asentimiento del menor.</strong> El menor, que tiene entre 14 y 17 años, está
              presente, fue informado y da su asentimiento para ser atendido.
            </span>
          </label>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="investigacion" className={checkboxClass} />
            <span>
              {esDeMenor
                ? "Autorizo el uso de los datos seudonimizados del menor para investigación científica del modelo."
                : "Autorizo el uso de mis datos seudonimizados para investigación científica del modelo."}
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

      <Button
        type="submit"
        disabled={!identidadLista || !representanteListo || !necesariasListas || enviando}
        className="self-start"
      >
        {enviando ? "Enviando..." : "Confirmar mi autorización"}
      </Button>
      {/* EL BOTÓN APAGADO DICE QUÉ FALTA, en el orden en que se llena. Un botón muerto sin explicación es
          peor que un error claro, y aquí lo lee alguien en su propio teléfono, sin nadie que le traduzca. */}
      {!identidadLista ? (
        <p className="text-xs text-muted-foreground">
          {esDeMenor
            ? "Escribe el nombre y el documento del menor para continuar."
            : "Escribe tu nombre y tu documento para continuar."}
        </p>
      ) : !representanteListo ? (
        <p className="text-xs text-muted-foreground">
          {pideAsentimiento &&
          rep.nombre.trim().length > 1 &&
          rep.documento.trim().length >= 3 &&
          rep.parentesco !== ""
            ? "Marca el asentimiento del menor para continuar."
            : "Escribe tus datos y tu relación con el menor para continuar."}
        </p>
      ) : !necesariasListas ? (
        <p className="text-xs text-muted-foreground">
          Marca las tres autorizaciones necesarias para continuar.
        </p>
      ) : null}
    </form>
  );
}
