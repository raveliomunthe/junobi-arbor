import type { AuthError } from '@supabase/supabase-js'

const messagesByCode: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Your email has not been verified yet. Check your inbox for the verification link.',
  user_already_exists: 'An account with this email already exists. Try logging in instead.',
  email_exists: 'An account with this email already exists. Try logging in instead.',
  weak_password: 'This password is too weak. Use at least 6 characters with a mix of letters and numbers.',
  signup_disabled: 'Registration is currently disabled.',
  validation_failed: 'Please enter a valid email address.',
  email_address_invalid: 'Please enter a valid email address.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails requested. Please wait a moment and try again.',
}

export function getAuthErrorMessage(error: AuthError | Error): string {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
  if (code && messagesByCode[code]) return messagesByCode[code]

  if (error.name === 'AuthRetryableFetchError' || /failed to fetch|network/i.test(error.message)) {
    return 'Unable to reach the server. Check your connection and try again.'
  }

  return 'Something went wrong. Please try again.'
}
