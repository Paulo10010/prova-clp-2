/**
 * Simulador da planta + da lógica do CLP.
 *
 * Imita o que o S7-1200 faz na bancada, escrevendo na mesma "imagem"
 * do DB_Supervisorio que o driver real lê. Assim o resto do sistema
 * (supervisor, WebSocket, frontend) não sabe se está no simulador ou no CLP.
 *
 * Modelo:
 *  - Motor de passo em malha aberta: `posEixo` é o que o Technology Object acha.
 *  - `anguloReal` é o ângulo físico do painel, medido pelo encoder.
 *    Uma perturbação (vento, empurrão) muda só o anguloReal.
 *
 * Rotina (HOME ou RESET disparam a rotina completa; LIMPAR roda do passo 3 em diante):
 *  1. vai a leste até o sensor indutivo LESTE: define posEixo = home e zera o HSC
 *  2. varre até o sensor indutivo OESTE
 *  3. vai para ROTINA.posicaoLimpezaDeg; o sensor óptico tem que confirmar a posição;
 *     limpeza a 20 Hz com o motor de passo trepidando em microstep, depois 60 Hz
 *  4. volta para o home (posição de alvorada) e segue rastreando se estiver em Start
 *  5. vento: se o encoder divergir do eixo (referenciado), trava (alarme 10)
 *     e o intertravamento leva o painel a 0°. RESET refaz a rotina.
 */
import {
  CONTAGENS_POR_GRAU, ENCODER, INVERSOR, ROTINA, SIM, TRACKER,
} from '../config.ts';
import type { CampoComando, PlantSource, StatusDB, ValorComando } from '../plc/tags.ts';

type Fase =
  | 'parado' | 'rastreando'
  | 'buscaLeste' | 'varreduraOeste' | 'irLimpeza' | 'limpeza1' | 'limpeza2' | 'voltaHome'
  | 'intertravamento' | 'intertravado';

/** Fase -> Status.Etapa_Rotina (tabela ETAPAS_ROTINA no config.ts). */
const ETAPA: Record<Fase, number> = {
  parado: 0, rastreando: 0,
  buscaLeste: 1, varreduraOeste: 2, irLimpeza: 3, limpeza1: 4, limpeza2: 5, voltaHome: 6,
  intertravamento: 7, intertravado: 8,
};

/** Faixa de detecção dos sensores indutivos de fim de curso (o came "entra" no sensor). */
const BANDA_SENSOR_DEG = 0.5;

const indiceFreq = (hz: number) => Math.max(0, INVERSOR.tabelaFreqHz.indexOf(hz));

export class SimSource implements PlantSource {
  readonly conectado = true;
  private timer: NodeJS.Timeout | null = null;
  private ultimo = Date.now();

  // Estado físico
  private anguloReal = SIM.posicaoInicialDeg;
  private posEixo = SIM.posicaoInicialDeg; // antes do home o CLP "acha" que está aqui
  private vel = 0;
  // Ângulo real em que o HSC foi zerado. Começa como se a contagem tivesse sido
  // preservada desde o último home (encoder já coerente ao ligar o simulador).
  private hscZeroDeg = ENCODER.anguloZeroDeg;

  // Estado lógico (o que a lógica do CLP guardaria)
  private fase: Fase = 'parado';
  private rodando = false;
  private referenciado = false;
  private travado = false;
  private emergencia = false;
  private escovaLigada = false;
  private escovaIdx = 0;
  private fimEstagio = 0;
  private baseTrepidacao = 0;
  private codigoAlarme = 0;
  private vivoPlc = 0;
  private perturbacaoPendente = 0;

  /** Ajustável pelo teste automático (padrão vem do config.ts). */
  velMaxDegS = SIM.velMaxDegS;

  // Imagem da área de comandos do DB
  private cmd = {
    vivoPc: 0, setpointDeg: 0, escovaVelIdx: 2,
    cmdStart: false, cmdStop: false, cmdHome: false, cmdLimpar: false, cmdReset: false,
    modoAuto: true, usaSetpointPC: true,
  };

  iniciar() {
    this.ultimo = Date.now();
    this.timer = setInterval(() => this.ciclo(), 50); // "scan" de 50 ms
  }

  parar() {
    if (this.timer) clearInterval(this.timer);
  }

  escrever(campo: CampoComando, valor: ValorComando) {
    (this.cmd as Record<string, ValorComando>)[campo] = valor;
  }

  /** Só no simulador: empurra o painel (simula vento / esforço mecânico). */
  perturbar(deltaDeg: number) {
    this.perturbacaoPendente += deltaDeg;
  }

  definirEmergencia(on: boolean) {
    this.emergencia = on;
  }

  private contagemEncoder(): number {
    return Math.round(ENCODER.sentido * (this.anguloReal - this.hscZeroDeg) * CONTAGENS_POR_GRAU);
  }

  /** Contagem que o encoder deveria ter se o painel estivesse onde o eixo acha que está. */
  private contagemEsperada(): number {
    return ENCODER.sentido * (this.posEixo - this.hscZeroDeg) * CONTAGENS_POR_GRAU;
  }

  private ciclo() {
    const agora = Date.now();
    const dt = Math.min(0.2, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    this.vivoPlc = (this.vivoPlc + 1) % 32000;

    // ---- Comandos (pulsos: lidos e zerados, como o FB_Supervisorio faz) ----
    const c = this.cmd;
    if (c.cmdStop) {
      this.rodando = false;
      this.desligarEscova();
      if (this.fase !== 'intertravado' && this.fase !== 'intertravamento') this.fase = 'parado';
    }
    if (c.cmdStart && !this.travado && !this.emergencia) this.rodando = true;
    if (c.cmdReset && !this.emergencia) {
      this.travado = false;
      this.codigoAlarme = 0;
      this.iniciarRotina();
    }
    if (c.cmdHome && !this.travado && !this.emergencia) this.iniciarRotina();
    if (c.cmdLimpar && this.referenciado && !this.travado && !this.emergencia
      && (this.fase === 'parado' || this.fase === 'rastreando')) {
      this.fase = 'irLimpeza';
    }
    c.cmdStart = c.cmdStop = c.cmdHome = c.cmdLimpar = c.cmdReset = false;

    // ---- Emergência ----
    if (this.emergencia) {
      this.rodando = false;
      this.desligarEscova();
      // travado: mantém intertravamento/intertravado para retomar a ida a 0° ao liberar
      if (!this.travado) this.fase = 'parado';
      this.codigoAlarme = 1;
    } else if (this.codigoAlarme === 1) {
      // ao liberar, o travamento por vento continua valendo até o RESET
      this.codigoAlarme = this.travado ? 10 : 0;
    }

    // ---- Perturbação física (só muda o ângulo real) ----
    if (this.perturbacaoPendente !== 0) {
      const passo = Math.sign(this.perturbacaoPendente) * Math.min(Math.abs(this.perturbacaoPendente), 4 * dt);
      this.anguloReal += passo;
      this.perturbacaoPendente -= passo;
      if (Math.abs(this.perturbacaoPendente) < 1e-6) this.perturbacaoPendente = 0;
    }

    // ---- 5) Vento: encoder divergiu do eixo -> intertravamento ----
    if (this.referenciado && !this.travado && !this.emergencia && this.fase !== 'buscaLeste'
      && Math.abs(this.contagemEncoder() - this.contagemEsperada()) >= ENCODER.toleranciaContagens) {
      this.travado = true;
      this.rodando = false;
      this.codigoAlarme = 10;
      this.desligarEscova();
      this.fase = 'intertravamento';
    }

    // ---- Máquina de estados ----
    let alvo: number | null = null;
    let velMax = this.velMaxDegS;

    switch (this.fase) {
      case 'buscaLeste': {
        velMax = SIM.velHomingDegS;
        alvo = TRACKER.limiteLesteDeg - 10; // segue para leste até achar o sensor
        if (this.sensorLeste()) {
          this.posEixo = TRACKER.posicaoHomeDeg;
          this.anguloReal = TRACKER.posicaoHomeDeg;
          this.hscZeroDeg = ENCODER.anguloZeroDeg;
          this.referenciado = true;
          this.vel = 0;
          alvo = null;
          this.fase = 'varreduraOeste';
        }
        break;
      }
      case 'varreduraOeste': {
        velMax = SIM.velHomingDegS;
        alvo = TRACKER.limiteOesteDeg + 10; // segue para oeste até achar o sensor
        if (this.sensorOeste()) {
          alvo = null;
          this.fase = 'irLimpeza';
        }
        break;
      }
      case 'irLimpeza': {
        alvo = ROTINA.posicaoLimpezaDeg;
        if (Math.abs(alvo - this.posEixo) < 1e-3) {
          if (this.sensorOptico()) {
            this.fase = 'limpeza1';
            this.escovaLigada = true;
            this.escovaIdx = indiceFreq(ROTINA.limpezaFreq1Hz);
            this.fimEstagio = agora + ROTINA.limpezaTempo1S * 1000;
            this.baseTrepidacao = this.posEixo;
          } else {
            this.codigoAlarme = 11; // posição não confirmada: não liga as escovas
            this.rodando = false;
            this.fase = 'parado';
          }
        }
        break;
      }
      case 'limpeza1': {
        // motor de passo trepidando em microstep em torno da posição de limpeza
        const t = (agora - (this.fimEstagio - ROTINA.limpezaTempo1S * 1000)) / 1000;
        const novo = this.baseTrepidacao + ROTINA.microstepAmplitudeDeg * Math.sin(2 * Math.PI * ROTINA.microstepFreqHz * t);
        this.moverJunto(novo - this.posEixo, dt);
        if (agora >= this.fimEstagio) {
          this.moverJunto(this.baseTrepidacao - this.posEixo, dt);
          this.vel = 0;
          this.fase = 'limpeza2';
          this.escovaIdx = indiceFreq(ROTINA.limpezaFreq2Hz);
          this.fimEstagio = agora + ROTINA.limpezaTempo2S * 1000;
        }
        break;
      }
      case 'limpeza2': {
        if (agora >= this.fimEstagio) {
          this.desligarEscova();
          this.fase = 'voltaHome';
        }
        break;
      }
      case 'voltaHome': {
        alvo = TRACKER.posicaoHomeDeg;
        if (Math.abs(alvo - this.posEixo) < 1e-3 && this.sensorLeste()) {
          alvo = null;
          this.fase = this.rodando && this.cmd.modoAuto ? 'rastreando' : 'parado';
        }
        break;
      }
      case 'intertravamento': {
        // o eixo perdeu a referência: o alvo é pelo ângulo real (encoder)
        alvo = this.posEixo + (ROTINA.posicaoIntertravamentoDeg - this.anguloReal);
        if (Math.abs(ROTINA.posicaoIntertravamentoDeg - this.anguloReal) < 1e-3) {
          alvo = null;
          this.fase = 'intertravado';
        }
        break;
      }
      case 'intertravado':
        break;
      case 'parado':
      case 'rastreando': {
        const podeRastrear = this.rodando && this.cmd.modoAuto && this.referenciado && !this.travado && !this.emergencia;
        this.fase = podeRastrear ? 'rastreando' : 'parado';
        if (podeRastrear && this.cmd.usaSetpointPC) {
          alvo = clamp(this.cmd.setpointDeg, TRACKER.limiteLesteDeg, TRACKER.limiteOesteDeg);
        }
        break;
      }
    }

    // ---- Movimento do eixo (motor de passo: eixo e painel andam juntos) ----
    if (this.emergencia) alvo = null; // emergência: nada se move
    if (alvo !== null) {
      const erro = alvo - this.posEixo;
      this.moverJunto(Math.sign(erro) * Math.min(Math.abs(erro), velMax * dt), dt);
      if (Math.abs(erro) < 1e-3) this.vel = 0;
    } else if (this.fase !== 'limpeza1') {
      this.vel = 0;
    }

    // ---- Sobrecurso: passou do sensor de fim de curso ----
    if (this.anguloReal <= TRACKER.limiteLesteDeg - 2 && this.fase !== 'buscaLeste' && this.codigoAlarme === 0) this.codigoAlarme = 2;
    if (this.anguloReal >= TRACKER.limiteOesteDeg + 2 && this.codigoAlarme === 0) this.codigoAlarme = 3;
  }

  private iniciarRotina() {
    this.desligarEscova();
    this.referenciado = false;
    this.fase = 'buscaLeste';
  }

  private moverJunto(passo: number, dt: number) {
    this.vel = dt > 0 ? passo / dt : 0;
    this.posEixo += passo;
    this.anguloReal += passo;
  }

  // sensores indutivos: acionam quando o came do tubo chega ao limite do curso
  private sensorLeste() {
    return this.anguloReal <= TRACKER.limiteLesteDeg + BANDA_SENSOR_DEG;
  }

  private sensorOeste() {
    return this.anguloReal >= TRACKER.limiteOesteDeg - BANDA_SENSOR_DEG;
  }

  private sensorOptico() {
    return Math.abs(this.anguloReal - ROTINA.posicaoLimpezaDeg) <= ROTINA.bandaSensorOpticoDeg;
  }

  private desligarEscova() {
    this.escovaLigada = false;
    if (this.fase === 'limpeza1' || this.fase === 'limpeza2' || this.fase === 'irLimpeza') this.fase = 'parado';
  }

  ler(): StatusDB {
    return {
      vivoPlc: this.vivoPlc,
      posEixoDeg: this.posEixo,
      velEixoDegS: this.vel,
      encoderContagem: this.contagemEncoder(),
      setpointAtualDeg: this.cmd.setpointDeg,
      // durante a limpeza a rotina escolhe o multispeed (20 Hz -> 60 Hz)
      escovaVelIdx: this.escovaLigada ? this.escovaIdx : this.cmd.escovaVelIdx,
      codigoAlarme: this.codigoAlarme,
      emAuto: this.cmd.modoAuto,
      emMovimento: Math.abs(this.vel) > 1e-3,
      referenciado: this.referenciado,
      sensorHome: this.sensorLeste(),
      limpezaAtiva: this.fase === 'limpeza1' || this.fase === 'limpeza2',
      escovaLigada: this.escovaLigada,
      travado: this.travado,
      emergencia: this.emergencia,
      fimCursoLeste: this.sensorLeste(),
      fimCursoOeste: this.sensorOeste(),
      pronto: this.referenciado && !this.travado && !this.emergencia,
      falhaCommPC: false,
      sensorOptico: this.sensorOptico(),
      etapaRotina: ETAPA[this.fase],
    };
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
