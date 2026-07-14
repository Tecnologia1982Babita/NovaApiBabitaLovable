import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/services/prisma.module';
import { CentralPgModule } from 'src/services/central-pg.module';
import { FichaRiscoController } from './ficha-risco.controller';
import { FichaRiscoService } from './ficha-risco.service';

@Module({
  imports: [PrismaModule, CentralPgModule],
  controllers: [FichaRiscoController],
  providers: [FichaRiscoService],
})
export class FichaRiscoModule {}
