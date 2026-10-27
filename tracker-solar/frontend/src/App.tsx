import { AlarmBanner } from './components/AlarmBanner.tsx';
import { ClockPanel } from './components/ClockPanel.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { HUD } from './components/HUD.tsx';
import { RotinaPanel } from './components/RotinaPanel.tsx';
import { SimPanel } from './components/SimPanel.tsx';
import { StatusPanel } from './components/StatusPanel.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Trends } from './components/Trends.tsx';
import { Scene3D } from './scene/Scene3D.tsx';

export function App() {
  return (
    <div className="app">
      <TopBar />
      <AlarmBanner />
      <main className="grade-principal">
        <div className="coluna-cena">
          <div className="cena">
            <Scene3D />
            <HUD />
          </div>
          <Trends />
        </div>
        <aside className="coluna-lateral">
          <StatusPanel />
          <RotinaPanel />
          <ControlPanel />
          <ClockPanel />
          <SimPanel />
        </aside>
      </main>
    </div>
  );
}
