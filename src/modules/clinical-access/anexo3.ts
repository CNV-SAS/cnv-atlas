// Version vigente del Anexo 3 (Acuerdo de Tratamiento que firma el Integrante).
// Es la precondicion del Nivel (b): la auditoria seudonimizada solo cubre a los
// pacientes cuyo profesional firmo esta version. Hoy 1.0 es la primera y unica
// version real; ya incluye la Clausula 17 con los tres niveles de auditoria. El
// chequeo queda listo para cuando exista una revision de fondo del Anexo 3.
//
// OJO: el helper SQL public.patient_professional_anexo3_current (migracion 0018)
// compara contra este mismo literal. Si esta constante cambia, hay que crear una
// migracion nueva que actualice el helper; el test de sincronia
// (clinical-access-anexo3.test.ts) falla si divergen.
export const ANEXO3_CURRENT_VERSION = "1.0";
