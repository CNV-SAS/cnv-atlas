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
        <>
          <strong className="font-semibold">Operación real:</strong> lo que registres aquí cuenta. Si algo
          falla, actualiza la página antes de repetirlo; si sigue fallando, escríbele a un administrador, porque
          repetir un cobro o una venta puede duplicarla.
        </>
      )}
    </div>
  );
}
