import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { ClienteComprasDto } from './dto/cliente-compras.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compra do cliente (liquido = erp_pedidos - erp_trocas), somando os cadastros vinculados (matriz).
   * granularidade: "mes" (default, DATE_TRUNC month) ou "dia" (por data).
   * Janela: periodo (dataIni/dataFim) > mes (YYYY-MM) > ultimos `meses` (default 12).
   * Uma unica query (sem chamadas extras).
   */
  async comprasPorMes(dto: ClienteComprasDto) {
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

    // granularidade validada no DTO (mes|dia) -> string controlada, sem injecao
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
        LIMIT 1
      ),
      cadastros AS (
        SELECT clientes_cpf_cnpj AS cpf FROM erp_clientes_real
        WHERE clientes_cpf_cnpj_principal = (SELECT principal FROM alvo)
        UNION
        SELECT lpad(regexp_replace($1,'[^0-9]','','g'),14,'0')
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
      SELECT ${label}, ROUND(SUM(valor),2) AS valor_total
      FROM mov
      GROUP BY ref
      ORDER BY ref`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }
}
