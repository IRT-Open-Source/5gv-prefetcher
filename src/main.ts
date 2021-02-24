import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport } from '@nestjs/common/enums/transport.enum';
import { Logger } from '@nestjs/common';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.NATS,
    options: {
      url: 'nats://5gv-message-broker:4222',
    },
  });
  app.listen(() => {
    logger.log('Listening');
  });
}
bootstrap();
