import { SpiffeClient } from './impl.js';
import type { SpiffeJwtClient } from './interface.js';
import assert from 'assert';
import * as fs from 'fs/promises';
import type {
  ExternalAccountClientOptions,
  ExternalAccountSupplierContext,
  GoogleAuthOptions,
  JWTInput,
  SubjectTokenSupplier,
} from 'google-auth-library';
import os from 'os';
import * as path from 'path';

export class SpiffeJwtGoogleSubjectTokenSupplier implements SubjectTokenSupplier {
  #spiffeClient?: SpiffeJwtClient;

  constructor(
    private readonly spiffe: SpiffeJwtClient | (() => SpiffeJwtClient) = () => new SpiffeClient(),
    private readonly hint?: string,
  ) {}

  async getSubjectToken(context: ExternalAccountSupplierContext): Promise<string> {
    this.#spiffeClient ??= typeof this.spiffe === 'function' ? this.spiffe() : this.spiffe;

    assert.strictEqual(
      context.subjectTokenType,
      'urn:ietf:params:oauth:token-type:jwt',
      "SpiffeJwtGoogleSubjectTokenSupplier can only provide 'urn:ietf:params:oauth:token-type:jwt' subject tokens",
    );

    return await this.#spiffeClient.getJwt(context.audience, this.hint);
  }
}

/**
 * Attempts to create a {@link GoogleAuth} configuration object from Application Default
 * Credentials (ADC) when the local ADC file is configured for external-account
 * authentication using JWT subject tokens and a SPIFFE credential source.
 *
 * If no ADC file is configured, or `.credential_source.spiffe` is not set in
 * the ADC, the function returns `undefined`. The value of `.credential_source.spiffe.hint`
 * is used as hint to the SPIFFE Client when retrieving the SVID.
 *
 * Throws if the discovered ADC file contains invalid JSON.
 *
 * @example
 *
 * ```json
 * {
 *   "type": "external_account",
 *   "audience": "//iam.googleapis.com/projects/<project-number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>",
 *   "subject_token_type": "urn:ietf:params:oauth:token-type:jwt",
 *   "credential_source": {
 *     "spiffe": {
 *       "hint": "external-gcp"
 *     }
 *   }
 * }
 * ```
 *
 * If the configured credential source is not `spiffe`, the function returns `undefined`, so that the
 * regular ADC flow can be used as a fallback.
 *
 * ```ts
 * import { maybeCreateGoogleAuthFromSpiffeAdc } from '@jeengbe/spiffe/google-auth';
 * import { BigQuery } from '@google-cloud/bigquery';
 * import { GoogleGenAI } from '@google/genai';
 * import { GoogleAuth } from 'google-auth-library';
 *
 * const googleAuthOptions = await maybeCreateGoogleAuthFromSpiffeAdc();
 *
 * const genAi = new GoogleGenAI({ googleAuthOptions });
 * const bigQuery = new BigQuery({ authClient: await new GoogleAuth(googleAuth).getClient() });
 * ```
 */
export async function maybeCreateGoogleAuthFromSpiffeAdc(
  spiffe: SpiffeJwtClient | (() => SpiffeJwtClient) = () => new SpiffeClient(),
  googleAuthOptions?: Omit<GoogleAuthOptions, 'credentials'>,
): Promise<GoogleAuthOptions | undefined> {
  const adcFileContent = await getAdcFileContent();
  if (!adcFileContent) return undefined;

  const adc = JSON.parse(adcFileContent) as JWTInput;

  if (!isSpiffeExternalAccountAdc(adc)) return undefined;
  const typedAdc = adc as ExternalAccountClientOptions & {
    credential_source: { spiffe: object };
  };

  const spiffeHint: string | undefined =
    'hint' in typedAdc.credential_source.spiffe &&
    typeof typedAdc.credential_source.spiffe.hint === 'string'
      ? typedAdc.credential_source.spiffe.hint
      : undefined;

  const { credential_source: _, ...rest } = typedAdc;

  return {
    ...googleAuthOptions,
    credentials: {
      ...rest,
      subject_token_supplier: new SpiffeJwtGoogleSubjectTokenSupplier(spiffe, spiffeHint),
    },
  };
}

/**
 * Discovers and reads the contents of the Google Application Default Credentials file.
 *
 * Follows standard GCP resolution order:
 * 1. `GOOGLE_APPLICATION_CREDENTIALS` environment variable.
 * 2. Windows: `%APPDATA%/gcloud/application_default_credentials.json`
 * 3. Unix/Linux/macOS: `$HOME/.config/gcloud/application_default_credentials.json`
 */
async function getAdcFileContent(): Promise<string | null> {
  const credentialsPath =
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] || process.env['google_application_credentials'];

  if (credentialsPath) {
    try {
      return await fs.readFile(credentialsPath, 'utf-8');
    } catch {
      return null;
    }
  }

  let location: string | undefined;
  if (os.platform().startsWith('win')) {
    location = process.env['APPDATA'];
  } else {
    const home = process.env['HOME'];
    if (home) {
      location = path.join(home, '.config');
    }
  }

  if (location) {
    location = path.join(location, 'gcloud', 'application_default_credentials.json');

    try {
      return await fs.readFile(location, 'utf-8');
    } catch {
      return null;
    }
  }

  return null;
}

function isSpiffeExternalAccountAdc(adc: JWTInput): boolean {
  return (
    'type' in adc &&
    adc.type === 'external_account' &&
    'subject_token_type' in adc &&
    adc.subject_token_type === 'urn:ietf:params:oauth:token-type:jwt' &&
    'credential_source' in adc &&
    typeof adc.credential_source === 'object' &&
    adc.credential_source !== null &&
    'spiffe' in adc.credential_source &&
    typeof adc.credential_source.spiffe === 'object' &&
    adc.credential_source.spiffe !== null
  );
}
