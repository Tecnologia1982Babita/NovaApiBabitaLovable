import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, Matches } from 'class-validator';

/** mesReferencia aceita YYYY-MM ou YYYY-MM-DD; omitido = mes corrente. */
export class MesReferenciaDto {
  @ApiPropertyOptional({ description: 'Mes de referencia (YYYY-MM). Omitido = mes corrente.', example: '2026-08' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}(-\d{2})?$/, { message: 'mesReferencia deve ser YYYY-MM ou YYYY-MM-DD' })
  mesReferencia?: string;
}

export class HistoricoQueryDto extends MesReferenciaDto {
  @ApiPropertyOptional({ description: 'Filtra pelo nome da vendedora.' })
  @IsOptional()
  @IsString()
  vendedora?: string;

  @ApiPropertyOptional({ description: 'Filtra pelo codigo da loja.' })
  @IsOptional()
  @IsNumberString({}, { message: 'loja deve ser numerico' })
  loja?: string;
}
