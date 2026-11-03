import { Text as TextDeReactPdf } from "@react-pdf/renderer";
import type { ComponentProps, ReactNode } from "react";

import { paraPdf } from "./texto-para-pdf";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL `Text` DE LOS PDF: EL MISMO, CON LOS SIMBOLOS TRADUCIDOS  ·  2026-11-03
//
// ═══ POR QUE AQUI Y NO EN CADA SITIO ═══
//
// Los tres documentos usan `<Text>` 169 veces. Traducir en cada uno seria 169 oportunidades de olvidar
// una, y la que se olvide es la que imprime basura sin avisar (es exactamente como aparecio el defecto:
// el texto estaba bien en la base y en la pantalla).
//
// ASI QUE SE SUSTITUYE LA PIEZA, NO LAS LLAMADAS: este modulo exporta un `Text` con la misma firma, y
// cada documento cambia UNA LINEA, la de su import. Las 169 llamadas quedan intactas y no hay forma de
// que una se quede fuera.
//
// Y UN CANDADO PROHIBE IMPORTAR `Text` DE `@react-pdf/renderer` en esta carpeta, que es lo que cierra la
// puerta de verdad: sin eso, el proximo archivo de PDF volveria a importarlo del paquete y nadie lo
// notaria hasta que un paciente reciba su informe.
//
// ═══ LO QUE NO HACE ═══
//
// No toca estilos, ni props, ni la maquetacion: solo pasa las cadenas por `paraPdf`. Los hijos que NO son
// cadenas (otro `<Text>` anidado para una palabra en negrita, por ejemplo) viajan tal cual y se traducen
// en SU propio `Text`, que es el que los compone.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// `Text` de @react-pdf acepta DOS formas de props (la del flujo normal y la de dentro de un `<Svg>`), y
// su union no declara `children` en comun. Se desestructura sobre la union ampliada con `children`, que es
// lo unico que este envoltorio toca; el resto de props viaja sin mirarse.
type Props = ComponentProps<typeof TextDeReactPdf> & { children?: ReactNode };

/** Recorre los hijos y traduce solo las cadenas. No entra en componentes: cada `Text` traduce los suyos. */
function traducidos(hijos: ReactNode): ReactNode {
  if (typeof hijos === "string") return paraPdf(hijos);
  if (Array.isArray(hijos)) return hijos.map((h) => (typeof h === "string" ? paraPdf(h) : h));
  return hijos;
}

export function Text({ children, ...resto }: Props) {
  return <TextDeReactPdf {...resto}>{traducidos(children)}</TextDeReactPdf>;
}
