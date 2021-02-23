import { Request } from './request';
import { RetryRule } from './retry-rule';
import { Logger } from '@nestjs/common';
import { BlacklistService } from './blacklist/blacklist.service';

export class RequestMap {
  private readonly logger = new Logger(RequestMap.name);

  private map: Record<string, Request>;
  private resolved = 0;
  private failed = [];

  private readonly rules: RetryRule[];
  private readonly DEFAULT_LIMIT = 2;

  constructor(
    urls: string[],
    private blacklist: BlacklistService,
    rules?: RetryRule[],
  ) {
    // Only keep URLs which are not black listed
    urls = urls.filter(u => this.blacklist.getList().indexOf(u) < 0);
    this.map = urls.reduce((map, url) => {
      map[url] = new Request(url);
      return map;
    }, {});
    this.rules = rules || [];
  }

  get(url: string): Request {
    return (this.map.hasOwnProperty(url) && this.map[url]) || null;
  }

  getAllFailed(): Request[] {
    return this.failed;
  }

  getFailed(url: string): Request {
    return this.failed.find((request: Request) => request.url === url) || null;
  }

  getAll(): Request[] {
    return Object.keys(this.map).map(key => this.map[key]);
  }

  getUrls(): string[] {
    return Object.keys(this.map).map(key => this.map[key].url);
  }

  remove(url: string): boolean {
    if (this.map.hasOwnProperty(url)) {
      delete this.map[url];
      return true;
    } else {
      return false;
    }
  }

  resolve(url: string) {
    if (this.remove(url)) {
      this.resolved++;
    }
  }

  addResponse(url: string, response: number) {
    const request = this.get(url);
    request.addResponse(response);
  }

  hasItem(): boolean {
    return this.getAll().length > 0;
  }

  try(request: Request, send: (req: Request) => Promise<any>): Promise<any> {
    if (request !== null) {
      if (request.checkRetry(this.rules)) {
        return send(request);
      } else {
        this.remove(request.url);
        this.failed.push(request);
        if (request.checkBlackList(this.rules)) {
          this.logger.debug(`Black list ${request.url}`);
          this.blacklist.add(request.url);
        }
        return new Promise(res => res(null));
      }
    } else {
      return new Promise((res, rej) => rej('NULL is not a request'));
    }
  }

  getStats() {
    return {
      resolved: this.resolved,
      failed: this.failed,
    };
  }
}
