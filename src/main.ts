import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Open to every origin, matching the analytics gateway. `credentials` is
  // deliberately left off: browsers reject `Allow-Credentials: true` alongside
  // a wildcard origin, and there are no cookies or auth headers to carry yet.
  // Restrict this to the dashboard's origin before any real deployment.
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Drop properties the DTO does not declare, so a client cannot set
      // columns the endpoint never meant to expose.
      whitelist: true,
      // Instantiate the DTO class before validating, which is what makes
      // PartialType and the nested decorators behave.
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
