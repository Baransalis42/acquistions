import { jest } from '@jest/globals';
import authenticateToken, { requireAuth } from '#middleware/auth.middleware.js';
import { jwttoken } from '#utils/jwt.js';

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('authenticateToken', () => {
  it('sets req.user when a valid token cookie is present', () => {
    const token = jwttoken.sign({ id: 1, role: 'user' });
    const req = { cookies: { token } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toMatchObject({ id: 1, role: 'user' });
    expect(next).toHaveBeenCalled();
  });

  it('leaves req.user unset and still calls next when there is no cookie', () => {
    const req = { cookies: {} };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('leaves req.user unset and still calls next on an invalid token', () => {
    const req = { cookies: { token: 'garbage' } };
    const res = buildRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAuth', () => {
  it('calls next when req.user is set', () => {
    const req = { user: { id: 1 } };
    const res = buildRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is unset', () => {
    const req = {};
    const res = buildRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
  });
});
