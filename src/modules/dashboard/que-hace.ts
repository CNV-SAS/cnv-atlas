// QUE HACE CADA SECCION, en una linea y en el lenguaje del profesional.
//
// ═══ POR QUE ES UN MAPA POR RUTA Y NO UN CAMPO DEL NAV ═══
//
// El sidebar es una barra de navegacion: sus items llevan un rotulo corto porque compiten por 60 px de
// ancho. Meterles aqui una descripcion los volveria un objeto con dos textos de los que uno casi nunca se
// usa, y el dia que alguien edite el rotulo corto tocaria el largo sin querer.
//
// LA CLAVE ES LA RUTA, que es lo unico estable: el rotulo cambia (esta semana "Tablero" paso a "Inicio" y
// "Administrador de Pacientes" a "Lista de pacientes") y la direccion no.
//
// ── COMO SE ESCRIBEN ────────────────────────────────────────────────────────────────────────────────
//
// DICEN QUE SE HACE ALLI, no que ES la pantalla. "Reportes" no necesita que le digan que es la seccion de
// reportes; necesita que le digan que ahi se aprueban y se envian, que es lo que no se ve desde fuera.
//
// Y NO PROMETEN LO QUE NO HAY. Si una seccion esta a medias, se dice en su linea antes que dejar que el
// profesional lo descubra entrando.
export const QUE_HACE: Record<string, string> = {
  "/dashboard": "Lo que tienes pendiente hoy y cómo va tu mes.",
  "/pacientes":
    "Tus pacientes, con lo que le falta a cada uno. Desde aquí se crea uno nuevo y se le pasa el enlace de la encuesta.",
  "/ani-bis-e":
    "El modelo: con qué versión se está diagnosticando y el consentimiento vigente que firma el paciente.",
  "/reportes": "Los reportes del paciente: aprobarlos, enviarlos y consultar los ya enviados.",
  "/direccion": "Indicadores de la operación para la dirección.",
  "/obbia": "El observatorio: datos agregados y anonimizados para investigación.",
  "/comercial": "Ventas, transacciones y la liquidación de comisiones.",
  "/comodato": "Los equipos en comodato: a quién están asignados y en qué estado.",
  "/nutraceuticos": "El catálogo de nutracéuticos y su inventario general.",
  "/mi-inventario": "Lo que tienes tú en existencia, y sus movimientos.",
  "/faltantes": "Los faltantes reportados en un conteo y cómo se resolvieron.",
  "/pagos": "Cobros a pacientes y el estado de cada transacción.",
  "/perfil": "Tus datos, tu profesión y tu información tributaria.",
  "/verificaciones": "La cola de RUT por verificar, para que se les pueda pagar.",
  "/admin": "Altas, bajas y roles de las cuentas.",
  "/admin/ia": "El proveedor de IA y los textos de los prompts, por versión.",
  "/admin/auditoria": "El registro de todo lo que ocurre sobre un dato clínico.",
  "/auditoria/notas": "Notas clínicas seudonimizadas, bajo un permiso con vigencia.",
  "/auditoria/solicitar": "Pedir acceso temporal a datos clínicos, con su motivo.",
  "/auditoria/aprobaciones": "Aprobar o negar las solicitudes de acceso de otros.",
};
