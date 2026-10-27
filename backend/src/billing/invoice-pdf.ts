import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
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

const ACCENT = rgb(0.31, 0.27, 0.9);
const MUTED = rgb(0.42, 0.45, 0.5);
const TEXT = rgb(0.07, 0.09, 0.15);

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

  // Header
  draw('LogicLab', L, 770, { font: bold, size: 24, color: ACCENT });
  draw(t.invoice.title, R, 774, { font: bold, size: 18, right: true });
  draw(data.invoiceNo, R, 754, { right: true, color: MUTED });
  draw(date(data.issuedAt), R, 740, { right: true, color: MUTED });

  // Paid stamp
  page.drawRectangle({
    x: L,
    y: 728,
    width: 52,
    height: 22,
    color: rgb(0.86, 0.97, 0.9),
  });
  draw(t.invoice.paid, L + 9, 735, {
    font: bold,
    size: 11,
    color: rgb(0.08, 0.5, 0.24),
  });

  // Customer
  draw(t.invoice.billedTo, L, 690, { size: 9, color: MUTED });
  draw(data.customerName || data.customerEmail, L, 674, { font: bold });
  draw(data.customerEmail, L, 660, { color: MUTED });

  // Lines
  let y = 610;
  const row = (label: string, value: string, strong = false) => {
    draw(label, L, y, {
      color: strong ? TEXT : MUTED,
      font: strong ? bold : regular,
    });
    draw(value, R, y, { right: true, font: strong ? bold : regular });
    y -= 24;
  };
  const rule = () => {
    page.drawLine({
      start: { x: L, y: y + 12 },
      end: { x: R, y: y + 12 },
      thickness: 0.5,
      color: rgb(0.85, 0.86, 0.88),
    });
    y -= 6;
  };

  row(t.invoice.plan, data.planName);
  row(t.invoice.period, `${date(data.periodStart)} - ${date(data.periodEnd)}`);
  rule();
  row(t.invoice.price, pkr(data.pricePkr));
  if (data.discountPkr > 0) {
    row(
      `${t.invoice.discount}${data.couponCode ? ` (${data.couponCode})` : ''}`,
      `- ${pkr(data.discountPkr)}`,
    );
  }
  rule();
  row(t.invoice.total, pkr(data.totalPkr), true);
  y -= 16;
  row(t.invoice.method, data.method);
  row(t.invoice.transactionId, data.transactionId);

  draw(t.invoice.footer, L, 80, { color: MUTED, size: 10 });

  return Buffer.from(await doc.save());
}
