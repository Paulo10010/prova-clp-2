/**
 * Configuração da interface. Os parâmetros da planta (limites, tabela de
 * frequências, local) vêm do backend em src/config.ts — não repita aqui.
 */

/**
 * Endereço do WebSocket. O padrão usa o mesmo host da página:
 *  - dev: Vite em :5173 faz proxy para o backend (vite.config.ts)
 *  - produção: o próprio backend serve a página em :8080
 * >>> Para apontar para outro PC, troque por ex.: 'ws://192.168.0.10:8080/ws'
 */
export const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

/** Qual medida move o painel no 3D: 'encoder' (ângulo físico) ou 'eixo' (Technology Object). */
export const PAINEL_SEGUE: 'encoder' | 'eixo' = 'encoder';

/** Janela dos gráficos e taxa de amostragem. */
export const HISTORICO_AMOSTRA_MS = 250;
export const HISTORICO_MAX_AMOSTRAS = 480; // 480 × 0,25 s = 2 min

/** A rotação real da escova (até ~1700 rpm) vira borrão na tela; esta escala deixa visível. */
export const ESCALA_VISUAL_ROTACAO_ESCOVA = 0.04;
/** Velocidade de deslocamento da escova ao longo do painel no 3D (m/s, só visual). */
export const VEL_VISUAL_TRANSLACAO_ESCOVA = 0.7;
