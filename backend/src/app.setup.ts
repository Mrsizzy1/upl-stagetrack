/**
 * Configuration HTTP commune à l'application réelle et aux tests d'intégration,
 * pour que les tests exercent exactement la même chaîne (préfixe, validation, erreurs, sécurité).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // En production, l'API n'est joignable que par Nginx, qui écrase X-Forwarded-For : on lui fait confiance
  // pour connaître l'adresse réelle (limitation des tentatives, journal). Ailleurs, l'API peut être
  // appelée directement : l'en-tête, falsifiable, est ignoré.
  if (config.get('NODE_ENV') === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.getOrThrow<string[]>('CORS_ORIGINS'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('UPL StageTrack API')
        .setDescription("Gestion des présences des stagiaires de l'Université Protestante de Lubumbashi")
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
}
