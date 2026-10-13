import { useState } from "react";
import { Check, LockKeyhole, Search, Settings2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  createPayrollPolicy,
  createStatutorySchedule,
  listPayrollPolicies,
  listStatutorySchedules,
  updateStatutoryScheduleStatus,
} from "@/services/api";
import { supabase } from "@/lib/supabase";
import {
  validatePasswordChange,
  type PasswordErrors,
  type PasswordField,
} from "@/lib/password";
import { usePagination } from "@/lib/use-pagination";

type ScheduleType = "sss" | "philhealth" | "pagibig" | "withholding_tax";
type CalculationType = "percentage" | "fixed" | "bracket";

export function AdminSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const policies = useQuery({
    queryKey: ["payroll-policies"],
    queryFn: listPayrollPolicies,
  });
  const schedules = useQuery({
    queryKey: ["statutory-schedules"],
    queryFn: listStatutorySchedules,
  });
  const [policy, setPolicy] = useState({
    name: "",
    payroll_frequency: "monthly" as "monthly" | "semi_monthly" | "special",
    work_days_per_period: "26",
    hours_per_day: "8",
    overtime_multiplier: "1.25",
    rounding_mode: "component_reconcile" as
      | "component_reconcile"
      | "final_total"
      | "component_only",
    effective_from: new Date().toISOString().slice(0, 10),
  });
  const [schedule, setSchedule] = useState({
    schedule_type: "sss" as ScheduleType,
    calculation_type: "percentage" as CalculationType,
    employee_rate: "",
    employee_amount: "",
    parameters_json: '{"brackets":[]}',
    source_url: "",
    source_reference: "",
    effective_from: new Date().toISOString().slice(0, 10),
    status: "draft" as "draft" | "approved",
  });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordBusy, setPasswordBusy] = useState(false);

  const policyMutation = useMutation({
    mutationFn: () =>
      createPayrollPolicy({
        ...policy,
        work_days_per_period: Number(policy.work_days_per_period),
        hours_per_day: Number(policy.hours_per_day),
        overtime_multiplier: Number(policy.overtime_multiplier),
        tardiness_deduction: true,
        undertime_deduction: true,
      }),
    onSuccess: () => {
      setMessage("Payroll policy saved.");
      void queryClient.invalidateQueries({ queryKey: ["payroll-policies"] });
    },
    onError: (error) => setMessage((error as Error).message),
  });
  const scheduleMutation = useMutation({
    mutationFn: () => {
      let parameters: Record<string, unknown> | undefined;
      if (schedule.calculation_type === "bracket") {
        try {
          parameters = JSON.parse(schedule.parameters_json) as Record<
            string,
            unknown
          >;
        } catch {
          throw new Error("Bracket parameters must be valid JSON.");
        }
      }
      return createStatutorySchedule({
        ...schedule,
        parameters,
        employee_rate: Number(schedule.employee_rate) || undefined,
        employee_amount: Number(schedule.employee_amount) || undefined,
      });
    },
    onSuccess: () => {
      setMessage("Statutory schedule saved.");
      void queryClient.invalidateQueries({ queryKey: ["statutory-schedules"] });
    },
    onError: (error) => setMessage((error as Error).message),
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "draft" | "approved" | "retired";
    }) => updateStatutoryScheduleStatus(id, status),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["statutory-schedules"] }),
    onError: (error) => setMessage((error as Error).message),
  });

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    const validationErrors = validatePasswordChange(password, confirmation);
    setPasswordErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setPasswordErrors({ password: error.message });
        return;
      }
      setPassword("");
      setConfirmation("");
      navigate("/admin", { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      setPasswordErrors({
        password:
          error instanceof Error
            ? error.message
            : "The password could not be updated.",
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  function clearPasswordError(field: PasswordField) {
    setPasswordErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <div>
      <PageHeading
        eyebrow="Administration"
        title="System settings"
        description="Configure the payroll policy and maintain effective-dated statutory schedules before processing any payroll."
      />
      {message && (
        <Alert
          className="mb-6"
          variant={
            message.includes("saved") || message.includes("successfully")
              ? "default"
              : "danger"
          }
        >
          {message}
        </Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <PolicyCard
          policy={policy}
          setPolicy={setPolicy}
          policies={policies.data ?? []}
          loading={policies.isLoading}
          saving={policyMutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            policyMutation.mutate();
          }}
        />
        <ScheduleCard
          schedule={schedule}
          setSchedule={setSchedule}
          schedules={schedules.data ?? []}
          loading={schedules.isLoading}
          saving={scheduleMutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            scheduleMutation.mutate();
          }}
          onApprove={(id) => statusMutation.mutate({ id, status: "approved" })}
          statusBusy={statusMutation.isPending}
        />
      </div>
      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" />
            Change password
          </CardTitle>
          <CardDescription>Administrator account security.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={changePassword} className="space-y-4">
            <div>
              <Label htmlFor="admin-new-password">New password</Label>
              <Input
                id="admin-new-password"
                type="password"
                minLength={8}
                value={password}
                onFocus={() => clearPasswordError("password")}
                onChange={(event) => {
                  clearPasswordError("password");
                  setPassword(event.target.value);
                }}
                aria-invalid={Boolean(passwordErrors.password)}
                aria-describedby={
                  passwordErrors.password
                    ? "admin-new-password-error"
                    : undefined
                }
                className={
                  passwordErrors.password
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
                    : undefined
                }
                required
              />
              {passwordErrors.password && (
                <p
                  id="admin-new-password-error"
                  className="mt-1 text-xs font-medium text-red-600"
                >
                  {passwordErrors.password}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="admin-confirm-password">
                Confirm new password
              </Label>
              <Input
                id="admin-confirm-password"
                type="password"
                minLength={8}
                value={confirmation}
                onFocus={() => clearPasswordError("confirmation")}
                onChange={(event) => {
                  clearPasswordError("confirmation");
                  setConfirmation(event.target.value);
                }}
                aria-invalid={Boolean(passwordErrors.confirmation)}
                aria-describedby={
                  passwordErrors.confirmation
                    ? "admin-confirm-password-error"
                    : undefined
                }
                className={
                  passwordErrors.confirmation
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
                    : undefined
                }
                required
              />
              {passwordErrors.confirmation && (
                <p
                  id="admin-confirm-password-error"
                  className="mt-1 text-xs font-medium text-red-600"
                >
                  {passwordErrors.confirmation}
                </p>
              )}
            </div>
              <Button
                type="submit"
                loading={passwordBusy}
                loadingLabel="Updating..."
              >
                Update password
              </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PolicyCard({
  policy,
  setPolicy,
  policies,
  loading,
  saving,
  onSubmit,
}: {
  policy: {
    name: string;
    payroll_frequency: "monthly" | "semi_monthly" | "special";
    work_days_per_period: string;
    hours_per_day: string;
    overtime_multiplier: string;
    rounding_mode: "component_reconcile" | "final_total" | "component_only";
    effective_from: string;
  };
  setPolicy: React.Dispatch<
    React.SetStateAction<{
      name: string;
      payroll_frequency: "monthly" | "semi_monthly" | "special";
      work_days_per_period: string;
      hours_per_day: string;
      overtime_multiplier: string;
      rounding_mode: "component_reconcile" | "final_total" | "component_only";
      effective_from: string;
    }>
  >;
  policies: Array<{
    id: string;
    name: string;
    effective_from: string;
    is_active: boolean;
  }>;
  loading: boolean;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [search, setSearch] = useState("");
  const visiblePolicies = policies.filter((item) =>
    `${item.name} ${item.effective_from} ${item.is_active ? "active" : "inactive"}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const policyPagination = usePagination(visiblePolicies, search);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Payroll policy
        </CardTitle>
        <CardDescription>
          There is no assumed policy. A valid active policy is required before
          preview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label>Policy name</Label>
            <Input
              value={policy.name}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Institution standard 2026"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Frequency</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={policy.payroll_frequency}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    payroll_frequency: event.target
                      .value as typeof current.payroll_frequency,
                  }))
                }
              >
                <option value="monthly">Monthly</option>
                <option value="semi_monthly">Semi-monthly</option>
                <option value="special">Special</option>
              </select>
            </div>
            <div>
              <Label>Effective from</Label>
              <Input
                type="date"
                value={policy.effective_from}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    effective_from: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Work days</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={policy.work_days_per_period}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    work_days_per_period: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label>Hours per day</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={policy.hours_per_day}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    hours_per_day: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label>Overtime multiplier</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={policy.overtime_multiplier}
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    overtime_multiplier: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>
          <div>
            <Label>Rounding mode</Label>
            <select
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              value={policy.rounding_mode}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  rounding_mode: event.target
                    .value as typeof current.rounding_mode,
                }))
              }
            >
              <option value="component_reconcile">
                Component rounding with final reconciliation
              </option>
              <option value="final_total">Round final total only</option>
              <option value="component_only">Round components only</option>
            </select>
          </div>
          <Button
            type="submit"
            loading={saving}
            loadingLabel="Saving..."
          >
            Save active policy
          </Button>
        </form>
        <div className="mt-6 border-t pt-5">
          <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Existing policies
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search policies"
              className="pl-9"
            />
          </div>
          {loading ? (
            <Skeleton className="h-10" />
          ) : visiblePolicies.length ? (
            <>
              <div className="space-y-2">
                {policyPagination.pageItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>
                      {item.name} · {item.effective_from}
                    </span>
                    <Badge variant={item.is_active ? "success" : "muted"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
              <ListPagination
                total={visiblePolicies.length}
                start={policyPagination.startIndex}
                end={policyPagination.endIndex}
                page={policyPagination.page}
                pageCount={policyPagination.pageCount}
                pageSize={policyPagination.pageSize}
                onPageChange={policyPagination.setPage}
                onPageSizeChange={policyPagination.setPageSize}
              />
            </>
          ) : policies.length ? (
            <p className="text-sm text-muted-foreground">
              No matching policies.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No policies configured.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleCard({
  schedule,
  setSchedule,
  schedules,
  loading,
  saving,
  onSubmit,
  onApprove,
  statusBusy,
}: {
  schedule: {
    schedule_type: ScheduleType;
    calculation_type: CalculationType;
    employee_rate: string;
    employee_amount: string;
    parameters_json: string;
    source_url: string;
    source_reference: string;
    effective_from: string;
    status: "draft" | "approved";
  };
  setSchedule: React.Dispatch<
    React.SetStateAction<{
      schedule_type: ScheduleType;
      calculation_type: CalculationType;
      employee_rate: string;
      employee_amount: string;
      parameters_json: string;
      source_url: string;
      source_reference: string;
      effective_from: string;
      status: "draft" | "approved";
    }>
  >;
  schedules: Array<{
    id: string;
    schedule_type: string;
    effective_from: string;
    status: "draft" | "approved" | "retired";
  }>;
  loading: boolean;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onApprove: (id: string) => void;
  statusBusy: boolean;
}) {
  const [search, setSearch] = useState("");
  const visibleSchedules = schedules.filter((item) =>
    `${item.schedule_type} ${item.effective_from} ${item.status}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const schedulePagination = usePagination(visibleSchedules, search);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statutory schedules</CardTitle>
        <CardDescription>
          Load official schedules with source references before approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Schedule type</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={schedule.schedule_type}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    schedule_type: event.target.value as ScheduleType,
                  }))
                }
              >
                <option value="sss">SSS</option>
                <option value="philhealth">PhilHealth</option>
                <option value="pagibig">Pag-IBIG</option>
                <option value="withholding_tax">Withholding tax</option>
              </select>
            </div>
            <div>
              <Label>Calculation type</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={schedule.calculation_type}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    calculation_type: event.target.value as CalculationType,
                  }))
                }
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
                <option value="bracket">Bracket reference</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Employee rate</Label>
              <Input
                type="number"
                min="0"
                step="0.000001"
                value={schedule.employee_rate}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    employee_rate: event.target.value,
                  }))
                }
                placeholder="Decimal form, e.g. 0.05"
              />
            </div>
            <div>
              <Label>Employee fixed amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={schedule.employee_amount}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    employee_amount: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          {schedule.calculation_type === "bracket" && (
            <div>
              <Label>Bracket parameters JSON</Label>
              <Input
                value={schedule.parameters_json}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    parameters_json: event.target.value,
                  }))
                }
                placeholder='{"brackets":[{"min":0,"max":10000,"employee_rate":0}]}'
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use official brackets only. Each bracket may contain min, max,
                base, employee_rate, and employee_amount.
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Effective from</Label>
              <Input
                type="date"
                value={schedule.effective_from}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    effective_from: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div>
              <Label>Initial status</Label>
              <select
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={schedule.status}
                onChange={(event) =>
                  setSchedule((current) => ({
                    ...current,
                    status: event.target.value as "draft" | "approved",
                  }))
                }
              >
                <option value="draft">Draft for review</option>
                <option value="approved">Approved</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Official source URL</Label>
            <Input
              type="url"
              value={schedule.source_url}
              onChange={(event) =>
                setSchedule((current) => ({
                  ...current,
                  source_url: event.target.value,
                }))
              }
              required
            />
          </div>
          <div>
            <Label>Source reference</Label>
            <Input
              value={schedule.source_reference}
              onChange={(event) =>
                setSchedule((current) => ({
                  ...current,
                  source_reference: event.target.value,
                }))
              }
              placeholder="Circular, schedule year, or official notice"
              required
            />
          </div>
          <Button
            type="submit"
            loading={saving}
            loadingLabel="Saving..."
          >
            Save schedule
          </Button>
        </form>
        <div className="mt-6 space-y-2 border-t pt-5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search statutory schedules"
              className="pl-9"
            />
          </div>
          {loading ? (
            <Skeleton className="h-10" />
          ) : visibleSchedules.length ? (
            schedulePagination.pageItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  {item.schedule_type.toUpperCase()} · {item.effective_from}
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      item.status === "approved"
                        ? "success"
                        : item.status === "draft"
                          ? "warning"
                          : "muted"
                    }
                  >
                    {item.status}
                  </Badge>
                  {item.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={statusBusy}
                      loadingLabel="Approving..."
                      onClick={() => onApprove(item.id)}
                      disabled={statusBusy}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : schedules.length ? (
            <p className="text-sm text-muted-foreground">
              No matching statutory schedules.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No statutory schedules configured.
            </p>
          )}
          {visibleSchedules.length > 0 && (
            <ListPagination
              total={visibleSchedules.length}
              start={schedulePagination.startIndex}
              end={schedulePagination.endIndex}
              page={schedulePagination.page}
              pageCount={schedulePagination.pageCount}
              pageSize={schedulePagination.pageSize}
              onPageChange={schedulePagination.setPage}
              onPageSizeChange={schedulePagination.setPageSize}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
