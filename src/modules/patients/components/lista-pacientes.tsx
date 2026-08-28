"use client";

import { useMemo, useState } from "react";

import { FilaLista } from "@/components/shared/fila-lista";
import { formatDateOnlyShort } from "@/lib/format/date";
import { edadEnAnios } from "../format";
import type { PatientListItem } from "../types";

// Lista de pacientes: filas de dos lineas + buscador (BRAND, "si busca, densidad").
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="buscar-paciente" className="text-sm font-medium text-foreground">
          Buscar paciente
        </label>
        <input
          id="buscar-paciente"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Nombre o número de documento"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>

      <div className="rounded-xl border border-border">
        {filtrados.length === 0 ? (
          // Dos vacios DISTINTOS: "no encontré lo que buscas" y "no tienes pacientes" son situaciones
          // opuestas, y decirle "no hay pacientes" a quien acaba de escribir mal un apellido lo manda a
          // buscar un problema que no existe.
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {busqueda.trim()
              ? `Ningún paciente coincide con "${busqueda.trim()}".`
              : "Todavía no tienes pacientes asignados."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtrados.map((p) => {
              const anos = edadEnAnios(p.birthDate);
              // Linea de metadatos: los cuatro datos secundarios en el ancho de uno. Se omite lo que no
              // hay en vez de escribir "-": un guion ocupa lo mismo que un dato y no dice nada.
              // EL ORDEN NO ES ARBITRARIO: lo mas mirado primero. En estrecho la linea envuelve, asi que
              // no se pierde nada, pero lo que queda en la primera linea es lo que se lee de un vistazo.
              // La ULTIMA CONSULTA abre porque es lo que responde "a quien no veo hace meses"; el
              // DOCUMENTO cierra porque es por lo que se BUSCA (y de eso ya se encarga el buscador de
              // arriba), no lo que se lee. Antes abria el documento y en un telefono la fecha se cortaba.
              const meta = [
                p.lastEvaluationDate ? `Última: ${formatDateOnlyShort(p.lastEvaluationDate)}` : null,
                p.evaluationCount > 0
                  ? `${p.evaluationCount} ${p.evaluationCount === 1 ? "evaluación" : "evaluaciones"}`
                  : "Sin evaluaciones",
                anos !== null ? `${anos} años` : null,
                `${p.documentType} ${p.documentNumber}`.trim() || "Sin documento",
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <FilaLista
                  key={p.patientId}
                  href={`/pacientes/${p.patientId}`}
                  titulo={`${p.firstName} ${p.lastName}`.trim() || "Sin nombre"}
                  meta={meta}
                  // CHIP SOLO SI ES EXCEPCIONAL (BRAND): "Activo" es lo normal y no lleva distintivo;
                  // gastar ancho en lo que casi siempre es igual es lo contrario de una lista escaneable.
                  chip={
                    p.status !== "active" ? (
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Inactivo
                      </span>
                    ) : null
                  }
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Cuantos se ven, para que el filtro no esconda su efecto: si alguien busca y quedan 2 de 40,
          tiene que saber que hay 38 fuera de la vista. */}
      <p className="text-xs text-muted-foreground">
        {busqueda.trim()
          ? `${filtrados.length} de ${pacientes.length} pacientes`
          : `${pacientes.length} ${pacientes.length === 1 ? "paciente" : "pacientes"}`}
      </p>
    </div>
  );
}
