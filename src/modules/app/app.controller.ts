import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateSetupDto } from './dto/createSetupDto.dto';
import { Public } from "../auth/constants/constants";
 
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('/initial-setup')
  async setupInicial(@Body() body: CreateSetupDto) {
    return this.appService.setupInicial(body);
  }
}
