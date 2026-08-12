import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AiHighlightsSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading highlights">
      <CardHeader>
        <CardTitle>Highlights</CardTitle>
        <CardDescription>Loading suggestions…</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}