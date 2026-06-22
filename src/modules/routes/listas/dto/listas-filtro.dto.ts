import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional } from 'class-validator';

/** Filtros comuns das listas. Tudo opcional -> POST com body vazio funciona. */
export class FiltroListaDto {
  @ApiPropertyOptional({
    description:
      'Filtra apenas os clientes da vendedora (codigovend). Usa vendedora_proprietaria. Omitido = todos.',
    example: 123,
  })
  @IsOptional()
  @IsInt()
  vendedora?: number;
}

export class SuperOfensivaFiltroDto extends FiltroListaDto {
  @ApiPropertyOptional({
    description:
      'Etapa do contato: 4 = entrou (4 meses seguidos), 5 = reforco (5 meses). Omitido = retorna 4 e 5.',
    enum: [4, 5],
    example: 4,
  })
  @IsOptional()
  @IsIn([4, 5])
  etapa?: number;
}
