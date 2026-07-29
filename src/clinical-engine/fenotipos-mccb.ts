// FENOTIPOS_MCCB — tabla de lookup de los 12 fenotipos MCCB, CONTENIDO PORTADO VERBATIM de
// Gildardo (ATLAS.html:10891-10904). Precedente: rutas-content.ts. NO es logica; son
// datos. Un DIFF (frozen-fenotipo-diff.test.ts) ancla estas 12 lineas byte a byte contra la fuente.
// ATLAS no las edita ni las re-estiliza; los cambios nacen del lado de Gildardo. Generado por
// script; no editar a mano.
export interface Fenotipo {
  id: string;
  nombre: string;
  riesgo: string;
  color: string;
}

export const FENOTIPOS_MCCB: Record<string, Fenotipo> = {
    'alto_clinico_bajo':     { id:'F1',  nombre:'Obesidad sarcopénica clínica',     riesgo:'crítico',  color:'#7b0000' },
    'alto_clinico_normal':   { id:'F2',  nombre:'Obesidad clínica clásica',          riesgo:'alto',     color:'#dc2626' },
    'alto_clinico_alto':     { id:'F3',  nombre:'Obesidad con hipermusculatura',     riesgo:'alto',     color:'#b91c1c' },
    'alto_preclinico_bajo':  { id:'F4',  nombre:'Obesidad precl. sarcopénica',       riesgo:'alto',     color:'#ef4444' },
    'alto_preclinico_normal':{ id:'F5',  nombre:'Obesidad preclínica clásica',       riesgo:'moderado', color:'#f97316' },
    'alto_preclinico_alto':  { id:'F6',  nombre:'Obesidad precl. hipermusculada',    riesgo:'moderado', color:'#f59e0b' },
    'normal_bajo':           { id:'F7',  nombre:'Normopeso sarcopénico',             riesgo:'moderado', color:'#ea580c' },
    'normal_normal':         { id:'F8',  nombre:'Normopeso',                         riesgo:'bajo',     color:'#22c55e' },
    'bajo_bajo':             { id:'F9',  nombre:'Bajo peso sarcopénico',             riesgo:'alto',     color:'#7c3aed' },
    'bajo_normal':           { id:'F10', nombre:'Bajo peso',                         riesgo:'moderado', color:'#a78bfa' },
    'bajo_alto':             { id:'F11', nombre:'Constitución delgada musculosa',    riesgo:'bajo',     color:'#16a34a' },
    'normal_alto':           { id:'F12', nombre:'Físicamente activo buenos hábitos', riesgo:'bajo',     color:'#15803d' },
};
