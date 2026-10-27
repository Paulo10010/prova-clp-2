# Blocos do CLP (TIA Portal V17, S7-1200 1214C)

| Arquivo | Bloco | Precisa editar? |
|---|---|---|
| `01_DB_Supervisorio.db` | DB global, **não otimizado**, área de troca com o PC | Não (só o número do DB) |
| `02_FB_Supervisorio.scl` | Vida do CLP, watchdog do PC, cópia de estado, pulsos de comando | Não |
| `03_IDB_Supervisorio.db` | DB de instância do FB | Não |
| `04_FC_Supervisorio_IO.scl` | **Mapeamento das suas I/O e memórias** | **Sim** |

## Importar

1. Na árvore do projeto, abra a CPU > **Arquivos de origem externos** > **Adicionar novo arquivo externo** e selecione os quatro arquivos.
2. Clique com o botão direito em cada um, **na ordem 01 → 04**, e escolha **Gerar blocos a partir da origem**.
3. Abra as propriedades do `DB_Supervisorio`:
   - **Geral > Número**: defina **10** (ou altere `PLC_DB` em `backend/.env`).
   - **Atributos**: confirme que **Acesso otimizado ao bloco** está **desmarcado**.
4. CPU > Propriedades > **Proteção e Segurança > Mecanismos de conexão**: marque **Permitir acesso com comunicação PUT/GET de parceiro remoto**.
5. No `Main [OB1]`, depois da lógica do tracker, chame `"FC_Supervisorio_IO"();`.
6. Preencha a Parte A e a Parte B do `FC_Supervisorio_IO` com as tags do seu programa.
7. Compile, carregue e, online, abra o `DB_Supervisorio` para conferir os offsets abaixo.

## Mapa de offsets (tem que bater com `backend/src/plc/tags.ts`)

| Offset | Variável | Tipo | Sentido |
|---|---|---|---|
| 0.0 | Status.Vivo_PLC | Int | CLP → PC |
| 2.0 | Status.Pos_Eixo_Deg | Real | CLP → PC |
| 6.0 | Status.Vel_Eixo_DegS | Real | CLP → PC |
| 10.0 | Status.Encoder_Contagem | DInt | CLP → PC |
| 14.0 | Status.Setpoint_Atual_Deg | Real | CLP → PC |
| 18.0 | Status.Escova_Vel_Idx | Int | CLP → PC |
| 20.0 | Status.Codigo_Alarme | Int | CLP → PC |
| 22.0 a 22.7 | Em_Auto, Em_Movimento, Referenciado, Sensor_Home, Limpeza_Ativa, Escova_Ligada, Travado, Emergencia | Bool | CLP → PC |
| 23.0 a 23.4 | Fim_Curso_Leste, Fim_Curso_Oeste, Pronto, Falha_Comm_PC, Sensor_Optico | Bool | CLP → PC |
| 24.0 | Status.Etapa_Rotina | Int | CLP → PC |
| 26.0 a 26.3 | Motor_Habilitado (EN), Sentido_Leste (DIR), Pulsando (PUL), Reparado | Bool | CLP → PC |
| 28 a 31 | Reserva | Byte[4] | — |
| 32.0 | Comandos.Vivo_PC | Int | PC → CLP |
| 34.0 | Comandos.Setpoint_Deg | Real | PC → CLP |
| 38.0 | Comandos.Escova_Vel_Idx | Int | PC → CLP |
| 40.0 a 40.4 | Cmd_Start, Cmd_Stop, Cmd_Home, Cmd_Limpar, Cmd_Reset (pulsos) | Bool | PC → CLP |
| 40.5 | Modo_Auto | Bool | PC → CLP |
| 40.6 | Usa_Setpoint_PC | Bool | PC → CLP |

## Rotina da bancada e `Etapa_Rotina`

A tela mostra em que passo a rotina está. Escreva em `Etapa_Rotina` o número do passo atual (o simulador segue a mesma tabela, definida em `ETAPAS_ROTINA` no `backend/src/config.ts`):

| Valor | Passo |
|---|---|
| 0 | Fora da rotina (parado ou rastreando o sol) |
| 1 | Buscando o sensor indutivo LESTE (home) |
| 2 | Varredura até o sensor indutivo OESTE |
| 3 | Indo para a posição de limpeza (30°), aguardando o sensor óptico |
| 4 | Limpeza a 20 Hz, motor de passo trepidando em microstep (10 s) |
| 5 | Limpeza a 60 Hz |
| 6 | Voltando ao home (posição de alvorada) |
| 7 | Intertravamento por vento: indo para 0° |
| 8 | Intertravado em 0°, aguardando RESET |

## Segurança

- Todos os intertravamentos (emergência, fins de curso, travamento por encoder) continuam **na sua lógica**. O PC só pede.
- Se o PC parar de enviar `Vivo_PC` por 3 s, o FB liga `Falha_Comm_PC`, bloqueia Start/Home/Limpar/Reset e desliga `o_UsaSetpointPC`. O Stop continua passando.
- O setpoint chega em graus. Configure o Technology Object do eixo em graus para usar `o_SetpointDeg` direto num `MC_MoveAbsolute`.

## Códigos de alarme usados pela tela

`0` sem alarme · `1` emergência · `2` fim de curso leste · `3` fim de curso oeste · `10` vento: encoder divergiu do eixo, intertravamento em 0° (travado) · `11` sensor óptico não confirmou a posição de limpeza · `20` sem comunicação com o PC (o FB gera sozinho) · `30` falha no eixo.
Para adicionar ou renomear, edite `ALARMES` em `backend/src/config.ts`.
