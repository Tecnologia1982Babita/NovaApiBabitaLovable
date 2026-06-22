import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class LigaQueryDto {
  @ApiPropertyOptional({
    description: 'Início do período de vendas (YYYY-MM-DD). Default: 1º dia do mês corrente.',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  dataIni?: string;

  @ApiPropertyOptional({
    description: 'Fim do período de vendas (YYYY-MM-DD, inclusivo). Default: hoje.',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({
    description:
      'Data de corte das "revendedoras novas" da Liga (fashionstars.entrou_fashionstar >=). Default: 2026-06-01.',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  entradaNovasDesde?: string;
}
