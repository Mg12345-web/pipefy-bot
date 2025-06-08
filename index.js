const { chromium } = require('playwright');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 8080;

let rodando = false; // trava simples

app.get('/', async (req, res) => {
  if (rodando) {
    return res.send('<h2>⚠️ Robô já está em execução. Aguarde a finalização.</h2>');
  }

  rodando = true;
  const statusCampos = [];

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://signin.pipefy.com/realms/pipefy/protocol/openid-connect/auth?client_id=pipefy-auth&redirect_uri=https%3A%2F%2Fapp-auth.pipefy.com%2Fauth_callback&response_type=code&scope=openid+email+profile');
    await page.fill('input[name="username"]', 'juridicomgmultas@gmail.com');
    await page.click('#kc-login');
    await page.fill('input[name="password"]', 'Mg.12345@');
    await page.click('#kc-login');
    await page.waitForNavigation({ waitUntil: 'load' });

    await page.getByText('Databases', { exact: true }).click();
    await page.getByText('Clientes', { exact: true }).click();
    await page.click('button:has-text("Criar registro")');

    const dados = {
      'Nome Completo': 'ADRIANO ANTONIO DE SOUZA',
      'CPF OU CNPJ': '414.746.148-41',
      'Profissão': 'Vigilante',
      'Email': 'jonas1gui@gmail.com',
      'Número de telefone': '31988429016',
      'Endereço Completo': 'Rua Luzia de Jesus, 135, Jardim dos Comerciários, Ribeirão das Neves - MG'
    };

    for (const [campo, valor] of Object.entries(dados)) {
      try {
        const label = await page.getByLabel(campo);
        await label.scrollIntoViewIfNeeded();
        await label.fill(valor);
        statusCampos.push(`✅ ${campo}`);
      } catch {
        statusCampos.push(`❌ ${campo}`);
      }
    }

    // 🔍 Buscar arquivos por nome aproximado
    function buscarArquivos(parteNome) {
      const extensoes = ['.pdf', '.jpg', '.jpeg'];
      const arquivos = fs.readdirSync(__dirname);
      return arquivos
        .filter(nome => {
          const nomeMin = nome.toLowerCase();
          return nomeMin.includes(parteNome.toLowerCase()) && extensoes.includes(path.extname(nomeMin));
        })
        .map(nome => path.join(__dirname, nome));
    }

    const arquivosCNH = buscarArquivos('cnh');
    const arquivosProc = buscarArquivos('procuracao');
    const arquivosContrato = buscarArquivos('contrato');
    const arquivosProcContrato = [...arquivosProc, ...arquivosContrato];

    // 📤 Enviar CNH
    if (arquivosCNH.length > 0) {
      await enviarArquivosPorOrdem(page, 0, '* CNH', arquivosCNH, statusCampos);
    } else {
      statusCampos.push('❌ Nenhum arquivo CNH encontrado');
    }

    // 📤 Enviar Procuração + Contrato juntos
    if (arquivosProcContrato.length > 0) {
      await enviarArquivosPorOrdem(page, 1, '* Procuração', arquivosProcContrato, statusCampos);
    } else {
      statusCampos.push('❌ Nenhum arquivo de Procuração/Contrato encontrado');
    }

    await page.screenshot({ path: 'print_antes_clique.png' });

    const botoes = await page.$$('button');
    for (let i = 0; i < botoes.length; i++) {
      const texto = await botoes[i].innerText();
      const box = await botoes[i].boundingBox();
      if (texto.trim() === 'Criar registro' && box && box.width > 200) {
        await botoes[i].scrollIntoViewIfNeeded();
        await botoes[i].click();
        await botoes[i].screenshot({ path: 'print_botao_clicado.png' });
        statusCampos.push(`✅ Botão ${i + 1} clicado com sucesso.`);
        break;
      }
    }

    for (let i = 0; i < 15; i++) {
      const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
      if (!aindaAberto) break;
      await page.waitForTimeout(800);
    }

    const aindaAberto = await page.$('input[placeholder="Nome Completo"]');
    if (aindaAberto) {
      statusCampos.push('⚠️ Formulário ainda aberto. Registro pode não ter sido criado.');
    } else {
      statusCampos.push('✅ Registro criado com sucesso');
    }

    await page.screenshot({ path: 'registro_final.png' });
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
    await browser.close();
  } catch (err) {
    statusCampos.push('❌ Erro durante execução: ' + err.message);
    fs.writeFileSync('status.txt', statusCampos.join('\n'));
  }

  rodando = false;

  res.send(`
    <h2>✅ Robô executado</h2>
    <pre>${fs.readFileSync('status.txt')}</pre>
    <p>
      <a href="/print">📥 Baixar print final</a><br>
      <a href="/antes">📷 Ver print antes do clique</a><br>
      <a href="/clicado">📷 Botão clicado</a>
    </p>
  `);
});

async function enviarArquivosPorOrdem(page, index, labelTexto, arquivosLocais, statusCampos) {
  try {
    const botoesUpload = await page.locator('button[data-testid="attachments-dropzone-button"]');
    const botao = botoesUpload.nth(index);

    await botao.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      botao.evaluate(el => el.click())
    ]);

    await fileChooser.setFiles(arquivosLocais);
    await page.waitForTimeout(2000);

    const nomesArquivos = arquivosLocais.map(p => path.basename(p));
    let algumVisivel = false;
    for (const nome of nomesArquivos) {
      const visivel = await page.locator(`text="${nome}"`).first().isVisible({ timeout: 7000 }).catch(() => false);
      if (visivel) algumVisivel = true;
    }

    if (algumVisivel) {
      await page.waitForTimeout(15000);
      statusCampos.push(`✅ ${labelTexto} enviado (${nomesArquivos.join(', ')})`);
    } else {
      statusCampos.push(`❌ ${labelTexto} falhou (arquivos não visíveis após envio)`);
    }
  } catch {
    statusCampos.push(`❌ Falha ao enviar ${labelTexto}`);
  }
}

app.get('/print', (req, res) => res.download('registro_final.png'));
app.get('/antes', (req, res) => res.download('print_antes_clique.png'));
app.get('/clicado', (req, res) => res.download('print_botao_clicado.png'));

app.listen(PORT, () => {
  console.log(`🖥️ Servidor escutando em http://localhost:${PORT}`);
});
