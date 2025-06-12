const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const OpenAI = require('openai');

// Inicializa o cliente OpenAI com a nova sintaxe
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function isImage(filePath) {
  return ['.jpg', '.jpeg', '.png'].includes(path.extname(filePath).toLowerCase());
}

async function extractTextFromImage(imagePath) {
  const result = await Tesseract.recognize(imagePath, 'por', { logger: () => null });
  return result.data.text.trim();
}

async function extractTextFromPDF(pdfPath) {
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  const text = data.text.trim();

  if (text.length > 50) return text;

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

  let fullText = '';
  const totalPages = data.numpages || 1;

  for (let i = 1; i <= totalPages; i++) {
    const page = await converter(i);
    const ocrText = await extractTextFromImage(page.path);
    fullText += '\n' + ocrText;
  }

  try {
    fs.readdirSync(tempDir).forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
  } catch (err) {
    console.warn('⚠️ Falha ao limpar temp_images:', err.message);
  }

  return fullText.length > 50 ? fullText : '[ERRO: OCR falhou]';
}

// Atualizado para a nova API do OpenAI
async function interpretarTextoComGPT(textoOriginal) {
  const resposta = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente que extrai dados de documentos de veículos e procurações. Responda com um objeto JSON contendo: nome, cpf, placa, chassi, renavam, estadoCivil, profissao, endereco e órgão autuador se houver.'
      },
      {
        role: 'user',
        content: textoOriginal
      }
    ],
    temperature: 0.2
  });

  return resposta.choices[0].message.content;
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

module.exports = {
  extractText,
  interpretarTextoComGPT
};
