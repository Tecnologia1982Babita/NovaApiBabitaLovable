import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ClienteComprasDto {
  @ApiProperty({ description: 'CPF/CNPJ do cliente (so digitos ou formatado).', example: '06472333637' })
  @IsString()
  @IsNotEmpty()
  cpf: string;

  @ApiPropertyOptional({ description: 'Mes especifico no formato YYYY-MM. Tem prioridade sobre "meses".', example: '2026-05' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'mes deve estar no formato YYYY-MM' })
  mes?: string;

  @ApiPropertyOptional({ description: 'Inicio do periodo (YYYY-MM-DD). Se informado, usa periodo dataIni..dataFim.', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do periodo (YYYY-MM-DD, inclusivo).', example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Qtos meses retroativos (inclui o atual). Usado se nao informar mes/periodo. Default 12.', example: 12 })
  @IsOptional()
  @IsInt()
  meses?: number;
}
