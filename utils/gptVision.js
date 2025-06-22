const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function interpretarImagemComGptVision(caminhoImagem, tipoDocumento = 'geral') {
  const imagemBase64 = fs.readFileSync(path.resolve(caminhoImagem), { encoding: 'base64' });

  let prompt = '';
  switch (tipoDocumento) {
    case 'procuracao':
      prompt = `Extraia os seguintes dados da procuração: nome completo, CPF, CNH, profissão, estado civil, endereço completo (rua, número, bairro, cidade, estado, CEP). Retorne em JSON.`;
      break;

    case 'crlv':
      prompt = `Você está lendo um documento oficial chamado CRLV.

⚠️ IMPORTANTE:
- Ignore campos como "placa anterior".
- Use apenas os dados visíveis em destaque no documento.

Extraia os seguintes dados e retorne em JSON:
{
  "Placa": "",                // Ex: QPI2C37
  "Renavam": "",              // Ex: 01167871593
  "Chassi": "",               // Ex: 9C6RM0920J0004479
  "Estado de Emplacamento": "" // Ex: RJ
}`.trim();
      break;

    case 'autuacao':
      prompt = `Extraia da notificação de autuação: órgão autuador, número da AIT, placa, data da infração. Retorne em JSON.`;
      break;

    default:
      prompt = `Extraia os dados relevantes deste documento de trânsito e devolva em JSON.`;
  }

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

  let conteudo = response.choices[0].message.content?.trim();
  conteudo = conteudo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    const dados = JSON.parse(conteudo);

    // Padronização
    if (dados.nome) dados['Nome Completo'] = dados.nome;
    if (dados.placa) dados['Placa'] = dados.placa.toUpperCase();
    if (dados.chassi) dados['Chassi'] = dados.chassi.toUpperCase();
    if (dados.renavam) dados['Renavam'] = dados.renavam;
    if (dados.estado || dados.estadoEmplacamento || dados['Estado de Emplacamento']) {
      dados['Estado de Emplacamento'] = (dados.estado || dados.estadoEmplacamento || dados['Estado de Emplacamento']).toUpperCase();
    }

    return dados;
  } catch (e) {
    console.error('❌ Retorno não é um JSON válido:', conteudo);

    // Fallback via regex
    const fallback = {};
    const matchPlaca = conteudo.match(/placa\s*[:=]?\s*["']?([A-Z0-9\-]{5,8})["']?/i);
    const matchChassi = conteudo.match(/chassi\s*[:=]?\s*["']?([\w\d]{8,})["']?/i);
    const matchRenavam = conteudo.match(/renavam\s*[:=]?\s*["']?(\d{8,})["']?/i);
    const matchEstado = conteudo.match(/(?:local|estado).*?([A-Z]{2})/i);

    if (matchPlaca) fallback['Placa'] = matchPlaca[1].toUpperCase();
    if (matchChassi) fallback['Chassi'] = matchChassi[1].toUpperCase();
    if (matchRenavam) fallback['Renavam'] = matchRenavam[1];
    if (matchEstado) fallback['Estado de Emplacamento'] = matchEstado[1];

    return fallback;
  }
}

module.exports = { interpretarImagemComGptVision };
