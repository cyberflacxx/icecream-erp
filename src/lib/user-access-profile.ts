const META_PREFIX = '@r:';

export function parseUserPhoneValue(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return {
      accessProfile: null,
      phone: null,
      rawPhone: null,
    };
  }

  if (!raw.startsWith(META_PREFIX)) {
    return {
      accessProfile: null,
      phone: raw,
      rawPhone: raw,
    };
  }

  const payload = raw.slice(META_PREFIX.length);
  const [accessProfilePart, ...phoneParts] = payload.split('|');

  return {
    accessProfile: accessProfilePart?.trim() || null,
    phone: phoneParts.join('|').trim() || null,
    rawPhone: raw,
  };
}

export function serializeUserPhoneValue(input: {
  accessProfile?: string | null;
  phone?: string | null;
}) {
  const phone = input.phone?.trim() || '';
  const accessProfile = input.accessProfile?.trim() || '';

  if (!accessProfile) {
    return phone || null;
  }

  return `${META_PREFIX}${accessProfile}${phone ? `|${phone}` : ''}`;
}
