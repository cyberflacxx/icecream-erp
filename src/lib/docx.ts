import { Buffer } from 'node:buffer';

export interface DocxMetadataItem {
  label: string;
  value: string;
}

export interface DocxTableColumn {
  header: string;
  key: string;
}

export interface DocxSection {
  lines: string[];
  title: string;
}

export interface BusinessDocxOptions {
  companyName?: string;
  footerText?: string;
  metadata?: DocxMetadataItem[];
  sections?: DocxSection[];
  subtitle?: string;
  table?: {
    columns: DocxTableColumn[];
    rows: Array<Record<string, unknown>>;
    title?: string;
  };
  title: string;
  totals?: DocxMetadataItem[];
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paragraph(text: unknown, options?: { bold?: boolean; size?: number; center?: boolean }) {
  const runProps = [
    options?.bold ? '<w:b/>' : '',
    options?.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
  ].join('');
  const paragraphProps = options?.center ? '<w:jc w:val="center"/>' : '';
  return `<w:p><w:pPr>${paragraphProps}</w:pPr><w:r><w:rPr>${runProps}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function tableCell(text: unknown, bold = false) {
  return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraph(text, { bold, size: 18 })}</w:tc>`;
}

function tableRow(values: unknown[], bold = false) {
  return `<w:tr>${values.map((value) => tableCell(value, bold)).join('')}</w:tr>`;
}

function buildTable(columns: DocxTableColumn[], rows: Array<Record<string, unknown>>) {
  const header = tableRow(columns.map((column) => column.header), true);
  const body = rows.map((row) => tableRow(columns.map((column) => row[column.key] ?? '-'))).join('');
  return `
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="0" w:type="auto"/>
      </w:tblPr>
      <w:tblGrid/>
      ${header}
      ${body}
    </w:tbl>
  `;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const checksum = crc32(file.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, name);
    offset += local.length + name.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localData, centralDirectory, end]);
}

export function createBusinessDocx(options: BusinessDocxOptions): Uint8Array {
  const body: string[] = [];

  body.push(paragraph(options.companyName ?? 'Absolute Quality Icecream', { bold: true, center: true, size: 30 }));
  body.push(paragraph(options.title, { bold: true, center: true, size: 34 }));
  if (options.subtitle) body.push(paragraph(options.subtitle, { center: true, size: 20 }));
  body.push(paragraph(''));

  for (const item of options.metadata ?? []) {
    body.push(paragraph(`${item.label}: ${item.value}`, { size: 20 }));
  }

  for (const section of options.sections ?? []) {
    body.push(paragraph(''));
    body.push(paragraph(section.title, { bold: true, size: 24 }));
    for (const line of section.lines) {
      body.push(paragraph(line || '-', { size: 20 }));
    }
  }

  if (options.table) {
    body.push(paragraph(''));
    if (options.table.title) body.push(paragraph(options.table.title, { bold: true, size: 24 }));
    body.push(buildTable(options.table.columns, options.table.rows));
  }

  if ((options.totals ?? []).length > 0) {
    body.push(paragraph(''));
    body.push(paragraph('Totals', { bold: true, size: 24 }));
    for (const item of options.totals ?? []) {
      body.push(paragraph(`${item.label}: ${item.value}`, { bold: item.label.toUpperCase() === 'TOTAL', size: 20 }));
    }
  }

  if (options.footerText) {
    body.push(paragraph(''));
    body.push(paragraph(options.footerText, { center: true, size: 18 }));
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="table" w:default="1" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:basedOn w:val="TableNormal"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:color="B7D7BD"/>
        <w:left w:val="single" w:sz="4" w:color="B7D7BD"/>
        <w:bottom w:val="single" w:sz="4" w:color="B7D7BD"/>
        <w:right w:val="single" w:sz="4" w:color="B7D7BD"/>
        <w:insideH w:val="single" w:sz="4" w:color="D9EADB"/>
        <w:insideV w:val="single" w:sz="4" w:color="D9EADB"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return zipStore([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml, 'utf8') },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(documentRels, 'utf8') },
    { name: 'word/styles.xml', data: Buffer.from(stylesXml, 'utf8') },
  ]);
}
