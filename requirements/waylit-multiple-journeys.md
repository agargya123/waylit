# Waylit multiple journeys

## Objective

Add 3 additional walking journeys with recognizable San Francisco origins and destinations, and prove that the same SDK evaluates all journeys without journey-specific scoring logic.

## Journeys

1. Ferry Building → Salesforce Park
2. Civic Center → Patricia's Green (Hayes Valley)
3. Oracle Park → Ferry Building

Retain our existing SoMa → South Beach journey and all its data unchanged.

## Dataset

- Use real geographical place names and coordinates for the origins and destinations where verified.
- Prepare 2–3 alternative walking routes for each journey.
- For this iteration, route durations, distances and environmental data may be synthetic; clearly distinguish them from verified locations.
- Do not represent synthetic geometry or durations as actual routing-provider results.
- If reliable real walking-route fixture data is already available in the project, use it with accurate provenance.
- Give each journey different characteristics and tradeoffs, rather than replicating the original example with renamed routes.
- At least two journeys should demonstrate preference-dependent recommendation changes where the scoring results genuinely support them.
- Include missing environmental information in at least one journey.
- Include a journey where the maximum-detour constraint eliminates an otherwise attractive option.
- Keep lighting, expected-open businesses and disruptions as synthetic contextual factors.

## Architecture

- Introduce a typed Journey fixture structure containing an ID, origin, destination, routes, context and provenance.
- Store sample journeys in separate fixture files or one well-organized fixtures module.
- Use one shared evaluateRoutes(routes, context, preferences) implementation for ALL journeys.
- Do not add hardcoded recommended route IDs, special journey-specific weights, or conditional scoring logic.
- Preserve the existing configurable factor registry, scoring strategies, and preference presets.
- Keep the SDK independent of React and any routing API.
- If useful, define a small provider-neutral route input type or adapter interface, but do not implement live API integrations.
- Make it easy for another developer to add a journey by modifying fixture data only.

## UI

- Preserve the current Waylit aesthetic and layout.
- Add a compact journey selection control near the current origin/destination display.
- Show only valid predefined origin/destination pairs; do not imply that arbitrary routing is supported.
- On selection, dynamically update the origin, destination, route alternatives, distances if available, environmental metrics, best-match badge, and explanation.
- Keep Better lighting and Shortest walk working for all journeys.
- The selected journey and selected preference must both affect the rendered evaluation results.
- Clearly display that route measurements and environmental metrics are synthetic where applicable.
- Do not add a full map, location tracking, search autocomplete, or backend.

## Testing

- Retain all existing tests.
- Add unit tests demonstrating that the same SDK function evaluates all journeys.
- Test a preference change on at least one newly added journey.
- Verify missing observations remain unknown.
- Verify maximum-detour constraints are respected.
- Do not break the existing Kane CLI flows at http://localhost:4173.
- Do not modify the existing default journey or its preference behavior, so previously passing Kane tests remain valid.
