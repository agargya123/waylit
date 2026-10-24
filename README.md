# Waylit

Waylit is a small React demo backed by a framework-independent TypeScript route scoring SDK.

## Start

```sh
npm install
npm run dev
```

## Checks

```sh
npm test
npm run build
```

## SDK usage

The framework-independent SDK accepts routes, their environmental contexts, factor definitions, and a preference preset as one typed input. The React demo consumes the SDK; React is not an SDK dependency.

```ts
import { evaluateRoutes } from './src/sdk'
import { contexts, factors, presets, routes } from './src/sdk/example'

const result = evaluateRoutes({ routes, contexts, factors, preset: presets[0] })

if (result.recommendedRouteId) {
  const route = routes.find((item) => item.id === result.recommendedRouteId)
  console.log(route?.name, result.explanation)
}

for (const routeResult of result.routes) {
  console.log(routeResult.routeId, routeResult.score, routeResult.dataCoverage)
  console.log(routeResult.factorResults)
}
```

`status` is `recommended`, `provisional`, or `insufficient_data`. A route is scored only when all positively weighted observations are present; missing values remain `unknown`, produce a null route score, and reduce `dataCoverage`. Incomplete eligible alternatives make a recommendation provisional. The `maxExtraMinutes` constraint is applied before scoring, so excluded routes have no factor results and cannot be recommended. The shortest-walk preset selects only routes tied for the minimum duration and uses route ID as a deterministic fallback when no complete environmental score is available.

Register a synthetic factor by adding a `FactorDefinition` and observations keyed by its ID in each route's `RouteContext`; the evaluator does not need changes. The default `weightedNormalizedScoring` strategy remains replaceable through the optional strategy argument. Scores are normalized preference fits, not safety probabilities. See [the SDK contract](docs/sdk-contract.md) for public types, validation, fixtures, missing-data behavior, and acceptance tests.

## Hackathon evidence

See [the browser test results and reproduction steps](docs/hackathon-evidence.md), including the limits of local evidence sharing.

## Add a sample journey

Add a typed `JourneyFixture` to `src/sdk/journeys.ts` with its supported endpoints, routes, and route contexts. The UI renders the fixture list and sends every entry through the same `evaluateRoutes()` function. Extend the shared factor registry or preference presets only when the SDK gains a new reusable factor or preference; do not add journey-specific scoring rules.

The demo's place names and supplied endpoint coordinates identify real San Francisco locations. Each coordinate records its source URL. Route durations, distances, route descriptions, and lighting, expected-open business, and disruption observations are synthetic examples. They are not route-provider responses or verified paths.

## Provider-neutral route data

Waylit is the environmental context and evaluation layer, not a routing engine. A future Google Maps, OpenRouteService, or GraphHopper adapter can translate provider route alternatives into the existing route fields (`id`, `name`, `durationMinutes`, `description`) and optional `distanceMeters`, while storing route geometry and provider provenance alongside the fixture. It can then attach environmental observations by route ID and call `evaluateRoutes()` with the shared factors and selected preference. No provider adapter or live routing integration is included in this demo.

## Scope

The demo uses synthetic route data only; it has no mapping integration, backend, persistence, plugin loader, or runtime dependency injection.
