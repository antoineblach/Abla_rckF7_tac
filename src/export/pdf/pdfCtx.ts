// The jsPDF document with the embedded font, and its 2D context seen as a Ctx2D (D-071).
import { jsPDF } from 'jspdf'
import type { Ctx2D } from '../../render/ctx2d'
import type { Measure } from './layout'

/** Family name of the embedded font: the same as the theme font, so that the context finds it. */
export const PDF_FONT = 'Atkinson Hyperlegible'

/** TrueType files of the embedded font (Regular and Bold). */
export interface PdfFonts {
  regular: Uint8Array
  bold: Uint8Array
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** A document whose first page measures `width` by `height` millimetres, font embedded. */
export function createPdfDoc(fonts: PdfFonts, width: number, height: number): jsPDF {
  const doc = new jsPDF({
    unit: 'mm',
    format: [width, height],
    orientation: width > height ? 'landscape' : 'portrait',
    compress: true,
    putOnlyUsedFonts: true,
  })
  // jsPDF embeds only the glyphs used, with a /ToUnicode map (text search and copy).
  doc.addFileToVFS('AtkinsonHyperlegible-Regular.ttf', base64(fonts.regular))
  doc.addFont('AtkinsonHyperlegible-Regular.ttf', PDF_FONT, 'normal')
  doc.addFileToVFS('AtkinsonHyperlegible-Bold.ttf', base64(fonts.bold))
  doc.addFont('AtkinsonHyperlegible-Bold.ttf', PDF_FONT, 'bold')
  return doc
}

/** Text widths in millimetres with the embedded font (a document kept for measuring only). */
export function pdfMeasure(fonts: PdfFonts): Measure {
  const doc = createPdfDoc(fonts, 100, 100)
  return (text, size, bold) => {
    doc.setFont(PDF_FONT, bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    return doc.getTextWidth(text)
  }
}

/**
 * The 2D context of jsPDF as a Ctx2D. Its declared type differs from its code (measureText returns
 * an object with `width`, as a canvas does); every member used by the renderer exists, which the
 * vector PDF tests check on the produced file (D-071).
 */
export function pdfContext(doc: jsPDF): Ctx2D {
  return doc.context2d as unknown as Ctx2D
}
