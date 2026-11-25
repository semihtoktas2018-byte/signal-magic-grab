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


export function calculateEma(values: number[], period: number): number[] {
  if (!Number.isInteger(period) || period <= 0) throw new RangeError("EMA period must be a positive integer.");
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("EMA requires a non-empty series of finite values.");
  }
  const multiplier = 2 / (period + 1);
  const output = [values[0]];
  let previous = values[0];
  for (let index = 1; index < values.length; index++) {
    previous = values[index] * multiplier + previous * (1 - multiplier);
    output.push(previous);
  }
  return output;
}

export function calculateRsi(values: number[], period = 14): (number | null)[] {
  if (!Number.isInteger(period) || period <= 0) throw new RangeError("RSI period must be a positive integer.");
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("RSI requires finite values.");
  }
  const output: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return output;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index++) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;
  const toRsi = (gain: number, loss: number) => {
    if (gain === 0 && loss === 0) return 50;
    if (loss === 0) return 100;
    if (gain === 0) return 0;
    return 100 - 100 / (1 + gain / loss);
  };
  output[period] = toRsi(averageGain, averageLoss);

  for (let index = period + 1; index < values.length; index++) {
    const change = values[index] - values[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] = toRsi(averageGain, averageLoss);
  }
  return output;
}

export function calculateMacdHistogram(values: number[]): number {
  if (values.length < 34) throw new RangeError("MACD requires at least 34 values for the configured signal line.");
  const fast = calculateEma(values, 12);
  const slow = calculateEma(values, 26);
  const line = values.map((_, index) => fast[index] - slow[index]);
  const signal = calculateEma(line.slice(25), 9);
  return line[line.length - 1] - signal[signal.length - 1];
}

export function calculateBollingerPct(values: number[], period = 20, multiplier = 2): number | null {
  if (!Number.isInteger(period) || period <= 0 || !Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError("Bollinger period and multiplier must be positive.");
  }
  if (values.some((value) => !Number.isFinite(value))) throw new RangeError("Bollinger requires finite values.");
  if (values.length < period) return null;

  const slice = values.slice(-period);
  const mean = slice.reduce((sum, value) => sum + value, 0) / period;
  const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
  const deviation = Math.sqrt(variance);
  const upper = mean + multiplier * deviation;
  const lower = mean - multiplier * deviation;
  const price = values[values.length - 1];
  return upper === lower ? 0.5 : (price - lower) / (upper - lower);
}

/**
 * Current closed-bar volume divided by the mean of the preceding N bars.
 * The current bar is deliberately excluded from its own baseline.
 */
export function calculateRelativeVolumeRatio(volumes: number[], period = 20): number | null {
  if (!Number.isInteger(period) || period <= 0) throw new RangeError("Volume period must be a positive integer.");
  if (volumes.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("Volume series must contain finite non-negative values.");
  }
  if (volumes.length <= period) return null;
  const baseline = volumes.slice(-period - 1, -1);
  const average = baseline.reduce((sum, value) => sum + value, 0) / period;
  if (average <= 0) return null;
  return volumes[volumes.length - 1] / average;
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
