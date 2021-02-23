export class CacheStateUpdateDto {
  readonly missing: string;
  readonly available: string;
  readonly referenceConf: string;

  constructor(available: string, missing: string, referenceConf: string) {
    this.available = available;
    this.missing = missing;
    this.referenceConf = referenceConf;
  }
}
