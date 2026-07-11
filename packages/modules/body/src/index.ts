export {
  BODY_NAMESPACE,
  BODY_SLICE_VERSION,
  MAX_PLAUSIBLE_WEIGHT_KG,
  MIN_PLAUSIBLE_WEIGHT_KG,
  bodyDayCodec,
  type BodyDaySlice,
} from './slice.js';
export {
  MIN_RATE_SPAN_DAYS,
  RATE_WINDOW_DAYS,
  TREND_SMOOTHING,
  weeklyRateKg,
  weightTrend,
  type TrendPoint,
  type WeightEntry,
} from './trend.js';
export { createBodyStore, type BodyStore } from './store.js';
export { bodyManifest } from './manifest.js';
