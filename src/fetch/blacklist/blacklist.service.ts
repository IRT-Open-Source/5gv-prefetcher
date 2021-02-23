import { Injectable, Logger } from '@nestjs/common';

/**
 * Keeps a list of URLs of media items witch the prefetcher
 * shall not try to fetch. Currently the list is only kept in
 * main memory of the service.
 *
 * TODO: Consider persiting the blacklist, for example in  state DB
 */
@Injectable()
export class BlacklistService {
  private logger = new Logger(BlacklistService.name);
  private list: string[] = [];

  /**
   * Adds URL to blacklist
   * @param url
   */
  add(url: string) {
    this.list.push(url);
    this.logger.debug(`Added ${url}`);
  }

  /**
   * Returns all blacklisted URLs
   * @returns {string[]}
   */
  getList(): string[] {
    return this.list;
  }
}
