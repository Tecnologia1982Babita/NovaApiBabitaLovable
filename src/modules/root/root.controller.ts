import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

// Rota raiz independente (não depende da pasta app nem do auth).
@ApiTags('Aplicação')
@Controller()
export class RootController {
  @ApiOperation({ summary: 'Status da API', description: 'Healthcheck simples da NovaAPIBabita.' })
  @ApiOkResponse({ description: 'API online.' })
  @HttpCode(HttpStatus.OK)
  @Get()
  status() {
    return {
      api: 'NovaAPIBabita',
      status: 'online',
      ambiente: process.env.AMBIENTE ?? null,
    };
  }
}
