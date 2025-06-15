import React, { createContext, useContext, useState } from 'react';

export interface Campaign {
  id: string;
  name?: string;
  status?: string;
  description?: string;
  jobDescription?: string;
  lead_source_type?: string;
  keywords?: string;
  title?: string;
  location?: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  emailStatus: string;
  title?: string;
  company?: string;
  linkedinUrl?: string;
  location?: string;
  isGdprLocked: boolean;
}

export interface WizardState {
  campaign?: Campaign;
  selectedLeads: string[];
  leads: Lead[];
  numLeads: number;
  step: number;
  pipeline?: {
    id: string;
    name: string;
    stages: Array<{
      id: string;
      name: string;
    }>;
  };
  message?: string;
}

export interface WizardContextType {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}

const defaultWizardState: WizardState = {
  selectedLeads: [],
  leads: [],
  numLeads: 100,
  step: 1
};

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [wizard, setWizard] = useState<WizardState>(defaultWizardState);

  // Wrap setWizard to ensure step is always a number and handle campaign nesting
  const safeSetWizard: React.Dispatch<React.SetStateAction<WizardState>> = (updater) => {
    setWizard(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      
      // Ensure step is a number
      if (typeof next.step !== 'number') {
        next.step = prev.step;
      }
      
      // Handle nested campaign object
      if (next.campaign && (next.campaign as any).campaign) {
        next.campaign = (next.campaign as any).campaign;
      }
      
      return next;
    });
  };

  return (
    <WizardContext.Provider value={{ wizard, setWizard: safeSetWizard }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

export default WizardContext; 