import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { CentralPgService } from 'src/services/central-pg.service';

const VALOR_MINIMO = 3200;

@Injectable()
export class FichaRiscoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly central: CentralPgService,
  ) {}

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

  /**
   * Snapshot de inicio de mes: clientes com compra liquida < R$3.200 nos 2 meses
   * fechados anteriores a mesReferencia. Idempotente - se ja existir snapshot pra
   * esse mes, retorna o que ja esta gravado (nunca recalcula/sobrescreve).
   */
  async snapshot(mesReferencia?: string) {
    const mes = this.normalizarMes(mesReferencia);

    const existentes = await this.central.query(
      `SELECT codparc, nome, valor_necessario FROM lovable_ficha_risco_historico WHERE mes_referencia = $1 ORDER BY codparc`,
      [mes],
    );
    if (existentes.rows.length > 0) {
      return { mesReferencia: mes, jaExistia: true, totalClientes: existentes.rows.length, clientes: existentes.rows };
    }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH janela AS (
        SELECT cod_cliente, data, situacao, nome_cliente, prcvenda_x_quantidade
        FROM view_base_12meses
        WHERE data >= ($1::date - interval '2 months') AND data < $1::date
      ), agregado AS (
        SELECT cod_cliente, SUM(prcvenda_x_quantidade) AS total_2m
        FROM janela GROUP BY cod_cliente
      ), recente AS (
        SELECT DISTINCT ON (cod_cliente) cod_cliente, nome_cliente, situacao
        FROM janela ORDER BY cod_cliente, data DESC
      )
      SELECT a.cod_cliente AS codparc, btrim(r.nome_cliente) AS nome, (${VALOR_MINIMO} - a.total_2m) AS valor_necessario
      FROM agregado a JOIN recente r ON r.cod_cliente = a.cod_cliente
      WHERE a.total_2m < ${VALOR_MINIMO} AND (r.situacao IS NULL OR r.situacao NOT IN (6,8,9,95))
      ORDER BY a.cod_cliente
      `,
      mes,
    );

    if (rows.length > 0) {
      const values: string[] = [];
      const params: any[] = [];
      rows.forEach((r, i) => {
        const b = i * 4;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`);
        params.push(mes, Number(r.codparc), r.nome, Number(r.valor_necessario));
      });
      await this.central.query(
        `INSERT INTO lovable_ficha_risco_historico (mes_referencia, codparc, nome, valor_necessario) VALUES ${values.join(',')}`,
        params,
      );
    }

    return { mesReferencia: mes, jaExistia: false, totalClientes: rows.length, clientes: rows };
  }

  /**
   * Fechamento: grava valor_realizado/atingiu/vendedora/loja (do fim do mes) nas
   * linhas em aberto de mesReferencia (ou o mes aberto mais antigo, se omitido).
   * Linhas ja fechadas nao sao reabertas/recalculadas.
   */
  async fechamento(mesReferencia?: string) {
    let mes: string;
    if (mesReferencia) {
      mes = this.normalizarMes(mesReferencia);
    } else {
      const aberto = await this.central.query<{ mes_referencia: Date }>(
        `SELECT mes_referencia FROM lovable_ficha_risco_historico WHERE data_snapshot_fim IS NULL ORDER BY mes_referencia ASC LIMIT 1`,
      );
      if (aberto.rows.length === 0) {
        return { mesReferencia: null, totalClientes: 0, message: 'Nenhum snapshot aberto para fechar.' };
      }
      mes = aberto.rows[0].mes_referencia.toISOString().slice(0, 10);
    }

    const abertos = await this.central.query<{ codparc: number; valor_necessario: string }>(
      `SELECT codparc, valor_necessario FROM lovable_ficha_risco_historico WHERE mes_referencia = $1 AND data_snapshot_fim IS NULL`,
      [mes],
    );
    if (abertos.rows.length === 0) {
      return { mesReferencia: mes, jaFechado: true, totalClientes: 0 };
    }
    const codparcs = abertos.rows.map((r) => Number(r.codparc));

    const realizados = await this.prisma.$queryRawUnsafe<any[]>(
      `
      WITH realizado AS (
        SELECT cod_cliente, SUM(prcvenda_x_quantidade) AS valor_realizado
        FROM view_base_12meses
        WHERE data >= $1::date AND data < ($1::date + interval '1 month')
          AND cod_cliente = ANY($2::int[])
        GROUP BY cod_cliente
      ), atribuicao AS (
        SELECT DISTINCT ON (cod_cliente) cod_cliente, ven_nome, loja, lojas_nome
        FROM view_base_12meses
        WHERE data >= ($1::date - interval '2 months') AND data < ($1::date + interval '1 month')
          AND cod_cliente = ANY($2::int[])
        ORDER BY cod_cliente, data DESC
      )
      SELECT c AS codparc,
             COALESCE(r.valor_realizado, 0) AS valor_realizado,
             btrim(a.ven_nome) AS vendedora, a.loja, btrim(a.lojas_nome) AS lojas_nome
      FROM unnest($2::int[]) AS c
      LEFT JOIN realizado r ON r.cod_cliente = c
      LEFT JOIN atribuicao a ON a.cod_cliente = c
      `,
      mes,
      codparcs,
    );

    const porCodparc = new Map<number, any>(realizados.map((r) => [Number(r.codparc), r]));
    const arrCodparc: number[] = [];
    const arrValorRealizado: number[] = [];
    const arrAtingiu: boolean[] = [];
    const arrVendedora: (string | null)[] = [];
    const arrLoja: (number | null)[] = [];
    const arrLojasNome: (string | null)[] = [];

    for (const row of abertos.rows) {
      const codparc = Number(row.codparc);
      const info = porCodparc.get(codparc);
      const valorRealizado = Number(info?.valor_realizado ?? 0);
      const atingiu = valorRealizado >= Number(row.valor_necessario);
      arrCodparc.push(codparc);
      arrValorRealizado.push(valorRealizado);
      arrAtingiu.push(atingiu);
      arrVendedora.push(info?.vendedora ?? null);
      arrLoja.push(info?.loja ?? null);
      arrLojasNome.push(info?.lojas_nome ?? null);
    }

    await this.central.query(
      `
      UPDATE lovable_ficha_risco_historico h
      SET valor_realizado = v.valor_realizado,
          atingiu = v.atingiu,
          vendedora = v.vendedora,
          loja = v.loja,
          lojas_nome = v.lojas_nome,
          data_snapshot_fim = now()
      FROM unnest($1::int[], $2::numeric[], $3::boolean[], $4::text[], $5::int[], $6::text[])
        AS v(codparc, valor_realizado, atingiu, vendedora, loja, lojas_nome)
      WHERE h.mes_referencia = $7 AND h.codparc = v.codparc AND h.data_snapshot_fim IS NULL
      `,
      [arrCodparc, arrValorRealizado, arrAtingiu, arrVendedora, arrLoja, arrLojasNome, mes],
    );

    return { mesReferencia: mes, jaFechado: false, totalClientes: abertos.rows.length };
  }

  /** So leitura do que ja esta persistido - nunca calcula ao vivo. */
  private async consultar(filtros: { mesReferencia?: string; vendedora?: string; loja?: number }) {
    const where: string[] = [];
    const params: any[] = [];
    if (filtros.mesReferencia) {
      params.push(this.normalizarMes(filtros.mesReferencia));
      where.push(`mes_referencia = $${params.length}`);
    }
    if (filtros.vendedora) {
      params.push(filtros.vendedora);
      where.push(`vendedora = $${params.length}`);
    }
    if (filtros.loja != null) {
      params.push(filtros.loja);
      where.push(`loja = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const lista = await this.central.query(
      `SELECT mes_referencia, codparc, nome, vendedora, loja, lojas_nome, valor_necessario, valor_realizado, atingiu,
              data_snapshot_inicio, data_snapshot_fim
       FROM lovable_ficha_risco_historico ${whereSql} ORDER BY mes_referencia DESC, codparc`,
      params,
    );

    const agregarPor = (campo: 'vendedora' | 'loja') => {
      const grupos = new Map<string, any>();
      for (const row of lista.rows) {
        const chave = row[campo] ?? '(sem info)';
        if (!grupos.has(chave)) {
          grupos.set(chave, { [campo]: chave, totalClientes: 0, atingiram: 0, valorNecessario: 0, valorRealizado: 0 });
        }
        const g = grupos.get(chave);
        g.totalClientes++;
        if (row.atingiu) g.atingiram++;
        g.valorNecessario += Number(row.valor_necessario || 0);
        g.valorRealizado += Number(row.valor_realizado || 0);
      }
      return [...grupos.values()];
    };

    return {
      totalClientes: lista.rows.length,
      atingiram: lista.rows.filter((r) => r.atingiu).length,
      valorNecessarioTotal: lista.rows.reduce((s, r) => s + Number(r.valor_necessario || 0), 0),
      valorRealizadoTotal: lista.rows.reduce((s, r) => s + Number(r.valor_realizado || 0), 0),
      porVendedora: agregarPor('vendedora'),
      porLoja: agregarPor('loja'),
      clientes: lista.rows,
    };
  }

  async atual() {
    const mes = this.normalizarMes();
    return { mesReferencia: mes, ...(await this.consultar({ mesReferencia: mes })) };
  }

  async historico(filtros: { mesReferencia?: string; vendedora?: string; loja?: string }) {
    return this.consultar({
      mesReferencia: filtros.mesReferencia,
      vendedora: filtros.vendedora,
      loja: filtros.loja != null ? Number(filtros.loja) : undefined,
    });
  }
}
