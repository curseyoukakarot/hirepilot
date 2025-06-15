export interface LeadSourceModule {
  id: 'linkedin' | 'apollo' | 'csv';
  label: string;
  Step: React.FC<any>;
  fetchPreview?: (args: any) => Promise<any[]>;
  importLeads: (args: any) => Promise<any[]>;
}

// Registry of available lead sources
export const leadSources: LeadSourceModule[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn (PhantomBuster)',
    Step: () => null, // TODO: wire to existing LinkedIn step
    importLeads: async (args) => [] // TODO: wire to existing logic
  },
  {
    id: 'apollo',
    label: 'Apollo.io',
    Step: () => null, // TODO: wire to ApolloStep
    fetchPreview: async (args) => [], // TODO: implement
    importLeads: async (args) => [] // TODO: implement
  },
  {
    id: 'csv',
    label: 'CSV Upload',
    Step: () => null, // TODO: wire to CsvStep
    fetchPreview: async (args) => [], // TODO: implement
    importLeads: async (args) => [] // TODO: implement
  }
]; 