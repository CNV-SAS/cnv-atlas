// COMO SE LEE CADA VIA DE ENTREGA. La base guarda el codigo ('impresa') y el documento escribe la frase.
//
// MODULO NEUTRO, sin "use client" ni "server-only", y a proposito: lo importan las DOS presentaciones de
// la historia clinica, la pantalla (componente cliente) y el PDF (render de servidor). Escribir las
// etiquetas dos veces es como el papel y la pantalla acaban diciendo cosas distintas del mismo hecho, que
// es exactamente el defecto que `componerHistoriaClinica` existe para evitar.
//
// 'anterior' NO SE MAQUILLA: son las prescripciones aprobadas antes de que existieran las emisiones, y su
// via no se registro. Decir "impresa" ahi seria inventar un hecho en un documento probatorio.
export const VIA_DE_ENTREGA: Record<string, string> = {
  impresa: "Impreso y entregado en la consulta",
  correo: "Enviado por correo con el reporte",
  anterior: "Entregado antes de que se registrara la vía",
};

/** La frase de una via. Una via desconocida se muestra tal cual: es mejor un codigo que una invencion. */
export function etiquetaDeVia(via: string): string {
  return VIA_DE_ENTREGA[via] ?? via;
}
