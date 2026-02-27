import axios, { AxiosRequestConfig } from 'axios';
import {
  ErpConnector,
  RawMovementData,
  RestConnectorConfig,
} from './erp-connector.interface';

/**
 * REST API ERP Connector
 *
 * Fetches daily movement data from a configurable REST endpoint.
 * Supports API key, Bearer token, and Basic authentication.
 * Supports JSON and XML response formats.
 *
 * @see Story 4.2 — AC-5, AC-6
 */
export class RestApiConnector implements ErpConnector {
  constructor(private readonly config: RestConnectorConfig) {}

  async fetchDailyData(date: Date): Promise<RawMovementData[]> {
    const response = await axios.request(this.buildRequest(date));
    return this.parseResponse(response.data);
  }

  async testConnection(): Promise<boolean> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const requestConfig = this.buildRequest(yesterday);
    requestConfig.timeout = 10_000;

    const response = await axios.request(requestConfig);
    return response.status >= 200 && response.status < 300;
  }

  private buildRequest(date: Date): AxiosRequestConfig {
    const formattedDate = date.toISOString().split('T')[0];
    const params: Record<string, string> = {};

    if (this.config.queryParams) {
      for (const [key, value] of Object.entries(this.config.queryParams)) {
        params[key] = value
          .replace('{yesterday}', formattedDate)
          .replace('{date}', formattedDate);
      }
    }

    if (Object.keys(params).length === 0) {
      params['data'] = formattedDate;
    }

    const headers: Record<string, string> = {};
    const { auth } = this.config;

    switch (auth.type) {
      case 'apiKey':
        headers[auth.headerName ?? 'X-API-Key'] = auth.apiKey ?? '';
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.token ?? ''}`;
        break;
      case 'basic': {
        const credentials = `${auth.username ?? ''}:${auth.password ?? ''}`;
        const encoded = Buffer.from(credentials).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
        break;
      }
    }

    return {
      method: 'GET',
      url: this.config.url,
      params,
      headers,
      timeout: 30_000,
    };
  }

  private parseResponse(data: unknown): RawMovementData[] {
    if (this.config.responseFormat === 'XML') {
      return this.parseXmlResponse(data);
    }
    return this.parseJsonResponse(data);
  }

  private parseJsonResponse(data: unknown): RawMovementData[] {
    if (this.config.dataPath) {
      const parts = this.config.dataPath.split('.');
      let current: unknown = data;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return [];
        }
      }
      return Array.isArray(current) ? current : [];
    }

    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'data' in data) {
      const nested = (data as Record<string, unknown>)['data'];
      return Array.isArray(nested) ? nested : [];
    }
    return [];
  }

  private parseXmlResponse(data: unknown): RawMovementData[] {
    const xmlString = typeof data === 'string' ? data : String(data);
    const rows: RawMovementData[] = [];

    const itemMatches = [...xmlString.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    for (const itemMatch of itemMatches) {
      const row: Record<string, string> = {};
      const fieldMatches = itemMatch[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g);

      for (const fieldMatch of fieldMatches) {
        row[fieldMatch[1]] = fieldMatch[2].trim();
      }

      if (Object.keys(row).length > 0) {
        rows.push(row);
      }
    }

    return rows;
  }
}
