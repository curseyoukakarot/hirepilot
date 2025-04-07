import { Routes, Route } from 'react-router-dom';
import SigninScreen from './screens/SigninScreen';
import SignupScreen from './screens/SignupScreen';
import OnboardingWizard from './screens/OnboardingWizard';
import Dashboard from './screens/Dashboard';
import MessageGenerator from './screens/MessageGenerator'; // 👈 new

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SigninScreen />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/generate-message" element={<MessageGenerator />} /> {/* 👈 new */}
    </Routes>
  );
}

export default App;
