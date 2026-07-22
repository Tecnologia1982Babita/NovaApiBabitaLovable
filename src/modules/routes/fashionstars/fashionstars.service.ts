import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';

const ROSTER_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class FashionstarsService {
  constructor(private prisma: PrismaService) {}
  private rosterCache: { at: number; set: Set<string> } | null = null;

  private norm14(v: any): string {
    return String(v ?? '').replace(/\D/g, '').padStart(14, '0');
  }

  /** Roster ATIVO da Liga: consulta interna direto em fashionstars (bd_think, sincronizada 1x/dia do Sankhya via cron no .202). Cache 5min. */
  private async rosterAtivo(): Promise<Set<string>> {
    if (this.rosterCache && Date.now() - this.rosterCache.at < ROSTER_TTL_MS) {
      return this.rosterCache.set;
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT lpad(regexp_replace(cpfcnpj,'[^0-9]','','g'),14,'0') AS c FROM fashionstars WHERE ativo = 'S'`,
    );
    const set = new Set<string>(rows.map((r) => r.c));
    this.rosterCache = { at: Date.now(), set };
    return set;
  }

  /** Lista de cadastros ATIVOS na Liga (roster vivo), 1 por matriz, com infos. */
  async findAll() {
    const roster = await this.rosterAtivo();
    if (roster.size === 0) return [];
    const cpfs = [...roster];
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT ON (cpf_matriz)
              codfashion, cpfcnpj, nome, telefone, plano, estrelas, pontosfashion, diastroca, percentualdesc, dtiniplano, dtfimplano
       FROM (
         SELECT a.codfashion, regexp_replace(a.cpfcnpj,'[^0-9]','','g') AS cpfcnpj,
                btrim(a.nomeparc) AS nome, a.planosfashion AS plano, a.estrelas,
                a.pontosfashion, a.diastroca, a.percentualdesc, a.dtiniplano, a.dtfimplano,
                COALESCE(
                  (SELECT lpad(regexp_replace(COALESCE(NULLIF(cr.clientes_cpf_cnpj_principal,''),cr.clientes_cpf_cnpj),'[^0-9]','','g'),14,'0')
                     FROM erp_clientes_real cr
                     WHERE lpad(regexp_replace(cr.clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') LIMIT 1),
                  lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0')) AS cpf_matriz,
                (SELECT cr.clientes_id_situacao FROM erp_clientes_real cr
                   WHERE lpad(regexp_replace(cr.clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') LIMIT 1) AS id_situacao,
                (SELECT CASE WHEN regexp_replace(coalesce(cr.clientes_telefone2,''),'[^0-9]','','g') ~ '[1-9]'
                             THEN NULLIF(btrim(coalesce(cr.clientes_ddd2,'')) || ' ' || btrim(coalesce(cr.clientes_telefone2,'')), '')
                             ELSE NULLIF(btrim(coalesce(cr.clientes_ddd1,'')) || ' ' || btrim(coalesce(cr.clientes_telefone1,'')), '')
                        END
                   FROM erp_clientes_real cr
                   WHERE lpad(regexp_replace(cr.clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') LIMIT 1) AS telefone
         FROM adfashionstars a
         WHERE lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') = ANY($1::text[])
       ) t
       WHERE (t.id_situacao IS NULL OR t.id_situacao NOT IN (6,8,9,95))
       ORDER BY cpf_matriz, dtfimplano DESC NULLS LAST`,
      cpfs,
    );
    const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);
    return rows.map((r) => ({
      codfashion: r.codfashion,
      cpfcnpj: r.cpfcnpj,
      nome: r.nome,
      telefone: r.telefone ?? null,
      plano: r.plano,
      estrelas: Number(r.estrelas) || 0,
      pontosfashion: Number(r.pontosfashion) || 0,
      diastroca: Number(r.diastroca) || 0,
      percentualdesc: Number(r.percentualdesc) || 0,
      dtiniplano: fmt(r.dtiniplano),
      dtfimplano: fmt(r.dtfimplano),
      naLiga: true,
    }));
  }

  /** Consulta por CPF/CNPJ. Considera o grupo da matriz (vinculados) e o roster VIVO. */
  async findOne(cpfcnpj: string) {
    if (!cpfcnpj) throw new BadRequestException('cpfcnpj e obrigatorio');
    const cpf14in = this.norm14(cpfcnpj);

    // cpfs do grupo (matriz + vinculados); fallback = proprio cpf.
    const g = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT lpad(regexp_replace(cr.clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') AS cpf14
       FROM erp_clientes_real cr
       WHERE lpad(regexp_replace(COALESCE(NULLIF(cr.clientes_cpf_cnpj_principal,''),cr.clientes_cpf_cnpj),'[^0-9]','','g'),14,'0') = (
         SELECT lpad(regexp_replace(COALESCE(NULLIF(clientes_cpf_cnpj_principal,''),clientes_cpf_cnpj),'[^0-9]','','g'),14,'0')
         FROM erp_clientes_real WHERE lpad(regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = $1 LIMIT 1)
         AND COALESCE(cr.clientes_id_situacao,-1) NOT IN (6,8,9,95)
       UNION SELECT $1`,
      cpf14in,
    );
    const grupo = g.map((x) => x.cpf14);
    if (!grupo.includes(cpf14in)) grupo.push(cpf14in);

    const roster = await this.rosterAtivo();
    const naLiga = grupo.some((c) => roster.has(c));

    // melhor registro adfashionstars do grupo (info), preferindo o proprio cpf consultado.
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT a.cpfcnpj, a.nomeparc, a.estrelas, a.planosfashion, a.pontosfashion, a.diastroca,
              a.percentualdesc, a.compra7mes, a.mesatual, a.dtnasc, a.dtiniplano, a.dtfimplano
       FROM adfashionstars a
       WHERE lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') = ANY($1::text[])
       ORDER BY (lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') = $2) DESC, a.dataalt DESC NULLS LAST
       LIMIT 1`,
      grupo,
      cpf14in,
    );

    const telRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT CASE WHEN regexp_replace(coalesce(clientes_telefone2,''),'[^0-9]','','g') ~ '[1-9]'
                   THEN NULLIF(btrim(coalesce(clientes_ddd2,'')) || ' ' || btrim(coalesce(clientes_telefone2,'')), '')
                   ELSE NULLIF(btrim(coalesce(clientes_ddd1,'')) || ' ' || btrim(coalesce(clientes_telefone1,'')), '')
              END AS telefone
       FROM erp_clientes_real
       WHERE lpad(regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = ANY($1::text[])
         AND COALESCE(clientes_id_situacao,-1) NOT IN (6,8,9,95)
       ORDER BY (lpad(regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = $2) DESC,
                (regexp_replace(coalesce(clientes_telefone2,''),'[^0-9]','','g') ~ '[1-9]') DESC
       LIMIT 1`,
      grupo,
      cpf14in,
    );
    const telefone = telRows[0]?.telefone ?? null;

    const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);

    if (!rows.length) {
      return {
        cpfcnpj: cpf14in.replace(/^0+/, ''),
        nomeparc: null,
        telefone,
        naLiga,
        statusLiga: naLiga ? 'ativa' : 'nunca',
        mensagem: naLiga ? 'Ativa na Liga.' : 'Cliente nao esta na Liga (sem cadastro FashionStar).',
        estrelas: 0, planosfashion: null, pontosfashion: 0, diastroca: 0,
        percentualdesc: 0, compra7mes: 0, mesatual: 0, saldoAtual: 0,
        dtnasc: null, dtiniplano: null, dtfimplano: null,
      };
    }

    const r = rows[0];
    const pontos = Number(r.pontosfashion) || 0;
    const compra7 = Number(r.compra7mes) || 0;
    const mesAtual = Number(r.mesatual) || 0;
    return {
      cpfcnpj: String(r.cpfcnpj || cpf14in).replace(/\D/g, ''),
      nomeparc: r.nomeparc ?? null,
      telefone,
      naLiga,
      statusLiga: naLiga ? 'ativa' : 'ja_esteve',
      mensagem: naLiga ? 'Ativa na Liga.' : 'Ja esteve na Liga (nao esta ativa no momento).',
      estrelas: Number(r.estrelas) || 0,
      planosfashion: r.planosfashion ?? null,
      pontosfashion: pontos,
      diastroca: Number(r.diastroca) || 0,
      percentualdesc: Number(r.percentualdesc) || 0,
      compra7mes: compra7,
      mesatual: mesAtual,
      saldoAtual: pontos - compra7 + mesAtual,
      dtnasc: fmt(r.dtnasc),
      dtiniplano: fmt(r.dtiniplano),
      dtfimplano: fmt(r.dtfimplano),
    };
  }
}
