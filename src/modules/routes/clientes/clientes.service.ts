import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { ClienteComprasDto } from './dto/cliente-compras.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compra por mes do cliente (liquido = erp_pedidos - erp_trocas), por DATE_TRUNC('month',data),
   * somando os cadastros vinculados (matriz) via erp_clientes_real.
   * Janela: periodo (dataIni/dataFim) > mes (YYYY-MM) > ultimos `meses` (default 12).
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
        SELECT DATE_TRUNC('month', data)::date AS mes_ref, COALESCE(totalgeral,0) AS valor
        FROM erp_pedidos
        WHERE doctoclie IN (SELECT cpf FROM cadastros)
          AND cancelado IS DISTINCT FROM 'S'
          AND ${dateCond}
        UNION ALL
        SELECT DATE_TRUNC('month', data)::date, -COALESCE(totalgeral,0)
        FROM erp_trocas
        WHERE doctoclie IN (SELECT cpf FROM cadastros)
          AND COALESCE(cancelado,'N') = 'N'
          AND ${dateCond}
      )
      SELECT to_char(mes_ref,'YYYY-MM') AS mes, mes_ref, ROUND(SUM(valor),2) AS valor_total
      FROM mov
      GROUP BY mes_ref
      ORDER BY mes_ref`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, ...params);
  }
}
