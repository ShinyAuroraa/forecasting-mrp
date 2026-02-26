import { Test, TestingModule } from '@nestjs/testing';
import { EmailSenderService } from '../email-sender.service';
import { PrismaService } from '../../../../prisma/prisma.service';

// Mock nodemailer
const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

const mockPrisma = {
  configSistema: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('EmailSenderService', () => {
  let service: EmailSenderService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSenderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EmailSenderService>(EmailSenderService);
  });

  describe('getSmtpConfig', () => {
    it('should return default config when nothing stored', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);

      const config = await service.getSmtpConfig();

      expect(config.host).toBe('smtp.gmail.com');
      expect(config.port).toBe(587);
      expect(config.user).toBe('');
    });

    it('should return stored config', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.email.smtp',
        valor: { host: 'custom.smtp.com', port: 465, secure: true, user: 'u', pass: 'p', fromAddress: 'a@b.com', fromName: 'Test' },
      });

      const config = await service.getSmtpConfig();

      expect(config.host).toBe('custom.smtp.com');
      expect(config.port).toBe(465);
      expect(config.secure).toBe(true);
    });
  });

  describe('saveSmtpConfig', () => {
    it('should upsert SMTP config and reset transporter', async () => {
      mockPrisma.configSistema.upsert.mockResolvedValue({});

      const input = { host: 'h', port: 587, secure: false, user: 'u', pass: 'p', fromAddress: 'f', fromName: 'n' };
      const result = await service.saveSmtpConfig(input);

      expect(result).toEqual(input);
      expect(mockPrisma.configSistema.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chave: 'automacao.email.smtp' },
        }),
      );
    });
  });

  describe('sendEmail', () => {
    it('should no-op when SMTP user is empty', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue(null);

      const result = await service.sendEmail({
        to: ['user@test.com'],
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeNull();
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it('should send email when SMTP configured', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.email.smtp',
        valor: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', pass: 'p', fromAddress: 'from@test.com', fromName: 'Test' },
      });
      mockSendMail.mockResolvedValue({ messageId: '<msg-123>' });

      const result = await service.sendEmail({
        to: ['user@test.com'],
        cc: ['cc@test.com'],
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<msg-123>');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
          cc: 'cc@test.com',
          subject: 'Test Subject',
        }),
      );
    });

    it('should return error on send failure', async () => {
      mockPrisma.configSistema.findUnique.mockResolvedValue({
        chave: 'automacao.email.smtp',
        valor: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', pass: 'p', fromAddress: 'from@test.com', fromName: 'Test' },
      });
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      const result = await service.sendEmail({
        to: ['user@test.com'],
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should reuse transporter when config unchanged', async () => {
      const smtpConfig = {
        chave: 'automacao.email.smtp',
        valor: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', pass: 'p', fromAddress: 'from@test.com', fromName: 'Test' },
      };
      mockPrisma.configSistema.findUnique.mockResolvedValue(smtpConfig);
      mockSendMail.mockResolvedValue({ messageId: '<msg-1>' });

      await service.sendEmail({ to: ['a@b.com'], subject: 'S', html: 'H', text: 'T' });
      await service.sendEmail({ to: ['a@b.com'], subject: 'S', html: 'H', text: 'T' });

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    });
  });
});
