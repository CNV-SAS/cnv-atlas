import {
  hayQueYuxtaponer,
  type DeclaracionDelPaciente,
  type DeclaracionDelProducto,
} from "../yuxtaposicion-alergenos";

// El bloque que pone las dos declaraciones juntas. Sin directiva de cliente ni de servidor: no tiene
// estado ni efectos, asi que sirve en las dos orillas y no arrastra una frontera RSC donde se use.
//
// DECISIONES DE PRESENTACION, y cada una responde a una linea de las dos instrucciones:
//
// · NEUTRO, NO DE ALERTA. Nada de rojo ni de icono de peligro. Un color de severidad seria una
//   clasificacion, y clasificar es justo lo que no se hace aqui. Es informacion que el profesional lee,
//   no un veredicto que el sistema emite.
// · LOS DOS LADOS CON EL MISMO PESO VISUAL, porque son dos hechos del mismo rango: lo que declaro una
//   persona y lo que declara una ficha. Jerarquizar uno sugeriria que el otro se mide contra el.
// · LA LISTA DEL PRODUCTO VA COMPLETA. Del asesor legal, y es la parte fina: asi el profesional ve
//   ingredientes que un filtro nunca le habria mostrado.
// · NADA SE RESALTA POR COINCIDIR. Pintar distinto lo que coincide seria el cruce con otro nombre.
// · Y EL CIERRE PIDE VERIFICAR, no informa de que se verifico. Gildardo, textual: "la pantalla no dice
//   que nada fue verificado contra las alergias, porque no lo sera".

function Columna({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((t, i) => (
          <li key={`${t}-${i}`} className="text-sm text-foreground">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function YuxtaposicionAlergenos({
  paciente,
  producto,
  nombreProducto,
}: {
  paciente: DeclaracionDelPaciente;
  producto: DeclaracionDelProducto;
  nombreProducto: string;
}) {
  if (!hayQueYuxtaponer(paciente, producto)) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {paciente.alergias.length > 0 && (
          <Columna titulo="El paciente declaró alergia a" items={paciente.alergias} />
        )}
        {paciente.intolerancias.length > 0 && (
          <Columna titulo="Y declaró intolerancia a" items={paciente.intolerancias} />
        )}
        <Columna titulo={`${nombreProducto} declara`} items={producto.alergenos} />
      </div>
      <p className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">
        Verifica la compatibilidad antes de recomendarlo. Atlas no las compara.
      </p>
    </div>
  );
}
