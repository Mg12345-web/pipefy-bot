# Usa a imagem base do Playwright com Ubuntu Jammy
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala Tesseract e OCR em português
RUN apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-por \
  && rm -rf /var/lib/apt/lists/*

# Instala dependências do Node.js
RUN npm install --omit=dev

# Copia restante do projeto
COPY . .

# Cria pastas utilizadas no projeto
RUN mkdir -p /app/uploads /app/logs /app/prints

# Instala navegadores do Playwright
RUN npx playwright install

# Define ambiente de produção
ENV NODE_ENV=production

# Expõe a porta usada pelo Express
EXPOSE 8080

# Comando padrão
CMD ["node", "index.js"]
