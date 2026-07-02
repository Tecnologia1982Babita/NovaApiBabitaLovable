import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';

@Injectable()
export class FashionstarsService {
  constructor(private prisma: PrismaService) {}

  /** Lista de cadastros ATIVOS na Liga (roster fashionstars), 1 por matriz (~170). */
  async findAll() {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT ON (cpf_matriz)
              codfashion, cpfcnpj, nome, plano, estrelas, pontosfashion, diastroca, percentualdesc, dtiniplano, dtfimplano
       FROM (
         SELECT a.codfashion,
                regexp_replace(a.cpfcnpj,'[^0-9]','','g') AS cpfcnpj,
                btrim(a.nomeparc) AS nome, a.planosfashion AS plano, a.estrelas,
                a.pontosfashion, a.diastroca, a.percentualdesc, a.dtiniplano, a.dtfimplano,
                lpad(regexp_replace(COALESCE(NULLIF(cr.clientes_cpf_cnpj_principal,''),cr.clientes_cpf_cnpj),'[^0-9]','','g'),14,'0') AS cpf_matriz
         FROM fashionstars f
         JOIN erp_clientes_real cr ON cr.clientes_cpf_cnpj = f.cpfcnpj
         JOIN adfashionstars a ON lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') = f.cpfcnpj
       ) t
       ORDER BY cpf_matriz, dtfimplano DESC NULLS LAST`,
    );
    const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);
    return rows.map((r) => ({
      codfashion: r.codfashion,
      cpfcnpj: r.cpfcnpj,
      nome: r.nome,
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

  /**
   * Consulta cliente por CPF/CNPJ. Sempre retorna todas as infos (estrelas, plano, pontos...).
   * statusLiga:
   *  - "ativa"     -> esta no roster atual da Liga (tabela fashionstars)
   *  - "ja_esteve" -> tem cadastro FashionStar (adfashionstars) mas nao esta no roster
   *  - "nunca"     -> nao tem cadastro nenhum -> retorna zerado / "nao esta na Liga"
   */
  async findOne(cpfcnpj: string) {
    if (!cpfcnpj) throw new BadRequestException('cpfcnpj e obrigatorio');

    // Considera o GRUPO da matriz (vinculados): status/infos valem pro grupo todo.
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `WITH pref AS (SELECT lpad(regexp_replace($1,'[^0-9]','','g'),14,'0') AS cpf14),
            matriz AS (
              SELECT lpad(regexp_replace(COALESCE(NULLIF(cr.clientes_cpf_cnpj_principal,''),cr.clientes_cpf_cnpj),'[^0-9]','','g'),14,'0') AS cpf_matriz
              FROM erp_clientes_real cr, pref
              WHERE lpad(regexp_replace(cr.clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') = pref.cpf14
              LIMIT 1
            ),
            grupo AS (
              SELECT lpad(regexp_replace(cr.clientes_cpf_cnpj,'[^0-9]','','g'),14,'0') AS cpf14
              FROM erp_clientes_real cr, matriz
              WHERE lpad(regexp_replace(COALESCE(NULLIF(cr.clientes_cpf_cnpj_principal,''),cr.clientes_cpf_cnpj),'[^0-9]','','g'),14,'0') = matriz.cpf_matriz
              UNION SELECT cpf14 FROM pref
            )
       SELECT a.cpfcnpj, a.nomeparc, a.estrelas, a.planosfashion, a.pontosfashion, a.diastroca,
              a.percentualdesc, a.compra7mes, a.mesatual, a.dtnasc, a.dtiniplano, a.dtfimplano,
              EXISTS (SELECT 1 FROM fashionstars f
                      WHERE lpad(regexp_replace(f.cpfcnpj,'[^0-9]','','g'),14,'0') IN (SELECT cpf14 FROM grupo)) AS na_liga
       FROM adfashionstars a
       WHERE lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0') IN (SELECT cpf14 FROM grupo)
       ORDER BY (EXISTS (SELECT 1 FROM fashionstars f
                         WHERE lpad(regexp_replace(f.cpfcnpj,'[^0-9]','','g'),14,'0')
                             = lpad(regexp_replace(a.cpfcnpj,'[^0-9]','','g'),14,'0'))) DESC,
                a.dataalt DESC NULLS LAST
       LIMIT 1`,
      cpfcnpj,
    );

    const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);
    const cpfLimpo = String(cpfcnpj).replace(/\D/g, '');

    if (!rows.length) {
      return {
        cpfcnpj: cpfLimpo, nomeparc: null, naLiga: false, statusLiga: 'nunca',
        mensagem: 'Cliente nao esta na Liga (sem cadastro FashionStar, incluindo vinculados).',
        estrelas: 0, planosfashion: null, pontosfashion: 0, diastroca: 0,
        percentualdesc: 0, compra7mes: 0, mesatual: 0, saldoAtual: 0,
        dtnasc: null, dtiniplano: null, dtfimplano: null,
      };
    }

    const r = rows[0];
    const naLiga = r.na_liga === true;
    const pontos = Number(r.pontosfashion) || 0;
    const compra7 = Number(r.compra7mes) || 0;
    const mesAtual = Number(r.mesatual) || 0;

    return {
      cpfcnpj: String(r.cpfcnpj || cpfLimpo).replace(/\D/g, ''),
      nomeparc: r.nomeparc ?? null,
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
