import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  HandCoins,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmployeeAvatar } from "@/components/profile/employee-avatar";
import { useAuth } from "@/contexts/auth-context";
import { useTimeContext } from "@/lib/use-time-context";
import { formatCurrency, formatDate, titleCase } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ListPagination } from "@/components/ui/list-pagination";
import { usePagination } from "@/lib/use-pagination";
import { NexMascot } from "@/components/brand/nex-mascot";
import {
  listAttendance,
  listEmployeeLoans,
  listPayrollPeriods,
  listPayrollRecords,
} from "@/services/api";

export function EmployeeDashboardPage() {
  const { employee } = useAuth();
  const { greeting, today } = useTimeContext();
  const [showBalance, setShowBalance] = useState(true);
  const payroll = useQuery({
    queryKey: ["my-payroll"],
    queryFn: () => listPayrollRecords(),
  });
  const loans = useQuery({
    queryKey: ["my-loans"],
    queryFn: listEmployeeLoans,
  });
  const periods = useQuery({
    queryKey: ["my-periods"],
    queryFn: listPayrollPeriods,
  });
  const attendance = useQuery({
    queryKey: ["my-attendance"],
    queryFn: () => listAttendance(),
  });
  const ownLoans =
    loans.data?.filter((loan) => loan.employee_id === employee?.id) ?? [];
  const allOwnPayroll = useMemo(
    () =>
      (
        payroll.data?.filter((record) => record.employee_id === employee?.id) ??
        []
      ).sort((a, b) => {
        const periodA = periods.data?.find(
          (period) => period.id === a.payroll_period_id,
        );
        const periodB = periods.data?.find(
          (period) => period.id === b.payroll_period_id,
        );
        return (periodB?.pay_date ?? periodB?.end_date ?? "").localeCompare(
          periodA?.pay_date ?? periodA?.end_date ?? "",
        );
      }),
    [employee?.id, payroll.data, periods.data],
  );
  const payrollPagination = usePagination(allOwnPayroll, "", 5);
  const ownPayroll = payrollPagination.pageItems;
  const ownAttendance = useMemo(
    () =>
      (
        attendance.data?.filter(
          (record) => record.employee_id === employee?.id,
        ) ?? []
      ).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [attendance.data, employee?.id],
  );
  const latestPay = allOwnPayroll[0];
  const latestAttendance = ownAttendance[0];
  const latestPeriod = periods.data?.find(
    (period) => period.id === latestPay?.payroll_period_id,
  );
  const activeLoans = ownLoans.filter((loan) => loan.status === "active");
  const activeLoanBalance = activeLoans.reduce(
    (sum, loan) => sum + Number(loan.outstanding_balance),
    0,
  );
  const hasError =
    payroll.isError || loans.isError || periods.isError || attendance.isError;
  const displayName = employee
    ? `${employee.first_name} ${employee.last_name}`.trim()
    : "colleague";

  return (
    <div className="page-transition space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="section-kicker">Employee wallet</div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}, {employee?.first_name || "colleague"}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {today} · Your private payroll workspace.
          </p>
        </div>
        <Link
          to="/employee/profile"
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
        >
          <UserRound className="h-4 w-4 text-primary" />
          View profile
        </Link>
      </header>
      {hasError && (
        <Alert variant="danger">
          Some account information could not be loaded. Refresh the page or
          contact your administrator if the problem continues.
        </Alert>
      )}
      <section className="surface-glow relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-900 p-5 text-white shadow-lift sm:p-7">
        <NexMascot decorative size="lg" className="absolute -bottom-8 right-[-1rem] z-0 h-40 w-40 opacity-[0.08] sm:h-52 sm:w-52 lg:bottom-auto lg:right-5 lg:top-1/2 lg:h-64 lg:w-64 lg:-translate-y-1/2 lg:opacity-10" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <EmployeeAvatar
                photoPath={employee?.photo_path}
                name={displayName}
                className="h-12 w-12 border border-white/20 bg-white/10 text-white"
                alt={displayName}
              />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                  Payroll wallet
                </div>
                <div className="mt-1 text-sm text-slate-300">{displayName}</div>
              </div>
            </div>
            <WalletCards className="h-7 w-7 text-emerald-200" />
          </div>
          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                <span>Latest take-home pay</span>
                <button
                  type="button"
                  onClick={() => setShowBalance((value) => !value)}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label={
                    showBalance ? "Hide take-home pay" : "Show take-home pay"
                  }
                >
                  {showBalance ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="money mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {payroll.isLoading ? (
                  <span className="inline-block h-10 w-44 rounded-lg bg-white/10 shimmer" />
                ) : latestPay ? (
                  showBalance ? (
                    formatCurrency(latestPay.net_pay)
                  ) : (
                    "••••••"
                  )
                ) : (
                  "Not published"
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                {latestPeriod ? (
                  <>
                    <span>{latestPeriod.name}</span>
                    <span className="text-slate-500">·</span>
                    <span>Pay date {formatDate(latestPeriod.pay_date)}</span>
                  </>
                ) : (
                  <span>Your finalized payroll will appear here.</span>
                )}
              </div>
            </div>
            <Link
              to="/employee/payslips"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-200 active:scale-[0.98]"
            >
              Open payslips <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="section-kicker">Shortcuts</div>
            <h2 className="mt-1 text-lg font-bold">What do you need today?</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickAction
            to="/employee/attendance"
            icon={CalendarDays}
            label="Attendance"
            detail="Review records"
          />
          <QuickAction
            to="/employee/payroll"
            icon={ReceiptText}
            label="Payroll"
            detail="See finalized pay"
          />
          <QuickAction
            to="/employee/payslips"
            icon={FileText}
            label="Payslips"
            detail="Download documents"
          />
          <QuickAction
            to="/employee/profile"
            icon={UserRound}
            label="Profile"
            detail="Keep details current"
          />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="motion-card">
          <CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Recent payroll activity</CardTitle>
              <CardDescription>
                Your latest published payroll records.
              </CardDescription>
            </div>
            <Link
              to="/employee/payroll"
              className="text-sm font-semibold text-primary transition hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {payroll.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : ownPayroll.length === 0 ? (
              <EmptyState
                title="No published payroll yet"
                description="Your administrator will publish payroll after finalization."
              />
            ) : (
              <div className="space-y-2">
                {ownPayroll.map((record) => {
                  const period = periods.data?.find(
                    (item) => item.id === record.payroll_period_id,
                  );
                  return (
                    <div
                      key={record.id}
                      className="motion-card flex items-center gap-3 rounded-lg border p-4"
                    >
                      <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                        <ReceiptText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">
                          {period?.name ?? "Payroll record"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {period
                            ? `${formatDate(period.start_date)} to ${formatDate(period.end_date)}`
                            : "Period details unavailable"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="money font-bold text-primary">
                          {showBalance
                            ? formatCurrency(record.net_pay)
                            : "••••••"}
                        </div>
                        <Badge variant="success">Finalized</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <ListPagination
              total={allOwnPayroll.length}
              start={payrollPagination.startIndex}
              end={payrollPagination.endIndex}
              page={payrollPagination.page}
              pageCount={payrollPagination.pageCount}
              pageSize={payrollPagination.pageSize}
              onPageChange={payrollPagination.setPage}
              onPageSizeChange={payrollPagination.setPageSize}
            />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="motion-card">
            <CardHeader>
              <CardTitle>Money snapshot</CardTitle>
              <CardDescription>
                A compact view of your current payroll picture.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Metric
                label="Loan balance"
                value={
                  showBalance ? formatCurrency(activeLoanBalance) : "••••••"
                }
                icon={HandCoins}
                tone="amber"
              />
              <Metric
                label="Days worked"
                value={latestAttendance?.days_worked ?? 0}
                icon={Clock3}
                tone="teal"
              />
              <Metric
                label="Employment"
                value={titleCase(employee?.status) || "Not set"}
                icon={UserRound}
                tone="violet"
              />
              <Metric
                label="Department"
                value={employee?.department?.name ?? "Unassigned"}
                icon={WalletCards}
                tone="navy"
              />
            </CardContent>
          </Card>
          <Card className="motion-card">
            <CardContent className="flex items-center gap-4 p-5">
              <EmployeeAvatar
                photoPath={employee?.photo_path}
                name={displayName}
                className="h-14 w-14 text-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold">Profile snapshot</div>
                <div className="truncate text-sm text-muted-foreground">
                  {employee?.position?.name ?? "Position not assigned"}
                </div>
                <Link
                  to="/employee/profile"
                  className="mt-2 inline-flex items-center text-sm font-semibold text-primary hover:underline"
                >
                  Manage profile <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  detail,
}: {
  to: string;
  icon: typeof CalendarDays;
  label: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="motion-card group rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
      </div>
      <div className="mt-4 text-sm font-bold">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </Link>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof HandCoins;
  tone: "amber" | "teal" | "violet" | "navy";
}) {
  const tones = {
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    teal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    violet:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200",
    navy: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };
  return (
    <div className="min-w-0">
      <div className={`mb-2 inline-flex rounded-lg p-2 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="money truncate text-base font-bold sm:text-lg">
        {value}
      </div>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
