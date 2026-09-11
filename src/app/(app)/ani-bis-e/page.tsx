import { requireUser } from "@/modules/auth/session";
import { ConsentimientoVigente } from "@/modules/model-registry/components/consentimiento-vigente";
import { MotorHoy } from "@/modules/model-registry/components/motor-hoy";

export const metadata = { title: "Modelo ANI-BIS-E - Atlas" };

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// LA PANTALLA DEL MODELO (Santiago, 2026-09-10, tercera vuelta: "mejor borremos todo")
//
// DE DONDE VIENE. Esta ruta era una bandeja con cinco colas. Al entrar la columna de pendientes en
// /pacientes, tres de las cinco pasaron a decir exactamente lo mismo paciente por paciente y se
// retiraron. Quedaban dos de lote (importar BIS, generar diagnostico) mas las encuestas sin responder, y
// encima de ellas se monto el taller del modelo.
//
// Y AHORA SE VA TAMBIEN LO DE LOTE. Su razon para el import: "considero que no es el mejor flujo, sino
// uno a uno en cada evaluacion". Tiene razon, y la version por evaluacion es ademas la BUENA:
// `entrada-evaluacion.tsx` (pestaña Antrop. & BIS) monta el mismo formulario CON sus dos guardas, que la
// cola no tenia: bloquea si hay contraindicacion (marcapasos) y exige las condiciones de la toma. La cola
// dejaba importar sin ninguna de las dos. Verificado antes de retirarla, junto con que cada pieza tiene
// su sitio:
//
//   · IMPORTAR BIS            -> `entrada-evaluacion.tsx`, con sus guardas y su modo de reemplazo.
//   · GENERAR DIAGNOSTICO     -> `GenerateDiagnosisPanel` en /ani-bis-e/[id].
//   · ENCUESTAS SIN RESPONDER -> la columna de pendientes dice "Esperando al paciente" (`pendientes.ts`).
//
// NO SE PIERDE NINGUNA ENTRADA A /ani-bis-e/[id]: la celda "Pendiente" de cada fila de /pacientes lleva
// directo a la evaluacion que corresponde.
//
// ── Y LA TABLA DE CORTES TAMBIEN SE VA, que era la unica reserva ────────────────────────────────────
//
// Su pregunta al proponerlo: esa tabla acababa de destapar el IRC desfasado doce dias, y eso paso porque
// los cortes se pusieron a la vista juntos. ¿Donde mas se veria esa clase de desfase?
//
// LA RESPUESTA ERA "EN NINGUN SITIO", y por eso no se retiro sin mas: habia dos candados y ninguno cubria
// el CRUCE (uno comprueba que nuestra referencia coincide con su archivo, el otro que nuestras bandas
// coinciden con el clasificador; los dos verdes y las dos superficies diciendo cosas distintas). Ese cruce
// es ahora un test (`hc-indices-ani.test.ts`, ultimo bloque), verificado con control negativo. Un test
// corre en cada commit; una tabla solo funciona si alguien la mira.
//
// ── LO QUE QUEDA ANOTADO PARA DESPUES ───────────────────────────────────────────────────────────────
//
// Entrenamiento y guias del modelo (suyo: "ya sera despues"). Esta es la pantalla donde van.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════
export default async function ModeloAniBisEPage() {
  // SOLO SESION, y el cambio de porton es consecuencia del cambio de contenido, no una relajacion.
  //
  // El gate anterior (`canConfirmIdentity || canEmitFollowupLink`) guardaba las COLAS DE PACIENTES que
  // vivian aqui. Con las colas fuera, esta pantalla no tiene un solo dato de paciente: las cuatro
  // versiones del modelo y el texto del consentimiento vigente, que es publico para quien va a firmarlo.
  // Mantener un porton que ya no guarda nada habria dejado fuera a direccion, soporte y obbia, que SI
  // tenian el consentimiento en su barra antes de mudarlo aqui.
  //
  // LA EVALUACION CONCRETA (/ani-bis-e/[id]) CONSERVA SUS POLICIES: ahi si hay paciente.
  await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-8">
      {/* LA CABECERA NO USA `TituloPantalla`: esta pantalla no describe una tarea, nombra el modelo. El
          subtitulo es su definicion completa, que es lo que Santiago pidio que estuviera aqui y no vive
          escrito en ninguna otra pantalla de Atlas. */}
      <header className="flex flex-col gap-3 border-b border-primary/20 bg-primary/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Modelo ANI-BIS-E</h1>
        <p className="max-w-[52ch] text-muted-foreground">
          Modelo de atención en salud, alimentación y nutrición informada basado en bioimpedancia
          espectroscópica y epigenética.
        </p>
      </header>

      <MotorHoy />
      <ConsentimientoVigente />
    </div>
  );
}
