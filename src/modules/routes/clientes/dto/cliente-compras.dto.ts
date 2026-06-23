import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClienteComprasDto {
  @ApiProperty({ description: 'CPF/CNPJ do cliente (so digitos ou formatado).', example: '06472333637' })
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @ApiPropertyOptional({ description: 'Quantos meses retroativos (inclui o mes atual). Default 12.', example: 12 })
  @IsOptional()
  @IsInt()
  meses?: number;
}
