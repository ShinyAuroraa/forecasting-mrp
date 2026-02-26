import { Pool, PoolConfig } from 'pg';
import {
  ErpConnector,
  RawMovementData,
  DbConnectorConfig,
} from './erp-connector.interface';

/**
 * Direct Database ERP Connector
 *
 * Read-only connection to the ERP database with connection pooling.
 * Uses incremental query pattern: WHERE data_movimento = CURRENT_DATE - 1
 *
 * @see Story 4.2 — AC-7, AC-8, AC-9
 */
export class DirectDbConnector implements ErpConnector {
  private pool: Pool | null = null;

  constructor(private readonly config: DbConnectorConfig) {}

  async fetchDailyData(date: Date): Promise<RawMovementData[]> {
    const pool = this.getPool();
    const formattedDate = date.toISOString().split('T')[0];

    const query = this.config.query.includes('$1')
      ? this.config.query
      : `${this.config.query} WHERE data_movimento = $1`;

    const result = await pool.query(query, [formattedDate]);
    return result.rows as RawMovementData[];
  }

  async testConnection(): Promise<boolean> {
    const pool = this.getPool();
    const result = await pool.query('SELECT 1 AS ok');
    return result.rows.length > 0;
  }

  async dispose(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      const poolConfig: PoolConfig = {
        connectionString: this.config.connectionString,
        max: Math.min(this.config.maxConnections, 5),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        application_name: 'forecastingmrp_erp_reader',
      };

      this.pool = new Pool(poolConfig);
    }

    return this.pool;
  }
}
