/**
 * BarberLoo — Structured State + City Location System
 * Provides validated state & city hierarchies and database fetching
 */

export interface StateItem {
  id: string;
  name: string;
  code: string;
}

export interface CityItem {
  id: string;
  stateId: string;
  name: string;
}

export const DEFAULT_STATES: StateItem[] = [
  { id: 'st-pb', name: 'Punjab', code: 'PB' },
  { id: 'st-dl', name: 'Delhi NCR', code: 'DL' },
  { id: 'st-mh', name: 'Maharashtra', code: 'MH' },
  { id: 'st-ka', name: 'Karnataka', code: 'KA' },
  { id: 'st-hr', name: 'Haryana', code: 'HR' },
  { id: 'st-ch', name: 'Chandigarh', code: 'CH' },
];

export const DEFAULT_CITIES: CityItem[] = [
  { id: 'ct-jal', stateId: 'st-pb', name: 'Jalandhar' },
  { id: 'ct-lud', stateId: 'st-pb', name: 'Ludhiana' },
  { id: 'ct-amr', stateId: 'st-pb', name: 'Amritsar' },
  { id: 'ct-pat', stateId: 'st-pb', name: 'Patiala' },
  { id: 'ct-nak', stateId: 'st-pb', name: 'Nakodar' },
  { id: 'ct-del', stateId: 'st-dl', name: 'New Delhi' },
  { id: 'ct-noida', stateId: 'st-dl', name: 'Noida' },
  { id: 'ct-gur', stateId: 'st-hr', name: 'Gurugram' },
  { id: 'ct-mum', stateId: 'st-mh', name: 'Mumbai' },
  { id: 'ct-pune', stateId: 'st-mh', name: 'Pune' },
  { id: 'ct-blr', stateId: 'st-ka', name: 'Bengaluru' },
  { id: 'ct-chd', stateId: 'st-ch', name: 'Chandigarh' },
];

export function getCitiesForState(
  stateId: string,
  cityList: CityItem[] = DEFAULT_CITIES
): CityItem[] {
  if (!stateId) return cityList;
  return cityList.filter((c) => c.stateId === stateId);
}

export function validateCityBelongsToState(
  cityId: string,
  stateId: string,
  cityList: CityItem[] = DEFAULT_CITIES
): boolean {
  if (!cityId || !stateId) return false;
  const match = cityList.find((c) => c.id === cityId);
  return Boolean(match && match.stateId === stateId);
}

export async function fetchLocationsFromApi(): Promise<{
  states: StateItem[];
  cities: CityItem[];
}> {
  try {
    const [stRes, ctRes] = await Promise.all([
      fetch('/api/locations/states').catch(() => null),
      fetch('/api/locations/cities').catch(() => null),
    ]);

    let states = DEFAULT_STATES;
    let cities = DEFAULT_CITIES;

    if (stRes && stRes.ok) {
      const data = await stRes.json();
      if (Array.isArray(data) && data.length > 0) {
        states = data.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        }));
      }
    }

    if (ctRes && ctRes.ok) {
      const data = await ctRes.json();
      if (Array.isArray(data) && data.length > 0) {
        cities = data.map((c: any) => ({
          id: c.id,
          stateId: c.stateId || c.state_id,
          name: c.name,
        }));
      }
    }

    return { states, cities };
  } catch {
    return { states: DEFAULT_STATES, cities: DEFAULT_CITIES };
  }
}
