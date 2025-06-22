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
  prompt = `
Você está lendo um documento oficial chamado CRLV (Certificado de Registro e Licenciamento de Veículo), emitido pelo DETRAN.

Sua tarefa é extrair **exatamente e apenas** os seguintes dados principais:

1. "Placa" → ⚠️ Atenção: use apenas a placa **atual** (ignorar campos como "PLACA ANTERIOR / UF").
2. "Renavam" → ⚠️ Atenção: é um número de 11 dígitos que geralmente aparece perto do topo com a palavra "CÓDIGO RENAVAM". **Não confunda com CRV ou código de segurança.**
3. "Chassi" → ⚠️ Um número longo que geralmente aparece junto com "CHASSI". Não confundir com número do motor.
4. "Estado de Emplacamento" → ⚠️ É a sigla do estado (ex: AL, SP, MG) vinculada à placa.

Retorne exatamente neste formato JSON (sem explicações extras):
{
  "Placa": "",
  "Chassi": "",
  "Renavam": "",
  "Estado de Emplacamento": ""
}
`.trim();
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

  let conteudo = response.choices[0].message.content?.trim();

  // Remove blocos de markdown tipo ```json
  conteudo = conteudo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    let dados = JSON.parse(conteudo);

    // Padronização dos nomes dos campos
    if (dados.nome) dados['Nome Completo'] = dados.nome;
    if (dados.placa) dados['Placa'] = dados.placa.toUpperCase();
    if (dados.chassi) dados['Chassi'] = dados.chassi.toUpperCase();
    if (dados.renavam) dados['Renavam'] = dados.renavam;
    if (dados.estado || dados.estadoEmplacamento)
      dados['Estado de Emplacamento'] = (dados.estado || dados.estadoEmplacamento).toUpperCase();

    return dados;
  } catch (e) {
    console.error('❌ Retorno não é um JSON válido:', conteudo);

    // Fallback: extrair campos com regex
    const fallback = {};
    const matchPlaca = conteudo.match(/placa\s*[:=]?\s*["']?([A-Z0-9\-]{5,8})["']?/i);
    const matchChassi = conteudo.match(/chassi\s*[:=]?\s*["']?([\w\d]{8,})["']?/i);
    const matchRenavam = conteudo.match(/renavam\s*[:=]?\s*["']?([\d]{8,})["']?/i);
    const matchEstado = conteudo.match(/estado\s*[:=]?\s*["']?([A-Z]{2})["']?/i);

    if (matchPlaca) fallback['Placa'] = matchPlaca[1].toUpperCase();
    if (matchChassi) fallback['Chassi'] = matchChassi[1].toUpperCase();
    if (matchRenavam) fallback['Renavam'] = matchRenavam[1];
    if (matchEstado) fallback['Estado de Emplacamento'] = matchEstado[1];

    return fallback;
  }
}

module.exports = { interpretarImagemComGptVision };
