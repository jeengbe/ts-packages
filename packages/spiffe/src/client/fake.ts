import { SpiffeJwtClient } from './interface.js';
import { vitest } from 'vitest';

export class FakeSpiffeClient implements SpiffeJwtClient {
  getJwt = vitest.fn<SpiffeJwtClient['getJwt']>();
  getJwtSvid = vitest.fn<SpiffeJwtClient['getJwtSvid']>();
  validateJwt = vitest.fn<SpiffeJwtClient['validateJwt']>();
}
