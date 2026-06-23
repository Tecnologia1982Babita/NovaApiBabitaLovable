import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClienteComprasDto } from './dto/cliente-compras.dto';
import { ClientesService } from './clientes.service';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post('compras-mes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Compra por mes do cliente (liquido = vendas - trocas), somando vinculados (matriz).' })
  @ApiOkResponse({ description: 'Lista por mes: mes (YYYY-MM), mes_ref, valor_total.' })
  comprasMes(@Body() body: ClienteComprasDto) {
    return this.service.comprasPorMes(body);
  }
}
