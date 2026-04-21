/**
 * Provider abstraction shared types.
 *
 * Payments, tax, and payroll each have one interface. A factory in
 * `./factory.ts` selects the concrete implementation per tenant based on
 * `tenants.region`. New features MUST call providers through the factory --
 * direct SDK imports are a lint failure in CI.
 */

export type Region = 'ca-central-1';

export interface MerchantAccount {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export interface OnboardingLink {
  url: string;
}

export interface CreateCheckoutSessionInput {
  tenantMerchantAccountId: string;
  currency: string;
  totalCents: number;
  applicationFeeCents: number;
  lineLabel: string;
  lineDescription?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface CheckoutSession {
  sessionId: string;
  url: string | null;
}

export interface WebhookEvent {
  type: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;

  createMerchantAccount(metadata: Record<string, string>): Promise<{ accountId: string }>;
  createOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<OnboardingLink>;
  getMerchantAccount(accountId: string): Promise<MerchantAccount>;

  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>;

  verifyWebhook(rawBody: string, signature: string): Promise<WebhookEvent>;
}

export interface TaxComputation {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  breakdown: Array<{ label: string; rate: number; amountCents: number }>;
}

export interface TaxProvider {
  readonly name: string;
  computeTax(input: { subtotalCents: number; tenantId: string }): Promise<TaxComputation>;
}

export interface PayrollProvider {
  readonly name: string;
  // Interface placeholder -- no implementation yet. First impl lands with the
  // Gusto/Canadian payroll card.
}
