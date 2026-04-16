import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CustomersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No customers yet</CardTitle>
          <CardDescription>Coming in Phase 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your residential, commercial, and agent contacts will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
