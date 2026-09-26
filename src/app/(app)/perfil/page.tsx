import { FileText, UserCheck, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { Panel } from "@/components/shared/panel";
import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { PROFESSION_LABELS } from "@/modules/auth/admin-validations";
import { requireUser } from "@/modules/auth/session";
import { ModalidadDelIntegrante } from "@/modules/payments/components/modalidad-del-integrante";
import { leerModalidad } from "@/modules/payments/data/modalidad-writer";
import { listarAdjuntos, registrarRutQueYaEstaba } from "@/modules/professionals/data/adjuntos-writer";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { BankAccountForm, MisDatosForm, TaxIdentityForm } from "@/modules/professionals/components/tax-status-form";
import { PerfilTabs } from "@/modules/professionals/components/perfil-tabs";
import { getPerfilDelIntegrante } from "@/modules/professionals/data/perfil-reader";
import { getTaxStatusView } from "@/modules/professionals/data/tax-status-reader";

export const metadata = { title: "Mi perfil - Atlas" };

// ═══ EL PERFIL DEL INTEGRANTE, EN PESTAÑAS (2026-09-25) ═══
//
// Antes era un panel con dos fieldsets: quien venia a cambiar su cuenta bancaria tenia que atravesar su
// clasificacion tributaria. Se parte en las cuatro secciones que son asuntos distintos, con la estructura de
// la referencia que paso Santiago (cabecera de identidad, tres indicadores, pestañas) y nuestra paleta.
//
// LA PESTAÑA DE SUS DATOS ES CASI TODA DE SOLO LECTURA, y eso es el contenido, no una limitacion: nombre,
// correo y profesion los pone un administrador, asi que se ven como DATOS y no como campos vacios, con el
// aviso de a quien contactar. Un campo editable que al guardar no cambia nada seria peor que un dato fijo.
//
// EL DOCUMENTO SE MUESTRA AQUI PERO SE EDITA EN TRIBUTARIA, y no se duplica el campo: el unico documento que
// Atlas guarda del integrante es el tributario. Dos campos para el mismo numero son dos fuentes que divergen,
// que es exactamente el defecto que acabamos de arreglar en el lote de la remesa.

const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

const ESTADO: Record<string, string> = {
  active: "Activo",
  invited: "Invitado",
  suspended: "Suspendido",
  inactive: "Inactivo",
};

const DOCUMENTO: Record<string, string> = {
  CC: "Cédula de ciudadanía",
  CE: "Cédula de extranjería",
  TI: "Tarjeta de identidad",
  PA: "Pasaporte",
  NIT: "NIT",
};

const TIPO_DE_ADJUNTO: Record<string, string> = {
  rut: "RUT",
  certificado_bancario: "Certificado bancario",
  tarjeta_profesional: "Tarjeta profesional",
  diploma: "Diploma",
  otro: "Otro documento",
};

const fechaCorta = (iso: string | null) =>
  iso == null ? "" : new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota" });

const TIPO_DE_DOCUMENTO_FIRMADO: Record<string, string> = {
  anexo3: "Anexo 3 · Tratamiento",
};

/** Un dato que no se edita: rótulo arriba, valor en caja. Se ve como dato, no como campo. */
function Dato({ rotulo, valor, nota }: { rotulo: string; valor: string | null; nota?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        {valor ?? <span className="text-muted-foreground">Sin registrar</span>}
      </div>
      {nota ? <span className="text-xs text-muted-foreground">{nota}</span> : null}
    </div>
  );
}

export default async function PerfilPage() {
  const user = await requireUser();
  const professionalId = await getProfessionalProfileIdByUser(user.id);
  if (!professionalId) redirect("/no-autorizado");

  // EL RUT QUE YA ESTABA gana su fila de historial la primera vez que alguien mira. Sin esto, un integrante que
  // subio su RUT antes de la 0179 veria la pestaña diciendo "no has subido ninguno" junto al enlace para verlo,
  // que es la contradiccion que hay que evitar. Va antes de leer, para que la lectura ya lo incluya.
  await registrarRutQueYaEstaba(professionalId);

  const [perfil, view, modalidad, adjuntos] = await Promise.all([
    getPerfilDelIntegrante(professionalId, user.id),
    getTaxStatusView(professionalId),
    leerModalidad(professionalId),
    listarAdjuntos(professionalId),
  ]);
  if (!perfil) redirect("/no-autorizado");

  const profesion = PROFESSION_LABELS[perfil.profesion as keyof typeof PROFESSION_LABELS] ?? perfil.profesion;
  const documento =
    perfil.documento.numero != null
      ? `${DOCUMENTO[perfil.documento.tipo ?? ""] ?? perfil.documento.tipo ?? ""} ${perfil.documento.numero}${
          perfil.documento.dv ? `-${perfil.documento.dv}` : ""
        }`.trim()
      : null;
  const { completitud, margen } = perfil;

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6">
      <TituloPantalla
        titulo={perfil.nombre}
        descripcion={`${profesion} · ${ESTADO[perfil.estado] ?? perfil.estado}. Tus datos para la operación con CNV.`}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TarjetaMetrica
          rotulo="Documentos firmados"
          valor={String(perfil.documentosFirmados.length)}
          icono={FileText}
          detalle={
            perfil.documentosFirmados.length > 0
              ? perfil.documentosFirmados
                  .map((d) => TIPO_DE_DOCUMENTO_FIRMADO[d.tipo] ?? d.tipo)
                  .join(", ")
              : "Ninguno todavía"
          }
        />
        <TarjetaMetrica
          rotulo="Tu perfil"
          valor={`${completitud.porcentaje} %`}
          icono={UserCheck}
          // LA UNICA ACCIONABLE DE LAS TRES, y la regla de la tarjeta es justo esa: una metrica tiene que
          // decir QUE HACER. Las otras dos son cifras que se consultan; esta nombra trabajo pendiente, y
          // solo se enciende cuando de verdad falta algo.
          acento={completitud.faltantes.length > 0}
          detalle={
            completitud.faltantes.length === 0
              ? "Completo"
              : `Falta: ${completitud.faltantes.join("; ")}`
          }
        />
        {/* ═══ "MARGEN" Y NO "COMISION" ═══ Es la palabra del modelo comercial (§13: "ambas modalidades dejan
            al Integrante el mismo margen del 20 %"), y es la única verdadera en las dos modalidades: en
            Comisión lo que recibe ES una comisión, pero en Distribución es un descuento comercial, y de esa
            diferencia depende su tratamiento tributario. */}
        <TarjetaMetrica
          rotulo="Tu margen"
          valor={pesos(margen.causado)}
          icono={Wallet}
          detalle={
            margen.pendiente !== 0
              ? `${pesos(margen.pendiente)} pendiente de liquidar`
              : "Todo liquidado"
          }
        />
      </section>

      <PerfilTabs
        datos={
          <Panel titulo="Mis datos">
            <p className="text-sm text-muted-foreground">
              Tu nombre, tu correo y tu profesión los registra un administrador de CNV, así que aquí solo se
              ven. Si alguno está mal o cambió, escríbele a un administrador y él lo corrige.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Dato rotulo="Nombre" valor={perfil.nombre} />
              <Dato rotulo="Correo" valor={perfil.correo} />
              <Dato rotulo="Profesión" valor={profesion} />
              <Dato
                rotulo="Registro profesional"
                valor={perfil.registroProfesional}
                nota={
                  perfil.registroProfesional
                    ? undefined
                    : "Sin registro no puedes ejercer. Pídeselo a un administrador."
                }
              />
              <Dato
                rotulo="Documento de identidad"
                valor={documento}
                nota="Se edita en la pestaña Tributaria, que es donde lo declaras."
              />
            </div>

            {/* ═══ Y LO QUE SI EDITA (0177) ═══ En su propio formulario y no junto a los datos fijos: si
                estuvieran mezclados habria que deshabilitar los de arriba, y un campo deshabilitado dentro de
                un formulario invita a intentar escribirlo. Aqui el formulario contiene solo lo que se guarda. */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="font-bold">Tu contacto y tu consultorio</h3>
              <p className="text-sm text-muted-foreground">
                Estos sí los cambias tú, cuando cambien.
              </p>
              <MisDatosForm current={perfil.contacto} />
            </div>
          </Panel>
        }
        tributaria={
          <Panel titulo="Datos tributarios">
            <p className="text-sm text-muted-foreground">
              CNV te paga tu margen y, como agente de retención, retiene el impuesto en la fuente y te entrega
              el certificado. Con tu RUT tomamos tu clasificación del documento, no de lo que recuerdes.
              {view.verified ? (
                <span className="ml-1 font-medium text-primary">Tus datos están verificados.</span>
              ) : view.submitted ? (
                <span className="ml-1 font-medium text-foreground">
                  Recibimos tus datos; los estamos verificando. Puedes actualizarlos si algo cambió.
                </span>
              ) : (
                <span className="ml-1 font-medium text-foreground">
                  Mientras no los completes, tu margen queda a la espera (ya es tuyo; solo falta esto).
                </span>
              )}
            </p>
            {view.rejected ? (
              <p className="rounded-md bg-attention-bg px-3 py-2 text-sm text-attention">
                Tu RUT fue devuelto: {view.rejectedReason ?? "sin motivo registrado"}. Sube uno nuevo.
              </p>
            ) : null}
            <TaxIdentityForm professionalId={professionalId} current={view.fields} />

            {/* ═══ SU MODALIDAD, EN SOLO LECTURA ═══ Las dos cards son texto del modelo comercial §13, y el
                propio §13 dice quien decide: "La modalidad activa la asigna un administrador de CNV". Asi que
                aqui se VE cual le aplica y por que las dos se diferencian, y no se ofrece cambiarla: no es una
                preferencia suya, decide quien le factura al paciente y si su margen lleva retencion. */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="font-bold">Tu modalidad de consignación</h3>
              <p className="text-sm text-muted-foreground">
                La asigna un administrador de CNV. Las dos te dejan el mismo margen del 20 %: lo que cambia es
                la operación, el riesgo y la carga administrativa. Si quieres cambiarla, escríbele a un
                administrador.
              </p>
              <ModalidadDelIntegrante
                professionalId={professionalId}
                modalidad={modalidad.modalidad}
                rigeDesde={modalidad.rigeDesde}
                pendiente={modalidad.pendiente}
                proximoCorte={modalidad.proximoCorte}
                puedeCambiar={false}
              />
            </div>
          </Panel>
        }
        bancaria={
          <Panel titulo="Cuenta bancaria">
            <BankAccountForm current={view.fields} />
          </Panel>
        }
        adjuntos={
          <Panel titulo="Tus documentos">
            <p className="text-sm text-muted-foreground">
              El vigente de cada tipo y los anteriores. Un documento no se borra cuando subes uno nuevo: queda
              como reemplazado, con su fecha, porque lo que se verificó sobre él sigue explicando decisiones que
              ya se tomaron.
            </p>
            {adjuntos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no has subido ningún documento. El RUT se sube en la pestaña Tributaria.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {adjuntos.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2">
                    <span>
                      {TIPO_DE_ADJUNTO[a.kind] ?? a.kind}
                      {a.originalName ? <span className="text-muted-foreground"> · {a.originalName}</span> : null}
                      {a.documentDate ? (
                        <span className="text-muted-foreground"> · del {a.documentDate}</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3">
                      {a.vigente ? (
                        <span className="text-xs font-medium text-primary">Vigente</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Reemplazado el {fechaCorta(a.reemplazadoEn)}
                        </span>
                      )}
                      {/* SOLO EL VIGENTE SE PUEDE ABRIR: la ruta /rut/[id] sirve el que dice el perfil, que es
                          el vigente. Ofrecer el enlace en uno reemplazado abriria el nuevo, diciendo algo
                          falso. Servir los anteriores es trabajo aparte y no lo pidio nadie. */}
                      {a.vigente && a.kind === "rut" ? (
                        <a
                          href={`/rut/${professionalId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          Verlo
                        </a>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        }
      />
    </div>
  );
}
