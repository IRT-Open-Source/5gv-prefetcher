import { Injectable, Logger } from '@nestjs/common';
import STAN = require('node-nats-streaming');
import { Subject, Subscription, BehaviorSubject } from 'rxjs';
import { CacheStateUpdateDto } from '../dto/cache-state-update.dto';

import { Messenger } from 'messenger';

@Injectable()
export class MessengerService {
  private messenger: Messenger;
  onConnectionChange = new BehaviorSubject<number>(Messenger.DISCONNECTED);
  connectState = {
    CONNECTED: Messenger.CONNECTED,
    DISCONNECTED: Messenger.DISCONNECTED,
  };
  NEW_AGGREGATOR_CONFIG = 'new-aggregator-config';
  NEW_CACHE_STATE = 'new-cache-state';

  constructor() {
    this.messenger = Messenger.getInstance('prefetcher');
    this.messenger.onConnectionChange.subscribe(state =>
      this.onConnectionChange.next(state),
    );
  }
  subscribe(ch: string) {
    return this.messenger.subscribe(ch);
  }
  disconnect() {
    // TODO: Disconnect messenger
  }
}
