const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { fromPath } = require('pdf2pic');

// Detecta extensão
function isImage(filePath) {
  return ['.jpg', '.jpeg', '.png'].includes(path.extname(filePath).toLowerCase());
}

async function extractTextFromImage(imagePath) {
  const result = await Tesseract.recognize(imagePath, 'por', { logger: e => null });
  return result.data.text.trim();
}

async function extractTextFromPDF(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  if (data.text.trim().length > 20) return data.text;

  const tempDir = path.resolve('./temp_images');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const converter = fromPath(pdfPath, {
    density: 150,
    saveFilename: 'ocr_page',
    savePath: tempDir,
    format: 'png',
    width: 1200,
    height: 1600
  });

  const totalPages = data.numpages || 1;
  let fullText = '';

  for (let i = 1; i <= totalPages; i++) {
    const page = await converter(i);
    const ocrText = await extractTextFromImage(page.path);
    fullText += '\n' + ocrText;
  }

  // 🧹 Limpeza dos arquivos temporários
  try {
    const tempFiles = fs.readdirSync(tempDir);
    for (const file of tempFiles) {
      const filePath = path.join(tempDir, file);
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('⚠️ Falha ao limpar temp_images:', err.message);
  }

  return fullText;
}

async function extractText(filePath) {
  if (isImage(filePath)) {
    return await extractTextFromImage(filePath);
  } else if (filePath.endsWith('.pdf')) {
    return await extractTextFromPDF(filePath);
  } else {
    throw new Error('Formato de arquivo não suportado');
  }
}

module.exports = { extractText };
