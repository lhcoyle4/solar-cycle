import { describe, it, expect } from 'vitest';
import { sunElevationDeg } from './index.js';

describe('sunElevationDeg', () => {
  it('is highest at noon', () => {
    const noon = sunElevationDeg(12);
    expect(noon).toBeCloseTo(80);
    expect(sunElevationDeg(9)).toBeLessThan(noon);
    expect(sunElevationDeg(15)).toBeLessThan(noon);
  });

  it('is lowest at midnight', () => {
    expect(sunElevationDeg(0)).toBeCloseTo(-30);
    expect(sunElevationDeg(24)).toBeCloseTo(-30);
  });

  it('is symmetric around noon', () => {
    expect(sunElevationDeg(9)).toBeCloseTo(sunElevationDeg(15));
    expect(sunElevationDeg(6)).toBeCloseTo(sunElevationDeg(18));
  });

  it('wraps hours outside 0-24', () => {
    expect(sunElevationDeg(12)).toBeCloseTo(sunElevationDeg(36));
  });
});
