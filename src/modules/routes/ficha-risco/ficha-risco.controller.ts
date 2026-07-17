import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FichaRiscoQueryDto } from './dto/ficha-risco-query.dto';
import { FichaRiscoService } from './ficha-risco.service';

@ApiTags('FichaRisco')
@Controller('ficha-risco')
export class FichaRiscoController {
  constructor(private readonly service: FichaRiscoService) {}

  @Get('calculo')
  @ApiOperation({
    summary:
      'Clientes em risco de perder ficha (compra liquida < R$3.200 nos 2 meses-calendario fechados anteriores a mesReferencia), calculado ao vivo em view_base_12meses. Sem mesReferencia, usa o mes corrente. Funciona pra qualquer mes passado (ex.: mesReferencia=2026-03) sem depender de snapshot previo.',
  })
  @ApiOkResponse({
    description:
      'mesReferencia, totalClientes, atingiram, valorNecessarioTotal, valorRealizadoTotal, porVendedora[], porLoja[], clientes[].',
  })
  calculo(@Query() query: FichaRiscoQueryDto) {
    return this.service.calcular(query);
  }
}
