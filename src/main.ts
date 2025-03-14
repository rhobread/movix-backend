import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as passport from 'passport';
import { config } from 'dotenv';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true, // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow specific HTTP methods
    allowedHeaders: 'Content-Type, Accept', // Allow specific headers
    credentials: true
  });
  
  // Set up sessions. In production, use a more secure store!
  app.use(
    session({
      secret: 'your-session-secret', // Replace with a secure secret
      resave: false,
      saveUninitialized: false,
    }),
  );

  // Initialize Passport and use sessions
  app.use(passport.initialize());
  app.use(passport.session());
  await app.listen(process.env.PORT ?? 3005);
}
bootstrap();
