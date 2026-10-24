export type FactorDirection = 'higher' | 'lower'

export interface FactorDefinition {
  id: string
  label: string
  weight: number
  direction: FactorDirection
  bounds: { min: number; max: number }
  description: string
}

export interface RouteContext {
  routeId: string
  /** A number is an observation; null explicitly means unknown. Omitted registered factors are also unknown. */
  factors: Record<string, number | null>
}

export interface Route {
  id: string
  name: string
  durationMinutes: number
  description: string
}

export interface PreferencePreset {
  id: string
  label: string
  description: string
  weightOverrides?: Partial<Record<string, number>>
  maxExtraMinutes: number
}

export interface FactorContribution {
  factorId: string
  label: string
  value: number
  normalizedValue: number
  weight: number
  contribution: number
}

export interface RouteScore {
  routeId: string
  score: number | null
  eligible: boolean
  extraMinutes: number
  observedFactors: FactorContribution[]
  missingFactors: string[]
  explanation: string
}

export interface EvaluationResult {
  presetId: string
  scores: RouteScore[]
  recommendation: string | null
  explanation: string
}

export interface ScoringInput {
  route: Route
  context: RouteContext
  factors: FactorDefinition[]
  preset: PreferencePreset
}

export interface ScoringStrategy {
  readonly id: string
  score(input: ScoringInput): { score: number | null; observedFactors: FactorContribution[]; missingFactors: string[] }
}

/** Default strategy. Missing observations are excluded, never imputed, and remaining weights are renormalized.
 * Cross-route comparison uses the observed-only score; exact score ties prefer greater weight coverage,
 * then shorter duration. Explanations always disclose missing factors so scores are not read as certainty.
 */
export const weightedNormalizedScoring: ScoringStrategy = {
  id: 'weighted-normalized',
  score({ context, factors, preset }) {
    const missingFactors: string[] = []
    const observed: Array<Omit<FactorContribution, 'contribution' | 'weight'>> = []
    let totalWeight = 0
    for (const factor of factors) {
      const weight = preset.weightOverrides?.[factor.id] ?? factor.weight
      const value = context.factors[factor.id]
      if (value === undefined || value === null) { missingFactors.push(factor.id); continue }
      const raw = (value - factor.bounds.min) / (factor.bounds.max - factor.bounds.min)
      const normalizedValue = Math.max(0, Math.min(1, factor.direction === 'higher' ? raw : 1 - raw))
      totalWeight += weight
      observed.push({ factorId: factor.id, label: factor.label, value, normalizedValue })
    }
    return {
      score: totalWeight === 0 ? null : observed.reduce((sum, factor) => sum + factor.normalizedValue * (preset.weightOverrides?.[factor.factorId] ?? factors.find((item) => item.id === factor.factorId)!.weight) / totalWeight, 0) * 100,
      observedFactors: observed.map((factor) => {
        const weight = preset.weightOverrides?.[factor.factorId] ?? factors.find((item) => item.id === factor.factorId)!.weight
        return { ...factor, weight, contribution: factor.normalizedValue * weight / totalWeight * 100 }
      }),
      missingFactors,
    }
  },
}

export function validateInputs(routes: Route[], contexts: RouteContext[], factors: FactorDefinition[], preset: PreferencePreset) {
  if (!routes.length) throw new Error('At least one route is required.')
  if (!Number.isFinite(preset.maxExtraMinutes) || preset.maxExtraMinutes < 0) throw new Error('maxExtraMinutes must be a finite non-negative number.')
  const ids = new Set<string>()
  const factorIds = new Set<string>()
  for (const factor of factors) {
    if (!factor.id || factorIds.has(factor.id)) throw new Error(`Factor ID must be unique and non-empty: ${factor.id}`)
    factorIds.add(factor.id)
    if (!factor.label || !factor.description || !['higher', 'lower'].includes(factor.direction)) throw new Error(`Invalid factor definition for ${factor.id}.`)
    if (!Number.isFinite(factor.weight) || factor.weight < 0) throw new Error(`Invalid weight for ${factor.id}.`)
    if (!Number.isFinite(factor.bounds.min) || !Number.isFinite(factor.bounds.max) || factor.bounds.max <= factor.bounds.min) throw new Error(`Invalid bounds for ${factor.id}.`)
  }
  const weights = factors.map((factor) => preset.weightOverrides?.[factor.id] ?? factor.weight)
  for (const [id, weight] of Object.entries(preset.weightOverrides ?? {})) {
    if (!factorIds.has(id) || !Number.isFinite(weight) || weight! < 0) throw new Error(`Invalid weight override for ${id}.`)
  }
  if (!weights.some((weight) => Number.isFinite(weight) && weight > 0)) throw new Error('Total factor weight must be greater than zero.')
  for (const route of routes) {
    if (!route.id || ids.has(route.id)) throw new Error(`Route ID must be unique and non-empty: ${route.id}`)
    ids.add(route.id)
    if (!Number.isFinite(route.durationMinutes) || route.durationMinutes <= 0) throw new Error(`Invalid duration for route ${route.id}.`)
  }
  const contextById = new Map<string, RouteContext>()
  for (const context of contexts) {
    if (contextById.has(context.routeId)) throw new Error(`Duplicate context for route ${context.routeId}.`)
    contextById.set(context.routeId, context)
    if (!ids.has(context.routeId)) throw new Error(`Context references unknown route ${context.routeId}.`)
    for (const [factorId, value] of Object.entries(context.factors)) {
      const definition = factors.find((factor) => factor.id === factorId)
      if (!definition) throw new Error(`Unknown factor ${factorId} on route ${context.routeId}.`)
      if (value !== null && (!Number.isFinite(value) || value < definition.bounds.min || value > definition.bounds.max)) throw new Error(`Malformed value for ${factorId} on route ${context.routeId}.`)
    }
  }
  return contextById
}

export function evaluateRoutes(
  routes: Route[], contexts: RouteContext[], factors: FactorDefinition[], preset: PreferencePreset,
  strategy: ScoringStrategy = weightedNormalizedScoring,
): EvaluationResult {
  const contextById = validateInputs(routes, contexts, factors, preset)
  const shortest = Math.min(...routes.map((route) => route.durationMinutes))
  const scores = routes.map((route) => {
    const extraMinutes = route.durationMinutes - shortest
    const eligible = extraMinutes <= preset.maxExtraMinutes
    const result = strategy.score({ route, context: contextById.get(route.id) ?? { routeId: route.id, factors: {} }, factors, preset })
    const top = [...result.observedFactors].sort((a, b) => b.contribution - a.contribution)[0]
    const known = result.observedFactors.map((factor) => factor.label)
    const unknown = result.missingFactors.map((id) => factors.find((factor) => factor.id === id)!.label)
    const explanation = `${route.name} has ${known.length ? `known ${known.join(', ').toLowerCase()} data` : 'no known factor data'}${top ? `; ${top.label.toLowerCase()} contributes most` : ''}${unknown.length ? `. Unknown: ${unknown.join(', ')}.` : '.'}`
    return { routeId: route.id, score: result.score, eligible, extraMinutes, observedFactors: result.observedFactors, missingFactors: result.missingFactors, explanation }
  })
  const eligible = scores.filter((score) => score.eligible && score.score !== null)
  eligible.sort((a, b) => (b.score! - a.score!) || (coverage(b, factors, preset) - coverage(a, factors, preset)) || (routes.find((route) => route.id === a.routeId)!.durationMinutes - routes.find((route) => route.id === b.routeId)!.durationMinutes))
  const recommendation = eligible[0]?.routeId ?? null
  const winner = recommendation ? scores.find((score) => score.routeId === recommendation)! : null
  const explanation = winner
    ? `${routes.find((route) => route.id === recommendation)!.name} is the best eligible match for ${preset.label.toLowerCase()} with a score of ${winner.score!.toFixed(0)} out of 100. ${winner.explanation}`
    : 'No eligible route has known factor observations to compare.'
  return { presetId: preset.id, scores, recommendation, explanation }
}

function coverage(score: RouteScore, factors: FactorDefinition[], preset: PreferencePreset) {
  const total = factors.reduce((sum, factor) => sum + (preset.weightOverrides?.[factor.id] ?? factor.weight), 0)
  const observed = score.observedFactors.reduce((sum, factor) => sum + factor.weight, 0)
  return total > 0 ? observed / total : 0
}
