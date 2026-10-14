import { useMemo, useState } from "react";
import {
  Edit3,
  HandCoins,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Trash2,
  WalletCards,
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
import { Dialog } from "@/components/ui/dialog";
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
import {
  createEmployeeLoan,
  createLoanType,
  listEmployeeLoans,
  listEmployees,
  listLoanTypes,
  deleteEmployeeLoan,
  deleteLoanType,
  updateEmployeeLoan,
  updateLoanType,
  updateLoanPriority,
} from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { EmployeeLoan, LoanType } from "@/types/database";
import { usePagination } from "@/lib/use-pagination";

type LoanTypeForm = {
  name: string;
  description: string;
  default_terms: string;
};
type LoanForm = {
  employee_id: string;
  loan_type_id: string;
  loan_date: string;
  principal_amount: string;
  repayment_terms: string;
  installment_amount: string;
  priority: string;
  status: EmployeeLoan["status"];
};
const emptyLoanType: LoanTypeForm = {
  name: "",
  description: "",
  default_terms: "",
};
const emptyLoan: LoanForm = {
  employee_id: "",
  loan_type_id: "",
  loan_date: new Date().toISOString().slice(0, 10),
  principal_amount: "",
  repayment_terms: "",
  installment_amount: "",
  priority: "",
  status: "active",
};

export function LoansPage() {
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ["loan-types"], queryFn: listLoanTypes });
  const loans = useQuery({
    queryKey: ["employee-loans"],
    queryFn: listEmployeeLoans,
  });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
  });
  const [typeDialog, setTypeDialog] = useState(false);
  const [loanDialog, setLoanDialog] = useState(false);
  const [typeForm, setTypeForm] = useState(emptyLoanType);
  const [loanForm, setLoanForm] = useState(emptyLoan);
  const [editingType, setEditingType] = useState<LoanType | null>(null);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [typeSearch, setTypeSearch] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const typeMutation = useMutation({
    mutationFn: () =>
      editingType
        ? updateLoanType(editingType.id, {
            name: typeForm.name,
            description: typeForm.description,
            default_terms: Number(typeForm.default_terms) || undefined,
            is_active: editingType.is_active,
          })
        : createLoanType({
            name: typeForm.name,
            description: typeForm.description,
            default_terms: Number(typeForm.default_terms) || undefined,
          }),
    onSuccess: () => {
      setTypeDialog(false);
      setTypeForm(emptyLoanType);
      setEditingType(null);
      void queryClient.invalidateQueries({ queryKey: ["loan-types"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const loanMutation = useMutation({
    mutationFn: () =>
      editingLoan
        ? updateEmployeeLoan(editingLoan.id, {
            loan_type_id: loanForm.loan_type_id,
            loan_date: loanForm.loan_date,
            principal_amount: Number(loanForm.principal_amount),
            repayment_terms: Number(loanForm.repayment_terms),
            installment_amount: Number(loanForm.installment_amount),
            priority: loanForm.priority ? Number(loanForm.priority) : null,
            status: loanForm.status,
          })
        : createEmployeeLoan({
            employee_id: loanForm.employee_id,
            loan_type_id: loanForm.loan_type_id,
            loan_date: loanForm.loan_date,
            principal_amount: Number(loanForm.principal_amount),
            repayment_terms: Number(loanForm.repayment_terms),
            installment_amount: Number(loanForm.installment_amount),
            priority: loanForm.priority ? Number(loanForm.priority) : null,
          }),
    onSuccess: () => {
      setLoanDialog(false);
      setLoanForm(emptyLoan);
      setEditingLoan(null);
      void queryClient.invalidateQueries({ queryKey: ["employee-loans"] });
    },
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number | null }) =>
      updateLoanPriority(id, priority),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => deleteLoanType(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["loan-types"] }),
    onError: (mutationError) => setError((mutationError as Error).message),
  });
  const deleteLoanMutation = useMutation({
    mutationFn: (id: string) => deleteEmployeeLoan(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["employee-loans"] }),
    onError: (mutationError) => setError((mutationError as Error).message),
  });

  const visibleTypes = useMemo(
    () =>
      types.data?.filter((type) =>
        `${type.name} ${type.description ?? ""} ${type.default_terms ?? ""}`
          .toLowerCase()
          .includes(typeSearch.toLowerCase()),
      ) ?? [],
    [typeSearch, types.data],
  );
  const visibleLoans = useMemo(
    () =>
      loans.data?.filter((loan) =>
        `${loan.employee?.first_name} ${loan.employee?.last_name} ${loan.employee?.employee_number} ${loan.loan_type?.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ) ?? [],
    [loans.data, search],
  );
  const typePagination = usePagination(visibleTypes, typeSearch);
  const loanPagination = usePagination(visibleLoans, search);
  const activeLoans =
    loans.data?.filter((loan) => loan.status === "active") ?? [];
  const outstanding = activeLoans.reduce(
    (sum, loan) => sum + Number(loan.outstanding_balance || 0),
    0,
  );
  const missingPriority = activeLoans.filter(
    (loan) => loan.priority === null,
  ).length;

  function submitType(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!typeForm.name.trim()) {
      setError("Loan type name is required.");
      return;
    }
    typeMutation.mutate();
  }
  function submitLoan(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (
      !loanForm.employee_id ||
      !loanForm.loan_type_id ||
      Number(loanForm.principal_amount) <= 0 ||
      Number(loanForm.repayment_terms) <= 0 ||
      Number(loanForm.installment_amount) <= 0
    ) {
      setError(
        "Employee, loan type, principal, terms, and installment amount are required.",
      );
      return;
    }
    loanMutation.mutate();
  }

  function editType(type: LoanType) {
    setError("");
    setEditingType(type);
    setTypeForm({
      name: type.name,
      description: type.description ?? "",
      default_terms: type.default_terms ? String(type.default_terms) : "",
    });
    setTypeDialog(true);
  }

  function toggleType(type: LoanType) {
    setError("");
    updateLoanType(type.id, {
      name: type.name,
      description: type.description ?? "",
      default_terms: type.default_terms ?? undefined,
      is_active: !type.is_active,
    })
      .then(
        () => void queryClient.invalidateQueries({ queryKey: ["loan-types"] }),
      )
      .catch((mutationError) => setError((mutationError as Error).message));
  }

  function editLoan(loan: EmployeeLoan) {
    setError("");
    setEditingLoan(loan);
    setLoanForm({
      employee_id: loan.employee_id,
      loan_type_id: loan.loan_type_id,
      loan_date: loan.loan_date,
      principal_amount: String(loan.principal_amount),
      repayment_terms: String(loan.repayment_terms),
      installment_amount: String(loan.installment_amount),
      priority: loan.priority === null ? "" : String(loan.priority),
      status: loan.status,
    });
    setLoanDialog(true);
  }

  return (
    <div>
      <PageHeading
        eyebrow="Employee finance"
        title="Loans"
        description="Track outstanding balances and set the deduction order used during payroll finalization. Preview estimates each installment; finalization posts the repayment and reduces the balance."
        actions={
          <ActionGroup>
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
              setError("");
              setEditingType(null);
              setTypeForm(emptyLoanType);
              setTypeDialog(true);
            }}>
              <Plus className="h-4 w-4" />
              Loan type
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => {
              setError("");
              setEditingLoan(null);
              setLoanForm(emptyLoan);
              setLoanDialog(true);
            }}>
              <Plus className="h-4 w-4" />
              Employee loan
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
        <LoanMetric
          label="Outstanding balance"
          value={formatCurrency(outstanding)}
          detail="Active principal"
          icon={WalletCards}
        />
        <LoanMetric
          label="Active loans"
          value={activeLoans.length}
          detail="Currently deducting"
          icon={HandCoins}
        />
        <LoanMetric
          label="Priority missing"
          value={missingPriority}
          detail="Must be resolved before payroll"
          icon={ShieldAlert}
          warning={missingPriority > 0}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Loan types</CardTitle>
                <CardDescription>Active repayment categories.</CardDescription>
              </div>
              <span className="section-kicker text-muted-foreground">
                Catalog
              </span>
            </div>
            <div className="relative mt-3 print:hidden">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={typeSearch}
                onChange={(event) => setTypeSearch(event.target.value)}
                placeholder="Search loan types"
              />
            </div>
          </CardHeader>
          <CardContent>
            {types.isLoading ? (
              <Skeleton className="h-20" />
            ) : types.data?.length ? (
              visibleTypes.length ? (
                <>
                  <div className="space-y-2">
                    {typePagination.pageItems.map((type) => (
                      <LoanTypeCard
                        key={type.id}
                        type={type}
                        onEdit={() => editType(type)}
                        onToggle={() => toggleType(type)}
                        onDelete={() => deleteTypeMutation.mutate(type.id)}
                        busy={deleteTypeMutation.isPending}
                      />
                    ))}
                  </div>
                  <ListPagination
                    total={visibleTypes.length}
                    start={typePagination.startIndex}
                    end={typePagination.endIndex}
                    page={typePagination.page}
                    pageCount={typePagination.pageCount}
                    pageSize={typePagination.pageSize}
                    onPageChange={typePagination.setPage}
                    onPageSizeChange={typePagination.setPageSize}
                  />
                </>
              ) : (
                <EmptyState
                  title="No matching loan types"
                  description="Try a different search."
                />
              )
            ) : (
              <EmptyState
                title="No loan types"
                description="Create a loan type before creating employee loans."
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Employee loans</CardTitle>
              <CardDescription>
                {visibleLoans.length} records shown. Priority controls the
                payroll deduction order.
              </CardDescription>
            </div>
            <div className="relative w-full print:hidden sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search employee or loan"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loans.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : visibleLoans.length ? (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Loan type</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Installment</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loanPagination.pageItems.map((loan) => (
                        <LoanRow
                          key={loan.id}
                          loan={loan}
                          busy={priorityMutation.isPending}
                          onPriority={(priority) =>
                            priorityMutation.mutate({ id: loan.id, priority })
                          }
                          onEdit={() => editLoan(loan)}
                          onDelete={() => deleteLoanMutation.mutate(loan.id)}
                          actionBusy={deleteLoanMutation.isPending}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">
                  {loanPagination.pageItems.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      busy={priorityMutation.isPending}
                      onPriority={(priority) =>
                        priorityMutation.mutate({ id: loan.id, priority })
                      }
                      onEdit={() => editLoan(loan)}
                      onDelete={() => deleteLoanMutation.mutate(loan.id)}
                      actionBusy={deleteLoanMutation.isPending}
                    />
                  ))}
                </div>
                <ListPagination
                  total={visibleLoans.length}
                  start={loanPagination.startIndex}
                  end={loanPagination.endIndex}
                  page={loanPagination.page}
                  pageCount={loanPagination.pageCount}
                  pageSize={loanPagination.pageSize}
                  onPageChange={loanPagination.setPage}
                  onPageSizeChange={loanPagination.setPageSize}
                />
              </>
            ) : (
              <EmptyState
                title="No employee loans"
                description="Create a loan when an employee has an approved repayment arrangement."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={typeDialog}
        onClose={() => setTypeDialog(false)}
        title={editingType ? "Edit loan type" : "Create loan type"}
        description="Loan types are deactivated rather than deleted once referenced."
      >
        <form onSubmit={submitType} className="space-y-5">
          <div>
            <Label htmlFor="loan-type-name">Name</Label>
            <Input
              id="loan-type-name"
              value={typeForm.name}
              onChange={(event) =>
                setTypeForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="loan-type-description">Description</Label>
            <Input
              id="loan-type-description"
              value={typeForm.description}
              onChange={(event) =>
                setTypeForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="loan-type-terms">Default repayment terms</Label>
            <Input
              id="loan-type-terms"
              type="number"
              min="1"
              value={typeForm.default_terms}
              onChange={(event) =>
                setTypeForm((current) => ({
                  ...current,
                  default_terms: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTypeDialog(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={typeMutation.isPending}>
              {editingType ? "Update loan type" : "Save loan type"}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={loanDialog}
        onClose={() => setLoanDialog(false)}
        title={editingLoan ? "Edit employee loan" : "Create employee loan"}
        description="A priority must be assigned before the loan can be deducted during finalization."
      >
        <form onSubmit={submitLoan} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="loan-employee">Employee</Label>
              <select
                id="loan-employee"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={loanForm.employee_id}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    employee_id: event.target.value,
                  }))
                }
              >
                <option value="">Select employee</option>
                {employees.data
                  ?.filter((employee) => employee.status === "active")
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_number} - {employee.last_name},{" "}
                      {employee.first_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="loan-type">Loan type</Label>
              <select
                id="loan-type"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                value={loanForm.loan_type_id}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    loan_type_id: event.target.value,
                  }))
                }
              >
                <option value="">Select loan type</option>
                {types.data
                  ?.filter((type) => type.is_active)
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="loan-date">Loan date</Label>
              <Input
                id="loan-date"
                type="date"
                value={loanForm.loan_date}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    loan_date: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="loan-priority">Priority</Label>
              <Input
                id="loan-priority"
                type="number"
                min="1"
                value={loanForm.priority}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
                placeholder="Required before payroll"
              />
            </div>
            {editingLoan && (
              <div>
                <Label htmlFor="loan-status">Status</Label>
                <select
                  id="loan-status"
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  value={loanForm.status}
                  onChange={(event) =>
                    setLoanForm((current) => ({
                      ...current,
                      status: event.target.value as LoanForm["status"],
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="loan-principal">Principal</Label>
              <Input
                id="loan-principal"
                type="number"
                min="0.01"
                step="0.01"
                value={loanForm.principal_amount}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    principal_amount: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="loan-terms">Terms</Label>
              <Input
                id="loan-terms"
                type="number"
                min="1"
                value={loanForm.repayment_terms}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    repayment_terms: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="loan-installment">Installment</Label>
              <Input
                id="loan-installment"
                type="number"
                min="0.01"
                step="0.01"
                value={loanForm.installment_amount}
                onChange={(event) =>
                  setLoanForm((current) => ({
                    ...current,
                    installment_amount: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLoanDialog(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loanMutation.isPending}>
              {loanMutation.isPending
                ? "Saving..."
                : editingLoan
                  ? "Update employee loan"
                  : "Save employee loan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function LoanTypeCard({
  type,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  type: LoanType;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate font-semibold">{type.name}</div>
        <Badge variant={type.is_active ? "success" : "muted"}>
          {type.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {type.default_terms
          ? `${type.default_terms} default terms`
          : "No default terms"}{" "}
        · {type.description || "No description"}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={onToggle}>
          {type.is_active ? "Deactivate" : "Activate"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete ${type.name}`}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function LoanRow({
  loan,
  busy,
  onPriority,
  onEdit,
  onDelete,
  actionBusy,
}: {
  loan: EmployeeLoan;
  busy: boolean;
  onPriority: (priority: number | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  actionBusy: boolean;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <EmployeeAvatar
            photoPath={loan.employee?.photo_path}
            name={
              loan.employee
                ? `${loan.employee.first_name} ${loan.employee.last_name}`
                : "Employee"
            }
            className="h-9 w-9 text-[10px]"
          />
          <div>
            <div className="font-semibold">
              {loan.employee
                ? `${loan.employee.last_name}, ${loan.employee.first_name}`
                : "Employee"}
            </div>
            <div className="text-xs text-muted-foreground">
              {loan.employee?.employee_number}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>{loan.loan_type?.name ?? "Loan"}</TableCell>
      <TableCell className="money font-semibold">
        {formatCurrency(loan.outstanding_balance)}
        <div className="mt-1 text-xs font-normal text-muted-foreground">
          of {formatCurrency(loan.principal_amount)}
        </div>
      </TableCell>
      <TableCell className="money">
        {formatCurrency(loan.installment_amount)}
        <div className="mt-1 text-xs text-muted-foreground">
          {loan.repayment_terms} terms · {formatDate(loan.loan_date)}
        </div>
      </TableCell>
      <TableCell>
        <PrioritySelect loan={loan} busy={busy} onPriority={onPriority} />
      </TableCell>
      <TableCell>
        <Badge
          variant={
            loan.status === "active"
              ? "success"
              : loan.status === "completed"
                ? "muted"
                : "warning"
          }
        >
          {loan.status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            aria-label="Edit employee loan"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={actionBusy}
            aria-label="Delete employee loan"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function LoanCard({
  loan,
  busy,
  onPriority,
  onEdit,
  onDelete,
  actionBusy,
}: {
  loan: EmployeeLoan;
  busy: boolean;
  onPriority: (priority: number | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  actionBusy: boolean;
}) {
  const progress = loan.principal_amount
    ? Math.min(
        100,
        Math.max(
          0,
          ((Number(loan.principal_amount) - Number(loan.outstanding_balance)) /
            Number(loan.principal_amount)) *
            100,
        ),
      )
    : 0;
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar
            photoPath={loan.employee?.photo_path}
            name={
              loan.employee
                ? `${loan.employee.first_name} ${loan.employee.last_name}`
                : "Employee"
            }
            className="h-9 w-9 text-[10px]"
          />
          <div className="min-w-0">
            <div className="truncate font-semibold">
              {loan.employee
                ? `${loan.employee.first_name} ${loan.employee.last_name}`
                : "Employee"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {loan.employee?.employee_number} · {loan.loan_type?.name ?? "Loan"}
          </div>
        </div>
        <Badge
          variant={
            loan.status === "active"
              ? "success"
              : loan.status === "completed"
                ? "muted"
                : "warning"
          }
        >
          {loan.status}
        </Badge>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs text-muted-foreground">
            Outstanding balance
          </div>
          <div className="money mt-1 text-xl font-black">
            {formatCurrency(loan.outstanding_balance)}
          </div>
        </div>
        <div className="money text-right text-sm text-muted-foreground">
          {formatCurrency(loan.installment_amount)} / term
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-secondary">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="text-xs text-muted-foreground">Deduction priority</div>
        <PrioritySelect loan={loan} busy={busy} onPriority={onPriority} />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={actionBusy}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function PrioritySelect({
  loan,
  busy,
  onPriority,
}: {
  loan: EmployeeLoan;
  busy: boolean;
  onPriority: (priority: number | null) => void;
}) {
  return (
    <select
      aria-label={`Deduction priority for ${loan.employee?.last_name ?? "employee"}`}
      className="h-9 rounded-lg border bg-background px-2 text-xs"
      value={loan.priority ?? ""}
      disabled={busy}
      onChange={(event) =>
        onPriority(event.target.value ? Number(event.target.value) : null)
      }
    >
      <option value="">Not set</option>
      {Array.from({ length: 10 }, (_, index) => (
        <option key={index + 1} value={index + 1}>
          {index + 1}
        </option>
      ))}
    </select>
  );
}

function LoanMetric({
  label,
  value,
  detail,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof WalletCards;
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
