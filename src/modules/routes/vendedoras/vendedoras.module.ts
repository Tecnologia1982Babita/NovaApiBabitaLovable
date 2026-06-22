import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/services/prisma.module';
import { VendedorasController } from './vendedoras.controller';
import { VendedorasService } from './vendedoras.service';

@Module({
  imports: [PrismaModule],
  controllers: [VendedorasController],
  providers: [VendedorasService],
  exports: [VendedorasService],
})
export class VendedorasModule {}
