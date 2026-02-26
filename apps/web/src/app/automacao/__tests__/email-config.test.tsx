import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailConfig } from '../components/email-config';
import type { EmailListenerConfig } from '@/types/automation';

const baseConfig: EmailListenerConfig = {
  adapterType: 'IMAP',
  imap: { host: 'imap.test.com', port: 993, username: 'user', password: 'pass', tls: true },
  filters: { sender: 'erp@test.com', hasAttachment: true },
  cronExpression: '0 6 * * *',
  maxAttachmentSizeMb: 25,
  allowedExtensions: ['.csv', '.xlsx', '.pdf'],
};

describe('EmailConfig', () => {
  it('should render adapter selector', () => {
    render(<EmailConfig config={baseConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('IMAP')).toBeInTheDocument();
  });

  it('should render cron expression input', () => {
    render(<EmailConfig config={baseConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('0 6 * * *')).toBeInTheDocument();
  });

  it('should render filter fields', () => {
    render(<EmailConfig config={baseConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('erp@test.com')).toBeInTheDocument();
  });

  it('should show IMAP fields when IMAP selected', () => {
    render(<EmailConfig config={baseConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('imap.test.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('993')).toBeInTheDocument();
  });

  it('should show Gmail fields when GMAIL selected', () => {
    const gmailConfig: EmailListenerConfig = {
      ...baseConfig,
      adapterType: 'GMAIL',
      gmail: { clientId: 'id123', clientSecret: 'secret', refreshToken: 'token' },
    };
    render(<EmailConfig config={gmailConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('id123')).toBeInTheDocument();
  });

  it('should show SFTP fields when SFTP selected', () => {
    const sftpConfig: EmailListenerConfig = {
      ...baseConfig,
      adapterType: 'SFTP',
      sftp: { host: 'sftp.test.com', port: 22, username: 'user', remotePath: '/emails/', filePattern: '*.csv' },
    };
    render(<EmailConfig config={sftpConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('sftp.test.com')).toBeInTheDocument();
  });

  it('should call onChange when adapter type changes', () => {
    const onChange = jest.fn();
    render(<EmailConfig config={baseConfig} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue('IMAP'), { target: { value: 'GMAIL' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ adapterType: 'GMAIL' }));
  });

  it('should display allowed extensions', () => {
    render(<EmailConfig config={baseConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('.csv, .xlsx, .pdf')).toBeInTheDocument();
  });

  it('should display max attachment size', () => {
    render(<EmailConfig config={baseConfig} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
  });
});
