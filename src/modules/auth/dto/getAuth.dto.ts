import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class GetAuthDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  LOGIN: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  SENHA: string;
}