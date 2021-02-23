import { Module, HttpModule } from '@nestjs/common';
import { FetchService } from './fetch/fetch.service';
import { MessengerService } from './messenger/messenger.service';
import { BlacklistService } from './fetch/blacklist/blacklist.service';

@Module({
  imports: [HttpModule],
  providers: [FetchService, MessengerService, BlacklistService],
})
export class AppModule {}
