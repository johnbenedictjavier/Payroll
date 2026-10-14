import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, FileCheck2, Printer, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ActionGroup } from "@/components/ui/action-group";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/layout/page-heading";
import { PrintReport } from "@/components/ui/print-report";
import { formatDate } from "@/lib/utils";
import { getStatutoryStatus, saveStatutoryReference } from "@/services/api";
import type { StatutoryStatus } from "@/types/database";

const statutoryTypes: Array<{ value: StatutoryStatus["schedule_type"]; label: string; description: string }> = [
  { value: "sss", label: "SSS", description: "Social Security System reference" },
  { value: "philhealth", label: "PHILHEALTH", description: "PhilHealth reference" },
  { value: "pagibig", label: "PAG-IBIG", description: "Pag-IBIG reference" },
  { value: "withholding_tax", label: "WITHHOLDING TAX", description: "Withholding tax reference" },
];

type ReferenceForm = {
  effective_from: string;
  source_reference: string;
  source_url: string;
};

const emptyForm: ReferenceForm = {
  effective_from: "",
  source_reference: "",
  source_url: "",
};

export function StatutoryReferencesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedType = normalizeType(searchParams.get("type"));
  const [selectedType, setSelectedType] = useState<StatutoryStatus["schedule_type"]>(requestedType ?? "sss");
  const [form, setForm] = useState<ReferenceForm>(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const status = useQuery({
    queryKey: ["statutory-status"],
    queryFn: getStatutoryStatus,
  });
  const selectedReference = status.data?.find((item) => item.schedule_type === selectedType);
  const recordedCount = status.data?.filter((item) => item.status === "RECORDED").length ?? 0;
  const selectedLabel = useMemo(
    () => statutoryTypes.find((item) => item.value === selectedType)?.label ?? "Statutory reference",
    [selectedType],
  );

  useEffect(() => {
    if (requestedType) setSelectedType(requestedType);
  }, [requestedType]);

  useEffect(() => {
    setForm({
      effective_from: selectedReference?.effective_from ?? "",
      source_reference: selectedReference?.source_reference ?? "",
      source_url: selectedReference?.source_url ?? "",
    });
    setError("");
    setMessage("");
  }, [selectedReference?.effective_from, selectedReference?.source_reference, selectedReference?.source_url, selectedType]);

  const saveMutation = useMutation({
    mutationFn: () => saveStatutoryReference({
      schedule_type: selectedType,
      effective_from: form.effective_from,
      source_reference: form.source_reference.trim(),
      source_url: form.source_url.trim() || null,
    }),
    onSuccess: () => {
      setMessage(`${selectedLabel} reference saved. It is recorded for review only and does not change payroll calculations.`);
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["statutory-status"] });
    },
    onError: (mutationError) => {
      setError((mutationError as Error).message);
      setMessage("");
    },
  });

  function selectType(type: StatutoryStatus["schedule_type"]) {
    setSelectedType(type);
    setSearchParams({ type });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.effective_from || !form.source_reference.trim()) {
      setError("Effective date and source reference are required.");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div>
       <PageHeading
        eyebrow="Administration"
        title="Statutory references"
         description="Record the official source references used to review and maintain effective-dated statutory rules."
        actions={
          <ActionGroup>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/admin/payroll/statutory-status")}>
              <ArrowLeft className="h-4 w-4" />
              Back to status
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </ActionGroup>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Recorded" value={`${recordedCount}/4`} detail="References completed" />
        <SummaryCard label="Selected" value={selectedLabel} detail="Reference being edited" />
         <SummaryCard label="Payroll impact" value="Rules" detail="Used by the calculation engine" />
      </div>

       <div className="grid gap-6 print:hidden xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
         <Card>
          <CardHeader>
            <CardTitle>What is needed</CardTitle>
            <CardDescription>Select a required reference to complete or review it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {status.isError && (
              <Alert variant="danger">
                The reference register could not be loaded. Retry the request before entering data.
                <Button size="sm" variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => void status.refetch()}>
                  Retry
                </Button>
              </Alert>
            )}
            {statutoryTypes.map((type) => {
              const item = status.data?.find((reference) => reference.schedule_type === type.value);
              const recorded = item?.status === "RECORDED";
              return (
                <button
                  key={type.value}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 ${selectedType === type.value ? "border-primary bg-primary/5 shadow-sm" : ""}`}
                  onClick={() => selectType(type.value)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1.5 ${recorded ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {recorded ? <CheckCircle2 className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{type.label}</span>
                        <Badge variant={recorded ? "success" : "warning"}>{recorded ? "RECORDED" : "NEEDED"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {recorded && item?.effective_from ? `Recorded effective ${formatDate(item.effective_from)}` : type.description}
                      </p>
                     </div>
                   </div>
                 </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedReference?.status === "RECORDED" ? "Update reference" : "Complete missing reference"}</CardTitle>
            <CardDescription>{selectedLabel} requires an effective date and an official source reference.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
            {message && <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</Alert>}
            <form className="space-y-5" onSubmit={submit}>
              <div>
                <Label htmlFor="statutory-effective-date">Effective date</Label>
                <Input id="statutory-effective-date" type="date" value={form.effective_from} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} required />
              </div>
              <div>
                <Label htmlFor="statutory-source-reference">Official source reference</Label>
                <Input id="statutory-source-reference" value={form.source_reference} onChange={(event) => setForm((current) => ({ ...current, source_reference: event.target.value }))} placeholder="Circular, schedule, or official document title" required />
              </div>
              <div>
                <Label htmlFor="statutory-source-url">Source URL <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="statutory-source-url" type="url" value={form.source_url} onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="https://official-source.example" />
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                 <p>This register documents the official source used for the active statutory calculation rules. Changes should be reviewed before a rule is approved.</p>
              </div>
              <ActionGroup className="border-t pt-4">
                {selectedReference?.source_url && (
                  <a href={selectedReference.source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold hover:bg-secondary sm:w-auto">
                    <ExternalLink className="h-4 w-4" />
                    Open source
                  </a>
                )}
                <Button type="submit" className="w-full sm:w-auto" loading={saveMutation.isPending} loadingLabel="Saving reference...">
                  <Save className="h-4 w-4" />
                  Save reference
                </Button>
              </ActionGroup>
            </form>
          </CardContent>
        </Card>
      </div>
      <PrintReport title="Statutory source register" subtitle="All configured official references">
        <table className="print-table w-full text-xs">
          <thead><tr><th>Rule</th><th>Status</th><th>Effective from</th><th>Source</th><th>URL</th></tr></thead>
          <tbody>{statutoryTypes.map((type) => { const item = status.data?.find((reference) => reference.schedule_type === type.value); return <tr key={`print-reference-${type.value}`}><td>{type.label}</td><td>{item?.status ?? "NEEDED"}</td><td>{item?.effective_from ? formatDate(item.effective_from) : "-"}</td><td>{item?.source_reference ?? "-"}</td><td>{item?.source_url ?? "-"}</td></tr> })}</tbody>
        </table>
      </PrintReport>
    </div>
  );
}

function normalizeType(value: string | null): StatutoryStatus["schedule_type"] | null {
  return statutoryTypes.some((item) => item.value === value) ? value as StatutoryStatus["schedule_type"] : null;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 truncate text-lg font-black">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></Card>;
}
