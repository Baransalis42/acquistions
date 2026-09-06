import { signUpSchema, signinSchema } from '#validations/auth.validation.js';

describe('signUpSchema', () => {
  it('accepts a valid sign-up payload and defaults role to user', () => {
    const result = signUpSchema.safeParse({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(result.success).toBe(true);
    expect(result.data.role).toBe('user');
  });

  it('rejects a malformed email', () => {
    const result = signUpSchema.safeParse({
      name: 'Jane Doe',
      email: 'not-an-email',
      password: 'password123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 6 characters', () => {
    const result = signUpSchema.safeParse({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: '123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid role', () => {
    const result = signUpSchema.safeParse({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
      role: 'superadmin',
    });

    expect(result.success).toBe(false);
  });
});

describe('signinSchema', () => {
  it('accepts a valid sign-in payload', () => {
    const result = signinSchema.safeParse({
      email: 'jane@example.com',
      password: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = signinSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(result.success).toBe(false);
  });
});
