export function calculateGreeks(
  spot: number,
  strike: number,
  expiryDateStr: string,
  ivPct: number,
  type: "CE" | "PE"
) {
  const expiry = new Date(expiryDateStr);
  const now = new Date();
  
  // Time to expiry in years
  let T = (expiry.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000);
  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const r = 0.10; // Standard 10% risk-free rate for Indian market
  const sigma = ivPct > 0 ? ivPct / 100 : 0.15; // Fallback to 15% IV if zero

  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  // Error function approximation
  const ncdf = (x: number) => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1 / (1 + p * absX);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1 + sign * y);
  };

  // Probability density function of standard normal distribution
  const pdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

  const nd1 = pdf(d1);
  const N_d1 = ncdf(d1);
  const N_d2 = ncdf(d2);

  let delta = 0;
  const gamma = nd1 / (spot * sigma * Math.sqrt(T));
  const vega = (spot * Math.sqrt(T) * nd1) / 100; // Divide by 100 for 1% IV change
  let theta = 0;

  if (type === "CE") {
    delta = N_d1;
    theta = (-(spot * nd1 * sigma) / (2 * Math.sqrt(T)) - r * strike * Math.exp(-r * T) * N_d2) / 365;
  } else {
    delta = N_d1 - 1;
    theta = (-(spot * nd1 * sigma) / (2 * Math.sqrt(T)) + r * strike * Math.exp(-r * T) * ncdf(-d2)) / 365;
  }

  return {
    delta: isNaN(delta) ? 0 : delta,
    gamma: isNaN(gamma) ? 0 : gamma,
    theta: isNaN(theta) ? 0 : theta,
    vega: isNaN(vega) ? 0 : vega,
  };
}
