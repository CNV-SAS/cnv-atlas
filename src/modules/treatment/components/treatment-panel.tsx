"use client";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useSyncExternalStore } from "react";
import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RotateCcw, Sparkles } from "lucide-react";

import { computeProtocoloEfectivo, type ProtocoloAjustes } from "@/clinical-engine";
import { NIVELES_FA, nivelFaLabel, PROFESION_NOTA } from "../data/treatment-view-types";
import { computeIntercambio, grupoSinPorcion } from "@/clinical-engine/intercambio";
import { DIAS_DEL_CICLO, diaDelCiclo, diaInicioDerivado } from "@/clinical-engine/menu-ciclo";
import {
  tabla,
  td,
  tdApagadoNum,
  tdFuerte,
  tdGrupo,
  tdNum,
  th,
  theadTr,
  thNum,
  tr,
  trGrupo,
} from "@/components/shared/tabla";
import { AsesoriaMacroPanel } from "./asesoria-macro-panel";
import { AlimentosDelSubgrupo } from "./lista-intercambio";
import { computeTiempos, TIEMPOS_DEF } from "@/clinical-engine/tiempos";
import { computeValidacion } from "@/clinical-engine/validacion";
import { bloqueCls, tituloBloqueCls } from "@/components/shared/bloque";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format/date";
import { etiquetaDeVia } from "@/modules/reports/vias-de-entrega";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import {
  useFormToastAndRefresh,
  useFormToastRefreshOnSuccess,
} from "@/components/shared/use-form-toast";

import {
  aplicarCambioMenuAction,
  aplicarCambiosMenuAction,
  generateMenuAction,
  guardarProtocoloAction,
  type TreatmentActionState,
} from "../actions";
import {
  ROTULO_SECCION,
  seccionesSucias,
  type Publicado,
  type SeccionId,
} from "../data/borrador-protocolo";
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
  type MenuSemanalSaved,
  type AsesoriaMacro,
  type PrescripcionNutricional,
  type TreatmentNote,
  type MenuSuggestion,
  type TiemposSaved,
  type TreatmentProtocol,
} from "../data/treatment-view-types";

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

// ═══ UN SOLO GUARDADO PARA TODO EL PROTOCOLO (Santiago, 2026-09-09) ═══
//
// LO QUE PIDIO, textual: *"quitar todos esos botones de guardar ajustes por bloques y que cada cambio sea
// en vivo... que aparezca un toast o notificación sticky... y un botón que diga Guardar cambios. Así
// pasamos de 8 botones a solo 1 botón."*
//
// COMO SE HIZO, Y POR QUE ASI. Cada seccion CONSERVA su estado y su logica de derivacion (la lista de
// intercambio recalcula sus porciones, la distribucion su reparto, la cadena su vista previa): eso ya
// funcionaba y reescribirlo para subirlo al padre habria sido cambiar mil quinientas lineas que nadie
// pidio cambiar. Lo que hacen ahora es PUBLICAR su borrador hacia arriba, y el padre reune los siete,
// dibuja el aviso pegajoso y manda UN guardado.
//
// EL GUARD CONTRA EL BUCLE es la FIRMA: una seccion publica en cada render, y el padre solo cambia de
// estado si la firma llego distinta. Sin eso, publicar provocaria un render que volveria a publicar.
//
// CADA SECCION PUBLICA **DOS** FIRMAS, y esa segunda es el arreglo del 2026-09-10: la de lo que hay en
// pantalla, y la de lo que ELLA MISMA presentaria sin tocarla. La diferencia entre las dos es la unica
// definicion de "cambiado" que no miente. Ver el porque completo en `data/borrador-protocolo.ts`.
//
// Y NINGUNA DE LAS DOS ES LA DEL CANDADO DE CONCURRENCIA, que se calcula sobre lo GUARDADO porque el
// servidor la recomputa bajo lock. Conflarlas fue justo el defecto.

/**
 * EL ALMACEN DEL BORRADOR, fuera de React a proposito.
 *
 * POR QUE NO ES `useState` DEL PADRE. Una seccion publica desde un efecto, y llamar al `setState` del
 * padre dentro del efecto de un hijo encadena renders (es lo que señala la regla `set-state-in-effect`, y
 * con razon: siete secciones publicando en cascada). Un almacen externo es justo el caso que React
 * documenta para esto: el hijo ACTUALIZA UN SISTEMA EXTERNO, y el padre se SUSCRIBE con
 * `useSyncExternalStore`. Un solo re-render del padre por cambio real, y ninguno por publicar lo mismo.
 *
 * EL GUARD CONTRA EL BUCLE sigue siendo la FIRMA: publicar lo mismo no notifica a nadie.
 */
type AlmacenBorrador = {
  publicar: (seccion: SeccionId, valor: unknown, firma: string, firmaBase: string) => void;
  leer: () => Partial<Record<SeccionId, Publicado>>;
  suscribir: (oyente: () => void) => () => void;
};

function crearAlmacenBorrador(): AlmacenBorrador {
  let estado: Partial<Record<SeccionId, Publicado>> = {};
  const oyentes = new Set<() => void>();
  return {
    publicar(seccion, valor, firma, firmaBase) {
      const previo = estado[seccion];
      // LAS DOS entran en el guard: la base tambien se mueve (los tiempos activos en vivo cambian el
      // contexto de la distribucion), y comparar solo la de pantalla dejaria al padre sin enterarse.
      if (previo?.firma === firma && previo?.firmaBase === firmaBase) return;
      // Objeto NUEVO en cada cambio: `useSyncExternalStore` compara por identidad, y mutar el mismo dejaria
      // al padre sin enterarse.
      estado = { ...estado, [seccion]: { valor, firma, firmaBase } };
      for (const o of oyentes) o();
    },
    leer: () => estado,
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
  };
}

type BorradorCtx = {
  almacen: AlmacenBorrador;
  /** Hay un guardado en vuelo: los campos se apagan para que no se pierda lo que se escriba encima. */
  guardando: boolean;
};

const BorradorContexto = createContext<BorradorCtx | null>(null);

function useBorrador(): BorradorCtx {
  const ctx = useContext(BorradorContexto);
  // No se cae con undefined en produccion: una seccion fuera del panel es un error de programacion, y el
  // mensaje tiene que decir cual es en vez de reventar en un `publicar of undefined`.
  if (!ctx) throw new Error("Una sección del protocolo se renderizó fuera del panel de tratamiento.");
  return ctx;
}

/**
 * Publica el borrador de una seccion cada vez que su firma cambia.
 *
 * SE PUBLICA EN UN EFECTO Y NO EN EL RENDER porque cambiar el estado del padre durante el render del hijo
 * es justo lo que React prohibe. El efecto corre despues de pintar, asi que el aviso pegajoso aparece un
 * ciclo despues de teclear, que es imperceptible y es el precio de no reescribir las siete secciones.
 */
function usePublicar(
  seccion: SeccionId,
  valor: unknown,
  firma: string | null,
  /** La firma de lo que esta seccion presentaria SIN TOCARLA. Es contra lo que se decide si hay cambios. */
  firmaBase: string | null,
): void {
  const { almacen } = useBorrador();
  useEffect(() => {
    // FIRMA NULA = LA SECCION NO APLICA (un tratamiento sin snapshot sellado no tiene cadena ni lista de
    // intercambio que publicar). Se llama al hook igual, sin condicion, porque el orden de los hooks no
    // puede depender de los datos; lo que se salta es la publicacion.
    if (firma == null || firmaBase == null) return;
    almacen.publicar(seccion, valor, firma, firmaBase);
    // `valor` se omite a proposito: la FIRMA es lo que decide si algo cambio, y el valor puede ser un
    // objeto nuevo en cada render (un `.map`, un literal) sin que nada haya cambiado de verdad. Con el
    // valor en las dependencias, el efecto correria en cada render y el guard del padre seria lo unico
    // que impediria el bucle; con la firma, ni siquiera se llega ahi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacen, seccion, firma, firmaBase]);
}

// Panel del protocolo de tratamiento (B13), vista interna del profesional. Edita objetivos,
// nutraceuticos y guias, y agrega notas. Si el diagnostico no esta confirmado, la edicion
// se bloquea (gate de B13: el protocolo se autoriza tras aprobar el reporte).
// Peso meta (cadena calórica, pieza 1: HECHO VISIBLE — nota 3 de Gildardo). Hoy el peso sobre el que se
// calcula la prescripción sale del snapshot (pesoCalculo) y, si nadie lo fija, se usa sin decirlo. Aquí se
// MUESTRA con su fórmula (pesoCalculoLabel) y se deja FIJAR (adj_peso_meta, con el guardado único). No
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
// Los cinco niveles de actividad viven en `treatment-view-types` (modulo NEUTRO): los comparte con el
// compositor de la historia clinica, que es servidor y hasta el 2026-09-06 imprimia "PAL 1.375" donde
// esta pantalla dice "Ligera (1.375)".

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

  // SE VE COMO UN BOTON (cotejo 2026-09-05, punto 24: "se ve raro"). Iba en `ghost`, o sea sin borde ni
  // fondo, al lado de un "Guardar" con contorno: se leia como texto suelto, que es el MISMO defecto del
  // selector de archivo del punto 7. Va con contorno, como todos los guardados del panel, y lo que lo
  // distingue es el ICONO, no la ausencia de forma.
  if (!hayAjustes) {
    return (
      <Button type="button" variant="outline" disabled={disabled} onClick={onRecalcular}>
        <RotateCcw className="size-4" aria-hidden />
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
        <RotateCcw className="size-4" aria-hidden />
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
  protocol,
  prescripcion,
  asesoria,
  validacion,
}: {
  protocol: TreatmentProtocol;
  /** La prescripcion del motor que gobierna, para AVISAR si su proteina difiere de la de la cadena. */
  prescripcion: PrescripcionNutricional | null;
  /** Los rangos que su ciencia SUGIERE para proteina y grasa. Muestran, no validan. */
  asesoria: { prot: AsesoriaMacro; grasa: AsesoriaMacro } | null;
  /**
   * LA TABLA DE VALIDACION, RENDERIZADA ENTRE LOS DOS BLOQUES (cotejo 2026-09-05, punto 21).
   *
   * Viene como prop en vez de estar en el padre porque su pantalla la pone JUSTO AHI: el bloque del
   * objetivo con sus cuatro campos, la validacion, y despues la formula. Y la razon de Santiago es la
   * buena: esos cuatro campos cambian la tabla en vivo, y con la tabla arriba y los campos abajo se
   * ignora que una cosa mueve a la otra.
   *
   * NO SE PARTE EL FORMULARIO. Los seis ajustes son una sola unidad clinica (`saveAdjustments` los
   * escribe de golpe y `adjustmentSignature` cubre los seis), asi que partirlo obligaria a dos firmas
   * sobre las mismas columnas y un guardado parcial dejaria que la cadena de un profesional pisara la
   * meta de otro. Lo que se intercala es una tabla de SOLO LECTURA, sin inputs ni botones: no hay
   * formulario anidado (que seria HTML invalido) ni un boton que herede `type="submit"`.
   *
   * ES UNA FUNCION Y NO UN NODO (2026-09-06, punto 21b): la tabla se recalcula EN VIVO con los cuatro
   * campos de arriba, y esos viven en el estado de ESTA seccion. El padre no los tiene. Mismo patron
   * que `adaptar` en el bloque de restricciones.
   */
  validacion: (
    ajustes: ProtocoloAjustes,
    opciones: { protKgVigente: number | null },
    sinGuardar: boolean,
  ) => ReactNode;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();
  // useState-once desde la prop; el remonte (key del padre) re-deriva cuando el servidor cambia algo.
  const [pesoMeta, setPesoMeta] = useState(numToInput(protocol.pesoMetaFijado));
  const [geb, setGeb] = useState(numToInput(protocol.adjGeb));
  const [pal, setPal] = useState(numToInput(protocol.adjPal));
  const [kcalObj, setKcalObj] = useState(numToInput(protocol.adjKcalObj));
  const [protGkg, setProtGkg] = useState(numToInput(protocol.adjProtGkg));
  const [fatPct, setFatPct] = useState(numToInput(protocol.adjFatPct));
  const [deficit, setDeficit] = useState(numToInput(protocol.adjDeficit));

  const snap = protocol.protocolSuggested;

  // Ajustes vivos (lo que hay en pantalla ahora) = exactamente lo que se guardara.
  //
  // SE CALCULAN ANTES DE LA GUARDA de "sin snapshot", y no por gusto: publicar el borrador es un HOOK, y
  // un hook no puede quedar detras de un `return` temprano. Los ajustes solo dependen del estado de esta
  // seccion, asi que calcularlos antes no cuesta nada.
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
  // LO QUE HAY EN PANTALLA, HACIA ARRIBA. La firma se calcula sobre los ajustes VIVOS: es la misma funcion
  // que el servidor recomputa bajo lock, asi que el aviso de "sin guardar" se enciende exactamente cuando
  // lo de pantalla difiere de lo que hay en la base.
  usePublicar(
    "ajustes",
    adj,
    // Sin snapshot sellado no hay cadena que publicar: la seccion no se rinde y no aporta al borrador.
    snap && protocol.pesoCalculo != null
      ? adjustmentSignature({
          treatmentId: protocol.treatmentId,
          adjGeb: adj.geb,
          adjPal: adj.pal,
          adjKcalObj: adj.kcalObj,
          adjProtGkg: adj.protGkg,
          adjFatPct: adj.fatPct,
          adjDeficit: adj.deficit,
          pesoMetaFijado: adj.pesoMeta,
        })
      : null,
    // SIN TOCAR presenta exactamente lo guardado: los campos se inicializan de la prop y la ida y vuelta
    // texto/numero es exacta. Por eso esta seccion nunca salio en el aviso falso.
    adjustmentSignature({
      treatmentId: protocol.treatmentId,
      adjGeb: protocol.adjGeb,
      adjPal: protocol.adjPal,
      adjKcalObj: protocol.adjKcalObj,
      adjProtGkg: protocol.adjProtGkg,
      adjFatPct: protocol.adjFatPct,
      adjDeficit: protocol.adjDeficit,
      pesoMetaFijado: protocol.pesoMetaFijado,
    }),
  );

  // Sin snapshot sellado (o sin cadena, o sin peso de calculo) no hay que ajustar: tratamiento pre-snapshot.
  if (!snap || protocol.pesoCalculo == null) return null;

  const opciones = { protKgVigente: prescripcion?.protKg ?? null };
  // LO DE PANTALLA FRENTE A LO GUARDADO. Se compara campo a campo sobre los seis ajustes, que son los
  // que la tabla consume; asi el aviso aparece exactamente cuando la tabla esta mostrando algo que
  // todavia no esta en la base, y desaparece solo al guardar (la seccion se remonta por su key).
  const hayCambiosSinGuardar =
    adj.geb !== protocol.adjGeb ||
    adj.pal !== protocol.adjPal ||
    adj.kcalObj !== protocol.adjKcalObj ||
    adj.protGkg !== protocol.adjProtGkg ||
    adj.fatPct !== protocol.adjFatPct ||
    adj.deficit !== protocol.adjDeficit ||
    adj.pesoMeta !== protocol.pesoMetaFijado;
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

  // LA FIRMA DE LO GUARDADO YA NO SE CALCULA AQUI (2026-09-09): el candado de concurrencia lo manda el
  // panel, con las SIETE firmas de golpe, para poder rechazar el conjunto si otro profesional movio
  // cualquiera de las secciones. Lo que esta seccion publica es la firma de lo que hay EN PANTALLA.


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

  // DE DONDE SALE EL OBJETIVO, mirando la CASCADA ENTERA y no un solo campo.
  //
  // EL DEFECTO QUE CIERRA (cotejo 2026-09-05, puntos 22.1 y 22.2, que son UNO): esto miraba solo
  // `adj.kcalObj`, asi que con el peso meta fijado la pantalla mostraba 2408 y lo rotulaba "sugerido por
  // el modelo", mientras el campo de abajo decia correctamente "modelo: 2377". Dos cifras del mismo
  // concepto en la misma pantalla, y una mintiendo sobre su procedencia.
  //
  // LAS CIFRAS ESTABAN BIEN, y eso es lo que costo ver: 1729 x 1,375 = 2377 es la cadena sobre el peso
  // CALCULADO, y 1751 x 1,375 = 2408 la MISMA cadena sobre el peso META que fijo el profesional. No eran
  // dos motores ni dos formulas, como con la proteina: era un rotulo.
  //
  // El objetivo se mueve con CINCO cosas, no con una: el objetivo mismo, el deficit, el PAL, el GEB y el
  // PESO META (que arrastra al GEB). Con cualquiera puesta, esto ya no es lo que sugirio el modelo.
  const hayAjusteAguasArriba =
    adj.pesoMeta != null || adj.geb != null || adj.pal != null || adj.deficit != null;
  const procedenciaObjetivo = objetivoLoFijoElProfesional
    ? "fijado por ti"
    : hayAjusteAguasArriba
      ? "recalculado con tus ajustes"
      : "sugerido por el modelo";
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
    // UNA SOLA unidad clinica, se escriben de golpe y `adjustmentSignature` cubre las seis. Partir el
    // guardado obligaria a dos firmas sobre las mismas columnas, y un guardado parcial dejaria que la
    // cadena de un profesional pisara la meta de otro. Se parte la PRESENTACION.
    //
    // YA NO ES UN `<form>`: desde el 2026-09-09 el guardado es UNO para todo el protocolo, al pie del
    // panel. Los campos siguen siendo los mismos y el estado sigue viviendo aqui; lo que desaparecio es el
    // acto de guardar por bloque.
    <div className="flex flex-col gap-4">
      <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-4">
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
              // EL PLACEHOLDER DICE LO QUE PASA SI SE DEJA VACIO, no lo que se sello al diagnosticar.
              // Antes ponia `base.kcalObj` (2377), y dejando el campo en blanco salia 2408: un placeholder
              // que promete una cifra y entrega otra. Era la raiz de la confusion del cotejo 22.1, y el
              // primer arreglo la TAPO (anadiendo "el modelo sugirio 2377") en vez de cerrarla.
              placeholder={`modelo: ${d0(objetivoDelModelo)}`}
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
              title="Vacía el campo; guarda para volver al peso calculado"
            >
              Usar el calculado ({pesoCalcDisp} kg)
            </button>
          </div>
          {/* EL BOTON DE GUARDAR DE ESTA SECCION SE RETIRO (2026-09-09), y con el su gemelo del pie de la
              formula. Habia DOS disparadores del mismo acto porque en movil el de abajo caia fuera de
              pantalla; ahora el guardado es UNO para todo el protocolo y vive en una barra PEGAJOSA al
              pie del panel, que se ve desde cualquier punto del scroll. El problema que motivo el
              segundo boton lo resuelve la barra, y de paso desaparecen los otros seis. */}
          {/* La distincion CALCULADO vs AJUSTADO, que es el segundo de los tres beneficios que concedio. */}
          <p className="flex items-baseline justify-between gap-4 border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">Objetivo calórico del plan</span>
            <span className="font-semibold text-foreground">
              {d0(cal.kcalObj)} kcal
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {/* SOLO LA PROCEDENCIA, sin una segunda cifra. Aqui llego a decir "el modelo sugirio
                    2377" para explicar por que el campo de arriba ponia otra cosa; con el placeholder
                    arreglado ese numero desaparecio de la pantalla y explicarlo sobra. La procedencia si
                    se queda: es lo que distingue una cifra del modelo de una que puso el profesional, y
                    no cuesta un segundo numero. */}
                {procedenciaObjetivo}
              </span>
            </span>
          </p>
        </section>
      </fieldset>

      {/* LA VALIDACION, ENTRE LOS DOS BLOQUES (cotejo punto 21). Va FUERA del fieldset a proposito:
          es lectura, no edicion, y un `fieldset:disabled` alrededor de una tabla de resultados la
          apagaria visualmente al sellar la prescripcion, que es justo cuando mas se consulta.

          Se le pasan los ajustes VIVOS y las MISMAS opciones que usa la cadena, para que se recalcule
          al teclear (21b) y para que las dos cuentas no puedan salir de fuentes distintas. */}
      {validacion(adj, opciones, hayCambiosSinGuardar)}

      <fieldset className="flex min-w-0 flex-col gap-4">
        {/* BLOQUE 2 · LA CADENA QUE PRODUCE ESA META.

            EL TITULO ES EL SUYO (cotejo punto 23): su archivo lo llama "D — FÓRMULA SINTÉTICA", y
            Santiago pidio adoptarlo. "Cómo se llega a ese objetivo" era nuestro y describia bien lo que
            hace, asi que no se pierde: baja a subtitulo. El nombre propio arriba, la explicacion debajo. */}
        <section className={bloqueCls("derivado")}>
          {/* EL SUBTITULO, COMO ROTULO Y NO DE CORRIDO (segundo smoke, punto 23). Iba pegado a la
              explicacion en el mismo parrafo ("Cómo se llega a ese objetivo. Ajusta cualquier eslabón:
              la vista previa..."), y asi no es un subtitulo: es una frase mas. Va en su propia linea, en
              versalitas, que es como esta pantalla marca lo que rotula frente a lo que explica. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo se llega a ese objetivo
          </p>
          <h3 className={tituloBloqueCls("derivado")}>Fórmula sintética</h3>
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
              // Mismo caso que el objetivo: `base.geb` era el sellado (1729) y lo que corre al dejarlo
              // vacio es el GEB sobre el peso de la cadena (1751). `gebAuto` ES ese valor.
              placeholder={`modelo: ${d0(cal.gebAuto)}`}
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
            {/* PROTEINA Y GRASA SON LOS DOS UNICOS CON REFERENCIA POR DIAGNOSTICO (Gildardo, 2026-09-03):
                son los dos macros para los que su ciencia tiene un rango por condicion. El panel MUESTRA,
                no valida: sin techo, sin piso y sin bloquear el guardado.

                EL PANEL BAJO A ANCHO COMPLETO, DEBAJO DE LA VISTA PREVIA (cotejo 2026-09-05, 22.3 y 23).
                Aqui, pegado a un campo de un cuarto de ancho, el porque y la fuente no cabian y se leian
                apretados. El cable entre el campo y su panel lo dice el subtitulo, que es lo que hace su
                archivo ("Su decisión — referencia según el diagnóstico abajo"). */}
            <div className="flex flex-col gap-1">
              <AdjInput
                name="adjProtGkg"
                label="Proteína (g/kg)"
                value={protGkg}
                onChange={setProtGkg}
                // MISMA REGLA QUE EL OBJETIVO Y EL GEB (barrido del 2026-09-05): un placeholder solo se
                // ve con el campo VACIO, y con el campo vacio lo que corre es `cal.*`. Leer el SELLADO
                // aqui prometia 0,8 en los snapshots anteriores al 2026-09-03, que no traen `mtn`: en
                // esos la cadena resuelve la proteina con el motor de HOY y podia dar otra cosa.
                placeholder={`modelo: ${cal.protGKg}`}
                step="0.1"
              />
              <span className="text-xs text-muted-foreground">Tu decisión; la referencia va abajo.</span>
            </div>
            <div className="flex flex-col gap-1">
              <AdjInput
                name="adjFatPct"
                label="Grasa (%)"
                value={fatPct}
                onChange={setFatPct}
                placeholder={`modelo: ${cal.fatPct}`}
                step="1"
              />
              <span className="text-xs text-muted-foreground">Tu decisión; la referencia va abajo.</span>
            </div>
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
            {/* EL GEB DICE TAMBIEN EL DEL MODELO CUANDO NO COINCIDE (cotejo 22.2). El campo de arriba
                lleva `modelo: 1729` de placeholder y aqui salia 1751 sin explicacion. Las dos son
                correctas: la del campo es la del peso CALCULADO y esta la del peso META que fijo el
                profesional, porque el GEB de Mifflin se calcula sobre el peso de la cadena. Sin decirlo,
                son dos cifras del mismo concepto en la misma pantalla. */}
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
              // "DE LA CADENA" Y NO "DEL MODELO": esta cifra sale de `cal.get`, que ya lleva el peso meta
              // y el PAL que puso el profesional, asi que llamarla del modelo era el mismo rotulo falso
              // del bloque de arriba (cotejo 22.1). Lo que dice es a donde llega la cuenta antes de que el
              // profesional la reemplace.
              label={objetivoLoFijoElProfesional ? "Objetivo de la cadena" : "Objetivo calórico"}
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

          {/* LAS DOS REFERENCIAS POR DIAGNOSTICO, A ANCHO COMPLETO Y DEBAJO DE LA CUENTA, como en su
              archivo (cotejo 2026-09-05, 22.3 y 23). Van DESPUES de la vista previa y no antes: primero
              se ve que se esta prescribiendo, y luego contra que se compara. Cada panel dice lo prescrito
              y lo sugerido en la misma linea, que es la comparacion que el profesional viene a hacer. */}
          <div className="flex flex-col gap-3">
            <AsesoriaMacroPanel
              titulo="Proteína"
              asesoria={asesoria?.prot ?? null}
              // El valor que se le pasa es el ESCRITO, con la caida al del modelo cuando el campo esta
              // vacio: es la cifra que de verdad se va a prescribir, y es sobre esa que hay que decir si
              // quedo fuera de rango. Con el campo vacio manda el modelo, no "sin dato".
              valor={protGkg.trim() === "" ? String(base.protGKg ?? "") : protGkg}
            />
            <AsesoriaMacroPanel
              titulo="Grasa"
              asesoria={asesoria?.grasa ?? null}
              valor={fatPct.trim() === "" ? String(base.fatPct ?? "") : fatPct}
            />
          </div>
        </section>

        </fieldset>
    </div>
  );
}


export function TreatmentPanel({
  evaluationId,
  protocol,
  patronAlimentario,
  prescripcion,
  asesoria,
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
  // Rangos de referencia por diagnostico para proteina y grasa (Gildardo 2026-09-03). Bajan hasta la
  // seccion de la cadena calorica, que es donde estan los dos campos.
  asesoria: { prot: AsesoriaMacro; grasa: AsesoriaMacro } | null;
}) {
  // Bloqueado para editar si el diagnostico no esta confirmado O si el protocolo YA se aprobo (la
  // prescripcion aprobada es inmutable: el trigger de BD la congela; sin este candado el campo se veria
  // editable y el guardado chocaria contra el trigger). Se distinguen para dar el mensaje correcto.
  // SIN BLOQUEO POR DIAGNOSTICO SIN CONFIRMAR (2026-09-09). Lo unico que cierra el protocolo es que la
  // prescripcion este APROBADA, que es cuando se emitio. Ver `treatment-writer.ts`.
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

  // ═══ EL BORRADOR DE LAS SIETE SECCIONES, Y UN SOLO GUARDADO ═══
  //
  // Las secciones publican lo que tienen en pantalla; aqui se reune, se compara contra lo guardado y se
  // manda entero. Ver la nota larga arriba, junto a `BorradorContexto`.
  const almacen = useMemo(() => crearAlmacenBorrador(), []);
  const publicado = useSyncExternalStore(almacen.suscribir, almacen.leer, almacen.leer);
  const [estadoGuardado, guardar, guardando] = useActionState(guardarProtocoloAction, EMPTY);
  // RefreshOnSuccess: al guardar, el servidor devuelve el protocolo nuevo, las firmas cambian y el aviso
  // se apaga solo. En WARNING (concurrencia) NO refresca, y esa es la mitad que protege el trabajo: traer
  // la version del otro profesional descartaria lo que este acaba de escribir, que es justo lo que el
  // rechazo preserva para que lo pueda reaplicar.
  useFormToastRefreshOnSuccess(estadoGuardado);

  // LAS FIRMAS DE LO GUARDADO. Son las MISMAS que el servidor recomputa bajo lock: el aviso de "sin
  // guardar" y el candado de concurrencia miran exactamente lo mismo, asi que no pueden discrepar.
  const firmasGuardadas: Record<SeccionId, string> = useMemo(
    () => ({
      ajustes: adjustmentSignature({
        treatmentId: protocol.treatmentId,
        adjGeb: protocol.adjGeb,
        adjPal: protocol.adjPal,
        adjKcalObj: protocol.adjKcalObj,
        adjProtGkg: protocol.adjProtGkg,
        adjFatPct: protocol.adjFatPct,
        adjDeficit: protocol.adjDeficit,
        pesoMetaFijado: protocol.pesoMetaFijado,
      }),
      objetivo: objetivoSignature({
        treatmentId: protocol.treatmentId,
        objetivo: protocol.objetivoTexto,
      }),
      restricciones: restriccionesSignature({
        treatmentId: protocol.treatmentId,
        restricciones: protocol.restricciones,
      }),
      intercambio: intercambioSignature({
        treatmentId: protocol.treatmentId,
        intercambio: protocol.intercambioPorciones,
      }),
      tiemposActivos: tiemposActivosSignature({
        treatmentId: protocol.treatmentId,
        activos: protocol.tiemposActivos,
      }),
      tiempos: tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: protocol.tiempos }),
      menuSemanal: menuSemanalSignature({
        treatmentId: protocol.treatmentId,
        menu: protocol.menuSemanal,
      }),
    }),
    [protocol],
  );

  // QUE HAY SIN GUARDAR. Se compara lo de pantalla contra lo que la MISMA seccion presentaria sin
  // tocarla, NO contra lo guardado.
  //
  // EL DEFECTO QUE ESTO CIERRA (Santiago, 2026-09-10): comparando contra lo guardado, entrar a la
  // pestaña sin tocar nada avisaba de CUATRO secciones con cambios. Son justo las cuatro que pueden estar
  // guardadas como `null` y DERIVAN un valor al montar (la lista de intercambio calcula sus porciones,
  // los tiempos caen a su juego por defecto, la distribucion arma su contexto, el menu deriva su dia de
  // arranque). Un aviso que sale siempre se aprende a ignorar, y entonces el dia que haya cambios de
  // verdad nadie lo lee. Ver `data/borrador-protocolo.ts`.
  const sucias = seccionesSucias(publicado);
  const haySinGuardar = sucias.length > 0;

  // AVISO DEL NAVEGADOR AL CERRAR O RECARGAR con trabajo sin guardar. No cubre cambiar de pestaña dentro
  // de la aplicacion (eso lo resuelve que las etapas visitadas ya no se desmonten, ver `evaluation-tabs`),
  // pero si el cierre accidental, que es la otra forma de perder una consulta entera.
  useEffect(() => {
    if (!haySinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [haySinGuardar]);

  // EL PAYLOAD. Cada seccion aporta lo que publico; si no publico (no llego a montar), va lo GUARDADO, que
  // es lo unico que no puede borrar nada. La cadena calorica se convierte de texto a numero aqui, que es
  // donde el borrador deja de ser lo que se escribe y pasa a ser lo que se guarda.
  // LO QUE VIAJA POR CADA SECCION.
  //
  // SOLO LAS TOCADAS MANDAN SU BORRADOR; las demas mandan lo GUARDADO, para que el writer no vea cambio y
  // no las escriba. No es una optimizacion: guardar la lista de intercambio DERIVADA porque el
  // profesional edito el objetivo sellaria un `objetivoBase` que nadie decidio, y a partir de ahi el aviso
  // de desfase empezaria a dispararse sobre una lista que nunca se toco.
  const sucia = (k: SeccionId) => publicado[k] != null && publicado[k]!.firma !== publicado[k]!.firmaBase;
  const valor = <T,>(k: SeccionId, guardado: T): T =>
    sucia(k) ? (publicado[k]!.valor as T) : guardado;

  const payload = () =>
    JSON.stringify({
      editable: {
        ajustes: valor<ProtocoloAjustes>("ajustes", {
          geb: protocol.adjGeb,
          pal: protocol.adjPal,
          kcalObj: protocol.adjKcalObj,
          protGkg: protocol.adjProtGkg,
          fatPct: protocol.adjFatPct,
          deficit: protocol.adjDeficit,
          pesoMeta: protocol.pesoMetaFijado,
        }),
        objetivo: valor<string | null>("objetivo", protocol.objetivoTexto),
        restricciones: valor<string[]>("restricciones", protocol.restricciones),
        intercambio: valor<IntercambioSaved | null>("intercambio", protocol.intercambioPorciones),
        tiemposActivos: valor<Record<string, boolean> | null>("tiemposActivos", protocol.tiemposActivos),
        tiempos: valor<TiemposSaved | null>("tiempos", protocol.tiempos),
        menuSemanal: valor<MenuSemanalSaved | null>("menuSemanal", protocol.menuSemanal),
      },
      firmas: firmasGuardadas,
    });

  // LOS AJUSTES VIAJAN CON LOS NOMBRES DE LA BASE, no con los del motor: el schema del servidor los espera
  // asi. Se traduce en un solo sitio para que no haya dos mapas del mismo objeto.
  const conNombresDeColumna = (a: ProtocoloAjustes) => ({
    adjGeb: a.geb,
    adjPal: a.pal,
    adjKcalObj: a.kcalObj,
    adjProtGkg: a.protGkg,
    adjFatPct: a.fatPct,
    adjDeficit: a.deficit,
    pesoMetaFijado: a.pesoMeta,
  });

  // EL CUERPO QUE VIAJA, ya con los nombres de las columnas. Va en un input oculto y el envio pasa por
  // `enviarSinReset`, como los demas formularios del modulo: escribirse un submit a mano es como se
  // pierde uno de los cuidados que ese helper concentra (React 19 resetea los select y los checkbox
  // controlados al ejecutar la accion de un `<form action={...}>`).
  const cuerpo = () => {
    const e = JSON.parse(payload()) as {
      editable: { ajustes: ProtocoloAjustes } & Record<string, unknown>;
      firmas: Record<string, string>;
    };
    return JSON.stringify({
      editable: { ...e.editable, ajustes: conNombresDeColumna(e.editable.ajustes) },
      firmas: e.firmas,
    });
  };

  // LOS VALORES VIVOS QUE GOBIERNAN OTRAS SECCIONES. Es la otra mitad de lo que pidio Santiago: que cada
  // cambio se vea EN VIVO. Los tiempos de comida mandan sobre la distribucion y sobre el menu, y hasta hoy
  // habia que APLICARLOS (un guardado) para que las dos tablas de abajo se enteraran; el aviso que lo
  // explicaba era la prueba de que el flujo estaba al reves.
  // OJO: estos NO pasan por `valor()`. Lo que gobierna a otra seccion es siempre lo que hay EN PANTALLA,
  // se haya tocado o no: la distribucion tiene que repartir sobre las porciones que se ven, aunque sean
  // las calculadas por defecto y nadie las haya movido. `valor()` decide que se GUARDA, que es otra cosa.
  const enPantalla = <T,>(k: SeccionId, guardado: T): T =>
    publicado[k] != null ? (publicado[k]!.valor as T) : guardado;
  const activosEnVivo = enPantalla<Record<string, boolean> | null>(
    "tiemposActivos",
    protocol.tiemposActivos,
  );
  const intercambioEnVivo = enPantalla<IntercambioSaved | null>(
    "intercambio",
    protocol.intercambioPorciones,
  );

  // Objeto NUEVO por render, y da igual: lo que consumen las secciones es `almacen`, que es estable, y
  // `guardando`, que tiene que cambiar para que los campos se apaguen.
  const ctx: BorradorCtx = { almacen, guardando };


  return (
    <BorradorContexto.Provider value={ctx}>
      <Card>
      <CardHeader>
        <CardTitle>Protocolo de tratamiento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* SE RETIRO EL AVISO DE "diagnostico sin confirmar" (2026-09-09): el protocolo ya no se bloquea
            por eso. Ver `treatment-writer.ts` para el porque.

            Y SE RETIRARON LOS DOS BLOQUES DE APROBACION. Uno decia que la prescripcion estaba congelada y
            ofrecia reabrirla con un motivo; el otro avisaba de que reemplazaba a una anterior. Los dos
            colgaban de un estado que ya no existe: la prescripcion esta SIEMPRE abierta.
            Lo que si importaba clinicamente (que el paciente ya tiene una version y hay que avisarle si
            cambia lo que come, §12c) no dependia del candado, sino de que alguien hubiera recibido algo.
            Eso es lo que dice ahora `EntregasRegistradas`. */}
        <EntregasRegistradas emisiones={protocol.emisiones} />
        {/* AGRUPACION (2026-08-22): dos bloques SEGUIDOS, sin nivel de navegacion nuevo (el orden natural es
            leer el caso y bajar a construir; no son dos modos alternativos, son dos momentos). Arriba LECTURA
            del diagnostico (resumen + meta, que rendriza el Panel server, + objetivo + guias + salud celular);
            una marca de bloque abajo abre el PLAN ALIMENTARIO. La marca es visual, NO un control. */}
        <ObjetivoSection
          key={sectionKey("objetivo", objetivoSignature({ treatmentId: protocol.treatmentId, objetivo: protocol.objetivoTexto }))}
          evaluationId={evaluationId}
          protocol={protocol}
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

        {/* ORDEN DE GILDARDO (2026-08-24), AFINADO CON SU PANTALLA AL LADO (cotejo 2026-09-05, punto 21).

            Su logica es fijar la meta, ver si el plan la cumple, ajustar y repartir. Lo que faltaba es que
            en SU pantalla los cuatro campos de la meta (objetivo, actividad, deficit y peso meta) estan
            DENTRO del bloque del objetivo, o sea JUSTO ENCIMA de la validacion, y en Atlas quedaban debajo
            de ella. Textual de Santiago: "estos 4 campos cambian inmediatamente la tabla de abajo... si los
            dejamos donde estan, se ignora casi por completo que esto afecta la funcionalidad de la tabla".

            Asi que la validacion ya no va suelta aqui: se le pasa a la cadena, que la renderiza ENTRE sus
            dos bloques. Queda el orden de su archivo: objetivo con sus cuatro campos, validacion, formula
            sintetica. Y sin partir el formulario, que sigue siendo uno con un solo boton. */}
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
          protocol={protocol}
          prescripcion={prescripcion}
          asesoria={asesoria}
          validacion={(ajustes, opcionesCadena, sinGuardar) => (
            <ValidacionSection
              protocol={protocol}
              ajustes={ajustes}
              opciones={opcionesCadena}
              sinGuardar={sinGuardar}
            />
          )}
        />
        {/* Intercambio (CP1.2b): despues de la cadena, que le da el objetivo. key = firma del intercambio
            guardado: un cambio del servidor remonta y re-deriva las porciones (no queda pegado). */}
        <IntercambioSection
          key={sectionKey(
            "intercambio",
            intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: protocol.intercambioPorciones }),
          )}
          protocol={protocol}
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
          protocol={protocol}
        />
        {/* Distribucion (CP2.2b): despues del intercambio, que le da las porciones. key = firma de tiempos (remonta). */}
        <TiemposSection
          key={sectionKey("tiempos", tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: protocol.tiempos }))}
          protocol={protocol}
          activosEnVivo={activosEnVivo}
          intercambioEnVivo={intercambioEnVivo}
        />
        {/* LA LISTA DEL PACIENTE SE RETIRO DE AQUI (2026-09-03), y era una divergencia nuestra que se cierra.
            En su archivo esa lista es `plan-print-only`: NO se ve en pantalla, solo al imprimir. La
            mostrabamos porque no teniamos superficie de entrega; desde el 1-sep el paciente recibe su plan
            dentro del reporte, asi que la condicion de salida que este mismo codigo declaraba se cumplio.
            El profesional no pierde nada: los alimentos con gramaje siguen en la tabla de trabajo de
            arriba, plegados por subgrupo y COMPLETOS (no recortados a 8). */}
        {/* Menu semanal (CP4). key = firma del menu guardado (remonte, como las demas secciones). */}
        <MenuSemanalSection
          key={sectionKey("menu-semanal", menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: protocol.menuSemanal }))}
          protocol={protocol}
          activosEnVivo={activosEnVivo}
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
          protocol={protocol}
          adaptar={(sinGuardar) => (
            <AdaptarMenuBoton
              evaluationId={evaluationId}
              protocol={protocol}
              patronAlimentario={patronAlimentario}
              sinGuardar={sinGuardar}
            />
          )}
        />
        <MenuSection evaluationId={evaluationId} protocol={protocol} />
        <NotesSection protocol={protocol} />
        {/* MIENTRAS NO SE HA ENTREGADO NADA, SE DICE. Es informacion y no un mando: no hay boton que
            pulsar, porque emitir ocurre al imprimir el plan o al enviar el reporte, que son actos que el
            profesional hace de todos modos. Sin esta linea, una prescripcion que nadie ha entregado se
            lee igual que una entregada. */}
        {protocol.emisiones.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            Todavía no le has entregado este plan al paciente. Queda registrado cuando lo imprimes desde{" "}
            <span className="font-medium text-foreground">Reporte / HC</span> o cuando le envías el
            reporte. Puedes seguir ajustándolo antes y después.
          </p>
        ) : null}
      </CardContent>
    </Card>

    {/* ═══ EL AVISO PEGAJOSO Y EL UNICO BOTON ═══

        VA FUERA DE LA TARJETA Y FIJO ABAJO, y es lo que hace SEGURO haber quitado los siete botones: con
        un guardado por bloque, lo escrito ya estaba en la base y no se podia perder; con uno solo al
        final, lo unico que impide perderlo es que se vea SIEMPRE, sin importar por donde vaya el scroll.

        SOLO APARECE CUANDO HAY ALGO QUE GUARDAR. Una barra permanente con un boton que casi nunca hace
        nada se lee como parte del marco y deja de mirarse, que es como se pierde un aviso.

        Y DICE QUE SECCIONES CAMBIARON, no "hay cambios": en una pantalla de este tamaño, saber que algo
        cambio sin saber que obliga a recorrerla entera para encontrarlo. */}
    {haySinGuardar ? (
      <form
        onSubmit={enviarSinReset(guardar)}
        className="sticky bottom-0 z-20 -mx-1 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-attention/40 bg-attention-bg px-4 py-3 shadow-lg"
      >
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <input type="hidden" name="protocolo" value={cuerpo()} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-attention">
            {sucias.length === 1
              ? "Tienes un cambio sin guardar."
              : `Tienes ${sucias.length} secciones con cambios sin guardar.`}
          </span>
          <span className="text-xs text-foreground/90">
            {sucias.map((s) => ROTULO_SECCION[s]).join(", ")}.
          </span>
        </div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    ) : null}
    </BorradorContexto.Provider>
  );
}


// TODA LA VERTICAL DE APROBAR SE RETIRO (2026-09-09): el boton, la accion, el servicio, el writer y las
// dos ramas del trigger 0026 (ver la migracion 0116).
//
// SU HISTORIA, EN DOS PASOS, porque explica por que el disenio actual no es un descuido:
//   1. El 2026-09-01 un barrido encontro que la vertical estaba construida entera y NINGUNA PANTALLA
//      invocaba la accion: todo plan que le llegaba a un paciente salia de una prescripcion en borrador.
//      Se cableo el boton.
//   2. El 2026-09-09, con el boton ya en pantalla, Santiago reporto que el acto CONFUNDE. Y el hallazgo
//      que decidio: el plan impreso, el del correo y la historia clinica se arman los tres del protocolo
//      VIVO, asi que la aprobacion no los protegia por diseño sino por efecto lateral (congelaba los
//      `adj_*`).
//
// LO QUE SUSTITUYE A LAS DOS COSAS QUE HACIA. Sellar lo hace la EMISION, que guarda una copia inmutable de
// lo que salio; cerrar no lo hace nadie, porque no hacia falta. Las dos vias de emision son actos que el
// profesional hace de todos modos: imprimir el plan y enviar el reporte.

// Etiqueta y color del estado de una sugerencia de IA (accesible: etiqueta ademas de color).
const MENU_STATUS: Record<string, { label: string; cls: string }> = {
  success: { label: "Generado", cls: "bg-clinical-optimal-bg text-clinical-optimal" },
  timeout: { label: "Timeout", cls: "bg-clinical-warning-bg text-clinical-warning" },
  provider_error: { label: "Error del proveedor", cls: "bg-clinical-critical-bg text-clinical-critical" },
  parse_failed: { label: "Respuesta inválida", cls: "bg-clinical-critical-bg text-clinical-critical" },
};

// EL BOTON DE ADAPTAR, extraido de `MenuSection` para que viva JUNTO A LAS RESTRICCIONES (cotejo
// 2026-09-05, punto 25). La accion es sobre lo que el profesional acaba de escribir, asi que ahi
// pertenece; las PROPUESTAS se quedan abajo, al lado de la grilla que modifican.
function AdaptarMenuBoton({
  evaluationId,
  protocol,
  patronAlimentario,
  sinGuardar,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  patronAlimentario: string[];
  /** Hay restricciones escritas y todavia no guardadas. */
  sinGuardar: boolean;
}) {
  const [state, formAction, pending] = useActionState(generateMenuAction, EMPTY);
  // AndRefresh, no useFormToast a secas: la accion ya no revalida (el revalidatePath era el que arrastraba
  // la pagina al inicio al pulsar "Adaptar a las restricciones", reportado en el smoke del 2026-08-31).
  // El refresco lo dispara el hook DESPUES del aviso, para que la propuesta aparezca sin mover el scroll.
  useFormToastAndRefresh(state);

  // El menu se genera contra el objetivo de la CADENA CALORICA (fuente unica). Basta con que el protocolo
  // este calculado (snapshot sellado); sin el no hay cadena que computar.
  const cadenaLista = protocol.protocolSuggested != null;
  // SIN RESTRICCIONES LA IA NO ENTRA (su 13, "solo lo adapta CUANDO HAY RESTRICCIONES"). El servicio ya lo
  // corta, pero la pantalla tiene que DECIRLO: un boton que se puede pulsar y no hace nada se lee como que
  // el sistema esta roto. Las tres fuentes son las mismas que viajan en el prompt.
  const hayRestricciones =
    (protocol.protocolSuggested?.restricciones?.length ?? 0) > 0 ||
    protocol.restricciones.length > 0 ||
    patronAlimentario.length > 0;
  const disabled = pending || !cadenaLista || !hayRestricciones || sinGuardar;

  return (
    <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <div>
        <Button type="submit" variant="outline" disabled={disabled}>
          <Sparkles className="size-4" aria-hidden />
          {pending ? "Adaptando..." : "Adaptar el menú a estas restricciones con IA"}
        </Button>
      </div>
      {/* EL HAZARD QUE ABRE ACERCAR EL BOTON, cerrado aqui mismo: `generateMenuAction` lee las
          restricciones de la BASE, no de este formulario. Escribir una y pulsar adaptar produciria una
          adaptacion que IGNORA lo recien escrito, sin decirlo. A media pantalla la distancia hacia de
          guarda; pegado al campo, hace falta decirlo. */}
      {sinGuardar ? (
        <p className="max-w-prose text-xs text-attention">
          Guarda las restricciones primero: la IA lee las guardadas, no lo que está escrito en el campo.
        </p>
      ) : !cadenaLista ? (
        <p className="text-xs text-muted-foreground">
          El protocolo aún no está calculado; no se puede adaptar el menú.
        </p>
      ) : !hayRestricciones ? (
        <p className="max-w-prose text-xs text-muted-foreground">
          Este paciente no tiene restricciones registradas (ni del modelo, ni tuyas, ni patrón
          alimentario declarado), así que no hay nada que adaptar: el menú del ciclo es el que aplica.
        </p>
      ) : (
        <p className="max-w-prose text-xs text-muted-foreground">
          Revisa la semana de arriba y propone sustituir solo lo que incumple una restricción. Las
          propuestas salen más abajo y las aceptas una por una.
        </p>
      )}
    </form>
  );
}

function MenuSection({
  evaluationId,
  protocol,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
}) {
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
      {/* EL BOTON SUBIO AL BLOQUE DE RESTRICCIONES (cotejo punto 25); aqui queda lo DERIVADO: la
          explicacion de que hace la IA y sus propuestas, que es lo que se lee al lado de la grilla que
          modifican. El titulo lo dice: esto ya no es la accion, son sus resultados. */}
      <h3 className={tituloBloqueCls("derivado")}>Propuestas de la IA para el menú</h3>
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
        responde, la grilla se queda con el ciclo. El botón para pedirlas está arriba, junto a tus
        restricciones.
      </p>

      {protocol.menuSuggestions.length ? (
        <ul className="flex flex-col gap-3">
          {protocol.menuSuggestions.map((m) => (
            <MenuCard
              key={m.id}
              suggestion={m}
              evaluationId={evaluationId}
              aplicados={aplicados}
            />
          ))}
        </ul>
      ) : (
        <p className="max-w-prose text-sm italic text-muted-foreground">
          Todavía no has pedido ninguna adaptación.
        </p>
      )}
    </div>
  );
}

function MenuCard({
  suggestion: m,
  evaluationId,
  aplicados,
}: {
  suggestion: MenuSuggestion;
  evaluationId: string;
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
                  yaEsta={aplicados.has(`${c.dia}_${c.tiempo}`)}
                />
              ))}
            </ul>
            <AplicarTodasMenu
              evaluationId={evaluationId}
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

// LO QUE YA SE LE ENTREGO AL PACIENTE (2026-09-09).
//
// SUSTITUYE A `ProtocoloAprobado`, que era el bloque de "esta prescripcion esta congelada, reabrela con un
// motivo". Ese bloque existia porque aprobar CERRABA; ahora emitir solo REGISTRA y no hay nada que
// reabrir, asi que el bloque deja de ser un mando y pasa a ser informacion.
//
// LO QUE SI SE CONSERVA, Y ES LO QUE IMPORTA CLINICAMENTE: el aviso de §12c. Si el paciente ya tiene una
// version en la mano y el profesional cambia lo que come, hay que decirselo, y el sistema no lo hace
// solo. Ese requisito no dependia del candado; dependia de que alguien hubiera recibido algo, que es
// justo lo que esta lista dice.
// ═══ Y CADA ENTREGA SE DISTINGUE DE LA ANTERIOR (Santiago, 2026-09-10) ═══
//
// EL DEFECTO: dos impresiones el mismo dia salian como dos lineas identicas. El registro existe para saber
// QUE recibio el paciente, y dos entradas iguales no contestan eso.
//
// LAS TRES COSAS QUE LO ARREGLAN, y las tres salen de lo que YA se guarda (la copia completa vive en
// `prescription_emissions.prescripcion`, con su cadena efectiva en columnas):
//   · LA HORA. Dos del mismo dia se distinguen por ella, y solo salia la fecha.
//   · LAS CIFRAS de esa salida. Es lo que de verdad diferencia una entrega de otra.
//   · CUAL ES LA VIGENTE. La ultima es la que el paciente tiene en la mano; sin marcarla, la lista es un
//     historial sin presente.
//
// NO SE AFIRMA QUE DOS SEAN IGUALES aunque coincidan las dos cifras: el menu, las restricciones o el
// reparto pudieron cambiar sin mover el objetivo calorico. Se muestran los datos y el profesional lee; una
// etiqueta de "sin cambios" seria una conclusion que estas dos columnas no sostienen.
function EntregasRegistradas({
  emisiones,
}: {
  emisiones: { fecha: string; via: string; kcal: number | null; proteina: number | null }[];
}) {
  if (emisiones.length === 0) return null;
  const cifras = (e: { kcal: number | null; proteina: number | null }) =>
    [e.kcal != null ? `${e.kcal} kcal` : null, e.proteina != null ? `${e.proteina} g de proteína` : null]
      .filter(Boolean)
      .join(" · ");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-attention/40 bg-attention-bg px-3 py-3 text-sm">
      <p className="font-medium text-attention">
        {emisiones.length === 1
          ? "El paciente ya tiene este plan."
          : `El paciente ya recibió este plan ${emisiones.length} veces.`}
      </p>
      <ul className="flex flex-col gap-1 text-foreground/90">
        {/* LA LISTA LLEGA DE LA MAS RECIENTE A LA MAS ANTIGUA (el lector ordena `emitted_at desc`), asi que
            la vigente es la primera. Se marca por POSICION y no por fecha: dos del mismo minuto no se
            podrian desempatar comparando cadenas. */}
        {emisiones.map((e, i) => (
          <li key={e.fecha + e.via} className="flex flex-wrap items-baseline gap-x-2">
            <span className="tabular-nums">{formatDateTime(e.fecha)}</span>
            <span>· {etiquetaDeVia(e.via)}</span>
            {cifras(e) ? <span className="tabular-nums text-muted-foreground">· {cifras(e)}</span> : null}
            {i === 0 ? (
              <span className="rounded-full border border-attention/50 px-2 py-0.5 text-xs font-medium text-attention">
                la que tiene ahora
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {/* NO PROMETE UN AVISO QUE EL SISTEMA NO MANDA. Emitir registra la salida y nada mas; al paciente
          se le dice enviandole el reporte o entregandole la hoja otra vez, que son actos del profesional.
          Un texto que diga que el sistema avisa por el hace que NO avise. */}
      <p className="text-foreground/90">
        Puedes seguir ajustando la prescripción. Si la cambias, vuelve a entregársela: cambia lo que come
        y el sistema no se lo avisa solo.
      </p>
    </div>
  );
}

// Rótulo de cada profesión, y el de las notas SIN profesión: son las anteriores a la separación del §8,
// cuando el campo era uno solo y compartido. No se les inventa un rol: decirlo es más honesto que
// repartirlas por lo que parezca.

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
  yaEsta,
}: {
  cambio: CambioPropuestoView;
  evaluationId: string;
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
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
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
  pendientes,
}: {
  evaluationId: string;
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
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Aplicando..." : `Aplicar las ${pendientes.length} a la grilla`}
      </Button>
    </form>
  );
}

// Restricciones alimentarias (checkpoint 2.4): seccion propia, JUNTO al menu (son su insumo). Guardado
// propio con firma de remonte, y desde el 2026-09-09 se guarda con el resto del protocolo.
//
// EL BOTON DE ADAPTAR VIVE AQUI (cotejo 2026-09-05, punto 25). Santiago: "un boton al lado que diga
// adaptar las restricciones al menu con ayuda de IA". Tiene razon en que la accion pertenece a este
// bloque: se actua SOBRE las restricciones que se acaban de escribir.
//
// LO QUE NO SE FUNDE, Y POR QUE: la LISTA de propuestas se queda abajo, en su bloque `derivado`. Este
// bloque es `decision` (lo que el profesional escribe) y aquel es `derivado` (lo que el sistema
// produce), y son los dos niveles con los que toda la app dice quien decidio que. Meterlos en una caja
// haria que esa caja significara las dos cosas, que es justo lo que los niveles vinieron a evitar. Se
// une la ACCION con su insumo; se deja el RESULTADO donde se lee al lado de la grilla que modifica.
//
// Y ACERCAR EL BOTON ABRE UN HAZARD QUE HAY QUE CERRAR AQUI MISMO: `generateMenuAction` lee las
// restricciones de la BASE, no del formulario. Con el boton a media pantalla, la distancia hacia de
// guarda; pegado al campo, escribir "sin lactosa" y pulsar adaptar produciria una adaptacion que IGNORA
// lo recien escrito, sin decirlo. Es la familia de "dos partes de la pantalla que leen fuentes
// distintas". Por eso el boton se apaga mientras haya cambios sin guardar, y dice por que.
function RestriccionesSection({
  protocol,
  adaptar,
}: {
  protocol: TreatmentProtocol;
  /** El boton de adaptar el menu, que se renderiza junto al de guardar. Recibe si hay cambios sin guardar. */
  adaptar: (sinGuardar: boolean) => ReactNode;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();
  const [restricciones, setRestricciones] = useState<string[]>(protocol.restricciones);
  const [restrInput, setRestrInput] = useState("");
  const addRestriccion = () => {
    const v = restrInput.trim();
    if (v && !restricciones.includes(v)) setRestricciones([...restricciones, v]);
    setRestrInput("");
  };
  usePublicar(
    "restricciones",
    restricciones,
    restriccionesSignature({ treatmentId: protocol.treatmentId, restricciones }),
    // Sin tocar, la lista es la guardada.
    restriccionesSignature({
      treatmentId: protocol.treatmentId,
      restricciones: protocol.restricciones,
    }),
  );
  // Lo que hay en pantalla frente a lo que hay en la base. El orden cuenta como cambio a proposito: es
  // barato y ser conservador aqui solo cuesta un guardado de mas.
  const sinGuardar =
    JSON.stringify(restricciones) !== JSON.stringify(protocol.restricciones) || restrInput.trim() !== "";

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
      <div className="flex flex-col gap-2">
        <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-2">
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
        </fieldset>
      </div>
      {/* HERMANO, NO ANIDADO: adaptar el menu sigue siendo su propia accion con su propio formulario, y un
          formulario dentro de otro es HTML invalido. */}
      {adaptar(sinGuardar)}
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
  protocol,
  prescripcion,
  kcalObjetivo,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  prescripcion: PrescripcionNutricional | null;
  /** El objetivo EFECTIVO de la cadena (el que el profesional ve abajo), para que el título no diga otro. */
  kcalObjetivo: number | null;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();
  const [objetivo, setObjetivo] = useState(protocol.objetivoTexto ?? "");
  // VACIO ES null, no cadena vacia: es lo que distingue "no escribio objetivo" de "escribio y lo borro",
  // y la firma del servidor se calcula sobre null. Sin esto, abrir el panel con el campo vacio marcaria la
  // seccion como cambiada sin que nadie la tocara.
  const objetivoValor = objetivo.trim() === "" ? null : objetivo;
  usePublicar(
    "objetivo",
    objetivoValor,
    objetivoSignature({ treatmentId: protocol.treatmentId, objetivo: objetivoValor }),
    // Sin tocar, el textarea trae lo guardado (y el vacio ya se normaliza a null arriba).
    objetivoSignature({ treatmentId: protocol.treatmentId, objetivo: protocol.objetivoTexto }),
  );

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
      <div className="flex flex-col gap-2">
        <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-2">
          <Textarea
            name="objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="ej. Dieta antiinflamatoria con proteína alta por sexo, para desacelerar el envejecimiento biológico."
            rows={3}
            maxLength={4000}
          />
        </fieldset>
      </div>

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
  protocol,
}: {
  protocol: TreatmentProtocol;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();

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
  //
  const [porciones, setPorciones] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const a of defaults) init[a.sub] = saved?.porciones[a.sub] ?? a.porciones;
    return init;
  });

  // ═══ Y SE RE-DERIVAN SI EL OBJETIVO SE MUEVE Y NADIE LAS TOCO (2026-09-10) ═══
  //
  // EL DEFECTO, del smoke: guardar la cadena calorica y que el aviso volviera a salir diciendo que la
  // lista de intercambio tiene cambios sin guardar. La causa es que la `key` de esta seccion depende del
  // intercambio GUARDADO, y al cambiar solo la cadena ese no cambia: la seccion NO se remonta y su estado
  // se queda con las porciones derivadas del objetivo ANTERIOR, mientras `defaults` ya se recalculo con el
  // nuevo. Lo de pantalla dejaba de coincidir con lo que la seccion presentaria sin tocarla.
  //
  // Y NO ERA SOLO UN AVISO FALSO: la tabla mostraba porciones calculadas para un objetivo que ya no es.
  // Eso ya pasaba antes de unificar los guardados; lo que hizo el aviso fue destaparlo.
  //
  // POR QUE "Y NADIE LAS TOCO": re-derivar siempre borraria el ajuste manual del profesional, que es justo
  // lo que el aviso de desfase (DIV-11) existe para NO hacer. Si las porciones en pantalla son las que
  // salian del objetivo anterior, no hay nada que perder y se siguen al nuevo; si las movio, se conservan
  // y manda el desfase, con su boton de redistribuir.
  // EL OBJETIVO CON EL QUE SE SEMBRARON, en ESTADO y no en un ref: se lee durante el render (para decidir
  // si hay que re-derivar) y React prohibe leer un ref ahi. Es el patron documentado de "ajustar el estado
  // cuando cambia una prop": re-rinde antes de pintar, sin el ciclo extra de un efecto.
  const [objetivoSembrado, setObjetivoSembrado] = useState(objetivoEfectivo);
  if (objetivoSembrado !== objetivoEfectivo) {
    const anteriores = objetivoSembrado != null ? computeIntercambio(objetivoSembrado) : [];
    const sinTocar =
      anteriores.length > 0 && anteriores.every((a) => (porciones[a.sub] ?? 0) === a.porciones);
    setObjetivoSembrado(objetivoEfectivo);
    // SOLO SI NO HAY NADA GUARDADO, y el limite importa: con una lista guardada, seguir al objetivo
    // volveria MENTIROSO el aviso de desfase de aqui abajo ("estas porciones se calcularon para X kcal,
    // pero el objetivo ahora es Y"), que es justo el mecanismo que su DIV-11 diseño para este caso, con su
    // boton de redistribuir. Sin nada guardado no hay decision que conservar ni desfase que avisar.
    if (saved == null && sinTocar) {
      setPorciones(Object.fromEntries(defaults.map((a) => [a.sub, a.porciones])));
    }
  }

  // LO QUE HAY EN PANTALLA, HACIA ARRIBA. Va ANTES de la guarda porque publicar es un HOOK y un hook no
  // puede quedar detras de un `return` temprano; con el objetivo en null la seccion no se rinde y no
  // aporta nada al borrador (firma nula).
  const borradorIntercambio: IntercambioSaved | null =
    objetivoEfectivo != null
      ? {
          // Las porciones POR ALIMENTO en pantalla + el objetivo con el que se calcularon (objetivoBase,
          // DIV-11). Se serializan los 21 alimentos: contexto completo del desfase.
          objetivoBase: objetivoEfectivo,
          porciones: Object.fromEntries(defaults.map((a) => [a.sub, porciones[a.sub] ?? 0])),
        }
      : null;
  // LO QUE ESTA SECCION PRESENTA SIN TOCARLA: las porciones GUARDADAS si las hay, y si no las calculadas
  // desde el objetivo. Es la misma derivacion con la que se inicializa el estado, y por eso no puede
  // divergir de ella. Comparar contra el `null` de la base marcaba la seccion como cambiada al montar.
  const intercambioSinTocar: IntercambioSaved | null =
    objetivoEfectivo != null
      ? {
          objetivoBase: objetivoEfectivo,
          porciones: Object.fromEntries(
            defaults.map((a) => [a.sub, saved?.porciones[a.sub] ?? a.porciones]),
          ),
        }
      : null;
  usePublicar(
    "intercambio",
    borradorIntercambio,
    borradorIntercambio
      ? intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: borradorIntercambio })
      : null,
    intercambioSinTocar
      ? intercambioSignature({ treatmentId: protocol.treatmentId, intercambio: intercambioSinTocar })
      : null,
  );

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
  // EL TOTAL DE PORCIONES, que faltaba (cotejo 2026-09-05, punto 24). Su tabla lo trae y es el numero
  // que dice de un vistazo el TAMAÑO del plan: 30 porciones repartidas. Sin el, la columna que el
  // profesional edita es la unica sin suma.
  const totalPorciones = defaults.reduce((s, a) => s + (porciones[a.sub] ?? 0), 0);
  const setP = (sub: string, v: number) => setPorciones((p) => ({ ...p, [sub]: Math.max(0, v) }));
  // Hay algo que perder si alguna porcion en pantalla difiere de la que calcula el objetivo actual. Se
  // compara contra los DEFAULTS vivos y no contra lo guardado: si el objetivo cambio, lo guardado tambien
  // es "ajuste" frente a lo que el recalculo va a poner.
  const hayAjustesIntercambio = defaults.some((a) => (porciones[a.sub] ?? 0) !== a.porciones);

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

      <div className="flex flex-col gap-3">
        <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-3">
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
            <table className={`${tabla} min-w-[38rem]`}>
              <thead>
                <tr className={theadTr}>
                  {/* "Grupo / subgrupo", no "Alimento": las filas SON subgrupos (Cereales, Leche entera)
                      y los alimentos estan en la ultima columna. Y no es cosmetico: esta columna define
                      que significa la casilla de Porciones, que Gildardo dejo en el SUBGRUPO el 27. Con
                      "Alimento" la pantalla contradecia esa decision. Rotulos cortos como los suyos: en
                      una tabla que no cabe, el ancho del encabezado fuerza el de la columna. */}
                  <th className={th}>Grupo / subgrupo</th>
                  <th className={thNum}>kcal/porc</th>
                  <th className={thNum}>Porciones</th>
                  <th className={thNum}>kcal</th>
                  <th className={thNum}>Prot</th>
                  <th className={thNum}>CHO</th>
                  <th className={thNum}>Grasa</th>
                  <th className={th}>Alimentos del grupo</th>
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
                      <tr key={`g-${a.gr}`} className={trGrupo}>
                        <td colSpan={8} className={tdGrupo}>
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
                    <tr key={a.sub} className={tr}>
                      <td className={tdFuerte}>{a.sub}</td>
                      <td className={tdApagadoNum}>{a.kcal}</td>
                      <td className={tdNum}>
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
                      <td className={tdNum}>
                        {Math.round(n * a.kcal)}
                      </td>
                      <td className={tdApagadoNum}>
                        {(n * a.prot).toFixed(1)}
                      </td>
                      <td className={tdApagadoNum}>
                        {(n * a.cho).toFixed(1)}
                      </td>
                      <td className={tdApagadoNum}>
                        {(n * a.gras).toFixed(1)}
                      </td>
                      {/* Alimentos concretos, PLEGADOS (porte fiel del v8). El plegado no es decoracion: el
                          primer subgrupo tiene 39 alimentos y desplegados romperian la tabla. Es referencia,
                          NO edita el calculo: el intercambio se cuenta por PORCIONES del subgrupo, y que
                          alimento se elija dentro del subgrupo es del paciente. */}
                      <td className={td}>
                        <AlimentosDelSubgrupo sub={a.sub} />
                      </td>
                    </tr>,
                  );
                  return filas;
                })}
                <tr className="border-t-2 border-border font-semibold text-foreground">
                  <td className="py-2" colSpan={2}>
                    Total
                  </td>
                  {/* LA COLUMNA QUE SE EDITA TAMBIEN SUMA (punto 24). Iba dentro del colSpan, o sea que la
                      unica columna sin total era justo la que el profesional toca. */}
                  <td className="py-2 pr-3 text-right tabular-nums">{totalPorciones}</td>
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
                  {/* SIN DECIMALES EN LA FILA DE TOTALES, como su tabla (punto 24). Las FILAS conservan
                      su decimal, que es donde el reparto de un alimento se aprecia; el total es una cifra
                      de conjunto y el decimal ahi solo suma ruido a una suma de veinte terminos. */}
                  <td className="py-2 pr-3 text-right tabular-nums">{Math.round(totalProt)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Math.round(totalCho)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Math.round(totalGras)}</td>
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
            {/* LA ETIQUETA DICE QUE PASA, no de donde sale la cuenta (cotejo 2026-09-05, punto 18). Su
                boton se llama "Distribuir porciones"; el nuestro decia "Recalcular desde el objetivo",
                que describe el MECANISMO. Se conserva el "desde el objetivo" porque distingue este boton
                del de la distribucion por tiempos, que tambien recalcula y desde otra cosa. */}
            <BotonRecalcular
              etiqueta="Distribuir porciones desde el objetivo"
              hayAjustes={hayAjustesIntercambio}
              disabled={guardando}
              onRecalcular={() =>
                setPorciones(Object.fromEntries(defaults.map((a) => [a.sub, a.porciones])))
              }
            />
          </div>
        </fieldset>
      </div>
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
  protocol,
  activosEnVivo,
}: {
  protocol: TreatmentProtocol;
  /** Los tiempos activos QUE HAY EN PANTALLA: las columnas de esta grilla se mueven al marcarlos. */
  activosEnVivo: Record<string, boolean> | null;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();

  const saved = protocol.menuSemanal;
  const [diaInicio, setDiaInicio] = useState<number>(() => saved?.diaInicio ?? diaInicioDerivado(protocol.treatmentId));
  const [celdas, setCeldas] = useState<Record<string, string>>(() => saved?.celdas ?? {});

  // Los tiempos ACTIVOS son los QUE HAY EN PANTALLA, los mismos que consume la tabla de distribucion: el
  // plan es uno solo, y desde el 2026-09-09 las dos superficies siguen la casilla en vivo.
  const activos = activosEnVivo ?? TIEMPOS_ACTIVOS_DEFAULT;
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
  // SIN TOCAR: el menu guardado si lo hay, y si no el dia de arranque DERIVADO con las celdas vacias (lo
  // que el ciclo propone no se guarda: solo se guarda lo que difiere de la precarga).
  const menuSinTocar = {
    diaInicio: saved?.diaInicio ?? diaInicioDerivado(protocol.treatmentId),
    celdas: saved?.celdas ?? {},
  };
  usePublicar(
    "menuSemanal",
    payload,
    menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: payload }),
    menuSemanalSignature({ treatmentId: protocol.treatmentId, menu: menuSinTocar }),
  );
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
      <div className="flex flex-col gap-3">
        <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 overflow-x-auto">
            {/* Ancho minimo por la misma razon que la tabla de intercambio: sin el, en pantalla estrecha las columnas se aprietan y los numeros se parten, y el desplazamiento lateral nunca se activa. */}
            <table className={`${tabla} min-w-[42rem]`}>
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Día</th>
                  {vivos.map((t) => (
                    <th key={t.id} className={th}>
                      {t.n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS_SEMANA.map((nombre, dia) => (
                  <tr key={nombre} className={`${tr} align-top`}>
                    <td className={tdFuerte}>{nombre}</td>
                    {vivos.map((t) => (
                      <td key={t.id} className={td}>
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
            <Button
              type="button"
              variant="ghost"
              disabled={guardando}
              onClick={() => {
                // Azar en una ACCION del profesional: el resultado se guarda, asi que deja de ser azaroso.
                // Se avanza a un dia DISTINTO del actual para que el boton siempre haga algo visible.
                setDiaInicio((d) => (d + 1 + Math.floor(Math.random() * (DIAS_DEL_CICLO - 1))) % DIAS_DEL_CICLO);
              }}
            >
              Proponer otra semana
            </Button>
            {hayEdiciones ? (
              <Button type="button" variant="ghost" disabled={guardando} onClick={() => setCeldas({})}>
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
      </div>
    </section>
  );
}

// TIEMPOS DE COMIDA (CP2.3): seccion propia, columna propia, guardado propio. Se partio de la distribucion
// el 2026-08-23 con el argumento de Santiago: el MENU tambien depende de estas casillas y esta en su propio
// contenedor, asi que la dependencia no justificaba agruparlas con la tabla; lo que las unia era nuestro
// jsonb, no el modelo. Y en el prototipo de Gildardo ya viven aparte (`atlas:plan`, junto al menu semanal;
// la distribucion vive en `atlas:plan_inter`), asi que partirlas es MAS fiel, no menos.
//
// REACCIONAN EN VIVO desde el 2026-09-09 (Santiago). Esta linea decia lo contrario: "no reaccionan en
// vivo... con reaccion en vivo, tantear marcando reconstruiria las dos en cada clic". El precio de esa
// decision era un boton de "aplicar" que era un guardado disfrazado, y un aviso que explicaba por que las
// dos tablas de abajo mostraban lo anterior mientras tanto.
function TiemposActivosSection({
  protocol,
}: {
  protocol: TreatmentProtocol;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();

  const guardados = protocol.tiemposActivos ?? TIEMPOS_ACTIVOS_DEFAULT;
  const [activos, setActivos] = useState<Record<string, boolean>>(() => guardados);
  usePublicar(
    "tiemposActivos",
    activos,
    tiemposActivosSignature({ treatmentId: protocol.treatmentId, activos }),
    // SIN TOCAR: los guardados, y si nunca se guardaron, el juego por defecto. Es con lo que se inicializa
    // el estado (`guardados`), asi que las casillas recien pintadas nunca cuentan como un cambio.
    tiemposActivosSignature({ treatmentId: protocol.treatmentId, activos: guardados }),
  );

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
        de los tiempos que dejes activos, y el menú semanal usa esos mismos tiempos como columnas. Al
        marcarlas, las dos se mueven al instante.
      </p>
      {/* EL PARRAFO DECIA LO CONTRARIO hasta el 2026-09-09 ("por eso se aplican con un paso propio y no
          cambian mientras marcas"), y era cierto: las dos tablas leian lo GUARDADO. Al pasar a leer lo que
          hay en pantalla, esa frase habria quedado describiendo un comportamiento retirado, que es la
          familia de texto que llevamos toda la semana barriendo. */}
      <div className="flex flex-col gap-3">
        <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            {TIEMPOS_DEF.map((t) => (
              <label key={t.id} className="flex items-center gap-1.5 text-sm text-foreground">
                <input type="checkbox" checked={Boolean(activos[t.id])} onChange={() => toggle(t.id)} />
                {t.n}
              </label>
            ))}
          </div>
          {/* SE RETIRO "APLICAR TIEMPOS DE COMIDA" Y SU AVISO (2026-09-09), y las dos cosas por la misma
              razon. El boton era un guardado disfrazado de otra cosa, y el aviso ("cambiaste los tiempos y
              aun no los has aplicado: la distribucion y el menu siguen mostrando los anteriores") existia
              porque las dos tablas de abajo leian lo GUARDADO. Ahora leen lo que hay en pantalla, asi que
              marcar una casilla las mueve al instante y no hay nada que aplicar.

              Es exactamente lo que pidio Santiago: que cada cambio se vea en vivo. El aviso era la prueba
              de que el flujo estaba al reves. */}
        </fieldset>
      </div>
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
  protocol,
  activosEnVivo,
  intercambioEnVivo,
}: {
  protocol: TreatmentProtocol;
  /**
   * Los tiempos activos QUE HAY EN PANTALLA, no los guardados (2026-09-09).
   *
   * ES LA MITAD DE LO QUE PIDIO SANTIAGO: que cada cambio se vea en vivo. Hasta hoy esta tabla leia
   * `protocol.tiemposActivos` (lo guardado), asi que marcar una casilla arriba no movia nada hasta
   * "aplicar", y habia un aviso explicando que las dos tablas seguian mostrando lo anterior. Ese aviso era
   * la prueba de que el flujo estaba al reves.
   */
  activosEnVivo: Record<string, boolean> | null;
  /** Las porciones QUE HAY EN PANTALLA en la lista de intercambio, por la misma razon. */
  intercambioEnVivo: IntercambioSaved | null;
}) {
  // SIN GUARDADO PROPIO (2026-09-09): esta seccion PUBLICA su borrador y lo guarda el boton unico del pie
  // del panel. Ver la nota de `BorradorContexto`.
  const { guardando } = useBorrador();

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
  const savedInter = intercambioEnVivo;
  const savedTiempos = protocol.tiempos;

  // Porciones actuales POR ALIMENTO (del intercambio guardado o el default) + kcal por porcion de cada alimento.
  const porcionesActuales: Record<string, number> = {};
  const kcalPorPorcion: Record<string, number> = {};
  for (const a of defaults) {
    porcionesActuales[a.sub] = savedInter?.porciones[a.sub] ?? a.porciones;
    kcalPorPorcion[a.sub] = a.kcal;
  }

  const [celdas, setCeldas] = useState<Record<string, Record<string, number>>>(() => savedTiempos?.celdas ?? {});

  // LO QUE HAY EN PANTALLA, HACIA ARRIBA. Va ANTES de la guarda porque publicar es un hook, y un hook no
  // puede quedar detras de un `return` temprano. Se conservan TODOS los overrides, incluidos los de
  // comidas apagadas: no se muestran, pero apagar una comida suele ser exploratorio y borrarlos
  // convertiria un tanteo en una perdida.
  const borradorTiempos: TiemposSaved | null =
    objetivoEfectivo != null
      ? { celdas, base: { porciones: porcionesActuales, activos: activosEnVivo ?? TIEMPOS_ACTIVOS_DEFAULT } }
      : null;
  const tiemposSinTocar: TiemposSaved | null =
    objetivoEfectivo != null
      ? {
          celdas: savedTiempos?.celdas ?? {},
          base: { porciones: porcionesActuales, activos: activosEnVivo ?? TIEMPOS_ACTIVOS_DEFAULT },
        }
      : null;
  usePublicar(
    "tiempos",
    borradorTiempos,
    borradorTiempos ? tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: borradorTiempos }) : null,
    tiemposSinTocar
      ? tiemposSignature({ treatmentId: protocol.treatmentId, tiempos: tiemposSinTocar })
      : null,
  );

  if (!snap || objetivoEfectivo == null) return null;

  // LAS DOS TABLAS (esta y el menu semanal) LEEN LOS TIEMPOS EN VIVO desde el 2026-09-09.
  //
  // ESTE COMENTARIO DECIA LO CONTRARIO, y la razon que daba se cayo sola. Decia: "los tiempos activos son
  // una decision CLINICA, no un ajuste visual: se toman una vez y se aplican con un boton; con reaccion en
  // vivo, tantear marcando y desmarcando reconstruiria la tabla y el menu en cada clic, lo que distrae en
  // vez de ayudar. Y asi las dos superficies cuentan lo mismo SIN compartir estado entre secciones
  // hermanas, que habria exigido subir el estado al panel".
  //
  // Santiago lo pidio al reves y tiene razon: el precio de no compartir estado era un boton de "aplicar"
  // que es un guardado disfrazado, y un aviso que explicaba por que las tablas mentian mientras tanto.
  // Ahora el estado SI sube al panel (por publicacion, sin reescribir las secciones) y las dos tablas se
  // mueven al marcar. Y lo que se temia, que reconstruir en cada clic distraiga, resulto ser justo lo que
  // se queria ver: cual es el efecto de apagar una comida.
  const activosGuardados = activosEnVivo ?? TIEMPOS_ACTIVOS_DEFAULT;

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

      <div className="flex flex-col gap-3">
        <fieldset disabled={guardando} className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 overflow-x-auto">
            {/* Ancho minimo por la misma razon que la tabla de intercambio: sin el, en pantalla estrecha las columnas se aprietan y los numeros se parten, y el desplazamiento lateral nunca se activa. */}
            <table className={`${tabla} min-w-[38rem]`}>
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className={th}>Alimento</th>
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
                        <td colSpan={vivos.length + 2} className={tdGrupo}>
                          {a.grNom}
                        </td>
                      </tr>,
                    );
                  }
                  const cuadre = reparto(a.sub);
                  const cuadra = cuadre.suma === cuadre.obj;
                  filas.push(
                    <tr key={a.sub} className={tr}>
                      <td className={tdFuerte}>{a.sub}</td>
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
                  <td className={tdFuerte}>Total kcal</td>
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
            {/* Igual que el de arriba (punto 18): su boton se llama "Sugerir distribución". "Recalcular
                desde el intercambio" no dice que lo que se rellena es la rejilla de tiempos de comida. */}
            <BotonRecalcular
              etiqueta="Sugerir la distribución desde el intercambio"
              hayAjustes={Object.keys(celdas).length > 0}
              disabled={guardando}
              onRecalcular={() => setCeldas({})}
            />
          </div>
        </fieldset>
      </div>
    </section>
  );
}

// Validacion nutricional (CP3.2): tabla de 16 nutrientes (obtenido/requerido/% cubrimiento/ICN) DERIVADA en
// vivo del intercambio (CP1) + los macros de la cadena + sexo/edad. Solo lectura: NO se guarda, NO se edita,
// asi que no puede desfasarse (se recalcula sola). El sodio se LIMITA (menos es mejor), el resto se cubre.
// LA VALIDACION SE RECALCULA EN VIVO CON LOS CUATRO CAMPOS DE ARRIBA (cotejo 2026-09-06, punto 21).
//
// POR QUE. Esos cuatro campos existen para ver como cambia esta tabla; su archivo la recalcula al
// teclear y el nuestro exigia bajar hasta el final de la formula sintetica y guardar. Textual de
// Santiago: "no hace sentido ir tan abajo y los profesionales no van a saber".
//
// Y SE PUDO SIN PARTIR EL GUARDADO, que es lo que ya habiamos decidido no hacer: esta tabla NO
// PERSISTE NADA, se deriva. Asi que basta con darle los ajustes que hay EN PANTALLA en vez de los
// guardados. Es una prop; no hay escritor, ni firma, ni columna nueva.
//
// LA DISTINCION CON EL BOTON DEL PUNTO 25, que parece la contraria y no lo es: alli el boton se APAGA
// mientras haya cambios sin guardar, y aqui la tabla SI muestra lo no guardado. La diferencia es que
// aquel ACTUA (manda las restricciones guardadas a la IA, y con las de pantalla mentiria) y esta
// PREVISUALIZA. Lo que una previsualizacion debe es DECIR que lo es, y eso hace el aviso de abajo.
function ValidacionSection({
  protocol,
  ajustes,
  opciones,
  sinGuardar = false,
}: {
  protocol: TreatmentProtocol;
  /** Los ajustes VIVOS de la cadena. Sin ellos (uso fuera del panel) manda lo guardado. */
  ajustes?: ProtocoloAjustes;
  /**
   * Las MISMAS opciones que usa la cadena, y esto cerraba un hueco que nadie habia mirado: la tabla
   * llamaba a `computeProtocoloEfectivo` SIN `protKgVigente` y la cadena CON el. En los snapshots
   * anteriores al 2026-09-03 (que no sellan `mtn.protKg`) esa opcion es la que decide si la proteina
   * sale del MOTOR o del minimo poblacional, asi que la tabla podia estar validando el plan contra una
   * proteina que el profesional no prescribio. Medido el 2026-09-06: 21 de 26 tratamientos de la nube
   * caen en esa ventana, 19 de ellos sin ajuste manual.
   */
  opciones?: { protKgVigente: number | null };
  /** Hay cambios en los campos de arriba todavia sin guardar. */
  sinGuardar?: boolean;
}) {
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
  const ef = computeProtocoloEfectivo(snap, ajustes ?? adjGuardados, opciones ?? {});
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
      {/* UNA PREVISUALIZACION TIENE QUE DECIR QUE LO ES. La tabla se recalcula con lo que hay escrito
          arriba, asi que sin este aviso un profesional podria leer una validacion correcta e irse sin
          guardar, creyendo que el plan validado es el que queda. Va en la capa de ATENCION (operativo:
          "te falta hacer algo"), no en la clinica, que significa un veredicto sobre el paciente. */}
      {sinGuardar ? (
        <div className="flex max-w-prose flex-col gap-2 rounded-md border border-attention/40 bg-attention-bg px-3 py-2 text-sm text-attention">
          <p>
            Esta tabla se está recalculando con los valores que acabas de escribir arriba,{" "}
            <strong>todavía sin guardar</strong>. El botón para guardarlos está en{" "}
            <strong>Objetivo del plan</strong>, junto a los campos.
          </p>
        </div>
      ) : null}
      {!algunaPorcion ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          La validación aparece cuando hay porciones en la lista de intercambio.
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          {/* Ancho minimo por la misma razon que la tabla de intercambio: sin el, en pantalla estrecha las columnas se aprietan y los numeros se parten, y el desplazamiento lateral nunca se activa. */}
          <table className={`${tabla} min-w-[32rem]`}>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className={th}>Nutriente</th>
                <th className="px-2 py-1 text-right font-medium">Obtenido</th>
                <th className="px-2 py-1 text-right font-medium">Necesidad</th>
                <th className="px-2 py-1 text-right font-medium">% Cubrim.</th>
                <th className="px-2 py-1 text-right font-medium">ICN</th>
              </tr>
            </thead>
            <tbody>
              {nutrientes.map((n) => (
                <tr key={n.k} className={tr}>
                  <td className={tdFuerte}>
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

// NOTAS DEL TRATAMIENTO: SE RETIRA EL CAMPO, NO LO YA ESCRITO (cotejo 2026-09-05, punto 26).
//
// Decision de Santiago: "el html no lo tiene, y pienso que no sirve mucho... de momento yo quitaria este
// bloque". Verificado: su archivo no tiene notas de tratamiento, y en Atlas estas notas NO viajan al
// reporte ni a la historia clinica; solo las leen esta pantalla y los lectores de auditoria.
//
// PERO NO SE BORRA LA LECTURA, y esa es la diferencia con quitar el bloque entero. Hay profesionales que
// ya escribieron notas aqui; si se retira la seccion completa, ese texto deja de existir para quien lo
// escribio y solo queda alcanzable por un grant de administrador. Es la leccion del almacen que se elige
// por la propiedad que resuelve lo de delante y se olvida la de LECTURA. Asi que:
//   · con notas guardadas, el bloque aparece en SOLO LECTURA y dice que ya no se agregan;
//   · sin notas (el caso normal y el que Santiago va a ver), no aparece nada.
//
// LO QUE NO SE TOCA: la tabla `treatment_notes`, el servicio, la accion y el aviso de correccion que
// cuenta cuantas notas se pierden al corregir. Devolver el campo es volver a montar un formulario. Es la
// misma disciplina con la que se retiraron las guias dietarias.
//
// Y LA IDEA GRANDE DE SANTIAGO (notas globales que se clasifiquen por la pestaña donde se escriben, y
// que en el reporte se elija cuales enviar) NO se construye aqui: es un bloque propio, va al backlog.
function NotesSection({ protocol }: { protocol: TreatmentProtocol }) {
  if (!protocol.notes.length) return null;

  return (
    <div className={bloqueCls("registro")}>
      <h3 className={tituloBloqueCls("registro")}>Notas del tratamiento (histórico)</h3>
      {/* EL TEXTO DECIA "nunca se envió al paciente ni salió en el reporte" Y ERA FALSO: estas notas
          SALEN en la historia clínica desde su §8.3 (2026-08-26). Es un texto que afirmaba un estado sin
          derivarlo, y en la pantalla donde el profesional decide cómo redactar: creer que una nota es
          privada cambia lo que se escribe en ella. */}
      <p className="text-xs text-muted-foreground">
        Aquí ya no se escriben notas nuevas: van en <strong>Seguimiento</strong>, con el próximo control.
        Se conserva lo escrito antes, y <strong>sale en la historia clínica</strong> igual que lo nuevo.
      </p>
      {/* UNA NOTA POR PROFESIÓN (Gildardo 2026-08-30 §8: "cada rol escribe lo suyo y no se pisan").
          Se AGRUPAN, no se ocultan: el médico necesita leer lo que anotó la nutricionista. */}
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
    </div>
  );
}
