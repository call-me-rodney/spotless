import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS first: these are Express middlewares and they run in registration
  // order, so registering the static handler above this would let it answer an
  // image request before the CORS headers were ever attached.
  //
  // Open to every origin, matching the analytics gateway. `credentials` is
  // deliberately left off: browsers reject `Allow-Credentials: true` alongside
  // a wildcard origin, and there are no cookies or auth headers to carry yet.
  // Restrict this to the dashboard's origin before any real deployment.
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });

  // Serve uploaded case photos. `imagePath` on a case is stored relative to the
  // project root ("uploads/cases/<uuid>.png"), so prefixing it with the origin
  // gives a working URL: http://host/uploads/cases/<uuid>.png
  //
  // process.cwd() rather than __dirname, to match where multer writes them in
  // case.controller.ts — __dirname would be dist/ and needs a ".." to climb out.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

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
