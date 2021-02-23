import { CacheStateUpdateDto } from './cache-state-update.dto';

describe('CacheStateUpdateDto', () => {
  it('should be defined', () => {
    expect(new CacheStateUpdateDto('url', 'url', 'url')).toBeDefined();
  });
});
