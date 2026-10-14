import { ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatutoryStatus } from "@/services/api";
import { formatDate } from "@/lib/utils";

export function StatutoryStatusPage() {
  const status = useQuery({
    queryKey: ["statutory-status"],
    queryFn: getStatutoryStatus,
  });

  return (
    <div>
      <PageHeading
        eyebrow="Payroll controls"
        title="Statutory status"
        description="Review whether the archived statutory reference schedules have been recorded. These records are informational only; statutory and tax deductions remain zero in payroll."
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Reference schedule register
          </CardTitle>
          <CardDescription>
            Four required schedule types are checked through a protected administrator RPC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status.isError && (
            <Alert variant="danger">{(status.error as Error).message}</Alert>
          )}
          {status.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(status.data ?? []).map((item) => (
                <div key={item.schedule_type} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{statutoryLabel(item.schedule_type)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.status === "RECORDED" && item.effective_from
                          ? `Recorded effective ${formatDate(item.effective_from)}`
                          : "No archived reference recorded"}
                      </div>
                    </div>
                    <Badge variant={item.status === "RECORDED" ? "success" : "warning"}>
                      {item.status}
                    </Badge>
                  </div>
                  {item.status === "RECORDED" && (item.source_reference || item.source_url) && (
                    <div className="mt-3 flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
                      {item.source_reference && <span>{item.source_reference}</span>}
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          Source <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Payroll preview continues to use the fixed default calculation. This page does not activate, edit, or apply statutory schedules.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function statutoryLabel(value: string) {
  return value === "sss"
    ? "SSS"
    : value === "philhealth"
      ? "PHILHEALTH"
      : value === "pagibig"
        ? "PAG-IBIG"
        : "WITHHOLDING TAX";
}
