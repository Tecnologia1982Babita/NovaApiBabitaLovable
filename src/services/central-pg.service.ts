import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

/**
 * Conexao dedicada ao bd_babitacentral (servidor 251) - mesma credencial do
 * CentralBabita-Sistema (PG_BABITACENTRAL_*). So pg.Pool direto (sem Prisma):
 * e so a tabela lovable_ficha_risco_historico, nao justifica um 2o schema.prisma.
 */
@Injectable()
export class CentralPgService implements OnModuleInit {
  private readonly logger = new Logger(CentralPgService.name);
  readonly pool = new Pool({
    host: process.env.PG_BABITACENTRAL_HOST,
    port: Number(process.env.PG_BABITACENTRAL_PORT),
    database: process.env.PG_BABITACENTRAL_DB,
    user: process.env.PG_BABITACENTRAL_USER,
    password: process.env.PG_BABITACENTRAL_PASS,
  });

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS lovable_ficha_risco_historico (
        id BIGSERIAL PRIMARY KEY,
        mes_referencia DATE NOT NULL,
        codparc INTEGER NOT NULL,
        nome TEXT,
        vendedora TEXT,
        loja INTEGER,
        lojas_nome TEXT,
        valor_necessario NUMERIC(12,2) NOT NULL,
        valor_realizado NUMERIC(12,2),
        atingiu BOOLEAN,
        data_snapshot_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
        data_snapshot_fim TIMESTAMPTZ,
        UNIQUE (mes_referencia, codparc)
      );
      CREATE INDEX IF NOT EXISTS lovable_ficha_risco_mes_idx  ON lovable_ficha_risco_historico (mes_referencia);
      CREATE INDEX IF NOT EXISTS lovable_ficha_risco_vend_idx ON lovable_ficha_risco_historico (vendedora);
      CREATE INDEX IF NOT EXISTS lovable_ficha_risco_loja_idx ON lovable_ficha_risco_historico (loja);
    `);
    this.logger.log('lovable_ficha_risco_historico OK (bd_babitacentral)');
  }

  query<T extends QueryResultRow = any>(sql: string, params: any[] = []) {
    return this.pool.query<T>(sql, params);
  }
}
