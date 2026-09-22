// EXPORTADOR DE PACIENTES DEL HTML A ATLAS WEB (plan de la importacion, sesion 2, 2026-09-22).
//
// Se inyecta en NUESTRA copia del HTML de Gildardo (su archivo no se toca; ver construir.mjs). Tambien sirve
// pegado en la consola del navegador con el HTML viejo abierto: define `AtlasExportador` y abre la ventana.
//
// QUE HACE: lista los pacientes guardados en este navegador, deja marcar cuales exportar (con "marcar todos"
// y "desmarcar todos"), exige la declaracion del profesional (punto 8 de la respuesta legal del 2026-09-21) y
// descarga un archivo con TODO lo que el navegador tiene de esos pacientes, sin transformarlo.
//
// FIDELIDAD, que es lo que el legal pide ("la exportacion es fiel"): cada valor se copia TAL CUAL esta
// guardado, como texto, sin leerlo ni reescribirlo. Atlas lo interpreta al importar. Asi nada se pierde por
// una conversion de este lado.
//
// LEE localStorage DIRECTO, no `window.storage` del HTML: ese intenta traer la copia de la nube, que no lleva
// la firma del consentimiento. La fuente con la prueba es el navegador.
(function (global) {
  "use strict";

  var FORMATO = "atlas-exportacion-html";
  var VERSION_FORMATO = 1;
  var VERSION_DECLARACION = "1.0";
  // La declaracion del punto 8 del legal, en tres partes, las tres obligatorias.
  var DECLARACION = [
    "Los pacientes que exporto me manifestaron su voluntad de continuar su atención en Atlas web.",
    "Obtuve el consentimiento de cada uno con el texto del consentimiento de este HTML.",
    "Esta exportación es fiel: el archivo contiene lo que este navegador tiene registrado, sin cambios.",
  ];

  // La clave de un paciente es "atlas:{documento}", sin subcategorias (la misma regla que `_isPatientKey`
  // del HTML).
  function esClaveDePaciente(k) {
    if (!k || k.indexOf("atlas:") !== 0) return false;
    var r = k.slice(6);
    return !(r.charAt(0) === "_" || r.indexOf(":") >= 0 || r === "profesionales");
  }

  // Las otras claves del mismo paciente: "atlas_bis_{doc}", "atlas:antro:{doc}", "atlas:plan:{doc}". El
  // documento va DESPUES DEL ULTIMO separador y tiene que ser IGUAL, no terminar igual: "atlas_bis_1234" no
  // es del paciente "234".
  function esClaveRelacionada(k, doc) {
    if (k === "atlas:" + doc) return false;
    if (k.indexOf("atlas") !== 0) return false;
    var cola = k.length - doc.length;
    if (cola <= 0 || k.slice(cola) !== doc) return false;
    var sep = k.charAt(cola - 1);
    return sep === ":" || sep === "_";
  }

  function leerJson(texto) {
    try {
      return JSON.parse(texto);
    } catch (_e) {
      return null;
    }
  }

  // entradas: [[clave, valor]] de localStorage.
  function listarPacientes(entradas) {
    var out = [];
    for (var i = 0; i < entradas.length; i++) {
      var k = entradas[i][0];
      if (!esClaveDePaciente(k)) continue;
      var doc = k.slice(6);
      var hist = leerJson(entradas[i][1]);
      var consultas = Array.isArray(hist) ? hist : [];
      var ultima = consultas.length ? consultas[consultas.length - 1] : {};
      var fechas = consultas
        .map(function (c) {
          return (c && (c.fechaConsulta || c.fecha_consulta)) || "";
        })
        .filter(Boolean)
        .sort();
      out.push({
        documento: doc,
        nombre: (ultima && ultima.nombre) || "",
        consultas: consultas.length,
        ultimaConsulta: fechas.length ? fechas[fechas.length - 1] : "",
      });
    }
    out.sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre, "es");
    });
    return out;
  }

  function construirExportacion(entradas, documentos, declaracionAceptadaEn, ahora) {
    var pacientes = documentos.map(function (doc) {
      var historia = null;
      var relacionadas = {};
      for (var i = 0; i < entradas.length; i++) {
        var k = entradas[i][0];
        if (k === "atlas:" + doc) historia = entradas[i][1];
        else if (esClaveRelacionada(k, doc)) relacionadas[k] = entradas[i][1];
      }
      return { documento: doc, clave: "atlas:" + doc, historia: historia, relacionadas: relacionadas };
    });
    var sesion = null;
    for (var j = 0; j < entradas.length; j++) {
      if (entradas[j][0] === "atlas:sesion:profesional") sesion = entradas[j][1];
    }
    return {
      formato: FORMATO,
      version: VERSION_FORMATO,
      exportadoEn: ahora,
      profesional: sesion,
      declaracion: { version: VERSION_DECLARACION, texto: DECLARACION.slice(), aceptadaEn: declaracionAceptadaEn },
      pacientes: pacientes,
    };
  }

  function entradasDe(storage) {
    var out = [];
    for (var i = 0; i < storage.length; i++) {
      var k = storage.key(i);
      out.push([k, storage.getItem(k)]);
    }
    return out;
  }

  // El hash del contenido, si el navegador lo permite. Si no, Atlas calcula el del archivo al importarlo.
  function hashDe(texto) {
    var sutil = global.crypto && global.crypto.subtle;
    if (!sutil || typeof TextEncoder === "undefined") return Promise.resolve(null);
    return sutil.digest("SHA-256", new TextEncoder().encode(texto)).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return ("0" + b.toString(16)).slice(-2);
        })
        .join("");
    }, function () {
      return null;
    });
  }

  // ── LA VENTANA ──────────────────────────────────────────────────────────────────────────────────────
  // DOM a mano y textContent para todo dato del paciente: nada se interpreta como HTML.
  function el(tag, estilo, texto) {
    var n = document.createElement(tag);
    if (estilo) n.setAttribute("style", estilo);
    if (texto != null) n.textContent = texto;
    return n;
  }

  function abrir() {
    var previa = document.getElementById("atlas-exportador");
    if (previa) previa.remove();
    var entradas = entradasDe(global.localStorage);
    var pacientes = listarPacientes(entradas);

    var fondo = el(
      "div",
      "position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif",
    );
    fondo.id = "atlas-exportador";
    var caja = el(
      "div",
      "background:#fff;color:#0f172a;width:min(720px,94vw);max-height:90vh;overflow:auto;border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px",
    );
    fondo.appendChild(caja);
    caja.appendChild(el("h2", "margin:0;font-size:18px", "Exportar pacientes a Atlas web"));
    caja.appendChild(
      el(
        "p",
        "margin:0;font-size:13px;color:#475569",
        "Marca los pacientes que te pidieron continuar en Atlas web. Se descarga un archivo con todo lo que este navegador tiene de ellos; envíaselo a CNV.",
      ),
    );

    if (pacientes.length === 0) {
      caja.appendChild(el("p", "margin:0;font-size:14px", "Este navegador no tiene pacientes guardados."));
    }

    var marcados = {};
    var lista = el("div", "display:flex;flex-direction:column;gap:4px;border:1px solid #e2e8f0;border-radius:8px;padding:8px");
    var casillas = [];
    pacientes.forEach(function (p) {
      var fila = el("label", "display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer");
      var c = el("input");
      c.type = "checkbox";
      c.onchange = function () {
        marcados[p.documento] = c.checked;
        actualizar();
      };
      casillas.push({ c: c, doc: p.documento });
      fila.appendChild(c);
      var detalle = p.consultas + (p.consultas === 1 ? " consulta" : " consultas");
      if (p.ultimaConsulta) detalle += ", la última el " + p.ultimaConsulta;
      fila.appendChild(el("span", "", (p.nombre || "Sin nombre") + " · " + p.documento + " · " + detalle));
      lista.appendChild(fila);
    });

    var botones = el("div", "display:flex;gap:8px");
    function todos(valor) {
      casillas.forEach(function (x) {
        x.c.checked = valor;
        marcados[x.doc] = valor;
      });
      actualizar();
    }
    var bTodos = el("button", "padding:6px 10px;font-size:13px;cursor:pointer", "Marcar todos");
    bTodos.type = "button";
    bTodos.onclick = function () {
      todos(true);
    };
    var bNinguno = el("button", "padding:6px 10px;font-size:13px;cursor:pointer", "Desmarcar todos");
    bNinguno.type = "button";
    bNinguno.onclick = function () {
      todos(false);
    };
    if (pacientes.length) {
      botones.appendChild(bTodos);
      botones.appendChild(bNinguno);
      caja.appendChild(botones);
      caja.appendChild(lista);
    }

    caja.appendChild(el("h3", "margin:4px 0 0;font-size:15px", "Declaración"));
    var declarado = [];
    DECLARACION.forEach(function (texto, i) {
      var fila = el("label", "display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer");
      var c = el("input");
      c.type = "checkbox";
      c.onchange = function () {
        declarado[i] = c.checked;
        actualizar();
      };
      fila.appendChild(c);
      fila.appendChild(el("span", "", texto));
      caja.appendChild(fila);
    });

    var estado = el("p", "margin:0;font-size:13px;color:#475569");
    caja.appendChild(estado);
    var acciones = el("div", "display:flex;gap:8px;justify-content:flex-end");
    var bCerrar = el("button", "padding:8px 14px;cursor:pointer", "Cerrar");
    bCerrar.type = "button";
    bCerrar.onclick = function () {
      fondo.remove();
    };
    var bDescargar = el("button", "padding:8px 14px;cursor:pointer;font-weight:600", "Descargar archivo");
    bDescargar.type = "button";
    acciones.appendChild(bCerrar);
    acciones.appendChild(bDescargar);
    caja.appendChild(acciones);

    function seleccion() {
      return pacientes
        .map(function (p) {
          return p.documento;
        })
        .filter(function (d) {
          return marcados[d];
        });
    }
    function actualizar() {
      var n = seleccion().length;
      var completa = DECLARACION.every(function (_, i) {
        return declarado[i];
      });
      bDescargar.disabled = n === 0 || !completa;
      estado.textContent =
        n === 0
          ? "Marca al menos un paciente."
          : !completa
            ? "Marca las tres declaraciones para descargar."
            : n === 1
              ? "Se exportará 1 paciente."
              : "Se exportarán " + n + " pacientes.";
    }
    bDescargar.onclick = function () {
      var ahora = new Date().toISOString();
      var exp = construirExportacion(entradasDe(global.localStorage), seleccion(), ahora, ahora);
      var cuerpo = JSON.stringify(exp.pacientes);
      hashDe(cuerpo).then(function (h) {
        exp.hashPacientes = h;
        var blob = new Blob([JSON.stringify(exp, null, 1)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "atlas-exportacion-" + ahora.slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        estado.textContent =
          "Archivo descargado. Envíaselo a CNV por el medio que te quede más fácil, y bórralo de tu equipo cuando CNV te confirme que lo importó.";
      });
    };
    actualizar();
    document.body.appendChild(fondo);
  }

  // El boton fijo, en una esquina. No toca nada del HTML: se agrega encima.
  function montarBoton() {
    if (document.getElementById("atlas-exportador-boton")) return;
    var b = el(
      "button",
      "position:fixed;right:16px;bottom:16px;z-index:2147483646;padding:10px 14px;border-radius:999px;border:0;background:#1d4fd8;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25)",
      "Exportar a Atlas web",
    );
    b.id = "atlas-exportador-boton";
    b.type = "button";
    b.onclick = abrir;
    document.body.appendChild(b);
  }

  var api = {
    FORMATO: FORMATO,
    VERSION_FORMATO: VERSION_FORMATO,
    DECLARACION: DECLARACION,
    esClaveDePaciente: esClaveDePaciente,
    esClaveRelacionada: esClaveRelacionada,
    listarPacientes: listarPacientes,
    construirExportacion: construirExportacion,
    abrir: abrir,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    return;
  }
  global.AtlasExportador = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarBoton);
  else montarBoton();
})(typeof window !== "undefined" ? window : globalThis);
