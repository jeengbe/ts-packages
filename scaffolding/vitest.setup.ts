import * as matchers from 'jest-extended';
import { expect } from 'vitest';

// @ts-expect-error -- ¯\_(ツ)_/¯
expect.extend(matchers);
