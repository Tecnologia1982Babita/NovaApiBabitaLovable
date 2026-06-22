import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { LigaQueryDto } from './dto/liga-query.dto';

export interface LinhaLiga {
  codigoVendedora: number;
  venNumero: number;
  nomeVendedora: string;
  totalVendaLiga: number;
  totalVendaNovasLiga: number;
}

@Injectable()
export class MetaVendedorasService {
  constructor(private readonly prisma: PrismaService) {}

  // Data de corte padrão para "revendedoras novas" da Liga.
  private readonly ENTRADA_NOVAS_PADRAO = '2026-06-01';

  // 1º dia do mês corrente (YYYY-MM-DD).
  private primeiroDiaMesCorrente(): string {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${hoje.getFullYear()}-${mes}-01`;
  }

  // Hoje (YYYY-MM-DD).
  private hojeISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Total de venda para revendedoras da Liga, por vendedora.
   * - Venda: SUM(erp_ipedidos.prcvenda) dos pedidos (erp_pedidos) não cancelados.
   * - Revendedora da Liga: cliente do pedido (doctoclie) presente em fashionstars (por cpfcnpj).
   * - Vendedora: erp_pedidos.codigovend = erp_vendedores.ven_numero (nome via erp_vendedores).
   * - "Novas Liga": subconjunto onde a revendedora entrou na Liga a partir da data de corte.
   */
  async totalVendaLigaPorVendedora(q: LigaQueryDto): Promise<LinhaLiga[]> {
    const dataIni = q.dataIni ?? this.primeiroDiaMesCorrente();
    const dataFim = q.dataFim ?? this.hojeISO();
    const entradaNovas = q.entradaNovasDesde ?? this.ENTRADA_NOVAS_PADRAO;

    const linhas = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        v.ven_cod    AS "codigoVendedora",
        v.ven_numero AS "venNumero",
        v.ven_nome   AS "nomeVendedora",
        ROUND(COALESCE(SUM(i.prcvenda), 0), 2) AS "totalVendaLiga",
        ROUND(COALESCE(SUM(CASE WHEN fs.entrou_desde >= $3::date THEN i.prcvenda ELSE 0 END), 0), 2) AS "totalVendaNovasLiga"
      FROM erp_pedidos p
      JOIN (
        SELECT regexp_replace(cpfcnpj, '\\D', '', 'g') AS cpf_norm,
               MAX(entrou_fashionstar) AS entrou_desde
        FROM fashionstars
        GROUP BY 1
      ) fs ON fs.cpf_norm = regexp_replace(p.doctoclie, '\\D', '', 'g')
      JOIN erp_vendedores v ON v.ven_numero = p.codigovend
      JOIN erp_ipedidos  i ON i.loja_origem = p.loja_origem AND i.documento = p.documento
      WHERE p.cancelado IS DISTINCT FROM 'S'
        AND p.data >= $1::date AND p.data <= $2::date
      GROUP BY v.ven_cod, v.ven_numero, v.ven_nome
      ORDER BY "totalVendaLiga" DESC
      `,
      dataIni,
      dataFim,
      entradaNovas,
    );

    // Postgres numeric volta como string -> normaliza para number.
    return linhas.map((r) => ({
      codigoVendedora: Number(r.codigoVendedora),
      venNumero: Number(r.venNumero),
      nomeVendedora: r.nomeVendedora,
      totalVendaLiga: Number(r.totalVendaLiga),
      totalVendaNovasLiga: Number(r.totalVendaNovasLiga),
    }));
  }
}
