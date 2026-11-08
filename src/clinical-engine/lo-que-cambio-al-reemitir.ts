// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE CAMBIO ENTRE EL DOCUMENTO ANTERIOR Y EL VIGENTE  ·  Santiago, 2026-11-08
//
// ═══ EL DEFECTO, EN SUS PALABRAS ═══
//
// *"'Lo que decía el documento anterior' muestra EB-BIS 76,4 e IAE +12,4, que no cambiaron (ya eran v7
// desde el 29-oct). Lo que cambió fue el dominio 3 (Enlentecido -> Acelerado), el riesgo y las rutas
// (0 -> 3). Ese panel debe mostrar LO QUE CAMBIÓ entre los dos documentos, no siempre la EB-BIS."*
//
// Tiene razon y el defecto es peor de lo que parece: el panel se titula *"Lo que decía el documento
// anterior"* y pone dos cifras IDENTICAS a las de arriba. Quien lo abre buscando que cambio encuentra
// que nada cambio, cierra el desplegable, y se pierde que su paciente paso de cero rutas a tres.
//
// ═══ ESTO NO CONSTRUYE CONTENIDO CLINICO (Regla 0) ═══
//
// Compara dos snapshots SELLADOS y repite lo que cada uno dice de si mismo. Las etiquetas de antes salen
// del snapshot de antes y las de ahora del de ahora: ninguna cifra se reclasifica con la ciencia de hoy,
// que es la leccion que ya costo una ronda (*"la cifra v5 sale con 'acorde con sus pares', que es texto
// de la v7: el documento viejo no decía eso"*).
//
// MODULO NEUTRO Y PURO: recibe los dos snapshots y devuelve una lista. Lo usan el lector del servidor y
// los tests.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Un cambio entre los dos documentos, ya resuelto: que, que decia antes y que dice ahora. */
export type CambioAlReemitir = {
  /** Que cambio ("Envejecimiento", "Riesgo funcional integrado", "Rutas de atención"). */
  que: string;
  /** Lo que decia el documento ANTERIOR, con SUS palabras. */
  antes: string;
  /** Lo que dice el vigente. */
  ahora: string;
};

type Dominio = { id?: string; nombre?: string; sev?: number | null; clasif?: string | null };
type Snap = {
  ebBis?: { eb?: number | null; iae?: number | null } | null;
  indicators?: { eb?: number | null; iae?: number | null } | null;
  dfi?: {
    domains?: Dominio[] | null;
    riesgo?: { nivel?: string | null; score?: number | null } | null;
    rutas?: unknown[] | null;
  } | null;
};

/** Una cifra como la escribe el modelo: un decimal y coma. Sin banda ni clasificacion. */
function cifra(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** El nombre de una ruta, tal como el snapshot la guarda ("R1 · Restauración Celular"). */
function rutas(s: Snap | null | undefined): string[] {
  return (s?.dfi?.rutas ?? []).map((r) => String(r)).filter((r) => r.trim() !== "");
}

function ebIae(s: Snap | null | undefined): { eb: number; iae: number } | null {
  const eb = s?.ebBis?.eb ?? s?.indicators?.eb ?? null;
  const iae = s?.ebBis?.iae ?? s?.indicators?.iae ?? null;
  if (typeof eb !== "number" || typeof iae !== "number") return null;
  if (!Number.isFinite(eb) || !Number.isFinite(iae)) return null;
  return { eb, iae };
}

/** Como se nombra un dominio en la lista: su clasificacion si la trae, si no su severidad. */
function estadoDelDominio(d: Dominio | undefined): string | null {
  if (!d) return null;
  if (d.clasif && String(d.clasif).trim() !== "") return String(d.clasif);
  if (d.sev == null) return "sin medir";
  return `severidad ${d.sev} de 3`;
}

/**
 * LO QUE CAMBIO ENTRE LOS DOS DOCUMENTOS, en el orden en que un profesional lo necesita.
 *
 * ═══ EL ORDEN NO ES ARBITRARIO: VA DE LO QUE CAMBIA LA ATENCION A LO QUE CAMBIA LA CIFRA ═══
 *
 *   1. LAS RUTAS, que es lo que el profesional hace con el paciente.
 *   2. EL RIESGO INTEGRADO, que es como se prioriza.
 *   3. LOS CINCO DOMINIOS, que es de donde sale lo anterior.
 *   4. LA EB-BIS Y EL IAE, que es lo que el paciente leyo.
 *
 * Al reves (que es como estaba) la pantalla abre por la cifra que mas veces NO cambia.
 *
 * LISTA VACIA = los dos documentos dicen lo mismo, y eso TAMBIEN hay que poder decirlo: una reemision
 * que no cambio nada es un hecho (el motor cambio, la salida no), no un panel en blanco.
 */
export function loQueCambioAlReemitir(
  anterior: unknown,
  vigente: unknown,
): CambioAlReemitir[] {
  const a = anterior as Snap | null;
  const v = vigente as Snap | null;
  if (!a || !v) return [];
  const salida: CambioAlReemitir[] = [];

  // 1 · LAS RUTAS. Se comparan como CONJUNTO y se dice cuales entraron y cuales salieron: "3 rutas" no
  // dice nada si antes habia otras 3. Y el caso de Santiago es justo el borde (0 -> 3), donde una
  // comparacion por cantidad diria "cambio" sin decir a que.
  const ra = rutas(a);
  const rv = rutas(v);
  if (ra.join("|") !== rv.join("|")) {
    salida.push({
      que: "Rutas de atención",
      antes: ra.length === 0 ? "ninguna" : ra.join(" · "),
      ahora: rv.length === 0 ? "ninguna" : rv.join(" · "),
    });
  }

  // 2 · EL RIESGO INTEGRADO, con su nivel y su cifra: el nivel solo esconde un salto de 20 puntos dentro
  // de la misma banda, y la cifra sola no dice si eso cruzo un corte.
  const nivelDe = (s: Snap | null) => {
    const r = s?.dfi?.riesgo;
    if (!r) return null;
    const nivel = r.nivel ? String(r.nivel) : null;
    const score = typeof r.score === "number" ? String(r.score) : null;
    if (!nivel && !score) return null;
    return nivel && score ? `${nivel} (${score} de 100)` : (nivel ?? (score as string));
  };
  const na = nivelDe(a);
  const nv = nivelDe(v);
  if (na !== nv && (na || nv)) {
    salida.push({
      que: "Riesgo funcional integrado",
      antes: na ?? "sin calcular",
      ahora: nv ?? "sin calcular",
    });
  }

  // 3 · LOS CINCO DOMINIOS, uno por uno y EN EL ORDEN DEL VIGENTE. Se emparejan por `id` y no por
  // posicion: un dominio que falte en uno de los dos desplazaria a todos los de abajo y la pantalla
  // diria que cambiaron cinco cuando cambio uno.
  const porId = new Map((a.dfi?.domains ?? []).map((d) => [String(d.id ?? ""), d]));
  for (const d of v.dfi?.domains ?? []) {
    const antes = estadoDelDominio(porId.get(String(d.id ?? "")));
    const ahora = estadoDelDominio(d);
    if (antes == null || ahora == null || antes === ahora) continue;
    salida.push({ que: String(d.nombre ?? d.id ?? "Dominio"), antes, ahora });
  }

  // 4 · LA EB-BIS Y EL IAE, Y SOLO SI CAMBIARON. Es el punto de Santiago: en la paciente de verificacion
  // ya eran v7 desde el 29 de octubre, asi que mostrarlas era mostrar dos veces la misma cifra.
  const ea = ebIae(a);
  const ev = ebIae(v);
  if (ea && ev && (ea.eb !== ev.eb || ea.iae !== ev.iae)) {
    salida.push({
      que: "Edad biológica estimada",
      antes: `${cifra(ea.eb)} años (IAE ${ea.iae > 0 ? "+" : ""}${cifra(ea.iae)})`,
      ahora: `${cifra(ev.eb)} años (IAE ${ev.iae > 0 ? "+" : ""}${cifra(ev.iae)})`,
    });
  }

  return salida;
}
