import "server-only";

import QRCode from "qrcode";

// EL QR DEL LINK DE PAGO, para que el paciente lo escanee en consulta con su telefono.
//
// Como imagen `data:` y no como SVG insertado en el HTML: la regla prohibe `dangerouslySetInnerHTML`, y un
// `<img>` no ejecuta nada. Es la misma libreria y la misma forma que el QR de MFA. Se genera en el servidor,
// sin red: no hay llamada externa que necesite timeout.
export async function qrDelLink(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}
