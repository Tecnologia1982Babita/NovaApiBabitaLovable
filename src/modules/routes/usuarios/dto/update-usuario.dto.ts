import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { CreateUsuarioDto } from './create-usuario.dto';

// Todos os campos do create viram opcionais no update.
export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {
  @ApiPropertyOptional({ example: 1, description: 'CODUSU de quem está alterando o registro' })
  @IsOptional()
  @IsInt()
  usu_usualt?: number;
}
