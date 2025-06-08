# Usa imagem oficial do Playwright com todas as dependências
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Cria diretório de trabalho
WORKDIR /app

# Copia os arquivos da sua aplicação para dentro do container
COPY . .

# Instala as dependências
RUN npm install

# Expõe porta para o Express funcionar (opcional)
EXPOSE 8080

# Comando padrão ao iniciar o container
CMD ["node", "login.js"]
