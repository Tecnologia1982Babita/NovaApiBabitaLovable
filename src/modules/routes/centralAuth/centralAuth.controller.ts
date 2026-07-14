import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CentralAuthService } from './centralAuth.service';
import { LoginCentralDto } from './dto/login-central.dto';

// Subdivisão de integração: login delegado ao CentralBabita, para apps
// Lovable que devem autenticar contra contas já cadastradas lá (ex.:
// Fornecedores, que agora recebem no Central a mesma senha do ERP).
// Ver docs/Módulos/CentralAuth.md.
@ApiTags('Integração Central')
@Controller('central-auth')
export class CentralAuthController {
  constructor(private readonly centralAuthService: CentralAuthService) {}

  @ApiOperation({
    summary: 'Login delegado ao CentralBabita',
    description:
      'Recebe login + senha em texto puro e encaminha para o CentralBabita ' +
      '(que guarda a senha em MD5 — mesmo hash de erp_usuario.usu_senha) via ' +
      'chamada servidor-a-servidor autenticada por chave de integração. ' +
      'Não há descriptografia em nenhum ponto: MD5 é hash de mão única.',
  })
  @ApiOkResponse({ description: 'Autenticado; retorna o perfil da conta no Central (sem senha).' })
  @ApiUnauthorizedResponse({ description: 'Login ou senha inválidos.' })
  @ApiResponse({ status: 502, description: 'Central indisponível ou integração mal configurada.' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() body: LoginCentralDto) {
    return this.centralAuthService.login(body.login, body.senha);
  }
}
