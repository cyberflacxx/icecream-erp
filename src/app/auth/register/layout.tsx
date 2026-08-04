import type { ReactNode } from 'react';

import { RegistrationCacheReset } from './registration-cache-reset';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function RegistrationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <RegistrationCacheReset />
      {children}
    </>
  );
}
