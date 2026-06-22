import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FiltroListaDto, SuperOfensivaFiltroDto } from './dto/listas-filtro.dto';
import { ListasService } from './listas.service';

@ApiTags('Listas')
@Controller('listas')
export class ListasController {
  constructor(private readonly service: ListasService) {}

  @Post('corrida')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desafio da Corrida: estrelas atuais, falta p/ 20, ritmo do dia (cor). Exclui premiados.' })
  @ApiOkResponse({ description: 'codparc, nome, cpfcnpj, telefone, realizado, estrelas, faltam_estrelas, falta_para_20, meta_diaria, esperado_ate_hoje, cor.' })
  corrida(@Body() body: FiltroListaDto) {
    return this.service.corrida(body);
  }

  @Post('top30')
  @HttpCode(200)
  @ApiOperation({ summary: 'Top 30 do mes (topfashiostar).' })
  @ApiOkResponse({ description: 'posicao, codparc, nome, cpfcnpj, telefone, valor_venda.' })
  top30(@Body() body: FiltroListaDto) {
    return this.service.top30(body);
  }

  @Post('super-ofensiva')
  @HttpCode(200)
  @ApiOperation({ summary: 'Super Ofensiva: meses seguidos batendo a meta. etapa=4 (entrou) | 5 (reforco); omitido = ambos.' })
  @ApiOkResponse({ description: 'codparc, nome, cpfcnpj, telefone, meses_seguidos.' })
  superOfensiva(@Body() body: SuperOfensivaFiltroDto) {
    return this.service.superOfensiva(body);
  }

  @Post('aniversariantes')
  @HttpCode(200)
  @ApiOperation({ summary: 'Aniversariantes do mes (1 linha por matriz; vinculados agrupados).' })
  @ApiOkResponse({ description: 'cpf_matriz, nome, nascimento, dia_aniv, mes_aniversario, dias_para_mes_aniversario, telefone.' })
  aniversariantes(@Body() body: FiltroListaDto) {
    return this.service.aniversariantes(body);
  }

  @Post('desativacao')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desativacao: media de compra dos 3 ultimos meses < R$3.200; quanto falta comprar.' })
  @ApiOkResponse({ description: 'cpfcnpj, nome, telefone, total_3m, media_3m, comprou_no_mes, zerou_mes, falta_comprar_mes.' })
  desativacao(@Body() body: FiltroListaDto) {
    return this.service.desativacao(body);
  }
}
