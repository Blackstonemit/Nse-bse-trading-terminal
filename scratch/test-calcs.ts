import { ATR } from "technicalindicators";

// Dummy data for testing
const highs = [102, 104, 105, 104, 103, 106, 108, 109, 107, 106, 108, 110, 112, 113, 111, 110, 112, 114, 115, 113];
const lows = [98, 100, 101, 100, 99, 102, 104, 105, 103, 102, 104, 106, 108, 109, 107, 106, 108, 110, 111, 109];
const closes = [100, 102, 103, 101, 100, 104, 106, 107, 105, 104, 106, 108, 110, 111, 109, 108, 110, 112, 113, 111];
const volumes = [1000, 1200, 1500, 1100, 900, 1300, 1600, 1700, 1400, 1200, 1500, 1800, 2000, 2100, 1700, 1600, 1800, 2200, 2400, 1900];

// 1. Supertrend calculation helper
function calculateSupertrend(high: number[], low: number[], close: number[], period: number = 7, multiplier: number = 3) {
  const atrValues = ATR.calculate({ high, low, close, period });
  const size = close.length;
  const supertrend = new Array(size).fill(0);
  const direction = new Array(size).fill(""); // "bullish" | "bearish"
  
  // ATR offset alignment: ATR values start from index 'period'
  // Let's align them by prepending nulls or 0s
  const alignedAtr = new Array(period).fill(0).concat(atrValues);
  
  let prevFinalUpper = 0;
  let prevFinalLower = 0;
  let prevDirection = "bullish";
  
  for (let i = 0; i < size; i++) {
    const hl2 = (high[i] + low[i]) / 2;
    const atr = alignedAtr[i] || 0;
    
    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;
    
    let finalUpper = basicUpper;
    let finalLower = basicLower;
    
    if (i > 0) {
      const prevClose = close[i - 1];
      
      if (basicUpper < prevFinalUpper || prevClose > prevFinalUpper) {
        finalUpper = basicUpper;
      } else {
        finalUpper = prevFinalUpper;
      }
      
      if (basicLower > prevFinalLower || prevClose < prevFinalLower) {
        finalLower = basicLower;
      } else {
        finalLower = prevFinalLower;
      }
    }
    
    let currDir = prevDirection;
    let currVal = 0;
    
    if (i > 0) {
      const prevSuper = supertrend[i - 1];
      if (prevDirection === "bullish") {
        if (close[i] < finalLower) {
          currDir = "bearish";
          currVal = finalUpper;
        } else {
          currDir = "bullish";
          currVal = Math.max(finalLower, prevSuper);
        }
      } else {
        if (close[i] > finalUpper) {
          currDir = "bullish";
          currVal = finalLower;
        } else {
          currDir = "bearish";
          currVal = Math.min(finalUpper, prevSuper);
        }
      }
    } else {
      currVal = finalUpper;
    }
    
    supertrend[i] = currVal;
    direction[i] = currDir;
    
    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevDirection = currDir;
  }
  
  return {
    value: supertrend[size - 1],
    direction: direction[size - 1].toUpperCase(),
  };
}

// 2. VWAP calculation helper
function calculateVWAP(high: number[], low: number[], close: number[], volume: number[]) {
  let sumTypicalVolume = 0;
  let sumVolume = 0;
  
  for (let i = 0; i < close.length; i++) {
    const typicalPrice = (high[i] + low[i] + close[i]) / 3;
    sumTypicalVolume += typicalPrice * volume[i];
    sumVolume += volume[i];
  }
  
  return sumVolume > 0 ? sumTypicalVolume / sumVolume : close[close.length - 1];
}

// 3. CMF calculation helper
function calculateCMF(high: number[], low: number[], close: number[], volume: number[], period: number = 20) {
  if (close.length < period) return null;
  
  const size = close.length;
  let mfVolumeSum = 0;
  let volumeSum = 0;
  
  for (let i = size - period; i < size; i++) {
    const range = high[i] - low[i];
    let mfm = 0; // Money Flow Multiplier
    if (range > 0) {
      mfm = ((close[i] - low[i]) - (high[i] - close[i])) / range;
    }
    mfVolumeSum += mfm * volume[i];
    volumeSum += volume[i];
  }
  
  return volumeSum > 0 ? mfVolumeSum / volumeSum : 0;
}

// 4. Fibonacci Retracement helper
function calculateFibonacci(highs: number[], lows: number[], period: number = 10) {
  const rangeHighs = highs.slice(-period);
  const rangeLows = lows.slice(-period);
  
  const maxHigh = Math.max(...rangeHighs);
  const minLow = Math.min(...rangeLows);
  const range = maxHigh - minLow;
  
  // Assuming trend is bullish if current close is near the high, bearish if near the low
  return {
    h100: maxHigh,
    h618: maxHigh - 0.382 * range,
    h50: maxHigh - 0.5 * range,
    h382: maxHigh - 0.618 * range,
    h236: maxHigh - 0.764 * range,
    h0: minLow,
  };
}

console.log("Supertrend result:", calculateSupertrend(highs, lows, closes, 7, 3));
console.log("VWAP result:", calculateVWAP(highs, lows, closes, volumes));
console.log("CMF result:", calculateCMF(highs, lows, closes, volumes, 10));
console.log("Fibonacci result:", calculateFibonacci(highs, lows, 10));
