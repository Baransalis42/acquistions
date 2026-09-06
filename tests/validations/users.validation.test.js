import {
  userIdSchema,
  updateUserSchema,
} from '#validations/users.validation.js';

describe('userIdSchema', () => {
  it('coerces a numeric string param to a number', () => {
    const result = userIdSchema.safeParse({ id: '42' });

    expect(result.success).toBe(true);
    expect(result.data.id).toBe(42);
  });

  it('rejects a non-numeric id', () => {
    const result = userIdSchema.safeParse({ id: 'abc' });

    expect(result.success).toBe(false);
  });

  it('rejects zero and negative ids', () => {
    expect(userIdSchema.safeParse({ id: '0' }).success).toBe(false);
    expect(userIdSchema.safeParse({ id: '-1' }).success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts a single valid field', () => {
    const result = updateUserSchema.safeParse({ name: 'New Name' });

    expect(result.success).toBe(true);
  });

  it('rejects an empty body', () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = updateUserSchema.safeParse({ email: 'not-an-email' });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid role', () => {
    const result = updateUserSchema.safeParse({ role: 'superadmin' });

    expect(result.success).toBe(false);
  });

  it('accepts a valid role', () => {
    const result = updateUserSchema.safeParse({ role: 'admin' });

    expect(result.success).toBe(true);
  });
});
