import React, { createContext, useContext, useState } from 'react';

export const initialState = {
  campaign: null, // the DB row only
  job: null,
  keywords: '',
  // Add properties expected by TypeScript components
  selectedLeads: [],
  leads: [],
  numLeads: 100,
  step: 1,
  pipeline: null,
  message: '',
};

const WizardContext = createContext(null);

export const WizardProvider = ({ children }) => {
  const [wizard, setWizard] = useState(initialState);

  /** guard: never allow nested "campaign" keys */
  const safeSetWizard = updater => {
    setWizard(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next?.campaign?.campaign) {
        // strip the extra layer if someone slips it in
        next.campaign = next.campaign.campaign;
      }
      return next;
    });
  };

  return (
    <WizardContext.Provider value={{ wizard, setWizard: safeSetWizard }}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}; 