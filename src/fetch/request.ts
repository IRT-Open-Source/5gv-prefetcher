import { RetryRule } from './retry-rule';
import { Logger } from '@nestjs/common';

export class Request {
  private readonly logger = new Logger(Request.name);

  url: string;
  id: number;
  lastSend: number; // time in milliseconds
  responses: Record<string, number>;

  constructor(url: string) {
    this.url = url;
    this.responses = {};
  }

  addResponse(status: number) {
    const key = status.toString(10);
    if (!this.responses.hasOwnProperty(key)) {
      this.responses[key] = 0;
    }
    this.responses[key]++;
  }

  checkRetry(rules: RetryRule[]): boolean {
    let res = true;
    Object.keys(this.responses).forEach(status => {
      const rule = rules.find(r => r.status.toString(10) === status);
      if (
        this.responses[status] >=
        ((rule && rule.limit) || RetryRule.DEFAULT_LIMIT)
      ) {
        res = false;
      }
    });
    return res;
  }

  checkBlackList(rules: RetryRule[]): boolean {
    let res = false;
    const blackListCriticalRules = rules.filter(r => r.blacklist);
    // For those status codes which are critical for blacklisting of requests
    // --> check if nuber of responses with this status code exceeds limit
    Object.keys(this.responses).forEach(status => {
      const rule = blackListCriticalRules.find(
        r => r.status.toString(10) === status,
      );
      if (rule && this.responses[status] >= rule.limit) {
        res = true;
      }
    });
    return res;
  }
}
