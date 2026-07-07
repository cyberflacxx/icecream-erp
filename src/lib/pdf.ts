interface PlainTextPdfOptions {
  fontSize?: number;
  lineHeight?: number;
  margin?: number;
  maxColumns?: number;
  title?: string;
}

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(value: string, maxColumns: number): string[] {
  const normalized = value.replace(/\r/g, '');
  if (!normalized) return [''];

  const wrapped: string[] = [];
  const segments = normalized.split('\n');

  for (const segment of segments) {
    let remaining = segment;
    while (remaining.length > maxColumns) {
      const slice = remaining.slice(0, maxColumns + 1);
      const splitIndex = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\t'));
      const cutIndex = splitIndex > Math.floor(maxColumns * 0.5) ? splitIndex : maxColumns;
      wrapped.push(remaining.slice(0, cutIndex).trimEnd());
      remaining = remaining.slice(cutIndex).trimStart();
    }
    wrapped.push(remaining);
  }

  return wrapped;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

export function createPlainTextPdf(lines: string[], options: PlainTextPdfOptions = {}): Uint8Array {
  const fontSize = options.fontSize ?? 10;
  const lineHeight = options.lineHeight ?? 14;
  const margin = options.margin ?? 48;
  const maxColumns = options.maxColumns ?? 92;

  const normalizedLines = (options.title ? [options.title, '', ...lines] : lines).flatMap((line) =>
    wrapLine(String(line ?? ''), maxColumns),
  );

  const usableHeight = PDF_PAGE_HEIGHT - margin * 2;
  const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));
  const pages = chunk(normalizedLines, linesPerPage);

  const objects: string[] = [''];
  const reserveObject = () => {
    objects.push('');
    return objects.length - 1;
  };
  const setObject = (id: number, body: string) => {
    objects[id] = body;
  };

  const fontId = reserveObject();
  const pagesId = reserveObject();
  setObject(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const contentId = reserveObject();
    const pageId = reserveObject();

    const commands = [
      'BT',
      `/F1 ${fontSize} Tf`,
      `${lineHeight} TL`,
      `1 0 0 1 ${margin} ${PDF_PAGE_HEIGHT - margin - fontSize} Tm`,
    ];

    pageLines.forEach((line, index) => {
      if (index > 0) commands.push('T*');
      commands.push(`(${escapePdfText(line)}) Tj`);
    });

    commands.push('ET');

    const stream = commands.join('\n');
    const streamLength = Buffer.byteLength(stream, 'utf8');

    setObject(contentId, `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
    setObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );

    pageIds.push(pageId);
  }

  setObject(pagesId, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);

  const catalogId = reserveObject();
  setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
