import { LOCAL, RELOGIO } from '../config.ts';

/** Relógio simulado: avança `velocidade` vezes mais rápido que o tempo real. */
export class SolarClock {
  private simMs: number;
  private ultimoReal = Date.now();
  velocidade = RELOGIO.velocidadeInicial;

  constructor() {
    this.simMs = horaInicial();
  }

  tick(): Date {
    const agora = Date.now();
    this.simMs += (agora - this.ultimoReal) * this.velocidade;
    this.ultimoReal = agora;
    return new Date(this.simMs);
  }

  irPara(iso: string) {
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) this.simMs = t;
  }

  agora() {
    this.simMs = Date.now();
  }

  get data() {
    return new Date(this.simMs);
  }
}

function horaInicial(): number {
  if (!RELOGIO.horaInicialLocal) return Date.now();
  const [h, m] = RELOGIO.horaInicialLocal.split(':').map(Number);
  // "hoje" no fuso do local
  const localAgora = new Date(Date.now() + LOCAL.utcOffsetHoras * 3_600_000);
  const utc = Date.UTC(
    localAgora.getUTCFullYear(), localAgora.getUTCMonth(), localAgora.getUTCDate(),
    h - LOCAL.utcOffsetHoras, m,
  );
  return utc;
}
