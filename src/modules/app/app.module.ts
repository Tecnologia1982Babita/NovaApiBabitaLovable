import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from '../auth/constants/constants';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { PrismaModule } from 'src/services/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FashionstarsController } from '../routes/fashionstars/fashionstars.controller';
import { FashionstarsService } from '../routes/fashionstars/fashionstars.service';
import { VendedorasModule } from '../routes/vendedoras/vendedoras.module';
import { UsuariosModule } from '../routes/usuarios/usuarios.module';

@Module({
  imports: [
    //UserModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '6000s' },
    }),
    PrismaModule,
    VendedorasModule,
    UsuariosModule,
  ],
  controllers: [
    AuthController,
    AppController,
    FashionstarsController
  ],
  providers: [
    AuthService,
    AppService,
    FashionstarsService
  ],
})
export class AppModule {}
