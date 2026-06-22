import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/services/prisma.service';
import { LoginVendedoraDto } from './dto/login-vendedora.dto';

@Injectable()
export class VendedorasService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(VendedorasService.name);

  async login(body: LoginVendedoraDto) {
    // Login sempre em MAIÚSCULO e sem espaços (padrão da erp_usuario).
    const usu_login = (body.usu_login ?? '').trim().toUpperCase();
    const senha = (body.usu_senha ?? '').trim();

    if (!usu_login || !senha) {
      throw new BadRequestException('usu_login e usu_senha são obrigatórios.');
    }

    // As senhas da erp_usuario são armazenadas em MD5 (32 caracteres hex).
    const senhaHash = createHash('md5').update(senha).digest('hex');

    const usuario = await this.prisma.erp_usuario.findUnique({
      where: { usu_login },
    });

    if (!usuario || usuario.usu_ativo !== 1) {
      this.logger.warn(`Login negado (inexistente/inativo): ${usu_login}`);
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }

    if (!usuario.usu_senha || usuario.usu_senha.toLowerCase() !== senhaHash) {
      this.logger.warn(`Login negado (senha inválida): ${usu_login}`);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Dados da vendedora vinculada (ven_numero -> erp_vendedores).
    const vendedora =
      usuario.ven_numero != null
        ? await this.prisma.erp_vendedores.findFirst({
            where: { ven_numero: usuario.ven_numero },
          })
        : null;

    this.logger.log(`Login OK: ${usu_login}`);

    // Não retorna a senha.
    const { usu_senha, ...usuarioSemSenha } = usuario;

    return {
      autenticado: true,
      usuario: usuarioSemSenha,
      vendedora,
    };
  }
}
