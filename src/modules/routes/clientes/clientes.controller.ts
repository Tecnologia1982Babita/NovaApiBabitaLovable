import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClienteComprasDto, MAX_CPFS_LOTE } from './dto/cliente-compras.dto';
import { ClientesService } from './clientes.service';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post('compras-mes')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Compra do cliente (liquido = vendas - trocas). Por periodo (1 cpf) ou em lote consolidado por matriz.',
    description:
      'Um cpf com granularidade "mes" (default) ou "dia" volta uma linha por periodo. ' +
      `Com granularidade "total" volta 1 item por MATRIZ - os parceiros vinculados ja entram consolidados ` +
      `numa linha so - e aceita lote: cpfs[] (ate ${MAX_CPFS_LOTE}) ou vendedora sem cpf (todos os clientes ` +
      'de que ela e a dona), uma chamada no lugar de uma por CPF. CPFs da mesma matriz colapsam: ' +
      'o valor nao se repete e somar a resposta nao conta em dobro. ' +
      'Matriz sem movimento no periodo tambem volta, com valor_total 0. ' +
      'codparc = erp_clientes_real.clientes_id (mesmo de /clientes/ativos; cliente vindo do Sankhya ' +
      'tem clientes_id = CODPARC + 1.000.000.000, o legado do ERP fica abaixo disso).',
  })
  @ApiOkResponse({
    description:
      'Identidade nos dois formatos: codparc, cpfcnpj_matriz, codparc_matriz (null quando o parceiro e a ' +
      'propria matriz) e is_matriz. granularidade "mes"/"dia" acrescenta mes (YYYY-MM) ou dia (YYYY-MM-DD), ' +
      'mes_ref/data_ref, valor_total, codigovend, vendedora_nome - a identidade e a do cpf consultado. ' +
      'granularidade "total" acrescenta cpfcnpj, nome, telefone, vendedora_nome, codigovend, valor_total - ' +
      'a linha E a matriz, entao cpfcnpj = cpfcnpj_matriz, is_matriz = true e codparc_matriz = null.',
  })
  comprasMes(@Body() body: ClienteComprasDto) {
    return this.service.comprasPorMes(body);
  }

  @Get('ativos')
  @ApiOperation({ summary: 'Clientes ativos: compras liquidas >= R$1 nos ultimos 6 meses-calendario fechados (mes corrente excluido). Oculta clientes situacao 6/8/9/95. Telefone = celular (clientes_telefone2), fallback fixo.' })
  @ApiOkResponse({ description: 'codparc, nome, cpfcnpj, telefone, situacao, vendedora.' })
  ativos() {
    return this.service.listarAtivos();
  }
}
