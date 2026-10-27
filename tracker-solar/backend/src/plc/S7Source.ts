/**
 * Driver do CLP S7-1200 real (protocolo S7 / ISO-on-TCP, porta 102) via `nodes7`.
 *
 * Pré-requisitos no TIA Portal (V17):
 *  1. CPU > Proteção e Segurança > Mecanismos de conexão >
 *     marcar "Permitir acesso com comunicação PUT/GET de parceiro remoto".
 *  2. DB_Supervisorio com "Acesso otimizado ao bloco" DESMARCADO.
 *  3. IP do CLP e número do DB conferidos no backend/.env.
 */
import { CONEXAO } from '../config.ts';
import {
  TAGS_COMANDO, TAGS_STATUS,
  type CampoComando, type PlantSource, type StatusDB, type ValorComando,
} from './tags.ts';

// nodes7 não tem tipos; descrevemos só o que usamos.
interface Nodes7Conn {
  initiateConnection(opts: Record<string, unknown>, cb: (err?: unknown) => void): void;
  setTranslationCB(cb: (tag: string) => string): void;
  addItems(items: string[]): void;
  readAllItems(cb: (bad: boolean, values: Record<string, unknown>) => void): void;
  writeItems(items: string[], values: ValorComando[], cb: (bad: boolean) => void): number;
  dropConnection(cb?: () => void): void;
}

const MAPA: Record<string, string> = {};
for (const [k, v] of Object.entries(TAGS_STATUS)) MAPA[`s_${k}`] = v;
for (const [k, v] of Object.entries(TAGS_COMANDO)) MAPA[`c_${k}`] = v;

/** Comandos de nível: reenviados sempre que a conexão é (re)estabelecida. */
const NIVEIS: CampoComando[] = ['modoAuto', 'usaSetpointPC', 'escovaVelIdx', 'setpointDeg'];

export class S7Source implements PlantSource {
  conectado = false;
  private conn: Nodes7Conn | null = null;
  private imagem: StatusDB | null = null;
  private pendentes = new Map<CampoComando, ValorComando>();
  private niveis = new Map<CampoComando, ValorComando>();
  private escrevendo = false;
  private lendo = false;
  private timer: NodeJS.Timeout | null = null;
  private reconectando = false;
  private falhasSeguidas = 0;
  private vivoPc = 0;
  private ativo = false;

  iniciar() {
    this.ativo = true;
    void this.conectar();
  }

  parar() {
    this.ativo = false;
    if (this.timer) clearInterval(this.timer);
    this.conn?.dropConnection();
  }

  ler() {
    return this.imagem;
  }

  escrever(campo: CampoComando, valor: ValorComando) {
    this.pendentes.set(campo, valor);
    if (NIVEIS.includes(campo)) this.niveis.set(campo, valor);
  }

  private async conectar() {
    if (!this.ativo) return;
    this.reconectando = true;
    let Nodes7: new (opts?: object) => Nodes7Conn;
    try {
      const mod = await import('nodes7');
      Nodes7 = (mod.default ?? mod) as unknown as typeof Nodes7;
    } catch {
      console.error('[S7] Pacote "nodes7" não encontrado. Rode "npm install" na raiz do projeto.');
      return;
    }
    const conn = new Nodes7({ silent: true });
    console.log(`[S7] Conectando em ${CONEXAO.plcIp} (rack ${CONEXAO.plcRack}, slot ${CONEXAO.plcSlot}, DB${CONEXAO.plcDb})...`);
    conn.initiateConnection(
      { port: 102, host: CONEXAO.plcIp, rack: CONEXAO.plcRack, slot: CONEXAO.plcSlot, timeout: 3000 },
      (err) => {
        this.reconectando = false;
        if (err) {
          console.error('[S7] Falha na conexão:', String(err), '— nova tentativa em 3 s');
          this.agendarReconexao();
          return;
        }
        console.log('[S7] Conectado.');
        this.conn = conn;
        this.conectado = true;
        this.falhasSeguidas = 0;
        conn.setTranslationCB((tag) => MAPA[tag] ?? tag);
        conn.addItems(Object.keys(TAGS_STATUS).map((k) => `s_${k}`));
        for (const [k, v] of this.niveis) this.pendentes.set(k, v); // ressincroniza
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.ciclo(), CONEXAO.pollMs);
      },
    );
  }

  private agendarReconexao() {
    this.conectado = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    try { this.conn?.dropConnection(); } catch { /* ignora */ }
    this.conn = null;
    this.lendo = this.escrevendo = false;
    if (this.ativo) setTimeout(() => void this.conectar(), 3000);
  }

  private ciclo() {
    const conn = this.conn;
    if (!conn || this.reconectando) return;

    // Heartbeat do PC (o FB_Supervisorio usa para o watchdog)
    this.vivoPc = (this.vivoPc + 1) % 32000;
    this.pendentes.set('vivoPc', this.vivoPc);

    if (!this.lendo) {
      this.lendo = true;
      conn.readAllItems((ruim, valores) => {
        this.lendo = false;
        if (ruim) {
          if (++this.falhasSeguidas >= 5) {
            console.error('[S7] Leituras falhando — reconectando');
            this.agendarReconexao();
          }
          return;
        }
        this.falhasSeguidas = 0;
        const img: Record<string, number | boolean> = {};
        for (const k of Object.keys(TAGS_STATUS)) {
          const v = valores[`s_${k}`];
          img[k] = typeof v === 'number' || typeof v === 'boolean' ? v : 0;
        }
        this.imagem = img as StatusDB;
      });
    }

    if (!this.escrevendo && this.pendentes.size > 0) {
      const campos = [...this.pendentes.keys()];
      const valores = campos.map((c) => this.pendentes.get(c)!);
      this.pendentes.clear();
      this.escrevendo = true;
      conn.writeItems(campos.map((c) => `c_${c}`), valores, (ruim) => {
        this.escrevendo = false;
        if (ruim) {
          // Devolve à fila só os valores de nível. Pulsos (Cmd_*) que falharam são
          // descartados de propósito: um "Start" atrasado nunca deve chegar depois.
          campos.forEach((c, i) => {
            if (NIVEIS.includes(c) && !this.pendentes.has(c)) this.pendentes.set(c, valores[i]);
          });
          console.warn('[S7] Falha na escrita de', campos.join(', '));
        }
      });
    }
  }
}
