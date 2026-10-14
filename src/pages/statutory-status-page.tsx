import { ArrowLeft, ExternalLink, FileCheck2, Pencil, Printer, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ActionGroup } from "@/components/ui/action-group";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintReport } from "@/components/ui/print-report";
import { getStatutoryStatus } from "@/services/api";
import { formatDate } from "@/lib/utils";

export function StatutoryStatusPage() {
  const navigate = useNavigate();
  const status = useQuery({
    queryKey: ["statutory-status"],
    queryFn: getStatutoryStatus,
  });

  return (
    <div>
      <PageHeading
        eyebrow="Payroll controls"
        title="Statutory status"
        description="Review the effective-dated statutory rules used by payroll calculations and their official sources."
        actions={
          <ActionGroup>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/admin/payroll")}>
              <ArrowLeft className="h-4 w-4" />
              Back to payroll
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </ActionGroup>
        }
      />
      <Card className="print:hidden">
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
            <Alert variant="danger">
              The reference register could not be loaded. Retry the request or open the setup screen to complete missing references.
              <ActionGroup className="mt-3 sm:justify-start">
                <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => void status.refetch()}>Retry</Button>
                <Button size="sm" className="w-full sm:w-auto" onClick={() => navigate("/admin/settings/statutory-references")}>Open setup</Button>
              </ActionGroup>
            </Alert>
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
              {requiredTypes.map((type) => {
                const item = status.data?.find((reference) => reference.schedule_type === type);
                const recorded = item?.status === "RECORDED";
                return (
                <div key={type} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{statutoryLabel(type)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {recorded && item?.effective_from
                          ? `Recorded effective ${formatDate(item.effective_from)}`
                          : "Missing official source reference"}
                      </div>
                    </div>
                    <Badge variant={recorded ? "success" : "warning"}>
                      {recorded ? "RECORDED" : "NEEDED"}
                    </Badge>
                  </div>
                  {recorded && item && (item.source_reference || item.source_url) && (
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
                  <ActionGroup className="mt-4 border-t pt-3 sm:justify-start">
                    <Button size="sm" variant={recorded ? "outline" : "primary"} className="w-full sm:w-auto" onClick={() => navigate(`/admin/settings/statutory-references?type=${type}`)}>
                      {recorded ? <Pencil className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}
                      {recorded ? "Edit reference" : "Complete setup"}
                    </Button>
                  </ActionGroup>
                </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Payroll uses the approved effective-dated rules selected for the payroll period. Update the source rules only after reviewing the official agency guidance.
            </p>
          </div>
        </CardContent>
      </Card>
      <PrintReport title="Statutory status" subtitle="Official source references and effective dates">
        <table className="print-table w-full text-xs">
          <thead><tr><th>Rule</th><th>Status</th><th>Effective from</th><th>Source</th><th>URL</th></tr></thead>
          <tbody>{requiredTypes.map((type) => { const item = status.data?.find((reference) => reference.schedule_type === type); return <tr key={`print-statutory-${type}`}><td>{statutoryLabel(type)}</td><td>{item?.status ?? "NEEDED"}</td><td>{item?.effective_from ? formatDate(item.effective_from) : "-"}</td><td>{item?.source_reference ?? "-"}</td><td>{item?.source_url ?? "-"}</td></tr> })}</tbody>
        </table>
      </PrintReport>
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

const requiredTypes = ["sss", "philhealth", "pagibig", "withholding_tax"] as const;
