import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { FiltroListaDto, SuperOfensivaFiltroDto } from './dto/listas-filtro.dto';

/**
 * Listas Importantes das vendedoras. Selects validados read-only contra bd_think (jun/2026).
 * Matriz = clientes_id = clientes_id_principal (ou principal nulo); cpf da matriz = clientes_cpf_cnpj_principal.
 * Lookups por hash join unico (CLI/VEND), sem subquery correlacionada por linha.
 */
@Injectable()
export class ListasService {
  constructor(private readonly prisma: PrismaService) {}

  // cpf(14) -> is_matriz, cpf_matriz, nome, telefone.
  private readonly CLI = `(
    SELECT DISTINCT ON (cpf14) cpf14, is_matriz, cpf_matriz, nome, telefone FROM (
      SELECT
        regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') AS cpf14,
        (clientes_id_principal IS NULL OR clientes_id = clientes_id_principal) AS is_matriz,
        lpad(regexp_replace(COALESCE(NULLIF(clientes_cpf_cnpj_principal,''), clientes_cpf_cnpj),'[^0-9]','','g'),14,'0') AS cpf_matriz,
        btrim(clientes_nome) AS nome,
        NULLIF(btrim(coalesce(clientes_ddd1,'')) || ' ' || btrim(coalesce(clientes_telefone1,'')), '') AS telefone
      FROM erp_clientes_real
    ) z ORDER BY cpf14
  )`;

  // cpf(14) -> vendedora dona (mais recente). Leve: so vendedora_proprietaria + erp_vendedores.
  private readonly VEND = `(
    SELECT DISTINCT ON (doc14) doc14, codigovend, ven_nome FROM (
      SELECT regexp_replace(vp.doctoclie,'[^0-9]','','g') AS doc14,
             vp.codigovend, btrim(v.ven_nome) AS ven_nome, vp.dat_inc
      FROM vendedora_proprietaria vp
      LEFT JOIN erp_vendedores v ON v.ven_numero = vp.codigovend
    ) z ORDER BY doc14, dat_inc DESC NULLS LAST
  )`;

  private filtroVendedoraPorFs(vendedora: number | undefined, params: any[]): string {
    if (vendedora == null) return '';
    params.push(vendedora);
    return `AND lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0') IN
            (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
  }

  /** Desafio da Corrida: ordenado por quem esta mais perto das 20 estrelas. Exclui premiados. */
  async corrida(f: FiltroListaDto = {}) {
    const params: any[] = [];
    const fVend = this.filtroVendedoraPorFs(f.vendedora, params);
    const sql = `
      SELECT c.codparc, btrim(fs.nomeparc) AS nome, fs.cpfcnpj, cli.telefone,
             vend.codigovend, vend.ven_nome AS vendedora_nome,
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
      LEFT JOIN ${this.CLI} cli ON cli.cpf14 = lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = cli.cpf_matriz
      WHERE m.mesinicial <= CURRENT_DATE AND m.mesfinal >= CURRENT_DATE
        AND NOT EXISTS (SELECT 1 FROM corridas_ligafashion_premio p WHERE p.codparc = c.codparc)
        ${fVend}
      ORDER BY faltam_estrelas ASC, realizado DESC`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Top 30: consome a tabela topfashiostar (ranking oficial). 1 linha por matriz. */
  async top30(f: FiltroListaDto = {}) {
    const params: any[] = [];
    const sql = `
      SELECT x.posicao, x.cpfcnpj, cli.nome, cli.telefone, true AS is_matriz,
             vend.codigovend, vend.ven_nome AS vendedora_nome,
             ROUND(x.valor_venda, 2) AS valor_venda
      FROM (
        SELECT DISTINCT ON (COALESCE(self.cpf_matriz, 'c' || t.codparc))
               t.posicao, t.valor_venda,
               COALESCE(self.cpf_matriz, lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')) AS cpfcnpj
        FROM topfashiostar t
        LEFT JOIN adfashionstars fs ON fs.codparc = t.codparc
        LEFT JOIN ${this.CLI} self ON self.cpf14 = lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')
        WHERE 1=1
        ORDER BY COALESCE(self.cpf_matriz, 'c' || t.codparc), (self.is_matriz IS NOT TRUE), t.posicao ASC NULLS LAST
      ) x
      LEFT JOIN ${this.CLI} cli ON cli.cpf14 = x.cpfcnpj
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = x.cpfcnpj
      ORDER BY x.posicao ASC NULLS LAST, x.valor_venda DESC
      LIMIT 30`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Super Ofensiva: meses consecutivos batendo a meta (conta meses-com-meta). */
  async superOfensiva(f: SuperOfensivaFiltroDto = {}) {
    const params: any[] = [];
    let fEtapa = `AND s.meses_seguidos IN (4,5)`;
    if (f.etapa != null) {
      params.push(f.etapa);
      fEtapa = `AND s.meses_seguidos = $${params.length}`;
    }
    const fVend = this.filtroVendedoraPorFs(f.vendedora, params);
    const sql = `
      SELECT s.codparc, btrim(fs.nomeparc) AS nome, fs.cpfcnpj, cli.telefone,
             vend.codigovend, vend.ven_nome AS vendedora_nome, s.meses_seguidos
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
      LEFT JOIN ${this.CLI} cli ON cli.cpf14 = lpad(regexp_replace(fs.cpfcnpj,'[^0-9]','','g'),14,'0')
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = cli.cpf_matriz
      WHERE s.last_rnk = (SELECT count(*) FROM ofensiva_ligafashion_meta WHERE mes_ref <= date_trunc('month', CURRENT_DATE))
        ${fEtapa}
        ${fVend}
      ORDER BY s.meses_seguidos DESC, nome`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Aniversariantes do mes, 1 linha por MATRIZ. */
  async aniversariantes(f: FiltroListaDto = {}) {
    const params: any[] = [];
    let fVend = '';
    if (f.vendedora != null) {
      params.push(f.vendedora);
      fVend = `AND regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') IN
               (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
    }
    const sql = `
      SELECT m.cpf_matriz, btrim(m.nome_matriz) AS nome, m.nascimento, true AS is_matriz,
             vend.codigovend, vend.ven_nome AS vendedora_nome,
             EXTRACT(DAY FROM m.nascimento)::int AS dia_aniv,
             (EXTRACT(MONTH FROM CURRENT_DATE) = EXTRACT(MONTH FROM m.nascimento)) AS mes_aniversario,
             (CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= EXTRACT(MONTH FROM m.nascimento)
                   THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int,     EXTRACT(MONTH FROM m.nascimento)::int, 1) - CURRENT_DATE
                   ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM m.nascimento)::int, 1) - CURRENT_DATE
              END) AS dias_para_mes_aniversario,
             NULLIF(btrim(coalesce(m.ddd,'')) || ' ' || btrim(coalesce(m.fone,'')), '') AS telefone
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
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = lpad(regexp_replace(m.cpf_matriz,'[^0-9]','','g'),14,'0')
      WHERE EXTRACT(MONTH FROM m.nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY dia_aniv`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /** Desativacao: 1 linha por MATRIZ (soma vinculados). Media 3 meses < R$3.200. Ordena por mais risco. */
  async desativacao(f: FiltroListaDto = {}) {
    const params: any[] = [];
    let fVend = '';
    if (f.vendedora != null) {
      params.push(f.vendedora);
      fVend = `AND regexp_replace(p.doctoclie,'[^0-9]','','g') IN
               (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
    }
    const sql = `
      SELECT agg.cpf_matriz AS cpfcnpj, cli.nome, cli.telefone, true AS is_matriz,
        vend.codigovend, vend.ven_nome AS vendedora_nome,
        ROUND(agg.total_3m,2)               AS total_3m,
        ROUND(agg.total_3m/3,2)             AS media_3m,
        ROUND(agg.mes_atual,2)              AS comprou_no_mes,
        (agg.mes_atual = 0)                 AS zerou_mes,
        GREATEST(0, ROUND(9600 - agg.total_3m,2)) AS falta_comprar_mes
      FROM (
        SELECT COALESCE(map.cpf_matriz, regexp_replace(p.doctoclie,'[^0-9]','','g')) AS cpf_matriz,
          SUM(COALESCE(p.totalgeral,0)) AS total_3m,
          SUM(CASE WHEN p.data >= date_trunc('month',CURRENT_DATE) THEN COALESCE(p.totalgeral,0) ELSE 0 END) AS mes_atual
        FROM erp_pedidos p
        LEFT JOIN ${this.CLI} map ON map.cpf14 = regexp_replace(p.doctoclie,'[^0-9]','','g')
        WHERE p.cancelado IS DISTINCT FROM 'S'
          AND p.data >= date_trunc('month',CURRENT_DATE) - INTERVAL '2 months'
          AND p.data <  date_trunc('month',CURRENT_DATE) + INTERVAL '1 month'
          ${fVend}
        GROUP BY 1
      ) agg
      LEFT JOIN ${this.CLI} cli ON cli.cpf14 = agg.cpf_matriz
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = agg.cpf_matriz
      WHERE agg.total_3m < 9600
      ORDER BY zerou_mes DESC, falta_comprar_mes DESC`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }
}
