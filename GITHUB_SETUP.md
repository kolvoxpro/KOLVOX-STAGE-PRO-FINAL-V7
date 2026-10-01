# Como Conectar e Subir o KOLVOX para o GitHub

Se você está tendo problemas com o GitHub não logando ou não autenticando com o seu projeto, siga este passo a passo testado e definitivo.

---

### 1. Por que o GitHub não aceita mais senha normal?
O GitHub desativou o login por senha normal via Git (`git push`) e agora exige:
- **Personal Access Token (PAT)** (Método mais simples e recomendado) **OU**
- **GitHub CLI (`gh auth login`)** **OU**
- **Chave SSH**

---

### 2. Passo a Passo Rápido com Token de Acesso Pessoal (PAT)

#### Passo 2.1 — Gerar o Token no GitHub:
1. Acesse o GitHub no seu navegador: [github.com/settings/tokens](https://github.com/settings/tokens)
2. Clique em **"Generate new token"** (escolha **Generate new token (classic)**).
3. No campo **Note**, coloque: `kolvox-deploy`.
4. Em **Expiration**, escolha `90 days` ou `No expiration`.
5. Marque a caixa de permissão:
   - ✅ **`repo`** (acesso completo aos repositórios privados e públicos)
   - ✅ **`workflow`** (se for usar GitHub Actions)
6. Role até o fim e clique no botão verde **"Generate token"**.
7. **Copie o token gerado** (começa com `ghp_...`). *Guarde-o em um local seguro, ele não será exibido novamente!*

#### Passo 2.2 — Criar o Repositório no GitHub:
1. Acesse [github.com/new](https://github.com/new)
2. Nome do repositório: `kolvox-stage` (ou o nome que preferir).
3. Deixe desmarcado "Initialize with README".
4. Clique em **"Create repository"**.

#### Passo 2.3 — Vincular e Enviar o Projeto pelo Terminal:
Abra o terminal do projeto e execute os comandos:

```bash
# 1. Adicionar todos os arquivos ao Git
git add .

# 2. Criar o primeiro commit
git commit -m "feat: lancamento oficial Kolvox Stage com Firebase e Vercel"

# 3. Vincular seu repositório remoto (substitua SEU-USUARIO e REPOSITORIO)
git remote add origin https://SEU-TOKEN-AQUI@github.com/SEU-USUARIO/REPOSITORIO.git

# Exemplo:
# git remote add origin https://ghp_abcdef123456789@github.com/seunome/kolvox-stage.git

# 4. Enviar os arquivos para a branch main
git push -u origin main --force
```

> **Dica**: Colocando o token direto na URL `https://TOKEN@github.com/...`, o Git não pedirá login interativo e o push funcionará instantaneamente sem erros de autenticação!

---

### 3. Alternativa: Usando GitHub CLI (Mais Seguro e Interativo)

Se você tem a ferramenta oficial `gh` instalada:

```bash
# 1. Fazer login no GitHub diretamente no terminal:
gh auth login

# Selecione:
# ? What account do you want to log into? -> GitHub.com
# ? What is your preferred protocol for Git operations? -> HTTPS
# ? Authenticate Git with your GitHub credentials? -> Yes
# ? How would you like to authenticate GitHub CLI? -> Login with a web browser

# 2. Crie o repositório e envie tudo automaticamente:
gh repo create kolvox-stage --public --source=. --remote=origin --push
```

---

### 4. Se já tiver um remote antigo configurado com erro:

```bash
# Verificar remote atual:
git remote -v

# Remover remote antigo:
git remote remove origin

# Adicionar o remote novo com seu token:
git remote add origin https://SEU-TOKEN@github.com/SEU-USUARIO/kolvox-stage.git

# Enviar:
git push -u origin main
```
