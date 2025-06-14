const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

    // 🛠️ Fallback: tentar extrair campos básicos com regex
    const fallback = {};
    const matchPlaca = conteudo.match(/placa\s*[:=]?\s*["']?([A-Z0-9\-]{5,8})["']?/i);
    const matchChassi = conteudo.match(/chassi\s*[:=]?\s*["']?([\w\d]{8,})["']?/i);
    const matchRenavam = conteudo.match(/renavam\s*[:=]?\s*["']?([\d]{8,})["']?/i);
    const matchEstado = conteudo.match(/estado\s*[:=]?\s*["']?([A-Z]{2})["']?/i);

    if (matchPlaca) fallback.placa = matchPlaca[1];
    if (matchChassi) fallback.chassi = matchChassi[1];
    if (matchRenavam) fallback.renavam = matchRenavam[1];
    if (matchEstado) fallback.estadoEmplacamento = matchEstado[1];

    return fallback;
  }
}

module.exports = { interpretarImagemComGptVision };
