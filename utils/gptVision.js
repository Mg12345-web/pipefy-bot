const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Usa a API do GPT-4 Vision para analisar imagens
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extrai informações de uma imagem (JPG/PNG) usando GPT-4 Vision
 * @param {string} caminhoImagem - Caminho para a imagem no disco
 * @param {string} tipoDocumento - Tipo do documento (procuracao, crlv, autuacao, etc.)
 * @returns {object} Dados extraídos (como JSON)
 */
async function interpretarImagemComGptVision(caminhoImagem, tipoDocumento = 'geral') {
  let prompt = '';

  switch (tipoDocumento) {
    case 'procuracao':
      prompt = `Extraia os seguintes dados da procuração: nome completo, CPF, CNH, profissão, estado civil, endereço completo (rua, número, bairro, cidade, estado, CEP). Retorne em JSON.`;
      break;
    case 'crlv':
      prompt = `Extraia os dados do CRLV: placa, chassi, renavam, município, estado e ano. Retorne em JSON.`;
      break;
    case 'autuacao':
      prompt = `Extraia da notificação de autuação: órgão autuador, número da AIT, placa, data da infração. Retorne em JSON.`;
      break;
    default:
      prompt = `Extraia os dados relevantes deste documento de trânsito e devolva em JSON.`;
  }

  const imagemBase64 = fs.readFileSync(path.resolve(caminhoImagem), { encoding: 'base64' });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Você é um assistente de extração de dados para automação de documentos.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imagemBase64}`
            }
          }
        ]
      }
    ],
    max_tokens: 1000
  });

  const conteudo = response.choices[0].message.content;
  try {
  return JSON.parse(conteudo);
} catch (e) {
  console.error('❌ Retorno não é um JSON válido:', conteudo);

    // Tenta extrair manualmente os campos mais comuns como fallback (mínimo)
    const matchPlaca = conteudo.match(/placa\s*[:=]\s*([A-Z0-9\-]+)/i);
    return {
    placa: matchPlaca?.[1] || '',
    // mais campos podem ser extraídos aqui se quiser melhorar ainda mais
  };
}

module.exports = { interpretarImagemComGptVision };
