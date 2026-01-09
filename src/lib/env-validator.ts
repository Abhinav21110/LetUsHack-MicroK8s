/**
 * Environment Variable Validator
 * Validates required environment variables on application startup
 */

const REQUIRED_ENV_VARS = [
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
  'JWT_SECRET_LOCAL',
  'HOST_URL',
] as const;

const OPTIONAL_ENV_VARS = [
  'LAB_ORIGIN_URL',
  'TRAEFIK_NETWORK',
] as const;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    
    if (!value || value.trim() === '') {
      if (isProduction) {
        errors.push(`Missing required environment variable: ${varName}`);
      } else {
        warnings.push(`Missing environment variable: ${varName} (using defaults)`);
      }
    }
  }

  // Validate JWT secret specifically
  const jwtSecret = process.env.JWT_SECRET_LOCAL;
  if (jwtSecret) {
    if (jwtSecret === 'dev-secret-change-me') {
      if (isProduction) {
        errors.push('JWT_SECRET_LOCAL cannot be the default value in production');
      } else {
        warnings.push('Using default JWT secret - NOT FOR PRODUCTION');
      }
    }
    
    if (jwtSecret.length < 32) {
      if (isProduction) {
        errors.push('JWT_SECRET_LOCAL must be at least 32 characters long');
      } else {
        warnings.push('JWT_SECRET_LOCAL should be at least 32 characters for security');
      }
    }
  }

  // Validate database port
  const pgPort = process.env.PGPORT;
  if (pgPort && (isNaN(parseInt(pgPort)) || parseInt(pgPort) < 1 || parseInt(pgPort) > 65535)) {
    errors.push(`Invalid PGPORT value: ${pgPort}. Must be a number between 1-65535`);
  }

  // Check optional variables
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(`Optional environment variable not set: ${varName}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment and throws if critical errors found in production
 * Logs warnings in development
 */
export function ensureValidEnvironment(): void {
  const result = validateEnvironment();

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment Warnings:');
    result.warnings.forEach(warning => console.warn(`   - ${warning}`));
  }

  // Handle errors
  if (!result.isValid) {
    console.error('❌ Environment Validation Failed:');
    result.errors.forEach(error => console.error(`   - ${error}`));
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Environment validation failed. Cannot start application with missing/invalid environment variables.'
      );
    } else {
      console.warn('⚠️  Continuing in development mode with warnings...');
    }
  } else {
    console.log('✅ Environment validation passed');
  }
}
