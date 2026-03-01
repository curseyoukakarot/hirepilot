import type { ProviderName, SniperExecutionProvider } from './types';
import { airtopProvider } from './airtopProvider';
import { localPlaywrightProvider } from './localPlaywrightProvider';
import { agenticBrowserProvider } from './agenticBrowserProvider';
import { airtopEnabled } from '../../airtop/airtopClient';
import { browserbaseEnabled } from '../agent/browserbaseClient';

export function getProvider(name: ProviderName): SniperExecutionProvider {
  if (name === 'agentic_browser') {
    if (!browserbaseEnabled()) throw new Error('BROWSERBASE provider disabled (set BROWSERBASE_PROVIDER_ENABLED=true)');
    return agenticBrowserProvider;
  }
  if (name === 'airtop') {
    if (!airtopEnabled()) throw new Error('AIRTOP provider disabled');
    return airtopProvider;
  }
  return localPlaywrightProvider;
}


