import { useMemo, useState } from "react";
import {
  Download,
  FileBarChart,
  Filter,
  Printer,
  Search,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  getPayrollReportPdfUrl,
  listPayrollPeriods,
  listPayrollRecords,
} from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PayrollRecord } from "@/types/database";
import { usePagination } from "@/lib/use-pagination";

export function ReportsPage() {
  const periods = useQuery({
    queryKey: ["payroll-periods"],
    queryFn: listPayrollPeriods,
  });
  const [periodId, setPeriodId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const records = useQuery({
    queryKey: ["report-payroll-records", periodId],
    queryFn: () => listPayrollRecords(periodId || undefined),
    enabled: periods.isSuccess,
  });
  const finalizedPeriodIds = new Set(
    (periods.data ?? [])
      .filter(
        (period) => period.status === "finalized" || period.status === "paid",
      )
      .map((period) => period.id),
  );
  const finalizedRecords =
    records.data?.filter(
      (record) =>
        finalizedPeriodIds.has(record.payroll_period_id) &&
        (!periodId || record.payroll_period_id === periodId),
    ) ?? [];
  const filteredRecords = finalizedRecords.filter((record) =>
    `${record.employee?.first_name ?? ""} ${record.employee?.last_name ?? ""} ${record.employee?.employee_number ?? ""} ${record.employee_id}`
      .toLowerCase()
      .includes(employeeSearch.trim().toLowerCase()),
  );
  const reportPagination = usePagination(filteredRecords, employeeSearch, 10);
  const visibleRecords = reportPagination.pageItems;
  const chartData = useMemo(
    () =>
      filteredRecords
        .map((record) => ({
          name: record.employee
            ? `${record.employee.first_name} ${record.employee.last_name}`
            : record.employee_id.slice(0, 8),
          netPay: Number(record.net_pay || 0),
        }))
        .sort((a, b) => b.netPay - a.netPay)
        .slice(0, 10),
    [filteredRecords],
  );
  const totals = filteredRecords.reduce(
    (result, record) => ({
      gross: result.gross + Number(record.gross_pay || 0),
      deductions: result.deductions + Number(record.total_deductions || 0),
      net: result.net + Number(record.net_pay || 0),
    }),
    { gross: 0, deductions: 0, net: 0 },
  );

  function exportCsv() {
    const header = [
      "Employee number",
      "Employee name",
      "Gross pay",
      "Total deductions",
      "Net pay",
    ];
    const rows = filteredRecords.map((record) => [
      record.employee?.employee_number ?? record.employee_id,
      record.employee
        ? `${record.employee.first_name} ${record.employee.last_name}`
        : "Employee",
      record.gross_pay,
      record.total_deductions,
      record.net_pay,
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payroll-report-${periodId || "all"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    setPdfBusy(true);
    setPdfError("");
    try {
      const url = await getPayrollReportPdfUrl(periodId || undefined);
      if (popup) popup.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      popup?.close();
      setPdfError((error as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Insights"
        title="Reports and analytics"
        description="Review finalized prototype payroll records using real database transactions. Draft calculations are never presented as historical reports, and statutory/tax deductions remain zero."
      />
      <Card className="mb-6 print:hidden">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="grid w-full gap-4 sm:max-w-2xl sm:grid-cols-2">
            <div>
              <label
                htmlFor="report-period"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Payroll period
              </label>
              <select
                id="report-period"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
              >
                <option value="">All finalized records</option>
                {periods.data
                  ?.filter(
                    (period) =>
                      period.status === "finalized" || period.status === "paid",
                  )
                  .map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="report-employee"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Employee filter
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="report-employee"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Search employee or number"
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <ActionGroup className="sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={exportCsv}
              disabled={!visibleRecords.length}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => void exportPdf()}
              loading={pdfBusy}
              loadingLabel="Preparing PDF..."
              disabled={!filteredRecords.length || pdfBusy}
            >
              <FileBarChart className="h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </ActionGroup>
        </CardContent>
      </Card>
      {pdfError && <Alert variant="danger" className="mb-6">{pdfError}</Alert>}
      {records.isError && (
        <Alert variant="danger" className="mb-6">
          {(records.error as Error).message}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Gross pay"
          value={formatCurrency(totals.gross)}
          icon={TrendingUp}
        />
        <Metric
          label="Deductions"
          value={formatCurrency(totals.deductions)}
          icon={Filter}
        />
        <Metric
          label="Net pay"
          value={formatCurrency(totals.net)}
          icon={FileBarChart}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Net pay by employee</CardTitle>
            <CardDescription>
              Top ten employees in the selected finalized records.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `₱${Math.round(Number(value) / 1000)}k`
                    }
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar dataKey="netPay" fill="#0f766e" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title={
                  finalizedRecords.length && employeeSearch.trim()
                    ? "No matching finalized data"
                    : "No finalized data"
                }
                description={
                  finalizedRecords.length && employeeSearch.trim()
                    ? "Adjust your employee search."
                    : "Finalize payroll before generating historical charts."
                }
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Finalized payroll</CardTitle>
            <CardDescription>
              Actual records available for reporting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.isLoading ? (
              <div className="space-y-3">
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : visibleRecords.length ? (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Net pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRecords.map((record) => (
                        <ReportRow
                          key={record.id}
                          record={record}
                          period={periods.data?.find(
                            (item) => item.id === record.payroll_period_id,
                          )}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-2 md:hidden">
                  {visibleRecords.map((record) => (
                    <ReportCard
                      key={record.id}
                      record={record}
                      period={periods.data?.find(
                        (item) => item.id === record.payroll_period_id,
                      )}
                    />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title={
                  finalizedRecords.length && employeeSearch.trim()
                    ? "No matching report records"
                    : "No report records"
                }
                description={
                  finalizedRecords.length && employeeSearch.trim()
                    ? "Adjust your employee search."
                    : "Only finalized or paid payroll records appear here."
                }
              />
            )}
            <ListPagination
              total={filteredRecords.length}
              start={reportPagination.startIndex}
              end={reportPagination.endIndex}
              page={reportPagination.page}
              pageCount={reportPagination.pageCount}
              pageSize={reportPagination.pageSize}
              onPageChange={reportPagination.setPage}
              onPageSizeChange={reportPagination.setPageSize}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportRow({
  record,
  period,
}: {
  record: PayrollRecord;
  period?: { start_date: string; end_date: string };
}) {
  return (
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
              {record.employee?.employee_number}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {period
          ? `${formatDate(period.start_date)} - ${formatDate(period.end_date)}`
          : "Unknown period"}
      </TableCell>
      <TableCell className="money text-right font-bold text-primary">
        {formatCurrency(record.net_pay)}
      </TableCell>
    </TableRow>
  );
}

function ReportCard({
  record,
  period,
}: {
  record: PayrollRecord;
  period?: { start_date: string; end_date: string };
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4">
      <EmployeeAvatar
        photoPath={record.employee?.photo_path}
        name={record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : "Employee"}
        className="h-9 w-9 text-[10px]"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          {record.employee
            ? `${record.employee.first_name} ${record.employee.last_name}`
            : "Employee"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {period
            ? `${formatDate(period.start_date)} - ${formatDate(period.end_date)}`
            : "Unknown period"}
        </div>
      </div>
      <div className="text-right">
        <div className="money font-bold text-primary">
          {formatCurrency(record.net_pay)}
        </div>
        <Badge variant="success">Finalized</Badge>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="money text-xl font-black">{value}</div>
          <div className="text-xs font-semibold">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function SkeletonRow() {
  return <div className="h-12 animate-pulse rounded-lg bg-secondary" />;
}
