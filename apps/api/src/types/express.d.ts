declare namespace Express {
  interface Request {
    rawBody?: string;
    authContext?: {
      branch: {
        id: string;
        code: string;
        name: string;
      } | null;
      clerkUserId: string;
      isBranchScoped: boolean;
      organizationId: string;
      permissions: string[];
      profile: {
        id: string;
        clerkUserId: string;
        organizationId: string;
        firstName: string;
        lastName: string;
        fullName: string;
        email: string;
        phone: string | null;
        avatarUrl: string | null;
        branchId: string | null;
        workId?: string;
        status: string;
      };
      rawPermissions: string[];
      roles: Array<{
        id: string;
        name: string;
        description: string | null;
        isSystemRole: boolean;
      }>;
    };
  }
}
