import { View } from "@react-pdf/renderer";

import { styles } from "./estilos-del-pdf";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA MARCA DE FONDO DE LOS DOCUMENTOS DEL PACIENTE  ·  Santiago, 2026-10-30
//
// *"Decorarlo un poco, con el brand de Atlas: el azul electrico y formas de fondo simples. Suaves y
// claras: el informe se imprime y a veces se fotocopia, asi que nada que tape el texto ni que gaste
// tinta. Que se vea igual en la vista previa y en el PDF del correo."*
//
// ═══ POR QUE ES UN COMPONENTE Y NO DOS PARES DE VIEWS ═══
//
// El paciente recibe DOS documentos en el mismo correo: el informe y la hoja del plan. Uno decorado y el
// otro no se lee como dos sistemas, que es el mismo argumento por el que los dos ya comparten la hoja de
// estilo y los bloques del plan. Y si la decoracion viviera copiada en los dos, el dia que cambie el azul
// cambiaria en uno.
//
// ═══ "IGUAL EN LA VISTA PREVIA Y EN EL PDF DEL CORREO" SALE GRATIS, Y CONVIENE SABER POR QUE ═══
//
// Las dos superficies renderizan EL MISMO componente (`renderReportPdf`, llamado por la ruta del preview y
// por el envio). No hay dos caminos que mantener iguales: hay uno. La peticion tendria coste si el preview
// fuera HTML, y no lo es.
//
// ═══ VA LO PRIMERO DENTRO DE LA PAGINA, Y ES LO UNICO FRAGIL DE ESTO ═══
//
// @react-pdf pinta en orden de declaracion, asi que esto tiene que ir ANTES del contenido para quedar
// detras. Puesto despues, el circulo taparia texto: justo lo que el encargo prohibe. Por eso el candado
// comprueba la POSICION, no solo que el componente este.
//
// `fixed` lo repite en todas las paginas. Es deliberado: una banda que aparece solo en la primera hoja
// hace que las siguientes parezcan de otro documento, y en un informe que se imprime y se reparte las
// hojas se separan.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function MarcaDeFondo() {
  return (
    <>
      {/* LA FORMA VA PRIMERO Y LA BANDA DESPUES, en ese orden: las dos ocupan el borde superior, y si la
          forma se pintara encima dejaria la banda con un velo azul claro en su tramo derecho. Pintada
          debajo, la banda se mantiene solida de punta a punta, que es lo que la hace fotocopiar limpia. */}
      <View fixed style={styles.formaDeMarca} />
      <View fixed style={styles.bandaDeMarca} />
    </>
  );
}
