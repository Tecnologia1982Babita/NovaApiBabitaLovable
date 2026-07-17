import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { FichaRiscoQueryDto } from './dto/ficha-risco-query.dto';

const VALOR_MINIMO = 3200;

@Injectable()
export class FichaRiscoService {
  constructor(private readonly prisma: PrismaService) {}

  // cpf(14) -> vendedora dona (mais recente). Mesmo CTE de ClientesService/listas.
  private readonly VEND = `(
    SELECT DISTINCT ON (doc14) doc14, codigovend, ven_nome FROM (
      SELECT regexp_replace(vp.doctoclie,'[^0-9]','','g') AS doc14,
             vp.codigovend, btrim(v.ven_nome) AS ven_nome, vp.dat_inc
      FROM vendedora_proprietaria vp
      LEFT JOIN erp_vendedores v ON v.ven_numero = vp.codigovend
    ) z ORDER BY doc14, dat_inc DESC NULLS LAST
  )`;

  /** Normaliza "YYYY-MM" ou "YYYY-MM-DD" para o dia 1 do mes; omitido = mes corrente. */
  private normalizarMes(mesReferencia?: string): string {
    if (mesReferencia) {
      const m = mesReferencia.match(/^(\d{4})-(\d{2})/);
      if (!m) throw new BadRequestException('mesReferencia invalido (use YYYY-MM)');
      return `${m[1]}-${m[2]}-01`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private agregarPor(linhas: any[], campo: 'vendedora' | 'loja') {
    const grupos = new Map<string, any>();
    for (const row of linhas) {
      const chave = row[campo] ?? '(sem info)';
      if (!grupos.has(chave)) {
        grupos.set(chave, { [campo]: chave, totalClientes: 0, atingiram: 0, valorNecessario: 0, valorRealizado: 0 });
      }
      const g = grupos.get(chave);
      g.totalClientes++;
      if (row.atingiu) g.atingiram++;
      g.valorNecessario += row.valor_necessario;
      g.valorRealizado += row.valor_realizado;
    }
    return [...grupos.values()];
  }

  /**
   * Clientes em risco de perder ficha: compra liquida < R$3.200 nos 2 meses-calendario
   * fechados anteriores a mesReferencia. Calculado ao vivo em view_base_12meses, sem
   * persistencia - valor_necessario/valor_realizado sao deterministicos, entao a mesma
   * rota serve tanto o mes corrente (parcial, reflete o estado atual da view) quanto
   * qualquer mes passado (ja fechado) so trocando mesReferencia.
   */
  async calcular(query: FichaRiscoQueryDto) {
    const mes = this.normalizarMes(query.mesReferencia);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH janela AS (
        SELECT cod_cliente, data, situacao, nome_cliente, doc_cliente, ven_nome, loja, prcvenda_x_quantidade
        FROM view_base_12meses
        WHERE data >= ($1::date - interval '2 months') AND data < ($1::date + interval '1 month')
      ),
      fechados AS (
        SELECT cod_cliente, SUM(prcvenda_x_quantidade) AS meses_fechados
        FROM janela WHERE data < $1::date GROUP BY cod_cliente
      ),
      realizado AS (
        SELECT cod_cliente, SUM(prcvenda_x_quantidade) AS valor_realizado
        FROM janela WHERE data >= $1::date GROUP BY cod_cliente
      ),
      recente AS (
        SELECT DISTINCT ON (cod_cliente) cod_cliente, nome_cliente, doc_cliente, situacao, ven_nome, loja
        FROM janela ORDER BY cod_cliente, data DESC
      )
      SELECT
        f.cod_cliente AS codparc,
        btrim(r.nome_cliente) AS nome,
        COALESCE(btrim(vend.ven_nome), btrim(r.ven_nome)) AS vendedora,
        r.loja AS loja,
        (${VALOR_MINIMO} - f.meses_fechados) AS valor_necessario,
        COALESCE(rl.valor_realizado, 0) AS valor_realizado,
        (f.meses_fechados + COALESCE(rl.valor_realizado, 0)) >= ${VALOR_MINIMO} AS atingiu
      FROM fechados f
      JOIN recente r ON r.cod_cliente = f.cod_cliente
      LEFT JOIN realizado rl ON rl.cod_cliente = f.cod_cliente
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = regexp_replace(r.doc_cliente,'[^0-9]','','g')
      WHERE f.meses_fechados < ${VALOR_MINIMO}
        AND (r.situacao IS NULL OR r.situacao NOT IN (6,8,9,95))
      ORDER BY f.cod_cliente
      `,
      mes,
    );

    const clientes = rows
      .map((r) => ({
        codparc: Number(r.codparc),
        nome: r.nome,
        vendedora: r.vendedora,
        loja: r.loja != null ? Number(r.loja) : null,
        valor_necessario: Number(r.valor_necessario),
        valor_realizado: Number(r.valor_realizado),
        atingiu: r.atingiu,
      }))
      .filter(
        (c) =>
          (!query.vendedora || c.vendedora === query.vendedora.trim()) &&
          (query.loja == null || c.loja === Number(query.loja)),
      );

    return {
      mesReferencia: mes,
      totalClientes: clientes.length,
      atingiram: clientes.filter((c) => c.atingiu).length,
      valorNecessarioTotal: clientes.reduce((s, c) => s + c.valor_necessario, 0),
      valorRealizadoTotal: clientes.reduce((s, c) => s + c.valor_realizado, 0),
      porVendedora: this.agregarPor(clientes, 'vendedora'),
      porLoja: this.agregarPor(clientes, 'loja'),
      clientes,
    };
  }
}
