import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { LigaQueryDto } from './dto/liga-query.dto';

export interface LinhaLiga {
  codigoVendedora: number;
  venNumero: number;
  nomeVendedora: string;
  totalVendaLiga: number;      // LIQUIDO (vendas - trocas), valor da nota (totalgeral)
  totalVendaNovasLiga: number; // liquido, so revendedoras novas
}

export interface RespostaLiga {
  metaGlobal: number;
  valorAtualCompra: number;  // soma liquida de todas as vendedoras
  atingiu: boolean;
  faltaParaMeta: number;
  vendedoras: LinhaLiga[];
}

@Injectable()
export class MetaVendedorasService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly ENTRADA_NOVAS_PADRAO = '2026-06-01';
  private readonly META_GLOBAL_PADRAO = 1600000;

  private primeiroDiaMesCorrente(): string {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return `${hoje.getFullYear()}-${mes}-01`;
  }
  private hojeISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Venda LIQUIDA para revendedoras da Liga, por vendedora (vendedor que fez a venda).
   * - Liquido = SUM(erp_pedidos.totalgeral) - SUM(erp_trocas.totalgeral)  [valor da nota].
   * - Revendedora da Liga: doctoclie presente em fashionstars.
   * - Vendedora: codigovend (venda/troca) -> erp_vendedores.ven_numero.
   * Retorna resumo (meta global + valor atual) + lista por vendedora.
   */
  async totalVendaLigaPorVendedora(q: LigaQueryDto): Promise<RespostaLiga> {
    const dataIni = q.dataIni ?? this.primeiroDiaMesCorrente();
    const dataFim = q.dataFim ?? this.hojeISO();
    const entradaNovas = q.entradaNovasDesde ?? this.ENTRADA_NOVAS_PADRAO;
    const metaGlobal = q.metaGlobal != null ? Number(q.metaGlobal) : this.META_GLOBAL_PADRAO;

    const linhas = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT v.ven_cod AS "codigoVendedora", v.ven_numero AS "venNumero", v.ven_nome AS "nomeVendedora",
             ROUND(COALESCE(SUM(mov.valor),0),2) AS "totalVendaLiga",
             ROUND(COALESCE(SUM(CASE WHEN mov.nova THEN mov.valor ELSE 0 END),0),2) AS "totalVendaNovasLiga"
      FROM (
        SELECT p.codigovend AS cod, COALESCE(p.totalgeral,0) AS valor, (fs.entrou_desde >= $3::date) AS nova
        FROM erp_pedidos p
        JOIN (SELECT regexp_replace(cpfcnpj,'[^0-9]','','g') AS cpf_norm, MAX(entrou_fashionstar) AS entrou_desde
              FROM fashionstars GROUP BY 1) fs
          ON fs.cpf_norm = regexp_replace(p.doctoclie,'[^0-9]','','g')
        WHERE p.cancelado IS DISTINCT FROM 'S' AND p.data >= $1::date AND p.data <= $2::date
        UNION ALL
        SELECT t.codigovend, -COALESCE(t.totalgeral,0), (fs.entrou_desde >= $3::date)
        FROM erp_trocas t
        JOIN (SELECT regexp_replace(cpfcnpj,'[^0-9]','','g') AS cpf_norm, MAX(entrou_fashionstar) AS entrou_desde
              FROM fashionstars GROUP BY 1) fs
          ON fs.cpf_norm = regexp_replace(t.doctoclie,'[^0-9]','','g')
        WHERE COALESCE(t.cancelado,'N') = 'N' AND t.data >= $1::date AND t.data <= $2::date
      ) mov
      JOIN erp_vendedores v ON v.ven_numero = mov.cod
      GROUP BY v.ven_cod, v.ven_numero, v.ven_nome
      ORDER BY "totalVendaLiga" DESC
      `,
      dataIni, dataFim, entradaNovas,
    );

    const vendedoras: LinhaLiga[] = linhas.map((r) => ({
      codigoVendedora: Number(r.codigoVendedora),
      venNumero: Number(r.venNumero),
      nomeVendedora: r.nomeVendedora,
      totalVendaLiga: Number(r.totalVendaLiga),
      totalVendaNovasLiga: Number(r.totalVendaNovasLiga),
    }));

    const valorAtualCompra = Math.round(vendedoras.reduce((s, v) => s + v.totalVendaLiga, 0) * 100) / 100;

    return {
      metaGlobal,
      valorAtualCompra,
      atingiu: valorAtualCompra >= metaGlobal,
      faltaParaMeta: Math.max(0, Math.round((metaGlobal - valorAtualCompra) * 100) / 100),
      vendedoras,
    };
  }
}
