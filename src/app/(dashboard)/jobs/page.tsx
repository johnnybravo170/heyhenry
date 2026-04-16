import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function JobsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Jobs</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>No jobs yet</CardTitle>
          <CardDescription>Coming in Phase 1</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Track jobs through booked, in progress, and complete statuses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
