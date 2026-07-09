import { NestFactory } from '@nestjs/core';
import { RootModule } from './modules/root/root.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import {DocumentBuilder, SwaggerModule} from "@nestjs/swagger";
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await createApp();
  configureApp(app);
  setupSwagger(app);
  await startServer(app);
}

async function createApp() {  
  return await NestFactory.create(RootModule);
}

function configureApp(app : any) {
  app.use(cookieParser());
  app.enableCors();
  configureMiddleware(app);
  configureValidation(app);
}

function configureMiddleware(app: any): void {
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
}

function configureValidation(app: any): void {
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
}

function setupSwagger(app: any) {
  if (process.env.AMBIENTE === 'DESENVOLVIMENTO') {
    const config = createSwaggerConfig();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('doc', app, document, {
      swaggerOptions: {
        displaySchemas: false,
      },
    });
  }
}

function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Documentação Think! Babita')
    .setDescription('Documentação de referência para o sistema Think! Babita')
    .setVersion('1.0.0.dev')
    .addBearerAuth({
      type: 'http',
      scheme: 'Bearer',
      bearerFormat: 'JWT',
    })
    .addTag('Aplicação')
    .addTag('Vendedoras')
    .addTag('Usuários')
    .addTag('Autênticação')
    .addTag('Integração')
    .addTag('Usuário')
    .addTag('Chamados')
    .addTag('Tipos de Chamados')
    .addTag('')
    .addTag('Listas', 'Listas de revendedoras. Oculta clientes com situacao 6/8/9/95 (erp_clientes_real.clientes_id_situacao); telefone = celular (clientes_telefone2) com fallback pro fixo (clientes_telefone1).')
    .addTag('Clientes', 'Consultas de clientes. Oculta clientes com situacao 6/8/9/95; telefone = celular (clientes_telefone2).')
    .addTag('fashionstars', 'Revendedoras na Liga Fashion Stars. Oculta clientes com situacao 6/8/9/95; telefone = celular (clientes_telefone2).')
    .build();
}

async function startServer(app: any) {
  const logger = new Logger('Sitema Think! Babita:');
  await app.listen(process.env.PORT, async () => {
    logger.verbose(`[BACK-END] EM [ http://localhost:${process.env.PORT} ]`);
    logger.verbose(
      `[DOCUMENTAÇAO DO BACKEND - ${process.env.AMBIENTE}] -> [ http://localhost:${process.env.PORT}/doc ]`,
    );
  });
}

bootstrap();
