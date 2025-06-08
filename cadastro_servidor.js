const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send(`
    <h2>🚀 Robô Pipefy - Cadastro</h2>
    <form action="/start" method="GET">
      <button type="submit" style="font-size: 18px; padding: 10px 20px;">
        Iniciar cadastro no Pipefy
      </button>
    </form>
  `);
});

app.get('/start', async (req, res) => {
  res.send('<p>✅ Robô de cadastro iniciado! Veja os logs no Railway.</p>');
  await executarCadastro();
});

app.listen(PORT, () => {
  console.log(`🖥️ Servidor rodando em http://localhost:${PORT}`);
});

async function executarCadastro() {
  console.log('🚀 Iniciando cadastro com sessão reutilizada...');

  const context = await chromium.launchPersistentContext('./session', {
    headless: true
  });

  const page = await context.newPage();

  await page.goto('https://app.pipefy.com/apollo_databases/304722696');
  await page.waitForSelector('button:has-text("Criar registro")', { timeout: 10000 });
  await page.click('button:has-text("Criar registro")');

  const dados = {
    'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
    'CPF OU CNPJ': '414.746.148-41',
    'Estado Civil Atual': 'Solteiro',
    'Profissão': 'Vigilante',
    'Email': 'jonas1gui@gmail.com',
    'Número de telefone': '31988429016',
    'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG',
  };

  for (const [campo, valor] of Object.entries(dados)) {
    try {
      const label = await page.getByLabel(campo);
      await label.scrollIntoViewIfNeeded();
      await label.fill(valor);
      console.log(`✅ ${campo} preenchido`);
    } catch {
      console.log(`❌ ${campo} não encontrado`);
    }
  }

  const botoes = await page.$$('button');
  for (let i = 0; i < botoes.length; i++) {
    const texto = await botoes[i].innerText();
    const box = await botoes[i].boundingBox();
    if (texto.trim() === 'Criar registro' && box && box.width > 200) {
      await botoes[i].scrollIntoViewIfNeeded();
      await botoes[i].click();
      console.log(`✅ Botão Criar Registro clicado com sucesso`);
      break;
    }
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'registro_criado.png' });

  console.log('✅ Card criado com sucesso!');
  await context.close();
}
