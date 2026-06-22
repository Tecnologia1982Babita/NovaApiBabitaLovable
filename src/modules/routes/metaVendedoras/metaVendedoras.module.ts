import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/services/prisma.module';
import { MetaVendedorasController } from './metaVendedoras.controller';
import { MetaVendedorasService } from './metaVendedoras.service';

@Module({
  imports: [PrismaModule],
  controllers: [MetaVendedorasController],
  providers: [MetaVendedorasService],
  exports: [MetaVendedorasService],
})
export class MetaVendedorasModule {}
