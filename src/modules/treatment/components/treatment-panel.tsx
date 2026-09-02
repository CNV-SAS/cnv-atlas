"use client";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useActionState, useId, useState } from "react";

import { computeProtocoloEfectivo, type ProtocoloAjustes } from "@/clinical-engine";
import { computeIntercambio, grupoSinPorcion } from "@/clinical-engine/intercambio";
import { DIAS_DEL_CICLO, diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";
import { AlimentosDelSubgrupo, ListaIntercambioPaciente } from "./lista-intercambio";
import { computeTiempos, TIEMPOS_DEF } from "@/clinical-engine/tiempos";
import { computeValidacion } from "@/clinical-engine/validacion";
import { bloqueCls, tituloBloqueCls } from "@/components/shared/bloque";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/date";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import {
  useFormToastAndRefresh,
  useFormToastRefreshOnSuccess,
} from "@/components/shared/use-form-toast";

import {
  addNoteAction,
  aplicarCambioMenuAction,
  approveProtocolAction,
  aplicarCambiosMenuAction,
  reopenProtocolAction,
  generateMenuAction,
  saveAdjustmentsAction,
  saveIntercambioAction,
  saveMenuSemanalAction,
  saveTiemposAction,
  saveTiemposActivosAction,
  saveObjetivoAction,
  saveRestriccionesAction,
  type TreatmentActionState,
} from "../actions";
import { RealimentacionAlert } from "./realimentacion-alert";
import {
  adjustmentSignature,
  intercambioSignature,
  objetivoSignature,
  restriccionesSignature,
  sectionKey,
  menuSemanalSignature,
  tiemposActivosSignature,
  tiemposSignature,
} from "../data/protocol-signature";
import {
  esMenuCambios,
  esMenuComidas,
  type IntercambioSaved,
  type MenuCambios,
  type PrescripcionNutricional,
  type TreatmentNote,
  type MenuSuggestion,
  type TiemposSaved,
  type TreatmentProtocol,
} from "../data/treatment-view-types";

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

// Panel del protocolo de tratamiento (B13), vista interna del profesional. Edita objetivos,
// nutraceuticos y guias, y agrega notas. Si el diagnostico no esta confirmado, la edicion
// se bloquea (gate de B13: el protocolo se autoriza tras aprobar el reporte).
// Peso meta (cadena calórica, pieza 1: HECHO VISIBLE — nota 3 de Gildardo). Hoy el peso sobre el que se
// calcula la prescripción sale del snapshot (pesoCalculo) y, si nadie lo fija, se usa sin decirlo. Aquí se
// MUESTRA con su fórmula (pesoCalculoLabel) y se deja FIJAR (adj_peso_meta, vía saveAdjustmentsAction). No
// cambia el modelo del cálculo (eso es pieza 2, el re-port): solo lo hace visible y editable, honesto sobre
// lo que hay. La key en el call-site (incluye el peso meta y su procedencia) remonta al guardar, para
// que "fijado" se vea.
// Entrada <-> numero para los ajustes. "" = sin ajuste (usar el valor del modelo). Basura tecleada (NaN)
// tambien cuenta como sin ajuste, para que la vista previa no muestre NaN mientras el profesional escribe.
const numToInput = (n: number | null): string => (n != null ? String(n) : "");
const inputToNum = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
// Presentacion: un decimal para pesos/factores, entero para kcal/gramos. El calculo usa el valor completo.
const d1 = (n: number): string => String(Number(n.toFixed(1)));
const d0 = (n: number): string => String(Math.round(n));

// Un campo numerico de ajuste. Controlado (no lo resetea la prop `action` de React 19), con el valor del
// modelo como placeholder para que el profesional sepa sobre que esta ajustando.
// Los cinco niveles de actividad de su desplegable, VERBATIM (FA_MAP de `motorTratNutri` y el select de su
// pantalla). Lista cerrada a proposito: el factor de actividad no es un numero libre.
const NIVELES_FA = [
  { valor: "1.2", label: "Sedentario (1.2)" },
  { valor: "1.375", label: "Ligera (1.375)" },
  { valor: "1.55", label: "Moderada (1.55)" },
  { valor: "1.725", label: "Alta (1.725)" },
  { valor: "1.9", label: "Muy alta (1.9)" },
] as const;

/** El nivel con su nombre, no el numero solo: "Ligera (1.375)". Si el modelo devolviera un factor que no
 *  esta en su escala (no deberia: es la misma lista), se muestra el numero antes que inventar un nombre. */
function nivelFaLabel(valor: number): string {
  return NIVELES_FA.find((n) => Number(n.valor) === valor)?.label ?? String(valor);
}

// UN DATO, DOS SUPERFICIES, DENTRO DEL MISMO FORMULARIO. El `name` es opcional a proposito: los cuatro
// campos de la cadena se ven arriba (donde se decide) y abajo (dentro de la cuenta), pero SOLO UNA de las
// dos copias lo lleva. Dos inputs con el mismo `name` mandan DOS valores en el FormData y el servidor se
// queda con uno cualquiera; el espejo sin `name` no viaja, solo edita el mismo estado.
// EL SELECT DEL PAL, en un componente porque aparece DOS veces: arriba, entre los cuatro campos que su
// pantalla agrupa, y abajo, dentro de la cuenta, donde es el factor que multiplica. Mismo estado, un solo
// `name` (el de arriba): dos inputs con el mismo name mandarian dos valores en el FormData.
function PalSelect({
  name,
  value,
  onChange,
  modelo,
  compacto,
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  modelo: number;
  compacto?: boolean;
}) {
  // SIN OPCION DE RELLENO: cuando el profesional no ha elegido, el desplegable muestra EL NIVEL QUE
  // RECOMIENDA EL MODELO, que es un nivel de verdad.
  //
  // ESTO ARREGLA UN DEFECTO Y RESPONDE UNA PREGUNTA, y las dos mitades importan:
  //
  // 1 · EL DEFECTO. Ayer la opcion de relleno iba `disabled`, y un navegador NO SELECCIONA una opcion
  //     deshabilitada: cae a la primera que si lo este. Con "Sin elegir" deshabilitada, un PAL sin decidir
  //     se veia como "Sedentario (1.2)" seleccionado. Es la MISMA familia que ya habiamos cazado (un
  //     `select` cuyo `value` no corresponde a ninguna `option` muestra la primera), y el `disabled` la
  //     reintrodujo por la puerta de atras: la opcion existia pero era inelegible, que para el navegador
  //     es casi lo mismo que no existir. Se vio como un parpadeo al guardar; era permanente.
  //
  // 2 · LA PREGUNTA (Santiago, 2026-09-01): que el boton deje el valor recomendado en vez de "Sin elegir".
  //     Asi queda, y SIN perder la distincion: lo que se muestra es el nivel del modelo, lo que se guarda
  //     sigue siendo `null` = "el profesional no lo decidio". Ver o decidir no son lo mismo, y separar las
  //     dos cosas deja las dos bien: la pantalla dice un nivel real y el registro no le atribuye al
  //     profesional una decision que no tomo.
  //
  // El borde imposible (que el modelo devuelva un factor fuera de su escala de cinco) se cubre con una
  // opcion propia, NO deshabilitada: preferimos mostrar un numero raro a mostrar uno falso.
  const modeloEnEscala = NIVELES_FA.some((n) => Number(n.valor) === modelo);
  const mostrado = value !== "" ? value : modeloEnEscala ? String(modelo) : "";
  return (
    <select
      name={name}
      value={mostrado}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Nivel de actividad física (PAL)"
      className={
        compacto
          ? "h-7 rounded-md border border-border bg-background px-1.5 text-sm tabular-nums text-foreground"
          : "h-9 w-36 rounded-md border border-border bg-background px-2 text-sm text-foreground"
      }
    >
      {mostrado === "" ? <option value="">{`modelo: ${modelo}`}</option> : null}
      {NIVELES_FA.map((n) => (
        <option key={n.valor} value={n.valor}>
          {n.label}
        </option>
      ))}
    </select>
  );
}
function AdjInput({
  name,
  label,
  value,
  onChange,
  placeholder,
  step,
}: {
  name?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  step: string;
}) {
  // El id sale de `useId` y no del `name`: el espejo no tiene name, y un `htmlFor` apuntando a nada deja
  // la etiqueta sin asociar (el clic no enfoca, y un lector de pantalla anuncia un campo sin nombre).
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-36"
      />
    </div>
  );
}

// Una fila de la vista previa (etiqueta + valor efectivo, con la derivacion entre parentesis). El `tag`
// distingue lo que el profesional FIJA de lo que sale CALCULADO (sub-tarea 3, cuidado b).
// LA CADENA SE LEE COMO UNA CUENTA, NO COMO UNA LISTA (cotejo 2026-08-31, punto 5). Su pantalla la
// dispone en vertical con el OPERADOR a la izquierda y una raya antes de cada resultado, que es como se
// lee una operacion: el profesional ve que el GET SALE de multiplicar, no que sea un tercer dato al lado
// de los otros dos. Nuestra version anterior era una lista de filas iguales: decia los mismos numeros y
// escondia que unos se derivan de otros.
//
// Lo unico que se porta es la DISPOSICION. Las dos marcas nuestras se conservan porque no las tiene y
// resuelven cosas reales: el tag "lo fijas arriba" (el objetivo aparece en los dos bloques y solo se edita
// en uno, instruccion suya del 26) y la distincion calculado/ajustado.
// LOS DOS RECALCULOS SON DOS ACTOS DISTINTOS, y por eso son dos botones y no uno (asi los tiene el
// tambien): "recalcular desde el objetivo" rehace el REPARTO por alimento, y "recalcular desde el
// intercambio" rehace la DISTRIBUCION por tiempos. Uno solo obligaria a rehacer las dos cosas para
// corregir una.
//
// LO QUE FALTABA NO ERAN LOS BOTONES, ERA EL FRENO. Los dos borran de un clic todo lo que el profesional
// ajusto a mano, y el aviso vivia solo en la etiqueta: se lee DESPUES de hacer clic, que es cuando ya no
// sirve. La confirmacion aparece SOLO si de verdad hay ajustes que perder; pedirla cuando no hay nada que
// borrar es la ceremonia que entrena a confirmar sin leer.
function BotonRecalcular({
  etiqueta,
  hayAjustes,
  onRecalcular,
  disabled,
}: {
  etiqueta: string;
  hayAjustes: boolean;
  onRecalcular: () => void;
  disabled: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!hayAjustes) {
    return (
      <Button type="button" variant="ghost" disabled={disabled} onClick={onRecalcular}>
        {etiqueta}
      </Button>
    );
  }

  // `key` distintas en los dos botones: es el hazard del wizard, que solo aparece en un navegador real.
  // Con la misma key React reutiliza el nodo y el clic que pide confirmacion aterriza en el que confirma.
  return confirmando ? (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-clinical-warning">Se pierden tus ajustes manuales.</span>
      <Button
        key="recalcular-confirmar"
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setConfirmando(false);
          onRecalcular();
        }}
      >
        Sí, recalcular
      </Button>
      <Button
        key="recalcular-cancelar"
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Button>
    </span>
  ) : (
    <Button
      key="recalcular-pedir"
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={() => setConfirmando(true)}
    >
      {etiqueta}
    </Button>
  );
}

function PrevRow({
  label,
  value,
  detail,
  tag,
  op,
  resultado,
  control,
}: {
  label: string;
  value: string;
  detail?: string;
  tag?: string;
  /** Operador de la cuenta ("×", "=", "−"). La columna es fija para que los signos queden alineados. */
  op?: string;
  /** Renglon de RESULTADO: raya arriba y numero en negrita, como el total de una operacion. */
  resultado?: boolean;
  /**
   * Control editable EN LUGAR del valor. Es el espejo de un campo que tambien vive arriba: mismo estado,
   * sin `name` (el name lo lleva la copia de arriba). Que un eslabon se pueda tocar donde se ve la cuenta
   * es lo que pidio el cotejo; que sea el MISMO dato y no una copia sincronizada es lo que impide que las
   * dos superficies discrepen.
   */
  control?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1 ${
        resultado ? "mt-0.5 border-t border-border pt-1.5" : ""
      }`}
    >
      <span className="flex min-w-0 items-baseline gap-1.5 text-muted-foreground">
        {/* Ancho fijo aunque no haya operador: sin el, las etiquetas de las filas con y sin signo
            arrancarian en columnas distintas y la cuenta dejaria de leerse como cuenta. */}
        <span className="w-3 shrink-0 text-right font-medium text-muted-foreground/70">{op ?? ""}</span>
        <span className={resultado ? "font-medium text-foreground" : ""}>{label}</span>
        {tag ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        ) : null}
      </span>
      <span
        className={`flex shrink-0 items-baseline gap-1.5 tabular-nums ${resultado ? "text-foreground" : "text-foreground/90"}`}
      >
        {control ?? <strong className={resultado ? "text-base" : ""}>{value}</strong>}
        {detail ? <span className="text-xs font-normal text-muted-foreground"> {detail}</span> : null}
      </span>
    </div>
  );
}

// Pieza 2 de la cadena calorica: los seis ajustes del profesional sobre el sugerido (peso meta + GEB, PAL,
// objetivo kcal, proteina g/kg, grasa %) en UN solo form. Unificado a proposito: saveAdjustments escribe las
// seis columnas de golpe, asi que dos forms sobre la misma accion se borrarian mutuamente (perdida de dato,
// no fragilidad futura). La vista previa recalcula EN VIVO con computeProtocoloEfectivo, la MISMA funcion que
// el servidor sella al aprobar: lo que ve el profesional == lo que se guarda. La seccion se REMONTA cuando el
// servidor cambia un ajuste (key = adjustmentSignature en el padre), evitando el estado pegado.

// La jerarquia visual de los bloques vive en @/components/shared/bloque: es decision de SISTEMA y no
// de esta pantalla. Aqui solo se dice de que NIVEL es cada seccion. Los tres niveles y su porque estan
// documentados alli y en BRAND.md.

// EL PESO META ES UN SOLO DATO CON DOS SUPERFICIES DE EDICION (Gildardo, 2026-08-28 §2): el campo de la
// entrada ("Meta de peso", en las condiciones de la toma) y el ajuste de este panel. Textual suyo: "no son
// dos pesos meta, es uno... si los construyen como campos separados, el defecto lo crean ustedes".
//
// YA NO HAY NADA QUE RESOLVER AQUI (migracion 0095): hasta el 2026-08-31 habia dos columnas y este panel
// las resolvia con un helper; ahora hay UNA (`evaluation_bis_intake.weight_goal_kg`) y el lector la trae
// como `pesoMetaFijado`, con `pesoMetaOrigen` diciendo de cual de las dos superficies salio. La
// resolucion en el lector era el paso intermedio correcto, pero un helper por el que TODOS tienen que
// acordarse de pasar sigue siendo mas fragil que no tener dos fuentes.

function CadenaCaloricaSection({
  evaluationId,
  protocol,
  locked,
  prescripcion,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
  /** La prescripcion del motor que gobierna, para AVISAR si su proteina difiere de la de la cadena. */
  prescripcion: PrescripcionNutricional | null;
}) {
  const [state, formAction, pending] = useActionState(saveAdjustmentsAction, EMPTY);
  // RefreshOnSuccess (no useFormToast): esta seccion se REMONTA por su key (adjustmentSignature) al guardar;
  // con useFormToast + revalidate en la accion, el remonte corria contra el efecto y el aviso de exito se
  // perdia. Aqui el toast se dispara y LUEGO el refresh. En warning (stale) NO refresca: preserva la edicion.
  useFormToastRefreshOnSuccess(state);
  // useState-once desde la prop; el remonte (key del padre) re-deriva cuando el servidor cambia algo.
  const [pesoMeta, setPesoMeta] = useState(numToInput(protocol.pesoMetaFijado));
  const [geb, setGeb] = useState(numToInput(protocol.adjGeb));
  const [pal, setPal] = useState(numToInput(protocol.adjPal));
  const [kcalObj, setKcalObj] = useState(numToInput(protocol.adjKcalObj));
  const [protGkg, setProtGkg] = useState(numToInput(protocol.adjProtGkg));
  const [fatPct, setFatPct] = useState(numToInput(protocol.adjFatPct));
  const [deficit, setDeficit] = useState(numToInput(protocol.adjDeficit));

  const snap = protocol.protocolSuggested;
  // Sin snapshot sellado (o sin cadena, o sin peso de calculo) no hay que ajustar: tratamiento pre-snapshot.
  if (!snap || protocol.pesoCalculo == null) return null;

  // Ajustes vivos (lo que hay en pantalla ahora) = exactamente lo que se guardara.
  const adj: ProtocoloAjustes = {
    geb: inputToNum(geb),
    pal: inputToNum(pal),
    kcalObj: inputToNum(kcalObj),
    protGkg: inputToNum(protGkg),
    fatPct: inputToNum(fatPct),
    deficit: inputToNum(deficit),
    // Vacio significa "nadie lo fijo": manda el peso CALCULADO. Ya no hay una segunda fuente detras (la
    // 0095 unifico el guardado), asi que el campo dice exactamente lo que gobierna.
    pesoMeta: inputToNum(pesoMeta),
  };
  // LA PROTEINA DEL MOTOR para los snapshots ANTERIORES al 2026-09-03, que no la traen sellada. La
  // pagina ya la trae aqui dentro de `prescripcion`, asi que no hace falta leer nada mas. Los sellados
  // desde esa fecha la ignoran: manda `snap.mtn.protKg`, que es lo reproducible.
  const opciones = { protKgVigente: prescripcion?.protKg ?? null };
  // MISMA funcion que sella el servidor: la vista previa no puede diverger de lo que se guarda (cuidado b).
  const efectivo = computeProtocoloEfectivo(snap, adj, opciones);
  const cal = efectivo.calorico;
  const base = snap.calorico; // cadena del MODELO (sellada), placeholder de cada campo.

  // ¿LA CIENCIA SE MOVIO DE VERDAD? Se DERIVA comparando cifras, no de que dos cadenas de version difieran.
  //
  // EL DEFECTO QUE CIERRA (smoke de Santiago, 2026-09-02): el aviso miraba solo
  // `snap.protocolEngineVersion !== PROTOCOL_ENGINE_VERSION`, y con eso NO SE PODIA APAGAR NUNCA.
  // `protocol_suggested` es write-once (trigger 0026): la version sellada no cambia al guardar ajustes ni
  // al reabrir. Santiago guardo sin cambiar nada, luego cambio valores y volvio a guardar, y el aviso
  // seguia ahi, porque NINGUNA accion de la aplicacion podia quitarlo. Un aviso que no se puede resolver
  // entrena a ignorarlo, que es peor que no tenerlo.
  //
  // Y ADEMAS AFIRMABA UN MOVIMIENTO QUE NO OCURRE: decia que "el peso meta y con el los gramos de proteina
  // pueden moverse". El peso meta sale de `snap.pesoCalculo`, que esta SELLADO; y el bump del 1-sep toco
  // `motorTratNutri`, cuyo peso meta interno Atlas ni siquiera ejecuta. Para esa diferencia de version no
  // se mueve NADA.
  //
  // LO QUE SI ES CIERTO: las cifras salen del codigo de HOY corriendo sobre los inputs SELLADOS. Asi que la
  // pregunta con respuesta es esta: el codigo de hoy, sobre esos mismos inputs y SIN ajustes, ¿da la misma
  // cadena que la sellada? Se comparan SIN ajustes a proposito: con ellos, la diferencia diria lo que
  // cambio el profesional, no lo que cambio la ciencia.
  const SIN_AJUSTES = {
    geb: null,
    pal: null,
    kcalObj: null,
    protGkg: null,
    fatPct: null,
    deficit: null,
    pesoMeta: null,
  };
  const modeloHoy = computeProtocoloEfectivo(snap, SIN_AJUSTES, opciones).calorico;
  const kcalSellado = Math.round(base.kcalObj);
  const kcalHoy = Math.round(modeloHoy.kcalObj);
  const protSellada = Math.round(base.protG);
  const protHoy = Math.round(modeloHoy.protG);
  const cienciaSeMovio = kcalSellado !== kcalHoy || protSellada !== protHoy;
  // SOBRE QUE PESO SE COMPARA, que es el dato que al aviso le faltaba (smoke 2026-09-03).
  //
  // El aviso comparaba SIN ajustes (peso de calculo del modelo) y los campos de abajo corren CON ellos
  // (peso meta del profesional). Para el paciente del smoke eso son dos cifras distintas del mismo
  // concepto en la misma pantalla, sin nada que las explique: 1.631 kcal y 85 g arriba, 1.529 kcal y 78 g
  // abajo. El profesional lo lee como una contradiccion, y tiene razon en leerlo asi.
  //
  // NO SE CAMBIA LA COMPARACION, SE DICE. Comparar sin ajustes es lo correcto y no solo lo defendible:
  //   1. Con ajustes, la diferencia mezclaria lo que cambio el MODELO con lo que cambio el PROFESIONAL, y
  //      el aviso dejaria de responder la pregunta que existe para responder.
  //   2. Y peor: un override a mano haria DESAPARECER el aviso. Si el profesional fijo el objetivo
  //      calorico, lo sellado y lo de hoy mostrarian ese mismo numero, la diferencia seria cero y el aviso
  //      se callaria justo en los pacientes cuya cadena mas se toco, con la ciencia movida por debajo.
  //
  // Asi que el aviso NOMBRA su peso, y solo menciona el otro cuando de verdad difieren: con un unico peso
  // la aclaracion seria ruido, y un aviso con ruido se deja de leer.
  const pesoEfectivo = adj.pesoMeta ?? protocol.pesoCalculo;
  const pesoModelo = protocol.pesoCalculo;
  const pesosDifieren = pesoModelo != null && Math.abs(pesoEfectivo - pesoModelo) > 0.05;
  // DE DONDE VIENE el peso meta que gobierna. Es UN valor, pero saber en cual de las dos superficies se
  // fijo es informacion clinica y por eso se conservo al unificar: no es lo mismo el peso acordado con el
  // paciente en la consulta que uno ajustado despues, aqui, al armar el plan.
  const origenPeso: "tratamiento" | "entrada" | "calculado" = protocol.pesoMetaOrigen ?? "calculado";

  // Firma de los ajustes GUARDADOS (de la prop, invariante mientras se edita): es lo que el cliente cargó y
  // contra lo que el servidor compara bajo lock. NO la de lo que se esta editando.
  const baseSignature = adjustmentSignature({
    treatmentId: protocol.treatmentId,
    adjGeb: protocol.adjGeb,
    adjPal: protocol.adjPal,
    adjKcalObj: protocol.adjKcalObj,
    adjProtGkg: protocol.adjProtGkg,
    adjFatPct: protocol.adjFatPct,
    adjDeficit: protocol.adjDeficit,
    pesoMetaFijado: protocol.pesoMetaFijado,
  });

  const pesoCalcDisp = d1(protocol.pesoCalculo);

  // Reparto en kcal (sub-tarea 3). Cuadra EXACTO por construccion: choKcal = kcalObj - protKcal - fatKcal
  // (residuo, sin redondeo), asi que protKcal + fatKcal + choKcal == kcalObj SIEMPRE. Unico borde: si la
  // proteina + grasa que fija el profesional ya exceden el objetivo, choKcal se clampea a 0 y la suma pasa
  // el objetivo (senal clinica: no hay margen para carbohidratos). Los gramos van redondeados para la receta;
  // el cuadre se afirma sobre las kcal, no sobre gramos*factor (que pueden diferir por redondeo).
  const macrosKcal = cal.protKcal + cal.fatKcal + cal.choKcal;
  const proteinaGrasaExcedenObjetivo = cal.protKcal + cal.fatKcal > cal.kcalObj;
  const protPct = cal.kcalObj > 0 ? Math.round((cal.protKcal / cal.kcalObj) * 100) : 0;
  // El objetivo coincide con el GET cuando NO hay override y el deficit del modelo es 0 (decision de Gildardo:
  // el sistema no deriva el objetivo, deja mantenimiento). Se explica junto al numero para que la coincidencia
  // GET == objetivo no se lea como un error (fix 1: Santiago dudo, un nutricionista tambien).
  const objetivoEsMantenimiento = adj.kcalObj == null && cal.kcalObj === cal.get;
  // Deficit SELLADO de la estrategia, la misma fuente que entra al motor (`snap.estrategia.deficit`). No
  // se re-deriva de GET - objetivo: si el profesional fija el objetivo a mano, esa resta daria un numero
  // que el modelo nunca calculo y el renglon estaria diciendo que el modelo mando algo que no mando.
  // El deficit EFECTIVO: el del profesional si lo fijo, y si no el del modelo. Es la misma resolucion que
  // hace `computeProtocoloEfectivo`, y tiene que serlo: con la del modelo a secas, el renglon "= Objetivo
  // del modelo" no cuadraria con la cuenta en cuanto alguien escribiera un deficit, y una cuenta cuyo total
  // no sale de sus terminos es una lista que miente.
  const deficitCadena = adj.deficit ?? snap.estrategia.deficit ?? 0;
  // A DONDE LLEGA LA CUENTA por si sola, con la MISMA aritmetica del motor (:14128), piso incluido. Se
  // computa aparte del objetivo efectivo porque los dos pueden diferir por dos razones distintas: que el
  // profesional lo haya fijado a mano, o que el piso de 1.000 kcal haya mordido. Una cuenta cuyo renglon
  // final no es el resultado de los de arriba deja de ser una cuenta y pasa a ser una lista que miente.
  const objetivoDelModelo = Math.max(1000, Math.round(cal.get - deficitCadena));
  const objetivoLoFijoElProfesional = adj.kcalObj != null;
  const pisoMordio = !objetivoLoFijoElProfesional && Math.round(cal.get - deficitCadena) < 1000;

  return (
    // DOS BLOQUES, NO UNO, por instruccion suya (2026-08-26 Parte 2, §8.1). Habiamos propuesto FUNDIRLOS y
    // dijo que no, con una razon que es de orden de trabajo y no de estetica:
    //
    //   "La formula desarrollada depende de la decision del nutricionista de subir o bajar las calorias.
    //    PRIMERO SE DECIDE LA META; DESPUES SE VE LA CADENA QUE LA PRODUCE. Fundirlas invierte el orden y
    //    empuja al profesional a mover la calculadora cuando lo que queria era fijar un objetivo."
    //
    // Y concedio los tres beneficios que habiamos pedido, sin fundir: el cuadre de macros va en el bloque
    // de la FORMULA, la distincion entre calculado y ajustado tambien, y el objetivo (que aparece en los
    // dos) queda EDITABLE EN UNO Y EN LECTURA EN EL OTRO.
    //
    // LO QUE NO SE PARTE ES EL GUARDADO, y es deliberado: los seis ajustes son una columna cada uno pero
    // UNA SOLA unidad clinica, `saveAdjustments` las escribe de golpe y `adjustmentSignature` cubre las
    // seis. Partir el guardado obligaria a dos firmas sobre las mismas columnas, y un guardado parcial
    // dejaria que la cadena de un profesional pisara la meta de otro. Se parte la PRESENTACION; el
    // formulario y su boton siguen siendo uno.
    <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-4">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      {/* Firma de concurrencia: lo que el cliente cargó. Si otro profesional cambió la cadena, el servidor
          lo detecta bajo lock y rechaza sin pisar. */}
      <input type="hidden" name="baseSignature" value={baseSignature} />
      <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4">
        {/* BLOQUE 1 · LA META. Lo que el profesional DECIDE. */}
        <section className={bloqueCls("decision")}>
          <h3 className={tituloBloqueCls("decision")}>Objetivo del plan</h3>
          <p className="text-sm text-muted-foreground">
            {snap.estrategia.label}
            {snap.estrategia.perfil ? ` · ${snap.estrategia.perfil}` : ""}. Deja un campo vacío para usar
            el valor del modelo.
          </p>
          <div className="flex flex-wrap gap-3">
            <AdjInput
              name="pesoMeta"
              label="Peso meta (kg)"
              value={pesoMeta}
              onChange={setPesoMeta}
              placeholder={`calculado: ${pesoCalcDisp}`}
              step="0.1"
            />
            <AdjInput
              name="adjKcalObj"
              label="Objetivo (kcal)"
              value={kcalObj}
              onChange={setKcalObj}
              placeholder={`modelo: ${d0(base.kcalObj)}`}
              step="1"
            />
            {/* LOS CUATRO CAMPOS JUNTOS, como su pantalla los agrupa (cotejo 2026-09-01, punto a). El PAL
                y el deficit tambien se ven abajo, dentro de la cuenta, con el MISMO estado: se cambia uno
                y el otro cambia con el, porque no son dos campos, es uno mostrado dos veces. */}
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium leading-none">PAL (factor)</span>
              <PalSelect name="adjPal" value={pal} onChange={setPal} modelo={base.pal} />
            </label>
            <AdjInput
              name="adjDeficit"
              label="Déficit (kcal)"
              value={deficit}
              onChange={setDeficit}
              placeholder={`modelo: ${d0(snap.estrategia.deficit ?? 0)}`}
              step="1"
            />
          </div>
          {/* El valor del modelo, FUERA de la lista y con su nombre. Mismo patron que el peso meta: el
              valor sugerido se dice, y volver a el es un boton. */}
          <p className="flex flex-wrap items-baseline gap-2 text-xs">
            {pal === "" ? (
              // El desplegable YA muestra el nivel; aqui solo se dice de quien es. La distincion la pidio
              // conservar el propio diseño: ver el nivel del modelo no es lo mismo que haberlo elegido, y
              // el registro no debe atribuirle al profesional una decision que no tomo.
              <span className="text-muted-foreground">
                Actividad <strong>recomendada por el modelo</strong>. Elige otra si no corresponde.
              </span>
            ) : (
              <button
                type="button"
                className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                onClick={() => setPal("")}
                disabled={locked}
                title="Deja el nivel que recomienda el modelo, sin registrarlo como decisión tuya"
              >
                Usar la recomendación del modelo ({nivelFaLabel(base.pal)})
              </button>
            )}
            {/* EL DEFICIT NO LLEVA TECHO NI PISO (Gildardo 2026-08-27 §5: "no existe techo y no existe
                piso; existe una recomendacion, y punto"). Lo unico que se dice es que un negativo es un
                superavit, porque es la mitad de la escala que nadie espera de un campo llamado deficit. */}
            <span className="text-muted-foreground">
              Un déficit negativo es un superávit (para recuperar peso).
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {origenPeso === "tratamiento" ? (
              <span className="text-clinical-optimal">
                Peso meta fijado por ti aquí:{" "}
                <strong>{d1(protocol.pesoMetaFijado as number)} kg</strong>.
              </span>
            ) : origenPeso === "entrada" ? (
              <span className="text-clinical-optimal">
                Peso meta fijado en la entrada:{" "}
                <strong>{d1(protocol.pesoMetaFijado as number)} kg</strong>. Es el mismo campo, no otro:
                cambiarlo aquí lo cambia también allá.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Peso meta sin registrar: se usa el calculado <strong>{pesoCalcDisp} kg</strong>
                {protocol.pesoCalculoLabel ? ` (${protocol.pesoCalculoLabel})` : ""}, un valor CALCULADO.
              </span>
            )}
            {/* Vacia el campo. Al guardar vacio, el peso meta queda null (en las DOS superficies, que son
                una) y manda el pesoCalculo COMPLETO, no el mostrado redondeado. */}
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
              onClick={() => setPesoMeta("")}
              disabled={locked}
              title="Vacía el campo; guarda para volver al peso calculado"
            >
              Usar el calculado ({pesoCalcDisp} kg)
            </button>
          </div>
          {/* La distincion CALCULADO vs AJUSTADO, que es el segundo de los tres beneficios que concedio. */}
          <p className="flex items-baseline justify-between gap-4 border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">Objetivo calórico del plan</span>
            <span className="font-semibold text-foreground">
              {d0(cal.kcalObj)} kcal
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {adj.kcalObj != null ? "fijado por ti" : "sugerido por el modelo"}
              </span>
            </span>
          </p>
        </section>

        {/* BLOQUE 2 · LA CADENA QUE PRODUCE ESA META. */}
        <section className={bloqueCls("derivado")}>
          <h3 className={tituloBloqueCls("derivado")}>Cómo se llega a ese objetivo</h3>
          <p className="text-sm text-muted-foreground">
            Ajusta cualquier eslabón: la vista previa se recalcula en vivo con la misma fórmula que se
            sella al aprobar.
          </p>
          <div className="flex flex-wrap gap-3">
            <AdjInput
              name="adjGeb"
              label="GEB (kcal)"
              value={geb}
              onChange={setGeb}
              placeholder={`modelo: ${d0(base.geb)}`}
              step="1"
            />
            {/* PAL COMO DESPLEGABLE, no campo libre (cotejo 2026-08-31, decisión de Santiago). Un campo
                libre deja escribir 3, que no es un factor de actividad que exista; el desplegable con sus
                cinco niveles ES su instrumento. La opción vacía conserva nuestra semántica: sin elegir,
                manda el valor del modelo.

                EL RÓTULO SIGUE SIENDO "PAL", y no es un detalle: su §8.1 del 26 dice que «Actividad
                prescrita (FA)» y «Factor actividad (PAL)» son el mismo factor con dos nombres, y nos mandó
                "unifíquenlo en el suyo", que es PAL. Al portar su desplegable estuve a punto de traerme
                también su rótulo, que es justo el desliz que él pidió no copiar. Lo atrapó el candado. */}
            <AdjInput
              name="adjProtGkg"
              label="Proteína (g/kg)"
              value={protGkg}
              onChange={setProtGkg}
              placeholder={`modelo: ${base.protGKg}`}
              step="0.1"
            />
            <AdjInput
              name="adjFatPct"
              label="Grasa (%)"
              value={fatPct}
              onChange={setFatPct}
              placeholder={`modelo: ${base.fatPct}`}
              step="1"
            />
          </div>
          {/* LA CADENA SE SELLO CON UNA CIENCIA ANTERIOR, y hay que decirlo donde se ve la cifra.
              EL HUECO QUE CIERRA: el mecanismo de vigencia de emision compara tres dimensiones
              (`classification`, `calibration`, `structural_mccb`) y NO el protocolo. La version del motor
              calorico se sella dentro de `protocol_suggested` y no la mira nadie: al medirlo habia CINCO
              versiones distintas vivas en la base. Asi que subir la version, por si sola, no avisaba a
              nadie.
              POR QUE AQUI Y NO EN EL AVISO GENERAL: es donde el nutricionista va a ver la cifra que
              cambia. Un aviso arriba, en la pantalla de diagnostico, no llega a la pantalla donde se
              prescribe. Y se dice QUE cambia, no solo que hay desfase: sin eso, "emitido con version
              anterior" no le dice si tiene que hacer algo. */}
          {/* CONTENEDOR NEUTRO, NO AMBAR, y el motivo es de proporcion (2026-09-03). Al pasar la
              proteina a prescribirse por el motor, este aviso deja de ser raro: lo van a ver 56 de los 60
              tratamientos de la base, o sea casi todos. Una franja ambar en casi toda la base no comunica
              "revisa esto", comunica "algo se rompio", y entrena a ignorarla. El hecho que reporta es
              normal despues de una actualizacion del modelo, y el texto ya dice QUE cambia y que lo
              sellado sigue siendo valido. El contenedor tambien afirma, no solo el texto. */}
          {cienciaSeMovio ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Esta cadena se selló con una versión anterior del modelo ({snap.protocolEngineVersion}), y con
              el de hoy las cifras del modelo <strong>no dan lo mismo</strong>
              {kcalSellado !== kcalHoy ? `: el objetivo daría ${kcalHoy} kcal en vez de ${kcalSellado}` : ""}
              {protSellada !== protHoy
                ? `${kcalSellado !== kcalHoy ? ", y" : ":"} la proteína, ${protHoy} g en vez de ${protSellada}`
                : ""}
              {pesosDifieren
                ? `. Las dos cifras se comparan sobre el peso de cálculo del modelo (${d1(pesoModelo!)} kg) y sin tus ajustes, para separar lo que cambió el modelo de lo que cambiaste tú; los campos de abajo usan el peso meta que fijaste (${d1(pesoEfectivo)} kg), así que darán otro número`
                : `. Se comparan sin tus ajustes, para separar lo que cambió el modelo de lo que cambiaste tú`}
              . Lo sellado sigue siendo válido para la fecha en que se emitió. Los campos de abajo ya usan el
              modelo de hoy.
            </p>
          ) : null}

          {/* EL AVISO DE LAS DOS PROTEINAS SE RETIRO EL 2026-09-03, porque ya no hay dos.
              Existia para que el profesional no descubriera a ojo que el chip de arriba decia 1 g/kg
              (lo que prescribe `motorTratNutri`) y esta cadena calculaba con 0,8 (el `protMin` de
              `motorProtocolo`). Era el sintoma visible de P-32/P-35, y Gildardo la respondio en su §9.6
              punto 4: "la proteina la prescribe el motor -1 g/kg, no el minimo poblacional de 0,8-".
              Ahora la cadena LEE esa misma cifra, asi que las dos coinciden por construccion y el aviso
              solo podria dispararse cuando el profesional escribe otra a proposito. Advertir sobre la
              cifra que el acaba de escribir es justo lo que su §5 del 27-ago prohibe. En su lugar va la
              linea de PROCEDENCIA de abajo, que informa sin corregir. */}
          {efectivo.protFuente === "protMin" ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              La proteína de esta cadena sale del mínimo poblacional, no del modelo de nutrición: esta
              evaluación no tiene encuesta legible. Al volver a diagnosticar, la prescribe el modelo.
            </p>
          ) : null}

          {/* Vista previa EN VIVO: la cadena efectiva con lo que hay en pantalla, antes de guardar. */}
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cadena efectiva (vista previa)
            </p>
            {/* LA CUENTA, en el orden en que se hace: del peso sale el GEB, por el PAL da el GET, y de
                ahi el objetivo. El peso NO lleva operador porque es el punto de partida, no un termino. */}
            <PrevRow label="Peso efectivo" value={`${d1(pesoEfectivo)} kg`} />
            <PrevRow
              label="Gasto energético basal (GEB)"
              value={`${d0(cal.geb)} kcal`}
              detail={`(${cal.formula})`}
            />
            <PrevRow
              op="×"
              label="Nivel de actividad física (PAL)"
              value={String(cal.pal)}
              control={<PalSelect value={pal} onChange={setPal} modelo={base.pal} compacto />}
            />
            <PrevRow op="=" resultado label="Gasto energético total (GET)" value={`${d0(cal.get)} kcal`} />
            {/* El deficit se muestra SIEMPRE, tambien cuando es 0, y es deliberado: es un eslabon de la
                cuenta, y una cuenta a la que le falta un renglon no cuadra a la vista. Hoy el modelo no
                aplica deficit por fenotipo (Gildardo los retiro el 19), asi que el 0 es el estado normal,
                no un dato faltante; el rotulo lo dice para que no se lea como un hueco. */}
            <PrevRow
              // SIEMPRE "−": es un DEFICIT, y lo que la fila dice es que operacion entra en la cuenta, no
              // si esa operacion cambia algo. Con el signo colgando del valor, un deficit de 0 aparecia
              // como "+ Deficit del modelo", que es una suma que nadie hace.
              op="−"
              label={adj.deficit != null ? "Déficit (lo fijas tú)" : "Déficit del modelo"}
              control={
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={deficit}
                  onChange={(e) => setDeficit(e.target.value)}
                  placeholder={d0(snap.estrategia.deficit ?? 0)}
                  aria-label="Déficit calórico (kcal)"
                  className="h-7 w-20 rounded-md border border-border bg-background px-1.5 text-right text-sm tabular-nums text-foreground"
                />
              }
              value=""
              detail="kcal"
            />
            {/* A DONDE LLEGA LA CUENTA. Cuando el profesional NO fijo el objetivo, este renglon ES el
                objetivo y no hay dos numeros. Cuando SI lo fijo, se muestran los dos y rotulados: el de la
                cuenta y el suyo, que la reemplaza. Es la distincion calculado/ajustado, en el sitio donde
                de verdad se decide algo. */}
            <PrevRow
              op="="
              resultado={!objetivoLoFijoElProfesional}
              label={objetivoLoFijoElProfesional ? "Objetivo del modelo" : "Objetivo calórico"}
              tag={objetivoLoFijoElProfesional ? undefined : "lo fijas arriba"}
              value={`${d0(objetivoDelModelo)} kcal`}
              detail={
                pisoMordio
                  ? "(piso de 1.000 kcal)"
                  : objetivoEsMantenimiento
                    ? "(= GET: sin déficit, el objetivo es de mantenimiento salvo que lo fijes tú)"
                    : undefined
              }
            />
            {objetivoLoFijoElProfesional ? (
              <PrevRow
                op="→"
                resultado
                label="Objetivo del plan"
                tag="lo fijas arriba"
                value={`${d0(cal.kcalObj)} kcal`}
                detail="(fijado por ti; reemplaza el del modelo)"
              />
            ) : null}
            {/* Biody reubicado aqui (checkpoint 2.4), aclarado: son DOS fuentes distintas de gasto. Santiago
                dudo al ver "medido 2590" al lado de la cadena que calcula otro numero. La base del plan es el
                CALCULADO (como el HTML); el medido queda como referencia del equipo. */}
            {protocol.kcalSugerido != null ? (
              <p className="pt-1 text-xs text-muted-foreground">
                El equipo (Biody) <strong>midió</strong> un gasto de {protocol.kcalSugerido} kcal; la cadena
                de arriba lo <strong>calcula</strong> por fórmula (GEB × actividad). Son dos fuentes
                distintas: la base del plan es el <strong>calculado</strong>, el medido queda como
                referencia.
              </p>
            ) : null}

            {/* Reparto de macronutrientes. El profesional FIJA proteina y grasa; los carbohidratos salen del
                residuo (calculado). El tag lo hace explicito para que no crea que ajusta los tres. Va en
                ESTE bloque por instruccion suya: "el cuadre de macros puede mostrarse en el bloque de la
                formula". */}
            <p className="pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reparto de macronutrientes
            </p>
            <PrevRow
              op="+"
              label="Proteína"
              tag="la fijas tú (g/kg de peso)"
              value={`${d0(cal.protG)} g`}
              detail={`(${cal.protGKg} g/kg · ${protPct}% · ${d0(cal.protKcal)} kcal)`}
            />
            <PrevRow
              op="+"
              label="Grasa"
              tag="la fijas tú (% de las calorías)"
              value={`${d0(cal.fatG)} g`}
              detail={`(${cal.fatPct}% · ${d0(cal.fatKcal)} kcal)`}
            />
            <PrevRow
              op="+"
              label="Carbohidratos"
              tag="calculado (residuo)"
              value={`${d0(cal.choG)} g`}
              detail={`(${cal.choPct}% · ${d0(cal.choKcal)} kcal)`}
            />
            {/* Cuadre: la suma en kcal es exacta por construccion (== objetivo), salvo el borde de excedente. */}
            {proteinaGrasaExcedenObjetivo ? (
              <p className="mt-2 rounded-md border border-clinical-critical/40 bg-clinical-critical-bg px-2 py-1.5 text-xs text-clinical-critical">
                La proteína y la grasa que fijaste suman <strong>{d0(macrosKcal)} kcal</strong>, más que el
                objetivo ({d0(cal.kcalObj)} kcal). No queda margen para carbohidratos (0 g). Baja la
                proteína o la grasa, o sube el objetivo calórico.
              </p>
            ) : (
              <p className="mt-0.5 flex items-baseline justify-between gap-4 border-t border-border pt-1.5 text-sm text-clinical-optimal">
                <span className="flex items-baseline gap-1.5">
                  <span className="w-3 shrink-0 text-right font-medium">=</span>
                  <span className="font-medium">Suma de los tres</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong className="text-base">{d0(macrosKcal)} kcal</strong>
                  <span className="text-xs font-normal"> = objetivo</span>
                </span>
              </p>
            )}
          </div>
        </section>

        {/* Un solo boton para los dos bloques: el guardado es atomico sobre las seis columnas. */}
        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Guardando..." : "Guardar ajustes"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}


export function TreatmentPanel({
  evaluationId,
  protocol,
  patronAlimentario,
  prescripcion,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  // Lo que el paciente DECLARO (d4_34). Llega como prop desde la pagina, que ya leyo la encuesta: es una
  // de las TRES fuentes de restriccion que deciden si la IA entra, y sin ella la pantalla diria "no hay
  // nada que adaptar" a un vegano. Un texto que describe mal lo que hace el motor es defecto de seguridad.
  patronAlimentario: string[];
  // Prescripcion del motor que gobierna (motorTratNutri), computada al vuelo por la pagina. null si la
  // evaluacion no tiene encuesta legible: ahi se cae a lo sellado, marcado como tal.
  prescripcion: PrescripcionNutricional | null;
}) {
  // Bloqueado para editar si el diagnostico no esta confirmado O si el protocolo YA se aprobo (la
  // prescripcion aprobada es inmutable: el trigger de BD la congela; sin este candado el campo se veria
  // editable y el guardado chocaria contra el trigger). Se distinguen para dar el mensaje correcto.
  const diagnosisPending = !protocol.diagnosisConfirmed;
  const locked = diagnosisPending || protocol.approved;
  // Restricciones del MODELO (salida del motor, selladas write-once). Un tratamiento anterior al snapshot
  // no las tiene: lista vacia, no aviso.
  const snapRestricciones = protocol.protocolSuggested?.restricciones ?? [];
  // Objetivo EFECTIVO desde los ajustes GUARDADOS, para el título del bloque de objetivo. Misma fuente que
  // la cadena y que el intercambio: el título no puede decir un número distinto del que se prescribe.
  const objetivoEfectivoPanel = protocol.protocolSuggested
    ? Math.round(
        computeProtocoloEfectivo(protocol.protocolSuggested, {
          geb: protocol.adjGeb,
          pal: protocol.adjPal,
          kcalObj: protocol.adjKcalObj,
          protGkg: protocol.adjProtGkg,
          fatPct: protocol.adjFatPct,
          deficit: protocol.adjDeficit,
          pesoMeta: protocol.pesoMetaFijado,
        }, { protKgVigente: prescripcion?.protKg ?? null }).calorico.kcalObj,
      )
    : null;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocolo de tratamiento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {diagnosisPending ? (
          <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
            El protocolo esta bloqueado porque el diagnostico aun no esta confirmado. Confirmalo en la
            pestana Diagnostico (el boton de confirmar esta al final de esa pagina); al confirmarlo se
            habilita editar y aprobar el tratamiento.
          </p>
        ) : protocol.approved ? (
          <ProtocoloAprobado evaluationId={evaluationId} protocol={protocol} />
        ) : null}

        {/* ESTA PRESCRIPCIÓN REEMPLAZA A OTRA. Va aunque el protocolo esté en borrador: es justo mientras
            se rehace cuando el profesional necesita saber que hay una anterior que el paciente ya tiene. */}
        {!protocol.approved && protocol.aprobacionesPrevias > 0 ? (
          <div className="rounded-md border border-attention/40 bg-attention-bg px-3 py-2 text-sm text-attention">
            <p className="font-medium">Esta prescripción reemplaza a otra que el paciente ya recibió.</p>
            <p className="pt-1 text-foreground/90">
              {protocol.aprobacionesPrevias === 1
                ? "Hay una prescripción anterior aprobada"
                : `Hay ${protocol.aprobacionesPrevias} prescripciones anteriores aprobadas`}
              , guardada{protocol.aprobacionesPrevias === 1 ? "" : "s"} en la historia del paciente.
              {protocol.reopenReason ? ` Motivo de la última reapertura: "${protocol.reopenReason}".` : ""}{" "}
              {/* DECIA "Al aprobar la nueva se le avisará". NO ES ASI: aprobar sella la prescripción y
                  escribe el evento en la auditoría, y nada más; el paciente se entera cuando le envías el
                  reporte, que es un acto tuyo aparte. Un texto que le dice al profesional que el sistema
                  avisa por él hace que NO avise. Su §12c exige que se le diga; lo que no existe es el
                  automatismo, y eso va preguntado, no inventado. */}
              Cuando apruebes la nueva, envíale el reporte: cambia lo que come y hoy el sistema no se lo
              avisa solo.
            </p>
          </div>
        ) : null}
        {/* AGRUPACION (2026-08-22): dos bloques SEGUIDOS, sin nivel de navegacion nuevo (el orden natural es
            leer el caso y bajar a construir; no son dos modos alternativos, son dos momentos). Arriba LECTURA
            del diagnostico (resumen + meta, que rendriza el Panel server, + objetivo + guias + salud celular);
            una marca de bloque abajo abre el PLAN ALIMENTARIO. La marca es visual, NO un control. */}
        <ObjetivoSection
          key={sectionKey("objetivo", objetivoSignature({ treatmentId: protocol.treatmentId, objetivo: protocol.objetivoTexto }))}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
          prescripcion={prescripcion}
          kcalObjetivo={objetivoEfectivoPanel}
        />
        {/* LAS GUIAS DIETARIAS SE RETIRARON (2026-08-31, declarado en la ronda del 31).

            Eran nuestras: su archivo no tiene una lista de guias. Lo que el tiene es el objetivo del
            tratamiento (texto libre, que si conservamos) mas los atributos que calcula el motor
            ("Hiposodica", "Patron DASH", "Nefroprotectora"), que ahora se muestran en el bloque de objetivo.
            Una caja mas para escribir lo mismo con otras palabras no aporta y alarga la pantalla.

            CUIDADO, Y VA DECLARADO: el 2026-08-26 el APROBO la caja explicitamente ("la caja se queda"), asi
            que retirarla es ir contra una decision suya aunque el argumento sea bueno. Se le dice en la
            ronda con la razon, y si las quiere se devuelven: el servicio, la accion y la tabla
            `treatment_diet_guidelines` NO se tocan, asi que volver a montarlo es un componente, y ninguna
            guia guardada se pierde. */}

        {/* Marca de bloque: aqui empieza el PLAN ALIMENTARIO. Borde superior mas fuerte + titulo, distinto de
            los separadores de seccion (border-t simple), para que se vea donde termina la lectura y empieza el
            plan. No es navegacion: se sigue en un solo scroll. */}
        <div className="mt-4 border-t-2 border-foreground/20 pt-6">
          <h3 className="text-base font-bold text-foreground">Plan alimentario</h3>
        </div>

        {/* Aviso ACCIONABLE de realimentacion (instruye: QUE hacer con las kcal), ENCIMA de la cadena, que es
            donde el nutricionista fija el objetivo calorico. La lectura informativa (QUE tiene el paciente) va
            en el resumen. Aqui no depende de la posicion de la cadena: se ancla al inicio del bloque del plan. */}
        {protocol.protocolSuggested?.alertaSindRealim ? (
          <RealimentacionAlert>
            Riesgo de síndrome de realimentación. Inicia con 10 kcal/kg/día y aumenta de forma gradual (ASPEN
            2023). Vigila fósforo, potasio, magnesio y tiamina; los exámenes críticos están en la vista del
            médico.
          </RealimentacionAlert>
        ) : null}

        {/* Restricciones del MODELO (porte fiel del v8, aviso al inicio de la Formula sintetica = nuestra
            cadena). Son las contraindicaciones por comorbilidad/fenotipo que calcula el motor (proteina,
            fosforo y potasio por IRC; sodio por HTA; CHO simples por DM; AGS y ultraprocesados por
            fenotipo), CON su referencia. Solo lectura: no son editables, son la salida del motor. Van
            ENCIMA de la cadena porque es lo que el nutricionista debe saber que excluir ANTES de armar el
            plan; hasta 2026-08-23 el motor las calculaba y nadie las veia mientras armaba (hueco clinico
            EN2 del barrido, COTEJOS_VISUALES). Distintas del campo de restricciones del PROFESIONAL, que
            vive junto al menu y es aditivo. */}
        {/* La prescripción del modelo se muestra en el BLOQUE DE OBJETIVO, no aquí (cotejo 2026-08-31,
            punto h): es la misma información que su chip y sus atributos, y decía dos veces lo mismo. El
            respaldo de lo SELLADO se conserva para las evaluaciones sin encuesta legible, donde el motor no
            puede correr y lo único que hay es lo que se computó al diagnosticar. */}
        {!prescripcion && snapRestricciones.length > 0 ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium">Restricciones del modelo (de la emisión)</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {snapRestricciones.map((r) => (
                <li key={r.nombre}>
                  {r.nombre}: {r.valor} <span className="opacity-80">({r.ref})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* ORDEN DE GILDARDO (2026-08-24): la validacion va ARRIBA, antes de la formula. Su logica es fijar
            la meta, ver si el plan la cumple, ajustar y repartir; en un SEGUIMIENTO, que va a ser el caso
            frecuente, responde la primera pregunta del profesional. DERIVADA en vivo, solo lectura, no
            persiste (no puede desfasarse), asi que subirla no mueve ninguna firma ni ningun candado. */}
        <ValidacionSection protocol={protocol} />
        {/* key = firma de los seis ajustes: un cambio del servidor remonta la seccion (no queda pegada). */}
        <CadenaCaloricaSection
          key={sectionKey(
            "cadena",
            // El peso meta de INGRESO va en la KEY y NO en la firma, y la distincion importa: la firma es el
            // candado de concurrencia que el servidor recomputa sobre las columnas que ESTE formulario
            // escribe (adj_*), y meterle un dato de otra tabla la haria diverger. La key solo tiene que
            // remontar la seccion cuando el servidor cambia algo que se muestra, y el peso del ingreso se
            // muestra (placeholder, procedencia, boton). Sin esto la seccion quedaria pegada al valor viejo.
            adjustmentSignature({
              treatmentId: protocol.treatmentId,
              adjGeb: protocol.adjGeb,
              adjPal: protocol.adjPal,
              adjKcalObj: protocol.adjKcalObj,
              adjProtGkg: protocol.adjProtGkg,
              adjFatPct: protocol.adjFatPct,
              adjDeficit: protocol.adjDeficit,
              pesoMetaFijado: protocol.pesoMetaFijado,
            }) + `§origen:${protocol.pesoMetaOrigen ?? ""}`,
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
          prescripcion={prescripcion}
        />
        {/* Intercambio (CP1.2b): despues de la cadena, que le da el objetivo. key = firma del intercambio
            guardado: un cambio del servidor remonta y re-deriva las porciones (no queda pegado). */}
        <IntercambioSection
          key={sectionKey(
            "intercambio",
            intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: protocol.intercambioPorciones }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Tiempos de comida (CP2.3): seccion propia, MANDAN sobre la distribucion y sobre el menu. Va antes
            de las dos, que es el orden en que se decide. key = su propia firma.
            DIVERGENCIA DELIBERADA de su orden (2026-08-24): el los pone DESPUES de la tabla de distribucion.
            Como gobiernan el reparto, ponerlos despues obliga a subir a corregir. Reportado en la ronda. */}
        <TiemposActivosSection
          key={sectionKey(
            "tiempos-activos",
            tiemposActivosSignature({ treatmentId: protocol.treatmentId, activos: protocol.tiemposActivos }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Distribucion (CP2.2b): despues del intercambio, que le da las porciones. key = firma de tiempos (remonta). */}
        <TiemposSection
          key={sectionKey("tiempos", tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: protocol.tiempos }))}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* La lista que se lleva el paciente. Va aqui, despues de la validacion y antes del menu, igual que
            en el v8 (su seccion E precede a la F). No depende del protocolo: es la tabla completa, la misma
            para todos; lo que cambia por paciente son las PORCIONES, que estan arriba. */}
        <ListaIntercambioPaciente />
        {/* Menu semanal (CP4). key = firma del menu guardado (remonte, como las demas secciones). */}
        <MenuSemanalSection
          key={sectionKey("menu-semanal", menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: protocol.menuSemanal }))}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        {/* Restricciones JUNTO al menu (checkpoint 2.4): son su insumo; que se lea que lo que se marca aqui
            cambia lo que genera el menu. key = firma de las restricciones (remonte). */}
        <RestriccionesSection
          key={sectionKey(
            "restricciones",
            restriccionesSignature({
              treatmentId: protocol.treatmentId,
              restricciones: protocol.restricciones,
            }),
          )}
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
        />
        <MenuSection
          evaluationId={evaluationId}
          protocol={protocol}
          locked={locked}
          patronAlimentario={patronAlimentario}
        />
        <NotesSection evaluationId={evaluationId} protocol={protocol} locked={locked} />
        {/* APROBAR VA AL FINAL, y no es estetico: es el acto que CIERRA la consulta. Todo lo de arriba se
            edita; esto lo sella. Un boton de sellar arriba invita a pulsarlo antes de leer lo que sella. */}
        {!protocol.approved && !diagnosisPending ? (
          <AprobarProtocolo evaluationId={evaluationId} protocol={protocol} />
        ) : null}
      </CardContent>
    </Card>
  );
}

// EL ACTO QUE FALTABA. La vertical de aprobar estaba construida entera (policy `canApproveProtocol`,
// servicio con sus cuatro gates, writer transaccional con audit inline, trigger 0026 de inmutabilidad y
// dos suites de tests) y NINGUNA PANTALLA INVOCABA LA ACTION. Lo encontro el barrido del 2026-09-01
// comparando las 99 server actions contra quien las nombra.
//
// LO QUE ARRASTRABA, y por eso no era un boton de menos: con `approved` clavado en false, nunca se
// activaba el bloqueo de edicion, nunca se veia el aviso de que la prescripcion reemplaza a otra, y la
// REAPERTURA era inalcanzable porque vive dentro del bloque de aprobado. Y sobre todo: **todo plan que
// le llegaba a un paciente salia de una prescripcion en borrador**.
//
// NO LLEVA DIALOGO DE CONFIRMACION, y es la misma razon que ya esta escrita en `ProtocoloAprobado`: un
// "¿seguro?" pide una confirmacion, no una razon. Aqui la salvaguarda no es un paso mas, es que el acto
// se puede DESHACER (reabrir, con motivo, que queda en la historia). Lo que si lleva es decir ANTES de
// pulsar que es lo que va a pasar.
function AprobarProtocolo({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
  const [state, formAction, pending] = useActionState(approveProtocolAction, EMPTY);
  useFormToastAndRefresh(state);
  // Sin sugerido no hay nada que sellar, y el servicio lo rechaza. Se dice aqui para que el profesional
  // no descubra el gate con un error: un guard correcto mal expuesto se siente como defecto.
  const sinSugerido = !protocol.protocolSuggested;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted px-3 py-3">
      <h3 className="text-sm font-medium">Aprobar la prescripción</h3>
      <p className="text-sm text-muted-foreground">
        Al aprobar, la prescripción queda sellada tal como está y deja de ser editable. Es la que se
        registra en la historia clínica y la que recibe el paciente en su plan. Si después necesitas
        cambiarla, puedes reabrirla escribiendo el motivo.
      </p>
      {sinSugerido ? (
        <p className="text-sm text-clinical-warning">
          Todavía no se puede aprobar: esta evaluación no tiene la prescripción del modelo calculada, y no
          se sella lo que nunca se computó.
        </p>
      ) : (
        <form onSubmit={enviarSinReset(formAction)}>
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Aprobando..." : "Aprobar la prescripción"}
          </Button>
        </form>
      )}
    </div>
  );
}

// Etiqueta y color del estado de una sugerencia de IA (accesible: etiqueta ademas de color).
const MENU_STATUS: Record<string, { label: string; cls: string }> = {
  success: { label: "Generado", cls: "bg-clinical-optimal-bg text-clinical-optimal" },
  timeout: { label: "Timeout", cls: "bg-clinical-warning-bg text-clinical-warning" },
  provider_error: { label: "Error del proveedor", cls: "bg-clinical-critical-bg text-clinical-critical" },
  parse_failed: { label: "Respuesta inválida", cls: "bg-clinical-critical-bg text-clinical-critical" },
};

function MenuSection({
  evaluationId,
  protocol,
  locked,
  patronAlimentario,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
  patronAlimentario: string[];
}) {
  const [state, formAction, pending] = useActionState(generateMenuAction, EMPTY);
  // AndRefresh, no useFormToast a secas: la accion ya no revalida (el revalidatePath era el que arrastraba
  // la pagina al inicio al pulsar "Adaptar a las restricciones", reportado en el smoke del 2026-08-31).
  // El refresco lo dispara el hook DESPUES del aviso, para que la propuesta aparezca sin mover el scroll.
  useFormToastAndRefresh(state);

  // El menu se genera contra el objetivo de la CADENA CALORICA (fuente unica; el input manual de objetivo
  // se retiro en el checkpoint 2). Basta con que el protocolo este calculado (snapshot sellado); sin el no
  // hay cadena que computar.
  const cadenaLista = protocol.protocolSuggested != null;
  // SIN RESTRICCIONES LA IA NO ENTRA (su §13, "solo lo adapta CUANDO HAY RESTRICCIONES"). El servicio ya lo
  // corta, pero la pantalla tiene que DECIRLO: un boton que se puede pulsar y no hace nada se lee como que
  // el sistema esta roto. Las tres fuentes son las mismas que viajan en el prompt.
  const hayRestricciones =
    (protocol.protocolSuggested?.restricciones?.length ?? 0) > 0 ||
    protocol.restricciones.length > 0 ||
    patronAlimentario.length > 0;
  const disabled = locked || pending || !cadenaLista || !hayRestricciones;

  // QUE CAMBIOS YA SE APLICARON. No se guarda una marca aparte: se DERIVA de la grilla, comparando el
  // reemplazo propuesto con lo que la celda tiene guardado. Una marca aparte seria un segundo estado que
  // puede desincronizarse del real (el profesional puede editar la celda a mano despues de aplicar).
  const celdasGuardadas = protocol.menuSemanal?.celdas ?? {};
  const aplicados = new Set(
    protocol.menuSuggestions
      .flatMap((m) => (esMenuCambios(m.menuJson) ? m.menuJson.cambios : []))
      .filter((c) => celdasGuardadas[`${c.dia}_${c.tiempo}`] === c.reemplazo)
      .map((c) => `${c.dia}_${c.tiempo}`),
  );

  return (
    <div className={bloqueCls("derivado")}>
      <h3 className={tituloBloqueCls("derivado")}>Adaptar el menú a las restricciones (IA)</h3>
      {/* QUE MIRA LA IA: se escribe lo que el contrato del prompt REALMENTE lleva (menu.v4.ts), no lo que
          suena bien. Si el contrato cambia, este texto cambia con el: un texto que describe mal el motor
          es un defecto de seguridad. */}
      <p className="max-w-prose text-sm text-muted-foreground">
        No compone un menú: <strong>revisa la semana de arriba</strong> y propone sustituir solo las
        preparaciones que incumplen una restricción del paciente. Lo que no incumple nada se queda como
        está. Ve el menú de la grilla, las restricciones del modelo y las tuyas, el patrón alimentario que
        el paciente declaró, y su objetivo de calorías y proteína. No lee las respuestas de la encuesta.
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        Cada propuesta viene con el motivo, y las aceptas <strong>una por una</strong>. Si falla o no
        responde, la grilla se queda con el ciclo.
      </p>
      <form onSubmit={enviarSinReset(formAction)}>
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Button type="submit" variant="outline" disabled={disabled}>
          {pending ? "Adaptando..." : "Adaptar a las restricciones"}
        </Button>
        {!cadenaLista && !locked ? (
          <p className="pt-2 text-xs text-muted-foreground">
            El protocolo aún no está calculado; no se puede adaptar el menú.
          </p>
        ) : !hayRestricciones && !locked ? (
          <p className="max-w-prose pt-2 text-xs text-muted-foreground">
            Este paciente no tiene restricciones registradas (ni del modelo, ni tuyas, ni patrón
            alimentario declarado), así que no hay nada que adaptar: el menú del ciclo es el que aplica.
          </p>
        ) : null}
      </form>

      {protocol.menuSuggestions.length ? (
        <ul className="flex flex-col gap-3">
          {protocol.menuSuggestions.map((m) => (
            <MenuCard
              key={m.id}
              suggestion={m}
              evaluationId={evaluationId}
              locked={locked}
              aplicados={aplicados}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MenuCard({
  suggestion: m,
  evaluationId,
  locked,
  aplicados,
}: {
  suggestion: MenuSuggestion;
  evaluationId: string;
  locked: boolean;
  /** Claves `dia_tiempo` que el profesional ya aceptó: su celda ya trae el reemplazo. */
  aplicados: Set<string>;
}) {
  const status = MENU_STATUS[m.status] ?? { label: m.status, cls: "bg-muted text-muted-foreground" };
  // Constante local: el estrechamiento de un acceso a propiedad (`m.menuJson`) no sobrevive al ternario.
  const json = m.menuJson;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge className={status.cls}>{status.label}</Badge>
        <span>
          {m.provider} · {m.model}
        </span>
        {m.latencyMs != null ? <span>· {m.latencyMs} ms</span> : null}
        <span>· {formatDateTime(m.generatedAt)}</span>
        <span>· prompt {m.promptVersion}</span>
      </div>
      {esMenuCambios(json) ? (
        json.cambios.length === 0 ? (
          // LISTA VACIA NO ES FALLO: es "revise la semana y no habia nada que sustituir". Decirlo cierra
          // la pregunta; dejarlo en blanco haria pensar que la IA no respondio.
          <p className="text-sm text-foreground">
            Revisó la semana y <strong>no encontró nada que sustituir</strong>: el menú del ciclo ya
            cumple las restricciones de este paciente.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {json.cambios.map((c) => (
                <CambioMenu
                  key={`${c.dia}_${c.tiempo}`}
                  cambio={c}
                  evaluationId={evaluationId}
                  locked={locked}
                  yaEsta={aplicados.has(`${c.dia}_${c.tiempo}`)}
                />
              ))}
            </ul>
            <AplicarTodasMenu
              evaluationId={evaluationId}
              locked={locked}
              pendientes={json.cambios.filter((c) => !aplicados.has(`${c.dia}_${c.tiempo}`))}
            />
          </div>
        )
      ) : esMenuComidas(json) ? (
        // FORMA v3, HISTORICA: cuando la IA componia un menu de un dia. Sus filas siguen en BD porque
        // `ai_menu_suggestions` es inmutable, asi que se siguen mostrando tal como se generaron. Lo que NO
        // se hace es ofrecer aplicarlas: se compusieron con otra regla.
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Generada con la versión anterior, cuando el modelo componía el menú. Se conserva como está.
          </p>
          {json.comidas.map((c) => (
            <div key={c.tiempo}>
              <p className="text-sm font-semibold text-foreground">{c.tiempo}</p>
              <ul className="ml-4 list-disc">
                {c.alimentos.map((a, i) => (
                  <li key={`${c.tiempo}-${a.nombre}-${i}`} className="text-sm text-foreground">
                    {a.nombre}
                    {a.porcion ? <span className="text-muted-foreground"> · {a.porcion}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : m.generatedText ? (
        // Sugerencias de la v2: prosa. Se siguen mostrando como estaban.
        <div className="text-sm text-foreground">
          <Markdown text={m.generatedText} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin contenido (el intento falló).</p>
      )}
    </li>
  );
}

// LA PRESCRIPCIÓN APROBADA, con su salida (Gildardo 2026-08-30 §6c).
//
// EL TEXTO CAMBIÓ, y el cambio es la instrucción: decía "para cambiarla se corrige la evaluación (versión
// nueva de toda la cadena), no se edita aquí", y eso ya no es cierto ni es lo que él quiere. Su palabra:
// "el sellado no es un candado: es una consecuencia registrada. Un profesional que necesita corregir un
// plan aprobado tiene que poder hacerlo". Un texto que describe mal lo que el sistema hace es un defecto
// de seguridad, no de redacción: le decía al profesional que su única salida era rehacer la evaluación.
//
// EL MOTIVO NO ES OPCIONAL Y NO SE ESCONDE detrás de una confirmación: se escribe ANTES de poder pulsar,
// porque es lo que queda en la historia. Un diálogo de "¿seguro?" pide una confirmación; esto pide una
// razón, que es otra cosa.
function ProtocoloAprobado({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
  const [state, formAction, pending] = useActionState(reopenProtocolAction, EMPTY);
  useFormToastAndRefresh(state);
  const [motivo, setMotivo] = useState("");
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted px-3 py-3">
      <p className="text-sm text-muted-foreground">
        Este protocolo ya fue aprobado, así que la prescripción está congelada: para editarla hay que
        reabrirla. Reabrir queda registrado en la historia del paciente con tu motivo, y cuando apruebes la
        nueva tendrás que enviarle el reporte: cambia lo que come y el sistema no se lo avisa solo.
        {protocol.aprobacionesPrevias > 0
          ? " Esta prescripción ya reemplazó a otra anterior."
          : ""}
      </p>
      {abierto ? (
        <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-2">
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <Label htmlFor="reopen-reason" className="text-sm">
            ¿Por qué la reabres?
          </Label>
          <Textarea
            id="reopen-reason"
            name="reason"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ej. El paciente reportó una intolerancia que no estaba registrada al aprobar."
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="sm" disabled={pending || motivo.trim().length < 10}>
              {pending ? "Reabriendo..." : "Reabrir la prescripción"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAbierto(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
          {motivo.trim().length > 0 && motivo.trim().length < 10 ? (
            <p className="text-xs text-muted-foreground">
              Escribe un motivo un poco más largo: queda en la historia del paciente.
            </p>
          ) : null}
        </form>
      ) : (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)}>
            Reabrir la prescripción
          </Button>
        </div>
      )}
    </div>
  );
}

// Rótulo de cada profesión, y el de las notas SIN profesión: son las anteriores a la separación del §8,
// cuando el campo era uno solo y compartido. No se les inventa un rol: decirlo es más honesto que
// repartirlas por lo que parezca.
const PROFESION_NOTA: Record<string, string> = {
  nutricionista: "Nutricionista",
  medico: "Médico",
  psicologo: "Psicólogo",
  deportologo: "Deportólogo",
  "sin-profesion": "Sin profesión registrada",
};

/** Agrupa por profesión conservando el orden de llegada dentro de cada grupo. */
function agruparNotasPorProfesion(notas: TreatmentNote[]): [string, TreatmentNote[]][] {
  const grupos = new Map<string, TreatmentNote[]>();
  for (const n of notas) {
    const k = n.profession ?? "sin-profesion";
    const lista = grupos.get(k);
    if (lista) lista.push(n);
    else grupos.set(k, [n]);
  }
  return [...grupos.entries()];
}

type CambioPropuestoView = MenuCambios["cambios"][number];

// UNA sustitución propuesta, con su botón. Es componente propio y no JSX suelto dentro del `.map` porque
// necesita su propio `useActionState`: los hooks no se pueden llamar dentro de un bucle.
//
// EL BOTON YA NO FALLA EN SILENCIO. Antes la acción era `Promise<void>` y descartaba el resultado, así que
// si el candado de concurrencia rechazaba el guardado no pasaba nada en pantalla y el profesional se
// quedaba creyendo que había aplicado el cambio. Ahora el rechazo sale como aviso.
function CambioMenu({
  cambio: c,
  evaluationId,
  locked,
  yaEsta,
}: {
  cambio: CambioPropuestoView;
  evaluationId: string;
  locked: boolean;
  yaEsta: boolean;
}) {
  const [state, formAction, pending] = useActionState(aplicarCambioMenuAction, EMPTY);
  // AndRefresh, no useFormToast: la acción ya no revalida (revalidar arrastraba la página al inicio en cada
  // clic), así que el refresco lo dispara el hook DESPUÉS del aviso, que es lo que lo hace visible.
  useFormToastAndRefresh(state);

  return (
    <li className="rounded-md border border-border bg-muted/30 p-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {DIAS_SEMANA[c.dia]} · {TIEMPOS_DEF.find((t) => t.id === c.tiempo)?.n ?? c.tiempo}
      </p>
      <p className="pt-0.5 text-sm text-foreground">{c.reemplazo}</p>
      <p className="pt-0.5 text-xs text-muted-foreground">
        Motivo: {c.motivo}
        {c.citaVerificada === false ? (
          // EL CAMBIO QUE PUEDE NO CORRESPONDER. No se bloquea (juzgarlo es clínico), pero el
          // profesional ve cuál cita una restricción que nadie le pidió atender.
          <span className="ml-2 text-attention">· no corresponde a ninguna restricción registrada</span>
        ) : null}
      </p>
      {/* CAMBIO POR CAMBIO: una sustitución puede ser buena y la de al lado no. El botón global de abajo
          es un atajo sobre estos, no un reemplazo de ellos. */}
      <form onSubmit={enviarSinReset(formAction)} className="pt-1.5">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="dia" value={c.dia} />
        <input type="hidden" name="tiempo" value={c.tiempo} />
        <input type="hidden" name="reemplazo" value={c.reemplazo} />
        {yaEsta ? (
          <p className="text-xs text-clinical-optimal">Aplicado a la grilla.</p>
        ) : (
          <Button type="submit" variant="outline" size="sm" disabled={locked || pending}>
            {pending ? "Aplicando..." : "Aplicar a la grilla"}
          </Button>
        )}
      </form>
    </li>
  );
}

// EL ATAJO: aplicar de una vez las sustituciones que quedan por aceptar.
//
// POR QUE NO ES LO QUE HABIAMOS DESCARTADO. Lo que se descartó fue un botón global COMO UNICA VIA, que
// obliga a tragarse todas. Con los botones individuales presentes, este solo ahorra clics: el profesional
// que quiere elegir sigue eligiendo (Santiago, 2026-08-31).
//
// UN SOLO GUARDADO, no un bucle: el servicio aplica las N celdas sobre una sola firma, así que el candado
// de concurrencia se comprueba una vez y se aplican todas o ninguna. Un bucle invalidaría su propia firma
// en la segunda escritura y dejaría la grilla a medias.
//
// NO APARECE con una sola pendiente: un "aplicar todas" que aplica una es ruido al lado de su propio botón.
function AplicarTodasMenu({
  evaluationId,
  locked,
  pendientes,
}: {
  evaluationId: string;
  locked: boolean;
  pendientes: CambioPropuestoView[];
}) {
  const [state, formAction, pending] = useActionState(aplicarCambiosMenuAction, EMPTY);
  useFormToastAndRefresh(state);
  if (pendientes.length < 2) return null;

  return (
    <form onSubmit={enviarSinReset(formAction)}>
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input
        type="hidden"
        name="cambios"
        value={JSON.stringify(
          pendientes.map((c) => ({ dia: c.dia, tiempo: c.tiempo, reemplazo: c.reemplazo })),
        )}
      />
      <Button type="submit" variant="outline" size="sm" disabled={locked || pending}>
        {pending ? "Aplicando..." : `Aplicar las ${pendientes.length} a la grilla`}
      </Button>
    </form>
  );
}

// Restricciones alimentarias (checkpoint 2.4): seccion propia, JUNTO al menu (son su insumo). Guardado
// propio con candado y firma de remonte (saveRestriccionesAction), como la cadena/nutraceuticos.
function RestriccionesSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveRestriccionesAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [restricciones, setRestricciones] = useState<string[]>(protocol.restricciones);
  const [restrInput, setRestrInput] = useState("");
  const addRestriccion = () => {
    const v = restrInput.trim();
    if (v && !restricciones.includes(v)) setRestricciones([...restricciones, v]);
    setRestrInput("");
  };
  const baseSignature = restriccionesSignature({
    treatmentId: protocol.treatmentId,
    restricciones: protocol.restricciones,
  });

  return (
    <section className={bloqueCls("decision")}>
      <h3 className={tituloBloqueCls("decision")}>Restricciones alimentarias del profesional</h3>
      <p className="text-sm text-muted-foreground">
        Lo que marques aquí condiciona el <strong>menú de abajo</strong>: la IA lo genera excluyendo estos
        alimentos o nutrientes. Guárdalas antes de generar el menú.
      </p>
      {/* Desambiguacion: hay DOS cosas llamadas restricciones (las del modelo, por comorbilidad, arriba de
          la cadena; y estas, del profesional). Las dos van al menu, en bloques separados del prompt. Decirlo
          aqui evita que este campo se lea como "todas las restricciones del paciente". */}
      <p className="text-sm text-muted-foreground">
        Son <strong>adicionales</strong> a las restricciones del modelo (las de arriba, por comorbilidad y
        fenotipo): esas no se editan y ya condicionan el menú por su cuenta.
      </p>
      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="restricciones" value={JSON.stringify(restricciones)} />
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Input
              value={restrInput}
              onChange={(e) => setRestrInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRestriccion();
                }
              }}
              placeholder="ej. sin gluten"
            />
            <Button type="button" variant="outline" onClick={addRestriccion}>
              Agregar
            </Button>
          </div>
          {restricciones.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {restricciones.map((r) => (
                <Badge key={r} variant="outline" className="gap-1">
                  {r}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setRestricciones(restricciones.filter((x) => x !== r))}
                    aria-label={`Quitar ${r}`}
                  >
                    x
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar restricciones"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Objetivo del tratamiento nutricional (pieza 1): lo que el profesional ESCRIBE sobre el plan (el objetivo /
// tipo de dieta), distinto de las guias (que son una lista). Un textarea con su guardado propio. En 1a.3 se
// le antepone el encabezado generado "Dieta ... de X kcal/dia" (de la cadena) y va arriba, antes de la formula.
// OBJETIVO DEL TRATAMIENTO NUTRICIONAL, con la forma de su pantalla (cotejo 2026-08-31).
//
// SU BLOQUE tiene cuatro cosas que el nuestro no tenia: un TITULO QUE CAMBIA con el objetivo calorico
// ("Dieta Normocalorica de 2339 kcal/dia"), el chip de proteina, los atributos del patron que calcula el
// motor, y la alerta de antecedentes FAMILIARES. Las cuatro salen de `motorTratNutri`, que es el que
// gobierna; ninguna es dato nuevo, es dato que ya teniamos y no se veia junto.
//
// EL TITULO NO ES DECORATIVO: es la unica linea de la pantalla que dice, de un vistazo, QUE dieta es esta.
// Sin el, el profesional tiene que leer las cifras para saberlo.
function ObjetivoSection({
  evaluationId,
  protocol,
  locked,
  prescripcion,
  kcalObjetivo,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
  prescripcion: PrescripcionNutricional | null;
  /** El objetivo EFECTIVO de la cadena (el que el profesional ve abajo), para que el título no diga otro. */
  kcalObjetivo: number | null;
}) {
  const [state, formAction, pending] = useActionState(saveObjetivoAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [objetivo, setObjetivo] = useState(protocol.objetivoTexto ?? "");
  const baseSignature = objetivoSignature({
    treatmentId: protocol.treatmentId,
    objetivo: protocol.objetivoTexto,
  });

  return (
    <section className={bloqueCls("decision")}>
      <h3 className={tituloBloqueCls("decision")}>Objetivo del tratamiento nutricional</h3>
      {/* El título que cambia con el objetivo, como el suyo. Se arma con el tipo energético del motor que
          gobierna y el objetivo EFECTIVO de la cadena, no con las kcal del otro motor: dos números del
          mismo concepto en la misma pantalla es el defecto que venimos cerrando. */}
      {prescripcion && kcalObjetivo != null ? (
        <p className="text-base font-bold text-foreground">
          Dieta {prescripcion.tipoEnergia.toLowerCase()} de {kcalObjetivo} kcal/día
        </p>
      ) : null}
      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-2">
          <Textarea
            name="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="ej. Dieta antiinflamatoria con proteína alta por sexo, para desacelerar el envejecimiento biológico."
            rows={3}
            maxLength={4000}
          />
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar objetivo"}
            </Button>
          </div>
        </fieldset>
      </form>

      {/* LO QUE PRESCRIBE EL MODELO, junto al objetivo y no suelto abajo (cotejo 2026-08-31, punto h): es
          la misma información que su chip y sus atributos, y leerla aquí es leerla donde se decide. */}
      {prescripcion ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {prescripcion.filas.map((f) => (
              <span
                key={f.nombre}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
              >
                {f.nombre} {f.valor}
                {/* LA REFERENCIA SE VE, no se esconde en un tooltip. Vivia en `title`, que exige hover y en
                    tactil no existe: en el smoke se reporto como "no aparece ESPEN 2023 en ningun sitio", y
                    era cierto. Una referencia que hay que descubrir no respalda nada. */}
                {f.ref ? <span className="ml-1 font-normal text-muted-foreground">({f.ref})</span> : null}
              </span>
            ))}
            {prescripcion.atributos.map((a) => (
              <span
                key={a}
                className="rounded-full border border-clinical-warning/40 bg-clinical-warning-bg px-2.5 py-0.5 text-xs font-medium text-clinical-warning"
              >
                {a}
              </span>
            ))}
          </div>
          {prescripcion.notas.length ? (
            <ul className="flex list-inside list-disc flex-col gap-0.5 text-xs text-muted-foreground">
              {prescripcion.notas.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {/* Su línea de antecedentes familiares, en el mismo sitio que él la pone. */}
          {prescripcion.alertaFam.length ? (
            <p className="text-xs text-attention">
              Antecedentes familiares (alerta preventiva): {prescripcion.alertaFam.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// Lista de intercambio (CP1.2b): tabla de 12 grupos con porciones editables, recompute en vivo del total, y
// (DIV-11) aviso de desfase cuando el objetivo cambio desde que se guardaron. El desplegable de alimento es
// de solo lectura por ahora (muestra el alimento por defecto del grupo; cambiarlo se cabla despues).
function IntercambioSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveIntercambioAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const snap = protocol.protocolSuggested;
  const adjGuardados: ProtocoloAjustes = {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    deficit: protocol.adjDeficit,
    pesoMeta: protocol.pesoMetaFijado,
  };
  // Objetivo efectivo desde los ajustes GUARDADOS (misma fuente que la cadena): base estable del intercambio.
  const objetivoEfectivo = snap ? Math.round(computeProtocoloEfectivo(snap, adjGuardados).calorico.kcalObj) : null;
  const defaults = objetivoEfectivo != null ? computeIntercambio(objetivoEfectivo) : [];
  const saved = protocol.intercambioPorciones;

  // useState-once (POR ALIMENTO): porciones guardadas por sub si existen, si no las calculadas. El remonte (key
  // del padre) re-deriva. Se inicializan los 21 alimentos (el que no tiene default arranca en 0).
  const [porciones, setPorciones] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const a of defaults) init[a.sub] = saved?.porciones[a.sub] ?? a.porciones;
    return init;
  });

  if (!snap || protocol.pesoCalculo == null || objetivoEfectivo == null) return null;

  const desfase = saved != null && saved.objetivoBase !== objetivoEfectivo;
  const totalKcal = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.kcal, 0);
  // Macros del reparto (porte fiel del v8: columnas kcal/porcion, kcal, proteina, CHO y grasa por alimento,
  // mas la fila TOTAL). No es calculo nuevo: INTER_TABLA_A ya trae los 26 nutrientes por porcion, portados
  // verbatim con candado de transcripcion; aqui solo se multiplica por las porciones. La ADECUACION real
  // (contra la necesidad de cada nutriente) sigue viviendo en la validacion, mas abajo: esta tabla dice
  // cuanto APORTA lo repartido, no si alcanza.
  const totalProt = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.prot, 0);
  const totalCho = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.cho, 0);
  const totalGras = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0) * a.gras, 0);
  const setP = (sub: string, v: number) => setPorciones((p) => ({ ...p, [sub]: Math.max(0, v) }));
  // Hay algo que perder si alguna porcion en pantalla difiere de la que calcula el objetivo actual. Se
  // compara contra los DEFAULTS vivos y no contra lo guardado: si el objetivo cambio, lo guardado tambien
  // es "ajuste" frente a lo que el recalculo va a poner.
  const hayAjustesIntercambio = defaults.some((a) => (porciones[a.sub] ?? 0) !== a.porciones);

  // Lo que se guarda: las porciones POR ALIMENTO en pantalla + el objetivo con el que se calcularon
  // (objetivoBase, DIV-11). Se serializan los 21 alimentos (contexto completo del desfase).
  const payload: IntercambioSaved = {
    objetivoBase: objetivoEfectivo,
    porciones: Object.fromEntries(defaults.map((a) => [a.sub, porciones[a.sub] ?? 0])),
  };
  const baseSignature = intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: saved });

  return (
    <section className={bloqueCls("decision")}>
      <h3 className={tituloBloqueCls("decision")}>Lista de intercambio U de A · ICBF 2025</h3>
      <p className="text-sm text-muted-foreground">
        Porciones por alimento para cubrir el objetivo calórico ({objetivoEfectivo} kcal). El auto-llenado
        sugiere un alimento representativo por grupo; puedes repartir dentro de un grupo (por ejemplo dos de
        leche entera y una descremada).
      </p>

      {desfase ? (
        <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          Estas porciones se calcularon para {saved!.objetivoBase} kcal, pero el objetivo ahora es{" "}
          {objetivoEfectivo} kcal. Puedes seguir con tus ajustes o recalcular desde el objetivo actual (perderás
          los ajustes manuales).
        </div>
      ) : null}

      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="intercambio" value={JSON.stringify(payload)} />
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-3">
          {/* QUE ES UN INTERCAMBIO, en una linea. Es la frase de su archivo, y sin ella la tabla es una
              lista de numeros sin decir para que sirve. La unidad de los macros va AQUI y no en tres
              encabezados: repetir "(g)" tres veces cuesta el ancho que necesitan los numeros. */}
          <p className="text-xs text-muted-foreground">
            Dentro de un mismo grupo los alimentos son equivalentes: puedes sustituir libremente.
            Proteína, CHO y grasa en gramos.
          </p>
          <div className="min-w-0 overflow-x-auto">
            {/* ANCHO MINIMO, y es lo que arregla el "no cabe" (cotejo 2026-08-27). Con `w-full` sin
                minimo, en pantalla estrecha las columnas se APRIETAN y los numeros se parten en dos
                lineas; el desplazamiento lateral nunca llega a activarse. Su tabla fija `minWidth: 600`
                (~38rem) justamente para forzarlo antes de que nada se apriete: el scroll horizontal no
                era el defecto, era la solucion sin activar. Mismo valor que la tabla de composicion.

                Y EL `min-w-0` DEL FIELDSET DE ARRIBA ES PARTE DEL MISMO ARREGLO, no un extra. Un
                `<fieldset>` trae de fabrica `min-inline-size: min-content`: se NIEGA a encogerse por
                debajo de su contenido, y `min-width:0` del flex item no lo alcanza. Sin el, la tabla de
                38rem estiraba el fieldset, el fieldset desbordaba la tarjeta y la TARJETA recortaba: se
                veia una tabla PARTIDA (con la barra de scroll flotando fuera) en vez de una que se
                desplaza, y hasta el parrafo de ayuda salia cortado, aunque esta fuera de este div.
                Las tres tablas de Diagnostico funcionaban con el mismo `min-w-` desde antes porque NO
                estan dentro de un fieldset; esa era toda la diferencia. */}
            <table className="w-full min-w-[38rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  {/* "Grupo / subgrupo", no "Alimento": las filas SON subgrupos (Cereales, Leche entera)
                      y los alimentos estan en la ultima columna. Y no es cosmetico: esta columna define
                      que significa la casilla de Porciones, que Gildardo dejo en el SUBGRUPO el 27. Con
                      "Alimento" la pantalla contradecia esa decision. Rotulos cortos como los suyos: en
                      una tabla que no cabe, el ancho del encabezado fuerza el de la columna. */}
                  <th className="py-1 pr-3 font-medium">Grupo / subgrupo</th>
                  <th className="py-1 pr-3 text-right font-medium">kcal/porc</th>
                  <th className="py-1 pr-3 text-right font-medium">Porciones</th>
                  <th className="py-1 pr-3 text-right font-medium">kcal</th>
                  <th className="py-1 pr-3 text-right font-medium">Prot</th>
                  <th className="py-1 pr-3 text-right font-medium">CHO</th>
                  <th className="py-1 pr-3 text-right font-medium">Grasa</th>
                  <th className="py-1 font-medium">Alimentos del grupo</th>
                </tr>
              </thead>
              <tbody>
                {/* 21 alimentos agrupados por los 12 grupos: una fila de encabezado por grupo (cuando cambia
                    el grupo del alimento anterior) y luego sus alimentos. El aviso de grupo nuclear sin
                    porciones (DIV-10) va en el encabezado, sobre la SUMA del grupo. */}
                {defaults.flatMap((a, i) => {
                  const nuevoGrupo = i === 0 || defaults[i - 1].gr !== a.gr;
                  const n = porciones[a.sub] ?? 0;
                  const filas = [] as React.ReactNode[];
                  if (nuevoGrupo) {
                    const sinPorcion = grupoSinPorcion(a.gr, porciones);
                    filas.push(
                      <tr key={`g-${a.gr}`} className="bg-muted/40">
                        <td colSpan={8} className="py-1 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {a.grNom}
                          {sinPorcion ? (
                            <span className="ml-2 font-normal normal-case text-clinical-warning" title="Grupo base sin porciones: el objetivo puede ser muy bajo">
                              sin porciones
                            </span>
                          ) : null}
                        </td>
                      </tr>,
                    );
                  }
                  filas.push(
                    <tr key={a.sub} className="border-b border-border/50">
                      <td className="py-1.5 pl-3 pr-3 text-foreground">{a.sub}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{a.kcal}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {/* Vacio con placeholder, no un 0 literal (como el suyo): en 21 filas, los ceros
                            compiten visualmente con las porciones asignadas, que es lo que hay que ver. */}
                        <input
                          type="number"
                          min={0}
                          value={n || ""}
                          placeholder="0"
                          onChange={(e) => setP(a.sub, Math.round(Number(e.target.value) || 0))}
                          className="w-16 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums font-medium text-foreground">
                        {Math.round(n * a.kcal)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {(n * a.prot).toFixed(1)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {(n * a.cho).toFixed(1)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                        {(n * a.gras).toFixed(1)}
                      </td>
                      {/* Alimentos concretos, PLEGADOS (porte fiel del v8). El plegado no es decoracion: el
                          primer subgrupo tiene 39 alimentos y desplegados romperian la tabla. Es referencia,
                          NO edita el calculo: el intercambio se cuenta por PORCIONES del subgrupo, y que
                          alimento se elija dentro del subgrupo es del paciente. */}
                      <td className="py-1.5">
                        <AlimentosDelSubgrupo sub={a.sub} />
                      </td>
                    </tr>,
                  );
                  return filas;
                })}
                <tr className="border-t-2 border-border font-semibold text-foreground">
                  <td className="py-2" colSpan={3}>
                    Total
                  </td>
                  {/* El total de kcal dice contra QUE se compara (objetivo): las porciones enteras lo aproximan,
                      no lo igualan, asi que los dos numeros conviven sin confundir. Los macros NO llevan su
                      objetivo al lado a proposito: su adecuacion es la tabla de validacion, que ademas la
                      colorea; repetir aqui un segundo juicio invitaria a leer dos veredictos distintos. */}
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {Math.round(totalKcal)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      objetivo {objetivoEfectivo}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totalProt.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totalCho.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totalGras.toFixed(1)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          {/* Linea de causa (no opcional): un total por debajo del objetivo sin explicacion hace dudar del
              calculo (le paso a Santiago). La brecha puede ser ~7% en objetivos altos, por la regla de verduras. */}
          <p className="text-xs text-muted-foreground">
            Las porciones enteras aproximan el objetivo, no lo igualan; las verduras se fijan en 2 porciones. La
            adecuación real por nutriente se ve en la validación, más abajo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar intercambio"}
            </Button>
            <BotonRecalcular
              etiqueta="Recalcular desde el objetivo"
              hayAjustes={hayAjustesIntercambio}
              disabled={pending}
              onRecalcular={() =>
                setPorciones(Object.fromEntries(defaults.map((a) => [a.sub, a.porciones])))
              }
            />
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// MENU SEMANAL (CP4, porte de la seccion F del v8): grilla 7 dias x tiempos ACTIVOS, una celda de texto
// editable por comida, precargada desde el ciclo de 21 dias.
//
// LA SEMILLA. El v8 arranca el ciclo en un dia ALEATORIO y puede permitirselo porque su menu es transitorio
// (localStorage, se recalcula al recargar). Aqui el plan se GUARDA, y un menu que cambia al recargar no es
// un plan. Dos capas: antes del primer guardado el arranque se DERIVA del treatmentId (determinista, sin
// parpadeo, y distinto entre evaluaciones del mismo paciente, para no repetirle la semana en el
// seguimiento); al guardar se PERSISTE, y desde ahi queda congelado aunque un dia cambiemos la derivacion.
// El boton de cambiar la semana base si puede usar azar: al ser una accion del profesional, el resultado se
// guarda y deja de ser azaroso.
const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function MenuSemanalSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveMenuSemanalAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const saved = protocol.menuSemanal;
  const [diaInicio, setDiaInicio] = useState<number>(() => saved?.diaInicio ?? diaInicioDerivado(protocol.treatmentId));
  const [celdas, setCeldas] = useState<Record<string, string>>(() => saved?.celdas ?? {});

  // Los tiempos ACTIVOS son los GUARDADOS, los mismos que manda la seccion de tiempos: el plan es uno solo.
  const activos = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;
  const vivos = TIEMPOS_DEF.filter((t) => activos[t.id]);

  // Texto de una celda: lo que el profesional escribio, o la precarga del ciclo. El ciclo NO trae merienda:
  // esa columna queda vacia y la UI dice por que (un blanco sin explicacion se lee como fallo).
  const precarga = (dia: number, tiempo: string): string => {
    const delCiclo = diaDelCiclo(diaInicio, dia) as unknown as Record<string, string | undefined>;
    return delCiclo[tiempo] ?? "";
  };
  const valor = (dia: number, tiempo: string): string => celdas[`${dia}_${tiempo}`] ?? precarga(dia, tiempo);
  const sinCiclo = vivos.filter((t) => !(diaDelCiclo(diaInicio, 0) as unknown as Record<string, unknown>)[t.id]);

  const setCelda = (dia: number, tiempo: string, v: string) =>
    setCeldas((c) => ({ ...c, [`${dia}_${tiempo}`]: v }));

  // Lo que se guarda: SOLO lo que difiere de la precarga. Asi la precarga no se congela: si mañana el
  // profesional cambia la semana base, las celdas que no toco siguen el ciclo nuevo.
  const payload = {
    diaInicio,
    celdas: Object.fromEntries(
      Object.entries(celdas).filter(([k, v]) => {
        const [d, ...resto] = k.split("_");
        return v !== precarga(Number(d), resto.join("_"));
      }),
    ),
  };
  const baseSignature = menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: protocol.menuSemanal });
  // Una celda esta EDITADA si difiere de lo que propone el ciclo. Es la misma comparacion que decide que se
  // guarda, asi que no puede desincronizarse del payload.
  const editada = (dia: number, tiempo: string) => valor(dia, tiempo) !== precarga(dia, tiempo);
  const hayEdiciones = DIAS_SEMANA.some((_, d) => vivos.some((t) => editada(d, t.id)));
  // La semana propuesta aun no esta guardada: si recarga, vuelve la anterior. Se avisa (Santiago perdio el
  // menu varias veces por esto).
  const semanaSinGuardar = diaInicio !== (saved?.diaInicio ?? diaInicioDerivado(protocol.treatmentId));
  // Devuelve una celda al ciclo: se BORRA el override, no se escribe el texto del ciclo. Asi la celda vuelve
  // a seguir el ciclo tambien cuando se proponga otra semana; escribir el texto la dejaria fija otra vez.
  const volverAlCiclo = (dia: number, tiempo: string) =>
    setCeldas((c) => {
      const resto = { ...c };
      delete resto[`${dia}_${tiempo}`];
      return resto;
    });

  return (
    <section className={bloqueCls("derivado")}>
      <h3 className={tituloBloqueCls("derivado")}>Menú semanal</h3>
      {/* EL PORQUE VA AQUI, EN EL CUERPO, NO DE NOTA AL PIE. Es lo que pidio Gildardo que se leyera en
          pantalla (§13): "partir del ciclo es CRITERIO CLINICO. El paciente debe recibir comida colombiana
          conocida, de su ciudad y de su mercado, no lo que un modelo componga. Que eso se lea en la
          pantalla". Puesto al pie se leeria como una limitacion tecnica o un ahorro; puesto arriba dice lo
          que es: la razon por la que el menu es como es. */}
      <p className="max-w-prose text-sm text-foreground">
        La base es un ciclo de {DIAS_DEL_CICLO} días de menús colombianos, y eso es{" "}
        <strong>criterio clínico</strong>: el paciente debe recibir comida conocida, de su ciudad y de su
        mercado, no un menú compuesto desde cero. Un plan que no se parece a lo que la persona come no se
        sigue.
      </p>
      {sinCiclo.length > 0 ? (
        <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          El ciclo base no trae {sinCiclo.map((t) => t.n.toLowerCase()).join(" ni ")}: esa columna queda
          vacía y la escribes tú.
        </p>
      ) : null}
      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="menu" value={JSON.stringify(payload)} />
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 overflow-x-auto">
            {/* Ancho minimo por la misma razon que la tabla de intercambio: sin el, en pantalla estrecha las columnas se aprietan y los numeros se parten, y el desplazamiento lateral nunca se activa. */}
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Día</th>
                  {vivos.map((t) => (
                    <th key={t.id} className="py-1 pr-3 font-medium">
                      {t.n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS_SEMANA.map((nombre, dia) => (
                  <tr key={nombre} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{nombre}</td>
                    {vivos.map((t) => (
                      <td key={t.id} className="py-1.5 pr-3">
                        <textarea
                          rows={3}
                          value={valor(dia, t.id)}
                          onChange={(e) => setCelda(dia, t.id, e.target.value)}
                          className="w-full min-w-48 rounded border border-border bg-background px-2 py-1 text-xs"
                        />
                        {/* Solo en las celdas EDITADAS: sin esto, una celda tocada por error queda fija para
                            siempre y ninguna semana nueva vuelve a tocarla. Era una trampa, no una falta. */}
                        {editada(dia, t.id) ? (
                          <button
                            type="button"
                            onClick={() => volverAlCiclo(dia, t.id)}
                            className="mt-0.5 text-xs text-muted-foreground underline hover:text-foreground"
                          >
                            Volver al menú del ciclo
                          </button>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar menú"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                // Azar en una ACCION del profesional: el resultado se guarda, asi que deja de ser azaroso.
                // Se avanza a un dia DISTINTO del actual para que el boton siempre haga algo visible.
                setDiaInicio((d) => (d + 1 + Math.floor(Math.random() * (DIAS_DEL_CICLO - 1))) % DIAS_DEL_CICLO);
              }}
            >
              Proponer otra semana
            </Button>
            {hayEdiciones ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => setCeldas({})}>
                Descartar mis ediciones
              </Button>
            ) : null}
          </div>
          {/* Que hace cada boton, en una linea. Sin esto "Proponer otra semana" y "Generar menu con IA"
              (mas abajo) se confunden, y hacen cosas muy distintas. */}
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Proponer otra semana:</span> propone otra
              combinación del menú base, sin mirar al paciente ni usar IA. Respeta las celdas que ya editaste.
            </p>
            {hayEdiciones ? (
              <p>
                <span className="font-medium text-foreground">Descartar mis ediciones:</span> devuelve todas
                las celdas al menú del ciclo. Para una sola, usa el enlace debajo de esa celda.
              </p>
            ) : null}
          </div>
          {semanaSinGuardar ? (
            <p className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              Semana nueva propuesta, sin guardar todavía. Si recargas, vuelve la anterior: pulsa
              &quot;Guardar menú&quot; para dejarla fija.
            </p>
          ) : null}
        </fieldset>
      </form>
    </section>
  );
}

// TIEMPOS DE COMIDA (CP2.3): seccion propia, columna propia, guardado propio. Se partio de la distribucion
// el 2026-08-23 con el argumento de Santiago: el MENU tambien depende de estas casillas y esta en su propio
// contenedor, asi que la dependencia no justificaba agruparlas con la tabla; lo que las unia era nuestro
// jsonb, no el modelo. Y en el prototipo de Gildardo ya viven aparte (`atlas:plan`, junto al menu semanal;
// la distribucion vive en `atlas:plan_inter`), asi que partirlas es MAS fiel, no menos.
//
// NO reaccionan en vivo: son una decision CLINICA (definen la estructura del dia del paciente) y mandan
// sobre la tabla Y sobre el menu. Con reaccion en vivo, tantear marcando reconstruiria las dos en cada clic.
function TiemposActivosSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTiemposActivosAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const guardados = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;
  const [activos, setActivos] = useState<Record<string, boolean>>(() => guardados);
  const sinAplicar = TIEMPOS_DEF.some((t) => Boolean(activos[t.id]) !== Boolean(guardados[t.id]));
  const baseSignature = tiemposActivosSignature({
    treatmentId: protocol.treatmentId,
    activos: protocol.tiemposActivos,
  });

  // DIV-13: al menos uno activo. Se impide en el cliente y lo revalida el schema.
  const toggle = (mid: string) =>
    setActivos((a) => {
      const activosCount = TIEMPOS_DEF.filter((t) => a[t.id]).length;
      if (a[mid] && activosCount <= 1) return a;
      return { ...a, [mid]: !a[mid] };
    });

  // DIV-13: al menos uno activo. Se impide en el cliente y lo revalida el schema.

  return (
    <section className={bloqueCls("decision")}>
      <h3 className={tituloBloqueCls("decision")}>Tiempos de comida</h3>
      {/* Se dice aqui lo que la seccion GOBIERNA, porque es lo que explica por que va antes y por que es
          una decision y no un ajuste. Sin esto, su titulo y el de la distribucion competian. Eran DOS
          parrafos que decian lo mismo; se conservo el que ademas explica el paso propio de "aplicar". */}
      <p className="max-w-prose text-sm text-muted-foreground">
        Qué comidas hace el paciente. Mandan sobre las dos tablas de abajo: la distribución reparte dentro
        de los tiempos que dejes activos, y el menú semanal usa esos mismos tiempos como columnas. Por eso
        se aplican con un paso propio y no cambian mientras marcas.
      </p>
      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="activos" value={JSON.stringify(activos)} />
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {TIEMPOS_DEF.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm text-foreground">
                <input type="checkbox" checked={Boolean(activos[t.id])} onChange={() => toggle(t.id)} />
                {t.n}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Aplicando..." : "Aplicar tiempos de comida"}
            </Button>
            {sinAplicar ? (
              <span className="text-xs text-clinical-warning">
                Cambiaste los tiempos y aún no los has aplicado: la distribución y el menú siguen mostrando
                los anteriores.
              </span>
            ) : null}
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Distribucion por tiempos (CP2.2b): reparte las porciones del intercambio (CP1) por tiempo de comida. Filas =
// grupos con porciones > 0; columnas = tiempos ACTIVOS. Celdas editables (override sobre el auto). Toggles de
// tiempos activos con recompute en vivo. Aviso de desfase DOBLE (por porciones y por activos) sin borrar los
// overrides (DIV-11); los overrides de comidas apagadas se conservan ocultos (apagar suele ser exploratorio).
const TIEMPOS_ACTIVOS_DEFAULT: Record<string, boolean> = {
  desayuno: true,
  mediasOnces: true,
  almuerzo: true,
  algo: true,
  cena: true,
  merienda: false,
};
// Serializacion estable de un mapa de porciones/booleanos por clave ordenada, para comparar el contexto base.
const serMap = (m: Record<string, number | boolean>) =>
  Object.keys(m)
    .sort()
    .map((k) => `${k}:${typeof m[k] === "boolean" ? (m[k] ? 1 : 0) : m[k]}`)
    .join(",");

function TiemposSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveTiemposAction, EMPTY);
  useFormToastRefreshOnSuccess(state);

  const snap = protocol.protocolSuggested;
  const adjGuardados: ProtocoloAjustes = {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    deficit: protocol.adjDeficit,
    pesoMeta: protocol.pesoMetaFijado,
  };
  const objetivoEfectivo = snap ? Math.round(computeProtocoloEfectivo(snap, adjGuardados).calorico.kcalObj) : null;
  const defaults = objetivoEfectivo != null ? computeIntercambio(objetivoEfectivo) : [];
  const savedInter = protocol.intercambioPorciones;
  const savedTiempos = protocol.tiempos;

  // Porciones actuales POR ALIMENTO (del intercambio guardado o el default) + kcal por porcion de cada alimento.
  const porcionesActuales: Record<string, number> = {};
  const kcalPorPorcion: Record<string, number> = {};
  for (const a of defaults) {
    porcionesActuales[a.sub] = savedInter?.porciones[a.sub] ?? a.porciones;
    kcalPorPorcion[a.sub] = a.kcal;
  }

  const [celdas, setCeldas] = useState<Record<string, Record<string, number>>>(() => savedTiempos?.celdas ?? {});

  if (!snap || objetivoEfectivo == null) return null;

  // LAS DOS TABLAS (esta y el menu semanal) LEEN LOS TIEMPOS GUARDADOS, no la edicion en vivo. Los tiempos
  // activos son una decision CLINICA (definen la estructura del dia del paciente), no un ajuste visual: se
  // toman una vez y se aplican con un boton. Con reaccion en vivo, tantear marcando y desmarcando
  // reconstruiria la tabla Y el menu en cada clic, lo que distrae en vez de ayudar. Y asi las dos superficies
  // cuentan lo mismo SIN compartir estado entre secciones hermanas, que habria exigido subir el estado al
  // panel y poner en riesgo el remonte por firma (el arreglo del estado pegado).
  const activosGuardados = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;

  const vivos = TIEMPOS_DEF.filter((t) => activosGuardados[t.id]);
  const alimentosConPorciones = defaults.filter((a) => porcionesActuales[a.sub] > 0);
  const alimentosOcultos = defaults.length - alimentosConPorciones.length;
  const auto = computeTiempos(porcionesActuales, activosGuardados); // alimento (sub) -> tiempo (solo activos)
  const celda = (sub: string, mid: string) => celdas[sub]?.[mid] ?? auto[sub]?.[mid] ?? 0;

  // Total por tiempo: porciones y kcal (lo que el nutricionista mira). kcal = porciones * kcal/porcion del alimento.
  const totalPorc: Record<string, number> = {};
  const totalKcal: Record<string, number> = {};
  for (const t of vivos) {
    totalPorc[t.id] = alimentosConPorciones.reduce((s, a) => s + celda(a.sub, t.id), 0);
    totalKcal[t.id] = alimentosConPorciones.reduce((s, a) => s + celda(a.sub, t.id) * kcalPorPorcion[a.sub], 0);
  }

  // CUADRE del reparto (fiel al v8, celda "suma/total ✓/⚠"): la distribucion es un REPARTO, la suma de un
  // alimento por los tiempos debe igualar sus porciones del intercambio. El auto siempre cuadra (interSplit);
  // un override manual puede romperlo. Se avisa EN VIVO por fila (verde/rojo), no se bloquea el guardado (el v8
  // tampoco lo bloquea; DIV-11: no destruir el trabajo del profesional, avisar). Es aritmetica, no criterio
  // clinico: no va a Gildardo.
  const reparto = (sub: string) => {
    const suma = vivos.reduce((s, t) => s + celda(sub, t.id), 0);
    return { suma, obj: porcionesActuales[sub] ?? 0 };
  };
  // COMIDA ACTIVA Y VACIA (P-41, propuesta nuestra: el v8 no lo detecta, solo compara por ALIMENTO -fila-,
  // nunca por TIEMPO -columna-). Si el desayuno esta activo y no tiene ni una porcion, el plan dice dos cosas
  // contradictorias: la casilla dice que el paciente desayuna y la tabla dice que no come nada. El modelo
  // mental correcto es que las CASILLAS mandan y la tabla reparte dentro de lo que ellas definen, asi que la
  // salida no es repartirle algo: es apagar la casilla. Se AVISA en vivo, no se bloquea (mismo trato que el
  // descuadre por alimento, DIV-11: no destruir el trabajo del profesional).
  const comidasVacias = vivos.filter((t) => totalPorc[t.id] === 0);

  const descuadres = alimentosConPorciones.filter((a) => {
    const r = reparto(a.sub);
    return r.suma !== r.obj;
  }).length;

  // Desfase DOBLE (DIV-11): overrides hechos con otras porciones o con otros tiempos activos. Se compara el
  // contexto SELLADO (savedTiempos.base) contra la realidad actual (porciones del intercambio + activos
  // guardados), no contra la edicion en vivo, para no titilar mientras se ajusta.
  const desfase =
    savedTiempos != null &&
    Object.keys(savedTiempos.celdas).length > 0 &&
    (serMap(porcionesActuales) !== serMap(savedTiempos.base.porciones) ||
      serMap(activosGuardados) !== serMap(savedTiempos.base.activos));

  const setCelda = (gid: string, mid: string, v: number) =>
    setCeldas((c) => ({ ...c, [gid]: { ...(c[gid] ?? {}), [mid]: Math.max(0, v) } }));
  const payload: TiemposSaved = {
    celdas, // se conservan TODOS, incluidos los de comidas apagadas (no se muestran, no se borran)
    base: { porciones: porcionesActuales, activos: activosGuardados },
  };
  const baseSignature = tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: savedTiempos });

  return (
    <section className={bloqueCls("derivado")}>
      {/* El titulo va VERBATIM de su archivo y NO se acorta: lo intentamos y el candado
          titulos-tablas-plan.test.ts lo freno, con razon. La referencia es parte del dato, asi que
          acortarlo no es presentacion, es quitar informacion (y el diseno no cambia QUE se muestra).
          Lo que las ordena sin tocar el titulo es el NIVEL (esta es derivada, los tiempos son
          prescripcion) mas la linea de abajo, que es ADITIVA. */}
      <h3 className={tituloBloqueCls("derivado")}>Distribución por tiempos de comida</h3>
      <p className="text-sm text-muted-foreground">
        Reparte las porciones de cada alimento entre los tiempos de comida activos.
      </p>

      {desfase ? (
        <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
          Estos ajustes de tiempos se hicieron con otras porciones o comidas activas; ya no corresponden. Puedes
          seguir con ellos o recalcular desde el intercambio actual (borra tus ajustes manuales).
        </div>
      ) : null}

      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="baseSignature" value={baseSignature} />
        <input type="hidden" name="tiempos" value={JSON.stringify(payload)} />
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 overflow-x-auto">
            {/* Ancho minimo por la misma razon que la tabla de intercambio: sin el, en pantalla estrecha las columnas se aprietan y los numeros se parten, y el desplazamiento lateral nunca se activa. */}
            <table className="w-full min-w-[38rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-1 pr-3 text-left font-medium">Alimento</th>
                  {vivos.map((t) => (
                    <th key={t.id} className="px-2 py-1 text-right font-medium">
                      {t.n}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right font-medium" title="Suma del reparto / porciones del alimento">
                    Reparto
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Filas por ALIMENTO (solo los con porciones > 0), agrupadas por grupo con un encabezado de
                    seccion cuando cambia el grupo del alimento anterior. */}
                {alimentosConPorciones.flatMap((a, i) => {
                  const nuevoGrupo = i === 0 || alimentosConPorciones[i - 1].gr !== a.gr;
                  const filas = [] as React.ReactNode[];
                  if (nuevoGrupo) {
                    filas.push(
                      <tr key={`g-${a.gr}`} className="bg-muted/40">
                        <td colSpan={vivos.length + 2} className="py-1 pr-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {a.grNom}
                        </td>
                      </tr>,
                    );
                  }
                  const cuadre = reparto(a.sub);
                  const cuadra = cuadre.suma === cuadre.obj;
                  filas.push(
                    <tr key={a.sub} className="border-b border-border/50">
                      <td className="py-1.5 pl-3 pr-3 text-foreground">{a.sub}</td>
                      {vivos.map((t) => (
                        <td key={t.id} className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={celda(a.sub, t.id)}
                            onChange={(e) => setCelda(a.sub, t.id, Math.round(Number(e.target.value) || 0))}
                            className="w-14 rounded border border-border bg-background px-1.5 py-1 text-right text-sm"
                          />
                        </td>
                      ))}
                      {/* Cuadre por alimento en vivo (v8): suma/porciones + ✓/⚠, verde si cuadra, rojo si no. */}
                      <td className={"px-2 py-1.5 text-right tabular-nums font-semibold " + (cuadra ? "text-clinical-optimal" : "text-clinical-critical")}>
                        {cuadre.suma}/{cuadre.obj} {cuadra ? "✓" : "⚠"}
                      </td>
                    </tr>,
                  );
                  return filas;
                })}
                <tr className="font-semibold text-foreground">
                  <td className="py-2 pr-3">Total porciones</td>
                  {vivos.map((t) => (
                    <td key={t.id} className="px-2 py-2 text-right tabular-nums">
                      {totalPorc[t.id]}
                    </td>
                  ))}
                  <td />
                </tr>
                <tr className="text-muted-foreground">
                  <td className="py-1 pr-3">Total kcal</td>
                  {vivos.map((t) => (
                    <td key={t.id} className="px-2 py-1 text-right tabular-nums">
                      {Math.round(totalKcal[t.id])}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {comidasVacias.length > 0 ? (
            <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              {comidasVacias.length === 1
                ? `${comidasVacias[0].n} está activo pero no tiene porciones asignadas.`
                : `${comidasVacias.map((t) => t.n).join(", ")} están activos pero no tienen porciones asignadas.`}{" "}
              Si el paciente no {comidasVacias.length === 1 ? "hace esa comida" : "hace esas comidas"}, apaga la
              casilla de arriba; si sí, repártele porciones.
            </div>
          ) : null}
          {descuadres > 0 ? (
            <div className="rounded-md border border-clinical-warning/40 bg-clinical-warning-bg px-3 py-2 text-sm text-clinical-warning">
              {descuadres === 1 ? "Un alimento reparte" : `${descuadres} alimentos reparten`} menos o más porciones
              de las que {descuadres === 1 ? "tiene" : "tienen"} en la lista de intercambio (marcados en rojo en la
              columna Reparto). El reparto por tiempos debe sumar las porciones del alimento; ajusta las celdas o
              usa Recalcular desde el intercambio. Puedes guardar igual, pero el plan quedará descuadrado.
            </div>
          ) : null}

          {alimentosOcultos > 0 ? (
            <p className="text-xs text-muted-foreground">
              Solo se muestran los alimentos con porciones. {alimentosOcultos}{" "}
              {alimentosOcultos === 1 ? "alimento tiene" : "alimentos tienen"} 0 porciones y no{" "}
              {alimentosOcultos === 1 ? "aparece" : "aparecen"} aquí; si les subes porciones en la lista de
              intercambio, {alimentosOcultos === 1 ? "aparece" : "aparecen"} en la distribución.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Guardando..." : "Guardar distribución"}
            </Button>
            <BotonRecalcular
              etiqueta="Recalcular desde el intercambio"
              hayAjustes={Object.keys(celdas).length > 0}
              disabled={pending}
              onRecalcular={() => setCeldas({})}
            />
          </div>
        </fieldset>
      </form>
    </section>
  );
}

// Validacion nutricional (CP3.2): tabla de 16 nutrientes (obtenido/requerido/% cubrimiento/ICN) DERIVADA en
// vivo del intercambio (CP1) + los macros de la cadena + sexo/edad. Solo lectura: NO se guarda, NO se edita,
// asi que no puede desfasarse (se recalcula sola). El sodio se LIMITA (menos es mejor), el resto se cubre.
function ValidacionSection({ protocol }: { protocol: TreatmentProtocol }) {
  const snap = protocol.protocolSuggested;
  if (!snap || protocol.pesoCalculo == null) return null;

  const adjGuardados: ProtocoloAjustes = {
    geb: protocol.adjGeb,
    pal: protocol.adjPal,
    kcalObj: protocol.adjKcalObj,
    protGkg: protocol.adjProtGkg,
    fatPct: protocol.adjFatPct,
    deficit: protocol.adjDeficit,
    pesoMeta: protocol.pesoMetaFijado,
  };
  const ef = computeProtocoloEfectivo(snap, adjGuardados);
  const objetivoEfectivo = Math.round(ef.calorico.kcalObj);
  const defaults = computeIntercambio(objetivoEfectivo);
  const savedInter = protocol.intercambioPorciones;

  const porcionesPorSub: Record<string, number> = {};
  let algunaPorcion = false;
  for (const a of defaults) {
    const p = savedInter?.porciones[a.sub] ?? a.porciones;
    porcionesPorSub[a.sub] = p;
    if (p > 0) algunaPorcion = true;
  }

  // ESTADO VACIO (2026-08-24, al adoptar su orden). La validacion pasa ARRIBA, antes de la formula, porque
  // en un seguimiento responde la primera pregunta del profesional ("¿como va este plan?"). Pero en una
  // consulta INICIAL todavia no hay plan: sin porciones asignadas todo daria 0 % y el ICN 0, y una tabla de
  // ceros se lee como "este plan cubre el 0 % de todo", que es falso. No es que el plan no cubra: es que no
  // hay plan. Se dice, en vez de mostrarla. Es la misma distincion de "no aplica" vs "no se registro".
  if (!algunaPorcion) {
    return (
      <section className={bloqueCls("derivado")}>
        <h3 className={tituloBloqueCls("derivado")}>
          Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)
        </h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Aparece al asignar porciones en la lista de intercambio. Todavía no hay plan que validar.
        </p>
      </section>
    );
  }

  const nutrientes = computeValidacion({
    porcionesPorSub,
    kcalObj: objetivoEfectivo,
    protG: ef.calorico.protG,
    choG: ef.calorico.choG,
    fatG: ef.calorico.fatG,
    // sexo/edad para los targets DRI salen del snapshot sellado (caloricoInputs), no del efectivo.
    sexoM: snap.caloricoInputs.sexoM,
    edad: snap.caloricoInputs.edad,
  });

  // SEMAFORO portado del v8 (interCobColor/interIcnColor, cortes verbatim), con los tokens clinicos de Atlas
  // (verde=optimal, ambar=warning, rojo=critical; NO el azul de excellent, reservado a lo optimo de escala).
  // Cubrimiento: [90,110] optimo, [70,130) alerta, resto critico. Sodio (a LIMITAR): <=100 bien, <=115 alerta,
  // resto critico. ICN: [0.9,1.15] optimo, [0.7,1.3) alerta, resto critico; null (kcal) neutro.
  const cobColor = (n: (typeof nutrientes)[number]): string => {
    if (n.lim) return n.cob <= 100 ? "text-clinical-optimal" : n.cob <= 115 ? "text-clinical-warning" : "text-clinical-critical";
    if (n.cob >= 90 && n.cob <= 110) return "text-clinical-optimal";
    if (n.cob >= 70 && n.cob < 130) return "text-clinical-warning";
    return "text-clinical-critical";
  };
  const icnColor = (v: number | null): string => {
    if (v == null) return "text-muted-foreground";
    if (v >= 0.9 && v <= 1.15) return "text-clinical-optimal";
    if (v >= 0.7 && v < 1.3) return "text-clinical-warning";
    return "text-clinical-critical";
  };
  const fmt = (v: number, d: number) => v.toFixed(d);

  // % de nutrientes con ICN >= 0,9 (resumen util del v8, _icnPctOk): excluye energia y los "a limitar".
  const icnVals = nutrientes.filter((n) => n.k !== "kcal" && !n.lim && n.icn != null).map((n) => n.icn as number);
  const icnPctOk = icnVals.length ? Math.round((icnVals.filter((v) => v >= 0.9).length / icnVals.length) * 100) : 0;

  return (
    <section className={bloqueCls("derivado")}>
      <h3 className={tituloBloqueCls("derivado")}>Validación del plan · % de cubrimiento e ICN (meta ICN ≈ 1)</h3>
      <p className="text-sm text-muted-foreground">
        Cubrimiento de nutrientes contra los requerimientos por sexo y edad. El sodio se{" "}
        <strong>limita</strong> (menos es mejor); el resto se cubre.
      </p>
      {!algunaPorcion ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          La validación aparece cuando hay porciones en la lista de intercambio.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          {/* Ancho minimo por la misma razon que la tabla de intercambio: sin el, en pantalla estrecha las columnas se aprietan y los numeros se parten, y el desplazamiento lateral nunca se activa. */}
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-1 pr-3 text-left font-medium">Nutriente</th>
                <th className="px-2 py-1 text-right font-medium">Obtenido</th>
                <th className="px-2 py-1 text-right font-medium">Necesidad</th>
                <th className="px-2 py-1 text-right font-medium">% Cubrim.</th>
                <th className="px-2 py-1 text-right font-medium">ICN</th>
              </tr>
            </thead>
            <tbody>
              {nutrientes.map((n) => (
                <tr key={n.k} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-foreground">
                    {n.l} <span className="text-xs text-muted-foreground">({n.u})</span>
                    {n.lim ? <span className="ml-1 text-xs text-muted-foreground">· a limitar</span> : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(n.obtenido, n.d)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(n.requerido, n.d)}</td>
                  <td className={"px-2 py-1.5 text-right tabular-nums font-medium " + cobColor(n)}>
                    {Math.round(n.cob)}%
                  </td>
                  {/* ICN: texto "límite" para los a limitar (sodio), "—" para energia, si no el valor. El COLOR
                      va por el ICN incluso para el sodio (fiel al v8: interIcnColor(interICN("na")) lo colorea;
                      un sodio denso -> ICN alto -> rojo, que refuerza el "te pasas"). kcal (icn null) -> gris. */}
                  <td className={"px-2 py-1.5 text-right tabular-nums font-medium " + icnColor(n.icn)}>
                    {n.lim ? "límite" : n.k === "kcal" ? "—" : n.icn == null ? "—" : n.icn.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Leyenda del ICN portada del v8: sin ella la columna es numeros sin significado. Incluye el % de
              nutrientes con ICN >= 0,9 (resumen util). */}
          <p className="mt-2 text-xs text-muted-foreground">
            ICN = (nutriente aportado / requerido) ÷ (energía aportada / requerida). ≈1 balanceado · &gt;1 denso
            · &lt;1 deficitario. Nutrientes con ICN ≥ 0,9: <span className="font-semibold text-foreground">{icnPctOk}%</span>.
          </p>
          {/* Las dos columnas responden preguntas distintas y por eso su color puede discrepar en una misma
              fila (p. ej. fibra al 136% en rojo pero su ICN en ámbar): NO es un error. */}
          <p className="mt-1 text-xs text-muted-foreground">
            El <span className="font-medium">% de cubrimiento</span> mide cuánto se cubre respecto a la necesidad;
            el <span className="font-medium">ICN</span>, si el nutriente viene en proporción a las calorías del
            plan. Un nutriente puede sobrar en cantidad y aun así estar bien proporcionado, así que las dos
            columnas pueden tener colores distintos en la misma fila.
          </p>
        </div>
      )}
    </section>
  );
}

function NotesSection({
  evaluationId,
  protocol,
  locked,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(addNoteAction, EMPTY);
  // Mismo motivo que en el menu: addNoteAction dejo de revalidar, asi que el refresco va aqui, tras el aviso.
  useFormToastAndRefresh(state);
  const [note, setNote] = useState("");
  // Append-only: limpiar el campo tras un guardado exitoso. Si no, el texto recien enviado
  // queda visible como si fuera una nota nueva por agregar, y el profesional podria darle a
  // "Agregar" otra vez y crear un duplicado permanente (la nota no se puede editar ni borrar).
  // Se ajusta en render al cambiar el estado de la accion (patron oficial de React de "ajustar
  // estado en render", guardando el estado previo en estado; sin efecto ni mutacion de ref).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.success && note !== "") setNote("");
  }

  return (
    <div className={bloqueCls("registro")}>
      <h3 className={tituloBloqueCls("registro")}>Notas del tratamiento</h3>
      <p className="text-xs text-muted-foreground">
        Notas internas del protocolo de tratamiento. Se agregan al historial (no se editan ni se
        borran) y no se envían al paciente. Distintas del criterio del diagnóstico y de las notas
        del reporte.
      </p>
      {/* UNA NOTA POR PROFESIÓN (Gildardo 2026-08-30 §8: "cada rol escribe lo suyo y no se pisan").
          Se AGRUPAN, no se ocultan: el médico necesita leer lo que anotó la nutricionista. Lo que su
          instrucción excluye es compartir el campo, no compartir la información. Y como las notas son
          append-only, nadie puede editar la de otro ni por accidente. */}
      {protocol.notes.length ? (
        <div className="flex flex-col gap-3">
          {agruparNotasPorProfesion(protocol.notes).map(([prof, notas]) => (
            <div key={prof} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {PROFESION_NOTA[prof] ?? prof}
              </p>
              <ul className="flex flex-col gap-2">
                {notas.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-3 text-sm text-foreground">
                    <p>{n.note}</p>
                    <p className="pt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sin notas.</p>
      )}
      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Agrega una nota desde tu profesión"
          rows={2}
          disabled={locked}
        />
        <div>
          <Button type="submit" variant="outline" disabled={locked || pending || note.trim() === ""}>
            {pending ? "Agregando..." : "Agregar nota"}
          </Button>
        </div>
      </form>
    </div>
  );
}
