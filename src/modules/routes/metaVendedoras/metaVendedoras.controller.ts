import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LigaQueryDto } from './dto/liga-query.dto';
import { MetaVendedorasService } from './metaVendedoras.service';

@ApiTags('Meta Vendedoras')
@Controller('meta-vendedoras')
export class MetaVendedorasController {
  constructor(private readonly service: MetaVendedorasService) {}

  @ApiOperation({
    summary: 'Total de venda para revendedoras da Liga, por vendedora',
    description:
      'Soma as vendas (erp_ipedidos) feitas a revendedoras da Liga (fashionstars), agrupadas por ' +
      'vendedora (erp_pedidos.codigovend → erp_vendedores). Retorna também o total restrito às ' +
      'revendedoras que entraram na Liga a partir da data de corte (entradaNovasDesde, default 2026-06-01). ' +
      'Sem dataIni/dataFim, usa o mês corrente.',
  })
  @ApiOkResponse({
    description:
      '{ metaGlobal, valorAtualCompra (liquido), atingiu, faltaParaMeta, vendedoras[] }. totalVendaLiga = liquido (vendas totalgeral - trocas).',
  })
  @Get('liga')
  liga(@Query() query: LigaQueryDto) {
    return this.service.totalVendaLigaPorVendedora(query);
  }
}
