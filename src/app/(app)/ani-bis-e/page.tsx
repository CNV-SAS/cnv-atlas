import { requireUser } from "@/modules/auth/session";
import { ConsentimientoVigente } from "@/modules/model-registry/components/consentimiento-vigente";
import { MotorHoy, SelloDelModelo } from "@/modules/model-registry/components/motor-hoy";
import { leerVersionDelModelo } from "@/modules/model-registry/data/version-modelo-reader";
import { motorVigente } from "@/modules/model-registry/motor-vigente";

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
  // UNA SOLA LECTURA para el sello del hero y para las tarjetas: son el mismo dato, y leerlo dos veces
  // seria una consulta de mas por carga y dos oportunidades de que digan cosas distintas.
  const motor = motorVigente(await leerVersionDelModelo());

  return (
    <div className="mx-auto flex w-full max-w-[64rem] flex-col gap-6">
      {/* ═══ LA PORTADA (Santiago elige la opcion A del artefacto, 2026-09-10) ═══

          QUE SE PORTA DE CONTRATIK: el bloque de marca con degradado hondo, el nombre grande en dos
          tonos y una linea de estado encima. Aqui se puede usar entero porque esta pantalla NO TIENE UN
          SOLO DATO DE PACIENTE: el azul puede pesar sin que nadie lo confunda con severidad. El verde, el
          ambar y el rojo siguen reservados, tambien aqui, que es lo que los mantiene vivos donde si hay
          paciente.

          Y NO EXPLICA EL MODELO, que fue la parte que propuse y Santiago descarto con razon: quien entra
          a Atlas hizo (y pago) el diplomado, asi que no hay nadie que no sepa que es ANI-BIS-E. Ademas el
          significado ya esta en el subtitulo, y el FLUJO se aprende donde se usa: las pestañas de cada
          evaluacion (Encuesta, Antrop. & BIS, Diagnostico, Tratamiento, Seguimiento) lo enseñan solas.

          NO USA `TituloPantalla`: esta pantalla no describe una tarea, nombra el modelo. */}
      <header className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--marca-honda)_0%,var(--primary)_190%)] p-7 text-primary-foreground">
        {/* El halo es decorativo y no lleva informacion: `aria-hidden` y sin eventos. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-32 size-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14),transparent_62%)]"
        />
        <div className="relative flex flex-col gap-3">
          <SelloDelModelo motor={motor} />
          <h1 className="text-3xl font-bold tracking-tight">Modelo ANI-BIS-E</h1>
          <p className="max-w-[54ch] text-primary-foreground/80">
            Modelo de atención en salud, alimentación y nutrición informada basado en bioimpedancia
            espectroscópica y epigenética.
          </p>
        </div>
      </header>

      <MotorHoy motor={motor} />
      <ConsentimientoVigente />
    </div>
  );
}
