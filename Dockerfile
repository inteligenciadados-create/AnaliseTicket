# Imagem base com Node.js 22 LTS (suporte nativo a node:sqlite)
FROM node:22-slim

WORKDIR /app

# 1. Copia manifestos de dependências para aproveitar cache do Docker
COPY package.json package-lock.json ./

# 2. Instala dependências completas para o build
RUN npm ci

# 3. Copia o código-fonte da aplicação (incluindo a pasta /data com o SQLite pré-carregado)
COPY . .

# 4. Executa o build de produção (Vite frontend + esbuild server.ts -> dist/server.cjs)
RUN npm run build

# 5. Remove dependências de desenvolvimento para otimizar tamanho da imagem
RUN npm prune --production

# 6. Garante diretório data criado e acessível
RUN mkdir -p /app/data

# Configurações de ambiente de produção
ENV NODE_ENV=production
ENV PORT=3000

# Porta exposta da aplicação
EXPOSE 3000

# Comando de inicialização
CMD ["node", "dist/server.cjs"]
