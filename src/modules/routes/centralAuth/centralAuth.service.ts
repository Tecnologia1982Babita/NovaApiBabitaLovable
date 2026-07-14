import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';

// Bridge de login: delega a autenticacao ao CentralBabita (fonte das contas
// de Fornecedores e de outros setores) em vez de checar erp_usuario direto.
// O Central e quem mantem o cadastro/atributos (setor, cargo,
// vinculo_fornecedor) dessas contas. Ver docs/Módulos/CentralAuth.md.
//
// Chama a API INTERNA do Central (IP/porta da LAN), NAO o dominio publico
// api.central.babita.com.br — esse dominio teve incidentes de 503 e de
// servir codigo desatualizado (14/07/2026, ver memoria); a chamada
// servidor-a-servidor nao precisa sair para a internet.
//
// IMPORTANTE: o CentralBabita hoje nao tem sessao/token real pos-login (achado
// critico de 14/07/2026) — a chave de integracao aqui so autentica ESTE
// SERVIDOR como chamador legitimo, nao e uma substituicao de sessao de
// usuario. Login MD5 e comparacao de hash: nao ha "descriptografia" em
// nenhum ponto dessa cadeia.
@Injectable()
export class CentralAuthService {
  private readonly logger = new Logger(CentralAuthService.name);

  private readonly url =
    process.env.CENTRAL_AUTH_URL || 'http://192.168.0.204:3010/Personalizado/AuthExterno/Login';
  private readonly chave = process.env.CENTRAL_AUTH_SECRET || '';

  private md5(senha: string): string {
    return createHash('md5').update(senha).digest('hex');
  }

  async login(login: string, senha: string) {
    if (!this.chave) {
      this.logger.error('CENTRAL_AUTH_SECRET não configurado.');
      throw new BadGatewayException('Integração com o Central não configurada.');
    }

    let resp: globalThis.Response;
    try {
      resp = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Integracao-Chave': this.chave },
        body: JSON.stringify({ login, senha_md5: this.md5(senha) }),
      });
    } catch (err: any) {
      this.logger.error(`Falha ao chamar o Central: ${err?.message}`);
      throw new BadGatewayException('Central indisponível no momento.');
    }

    const data: any = await resp.json().catch(() => ({}));

    if (resp.status === 401) {
      this.logger.warn(`Login negado pelo Central: ${login}`);
      throw new UnauthorizedException(data?.Error || 'Credenciais inválidas.');
    }
    if (!resp.ok) {
      this.logger.error(`Central respondeu ${resp.status}: ${JSON.stringify(data)}`);
      throw new BadGatewayException(data?.Error || 'Erro ao autenticar no Central.');
    }

    this.logger.log(`Login OK via Central: ${login}`);
    return { autenticado: true, usuario: data };
  }
}
