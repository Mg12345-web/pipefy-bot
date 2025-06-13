# Usa a imagem base do Playwright com Ubuntu Jammy
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependência e instala libs de imagem
COPY package*.json ./

# Instala libs do sistema necessárias para OCR
RUN apt-get update && apt-get install -y \
  graphicsmagick \
  imagemagick \
  && rm -rf /var/lib/apt/lists/*

# Instala dependências Node.js
COPY package*.json ./
RUN npm install --omit=dev

# Copia restante do código
COPY . .

# Garante que a pasta uploads/ existe
RUN mkdir -p /app/uploads

# Instala navegadores do Playwright
RUN npx playwright install --with-deps

# Define ambiente de produção
ENV NODE_ENV=production

# Expõe a porta do Express
EXPOSE 8080

# Comando padrão de inicialização
CMD ["node", "index.js"]
