import { Ngo, PoliceStation } from '../types';

// Default list of pre-configured Women's safety NGOs
export const DEFAULT_NGOS: Ngo[] = [
  {
    id: 'ngo-1',
    name: 'Asha Women Crisis Support',
    phone: '+1 (555) 014-9911',
    email: 'crisis-asha@ngo-alliance.org',
    address: '404 Red Rose Ave, Sector 4',
    category: 'Crisis Intervention & Rescue Support',
    latitude: 37.7749, // Close to default San Francisco coordinates for simulation
    longitude: -122.4194,
    isActive: true
  },
  {
    id: 'ngo-2',
    name: 'SafeHaven Women Shelter Foundation',
    phone: '+1 (555) 016-8844',
    email: 'assistance@safehaven-foundation.org',
    address: '89 Willow Creek Lane',
    category: 'Emergency Shelter & Legal Advice',
    latitude: 37.7833,
    longitude: -122.4167,
    isActive: true
  },
  {
    id: 'ngo-3',
    name: 'Nirbhaya Safe Transit Coalition',
    phone: '+1 (555) 018-7722',
    email: 'rapid@nirbhaya-transit.org',
    address: 'Suite 12, Metro Junction Block',
    category: 'Rapid Transit Escort Services',
    latitude: 37.7599,
    longitude: -122.4368,
    isActive: true
  },
  {
    id: 'ngo-4',
    name: 'Saheli Women Support Circle',
    phone: '+1 (555) 012-3300',
    email: 'info@saheli-support.org',
    address: '76 Maple Boulevard, Sub-District B',
    category: 'Mental Wellness & Crisis Support',
    latitude: 37.8044,
    longitude: -122.2712, // Oakland area
    isActive: true
  }
];

// Default list of Police Stations
export const DEFAULT_POLICE_STATIONS: PoliceStation[] = [
  {
    id: 'police-1',
    name: 'Central Metropolitan District Police Station',
    phone: '+1 (555) 911-0011',
    address: '850 Bryant St, San Francisco, CA',
    latitude: 37.7754,
    longitude: -122.4034,
    isActive: true
  },
  {
    id: 'police-2',
    name: 'Mission District Precinct Police',
    phone: '+1 (555) 911-0022',
    address: '630 Valencia St, San Francisco, CA',
    latitude: 37.7628,
    longitude: -122.4219,
    isActive: true
  },
  {
    id: 'police-3',
    name: 'Richmond Precinct Police HQ',
    phone: '+1 (555) 911-0033',
    address: '461 6th Ave, San Francisco, CA',
    latitude: 37.7813,
    longitude: -122.4641,
    isActive: true
  },
  {
    id: 'police-4',
    name: 'Northern Precinct Patrol Office',
    phone: '+1 (555) 911-0044',
    address: '1125 Fillmore St, San Francisco, CA',
    latitude: 37.7801,
    longitude: -122.4324,
    isActive: true
  }
];

// Haversine formula to compute distance in kilometers
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2)); // Distance in km
}
