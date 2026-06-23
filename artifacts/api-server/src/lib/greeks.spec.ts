import { describe, it, expect } from 'vitest';
import { calculateGreeks } from './greeks';

describe('calculateGreeks', () => {
  it('should calculate call (CE) greeks correctly', () => {
    // Spot: 100, Strike: 100, 30 days to expiry, 20% IV
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    const result = calculateGreeks(100, 100, expiryDate.toISOString(), 20, "CE");
    
    expect(result.delta).toBeGreaterThan(0.4);
    expect(result.delta).toBeLessThan(0.7);
    expect(result.gamma).toBeGreaterThan(0);
    expect(result.vega).toBeGreaterThan(0);
    expect(result.theta).toBeLessThan(0);
  });

  it('should calculate put (PE) greeks correctly', () => {
    // Spot: 100, Strike: 100, 30 days to expiry, 20% IV
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    const result = calculateGreeks(100, 100, expiryDate.toISOString(), 20, "PE");
    
    // Put delta is negative
    expect(result.delta).toBeLessThan(0);
    expect(result.delta).toBeGreaterThan(-0.6);
    expect(result.gamma).toBeGreaterThan(0);
    expect(result.vega).toBeGreaterThan(0);
    expect(result.theta).toBeLessThan(0);
  });

  it('should handle expired options (T <= 0)', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    
    const result = calculateGreeks(100, 100, pastDate.toISOString(), 20, "CE");
    
    expect(result.delta).toBe(0);
    expect(result.gamma).toBe(0);
    expect(result.theta).toBe(0);
    expect(result.vega).toBe(0);
  });

  it('should fallback to default IV when 0 is passed', () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    const resultWithZero = calculateGreeks(100, 100, expiryDate.toISOString(), 0, "CE");
    const resultWithFallback = calculateGreeks(100, 100, expiryDate.toISOString(), 15, "CE");
    
    expect(resultWithZero.delta).toBeCloseTo(resultWithFallback.delta, 5);
  });
});
