export const userErrorSkipPatterns: RegExp[] = [
  /^USER_NOT_FOUND_WITH_TOKEN/i, // Invalid reset password token
  /^User with token [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12} not found$/i, // User with specific token not found
  /^User is not authorized because password is not correct/i, // Wrong credentials
  /^DUPLICATE_USERNAME/i, // Duplicate username on sign up
  /^CHANGE_EMAIL_TOKEN_NOT_FOUND/i, // Invalid email change token
  /^DUPLICATE_EMAIL/i, // Duplicate email on sign up
  /^ALREADY_REGISTERED/i, // Already registered user
  /^PLAN_LIMIT_REACHED/i, // Subscription plan exceeded
  /^User status "DELETED" not allowed. "ENABLED" required/i, // Deleted user access
  /^DUPLICATE_CIF/i, // Duplicate company identifier
  /^User not allowed because of user email pair/i, // Email pair blocked
  /^User status "WAITING_FOR_VERIFICATION" not allowed. "ENABLED" required/i, // Unverified account
  /^Unauthorized/i, // Generic unauthorized access
  /^INCORRECT_USER_PASSWORD/i, // Incorrect password
  /^PASSWORD_TOO_WEAK/i, // Weak password
  /^CHANGE_EMAIL_ALREADY_IN_USE/i, // Email already in use
  /^INVALID_CHANGE_EMAIL_TOKEN/i, // Bad change email token
  /^INVALID_VERIFY_EMAIL_TOKEN/i, // Bad email verify token
  /^INVALID_RESET_PASSWORD_TOKEN_GET_USER_INFO/i, // Invalid reset token
  /^USER_ALREADY_REGISTERED/i, // User already signed up
  /^USER_FIND_ONE_NOT_FOUND/i, // User not found
  /^USER_CHANGE_PASSWORD_NOT_FOUND/i, // Change password user not found

  // === NEW STANDARDIZED ERROR CONSTANTS ===
  // These constants are defined in domain-specific files:
  // - src/app/users/const/user-error-constants.ts
  // - src/app/contents/const/content-error-constants.ts
  // - src/app/media/const/media-error-constants.ts
  // - src/app/tag/const/tag-error-constants.ts

  // User Domain Errors
  /^INVALID_CREDENTIALS/i, // USER_LOGIN_INVALID_CREDENTIALS
  /^WRONG_CREDENTIALS/i, // USER_LOGIN_WRONG_CREDENTIALS
  /^INVALID_TOKEN/i, // USER_TOKEN_INVALID
  /^USER_DETAILS_NOT_FOUND/i, // USER_DETAILS_NOT_FOUND
  /^USER_NOT_FOUND/i, // USER_NOT_FOUND
  /^USER_ROLE_NOT_ALLOWED/i, // USER_ROLE_NOT_ALLOWED
  /^USER_HAS_NO_ROLE/i, // USER_STATUS_NO_ROLE
  /^USER_EMAIL_CHANGE_SOCIAL_LOGIN_RESTRICTION/i, // USER_EMAIL_CHANGE_SOCIAL_LOGIN_RESTRICTION
  /^USER_EMAIL_ALREADY_IN_USE/i, // USER_EMAIL_ALREADY_IN_USE
  /^Admin users cannot authenticate from the public frontend\. Please use the dashboard entry point\./i, // ADMIN_USERS_CANNOT_AUTHENTICATE_FROM_FRONTEND
  /^Standard users cannot authenticate from the admin dashboard\. Please use the public entry point\./i, // USERS_CANNOT_AUTHENTICATE_FROM_DASHBOARD

  // Content Domain Errors
  /^CONTENT_ID_INVALID_UUID/i, // CONTENT_ID_INVALID_UUID
  /^CONTENT_NOT_FOUND/i, // CONTENT_NOT_FOUND
  /^CONTENT_LOCALES_UNSUPPORTED/i, // CONTENT_LOCALES_UNSUPPORTED
  /^CONTENT_LOCALES_MISSING/i, // CONTENT_LOCALES_MISSING
  /^CONTENT_LOCALES_MISSING_EN/i, // CONTENT_LOCALES_MISSING_EN
  /^CONTENT_LOCALES_MISSING_ES/i, // CONTENT_LOCALES_MISSING_ES
  /^CONTENT_TRANSLATIONS_MISSING/i, // CONTENT_TRANSLATIONS_MISSING
  /^KEY_ALREADY_EXISTS/i, // KEY_ALREADY_EXISTS

  // Media Domain Errors
  /^MEDIA_BASE64_INVALID/i, // MEDIA_BASE64_INVALID
  /^MEDIA_MIMETYPE_UNSUPPORTED/i, // MEDIA_MIMETYPE_UNSUPPORTED
  /^MEDIA_NOT_FOUND/i, // MEDIA_NOT_FOUND
  /^MEDIA_FILE_NOT_FOUND/i, // MEDIA_FILE_NOT_FOUND
  /^MEDIA_FILENAME_NO_EXTENSION/i, // MEDIA_FILENAME_NO_EXTENSION

  // Tag Domain Errors
  /^TAG_NOT_FOUND/i, // TAG_NOT_FOUND

  // Blog Post Errors
  /^BLOG_POST_NOT_FOUND/i, // Blog post not found
  /^BLOG_POST_SLUG_GENERATION_FAILED/i, // Blog post slug generation failed

  // Country Errors
  /^COUNTRY_NOT_FOUND/i, // Country not found

  // Database Errors
  /^DATABASE_ID_INVALID_UUID/i, // Database ID invalid UUID
  /^DATABASE_ENTITY_NOT_FOUND/i, // Database entity not found
  /^DATABASE_MODEL_UNSUPPORTED/i, // Database model unsupported

  // System Errors
  /^SYSTEM_STORAGE_PROVIDER_UNSUPPORTED/i, // System storage provider unsupported
  /^SYSTEM_TEMPLATE_NOT_FOUND/i, // System template not found
  /^SYSTEM_EMAIL_NOT_SENT/i, // System email not sent
  /^Cannot execute "readAll" on "PlatformConfig"/i, // Platform configuration readAll retrieval not available

  // Validation Errors
  /^VALIDATION_ERRORS/i, // Validation errors
  /^VALIDATION_FIELD_REQUIRED/i, // Validation field required
  /^VALIDATION_FIELD_INVALID/i, // Validation field invalid

  // Authorization Errors
  /^AUTH_USER_STATUS_WRONG/i, // Auth user status wrong
  /^AUTH_NOT_IMPLEMENTED/i, // Auth not implemented

  // Network/Client Errors (should not be logged as server errors)
  /^Failed to fetch/i, // Network connectivity issues from frontend

  // React/Frontend Errors (minified production errors that are not useful for debugging)
  /Minified React error #\d+/i, // Minified React errors from production builds
];
