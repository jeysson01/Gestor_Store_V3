import type { PoolConfig } from 'pg';

function isSupabaseHost(connectionString: string) {
  return (
    connectionString.includes('supabase.com') ||
    connectionString.includes('supabase.co')
  );
}

export function createPoolConfig(connectionString: string): PoolConfig {
  if (!isSupabaseHost(connectionString)) {
    return { connectionString };
  }

  const normalized = connectionString
    .replace(/([?&])sslmode=[^&]*/g, '$1')
    .replace(/[?&]$/, '');

  return {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
  };
}
