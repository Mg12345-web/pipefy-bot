const path = require("path");
const fs = require("fs");

const { runClientRobot } = require("../robots/client");
const { runRGPRobot } = require("../robots/rgp");
const { runSemRGPRobot } = require("../robots/semrgp");
const { runCrlvRobot } = require("../robots/crlv");
const { runFilaRobot } = require("../robots/fila");

async function handleFormulario(req, res) {
  const { email, telefone } = req.body;

  const log = (msg) => {
    res.write(`${msg}\n`);
    console.log(msg);
  };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.write("<pre>📥 Iniciando processamento do formulário...\n");

  try {
    const arquivos = req.files || {};

    // 1. Robô de cliente (se arquivos base existirem)
    const temCliente = arquivos.procuracao && arquivos.cnh && arquivos.contrato;
    if (temCliente) {
      log("🔁 Chamando robô de cliente...");
      await runClientRobot(req, res);
    }

    // 2. Robôs de autuações (por tipo)
    const autuacoes = Object.keys(arquivos)
      .filter(k => k.startsWith("autuacoes["))
      .map((nomeCampo) => {
        const match = nomeCampo.match(/autuacoes\[(\d+)\]\[arquivo\]/);
        if (!match) return null;
        const index = match[1];
        return {
          index,
          arquivo: arquivos[nomeCampo][0],
          tipo: req.body[`autuacoes[${index}][tipo]`] || ""
        };
      })
      .filter(Boolean);

    for (const aut of autuacoes) {
      const nomeArquivo = aut.arquivo.originalname;
      const caminho = aut.arquivo.path;
      if (aut.tipo === "RGP") {
        log(`📄 Autuação #${aut.index} (RGP) → ${nomeArquivo}`);
        await runRGPRobot(caminho, res);
      } else if (aut.tipo === "Sem RGP") {
        log(`📄 Autuação #${aut.index} (Sem RGP) → ${nomeArquivo}`);
        await runSemRGPRobot(caminho, res);
      }
    }

    // 3. CRLV
    if (arquivos.crlv) {
      const caminho = arquivos.crlv[0].path;
      log("🚗 CRLV enviado. Iniciando robô...");
      await runCrlvRobot(caminho, res);
    }

    res.end("\n✅ Todos os fluxos executados.\n</pre>");
  } catch (err) {
    console.error("❌ Erro ao processar o formulário:", err);
    res.end("</pre><p style='color:red'>Erro interno no servidor.</p>");
  }
}

module.exports = { handleFormulario };
