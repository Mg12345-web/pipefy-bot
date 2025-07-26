const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function interpretarPaginaComGptVision(page, descricaoAlvo = 'botão relevante') {
  const caminhoImagem = path.resolve(__dirname, 'pagina_temp.jpg');

  // Tira screenshot da tela atual do Pipefy
  await page.screenshot({ path: caminhoImagem, fullPage: true });

  const imagemBase64 = fs.readFileSync(caminhoImagem, { encoding: 'base64' });

  const prompt = `
Você é um assistente visual de automação web. Analise a imagem abaixo e retorne um seletor CSS (ou Playwright) que permita clicar no elemento que corresponde à descrição:
"${descricaoAlvo}"

⚠️ Regras:
- Responda apenas com o seletor CSS ou Playwright.
- Nunca use blocos de código como \`\`\`.
- Nunca explique.
- Seja o mais específico possível (ex: use [data-testid] ou nomes visíveis).

Se não encontrar nada, diga apenas: "NÃO ENCONTRADO".
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Você é um interpretador visual de páginas HTML automatizadas.'
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
    max_tokens: 500
  });

  let seletor = response.choices[0].message.content?.trim() || '';

  // 🧹 Limpeza automática do seletor
  seletor = seletor
    .replace(/```(css)?/gi, '') // remove blocos de código
    .replace(/[\r\n]/g, '')     // remove quebras de linha
    .trim();

  // 🛡️ Proteção: se vier vazio, trata como não encontrado
  if (!seletor || seletor.toLowerCase().includes('não encontrado')) {
    return 'NÃO ENCONTRADO';
  }

  return seletor;
}

module.exports = { interpretarPaginaComGptVision };
