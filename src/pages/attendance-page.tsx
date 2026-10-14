import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Printer,
  Save,
  Search,
  Trash2,
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
import { PrintReport } from "@/components/ui/print-report";
import {
  deleteAttendance,
  listAttendance,
  listEmployees,
  listPayrollPeriods,
  saveAttendance,
} from "@/services/api";
import type { Attendance } from "@/types/database";
import { usePagination } from "@/lib/use-pagination";

type AttendanceDraft = {
  payroll_period_id: string;
  employee_id: string;
  days_worked: number | "";
  absence_days: number | "";
  tardiness_minutes: number | "";
  undertime_minutes: number | "";
  overtime_hours: number | "";
  notes: string;
};
const blankDraft = (periodId: string, employeeId: string): AttendanceDraft => ({
  payroll_period_id: periodId,
  employee_id: employeeId,
  days_worked: "",
  absence_days: "",
  tardiness_minutes: "",
  undertime_minutes: "",
  overtime_hours: "",
  notes: "",
});

export function AttendancePage() {
  const queryClient = useQueryClient();
  const periods = useQuery({
    queryKey: ["payroll-periods"],
    queryFn: listPayrollPeriods,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
  });
  const [periodId, setPeriodId] = useState("");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const attendance = useQuery({
    queryKey: ["attendance", periodId],
    queryFn: () => listAttendance(periodId),
    enabled: Boolean(periodId),
  });
  const activeEmployees = useMemo(
    () =>
      employees.data?.filter(
        (employee) =>
          employee.status === "active" &&
          `${employee.first_name} ${employee.last_name} ${employee.employee_number}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ) ?? [],
    [employees.data, search],
  );
  const employeePagination = usePagination(
    activeEmployees,
    `${periodId}|${search}`,
  );
  const allActiveEmployees = useMemo(
    () =>
      employees.data?.filter((employee) => employee.status === "active") ?? [],
    [employees.data],
  );
  const completedCount = periodId ? (attendance.data?.length ?? 0) : 0;
  const isLocked = Boolean(
    periods.data?.find(
      (period) =>
        period.id === periodId &&
        ["finalized", "paid", "cancelled"].includes(period.status),
    ),
  );

  useEffect(() => {
    if (!periodId && periods.data?.[0]) setPeriodId(periods.data[0].id);
  }, [periodId, periods.data]);
  useEffect(() => {
    if (!periodId) return;
    const existing = Object.fromEntries(
      (attendance.data ?? []).map((row) => [
        row.employee_id,
        {
          payroll_period_id: row.payroll_period_id,
          employee_id: row.employee_id,
          days_worked: row.days_worked,
          absence_days: row.absence_days,
          tardiness_minutes: row.tardiness_minutes,
          undertime_minutes: row.undertime_minutes,
          overtime_hours: row.overtime_hours,
          notes: row.notes ?? "",
        },
      ]),
    );
    setDrafts(existing);
    setDirtyRows(new Set());
  }, [attendance.data, periodId]);

  const saveMutation = useMutation({
    mutationFn: (draft: AttendanceDraft) =>
      saveAttendance(normalizeDraft(draft)),
    onSuccess: () => {
      setMessage("Attendance saved.");
      void queryClient.invalidateQueries({
        queryKey: ["attendance", periodId],
      });
    },
    onError: (error) => setMessage((error as Error).message),
  });
  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const pending = Array.from(dirtyRows)
        .map((employeeId) => drafts[employeeId])
        .filter((draft): draft is AttendanceDraft => Boolean(draft));
      await Promise.all(
        pending.map((draft) => saveAttendance(normalizeDraft(draft))),
      );
    },
    onSuccess: () => {
      setDirtyRows(new Set());
      setMessage("All attendance changes saved.");
      void queryClient.invalidateQueries({
        queryKey: ["attendance", periodId],
      });
    },
    onError: (error) => setMessage((error as Error).message),
  });
  const clearMutation = useMutation({
    mutationFn: (attendanceId: string) => deleteAttendance(attendanceId),
    onSuccess: () => {
      setMessage("Attendance record cleared.");
      void queryClient.invalidateQueries({
        queryKey: ["attendance", periodId],
      });
    },
    onError: (error) => setMessage((error as Error).message),
  });

  function draftFor(employeeId: string) {
    return drafts[employeeId] ?? blankDraft(periodId, employeeId);
  }
  function update(
    employeeId: string,
    field: keyof Omit<AttendanceDraft, "payroll_period_id" | "employee_id">,
    value: string,
  ) {
    const current = draftFor(employeeId);
    setDrafts((all) => ({
      ...all,
      [employeeId]: {
        ...current,
        [field]:
          field === "notes"
            ? value
            : value === ""
              ? ""
              : Math.max(0, Number(value)),
      },
    }));
    setDirtyRows((rows) => new Set(rows).add(employeeId));
    setMessage("");
  }
  function saveOne(employeeId: string) {
    saveMutation.mutate(draftFor(employeeId));
    setDirtyRows((rows) => {
      const next = new Set(rows);
      next.delete(employeeId);
      return next;
    });
  }
  function clearOne(employeeId: string) {
    const existing = attendance.data?.find(
      (row) => row.employee_id === employeeId,
    );
    if (existing) clearMutation.mutate(existing.id);
    else {
      setDrafts((all) => ({
        ...all,
        [employeeId]: blankDraft(periodId, employeeId),
      }));
      setDirtyRows((rows) => {
        const next = new Set(rows);
        next.delete(employeeId);
        return next;
      });
      setMessage("Unsaved attendance cleared.");
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Payroll inputs"
        title="Attendance"
        description="Record period-specific attendance before payroll is previewed and finalized."
        actions={
          <ActionGroup>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print register
            </Button>
          </ActionGroup>
        }
      />
      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-3 shadow-sm print:hidden sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <Label htmlFor="attendance-period">Payroll period</Label>
          <select
            id="attendance-period"
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            value={periodId}
            onChange={(event) => {
              setPeriodId(event.target.value);
              setMessage("");
            }}
          >
            <option value="">Select a period</option>
            {periods.data?.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name} ({period.status})
              </option>
            ))}
          </select>
        </div>
        <div className="relative self-end">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter employees"
          />
        </div>
      </div>
      {message && (
        <Alert
          className="mb-6"
          variant={
            message.toLowerCase().includes("saved") ? "default" : "danger"
          }
        >
          {message}
        </Alert>
      )}
      {!periodId ? (
        <EmptyState
          title="Choose a payroll period"
          description="Attendance belongs to exactly one payroll period."
        />
      ) : (
        <>
           <div className="mb-6 grid gap-3 print:hidden sm:grid-cols-3">
            <AttendanceMetric
              label="Completion"
              value={`${completedCount}/${allActiveEmployees.length}`}
              detail="Employee records"
              icon={CalendarCheck2}
            />
            <AttendanceMetric
              label="Unsaved changes"
              value={dirtyRows.size}
              detail="Ready to save"
              icon={Save}
              warning={dirtyRows.size > 0}
            />
            <AttendanceMetric
              label="Period status"
              value={isLocked ? "Locked" : "Open"}
              detail={
                isLocked
                  ? "Finalized periods cannot change"
                  : "Inputs can be corrected"
              }
              icon={CheckCircle2}
              warning={isLocked}
            />
          </div>
           <Card className="print:hidden">
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck2 className="h-5 w-5 text-primary" />
                  Attendance register
                </CardTitle>
                <CardDescription>
                  {activeEmployees.length} active employees shown. Units are
                  days, minutes, and hours.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <Badge variant={isLocked ? "muted" : "warning"}>
                  {isLocked ? "Locked inputs" : "Draft inputs"}
                </Badge>
                <Button
                  size="sm"
                  onClick={() => saveAllMutation.mutate()}
                  loading={saveAllMutation.isPending}
                  loadingLabel="Saving all..."
                  disabled={isLocked || !dirtyRows.size}
                >
                  <Save className="h-4 w-4" />
                  Save all changes
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {employees.isLoading || attendance.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : activeEmployees.length === 0 ? (
                <EmptyState
                  title="No active employees found"
                  description="Add or activate employees before entering attendance."
                />
              ) : (
                <>
                  <div className="hidden lg:block">
                    <AttendanceTable
                      employees={employeePagination.pageItems}
                      draftFor={draftFor}
                      update={update}
                      saveOne={saveOne}
                      clearOne={clearOne}
                      dirtyRows={dirtyRows}
                      locked={isLocked}
                      busy={saveMutation.isPending || clearMutation.isPending}
                    />
                  </div>
                  <div className="space-y-3 lg:hidden">
                    {employeePagination.pageItems.map((employee) => (
                      <AttendanceCard
                        key={employee.id}
                        employee={employee}
                        draft={draftFor(employee.id)}
                        update={update}
                        saveOne={saveOne}
                        clearOne={clearOne}
                        dirty={dirtyRows.has(employee.id)}
                        locked={isLocked}
                        busy={saveMutation.isPending || clearMutation.isPending}
                      />
                    ))}
                  </div>
                  <ListPagination
                    total={activeEmployees.length}
                    start={employeePagination.startIndex}
                    end={employeePagination.endIndex}
                    page={employeePagination.page}
                    pageCount={employeePagination.pageCount}
                    pageSize={employeePagination.pageSize}
                    onPageChange={employeePagination.setPage}
                    onPageSizeChange={employeePagination.setPageSize}
                  />
                </>
              )}
            </CardContent>
           </Card>
           <PrintReport
             title="Attendance register"
             subtitle={`${periods.data?.find((period) => period.id === periodId)?.name ?? "Payroll period"} · ${allActiveEmployees.length} active employees`}
           >
             <table className="print-table print-table-wide w-full text-xs">
               <thead><tr><th>Employee</th><th>Days worked</th><th>Absences</th><th>Tardiness</th><th>Undertime</th><th>Overtime</th><th>Notes</th></tr></thead>
               <tbody>
                 {allActiveEmployees.map((employee) => {
                   const row = draftFor(employee.id)
                   return <tr key={`print-attendance-${employee.id}`}><td>{employee.employee_number} · {employee.last_name}, {employee.first_name}</td><td>{row.days_worked || 0}</td><td>{row.absence_days || 0}</td><td>{row.tardiness_minutes || 0} min</td><td>{row.undertime_minutes || 0} min</td><td>{row.overtime_hours || 0} hrs</td><td>{row.notes || ""}</td></tr>
                 })}
               </tbody>
             </table>
           </PrintReport>
         </>
      )}
    </div>
  );
}

function AttendanceTable({
  employees,
  draftFor,
  update,
  saveOne,
  clearOne,
  dirtyRows,
  locked,
  busy,
}: {
  employees: Array<{
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    photo_path?: string | null;
  }>;
  draftFor: (id: string) => AttendanceDraft;
  update: (
    id: string,
    field: keyof Omit<AttendanceDraft, "payroll_period_id" | "employee_id">,
    value: string,
  ) => void;
  saveOne: (id: string) => void;
  clearOne: (id: string) => void;
  dirtyRows: Set<string>;
  locked: boolean;
  busy: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Days worked</TableHead>
          <TableHead>Absences</TableHead>
          <TableHead>Tardiness</TableHead>
          <TableHead>Undertime</TableHead>
          <TableHead>Overtime</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => {
          const draft = draftFor(employee.id);
          return (
            <TableRow key={employee.id} className="data-row-in">
              <TableCell>
                <div className="flex items-center gap-3">
                  <EmployeeAvatar
                    photoPath={employee.photo_path}
                    name={`${employee.first_name} ${employee.last_name}`}
                    className="h-9 w-9 text-[10px]"
                  />
                  <div>
                    <div className="font-semibold">
                      {employee.last_name}, {employee.first_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {employee.employee_number}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <CompactNumber
                  value={draft.days_worked}
                  onChange={(value) =>
                    update(employee.id, "days_worked", value)
                  }
                  disabled={locked}
                />
              </TableCell>
              <TableCell>
                <CompactNumber
                  value={draft.absence_days}
                  onChange={(value) =>
                    update(employee.id, "absence_days", value)
                  }
                  disabled={locked}
                />
              </TableCell>
              <TableCell>
                <CompactNumber
                  value={draft.tardiness_minutes}
                  onChange={(value) =>
                    update(employee.id, "tardiness_minutes", value)
                  }
                  disabled={locked}
                />
              </TableCell>
              <TableCell>
                <CompactNumber
                  value={draft.undertime_minutes}
                  onChange={(value) =>
                    update(employee.id, "undertime_minutes", value)
                  }
                  disabled={locked}
                />
              </TableCell>
              <TableCell>
                <CompactNumber
                  value={draft.overtime_hours}
                  onChange={(value) =>
                    update(employee.id, "overtime_hours", value)
                  }
                  disabled={locked}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    variant={dirtyRows.has(employee.id) ? "primary" : "outline"}
                    loading={busy && dirtyRows.has(employee.id)}
                    loadingLabel="Saving..."
                    onClick={() => saveOne(employee.id)}
                    disabled={locked || !dirtyRows.has(employee.id)}
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Clear attendance for ${employee.first_name} ${employee.last_name}`}
                    onClick={() => clearOne(employee.id)}
                    disabled={locked || busy}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function AttendanceCard({
  employee,
  draft,
  update,
  saveOne,
  clearOne,
  dirty,
  locked,
  busy,
}: {
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    photo_path?: string | null;
  };
  draft: AttendanceDraft;
  update: (
    id: string,
    field: keyof Omit<AttendanceDraft, "payroll_period_id" | "employee_id">,
    value: string,
  ) => void;
  saveOne: (id: string) => void;
  clearOne: (id: string) => void;
  dirty: boolean;
  locked: boolean;
  busy: boolean;
}) {
  return (
    <div className="data-row-in rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            photoPath={employee.photo_path}
            name={`${employee.first_name} ${employee.last_name}`}
            className="h-9 w-9 text-[10px]"
          />
          <div>
            <div className="font-semibold">
              {employee.first_name} {employee.last_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {employee.employee_number}
            </div>
          </div>
        </div>
        <Badge variant={dirty ? "warning" : "muted"}>
          {dirty ? "Unsaved" : "Saved"}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumericField
          label="Days worked"
          value={draft.days_worked}
          onChange={(value) => update(employee.id, "days_worked", value)}
          disabled={locked}
        />
        <NumericField
          label="Absences"
          value={draft.absence_days}
          onChange={(value) => update(employee.id, "absence_days", value)}
          disabled={locked}
        />
        <NumericField
          label="Tardiness (min)"
          value={draft.tardiness_minutes}
          onChange={(value) => update(employee.id, "tardiness_minutes", value)}
          disabled={locked}
        />
        <NumericField
          label="Undertime (min)"
          value={draft.undertime_minutes}
          onChange={(value) => update(employee.id, "undertime_minutes", value)}
          disabled={locked}
        />
        <NumericField
          label="Overtime (hrs)"
          value={draft.overtime_hours}
          onChange={(value) => update(employee.id, "overtime_hours", value)}
          disabled={locked}
        />
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor={`attendance-notes-${employee.id}`}>Notes</Label>
          <Input
            id={`attendance-notes-${employee.id}`}
            value={draft.notes ?? ""}
            onChange={(event) =>
              update(employee.id, "notes", event.target.value)
            }
            disabled={locked}
          />
        </div>
      </div>
      <ActionGroup className="mt-4 sm:justify-start">
        <Button
          className="w-full sm:w-auto"
          variant={dirty ? "primary" : "outline"}
          loading={busy && dirty}
          loadingLabel="Saving..."
          onClick={() => saveOne(employee.id)}
          disabled={locked || !dirty}
        >
          <Save className="h-4 w-4" />
          {dirty ? "Save attendance" : "Attendance saved"}
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant="ghost"
          onClick={() => clearOne(employee.id)}
          disabled={locked || busy}
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </ActionGroup>
    </div>
  );
}

function NumericField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | "";
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
function CompactNumber({
  value,
  onChange,
  disabled,
}: {
  value: number | "";
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      className="h-9 w-24"
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  );
}
function AttendanceMetric({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof CalendarCheck2;
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
        <div>
          <div className="money text-xl font-black">{value}</div>
          <div className="text-xs font-semibold">{label}</div>
          <div className="text-[11px] text-muted-foreground">{detail}</div>
        </div>
      </div>
    </Card>
  );
}

function normalizeDraft(
  draft: AttendanceDraft,
): Omit<Attendance, "id" | "created_at" | "updated_at" | "employee"> {
  return {
    payroll_period_id: draft.payroll_period_id,
    employee_id: draft.employee_id,
    days_worked: Number(draft.days_worked || 0),
    absence_days: Number(draft.absence_days || 0),
    tardiness_minutes: Number(draft.tardiness_minutes || 0),
    undertime_minutes: Number(draft.undertime_minutes || 0),
    overtime_hours: Number(draft.overtime_hours || 0),
    notes: draft.notes || null,
  };
}
