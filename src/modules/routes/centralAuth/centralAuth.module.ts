import { Module } from '@nestjs/common';
import { CentralAuthController } from './centralAuth.controller';
import { CentralAuthService } from './centralAuth.service';

@Module({
  controllers: [CentralAuthController],
  providers: [CentralAuthService],
})
export class CentralAuthModule {}
