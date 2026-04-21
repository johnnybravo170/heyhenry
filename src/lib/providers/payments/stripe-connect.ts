/**
 * Stripe Connect Standard implementation of PaymentProvider.
 *
 * One instance per region. Today only ca-central-1 exists; instances are
 * cheap and memoized inside the factory so additional regions just add
 * additional Stripe API keys in `provider_credentials`.
 */

import Stripe from 'stripe';
import { getProviderSecret } from '../secrets';
import type {
  CheckoutSession,
  CreateCheckoutSessionInput,
  MerchantAccount,
  OnboardingLink,
  PaymentProvider,
  WebhookEvent,
} from '../types';

const API_VERSION = '2026-03-25.dahlia' as const;

export class StripeConnectPaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private sdk: Stripe | null = null;
  private readonly region: string;

  constructor(region: string) {
    this.region = region;
  }

  private async getSdk(): Promise<Stripe> {
    if (!this.sdk) {
      const key = await getProviderSecret(this.region, 'stripe', 'secret_key');
      this.sdk = new Stripe(key, { apiVersion: API_VERSION });
    }
    return this.sdk;
  }

  async createMerchantAccount(metadata: Record<string, string>): Promise<{ accountId: string }> {
    const sdk = await this.getSdk();
    const account = await sdk.accounts.create({ type: 'standard', metadata });
    return { accountId: account.id };
  }

  async createOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<OnboardingLink> {
    const sdk = await this.getSdk();
    const link = await sdk.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
    return { url: link.url };
  }

  async getMerchantAccount(accountId: string): Promise<MerchantAccount> {
    const sdk = await this.getSdk();
    const account = await sdk.accounts.retrieve(accountId);
    return {
      accountId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
    };
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    const sdk = await this.getSdk();
    const session = await sdk.checkout.sessions.create(
      {
        line_items: [
          {
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: input.totalCents,
              product_data: {
                name: input.lineLabel,
                description: input.lineDescription,
              },
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        payment_intent_data: {
          application_fee_amount: input.applicationFeeCents,
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      },
      { stripeAccount: input.tenantMerchantAccountId },
    );
    return { sessionId: session.id, url: session.url };
  }

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookEvent> {
    const sdk = await this.getSdk();
    const webhookSecret = await getProviderSecret(this.region, 'stripe', 'webhook_secret');
    const event = sdk.webhooks.constructEvent(rawBody, signature, webhookSecret);
    return { type: event.type, raw: event };
  }
}
