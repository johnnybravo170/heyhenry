import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">Todos and work log in one view.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nothing in your inbox</CardTitle>
          <CardDescription>Coming in Phase 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Todos and auto-generated work log entries will show up here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
