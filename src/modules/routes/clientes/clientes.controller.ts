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
    summary: 'Compra do cliente (liquido = vendas - trocas), somando vinculados (matriz). Aceita lote.',
    description:
      'Um cpf com granularidade "mes" (default) ou "dia" volta uma linha por periodo. ' +
      `Com granularidade "total" volta 1 item por cliente e aceita lote: cpfs[] (ate ${MAX_CPFS_LOTE}) ` +
      'ou vendedora sem cpf (todos os clientes de que ela e a dona) - uma chamada no lugar de uma por CPF. ' +
      'Cada cliente soma a matriz inteira (cadastros vinculados), igual a consulta por CPF: dois CPFs da ' +
      'mesma matriz repetem o mesmo valor_total, entao somar a resposta contaria em dobro. ' +
      'Cliente sem movimento no periodo tambem volta, com valor_total 0.',
  })
  @ApiOkResponse({
    description:
      'granularidade "mes"/"dia": mes (YYYY-MM) ou dia (YYYY-MM-DD), mes_ref/data_ref, valor_total, ' +
      'codigovend, vendedora_nome. granularidade "total": cpfcnpj (14 digitos), nome, telefone, ' +
      'vendedora_nome, codigovend, valor_total.',
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
