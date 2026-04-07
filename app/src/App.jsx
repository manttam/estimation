import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Step1BienCible from './pages/Step1BienCible';
import Step2ContexteZone from './pages/Step2ContexteZone';
import Step3Comparables from './pages/Step3Comparables';
import Step4TensionMarche from './pages/Step4TensionMarche';
import Step5AvisValeur from './pages/Step5AvisValeur';
import CompteRendu from './pages/CompteRendu';
import AvisValeurDoc from './pages/AvisValeurDoc';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/step/1" replace />} />
        <Route element={<Layout />}>
          <Route path="/step/1" element={<Step1BienCible />} />
          <Route path="/step/2" element={<Step2ContexteZone />} />
          <Route path="/step/3" element={<Step3Comparables />} />
          <Route path="/step/4" element={<Step4TensionMarche />} />
          <Route path="/step/5" element={<Step5AvisValeur />} />
          <Route path="/report" element={<CompteRendu />} />
          <Route path="/avis-valeur" element={<AvisValeurDoc />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
