import { Logger } from '@nestjs/common';
import { threadId } from 'worker_threads';

export class Paginator {
  currentPage: number;
  limit: number;
  baseUrl: string;
  hasNext: boolean;
  logger = new Logger(Paginator.name);
  constructor(pageBaseUrl: string, pageLimit: number) {
    this.currentPage = 0;
    this.limit = pageLimit;
    this.baseUrl = pageBaseUrl;
  }
  async getNextPage(get) {
    ++this.currentPage;
    return this.getCurrentPage(get);
  }
  async getCurrentPage(get) {
    const res = await this.getPage(get, this.currentPage);
    this.hasNext = res.hasNextPage;
    return res.docs;
  }
  async getTotalDocs(get) {
    return (await this.getPage(get, 1)).totalDocs;
  }
  reset() {
    this.currentPage = 0;
  }
  private async getPage(get, page: number) {
    const res = await get(this.buildPageUrl(page));
    this.logger.debug(`Get page ${page}/${res.totalPages}`);
    return res;
  }
  private buildPageUrl(page: number) {
    return `${this.baseUrl}?page=${page}&limit=${this.limit}`;
  }
}
