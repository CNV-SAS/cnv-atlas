import { alimentosDe } from "@/clinical-engine/intercambio-alimentos";

// Los alimentos concretos de `INTER_TABLA_B`, portados del v8, como REFERENCIA DEL PROFESIONAL mientras
// reparte porciones. Modulo NEUTRO (sin "use client" ni server-only) porque es presentacional puro: asi lo
// puede renderizar el panel cliente y tambien un test, sin arrastrar los hooks del panel.
//
// AQUI VIVIA TAMBIEN `ListaIntercambioPaciente`, la version recortada a 8 por subgrupo que se le entrega
// al paciente. SE RETIRO EL 2026-09-03 y con ella se cierra una divergencia NUESTRA: en su archivo esa
// lista es `plan-print-only` (no se ve en pantalla, solo al imprimir), y la mostrabamos porque no teniamos
// superficie de entrega. Desde el 1-sep el paciente recibe su plan dentro del reporte.
//
// NO SE PIERDE NADA CLINICO: el recorte a 8 con "entre otros" y el parrafo de "como usarla" son decisiones
// SUYAS y siguen en su HTML; cuando llegue el mapa de regiones (punto 2 de la ronda del 3-sep) se re-portan
// dentro del septimo bloque del plan, que es donde el las quiere. Se retiran de aqui porque una pieza que
// nadie consume envejece sin que nada avise, y porque su aviso en pantalla ("todavia no esta adaptada a la
// ciudad, revisala antes de entregarla") invitaba a entregar a mano lo que ahora entrega el reporte.

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
      {/* Mismo aviso que la lista del paciente, en una linea: aqui tambien es la lista base. */}
      <p className="mt-1 text-muted-foreground/80">Lista base, sin adaptar a la ciudad del paciente.</p>
    </details>
  );
}
