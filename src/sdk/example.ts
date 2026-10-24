import type { FactorDefinition, PreferencePreset, Route, RouteContext } from './index'

export const factors: FactorDefinition[] = [
  { id: 'lighting', label: 'Lighting', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Expected street lighting along the route.' },
  { id: 'open-businesses', label: 'Open businesses', weight: 0.7, direction: 'higher', bounds: { min: 0, max: 10 }, description: 'Expected number of open businesses along the route.' },
  { id: 'disruptions', label: 'Disruptions', weight: 0.6, direction: 'lower', bounds: { min: 0, max: 10 }, description: 'Reported disruptions along the route.' },
]

export const presets: PreferencePreset[] = [
  { id: 'better-lighting', label: 'Better lighting', description: 'Prefer brighter streets and visible activity.', weightOverrides: { lighting: 1.8, 'open-businesses': 0.9, disruptions: 0.4 }, maxExtraMinutes: 8 },
  { id: 'shortest-walk', label: 'Shortest walk', description: 'Keep the walk short while using the same safety signals.', weightOverrides: { lighting: 0.6, 'open-businesses': 0.2, disruptions: 0.2 }, maxExtraMinutes: 0 },
]

export const routes: Route[] = [
  { id: 'route-a', name: 'Route A', durationMinutes: 14, description: 'A quick walk along familiar streets.' },
  { id: 'route-b', name: 'Route B', durationMinutes: 19, description: 'A brighter walk through active streets.' },
  { id: 'route-c', name: 'Route C', durationMinutes: 22, description: 'A longer walk with a quieter stretch.' },
]

export const contexts: RouteContext[] = [
  { routeId: 'route-a', factors: { lighting: 48, 'open-businesses': 2, disruptions: 2 } },
  { routeId: 'route-b', factors: { lighting: 91, 'open-businesses': 8, disruptions: 1 } },
  { routeId: 'route-c', factors: { lighting: 72, 'open-businesses': null, disruptions: 3 } },
]
