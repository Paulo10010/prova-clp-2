import { useEffect, useMemo, useRef, useState } from 'react';
import type { Amostra } from '../store.ts';

export interface Serie {
  chave: keyof Omit<Amostra, 't'>;
  rotulo: string;
  cor: string;
  tracejado?: boolean;
}

interface Props {
  titulo: string;
  dados: Amostra[];
  series: Serie[];
  unidade: string;
  altura?: number;
  minY?: number;          // limites fixos (opcional)
  maxY?: number;
  minFaixa?: number;      // faixa mínima do eixo Y quando automático
}

/** Gráfico de tendência leve em SVG (sem dependências). */
export function TrendChart({ titulo, dados, series, unidade, altura = 170, minY, maxY, minFaixa = 2 }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(400);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = { e: 40, d: 10, t: 8, b: 20 };
  const w = largura - m.e - m.d;
  const h = altura - m.t - m.b;

  const { y0, y1, ticks } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of dados) for (const s of series) {
      const v = a[s.chave];
      if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    if (minY !== undefined) lo = minY;
    if (maxY !== undefined) hi = maxY;
    if (hi - lo < minFaixa) {
      if (minY !== undefined) hi = lo + minFaixa;
      else { const c = (hi + lo) / 2; lo = c - minFaixa / 2; hi = c + minFaixa / 2; }
    }
    const passo = passoBonito((hi - lo) / 4);
    const a = Math.floor(lo / passo) * passo;
    const b = Math.ceil(hi / passo) * passo;
    const t: number[] = [];
    for (let v = a; v <= b + passo / 2; v += passo) t.push(Number(v.toFixed(6)));
    return { y0: a, y1: b, ticks: t };
  }, [dados, series, minY, maxY, minFaixa]);

  const t0 = dados[0]?.t ?? 0;
  const t1 = dados[dados.length - 1]?.t ?? 1;
  const px = (t: number) => m.e + ((t - t0) / Math.max(1, t1 - t0)) * w;
  const py = (v: number) => m.t + (1 - (v - y0) / Math.max(1e-9, y1 - y0)) * h;

  const ultimo = dados[dados.length - 1];

  return (
    <div className="grafico" ref={caixa}>
      <div className="grafico-topo">
        <span className="grafico-titulo">{titulo}</span>
        <span className="legenda">
          {series.map((s) => (
            <span key={s.chave} className="legenda-item">
              <i style={{ background: s.tracejado ? 'transparent' : s.cor, borderColor: s.cor }} className={s.tracejado ? 'tracejado' : ''} />
              {s.rotulo}
              {ultimo && <b>{ultimo[s.chave].toFixed(1).replace('.', ',')}</b>}
            </span>
          ))}
        </span>
      </div>
      <svg width={largura} height={altura} role="img" aria-label={titulo}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.e} x2={m.e + w} y1={py(v)} y2={py(v)} className={v === 0 ? 'eixo-zero' : 'grade'} />
            <text x={m.e - 6} y={py(v) + 3.5} className="tick" textAnchor="end">{fmtTick(v)}</text>
          </g>
        ))}
        <text x={m.e} y={altura - 4} className="tick">−{Math.round((t1 - t0) / 1000)} s</text>
        <text x={m.e + w} y={altura - 4} className="tick" textAnchor="end">agora · {unidade}</text>
        {dados.length > 1 && series.map((s) => (
          <polyline
            key={s.chave}
            fill="none"
            stroke={s.cor}
            strokeWidth={s.tracejado ? 1.5 : 2}
            strokeDasharray={s.tracejado ? '5 4' : undefined}
            strokeLinejoin="round"
            points={dados.map((a) => `${px(a.t).toFixed(1)},${py(a[s.chave]).toFixed(1)}`).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}

function passoBonito(bruto: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(1e-9, bruto)));
  const n = bruto / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function fmtTick(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}
