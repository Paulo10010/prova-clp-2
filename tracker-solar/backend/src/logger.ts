/** Grava uma linha por segundo em backend/logs/tracker_AAAA-MM-DD.csv (data real do PC). */
import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlantState } from '../../shared/types.ts';

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');

const CABECALHO = [
  'hora_pc', 'hora_simulada', 'fonte', 'plc_conectado',
  'sol_azimute', 'sol_elevacao', 'angulo_ideal', 'setpoint_clp',
  'pos_eixo', 'encoder_contagem', 'encoder_deg', 'erro_eixo_encoder',
  'escova_freq_hz', 'escova_rpm', 'em_auto', 'em_movimento', 'referenciado',
  'limpeza', 'travado', 'alarme',
].join(';');

export class CsvLogger {
  private ultimo = 0;
  private pronto = false;

  async registrar(s: PlantState) {
    if (s.t - this.ultimo < 1000) return;
    this.ultimo = s.t;
    if (!this.pronto) { await mkdir(PASTA, { recursive: true }); this.pronto = true; }

    const arquivo = path.join(PASTA, `tracker_${new Date(s.t).toISOString().slice(0, 10)}.csv`);
    const novo = !existsSync(arquivo);
    const n = (v: number) => v.toFixed(3).replace('.', ','); // vírgula decimal para o Excel pt-BR
    const b = (v: boolean) => (v ? 1 : 0);
    const linha = [
      new Date(s.t).toISOString(), s.sol.relogioIso, s.fonte, b(s.plcConectado),
      n(s.sol.azimuteDeg), n(s.sol.elevacaoDeg), n(s.sol.anguloIdealDeg), n(s.eixo.setpointAtualDeg),
      n(s.eixo.posDeg), s.encoder.contagem, n(s.encoder.deg), n(s.encoder.erroDeg),
      n(s.escova.freqHz), n(s.escova.rpmEscova), b(s.flags.emAuto), b(s.flags.emMovimento),
      b(s.flags.referenciado), b(s.flags.limpezaAtiva), b(s.flags.travado), s.alarme.codigo,
    ].join(';');
    await appendFile(arquivo, (novo ? CABECALHO + '\n' : '') + linha + '\n');
  }
}
