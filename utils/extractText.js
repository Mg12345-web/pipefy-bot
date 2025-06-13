const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 🧠 GPT: interpreta um texto OCR com base no tipo de documento
async function interpretarTextoComGPT(textoOriginal, tipoDocumento = 'geral') {
  let systemPrompt = '';

  switch (tipoDocumento) {
    case 'procuracao':
      systemPrompt = 'Você é um assistente que extrai dados de uma procuração.';
      break;
    case 'crlv':
      systemPrompt = 'Você é um assistente que extrai dados de um CRLV. Responda com JSON: placa, chassi, renavam, estadoEmplacamento.';
      break;
    case 'autuacao':
      systemPrompt = 'Você é um assistente que extrai dados de uma notificação de autuação. JSON: orgaoAutuador, numeroAIT, dataDefesaRecurso.';
      break;
    default:
      systemPrompt = 'Você é um assistente que extrai dados de documentos de veículos e procurações.';
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
    JSON.parse(content); // Valida o JSON
    return content;
  } catch (err) {
    console.error(`❌ Erro ao interpretar texto com GPT: ${err.message}`);
    return '{}';
  }
}

// 🧾 OCR de imagem ou PDF (convertendo primeira página em imagem)
async function extractText(caminhoArquivo) {
  try {
    const extensao = path.extname(caminhoArquivo).toLowerCase();

    if (extensao === '.pdf') {
      const outputBase = path.join('/tmp', `ocr_${Date.now()}`);
      const converter = fromPath(caminhoArquivo, {
        density: 200,
        saveFilename: outputBase,
        savePath: '/tmp',
        format: 'png',
        width: 1200,
        height: 1600
      });

      const resultadoConversao = await converter(1); // página 1
      caminhoImagem = resultadoConversao.path;
    } else {
      caminhoImagem = caminhoArquivo; // já é imagem
    }

    const resultado = await Tesseract.recognize(caminhoImagem, 'por', {
      logger: m => console.log(`[OCR] ${m.status}`)
    });

    return resultado.data.text;

  } catch (err) {
    console.error('❌ Erro no OCR:', err.message);
    return '';
  }
}

module.exports = {
  extractText,
  interpretarTextoComGPT
};
