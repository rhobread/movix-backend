import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*', // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow specific HTTP methods
    allowedHeaders: 'Content-Type, Accept', // Allow specific headers
  });
  await app.listen(process.env.PORT ?? 3005);
}
bootstrap();
