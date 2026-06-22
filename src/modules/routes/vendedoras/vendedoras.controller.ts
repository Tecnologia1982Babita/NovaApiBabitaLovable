import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginVendedoraDto } from './dto/login-vendedora.dto';
import { VendedorasService } from './vendedoras.service';

@ApiTags('Vendedoras')
@Controller('vendedoras')
export class VendedorasController {
  constructor(private readonly vendedorasService: VendedorasService) {}

  @ApiOperation({
    summary: 'Login da vendedora (login + senha)',
    description:
      'Valida usu_login + usu_senha (MD5) na erp_usuario. O login é normalizado para MAIÚSCULO/trim. ' +
      'Retorna os dados do usuário e da vendedora vinculada (erp_vendedores).',
  })
  @ApiOkResponse({ description: 'Autenticado; retorna usuario + vendedora.' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas ou usuário inativo.' })
  @ApiBadRequestResponse({ description: 'usu_login e/ou usu_senha ausentes.' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: LoginVendedoraDto) {
    return this.vendedorasService.login(body);
  }
}
