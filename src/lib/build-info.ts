const FALLBACK_SOURCE_COMMIT = '6b8561e';

export function getBuildInfo() {
  const commit =
    process.env.NEXT_PUBLIC_APP_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    FALLBACK_SOURCE_COMMIT;

  return {
    commit,
    commitShort: commit.slice(0, 7),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    version: process.env.npm_package_version ?? '0.1.0',
  };
}
