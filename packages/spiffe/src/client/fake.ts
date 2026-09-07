import { SpiffeJwtClient } from './interface.js';
import { vitest } from 'vitest';

export class FakeSpiffeClient implements SpiffeJwtClient {
  getJwt = vitest.fn<SpiffeJwtClient['getJwt']>();
  getJwtSvid = vitest.fn<SpiffeJwtClient['getJwtSvid']>();
  getSpiffeId = vitest.fn<SpiffeJwtClient['getSpiffeId']>();
  validateJwt = vitest.fn<SpiffeJwtClient['validateJwt']>();
}
