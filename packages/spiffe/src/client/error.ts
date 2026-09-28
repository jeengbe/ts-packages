import { SvidFilter } from './interface.js';

/**
 * Thrown when the Workload API holds no SVID for the workload.
 */
export class NoSvidError extends Error {
  constructor(readonly filter?: SvidFilter) {
    const formatted = formatFilter(filter);
    super(`No SVID found${formatted ? ` for filter '${formatted}'` : ''}.`);
    this.name = this.constructor.name;

    Error.captureStackTrace(this, NoSvidError);
  }
}

function formatFilter(filter: SvidFilter = {}): string {
  return [
    filter.hint ? `hint=${filter.hint}` : undefined,
    filter.spiffeId ? `spiffeId=${filter.spiffeId}` : undefined,
  ]
    .filter((p) => p !== undefined)
    .join(';');
}
