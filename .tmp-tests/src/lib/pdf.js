"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlainTextPdf = createPlainTextPdf;
exports.createBrandedPdfDocument = createBrandedPdfDocument;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PAGE_MARGIN = 36;
const HEADER_HEIGHT = 118;
const FOOTER_HEIGHT = 46;
const CONTENT_BOTTOM = PDF_PAGE_HEIGHT - FOOTER_HEIGHT - 18;
const BRAND_NAVY = [24, 62, 124];
const BRAND_BLUE = [42, 97, 184];
const BRAND_SKY = [232, 241, 255];
const BRAND_BORDER = [191, 213, 245];
const TEXT_DARK = [23, 37, 84];
const TEXT_MUTED = [71, 85, 105];
const TEXT_LIGHT = [255, 255, 255];
const ROW_ALT = [248, 250, 252];
const EPSILON = 0.001;
function escapePdfText(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\r/g, '')
        .replace(/\u2019/g, "'")
        .replace(/\u2018/g, "'")
        .replace(/\u201c/g, '"')
        .replace(/\u201d/g, '"')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '-')
        .replace(/\u2026/g, '...');
}
function wrapLine(value, maxColumns) {
    const normalized = value.replace(/\r/g, '');
    if (!normalized)
        return [''];
    const wrapped = [];
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
function chunk(rows, size) {
    const chunks = [];
    for (let index = 0; index < rows.length; index += size) {
        chunks.push(rows.slice(index, index + size));
    }
    return chunks;
}
function rgb(color) {
    return color.map((channel) => (channel / 255).toFixed(3)).join(' ');
}
function approxTextWidth(text, fontSize) {
    return text.length * fontSize * 0.52;
}
function wrapTextToWidth(value, width, fontSize) {
    const normalized = String(value ?? '').replace(/\r/g, '').trim();
    if (!normalized)
        return ['-'];
    const maxChars = Math.max(8, Math.floor(width / Math.max(fontSize * 0.52, 1)));
    const wrapped = [];
    for (const paragraph of normalized.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (!words.length) {
            wrapped.push('');
            continue;
        }
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (candidate.length <= maxChars || current.length === 0) {
                current = candidate;
                continue;
            }
            wrapped.push(current);
            current = word;
        }
        if (current) {
            wrapped.push(current);
        }
    }
    return wrapped;
}
function fitText(value, width, fontSize) {
    const normalized = String(value ?? '').trim();
    if (!normalized)
        return '-';
    if (approxTextWidth(normalized, fontSize) <= width)
        return normalized;
    let trimmed = normalized;
    while (trimmed.length > 1 && approxTextWidth(`${trimmed}...`, fontSize) > width) {
        trimmed = trimmed.slice(0, -1).trimEnd();
    }
    return `${trimmed}...`;
}
function formatDisplayDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
function toTitleCase(value) {
    return value
        .replace(/_/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
function isIsoDateString(value) {
    return /^\d{4}-\d{2}-\d{2}(t|\b)/i.test(value);
}
function formatCellValue(value, keyHint = '') {
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    const normalizedKey = keyHint.toLowerCase();
    const currencyLike = /(amount|total|value|cost|price|sales|revenue|subtotal|tax|discount|balance|payment|payable|receivable)/;
    const quantityLike = /(qty|quantity|count|units|rate|percent|percentage|hours)/;
    if (typeof value === 'number') {
        if (currencyLike.test(normalizedKey)) {
            return new Intl.NumberFormat('en-US', {
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(value);
        }
        if (quantityLike.test(normalizedKey)) {
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
                maximumFractionDigits: 2,
            }).format(value);
        }
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(value);
    }
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'string') {
        if (isIsoDateString(value)) {
            return formatDisplayDate(value);
        }
        return value;
    }
    return JSON.stringify(value);
}
function parseJpegDimensions(buffer) {
    let offset = 2;
    while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        const marker = buffer[offset + 1];
        if (!marker || marker === 0xd8 || marker === 0xd9) {
            offset += 2;
            continue;
        }
        const length = buffer.readUInt16BE(offset + 2);
        const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isStartOfFrame) {
            return {
                height: buffer.readUInt16BE(offset + 5),
                width: buffer.readUInt16BE(offset + 7),
            };
        }
        offset += 2 + length;
    }
    throw new Error('Unable to determine JPEG dimensions for PDF logo.');
}
function getDefaultLogoPath() {
    const candidates = [
        node_path_1.default.join(process.cwd(), 'public', 'branding', 'logo.jpeg'),
        node_path_1.default.join(process.cwd(), 'public', 'branding', 'logo.jpg'),
        node_path_1.default.join(process.cwd(), 'public', 'branding', 'logo.png'),
        node_path_1.default.join(process.cwd(), 'public', 'logo.jpeg'),
        node_path_1.default.join(process.cwd(), 'public', 'logo.jpg'),
        node_path_1.default.join(process.cwd(), 'public', 'logo.png'),
    ];
    return candidates.find((candidate) => node_fs_1.default.existsSync(candidate)) ?? null;
}
function loadPdfLogo(logoPath) {
    const candidate = logoPath ?? getDefaultLogoPath();
    if (!candidate || !node_fs_1.default.existsSync(candidate)) {
        return null;
    }
    if (!candidate.toLowerCase().endsWith('.jpg') && !candidate.toLowerCase().endsWith('.jpeg')) {
        return null;
    }
    const buffer = node_fs_1.default.readFileSync(candidate);
    const dimensions = parseJpegDimensions(buffer);
    return {
        alias: 'Im1',
        buffer,
        height: dimensions.height,
        width: dimensions.width,
    };
}
function buildPdfDocument(input) {
    const objects = [''];
    const reserveObject = () => {
        objects.push('');
        return objects.length - 1;
    };
    const setObject = (id, body) => {
        objects[id] = body;
    };
    const regularFontId = reserveObject();
    const boldFontId = reserveObject();
    const pagesId = reserveObject();
    const imageId = input.image ? reserveObject() : null;
    setObject(regularFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    setObject(boldFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    if (input.image && imageId) {
        const header = Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${input.image.width} /Height ${input.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.image.buffer.length} >>\nstream\n`, 'ascii');
        const footer = Buffer.from('\nendstream', 'ascii');
        setObject(imageId, Buffer.concat([header, input.image.buffer, footer]));
    }
    const pageIds = [];
    for (const stream of input.pageStreams) {
        const contentId = reserveObject();
        const pageId = reserveObject();
        const streamBuffer = Buffer.from(stream, 'utf8');
        setObject(contentId, `<< /Length ${streamBuffer.length} >>\nstream\n${stream}\nendstream`);
        const xObjectRef = input.image && imageId ? `/XObject << /${input.image.alias} ${imageId} 0 R >>` : '';
        setObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> ${xObjectRef} >> /Contents ${contentId} 0 R >>`);
        pageIds.push(pageId);
    }
    setObject(pagesId, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`);
    const catalogId = reserveObject();
    setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const buffers = [Buffer.from('%PDF-1.4\n', 'ascii')];
    const offsets = [0];
    let length = buffers[0].length;
    for (let index = 1; index < objects.length; index += 1) {
        offsets[index] = length;
        const objectHeader = Buffer.from(`${index} 0 obj\n`, 'ascii');
        const rawBody = objects[index];
        const objectBody = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
        const objectFooter = Buffer.from('\nendobj\n', 'ascii');
        buffers.push(objectHeader, objectBody, objectFooter);
        length += objectHeader.length + objectBody.length + objectFooter.length;
    }
    const xrefOffset = length;
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) {
        xref += `${String(offsets[index] ?? 0).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    buffers.push(Buffer.from(xref, 'ascii'), Buffer.from(trailer, 'ascii'));
    return Buffer.concat(buffers);
}
function createPlainTextPdf(lines, options = {}) {
    const fontSize = options.fontSize ?? 10;
    const lineHeight = options.lineHeight ?? 14;
    const margin = options.margin ?? 48;
    const maxColumns = options.maxColumns ?? 92;
    const normalizedLines = (options.title ? [options.title, '', ...lines] : lines).flatMap((line) => wrapLine(String(line ?? ''), maxColumns));
    const usableHeight = PDF_PAGE_HEIGHT - margin * 2;
    const linesPerPage = Math.max(1, Math.floor(usableHeight / lineHeight));
    const pages = chunk(normalizedLines, linesPerPage);
    const pageStreams = pages.map((pageLines) => {
        const commands = [
            'BT',
            `/F1 ${fontSize} Tf`,
            `${lineHeight} TL`,
            `1 0 0 1 ${margin} ${PDF_PAGE_HEIGHT - margin - fontSize} Tm`,
        ];
        pageLines.forEach((line, index) => {
            if (index > 0)
                commands.push('T*');
            commands.push(`(${escapePdfText(line)}) Tj`);
        });
        commands.push('ET');
        return commands.join('\n');
    });
    return buildPdfDocument({ pageStreams });
}
function createBrandedPdfDocument(options) {
    const pages = [];
    const logo = loadPdfLogo(options.logoPath);
    const headerMeta = [
        { label: 'Generated', value: formatDisplayDate(options.generatedAt) },
        { label: 'Generated By', value: options.generatedBy || '-' },
        ...(options.metadata ?? []),
    ].filter((item) => item.value.trim());
    let currentPage = createPage();
    let cursorTop = HEADER_HEIGHT + 22;
    function createPage() {
        const page = [];
        drawHeader(page);
        pages.push(page);
        return page;
    }
    function ensureSpace(requiredHeight) {
        if (cursorTop + requiredHeight <= CONTENT_BOTTOM + EPSILON) {
            return;
        }
        currentPage = createPage();
        cursorTop = HEADER_HEIGHT + 22;
    }
    function drawHeader(page) {
        const bannerHeight = 96;
        const bannerY = PDF_PAGE_HEIGHT - bannerHeight;
        page.push(`${rgb(BRAND_NAVY)} rg`, `0 ${bannerY.toFixed(2)} ${PDF_PAGE_WIDTH} ${bannerHeight} re f`, `${rgb(BRAND_BLUE)} rg`, `0 ${(bannerY - 8).toFixed(2)} ${PDF_PAGE_WIDTH} 8 re f`);
        if (logo) {
            const maxHeight = 58;
            const scale = maxHeight / logo.height;
            const drawWidth = logo.width * scale;
            const drawHeight = maxHeight;
            const imageX = PAGE_MARGIN;
            const imageY = PDF_PAGE_HEIGHT - 78;
            page.push('q', `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${imageX.toFixed(2)} ${imageY.toFixed(2)} cm`, `/${logo.alias} Do`, 'Q');
        }
        const titleX = logo ? PAGE_MARGIN + 92 : PAGE_MARGIN;
        const titleY = PDF_PAGE_HEIGHT - 48;
        const subtitleY = PDF_PAGE_HEIGHT - 70;
        page.push('BT', `/F2 13 Tf`, `${rgb(TEXT_LIGHT)} rg`, `1 0 0 1 ${titleX.toFixed(2)} ${titleY.toFixed(2)} Tm`, `(Absolute Ice Cream ERP) Tj`, 'ET', 'BT', `/F2 22 Tf`, `${rgb(TEXT_LIGHT)} rg`, `1 0 0 1 ${titleX.toFixed(2)} ${subtitleY.toFixed(2)} Tm`, `(${escapePdfText(options.title)}) Tj`, 'ET');
        if (options.subtitle) {
            page.push('BT', `/F1 10 Tf`, `${rgb(TEXT_LIGHT)} rg`, `1 0 0 1 ${titleX.toFixed(2)} ${(subtitleY - 18).toFixed(2)} Tm`, `(${escapePdfText(fitText(options.subtitle, 230, 10))}) Tj`, 'ET');
        }
        let metaTop = 20;
        for (const item of headerMeta.slice(0, 6)) {
            const line = `${item.label}: ${item.value}`;
            const lines = wrapTextToWidth(line, 184, 9);
            for (const wrapped of lines) {
                page.push('BT', `/F1 9 Tf`, `${rgb(TEXT_LIGHT)} rg`, `1 0 0 1 ${(PDF_PAGE_WIDTH - PAGE_MARGIN - 184).toFixed(2)} ${(PDF_PAGE_HEIGHT - metaTop - 10).toFixed(2)} Tm`, `(${escapePdfText(fitText(wrapped, 184, 9))}) Tj`, 'ET');
                metaTop += 12;
            }
        }
    }
    function drawFooter(page, pageNumber, pageCount) {
        const footerTop = PDF_PAGE_HEIGHT - FOOTER_HEIGHT;
        page.push(`${rgb(BRAND_BORDER)} RG`, `${PAGE_MARGIN} ${footerTop.toFixed(2)} m ${PDF_PAGE_WIDTH - PAGE_MARGIN} ${footerTop.toFixed(2)} l S`);
        const footerText = options.footerNote ?? 'This report was generated from Absolute Ice Cream ERP.';
        const leftText = 'Absolute Ice Cream ERP';
        const centerText = 'Powered by Nexatech';
        const rightText = `Page ${pageNumber} of ${pageCount}  •  ${formatDisplayDate(options.generatedAt)}`;
        page.push('BT', `/F2 8 Tf`, `${rgb(TEXT_DARK)} rg`, `1 0 0 1 ${PAGE_MARGIN.toFixed(2)} 24 Tm`, `(${escapePdfText(leftText)}) Tj`, 'ET', 'BT', `/F1 8 Tf`, `${rgb(TEXT_MUTED)} rg`, `1 0 0 1 ${(PAGE_MARGIN + 120).toFixed(2)} 24 Tm`, `(${escapePdfText(centerText)}) Tj`, 'ET', 'BT', `/F1 8 Tf`, `${rgb(TEXT_MUTED)} rg`, `1 0 0 1 ${(PAGE_MARGIN + 250).toFixed(2)} 24 Tm`, `(${escapePdfText(fitText(footerText, 150, 8))}) Tj`, 'ET', 'BT', `/F1 8 Tf`, `${rgb(TEXT_MUTED)} rg`, `1 0 0 1 ${(PDF_PAGE_WIDTH - PAGE_MARGIN - 150).toFixed(2)} 24 Tm`, `(${escapePdfText(fitText(rightText, 150, 8))}) Tj`, 'ET');
    }
    function drawSummarySection(items) {
        if (!items.length) {
            return;
        }
        const cardsPerRow = 2;
        const gap = 12;
        const cardWidth = (PDF_PAGE_WIDTH - PAGE_MARGIN * 2 - gap) / cardsPerRow;
        const cardHeight = 58;
        ensureSpace(28);
        drawSectionHeading('Summary');
        for (let index = 0; index < items.length; index += cardsPerRow) {
            ensureSpace(cardHeight + 10);
            const rowItems = items.slice(index, index + cardsPerRow);
            rowItems.forEach((item, rowIndex) => {
                const x = PAGE_MARGIN + rowIndex * (cardWidth + gap);
                const y = PDF_PAGE_HEIGHT - cursorTop - cardHeight;
                currentPage.push(`${rgb(BRAND_SKY)} rg`, `${rgb(BRAND_BORDER)} RG`, `${x.toFixed(2)} ${y.toFixed(2)} ${cardWidth.toFixed(2)} ${cardHeight.toFixed(2)} re B`, 'BT', `/F2 10 Tf`, `${rgb(BRAND_BLUE)} rg`, `1 0 0 1 ${(x + 14).toFixed(2)} ${(y + cardHeight - 18).toFixed(2)} Tm`, `(${escapePdfText(fitText(item.label, cardWidth - 28, 10))}) Tj`, 'ET', 'BT', `/F2 16 Tf`, `${rgb(TEXT_DARK)} rg`, `1 0 0 1 ${(x + 14).toFixed(2)} ${(y + 18).toFixed(2)} Tm`, `(${escapePdfText(fitText(item.value, cardWidth - 28, 16))}) Tj`, 'ET');
            });
            cursorTop += cardHeight + 10;
        }
    }
    function drawSectionHeading(title) {
        ensureSpace(24);
        currentPage.push('BT', `/F2 12 Tf`, `${rgb(TEXT_DARK)} rg`, `1 0 0 1 ${PAGE_MARGIN.toFixed(2)} ${(PDF_PAGE_HEIGHT - cursorTop - 12).toFixed(2)} Tm`, `(${escapePdfText(title)}) Tj`, 'ET');
        cursorTop += 20;
    }
    function drawSections(sections) {
        for (const section of sections) {
            drawSectionHeading(section.title);
            for (const line of section.lines) {
                const wrapped = wrapTextToWidth(line, PDF_PAGE_WIDTH - PAGE_MARGIN * 2 - 20, 10);
                ensureSpace(wrapped.length * 14 + 10);
                for (const wrappedLine of wrapped) {
                    currentPage.push('BT', `/F1 10 Tf`, `${rgb(TEXT_MUTED)} rg`, `1 0 0 1 ${PAGE_MARGIN.toFixed(2)} ${(PDF_PAGE_HEIGHT - cursorTop - 10).toFixed(2)} Tm`, `(${escapePdfText(wrappedLine)}) Tj`, 'ET');
                    cursorTop += 14;
                }
                cursorTop += 4;
            }
        }
    }
    function resolveColumnWidths(columns) {
        const explicitWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), 0);
        const autoColumns = columns.filter((column) => !column.width);
        const available = PDF_PAGE_WIDTH - PAGE_MARGIN * 2 - explicitWidth;
        const autoWidth = autoColumns.length > 0 ? available / autoColumns.length : 0;
        return columns.map((column) => ({
            ...column,
            width: column.width ?? autoWidth,
        }));
    }
    function drawTableHeader(columns, title) {
        if (title) {
            drawSectionHeading(title);
        }
        ensureSpace(28);
        const rowHeight = 24;
        const y = PDF_PAGE_HEIGHT - cursorTop - rowHeight;
        currentPage.push(`${rgb(BRAND_NAVY)} rg`, `${rgb(BRAND_NAVY)} RG`, `${PAGE_MARGIN.toFixed(2)} ${y.toFixed(2)} ${(PDF_PAGE_WIDTH - PAGE_MARGIN * 2).toFixed(2)} ${rowHeight.toFixed(2)} re B`);
        let x = PAGE_MARGIN;
        for (const column of columns) {
            const content = fitText(column.header, column.width - 12, 9);
            const textX = column.align === 'right'
                ? x + column.width - approxTextWidth(content, 9) - 6
                : column.align === 'center'
                    ? x + (column.width / 2) - (approxTextWidth(content, 9) / 2)
                    : x + 6;
            currentPage.push('BT', `/F2 9 Tf`, `${rgb(TEXT_LIGHT)} rg`, `1 0 0 1 ${textX.toFixed(2)} ${(y + 8).toFixed(2)} Tm`, `(${escapePdfText(content)}) Tj`, 'ET');
            x += column.width;
        }
        cursorTop += rowHeight;
    }
    function drawTable(table) {
        const columns = resolveColumnWidths(table.columns);
        if (!columns.length) {
            return;
        }
        drawTableHeader(columns, table.title);
        if (!table.rows.length) {
            ensureSpace(40);
            const y = PDF_PAGE_HEIGHT - cursorTop - 32;
            currentPage.push(`${rgb(BRAND_SKY)} rg`, `${rgb(BRAND_BORDER)} RG`, `${PAGE_MARGIN.toFixed(2)} ${y.toFixed(2)} ${(PDF_PAGE_WIDTH - PAGE_MARGIN * 2).toFixed(2)} 32 re B`, 'BT', `/F1 10 Tf`, `${rgb(TEXT_MUTED)} rg`, `1 0 0 1 ${(PAGE_MARGIN + 12).toFixed(2)} ${(y + 11).toFixed(2)} Tm`, '(No rows returned for the selected filters.) Tj', 'ET');
            cursorTop += 40;
            return;
        }
        table.rows.forEach((row, rowIndex) => {
            const cellValues = columns.map((column) => formatCellValue(row[column.key], column.key));
            const rowLineCounts = cellValues.map((value, index) => wrapTextToWidth(value, columns[index]?.width ? columns[index].width - 12 : 80, 9).length);
            const rowHeight = Math.max(24, Math.max(...rowLineCounts) * 11 + 10);
            ensureSpace(rowHeight + 1);
            if (cursorTop === HEADER_HEIGHT + 22) {
                drawTableHeader(columns);
            }
            const y = PDF_PAGE_HEIGHT - cursorTop - rowHeight;
            currentPage.push(`${rgb(rowIndex % 2 === 0 ? [255, 255, 255] : ROW_ALT)} rg`, `${rgb(BRAND_BORDER)} RG`, `${PAGE_MARGIN.toFixed(2)} ${y.toFixed(2)} ${(PDF_PAGE_WIDTH - PAGE_MARGIN * 2).toFixed(2)} ${rowHeight.toFixed(2)} re B`);
            let x = PAGE_MARGIN;
            columns.forEach((column, columnIndex) => {
                const wrapped = wrapTextToWidth(cellValues[columnIndex] ?? '-', column.width - 12, 9);
                wrapped.forEach((line, lineIndex) => {
                    const text = fitText(line, column.width - 12, 9);
                    const textWidth = approxTextWidth(text, 9);
                    const textX = column.align === 'right'
                        ? x + column.width - textWidth - 6
                        : column.align === 'center'
                            ? x + (column.width / 2) - (textWidth / 2)
                            : x + 6;
                    currentPage.push('BT', `/F1 9 Tf`, `${rgb(TEXT_DARK)} rg`, `1 0 0 1 ${textX.toFixed(2)} ${(y + rowHeight - 14 - lineIndex * 11).toFixed(2)} Tm`, `(${escapePdfText(text)}) Tj`, 'ET');
                });
                x += column.width;
            });
            cursorTop += rowHeight;
        });
    }
    drawSummarySection(options.summary ?? []);
    drawTable(options.table ?? { columns: [], rows: [] });
    drawSections(options.sections ?? []);
    const pageCount = pages.length;
    pages.forEach((page, index) => drawFooter(page, index + 1, pageCount));
    return buildPdfDocument({
        image: logo,
        pageStreams: pages.map((page) => page.join('\n')),
    });
}
