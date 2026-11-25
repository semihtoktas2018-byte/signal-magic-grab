# Signal Engine Calculation Audit

Audit date: 2026-11-25

## Scope and deployment status

This document describes the proposed calculation changes in branch `feat/signal-math-verification-20261125`. They are not deployed to the production Supabase Edge Function. The live database, cron schedule, secrets, and existing signal rows have not been changed.

## Current calculation contract

### Market data

- Signal candles: Bybit Spot, 15-minute interval.
- Indicator input: closed candles only; the engine requires at least 50 closed candles, validates OHLCV ranges, and rejects missing, duplicate, or misaligned 15-minute intervals.
- Entry snapshot: Bybit Spot ticker at signal-record time. If the ticker is missing, invalid, zero, or negative, the signal is not recorded. The previous fallback to the last candle close is removed.
- Exchange comparison: current Bybit Spot ticker versus current OKX ticker. Invalid or unavailable Bybit/OKX prices prevent a fresh comparison record; the system does not compare a candle close against a live ticker.
- Performance-page live P&L: uses the same Bybit price snapshot stored in `exchange_prices`, not a different exchange's ticker. Each coin's source timestamp is shown; data older than ten minutes is visibly marked stale.
- Whale flow: Bybit recent trades, Spot and Linear are recorded separately. The current V1 signal score uses Spot whale flow; the Linear feed is diagnostic/event data and does not currently contribute to V1.
- Sentiment: Alternative.me Fear & Greed. The proposed cron reads a cache using `updated_at`, refreshes it no more than once per six hours when successful, and supplies the value to V2. If refresh fails and the cache is stale, V2 receives no sentiment value.
- Funding: current Bybit Linear ticker `fundingRate` per coin, fetched on each cron run. A missing/invalid response is excluded from V2 coverage and logged; it is not fabricated.

### Indicators

- EMA: recursive exponential moving average, periods 20 and 50; the initial seed is the first available close and subsequent values use the standard smoothing multiplier.
- RSI: Wilder-smoothed RSI, period 14. A flat series returns 50; a series with gains and no losses returns 100; a series with losses and no gains returns 0.
- MACD: EMA(12) minus EMA(26), with EMA(9) signal line; histogram is MACD minus signal.
- Bollinger position: 20-period population standard deviation, 2 standard deviations.
- Relative volume: latest closed candle volume divided by the mean volume of the preceding 20 candles. The current candle is excluded from its own baseline.
- V2 volatility input: currently derived from the dispersion of the last 15 close prices relative to the latest close. This is not a standard return-based realized-volatility estimator and remains a calibration item before V2 can be treated as a production-quality model.

### V1 signal scoring

V1 remains the active signal-generation path. Its weights and score thresholds have not been changed in this branch. The shared implementation preserves the existing score rules while correcting the invalid truthiness check that treated RSI=0 as missing.

- BUY / SELL candidates are recorded only at score 75 or higher.
- At most two candidates are recorded per cron run.
- The highest-scoring candidates are selected.
- A coin/direction duplicate for the UTC day is skipped.
- A missing or invalid ticker prevents entry recording; no candle-close fallback is used.

### V2 scoring

V2 remains a comparison/reporting engine; it does not authorize or block V1 signals.

| Factor | Weight |
|---|---:|
| Trend | 30% |
| Momentum | 25% |
| Volume | 15% |
| Whale flow | 15% |
| Funding / Fear & Greed | 10% |
| Volatility | 5% |

Only available factors contribute; available weights are normalized and reported as coverage. Funding is supplied from the Bybit Linear ticker when valid. Fear & Greed is supplied only when the cache or refresh provides a valid value. V2 coverage is dynamic and must be inspected per run; it must not be marketed as a fully populated six-factor engine when any input is unavailable or its volatility definition remains unresolved.

### TP/SL resolution

- TP: +2.5% for BUY, -2.5% price move for SELL.
- SL: -2.0% for BUY, +2.0% price move for SELL.
- Resolution window: 48 hours after signal creation.
- Resolution interval: 15-minute candles.
- Candles before the signal timestamp are ignored.
- An unfinished candle is ignored.
- A TP/SL result is accepted only when all preceding expected candles from the first post-signal interval through the hit candle are present.
- If TP and SL are both touched within the same candle, the result is conservatively classified as stop-loss because intrabar order is unknown.
- The recorded `closed_at` is the confirming candle's close timestamp, not a claimed exact intrabar hit time.
- A signal is marked expired only after 48 hours and only if the complete candle history for the entire window is available. Otherwise it remains unresolved.

## Performance accounting

- Hit rate denominator: wins + losses only.
- Pending and expired signals are excluded from hit rate and EV.
- Gross theoretical EV per closed signal: `(wins × 2.5% − losses × 2.0%) / (wins + losses)`.
- BUY and SELL are calculated separately.
- A zero-sample hit rate and EV are represented as unavailable (`null`) by the shared calculation layer.
- This EV is not realized account P&L. Fees, spread, slippage, funding, position sizing, partial fills, and execution failures are not included.

## Automated regression coverage

The Deno test suite covers:

- BUY/SELL TP and SL levels and invalid entry prices.
- Single-candle TP, SL, both-hit, and no-hit cases.
- Performance denominators, expired/pending exclusions, directional summaries, and zero-sample output.
- RSI=0 handling and missing-RSI behavior in V1.
- EMA, RSI, MACD, Bollinger, and relative-volume calculations.
- V2 factor coverage, weight normalization, sentiment availability, and V1/V2 comparison.
- Historical TP/SL resolution, missing-candle protection, unfinished candles, same-candle collisions, and 48-hour expiry coverage.

## Remaining work before production acceptance

1. Run a reproducible historical replay with time-ordered data and no look-ahead.
2. Obtain or store historical whale-flow data; current recent-trade snapshots cannot reproduce past whale inputs.
3. Define and test fee, spread, slippage, funding, and position-sizing assumptions for net P&L.
4. Replace or formally calibrate the V2 price-dispersion input with a documented realized-volatility measure.
5. Monitor funding-rate availability and source freshness; keep missing funding out of V2 coverage.
6. Evaluate V1 and V2 separately on out-of-sample periods, including BUY and SELL breakdowns and drawdown.
7. Add operational monitoring for stale market data, cron failures, API failures, and unresolved signals.
8. Deploy the Edge Function only after the branch passes tests, code review, and an explicit production rollout decision.

## Production safety

No migration, schema mutation, historical data rewrite, cron change, secret change, or production deployment is included in this branch.
