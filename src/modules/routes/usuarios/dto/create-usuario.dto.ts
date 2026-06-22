import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty({ example: 'JULIANA.FERREIRA', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  usu_login: string;

  @ApiProperty({ example: '12345', description: 'Senha em texto puro (será gravada em MD5)' })
  @IsString()
  @IsNotEmpty()
  usu_senha: string;

  @ApiPropertyOptional({ example: 'fulano@babita.com.br', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  usu_email?: string;

  @ApiPropertyOptional({ example: 1, description: '1 = ativo, 0 = inativo' })
  @IsOptional()
  @IsInt()
  usu_ativo?: number;

  @ApiPropertyOptional({ example: 1, description: 'Tipo do usuário (1 = vendedora)' })
  @IsOptional()
  @IsInt()
  usu_tipo?: number;

  @ApiPropertyOptional({ example: 214, description: 'Número do vendedor (erp_vendedores.ven_numero)' })
  @IsOptional()
  @IsInt()
  ven_numero?: number;

  @ApiPropertyOptional({ example: 401330, description: 'Código da pessoa (erp_pessoa.pes_cod)' })
  @IsOptional()
  @IsInt()
  pes_cod?: number;

  @ApiPropertyOptional({ example: '21', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  usu_loja?: string;

  @ApiPropertyOptional({ example: 1, description: 'CODUSU de quem está criando o registro' })
  @IsOptional()
  @IsInt()
  usu_usuinc?: number;
}
