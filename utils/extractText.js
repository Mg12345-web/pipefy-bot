const fs = require('fs');
const Tesseract = require('tesseract.js');
const { OpenAI } = require('openai');

// Configure sua chave da OpenAI aqui ou via variável de ambiente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // use .env com dotenv se preferir
});

// 📄 Função de OCR para extrair texto de imagens e PDFs
async function extractText(caminhoArquivo) {
  try {
    const resultado = await Tesseract.recognize(caminhoArquivo, 'por', {
      logger: m => console.log(`[OCR] ${m.status}`)
    });
    return resultado.data.text;
  } catch (err) {
    console.error('❌ Erro no OCR:', err.message);
    return '';
  }
}

// 🧠 Função para interpretar o texto usando o GPT
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
    JSON.parse(content); // valida se é JSON
    return content;
  } catch (err) {
    console.error(`❌ Erro ao interpretar texto com GPT: ${err.message}`);
    return '{}';
  }
}

module.exports = {
  extractText,
  interpretarTextoComGPT
};
