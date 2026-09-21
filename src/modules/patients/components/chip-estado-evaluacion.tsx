import { estadoEvaluacionLabel } from "../labels";

// ═══ EL ESTADO DE UNA EVALUACION, QUE SE DISTINGA DE UN VISTAZO (Santiago, 2026-09-21) ═══
//
// SU OBSERVACION: "abandonada, completada y en progreso aparecen en gris". Era texto apagado en una
// columna, y cinco estados distintos se leian como uno solo.
//
// POR QUE NO ES `PillEstado`. Ese componente tiene una regla dura: pill solo para lo EXCEPCIONAL, y por eso
// no tiene tono "normal". Aqui el chip no marca una fila rara: ES el valor de la columna, y todas las filas
// tienen uno. Meterlo en `PillEstado` obligaria a romper su regla o a darle un tono "normal" que la regla
// prohibe a proposito.
//
// ── LOS COLORES NO SON EL SEMAFORO CLINICO, Y ESO ES LA MITAD DEL DISEÑO ─────────────────────────────
//
// Verde, ambar y rojo son la escala `--clinical-*`: en Atlas significan como esta el PACIENTE. Un estado de
// trabajo no dice nada del paciente, asi que pintar "Completada" en verde o "Abandonada" en rojo haria leer
// un veredicto donde hay un tramite. Se usan solo los tonos de INTERFAZ (azul de marca, navy, gris), y los
// estados se separan tambien por FORMA (relleno, contorno, contorno discontinuo), para que se distingan sin
// depender del color y tambien impresos en blanco y negro.
//
//   En progreso     azul de marca, suave   · se esta trabajando
//   Completada      navy, relleno          · cerrada por el profesional: un hecho, no una tarea
//   Esperando       contorno azul discont. · la pelota la tiene el paciente
//   Borrador        contorno gris discont. · todavia no empezo
//   Abandonada      gris apagado           · retirada, sin trabajo detras
const ESTILO: Record<string, string> = {
  in_progress: "border-primary/30 bg-primary/10 text-primary",
  completed: "border-marca-honda bg-marca-honda text-white dark:border-white/30",
  awaiting_survey: "border-dashed border-primary/60 bg-transparent text-primary",
  draft: "border-dashed border-border bg-transparent text-foreground",
  abandoned: "border-border bg-muted text-muted-foreground",
};

// Mas corto que el rotulo largo ("Firmada, esperando la encuesta"): en un chip no cabe una frase, y el
// titulo al pasar el raton conserva el rotulo completo.
const CORTO: Record<string, string> = {
  awaiting_survey: "Esperando la encuesta",
};

export function ChipEstadoEvaluacion({ status }: { status: string }) {
  const estilo = ESTILO[status] ?? "border-border bg-muted text-muted-foreground";
  return (
    <span
      title={estadoEvaluacionLabel(status)}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${estilo}`}
    >
      {CORTO[status] ?? estadoEvaluacionLabel(status)}
    </span>
  );
}
