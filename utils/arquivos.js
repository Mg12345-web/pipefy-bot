const path = require('path');
const fs = require('fs');

function normalizarArquivo(nomeFinalBase, arquivoOriginalPath) {
  const ext = path.extname(arquivoOriginalPath).toLowerCase(); // .pdf, .jpg, etc.
  const pasta = path.dirname(arquivoOriginalPath);
  const nomeFinal = `${nomeFinalBase}${ext}`;
  const destino = path.join(pasta, nomeFinal);

  if (arquivoOriginalPath !== destino) {
    fs.renameSync(arquivoOriginalPath, destino);
  }

  return destino;
}

module.exports = { normalizarArquivo };
