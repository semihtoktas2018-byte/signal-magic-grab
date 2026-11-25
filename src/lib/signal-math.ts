export type TradeDirection = "BUY" | "SELL";
export type SignalOutcome = "tuttu" | "tutmadi" | "bekliyor" | "suresi_doldu";

export const TAKE_PROFIT_PCT = 0.025;
export const STOP_LOSS_PCT = 0.02;

export interface TradeLevels {
  target: number;
  stop: number;
}

export function getTradeLevels(
  direction: TradeDirection,
  entryPrice: number,
  takeProfitPct = TAKE_PROFIT_PCT,
  stopLossPct = STOP_LOSS_PCT,
): TradeLevels {
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new RangeError("Entry price must be a finite positive number.");
  }
  if (!Number.isFinite(takeProfitPct) || takeProfitPct <= 0 ||
      !Number.isFinite(stopLossPct) || stopLossPct <= 0) {
    throw new RangeError("TP and SL percentages must be finite positive numbers.");
  }

  const isBuy = direction === "BUY";
  return {
    target: entryPrice * (isBuy ? 1 + takeProfitPct : 1 - takeProfitPct),
    stop: entryPrice * (isBuy ? 1 - stopLossPct : 1 + stopLossPct),
  };
}

/**
 * Resolve a single OHLC candle. If TP and SL are both touched in one candle,
 * return the conservative stop outcome because intrabar order is unknown.
 */
export function evaluateCandleOutcome(
  direction: TradeDirection,
  entryPrice: number,
  high: number,
  low: number,
  takeProfitPct = TAKE_PROFIT_PCT,
  stopLossPct = STOP_LOSS_PCT,
): "tuttu" | "tutmadi" | null {
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= 0 || low <= 0 || high < low) {
    throw new RangeError("Candle high/low must be finite positive prices with high >= low.");
  }
  const { target, stop } = getTradeLevels(direction, entryPrice, takeProfitPct, stopLossPct);
  const tpHit = direction === "BUY" ? high >= target : low <= target;
  const slHit = direction === "BUY" ? low <= stop : high >= stop;

  if (tpHit && slHit) return "tutmadi";
  if (tpHit) return "tuttu";
  if (slHit) return "tutmadi";
  return null;
}

export interface PerformanceRow {
  signal: TradeDirection;
  result: SignalOutcome;
}

export interface DirectionPerformance {
  total: number;
  wins: number;
  losses: number;
  expired: number;
  pending: number;
  closed: number;
  winRatePct: number | null;
  grossTheoreticalEvPct: number | null;
}

export interface PerformanceSummary extends DirectionPerformance {
  byDirection: Record<TradeDirection, DirectionPerformance>;
}

function summarizeRows(rows: PerformanceRow[], tpPct: number, slPct: number): DirectionPerformance {
  const wins = rows.filter((row) => row.result === "tuttu").length;
  const losses = rows.filter((row) => row.result === "tutmadi").length;
  const expired = rows.filter((row) => row.result === "suresi_doldu").length;
  const pending = rows.filter((row) => row.result === "bekliyor").length;
  const closed = wins + losses;

  return {
    total: rows.length,
    wins,
    losses,
    expired,
    pending,
    closed,
    winRatePct: closed > 0 ? (wins / closed) * 100 : null,
    grossTheoreticalEvPct: closed > 0 ? ((wins * tpPct - losses * slPct) / closed) * 100 : null,
  };
}

export function calculatePerformanceSummary(
  rows: PerformanceRow[],
  takeProfitPct = TAKE_PROFIT_PCT,
  stopLossPct = STOP_LOSS_PCT,
): PerformanceSummary {
  if (!Number.isFinite(takeProfitPct) || takeProfitPct <= 0 ||
      !Number.isFinite(stopLossPct) || stopLossPct <= 0) {
    throw new RangeError("TP and SL percentages must be finite positive numbers.");
  }

  const buyRows = rows.filter((row) => row.signal === "BUY");
  const sellRows = rows.filter((row) => row.signal === "SELL");

  return {
    ...summarizeRows(rows, takeProfitPct, stopLossPct),
    byDirection: {
      BUY: summarizeRows(buyRows, takeProfitPct, stopLossPct),
      SELL: summarizeRows(sellRows, takeProfitPct, stopLossPct),
    },
  };
}

export interface V1SignalInputs {
  price: number;
  prevPrice: number;
  rsi: number | null;
  prevRsi: number | null;
  ema20: number;
  ema50: number;
  ema20Prev: number;
  macdHist: number | null;
  bbPct: number | null;
  volumeRatio: number | null;
  whaleBuyUsd: number;
  whaleSellUsd: number;
}

export interface V1SignalResult {
  signal: TradeDirection | "WAIT";
  quality: "ULTRA" | "GÜÇLÜ" | "ORTA" | "ZAYIF";
  score: number;
}

export function calculateV1Signal(input: V1SignalInputs): V1SignalResult {
  const {
    price, prevPrice, rsi, prevRsi, ema20, ema50, ema20Prev,
    macdHist, bbPct, volumeRatio, whaleBuyUsd, whaleSellUsd,
  } = input;

  // RSI=0 is a valid oscillator value; only null/undefined or invalid values mean missing data.
  if (
    !Number.isFinite(rsi) ||
    !Number.isFinite(price) || price <= 0 ||
    !Number.isFinite(prevPrice) || prevPrice <= 0 ||
    !Number.isFinite(ema20) || ema20 <= 0 ||
    !Number.isFinite(ema50) || ema50 <= 0
  ) {
    return { signal: "WAIT", quality: "ZAYIF", score: 0 };
  }

  const rsiValue = rsi as number;
  const rsiTurn = prevRsi !== null && prevRsi < 30 && rsiValue >= 30;
  const rsiOversold = rsiValue < 30;
  const above20 = price > ema20;
  const crossed20 = prevPrice < ema20 && price >= ema20;
  const below20 = price < ema20;
  const trendUp = ema20 >= ema50;
  const slopeUp = ema20Prev > 0 && ema20 > ema20Prev;
  const overbought = rsiValue > 70;
  const macdBull = macdHist !== null && macdHist > 0;
  const macdBear = macdHist !== null && macdHist < 0;
  const bbOversold = bbPct !== null && bbPct < 0.2;
  const bbOverbought = bbPct !== null && bbPct > 0.8;
  const highVolume = volumeRatio !== null && volumeRatio > 1.3;
  const whaleBuy = whaleBuyUsd > whaleSellUsd * 1.5 && whaleBuyUsd > 0;
  const whaleSell = whaleSellUsd > whaleBuyUsd * 1.5 && whaleSellUsd > 0;
  const trendDown = ema20 < ema50;
  const slopeDown = ema20Prev > 0 && ema20 < ema20Prev;

  let buy = 0;
  if (rsiTurn) buy += 32;
  else if (rsiOversold) buy += 20;
  if (above20) buy += 20;
  if (crossed20) buy += 10;
  if (trendUp) buy += 15;
  if (slopeUp) buy += 12;
  if (macdBull) buy += 14;
  if (bbOversold) buy += 8;
  if (highVolume) buy += 6;
  if (whaleBuy) buy += 14;
  if (!trendUp || !slopeUp) buy -= 30;
  if (whaleSell) buy -= 15;

  let sell = 0;
  if (below20) sell += 28;
  if (overbought) sell += 24;
  if (trendDown) sell += 18;
  if (slopeDown) sell += 12;
  if (macdBear) sell += 14;
  if (bbOverbought) sell += 8;
  if (highVolume) sell += 6;
  if (whaleSell) sell += 14;
  if (!trendDown || !slopeDown) sell -= 30;
  if (whaleBuy) sell -= 15;

  buy = Math.max(0, buy);
  sell = Math.max(0, sell);

  if (buy >= 50 && sell >= 50) {
    return { signal: "WAIT", quality: "ZAYIF", score: 0 };
  }

  const ultraBuy = rsiTurn && above20 && trendUp && slopeUp && macdBull && whaleBuy && buy >= 88;
  const ultraSell = below20 && overbought && trendDown && slopeDown && macdBear && whaleSell && sell >= 88;

  if (ultraBuy) return { signal: "BUY", quality: "ULTRA", score: Math.min(100, buy) };
  if (ultraSell) return { signal: "SELL", quality: "ULTRA", score: Math.min(100, sell) };
  if (buy >= 82) return { signal: "BUY", quality: "GÜÇLÜ", score: Math.min(100, buy) };
  if (sell >= 82) return { signal: "SELL", quality: "GÜÇLÜ", score: Math.min(100, sell) };
  if (buy >= 65) return { signal: "BUY", quality: "ORTA", score: Math.min(100, buy) };
  if (sell >= 65) return { signal: "SELL", quality: "ORTA", score: Math.min(100, sell) };
  return { signal: "WAIT", quality: "ZAYIF", score: Math.max(buy, sell) };
}
