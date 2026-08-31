import type { EncabezadoFrecuencia as Encabezado } from "@/clinical-engine/encabezados-frecuencia";

// LA BANDA DE CATEGORIA de la matriz de frecuencia, en la forma que la pinta su archivo.
//
// POR QUE ASI Y NO COMO ESTABA. La primera version era texto pequeño en negrita con una linea fina debajo,
// y en el smoke del 2026-08-31 Santiago recorrio la encuesta entera SIN VERLA: estaba renderizada, pero no
// se leia como encabezado, sino como una etiqueta mas entre las preguntas. Su `ATLAS_v8.html` la pinta como
// una banda con fondo tintado y una barra de color a la izquierda, y esa forma es la que hace que se lea.
//
// EL COLOR ES SUYO (`catColor` del frozen: verde protector, azul neutro, rojo riesgo), no una eleccion
// nuestra de interfaz, asi que va inline y no como clase: si el mueve un color, esto se mueve con el. Un
// valor arbitrario de Tailwind construido con una variable no se compila (la clase no existe en el CSS) y
// el efecto desapareceria EN SILENCIO, que es justo el modo de fallo que este componente viene a cerrar.
//
// MODULO NEUTRO a proposito (sin "use client" ni "server-only"): lo consumen la vista de solo lectura, que
// es un Server Component, y el formulario de edicion, que es cliente.
export function EncabezadoDeFrecuencia({ encabezado }: { encabezado: Encabezado }) {
  return (
    <p
      className="rounded-r-lg py-1.5 pl-3 pr-4 text-sm font-bold"
      style={{
        color: encabezado.color,
        backgroundColor: `${encabezado.color}18`,
        borderLeft: `4px solid ${encabezado.color}`,
      }}
    >
      {encabezado.etiqueta}
    </p>
  );
}
