import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function QuotesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Quotes</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No quotes yet</CardTitle>
          <CardDescription>Coming in Phase 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Draw polygons on satellite maps to build accurate quotes fast.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
