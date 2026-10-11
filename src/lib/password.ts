export type PasswordField = 'password' | 'confirmation'

export type PasswordErrors = Partial<Record<PasswordField, string>>

export function validatePasswordChange(password: string, confirmation: string): PasswordErrors {
  const errors: PasswordErrors = {}
  if (password.length < 8) errors.password = 'Use at least eight characters.'
  if (!confirmation) errors.confirmation = 'Confirm your new password.'
  else if (password !== confirmation) errors.confirmation = 'Passwords do not match.'
  return errors
}
