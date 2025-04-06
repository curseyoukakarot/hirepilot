// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SigninScreen from './screens/SigninScreen';
import SignupScreen from './screens/SignupScreen';
import OnboardingWizard from './screens/OnboardingWizard';
import Dashboard from './screens/Dashboard';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/signin" />} />
        <Route path="/signin" element={<SigninScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Add more routes here as we expand */}
      </Routes>
    </Router>
  );
}
