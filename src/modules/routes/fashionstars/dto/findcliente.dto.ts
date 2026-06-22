import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class FindClienteDto {
  @ApiProperty({
    description: 'CPF ou CNPJ do cliente Fashion Star',
    example: '12345678901',
  })
  @IsString()
  @IsNotEmpty()
  cpfcnpj!: string;
}
