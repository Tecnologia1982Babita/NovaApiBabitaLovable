import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { ClienteComprasDto } from './dto/cliente-compras.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  // cpf(14) -> vendedora dona (mais recente).
  private readonly VEND = `(
    SELECT DISTINCT ON (doc14) doc14, codigovend, ven_nome FROM (
      SELECT regexp_replace(vp.doctoclie,'[^0-9]','','g') AS doc14,
             vp.codigovend, btrim(v.ven_nome) AS ven_nome, vp.dat_inc
      FROM vendedora_proprietaria vp
      LEFT JOIN erp_vendedores v ON v.ven_numero = vp.codigovend
    ) z ORDER BY doc14, dat_inc DESC NULLS LAST
  )`;

  // Situacoes de cliente ocultas em todas as rotas (6=ABERTO, 8=EM ATENDIMENTO, 9=AGENDADO, 95).
  private sitOk(alias: string): string {
    return `COALESCE(${alias}.clientes_id_situacao,-1) NOT IN (6,8,9,95)`;
  }

  // Telefone = celular (clientes_telefone2), fallback fixo. Igual a /clientes/ativos e /listas,
  // mas NULL em vez de " " quando o cliente nao tem nenhum dos dois.
  private telefone(alias: string): string {
    return `CASE WHEN regexp_replace(COALESCE(${alias}.clientes_telefone2,''),'[^0-9]','','g') ~ '[1-9]'
                 THEN NULLIF(btrim(btrim(COALESCE(${alias}.clientes_ddd2,'')) || ' ' || btrim(COALESCE(${alias}.clientes_telefone2,''))), '')
                 ELSE NULLIF(btrim(btrim(COALESCE(${alias}.clientes_ddd1,'')) || ' ' || btrim(COALESCE(${alias}.clientes_telefone1,''))), '')
            END`;
  }

  /** true quando a string tem pelo menos um digito (CPF/CNPJ utilizavel). */
  private temDigito(valor?: string): boolean {
    return /\d/.test(String(valor ?? ''));
  }

  /**
   * Compra do cliente (liquido = erp_pedidos - erp_trocas), somando os cadastros vinculados (matriz).
   *
   * Dois formatos de resposta:
   * - `granularidade` "mes" (default) / "dia": UM cpf quebrado por periodo (comportamento historico),
   *   agora tambem com a identidade do parceiro (codparc, codparc_matriz, is_matriz, cpfcnpj_matriz).
   * - `granularidade` "total": 1 item por MATRIZ, ja consolidando os vinculados - aceita `cpfs[]`
   *   (lote) ou `vendedora` sem cpf, trocando ~1 chamada por CPF por uma unica.
   *
   * Janela: periodo (dataIni/dataFim) > mes > ultimos `meses` (12).
   */
  async comprasPorMes(dto: ClienteComprasDto) {
    const cpfsLote = (dto.cpfs ?? []).filter((c) => this.temDigito(c));
    const cpfUnico = this.temDigito(dto.cpf) ? String(dto.cpf) : null;

    if (dto.cpfs?.length && cpfsLote.length === 0) {
      throw new BadRequestException('cpfs[] nao tem nenhum CPF/CNPJ com digitos');
    }
    if (cpfsLote.length === 0 && !cpfUnico && dto.vendedora == null) {
      throw new BadRequestException('informe cpf, cpfs[] ou vendedora');
    }

    // Lote = cpfs[] ou vendedora sem cpf; nos dois casos a resposta e 1 item por matriz.
    const emLote = cpfsLote.length > 0 || !cpfUnico;
    if (emLote && dto.granularidade && dto.granularidade !== 'total') {
      throw new BadRequestException(
        'cpfs[] e vendedora sem cpf devolvem 1 item por matriz: use granularidade "total"',
      );
    }
    if (emLote || dto.granularidade === 'total') {
      return this.totalPorMatriz(dto, cpfUnico ? [...cpfsLote, cpfUnico] : cpfsLote);
    }

    const rows = await this.comprasPorMesRun(dto);
    if (dto.vendedora != null && rows.length === 0) {
      return this.comprasPorMesRun({ ...dto, vendedora: undefined });
    }
    return rows;
  }

  /**
   * Condicao da janela sobre a coluna `data`: periodo (dataIni/dataFim) > mes > ultimos `meses` (12).
   * Empilha os valores em `params` (a numeracao dos $ segue o tamanho do array).
   */
  private montaJanela(dto: ClienteComprasDto, params: any[]): string {
    if (dto.dataIni || dto.dataFim) {
      const conds: string[] = [];
      if (dto.dataIni) { params.push(dto.dataIni); conds.push(`data >= $${params.length}::date`); }
      if (dto.dataFim) { params.push(dto.dataFim); conds.push(`data <= $${params.length}::date`); }
      return conds.join(' AND ');
    }
    if (dto.mes) {
      params.push(dto.mes);
      const i = params.length;
      return `data >= ($${i} || '-01')::date AND data < (($${i} || '-01')::date + interval '1 month')`;
    }
    const meses = dto.meses && dto.meses > 0 ? dto.meses : 12;
    params.push(meses);
    return `data >= date_trunc('month', CURRENT_DATE) - make_interval(months => $${params.length}::int - 1)`;
  }

  /**
   * granularidade "total": 1 item por MATRIZ, com os parceiros vinculados ja consolidados
   * ({cpfcnpj, codparc, cpfcnpj_matriz, codparc_matriz, is_matriz, nome, telefone,
   * vendedora_nome, codigovend, valor_total}). Dois CPFs da mesma matriz colapsam numa
   * linha so - o valor nao se repete e somar a resposta nao conta em dobro.
   *
   * Uma unica ida ao banco para o lote todo: erp_pedidos/erp_trocas nao tem indice por
   * doctoclie, entao varrer o periodo UMA vez para N clientes e o que substitui as N
   * chamadas por CPF. `cpfs` vazio = modo vendedora (clientes de que ela e a dona hoje).
   *
   * O grupo de cada matriz e o mesmo da consulta por CPF: os cadastros visiveis vinculados
   * a ela MAIS os CPFs pedidos que caem nela (a rota por CPF sempre soma o CPF perguntado,
   * mesmo oculto/sem cadastro) - por isso os valores batem com os da consulta individual.
   * Matriz sem movimento no periodo tambem volta, com valor_total 0.
   */
  private async totalPorMatriz(dto: ClienteComprasDto, cpfs: string[]) {
    const params: any[] = [];
    let entrada: string;
    if (cpfs.length > 0) {
      params.push(cpfs);
      entrada = `SELECT DISTINCT lpad(regexp_replace(x,'[^0-9]','','g'),14,'0') AS cpf_in
                 FROM unnest($${params.length}::text[]) AS x`;
    } else {
      params.push(dto.vendedora);
      entrada = `SELECT doc14 AS cpf_in FROM vend WHERE codigovend = $${params.length}`;
    }
    const janela = this.montaJanela(dto, params);

    const sql = `
      WITH vend AS ${this.VEND},
      entrada AS (
        ${entrada}
      ),
      alvo AS (
        -- CPF pedido -> matriz dele (cpf_matriz = principal, ou ele mesmo quando nao ha cadastro visivel)
        SELECT DISTINCT ON (e.cpf_in)
               e.cpf_in,
               NULLIF(c.clientes_cpf_cnpj_principal,'') AS principal,
               lpad(regexp_replace(COALESCE(NULLIF(c.clientes_cpf_cnpj_principal,''), e.cpf_in),'[^0-9]','','g'),14,'0') AS cpf_matriz,
               btrim(c.clientes_nome) AS nome,
               ${this.telefone('c')} AS telefone
        FROM entrada e
        LEFT JOIN erp_clientes_real c
               ON c.clientes_cpf_cnpj = e.cpf_in
              AND ${this.sitOk('c')}
        ORDER BY e.cpf_in, c.clientes_id DESC NULLS LAST
      ),
      cadastros AS (
        -- vinculados visiveis da matriz + os proprios CPFs pedidos (UNION dedupa: nao conta 2x)
        SELECT a.cpf_matriz, c.clientes_cpf_cnpj AS cad
        FROM alvo a
        JOIN erp_clientes_real c
          ON NULLIF(c.clientes_cpf_cnpj_principal,'') = a.principal
         AND ${this.sitOk('c')}
        UNION
        SELECT a.cpf_matriz, a.cpf_in FROM alvo a
      ),
      matriz AS (
        -- identidade da propria matriz (codparc/nome/telefone), quando ela tem cadastro visivel
        SELECT DISTINCT ON (a.cpf_matriz)
               a.cpf_matriz,
               m.clientes_id AS codparc,
               btrim(m.clientes_nome) AS nome,
               ${this.telefone('m')} AS telefone
        FROM alvo a
        LEFT JOIN erp_clientes_real m
               ON m.clientes_cpf_cnpj = a.cpf_matriz
              AND ${this.sitOk('m')}
        ORDER BY a.cpf_matriz, m.clientes_id DESC NULLS LAST
      ),
      rotulo AS (
        -- matriz oculta: rotula pelo membro pedido que tem cadastro visivel (nunca expoe cliente oculto)
        SELECT DISTINCT ON (cpf_matriz) cpf_matriz, nome, telefone
        FROM alvo WHERE nome IS NOT NULL OR telefone IS NOT NULL
        ORDER BY cpf_matriz, cpf_in
      ),
      mov AS (
        SELECT c.cpf_matriz, COALESCE(p.totalgeral,0) AS valor
        FROM cadastros c
        JOIN erp_pedidos p ON p.doctoclie = c.cad
        WHERE p.cancelado IS DISTINCT FROM 'S'
          AND ${janela}
        UNION ALL
        SELECT c.cpf_matriz, -COALESCE(t.totalgeral,0)
        FROM cadastros c
        JOIN erp_trocas t ON t.doctoclie = c.cad
        WHERE COALESCE(t.cancelado,'N') = 'N'
          AND ${janela}
      ),
      soma AS (
        SELECT cpf_matriz, SUM(valor) AS valor_total FROM mov GROUP BY cpf_matriz
      )
      SELECT m.cpf_matriz AS cpfcnpj,
             m.codparc,
             m.cpf_matriz AS cpfcnpj_matriz,
             NULL::int AS codparc_matriz,
             true AS is_matriz,
             COALESCE(m.nome, r.nome) AS nome,
             COALESCE(m.telefone, r.telefone) AS telefone,
             v.ven_nome AS vendedora_nome,
             v.codigovend,
             COALESCE(s.valor_total, 0)::numeric(14,2) AS valor_total
      FROM matriz m
      LEFT JOIN rotulo r ON r.cpf_matriz = m.cpf_matriz
      LEFT JOIN soma s ON s.cpf_matriz = m.cpf_matriz
      LEFT JOIN vend v ON v.doc14 = m.cpf_matriz
      ORDER BY m.cpf_matriz`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  private async comprasPorMesRun(dto: ClienteComprasDto) {
    const params: any[] = [dto.cpf]; // $1
    const dateCond = this.montaJanela(dto, params);

    let fVendCad = '';
    let unirInput = `UNION SELECT lpad(regexp_replace($1,'[^0-9]','','g'),14,'0')`;
    if (dto.vendedora != null) {
      params.push(dto.vendedora);
      fVendCad = `AND regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') IN
                  (SELECT regexp_replace(doctoclie,'[^0-9]','','g') FROM vendedora_proprietaria WHERE codigovend = $${params.length})`;
      unirInput = ''; // com filtro de vendedora nao forca o cpf de entrada
    }

    const porDia = dto.granularidade === 'dia';
    const bucket = porDia ? `data::date` : `DATE_TRUNC('month', data)::date`;
    const label = porDia
      ? `to_char(ref,'YYYY-MM-DD') AS dia, ref AS data_ref`
      : `to_char(ref,'YYYY-MM') AS mes, ref AS mes_ref`;

    const sql = `
      WITH alvo AS (
        SELECT clientes_cpf_cnpj_principal AS principal,
               clientes_id AS codparc,
               clientes_id_principal AS codparc_principal,
               (clientes_id_principal IS NULL OR clientes_id = clientes_id_principal) AS is_matriz
        FROM erp_clientes_real
        WHERE regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') = lpad(regexp_replace($1,'[^0-9]','','g'),14,'0')
          AND COALESCE(clientes_id_situacao,-1) NOT IN (6,8,9,95)
        LIMIT 1
      ),
      matrizcpf AS (
        SELECT lpad(regexp_replace(COALESCE(NULLIF((SELECT principal FROM alvo),''), $1),'[^0-9]','','g'),14,'0') AS cpf_matriz
      ),
      vendinfo AS (
        SELECT codigovend, ven_nome FROM ${this.VEND} v
        WHERE v.doc14 = (SELECT cpf_matriz FROM matrizcpf) LIMIT 1
      ),
      cadastros AS (
        SELECT clientes_cpf_cnpj AS cpf FROM erp_clientes_real
        WHERE clientes_cpf_cnpj_principal = (SELECT principal FROM alvo)
          AND COALESCE(clientes_id_situacao,-1) NOT IN (6,8,9,95)
          ${fVendCad}
        ${unirInput}
      ),
      mov AS (
        SELECT ${bucket} AS ref, COALESCE(totalgeral,0) AS valor
        FROM erp_pedidos
        WHERE doctoclie IN (SELECT cpf FROM cadastros)
          AND cancelado IS DISTINCT FROM 'S'
          AND ${dateCond}
        UNION ALL
        SELECT ${bucket}, -COALESCE(totalgeral,0)
        FROM erp_trocas
        WHERE doctoclie IN (SELECT cpf FROM cadastros)
          AND COALESCE(cancelado,'N') = 'N'
          AND ${dateCond}
      )
      SELECT ${label}, ROUND(SUM(valor),2) AS valor_total,
             (SELECT codparc FROM alvo) AS codparc,
             (SELECT cpf_matriz FROM matrizcpf) AS cpfcnpj_matriz,
             CASE WHEN (SELECT is_matriz FROM alvo) THEN NULL ELSE (SELECT codparc_principal FROM alvo) END AS codparc_matriz,
             COALESCE((SELECT is_matriz FROM alvo), true) AS is_matriz,
             (SELECT codigovend FROM vendinfo) AS codigovend,
             (SELECT ven_nome FROM vendinfo) AS vendedora_nome
      FROM mov
      GROUP BY ref
      ORDER BY ref`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }

  /**
   * Clientes ativos: compras liquidas (view_base_12meses.prcvenda_x_quantidade, ja assinado
   * PEDIDO=+/TROCA=-) >= R$1 nos ultimos 6 meses-calendario fechados (mes corrente excluido).
   * Oculta situacao 6/8/9/95. 1 linha por cliente (registro mais recente da janela).
   * Telefone = celular (clientes_telefone2), fallback fixo (clientes_telefone1).
   * Vendedora = vendedora_proprietaria (dona do cliente, mesmo padrao de /listas e
   * /clientes/compras-mes); so cai pra vendedora da ultima venda (view_base_12meses)
   * se o cliente nao tiver registro em vendedora_proprietaria (raro - fallback "ultimo caso").
   *
   * Identidade da MATRIZ em cada linha (is_matriz, codparc_matriz, cpfcnpj_matriz, nome_matriz,
   * nascimento_matriz, matriz_oculta): vem do vinculo do proprio cadastro em erp_clientes_real
   * (clientes_id_principal -> a linha da matriz), nao de heuristica por nome/telefone.
   * Matriz nao tem principal, entao ela e a propria matriz: codparc_matriz = codparc e
   * is_matriz = true (nunca null - a chave de agrupamento serve pros dois casos).
   * nascimento_matriz e a data do cadastro da matriz: quando a matriz e CPF isso e o
   * aniversario da pessoa fisica (que e o que as acoes de aniversario querem); quando a
   * matriz e CNPJ e a data de abertura da empresa. matriz_oculta avisa que o cadastro da
   * matriz esta em situacao oculta (6/8/9/95) - a linha continua sendo do cliente visivel.
   */
  async listarAtivos() {
    const sql = `
      WITH janela AS (
        SELECT cod_cliente, data, situacao, nome_cliente, doc_cliente, ven_nome, prcvenda_x_quantidade
        FROM view_base_12meses
        WHERE data >= date_trunc('month', CURRENT_DATE) - interval '6 months'
          AND data <  date_trunc('month', CURRENT_DATE)
      ),
      agregado AS (
        SELECT cod_cliente, SUM(prcvenda_x_quantidade) AS total_liquido
        FROM janela GROUP BY cod_cliente
        HAVING SUM(prcvenda_x_quantidade) >= 1
      ),
      recente AS (
        SELECT DISTINCT ON (cod_cliente) cod_cliente, nome_cliente, doc_cliente, situacao, ven_nome
        FROM janela ORDER BY cod_cliente, data DESC
      )
      SELECT
        r.cod_cliente AS codparc,
        btrim(r.nome_cliente) AS nome,
        r.doc_cliente AS cpfcnpj,
        CASE WHEN regexp_replace(coalesce(ecr.clientes_telefone2,''),'[^0-9]','','g') ~ '[1-9]'
             THEN NULLIF(btrim(coalesce(ecr.clientes_ddd2,'')) || ' ' || btrim(coalesce(ecr.clientes_telefone2,'')), '')
             ELSE NULLIF(btrim(coalesce(ecr.clientes_ddd1,'')) || ' ' || btrim(coalesce(ecr.clientes_telefone1,'')), '')
        END AS telefone,
        r.situacao AS situacao,
        COALESCE(btrim(vend.ven_nome), btrim(r.ven_nome)) AS vendedora,
        -- matriz: vinculo real do cadastro (clientes_id_principal); matriz e a propria matriz
        (COALESCE(mtz.clientes_id, ecr.clientes_id, r.cod_cliente) = COALESCE(ecr.clientes_id, r.cod_cliente)) AS is_matriz,
        COALESCE(mtz.clientes_id, ecr.clientes_id, r.cod_cliente) AS codparc_matriz,
        COALESCE(mtz.clientes_cpf_cnpj, ecr.clientes_cpf_cnpj,
                 lpad(regexp_replace(COALESCE(r.doc_cliente,''),'[^0-9]','','g'),14,'0')) AS cpfcnpj_matriz,
        btrim(COALESCE(mtz.clientes_nome, ecr.clientes_nome, r.nome_cliente)) AS nome_matriz,
        COALESCE(mtz.clientes_nascimento, ecr.clientes_nascimento) AS nascimento_matriz,
        (COALESCE(mtz.clientes_id_situacao, ecr.clientes_id_situacao, -1) IN (6,8,9,95)) AS matriz_oculta
      FROM agregado a
      JOIN recente r ON r.cod_cliente = a.cod_cliente
      LEFT JOIN erp_clientes_real ecr ON ecr.clientes_id = r.cod_cliente
      LEFT JOIN erp_clientes_real mtz ON mtz.clientes_id = ecr.clientes_id_principal
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = regexp_replace(r.doc_cliente,'[^0-9]','','g')
      WHERE (r.situacao IS NULL OR r.situacao NOT IN (6,8,9,95))
      ORDER BY r.cod_cliente`;
    return this.prisma.$queryRawUnsafe<any[]>(sql);
  }
}
