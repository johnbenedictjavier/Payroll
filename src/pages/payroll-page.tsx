import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  Edit3,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmployeeAvatar } from "@/components/profile/employee-avatar";
import { ActionGroup } from "@/components/ui/action-group";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import { usePagination } from "@/lib/use-pagination";
import {
  createPayrollPeriod,
  createOtherTransaction,
  cancelPayrollPeriod,
  deletePayrollPeriod,
  finalizePayroll,
  listAttendance,
  listOtherTransactions,
  listPayrollPeriods,
  listPayrollRecords,
  markPayrollPaid,
  previewPayroll,
  publishPayslips,
  saveAttendance,
  updateOtherTransactionStatus,
  updatePayrollPeriod,
} from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  Attendance,
  OtherTransaction,
  PayrollPeriod,
  PayrollRecord,
} from "@/types/database";

type PeriodForm = {
  name: string;
  start_date: string;
  end_date: string;
  pay_date: string;
  frequency: PayrollPeriod["frequency"];
};
type ConfirmAction = "finalize" | "paid" | "publish" | null;
type PeriodAction = "delete" | "cancel" | null;
type AdjustmentKind = "income" | "deduction";
type ApprovalTarget = { kind: AdjustmentKind; transaction: OtherTransaction } | null;
type AttendanceEditorDraft = {
  days_worked: string;
  absence_days: string;
  tardiness_minutes: string;
  undertime_minutes: string;
  overtime_hours: string;
  notes: string;
};
type AdjustmentDraft = {
  kind: AdjustmentKind;
  transaction_type: string;
  amount: string;
  description: string;
};
const blankPeriod: PeriodForm = {
  name: "",
  start_date: "",
  end_date: "",
  pay_date: "",
  frequency: "monthly",
};

export function PayrollPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const periods = useQuery({
    queryKey: ["payroll-periods"],
    queryFn: listPayrollPeriods,
  });
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(blankPeriod);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<PayrollPeriod | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [periodAction, setPeriodAction] = useState<PeriodAction>(null);
  const [error, setError] = useState("");
  const [periodSearch, setPeriodSearch] = useState("");
  const [periodStatus, setPeriodStatus] = useState<
    PayrollPeriod["status"] | "all"
  >("all");
  const [recordSearch, setRecordSearch] = useState("");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [attendanceEditor, setAttendanceEditor] = useState<PayrollRecord | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceEditorDraft | null>(null);
  const [adjustmentEditor, setAdjustmentEditor] = useState<PayrollRecord | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentDraft>({
    kind: "income",
    transaction_type: "",
    amount: "",
    description: "",
  });
  const [approvalTarget, setApprovalTarget] = useState<ApprovalTarget>(null);

  const selectedPeriod =
    periods.data?.find((period) => period.id === selectedId) ??
    periods.data?.[0];
  const visiblePeriods =
    periods.data?.filter((period) => {
      const matchesStatus =
        periodStatus === "all" || period.status === periodStatus;
      return (
        matchesStatus &&
        `${period.name} ${period.frequency} ${period.status} ${period.start_date} ${period.end_date} ${period.pay_date}`
          .toLowerCase()
          .includes(periodSearch.trim().toLowerCase())
      );
    }) ?? [];
  const periodPagination = usePagination(
    visiblePeriods,
    `${periodSearch}|${periodStatus}`,
  );
  const records = useQuery({
    queryKey: ["payroll-records", selectedPeriod?.id],
    queryFn: () => listPayrollRecords(selectedPeriod?.id),
    enabled: Boolean(selectedPeriod?.id),
  });
  const preview = useQuery({
    queryKey: ["payroll-preview", selectedPeriod?.id],
    queryFn: () => previewPayroll(selectedPeriod!.id),
    enabled: false,
  });
  const attendance = useQuery({
    queryKey: ["attendance", selectedPeriod?.id],
    queryFn: () => listAttendance(selectedPeriod!.id),
    enabled: Boolean(selectedPeriod?.id),
  });
  const incomeTransactions = useQuery({
    queryKey: ["transactions", "income", selectedPeriod?.id],
    queryFn: () => listOtherTransactions("income", selectedPeriod!.id),
    enabled: Boolean(selectedPeriod?.id),
  });
  const deductionTransactions = useQuery({
    queryKey: ["transactions", "deduction", selectedPeriod?.id],
    queryFn: () => listOtherTransactions("deduction", selectedPeriod!.id),
    enabled: Boolean(selectedPeriod?.id),
  });

  useEffect(() => {
    if (!periods.data?.length) return;
    const requested = searchParams.get("period");
    const hasRequested = Boolean(
      requested && periods.data.some((period) => period.id === requested),
    );
    const hasSelected = Boolean(
      selectedId && periods.data.some((period) => period.id === selectedId),
    );
    if (requested && !hasRequested && selectedId && !hasSelected) return;
    const nextId =
      requested && periods.data.some((period) => period.id === requested)
        ? requested
        : selectedId && periods.data.some((period) => period.id === selectedId)
          ? selectedId
          : periods.data[0].id;
    if (nextId !== selectedId) setSelectedId(nextId);
    if (requested !== nextId)
      setSearchParams({ period: nextId }, { replace: true });
  }, [periods.data, searchParams, selectedId, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: () => editingPeriod ? updatePayrollPeriod(editingPeriod.id, form) : createPayrollPeriod(form),
    onSuccess: (created) => {
      setDialogOpen(false);
      setForm(blankPeriod);
      setEditingPeriod(null);
      setSelectedId(created.id);
      setSearchParams({ period: created.id });
      void queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const deletePeriodMutation = useMutation({
    mutationFn: () => deletePayrollPeriod(selectedPeriod!.id),
    onSuccess: () => {
      setPeriodAction(null);
      setSelectedId("");
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const cancelPeriodMutation = useMutation({
    mutationFn: () => cancelPayrollPeriod(selectedPeriod!.id),
    onSuccess: () => {
      setPeriodAction(null);
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const finalizeMutation = useMutation({
    mutationFn: () => finalizePayroll(selectedPeriod!.id, crypto.randomUUID()),
    onSuccess: () => {
      setConfirmAction(null);
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      void queryClient.invalidateQueries({ queryKey: ["report-payroll-records"] });
      queryClient.removeQueries({ queryKey: ["payroll-preview"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const paidMutation = useMutation({
    mutationFn: () => markPayrollPaid(selectedPeriod!.id),
    onSuccess: () => {
      setConfirmAction(null);
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const publishMutation = useMutation({
    mutationFn: () => publishPayslips(selectedPeriod!.id),
    onSuccess: () => {
      setConfirmAction(null);
      setError("Payslips published successfully.");
      void queryClient.invalidateQueries({ queryKey: ["payroll-periods"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const attendanceMutation = useMutation({
    mutationFn: (draft: AttendanceEditorDraft) => saveAttendance({
      payroll_period_id: selectedPeriod!.id,
      employee_id: attendanceEditor!.employee_id,
      days_worked: Number(draft.days_worked || 0),
      absence_days: Number(draft.absence_days || 0),
      tardiness_minutes: Number(draft.tardiness_minutes || 0),
      undertime_minutes: Number(draft.undertime_minutes || 0),
      overtime_hours: Number(draft.overtime_hours || 0),
      notes: draft.notes || null,
    }),
    onSuccess: () => {
      setAttendanceEditor(null);
      setAttendanceDraft(null);
      setError("Attendance updated. Run Preview to recalculate the ledger.");
      void queryClient.invalidateQueries({ queryKey: ["attendance", selectedPeriod?.id] });
      queryClient.removeQueries({ queryKey: ["payroll-preview", selectedPeriod?.id] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const adjustmentMutation = useMutation({
    mutationFn: () => createOtherTransaction(adjustmentDraft.kind, {
      payroll_period_id: selectedPeriod!.id,
      employee_id: adjustmentEditor!.employee_id,
      transaction_type: adjustmentDraft.transaction_type,
      amount: Number(adjustmentDraft.amount),
      description: adjustmentDraft.description,
    }),
    onSuccess: () => {
      setAdjustmentEditor(null);
      setAdjustmentDraft({ kind: "income", transaction_type: "", amount: "", description: "" });
      setError("Adjustment added as pending. Approve it before running Preview.");
      void queryClient.invalidateQueries({ queryKey: ["transactions", adjustmentDraft.kind, selectedPeriod?.id] });
      queryClient.removeQueries({ queryKey: ["payroll-preview", selectedPeriod?.id] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const approvalMutation = useMutation({
    mutationFn: (target: { kind: AdjustmentKind; transaction: OtherTransaction; status: "approved" | "rejected" }) =>
      updateOtherTransactionStatus(target.kind, target.transaction.id, target.status),
    onSuccess: () => {
      const kind = approvalTarget?.kind;
      setApprovalTarget(null);
      setError("Adjustment status updated. Run Preview to recalculate the ledger.");
      if (kind) void queryClient.invalidateQueries({ queryKey: ["transactions", kind, selectedPeriod?.id] });
      queryClient.removeQueries({ queryKey: ["payroll-preview", selectedPeriod?.id] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });

  const previewRecords = (preview.data ?? []) as PayrollRecord[];
  const displayedRecords = preview.isSuccess
    ? previewRecords
    : (records.data ?? []);
  const filteredRecords = displayedRecords.filter((record) =>
    `${record.employee?.first_name ?? ""} ${record.employee?.last_name ?? ""} ${record.employee?.employee_number ?? ""} ${record.employee_id} ${record.salary_type}`
      .toLowerCase()
      .includes(recordSearch.trim().toLowerCase()),
  );
  const recordPagination = usePagination(filteredRecords, recordSearch);
  const visibleRecords = recordPagination.pageItems;
  const totals = useMemo(
    () =>
      displayedRecords.reduce(
        (result, record) => ({
          gross: result.gross + Number(record.gross_pay || 0),
          deductions: result.deductions + Number(record.total_deductions || 0),
          net: result.net + Number(record.net_pay || 0),
        }),
        { gross: 0, deductions: 0, net: 0 },
      ),
    [displayedRecords],
  );
  const rawPreviewErrorMessage =
    preview.error instanceof Error
      ? preview.error.message
      : "The payroll preview could not be loaded.";
  const previewUsesLegacyRules = /statutory schedule|legacy.*payroll function/i.test(
    rawPreviewErrorMessage,
  );
  const previewErrorMessage = previewUsesLegacyRules
    ? "The connected Supabase project is still using an older payroll function. Apply the Payroll migrations through 202610150006 to use the current ledger and statutory rules."
    : rawPreviewErrorMessage;
  const previewNeedsInputs =
    !previewUsesLegacyRules &&
    /salary|attendance|loan|negative|employee/i.test(previewErrorMessage);
  const actionPending =
    finalizeMutation.isPending ||
    paidMutation.isPending ||
    publishMutation.isPending;
  const periodIsEditable = Boolean(
    selectedPeriod && ["draft", "review"].includes(selectedPeriod.status),
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.name || !form.start_date || !form.end_date || !form.pay_date) {
      setError("All payroll period fields are required.");
      return;
    }
    if (form.end_date < form.start_date || form.pay_date < form.end_date) {
      setError(
        "End date must follow start date, and pay date must be on or after the end date.",
      );
      return;
    }
    createMutation.mutate();
  }

  function selectPeriod(id: string) {
    setSelectedId(id);
    setSearchParams({ period: id });
    queryClient.removeQueries({ queryKey: ["payroll-preview", id] });
    setError("");
  }

  function requestPreview() {
    if (!selectedPeriod) return;
    queryClient.removeQueries({
      queryKey: ["payroll-preview", selectedPeriod.id],
    });
    void preview.refetch();
  }

  function confirmActionNow() {
    if (!selectedPeriod || !confirmAction) return;
    if (confirmAction === "finalize") finalizeMutation.mutate();
    if (confirmAction === "paid") paidMutation.mutate();
    if (confirmAction === "publish") publishMutation.mutate();
  }

  function confirmPeriodActionNow() {
    if (!selectedPeriod || !periodAction) return;
    if (periodAction === "delete") deletePeriodMutation.mutate();
    else cancelPeriodMutation.mutate();
  }

  function openCreatePeriod() {
    setError("");
    setEditingPeriod(null);
    setForm(blankPeriod);
    setDialogOpen(true);
  }

  function openEditPeriod() {
    if (!selectedPeriod || selectedPeriod.status !== "draft") return;
    setError("");
    setEditingPeriod(selectedPeriod);
    setForm({ name: selectedPeriod.name, start_date: selectedPeriod.start_date, end_date: selectedPeriod.end_date, pay_date: selectedPeriod.pay_date, frequency: selectedPeriod.frequency });
    setDialogOpen(true);
  }

  function attendanceFor(record: PayrollRecord) {
    return record.attendance ?? attendance.data?.find(
      (row) => row.payroll_period_id === record.payroll_period_id && row.employee_id === record.employee_id,
    ) ?? null;
  }

  function transactionsFor(record: PayrollRecord) {
    return {
      income: (incomeTransactions.data ?? []).filter((transaction) => transaction.employee_id === record.employee_id),
      deduction: (deductionTransactions.data ?? []).filter((transaction) => transaction.employee_id === record.employee_id),
    };
  }

  function openAttendanceEditor(record: PayrollRecord) {
    const current = attendanceFor(record);
    setAttendanceEditor(record);
    setAttendanceDraft({
      days_worked: String(current?.days_worked ?? 0),
      absence_days: String(current?.absence_days ?? 0),
      tardiness_minutes: String(current?.tardiness_minutes ?? 0),
      undertime_minutes: String(current?.undertime_minutes ?? 0),
      overtime_hours: String(current?.overtime_hours ?? 0),
      notes: current?.notes ?? "",
    });
    setError("");
  }

  function openAdjustmentEditor(record: PayrollRecord, kind: AdjustmentKind) {
    setAdjustmentEditor(record);
    setAdjustmentDraft({ kind, transaction_type: "", amount: "", description: "" });
    setError("");
  }

  function submitAdjustment(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!adjustmentDraft.transaction_type.trim() || Number(adjustmentDraft.amount) <= 0) {
      setError("Adjustment type and a positive amount are required.");
      return;
    }
    adjustmentMutation.mutate();
  }

  const actionCopy =
    confirmAction === "finalize"
      ? {
          title: "Finalize payroll?",
          description:
            "This creates immutable payroll records, applies approved adjustments, and records employee and employer statutory contributions.",
          button: "Finalize payroll",
          variant: "primary" as const,
        }
      : confirmAction === "paid"
        ? {
            title: "Mark payroll as paid?",
          description:
            "This records the pay cycle as paid. Confirm that the bank or cash disbursement is complete.",
            button: "Mark as paid",
            variant: "primary" as const,
          }
        : {
            title: "Publish payslips?",
          description:
            "Employees will be notified that their payslips are available with the recorded earnings, deductions, and statutory contribution details.",
            button: "Publish payslips",
            variant: "primary" as const,
          };

  return (
    <div>
      <PageHeading
        eyebrow="Pay cycle"
        title="Payroll processing"
        description="Review attendance, earnings, statutory contributions, adjustments, and net pay before finalization."
      />
      {periods.isError && (
        <Alert variant="danger" className="mb-6">
          {(periods.error as Error).message}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="h-fit print:hidden xl:sticky xl:top-24">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Pay periods</CardTitle>
                <CardDescription>
                  {periods.data?.length ?? 0} configured periods.
                </CardDescription>
              </div>
              <Button
                size="icon"
                onClick={() => {
                  setError("");
                  openCreatePeriod();
                }}
                aria-label="Create payroll period"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={periodSearch}
                onChange={(event) => setPeriodSearch(event.target.value)}
                placeholder="Search periods"
                className="pl-9"
              />
              <select
                aria-label="Filter period status"
                className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={periodStatus}
                onChange={(event) =>
                  setPeriodStatus(event.target.value as typeof periodStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="processing">Processing</option>
                <option value="review">Review</option>
                <option value="finalized">Finalized</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {periods.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : visiblePeriods.length ? (
              <>
                <div className="space-y-2">
                  {periodPagination.pageItems.map((period) => (
                    <button
                      type="button"
                      key={period.id}
                      onClick={() => selectPeriod(period.id)}
                      className={`data-row-in w-full rounded-lg border p-4 text-left transition ${selectedPeriod?.id === period.id ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-secondary/60"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">
                            {period.name}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDate(period.start_date)} to{" "}
                            {formatDate(period.end_date)}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge
                          variant={
                            period.status === "finalized" ||
                            period.status === "paid"
                              ? "success"
                              : period.status === "cancelled"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {period.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          Pay {formatDate(period.pay_date)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <ListPagination
                  total={visiblePeriods.length}
                  start={periodPagination.startIndex}
                  end={periodPagination.endIndex}
                  page={periodPagination.page}
                  pageCount={periodPagination.pageCount}
                  pageSize={periodPagination.pageSize}
                  onPageChange={periodPagination.setPage}
                  onPageSizeChange={periodPagination.setPageSize}
                />
              </>
            ) : (
              <EmptyState
                title={
                  periods.data?.length
                    ? "No matching periods"
                    : "No payroll periods"
                }
                description={
                  periods.data?.length
                    ? "Adjust your search."
                    : "Create a period before collecting inputs."
                }
              />
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          {error && (
            <Alert
              variant={
                error === "Payslips published successfully."
                  ? "default"
                  : "danger"
              }
            >
              {error}
            </Alert>
          )}
          {records.isError && (
            <Alert variant="danger" className="mb-6">
              {(records.error as Error).message}
            </Alert>
          )}
          {selectedPeriod ? (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-xl sm:text-2xl">
                        {selectedPeriod.name}
                      </CardTitle>
                      <Badge
                        variant={
                          selectedPeriod.status === "finalized" ||
                          selectedPeriod.status === "paid"
                            ? "success"
                            : selectedPeriod.status === "cancelled"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {selectedPeriod.status}
                      </Badge>
                    </div>
                    <CardDescription className="mt-2">
                      {formatDate(selectedPeriod.start_date)} to{" "}
                      {formatDate(selectedPeriod.end_date)} · Pay date{" "}
                      {formatDate(selectedPeriod.pay_date)}
                    </CardDescription>
                  </div>
                  <ActionGroup className="print:hidden sm:justify-end">
                    {selectedPeriod.status === "draft" && (
                      <>
                        <Button size="sm" className="w-full sm:w-auto" variant="ghost" onClick={openEditPeriod}>
                          <Edit3 className="h-4 w-4" />
                          Edit period
                        </Button>
                        <Button size="sm" className="w-full sm:w-auto" variant="ghost" onClick={() => setPeriodAction("delete")}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    )}
                    {!(["finalized", "paid", "cancelled"] as PayrollPeriod["status"][]).includes(selectedPeriod.status) && (
                       <Button size="sm" className="w-full sm:w-auto" variant="ghost" onClick={() => setPeriodAction("cancel")}>
                        <Ban className="h-4 w-4" />
                        Cancel period
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={requestPreview}
                      loading={preview.isFetching}
                      loadingLabel="Previewing..."
                      disabled={["finalized", "paid", "cancelled"].includes(
                        selectedPeriod.status,
                      )}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Preview
                    </Button>
                    {!["finalized", "paid", "cancelled"].includes(
                      selectedPeriod.status,
                    ) && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setConfirmAction("finalize")}
                        disabled={actionPending || !preview.isSuccess}
                      >
                        <FileCheck2 className="h-4 w-4" />
                        Finalize
                      </Button>
                    )}
                    {selectedPeriod.status === "finalized" && (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setConfirmAction("paid")}
                        disabled={actionPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark paid
                      </Button>
                    )}
                    {(selectedPeriod.status === "finalized" ||
                      selectedPeriod.status === "paid") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setConfirmAction("publish")}
                        disabled={actionPending}
                      >
                        <FileCheck2 className="h-4 w-4" />
                        Publish payslips
                      </Button>
                    )}
                  </ActionGroup>
                </CardHeader>
                <CardContent>
                  <ProcessingSteps status={selectedPeriod.status} />
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <MoneySummary
                  label="Gross pay"
                  value={totals.gross}
                  tone="default"
                />
                <MoneySummary
                  label="Deductions"
                  value={totals.deductions}
                  tone="warning"
                />
                <MoneySummary
                  label="Net pay"
                  value={totals.net}
                  tone="success"
                />
              </div>

              <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UsersRound className="h-5 w-5 text-primary" />
                      Payroll ledger
                    </CardTitle>
                    <CardDescription>
                      {displayedRecords.length} employee records{" "}
                      {preview.isSuccess
                        ? "in the current server preview"
                        : "available for this period"}
                      .
                    </CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <ActionGroup className="print:hidden sm:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => navigate("/admin/payroll/statutory-status")}
                      >
                        Review statutory status
                      </Button>
                      <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        Print
                      </Button>
                    </ActionGroup>
                    <div className="relative w-full print:hidden sm:w-64">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={recordSearch}
                        onChange={(event) => setRecordSearch(event.target.value)}
                        placeholder="Search employee"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {preview.isError && (
                    <Alert
                      variant={previewUsesLegacyRules ? "danger" : "warning"}
                      className="mb-4 print:hidden"
                    >
                      <ShieldAlert className="mr-2 inline h-4 w-4" />
                      {previewErrorMessage}
                      {previewNeedsInputs &&
                        " Complete missing salary, attendance, or loan inputs before finalization."}
                    </Alert>
                  )}
                  {!preview.isSuccess &&
                    !preview.isFetching &&
                    !["finalized", "paid", "cancelled"].includes(
                      selectedPeriod.status,
                    ) && (
                      <Alert className="mb-4 print:hidden">
                        <AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600" />
                        Run a server preview before finalizing this period. The
                        preview validates every employee input.
                      </Alert>
                    )}
                  {records.isLoading || preview.isFetching ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                    </div>
                  ) : visibleRecords.length ? (
                    <>
                       <div className="hidden print:hidden 2xl:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Employee</TableHead>
                              <TableHead>Basic pay</TableHead>
                              <TableHead>Gross</TableHead>
                              <TableHead>Loan</TableHead>
                              <TableHead>Deductions</TableHead>
                              <TableHead>Attendance</TableHead>
                              <TableHead />
                              <TableHead className="text-right">
                                Net pay
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleRecords.map((record) => (
                              <Fragment key={record.id}>
                              <TableRow>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <EmployeeAvatar
                                      photoPath={record.employee?.photo_path}
                                      name={record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : "Employee"}
                                      className="h-9 w-9 text-[10px]"
                                    />
                                    <div>
                                      <div className="font-semibold">
                                        {record.employee
                                          ? `${record.employee.last_name}, ${record.employee.first_name}`
                                          : "Employee"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {record.employee?.employee_number ??
                                          record.employee_id}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="money">
                                  {formatCurrency(record.basic_pay)}
                                </TableCell>
                                <TableCell className="money">
                                  {formatCurrency(record.gross_pay)}
                                </TableCell>
                                <TableCell className="money">
                                  {formatCurrency(record.loan_deductions)}
                                </TableCell>
                                <TableCell className="money">
                                  {formatCurrency(record.total_deductions)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatAttendanceShort(attendanceFor(record))}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setExpandedRecordId((current) => current === record.id ? null : record.id)}
                                    aria-expanded={expandedRecordId === record.id}
                                  >
                                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedRecordId === record.id ? "rotate-180" : ""}`} />
                                    Details
                                  </Button>
                                </TableCell>
                                <TableCell className="money text-right font-bold text-primary">
                                  {formatCurrency(record.net_pay)}
                                </TableCell>
                              </TableRow>
                              {expandedRecordId === record.id && (
                                <TableRow className="bg-secondary/20">
                                  <TableCell colSpan={8}>
                                    <LedgerDetails
                                      record={record}
                                      attendance={attendanceFor(record)}
                                      transactions={transactionsFor(record)}
                                      editable={periodIsEditable}
                                      onEditAttendance={() => openAttendanceEditor(record)}
                                      onAddIncome={() => openAdjustmentEditor(record, "income")}
                                      onAddDeduction={() => openAdjustmentEditor(record, "deduction")}
                                      onApprove={(kind, transaction) => setApprovalTarget({ kind, transaction })}
                                    />
                                  </TableCell>
                                </TableRow>
                              )}
                              </Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                       <div className="space-y-2 print:hidden 2xl:hidden">
                        {visibleRecords.map((record) => (
                          <div
                            key={record.id}
                            className="rounded-lg border p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <EmployeeAvatar
                                  photoPath={record.employee?.photo_path}
                                  name={record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : "Employee"}
                                  className="h-9 w-9 text-[10px]"
                                />
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">
                                    {record.employee
                                      ? `${record.employee.first_name} ${record.employee.last_name}`
                                      : "Employee"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {record.employee?.employee_number ??
                                      record.employee_id}
                                  </div>
                                </div>
                              </div>
                              <div className="money text-right font-black text-primary">
                                {formatCurrency(record.net_pay)}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 w-full"
                              onClick={() => setExpandedRecordId((current) => current === record.id ? null : record.id)}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${expandedRecordId === record.id ? "rotate-180" : ""}`} />
                              {expandedRecordId === record.id ? "Hide details" : "View ledger details"}
                            </Button>
                            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs sm:grid-cols-4">
                              <div>
                                <div className="text-muted-foreground">
                                  Basic
                                </div>
                                <div className="money mt-1 font-semibold">
                                  {formatCurrency(record.basic_pay)}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">
                                  Gross
                                </div>
                                <div className="money mt-1 font-semibold">
                                  {formatCurrency(record.gross_pay)}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">
                                  Deductions
                                </div>
                                <div className="money mt-1 font-semibold">
                                  {formatCurrency(record.total_deductions)}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">
                                  Loan repayment
                                </div>
                                <div className="money mt-1 font-semibold">
                                  {formatCurrency(record.loan_deductions)}
                                </div>
                              </div>
                            </div>
                            {expandedRecordId === record.id && (
                              <LedgerDetails
                                record={record}
                                attendance={attendanceFor(record)}
                                transactions={transactionsFor(record)}
                                editable={periodIsEditable}
                                onEditAttendance={() => openAttendanceEditor(record)}
                                onAddIncome={() => openAdjustmentEditor(record, "income")}
                                onAddDeduction={() => openAdjustmentEditor(record, "deduction")}
                                onApprove={(kind, transaction) => setApprovalTarget({ kind, transaction })}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title={
                        displayedRecords.length && recordSearch.trim()
                          ? "No matching records"
                          : preview.isSuccess
                            ? "No eligible employees"
                            : "No payroll records yet"
                      }
                      description={
                        displayedRecords.length && recordSearch.trim()
                          ? "Adjust your search."
                          : preview.isSuccess
                            ? "Check active employees and effective salary records."
                            : "Run a server-side preview after entering payroll inputs."
                      }
                    />
                  )}
                  <div className="print:hidden">
                    <ListPagination
                      total={filteredRecords.length}
                      start={recordPagination.startIndex}
                      end={recordPagination.endIndex}
                      page={recordPagination.page}
                      pageCount={recordPagination.pageCount}
                      pageSize={recordPagination.pageSize}
                      onPageChange={recordPagination.setPage}
                      onPageSizeChange={recordPagination.setPageSize}
                    />
                  </div>
                  <div className="hidden print:block">
                      <table className="print-table print-table-wide w-full text-xs">
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Attendance</th>
                            <th>Basic</th>
                            <th>Basic pay</th>
                            <th>Statutory</th>
                            <th>Employer contributions</th>
                            <th>Gross</th>
                            <th>All deductions</th>
                            <th>Net pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => (
                          <tr key={`print-${record.id}`}>
                            <td>
                              {record.employee
                                ? `${record.employee.last_name}, ${record.employee.first_name}`
                                : record.employee_id}
                            </td>
                            <td>{formatAttendanceShort(attendanceFor(record))}</td>
                            <td className="money">{formatCurrency(record.base_pay ?? record.basic_pay)}</td>
                            <td className="money">{formatCurrency(record.basic_pay)}</td>
                            <td className="money">{formatCurrency((record.employee_contributions ?? 0) + (record.withholding_tax ?? 0))}</td>
                            <td className="money">{formatCurrency(record.employer_contributions ?? 0)}</td>
                            <td className="money">{formatCurrency(record.gross_pay)}</td>
                            <td className="money">{formatCurrency(record.total_deductions)}</td>
                            <td className="money font-bold">{formatCurrency(record.net_pay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="print:hidden">
                <CardHeader>
                  <CardTitle>Control record</CardTitle>
                  <CardDescription>
                    Finalization creates an immutable audit snapshot and loan
                    repayment transaction. The loan balance decreases at
                    finalization, not again when payroll is marked paid.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                  <Control label="Inputs" value="Database records" />
                  <Control label="Calculation" value="PostgreSQL function" />
                  <Control label="Finalization" value="Atomic transaction" />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-16">
                <EmptyState
                  title="Select a payroll period"
                  description="Choose an existing period or create a new one to begin."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingPeriod ? "Edit payroll period" : "Create payroll period"}
        description="Periods cannot overlap another regular payroll period."
      >
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}
          <div>
            <Label htmlFor="period-name">Period name</Label>
            <Input
              id="period-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="October 2026 - First Cutoff"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="period-frequency">Frequency</Label>
              <select
                id="period-frequency"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.frequency}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    frequency: event.target.value as PeriodForm["frequency"],
                  }))
                }
              >
                <option value="monthly">Monthly</option>
                <option value="semi_monthly">Semi-monthly</option>
                <option value="special">Special payroll</option>
              </select>
            </div>
            <div>
              <Label htmlFor="period-pay-date">Pay date</Label>
              <Input
                id="period-pay-date"
                type="date"
                value={form.pay_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pay_date: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="period-start-date">Start date</Label>
              <Input
                id="period-start-date"
                type="date"
                value={form.start_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    start_date: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="period-end-date">End date</Label>
              <Input
                id="period-end-date"
                type="date"
                value={form.end_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    end_date: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? editingPeriod
                  ? "Updating..."
                  : "Creating..."
                : editingPeriod
                  ? "Update period"
                  : "Create period"}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(attendanceEditor && attendanceDraft)}
        onClose={() => {
          if (!attendanceMutation.isPending) {
            setAttendanceEditor(null);
            setAttendanceDraft(null);
          }
        }}
        title="Edit attendance"
        description={`${attendanceEditor?.employee?.first_name ?? "Employee"} ${attendanceEditor?.employee?.last_name ?? ""} · Changes affect the next server preview.`}
      >
        {attendanceDraft && (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              attendanceMutation.mutate(attendanceDraft);
            }}
          >
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <LedgerInput label="Days worked" value={attendanceDraft.days_worked} onChange={(value) => setAttendanceDraft((current) => current ? { ...current, days_worked: value } : current)} />
              <LedgerInput label="Absence days" value={attendanceDraft.absence_days} onChange={(value) => setAttendanceDraft((current) => current ? { ...current, absence_days: value } : current)} />
              <LedgerInput label="Tardiness (minutes)" value={attendanceDraft.tardiness_minutes} onChange={(value) => setAttendanceDraft((current) => current ? { ...current, tardiness_minutes: value } : current)} />
              <LedgerInput label="Undertime (minutes)" value={attendanceDraft.undertime_minutes} onChange={(value) => setAttendanceDraft((current) => current ? { ...current, undertime_minutes: value } : current)} />
              <LedgerInput label="Overtime (hours)" value={attendanceDraft.overtime_hours} onChange={(value) => setAttendanceDraft((current) => current ? { ...current, overtime_hours: value } : current)} />
            </div>
            <div>
              <Label htmlFor="ledger-attendance-notes">Notes</Label>
              <Input id="ledger-attendance-notes" value={attendanceDraft.notes} onChange={(event) => setAttendanceDraft((current) => current ? { ...current, notes: event.target.value } : current)} />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => { setAttendanceEditor(null); setAttendanceDraft(null); }}>Cancel</Button>
              <Button type="submit" loading={attendanceMutation.isPending} loadingLabel="Saving attendance...">Save attendance</Button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={Boolean(adjustmentEditor)}
        onClose={() => {
          if (!adjustmentMutation.isPending) setAdjustmentEditor(null);
        }}
        title={`Add ${adjustmentDraft.kind === "income" ? "income" : "deduction"}`}
        description="The adjustment is saved as pending and must be approved before it affects payroll."
      >
        <form className="space-y-5" onSubmit={submitAdjustment}>
          {error && <Alert variant="danger">{error}</Alert>}
          <div>
            <Label htmlFor="ledger-adjustment-kind">Adjustment type</Label>
            <select id="ledger-adjustment-kind" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={adjustmentDraft.kind} onChange={(event) => setAdjustmentDraft((current) => ({ ...current, kind: event.target.value as AdjustmentKind }))}>
              <option value="income">Other income</option>
              <option value="deduction">Other deduction</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ledger-adjustment-type">Type</Label>
              <Input id="ledger-adjustment-type" value={adjustmentDraft.transaction_type} onChange={(event) => setAdjustmentDraft((current) => ({ ...current, transaction_type: event.target.value }))} placeholder={adjustmentDraft.kind === "income" ? "Allowance or bonus" : "Authorized deduction"} required />
            </div>
            <div>
              <Label htmlFor="ledger-adjustment-amount">Amount</Label>
              <Input id="ledger-adjustment-amount" type="number" min="0.01" step="0.01" value={adjustmentDraft.amount} onChange={(event) => setAdjustmentDraft((current) => ({ ...current, amount: event.target.value }))} required />
            </div>
          </div>
          <div>
            <Label htmlFor="ledger-adjustment-description">Description</Label>
            <Input id="ledger-adjustment-description" value={adjustmentDraft.description} onChange={(event) => setAdjustmentDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Reason or supporting note" />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setAdjustmentEditor(null)}>Cancel</Button>
            <Button type="submit" loading={adjustmentMutation.isPending} loadingLabel="Adding adjustment...">Add pending adjustment</Button>
          </div>
        </form>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(periodAction)}
        onClose={() => setPeriodAction(null)}
        onConfirm={confirmPeriodActionNow}
        title={periodAction === "delete" ? "Delete payroll period?" : "Cancel payroll period?"}
        description={periodAction === "delete" ? "Only an empty draft can be deleted. Referenced drafts must be cancelled instead." : "The period and its audit history will be retained, but it will no longer accept payroll inputs."}
        confirmLabel={periodAction === "delete" ? "Delete period" : "Cancel period"}
        variant={periodAction === "delete" ? "danger" : "primary"}
        loading={deletePeriodMutation.isPending || cancelPeriodMutation.isPending}
      />
      <ConfirmationDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmActionNow}
        title={actionCopy.title}
        description={actionCopy.description}
        confirmLabel={actionCopy.button}
        loading={actionPending}
      >
        <div className="rounded-lg bg-secondary/60 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {selectedPeriod?.name}
          </div>
          <div className="money mt-2 text-2xl font-black">
            {formatCurrency(totals.net)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Estimated net payroll for {displayedRecords.length} employee
            records.
          </div>
        </div>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={Boolean(approvalTarget)}
        onClose={() => setApprovalTarget(null)}
        onConfirm={() => {
          if (approvalTarget) approvalMutation.mutate({ kind: approvalTarget.kind, transaction: approvalTarget.transaction, status: "approved" });
        }}
        title="Approve payroll adjustment?"
        description="This adjustment will be included in the next server preview and final payroll calculation."
        confirmLabel="Approve adjustment"
        loading={approvalMutation.isPending}
      >
        <div className="rounded-lg bg-secondary/60 p-4">
          <div className="font-semibold">{approvalTarget?.transaction.transaction_type}</div>
          <div className="money mt-1 text-xl font-black">{formatCurrency(approvalTarget?.transaction.amount)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{approvalTarget?.transaction.description || "No description"}</div>
        </div>
      </ConfirmationDialog>
    </div>
  );
}

function ProcessingSteps({ status }: { status: PayrollPeriod["status"] }) {
  const steps = ["Prepare", "Review", "Finalize", "Paid"];
  const active =
    status === "paid"
      ? 3
      : status === "finalized"
        ? 2
        : status === "review" || status === "processing"
          ? 1
          : 0;
  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((step, index) => (
        <div key={step} className="min-w-0">
          <div
            className={`h-1.5 rounded-full ${index <= active ? "bg-primary" : "bg-secondary"}`}
          />
          <div
            className={`mt-2 truncate text-[10px] font-bold uppercase tracking-wide ${index <= active ? "text-primary" : "text-muted-foreground"}`}
          >
            {step}
          </div>
        </div>
      ))}
    </div>
  );
}

function MoneySummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "warning" | "success";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`money mt-2 text-xl font-black ${tone === "success" ? "text-primary" : tone === "warning" ? "text-amber-700 dark:text-amber-300" : ""}`}
      >
        {formatCurrency(value)}
      </div>
    </Card>
  );
}

function Control({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <CircleDollarSign className="h-4 w-4 text-primary" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}

function formatAttendanceShort(attendance: PayrollRecord["attendance"]) {
  if (!attendance) return "No attendance"
  return `${Number(attendance.days_worked || 0)}d · ${Number(attendance.absence_days || 0)}a · ${Number(attendance.overtime_hours || 0)}h OT`
}

function LedgerDetails({
  record,
  attendance,
  transactions,
  editable,
  onEditAttendance,
  onAddIncome,
  onAddDeduction,
  onApprove,
}: {
  record: PayrollRecord
  attendance: PayrollRecord["attendance"]
  transactions: { income: OtherTransaction[]; deduction: OtherTransaction[] }
  editable: boolean
  onEditAttendance: () => void
  onAddIncome: () => void
  onAddDeduction: () => void
  onApprove: (kind: AdjustmentKind, transaction: OtherTransaction) => void
}) {
  const items = record.items ?? []
  const statutoryItems = items.filter((item) => item.code.endsWith("_EE") || item.code === "WITHHOLDING_TAX")
  const snapshot = record.calculation_snapshot?.statutory
  const snapshotStatutory = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : null
  const allTransactions = [
    ...transactions.income.map((transaction) => ({ kind: "income" as const, transaction })),
    ...transactions.deduction.map((transaction) => ({ kind: "deduction" as const, transaction })),
  ]

  return (
    <div className="rounded-xl border bg-background/80 p-4 text-sm shadow-sm">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="section-kicker">Employee ledger detail</div>
          <div className="mt-1 font-bold">
            {record.employee ? `${record.employee.last_name}, ${record.employee.first_name}` : record.employee_id}
          </div>
          <div className="text-xs text-muted-foreground">
            {record.employee?.employee_number ?? record.employee_id} · {record.calculation_version}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {editable && (
            <>
              <Button size="sm" variant="outline" onClick={onEditAttendance}>
                <Edit3 className="h-4 w-4" />
                Edit attendance
              </Button>
              <Button size="sm" variant="outline" onClick={onAddIncome}>
                <Plus className="h-4 w-4" />
                Add income
              </Button>
              <Button size="sm" variant="outline" onClick={onAddDeduction}>
                <Plus className="h-4 w-4" />
                Add deduction
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <DetailMetric label="Days worked" value={attendance ? `${attendance.days_worked}` : "-"} />
        <DetailMetric label="Absences" value={attendance ? `${attendance.absence_days}` : "-"} />
        <DetailMetric label="Tardiness" value={attendance ? `${attendance.tardiness_minutes} min` : "-"} />
        <DetailMetric label="Undertime" value={attendance ? `${attendance.undertime_minutes} min` : "-"} />
        <DetailMetric label="Overtime" value={attendance ? `${attendance.overtime_hours} hrs` : "-"} />
        <DetailMetric label="Hourly basis" value={formatCurrency(Number(record.calculation_snapshot?.hourly_rate || 0))} />
      </div>
      {attendance?.notes && (
        <div className="mt-3 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Attendance note:</strong> {attendance.notes}
        </div>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Earnings and attendance</div>
          <LedgerLine label="Base pay" amount={record.base_pay ?? record.basic_pay} />
          <LedgerLine label="Attendance adjustment" amount={record.attendance_deductions ?? 0} negative />
          <LedgerLine label="Basic pay after attendance" amount={record.basic_pay} />
          <LedgerLine label="Overtime pay" amount={record.overtime_pay} />
          <LedgerLine label="Other income" amount={record.other_income} />
          <LedgerLine label="Gross pay" amount={record.gross_pay} emphasized />
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Deductions and contributions</div>
          {statutoryItems.length ? statutoryItems.map((item) => <LedgerLine key={`${item.code}-${item.id ?? item.label}`} label={item.label} amount={item.amount} negative />) : (
            <>
              <LedgerLine label="Employee contributions" amount={record.employee_contributions} negative />
              <LedgerLine label="Withholding tax" amount={record.withholding_tax} negative />
            </>
          )}
          <LedgerLine label="Loan deductions" amount={record.loan_deductions} negative />
          <LedgerLine label="Other deductions" amount={record.other_deductions} negative />
          <LedgerLine label="Total employee deductions" amount={record.total_deductions} negative emphasized />
          <LedgerLine label="Net pay" amount={record.net_pay} emphasized />
          <LedgerLine label="Employer contributions" amount={record.employer_contributions ?? 0} muted />
        </div>
      </div>
      {snapshotStatutory && (
        <div className="mt-4 rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Statutory bases:</strong>{" "}
          SSS MSC {formatCurrency(readStatutoryBase(snapshotStatutory.sss, "msc"))} · PhilHealth base {formatCurrency(readStatutoryBase(snapshotStatutory.philhealth, "base"))} · Pag-IBIG base {formatCurrency(readStatutoryBase(snapshotStatutory.pagibig, "base"))}
        </div>
      )}
      {allTransactions.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Manual adjustments</div>
          <div className="space-y-2">
            {allTransactions.map(({ kind, transaction }) => (
              <div key={`${kind}-${transaction.id}`} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold">{transaction.transaction_type}</div>
                  <div className="text-xs text-muted-foreground">{transaction.description || "No description"} · {transaction.status}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="money font-bold">{kind === "deduction" ? "-" : "+"}{formatCurrency(transaction.amount)}</span>
                  {editable && transaction.status === "pending" && (
                    <Button size="sm" onClick={() => onApprove(kind, transaction)}>
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function readStatutoryBase(value: unknown, key: string) {
  if (!value || typeof value !== "object") return 0
  return Number((value as Record<string, unknown>)[key] || 0)
}

function LedgerLine({ label, amount, negative = false, emphasized = false, muted = false }: { label: string; amount: number; negative?: boolean; emphasized?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${emphasized ? "border-t pt-2 font-bold" : ""} ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className={`money ${negative ? "text-rose-700 dark:text-rose-300" : ""}`}>{negative ? "-" : ""}{formatCurrency(amount)}</span>
    </div>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  )
}

function LedgerInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  )
}
