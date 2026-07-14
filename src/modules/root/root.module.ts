import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/services/prisma.module';
import { FashionstarsModule } from '../routes/fashionstars/fashionstars.module';
import { ClientesModule } from '../routes/clientes/clientes.module';
import { ListasModule } from '../routes/listas/listas.module';
import { MetaVendedorasModule } from '../routes/metaVendedoras/metaVendedoras.module';
import { UsuariosModule } from '../routes/usuarios/usuarios.module';
import { VendedorasModule } from '../routes/vendedoras/vendedoras.module';
import { CentralAuthModule } from '../routes/centralAuth/centralAuth.module';
import { FichaRiscoModule } from '../routes/ficha-risco/ficha-risco.module';
import { RootController } from './root.controller';

// Modulo raiz independente: agrega apenas os modulos funcionais.
// Nao importa a pasta app nem o auth.service legado.
@Module({
  imports: [
    PrismaModule,
    VendedorasModule,
    UsuariosModule,
    FashionstarsModule,
    MetaVendedorasModule,
    ListasModule,
    ClientesModule,
    CentralAuthModule,
    FichaRiscoModule,
  ],
  controllers: [RootController],
})
export class RootModule {}
