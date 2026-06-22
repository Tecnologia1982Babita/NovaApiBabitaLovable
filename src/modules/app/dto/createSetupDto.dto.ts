import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, IsOptional } from 'class-validator';

export class CreateSetupDto {

  @ApiProperty({
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  SECRET: string;
  
  // ENDEREÇO
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  LOGRADOURO: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  NUMERO: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  COMPLEMENTO?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  BAIRRO: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  CIDADE: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  CEP: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ESTADO: string;

  // EMPRESA
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  RAZAOSOCIAL: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  NOMEFANTASIA: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  CNPJCPF: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  EMAIL: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  TELEFONE: string;
}
