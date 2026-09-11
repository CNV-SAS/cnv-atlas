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
//
// ── LOS ROTULOS SE ESCRIBIERON DOS VECES, Y LA SEGUNDA VERSION ES LA QUE ESTA (2026-09-11) ───────
//
// La primera decia "El paciente declaro alergia a" / "Y declaro intolerancia a" / "LUVIA declara". Estaba
// armada como UNA FRASE REPARTIDA EN TRES COLUMNAS, y solo se lee bien en el caso en que las tres estan:
// un paciente que declara intolerancias y NINGUNA alergia veia una columna que empezaba por "Y" y que
// habia perdido el sujeto. El caso del smoke era exactamente ese.
//
// LA REGLA QUE SALE: cada rotulo tiene que sostenerse SOLO, porque cual aparece depende del dato. Un
// texto que depende de que su vecino exista es un texto que falla en cuanto el vecino falta, y en una
// pantalla condicional eso no es un caso borde, es la mitad de los casos.
//
// Por eso los tres son ahora frases nominales paralelas y en plural, que leen igual con un elemento o con
// cinco, aparezcan solas o juntas, y en cualquier orden.

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
          <Columna titulo="Alergias declaradas por el paciente" items={paciente.alergias} />
        )}
        {paciente.intolerancias.length > 0 && (
          <Columna titulo="Intolerancias declaradas por el paciente" items={paciente.intolerancias} />
        )}
        <Columna titulo={`Alérgenos declarados por ${nombreProducto}`} items={producto.alergenos} />
      </div>
      <p className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">
        Verifica la compatibilidad antes de recomendarlo. Atlas no las compara.
      </p>
    </div>
  );
}
