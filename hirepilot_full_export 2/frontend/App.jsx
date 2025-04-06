// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import SigninScreen from './pages/SigninScreen';
// Add more pages as you recreate them

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signin" element={<SigninScreen />} />
        {/* Later you'll add things like: <Route path="/dashboard" element={<Dashboard />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
