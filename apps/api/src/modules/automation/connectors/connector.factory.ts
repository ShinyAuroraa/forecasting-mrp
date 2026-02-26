import { BadRequestException } from '@nestjs/common';
import {
  ErpConnector,
  ErpConfig,
  ConnectorType,
} from './erp-connector.interface';
import { RestApiConnector } from './rest-api.connector';
import { DirectDbConnector } from './direct-db.connector';
import { SftpConnector } from './sftp.connector';

/**
 * Factory that creates the appropriate ERP connector based on configuration.
 *
 * @see Story 4.2 — AC-1, AC-2, AC-3, AC-4
 */
export class ConnectorFactory {
  static create(config: ErpConfig, type?: ConnectorType): ErpConnector {
    const connectorType = type ?? config.tipo;

    switch (connectorType) {
      case 'REST': {
        if (!config.rest) {
          throw new BadRequestException('REST connector configuration is missing');
        }
        return new RestApiConnector(config.rest);
      }
      case 'DB': {
        if (!config.db) {
          throw new BadRequestException('DB connector configuration is missing');
        }
        return new DirectDbConnector(config.db);
      }
      case 'SFTP': {
        if (!config.sftp) {
          throw new BadRequestException('SFTP connector configuration is missing');
        }
        return new SftpConnector(config.sftp);
      }
      default:
        throw new BadRequestException(`Unknown connector type: ${connectorType}`);
    }
  }
}
