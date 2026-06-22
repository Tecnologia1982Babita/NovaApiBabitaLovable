import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/services/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(UsuariosService.name);

  // Nunca retorna a senha nas respostas.
  private readonly semSenha = { usu_senha: true } as const;

  // erp_usuario.usu_senha é armazenada em MD5.
  private md5(senha: string): string {
    return createHash('md5').update(senha.trim()).digest('hex');
  }

  async create(dto: CreateUsuarioDto) {
    const usu_login = dto.usu_login.trim().toUpperCase();

    try {
      const usuario = await this.prisma.erp_usuario.create({
        data: {
          ...dto,
          usu_login,
          usu_senha: this.md5(dto.usu_senha),
        },
        omit: this.semSenha,
      });
      this.logger.log(`Usuário criado: ${usu_login} (cod ${usuario.usu_cod})`);
      return usuario;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(`Já existe um usuário com o login '${usu_login}'.`);
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.erp_usuario.findMany({
      where: { usu_ativo: 1 },
      orderBy: { usu_cod: 'asc' },
      omit: this.semSenha,
    });
  }

  async findOne(usu_cod: number) {
    const usuario = await this.prisma.erp_usuario.findUnique({
      where: { usu_cod },
      omit: this.semSenha,
    });

    if (!usuario) {
      throw new NotFoundException(`Usuário ${usu_cod} não encontrado.`);
    }

    return usuario;
  }

  // Autenticação por login + senha em MD5.
  // A senha JÁ chega hasheada (MD5) do frontend; comparamos direto com o banco
  // (erp_usuario.usu_senha também é MD5). MD5 é irreversível — não há descriptografia.
  async login(loginRaw: string, senhaMd5Raw: string) {
    const usu_login = (loginRaw ?? '').trim().toUpperCase();
    const senhaMd5 = (senhaMd5Raw ?? '').trim().toLowerCase();

    if (!usu_login || !senhaMd5) {
      throw new BadRequestException('usu_login e usu_senha (MD5) são obrigatórios.');
    }

    const usuario = await this.prisma.erp_usuario.findUnique({
      where: { usu_login },
    });

    if (!usuario || usuario.usu_ativo !== 1) {
      this.logger.warn(`Login negado (inexistente/inativo): ${usu_login}`);
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }

    if (!usuario.usu_senha || usuario.usu_senha.toLowerCase() !== senhaMd5) {
      this.logger.warn(`Login negado (senha inválida): ${usu_login}`);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    this.logger.log(`Login OK: ${usu_login}`);

    const { usu_senha, ...usuarioSemSenha } = usuario;
    return {
      autenticado: true,
      usuario: usuarioSemSenha,
    };
  }

  async update(usu_cod: number, dto: UpdateUsuarioDto) {
    await this.findOne(usu_cod); // garante que existe (404 se não)

    const data: any = { ...dto, usu_datalt: new Date() };
    if (dto.usu_login != null) {
      data.usu_login = dto.usu_login.trim().toUpperCase();
    }
    if (dto.usu_senha != null) {
      data.usu_senha = this.md5(dto.usu_senha);
    }

    try {
      const usuario = await this.prisma.erp_usuario.update({
        where: { usu_cod },
        data,
        omit: this.semSenha,
      });
      this.logger.log(`Usuário atualizado: cod ${usu_cod}`);
      return usuario;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Já existe um usuário com esse login.');
      }
      throw error;
    }
  }

  async remove(usu_cod: number) {
    await this.findOne(usu_cod); // garante que existe (404 se não)

    // Soft delete: mantém histórico e não quebra as FKs (acessos / sistemas).
    const usuario = await this.prisma.erp_usuario.update({
      where: { usu_cod },
      data: { usu_ativo: 0, usu_datalt: new Date() },
      omit: this.semSenha,
    });
    this.logger.log(`Usuário inativado (soft delete): cod ${usu_cod}`);
    return usuario;
  }
}
