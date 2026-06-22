import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

// Body do POST /usuarios/login.
// A senha já chega em MD5 (gerada no frontend) e é comparada DIRETO com
// erp_usuario.usu_senha (que também é MD5). MD5 é hash de mão única:
// não há descriptografia — só comparação de hashes.
export class LoginUsuarioDto {
  @ApiProperty({
    description: 'Login do usuário (erp_usuario.usu_login)',
    example: 'JULIANA.FERREIRA',
  })
  @IsString()
  @IsNotEmpty()
  usu_login: string;

  @ApiProperty({
    description: 'Senha já em hash MD5 (32 caracteres hex). NÃO enviar em texto puro.',
    example: '827ccb0eea8a706c4c34a16891f84e7b',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-fA-F0-9]{32}$/, { message: 'usu_senha deve ser um hash MD5 (32 caracteres hexadecimais).' })
  usu_senha: string;
}
