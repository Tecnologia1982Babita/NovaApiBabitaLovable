import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FashionstarsService } from './fashionstars.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IUsuario } from '../../global/usuario.entity';
import { FindClienteDto } from './dto/findcliente.dto';

@ApiTags('fashionstars')
@Controller('fashionstars')
export class FashionstarsController {
  constructor(private readonly fashionstarsService: FashionstarsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista revendedoras ativas na Liga (roster vivo): nome, cpfcnpj, telefone (celular), plano. Oculta clientes situacao 6/8/9/95.' })
  findAll() {
    return this.fashionstarsService.findAll();
  }

  @Get(':cpfcnpj')
  @ApiOperation({ summary: 'Consulta revendedora por CPF/CNPJ na Liga: nome, cpfcnpj, telefone (celular), status. Oculta clientes situacao 6/8/9/95.' })
  findOne(@Param() params: FindClienteDto) {
    return this.fashionstarsService.findOne(params.cpfcnpj);
  }
}
