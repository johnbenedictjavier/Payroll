import {
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import type { Role } from "@/types/database";

export type NavigationIcon = typeof LayoutDashboard;

export type NavigationItem = {
  label: string;
  description: string;
  to: string;
  icon: NavigationIcon;
  end?: boolean;
};

export type NavigationGroup = {
  id: string;
  label: string;
  items: NavigationItem[];
};

const adminGroups: NavigationGroup[] = [
  {
    id: "workspace",
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        description: "Overview and payroll activity",
        to: "/admin",
        icon: LayoutDashboard,
        end: true,
      },
      {
        label: "Reports",
        description: "Payroll and workforce reports",
        to: "/admin/reports",
        icon: FileBarChart,
      },
    ],
  },
  {
    id: "employee",
    label: "People",
    items: [
      {
        label: "Employees",
        description: "Employee records and profiles",
        to: "/admin/employees",
        icon: Users,
      },
      {
        label: "Organization",
        description: "Departments and positions",
        to: "/admin/organization",
        icon: Building2,
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll operations",
    items: [
      {
        label: "Payroll",
        description: "Process pay periods",
        to: "/admin/payroll",
        icon: ReceiptText,
      },
      {
        label: "Attendance",
        description: "Payroll-period attendance inputs",
        to: "/admin/attendance",
        icon: ClipboardCheck,
      },
      {
        label: "Loans",
        description: "Loan balances and priority",
        to: "/admin/loans",
        icon: WalletCards,
      },
      {
        label: "Salaries",
        description: "Effective-dated salary history",
        to: "/admin/salaries",
        icon: CircleDollarSign,
      },
      {
        label: "Transactions",
        description: "Approved income and deductions",
        to: "/admin/transactions",
        icon: ReceiptText,
      },
    ],
  },
  {
    id: "settings",
    label: "Administration",
    items: [
      {
        label: "System settings",
        description: "Password and payroll defaults",
        to: "/admin/settings",
        icon: Settings,
      },
    ],
  },
];

const employeeGroups: NavigationGroup[] = [
  {
    id: "workspace",
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        description: "Your payroll overview",
        to: "/employee",
        icon: LayoutDashboard,
        end: true,
      },
    ],
  },
  {
    id: "employee",
    label: "My account",
    items: [
      {
        label: "My profile",
        description: "Personal information and requests",
        to: "/employee/profile",
        icon: UserRound,
      },
    ],
  },
  {
    id: "payroll",
    label: "Pay information",
    items: [
      {
        label: "My attendance",
        description: "Attendance records",
        to: "/employee/attendance",
        icon: ClipboardCheck,
      },
      {
        label: "My payroll",
        description: "Payroll records and totals",
        to: "/employee/payroll",
        icon: ReceiptText,
      },
      {
        label: "My payslips",
        description: "Published payslips",
        to: "/employee/payslips",
        icon: FileBarChart,
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        label: "Account settings",
        description: "Password and account security",
        to: "/employee/settings",
        icon: Settings,
      },
    ],
  },
];

export function navGroupsForRole(role: Role | null) {
  return role === "admin" ? adminGroups : employeeGroups;
}

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const normalizedTarget = item.to.replace(/\/+$/, "") || "/";
  return item.end
    ? normalizedPathname === normalizedTarget
    : normalizedPathname === normalizedTarget ||
        normalizedPathname.startsWith(`${normalizedTarget}/`);
}
