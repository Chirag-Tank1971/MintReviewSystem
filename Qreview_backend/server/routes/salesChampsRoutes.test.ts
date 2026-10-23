import { describe, it, expect } from 'vitest';
import { cleanSlabs } from './salesChampsRoutes.js';

describe('cleanSlabs', () => {
  it('keeps only the four slab amounts, as numbers', () => {
    const { slabs, error } = cleanSlabs([
      { amcTargetLacs: '10', amcIncentiveLacs: 1.5, gm2AchievementLacs: 96, salesIncentiveLacs: '4.25', extra: 'x' },
    ]);
    expect(error).toBeUndefined();
    expect(slabs).toEqual([{ amcTargetLacs: 10, amcIncentiveLacs: 1.5, gm2AchievementLacs: 96, salesIncentiveLacs: 4.25 }]);
  });

  it('treats missing amounts as 0', () => {
    expect(cleanSlabs([{ gm2AchievementLacs: 50 }]).slabs?.[0]).toEqual({
      amcTargetLacs: 0, amcIncentiveLacs: 0, gm2AchievementLacs: 50, salesIncentiveLacs: 0,
    });
  });

  it('rejects an empty or non-array slab list', () => {
    expect(cleanSlabs([]).error).toBeTruthy();
    expect(cleanSlabs(undefined).error).toBeTruthy();
  });

  it('rejects negative or non-numeric amounts', () => {
    expect(cleanSlabs([{ salesIncentiveLacs: -1 }]).error).toMatch(/salesIncentiveLacs/);
    expect(cleanSlabs([{ amcTargetLacs: 'abc' }]).error).toMatch(/amcTargetLacs/);
  });
});
