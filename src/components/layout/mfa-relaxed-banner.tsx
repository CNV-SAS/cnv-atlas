// Aviso PERMANENTE de que el entorno tiene el segundo factor relajado (solo PRUEBAS). Se muestra a TODOS
// los usuarios autenticados, incluido el admin (es quien mas necesita recordar el estado del entorno). No
// se puede cerrar: mientras la relajacion este activa, el aviso esta. Componente de servidor sin estado.
export function MfaRelaxedBanner() {
  return (
    <div
      role="alert"
      className="border-b-2 border-clinical-warning bg-clinical-warning-bg px-4 py-2 text-center text-sm font-semibold text-clinical-warning"
    >
      Entorno de PRUEBAS · el segundo factor está relajado (se reactiva en el Hito 3). Esto no es
      producción.
    </div>
  );
}
