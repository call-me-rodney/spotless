import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
