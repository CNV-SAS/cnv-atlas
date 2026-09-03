import type { LucideIcon } from "lucide-react";

// PILL DE ESTADO: la etiqueta corta que marca una fila o un bloque cuando su estado es EXCEPCIONAL.
//
// POR QUE COMPARTIDO. El patron ya existia escrito a mano en `/pacientes` ("Sin autorización vigente") con
// sus seis clases copiadas. A la segunda pantalla serian dos copias y a la tercera, tres aspectos de la
// misma idea; es el mismo problema que ya resolvieron `bloque` y `titulo-pantalla`.
//
// ── LA REGLA, QUE ES LA PARTE QUE NO SE NEGOCIA (BRAND) ─────────────────────────────────────────────
//
// **Un pill solo cuando dice algo EXCEPCIONAL.** El estado "Activo" no lleva pill; "Inactivo" si. Gastar
// ancho en lo que casi siempre es igual es lo contrario de una lista escaneable, y ademas entrena a
// ignorar el color: si todas las filas llevan distintivo, ninguna lo lleva.
//
// Por eso este componente NO tiene un tono "normal" ni "ok". No es un olvido: es la regla, hecha tipo. Si
// hace falta decir que algo esta bien, se dice con la ausencia de pill.
//
// ── Y LOS TONOS SON DEL EJE OPERATIVO, NO DEL CLINICO ───────────────────────────────────────────────
//
// `clinical-critical` significa riesgo del PACIENTE. Un paciente que revoco su autorizacion no esta en
// riesgo: lo que esta vencido es un permiso. Por eso el tono `atencion` usa `clinical-warning` para el
// AMBAR pero el texto habla del permiso y no de la persona, y por eso no hay un tono rojo aqui: un rojo
// en una lista operativa se leeria como veredicto clinico.
//
// El tono `clinico` existe SOLO para superficies donde el pill si expresa una banda del modelo (una
// severidad, un veredicto). Ahi el color lo pone la capa `--clinical-*` y el llamador es responsable de
// que la banda y el color correspondan: este componente no clasifica nada.

export type TonoPill = "neutro" | "atencion" | "info" | "clinico";

const TONOS: Record<TonoPill, string> = {
  // Un hecho que conviene ver y no pide accion inmediata (un borrador, una copia, un archivado).
  neutro: "border-border bg-muted text-muted-foreground",
  // Pide trabajo o bloquea algo. Es el eje OPERATIVO, separado del clinico a proposito.
  atencion: "border-clinical-warning/40 bg-clinical-warning-bg text-clinical-warning",
  // Un estado en curso, sin carga de urgencia (enviado, en revision).
  info: "border-primary/30 bg-primary/10 text-primary",
  // Solo donde el pill ES una banda del modelo. El color lo pone quien lo llama, con `className`.
  clinico: "border-current/40",
};

export function PillEstado({
  children,
  tono = "neutro",
  icono: Icono,
  title,
  className,
}: {
  children: React.ReactNode;
  tono?: TonoPill;
  /** Icono de lucide, opcional. Refuerza el significado sin depender solo del color. */
  icono?: LucideIcon;
  /** Explicacion al pasar el raton. NO es el unico sitio donde vive la razon: es un refuerzo. */
  title?: string;
  /** Para el tono `clinico`, donde el color lo decide la banda. */
  className?: string;
}) {
  return (
    <span
      title={title}
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONOS[tono],
        className ?? "",
      ].join(" ")}
    >
      {Icono ? <Icono aria-hidden className="size-3" /> : null}
      {children}
    </span>
  );
}
