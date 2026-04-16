import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No invoices yet</CardTitle>
          <CardDescription>Coming in Phase 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Send Stripe-powered invoices and get paid on completed jobs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
