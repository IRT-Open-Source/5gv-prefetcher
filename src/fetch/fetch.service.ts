import {
  Injectable,
  HttpService,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import * as writeJsonFile from 'write-json-file';
import { Promise } from 'bluebird';
import { RequestMap } from './request-map';
import { Request } from './request';
import { RetryRule } from './retry-rule';
import * as axios from 'axios';

import computeStatistic = require('../../stats');
import util = require('util');
import { MessengerService } from '../messenger/messenger.service';
import { CacheItemDto } from '../dto/cache-item.dto';
import { Paginator } from './paginator';

import * as URL from 'url';
import { BlacklistService } from './blacklist/blacklist.service';

@Injectable()
export class FetchService implements OnModuleDestroy {
  private readonly logger = new Logger(FetchService.name);

  private readonly CACHE_DEFAULT_PROTOCOL = 'http';
  private readonly CACHE_HOSTNAME = 'cache.cache:8080';
  private readonly CACHE_UPSTREAM_LOCATION_PARAM = 'dest';
  private readonly MAX_PAGE_SIZE = 128;
  private readonly MAX_CONCURRENT_REQUESTS = 128;

  private stats = [];
  private reqCount = 0;
  private requests: RequestMap;
  private aggregatorConfigSub: any;
  private newCacheState: any;
  private cacheItemsPaginator: Paginator;
  private cancelTokenMap: Record<string, axios.CancelTokenSource> = {};

  constructor(
    private readonly http: HttpService,
    private messenger: MessengerService,
    private blacklist: BlacklistService,
  ) {
    this.setupSystemEventSubscriptions();
  }

  setupSystemEventSubscriptions() {
    this.messenger.onConnectionChange.subscribe(state => {
      if (state === this.messenger.connectState.CONNECTED) {
        this.logger.debug(
          `Set listener: ${this.messenger.NEW_AGGREGATOR_CONFIG}`,
        );
        this.aggregatorConfigSub = this.messenger.subscribe(
          this.messenger.NEW_AGGREGATOR_CONFIG,
        );
        this.aggregatorConfigSub.on('message', message =>
          this.handleNewAggregatorConfig(message),
        );
        this.logger.debug(`Set listener: ${this.messenger.NEW_CACHE_STATE}`);
        this.newCacheState = this.messenger.subscribe(
          this.messenger.NEW_CACHE_STATE,
        );
        this.newCacheState.on('message', message =>
          this.handleNewCacheState(message),
        );
      }
    });
  }

  onModuleDestroy() {
    this.aggregatorConfigSub.unsubscribe();
    this.messenger.disconnect();
  }

  handleNewAggregatorConfig(message: any) {
    this.logger.debug(
      `'${
        this.messenger.NEW_AGGREGATOR_CONFIG
      }': [${message.getSequence()}]: ${message.getData()}`,
    );
    this.cancelPendingRequests();
  }

  handleNewCacheState(message) {
    const data = JSON.parse(message.getData()) as {
      base: string;
      mediaItems: { all: string; one: string };
      streams: {
        all: string;
        one: string;
        missing: {
          all: string;
          mediaItem: string;
        };
        available: {
          all: string;
          mediaItem: string;
        };
      };
    };
    this.logger.debug(
      `'${
        this.messenger.NEW_CACHE_STATE
      }': [${message.getSequence()}]: ${message.getData()}`,
    );

    this.cacheItemsPaginator = new Paginator(
      data.base + data.streams.missing.all,
      this.MAX_PAGE_SIZE,
    );

    this.fetch();
  }

  async fetch(fetchConfig?: CacheItemDto[]) {
    this.stats = [];
    this.reqCount = 0;

    try {
      if (typeof fetchConfig === 'undefined') {
        fetchConfig = await this.cacheItemsPaginator.getNextPage(url =>
          this.getFetchConfig(url),
        );
      } else if (fetchConfig.length < this.MAX_CONCURRENT_REQUESTS) {
        fetchConfig = fetchConfig.concat(
          ...(await this.cacheItemsPaginator.getNextPage(url =>
            this.getFetchConfig(url),
          )),
        );
      }

      this.logger.log('Handling #config_items:' + fetchConfig.length);

      this.requests = new RequestMap(
        fetchConfig.map(configItem => this.toCacheLink(configItem.url)),
        this.blacklist,
        [new RetryRule(404, 1, true), new RetryRule(418, 1)],
      );

      this.logger.log(
        `Prepared #request-tasks: ${this.requests.getAll().length}`,
      );

      while (this.requests.hasItem()) {
        this.logger.log('Enter fetch cycle');
        await Promise.map(
          this.requests.getAll(),
          request => this.requests.try(request, req => this.queryCache(req)),
          {
            concurrency: this.MAX_CONCURRENT_REQUESTS,
          },
        );

        writeJsonFile.sync('log/log.json', this.stats, {
          indent: 2,
        });

        this.logger.log(util.inspect(computeStatistic(), false, null, true));

        writeJsonFile.sync('log/request_stats.json', this.requests.getStats(), {
          indent: 2,
        });
      }

      fetchConfig = await this.checkRetry();
      if (fetchConfig.length > 0) {
        this.logger.debug('Retry (fetchConfig.length > 0)');
        this.fetch(fetchConfig);
      } else if (this.cacheItemsPaginator.hasNext) {
        this.logger.debug(
          'Got to next page (this.cacheItemsPaginator.hasNext)',
        );
        this.fetch();
      } else if (
        (await this.cacheItemsPaginator.getTotalDocs(url =>
          this.getFetchConfig(url),
        )) > 0
      ) {
        this.logger.debug('Go to first page (totalDocs > 0)');
        this.cacheItemsPaginator.reset();
        this.fetch();
      } else {
        this.logger.debug('Done');
      }
    } catch (error) {
      if (axios.default.isCancel(error)) {
        this.logger.debug('--- CANCELED PENDING REQUESTS ---');
      } else {
        this.logger.error((error && error.message) || 'unknown');
      }
    }
  }

  private async checkRetry() {
    const missing = await this.cacheItemsPaginator.getCurrentPage(url =>
      this.getFetchConfig(url),
    );
    if (this.requests.getAllFailed().length === 0) {
      return [];
    } else {
      const missingButNeverNotFound = missing.filter(cacheItem => {
        const request = this.requests.getFailed(
          this.toCacheLink(cacheItem.url),
        );
        return request !== null && !request.responses.hasOwnProperty('404');
      });
      this.logger.log(
        `# Missing but never NOT found: ${missingButNeverNotFound.length}`,
      );
      return missingButNeverNotFound;
    }
  }

  private cancelPendingRequests() {
    if (typeof this.cancelTokenMap === 'object') {
      const keys = Object.keys(this.cancelTokenMap);
      if (keys.length > 0) {
        keys.map(key => this.cancelTokenMap[key].cancel());
        this.logger.log(`Canceling ${keys.length} pending requests`);
      } else {
        this.logger.log('No pending requests');
      }
    } else {
      this.logger.log('No pending requests');
    }
  }

  private createCancelToken(): {
    key: string;
    source: axios.CancelTokenSource;
  } {
    const source = axios.default.CancelToken.source();
    const key = Date.now().toString() + Math.round(Math.random() * 1000);
    this.cancelTokenMap[key] = source;
    return { key, source };
  }

  private deleteCancelToken(cToken: {
    key: string;
    source: axios.CancelTokenSource;
  }) {
    delete this.cancelTokenMap[cToken.key];
  }

  private async getFetchConfig(configUrl: string): Promise<CacheItemDto[]> {
    const cToken = this.createCancelToken();
    return await axios.default
      .get(configUrl, { cancelToken: cToken.source.token })
      .then(response => response.data)
      .finally(() => this.deleteCancelToken(cToken));
  }

  private queryCache(req: Request): Promise<any> {
    // this.logger.verbose('GET: ' + req.url);

    try {
      const cToken = this.createCancelToken();
      req.id = this.reqCount++;
      req.lastSend = Date.now();

      if (req.id % 100 === 0) {
        this.logger.log('Sent #requests: ' + req.id);
      }

      return axios.default
        .head(req.url, { cancelToken: cToken.source.token })
        .then(res => {
          this.stats.push({
            status: res.status.toString(10), // OK
            cache_status: res.headers['x-cache-status'] || null,
            url: req.url,
            id: req.id,
            responseDelay: Date.now() - req.lastSend,
          });

          this.requests.addResponse(req.url, res.status);
          this.requests.resolve(req.url);
        })
        .catch(error => {
          let statusCode = '418';

          if (axios.default.isCancel(error)) {
            throw error;
          }

          if (error && error.message) {
            const code = error.message.match(/[0-9]{3}/);
            if (code) {
              statusCode = code[0];
            }
          }

          this.stats.push({
            status: statusCode, // ERROR
            msg: (error && error.message) || null,
            url: req.url,
            id: req.id,
            responseDelay: Date.now() - req.lastSend,
          });

          this.requests.addResponse(req.url, parseInt(statusCode, 10));
        })
        .finally(() => this.deleteCancelToken(cToken));
    } catch (error) {
      if (axios.default.isCancel(error)) {
        throw error;
      }

      this.stats.push({
        status: 666, // ERROR
        id: req.id,
        url: req.url,
        msg: error,
      });
      this.logger.error(error);

      this.requests.addResponse(req.url, 666);
    }
  }

  private toCacheLink(location: string) {
    try {
      //   return (
      //     this.CACHE_DEFAULT_PROTOCOL +
      //     '://' +
      //     this.CACHE_HOSTNAME +
      //     '?' +
      //     this.CACHE_UPSTREAM_LOCATION_PARAM +
      //     '=' +
      //     this.rectifyUrl(location)
      //   );
      const u = URL.parse(location);
      const res =
        this.CACHE_DEFAULT_PROTOCOL +
        '://' +
        u.hostname +
        '.' +
        this.CACHE_HOSTNAME +
        u.path;
      //   this.logger.verbose(`IN: ${location}`);
      //   this.logger.verbose(`OUT: ${res}`);
      // Check path equality
      if (
        location
          .split('/')
          .slice(2)
          .join('') ===
        res
          .split('/')
          .slice(2)
          .join('')
      ) {
        this.logger.warn(`${location} !== ${res}`);
      }

      return res;
    } catch (error) {
      this.logger.error(`toCacheLink url: ${location} failed: ${error}`);
    }
  }

  private rectifyUrl(location: string): string {
    // Always use CACHE_DEFAULT_PROTOCOL
    // (even if protocol in URL is HTTPS or URL is protocol relative)
    return location.replace(
      /(^[a-z]+:)?\/\//,
      this.CACHE_DEFAULT_PROTOCOL + '://',
    );
  }
}
