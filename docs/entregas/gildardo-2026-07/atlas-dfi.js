/**
 * atlas-dfi.js
 * Diagnostico Funcional Integrado (DFI): motor, adaptador de datos, rutas y activacion.
 *
 * Dependencias externas: computeDFIFromData usa clasificadores externos (cIFC,cIRC,cPABU,cFMI,cFFMI...) y helpers (num,calcPABU) del core compartido.
 * Extraido de ATLAS_v7.html (estado actual, 2026-07-23).
 */

import { calcPABU, cIFC, cIRC, cIEHH, cIAE, cFMI, cFFMI } from './atlas-core-indices.js';

// Paleta de colores (metadata de presentacion de las rutas).
// Helpers del parrafo DFI.
const _dfiCap3 = n => Math.max(0, Math.min(3, n));
function _dfiFmt(v){ return v==null||isNaN(v) ? "-" : (Math.round(v*100)/100).toString().replace(".",","); }
function _dfiSigned(v){ const n=Math.round((v||0)*10)/10; return (n>=0?"+":"")+n.toString().replace(".",","); }
function _dfiIsLimiting(v){ return v && !["no","nunca","buena","alta","siempre_disponible",""].includes(v); }

const C5 = {
  bg: "#ffffff",
  surface: "#f8fafc",
  card: "#f1f5f9",
  card2: "#e8f4f1",
  border: "#162437",
  accent: "#00c9a7",
  gold: "#f5c518",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  blue: "#38bdf8",
  green: "#22c55e",
  purple: "#a78bfa",
  pink: "#f472b6",
  teal: "#2dd4bf",
  text: "#dce9f5",
  muted: "#4d7090",
  dim: "#2a4560"
};


const RUTAS = {
  R1: {
    n: 1, id: "R1", icono: "⚡", label: "Restauración Celular", color: C5.red,
    activacion: "IFC bajo + IRC alto + IAE acelerado",
    condicion: d => Number(d.ifc||d.IFC) < 4.5 && Number(d.ifc||d.IFC) > 0 && Number(d.irc||d.IRC) >= 3.5 && Number(d.iae||d.IAE) > 5,
    componentes: {
      nutricional: {
        aplica: true,
        solo_nutricionista: false,
        indicaciones: ["Omega-3 dietario: ≥2 porciones pescado graso/semana","Reducir grasas trans y aceites refinados","Antioxidantes: cúrcuma, jengibre, té verde","Hidratación: ≥35 ml/kg/día"]
      },
      ejercicio: {
        aplica: true,
        remision: false,
        indicaciones: ["Actividad física moderada 3-5 días/semana","Evitar sedentarismo prolongado >2h continuas","Respiración diafragmática 10 min/día"]
      },
      psicologico: {
        aplica: true,
        remision: false,
        indicaciones: ["Manejo de estrés crónico — correlaciona con IRC elevado","Técnicas de reducción de estrés: mindfulness, meditación","Evaluar si estrés crónico es factor contribuyente"]
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: ["Valoración médica si IRC > 5.0 — descartar patología inflamatoria subyacente","Laboratorios: PCR ultrasensible, glucemia, perfil lipídico, hemograma","Correlacionar hallazgos BIS con paraclínicos"]
      },
      seguimiento: {
        frecuencia: "Cada 30 días",
        criterio_egreso: "IFC ≥ 4.5 y IRC < 3.5 sostenido 2 controles"
      }
    }
  },
  R2: {
    n: 2, id: "R2", icono: "🫀", label: "Reducción Riesgo Cardiometabólico", color: C5.orange,
    activacion: "FMI elevado / ISCM alto / obesidad sarcopénica / ICC-ICT-IR cardiometabólico",
    condicion: d => Number(d.FMI||d.fmi) > ((d.sexo==='M'||d.sexo==='Masculino') ? 6 : 9) || Number(d.iscm||d.ISCM) > 1.0 || d.obesidadSarcopenica === true || Number(d.ICC||d.icc) >= ((d.sexo==='M'||d.sexo==='Masculino') ? 0.90 : 0.85) || Number(d.ICT||d.ict) >= 0.50 || ((d.sexo==='M'||d.sexo==='Masculino') ? Number(d.IR||d.ir) >= 0.78 : Number(d.IR||d.ir) >= 0.82),
    componentes: {
      nutricional: {
        aplica: true,
        solo_nutricionista: false,
        indicaciones: ["Déficit calórico moderado: −400 a −500 kcal/día","Proteína preservada: 1.5 g/kg/día","Reducir azúcares añadidos y harinas refinadas","Fibra soluble: avena, leguminosas, manzana","Limitar sodio <2.300 mg/día si HTA activa"]
      },
      ejercicio: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: ["Remisión a entrenador certificado con prescripción de ejercicio aeróbico","Cardio aeróbico: 150–300 min/semana intensidad moderada","FC objetivo: 50–70% FCmáx — con HTA máx 60%","Inicio progresivo: 3 días 20 min, aumentar 10 min/semana"]
      },
      psicologico: {
        aplica: false,
        remision: false,
        indicaciones: []
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "obligatoria si HTA o DM2 activa",
        indicaciones: ["Remisión médica si HTA o DM2 activa detectada en D5","Seguimiento glucémico si resistencia a insulina","Perfil lipídico y función hepática si FMI muy elevado"]
      },
      seguimiento: {
        frecuencia: "Cada 45 días",
        criterio_egreso: "ISCM ≤ 1.0 y FMI en rango normal sostenido 2 controles"
      }
    }
  },
  R3: {
    n: 3, id: "R3", icono: "🧠", label: "Intervención Conductual", color: C5.pink,
    activacion: "TCA activo o insatisfacción corporal severa",
    condicion: d => {
      const tca = Array.isArray(d.d2_21) ? d.d2_21 : [];
      return ["Laxantes","Vómito","Ejercicio excesivo"].some(t => tca.includes(t)) || d.d2_20 === "Muy insatisfecho/a";
    },
    componentes: {
      nutricional: {
        aplica: true,
        solo_nutricionista: false,
        indicaciones: ["⚠️ Enfoque NO RESTRICTIVO — contraindicado déficit calórico con TCA activo","Normalización: 3 comidas + 2 colaciones regulares","Reintroducción progresiva de grupos alimentarios eliminados","Coordinación obligatoria con psicólogo antes de cualquier plan alimentario"]
      },
      ejercicio: {
        aplica: false,
        remision: false,
        indicaciones: ["⚠️ Contraindicado prescribir ejercicio intenso con TCA activo","Solo actividad física suave supervisada si psicólogo lo aprueba"]
      },
      psicologico: {
        aplica: true,
        remision: true,
        urgencia: "OBLIGATORIA — primera acción antes que cualquier intervención nutricional",
        indicaciones: ["Remisión urgente a psicología/psiquiatría especializada en TCA","Terapia Cognitivo Conductual (TCC) — primera línea en TCA","Evaluación BSQ (Body Shape Questionnaire) formal","Psicoeducación sobre imagen corporal y relación con alimentos","Documentar remisión en HC antes de iniciar cualquier plan"]
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: ["Valoración médica para descartar complicaciones orgánicas del TCA","Electrocardiograma si purgas frecuentes (riesgo arritmia por hipokalemia)","Laboratorios: electrolitos, función renal, hemograma"]
      },
      seguimiento: {
        frecuencia: "Cada 15 días coordinado con psicología",
        criterio_egreso: "Alta psicológica + IFC estable 2 controles consecutivos"
      }
    }
  },
  R4: {
    n: 4, id: "R4", icono: "⏳", label: "Desaceleración del Envejecimiento", color: C5.yellow,
    activacion: "IAE acelerado + Sarcopenia / FFMI bajo clasificado",
    condicion: d => Number(d.iae||d.IAE) > 5 || (Number(d.FFMI||d.ffmi) > 0 && Number(d.FFMI||d.ffmi) < ((d.sexo==='M'||d.sexo==='Masculino') ? 17 : 15)) || d.nivelFFMI === 'bajo' || d.obesidadSarcopenica === true,
    componentes: {
      nutricional: {
        aplica: true,
        solo_nutricionista: false,
        indicaciones: ["Proteína alta: 1.6–2.0 g/kg/día — prioridad absoluta","Distribución proteica: ≥25g por comida para maximizar síntesis","NO déficit calórico en presencia de sarcopenia activa","Antioxidantes: bayas, cacao, cúrcuma, té verde"]
      },
      ejercicio: {
        aplica: true,
        remision: true,
        urgencia: "OBLIGATORIA — sin ejercicio los nutracéuticos son insuficientes",
        indicaciones: ["Remisión a entrenador o fisioterapeuta con prescripción de resistencia progresiva","Ejercicios multiarticulares: sentadilla, peso muerto, press, remo","Carga: 65–75% de 1RM · 3 series × 8–12 repeticiones · 3 días/semana","Si IAE > 10 años o fragilidad: fisioterapia antes de ejercicio de fuerza"]
      },
      psicologico: {
        aplica: false,
        remision: false,
        indicaciones: []
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada si IAE > 10 años",
        indicaciones: ["Valoración médica si IAE > 10 años","Densitometría ósea si CMO bajo por BIS — riesgo osteoporosis","Laboratorios: vitamina D, testosterona/estrógenos, IGF-1","Descartar causa secundaria de sarcopenia si FFMI muy bajo"]
      },
      seguimiento: {
        frecuencia: "Cada 90 días",
        criterio_egreso: "IAE < 5 años y FFMI en rango normal sostenido"
      }
    }
  },
  R5: {
    n: 5, id: "R5", icono: "🧬", label: "Intervención Contextual / Epigenética", color: C5.green,
    activacion: "≥3 factores de riesgo epigenético",
    condicion: d => {
      const dx = Array.isArray(d.d5_39) ? d.d5_39 : [];
      const af = Array.isArray(d.d5_38) ? d.d5_38 : [];
      const ct = Array.isArray(d.d5_42) ? d.d5_42 : [];
      const n = [dx.includes("Diabetes tipo 2"), dx.includes("HTA") || d.d5_36 === "Sí",
        dx.includes("Dislipidemia (colesterol alto)"), af.filter(x => x !== "Ninguna").length >= 2,
        d.d3_30 && !d.d3_30.includes("Nunca") && !d.d3_30.includes("5 años o más"),
        Number(d.d3_29) >= 7, ct.filter(x => x !== "Ninguna").length > 0].filter(Boolean).length;
      return n >= 3;
    },
    componentes: {
      nutricional: {
        aplica: true,
        solo_nutricionista: false,
        indicaciones: ["Crucíferas: sulforafano → Nrf2 → protección epigenética","Berries, granada, cacao: polifenoles → metilación protectora","Reducir ultraprocesados: aditivos → disruptores endocrinos epigenéticos","Ayuno intermitente 12:12 mínimo → autofagia"]
      },
      ejercicio: {
        aplica: true,
        remision: false,
        indicaciones: ["Ejercicio es el modificador epigenético no farmacológico más potente","150 min/semana mínimo de actividad moderada","Combinar aeróbico y resistencia para máximo efecto epigenético"]
      },
      psicologico: {
        aplica: true,
        remision: false,
        indicaciones: ["Manejo de estrés crónico — el cortisol es modificador epigenético negativo","Sueño reparador ≥7h: privación altera epigenoma en <1 semana","Técnicas de reducción de estrés sostenidas"]
      },
      medico: {
        aplica: true,
        remision: true,
        urgencia: "recomendada",
        indicaciones: ["Remisión a médico funcional o integrativo","Revisión de polimedicación con médico — citocromo P450","Reducción exposición ambiental: filtro de agua, ventilación","Laboratorios: metales pesados si exposición ocupacional"]
      },
      seguimiento: {
        frecuencia: "Cada 60 días",
        criterio_egreso: "LE8 score ≥ 80 y reducción a < 2 factores de riesgo epigenético"
      }
    }
  },
  R6: {
    n: 6, id: "R6", icono: "✅", label: "Mantenimiento y Optimización", color: C5.accent,
    activacion: "Todos los dominios normales y composición corporal en rango",
    condicion: (d, dominios) => (!dominios || dominios.every(x => x.nivel === "óptimo" || x.nivel === "normal")) && d.nivelFMI !== 'alto_clinico' && d.nivelFFMI !== 'bajo' && !d.obesidadSarcopenica,
    componentes: {
      nutricional: {
        aplica: true,
        solo_nutricionista: true,
        indicaciones: ["Mantener patrón alimentario variado — evaluación semestral","Ajustar proteína según actividad física y edad","Dieta de mantenimiento personalizada según fenotipo MCCB"]
      },
      ejercicio: {
        aplica: true,
        remision: false,
        indicaciones: ["Mantener actividad física: 150 min/semana mínimo","Combinar aeróbico y resistencia para preservar FFMI","Aumentar intensidad progresivamente para mantener ICA-BIS cerca de φ"]
      },
      psicologico: {
        aplica: false,
        remision: false,
        indicaciones: []
      },
      medico: {
        aplica: false,
        remision: false,
        indicaciones: ["Control médico anual de rutina"]
      },
      seguimiento: {
        frecuencia: "Cada 90 días",
        criterio_egreso: "Permanencia en R6 es el objetivo — escalar si algún índice sale de rango"
      }
    }
  }
};

function computeDFI({ idx, dv={}, bc={}, pt={}, icec={}, perc={}, hab={}, soc={}, epi={} }){
  if(!idx) return null;
  const famHx = (epi.famHx||[]).filter(f=>f && String(f).toLowerCase()!=="ninguna");
  // ---- Dominio 1 · Celular-Eléctrico (IFC × IRC, matiz IEHH) ----
  const ifcL = idx.ifcCl?.l, ircL = idx.ircCl?.l;
  const D1 = { "Alto|Bajo":0,"Alto|Normal":1,"Normal|Bajo":1,"Alto|Alto":2,"Normal|Normal":2,"Bajo|Bajo":2,"Normal|Alto":2,"Bajo|Normal":3,"Bajo|Alto":3 };
  let s1 = D1[`${ifcL}|${ircL}`]; if(s1==null) s1=1;
  const iehhAlt = idx.iehhCl && (idx.iehhCl.l==="Moderado"||idx.iehhCl.l==="Alto");
  if(iehhAlt) s1=_dfiCap3(s1+1);
  const dom1 = { id:"d1", nombre:"Celular-Eléctrico", icon:"🔬", sev:s1,
    clasif: idx.frL || `IFC ${ifcL} · IRC ${ircL}`,
    lectura: s1>=3?"Función celular comprometida con microambiente hostil.":s1===2?"Estado celular en presión: vigilar función y riesgo.":s1===1?"Función conservada con señal de riesgo a observar.":"Homeostasis celular: membranas íntegras y microambiente equilibrado.",
    items:[`IFC ${_dfiFmt(idx.ifc)} (${ifcL})`,`IRC ${_dfiFmt(idx.irc)} (${ircL})`,`IEHH ${_dfiFmt(idx.iehh)} (${idx.iehhCl?.l||"-"})`] };
  // ---- Dominio 2 · Metabólico-Estructural (ISCM-BIS × fenotipo) ----
  const iscmMap = { Bajo:0, Leve:1, Moderado:2, Alto:3 };
  let s2 = iscmMap[idx.iscmCl?.l] ?? 1;
  const fen = idx.structL || "";
  if(/Sarcop|Déficit|Deficit/i.test(fen)) s2=_dfiCap3(s2+1);
  const dom2 = { id:"d2", nombre:"Metabólico-Estructural", icon:"❤️", sev:s2,
    clasif:`ISCM ${idx.iscmCl?.l||"-"} · ${fen||"fenotipo N/C"}`,
    lectura: s2>=3?"Susceptibilidad cardiometabólica alta; fenotipo de riesgo.":s2===2?"Vulnerabilidad metabólica o fenotipo a corregir.":s2===1?"Susceptibilidad leve: prevención eficaz.":"Perfil metabólico-estructural favorable.",
    items:[`ISCM-BIS ${_dfiFmt(idx.iscm)} (${idx.iscmCl?.l||"-"})`,`Fenotipo: ${fen||"N/C"}`,`FMI ${_dfiFmt(dv.fmi)} · FFMI ${_dfiFmt(dv.ffmi)}`] };
  // ---- Dominio 3 · Envejecimiento (EB-BIS · IAE) ----
  const iae = idx.iae ?? 0;
  let s3;
  if(idx.iaeCl?.l==="Enlentecido") s3=0;
  else if(idx.iaeCl?.l==="Concordante") s3 = iae>3?1:0;
  else s3 = iae>10?3:2;
  const dom3 = { id:"d3", nombre:"Envejecimiento", icon:"⏳", sev:s3,
    clasif:`IAE ${_dfiSigned(iae)} años · ${idx.iaeCl?.l||"-"}`,
    lectura: s3>=3?"Envejecimiento biológico marcadamente acelerado.":s3===2?"Envejecimiento acelerado: intervenir sobre función y masa.":s3===1?"Ritmo en el límite superior de lo esperado.":"Ritmo de envejecimiento esperado o enlentecido.",
    items:[`EB-BIS ${_dfiFmt(idx.ebBis)} años`,`Edad cronológica ${pt.edad ?? "-"} años`,`IAE ${_dfiSigned(iae)} años`] };
  // ---- Dominio 4 · Conductual-Perceptual ----
  let s4=0, veto=false; const f4=[];
  const methods = perc.methods||[];
  const tca = methods.some(m=>_DFI_RISK.includes(m));
  if(tca){ s4=3; veto=true; f4.push("Conducta de riesgo (posible TCA)"); }
  const distor = perc.bodyImage && _DFI_PMAP[perc.bodyImage] && idx.fmiCat && _DFI_PMAP[perc.bodyImage]!==idx.fmiCat;
  if(distor){ s4=Math.max(s4,2); f4.push("Distorsión de imagen corporal"); if(s4>=2) veto=veto||tca; }
  if(["frecuente","siempre","alto"].includes(perc.lossControl)){ s4=Math.max(s4,2); f4.push("Pérdida de control alimentario"); }
  if(["muy_insatisfecho","insatisfecho"].includes(perc.satisfaction)){ s4=Math.max(s4,1); f4.push("Insatisfacción corporal"); }
  const dom4 = { id:"d4", nombre:"Conductual-Perceptual", icon:"🪞", sev:s4, veto,
    clasif: s4>=3?"Conducta de riesgo":s4===2?"Distorsión / desajuste":s4===1?"Señal leve":"Sin distorsión",
    lectura: s4>=3?"Prioridad psicológica; excluye intervención nutricional restrictiva.":s4===2?"Distorsión o desajuste conductual: abordaje psicológico.":s4===1?"Señal conductual a vigilar.":"Relación con el cuerpo y la comida sin alertas.",
    items: f4.length?f4:["Percepción congruente con el fenotipo real"] };
  // ---- Dominio 5 · Epigenético-Contextual (ICEC/LE8 · contexto) ----
  const icecTotal = icec.total ?? null;
  let s5;
  if(icecTotal==null) s5=1;
  else if(icecTotal>=80) s5=0;
  else if(icecTotal>=50) s5 = famHx.length>=3?2:1;
  else s5=3;
  const barrera = _dfiIsLimiting(soc.insec) || _dfiIsLimiting(soc.access);
  if(barrera) s5=_dfiCap3(s5+1);
  const dom5 = { id:"d5", nombre:"Epigenético-Contextual", icon:"🧬", sev:s5,
    clasif:`ICEC ${icecTotal==null?"-":Math.round(icecTotal)} · ${icec.cl?.l||"-"}`,
    lectura: s5>=3?"Carga epigenética alta o barreras estructurales del contexto.":s5===2?"Carga contextual amplificada por antecedentes o entorno.":s5===1?"Carga contextual moderada y modificable.":"Estilo de vida y contexto protectores.",
    items:[`ICEC/LE8 ${icecTotal==null?"-":Math.round(icecTotal)} (${icec.cl?.l||"-"})`,`Antecedentes familiares: ${famHx.length||0}`, barrera?"Barreras del contexto presentes":"Sin barreras estructurales mayores"] };
  const domains=[dom1,dom2,dom3,dom4,dom5];
  // ---- Síntesis · Riesgo integrado (ponderado) ----
  const W=[0.30,0.25,0.15,0.15,0.15];
  const score01 = domains.reduce((a,d,i)=>a+W[i]*(d.sev/3),0);
  let nivel = score01<0.20?0:score01<0.45?1:score01<0.70?2:3;
  const anySev3 = domains.some(d=>d.sev===3);
  if(anySev3) nivel=Math.max(nivel,2);
  if(veto && (dom1.sev>=2||dom2.sev>=2)) nivel=3;
  if(dom1.sev===3 && dom2.sev===3) nivel=3;
  if(dom4.sev===3) nivel=Math.max(nivel,2);
  const NIV=[{l:"BAJO",c:"#10b981",d:"Mantenimiento y optimización"},{l:"MEDIO",c:"#f59e0b",d:"Intervención dirigida y educativa"},{l:"ALTO",c:"#ea580c",d:"Intervención activa priorizada"},{l:"CRÍTICO",c:"#ef4444",d:"Intervención inmediata y seguimiento intensivo"}];
  const rutas=[];
  if(dom1.sev>=2) rutas.push("R1 · Restauración Celular");
  if(dom2.sev>=2) rutas.push("R2 · Reducción Cardiometabólica");
  if(dom4.veto||dom4.sev===3) rutas.push("R3 · Conductual (prioritaria)");
  if(dom3.sev>=2) rutas.push("R4 · Desaceleración Envejecimiento");
  if(dom5.sev>=2) rutas.push("R5 · Contextual");
  if(!rutas.length) rutas.push("R6 · Mantenimiento");
  // -- (A) DFI redactado como parrafo + (B) metas por profesional --
  // Spec: ATLAS_DFI_y_Metas_Terapeuticas_por_Profesional v1.0. El parrafo es la
  // transcripcion de los 5 dominios (no redaccion libre); la meta se deriva de las rutas.
  var _seg1 = "El paciente " + (ifcL==="Alto"?"conserva una función celular óptima":ifcL==="Normal"?"presenta una función celular en rango normal":"muestra disfunción celular")
    + " " + (ircL==="Bajo"?"con riesgo celular bajo":ircL==="Normal"?"con riesgo celular en rango normal":"con riesgo celular elevado, compatible con inflamación de bajo grado")
    + (iehhAlt?" y signos de alteración del espectro de hidratación (expansión extracelular)":"");
  var _iscmW = ({Bajo:"baja",Leve:"leve",Moderado:"intermedia",Alto:"elevada"})[idx.iscmCl && idx.iscmCl.l] || "intermedia";
  var _seg2 = "en el dominio metabólico-estructural presenta susceptibilidad cardiometabólica " + _iscmW + (fen?(" con un fenotipo estructural de " + String(fen).replace(/^Fenotipo\s+/i,"").toLowerCase()):"");
  var _aeL = idx.iaeCl && idx.iaeCl.l;
  var _seg3 = _aeL==="Enlentecido" ? "su ritmo de envejecimiento es más lento que su edad cronológica"
    : (s3>=2 ? ("su envejecimiento biológico está acelerado (" + Math.round(Math.abs(iae)) + " años por encima de lo esperado)") : "su ritmo de envejecimiento es acorde con su edad cronológica");
  var _seg4 = "en lo conductual-perceptual " + (s4>=3?"hay distorsión marcada de la imagen corporal y conductas alimentarias de riesgo":s4===2?"hay preocupación moderada por la imagen corporal":s4===1?"hay preocupación leve por la imagen corporal":"no hay distorsión de la imagen corporal");
  var _seg5 = "y la carga contextual y de estilo de vida es " + (s5<=0?"baja (entorno favorable)":s5===1?"moderada":"alta (determinantes desfavorables)");
  var _acts = [];
  if(dom1.sev>=2) _acts.push({k:"R1", pr: dom1.sev===3?1:2, nom:"Ruta 1 (Restauración Celular)"});
  if(dom2.sev>=2) _acts.push({k:"R2", pr: dom2.sev===3?1:2, nom:"Ruta 2 (Reducción Cardiometabólica)"});
  if(dom4.veto||dom4.sev===3) _acts.push({k:"R3", pr: veto?0:1, nom:"Ruta 3 (Conductual)"});
  if(dom3.sev>=2) _acts.push({k:"R4", pr: dom3.sev===3?1:2, nom:"Ruta 4 (Desaceleración del Envejecimiento)"});
  if(dom5.sev>=2) _acts.push({k:"R5", pr: 2, nom:"Ruta 5 (Contextual)"});
  if(!_acts.length) _acts.push({k:"R6", pr: 3, nom:"Ruta 6 (Mantenimiento)"});
  _acts.sort(function(a,b){return a.pr-b.pr;});
  var _prW = function(p){ return p===0?"crítica":p===1?"prioritaria":p===2?"complementaria":"de mantenimiento"; };
  var _rutasTxt = _acts.map(function(a){return a.nom+", "+_prW(a.pr);}).join("; ");
  var _nivelW = String(NIV[nivel].l||"").toLowerCase();
  var _parrafo = _seg1 + "; " + _seg2 + "; " + _seg3 + "; " + _seg4 + "; " + _seg5 + ". El perfil configura un riesgo integrado " + _nivelW + ", que activa las siguientes rutas de atención: " + _rutasTxt + ".";
  var _OBJ = {
    R1:{nutricion:"aportar densidad nutricional y proteína suficiente por sexo para superar la disfunción celular y reducir el riesgo celular, corrigiendo déficits", medicina:"descartar y tratar la causa subyacente del deterioro celular y corregir los déficits de micronutrientes", ejercicio:"instaurar entrenamiento de fuerza progresivo para mejorar la función celular y preservar la masa magra", psicologia:"asegurar la adherencia al plan y manejar el estrés que sostiene el deterioro"},
    R2:{nutricion:"instaurar un patrón antiinflamatorio con un timing adecuado para reducir la susceptibilidad cardiometabólica", medicina:"evaluar y tratar los factores de riesgo cardiometabólico", ejercicio:"combinar fuerza y trabajo aeróbico o interválico tolerado para mejorar el perfil cardiometabólico", psicologia:"consolidar hábitos y manejar el estrés asociado al riesgo"},
    R3:{nutricion:"acompañar la normalización de la alimentación sin restricción ni control del peso, reforzando una relación funcional con la comida", medicina:"valorar la evaluación psiquiátrica y descartar complicaciones", ejercicio:"suspender el ejercicio excesivo o compensatorio", psicologia:"iniciar terapia cognitivo-conductual para la imagen corporal y las conductas alimentarias de riesgo, con derivación a evaluación psiquiátrica si hay conductas compensatorias"},
    R4:{nutricion:"asegurar proteína alta por sexo y un patrón antiinflamatorio para desacelerar el envejecimiento biológico", medicina:"descartar y tratar comorbilidades y valorar la derivación a geriatría", ejercicio:"priorizar el entrenamiento de fuerza para prevenir o revertir la sarcopenia", psicologia:"sostener hábitos, sueño y manejo del estrés"},
    R5:{nutricion:"educar y resolver las barreras de acceso para mejorar la carga contextual", medicina:"controlar la presión arterial y tamizar los factores del estilo de vida", ejercicio:"prescribir actividad física accesible y sostenible", psicologia:"trabajar el sueño, el estrés y los determinantes sociales"},
    R6:{nutricion:"sostener el estado óptimo alcanzado y mantener la trayectoria del PABU cercana a phi (1,618)", medicina:"sostener el estado óptimo alcanzado y vigilar la trayectoria clínica", ejercicio:"sostener el estado óptimo alcanzado en su ámbito", psicologia:"sostener los hábitos y el bienestar alcanzados"}
  };
  var _ROLN = {nutricion:"nutrición", medicina:"medicina", ejercicio:"ejercicio", psicologia:"psicología"};
  var _metaDe = function(rol){
    var ph = _acts.map(function(a){ return _OBJ[a.k] && _OBJ[a.k][rol]; }).filter(Boolean);
    if(veto){
      if(rol==="nutricion"){
        ph = [_OBJ.R3.nutricion];
        if(dom1.sev>=2) ph.push("aportando la densidad nutricional y la proteína necesarias para superar la disfunción celular");
        if(dom3.sev>=2) ph.push("y asegurando proteína alta para desacelerar el envejecimiento");
      } else {
        var r3 = _OBJ.R3[rol]; if(r3){ ph = [r3].concat(ph.filter(function(x){return x!==r3;})); }
      }
    }
    if(!ph.length) ph = [_OBJ.R6[rol]];
    var txt = "Meta de " + _ROLN[rol] + ": " + ph.join("; ") + ".";
    if(rol==="nutricion"||rol==="ejercicio"){
      var med = [];
      if(dom1.sev>=2 && ifcL==="Bajo") med.push("mejora del IFC de al menos 0,5 unidades y salida del rango de disfunción");
      if(dom3.sev>=2) med.push("reducción del IAE de al menos 2 años");
      if(med.length) txt += " Meta a 24 semanas: " + med.join(" y ") + ".";
    }
    if(veto && rol==="nutricion") txt += " Dado que coexiste una alteración conductual, la intervención se realiza sin restricción ni control del peso.";
    return txt;
  };
  var _metas = { nutricion:_metaDe("nutricion"), medicina:_metaDe("medicina"), ejercicio:_metaDe("ejercicio"), psicologia:_metaDe("psicologia") };
  return { domains, riesgo:{...NIV[nivel], score:Math.round(score01*100)}, veto, rutas, parrafo:_parrafo, metas:_metas };
}

const computeDFIFromData = (enc, bis) => {
  const d = { ...(enc || {}), ...(bis || {}) };
  const _norm = s => (s == null ? "" : String(s)).trim().toLowerCase();
  const _pick = (m, v, fb) => (m[_norm(v)] !== undefined ? m[_norm(v)] : (fb !== undefined ? fb : ""));
  const num = (...ks) => { for (const k of ks) { const n = Number(d[k]); if (d[k] != null && d[k] !== "" && !isNaN(n)) return n; } return 0; };
  const Re = num("Re"), Ri = num("Ri"), Rinf = num("Rinf"), C = num("C");
  // Índices: usar el valor ya calculado; si falta, derivar de Cole-Cole (como el panel DFI).
  const sexoM = (d.sexo === "Masculino" || d.sexo === "M") ? "M" : "F";
  const ifc = num("IFC", "ifc") || calcIFC(C, Rinf),
        irc = num("IRC", "irc") || calcIRC(Re, Ri, C),
        pabu = num("PABU", "pabu") || calcPABU(Re, Ri, Rinf, C, sexoM);
  const iehh = num("IEHH", "iehh"), iscm = num("ISCM", "iscm"), iae = num("IAE", "iae"),
        ebBis = num("EB_BIS", "eb", "ebBis"), FMI = num("FMI", "fmi"), FFMI = num("FFMI", "ffmi");
  const icaBis = num("ICA_BIS", "icaBis") || (pabu ? pabu - 1.618 : null);
  const esMasc = sexoM === "M";
  const ifcK = cIFC(ifc, sexoM).k, ircK = cIRC(irc, sexoM).k, _fmiK = cFMI(FMI, sexoM).k;
  const edad = Number(d.edad) || null;
  const _asmi = num("ASMI"), _smmw = num("SMM_W", "smmW");
  const _fmiElev = esMasc ? FMI > 6.0 : FMI > 9.0;
  const _ffmiLow = esMasc ? (FFMI > 0 && FFMI < 17.92) : (FFMI > 0 && FFMI < 15.64);
  const _asmiLow = _asmi > 0 && _asmi < (esMasc ? 7.0 : 5.5);
  const _smmwLow = _smmw > 0 && _smmw < (esMasc ? 27 : 24);
  const _obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow);
  const _idx = {
    ifc, irc, iehh, iscm, iae, ebBis, icaBis,
    ifcCl: { l: ifcK === 3 ? "Alto" : ifcK === 2 ? "Normal" : "Bajo" },
    ircCl: { l: ircK === 1 ? "Bajo" : ircK === 2 ? "Normal" : "Alto" },
    iehhCl: { l: (() => { const x = cIEHH(iehh).l; return x === "Severo" ? "Alto" : x; })() },
    iscmCl: { l: (iscm <= -1 ? "Bajo" : iscm <= 1 ? "Leve" : iscm <= 2.5 ? "Moderado" : "Alto") },
    iaeCl: { l: (() => { const x = cIAE(iae || 0).l; return x === "Desacelerado" ? "Enlentecido" : x; })() },
    fmiCat: (_fmiK <= 1 ? "bajo_grasa" : _fmiK === 2 ? "normal" : "exceso"),
    structL: _obSarc ? "Obesidad sarcopénica" : ("Fenotipo " + cFMI(FMI, sexoM).l + "/" + cFFMI(FFMI, sexoM).l)
  };
  const _perc = {
    bodyImage: _pick({ "muy delgado/a": "muy_delgado", "delgado/a": "delgado", "normal": "normal", "sobrepeso": "sobrepeso", "obesidad": "obesidad" }, d.d2_19),
    methods: (Array.isArray(d.d2_21) ? d.d2_21 : []).map(m => _pick({ "vómito": "vomito", "vomito": "vomito", "laxantes": "laxantes", "ayunos": "ayuno", "ejercicio excesivo": "ejercicio_excesivo" }, m, null)).filter(Boolean),
    lossControl: _pick({ "frecuentemente": "frecuente", "siempre": "siempre" }, d.d2_22, _norm(d.d2_22)),
    satisfaction: _pick({ "muy insatisfecho/a": "muy_insatisfecho", "insatisfecho/a": "insatisfecho" }, d.d2_20, _norm(d.d2_20))
  };
  const _soc = {
    access: _pick({ "sí, siempre": "siempre_disponible", "si, siempre": "siempre_disponible", "a veces es difícil": "a_veces", "generalmente es difícil": "dificil" }, d.d8_61),
    insec: _pick({ "no, nunca": "no", "a veces": "a_veces", "frecuentemente": "frecuente" }, d.d8_62)
  };
  const _epi = { famHx: (Array.isArray(d.d5_38) ? d.d5_38 : []).filter(f => f && _norm(f) !== "ninguna") };
  let _t = null; try { _t = (calcLE8(d) || {}).total; if (_t == null) _t = null; } catch (e) { _t = null; }
  const _icec = { total: _t, cl: _t == null ? { l: "-" } : _t >= 80 ? { l: "Ideal" } : _t >= 50 ? { l: "Intermedio" } : { l: "Bajo" } };
  const _hasBis = !!(ifc || irc || iscm || iehh);
  return _hasBis ? computeDFI({ idx: _idx, dv: { fmi: FMI, ffmi: FFMI }, pt: { edad }, icec: _icec, perc: _perc, soc: _soc, epi: _epi }) : null;
};

const rutasActivasDFI = (enc, bis) => {
  const dfi = computeDFIFromData(enc, bis);
  if (!dfi || !Array.isArray(dfi.rutas)) return [RUTAS.R6];
  const out = [];
  dfi.rutas.forEach(s => {
    const m = /R(\d)/.exec(String(s));
    if (m) { const r = RUTAS["R" + m[1]]; if (r && out.indexOf(r) < 0) out.push(r); }
  });
  return out.length ? out : [RUTAS.R6];
};

export { computeDFI, computeDFIFromData, RUTAS, rutasActivasDFI };
