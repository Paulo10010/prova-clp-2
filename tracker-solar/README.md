# Tracker Solar · Gêmeo Digital

Supervisório web com cena 3D para a bancada do tracker solar:
CLP **S7-1200 (1214C DC/DC/DC)**, motor de passo com **TB6600** (PTO), **encoder incremental 600 PPR** (HSC),
inversor **CFW10** com motor de indução (escovas, multispeed).

```
 Navegador (React + Three.js)  ←WebSocket→  Backend Node  ←S7 PUT/GET→  S7-1200  →  bancada
        cena 3D, gráficos,                  cálculo do sol,               DB_Supervisorio
        comandos                            simulador, log CSV
```

O navegador não fala direto com o CLP. O backend lê o `DB_Supervisorio` a cada 200 ms,
calcula a posição do sol em Recife, envia o setpoint de ângulo e repassa tudo para a tela.
Sem a bancada, o mesmo backend roda um **simulador** que imita a lógica do CLP.

## Estrutura

```
tracker-solar/
├── backend/
│   ├── .env.example            ← IP do CLP, nº do DB, modo sim/plc
│   └── src/
│       ├── config.ts           ← TODOS os parâmetros da planta e do local
│       ├── server.ts           ← HTTP + WebSocket
│       ├── supervisor.ts       ← relógio solar + setpoint + estado da tela
│       ├── logger.ts           ← CSV em backend/logs/
│       ├── plc/tags.ts         ← mapa de offsets do DB_Supervisorio
│       ├── plc/S7Source.ts     ← driver do CLP real (nodes7)
│       ├── sim/SimSource.ts    ← planta + lógica simuladas
│       └── solar/              ← posição do sol e ângulo do tracker
├── frontend/
│   └── src/
│       ├── config.ts           ← endereço do WebSocket e opções visuais
│       ├── scene/              ← cena 3D (tracker, escova, sol, céu)
│       └── components/         ← painéis, comandos, gráficos, alarmes
├── plc/                        ← fontes para importar no TIA Portal V17
└── shared/types.ts             ← tipos usados pelos dois lados
```

## Rodar no modo simulador (sem CLP)

Requisito: **Node.js 20 ou mais novo**.

```bash
cd tracker-solar
npm install
cp backend/.env.example backend/.env      # no Windows: copy backend\.env.example backend\.env
npm run dev
```

Abra **http://localhost:5173**. Um roteiro para testar:

1. **Home** (o eixo vai a leste até o sensor) e depois **Start**.
2. Em *Relógio solar*, escolha **×300** para ver o tracker acompanhar o sol.
3. Com o eixo parado, clique em **Limpar**. A escova percorre o painel na velocidade multispeed escolhida.
4. Durante a limpeza, use **+0,3°** em *Simulador · perturbações*: o encoder detecta o deslocamento e o tracker **trava** (alarme 10).
5. **Reset** refaz o home e libera o sistema.

## Rodar com o CLP real

1. Importe os blocos de `plc/` no TIA Portal. O passo a passo e o mapa de offsets estão em [`plc/LEIA-ME.md`](plc/LEIA-ME.md).
2. Preencha o `FC_Supervisorio_IO` com suas I/O e memórias (Parte A e Parte B).
3. Em `backend/.env`:
   ```
   MODE=plc
   PLC_IP=192.168.0.1      ← IP do seu CLP
   PLC_DB=10               ← número do DB_Supervisorio
   ```
4. Coloque o PC na mesma sub-rede do CLP (ex.: 192.168.0.10 / 255.255.255.0) e rode `npm run dev`.

O indicador **CLP** no topo fica verde quando a conexão funciona, e **Vida CLP** pisca enquanto o contador do CLP muda.

## Onde modificar

| O que | Arquivo | Onde |
|---|---|---|
| **IP do CLP**, rack/slot | `backend/.env` | `PLC_IP`, `PLC_RACK`, `PLC_SLOT` |
| **Número do DB** | `backend/.env` | `PLC_DB` |
| Simulador ou CLP | `backend/.env` | `MODE=sim` ou `MODE=plc` |
| **Local (latitude, longitude, altitude, fuso)** | `backend/src/config.ts` | seção `2) LOCALIZAÇÃO` |
| Modelo de posição do sol | `backend/src/solar/sunPosition.ts` | função `posicaoSol` |
| Limites do curso, ângulo à noite, posição do home | `backend/src/config.ts` | seção `3) GEOMETRIA E LIMITES` |
| PPR, quadratura, relação de transmissão do encoder | `backend/src/config.ts` | seção `4) ENCODER` |
| Frequências do multispeed do CFW10, polos do motor | `backend/src/config.ts` | seção `5) INVERSOR` |
| Textos dos alarmes | `backend/src/config.ts` | seção `8) CÓDIGOS DE ALARME` |
| Estrutura/offsets do DB | `backend/src/plc/tags.ts` + `plc/01_DB_Supervisorio.db` | os dois juntos |
| **Ligação com suas I/O e memórias** | `plc/04_FC_Supervisorio_IO.scl` | Parte A e Parte B |
| Porta do backend | `backend/.env` (`PORT`) e `frontend/vite.config.ts` (`BACKEND`) | os dois juntos |
| Abrir a tela de outro PC | `frontend/src/config.ts` | `WS_URL` |
| Painel 3D segue encoder ou eixo | `frontend/src/config.ts` | `PAINEL_SEGUE` |

## Convenção de ângulo

Tracker de 1 eixo, eixo Norte-Sul: **negativo = virado para leste**, **0 = horizontal**, **positivo = oeste**.
O Technology Object do eixo deve trabalhar em graus com essa mesma convenção. Se o seu estiver invertido,
inverta o sinal no `FC_Supervisorio_IO` (ou `ENCODER.sentido` no `config.ts`, para o encoder).

## Outros comandos

```bash
npm run test:solar -w backend              # tabela sol/tracker ao longo de um dia
npm run test:solar -w backend -- 2026-12-21  # outra data
npm run typecheck                          # checagem de tipos dos dois lados
npm run build && npm start                 # versão final: tudo em http://localhost:8080
```

O log fica em `backend/logs/tracker_AAAA-MM-DD.csv`, uma linha por segundo, separado por `;` com vírgula decimal (abre direto no Excel).

## Limitações conhecidas

- O cálculo solar é o modelo simplificado da NOAA (erro típico abaixo de 0,5°). Não há backtracking (sombreamento entre fileiras).
- A rotação das escovas é **estimada** pela frequência comandada (sem sensor de velocidade).
- No 3D, a rotação da escova está desacelerada de propósito (`ESCALA_VISUAL_ROTACAO_ESCOVA`) para continuar visível.
- Os intertravamentos de segurança ficam no CLP. A tela só envia pedidos, e o CLP decide.
