import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumberString, IsOptional } from 'class-validator';

export class LigaQueryDto {
  @ApiPropertyOptional({ description: 'Inicio do periodo (YYYY-MM-DD). Default: 1o dia do mes corrente.', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do periodo (YYYY-MM-DD, inclusivo). Default: hoje.', example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Data de corte das "novas" da Liga (entrou_fashionstar >=). Default: 2026-06-01.', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  entradaNovasDesde?: string;

  @ApiPropertyOptional({ description: 'Meta global (R$) para comparar. Default: 1600000.', example: 1210000 })
  @IsOptional()
  @IsNumberString()
  metaGlobal?: string;
}
