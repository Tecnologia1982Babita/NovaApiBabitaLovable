import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { FiltroListaDto, SuperOfensivaFiltroDto } from './dto/listas-filtro.dto';

/**
 * Listas Importantes das vendedoras (Liga / Premiacoes + Desativacao + Aniversariantes).
 * Selects validados read-only contra bd_think (jun/2026).
 *
 * Perf: o lookup de nome/telefone do cliente sai de erp_clientes_real em UMA varredura
 * (CLIENTES, com DISTINCT ON cpf14) e entra como hash join — evita subquery correlacionada
 * por linha (que estava deixando corrida ~10s e desativacao em timeout).
 *
 * Pendencia: filtro empresa MG/ML (mapeamento empresa<->loja) nao implementado.
 * Valores numericos voltam como string (numeric do Postgres); o front faz o parse.
 */
@Injectable()
export class ListasService {
  constructor(private readonly prisma: PrismaService) {}

  // cpf/cnpj normalizado a 14 digitos -> nome + telefone (uma linha por cpf).
  private readonly CLIENTES = `(
    SELECT DISTINCT ON (cpf14) cpf14, nome, telefone FROM (
      SELECT regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') AS cpf14,
             btrim(clientes_nome) AS nome,
             NULLIF(btrim(coalesce(clientes_ddd1,'')) || ' ' || btrim(coalesce(clientes_telefone1,'')), '') AS telefone
      FROM erp_clientes_real
    ) z ORDER BY cpf14
  )`;

  // Restringe aos clientes (codparc->cpf da fashionstar, padded 14) da vendedora.
  private filtroVendedoraPorFs(vendedora: number | undefined, params: any[]): string {
    if (vendedora == null) return '';
    params.push(vendedora);
    return `AND lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0') IN
            (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
  }

  /** Desafio da Corrida: estrelas atuais, falta p/ 20, ritmo do dia + cor. Exclui premiados. */
  async corrida(f: FiltroListaDto = {}) {
    const params: any[] = [];
    const fVend = this.filtroVendedoraPorFs(f.vendedora, params);
    const sql = `
      SELECT c.codparc, btrim(fs.nomeparc) AS nome, fs.cpfcnpj, cli.telefone,
             ROUND(c.valor_total,2) AS realizado,
             LEAST(20, FLOOR(c.valor_total / m.valor_estrela))::int        AS estrelas,
             (20 - LEAST(20, FLOOR(c.valor_total / m.valor_estrela)))::int AS faltam_estrelas,
             GREATEST(0, ROUND(m.valor_meta - c.valor_total,2))            AS falta_para_20,
             ROUND(m.valor_meta / (m.mesfinal - m.mesinicial),2)           AS meta_diaria,
             (LEAST(CURRENT_DATE, m.mesfinal) - m.mesinicial + 1)          AS dias_decorridos,
             ROUND(m.valor_meta / (m.mesfinal - m.mesinicial)
                   * (LEAST(CURRENT_DATE, m.mesfinal) - m.mesinicial + 1), 2) AS esperado_ate_hoje,
             CASE
               WHEN c.valor_total >=        (m.valor_meta/(m.mesfinal-m.mesinicial))*(LEAST(CURRENT_DATE,m.mesfinal)-m.mesinicial+1) THEN 'verde'
               WHEN c.valor_total >= 0.95 * (m.valor_meta/(m.mesfinal-m.mesinicial))*(LEAST(CURRENT_DATE,m.mesfinal)-m.mesinicial+1) THEN 'amarelo'
               ELSE 'vermelho'
             END AS cor
      FROM corridas_ligafashion_compra_mes c
      JOIN corridas_ligafashion_meta m ON m.mesinicial = c.mesinicial AND m.mesfinal = c.mesfinal
      LEFT JOIN adfashionstars fs ON fs.codparc = c.codparc
      LEFT JOIN ${this.CLIENTES} cli ON cli.cpf14 = lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')
      WHERE m.mesinicial <= CURRENT_DATE AND m.mesfinal >= CURRENT_DATE
        AND NOT EXISTS (SELECT 1 FROM corridas_ligafashion_premio p WHERE p.codparc = c.codparc)
        ${fVend}
      ORDER BY faltam_estrelas ASC, realizado DESC`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Top 30 do mes (topfashiostar ja ranqueado). */
  async top30(f: FiltroListaDto = {}) {
    const params: any[] = [];
    const fVend = this.filtroVendedoraPorFs(f.vendedora, params);
    const sql = `
      SELECT t.posicao, t.codparc, btrim(fs.nomeparc) AS nome, fs.cpfcnpj, cli.telefone,
             ROUND(t.valor_venda,2) AS valor_venda
      FROM topfashiostar t
      LEFT JOIN adfashionstars fs ON fs.codparc = t.codparc
      LEFT JOIN ${this.CLIENTES} cli ON cli.cpf14 = lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')
      WHERE 1=1 ${fVend}
      ORDER BY t.posicao ASC NULLS LAST, t.valor_venda DESC
      LIMIT 30`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Super Ofensiva: meses consecutivos batendo a meta (conta meses-com-meta; ignora mes sem meta). */
  async superOfensiva(f: SuperOfensivaFiltroDto = {}) {
    const params: any[] = [];
    let fEtapa = `AND s.meses_seguidos IN (4,5)`;
    if (f.etapa != null) {
      params.push(f.etapa);
      fEtapa = `AND s.meses_seguidos = $${params.length}`;
    }
    const fVend = this.filtroVendedoraPorFs(f.vendedora, params);
    const sql = `
      SELECT s.codparc, btrim(fs.nomeparc) AS nome, fs.cpfcnpj, cli.telefone, s.meses_seguidos
      FROM (
        SELECT codparc, count(*)::int AS meses_seguidos, max(rnk) AS last_rnk
        FROM (
          SELECT codparc, rnk, rnk - row_number() OVER (PARTITION BY codparc ORDER BY rnk) AS grp
          FROM (
            SELECT c.codparc, mr.rnk, (c.valor_total >= mr.valor_meta) AS hit
            FROM ofensiva_ligafashion_compra_mes c
            JOIN (
              SELECT mes_ref, valor_meta, row_number() OVER (ORDER BY mes_ref) AS rnk
              FROM ofensiva_ligafashion_meta
              WHERE mes_ref <= date_trunc('month', CURRENT_DATE)
            ) mr ON mr.mes_ref = c.mes_ref
          ) b WHERE hit
        ) g GROUP BY codparc, grp
      ) s
      LEFT JOIN adfashionstars fs ON fs.codparc = s.codparc
      LEFT JOIN ${this.CLIENTES} cli ON cli.cpf14 = lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')
      WHERE s.last_rnk = (SELECT count(*) FROM ofensiva_ligafashion_meta WHERE mes_ref <= date_trunc('month', CURRENT_DATE))
        ${fEtapa}
        ${fVend}
      ORDER BY s.meses_seguidos DESC, nome`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Aniversariantes do mes, 1 linha por MATRIZ (vinculados agrupados por cpf principal). */
  async aniversariantes(f: FiltroListaDto = {}) {
    const params: any[] = [];
    let fVend = '';
    if (f.vendedora != null) {
      params.push(f.vendedora);
      fVend = `AND regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') IN
               (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
    }
    const sql = `
      SELECT cpf_matriz, btrim(nome_matriz) AS nome, nascimento,
             EXTRACT(DAY FROM nascimento)::int AS dia_aniv,
             (EXTRACT(MONTH FROM CURRENT_DATE) = EXTRACT(MONTH FROM nascimento)) AS mes_aniversario,
             (CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= EXTRACT(MONTH FROM nascimento)
                   THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,     EXTRACT(MONTH FROM nascimento)::int, 1) - CURRENT_DATE
                   ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM nascimento)::int, 1) - CURRENT_DATE
              END) AS dias_para_mes_aniversario,
             NULLIF(btrim(coalesce(ddd,'')) || ' ' || btrim(coalesce(fone,'')), '') AS telefone
      FROM (
        SELECT DISTINCT ON (clientes_cpf_cnpj_principal)
               clientes_cpf_cnpj_principal   AS cpf_matriz,
               clientes_nome_principal       AS nome_matriz,
               clientes_nascimento_principal AS nascimento,
               clientes_ddd1_principal       AS ddd,
               clientes_telefone1_principal  AS fone
        FROM erp_clientes_real
        WHERE clientes_nascimento_principal IS NOT NULL
          ${fVend}
        ORDER BY clientes_cpf_cnpj_principal
      ) m
      WHERE EXTRACT(MONTH FROM nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY dia_aniv`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Desativacao: media de compra dos 3 ultimos meses < R$3.200. Mostra quanto falta comprar. */
  async desativacao(f: FiltroListaDto = {}) {
    const params: any[] = [];
    let fVend = '';
    if (f.vendedora != null) {
      params.push(f.vendedora);
      fVend = `AND regexp_replace(doctoclie,'[^0-9]','','g') IN
               (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
    }
    const sql = `
      SELECT agg.doc AS cpfcnpj, cli.nome, cli.telefone,
        ROUND(agg.total_3m,2)               AS total_3m,
        ROUND(agg.total_3m/3,2)             AS media_3m,
        ROUND(agg.mes_atual,2)              AS comprou_no_mes,
        (agg.mes_atual = 0)                 AS zerou_mes,
        GREATEST(0, ROUND(9600 - agg.total_3m,2)) AS falta_comprar_mes
      FROM (
        SELECT regexp_replace(doctoclie,'[^0-9]','','g') AS doc,
          SUM(COALESCE(totalgeral,0)) AS total_3m,
          SUM(CASE WHEN data >= date_trunc('month',CURRENT_DATE) THEN COALESCE(totalgeral,0) ELSE 0 END) AS mes_atual
        FROM erp_pedidos
        WHERE cancelado IS DISTINCT FROM 'S'
          AND data >= date_trunc('month',CURRENT_DATE) - INTERVAL '2 months'
          AND data <  date_trunc('month',CURRENT_DATE) + INTERVAL '1 month'
          ${fVend}
        GROUP BY regexp_replace(doctoclie,'[^0-9]','','g')
      ) agg
      LEFT JOIN ${this.CLIENTES} cli ON cli.cpf14 = agg.doc
      WHERE agg.total_3m < 9600
      ORDER BY falta_comprar_mes ASC`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }
}
