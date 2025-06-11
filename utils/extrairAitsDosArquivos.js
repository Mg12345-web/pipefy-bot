const fs = require('fs');
const path = require('path');
const { extractText } = require('./extractText');

async function extrairAitsDosArquivos(caminhosArquivos) {
  const aits = [];

  for (const caminho of caminhosArquivos) {
    if (!fs.existsSync(caminho)) continue;

    try {
      const texto = await extractText(caminho);
      const encontrados = [...texto.matchAll(/(?:AIT|Auto\s+de\s+Infração)[\s:\-#]*([A-Z0-9\-\.]{5,})/gi)];

      for (const match of encontrados) {
        const ait = match[1].trim();
        if (ait && !aits.includes(ait)) {
          aits.push(ait);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Falha ao extrair texto de ${path.basename(caminho)}: ${err.message}`);
    }
  }

  return aits;
}

module.exports = { extrairAitsDosArquivos };
