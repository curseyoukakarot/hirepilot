import { Routes, Route } from 'react-router-dom';
import SignupScreen from './screens/SignupScreen';
import SigninScreen from './screens/SigninScreen';
import Dashboard from './screens/Dashboard';
import CampaignBuilder from './screens/CampaignBuilder';
import CampaignPerformance from './screens/CampaignPerformance';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route path="/signin" element={<SigninScreen />} />
      <Route path="/campaign-builder" element={<CampaignBuilder />} />
      <Route path="/campaigns" element={<CampaignPerformance />} />
    </Routes>
  );
}

export default App;
