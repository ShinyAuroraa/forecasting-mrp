import { CnpjConstraint } from './cnpj.validator';

describe('CnpjConstraint', () => {
  const validator = new CnpjConstraint();

  it('should accept valid CNPJ without formatting', () => {
    expect(validator.validate('11222333000181')).toBe(true);
  });

  it('should accept valid CNPJ with formatting', () => {
    expect(validator.validate('11.222.333/0001-81')).toBe(true);
  });

  it('should reject CNPJ with wrong check digits', () => {
    expect(validator.validate('11222333000199')).toBe(false);
  });

  it('should reject all-same-digit CNPJ', () => {
    expect(validator.validate('11111111111111')).toBe(false);
  });

  it('should reject CNPJ with wrong length', () => {
    expect(validator.validate('1122233300018')).toBe(false);
    expect(validator.validate('112223330001811')).toBe(false);
  });

  it('should reject non-string values', () => {
    expect(validator.validate(12345)).toBe(false);
    expect(validator.validate(null)).toBe(false);
    expect(validator.validate(undefined)).toBe(false);
  });

  it('should return correct default message', () => {
    expect(validator.defaultMessage()).toBe('Invalid CNPJ');
  });
});
