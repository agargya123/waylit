import { describe, expect, it } from 'vitest'
import { evaluateRoutes, type FactorDefinition, type PreferencePreset, type Route, type RouteContext } from './index'
import { contexts, factors, presets, routes } from './example'

describe('Waylit SDK', () => {
  it('recommends Route B for lighting and Route A for shortest walk', () => {
    expect(evaluateRoutes(routes, contexts, factors, presets[0]).recommendation).toBe('route-b')
    expect(evaluateRoutes(routes, contexts, factors, presets[1]).recommendation).toBe('route-a')
  })

  it('accepts a newly registered factor without changing the evaluator', () => {
    const factor: FactorDefinition = { id: 'tree-cover', label: 'Tree cover', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Canopy along the walk.' }
    const moreContexts = contexts.map((context) => ({ ...context, factors: { ...context.factors, 'tree-cover': context.routeId === 'route-a' ? 100 : 0 } }))
    const preset: PreferencePreset = { id: 'shade', label: 'Shade', description: '', maxExtraMinutes: 8 }
    const result = evaluateRoutes(routes, moreContexts, [...factors, factor], preset)
    expect(result.recommendation).toBe('route-a')
    expect(result.scores[0].observedFactors.map((item) => item.factorId)).toContain('tree-cover')
  })

  it('allows preference weights to change the ranking', () => {
    const testRoutes: Route[] = [
      { id: 'dim', name: 'Dim', durationMinutes: 10, description: '' },
      { id: 'bright', name: 'Bright', durationMinutes: 11, description: '' },
    ]
    const testFactors: FactorDefinition[] = [
      { id: 'lighting', label: 'Lighting', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Street lighting.' },
      { id: 'business', label: 'Business', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Open businesses.' },
    ]
    const testContexts: RouteContext[] = [
      { routeId: 'dim', factors: { lighting: 10, business: 100 } },
      { routeId: 'bright', factors: { lighting: 100, business: 10 } },
    ]
    expect(evaluateRoutes(testRoutes, testContexts, testFactors, { id: 'business', label: 'Business', description: '', maxExtraMinutes: 2, weightOverrides: { lighting: 0.1, business: 1 } }).recommendation).toBe('dim')
    expect(evaluateRoutes(testRoutes, testContexts, testFactors, { id: 'lighting', label: 'Lighting', description: '', maxExtraMinutes: 2, weightOverrides: { lighting: 1, business: 0.1 } }).recommendation).toBe('bright')
  })

  it('keeps unknowns explicit and excludes unknowns from the weighted average', () => {
    const result = evaluateRoutes(routes, contexts, factors, presets[0])
    const routeC = result.scores.find((score) => score.routeId === 'route-c')!
    expect(routeC.missingFactors).toContain('open-businesses')
    expect(routeC.explanation).toContain('Unknown: Open businesses')
    expect(routeC.observedFactors.map((factor) => factor.factorId)).not.toContain('open-businesses')
  })

  it('enforces max detour as a hard eligibility rule', () => {
    const result = evaluateRoutes(routes, contexts, factors, { ...presets[0], maxExtraMinutes: 0 })
    expect(result.scores.find((score) => score.routeId === 'route-b')?.eligible).toBe(false)
    expect(result.recommendation).not.toBe('route-b')
  })

  it('rejects invalid weights, bounds, durations, and factor values', () => {
    expect(() => evaluateRoutes(routes, contexts, factors.map((factor) => ({ ...factor, weight: 0 })), { id: 'zero', label: 'Zero', description: '', maxExtraMinutes: 0 })).toThrow(/weight/i)
    expect(() => evaluateRoutes(routes, contexts, [{ ...factors[0], bounds: { min: 2, max: 2 } }], presets[0])).toThrow(/bounds/i)
    expect(() => evaluateRoutes([{ ...routes[0], durationMinutes: Number.NaN }], [], factors, presets[0])).toThrow(/duration/i)
    expect(() => evaluateRoutes(routes, [{ routeId: 'route-a', factors: { lighting: Number.NaN } }, ...contexts.slice(1)], factors, presets[0])).toThrow(/value/i)
  })
})
