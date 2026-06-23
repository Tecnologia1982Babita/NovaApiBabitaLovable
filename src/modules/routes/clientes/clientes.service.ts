import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { ClienteComprasDto } from './dto/cliente-compras.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compra por mes do cliente (liquido = vendas erp_pedidos - trocas erp_trocas),
   * somando todos os cadastros vinculados (matriz) via erp_clientes_real.
   * Mesmo calculo da rotina ofensiva_ligafashion_compra_mes.
   */
  async comprasPorMes(dto: ClienteComprasDto) {
    const meses = dto.meses && dto.meses > 0 ? dto.meses : 12;
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
          AND data >= DATE_TRUNC('month', CURRENT_DATE) - make_interval(months => $2::int - 1)
        UNION ALL
        SELECT DATE_TRUNC('month', data)::date, -COALESCE(totalgeral,0)
        FROM erp_trocas
        WHERE doctoclie IN (SELECT cpf FROM cadastros)
          AND COALESCE(cancelado,'N') = 'N'
          AND data >= DATE_TRUNC('month', CURRENT_DATE) - make_interval(months => $2::int - 1)
      )
      SELECT to_char(mes_ref,'YYYY-MM') AS mes, mes_ref, ROUND(SUM(valor),2) AS valor_total
      FROM mov
      GROUP BY mes_ref
      ORDER BY mes_ref`;
    return this.prisma.$queryRawUnsafe<any[]>(sql, dto.cpf, meses);
  }
}
