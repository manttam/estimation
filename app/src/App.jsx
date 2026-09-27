import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Step1Ouverture from './pages/Step1Ouverture';
import Step2ReleveBien from './pages/Step2ReleveBien';
import Step3ContexteZone from './pages/Step3ContexteZone';
import Step4Comparables from './pages/Step4Comparables';
import Step5TensionMarche from './pages/Step5TensionMarche';
import Step6AvisValeur from './pages/Step6AvisValeur';
import Mandat from './pages/Mandat';
import CompteRendu from './pages/CompteRendu';
import AvisValeurDoc from './pages/AvisValeurDoc';
import Dashboard from './pages/Dashboard';
import CreationBien from './pages/CreationBien';
import ResultatEstimation from './pages/ResultatEstimation';
import Reglages from './pages/Reglages';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/new" element={<Navigate to="/nouveau-bien" replace />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nouveau-bien" element={<CreationBien />} />
          <Route path="/resultat" element={<ResultatEstimation />} />
          <Route path="/step/1" element={<Step1Ouverture />} />
          <Route path="/step/2" element={<Step2ReleveBien />} />
          <Route path="/step/3" element={<Step3ContexteZone />} />
          <Route path="/step/4" element={<Step4Comparables />} />
          <Route path="/step/5" element={<Step5TensionMarche />} />
          <Route path="/step/6" element={<Step6AvisValeur />} />
          <Route path="/mandat" element={<Mandat />} />
          <Route path="/report" element={<CompteRendu />} />
          <Route path="/avis-valeur" element={<AvisValeurDoc />} />
          <Route path="/reglages" element={<Reglages />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
