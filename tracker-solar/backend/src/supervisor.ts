/**
 * Supervisor: junta relógio solar + fonte de dados (simulador ou CLP),
 * decide o setpoint enviado ao CLP e monta o estado que vai para a tela.
 */
import {
  CONEXAO, ETAPAS_ROTINA, freqDoIndice, INVERSOR, LOCAL, RELOGIO, ROTINA, rpmMotor, TRACKER,
  contagemParaGraus, textoAlarme, textoEtapa,
} from './config.ts';
import type {
  ComandosAtuais, MsgCliente, PlantInfo, PlantState,
} from '../../shared/types.ts';
import type { PlantSource } from './plc/tags.ts';
import { SimSource } from './sim/SimSource.ts';
import { TesteAutomatico } from './sim/TesteAutomatico.ts';
import { SolarClock } from './solar/SolarClock.ts';
import { anguloIdealTracker, elevacaoPorDoSol, posicaoSol } from './solar/sunPosition.ts';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Supervisor {
  readonly relogio = new SolarClock();
  private ultimaEscritaSp = 0;

  readonly comandos: ComandosAtuais = {
    modoAuto: true,
    usaSetpointPC: true,
    fonteSetpoint: 'sol',
    setpointManualDeg: 0,
    setpointEnviadoDeg: NaN,
    escovaVelIdx: 2,
  };

  private readonly teste: TesteAutomatico | null;

  constructor(readonly fonte: PlantSource) {
    this.teste = fonte instanceof SimSource ? new TesteAutomatico(fonte, this.relogio) : null;
    // estado inicial dos comandos de nível
    fonte.escrever('modoAuto', this.comandos.modoAuto);
    fonte.escrever('usaSetpointPC', this.comandos.usaSetpointPC);
    fonte.escrever('escovaVelIdx', this.comandos.escovaVelIdx);
  }

  info(): PlantInfo {
    return {
      fonte: CONEXAO.modo,
      local: LOCAL,
      eixoAzimuteDeg: TRACKER.eixoAzimuteDeg,
      limiteLesteDeg: TRACKER.limiteLesteDeg,
      limiteOesteDeg: TRACKER.limiteOesteDeg,
      tabelaFreqHz: INVERSOR.tabelaFreqHz,
      velocidadesRelogio: RELOGIO.velocidades,
      limpezaDuracaoS: ROTINA.limpezaTempo1S + ROTINA.limpezaTempo2S,
      posicaoLimpezaDeg: ROTINA.posicaoLimpezaDeg,
      etapasRotina: ETAPAS_ROTINA,
    };
  }

  /** Chamado periodicamente: avança o relógio, calcula o sol e atualiza o setpoint. */
  passo(): PlantState {
    const data = this.relogio.tick();
    const sol = posicaoSol(data, LOCAL.latitude, LOCAL.longitude);
    const diurno = sol.elevacaoDeg > elevacaoPorDoSol(LOCAL.altitudeM);
    const livre = diurno ? anguloIdealTracker(sol, TRACKER.eixoAzimuteDeg) : TRACKER.anguloNoiteDeg;
    const ideal = clamp(livre, TRACKER.limiteLesteDeg, TRACKER.limiteOesteDeg);

    // ---- setpoint enviado ao CLP ----
    const alvo = this.comandos.fonteSetpoint === 'sol'
      ? ideal
      : clamp(this.comandos.setpointManualDeg, TRACKER.limiteLesteDeg, TRACKER.limiteOesteDeg);
    const agora = Date.now();
    const mudou = !(Math.abs(alvo - this.comandos.setpointEnviadoDeg) < TRACKER.bandaMortaSetpointDeg);
    if (mudou && agora - this.ultimaEscritaSp >= TRACKER.intervaloEscritaSetpointMs) {
      this.fonte.escrever('setpointDeg', round(alvo, 2));
      this.comandos.setpointEnviadoDeg = round(alvo, 2);
      this.ultimaEscritaSp = agora;
    }

    // ---- imagem do DB -> estado da tela ----
    const db = this.fonte.ler();
    this.teste?.passo(db, diurno);
    const encDeg = db ? contagemParaGraus(db.encoderContagem) : 0;
    const freq = db && db.escovaLigada ? freqDoIndice(db.escovaVelIdx) : 0;
    const rpm = rpmMotor(freq);

    return {
      t: agora,
      fonte: CONEXAO.modo,
      plcConectado: this.fonte.conectado && db !== null,
      vivoPlc: db?.vivoPlc ?? 0,
      eixo: {
        posDeg: db?.posEixoDeg ?? 0,
        velDegS: db?.velEixoDegS ?? 0,
        setpointAtualDeg: db?.setpointAtualDeg ?? 0,
      },
      encoder: {
        contagem: db?.encoderContagem ?? 0,
        deg: encDeg,
        erroDeg: db ? db.posEixoDeg - encDeg : 0,
      },
      escova: {
        velIdx: db?.escovaVelIdx ?? this.comandos.escovaVelIdx,
        freqHz: freq,
        rpmMotor: rpm,
        rpmEscova: rpm / INVERSOR.reducaoEscova,
      },
      flags: {
        emAuto: db?.emAuto ?? false,
        emMovimento: db?.emMovimento ?? false,
        referenciado: db?.referenciado ?? false,
        sensorHome: db?.sensorHome ?? false,
        limpezaAtiva: db?.limpezaAtiva ?? false,
        escovaLigada: db?.escovaLigada ?? false,
        travado: db?.travado ?? false,
        emergencia: db?.emergencia ?? false,
        fimCursoLeste: db?.fimCursoLeste ?? false,
        fimCursoOeste: db?.fimCursoOeste ?? false,
        pronto: db?.pronto ?? false,
        falhaCommPC: db?.falhaCommPC ?? false,
        sensorOptico: db?.sensorOptico ?? false,
      },
      alarme: { codigo: db?.codigoAlarme ?? 0, texto: textoAlarme(db?.codigoAlarme ?? 0) },
      rotina: { etapa: db?.etapaRotina ?? 0, texto: textoEtapa(db?.etapaRotina ?? 0) },
      comandos: { ...this.comandos },
      sol: {
        relogioIso: data.toISOString(),
        velocidade: this.relogio.velocidade,
        azimuteDeg: sol.azimuteDeg,
        elevacaoDeg: sol.elevacaoDeg,
        anguloIdealDeg: ideal,
        anguloIdealLivreDeg: livre,
        diurno,
      },
      teste: this.teste?.estado() ?? { ativo: false, texto: '', passo: 0, total: 0, ok: true },
    };
  }

  /** Trata mensagens vindas da interface. Retorna texto de erro, se houver. */
  tratar(msg: MsgCliente): string | null {
    switch (msg.type) {
      case 'cmd': {
        const mapa = { start: 'cmdStart', stop: 'cmdStop', home: 'cmdHome', limpar: 'cmdLimpar', reset: 'cmdReset' } as const;
        const campo = mapa[msg.cmd];
        if (!campo) return `Comando desconhecido: ${msg.cmd}`;
        this.fonte.escrever(campo, true);
        return null;
      }
      case 'set': {
        if (msg.key === 'modoAuto' || msg.key === 'usaSetpointPC') {
          this.comandos[msg.key] = Boolean(msg.value);
          this.fonte.escrever(msg.key, Boolean(msg.value));
        } else if (msg.key === 'fonteSetpoint') {
          this.comandos.fonteSetpoint = msg.value === 'manual' ? 'manual' : 'sol';
        } else if (msg.key === 'setpointManualDeg') {
          const v = Number(msg.value);
          if (!Number.isFinite(v)) return 'Setpoint inválido';
          this.comandos.setpointManualDeg = clamp(v, TRACKER.limiteLesteDeg, TRACKER.limiteOesteDeg);
        } else if (msg.key === 'escovaVelIdx') {
          const idx = clamp(Math.round(Number(msg.value)), 0, INVERSOR.tabelaFreqHz.length - 1);
          this.comandos.escovaVelIdx = idx;
          this.fonte.escrever('escovaVelIdx', idx);
        }
        return null;
      }
      case 'relogio': {
        if (typeof msg.velocidade === 'number' && msg.velocidade >= 0 && msg.velocidade <= 100_000) {
          this.relogio.velocidade = msg.velocidade;
        }
        if (msg.agora) this.relogio.agora();
        if (msg.irParaIso) this.relogio.irPara(msg.irParaIso);
        return null;
      }
      case 'sim': {
        if (!(this.fonte instanceof SimSource)) return 'Ação disponível só no modo simulador';
        if (msg.acao === 'perturbar') this.fonte.perturbar(clamp(Number(msg.deltaDeg) || 0, -20, 20));
        if (msg.acao === 'emergencia') this.fonte.definirEmergencia(Boolean(msg.value));
        if (msg.acao === 'teste') {
          if (msg.value) {
            // o teste roda com rastreio automático pelo sol
            for (const k of ['modoAuto', 'usaSetpointPC'] as const) {
              this.comandos[k] = true;
              this.fonte.escrever(k, true);
            }
            this.comandos.fonteSetpoint = 'sol';
            this.teste?.iniciar();
          } else {
            this.teste?.cancelar();
          }
        }
        return null;
      }
      default:
        return 'Mensagem desconhecida';
    }
  }
}

function round(v: number, casas: number) {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}
