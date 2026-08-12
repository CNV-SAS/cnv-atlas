// Armado de la cadena de correcciones (v1 -> v2 -> v3) a partir de las aristas old->new. PURO: sin
// server-only ni cliente, para poder probar la logica de recorrido/orden sin BD ni sesion (el reader
// hace el fetch RLS y llama aqui). Cada correccion es una arista de la lista enlazada de
// clinical_corrections; desde CUALQUIER version de la cadena se reconstruye entera.

export type CorrectionEdge = {
  oldEvaluationId: string; // la version que se reemplazo
  newEvaluationId: string; // la version que la sucede
  reason: string;
  correctedByName: string;
  triggerType: string;
  createdAt: string; // ISO
};

export type CorrectionChain = {
  // Correcciones ordenadas de la mas antigua a la mas reciente (v1->v2, v2->v3, ...). Vacio si la
  // evaluacion nunca se corrigio ni se corrigio a partir de ella.
  entries: CorrectionEdge[];
  currentEvaluationId: string; // la version que se esta viendo
  currentVigenteId: string; // la ultima version de la cadena (la vigente)
};

// Reconstruye la cadena que CONTIENE evaluationId, siguiendo las aristas dentro del conjunto dado.
// Aristas de OTRAS cadenas (otros pacientes) quedan fuera: no conectan con evaluationId. Los `seen`
// evitan un bucle infinito si los datos tuvieran un ciclo (no deberia: es append-only, pero defensivo).
export function chainContaining(evaluationId: string, edges: CorrectionEdge[]): CorrectionChain {
  const byOld = new Map(edges.map((e) => [e.oldEvaluationId, e]));
  const byNew = new Map(edges.map((e) => [e.newEvaluationId, e]));

  // Hacia atras hasta el origen: mientras esta version sea el `new` de alguna correccion, retrocede.
  let origin = evaluationId;
  const seenBack = new Set<string>();
  while (byNew.has(origin) && !seenBack.has(origin)) {
    seenBack.add(origin);
    origin = byNew.get(origin)!.oldEvaluationId;
  }

  // Hacia adelante desde el origen, recogiendo cada salto en orden.
  const entries: CorrectionEdge[] = [];
  let cursor = origin;
  const seenFwd = new Set<string>();
  while (byOld.has(cursor) && !seenFwd.has(cursor)) {
    seenFwd.add(cursor);
    const e = byOld.get(cursor)!;
    entries.push(e);
    cursor = e.newEvaluationId;
  }

  const currentVigenteId = entries.length > 0 ? entries[entries.length - 1].newEvaluationId : evaluationId;
  return { entries, currentEvaluationId: evaluationId, currentVigenteId };
}
