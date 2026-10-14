import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FileText,
  MailWarning,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeading } from "@/components/layout/page-heading";
import { EmployeeAvatar } from "@/components/profile/employee-avatar";
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
import {
  DuplicateEmployeeEmailError,
  getEmployeeDirectoryPdfUrl,
  listEmployees,
  listProfileChangeRequests,
  provisionEmployeeAccount,
  reviewProfileChangeRequest,
  updateEmployeeStatus,
} from "@/services/api";
import type { Employee, EmploymentStatus } from "@/types/database";
import { formatDate, titleCase } from "@/lib/utils";
import { usePagination } from "@/lib/use-pagination";

type EmployeeFilter = "all" | EmploymentStatus;
type Feedback = {
  title: string;
  message: string;
  variant?: "default" | "danger";
};

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeFilter>("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const employees = useQuery({
    queryKey: ["employees", search],
    queryFn: () => listEmployees(search, { excludeAdmins: true }),
  });
  const requests = useQuery({
    queryKey: ["profile-change-requests"],
    queryFn: () => listProfileChangeRequests("pending"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Employee["status"] }) =>
      updateEmployeeStatus(id, status),
    onSuccess: (_employee, variables) => {
      setStatusTarget(null);
      setFeedback({
        title:
          variables.status === "inactive"
            ? "Employee archived"
            : "Employee restored",
        message:
          variables.status === "inactive"
            ? "The employee remains in the system and is now visible under the Archived filter."
            : "The employee is visible again in the default employee list.",
      });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) => {
      setStatusTarget(null);
      setFeedback({
        title: "Status update failed",
        message: (error as Error).message,
        variant: "danger",
      });
    },
  });
  const provisionMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      provisionEmployeeAccount(id, email),
    onSuccess: () => {
      setOpenMenu(null);
      setFeedback({
        title: "Portal account created",
        message:
          "The temporary password is PMS@2026 and must be changed on first login.",
      });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) =>
      setFeedback({
        title:
          error instanceof DuplicateEmployeeEmailError
            ? "Duplicate email detected"
            : "Portal account could not be created",
        message:
          error instanceof DuplicateEmployeeEmailError
            ? "The employee record was kept, but no new portal account was created. Change the email in the employee profile, then retry provisioning."
            : (error as Error).message,
        variant: "danger",
      }),
  });
  const requestMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => reviewProfileChangeRequest(id, status),
    onSuccess: () => {
      setFeedback({
        title: "Request updated",
        message: "The profile change request was updated.",
      });
      void queryClient.invalidateQueries({
        queryKey: ["profile-change-requests"],
      });
    },
    onError: (error) =>
      setFeedback({
        title: "Request update failed",
        message: (error as Error).message,
        variant: "danger",
      }),
  });

  const visibleEmployees = (employees.data ?? []).filter((employee) =>
    statusFilter === "all"
      ? employee.status !== "inactive"
      : employee.status === statusFilter,
  );
  const employeePagination = usePagination(
    visibleEmployees,
    `${search}|${statusFilter}`,
  );
  const requestPagination = usePagination(requests.data ?? []);
  const activeCount = (employees.data ?? []).filter(
    (employee) => employee.status === "active",
  ).length;
  const portalReadyCount = (employees.data ?? []).filter((employee) =>
    Boolean(employee.auth_user_id),
  ).length;
  const reviewCount = requests.data?.length ?? 0;

  function requestStatusChange(employee: Employee) {
    setOpenMenu(null);
    setStatusTarget(employee);
  }

  function confirmStatusChange() {
    if (!statusTarget) return;
    statusMutation.mutate({
      id: statusTarget.id,
      status: statusTarget.status === "inactive" ? "active" : "inactive",
    });
  }

  return (
    <div>
      <PageHeading
        eyebrow="People operations"
        title="Employees"
        description="Manage the people directory, portal access, and profile approvals from one secure workspace."
        action={{ label: "Add employee", to: "/admin/employees/new" }}
      />
      <div className="mb-6 flex justify-end">
        <Button
          variant="outline"
          onClick={async () => {
            const popup = window.open("", "_blank", "noopener,noreferrer");
            try {
              const url = await getEmployeeDirectoryPdfUrl();
              if (popup) popup.location.href = url;
              else window.open(url, "_blank", "noopener,noreferrer");
            } catch (error) {
              popup?.close();
              setFeedback({
                title: "Directory PDF unavailable",
                message: (error as Error).message,
                variant: "danger",
              });
            }
          }}
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <MiniMetric
          label="Active employees"
          value={activeCount}
          icon={UsersRound}
          detail="Ready for payroll"
        />
        <MiniMetric
          label="Portal ready"
          value={portalReadyCount}
          icon={ShieldCheck}
          detail="Employee access enabled"
        />
        <MiniMetric
          label="Needs review"
          value={reviewCount}
          icon={UserCheck}
          detail="Profile requests"
        />
      </div>
      <div className="mb-6 grid min-w-0 gap-3 rounded-xl border bg-card p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, employee number, or email"
            className="pl-10"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Directory view
          </label>
          <select
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as EmployeeFilter)
            }
          >
            <option value="all">All non-archived</option>
            <option value="active">Active</option>
            <option value="inactive">Archived</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Employee directory</CardTitle>
              <CardDescription>
                {visibleEmployees.length} records shown. Archived employees are
                hidden from the default view.
              </CardDescription>
            </div>
            <span className="section-kicker text-muted-foreground">
              People ledger
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          {employees.isError && (
            <Alert variant="danger" className="m-4">
              {(employees.error as Error).message}
            </Alert>
          )}
          {employees.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : visibleEmployees.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Portal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeePagination.pageItems.map((employee) => (
                      <EmployeeRow
                        key={employee.id}
                        employee={employee}
                        openMenu={openMenu === employee.id}
                        onMenu={() =>
                          setOpenMenu((current) =>
                            current === employee.id ? null : employee.id,
                          )
                        }
                        onProvision={() =>
                          employee.email &&
                          provisionMutation.mutate({
                            id: employee.id,
                            email: employee.email,
                          })
                        }
                        onStatus={() => requestStatusChange(employee)}
                        busy={
                          statusMutation.isPending ||
                          provisionMutation.isPending
                        }
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {employeePagination.pageItems.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    openMenu={openMenu === employee.id}
                    onMenu={() =>
                      setOpenMenu((current) =>
                        current === employee.id ? null : employee.id,
                      )
                    }
                    onProvision={() =>
                      employee.email &&
                      provisionMutation.mutate({
                        id: employee.id,
                        email: employee.email,
                      })
                    }
                    onStatus={() => requestStatusChange(employee)}
                    busy={
                      statusMutation.isPending || provisionMutation.isPending
                    }
                  />
                ))}
              </div>
              <div className="px-3 pb-3 sm:px-5">
                <ListPagination
                  total={visibleEmployees.length}
                  start={employeePagination.startIndex}
                  end={employeePagination.endIndex}
                  page={employeePagination.page}
                  pageCount={employeePagination.pageCount}
                  pageSize={employeePagination.pageSize}
                  onPageChange={employeePagination.setPage}
                  onPageSizeChange={employeePagination.setPageSize}
                />
              </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No employees found"
                description={
                  statusFilter === "inactive"
                    ? "No archived employees match this search."
                    : "Adjust your search or create the first complete employee profile."
                }
                action={
                  statusFilter === "all" ? (
                    <Link
                      to="/admin/employees/new"
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add employee
                    </Link>
                  ) : undefined
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Profile change requests</CardTitle>
          <CardDescription>
            Employee-submitted personal information changes waiting for review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <Skeleton className="h-16" />
          ) : requests.data?.length ? (
            <>
              <div className="space-y-3">
                {requestPagination.pageItems.map((request) => (
                  <div
                    key={request.id}
                    className="data-row-in flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <EmployeeAvatar
                        photoPath={request.employee?.photo_path}
                        name={request.employee ? `${request.employee.first_name} ${request.employee.last_name}` : "Employee request"}
                        className="h-10 w-10 text-xs"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold">
                          {request.employee
                            ? `${request.employee.first_name} ${request.employee.last_name}`
                            : "Employee request"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Submitted {formatDate(request.created_at.slice(0, 10))}{" "}
                          ·{" "}
                          {Object.keys(request.requested_changes).join(", ") ||
                            "Profile information"}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {request.reason || "No reason provided."}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={requestMutation.isPending}
                        loadingLabel="Updating..."
                        onClick={() =>
                          requestMutation.mutate({
                            id: request.id,
                            status: "rejected",
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        loading={requestMutation.isPending}
                        loadingLabel="Updating..."
                        onClick={() =>
                          requestMutation.mutate({
                            id: request.id,
                            status: "approved",
                          })
                        }
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <ListPagination
                total={requests.data.length}
                start={requestPagination.startIndex}
                end={requestPagination.endIndex}
                page={requestPagination.page}
                pageCount={requestPagination.pageCount}
                pageSize={requestPagination.pageSize}
                onPageChange={requestPagination.setPage}
                onPageSizeChange={requestPagination.setPageSize}
              />
            </>
          ) : (
            <EmptyState
              title="No pending requests"
              description="Approved and rejected requests remain in the audit history."
            />
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatusChange}
        title={
          statusTarget?.status === "inactive"
            ? "Restore employee?"
            : "Archive employee?"
        }
        description={
          statusTarget?.status === "inactive"
            ? "This employee will return to the default directory view."
            : "The employee record and history will be preserved, but it will leave the default directory view."
        }
        confirmLabel={
          statusTarget?.status === "inactive"
            ? "Restore employee"
            : "Archive employee"
        }
        variant={statusTarget?.status === "inactive" ? "primary" : "danger"}
        loading={statusMutation.isPending}
      />
      <Dialog
        open={Boolean(feedback)}
        onClose={() => setFeedback(null)}
        title={feedback?.title ?? ""}
      >
        <div className="space-y-5">
          <p
            className={
              feedback?.variant === "danger"
                ? "text-sm text-red-700 dark:text-red-200"
                : "text-sm text-muted-foreground"
            }
          >
            {feedback?.message}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setFeedback(null)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function EmployeeRow({
  employee,
  openMenu,
  onMenu,
  onProvision,
  onStatus,
  busy,
}: {
  employee: Employee;
  openMenu: boolean;
  onMenu: () => void;
  onProvision: () => void;
  onStatus: () => void;
  busy: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <Link
          to={`/admin/employees/${employee.id}`}
          className="flex items-center gap-3"
        >
          <EmployeeAvatar
            photoPath={employee.photo_path}
            name={`${employee.first_name} ${employee.last_name}`}
            className="h-10 w-10 text-xs"
          />
          <div>
            <div className="font-semibold hover:text-primary">
              {employee.last_name}, {employee.first_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {employee.employee_number}
            </div>
          </div>
        </Link>
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {employee.position?.name ?? "Unassigned"}
        </div>
        <div className="text-xs text-muted-foreground">
          {employee.department?.name ?? "No department"}
        </div>
      </TableCell>
      <TableCell>
        <div className="max-w-44 truncate">{employee.email ?? "No email"}</div>
        <div className="text-xs text-muted-foreground">
          {employee.contact_number ?? "No phone"}
        </div>
      </TableCell>
      <TableCell>
        <PortalStatus employee={employee} />
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(employee.status)}>
          {statusLabel(employee.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <EmployeeMenu
          employee={employee}
          open={openMenu}
          onToggle={onMenu}
          onClose={onMenu}
          onProvision={onProvision}
          onStatus={onStatus}
          busy={busy}
        />
      </TableCell>
    </TableRow>
  );
}

function EmployeeCard({
  employee,
  openMenu,
  onMenu,
  onProvision,
  onStatus,
  busy,
}: {
  employee: Employee;
  openMenu: boolean;
  onMenu: () => void;
  onProvision: () => void;
  onStatus: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/admin/employees/${employee.id}`}
          className="flex items-center gap-3"
        >
          <EmployeeAvatar
            photoPath={employee.photo_path}
            name={`${employee.first_name} ${employee.last_name}`}
            className="h-10 w-10 text-xs"
          />
          <div>
            <div className="font-semibold">
              {employee.first_name} {employee.last_name}
            </div>
            <div className="text-xs text-muted-foreground">
              {employee.employee_number}
            </div>
          </div>
        </Link>
        <EmployeeMenu
          employee={employee}
          open={openMenu}
          onToggle={onMenu}
          onClose={onMenu}
          onProvision={onProvision}
          onStatus={onStatus}
          busy={busy}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Position</div>
          <div className="font-medium">
            {employee.position?.name ?? "Unassigned"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <Badge variant={statusVariant(employee.status)}>
            {statusLabel(employee.status)}
          </Badge>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <span className="flex max-w-[70%] items-center gap-1 truncate text-xs text-muted-foreground">
          {employee.email ? (
            <MailWarning className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          ) : (
            <MailWarning className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          )}
          {employee.email ?? "Email required for portal"}
        </span>
        <PortalStatus employee={employee} />
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof UsersRound;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="money text-xl font-black">{value}</div>
          <div className="truncate text-xs font-semibold">{label}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {detail}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PortalStatus({ employee }: { employee: Employee }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge
        variant={
          employee.auth_user_id
            ? "success"
            : employee.email_duplicate
              ? "warning"
              : "warning"
        }
      >
        {employee.auth_user_id
          ? "Portal ready"
          : employee.email_duplicate
            ? "Needs email change"
            : "Setup needed"}
      </Badge>
      {employee.email_duplicate && (
        <Badge variant="warning">Duplicate email</Badge>
      )}
    </div>
  );
}

function EmployeeMenu({
  employee,
  open,
  onToggle,
  onClose,
  onProvision,
  onStatus,
  busy,
}: {
  employee: Employee;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onProvision: () => void;
  onStatus: () => void;
  busy: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 224;
      const menuHeight = employee.email && !employee.auth_user_id ? 184 : 136;
      const top =
        rect.bottom + menuHeight + 8 > window.innerHeight
          ? Math.max(8, rect.top - menuHeight - 8)
          : rect.bottom + 8;
      const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
      );
      setPosition({ top, left });
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      )
        onClose();
    };
    updatePosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [employee.auth_user_id, employee.email, onClose, open]);

  return (
    <div className="relative inline-block text-left">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${employee.first_name} ${employee.last_name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            onMouseDown={(event) => event.stopPropagation()}
            className="fixed z-[70] w-56 rounded-lg border bg-card p-1 text-left shadow-2xl"
            style={position}
            role="menu"
          >
            <Link
              to={`/admin/employees/${employee.id}`}
              onClick={onClose}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-secondary"
              role="menuitem"
            >
              <UserRound className="h-4 w-4" />
              Open full profile
            </Link>
            {!employee.auth_user_id && (
              <button
                type="button"
                disabled={busy || !employee.email}
                title={
                  !employee.email
                    ? "Add an email address to create the portal account."
                    : undefined
                }
                onClick={() => {
                  onClose();
                  onProvision();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                role="menuitem"
              >
                <UserPlus className="h-4 w-4" />
                {employee.email
                  ? "Create portal account"
                  : "Add email to create account"}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onClose();
                onStatus();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
              role="menuitem"
            >
              <FileText className="h-4 w-4" />
              {employee.status === "inactive"
                ? "Restore employee"
                : "Archive employee"}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

function statusLabel(status: Employee["status"]) {
  return status === "inactive" ? "Archived" : titleCase(status);
}
function statusVariant(status: Employee["status"]) {
  return status === "active"
    ? "success"
    : status === "inactive"
      ? "muted"
      : status === "terminated"
        ? "danger"
        : "warning";
}
