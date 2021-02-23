import { StreamInfoDto } from './stream-info.dto';

export class CacheItemDto {
  publicationId: string;
  url: string;
  available: boolean;

  constructor(url: string, streamInfo: StreamInfoDto) {
    this.url = url;
    this.publicationId = streamInfo.id;
    this.available = false;
  }
}
