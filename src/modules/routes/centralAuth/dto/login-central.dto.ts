import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// Body do POST /central-auth/login.
// Login + senha em texto puro (via HTTPS) de um app Lovable integrado; o
// service hasheia em MD5 antes de repassar ao CentralBabita, que guarda
// pw_md5 = md5(senha) — o mesmo esquema de erp_usuario.usu_senha. MD5 aqui
// não é medida de segurança (é hash de mão única, só o formato já usado
// nesta API — ver LoginUsuarioDto); a proteção real é HTTPS + a chave de
// integração servidor-a-servidor com o Central.
export class LoginCentralDto {
  @ApiProperty({
    description: 'Login da conta no CentralBabita (ex.: fornecedor cadastrado)',
    example: 'nomefornecedor',
  })
  @IsString()
  @IsNotEmpty()
  login: string;

  @ApiProperty({
    description: 'Senha em texto puro (a mesma senha real, ex. a do ERP para Fornecedores)',
    example: 'minhaSenhaReal123',
  })
  @IsString()
  @IsNotEmpty()
  senha: string;
}
