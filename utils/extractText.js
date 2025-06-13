const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🧠 Interpreta texto com GPT, com fallback seguro
async function interpretarTextoComGPT(textoOriginal, tipoDocumento = 'geral') {
  let systemPrompt = '';

  switch (tipoDocumento) {
    case 'procuracao':
      systemPrompt = 'Você é um assistente que extrai dados de uma procuração. Responda somente com um JSON.';
      break;
    case 'crlv':
      systemPrompt = 'Você é um assistente que extrai dados de um CRLV. Responda com JSON: placa, chassi, renavam, estadoEmplacamento.';
      break;
    case 'autuacao':
      systemPrompt = 'Você é um assistente que extrai dados de uma notificação de autuação. JSON: orgaoAutuador, numeroAIT, dataDefesaRecurso.';
      break;
    default:
      systemPrompt = 'Você é um assistente que extrai dados de documentos de veículos e procurações. Responda apenas com um JSON.';
  }

  try {
    const resposta = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: textoOriginal }
      ],
      temperature: 0.2
    });

    const content = resposta.choices[0].message.content;

    console.log('📤 Resposta bruta do GPT:', content);

    const matchJson = content.match(/\{[\s\S]+?\}/);
    
if (matchJson) {
  try {
    JSON.parse(matchJson[0]); // Valida sintaxe
    return matchJson[0];
  } catch {
    console.warn('⚠️ JSON malformado retornado pelo GPT.');
    return '{}';
  }
}

return '{}';

  } catch (err) {
    console.error(`❌ Erro ao interpretar texto com GPT: ${err.message}`);
    return '{}';
  }
}

// 📄 Extrai texto de imagem ou PDF
async function extractText(caminhoArquivo) {
  try {
    const extensao = path.extname(caminhoArquivo).toLowerCase();

    if (extensao === '.pdf') {
      const buffer = fs.readFileSync(caminhoArquivo);
      const data = await pdfParse(buffer);
      return data.text;
    } else {
      const resultado = await Tesseract.recognize(caminhoArquivo, 'por', {
        logger: m => console.log(`[OCR] ${m.status}`)
      });
      return resultado.data.text;
    }

  } catch (err) {
    console.error('❌ Erro no OCR:', err.message);
    return '';
  }
}

module.exports = {
  extractText,
  interpretarTextoComGPT
};
