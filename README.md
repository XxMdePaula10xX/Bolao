# ⚽ Bolão Flex

App mobile para criar e gerenciar **bolões esportivos customizáveis** — públicos ou privados, com convite por link, palpites em grupo, ranking automático, liga e copa. Feito com **Expo + React Native (TypeScript)** no front-end e **Firebase** no back-end.

> Este README é um guia **passo a passo para iniciantes**. Vá com calma, na ordem. Se travar em algum ponto, releia o passo anterior — quase sempre o problema é uma configuração que faltou.

---

## 📑 Índice

1. [O que já está pronto](#-o-que-já-está-pronto)
2. [Como o projeto está organizado](#-como-o-projeto-está-organizado)
3. [Pré-requisitos (instalar uma vez)](#-pré-requisitos-instalar-uma-vez)
4. [Passo 1 — Criar o projeto no Firebase](#-passo-1--criar-o-projeto-no-firebase)
5. [Passo 2 — Configurar o app (.env)](#-passo-2--configurar-o-app-env)
6. [Passo 3 — Instalar e rodar o app](#-passo-3--instalar-e-rodar-o-app)
7. [Passo 4 — Regras de segurança e índices](#-passo-4--regras-de-segurança-e-índices)
8. [Passo 5 — Dados de exemplo (competição e jogos)](#-passo-5--dados-de-exemplo-competição-e-jogos)
9. [Passo 6 — Cloud Functions (pontuação automática)](#-passo-6--cloud-functions-pontuação-automática)
10. [Testando o fluxo completo](#-testando-o-fluxo-completo)
11. [Próximos passos do roadmap](#-próximos-passos-do-roadmap)
12. [Perguntas frequentes / problemas comuns](#-perguntas-frequentes--problemas-comuns)

---

## ✅ O que já está pronto

Rodando em **Expo SDK 54**. Já implementado:

- **Autenticação** por e-mail/senha (cadastro, login, recuperar senha).
- **Home** com seus bolões, atalhos, bolões oficiais e sino de notificações.
- **Explorar** bolões públicos (com busca).
- **Criar bolão** via wizard guiado (templates, módulos, pontuação).
- **Convite por código** (entrar em bolão privado).
- **Tela do bolão** com abas dinâmicas: Visão geral, Jogos/Palpites, Ranking, **Copa**, **Copa dos Ruins**, **Longo prazo**, **Feed**, Regras, Membros.
- **Palpites jogo a jogo** com trava após o início do jogo.
- **Copa / chaveamento visual** (mata-mata entre participantes, com seed por classificação, byes e avanço de fases).
- **Palpites de longo prazo** (campeão, vice, artilheiro, craque).
- **Feed do bolão** (mural de avisos do organizador).
- **Notificações** in-app + push (Expo) quando há novo aviso no feed.
- **Regulamento automático** gerado a partir das regras.
- **Ranking geral** automático.
- **Cloud Functions**: pontuação ao fim de cada jogo e envio de push no feed.
- **Regras de segurança** do Firestore e Storage por papel.

O que **ainda não** está implementado (próximas fases): liga por rodadas detalhada, integração com API esportiva real ao vivo e pontuação automática da copa/longo prazo. A estrutura já está pronta para receber tudo isso.

> **Sobre push no Expo Go:** a partir do SDK 53, notificações push **remotas** não funcionam mais no app Expo Go — só em um *development build* (EAS) ou no app publicado. No Expo Go você ainda recebe as **notificações in-app** (a lista do sino 🔔) e notificações **locais**. Para testar push de verdade, gere um development build com `npx expo run:android`/`run:ios` ou `eas build`.

---

## 🗂 Como o projeto está organizado

```
Bolao/
├── app/                      # Telas (Expo Router = navegação por arquivos)
│   ├── _layout.tsx           #   "Porteiro": providers + guarda de login
│   ├── index.tsx             #   Redireciona para login ou home
│   ├── (auth)/               #   Telas de login e cadastro
│   ├── (app)/                #   Abas: home, explore, my-pools, profile
│   ├── create-pool.tsx       #   Wizard de criação de bolão
│   ├── join.tsx              #   Entrar por código
│   └── pool/[id]/index.tsx   #   Tela de um bolão (com abas internas)
├── src/
│   ├── components/ui/         # Botão, Input, Card, etc. (reutilizáveis)
│   ├── components/Logo.tsx    # Logo do app (sem precisar de imagem)
│   ├── features/             # Lógica por funcionalidade (pools, palpites...)
│   ├── services/firebase/    # Conexão e funções do Firebase
│   ├── store/                # Estado global (Zustand) — quem está logado
│   ├── lib/                  # Utilidades + motor de pontuação
│   ├── theme/                # Cores e estilos da marca
│   └── types/                # Tipos de dados (modelo do Firestore)
├── functions/                # Cloud Functions (back-end de cálculo)
├── scripts/seed.mjs          # Popula dados de exemplo
├── firestore.rules           # Segurança do banco
├── storage.rules             # Segurança dos arquivos
└── .env.example              # Modelo de configuração do Firebase
```

> **Conceito-chave (Expo Router):** cada arquivo dentro de `app/` vira uma tela. Pastas entre `(parênteses)` agrupam telas sem virar parte do endereço. Colchetes `[id]` são partes dinâmicas do endereço (ex: o id do bolão).

---

## 🧰 Pré-requisitos (instalar uma vez)

1. **Node.js 20+** — baixe em https://nodejs.org (versão LTS).
   Para conferir, abra o terminal e rode: `node --version`
2. **App Expo Go** no seu celular (Android ou iPhone), pela loja de apps.
   É com ele que você vai abrir o app durante o desenvolvimento, sem precisar publicar nada.
3. (Opcional, para back-end) **Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

---

## 🔥 Passo 1 — Criar o projeto no Firebase

O Firebase é o "servidor" do app (banco de dados, login, etc.). É gratuito para começar.

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**.
2. Dê um nome (ex: `bolao-flex`) e siga até criar. Pode desativar o Google Analytics.
3. Dentro do projeto, ative os serviços:
   - **Authentication** → aba *Sign-in method* → ative **E-mail/senha**.
   - **Firestore Database** → *Criar banco de dados* → comece em **modo de produção** → escolha uma região (ex: `southamerica-east1`).
   - **Storage** → *Começar* (aceite os padrões).
4. Pegue as credenciais do app:
   - Clique no ícone de engrenagem ⚙️ → **Configurações do projeto**.
   - Em "Seus apps", clique no ícone **`</>`** (Web) para registrar um app web.
   - Dê um apelido qualquer e registre. **Não** precisa marcar Hosting.
   - O Firebase vai mostrar um objeto `firebaseConfig` com várias chaves. **Deixe essa tela aberta**, você vai copiar esses valores no próximo passo.

---

## ⚙️ Passo 2 — Configurar o app (.env)

1. Na raiz do projeto, copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```
2. Abra o `.env` e preencha com os valores do `firebaseConfig` do passo anterior:
   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=bolao-flex.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=bolao-flex
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=bolao-flex.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
   EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```

> O `.env` **não** vai para o GitHub (já está no `.gitignore`). Cada pessoa que rodar o projeto cria o seu.

---

## ▶️ Passo 3 — Instalar e rodar o app

1. Na raiz do projeto, instale as dependências:
   ```bash
   npm install
   ```
2. (Recomendado) Garanta versões compatíveis com o Expo:
   ```bash
   npx expo install --fix
   ```
3. Inicie o app:
   ```bash
   npx expo start
   ```
4. Vai aparecer um **QR code** no terminal. Abra o **Expo Go** no celular e escaneie.
   O app abre direto no celular. 🎉

> Se mudou o `.env`, pare o servidor (Ctrl+C) e rode `npx expo start -c` (o `-c` limpa o cache).

---

## 🔐 Passo 4 — Regras de segurança e índices

As regras impedem que alguém leia/escreva dados que não deveria, e os índices fazem as listas carregarem rápido.

1. Faça login na CLI e selecione o projeto:
   ```bash
   firebase login
   firebase use --add        # escolha o projeto bolao-flex
   ```
2. Publique as regras e índices:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

> Se preferir não usar a CLI agora, você pode colar o conteúdo de `firestore.rules` direto no Console (Firestore → aba *Regras*). Mas a CLI é o jeito recomendado.

---

## 🌱 Passo 5 — Dados de exemplo (competição e jogos)

Para palpitar, o app precisa de uma competição e alguns jogos. Como esses dados só podem ser escritos pelo back-end (por segurança), usamos um script com permissão de administrador.

1. No Console: ⚙️ **Configurações do projeto** → aba **Contas de serviço** → **Gerar nova chave privada**. Baixe o arquivo JSON.
2. Renomeie/salve esse arquivo como **`serviceAccountKey.json`** na raiz do projeto.
   ⚠️ **Esse arquivo é secreto.** Já está no `.gitignore` — nunca suba para o GitHub.
3. Instale a dependência usada pelo script e rode:
   ```bash
   npm install firebase-admin
   node scripts/seed.mjs
   ```
4. Pronto: o script cria uma competição **"Brasileirão Exemplo 2026"** com 5 jogos (um já finalizado, para testar a pontuação, e quatro futuros para palpitar).

---

## 🧮 Passo 6 — Cloud Functions (pontuação automática)

A função recalcula os pontos automaticamente quando um jogo termina.

1. Instale as dependências das functions:
   ```bash
   cd functions
   npm install
   cd ..
   ```
2. Faça o deploy:
   ```bash
   firebase deploy --only functions
   ```

> **Importante:** Cloud Functions exigem o plano **Blaze** (pague conforme o uso) do Firebase. Ele tem uma cota gratuita generosa; para testes você não deve pagar nada, mas é preciso cadastrar um cartão. Se não quiser ativar agora, o app funciona sem a function — só a pontuação automática não roda (você pode testar o resto normalmente).

Para testar localmente sem deploy, use o emulador:
```bash
cd functions && npm run serve
```

---

## 🧪 Testando o fluxo completo

1. Abra o app → **Criar conta**.
2. Toque em **Criar bolão** → siga o wizard (nome → escolha "Brasileirão Exemplo 2026" → formato → pontuação → publicar).
3. Na tela do bolão, aba **Jogos**: preencha placares nos jogos futuros e toque em **Salvar palpites**.
4. Aba **Ranking**: você aparece na tabela.
5. Para testar a pontuação automática: no Console do Firestore, abra um jogo `scheduled`, mude `status` para `finished` e preencha `homeScore`/`awayScore`. Se a Cloud Function estiver no ar, em segundos seu `totalPoints` no ranking é atualizado.
6. **Convite:** na aba Visão geral há um **código** — compartilhe e outra pessoa usa "Entrar por código" na Home.

---

## 🛣 Próximos passos do roadmap

Seguindo o PRD (seção 30), as próximas entregas naturais são:

- **Fase 2:** liga por rodadas, notificações push (Firebase Cloud Messaging), tela de admin do bolão.
- **Fase 3:** copa (chaveamento visual), palpites de longo prazo, feed do bolão.
- **Integração esportiva real:** trocar o `seed.mjs` por uma Cloud Function agendada que busca jogos/resultados de uma API (API-Football, Sportmonks ou TheSportsDB) e grava em `/matches`. O app já lê de `/matches` em tempo real, então é só alimentar essa coleção.

Cada um desses já tem o "esqueleto" pronto: tipos em `src/types`, coleções nas regras e o padrão de telas/serviços para copiar.

---

## ❓ Perguntas frequentes / problemas comuns

**"Firebase não configurado" no console.**
Faltou o `.env` ou ele está incompleto. Confira o Passo 2 e reinicie com `npx expo start -c`.

**A lista de bolões/jogos não carrega e aparece erro de índice.**
O Firestore às vezes pede para criar um índice. O erro no console traz um **link** — clique nele para criar automaticamente, ou rode o deploy de índices do Passo 4.

**Não consigo escrever em `matches`/`competitions` pelo app.**
É de propósito (segurança). Esses dados só entram pelo `seed.mjs` ou por Cloud Functions.

**Erro de versão ao instalar.**
Rode `npx expo install --fix`, que acerta as versões para o seu Expo.

**Quero mudar as cores/identidade.**
Edite `src/theme/colors.ts`. Tudo no app puxa as cores de lá.

---

Feito com 💛 e ⚽. Bons palpites!
