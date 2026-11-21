import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { setupSwagger } from './common/swagger/swagger.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  // 요청 검증·응답 형식·예외 처리는 CommonModule(src/common)이 전역으로 등록한다.

  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server: http://localhost:${port}/api`);
  console.log(`Swagger: http://localhost:${port}/docs`);
}
await bootstrap();
