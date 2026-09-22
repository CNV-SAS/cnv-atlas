// ARMA NUESTRA COPIA DEL HTML CON EL EXPORTADOR (plan de la importacion, sesion 2, 2026-09-22).
//
// El HTML de Gildardo NO se toca: se lee, se le agrega `exportador.js` antes de </body> y se escribe una
// copia aparte. Cuando llegue otra version del HTML, se vuelve a correr sobre ella.
//
// Uso:  node scripts/exportador-html/construir.mjs [ruta del HTML] [carpeta de salida]
//       (por defecto, el v9 del 21 de septiembre y docs/distribucion/exportador-html)
//
// La copia de salida conserva el NOMBRE del HTML de entrada a proposito: el profesional reemplaza su archivo
// por este en la MISMA carpeta y con el MISMO nombre, para que el navegador le muestre lo que guardo con el
// viejo (algunos navegadores separan lo guardado por archivo).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const entrada =
  process.argv[2] ?? "docs/entregas/Gildardo responses/html actualizado 21 septiembre/ATLAS_v9.html";
const salida = process.argv[3] ?? "docs/distribucion/exportador-html";

const html = readFileSync(entrada, "utf8");
const script = readFileSync(new URL("./exportador.js", import.meta.url), "utf8");

// Barrido de credenciales: la copia se distribuye, asi que no puede llevar una clave viva. El HTML del
// repositorio ya viene barrido; esto lo comprueba antes de escribir.
const SOSPECHOSAS = [/sk_[a-z]+_[A-Za-z0-9]{16,}/, /gsk_[A-Za-z0-9]{20,}/, /AIza[0-9A-Za-z_-]{30,}/, /eyJhbGciOi[A-Za-z0-9._-]{40,}/];
for (const re of SOSPECHOSAS) {
  if (re.test(html)) {
    console.error(`El HTML de entrada trae algo con forma de credencial (${re}). No se arma la copia.`);
    process.exit(1);
  }
}

const cierre = html.lastIndexOf("</body>");
if (cierre < 0) {
  console.error("El HTML no tiene </body>: no se sabe donde agregar el exportador.");
  process.exit(1);
}
const marca = "<!-- EXPORTADOR A ATLAS WEB (agregado por CNV; el resto del archivo es el original) -->";
const copia = html.slice(0, cierre) + `${marca}\n<script>\n${script}\n</script>\n` + html.slice(cierre);

mkdirSync(salida, { recursive: true });
const destino = join(salida, basename(entrada));
writeFileSync(destino, copia);
console.log(`Copia con exportador: ${destino}`);
