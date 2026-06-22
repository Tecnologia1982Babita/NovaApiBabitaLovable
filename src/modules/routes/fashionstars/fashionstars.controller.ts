import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FashionstarsService } from './fashionstars.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IUsuario } from '../../global/usuario.entity';
import { FindClienteDto } from './dto/findcliente.dto';

@ApiTags('fashionstars')
@Controller('fashionstars')
export class FashionstarsController {
  constructor(private readonly fashionstarsService: FashionstarsService) {}

  @Get()
  findAll() {
    return this.fashionstarsService.findAll();
  }

  @Get(':cpfcnpj')
  findOne(@Param() params: FindClienteDto) {
    return this.fashionstarsService.findOne(params.cpfcnpj);
  }
}
