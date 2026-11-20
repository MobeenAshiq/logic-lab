import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { degrees, PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import { t } from '../common/i18n/en';

export interface InvoicePdfData {
  invoiceNo: string;
  issuedAt: Date;
  customerName: string;
  customerEmail: string;
  planName: string;
  periodStart: Date;
  periodEnd: Date;
  pricePkr: number;
  discountPkr: number;
  couponCode: string | null;
  totalPkr: number;
  method: string;
  transactionId: string;
}

const NAVY = rgb(0.043, 0.071, 0.125); // #0B1220
const TEAL = rgb(0.059, 0.463, 0.431); // #0F766E
const TEAL_SOFT = rgb(0.894, 0.969, 0.957); // #E4F7F4
const MUTED = rgb(0.42, 0.45, 0.5);
const TEXT = rgb(0.07, 0.09, 0.15);
const LINE = rgb(0.88, 0.9, 0.92);
const WHITE = rgb(1, 1, 1);

// dist/billing/ and src/billing/ are both two levels below backend/.
const LOGO_PATH = join(__dirname, '..', '..', 'assets', 'logo-mark.png');

/** Standard PDF fonts only cover Latin text; replace anything else (e.g. Urdu names). */
function safe(text: string) {
  return text.replace(/[^\x20-\x7E]/g, '?');
}

function pkr(amount: number) {
  return `Rs ${amount.toLocaleString('en-PK')}`;
}

function date(d: Date) {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`LogicLab invoice ${data.invoiceNo}`);
  doc.setAuthor('LogicLab');
  const page = doc.addPage([595, 842]); // A4
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const L = 56;
  const R = 539;

  const draw = (
    text: string,
    x: number,
    y: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: typeof TEXT;
      right?: boolean;
    } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 11;
    const s = safe(text);
    const width = font.widthOfTextAtSize(s, size);
    page.drawText(s, {
      x: opts.right ? x - width : x,
      y,
      size,
      font,
      color: opts.color ?? TEXT,
    });
  };

  const H = 842;
  const W = 595;

  // Header band
  page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 156, width: W, height: 6, color: TEAL });
  let textX = L;
  try {
    const logo = await doc.embedPng(await readFile(LOGO_PATH));
    page.drawRectangle({
      x: L,
      y: H - 112,
      width: 52,
      height: 64,
      color: WHITE,
    });
    page.drawImage(logo, { x: L + 8, y: H - 106, width: 36, height: 52 });
    textX = L + 66;
  } catch {
    // No logo file: the name alone still identifies the invoice.
  }
  draw('LogicLab', textX, H - 78, { font: bold, size: 24, color: WHITE });
  draw(t.invoice.tagline, textX, H - 98, {
    size: 10,
    color: rgb(0.6, 0.85, 0.82),
  });
  draw(t.invoice.title, R, H - 74, {
    font: bold,
    size: 26,
    color: WHITE,
    right: true,
  });
  draw(`# ${data.invoiceNo}`, R, H - 96, {
    size: 11,
    color: rgb(0.8, 0.84, 0.9),
    right: true,
  });

  // Meta strip: issue date, access period, status
  const metaY = H - 205;
  const meta = (label: string, value: string, x: number) => {
    draw(label.toUpperCase(), x, metaY + 16, {
      size: 8,
      color: MUTED,
      font: bold,
    });
    draw(value, x, metaY, { font: bold, size: 11 });
  };
  meta(t.invoice.issued, date(data.issuedAt), L);
  meta(
    t.invoice.period,
    `${date(data.periodStart)} - ${date(data.periodEnd)}`,
    L + 150,
  );
  draw(t.invoice.status.toUpperCase(), R, metaY + 16, {
    size: 8,
    color: MUTED,
    font: bold,
    right: true,
  });
  page.drawRectangle({
    x: R - 50,
    y: metaY - 5,
    width: 50,
    height: 18,
    color: TEAL,
  });
  draw(
    t.invoice.paid,
    R - 25 - bold.widthOfTextAtSize(t.invoice.paid, 9) / 2,
    metaY,
    {
      font: bold,
      size: 9,
      color: WHITE,
    },
  );

  // Billed to / From
  const partyY = H - 270;
  draw(t.invoice.billedTo.toUpperCase(), L, partyY, {
    size: 8,
    color: TEAL,
    font: bold,
  });
  draw(data.customerName || data.customerEmail, L, partyY - 18, {
    font: bold,
    size: 12,
  });
  draw(data.customerEmail, L, partyY - 34, { color: MUTED, size: 10 });
  draw(t.invoice.from.toUpperCase(), R, partyY, {
    size: 8,
    color: TEAL,
    font: bold,
    right: true,
  });
  draw('LogicLab', R, partyY - 18, { font: bold, size: 12, right: true });
  draw(t.invoice.fromLine, R, partyY - 34, {
    color: MUTED,
    size: 10,
    right: true,
  });

  // Line items table
  let y = H - 350;
  page.drawRectangle({ x: L, y: y - 8, width: R - L, height: 26, color: NAVY });
  draw(t.invoice.description.toUpperCase(), L + 12, y, {
    size: 8,
    font: bold,
    color: WHITE,
  });
  draw(t.invoice.amount.toUpperCase(), R - 12, y, {
    size: 8,
    font: bold,
    color: WHITE,
    right: true,
  });
  y -= 36;
  draw(data.planName, L + 12, y, { font: bold });
  draw(pkr(data.pricePkr), R - 12, y, { right: true });
  draw(
    `${t.invoice.access} ${date(data.periodStart)} - ${date(data.periodEnd)}`,
    L + 12,
    y - 15,
    {
      size: 9,
      color: MUTED,
    },
  );
  y -= 34;
  page.drawLine({
    start: { x: L, y },
    end: { x: R, y },
    thickness: 0.75,
    color: LINE,
  });

  // Totals (right column)
  const TX = 340;
  y -= 26;
  const total = (label: string, value: string) => {
    draw(label, TX, y, { color: MUTED, size: 10 });
    draw(value, R - 12, y, { right: true, size: 10 });
    y -= 20;
  };
  total(t.invoice.subtotal, pkr(data.pricePkr));
  if (data.discountPkr > 0) {
    total(
      `${t.invoice.discount}${data.couponCode ? ` (${data.couponCode})` : ''}`,
      `- ${pkr(data.discountPkr)}`,
    );
  }
  total(t.invoice.due, pkr(data.pricePkr - Math.max(data.discountPkr, 0)));
  y -= 14;
  page.drawRectangle({
    x: TX - 12,
    y: y - 12,
    width: R - TX + 12,
    height: 34,
    color: TEAL_SOFT,
  });
  draw(t.invoice.total, TX, y, { font: bold, size: 12, color: TEAL });
  draw(pkr(data.totalPkr), R - 12, y, {
    font: bold,
    size: 14,
    color: TEAL,
    right: true,
  });

  // PAID stamp, rotated, left of the totals
  const stampY = y + 18;
  page.drawRectangle({
    x: L + 20,
    y: stampY,
    width: 120,
    height: 44,
    borderColor: TEAL,
    borderWidth: 2.5,
    rotate: degrees(12),
    opacity: 0,
    borderOpacity: 0.55,
  });
  page.drawText(t.invoice.paid, {
    x: L + 40,
    y: stampY + 17,
    size: 26,
    font: bold,
    color: TEAL,
    opacity: 0.55,
    rotate: degrees(12),
  });

  // Payment details card
  y -= 70;
  page.drawRectangle({
    x: L,
    y: y - 58,
    width: R - L,
    height: 78,
    borderColor: LINE,
    borderWidth: 1,
  });
  draw(t.invoice.paymentDetails.toUpperCase(), L + 16, y, {
    size: 8,
    font: bold,
    color: TEAL,
  });
  const detail = (label: string, value: string, x: number) => {
    draw(label, x, y - 24, { size: 9, color: MUTED });
    draw(value, x, y - 40, { font: bold, size: 11 });
  };
  detail(t.invoice.method, data.method, L + 16);
  detail(t.invoice.transactionId, data.transactionId, L + 180);
  detail(t.invoice.paidOn, date(data.issuedAt), L + 360);

  // Footer
  page.drawLine({
    start: { x: L, y: 96 },
    end: { x: R, y: 96 },
    thickness: 0.75,
    color: LINE,
  });
  draw(t.invoice.footer, L, 76, { font: bold, size: 11, color: TEAL });
  draw(t.invoice.note, L, 60, { size: 8.5, color: MUTED });
  draw(data.invoiceNo, R, 76, { size: 9, color: MUTED, right: true });
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: TEAL });

  return Buffer.from(await doc.save());
}
