/**
 * Thrown when the Workload API holds no SVID for the workload.
 */
export class NoSvidError extends Error {
  constructor(readonly hint?: string) {
    super(hint ? `No SVID found for hint '${hint}'.` : 'No SVID found.');
    this.name = 'NoSvidError';
    Error.captureStackTrace(this, NoSvidError);
  }
}
