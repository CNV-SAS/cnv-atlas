import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { HistoriaClinicaDoc } from "../data/reports-view-types";

// LA HISTORIA CLINICA EN PDF, para adjuntarla al correo del paciente.
//
// POR QUE ESTE CAMINO Y NO RENDERIZAR LA PANTALLA (decision de Santiago, 2026-09-02, con la medicion
// delante): la tercera via (un Chromium sin interfaz que imprima la pagina que ya existe) es mas elegante
// en teoria y paga con una superficie AUTENTICADA NUEVA PARA PHI, ademas de una dependencia pesada y
// arranques en frio. Reescribir los bloques sobre `@react-pdf`, que ya esta aprobado y ya tiene andamiaje,
// sale mas barato y no abre superficie.
//
// LA CONDICION QUE LO HACE SEGURO: este documento NO COMPONE NADA. Recibe un `HistoriaClinicaDoc` armado
// por `getHistoriaClinicaDoc`, que llama a los MISMOS lectores que la pantalla y a la MISMA composicion.
// Dos presentaciones de un dato no se desincronizan; dos lecturas si. Con candado sobre eso.
//
// EL DISEÑO ESTA PENDIENTE, y va con el del reporte del paciente (BACKLOG): hoy los dos son texto con poca
// jerarquia, y se hacen juntos para que se parezcan entre si. Aqui la estructura es correcta y sobria; lo
// que falta es la pasada tipografica.

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, lineHeight: 1.45, color: "#1f2937" },
  titulo: { fontSize: 15, fontWeight: "bold", color: "#16324f" },
  sub: { fontSize: 9, color: "#6b7280", marginBottom: 14 },
  seccion: { marginBottom: 12 },
  h2: { fontSize: 11, fontWeight: "bold", marginBottom: 4, color: "#16324f" },
  fila: { flexDirection: "row", paddingVertical: 2 },
  etiqueta: { width: 120, color: "#6b7280" },
  valor: { flex: 1 },
  item: { marginBottom: 1 },
  vacio: { color: "#6b7280", fontStyle: "italic" },
  sello: {
    marginTop: 10,
    borderTopWidth: 0.5,
    borderColor: "#d1d5db",
    paddingTop: 8,
    fontSize: 9,
    color: "#374151",
  },
  firma: { marginTop: 18, borderTopWidth: 0.5, borderColor: "#9ca3af", paddingTop: 6, fontSize: 9 },
});

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion} wrap={false}>
      <Text style={styles.h2}>{titulo}</Text>
      {children}
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

const noRegistrado = (v: string | number | null | undefined, unidad = ""): string =>
  v == null || v === "" ? "No registrado" : `${v}${unidad}`;

export function HistoriaClinicaDocument({ hc }: { hc: HistoriaClinicaDoc }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.titulo}>Historia clínica</Text>
        <Text style={styles.sub}>
          {hc.paciente} · Consulta del {hc.fechaConsulta}
        </Text>

        <Seccion titulo="Datos del paciente">
          <Dato etiqueta="Nombre" valor={hc.paciente} />
          <Dato etiqueta="Edad" valor={noRegistrado(hc.edad, " años")} />
          <Dato etiqueta="Sexo" valor={noRegistrado(hc.sexo)} />
          <Dato etiqueta="Peso" valor={noRegistrado(hc.pesoKg, " kg")} />
          <Dato etiqueta="Talla" valor={noRegistrado(hc.tallaCm, " cm")} />
          <Dato etiqueta="Profesional" valor={hc.profesional} />
        </Seccion>

        <Seccion titulo="Motivo de consulta">
          {hc.motivos.length > 0 ? (
            hc.motivos.map((m) => (
              <Text key={m} style={styles.item}>
                {m}
              </Text>
            ))
          ) : (
            <Text style={styles.vacio}>No registrado</Text>
          )}
        </Seccion>

        <Seccion titulo="Antecedentes">
          {hc.antecedentes.some((g) => g.items.length > 0) ? (
            hc.antecedentes
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <View key={g.grupo} style={{ marginBottom: 4 }}>
                  <Text style={{ fontWeight: "bold" }}>{g.grupo}</Text>
                  {g.items.map((i) => (
                    <Text key={i} style={styles.item}>
                      {i}
                    </Text>
                  ))}
                </View>
              ))
          ) : (
            <Text style={styles.vacio}>El paciente no declaró antecedentes.</Text>
          )}
        </Seccion>

        {hc.objetivoTratamiento ? (
          <Seccion titulo="Objetivo del tratamiento">
            <Text>{hc.objetivoTratamiento}</Text>
          </Seccion>
        ) : null}

        {hc.plan ? (
          <Seccion titulo="Plan nutricional">
            <Dato etiqueta="GEB" valor={noRegistrado(hc.plan.geb, " kcal")} />
            <Dato etiqueta="GET" valor={noRegistrado(hc.plan.get, " kcal")} />
            <Dato etiqueta="Objetivo" valor={noRegistrado(hc.plan.kcalObjetivo, " kcal")} />
            <Dato etiqueta="Proteína" valor={noRegistrado(hc.plan.proteinaG, " g")} />
            <Dato etiqueta="Carbohidratos" valor={noRegistrado(hc.plan.carbohidratosG, " g")} />
            <Dato etiqueta="Grasas" valor={noRegistrado(hc.plan.grasasG, " g")} />
            <Dato etiqueta="Actividad física" valor={noRegistrado(hc.plan.actividadFisica)} />
            {hc.plan.sodioMax != null ? (
              <Dato etiqueta="Sodio" valor={`< ${hc.plan.sodioMax.toLocaleString("es-CO")} mg/día`} />
            ) : null}
          </Seccion>
        ) : null}

        {hc.recomendaciones.length > 0 ? (
          <Seccion titulo="Recomendaciones">
            {hc.recomendaciones.map((r) => (
              <View key={r.titulo} style={{ marginBottom: 4 }}>
                <Text style={{ fontWeight: "bold" }}>{r.titulo}</Text>
                {/* UN BLOQUE PENDIENTE SE DICE, no se omite: omitirlo haría creer que no aplicaba. */}
                {r.pendiente ? (
                  <Text style={styles.vacio}>
                    Este bloque necesita cifras que esta evaluación no tiene.
                  </Text>
                ) : (
                  r.items.map((i) => (
                    <Text key={i} style={styles.item}>
                      {i}
                    </Text>
                  ))
                )}
              </View>
            ))}
          </Seccion>
        ) : null}

        {hc.remisiones.length > 0 ? (
          <Seccion titulo="Remisiones">
            {hc.remisiones.map((r, i) => (
              <Text key={`${r.profesion}-${i}`} style={styles.item}>
                {r.fecha} · {r.profesion} · {r.estado}
                {r.motivo ? ` · ${r.motivo}` : ""}
              </Text>
            ))}
          </Seccion>
        ) : null}

        {hc.observaciones.length > 0 ? (
          <Seccion titulo="Observaciones del profesional">
            {hc.observaciones.map((o, i) => (
              <View key={`${o.fecha}-${i}`} style={{ marginBottom: 3 }}>
                <Text style={{ color: "#6b7280", fontSize: 9 }}>
                  {o.fecha}
                  {o.profesion ? ` · ${o.profesion}` : ""}
                </Text>
                <Text>{o.texto}</Text>
              </View>
            ))}
          </Seccion>
        ) : null}

        <Seccion titulo="Próxima consulta">
          <Text>{hc.proximaCita ?? "No agendada"}</Text>
        </Seccion>

        {/* EL SELLO DE CONSENTIMIENTO: la mitad legal del derecho de acceso. Dice bajo qué autorizaciones se
            recogió esta consulta, y con QUÉ VERSIÓN del texto: "hubo permiso" sin decir de qué texto no es
            constancia de nada, porque las autorizaciones cambian de redacción y lo que se pactó fue el
            texto de SU versión. Va antes de la firma, que es donde cierra el documento. */}
        <View style={styles.sello}>
          <Text style={{ fontWeight: "bold" }}>Autorizaciones del paciente</Text>
          <Text>
            Consentimiento de esta consulta: versión {hc.consentVersion ?? "no registrada"}
          </Text>
          {hc.autorizaciones.length > 0 ? (
            hc.autorizaciones.map((a) => (
              <Text key={a.tipo} style={styles.item}>
                {a.tipo}: {a.vigente ? "Vigente" : a.revocada ? "Revocada" : "No otorgada"}
              </Text>
            ))
          ) : (
            <Text style={styles.vacio}>No hay autorizaciones registradas para este paciente.</Text>
          )}
        </View>

        <View style={styles.firma}>
          <Text>{hc.profesional}</Text>
          <Text style={{ color: "#6b7280" }}>Profesional tratante · {hc.fechaConsulta}</Text>
        </View>
      </Page>
    </Document>
  );
}
