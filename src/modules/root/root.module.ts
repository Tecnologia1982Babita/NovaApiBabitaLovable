import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/services/prisma.module';
import { FashionstarsModule } from '../routes/fashionstars/fashionstars.module';
import { MetaVendedorasModule } from '../routes/metaVendedoras/metaVendedoras.module';
import { UsuariosModule } from '../routes/usuarios/usuarios.module';
import { VendedorasModule } from '../routes/vendedoras/vendedoras.module';
import { RootController } from './root.controller';

// Módulo raiz independente: agrega apenas os módulos funcionais.
// Não importa a pasta app nem o auth.service legado.
@Module({
  imports: [
    PrismaModule,
    VendedorasModule,
    UsuariosModule,
    FashionstarsModule,
    MetaVendedorasModule,
  ],
  controllers: [RootController],
})
export class RootModule {}
