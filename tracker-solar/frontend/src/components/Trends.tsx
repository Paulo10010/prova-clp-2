import { useStore } from '../store.ts';
import { TrendChart } from './TrendChart.tsx';

export function Trends() {
  const dados = useStore((s) => s.historico);
  return (
    <section className="tendencias">
      <TrendChart
        titulo="Ângulos (°)"
        unidade="graus"
        dados={dados}
        altura={190}
        minFaixa={4}
        series={[
          { chave: 'ideal', rotulo: 'Sol ideal', cor: '#f2b43c', tracejado: true },
          { chave: 'setpoint', rotulo: 'Setpoint', cor: '#f2b43c' },
          { chave: 'eixo', rotulo: 'Eixo', cor: '#4cc9f0' },
          { chave: 'encoder', rotulo: 'Encoder', cor: '#7ee081' },
        ]}
      />
      <TrendChart
        titulo="Escova (Hz)"
        unidade="Hz"
        dados={dados}
        altura={190}
        minY={0}
        minFaixa={10}
        series={[{ chave: 'freq', rotulo: 'Frequência', cor: '#b392f0' }]}
      />
      <TrendChart
        titulo="Erro eixo − encoder (°)"
        unidade="graus"
        dados={dados}
        altura={190}
        minFaixa={1}
        series={[{ chave: 'erro', rotulo: 'Erro', cor: '#ff6b6b' }]}
      />
    </section>
  );
}
