import type { AlertaClinica } from "@/clinical-engine/alertas-disponibles";
import { ALERTAS_NO_DISPONIBLES } from "@/clinical-engine/alertas-disponibles";
import { Bloque } from "@/components/shared/bloque";

// ALERTAS CLINICAS de la encuesta.
//
// Es nivel DECISION y no de registro: una bandera de conducta alimentaria manda derivar hoy,
// no queda anotada para despues.
//
// ═══ DONDE APARECEN, Y POR QUE SON CUATRO SITIOS (Gildardo + Santiago, 2026-09-10) ═══
//
// SU INSTRUCCION DEL 2026-08-28 (11a), textual: "Esas alertas aparecen al inicio, cuando el profesional
// abre la informacion de la encuesta del paciente. Son lo que le dice que mirar ANTES de evaluar, no una
// conclusion del diagnostico".
//
// SE APLICO A LA PESTAÑA "Encuesta", Y ESE ERA EL ERROR DE LECTURA. Lo precisa Santiago: "abrir la
// informacion de la encuesta" es la PANTALLA de ver/editar la encuesta (/ani-bis-e/[id]/encuesta), que es
// donde el profesional va a leer lo que respondio el paciente. Ahi siguen estando, asi que su instruccion
// NO se revierte: se cumple donde el la queria.
//
// Y SE SUMAN LAS TRES QUE PIDIO DESPUES: Diagnostico, la subpestaña del profesional en Tratamiento, y
// Reporte/HC. Salen de la pestaña Encuesta, que es la unica donde dijo que no van.
//
// SON LAS MISMAS EN LOS CUATRO, y no por decision sino por construccion: una funcion sobre las respuestas
// de esa evaluacion, sin filtro por profesion. NO se filtra por profesion a proposito: el psicologo
// necesita ver el riesgo glucemico igual que la nutricionista necesita ver el TCA.
//
// TRES DE LAS CINCO SON ALIMENTARIAS (riesgo glucemico, deshidratacion, estres+azucares) y aun asi NO van
// junto a las restricciones del menu: no son restricciones, no alimentan el filtro de alergenos ni viajan
// al prompt del menu, y ponerlas ahi haria creer que el menu las esta atendiendo.
//
// LA NOTA DE ABAJO NO ES UN DESCARGO, ES LA PIEZA PRINCIPAL. De sus quince reglas corren cinco: las diez
// restantes necesitan el consumo de nutrientes EN PORCIONES, que la encuesta no captura. Sin decirlo,
// "ninguna alerta" se lee como "el paciente esta bien", cuando significa "de lo nutricional no estamos
// evaluando nada". El silencio de un sistema que el profesional cree completo pesa mas que un aviso.
//
// Y NO DICE "todavia", que es lo que decia antes. El puente frecuencia -> porciones esta CERRADO POR EL,
// dos veces: P-70 (2026-08-30, "no hay puente que construir": la frecuencia es un patron, no una
// cuantificacion) y P-83 (2026-09-03, sobre las porciones por grupo de la TCAC: "No va, y no es que falte:
// es que no debe existir"). Asi que hoy no hay via, y prometer una en un pie de pantalla seria afirmar mas
// de lo que sabemos. Declarado en PENDIENTES_CIENTIFICOS.

const ESTILO: Record<string, { caja: string; texto: string }> = {
  crítico: {
    caja: "border-clinical-critical bg-clinical-critical-bg",
    texto: "text-clinical-critical",
  },
  alto: { caja: "border-attention bg-attention-bg", texto: "text-attention" },
  moderado: { caja: "border-attention bg-attention-bg", texto: "text-attention" },
  positivo: { caja: "border-clinical-optimal bg-clinical-optimal-bg", texto: "text-clinical-optimal" },
};

/** Una alerta, con el estilo de su nivel. */
function Alerta({ a }: { a: AlertaClinica }) {
  const est = ESTILO[a.niv] ?? ESTILO.moderado;
  return (
    // La clave es el TITULO, que es su identificador estable dentro de la función; el índice
    // del arreglo cambia en cuanto una regla deja de aplicar.
    <li className={`rounded-lg border-2 p-3 ${est.caja}`}>
      <p className={`text-sm font-semibold ${est.texto}`}>{a.t}</p>
      <p className="mt-1 text-sm text-foreground">{a.txt}</p>
      <p className="mt-1 text-xs text-muted-foreground">Dominio {a.dom}</p>
    </li>
  );
}

export function AlertasClinicas({ alertas }: { alertas: AlertaClinica[] }) {
  // LAS POSITIVAS VAN APARTE, y es instrucción suya (2026-08-30, punto 5): "Una hidratación adecuada y un
  // TCA activo no pueden compartir lista ni peso visual. Lo que la alerta hace es dirigir la mirada del
  // profesional, y mezclarlas gasta esa atención en lo que ya está bien."
  //
  // La partición se hace por el nivel que trae SU regla (`niv === "positivo"`), no por una lista nuestra
  // de títulos: el día que agregue una cuarta positiva, cae sola en el bloque correcto.
  const aAtender = alertas.filter((a) => a.niv !== "positivo");
  const positivas = alertas.filter((a) => a.niv === "positivo");
  return (
    <Bloque nivel="decision" titulo="Alertas clínicas de la encuesta">
      {aAtender.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin banderas en las respuestas que hoy se evalúan.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {aAtender.map((a) => (
            <Alerta key={a.t} a={a} />
          ))}
        </ul>
      )}

      {/* SEGUNDO BLOQUE, con menos peso visual a propósito: título pequeño y separador. Lo que está bien
          se registra, no compite por la mirada. Si no hay ninguna, no se muestra un bloque vacío: un
          encabezado sin contenido también reclama atención. */}
      {positivas.length ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lo que el paciente ya hace bien
          </p>
          <ul className="flex flex-col gap-2">
            {positivas.map((a) => (
              <Alerta key={a.t} a={a} />
            ))}
          </ul>
        </div>
      ) : null}
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        El cuadro nutricional no se evalúa. De las quince alertas del modelo,{" "}
        {ALERTAS_NO_DISPONIBLES.porConsumo} necesitan el consumo de nutrientes en porciones, que la
        encuesta no captura. La ausencia de avisos no equivale a ausencia de riesgo.
      </p>
    </Bloque>
  );
}
