import { INTER_GRUPOS, INTER_TABLA_A } from "@/clinical-engine/intercambio";
import { alimentosDe } from "@/clinical-engine/intercambio-alimentos";

// Las DOS superficies de la lista de alimentos concretos (INTER_TABLA_B), portadas del v8. Viven en un
// modulo NEUTRO (sin "use client" ni server-only) porque son presentacionales puras, sin estado: asi las
// puede renderizar el panel cliente y tambien un test, sin arrastrar los hooks del panel.
//
// Son dos porque tienen DOS PUBLICOS, y el v8 las trata distinto:
//   - AlimentosDelSubgrupo: referencia del PROFESIONAL mientras reparte porciones. Plegada.
//   - ListaIntercambioPaciente: lo que el PACIENTE se lleva. Recortada a los primeros 8 por subgrupo.
// Ninguno de los dos recortes es decision nuestra: son las suyas, y por eso van con candado
// (lista-intercambio.test.tsx).

// Alimentos concretos de un subgrupo, PLEGADOS (porte fiel del v8: <details> "ver N alimentos" y, al
// abrir, "nombre (N g)" separados por punto medio). El plegado resuelve el problema de tamaño sin que
// tengamos que inventar nada: el subgrupo Cereales tiene 39 alimentos.
export function AlimentosDelSubgrupo({ sub }: { sub: string }) {
  const alimentos = alimentosDe(sub);
  if (alimentos.length === 0) return null;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        ver {alimentos.length} alimentos
      </summary>
      <p className="mt-1 max-w-prose leading-relaxed text-muted-foreground">
        {alimentos.map((a) => `${a.al} (${a.g} g)`).join(" · ")}
      </p>
    </details>
  );
}

// LISTA DE INTERCAMBIO PARA EL PACIENTE (porte fiel del v8, seccion propia). Es la otra superficie de la
// misma tabla y tiene otro publico: la de arriba es referencia mientras el profesional reparte; esta es lo
// que el paciente se lleva. Por eso el v8 la recorta a los PRIMEROS 8 por subgrupo con "entre otros" (una
// lista de 39 no se usa en casa) y la encabeza con el parrafo de como usarla. Se porta el recorte tal cual:
// no es una decision nuestra de diseño, es la suya.
//
// OJO (no es un olvido): hoy esta lista se VE en pantalla y no tiene forma de LLEGAR al paciente. El envio
// del plan es un item propio de BACKLOG ("el PLAN de tratamiento no tiene forma de llegar al paciente");
// cuando exista, esta seccion es su contenido.
export const ALIMENTOS_VISIBLES_PACIENTE = 8;

export function ListaIntercambioPaciente() {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-semibold text-foreground">Lista de intercambio para el paciente</h3>
      <p className="max-w-prose text-sm text-muted-foreground">
        Cómo usar esta lista: los alimentos de un mismo grupo aportan aproximadamente lo mismo por porción,
        así que puedes intercambiarlos libremente. Sigue las porciones que te indicó tu nutricionista para
        cada grupo y elige entre los alimentos de la lista, variando cada día para lograr una alimentación
        completa y diversa. La cantidad entre paréntesis es el tamaño de una porción de intercambio.
      </p>
      <div className="flex flex-col gap-3">
        {INTER_GRUPOS.map((g) => {
          const subs = INTER_TABLA_A.filter((r) => r.gr === g.id);
          if (subs.length === 0) return null;
          return (
            <div key={g.id} className="border-b border-border/50 pb-2 last:border-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.nom}</p>
              {subs.map((r) => {
                const alimentos = alimentosDe(r.sub);
                const visibles = alimentos.slice(0, ALIMENTOS_VISIBLES_PACIENTE);
                return (
                  <p key={r.sub} className="mt-1 max-w-prose text-sm leading-relaxed text-foreground">
                    <span className="font-medium">{r.sub}: </span>
                    <span className="text-muted-foreground">
                      {visibles.map((a) => `${a.al} (${a.g} g)`).join(", ")}
                      {alimentos.length > ALIMENTOS_VISIBLES_PACIENTE ? ", entre otros" : ""}
                    </span>
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

