import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/services/prisma.module';
import { ListasController } from './listas.controller';
import { ListasService } from './listas.service';

@Module({
  imports: [PrismaModule],
  controllers: [ListasController],
  providers: [ListasService],
  exports: [ListasService],
})
export class ListasModule {}
