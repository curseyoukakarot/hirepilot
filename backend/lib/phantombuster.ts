import axios from 'axios';

const PHANTOMBUSTER_API_URL = 'https://api.phantombuster.com/api/v2';

interface LaunchParams {
  id: string;
  argument: {
    sessionCookie: string;
    queries: string;  // Single URL string or newline-separated URLs
    searchType: 'people';
    numberOfProfiles?: number;
    [key: string]: any;
  };
  saveArgument?: boolean;
}

interface RunStatus {
  state: string;
  error?: string;
  output?: any[];
}

class PhantomBuster {
  public client;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create();
  }

  async launch({ id, argument, saveArgument = true }: LaunchParams) {
    const response = await this.client.post(
      `${PHANTOMBUSTER_API_URL}/agents/launch`,
      {
        id,
        argument,
        saveArgument
      },
      {
        headers: { 'X-Phantombuster-Key': this.apiKey }
      }
    );

    return {
      id: response.data?.containerId,
      status: response.data?.status
    };
  }

  async getRun(runId: string): Promise<RunStatus> {
    const response = await this.client.get(
      `${PHANTOMBUSTER_API_URL}/containers/fetch-output`,
      {
        params: { id: runId },
        headers: { 'X-Phantombuster-Key': this.apiKey }
      }
    );

    return {
      state: response.data?.status || 'unknown',
      error: response.data?.error,
      output: response.data?.output
    };
  }

  async getOutput(runId: string): Promise<any[]> {
    const response = await this.client.get(
      `${PHANTOMBUSTER_API_URL}/containers/fetch-output`,
      {
        params: { id: runId },
        headers: { 'X-Phantombuster-Key': this.apiKey }
      }
    );

    return response.data?.output || [];
  }
}

// Export a singleton instance using the house account API key
export default new PhantomBuster(process.env.PHANTOMBUSTER_API_KEY!); 