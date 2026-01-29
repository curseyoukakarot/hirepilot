import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

type TemplateConfig = {
  assets?: {
    base_pdf?: { storage_bucket: string; storage_path: string };
    preview_image?: { storage_bucket: string; storage_path: string };
  };
  fonts?: Record<string, { storage_bucket: string; storage_path: string }>;
  photo?: {
    enabled?: boolean;
    box?: { page: number; x: number; y: number; w: number; h: number; shape?: 'circle' | 'square' };
    source?: 'resume_or_profile' | string;
  };
  layout?: {
    page?: { unit?: string };
    fields?: Record<
      string,
      {
        page: number;
        x: number;
        y: number;
        font: string;
        size: number;
        color?: string;
        w?: number;
        h?: number;
        lineHeight?: number;
      }
    >;
    repeaters?: Record<
      string,
      {
        page: number;
        start: { x: number; y: number };
        itemGap: number;
        maxItems: number;
        fields: Record<
          string,
          {
            dx: number;
            dy: number;
            font: string;
            size: number;
            color?: string;
            w?: number;
            h?: number;
            lineHeight?: number;
          }
        >;
      }
    >;
  };
};

type RenderInput = {
  basePdfBytes: Uint8Array;
  templateConfig: TemplateConfig;
  resumeData: any;
  fontsByName: Record<string, Uint8Array>;
  photoPngBytes?: Uint8Array | null;
  debug?: boolean;
};

type WrappedTextParams = {
  page: PDFPage;
  text: string;
  font: PDFFont;
  size: number;
  color: { r: number; g: number; b: number };
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  maxLines?: number;
};

type BulletParams = {
  page: PDFPage;
  bullets: string[];
  x: number;
  y: number;
  width: number;
  font: PDFFont;
  size: number;
  color: { r: number; g: number; b: number };
  lineHeight: number;
  maxLines?: number;
};

function hexToRgb01(hex: string) {
  const clean = hex.replace('#', '').trim();
  const value = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = Number.parseInt(value, 16);
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 };
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function splitLinesByWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText({
  page,
  text,
  font,
  size,
  color,
  x,
  y,
  width,
  lineHeight,
  maxLines,
}: WrappedTextParams) {
  const normalized = normalizeText(text);
  const paragraphs = normalized.split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    lines.push(...splitLinesByWidth(paragraph, font, size, width));
  }

  const limit = typeof maxLines === 'number' ? Math.max(maxLines, 0) : lines.length;
  let currentY = y;
  for (let i = 0; i < lines.length && i < limit; i += 1) {
    page.drawText(lines[i], { x, y: currentY, size, font, color: rgb(color.r, color.g, color.b) });
    currentY -= lineHeight;
  }
}

function drawBullets({
  page,
  bullets,
  x,
  y,
  width,
  font,
  size,
  color,
  lineHeight,
  maxLines,
}: BulletParams) {
  const bulletPrefix = '- ';
  const prefixWidth = font.widthOfTextAtSize(bulletPrefix, size);
  const lines: string[] = [];

  for (const bullet of bullets) {
    const normalized = normalizeText(String(bullet || '').trim());
    if (!normalized) continue;
    const wrapped = splitLinesByWidth(normalized, font, size, Math.max(width - prefixWidth, 0));
    wrapped.forEach((line, index) => {
      lines.push(index === 0 ? `${bulletPrefix}${line}` : `${' '.repeat(bulletPrefix.length)}${line}`);
    });
  }

  const limit = typeof maxLines === 'number' ? Math.max(maxLines, 0) : lines.length;
  let currentY = y;
  for (let i = 0; i < lines.length && i < limit; i += 1) {
    page.drawText(lines[i], { x, y: currentY, size, font, color: rgb(color.r, color.g, color.b) });
    currentY -= lineHeight;
  }
}

function splitName(fullName: string) {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeFontKey(name: string) {
  return String(name || '').replace(/^[A-Z]{6}\+/, '');
}

function resolveFont(name: string, fonts: Record<string, PDFFont>) {
  if (fonts[name]) return fonts[name];
  const normalized = normalizeFontKey(name);
  return fonts[normalized] || null;
}

function drawDebugCrosshair(page: PDFPage, x: number, y: number) {
  const size = 4;
  const color = rgb(0.2, 0.2, 0.8);
  page.drawLine({ start: { x: x - size, y }, end: { x: x + size, y }, color, thickness: 0.4 });
  page.drawLine({ start: { x, y: y - size }, end: { x, y: y + size }, color, thickness: 0.4 });
}

function drawDebugRect(page: PDFPage, x: number, y: number, w: number, h: number) {
  const color = rgb(0.8, 0.2, 0.2);
  page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 0.4 });
}

function getValueFromResume(resumeData: any, key: string) {
  switch (key) {
    case 'full_name':
      return resumeData?.full_name ?? '';
    case 'full_name_first': {
      if (resumeData?.first_name) return resumeData.first_name;
      const derived = splitName(resumeData?.full_name ?? '');
      return derived.firstName;
    }
    case 'full_name_last': {
      if (resumeData?.last_name) return resumeData.last_name;
      const derived = splitName(resumeData?.full_name ?? '');
      return derived.lastName;
    }
    case 'headline':
      return resumeData?.headline ?? '';
    case 'profile_body':
      return resumeData?.profile_body ?? '';
    case 'experience':
      return Array.isArray(resumeData?.experience) ? resumeData.experience : [];
    case 'education':
      return Array.isArray(resumeData?.education) ? resumeData.education : [];
    default:
      return null;
  }
}

function getValueFromRepeaterItem(item: any, key: string) {
  switch (key) {
    case 'company':
      return item?.company ?? '';
    case 'role':
      return item?.role ?? '';
    case 'dates':
      return item?.dates ?? '';
    case 'bullets':
      return Array.isArray(item?.bullets) ? item.bullets : [];
    case 'school':
      return item?.school ?? '';
    case 'degree':
      return item?.degree ?? '';
    case 'details':
      return item?.details ?? '';
    default:
      return null;
  }
}

export async function renderResumePdf({
  basePdfBytes,
  templateConfig,
  resumeData,
  fontsByName,
  photoPngBytes,
  debug = false,
}: RenderInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(basePdfBytes);
  pdfDoc.registerFontkit(fontkit);

  const embeddedFonts: Record<string, PDFFont> = {};
  for (const [fontName, fontBytes] of Object.entries(fontsByName || {})) {
    const embedded = await pdfDoc.embedFont(fontBytes);
    embeddedFonts[fontName] = embedded;
    const normalized = normalizeFontKey(fontName);
    if (normalized && !embeddedFonts[normalized]) {
      embeddedFonts[normalized] = embedded;
    }
  }

  const pages = pdfDoc.getPages();
  const layout = templateConfig?.layout || {};
  const fields = layout.fields || {};
  const hasSplitNameFields = Boolean(fields.full_name_first || fields.full_name_last);

  Object.entries(fields).forEach(([fieldKey, config]) => {
    if (hasSplitNameFields && fieldKey === 'full_name') return;
    const page = pages[(config.page || 1) - 1];
    if (!page) return;
    if (debug) {
      drawDebugCrosshair(page, config.x, config.y);
      if (typeof config.w === 'number' && typeof config.h === 'number') {
        drawDebugRect(page, config.x, config.y - config.h, config.w, config.h);
      }
    }
    const value = getValueFromResume(resumeData, fieldKey);
    if (value === null || value === undefined || value === '') return;
    const font = resolveFont(config.font, embeddedFonts);
    if (!font) return;
    const color = hexToRgb01(config.color || '#000000');
    const lineHeight = config.lineHeight || Math.round(config.size * 1.2);

    if (Array.isArray(value)) {
      const bullets = value.map((v) => String(v)).filter(Boolean);
      if (!bullets.length) return;
      const maxLines =
        typeof config.h === 'number' ? Math.floor(config.h / lineHeight) : undefined;
      const wrapWidth = typeof config.w === 'number' ? config.w : 1000;
      drawBullets({
        page,
        bullets,
        x: config.x,
        y: config.y,
        width: wrapWidth,
        font,
        size: config.size,
        color,
        lineHeight,
        maxLines,
      });
      return;
    }

    const text = String(value);
    if (typeof config.w === 'number' && typeof config.h === 'number') {
      const maxLines = Math.floor(config.h / lineHeight);
      drawWrappedText({
        page,
        text,
        font,
        size: config.size,
        color,
        x: config.x,
        y: config.y,
        width: config.w,
        lineHeight,
        maxLines,
      });
      return;
    }

    page.drawText(text, {
      x: config.x,
      y: config.y,
      size: config.size,
      font,
      color: rgb(color.r, color.g, color.b),
    });
  });

  const repeaters = layout.repeaters || {};
  Object.entries(repeaters).forEach(([repeaterKey, repeater]) => {
    const items = getValueFromResume(resumeData, repeaterKey);
    if (!Array.isArray(items) || !items.length) return;
    const page = pages[(repeater.page || 1) - 1];
    if (!page) return;
    const max = Math.min(repeater.maxItems || items.length, items.length);

    for (let index = 0; index < max; index += 1) {
      const item = items[index];
      const baseX = repeater.start.x;
      const baseY = repeater.start.y - index * repeater.itemGap;

      Object.entries(repeater.fields).forEach(([fieldKey, fieldConfig]) => {
        const x = baseX + fieldConfig.dx;
        const y = baseY + fieldConfig.dy;
        if (debug) {
          drawDebugCrosshair(page, x, y);
          if (typeof fieldConfig.w === 'number' && typeof fieldConfig.h === 'number') {
            drawDebugRect(page, x, y - fieldConfig.h, fieldConfig.w, fieldConfig.h);
          }
        }
        const value = getValueFromRepeaterItem(item, fieldKey);
        if (value === null || value === undefined || value === '') return;
        const font = resolveFont(fieldConfig.font, embeddedFonts);
        if (!font) return;
        const color = hexToRgb01(fieldConfig.color || '#000000');
        const lineHeight = fieldConfig.lineHeight || Math.round(fieldConfig.size * 1.2);

        if (Array.isArray(value)) {
          const bullets = value.map((v) => String(v)).filter(Boolean);
          if (!bullets.length) return;
          const maxLines =
            typeof fieldConfig.h === 'number' ? Math.floor(fieldConfig.h / lineHeight) : undefined;
          const wrapWidth = typeof fieldConfig.w === 'number' ? fieldConfig.w : 1000;
          drawBullets({
            page,
            bullets,
            x,
            y,
            width: wrapWidth,
            font,
            size: fieldConfig.size,
            color,
            lineHeight,
            maxLines,
          });
          return;
        }

        const text = String(value);
        if (typeof fieldConfig.w === 'number' && typeof fieldConfig.h === 'number') {
          const maxLines = Math.floor(fieldConfig.h / lineHeight);
          drawWrappedText({
            page,
            text,
            font,
            size: fieldConfig.size,
            color,
            x,
            y,
            width: fieldConfig.w,
            lineHeight,
            maxLines,
          });
          return;
        }

        page.drawText(text, {
          x,
          y,
          size: fieldConfig.size,
          font,
          color: rgb(color.r, color.g, color.b),
        });
      });
    }
  });

  const photoBox = templateConfig?.photo?.box;
  if (templateConfig?.photo?.enabled && photoBox) {
    const page = pages[(photoBox.page || 1) - 1];
    if (page) {
      if (photoPngBytes) {
        const image = await pdfDoc.embedPng(photoPngBytes);
        page.drawImage(image, {
          x: photoBox.x,
          y: photoBox.y,
          width: photoBox.w,
          height: photoBox.h,
        });
      }
      if (debug) {
        drawDebugRect(page, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
      }
    }
  }

  return await pdfDoc.save();
}
