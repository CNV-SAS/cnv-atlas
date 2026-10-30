import { Document, Page, Text, View } from "@react-pdf/renderer";

import type { PlanPaciente } from "../data/reports-view-types";
import {
  BloqueAlimentacion,
  BloqueDistribucion,
  BloqueEvitar,
  BloqueIntercambio,
  BloqueMenu,
  BloqueMeta,
  BloqueRecomendaciones,
} from "./bloques-del-plan";
import { MarcaDeFondo } from "./marca-de-fondo";
import { styles } from "./estilos-del-pdf";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL PLAN DEL PACIENTE, COMO PDF  ·  EL ADJUNTO DEL CORREO
//
// ═══ DE DONDE SALE (Santiago, 2026-10-28) ═══
//
// *"Que el correo al paciente adjunte TAMBIEN la hoja del plan cuando haya prescripcion emitida. Asi la
// cifra de calorias y proteina le llega por su canal."*
//
// Es la respuesta a la duda que quedo abierta al sacar los cuatro bloques del informe: la §7.1 de Gildardo
// dice lo que el PACIENTE RECIBE, y hasta hoy el correo adjuntaba solo el informe, asi que el plan
// dependia de que su profesional se acordara de imprimirlo. Ahora sale por el mismo canal, en su propia
// hoja, que es lo que su §7.1 pide desde el principio: el plan COMPLETO, no el informe de composicion.
//
// ═══ EL ORDEN ES EL DE LA HOJA IMPRESA, no el que tenia el informe ═══
//
// `plan-imprimible.tsx` es el documento que el paciente ya conoce (el que su profesional le entrega en la
// consulta), asi que el adjunto es ESE y no una tercera forma del mismo plan. Dos ordenes del mismo plan se
// leen como dos planes, y el candado (`plan-paciente.test.ts`) compara los dos ordenes.
//
// ═══ LO QUE NO LLEVA ═══
//
// Ni diagnostico, ni indicadores, ni trayectoria, ni suplementos, ni remisiones: todo eso es el INFORME, y
// esta es la hoja de la cocina. Un adjunto que repitiera el informe volveria a poner al paciente con dos
// papeles que compiten, que es justo lo que se acabo de arreglar.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type PlanMeta = {
  patientName: string;
  documentLabel: string;
  /** Fecha de la CONSULTA, ya formateada. Es la del plan: la medicion no fecha una prescripcion. */
  consultationDate?: string | null;
  /** Quien lo atendio, con la profesion ya como etiqueta. null = no se pudo resolver y la linea no sale. */
  profesional?: { nombre: string; profesion: string | null } | null;
};

export function PlanDocument({ plan, meta }: { plan: PlanPaciente; meta: PlanMeta }) {
  return (
    <Document title={`Plan ANI-BIS-E ${meta.documentLabel}`} author="Connected Nutrition Ventures">
      {/* CARTA, como todo lo que se imprime en Atlas: en Colombia el papel es carta, y A4 impresa en carta
          deja margenes desiguales (Santiago, 2026-09-20). */}
      <Page size="LETTER" style={styles.page}>
        {/* LA MISMA MARCA QUE EL INFORME, y por eso es un componente: los dos llegan en el mismo correo,
            y uno decorado junto a otro sin decorar se lee como dos sistemas distintos. Va LO PRIMERO para
            quedar detras del contenido. */}
        <MarcaDeFondo />
        <Text style={styles.title}>Tu plan de alimentación</Text>
        <Text style={styles.subtitle}>Connected Nutrition Ventures</Text>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Paciente</Text>
            <Text>{meta.patientName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Documento</Text>
            <Text>{meta.documentLabel}</Text>
          </View>
          {meta.consultationDate ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Fecha de la consulta</Text>
              <Text>{meta.consultationDate}</Text>
            </View>
          ) : null}
          {meta.profesional ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Te atendió</Text>
              <Text>
                {meta.profesional.nombre}
                {meta.profesional.profesion ? ` · ${meta.profesional.profesion}` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        <BloqueMeta plan={plan} />
        <BloqueAlimentacion plan={plan} />
        <BloqueEvitar plan={plan} />
        <BloqueDistribucion plan={plan} />
        <BloqueRecomendaciones plan={plan} />
        <BloqueIntercambio plan={plan} />
        <BloqueMenu plan={plan} />

        <Text style={styles.footer} fixed>
          Connected Nutrition Ventures · Este plan lo emitió tu profesional de salud. Si algo no te queda
          claro, pregúntaselo antes de empezar.
        </Text>
      </Page>
    </Document>
  );
}
