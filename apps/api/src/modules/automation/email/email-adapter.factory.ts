import { BadRequestException } from '@nestjs/common';
import {
  EmailAdapter,
  EmailListenerConfig,
  EmailAdapterType,
} from './email-adapter.interface';
import { GmailAdapter } from './gmail.adapter';
import { ImapAdapter } from './imap.adapter';
import { SftpEmailAdapter } from './sftp-email.adapter';

export class EmailAdapterFactory {
  static create(config: EmailListenerConfig, type?: EmailAdapterType): EmailAdapter {
    const adapterType = type ?? config.adapterType;

    switch (adapterType) {
      case 'GMAIL': {
        if (!config.gmail) throw new BadRequestException('Gmail configuration is missing');
        return new GmailAdapter(config.gmail);
      }
      case 'IMAP': {
        if (!config.imap) throw new BadRequestException('IMAP configuration is missing');
        return new ImapAdapter(config.imap);
      }
      case 'SFTP': {
        if (!config.sftp) throw new BadRequestException('SFTP configuration is missing');
        return new SftpEmailAdapter(config.sftp);
      }
      default:
        throw new BadRequestException(`Unknown email adapter type: ${adapterType}`);
    }
  }
}
