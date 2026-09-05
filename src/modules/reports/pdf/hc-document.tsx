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

// EL SOLAPAMIENTO DE "META TERAPEUTICA" (smoke de Santiago, 2026-09-02): la seccion llevaba
// `wrap={false}`, que le prohibe partirse entre dos hojas. Cuando una seccion NO CABE en lo que queda de
// hoja, `@react-pdf` la empuja a la siguiente; pero si tampoco cabe alli (o si arranca la hoja y se pasa),
// no tiene a donde empujarla y la PINTA ENCIMA de lo que sigue. Un parrafo largo con `wrap={false}` es
// justo ese caso.
//
// AHORA LAS SECCIONES SE PARTEN (que en un documento largo es lo normal) y lo que NO se parte es la
// unidad chica: la fila de un dato y el bloque de una recomendacion, que si es ilegible a medias. Es la
// misma regla que ya aplica la hoja impresa con `break-inside: avoid` sobre tablas y secciones.
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion}>
      {/* El titulo no se queda solo al pie de una hoja: viaja con al menos parte de su contenido. */}
      <Text style={styles.h2} minPresenceAhead={40}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.fila} wrap={false}>
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

        {/* LOS TRES PÁRRAFOS DEL DIAGNÓSTICO. Faltaban los SIETE bloques que dependen del snapshot, y
            todos por la misma razón: el lector no lo cargaba. Una historia clínica sin el diagnóstico
            funcional ni la composición corporal no es la historia clínica, es un resumen, y el paciente
            que la pide tiene derecho a la completa. */}
        {hc.motivoSinNarrativa ? (
          <Seccion titulo="Resumen del diagnóstico">
            {/* SE DICE POR QUÉ NO ESTÁ. Un bloque ausente sin explicación, en un documento probatorio, se
                lee como que no se evaluó. */}
            <Text style={styles.vacio}>{hc.motivoSinNarrativa}</Text>
          </Seccion>
        ) : (
          <>
            {hc.resumenProfesional ? (
              <Seccion titulo="Resumen diagnóstico · Nutricionista">
                <Text>{hc.resumenProfesional}</Text>
              </Seccion>
            ) : null}
            {hc.dfiParrafo ? (
              <Seccion titulo="Diagnóstico funcional">
                <Text>{hc.dfiParrafo}</Text>
              </Seccion>
            ) : null}
            {hc.metaTerapeutica ? (
              <Seccion titulo="Meta terapéutica">
                <Text>{hc.metaTerapeutica}</Text>
              </Seccion>
            ) : null}
          </>
        )}

        {/* LA COMPOSICIÓN CORPORAL. Peso y talla ya van arriba; aquí van las medidas del equipo que
            sostienen el diagnóstico, con su clasificación. */}
        <Seccion titulo="Composición corporal">
          {hc.composicion.length > 0 ? (
            hc.composicion.map((c) => (
              <View key={c.etiqueta} style={styles.fila} wrap={false}>
                <Text style={[styles.etiqueta, { width: 170 }]}>{c.etiqueta}</Text>
                <Text style={styles.valor}>{c.valor}</Text>
                <Text style={styles.valor}>{c.clasificacion ?? ""}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.vacio}>Esta evaluación no tiene medición de composición corporal.</Text>
          )}
        </Seccion>

        {/* LOS ÍNDICES ANI BIS-E. Aquí SÍ van, al revés que en el reporte del paciente: este es el
            documento técnico. Su §7.1 prohíbe los índices en lo que el paciente recibe COMO reporte; la
            historia que él mismo pide es otra cosa, es su registro clínico. */}
        <Seccion titulo="Índices ANI BIS-E alterados">
          {hc.indices.length === 0 ? (
            <Text style={styles.vacio}>Ningún índice quedó fuera de su rango de referencia.</Text>
          ) : null}
          {hc.indices.length > 0 ? (
            <View style={styles.fila} wrap={false}>
              <Text style={[styles.etiqueta, { width: 150, fontWeight: "bold" }]}>Índice</Text>
              <Text style={[styles.valor, { fontWeight: "bold" }]}>Valor</Text>
              <Text style={[styles.valor, { fontWeight: "bold" }]}>Clasificación</Text>
              <Text style={[styles.valor, { fontWeight: "bold" }]}>Referencia</Text>
            </View>
          ) : null}
          {hc.indices.map((i) => (
            <View key={i.codigo} style={styles.fila} wrap={false}>
              <Text style={[styles.etiqueta, { width: 150 }]}>{i.nombre}</Text>
              <Text style={styles.valor}>{i.valor ?? "—"}</Text>
              <Text style={styles.valor}>{i.clasificacion ?? "—"}</Text>
              <Text style={styles.valor}>{i.referencia ?? "—"}</Text>
            </View>
          ))}
        </Seccion>

        <Seccion titulo="Rutas de atención activadas">
          {hc.rutas.length > 0 ? (
            hc.rutas.map((r) => (
              <Text key={r.label} style={styles.item}>
                {r.label}
                {r.activacion ? ` · ${r.activacion}` : ""}
              </Text>
            ))
          ) : (
            <Text style={styles.vacio}>El diagnóstico no activó rutas de atención.</Text>
          )}
        </Seccion>

        {/* EL BLOQUE VA SIEMPRE, aunque este vacio (smoke de Santiago, 2026-09-02). En la pantalla estos
            dos bloques SI aparecen cuando no hay dato, diciendo "No se registró" y "Sin remisiones"; en el
            PDF se omitian, asi que el documento enviado tenia dos bloques menos que el impreso.
            Y en un documento probatorio la diferencia importa: un bloque AUSENTE se lee como que no se
            evaluo, mientras que uno que dice "no se registró" dice que se miro y no habia. */}
        <Seccion titulo="Objetivo del tratamiento">
          {hc.objetivoTratamiento && hc.objetivoTratamiento.trim() !== "" ? (
            <Text>{hc.objetivoTratamiento}</Text>
          ) : (
            // "No se registró" y no "no aplica": el objetivo SIEMPRE deberia estar en una consulta con
            // prescripcion; si falta, falta de verdad. Mismo texto que la pantalla.
            <Text style={styles.vacio}>No se registró</Text>
          )}
        </Seccion>

        {hc.plan ? (
          <Seccion titulo="Plan nutricional">
            <Dato etiqueta="GEB" valor={noRegistrado(hc.plan.geb, " kcal")} />
            <Dato etiqueta="GET" valor={noRegistrado(hc.plan.get, " kcal")} />
            <Dato etiqueta="Objetivo" valor={noRegistrado(hc.plan.kcalObjetivo, " kcal")} />
            <Dato etiqueta="Proteína" valor={noRegistrado(hc.plan.proteinaG, " g")} />
            <Dato etiqueta="Carbohidratos" valor={noRegistrado(hc.plan.carbohidratosG, " g")} />
            {/* Igual que en pantalla: el porcentaje es la decision del profesional. */}
            <Dato
              etiqueta="Grasas"
              valor={
                hc.plan.grasasPct == null
                  ? noRegistrado(hc.plan.grasasG, " g")
                  : `${noRegistrado(hc.plan.grasasG, " g")} (${hc.plan.grasasPct} %)`
              }
            />
            <Dato etiqueta="Actividad física" valor={noRegistrado(hc.plan.actividadFisica)} />
            {hc.plan.sodioMax != null ? (
              <Dato etiqueta="Sodio" valor={`< ${hc.plan.sodioMax.toLocaleString("es-CO")} mg/día`} />
            ) : null}
            {/* CONSTANCIA DE LAS CIFRAS FUERA DE LA REFERENCIA (P-109). La MISMA lista que la pantalla,
                que es la razón por la que se compone en `hc-composicion` y no en cada documento: una
                historia impresa que no registrara la desviación diría algo distinto del archivo. */}
            {hc.desviaciones.map((d) => (
              <Dato
                key={d.macro}
                etiqueta={`Decisión del profesional · ${d.macro}`}
                valor={`${d.cifra}: ${d.texto}.`}
              />
            ))}
          </Seccion>
        ) : null}

        <Seccion titulo="Recomendaciones">
          {hc.recomendaciones.length === 0 ? (
            <Text style={styles.vacio}>No se emitieron recomendaciones para este caso.</Text>
          ) : null}
          {hc.recomendaciones.map((r) => (
            <View key={r.titulo} style={{ marginBottom: 4 }} wrap={false}>
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

        <Seccion titulo="Remisiones">
          {hc.remisiones.length > 0 ? (
            hc.remisiones.map((r, i) => (
              <Text key={`${r.profesion}-${i}`} style={styles.item}>
                {r.fecha} · {r.profesion} · {r.estado}
                {r.motivo ? ` · ${r.motivo}` : ""}
              </Text>
            ))
          ) : (
            <Text style={styles.vacio}>No se remitió a otro profesional en esta consulta.</Text>
          )}
        </Seccion>

        <Seccion titulo="Observaciones del profesional">
          {hc.observaciones.length === 0 ? (
            // No dice "sin observaciones" a secas: en un documento probatorio, un bloque vacio sin
            // explicar deja la duda de si el profesional no escribio nada o si el sistema no lo trajo.
            // Mismo texto que la pantalla.
            <Text style={styles.vacio}>El profesional no registró observaciones en esta consulta.</Text>
          ) : null}
          {hc.observaciones.map((o, i) => (
            <View key={`${o.fecha}-${i}`} style={{ marginBottom: 3 }} wrap={false}>
              <Text style={{ color: "#6b7280", fontSize: 9 }}>
                {o.fecha}
                {o.profesion ? ` · ${o.profesion}` : ""}
              </Text>
              <Text>{o.texto}</Text>
            </View>
          ))}
        </Seccion>

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
