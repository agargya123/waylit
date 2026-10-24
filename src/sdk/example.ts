// Compatibility exports for existing SDK consumers and examples.
export { factors, presets } from './journeys'
import { journeys } from './journeys'

export const routes = journeys[0].routes
export const contexts = journeys[0].contexts
