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

## SDK shape

The UI calls `evaluateRoutes` from `src/sdk`; it contains no ranking logic. Register a factor by supplying a `FactorDefinition` and observations keyed by its ID in each route's `RouteContext`. A factor's ID, label, base weight, direction, normalization bounds and description travel together. Add or tune a `PreferencePreset` with weight overrides and a hard `maxExtraMinutes` constraint.

The default `weightedNormalizedScoring` strategy maps observed values to 0–1 using the factor bounds and direction. It excludes missing (`null` or omitted) values and renormalizes the remaining weights for each route. It never imputes unknown data. Scores therefore compare observed evidence only; exact ties prefer the route with more total configured weight observed, then the shorter route. Every result includes observed and missing factors so this limitation remains visible. `maxExtraMinutes` is measured against the shortest listed route; ineligible routes cannot be recommended. A route with no observations has no score and cannot be recommended; when no eligible route has a score, the recommendation is `null`.

The `ScoringStrategy` interface is the narrow seam for a future algorithm. The MVP intentionally ships only the weighted normalized implementation. Factor additions do not require evaluator changes.

## Scope

The demo uses synthetic route data only; it has no mapping integration, backend, persistence, plugin loader, or runtime dependency injection.
