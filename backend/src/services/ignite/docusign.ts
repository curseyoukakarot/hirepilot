import axios from 'axios';
import jwt from 'jsonwebtoken';

type DocusignTokenCache = {
  token: string;
  expiresAt: number;
} | null;

let tokenCache: DocusignTokenCache = null;

type DocusignConfig = {
  authBaseUrl: string;
  apiBaseUrl: string;
  accountId: string;
  integrationKey: string;
  userId: string;
  privateKey: string;
  templateId?: string;
};

export type IgniteAgreementSigner = {
  name: string;
  email: string;
  title?: string | null;
};

export type SendIgniteAgreementArgs = {
  pdfBytesBase64: string;
  fileName: string;
  emailSubject: string;
  emailBlurb: string;
  signer: IgniteAgreementSigner;
  clientUserId?: string | null;
};

function getConfig(): DocusignConfig {
  const authBaseUrl = String(process.env.DOCUSIGN_AUTH_BASE_URL || 'account-d.docusign.com');
  const apiBaseUrl = String(process.env.DOCUSIGN_API_BASE_URL || 'https://demo.docusign.net/restapi');
  const accountId = String(process.env.DOCUSIGN_ACCOUNT_ID || '');
  const integrationKey = String(process.env.DOCUSIGN_INTEGRATION_KEY || '');
  const userId = String(process.env.DOCUSIGN_USER_ID || '');
  const privateKey = String(process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const templateId = String(process.env.DOCUSIGN_TEMPLATE_ID || '');

  if (!accountId || !integrationKey || !userId || !privateKey) {
    throw new Error(
      'DocuSign is not configured. Required env vars: DOCUSIGN_ACCOUNT_ID, DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY'
    );
  }

  return {
    authBaseUrl,
    apiBaseUrl,
    accountId,
    integrationKey,
    userId,
    privateKey,
    ...(templateId ? { templateId } : {}),
  };
}

async function getAccessToken(config: DocusignConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: config.integrationKey,
      sub: config.userId,
      aud: config.authBaseUrl,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
      scope: 'signature impersonation',
    },
    config.privateKey,
    { algorithm: 'RS256' }
  );

  const form = new URLSearchParams();
  form.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  form.set('assertion', assertion);

  const response = await axios.post(`https://${config.authBaseUrl}/oauth/token`, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 20_000,
  });

  const token = String(response.data?.access_token || '');
  const expiresIn = Number(response.data?.expires_in || 3600);
  if (!token) throw new Error('Failed to obtain DocuSign access token');

  tokenCache = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return token;
}

async function createEnvelope(
  config: DocusignConfig,
  accessToken: string,
  args: SendIgniteAgreementArgs
): Promise<{ envelopeId: string }> {
  const baseHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  if (config.templateId) {
    const payload = {
      templateId: config.templateId,
      status: 'sent',
      emailSubject: args.emailSubject,
      emailBlurb: args.emailBlurb,
      templateRoles: [
        {
          roleName: String(process.env.DOCUSIGN_TEMPLATE_ROLE_NAME || 'Client Signer'),
          name: args.signer.name,
          email: args.signer.email,
          clientUserId: args.clientUserId || undefined,
          tabs: {
            textTabs: [
              { tabLabel: 'signer_title', value: args.signer.title || '' },
            ],
          },
        },
      ],
    };

    const response = await axios.post(
      `${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/envelopes`,
      payload,
      { headers: baseHeaders, timeout: 30_000 }
    );
    const envelopeId = String(response.data?.envelopeId || '');
    if (!envelopeId) throw new Error('DocuSign envelope was created without an envelopeId');
    return { envelopeId };
  }

  // Fallback ad-hoc envelope mode if no template is configured.
  const payload = {
    emailSubject: args.emailSubject,
    emailBlurb: args.emailBlurb,
    status: 'sent',
    documents: [
      {
        documentBase64: args.pdfBytesBase64,
        name: args.fileName,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          recipientId: '1',
          routingOrder: '1',
          name: args.signer.name,
          email: args.signer.email,
          clientUserId: args.clientUserId || undefined,
          tabs: {
            signHereTabs: [
              { xPosition: '430', yPosition: '700', pageNumber: '1', documentId: '1' },
            ],
            dateSignedTabs: [
              { xPosition: '430', yPosition: '732', pageNumber: '1', documentId: '1' },
            ],
            textTabs: [
              { xPosition: '72', yPosition: '732', pageNumber: '1', documentId: '1', value: args.signer.title || '' },
            ],
          },
        },
      ],
    },
  };

  const response = await axios.post(
    `${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/envelopes`,
    payload,
    { headers: baseHeaders, timeout: 30_000 }
  );
  const envelopeId = String(response.data?.envelopeId || '');
  if (!envelopeId) throw new Error('DocuSign envelope was created without an envelopeId');
  return { envelopeId };
}

export async function sendIgniteAgreementForSignature(args: SendIgniteAgreementArgs): Promise<{ envelopeId: string }> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  return createEnvelope(config, accessToken, args);
}

export async function getDocusignEnvelopeStatus(envelopeId: string): Promise<string> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const response = await axios.get(
    `${config.apiBaseUrl}/v2.1/accounts/${config.accountId}/envelopes/${encodeURIComponent(envelopeId)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 20_000,
    }
  );
  return String(response.data?.status || 'unknown');
}
