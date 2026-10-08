"use client";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { bloqueCls } from "@/components/shared/bloque";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { NoLosAdquiereForm } from "./no-los-adquiere-form";
import { YuxtaposicionAlergenos } from "@/modules/nutraceuticals/components/yuxtaposicion-alergenos";

import { saveNutraceuticalsAction, type TreatmentActionState } from "../actions";
// prescriptionSignature vive en el modulo NEUTRO (no aqui): la llama tambien page.tsx (servidor), y una
// funcion exportada por un "use client" no puede invocarse desde el servidor (tumba la pagina, RSC boundary).
import { estadoParaPrescribir, LEYENDA_DISPONIBILIDAD } from "@/modules/nutraceuticals/disponibilidad";
import { prescriptionSignature } from "../data/protocol-signature";
import type { TreatmentProtocol } from "../data/treatment-view-types";
import { resolveRecommendation } from "../nutraceuticals-recommendation";

const EMPTY: TreatmentActionState = { error: null, success: null, warning: null };

// Etiqueta de disponibilidad comercial (dato del producto): que significa para el paciente.

type NutraLine = { nutraceuticalId: string; name: string; dosage: string; durationDays: string };

// Nutraceuticos, en la subpestaña Rutas (checkpoint 2.3). VISIBLE para toda profesion (Opcion A): si el
// medico va a decidir sobre el paciente necesita saber que se le esta dando (interacciones farmaco-nutriente:
// warfarina/vitK, metformina/B12, corticoides/vitD). Pero EDITAR la prescripcion es solo del nutricionista;
// el resto la ve en modo consulta (lectura). Guardado propio (saveNutraceuticals) con candado y firma de
// remonte, partido del protocolo para no pisarse en bloque.
export function NutraceuticalsSection({
  evaluationId,
  protocol,
  canPrescribe,
  ventaPosteriorAlNo,
  dondeEsta,
}: {
  evaluationId: string;
  protocol: TreatmentProtocol;
  canPrescribe: boolean; // el actor es nutricionista
  /**
   * DONDE ESTA CADA PRODUCTO, por id: en su vitrina y en la bodega. Lo calcula la PAGINA, que es quien ya lo
   * calcula para el bloque de venta, y por eso el chip y el bloque no pueden discrepar: es la misma fuente.
   *
   * Sin esto el chip solo podia hablar del catalogo, y decia que un producto se entrega en consulta mientras el
   * bloque de abajo decia que no hay ninguno (Santiago, 2026-10-08).
   */
  dondeEsta?: Record<string, { propias: number; enCentral: number }>
  /** La venta pagada mas reciente POSTERIOR al "no los adquiere", si la hay. La calcula la pagina, que es
   *  quien tiene las ventas de la consulta. */
  ventaPosteriorAlNo?: string | null;
}) {
  const [state, formAction, pending] = useActionState(saveNutraceuticalsAction, EMPTY);
  useFormToastRefreshOnSuccess(state);
  const [nutras, setNutras] = useState<NutraLine[]>(
    protocol.nutraceuticals.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      name: n.name,
      dosage: n.dosage ?? "",
      durationDays: n.durationDays?.toString() ?? "",
    })),
  );
  const [pickId, setPickId] = useState("");
  /** Se intentó guardar sin prescribir nada y sin registrar la decisión del paciente. Ver el `onSubmit`. */
  const [faltaCerrar, setFaltaCerrar] = useState(false);

  const recommended = resolveRecommendation(protocol.recommendedNutraceuticals, protocol.catalog);
  // LAS DOS LISTAS SALEN DE LA PROPIEDAD DEL PRODUCTO, no de una lista de nombres a mano: un producto de
  // tercero nuevo aparece en su bloque sin que nadie lo agregue aqui.
  // LOS RECOMENDADOS NO SE REPITEN ABAJO (Santiago, 2026-09-28). El desplegable de "lo que el modelo no
  // recomendo" traia el catalogo entero, incluidos los que estan arriba en su propia lista. Ademas de repetir,
  // contradecia su rotulo: ofrecia como "no recomendado" algo que el modelo SI recomendo.
  const idsRecomendados = new Set(
    recommended.map((r) => (r.status === "en_catalogo" ? r.product.id : null)).filter((id): id is string => id != null),
  );
  const nutraceuticosDeCnv = protocol.catalog.filter(
    (c) => c.ownership !== "tercero" && !idsRecomendados.has(c.id),
  );
  const productosDeTercero = protocol.catalog.filter((c) => c.ownership === "tercero");
  const isAdded = (id: string) => nutras.some((n) => n.nutraceuticalId === id);
  // El producto del desplegable, para poner sus declaraciones junto a las del paciente mientras elige.
  const seleccionado = protocol.catalog.find((c) => c.id === pickId) ?? null;
  const addProduct = (id: string) => {
    if (!id || isAdded(id)) return;
    const item = protocol.catalog.find((c) => c.id === id);
    if (!item) return;
    setNutras((prev) => [...prev, { nutraceuticalId: id, name: item.name, dosage: "", durationDays: "" }]);
  };
  // CAMBIOS SIN GUARDAR. Es el tercero de los tres estados que antes se confundian: agregar un producto
  // solo cambia estado LOCAL, y todo lo de abajo (la pregunta de si lo adquiere, la entrega) lee del
  // SERVIDOR. Sin este aviso, el profesional agregaba, no guardaba, y el resto de la seccion se
  // comportaba como si no hubiera prescrito nada, sin decir por que. Y al reves: quitar un producto sin
  // guardar dejaba la entrega mostrandolo, que es lo que se veia como defecto.
  //
  // Se compara contra lo GUARDADO (protocol.nutraceuticals), que es la misma fuente que leen los bloques
  // de abajo: si comparara contra otra cosa, el aviso podria decir "guardado" mientras la entrega sigue
  // viendo lo viejo.
  const guardadoFirma = JSON.stringify(
    protocol.nutraceuticals.map((n) => [n.nutraceuticalId, n.dosage ?? "", n.durationDays?.toString() ?? ""]),
  );
  const enPantallaFirma = JSON.stringify(
    nutras.map((n) => [n.nutraceuticalId, n.dosage.trim(), n.durationDays.trim()]),
  );
  const haycambiosSinGuardar = guardadoFirma !== enPantallaFirma;

  const nutrasPayload = JSON.stringify(
    nutras.map((n) => ({
      nutraceuticalId: n.nutraceuticalId,
      dosage: n.dosage.trim() === "" ? null : n.dosage.trim(),
      durationDays: n.durationDays.trim() === "" ? null : Number(n.durationDays),
    })),
  );

  // --- VISTA DE CONSULTA (no nutricionista): recomendados + prescritos en lectura, sin controles ---
  if (!canPrescribe) {
    return (
      <section className={bloqueCls("derivado")}>
      {/* CONTRAINDICACIONES DEL PACIENTE (2026-08-24). Guardar una contraindicacion que nadie ve es la
          mitad del valor: sin esto, el siguiente profesional no se entera de que otro ya descarto un
          producto por una razon clinica. Va ARRIBA y en tono critico, no como nota al pie, porque su
          trabajo es que se lea ANTES de prescribir. Vienen de TODAS las consultas del paciente, no de esta.
          Se muestra tambien en la vista de consulta (otras profesiones): es informacion clinica que
          cualquiera que atienda al paciente debe tener. */}
      <ContraindicacionesAviso protocol={protocol} />

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-foreground">Nutracéuticos</h3>
          <Badge variant="outline" className="text-[10px] font-normal">
            Vista de consulta
          </Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          La prescripción la edita el nutricionista. Se muestra aquí para que tengas presente qué se le está
          dando al paciente (puede interactuar con lo que prescribas).
        </p>
        <RecommendedList recommended={recommended} readOnly dondeEsta={dondeEsta} />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Prescrito por el nutricionista</p>
          {protocol.nutraceuticals.length ? (
            <ul className="flex flex-col gap-1 text-sm text-foreground">
              {protocol.nutraceuticals.map((n) => (
                <li key={n.id}>
                  <span className="font-medium">{n.name}</span>
                  {n.dosage ? ` · ${n.dosage}` : ""}
                  {n.durationDays != null ? ` · ${n.durationDays} días` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nutracéuticos prescritos.</p>
          )}
        </div>
      </section>
    );
  }

  // --- VISTA DEL NUTRICIONISTA (editable) ---
  return (
    <section className={bloqueCls("derivado")}>
      <h3 className="text-base font-semibold text-foreground">Nutracéuticos</h3>
      {/* CONTRAINDICACIONES DEL PACIENTE (2026-08-24). Guardar una contraindicacion que nadie ve es la
          mitad del valor: sin esto, el siguiente profesional no se entera de que otro ya descarto un
          producto por una razon clinica. Va ARRIBA y en tono critico, no como nota al pie, porque su
          trabajo es que se lea ANTES de prescribir. Vienen de TODAS las consultas del paciente, no de esta.
          Se muestra tambien en la vista de consulta (otras profesiones): es informacion clinica que
          cualquiera que atienda al paciente debe tener. */}
      <ContraindicacionesAviso protocol={protocol} />

      {/* ═══ GUARDAR SIN NADA PRESCRITO Y SIN DECIDIR AVISA, NO SE APAGA (Santiago, smoke del 2026-10-07) ═══

          LO QUE PASABA: *"deja guardar prescripción sin siquiera haber agregado un nutracéutico ni haber dado al
          botón 'el paciente no los adquiere por ahora'"*. Guardaba una prescripción vacía sin decir nada, así que
          la consulta quedaba sin prescripción Y sin la decisión del paciente: ninguno de los dos hechos
          registrado, y nada en pantalla que lo dijera.

          Y LA FORMA LA ELIGIÓ ÉL, contra mi primer impulso de apagar el botón: *"o mejor mantenerlo activo y que
          salga un toast o mensaje... esto me parece mejor."* Tiene razón, y la razón vale para más casos que
          este: un botón apagado no dice por qué está apagado, y el profesional se queda buscando el motivo en la
          pantalla. Uno que se pulsa y responde sí lo dice.

          CUÁNDO NO AVISA: si la decisión "no los adquiere" ya está registrada, una prescripción vacía es
          coherente y guardarla es correcto. El aviso solo sale cuando faltan LAS DOS cosas. */}
      <form
        onSubmit={(e) => {
          const yaDecidido = protocol.nutraceuticalDecision?.decision === "no";
          if (nutras.length === 0 && !yaDecidido) {
            e.preventDefault();
            setFaltaCerrar(true);
            return;
          }
          setFaltaCerrar(false);
          enviarSinReset(formAction)(e);
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="evaluationId" value={evaluationId} />
        {/* Firma de concurrencia: la prescripcion que el cliente cargó. Si otro profesional la cambió, el
            servidor lo detecta bajo lock y rechaza sin pisar. */}
        <input type="hidden" name="baseSignature" value={prescriptionSignature(protocol)} />
        <input type="hidden" name="nutraceuticals" value={nutrasPayload} />
        <fieldset className="flex flex-col gap-3">
          <RecommendedList recommended={recommended} isAdded={isAdded} onAdd={addProduct} dondeEsta={dondeEsta} />

          {/* ═══ EL "NO" VA AQUI, SOBRE LOS RECOMENDADOS (Santiago, 2026-09-26) ═══
              Un solo boton donde habia una pregunta de tres opciones. El "SI" no se pregunta: lo demuestra la
              venta. Y va sobre los RECOMENDADOS POR EL MODELO y no sobre toda la prescripcion, porque son los
              que importan para la investigacion: que el modelo recomiende algo y el paciente no lo tome es EL
              dato. Solo aparece si el modelo recomendo algo; si no, no hay nada que no adquirir. */}
          {recommended.length > 0 ? (
            <NoLosAdquiereForm
              evaluationId={evaluationId}
              yaRegistrado={
                protocol.nutraceuticalDecision?.decision === "no"
                  ? (protocol.nutraceuticalDecision.note ?? "")
                  : null
              }
              registradoEn={protocol.nutraceuticalDecision?.at ?? null}
              ventaPosteriorEn={ventaPosteriorAlNo ?? null}
            />
          ) : null}

          {/* ═══ PRESCRIBIR ALGO QUE EL MODELO NO RECOMENDO: PLEGADO (Santiago, 2026-09-26) ═══
              Estaba siempre abierto y con el catalogo entero a la vista, al mismo nivel que la recomendacion
              del modelo, y eso hacia que prescribir CONTRA el modelo se viera igual de normal que seguirlo. No
              lo es: el modelo es lo que Atlas propone y lo otro es una decision propia del profesional. Plegarlo
              no lo esconde (el rotulo dice exactamente lo que hay dentro), lo pone en su lugar. */}
          <details className="rounded-lg border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
              ¿Quieres prescribir un nutracéutico que el modelo no recomendó?
            </summary>
            <div className="flex flex-col gap-2 border-t border-border p-3">
              <p className="text-xs text-muted-foreground">
                Lo que agregues aquí es tu decisión, distinta de la recomendación del modelo.
              </p>
          <div className="flex gap-2">
            <select
              value={pickId}
              // SE AGREGA AL ELEGIR (Santiago, 2026-10-04). `addProduct` recibe el id del evento y no `pickId`:
              // el estado todavia no se actualizo cuando este handler corre, y leerlo agregaria el anterior.
              onChange={(e) => {
                const id = e.target.value;
                setPickId("");
                if (id) addProduct(id);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">Selecciona un nutracéutico</option>
              {/* ═══ LA QUINTA COPIA, Y LA ENCONTRO SANTIAGO (2026-10-08) ═══

                  Lleve el mapa de rotulos a un modulo y dije que estaba en CUATRO sitios. Estaba en CINCO: esta
                  lista no usaba el mapa, escribia sus propias frases a mano, asi que se quedo diciendo "se vende
                  en consultorio" de un producto que el profesional no tiene. Textual suyo: *"faltó aplicar la
                  mejora en ese listado"*.

                  ES LA LECCION DEL BARRIDO, otra vez: contar las copias leyendo una busqueda de `AVAILABILITY_LABEL`
                  dejo fuera la que no usaba esa constante. Lo que hay que barrer es la PREGUNTA ("¿que se le dice
                  al profesional sobre la disponibilidad?"), no el nombre de una variable.

                  EL ESTADO SE QUEDA EN LA ETIQUETA (cotejo 2026-08-24): sin el se puede prescribir algo que no
                  existe y el paciente se va con una indicacion que no puede cumplir. Los no disponibles NO se
                  ocultan, se marcan. */}
              {nutraceuticosDeCnv.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {estadoParaPrescribir(c.commercialAvailability, dondeEsta?.[c.id]).texto.toLowerCase()}
                </option>
              ))}
            </select>
            {/* EL BOTON SE ENCIENDE CUANDO HAY ALGO SELECCIONADO Y SIN AGREGAR. Santiago elegia en el
                desplegable y se saltaba este paso, y no aparecia ningun aviso.
                El aviso de "cambios sin guardar" hace bien en NO dispararse aqui, y la razon es la que
                explica el arreglo: SELECCIONAR EN UN DESPLEGABLE NO ES UNA DECISION, ES UNA INTENCION.
                Todavia no hay ningun cambio que guardar porque nada entro a la lista.
                Y por eso el arreglo tampoco es otro aviso: esta seccion ya tiene tres (sin guardar,
                contraindicaciones, disponibilidad) y uno mas compite con los otros. Que se encienda el
                boton dice que le toca a el, sin texto nuevo. */}
            {/* ═══ EL BOTON "AGREGAR" SE QUITA: SE AGREGA AL ELEGIR (Santiago, 2026-10-04) ═══

                EL COMENTARIO DE ARRIBA SE QUEDA PORQUE SU OBSERVACION ERA BUENA, y ahora se resuelve mejor:
                Santiago elegía en el desplegable y se saltaba el paso de "Agregar", sin que nada lo avisara.
                Se encendió el botón para decir que le tocaba a él.

                PERO SI ELEGIR NO ES UNA DECISION, EL SEGUNDO PASO TAMPOCO LA VUELVE UNA: lo que convierte la
                intención en decisión es GUARDAR, que ya existe y ya avisa cuando hay cambios sin guardar. El
                paso intermedio solo añadía una forma de equivocarse. Y para deshacer está "Quitar", al lado.

                El botón se va del todo: dejarlo oculto sería dos caminos para lo mismo, y uno sin probar. */}
          </div>
          {/* LAS DOS DECLARACIONES, JUNTAS, EN EL MOMENTO DE ELEGIR (§7.7 del modelo comercial, texto del
              asesor legal del 2026-09-11). No compara nada y no bloquea nada: pone lo que declaró el
              paciente al lado de lo que declara el producto, y la valoración es del profesional.
              VA AQUI, sobre lo SELECCIONADO y no solo sobre lo ya agregado, porque el momento útil es
              antes de agregarlo. Y sale con cualquier producto que declare algo, no solo cuando algo
              coincide: si apareciera al coincidir, su presencia sería una clasificación. */}
          {seleccionado && (
                <YuxtaposicionAlergenos
                  paciente={protocol.declaracionesPaciente}
                  producto={{ alergenos: seleccionado.alergenosDeclarados }}
                  nombreProducto={seleccionado.name}
                />
              )}
            </div>
          </details>

          {/* ═══ BLOQUE B · PRODUCTOS QUE NO SON NUTRACEUTICOS DE CNV ═══
              SALEN DEL DESPLEGABLE DE ARRIBA, que es lo que mas confundia: LUVIA aparecia en la misma lista que
              los VITACELLEBIS, y no son lo mismo ni para el paciente ni para la contabilidad (uno lleva
              participacion del proveedor).
              LA FICHA ES LA DE GILDARDO, PORTADA: su HTML v9 tiene `OTROS_PRODUCTOS` con descripcion,
              presentacion, dosis, INVIMA, alergenos y fabricante, y esos campos YA estaban en nuestra tabla sin
              que nadie los leyera. No se mejora ni se resume.
              Y LO QUE SU COMENTARIO DICE Y AQUI SE RESPETA: "el alergeno se muestra tal como lo declara la
              ficha. El sistema NO lo cruza con las alergias de la encuesta." Es la misma decision que ya
              teniamos: yuxtaponer y que valore el profesional. */}
          {productosDeTercero.length > 0 ? (
            <details className="rounded-lg border border-border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
                ¿Quieres prescribir un producto diferente para el tratamiento del paciente?
              </summary>
              <div className="flex flex-col gap-3 border-t border-border p-3">
                {productosDeTercero.map((c) => (
                  // LA TARJETA, DECORADA CON LA REFERENCIA DE GILDARDO Y NUESTRA REGLA DE COLOR.
                  //
                  // De su HTML se adopta la DISPOSICION: el nombre y su accion arriba, la descripcion como
                  // cuerpo, y debajo los datos de ficha en una tira de etiquetas (presentacion, dosis, INVIMA,
                  // fabricante), con el alergeno separado del resto.
                  //
                  // EL COLOR NO SALE DE LA CAPA CLINICA, y es la unica cosa donde no seguimos su hoja: sus
                  // `--clinical-*` significan severidad del PACIENTE, y este es un producto, no un veredicto.
                  // Va con el azul de marca (capa de interfaz). La UNICA excepcion es el ALERGENO, que va en
                  // `attention`: ahi si hay algo que mirar antes de prescribir, y `attention` es el eje
                  // operativo, que existe justamente separado del clinico.
                  <div
                    key={c.id}
                    className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base font-extrabold tracking-tight text-foreground">{c.name}</span>
                        {/* PRODUCTO EXTERNO, dicho de frente: es lo que separa esta tarjeta de un nutraceutico
                            de CNV, y el profesional tiene que saberlo antes de prescribirlo. */}
                        <span className="text-xs font-medium uppercase tracking-wide text-primary">
                          Producto externo
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant={isAdded(c.id) ? "outline" : "default"}
                        onClick={() => addProduct(c.id)}
                        disabled={isAdded(c.id)}
                      >
                        {isAdded(c.id) ? "Agregado" : "Agregar"}
                      </Button>
                    </div>

                    {/* ═══ EL ORDEN ES EL DE SU FICHA (Santiago, 2026-09-28) ═══
                        Su HTML la dispone asi, y se porta asi:
                          LUVIA
                          1 scoop (15 g) en un vaso con agua · Polvo · 600 g     <- la posologia, arriba
                          Mezcla en polvo ... arroz con avena, linaza, psyllium   <- los INGREDIENTES
                          ⚠ Alergenos: Contiene avena
                          INVIMA RSA-... · Laboratorio Naturex S.A.S.
                        Yo la habia partido en una tira de etiquetas, y eso perdia la lectura corrida que su
                        ficha tiene. */}
                    {/* ═══ LA JERARQUIA ES LA DE SU FICHA (Santiago, 2026-09-28) ═══
                        Lo que hace que la suya se vea trabajada y la nuestra plana NO es el color: es que cada
                        linea tiene su PESO y su TAMAÑO, y una sola lleva acento. En su HTML:

                          nombre        13px, peso 800, texto oscuro
                          dosis · pres  11px, peso 700, ACENTO (el unico color de la tarjeta)
                          descripcion   11px, gris medio
                          alergenos     11px, peso 700, ambar, con su simbolo
                          INVIMA · fab  10px, gris claro

                        Se porta esa escala. EL ACENTO ES EL NUESTRO y no su verde azulado: el suyo es el color de
                        una seccion de su hoja, y meter una quinta tinta en Atlas para un bloque es justo lo que
                        BRAND.md llama el arcoiris. El ambar del alergeno SI se conserva, porque ahi el color
                        significa: es el eje operativo (attention), no la capa clinica. */}
                    <p className="text-sm font-bold text-primary">
                      {[c.servingSize, c.doseFrequency, c.presentation].filter(Boolean).join(" · ")}
                    </p>

                    {/* LOS INGREDIENTES SALEN DE composition: es donde estan y coinciden palabra por palabra con
                        la descripcion de su ficha. La columna description traia un resumen nuestro. */}
                    {c.composition ? (
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{c.composition}</p>
                    ) : c.description ? (
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{c.description}</p>
                    ) : null}

                    {/* EL ALERGENO CON SU SIMBOLO Y SU ROTULO, textual de su ficha ("Alérgenos: Contiene avena").
                        El texto que sale es el que DECLARA la ficha del producto, no una version nuestra: la 0184
                        corrigio el dato para que diga "Contiene avena" y no "avena".
                        Y no se cruza con la encuesta: eso lo hace la yuxtaposicion, aparte. */}
                    {c.alergenosDeclarados.length > 0 ? (
                      <p className="text-sm font-bold text-attention">
                        <span aria-hidden>⚠</span> Alérgenos: {c.alergenosDeclarados.join(" · ")}
                      </p>
                    ) : null}

                    {/* LA LINEA DE REGISTRO, la mas pequeña y la mas apagada, como en su ficha.
                        VAN LAS DOS PARTES, y esto resuelve un conflicto real entre dos documentos suyos: su ficha
                        nombra al FABRICANTE (Naturex, el maquilador) y la §7.7 obliga a mostrar el TITULAR DE
                        MARCA (Katherine Ruiz), por la doctrina del fabricante aparente. Mostrar las dos no cambia
                        nada de lo suyo: le agrega lo que la ley exige, y el modelo comercial pide expresamente no
                        confundirlas. */}
                    {c.sanitaryRegistration || c.manufacturer || c.brandOwner ? (
                      <p className="text-xs text-muted-foreground/80">
                        {[
                          c.sanitaryRegistration ? `INVIMA ${c.sanitaryRegistration}` : null,
                          c.manufacturer,
                          c.brandOwner ? `Titular de marca: ${c.brandOwner}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}

                    {c.commercialAvailability !== "en_consultorio" ? (
                      <p className="text-xs text-muted-foreground">
                        {c.commercialAvailability === "solo_tienda"
                          ? "Se compra en la tienda, no en consultorio."
                          : "Aún no está disponible."}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {nutras.length ? (
            <ul className="flex flex-col gap-2">
              {nutras.map((n, i) => (
                <li
                  key={n.nutraceuticalId}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
                >
                  <span className="min-w-[8rem] flex-1 font-medium text-foreground">{n.name}</span>
                  {/* ═══ LA POSOLOGIA SALE DEL CATALOGO, NO SE TECLEA (Santiago, 2026-09-28) ═══
                      AQUI HABIA DOS CAMPOS, "Dosis" y "Dias", que el profesional llenaba a mano. Se retiran
                      porque SU ARCHIVO NO LOS PIDE: el HTML tiene una tabla FIJA por producto (NUTR_DOSIS, con
                      dosis y frecuencia) y la imprime; el profesional nunca la escribe. Era una adicion nuestra,
                      y la Regla 0 dice que lo que el archivo no tiene se retira, no se defiende.
                      Y se veia el daño: el informe del paciente salia con "LUVIA: 1 durante 1 días", que es lo
                      que alguien tecleo para salir del campo.
                      La 0184 trajo la dosis y la frecuencia de su tabla, asi que lo que se muestra debajo del
                      nombre es su posologia, igual para todos los pacientes, como en su archivo. */}
                  <span className="text-xs font-medium text-primary">{posologiaDelCatalogo(protocol, n.nutraceuticalId)}</span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setNutras(nutras.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </Button>
                  {/* Y TAMBIEN SOBRE LO YA PRESCRITO, no solo al elegir: quien abre esta pantalla puede
                      ser otro profesional, o el mismo en una consulta posterior, y la declaración del
                      paciente puede haber cambiado desde que el producto entró a la lista. */}
                  <div className="w-full">
                    <YuxtaposicionAlergenos
                      paciente={protocol.declaracionesPaciente}
                      producto={{
                        alergenos:
                          protocol.catalog.find((c) => c.id === n.nutraceuticalId)
                            ?.alergenosDeclarados ?? [],
                      }}
                      nombreProducto={n.name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin nutracéuticos en la prescripción.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar prescripción"}
            </Button>
            {/* El aviso va JUNTO AL BOTON, que es donde se resuelve. Puesto al final de la sección o
                arriba, el profesional lo lee cuando ya bajó a la entrega y no sabe qué hacer con él. */}
            {haycambiosSinGuardar ? (
              <span className="text-xs text-clinical-warning">
                Tienes cambios sin guardar. La entrega y la decisión del paciente usan lo guardado.
              </span>
            ) : null}
          </div>
          {/* EL AVISO VA JUNTO AL BOTÓN que lo provocó, y nombra LAS DOS salidas: decir solo "falta algo" deja al
              profesional buscando qué. */}
          {faltaCerrar ? (
            <p className="max-w-prose text-sm text-clinical-warning">
              No hay nada que guardar todavía. Esta consulta se cierra de una de dos formas:{" "}
              <strong>agrega al menos un nutracéutico</strong> a la prescripción, o registra que{" "}
              <strong>el paciente no los adquiere por ahora</strong> con el botón de abajo. Las dos quedan en su
              historia clínica; dejarlo en blanco no registra ninguna.
            </p>
          ) : null}
        </fieldset>
      </form>

      {/* ═══ MIENTRAS LLEGA EL BLOQUE DE COBRO, SE DICE QUE VIENE (Santiago, 2026-10-04) ═══

          EL PROBLEMA NO ERA LA ESPERA, ERA EL SILENCIO. Textual suyo: "a veces por la espera sin decir nada
          los profesionales dicen que no aparece nada o creen que la app no hace nada". Guardar la prescripción
          tarda unos segundos en traer el bloque de venta, porque la página entera se vuelve a renderizar.

          EL ARREGLO DE FONDO ES EL REFRESCO PARCIAL (ver BACKLOG), y no es de hoy. Esto es lo barato que se
          puede hacer sin tocarlo: ocupar el sitio donde va a salir y decir qué está pasando.

          POR QUÉ DESAPARECE SOLO, sin lógica que lo apague: al llegar los datos, la página re-renderiza con una
          `key` nueva para esta sección (la firma de la prescripción cambió), así que el componente se MONTA de
          cero y este estado se va con él. El mismo remonte que causa el salto de scroll es el que lo limpia.

          Y SOLO SI HAY ALGO PRESCRITO: sin productos no va a aparecer ningún bloque de cobro, y anunciarlo
          sería prometer algo que no llega. */}
      {state.success != null && nutras.length > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
          Prescripción guardada. Preparando el cobro de lo prescrito...
        </div>
      ) : null}
    </section>
  );
}

// Nombre del producto de una contraindicacion. Si es de un COMPONENTE (sin producto asociado) o de uno
// retirado del catalogo, se dice asi en vez de mostrar un id o esconder la fila: una contraindicacion sin
// nombre sigue siendo una advertencia.
function nombreDe(protocol: TreatmentProtocol, nutraceuticalId: string | null): string {
  if (!nutraceuticalId) return "General";
  return protocol.catalog.find((c) => c.id === nutraceuticalId)?.name ?? "Producto retirado del catálogo";
}

function ContraindicacionesAviso({ protocol }: { protocol: TreatmentProtocol }) {
  if (protocol.contraindications.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border-2 border-clinical-critical bg-clinical-critical-bg px-3 py-2 text-sm text-clinical-critical"
    >
      <p className="font-medium">
        {protocol.contraindications.length === 1
          ? "Este paciente tiene una contraindicación registrada"
          : `Este paciente tiene ${protocol.contraindications.length} contraindicaciones registradas`}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {protocol.contraindications.map((c) => (
          <li key={c.id}>
            <span className="font-medium">{nombreDe(protocol, c.nutraceuticalId)}:</span> {c.reason}
            <span className="opacity-80"> ({new Date(c.createdAt).toLocaleDateString("es-CO")})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * LA POSOLOGIA DE UN PRESCRITO, desde el catalogo (2026-09-28).
 *
 * Es lo que reemplazo a los dos campos que el profesional tecleaba. Sale de la tabla de Gildardo (0184): dosis,
 * frecuencia y linea, en ese orden, como en su archivo. Si el catalogo no tiene nada del producto, no se
 * inventa: se devuelve cadena vacia y la linea no se pinta.
 */
function posologiaDelCatalogo(protocol: TreatmentProtocol, nutraceuticalId: string): string {
  const c = protocol.catalog.find((x) => x.id === nutraceuticalId);
  if (!c) return "";
  return [c.servingSize, c.doseFrequency, c.presentation].filter(Boolean).join(" · ");
}

// "30 mL · linea liquida" a partir de lo que el catalogo ya tiene. Sin inventar nada: si falta un campo,
// se muestra lo que haya, y si no hay ninguno, no se muestra la linea.
function posologia(p: { servingSize?: string | null; presentation?: string | null }): string {
  const linea = p.presentation ? `línea ${p.presentation}` : null;
  return [p.servingSize, linea].filter(Boolean).join(" · ");
}

// La lista "El modelo recomienda": en lectura (consulta) sin boton, o con "Agregar" (nutricionista).
function RecommendedList({
  recommended,
  isAdded,
  onAdd,
  readOnly,
  dondeEsta,
}: {
  recommended: ReturnType<typeof resolveRecommendation>;
  isAdded?: (id: string) => boolean;
  onAdd?: (id: string) => void;
  readOnly?: boolean;
  dondeEsta?: Record<string, { propias: number; enCentral: number }>;
}) {
  if (!recommended.length) {
    return (
      <p className="text-sm text-muted-foreground">El modelo no recomendó nutracéuticos para este fenotipo.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">El modelo recomienda</p>
      <ul className="flex flex-col gap-2">
        {recommended.map((r, i) =>
          r.status === "en_catalogo" ? (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-[10rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{r.product.name}</span>
                  {/* EL CHIP RESPONDE "¿PUEDO DÁRSELO HOY?" (Santiago, 2026-10-08), que es lo que se pregunta
                      aquí. La regla vive en `estadoParaPrescribir`, con su orden (catálogo antes que saldo) y
                      su razón; esto solo pinta. */}
                  {(() => {
                    const e = estadoParaPrescribir(r.product.commercialAvailability, dondeEsta?.[r.product.id]);
                    return (
                      <Badge
                        variant="outline"
                        className={
                          "text-[10px] font-normal " +
                          (e.tono === "bueno"
                            ? "border-clinical-optimal text-clinical-optimal"
                            : e.tono === "aviso"
                              ? "border-attention text-attention"
                              : "")
                        }
                      >
                        {e.texto}
                      </Badge>
                    );
                  })()}
                </div>
                {/* Posologia y composicion (cotejo 2026-08-24): el v8 las muestra en esta tarjeta
                    ("30 mL/dia · 1 vez al dia · linea liquida" y los ingredientes). Verificado que NO
                    son calculadas: salen de una tabla fija por producto. En Atlas ya vivian en el
                    catalogo y no se estaban leyendo. La FRECUENCIA es lo unico que su tabla trae y el
                    catalogo no: la fija el profesional al prescribir, que es donde tiene criterio. */}
                {posologia(r.product) ? (
                  <p className="text-xs font-medium text-foreground">{posologia(r.product)}</p>
                ) : null}
                {r.product.indication ? (
                  <p className="text-xs text-muted-foreground">{r.product.indication}</p>
                ) : null}
                {r.product.composition ? (
                  <p className="text-xs text-muted-foreground">{r.product.composition}</p>
                ) : null}
              </div>
              {!readOnly && onAdd && isAdded ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isAdded(r.product.id)}
                  onClick={() => onAdd(r.product.id)}
                >
                  {isAdded(r.product.id) ? "Agregado" : "Agregar"}
                </Button>
              ) : null}
            </li>
          ) : (
            <li
              key={i}
              className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
            >
              El modelo recomienda <span className="font-medium text-foreground">{r.motorName}</span>, que
              todavía no está en el catálogo.
            </li>
          ),
        )}
      </ul>
      {/* ── ESTO ES EL CANAL DEL PRODUCTO, NO TUS UNIDADES (Santiago, smoke del 2026-10-07) ──

          *"Profesional Prueba solo tiene ADAPTO-STRESS, pero aun así el listado de nutracéuticos dice 'en
          consultorio'."* El rótulo era correcto (es la disponibilidad comercial del producto) y la leyenda lo
          hacía sonar a otra cosa: decía "se lo puedes entregar en la consulta", que es falso con la vitrina en
          cero. La frase prometía algo sobre SU inventario y solo sabía algo sobre el catálogo.

          Y no se le añade el saldo aquí a propósito: el bloque de venta ya lo dice con las cifras exactas y de
          dónde salen. Dos sitios diciendo el stock es como se llega a que uno quede viejo. */}
      {/* ── Y ME CORRIJO OTRA VEZ, QUE ES LO QUE IMPORTA AQUÍ (Santiago insistió, 2026-10-08) ──

          Yo arreglé la leyenda y DEFENDÍ el rótulo: "En consultorio" es la disponibilidad comercial, dije, no
          el inventario. El rótulo seguía diciendo que el producto está en un sitio donde no está, y dos líneas
          más abajo el bloque de venta decía "No tienes unidades en tu vitrina". Es el mismo defecto que acababa
          de arreglar en /direccion, en otra pantalla, y lo defendí en vez de verlo.

          AHORA EL RÓTULO DICE EL CANAL ("Se entrega en consulta"), que es lo que el campo sabe, y la leyenda
          sale del mismo módulo que el rótulo: una frase que explica un nombre tiene que cambiar con el nombre, y
          en archivos distintos no cambian juntas. */}
      <p className="max-w-prose text-xs text-muted-foreground">{LEYENDA_DISPONIBILIDAD}</p>
    </div>
  );
}
