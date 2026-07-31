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

  /** true quando a string tem pelo menos um digito (CPF/CNPJ utilizavel). */
  private temDigito(valor?: string): boolean {
    return /\d/.test(String(valor ?? ''));
  }

  /**
   * Compra do cliente (liquido = erp_pedidos - erp_trocas), somando os cadastros vinculados (matriz).
   *
   * Dois formatos de resposta:
   * - `granularidade` "mes" (default) / "dia": UM cpf quebrado por periodo (comportamento historico).
   * - `granularidade` "total": 1 item por cliente com o periodo somado - aceita `cpfs[]` (lote) ou
   *   `vendedora` sem cpf (todos os clientes dela), trocando ~1 chamada por CPF por uma unica.
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

    // Lote = cpfs[] ou vendedora sem cpf; nos dois casos a resposta e 1 item por cliente.
    const emLote = cpfsLote.length > 0 || !cpfUnico;
    if (emLote && dto.granularidade && dto.granularidade !== 'total') {
      throw new BadRequestException(
        'cpfs[] e vendedora sem cpf devolvem 1 item por cliente: use granularidade "total"',
      );
    }
    if (emLote || dto.granularidade === 'total') {
      return this.totalPorCliente(dto, cpfUnico ? [...cpfsLote, cpfUnico] : cpfsLote);
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
   * granularidade "total": 1 item por cliente ({cpfcnpj, nome, telefone, vendedora_nome,
   * codigovend, valor_total}) com o liquido do periodo inteiro. Uma unica ida ao banco
   * para o lote todo - erp_pedidos/erp_trocas nao tem indice por doctoclie, entao varrer
   * o periodo UMA vez para N clientes e o que substitui as N chamadas por CPF.
   *
   * `cpfs` vazio = modo vendedora (clientes de que ela e a dona hoje). Cada cliente soma a
   * matriz inteira (todos os cadastros vinculados), igual a chamada por CPF; entao dois CPFs
   * da mesma matriz repetem o mesmo valor_total - somar a resposta contaria em dobro.
   * Cliente sem movimento no periodo tambem volta, com valor_total 0.
   */
  private async totalPorCliente(dto: ClienteComprasDto, cpfs: string[]) {
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
        SELECT DISTINCT ON (e.cpf_in)
               e.cpf_in,
               c.clientes_cpf_cnpj_principal AS principal,
               COALESCE(c.clientes_cpf_cnpj_principal, e.cpf_in) AS cpf_matriz,
               btrim(c.clientes_nome) AS nome,
               -- mesmo telefone de /clientes/ativos e /listas (celular, fallback fixo), mas
               -- NULL em vez de " " quando o cliente nao tem nenhum dos dois.
               CASE WHEN regexp_replace(COALESCE(c.clientes_telefone2,''),'[^0-9]','','g') ~ '[1-9]'
                    THEN NULLIF(btrim(btrim(COALESCE(c.clientes_ddd2,'')) || ' ' || btrim(COALESCE(c.clientes_telefone2,''))), '')
                    ELSE NULLIF(btrim(btrim(COALESCE(c.clientes_ddd1,'')) || ' ' || btrim(COALESCE(c.clientes_telefone1,''))), '')
               END AS telefone
        FROM entrada e
        LEFT JOIN erp_clientes_real c
               ON c.clientes_cpf_cnpj = e.cpf_in
              AND COALESCE(c.clientes_id_situacao,-1) NOT IN (6,8,9,95)
        ORDER BY e.cpf_in, c.clientes_id DESC NULLS LAST
      ),
      cadastros AS (
        SELECT a.cpf_in, c.clientes_cpf_cnpj AS cad
        FROM alvo a
        JOIN erp_clientes_real c
          ON c.clientes_cpf_cnpj_principal = a.principal
         AND COALESCE(c.clientes_id_situacao,-1) NOT IN (6,8,9,95)
        UNION
        SELECT a.cpf_in, a.cpf_in FROM alvo a
      ),
      mov AS (
        SELECT c.cpf_in, COALESCE(p.totalgeral,0) AS valor
        FROM cadastros c
        JOIN erp_pedidos p ON p.doctoclie = c.cad
        WHERE p.cancelado IS DISTINCT FROM 'S'
          AND ${janela}
        UNION ALL
        SELECT c.cpf_in, -COALESCE(t.totalgeral,0)
        FROM cadastros c
        JOIN erp_trocas t ON t.doctoclie = c.cad
        WHERE COALESCE(t.cancelado,'N') = 'N'
          AND ${janela}
      ),
      soma AS (
        SELECT cpf_in, SUM(valor) AS valor_total FROM mov GROUP BY cpf_in
      )
      SELECT a.cpf_in AS cpfcnpj,
             a.nome,
             a.telefone,
             v.ven_nome AS vendedora_nome,
             v.codigovend,
             COALESCE(s.valor_total, 0)::numeric(14,2) AS valor_total
      FROM alvo a
      LEFT JOIN soma s ON s.cpf_in = a.cpf_in
      LEFT JOIN vend v ON v.doc14 = a.cpf_matriz
      ORDER BY a.cpf_in`;
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
        SELECT clientes_cpf_cnpj_principal AS principal
        FROM erp_clientes_real
        WHERE regexp_replace(clientes_cpf_cnpj,'[^0-9]','','g') = lpad(regexp_replace($1,'[^0-9]','','g'),14,'0')
          AND COALESCE(clientes_id_situacao,-1) NOT IN (6,8,9,95)
        LIMIT 1
      ),
      matrizcpf AS (
        SELECT lpad(regexp_replace(COALESCE((SELECT principal FROM alvo), $1),'[^0-9]','','g'),14,'0') AS cpf_matriz
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
        COALESCE(btrim(vend.ven_nome), btrim(r.ven_nome)) AS vendedora
      FROM agregado a
      JOIN recente r ON r.cod_cliente = a.cod_cliente
      LEFT JOIN erp_clientes_real ecr ON ecr.clientes_id = r.cod_cliente
      LEFT JOIN ${this.VEND} vend ON vend.doc14 = regexp_replace(r.doc_cliente,'[^0-9]','','g')
      WHERE (r.situacao IS NULL OR r.situacao NOT IN (6,8,9,95))
      ORDER BY r.cod_cliente`;
    return this.prisma.$queryRawUnsafe<any[]>(sql);
  }
}
