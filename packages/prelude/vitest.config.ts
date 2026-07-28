import { base } from '@jeengbe/scaffolding/vitest.config.base.ts';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(base(import.meta.dirname), defineConfig({}));
