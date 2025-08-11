import { countryCodeToName } from './countryMapping';

interface NormalizedLocation {
  city?: string;
  state?: string;
  country: string;
}

const commonLocationMappings: { [key: string]: string } = {
  'SF Bay Area': 'San Francisco, CA, US',
  'SF': 'San Francisco, CA, US',
  'NYC': 'New York, NY, US',
  'NY': 'New York, NY, US',
  'LA': 'Los Angeles, CA, US',
  'UK': 'United Kingdom',
  'GB': 'United Kingdom',
  'USA': 'US',
  'United States': 'US',
};

export function normalizeLocation(input: string): string {
  // Check for direct mappings first
  if (commonLocationMappings[input.trim()]) {
    return commonLocationMappings[input.trim()];
  }

  // Split the input into parts
  const parts = input.split(',').map(part => part.trim());

  // Handle country codes
  if (parts.length === 1) {
    // Single part might be a country code
    const countryName = countryCodeToName[parts[0].toUpperCase()];
    if (countryName) {
      return countryName;
    }
  }

  // Handle US states
  if (parts.length === 2) {
    const [city, state] = parts;
    if (state.length === 2) { // State abbreviation
      return `${city}, ${state}, US`;
    }
  }

  // Return the original string if no normalization rules match
  return input;
}

export function toApolloGeoString(location: string): string {
  // Preserve "City, ST" granularity; don't broaden to state-only,
  // to avoid wide-radius matches in Apollo.
  const normalized = normalizeLocation(location);
  return normalized;
}

export function parseApolloLocation(person: any): NormalizedLocation {
  return {
    city: person.city || undefined,
    state: person.state || undefined,
    country: person.country || 'Unknown'
  };
}

export function formatLocation(location: NormalizedLocation): string {
  if (!location.city && !location.state) {
    if (location.country === 'Unknown') {
      return 'Remote';
    }
    return `Remote - ${location.country}`;
  }

  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (location.country) parts.push(location.country);
  
  return parts.join(', ');
} 