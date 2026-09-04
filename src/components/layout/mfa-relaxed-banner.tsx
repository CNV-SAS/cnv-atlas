// Aviso PERMANENTE del entorno de pruebas (se muestra cuando la relajacion del segundo factor esta activa,
// que solo ocurre en pruebas). El texto NO habla de "segundo factor" ni "Hito 3": eso no le dice nada a un
// profesional. Le dice lo util: que nada de lo que registre es real, que puede probar con libertad. NO
// afirma que los datos se borren solos (no es cierto: se limpian cuando nosotros limpiemos). Se muestra a
// TODOS, incluido el admin. No se puede cerrar: mientras la relajacion este activa, el aviso esta.
export function MfaRelaxedBanner() {
  return (
    <div
      role="alert"
      className="border-b-2 border-attention bg-attention-bg px-4 py-2 text-center text-sm font-semibold text-attention"
    >
      Entorno de pruebas. Nada de lo que registres aquí es real ni tiene efectos: puedes crear pacientes,
      hacer evaluaciones y registrar ventas con libertad para conocer el sistema.
    </div>
  );
}
