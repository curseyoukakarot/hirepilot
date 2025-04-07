import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import SignupScreen from './screens/SignupScreen';
import SigninScreen from './screens/SigninScreen';
import OnboardingWizard from './screens/OnboardingWizard';
import Dashboard from './screens/Dashboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/signin" />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route path="/signin" element={<SigninScreen />} />
      <Route path="/onboarding" element={<OnboardingWizard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      {/* Add more routes as needed */}
    </Routes>
  );
}

export default App;
