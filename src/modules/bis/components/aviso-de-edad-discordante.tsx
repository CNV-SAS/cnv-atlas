import { avisoDeEdadDiscordante, type DiscordanciaDeEdad } from "@/clinical-engine/edad-discordante";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL AVISO DE SU ERROR 5  ·  LA EDAD DE LA FICHA NO COINCIDE CON LA DEL EQUIPO
//
// Tabla 1 de su entrega del 2026-10-26: *"si hay discrepancia mayor de 1 año, alertar antes de calcular"*.
// Seis casos reales, con diferencias de 3 a 20 años.
//
// ═══ AVISA, NO FRENA, Y POR QUE ═══
//
// El sistema no puede saber cual de las dos edades es la buena: la de la ficha sale de una fecha de
// nacimiento que alguien escribio, la del equipo de lo que se teclee antes de medir. Frenar dejaria al
// paciente sin diagnostico mientras la unica persona que puede resolverlo se queda sin ver el problema. Y
// un freno que lanza desde una accion es un 500 con la pantalla caida.
//
// ═══ VA ARRIBA, DONDE VIVE LA TOMA ═══
//
// Mismo sitio que el aviso de medicion repetida, y por lo mismo: esto se lee ANTES de mirar las cifras,
// porque la edad entra en el calculo de la edad biologica estimada. Y aparte de ese bloque, porque el
// arreglo es otro: aqui no se desliga una medicion, se verifica una fecha de nacimiento.
//
// `null` = no hay nada que avisar, y entonces NO hay bloque: a diferencia del de la correccion (que deja
// una salida siempre disponible), esto es solo un aviso, y un aviso sin hecho que avisar es ruido.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function AvisoDeEdadDiscordante({ discordancia }: { discordancia: DiscordanciaDeEdad | null }) {
  if (!discordancia) return null;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-attention bg-attention-bg p-4">
      <p className="text-sm font-medium text-foreground">Revisa la fecha de nacimiento</p>
      <p className="text-sm text-muted-foreground">{avisoDeEdadDiscordante(discordancia)}</p>
    </div>
  );
}
