# Historical Market Data Archive Plan

## Current production evidence (read-only inspection, 2026-11-25)

- The `kpk-signals-cron` job is scheduled every 5 minutes (`*/5 * * * *`).
- `kpk_signals` contains 400 rows spanning 2026-10-22 through 2026-11-25.
- `whale_events` contains 216 rows spanning 2026-11-19 through 2026-11-25: 212 `linear` and 4 `spot`.
- The current cron stores only the largest qualifying trade returned for each coin and market category during a scan. It does not persist every qualifying trade or a complete per-run feature snapshot.
- `exchange_prices` is a latest-value table (9 rows at inspection time), not a historical price series.
- `market_sentiment` has 12 rows, with source timestamps from 2026-11-13 through 2026-11-25.

These are live read-only observations, not synthetic examples. Counts and date ranges will change as the system runs.

## What can and cannot be backtested now

The existing 400 signal records can support an audit of already-recorded signals and their recorded outcomes. They cannot reproduce every historical V1/V2 decision because the database does not retain a complete time series of the inputs used at each scan.

The existing whale event table is not a complete historical whale-flow archive. In particular, its current collection logic stores at most one largest qualifying trade per coin/category per scan, and the observed spot archive is sparse. A historical strategy test that treats it as complete would be misleading.

## Proposed archive design

Capture one immutable market-feature snapshot per coin per five-minute cron bucket. A snapshot should include:

- Exact capture timestamp and five-minute bucket.
- Coin and the latest fully closed 15-minute candle timestamp.
- Bybit spot ticker used as the entry reference.
- V1 direction, score, quality and the exact indicator inputs used by V1.
- V2 direction, score, bias, coverage and factor inputs.
- Whale spot and linear scan diagnostics, including API status and scan counts.
- Funding rate and Fear & Greed value, each with source/observation timestamp and availability status.
- Data-quality flags so failed or stale inputs are not silently treated as zero.

Use a unique key on (coin, five-minute bucket) so a retried cron invocation cannot create duplicate snapshots. Keep this archive append-only; do not overwrite earlier observations with newer values.

## Whale event collection correction

In addition to the feature snapshots, persist every qualifying trade returned by each recent-trade API response, keyed by market category plus the exchange trade ID. Record response coverage diagnostics (returned trade count and oldest/newest trade timestamps). Because the endpoint returns a bounded recent-trade window, this still cannot guarantee complete coverage if more trades occur than fit in the response between polls. The system must expose that limitation rather than label the archive complete.

## Backtest methodology after collection begins

1. Validate snapshot cadence, uniqueness, feature completeness and source freshness.
2. Replay V1 and V2 decisions using only the feature values captured at each historical timestamp.
3. Resolve outcomes using subsequent 15-minute OHLC candles, with the existing conservative same-candle TP/SL rule.
4. Use a chronological train/calibration/test split; do not tune thresholds on the final test window.
5. Report BUY and SELL separately, and include sample size, coverage, pending/unresolved count, gross theoretical results, and a separate net model including fees, spread, slippage and funding.
6. Do not claim predictive performance until a sufficiently long, out-of-sample archive exists.

## Rollout boundary

The archive requires a database migration and a cron code change. This plan document does not modify the production database, cron schedule, secrets, or deployed Edge Function. The migration must be generated and validated with the Supabase CLI, reviewed for RLS/grants, and deployed only after explicit approval.
