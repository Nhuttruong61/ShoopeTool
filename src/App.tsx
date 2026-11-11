import type { TimePhase } from './types/contracts';

const INITIAL_PHASE: TimePhase = 'IDLE';

export function App() {
  return (
    <main data-phase={INITIAL_PHASE}>
      <h1>ShoopeeTool 11/11 — Trợ Lý Canh Nhịp Săn Mã</h1>
      <p>Khung dự án sẵn sàng cho các module săn mã hợp lệ.</p>
    </main>
  );
}

export default App;
