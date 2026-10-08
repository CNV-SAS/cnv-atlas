import type { FaseDeOperacion } from "@/modules/auth/fase-de-operacion";

// ═══ EL AVISO DE ARRIBA, SEGUN LA FASE (2026-09-25) ═══
//
// ANTES COLGABA DEL SEGUNDO FACTOR (`MfaRelaxedBanner`, atado a `ATLAS_MFA_RELAXED`), y eso dejo de ser cierto:
// Santiago arranca operacion real sin separar ambientes y con el segundo factor todavia relajado, asi que el
// aviso habria seguido diciendo "nada de lo que registres aqui es real" a profesionales atendiendo pacientes de
// verdad. Ver `modules/auth/fase-de-operacion.ts`.
//
// ── EL TEXTO DE LANZAMIENTO: LO UTIL ES LA ULTIMA FRASE ──
//
// "Puede haber errores" es informacion que no se puede accionar. Lo que si se puede accionar es QUE HACER
// cuando algo falla, y ahi hay un riesgo concreto que ya nos ha pasado: un profesional cuya venta parece
// fallar VUELVE A INTENTARLA, y un cobro repetido se duplica (por eso existe el aviso de cobro duplicado en el
// checkout). Asi que el aviso no dice "puede haber errores" y para; dice que actualice antes de repetir, y que
// repetir un cobro puede duplicarlo. Es la frase que evita el daño.
//
// ── SE QUEDA EN AMBAR, Y NO POR INERCIA ──
//
// Santiago pregunto si cambiarlo de color. Se queda, porque `attention` es el eje OPERATIVO (no clinico) y esto
// es exactamente una advertencia de operacion. Lo que si baja es el PESO: el aviso de pruebas iba en
// `font-semibold` sobre todo el ancho, y un aviso permanente en negrita durante meses entrena a no mirarlo. Va
// el rotulo en negrita y el resto en peso normal, que es como se lee una linea de contexto.
export function AvisoDeFase({ fase }: { fase: FaseDeOperacion }) {
  if (fase === null) return null;

  return (
    <div
      role="alert"
      className="border-b border-attention/50 bg-attention-bg px-4 py-2 text-center text-sm text-attention"
    >
      {fase === "pruebas" ? (
        <>
          <strong className="font-semibold">Entorno de pruebas.</strong> Nada de lo que registres aquí es real
          ni tiene efectos: puedes crear pacientes, hacer evaluaciones y registrar ventas con libertad para
          conocer el sistema.
        </>
      ) : (
        /* ═══ REDACTADO DE NUEVO, Y LA SEGUNDA VEZ POR LA RAZON BUENA (Santiago, 2026-10-08) ═══

           PRIMERA PASADA: cambie "Operación real: lo que registres aquí cuenta" por su redacción y le pegué la
           razón del cobro duplicado, que era la frase que evitaba el daño.

           Y ME CORRIGIO, con el argumento que yo no tenía: **ese texto es viejo**. Se escribió cuando las ventas
           eran lo frágil, y las ventas son justamente lo que más se ha pulido desde entonces. Textual suyo: *"el
           problema no es que se pueda duplicar un cobro, sino que algo se caiga, algo no funcione (ejemplo los
           hooks). La idea es que refresquen y vuelvan a cargar."*

           ASI QUE EL DAÑO A EVITAR CAMBIO, y con él el aviso: ya no es un cobro repetido, es alguien atascado en
           una pantalla que no cargó, sin saber que recargar lo resuelve. Un aviso que nombra el riesgo de hace
           dos meses entrena a leerlo como decoración.

           SE CONSERVA "ACTUALIZA ANTES DE REPETIR", que es lo útil y vale para todo: recargar antes de reintentar
           sirve igual para un cobro y para una pantalla caída, y evita el duplicado sin tener que nombrarlo. Lo
           que se va es el ancla a pagos, porque el aviso sale en toda la app. */
        <>
          <strong className="font-semibold">Estamos haciendo ajustes.</strong> Si algo no carga o se queda a
          medias, actualiza la página antes de volver a intentarlo. Si sigue fallando, escríbele a un
          administrador en vez de repetirlo.
        </>
      )}
    </div>
  );
}
