import { useMemo, useState } from "react";
import {
  CalendarRange,
  Check,
  CircleDollarSign,
  Printer,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeading } from "@/components/layout/page-heading";
import { EmployeeAvatar } from "@/components/profile/employee-avatar";
import { ActionGroup } from "@/components/ui/action-group";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPagination } from "@/components/ui/list-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePagination } from "@/lib/use-pagination";
import {
  approveSalaryHistory,
  createSalaryHistory,
  listEmployees,
  listSalaryHistory,
} from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";

type SalaryForm = {
  employee_id: string;
  salary_type: "monthly" | "daily" | "hourly";
  amount: string;
  effective_from: string;
  effective_to: string;
  source: string;
};
type SalaryRecord = {
  id: string;
  employee?: {
    employee_number: string;
    first_name: string;
    last_name: string;
    photo_path?: string | null;
  };
  salary_type: string;
  amount: number;
  effective_from: string;
  effective_to: string | null;
  is_approved: boolean;
};
const blank: SalaryForm = {
  employee_id: "",
  salary_type: "monthly",
  amount: "",
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
  source: "",
};

export function SalariesPage() {
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["salary-history"],
    queryFn: listSalaryHistory,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
  });
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<SalaryRecord | null>(
    null,
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<
    "all" | "approved" | "pending"
  >("all");
  const records = (history.data ?? []) as SalaryRecord[];
  const visibleHistory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((row) => {
      const employee = row.employee;
      const matchesApproval =
        approvalFilter === "all" ||
        (approvalFilter === "approved" ? row.is_approved : !row.is_approved);
      return (
        matchesApproval &&
        `${employee?.first_name ?? ""} ${employee?.last_name ?? ""} ${employee?.employee_number ?? ""} ${row.salary_type} ${row.amount} ${row.effective_from} ${row.effective_to ?? ""} ${row.is_approved ? "approved" : "review required"}`
          .toLowerCase()
          .includes(normalizedSearch)
      );
    });
  }, [approvalFilter, records, search]);
  const historyPagination = usePagination(
    visibleHistory,
    `${search}|${approvalFilter}`,
  );
  const pendingCount = records.filter((row) => !row.is_approved).length;
  const monthlyTotal = records
    .filter((row) => row.is_approved && row.salary_type === "monthly")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const createMutation = useMutation({
    mutationFn: () =>
      createSalaryHistory({
        ...form,
        amount: Number(form.amount),
        effective_to: form.effective_to || undefined,
        is_approved: true,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm(blank);
      void queryClient.invalidateQueries({ queryKey: ["salary-history"] });
    },
    onError: (errorValue) => setError((errorValue as Error).message),
  });
  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      approveSalaryHistory(id, approved),
    onSuccess: () => {
      setApprovalTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["salary-history"] });
    },
    onError: (errorValue) => setError((errorValue as Error).message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.employee_id || Number(form.amount) <= 0 || !form.effective_from) {
      setError("Employee, positive amount, and effective date are required.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div>
      <PageHeading
        eyebrow="Compensation"
        title="Salary configuration"
        description="Manage effective-dated compensation and keep approved salary records ready for payroll."
        actions={
          <ActionGroup>
            <Button className="w-full sm:w-auto" onClick={() => {
              setError("");
              setForm(blank);
              setOpen(true);
            }}>
              <Plus className="h-4 w-4" />
              Add salary configuration
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </ActionGroup>
        }
      />
      {error && (
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SalaryMetric
          label="Salary records"
          value={records.length}
          detail="Effective-dated history"
          icon={CalendarRange}
        />
        <SalaryMetric
          label="Review required"
          value={pendingCount}
          detail="Imported or unapproved"
          icon={ShieldCheck}
          warning={pendingCount > 0}
        />
        <SalaryMetric
          label="Monthly configured"
          value={formatCurrency(monthlyTotal)}
          detail="Approved monthly values"
          icon={CircleDollarSign}
        />
      </div>
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                Salary history
              </CardTitle>
              <CardDescription>
                {records.length} effective-dated records.
              </CardDescription>
            </div>
            <span className="section-kicker text-muted-foreground">
              Compensation ledger
            </span>
          </div>
          <div className="grid gap-3 print:hidden sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee, number, or type"
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filter salary status"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={approvalFilter}
              onChange={(event) =>
                setApprovalFilter(event.target.value as typeof approvalFilter)
              }
            >
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Review required</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : visibleHistory.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyPagination.pageItems.map((row) => (
                      <SalaryRow
                        key={row.id}
                        row={row}
                        onApprove={() => setApprovalTarget(row)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {historyPagination.pageItems.map((row) => (
                  <SalaryCard
                    key={row.id}
                    row={row}
                    onApprove={() => setApprovalTarget(row)}
                  />
                ))}
              </div>
              <ListPagination
                total={visibleHistory.length}
                start={historyPagination.startIndex}
                end={historyPagination.endIndex}
                page={historyPagination.page}
                pageCount={historyPagination.pageCount}
                pageSize={historyPagination.pageSize}
                onPageChange={historyPagination.setPage}
                onPageSizeChange={historyPagination.setPageSize}
              />
            </>
          ) : history.data?.length ? (
            <EmptyState
              title="No matching salary history"
              description="Adjust your search or status filter."
            />
          ) : (
            <EmptyState
              title="No salary history"
              description="Add an approved salary configuration before payroll."
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={() => {
          if (!createMutation.isPending) setOpen(false);
        }}
        title="Add salary configuration"
        description="New administrator configurations are approved immediately. Imported values can be reviewed separately."
      >
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert variant="danger">{error}</Alert>}
          <div>
            <Label htmlFor="salary-employee">Employee</Label>
            <select
              id="salary-employee"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={form.employee_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  employee_id: event.target.value,
                }))
              }
            >
              <option value="">Select employee</option>
              {employees.data?.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_number} - {employee.last_name},{" "}
                  {employee.first_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SalaryTypeCapsules
              value={form.salary_type}
              onChange={(salary_type) =>
                setForm((current) => ({ ...current, salary_type }))
              }
            />
            <div>
              <Label htmlFor="salary-amount">Amount</Label>
              <Input
                id="salary-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="salary-from">Effective from</Label>
              <Input
                id="salary-from"
                type="date"
                value={form.effective_from}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    effective_from: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="salary-to">Effective to</Label>
              <Input
                id="salary-to"
                type="date"
                value={form.effective_to}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    effective_to: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="salary-source">Source or approval note</Label>
            <Input
              id="salary-source"
              value={form.source}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  source: event.target.value,
                }))
              }
              placeholder="Administrator configuration"
              required
            />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              loadingLabel="Saving..."
            >
              Save salary
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmationDialog
        open={Boolean(approvalTarget)}
        onClose={() => setApprovalTarget(null)}
        onConfirm={() => {
          if (approvalTarget)
            approveMutation.mutate({ id: approvalTarget.id, approved: true });
        }}
        title="Approve salary record?"
        description="This effective-dated salary can be used by the payroll preview when its dates match the pay period."
        confirmLabel="Approve salary"
        loading={approveMutation.isPending}
      >
        <div className="rounded-lg bg-secondary/60 p-4">
          <div className="font-semibold">
            {approvalTarget?.employee
              ? `${approvalTarget.employee.first_name} ${approvalTarget.employee.last_name}`
              : "Employee"}
          </div>
          <div className="money mt-1 text-xl font-black">
            {formatCurrency(approvalTarget?.amount)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Effective{" "}
            {approvalTarget ? formatDate(approvalTarget.effective_from) : ""}
          </div>
        </div>
      </ConfirmationDialog>
    </div>
  );
}

function SalaryRow({
  row,
  onApprove,
}: {
  row: SalaryRecord;
  onApprove: () => void;
}) {
  return (
    <TableRow className="data-row-in">
      <TableCell>
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            photoPath={row.employee?.photo_path}
            name={row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : "Employee"}
            className="h-9 w-9 text-[10px]"
          />
          <div>
            <div className="font-semibold">
              {row.employee
                ? `${row.employee.last_name}, ${row.employee.first_name}`
                : "Employee"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.employee?.employee_number}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="capitalize">{row.salary_type}</TableCell>
      <TableCell className="money font-semibold">
        {formatCurrency(row.amount)}
      </TableCell>
      <TableCell>
        <div>{formatDate(row.effective_from)}</div>
        <div className="text-xs text-muted-foreground">
          to {row.effective_to ? formatDate(row.effective_to) : "current"}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={row.is_approved ? "success" : "warning"}>
          {row.is_approved ? "Approved" : "Review required"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {!row.is_approved && (
          <Button size="sm" variant="outline" onClick={onApprove}>
            <Check className="h-4 w-4" />
            Approve
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function SalaryCard({
  row,
  onApprove,
}: {
  row: SalaryRecord;
  onApprove: () => void;
}) {
  return (
    <div className="data-row-in rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar
            photoPath={row.employee?.photo_path}
            name={row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : "Employee"}
            className="h-9 w-9 text-[10px]"
          />
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {row.employee
                ? `${row.employee.first_name} ${row.employee.last_name}`
                : "Employee"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.employee?.employee_number} ·{" "}
              <span className="capitalize">{row.salary_type}</span>
            </div>
          </div>
        </div>
        <Badge variant={row.is_approved ? "success" : "warning"}>
          {row.is_approved ? "Approved" : "Review required"}
        </Badge>
      </div>
      <div className="money mt-4 text-xl font-black">
        {formatCurrency(row.amount)}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatDate(row.effective_from)} to{" "}
        {row.effective_to ? formatDate(row.effective_to) : "current"}
      </div>
      {!row.is_approved && (
        <Button className="mt-4 w-full" variant="outline" onClick={onApprove}>
          <Check className="h-4 w-4" />
          Approve salary
        </Button>
      )}
    </div>
  );
}

function SalaryMetric({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof CircleDollarSign;
  warning?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-lg p-2 ${warning ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-primary/10 text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="money truncate text-xl font-black">{value}</div>
          <div className="truncate text-xs font-semibold">{label}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {detail}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SalaryTypeCapsules({
  value,
  onChange,
}: {
  value: SalaryForm["salary_type"];
  onChange: (value: SalaryForm["salary_type"]) => void;
}) {
  const options: Array<{ value: SalaryForm["salary_type"]; label: string }> = [
    { value: "monthly", label: "MONTHLY" },
    { value: "daily", label: "DAILY" },
    { value: "hourly", label: "HOURLY" },
  ];
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">Salary type</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Salary type">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-10 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-xs font-bold tracking-wide transition ${value === option.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
          >
            <input
              type="radio"
              name="salary-type"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
