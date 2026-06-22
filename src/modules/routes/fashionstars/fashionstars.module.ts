import { Module } from '@nestjs/common';
import { FashionstarsService } from './fashionstars.service';
import { FashionstarsController } from './fashionstars.controller';
import { PrismaModule } from 'src/services/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FashionstarsController],
  providers: [FashionstarsService],
  exports: [FashionstarsService],
})
export class FashionstarsModule {}
