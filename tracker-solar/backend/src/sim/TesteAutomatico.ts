/**
 * Teste automático (só no simulador): um botão roda o ciclo completo com dados simulados.
 *
 *   1. Rotina do CLP — RESET dispara: sensor LESTE → varredura até o sensor OESTE →
 *                      posição de limpeza (sensor óptico) → 20 Hz com trepidação →
 *                      60 Hz → volta ao home (alvorada).
 *   2. Rastreio      — relógio ×1000: o sol vai de leste a oeste e o painel acompanha
 *                      até encostar no sensor OESTE.
 *   3. Vento         — uma rajada empurra o painel; o intertravamento tem que levá-lo a 0°.
 */
import type { EstadoTeste } from '../../../shared/types.ts';
import { contagemParaGraus, LOCAL, ROTINA, SIM } from '../config.ts';
import type { StatusDB } from '../plc/tags.ts';
import type { SolarClock } from '../solar/SolarClock.ts';
import { elevacaoPorDoSol, posicaoSol } from '../solar/sunPosition.ts';
import type { SimSource } from './SimSource.ts';

export const VELOCIDADE_TESTE = 1000;
const VEL_EIXO_TESTE_DEG_S = 10;   // o sol anda ~4 °/s no relógio ×1000; o eixo precisa acompanhar
const RAJADA_VENTO_DEG = -3;
const TIMEOUT_ROTINA_MS = 150_000;
const TIMEOUT_ETAPA_MS = 60_000;

type Etapa = 'rotina' | 'rastreio' | 'vento';

const TEXTOS: Record<Etapa, string> = {
  rotina: 'Rotina do CLP: leste → oeste → limpeza → home',
  rastreio: `Rastreando o sol ×${VELOCIDADE_TESTE} (leste → oeste)`,
  vento: 'Rajada de vento: esperando o intertravamento levar o painel a 0°',
};
const ORDEM: Etapa[] = ['rotina', 'rastreio', 'vento'];
/** Etapas da rotina do CLP que o teste exige ver (1..6, ver ETAPAS_ROTINA). */
const ETAPAS_EXIGIDAS = [1, 2, 3, 4, 5, 6];

export class TesteAutomatico {
  private etapa: Etapa | null = null;
  private resultado: { texto: string; ok: boolean } | null = null;
  private inicioEtapa = 0;
  private startEnviado = false;
  private etapasVistas = new Set<number>();
  private velRelogioAnterior = 0;

  constructor(private readonly sim: SimSource, private readonly relogio: SolarClock) {}

  get ativo() {
    return this.etapa !== null;
  }

  iniciar() {
    if (this.ativo) return;
    this.velRelogioAnterior = this.relogio.velocidade;
    this.resultado = null;
    this.etapasVistas.clear();

    this.sim.definirEmergencia(false);
    this.sim.velMaxDegS = VEL_EIXO_TESTE_DEG_S;

    // relógio parado logo após o nascer do sol: ao fim da rotina o setpoint fica no limite leste
    this.relogio.velocidade = 0;
    this.relogio.irPara(new Date(this.nascerDoSol() + 15 * 60_000).toISOString());

    this.sim.escrever('cmdReset', true); // destrava e dispara a rotina completa
    this.mudar('rotina');
  }

  cancelar() {
    if (this.ativo) this.finalizar('Teste cancelado', false);
  }

  /** Chamado a cada passo do supervisor, depois de ler o DB. */
  passo(db: StatusDB | null, diurno: boolean) {
    if (!this.etapa || !db) return;
    const decorrido = Date.now() - this.inicioEtapa;
    const limite = this.etapa === 'rotina' ? TIMEOUT_ROTINA_MS : TIMEOUT_ETAPA_MS;
    if (this.etapa !== 'rastreio' && decorrido > limite) {
      return this.finalizar(`Falhou: tempo esgotado em "${TEXTOS[this.etapa]}"`, false);
    }
    if (db.emergencia) return this.finalizar('Falhou: emergência acionada', false);
    // logo após o reset o DB ainda pode mostrar "travado"; no teste de vento o travamento é o esperado
    if (db.travado && this.etapa !== 'vento' && decorrido > 1000) {
      return this.finalizar('Falhou: tracker travou fora do teste de vento', false);
    }
    if (db.codigoAlarme === 11) return this.finalizar('Falhou: sensor óptico não confirmou a posição de limpeza', false);

    switch (this.etapa) {
      case 'rotina':
        // start vai depois do reset ter sido processado, para seguir rastreando ao fim da rotina
        if (!this.startEnviado && decorrido > 300) {
          this.sim.escrever('cmdStart', true);
          this.startEnviado = true;
        }
        if (db.etapaRotina > 0) this.etapasVistas.add(db.etapaRotina);
        if (this.etapasVistas.has(6) && db.etapaRotina === 0 && db.fimCursoLeste && !db.emMovimento) {
          const faltou = ETAPAS_EXIGIDAS.filter((e) => !this.etapasVistas.has(e));
          if (faltou.length) return this.finalizar(`Falhou: a rotina pulou as etapas ${faltou.join(', ')}`, false);
          this.relogio.velocidade = VELOCIDADE_TESTE;
          this.mudar('rastreio');
        }
        break;
      case 'rastreio':
        // tarde: painel encostado no sensor oeste -> pausa o sol e solta a rajada
        if (db.fimCursoOeste && !db.emMovimento) {
          this.relogio.velocidade = 0;
          this.sim.perturbar(RAJADA_VENTO_DEG);
          this.mudar('vento');
        } else if (!diurno && decorrido > 5000) {
          this.finalizar('Falhou: o rastreio não chegou ao sensor OESTE', false);
        }
        break;
      case 'vento': {
        const anguloReal = contagemParaGraus(db.encoderContagem);
        if (db.travado && db.etapaRotina === 8 && Math.abs(anguloReal - ROTINA.posicaoIntertravamentoDeg) < 0.5) {
          this.finalizar(
            `Teste OK: rotina completa, rastreio leste → oeste e intertravamento em ${ROTINA.posicaoIntertravamentoDeg}°. Use RESET para rearmar.`,
            true,
          );
        }
        break;
      }
    }
  }

  estado(): EstadoTeste {
    if (this.etapa) {
      return { ativo: true, texto: TEXTOS[this.etapa], passo: ORDEM.indexOf(this.etapa) + 1, total: ORDEM.length, ok: true };
    }
    return { ativo: false, texto: this.resultado?.texto ?? '', passo: 0, total: ORDEM.length, ok: this.resultado?.ok ?? true };
  }

  private mudar(etapa: Etapa) {
    this.etapa = etapa;
    this.inicioEtapa = Date.now();
    this.startEnviado = false;
  }

  private finalizar(texto: string, ok: boolean) {
    this.etapa = null;
    this.resultado = { texto, ok };
    this.relogio.velocidade = this.velRelogioAnterior;
    this.sim.velMaxDegS = SIM.velMaxDegS;
  }

  /** Primeiro instante (UTC ms) do dia simulado em que o sol está acima do horizonte. */
  private nascerDoSol(): number {
    const off = LOCAL.utcOffsetHoras * 3_600_000;
    const local = new Date(this.relogio.data.getTime() + off);
    const meiaNoite = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - off;
    const limite = elevacaoPorDoSol(LOCAL.altitudeM);
    for (let min = 3 * 60; min < 10 * 60; min += 2) {
      const t = meiaNoite + min * 60_000;
      if (posicaoSol(new Date(t), LOCAL.latitude, LOCAL.longitude).elevacaoDeg > limite) return t;
    }
    return meiaNoite + 6 * 3_600_000;
  }
}
