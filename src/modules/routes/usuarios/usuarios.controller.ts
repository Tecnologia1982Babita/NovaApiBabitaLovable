import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { LoginUsuarioDto } from './dto/login-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuários')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @ApiOperation({
    summary: 'Cria um novo usuário',
    description: 'O login é gravado em MAIÚSCULO (trim) e a senha em MD5.',
  })
  @ApiCreatedResponse({ description: 'Usuário criado (sem retornar a senha).' })
  @ApiConflictResponse({ description: 'Já existe um usuário com esse login.' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() body: CreateUsuarioDto) {
    return this.usuariosService.create(body);
  }

  // Login por POST: corpo { usu_login, usu_senha } com a senha já em MD5.
  // O backend NÃO descriptografa (MD5 é irreversível): compara o hash recebido
  // direto com erp_usuario.usu_senha.
  @ApiOperation({
    summary: 'Autentica um usuário (login + senha em MD5)',
    description:
      'Recebe usu_login e usu_senha (esta já em hash MD5, gerado no frontend). ' +
      'O login é normalizado para MAIÚSCULO/trim. A senha NÃO é re-hasheada nem ' +
      'descriptografada — o MD5 recebido é comparado diretamente com o do banco.',
  })
  @ApiOkResponse({ description: 'Autenticado; retorna os dados do usuário (sem senha).' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas ou usuário inativo.' })
  @ApiBadRequestResponse({ description: 'usu_login e/ou usu_senha ausentes ou MD5 inválido.' })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() body: LoginUsuarioDto) {
    return this.usuariosService.login(body.usu_login, body.usu_senha);
  }

  @ApiOperation({ summary: 'Lista os usuários ativos (usu_ativo = 1)' })
  @ApiOkResponse({ description: 'Lista de usuários (sem senha).' })
  @Get()
  findAll() {
    return this.usuariosService.findAll();
  }

  @ApiOperation({ summary: 'Busca um usuário pelo código' })
  @ApiParam({ name: 'usu_cod', type: Number, example: 571 })
  @ApiOkResponse({ description: 'Usuário encontrado (sem senha).' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  @Get(':usu_cod')
  findOne(@Param('usu_cod', ParseIntPipe) usu_cod: number) {
    return this.usuariosService.findOne(usu_cod);
  }

  @ApiOperation({
    summary: 'Atualiza um usuário',
    description: 'Campos parciais. Se enviar usu_login vira MAIÚSCULO; se enviar usu_senha vira MD5.',
  })
  @ApiParam({ name: 'usu_cod', type: Number, example: 571 })
  @ApiOkResponse({ description: 'Usuário atualizado (sem senha).' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  @ApiConflictResponse({ description: 'Já existe um usuário com esse login.' })
  @Patch(':usu_cod')
  update(
    @Param('usu_cod', ParseIntPipe) usu_cod: number,
    @Body() body: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(usu_cod, body);
  }

  @ApiOperation({
    summary: 'Inativa um usuário (soft delete)',
    description: 'Não remove fisicamente: seta usu_ativo = 0 para preservar histórico e FKs.',
  })
  @ApiParam({ name: 'usu_cod', type: Number, example: 571 })
  @ApiOkResponse({ description: 'Usuário inativado (sem senha).' })
  @ApiNotFoundResponse({ description: 'Usuário não encontrado.' })
  @Delete(':usu_cod')
  remove(@Param('usu_cod', ParseIntPipe) usu_cod: number) {
    return this.usuariosService.remove(usu_cod);
  }
}
