import type { EvaluationInput } from './index'
import type { FactorDefinition, PreferencePreset, Route, RouteContext } from './index'

export interface JourneyFixture extends Omit<EvaluationInput, 'preset'> {
  id: string
  origin: string
  destination: string
  originCoordinates?: { latitude: number; longitude: number }
  destinationCoordinates?: { latitude: number; longitude: number }
  coordinateSource?: string
  routes: Array<Route & { distanceMeters?: number }>
  provenance: {
    kind: 'synthetic-estimate'
    label: string
    verified: false
    geographicAccuracy: 'not-verified'
    routeMeasurements?: 'synthetic'
    environmentalContext?: 'synthetic'
  }
}

export const factors: FactorDefinition[] = [
  { id: 'lighting', label: 'Lighting', weight: 0.6, direction: 'higher', bounds: { min: 0, max: 1 }, description: 'Synthetic documented lighting observation.' },
  { id: 'open-businesses', label: 'Open businesses', weight: 0.25, direction: 'higher', bounds: { min: 0, max: 12 }, description: 'Synthetic expected-open business count.' },
  { id: 'disruptions', label: 'Disruptions', weight: 0.15, direction: 'lower', bounds: { min: 0, max: 3 }, description: 'Synthetic known disruption count.' },
]

export const presets: PreferencePreset[] = [
  { id: 'better-lighting', label: 'Better lighting', description: 'Prefer routes with better documented lighting.', weightOverrides: { lighting: 0.75, 'open-businesses': 0.15, disruptions: 0.1 }, maxExtraMinutes: 5 },
  { id: 'shortest-walk', label: 'Shortest walk', description: 'Keep to the shortest-duration routes.', maxExtraMinutes: 0 },
]

const marketStreetRoutes: Route[] = [
  { id: 'route-a', name: 'Route A', durationMinutes: 12, description: 'A shorter walk along familiar streets.' },
  { id: 'route-b', name: 'Route B', durationMinutes: 16, description: 'A brighter walk through active streets.' },
  { id: 'route-c', name: 'Route C', durationMinutes: 19, description: 'A longer walk with a quieter stretch.' },
]

const marketStreetContexts: RouteContext[] = [
  { routeId: 'route-a', factors: { lighting: 0.6, 'open-businesses': 2, disruptions: 1 } },
  { routeId: 'route-b', factors: { lighting: 0.95, 'open-businesses': 11, disruptions: 0 } },
  { routeId: 'route-c', factors: { lighting: 0.85, 'open-businesses': 7, disruptions: 0 } },
]

const missionRoutes: Route[] = [
  { id: 'mission-a', name: 'Route A', durationMinutes: 29, description: 'A direct walk with fewer open storefronts.' },
  { id: 'mission-b', name: 'Route B', durationMinutes: 33, description: 'A brighter option with more open businesses.' },
  { id: 'mission-c', name: 'Route C', durationMinutes: 37, description: 'The longest option, with the strongest lighting estimate.' },
]

const missionContexts: RouteContext[] = [
  { routeId: 'mission-a', factors: { lighting: 0.58, 'open-businesses': 2, disruptions: 1 } },
  { routeId: 'mission-b', factors: { lighting: 0.96, 'open-businesses': 9, disruptions: 0 } },
  { routeId: 'mission-c', factors: { lighting: 1, 'open-businesses': 8, disruptions: 0 } },
]

const ferryRoutes: Route[] = [
  { id: 'ferry-a', name: 'Route A', durationMinutes: 18, description: 'A shorter walk with a moderate lighting estimate.' },
  { id: 'ferry-b', name: 'Route B', durationMinutes: 22, description: 'A brighter option with more expected open businesses.' },
  { id: 'ferry-c', name: 'Route C', durationMinutes: 23, description: 'A well-lit estimate with one factor not reported.' },
]

const ferryContexts: RouteContext[] = [
  { routeId: 'ferry-a', factors: { lighting: 0.45, 'open-businesses': 4, disruptions: 2 } },
  { routeId: 'ferry-b', factors: { lighting: 0.9, 'open-businesses': 8, disruptions: 1 } },
  { routeId: 'ferry-c', factors: { lighting: 1, 'open-businesses': 11, disruptions: null } },
]

const provenance: JourneyFixture['provenance'] = {
  kind: 'synthetic-estimate',
  label: 'Synthetic example · not measured or verified',
  verified: false,
  geographicAccuracy: 'not-verified',
}

const newJourneyProvenance: JourneyFixture['provenance'] = {
  kind: 'synthetic-estimate',
  label: 'Synthetic route durations, distances, and environmental estimates',
  verified: false,
  geographicAccuracy: 'not-verified',
  routeMeasurements: 'synthetic',
  environmentalContext: 'synthetic',
}

const ferryToSalesforceRoutes: JourneyFixture['routes'] = [
  { id: 'ferry-salesforce-a', name: 'Embarcadero stroll', durationMinutes: 8, distanceMeters: 620, description: 'A short waterfront estimate with stronger business activity.' },
  { id: 'ferry-salesforce-b', name: 'Downtown blocks', durationMinutes: 10, distanceMeters: 760, description: 'A longer estimate with higher lighting and fewer open businesses.' },
  { id: 'ferry-salesforce-c', name: 'Market Street loop', durationMinutes: 14, distanceMeters: 1080, description: 'The most active synthetic estimate, beyond the lighting detour limit.' },
]

const ferryToSalesforceContexts: RouteContext[] = [
  { routeId: 'ferry-salesforce-a', factors: { lighting: 0.45, 'open-businesses': 10, disruptions: 1 } },
  { routeId: 'ferry-salesforce-b', factors: { lighting: 0.9, 'open-businesses': 3, disruptions: 0 } },
  { routeId: 'ferry-salesforce-c', factors: { lighting: 1, 'open-businesses': 12, disruptions: 0 } },
]

const civicToPatriciasRoutes: JourneyFixture['routes'] = [
  { id: 'civic-patricias-a', name: 'Civic plaza walk', durationMinutes: 13, distanceMeters: 980, description: 'A short estimate with moderate lighting and active storefronts.' },
  { id: 'civic-patricias-b', name: 'Hayes Street approach', durationMinutes: 16, distanceMeters: 1220, description: 'A brighter estimate with fewer expected open businesses.' },
  { id: 'civic-patricias-c', name: 'Market and Octavia loop', durationMinutes: 22, distanceMeters: 1650, description: 'A very bright, active estimate that exceeds the maximum detour.' },
]

const civicToPatriciasContexts: RouteContext[] = [
  { routeId: 'civic-patricias-a', factors: { lighting: 0.55, 'open-businesses': 8, disruptions: 0 } },
  { routeId: 'civic-patricias-b', factors: { lighting: 0.96, 'open-businesses': 6, disruptions: 1 } },
  { routeId: 'civic-patricias-c', factors: { lighting: 1, 'open-businesses': 12, disruptions: 0 } },
]

const oracleToFerryRoutes: JourneyFixture['routes'] = [
  { id: 'oracle-ferry-a', name: 'South Beach streets', durationMinutes: 16, distanceMeters: 1260, description: 'A compact estimate through South Beach with moderate activity.' },
  { id: 'oracle-ferry-b', name: 'Waterfront avenue', durationMinutes: 18, distanceMeters: 1450, description: 'A brighter estimate with more expected open businesses.' },
  { id: 'oracle-ferry-c', name: 'Embarcadero north', durationMinutes: 20, distanceMeters: 1610, description: 'A bright estimate with an unreported disruption observation.' },
]

const oracleToFerryContexts: RouteContext[] = [
  { routeId: 'oracle-ferry-a', factors: { lighting: 0.62, 'open-businesses': 6, disruptions: 1 } },
  { routeId: 'oracle-ferry-b', factors: { lighting: 0.92, 'open-businesses': 9, disruptions: 0 } },
  { routeId: 'oracle-ferry-c', factors: { lighting: 1, 'open-businesses': 12, disruptions: null } },
]

/** Add supported sample journeys here. Values are illustrative and have no verified map geometry. */
export const journeys: JourneyFixture[] = [
  {
    id: 'market-to-home', origin: 'Market Street', destination: 'Home',
    routes: marketStreetRoutes, contexts: marketStreetContexts, factors, provenance,
  },
  {
    id: 'mission-to-ferry', origin: 'Mission Dolores Park', destination: 'Ferry Building',
    routes: missionRoutes, contexts: missionContexts, factors, provenance,
  },
  {
    id: 'ferry-to-coit', origin: 'Ferry Building', destination: 'Coit Tower',
    routes: ferryRoutes, contexts: ferryContexts, factors, provenance,
  },
  {
    id: 'ferry-to-salesforce', origin: 'Ferry Building', destination: 'Salesforce Park',
    originCoordinates: { latitude: 37.79554, longitude: -122.39343 },
    destinationCoordinates: { latitude: 37.7897, longitude: -122.3966 },
    coordinateSource: 'https://mapcarta.com/23041732/Map and https://en.wikipedia.org/wiki/Salesforce_Transit_Center',
    routes: ferryToSalesforceRoutes, contexts: ferryToSalesforceContexts, factors, provenance: newJourneyProvenance,
  },
  {
    id: 'civic-center-to-patricias-green', origin: 'Civic Center (Civic Center Plaza)', destination: "Patricia's Green (Hayes Valley)",
    originCoordinates: { latitude: 37.77949, longitude: -122.41761 },
    destinationCoordinates: { latitude: 37.77623, longitude: -122.42444 },
    coordinateSource: 'https://mapcarta.com/23020966 and https://mapcarta.com/W28015862',
    routes: civicToPatriciasRoutes, contexts: civicToPatriciasContexts, factors, provenance: newJourneyProvenance,
  },
  {
    id: 'oracle-park-to-ferry', origin: 'Oracle Park', destination: 'Ferry Building',
    originCoordinates: { latitude: 37.77861, longitude: -122.38917 },
    destinationCoordinates: { latitude: 37.79554, longitude: -122.39343 },
    coordinateSource: 'https://en.wikipedia.org/wiki/Oracle_Park and https://mapcarta.com/23041732/Map',
    routes: oracleToFerryRoutes, contexts: oracleToFerryContexts, factors, provenance: newJourneyProvenance,
  },
]

