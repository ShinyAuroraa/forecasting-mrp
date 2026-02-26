import { BadRequestException } from '@nestjs/common';
import { UuidValidationPipe } from './uuid-validation.pipe';

describe('UuidValidationPipe', () => {
  let pipe: UuidValidationPipe;

  beforeEach(() => {
    pipe = new UuidValidationPipe();
  });

  it('should accept a valid UUID v4', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(pipe.transform(uuid)).toBe(uuid);
  });

  it('should accept a valid UUID with uppercase letters', () => {
    const uuid = '550E8400-E29B-41D4-A716-446655440000';
    expect(pipe.transform(uuid)).toBe(uuid);
  });

  it('should reject an invalid UUID', () => {
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
  });

  it('should reject an empty string', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });

  it('should reject a UUID missing a section', () => {
    expect(() => pipe.transform('550e8400-e29b-41d4-a716')).toThrow(
      BadRequestException,
    );
  });

  it('should include the invalid value in the error message', () => {
    try {
      pipe.transform('bad-uuid');
      fail('Expected BadRequestException');
    } catch (error) {
      expect((error as BadRequestException).message).toContain('bad-uuid');
    }
  });
});
