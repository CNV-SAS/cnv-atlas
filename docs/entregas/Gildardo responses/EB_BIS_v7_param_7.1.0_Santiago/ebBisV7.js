// EB-BIS v7 · Sistema ANI BIS-E · © Gildardo de Jesús Uribe Gil, 2026
// Parámetros 7.1.0 (25 de octubre de 2026). Núcleo: pesos y referencias 7.0.0 (sin cambio).
// Esperado de los pares: curvo (edad, edad² y FMI) y DE residual ajustados en la base consolidada
// BiodyXpert ZM3 (n = 5.891 adultos de 18 años o más, FFMI ≤ 23 en mujeres y ≤ 25 en hombres).
const EB_BIS_V7 = {
  version: '7.1.0',
  escalaAniosPorDE: 5,      // definitiva (25 de octubre de 2026)
  topeAnios: 15,
  F: { mu: { IRC: 2.6054, ReRi: 0.3600, PSSGp: 0.2020 }, de: { IRC: 0.7025, ReRi: 0.0630, PSSGp: 0.0206 },
       w: { IRC: 0.435, ReRi: -1.268, PSSGp: -4.090 },
       esperado: { b0: -5.773081, edad: -0.021269, edad2: 0.0013760, FMI: 0.602892 }, deResidual: 2.793 },
  M: { mu: { IRC: 1.9520, ReRi: 0.4186, PSSGp: 0.2204 }, de: { IRC: 0.5421, ReRi: 0.0811, PSSGp: 0.0230 },
       w: { IRC: 3.825, ReRi: -5.057, PSSGp: -3.930 },
       esperado: { b0: -6.852137, edad: -0.042247, edad2: 0.0026575, FMI: 0.472553 }, deResidual: 5.165 }
};

function ebBisV7({ sexo, edad, Re, Ri, C, peso, MLG, ACT, FMI, ICEC = null }) {
  const p = EB_BIS_V7[sexo];
  if (!p) return { estado: 'error', motivo: 'sexo no válido' };
  if (!Number.isInteger(edad) || edad < 18 || edad > 100) return { estado: 'pendiente', motivo: 'edad no válida' };
  for (const [k, v] of Object.entries({ Re, Ri, C, peso, MLG, ACT, FMI }))
    if (!(typeof v === 'number' && isFinite(v) && v > 0)) return { estado: 'pendiente', motivo: `dato faltante o inválido: ${k}` };
  const IRC = (Re / (Ri * C)) * 10;
  const ReRi = Re / Ri;
  const PSSG = MLG - ACT;                 // masa seca sin grasa (kg)
  const PSSGp = PSSG / peso;              // por kg de peso corporal
  if (PSSGp <= 0.05 || PSSGp >= 0.40) return { estado: 'revisar', motivo: 'masa seca sin grasa fuera de rango fisiológico' };
  const z = {
    IRC: (IRC - p.mu.IRC) / p.de.IRC,
    ReRi: (ReRi - p.mu.ReRi) / p.de.ReRi,
    PSSGp: (PSSGp - p.mu.PSSGp) / p.de.PSSGp
  };
  const S = p.w.IRC * z.IRC + p.w.ReRi * z.ReRi + p.w.PSSGp * z.PSSGp;
  const Sesp = p.esperado.b0 + p.esperado.edad * edad + p.esperado.edad2 * edad * edad + p.esperado.FMI * FMI;
  const zPares = (S - Sesp) / p.deResidual;
  const T = EB_BIS_V7.topeAnios;
  const IAE = Math.max(-T, Math.min(T, EB_BIS_V7.escalaAniosPorDE * zPares));
  const EB = edad + IAE;
  const alertaDiscordancia = ICEC !== null && zPares >= 1 && ICEC >= 80;
  return {
    estado: 'ok', version: 'EB-BIS v7', versionParametros: EB_BIS_V7.version,
    EB_BIS: Math.round(EB * 10) / 10, IAE: Math.round(IAE * 10) / 10, zPares: Math.round(zPares * 100) / 100,
    topado: Math.abs(EB_BIS_V7.escalaAniosPorDE * zPares) > T,
    alertaDiscordancia,
    intermedios: { IRC, ReRi, PSSG, PSSGp, z, S, Sesp }
  };
}
module.exports = { ebBisV7, EB_BIS_V7 };
