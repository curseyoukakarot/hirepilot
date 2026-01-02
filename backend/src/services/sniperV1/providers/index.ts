import type { ProviderName, SniperExecutionProvider } from './types';
import { airtopProvider } from './airtopProvider';
import { localPlaywrightProvider } from './localPlaywrightProvider';
import { airtopEnabled } from '../../airtop/airtopClient';

export function getProvider(name: ProviderName): SniperExecutionProvider {
  if (name === 'airtop') {
    if (!airtopEnabled()) throw new Error('AIRTOP provider disabled');
    return airtopProvider;
  }
  return localPlaywrightProvider;
}


