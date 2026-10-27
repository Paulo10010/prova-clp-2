/**
 * Servidor: WebSocket em /ws (dados a ~10 Hz) + arquivos do frontend compilado.
 *
 *   Desenvolvimento:  npm run dev   (Vite em :5173 faz proxy de /ws para cá)
 *   Produção:         npm run build && npm start   -> abrir http://localhost:8080
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { MsgCliente, MsgServidor } from '../../shared/types.ts';
import { CONEXAO } from './config.ts';
import { CsvLogger } from './logger.ts';
import { S7Source } from './plc/S7Source.ts';
import type { PlantSource } from './plc/tags.ts';
import { SimSource } from './sim/SimSource.ts';
import { Supervisor } from './supervisor.ts';

const BROADCAST_MS = 100;

const fonte: PlantSource = CONEXAO.modo === 'plc' ? new S7Source() : new SimSource();
const supervisor = new Supervisor(fonte);
const logger = CONEXAO.logCsv ? new CsvLogger() : null;
fonte.iniciar();

// ---- arquivos estáticos (frontend/dist) ----
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon',
};

const http = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(supervisor.info()));
    return;
  }
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Backend rodando. Em desenvolvimento, abra o frontend em http://localhost:5173');
    return;
  }
  let arquivo = path.join(DIST, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!arquivo.startsWith(DIST) || !existsSync(arquivo) || statSync(arquivo).isDirectory()) {
    arquivo = path.join(DIST, 'index.html');
  }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' });
  createReadStream(arquivo).pipe(res);
});

// ---- WebSocket ----
const wss = new WebSocketServer({ server: http, path: '/ws' });

function enviar(ws: WebSocket, msg: MsgServidor) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on('connection', (ws) => {
  enviar(ws, { type: 'hello', info: supervisor.info() });
  ws.on('message', (raw) => {
    let msg: MsgCliente;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return enviar(ws, { type: 'erro', mensagem: 'JSON inválido' });
    }
    // JSON válido não garante objeto ("null", "1", "[]"...): sem isto, um cliente derruba o backend
    if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) {
      return enviar(ws, { type: 'erro', mensagem: 'Mensagem inválida' });
    }
    try {
      const erro = supervisor.tratar(msg);
      if (erro) enviar(ws, { type: 'erro', mensagem: erro });
    } catch (e) {
      console.error('[ws] erro ao tratar mensagem:', e);
      enviar(ws, { type: 'erro', mensagem: 'Erro ao tratar a mensagem' });
    }
  });
});

setInterval(() => {
  const estado = supervisor.passo();
  const texto = JSON.stringify({ type: 'state', data: estado } satisfies MsgServidor);
  for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(texto);
  logger?.registrar(estado).catch((e) => console.error('[log]', e.message));
}, BROADCAST_MS);

http.listen(CONEXAO.porta, () => {
  console.log(`\n  Tracker Solar — backend`);
  console.log(`  Fonte de dados : ${CONEXAO.modo === 'plc' ? `CLP em ${CONEXAO.plcIp} (DB${CONEXAO.plcDb})` : 'SIMULADOR'}`);
  console.log(`  WebSocket      : ws://localhost:${CONEXAO.porta}/ws`);
  console.log(`  Log CSV        : ${CONEXAO.logCsv ? 'backend/logs/' : 'desligado'}\n`);
});

process.on('SIGINT', () => { fonte.parar(); process.exit(0); });
