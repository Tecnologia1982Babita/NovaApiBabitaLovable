import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/** Teto de CPFs por chamada em lote. */
export const MAX_CPFS_LOTE = 500;

export class ClienteComprasDto {
  @ApiPropertyOptional({
    description: 'CPF/CNPJ do cliente (so digitos ou formatado). Obrigatorio quando nao vier cpfs[] nem vendedora.',
    example: '06472333637',
  })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional({
    description:
      `Lote de CPF/CNPJ (ate ${MAX_CPFS_LOTE}) - uma chamada no lugar de uma por cliente. ` +
      'Exige granularidade "total" e devolve 1 item por MATRIZ: duplicados e CPFs vinculados ' +
      'a mesma matriz colapsam numa linha so.',
    type: [String],
    example: ['06472333637', '12345678909'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_CPFS_LOTE)
  @IsString({ each: true })
  cpfs?: string[];

  @ApiPropertyOptional({
    description:
      'Agrupamento: "mes" (default) ou "dia" quebram o periodo de UM cpf; ' +
      '"total" soma o periodo inteiro e devolve 1 item por MATRIZ, com os vinculados ' +
      'ja consolidados (obrigatorio em lote).',
    enum: ['mes', 'dia', 'total'],
    example: 'mes',
  })
  @IsOptional()
  @IsIn(['mes', 'dia', 'total'])
  granularidade?: 'mes' | 'dia' | 'total';

  @ApiPropertyOptional({ description: 'Mes especifico YYYY-MM. Prioridade sobre "meses".', example: '2026-05' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'mes deve estar no formato YYYY-MM' })
  mes?: string;

  @ApiPropertyOptional({ description: 'Inicio do periodo (YYYY-MM-DD).', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dataIni?: string;

  @ApiPropertyOptional({ description: 'Fim do periodo (YYYY-MM-DD, inclusivo).', example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({
    description:
      'codigovend da vendedora. SEM cpf/cpfs[] (e com granularidade "total") ela vira o SELETOR: ' +
      'devolve os clientes de que ela e a dona (vendedora_proprietaria), consolidados por matriz. ' +
      'Junto de um cpf unico (mes/dia) mantem o comportamento antigo: restringe aos cadastros dela. ' +
      'Junto de cpfs[] e ignorada - quem manda na lista sao os CPFs.',
    example: 55,
  })
  @IsOptional()
  @IsInt()
  vendedora?: number;

  @ApiPropertyOptional({ description: 'Qtos meses retroativos (inclui o atual). Default 12.', example: 12 })
  @IsOptional()
  @IsInt()
  meses?: number;
}
