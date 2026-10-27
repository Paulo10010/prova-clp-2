import { useStore } from '../store.ts';

/** Passos 1..6 da rotina do CLP; 7 e 8 são o intertravamento por vento (ETAPAS_ROTINA no backend). */
const PASSOS = [1, 2, 3, 4, 5, 6];

/** Mostra em que passo da rotina da bancada o CLP está. */
export function RotinaPanel() {
  const info = useStore((st) => st.info);
  const rotina = useStore((st) => st.estado?.rotina);
  if (!info || !rotina) return null;

  const e = rotina.etapa;
  const intertravado = e >= 7;

  return (
    <section className="cartao">
      <h2>Rotina do CLP</h2>
      <ol className="rotina">
        {PASSOS.map((p) => (
          <li key={p} className={e === p ? 'atual' : e > p && e <= 6 ? 'feito' : ''}>
            <span className="rotina-num">{p}</span>
            {info.etapasRotina[p]}
          </li>
        ))}
      </ol>
      {intertravado ? (
        <p className="rotina-intertravamento">⚠ {rotina.texto}</p>
      ) : e === 0 ? (
        <p className="dica">{rotina.texto}. HOME ou RESET rodam a rotina completa; LIMPAR começa no passo 3.</p>
      ) : null}
    </section>
  );
}
