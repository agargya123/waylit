import { describe, expect, it } from 'vitest'
import { evaluateRoutes, type RouteContext } from './index'
import { contexts as originalContexts, routes as originalRoutes } from './example'
import { factors, journeys, presets, type JourneyFixture } from './journeys'

describe('supported synthetic journeys', () => {
  it('retains the original journey data and marks all fixtures as synthetic', () => {
    expect(journeys[0].routes).toEqual(originalRoutes)
    expect(journeys[0].contexts).toEqual(originalContexts)
    expect(journeys).toHaveLength(6)
    expect(journeys.every((journey) => journey.provenance.verified === false && journey.provenance.geographicAccuracy === 'not-verified')).toBe(true)
  })

  it('evaluates a newly added journey fixture through the existing SDK', () => {
    const newContexts: RouteContext[] = [
      { routeId: 'new-a', factors: { lighting: 0.35, 'open-businesses': 2, disruptions: 2 } },
      { routeId: 'new-b', factors: { lighting: 0.92, 'open-businesses': 9, disruptions: 0 } },
    ]
    const newJourney: JourneyFixture = {
      id: 'new-neighborhood-walk', origin: 'Union Square', destination: 'Oracle Park',
      factors, contexts: newContexts,
      routes: [
        { id: 'new-a', name: 'Route A', durationMinutes: 14, description: 'Shorter synthetic option.' },
        { id: 'new-b', name: 'Route B', durationMinutes: 17, description: 'Brighter synthetic option.' },
      ],
      provenance: { kind: 'synthetic-estimate', label: 'Synthetic example', verified: false, geographicAccuracy: 'not-verified' },
    }
    const result = evaluateRoutes({ ...newJourney, preset: presets[0] })
    expect(result.recommendedRouteId).toBe('new-b')
  })

  it('changes the preferred route for both added journeys when the preset changes', () => {
    const lightingRouteByJourney: Record<string, string> = {
      'mission-to-ferry': 'mission-b',
      'ferry-to-coit': 'ferry-b',
    }
    for (const journey of journeys.filter((item) => item.id === 'mission-to-ferry' || item.id === 'ferry-to-coit')) {
      const betterLighting = evaluateRoutes({ ...journey, preset: presets[0] })
      const shortestWalk = evaluateRoutes({ ...journey, preset: presets[1] })
      expect(betterLighting.recommendedRouteId).toBe(lightingRouteByJourney[journey.id])
      expect(shortestWalk.recommendedRouteId).toBe(journey.routes[0].id)
      expect(shortestWalk.recommendedRouteId).not.toBe(betterLighting.recommendedRouteId)
    }
  })

  it('evaluates every journey with the same shared SDK function', () => {
    const results = journeys.map((journey) => evaluateRoutes({
      routes: journey.routes,
      contexts: journey.contexts,
      factors: journey.factors,
      preset: presets[0],
    }))

    expect(results).toHaveLength(journeys.length)
    expect(results.every((result) => result.presetId === presets[0].id)).toBe(true)
    expect(journeys.slice(3).map((journey) => [journey.origin, journey.destination])).toEqual([
      ['Ferry Building', 'Salesforce Park'],
      ['Civic Center (Civic Center Plaza)', "Patricia's Green (Hayes Valley)"],
      ['Oracle Park', 'Ferry Building'],
    ])
    expect(journeys.slice(3).every((journey) => journey.routes.length >= 2 && journey.routes.every((route) => route.distanceMeters !== undefined))).toBe(true)
    expect(journeys.slice(3).every((journey) => journey.originCoordinates && journey.destinationCoordinates && journey.coordinateSource)).toBe(true)
  })

  it('changes preference recommendation on a new journey using its fixture data', () => {
    const journey = journeys.find((item) => item.id === 'ferry-to-salesforce')!
    const lightingResult = evaluateRoutes({ ...journey, preset: presets[0] })
    const shortestResult = evaluateRoutes({ ...journey, preset: presets[1] })

    expect(lightingResult.recommendedRouteId).not.toBe(shortestResult.recommendedRouteId)
    expect(journey.routes.some((route) => route.id === lightingResult.recommendedRouteId)).toBe(true)
    expect(journey.routes.some((route) => route.id === shortestResult.recommendedRouteId)).toBe(true)

    for (const changedJourney of journeys.filter((item) => item.id === 'ferry-to-salesforce' || item.id === 'civic-center-to-patricias-green')) {
      const betterLighting = evaluateRoutes({ ...changedJourney, preset: presets[0] })
      const shortestWalk = evaluateRoutes({ ...changedJourney, preset: presets[1] })
      expect(betterLighting.recommendedRouteId).not.toBe(shortestWalk.recommendedRouteId)
    }
  })

  it('keeps missing observations unknown and enforces detour exclusions on new journeys', () => {
    const oracleJourney = journeys.find((item) => item.id === 'oracle-park-to-ferry')!
    const oracleResult = evaluateRoutes({ ...oracleJourney, preset: presets[0] })
    const missingRoute = oracleResult.routes.find((route) => route.routeId === 'oracle-ferry-c')!
    expect(missingRoute.score).toBeNull()
    expect(missingRoute.factorResults.find((factor) => factor.factorId === 'disruptions')?.status).toBe('unknown')

    const civicJourney = journeys.find((item) => item.id === 'civic-center-to-patricias-green')!
    const civicResult = evaluateRoutes({ ...civicJourney, preset: presets[0] })
    expect(civicResult.routes.find((route) => route.routeId === 'civic-patricias-c')).toMatchObject({ eligible: false, score: null })
    expect(civicResult.recommendedRouteId).not.toBe('civic-patricias-c')
  })

  it('labels missing environmental observations and keeps the comparison provisional', () => {
    const journey = journeys.find((item) => item.id === 'ferry-to-coit')!
    const result = evaluateRoutes({ ...journey, preset: presets[0] })
    const routeC = result.routes.find((route) => route.routeId === 'ferry-c')!
    expect(result.status).toBe('provisional')
    expect(routeC.score).toBeNull()
    expect(routeC.missingFactors).toContain('disruptions')
    expect(routeC.factorResults.find((factor) => factor.factorId === 'disruptions')?.status).toBe('unknown')
  })

  it('excludes a route outside the preset maximum detour before scoring', () => {
    const journey = journeys.find((item) => item.id === 'mission-to-ferry')!
    const result = evaluateRoutes({ ...journey, preset: presets[0] })
    expect(result.routes.find((route) => route.routeId === 'mission-c')).toMatchObject({ eligible: false, score: null })
    expect(result.recommendedRouteId).not.toBe('mission-c')
  })
})
