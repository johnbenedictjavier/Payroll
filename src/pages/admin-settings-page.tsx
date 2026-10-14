import { useState } from "react";
import { FileCheck2, LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeading } from "@/components/layout/page-heading";
import { Alert } from "@/components/ui/alert";
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
import { supabase } from "@/lib/supabase";
import {
  validatePasswordChange,
  type PasswordErrors,
  type PasswordField,
} from "@/lib/password";

export function AdminSettingsPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordBusy, setPasswordBusy] = useState(false);

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
        description="Payroll uses fixed prototype calculation rules. Manage administrator account security here."
      />

      <Alert variant="warning" className="mb-6 max-w-xl">
        Prototype payroll is for development testing only. SSS, PhilHealth,
        Pag-IBIG, and withholding tax are not calculated, so this system is not
        compliant for Philippine salary disbursement until a future statutory
        module is implemented and validated.
      </Alert>

      <Card className="mb-6 max-w-xl">
        <CardHeader>
          <CardTitle>Payroll calculation</CardTitle>
          <CardDescription>
            Fixed payroll rules do not require calculation schedules. Informational statutory references can be recorded separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Work days</div>
            <div className="font-semibold">26 per period</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Hours per day</div>
            <div className="font-semibold">8 hours</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Overtime</div>
            <div className="font-semibold">1.25x hourly rate</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Attendance</div>
            <div className="font-semibold">Monthly deductions</div>
          </div>
          <div className="rounded-lg border p-3 sm:col-span-2">
            <div className="text-xs text-muted-foreground">Statutory and tax</div>
            <div className="font-semibold">Not deducted</div>
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>Complete the informational source register when a statutory reference is needed for review.</span>
            </div>
            <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={() => navigate("/admin/settings/statutory-references")}>
              Open statutory references
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
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
