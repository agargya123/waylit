import { useMemo, useState } from 'react'
import { evaluateRoutes } from '../sdk'
import { journeys, presets } from '../sdk/journeys'
import { RouteEvaluationAssistant } from './EvaluationAssistantView'

export default function App() {
  const [journeyId, setJourneyId] = useState(journeys[0].id)
  const [presetId, setPresetId] = useState(presets[0].id)
  const journey = journeys.find((item) => item.id === journeyId) ?? journeys[0]
  const preset = presets.find((item) => item.id === presetId)!
  const result = useMemo(() => evaluateRoutes({ routes: journey.routes, contexts: journey.contexts, factors: journey.factors, preset }), [journey, preset])
  const recommendation = journey.routes.find((route) => route.id === result.recommendedRouteId)

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="#top" aria-label="Waylit home"><span className="brand-mark">w</span> waylit</a><span className="live"><i /> Route guidance · Demo</span><button className="avatar" aria-label="Your profile">A</button></header>
      <section className="intro" id="top">
        <div className="eyebrow"><span className="sun">✳</span> YOUR WALK, YOUR WAY</div>
        <h1>A better way<br /><em>home.</em></h1>
        <p className="lede">Choose the route that feels right for you tonight.</p>
      </section>
      <div className="journey-picker"><label htmlFor="journey-select">CHOOSE A SUPPORTED SAN FRANCISCO WALK</label><select id="journey-select" aria-label="Select a supported San Francisco journey" value={journey.id} onChange={(event) => setJourneyId(event.target.value)}>{journeys.map((item) => <option key={item.id} value={item.id}>{item.origin} → {item.destination}</option>)}</select></div>
      <section className="journey" aria-label="Trip details">
        <div className="place"><span className="pin origin">○</span><div><small>FROM</small><strong>{journey.origin}</strong></div></div>
        <span className="journey-line" />
        <div className="place"><span className="pin destination">⌖</span><div><small>TO</small><strong>{journey.destination}</strong></div></div>
        <span className="trip-length">{Math.min(...journey.routes.map((route) => route.durationMinutes))} min fastest</span>
      </section>
      <section className="results">
        <div className="section-heading"><div><div className="eyebrow muted">YOUR ROUTES</div><h2>Find your way</h2></div><span className="route-count">{String(journey.routes.length).padStart(2, '0')} OPTIONS</span></div>
        <div className="preset-tabs" role="tablist" aria-label="Route preference">
          {presets.map((item) => <button key={item.id} role="tab" aria-selected={presetId === item.id} className={presetId === item.id ? 'preset active' : 'preset'} onClick={() => setPresetId(item.id)}>{item.id === 'better-lighting' ? '☼' : '↗'} {item.label}</button>)}
        </div>
        <div className="route-list">
          {journey.routes.map((route, index) => {
            const score = result.routes.find((item) => item.routeId === route.id)!
            const isRecommended = result.recommendedRouteId === route.id
            return <article className={`route-card ${isRecommended ? 'recommended' : ''}`} key={route.id}>
              <div className="route-top"><div className="route-number">0{index + 1}</div><div className="route-title"><div className="route-name">{route.name}{isRecommended && <span className="best-badge">BEST MATCH</span>}</div><p>{route.description}</p></div><div className="route-time"><strong>{route.durationMinutes}</strong><span>min{route.distanceMeters ? ` · ${(route.distanceMeters / 1000).toFixed(2)} km` : ''}</span></div></div>
              <div className="route-meta"><span>{score.score === null ? 'Not enough data' : `${Math.round(score.score)} match`}</span><span>{score.eligible ? `+${score.extraMinutes} min vs. fastest` : `Outside ${preset.maxExtraMinutes} min detour limit`}</span></div>
              <div className="meter"><span style={{ width: `${score.score ?? 0}%` }} /></div>
              <div className="factor-row">{score.factorResults.filter((factor) => factor.status === 'observed').map((factor) => <span key={factor.factorId} className="factor-chip"><b>{factor.label}</b> {factor.factorId === 'lighting' ? `${Math.round(factor.value! * 100)}%` : factor.value}</span>)}{score.factorResults.filter((factor) => factor.status === 'unknown').map((factor) => <span key={factor.factorId} className="factor-chip unknown">? {factor.label} unknown</span>)}</div>
            </article>
          })}
        </div>
        <aside className="recommendation"><span className="rec-icon">✳</span><div><strong>{recommendation ? `Made for your ${preset.label.toLowerCase()} preference` : 'No recommendation available'}</strong><p>{result.explanation}</p>{result.warnings.map((warning) => <p className="result-warning" key={warning}>{warning}</p>)}</div></aside>
        <p className="disclaimer">{journey.provenance.label}. Route durations, distances and environmental metrics are synthetic estimates; they are not routing-provider results. Endpoint coordinates, when supplied, identify named places only and do not define route geometry. Unknown observations stay unknown.</p>
      </section>
      <RouteEvaluationAssistant routes={routes} contexts={contexts} factors={factors} />
      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark">w</span> waylit</a><span>Go the way that feels right.</span><span>MADE FOR THE WAY HOME&nbsp; ✳</span></footer>
    </main>
  )
}
