import { jwttoken } from '#utils/jwt.js';

describe('jwttoken', () => {
  it('signs a payload and verifies it back to the same claims', () => {
    const payload = { id: 1, email: 'jane@example.com', role: 'user' };

    const token = jwttoken.sign(payload);
    const decoded = jwttoken.verify(token);

    expect(decoded).toMatchObject(payload);
  });

  it('throws on a malformed token', () => {
    expect(() => jwttoken.verify('not.a.valid.jwt')).toThrow(
      'Failed to verify token'
    );
  });

  it('throws on a token signed with a different secret', () => {
    // Simulates a forged/foreign token: jwt.verify must reject it outright.
    const jwt = jwttoken.sign({ id: 1 });
    const tampered = jwt.slice(0, -1) + (jwt.endsWith('a') ? 'b' : 'a');

    expect(() => jwttoken.verify(tampered)).toThrow('Failed to verify token');
  });
});
