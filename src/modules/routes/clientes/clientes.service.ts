import { Injectable } from '@nestjs/common';
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

  /**
   * Compra do cliente (liquido = erp_pedidos - erp_trocas), somando os cadastros vinculados (matriz).
   * granularidade: "mes" (default) ou "dia". Janela: periodo > mes > ultimos `meses` (12).
   * Mostra a vendedora dona; filtro opcional `vendedora` restringe aos cadastros dela.
   */
  async comprasPorMes(dto: ClienteComprasDto) {
    const rows = await this.comprasPorMesRun(dto);
    if (dto && dto.vendedora != null && rows.length === 0) {
      return this.comprasPorMesRun({ ...dto, vendedora: undefined });
    }
    return rows;
  }

  private async comprasPorMesRun(dto: ClienteComprasDto) {
    const params: any[] = [dto.cpf]; // $1
    let dateCond: string;
    if (dto.dataIni || dto.dataFim) {
      const conds: string[] = [];
      if (dto.dataIni) { params.push(dto.dataIni); conds.push(`data >= $${params.length}::date`); }
      if (dto.dataFim) { params.push(dto.dataFim); conds.push(`data <= $${params.length}::date`); }
      dateCond = conds.join(' AND ');
    } else if (dto.mes) {
      params.push(dto.mes);
      const i = params.length;
      dateCond = `data >= ($${i} || '-01')::date AND data < (($${i} || '-01')::date + interval '1 month')`;
    } else {
      const meses = dto.meses && dto.meses > 0 ? dto.meses : 12;
      params.push(meses);
      dateCond = `data >= date_trunc('month', CURRENT_DATE) - make_interval(months => $${params.length}::int - 1)`;
    }

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
          AND COALESCE(clientes_id_situacao,-1) NOT IN (6,8)
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
          AND COALESCE(clientes_id_situacao,-1) NOT IN (6,8)
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
}
