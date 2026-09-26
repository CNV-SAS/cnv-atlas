import { FileText, UserCheck, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { Panel } from "@/components/shared/panel";
import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { PROFESSION_LABELS } from "@/modules/auth/admin-validations";
import { requireUser } from "@/modules/auth/session";
import { getProfessionalProfileIdByUser } from "@/modules/payments/data/payments-repository";
import { BankAccountForm, TaxIdentityForm } from "@/modules/professionals/components/tax-status-form";
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

  const [perfil, view] = await Promise.all([
    getPerfilDelIntegrante(professionalId, user.id),
    getTaxStatusView(professionalId),
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
          </Panel>
        }
        bancaria={
          <Panel titulo="Cuenta bancaria">
            <BankAccountForm current={view.fields} />
          </Panel>
        }
        adjuntos={
          <Panel titulo="Adjuntos">
            {/* PENDIENTE DE DECISION, y se dice en vez de dejar la pestaña vacía: hoy solo se guarda EL ULTIMO
                RUT (una sola ruta en la fila), así que no hay historial que mostrar. Construirlo es la
                decisión 2 del plan del 2026-09-25. */}
            <p className="text-sm text-muted-foreground">
              Aquí va a vivir el historial de tus documentos. Hoy Atlas guarda tu RUT vigente
              {view.fields.rutUploaded ? (
                <>
                  {" "}
                  (
                  <a
                    href={`/rut/${professionalId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    verlo
                  </a>
                  )
                </>
              ) : (
                " (todavía no has subido ninguno)"
              )}
              , y los anteriores no quedan listados. El historial está dimensionado y espera una decisión.
            </p>
          </Panel>
        }
      />
    </div>
  );
}
