export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

export function fmt(v: number | undefined, casas = 1, unidade = '') {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const s = v.toFixed(casas).replace('.', ',').replace(/^-0(,0+)?$/, '0$1');
  return unidade ? `${s}${unidade}` : s;
}

/** Vetor unitário do sol no mundo 3D: x = leste, y = cima, z = sul. */
export function vetorSol(azDeg: number, elDeg: number): [number, number, number] {
  const az = rad(azDeg);
  const el = rad(elDeg);
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)];
}

/** Normal do painel (no referencial do tracker, eixo ao longo de z) para um ângulo em graus. */
export function normalPainel(anguloDeg: number): [number, number, number] {
  const a = rad(anguloDeg);
  return [-Math.sin(a), Math.cos(a), 0];
}

/** Hora formatada no fuso do local simulado (offset fixo em horas). */
export function horaLocal(iso: string, offsetH: number, comSegundos = false) {
  const d = new Date(Date.parse(iso) + offsetH * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const hm = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  return comSegundos ? `${hm}:${p(d.getUTCSeconds())}` : hm;
}

export function dataLocal(iso: string, offsetH: number) {
  const d = new Date(Date.parse(iso) + offsetH * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Converte o valor de um <input type="datetime-local"> (hora do local) para ISO UTC. */
export function localParaIso(valor: string, offsetH: number) {
  const t = Date.parse(`${valor}:00Z`);
  return new Date(t - offsetH * 3_600_000).toISOString();
}
