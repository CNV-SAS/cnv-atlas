"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { type ColumnaLista, FilaLista, ListaFilas } from "@/components/shared/fila-lista";
import { formatDateOnlyShort } from "@/lib/format/date";
import { edadEnAnios } from "../format";
import type { PatientListItem } from "../types";

// Lista de pacientes: una sola fila en dos disposiciones (columnas en ancho, dos lineas en estrecho), con
// buscador. Ver `fila-lista.tsx` para el porque de la mecanica; aqui solo se declara QUE columnas van.
//
// TODO VIVE EN UNA SOLA TARJETA BLANCA sobre el gris de la pagina: buscador, lista y conteo. Es lo que
// faltaba tras invertir la disposicion (hallazgo de Santiago, 2026-08-28): pusimos el fondo gris pero
// dejamos el contenido suelto encima, y la pagina se veia apagada en vez de organizada.
//
// Y VAN JUNTOS, no en tres bloques: el buscador y la lista son UNA cosa (un roster que se busca), y el
// conteo describe lo que la lista esta mostrando. Partirlos separaria en tres bloques blancos lo que el
// profesional usa como un solo gesto: escribir, mirar el resultado, y ver cuantos quedaron fuera.
//
// EL TITULO DE PANTALLA SE QUEDA FUERA, sobre el gris: es de la PAGINA y no de este bloque. Meterlo
// dentro haria que la tarjeta pareciera contener toda la pantalla, incluido lo que venga despues.
//
// EL FILTRO ES EN CLIENTE, y el limite queda escrito porque un dia va a importar. La pagina es un
// Server Component que trae el roster COMPLETO y lo pasa aqui; filtrar en cliente da respuesta
// instantanea mientras se teclea, sin ida y vuelta al servidor.
//
//   Hasta ~500 pacientes: bien. Cada item pesa ~200 bytes serializados, asi que 500 son ~100 KB en el
//   payload de la pagina, y filtrar 500 cadenas por tecla es imperceptible.
//   Por encima de ~1.000: hay que mover la busqueda al SERVIDOR (consulta con `ilike` y limite), porque
//   lo que se rompe primero NO es el filtro sino el PAYLOAD: se descargan todos los pacientes en cada
//   carga de la pagina, se vean o no.
//
// El dia que se cruce ese umbral, lo que cambia es de donde salen `pacientes`; esta vista no.
//
// NO LLEVA ALTURA FIJA CON SCROLL PROPIO, aunque el archivo de Gildardo si la tenga: alli la lista vive
// dentro de un panel desplegable y el scroll anidado tiene sentido. En una pagina nuestra, un area con
// scroll propio dentro del scroll de la pagina se pelean en movil (el clasico "se mueve la de adentro
// cuando querias mover la de afuera"). Y con buscador no hace falta: cuando escribes ya estas arriba.

// EL ORDEN NO ES ARBITRARIO: lo mas mirado primero, tanto en columnas como en la linea concatenada. La
// ULTIMA CONSULTA abre porque es lo que responde "a quien no veo hace meses"; el DOCUMENTO cierra porque es
// por lo que se BUSCA (y de eso ya se encarga el buscador de arriba), no lo que se lee.
const COLUMNAS: readonly ColumnaLista[] = [
  { rotulo: "Última", ancho: "7rem", numerico: true, rotularEnEstrecho: true },
  { rotulo: "Evaluaciones", ancho: "7rem", numerico: true, rotularEnEstrecho: true },
  { rotulo: "Edad", ancho: "4.5rem", numerico: true, rotularEnEstrecho: true },
  // El documento ya carga su tipo delante ("CC 1.020..."), asi que en estrecho se explica solo.
  { rotulo: "Documento", ancho: "11rem", numerico: true },
];

export function ListaPacientes({ pacientes }: { pacientes: PatientListItem[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q === "") return pacientes;
    // Por NOMBRE o por DOCUMENTO, que son las dos formas en que un profesional busca a alguien: se
    // acuerda del nombre, o tiene la cedula delante.
    return pacientes.filter((p) => {
      const nombre = `${p.firstName} ${p.lastName}`.toLowerCase();
      return nombre.includes(q) || p.documentNumber.toLowerCase().includes(q);
    });
  }, [pacientes, busqueda]);

  // BUSCADOR SIN ROTULO VISIBLE: el placeholder ya dice que hace, asi que el rotulo encima repetia lo
  // mismo y gastaba una linea. Pero el nombre accesible NO desaparece: va en `aria-label`, porque un campo
  // sin nombre solo se anuncia como "cuadro de busqueda" y el placeholder no lo sustituye (se borra al
  // escribir y algunos lectores no lo leen).
  const buscador = (
    <div className="relative sm:max-w-md">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id="buscar-paciente"
        type="search"
        aria-label="Buscar paciente por nombre o número de documento"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o número de documento"
        className="w-full rounded-full border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );

  return (
    <ListaFilas
      columnas={COLUMNAS}
      encabezado={buscador}
      // Cuantos se ven, para que el filtro no esconda su efecto: si alguien busca y quedan 2 de 40, tiene
      // que saber que hay 38 fuera de la vista.
      pie={
        busqueda.trim()
          ? `${filtrados.length} de ${pacientes.length} pacientes`
          : `${pacientes.length} ${pacientes.length === 1 ? "paciente" : "pacientes"}`
      }
      // DOS VACIOS DISTINTOS: "no encontré lo que buscas" y "no tienes pacientes" son situaciones
      // opuestas, y decirle "no hay pacientes" a quien acaba de escribir mal un apellido lo manda a buscar
      // un problema que no existe. Va DENTRO de la tarjeta, con el buscador todavia visible para corregir.
      vacia={
        filtrados.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {busqueda.trim()
              ? `Ningún paciente coincide con "${busqueda.trim()}".`
              : "Todavía no tienes pacientes asignados."}
          </p>
        ) : null
      }
    >
      {filtrados.map((p) => {
        const anos = edadEnAnios(p.birthDate);
        // Un valor por columna, en el mismo orden. `null` deja la celda VACIA en columnas (para no correr
        // las de al lado) y se omite en la linea concatenada, donde un hueco no dice nada.
        const valores = [
          p.lastEvaluationDate ? formatDateOnlyShort(p.lastEvaluationDate) : null,
          String(p.evaluationCount),
          anos !== null ? String(anos) : null,
          `${p.documentType} ${p.documentNumber}`.trim() || null,
        ];

        return (
          <FilaLista
            key={p.patientId}
            href={`/pacientes/${p.patientId}`}
            titulo={`${p.firstName} ${p.lastName}`.trim() || "Sin nombre"}
            columnas={COLUMNAS}
            valores={valores}
            // CHIP SOLO SI ES EXCEPCIONAL (BRAND): lo normal no lleva distintivo; gastar ancho en lo que
            // casi siempre es igual es lo contrario de una lista escaneable.
            //
            // EL CHIP LEE LA AUTORIZACION, no `patients.status`. `status` no tiene escritor (nadie pone
            // nunca "inactive"), asi que el chip no aparecia jamas. La falta de autorizacion vigente si
            // tiene consecuencia real y hoy se descubre AL INTENTAR crear la evaluacion.
            //
            // Y NO ES ROJO CLINICO a proposito: `clinical-critical` significa riesgo del PACIENTE, y un
            // paciente que ejercio su derecho no esta en riesgo. El texto habla de la AUTORIZACION, no de
            // la persona: "Revocado" sonaria a que el revocado es el paciente.
            chip={
              p.sinAutorizacionVigente ? (
                <span
                  className="shrink-0 rounded-full border border-clinical-warning/40 bg-clinical-warning-bg px-2 py-0.5 text-xs font-medium text-clinical-warning"
                  title="Le falta alguna autorización necesaria vigente. No se le pueden crear evaluaciones nuevas."
                >
                  Sin autorización vigente
                </span>
              ) : null
            }
          />
        );
      })}
    </ListaFilas>
  );
}
