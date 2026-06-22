import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginVendedoraDto {
  @ApiProperty({
    description: 'Login da vendedora (erp_usuario.usu_login)',
    example: 'JULIANA.FERREIRA',
  })
  @IsString()
  @IsNotEmpty()
  usu_login: string;

  @ApiProperty({
    description: 'Senha da vendedora (erp_usuario.usu_senha)',
    example: '12345',
  })
  @IsString()
  @IsNotEmpty()
  usu_senha: string;
}
