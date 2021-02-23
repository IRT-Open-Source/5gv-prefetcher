export class RetryRule {
  static readonly DEFAULT_LIMIT = 2;

  readonly status: number;
  readonly limit: number;
  readonly blacklist: boolean;

  constructor(status: number, limit: number, blacklist?: boolean) {
    this.status = status;
    this.limit = limit;
    this.blacklist = blacklist || false;
  }
}
