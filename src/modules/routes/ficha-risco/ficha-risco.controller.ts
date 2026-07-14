import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HistoricoQueryDto, MesReferenciaDto } from './dto/ficha-risco-query.dto';
import { FichaRiscoService } from './ficha-risco.service';

@ApiTags('FichaRisco')
@Controller('ficha-risco')
export class FichaRiscoController {
  constructor(private readonly service: FichaRiscoService) {}

  @Post('snapshot')
  @HttpCode(200)
  @ApiOperation({ summary: 'Dispara o snapshot de inicio de mes (clientes em risco + valor_necessario). Idempotente: se ja existir pra esse mes, so retorna o que ja esta gravado.' })
  @ApiOkResponse({ description: 'mesReferencia, jaExistia, totalClientes, clientes[].' })
  snapshot(@Query() query: MesReferenciaDto) {
    return this.service.snapshot(query.mesReferencia);
  }

  @Post('fechamento')
  @HttpCode(200)
  @ApiOperation({ summary: 'Fecha o mes (grava valor_realizado, atingiu, vendedora/loja de fechamento). Sem mesReferencia, fecha o snapshot aberto mais antigo.' })
  @ApiOkResponse({ description: 'mesReferencia, jaFechado, totalClientes.' })
  fechamento(@Query() query: MesReferenciaDto) {
    return this.service.fechamento(query.mesReferencia);
  }

  @Get('atual')
  @ApiOperation({ summary: 'Snapshot do mes corrente ja persistido (nao calcula ao vivo). Lista + agregacoes por vendedora e por loja.' })
  @ApiOkResponse({ description: 'totalClientes, atingiram, valorNecessarioTotal, valorRealizadoTotal, porVendedora[], porLoja[], clientes[].' })
  atual() {
    return this.service.atual();
  }

  @Get('historico')
  @ApiOperation({ summary: 'Historico persistido, com filtros opcionais por mesReferencia, vendedora ou loja. Lista + agregacoes por vendedora e por loja.' })
  @ApiOkResponse({ description: 'totalClientes, atingiram, valorNecessarioTotal, valorRealizadoTotal, porVendedora[], porLoja[], clientes[].' })
  historico(@Query() query: HistoricoQueryDto) {
    return this.service.historico(query);
  }
}
