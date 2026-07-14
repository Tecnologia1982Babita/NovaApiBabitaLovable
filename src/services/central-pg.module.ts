import { Module } from '@nestjs/common';
import { CentralPgService } from './central-pg.service';

@Module({
  providers: [CentralPgService],
  exports: [CentralPgService],
})
export class CentralPgModule {}
