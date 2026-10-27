import { useEffect, useState } from 'react';
import { useStore } from '../store.ts';

export function AlarmBanner() {
  const ws = useStore((s) => s.wsConectado);
  const fonte = useStore((s) => s.info?.fonte);
  const s = useStore((st) => st.estado);
  const erro = useStore((st) => st.ultimoErro);
  const [mostrarErro, setMostrarErro] = useState(false);

  useEffect(() => {
    if (!erro) return;
    setMostrarErro(true);
    const id = setTimeout(() => setMostrarErro(false), 4000);
    return () => clearTimeout(id);
  }, [erro]);

  let texto: string | null = null;
  if (!ws) texto = 'Sem conexão com o backend. Verifique se "npm run dev" está rodando.';
  else if (s && !s.plcConectado && fonte === 'plc') texto = 'Backend sem conexão com o CLP. Confira o IP em backend/.env, o cabo e o PUT/GET.';
  else if (s && s.alarme.codigo !== 0) texto = `Alarme ${s.alarme.codigo}: ${s.alarme.texto}`;

  return (
    <>
      {texto && <div className="faixa alarme" role="alert">{texto}</div>}
      {mostrarErro && erro && <div className="faixa aviso" role="status">{erro.texto}</div>}
    </>
  );
}
