# ⚽ Bolão Flex

App mobile para criar e gerenciar **bolões esportivos customizáveis** — públicos ou privados, com convite por link, palpites em grupo, ranking automático, liga e copa. Feito com **Expo + React Native (TypeScript)** no front-end e **Firebase** no back-end.

> Este README é um guia **passo a passo para iniciantes**. Vá com calma, na ordem. Se travar em algum ponto, releia o passo anterior — quase sempre o problema é uma configuração que faltou.

---

## 🌐 Versão WEB (abre em qualquer celular por um link)

Além do app React Native, existe uma **versão web** na pasta `web/` — HTML/CSS/JS puro, ligada ao **mesmo Firebase**. É a forma mais fácil de usar: você publica num link e todo mundo abre no navegador do celular, **sem instalar nada**.

### Como publicar (3 passos)
1. **Configuração:** copie `web/firebase-config.example.js` para `web/firebase-config.js` e cole os valores do seu Firebase (os mesmos do `.env`).
   ```bash
   # dentro da pasta web/
   cp firebase-config.example.js firebase-config.js
   ```
2. **Publicar no ar** (dá um link `https://SEU-PROJETO.web.app`):
   ```bash
   firebase deploy --only hosting
   ```
   (Precisa ter feito `firebase login` e `firebase use --add` uma vez — veja o Passo 4.)
3. Abra o link no celular. Pronto. Dá pra **"Adicionar à tela de início"** e virar um ícone igual app.

### Testar no seu computador antes de publicar
```bash
npx serve web
```
Abra o endereço que aparecer (ex: `http://localhost:3000`) no navegador.

> A versão web usa as **mesmas** regras do Firestore e os **mesmos** dados (competições, bolões, palpites, ranking) do app React Native. Cadastre competições pelo painel do admin do app, ou pela versão web quando esse recurso chegar nela.
>
> **Login/dados funcionam** (auth, criar bolão, entrar por código, palpitar, ranking, ao vivo, meus pontos). Chaveamento da copa e "poderes" ainda vão chegar na web.

---

## 📦 Virar app instalável (Capacitor + Codemagic)

A versão web pode virar um **app de verdade** (`.apk` para Android, `.ipa` para iPhone) usando o **Capacitor** (embrulha a web em nativo) + **Codemagic** (compila na nuvem — você não precisa de Mac nem de instalar nada nativo no seu PC).

- `mobile/` → projeto Capacitor (aponta para a pasta `web/`).
- `codemagic.yaml` → receita de build que o Codemagic executa.

### Passo 1 — Conta no Codemagic e conectar o repositório
1. Crie conta grátis em https://codemagic.io (login com GitHub).
2. Autorize e **adicione o repositório** `XxMdePaula10xX/Bolao`.
3. O Codemagic detecta o `codemagic.yaml` automaticamente.

### Passo 2 — Colocar a config do Firebase como variáveis
No Codemagic: **Environment variables** → crie um grupo chamado **`firebase_config`** com (os mesmos valores do `.env`):

| Variável | Valor |
|---|---|
| `FB_API_KEY` | sua apiKey |
| `FB_AUTH_DOMAIN` | seu authDomain |
| `FB_PROJECT_ID` | seu projectId |
| `FB_STORAGE_BUCKET` | seu storageBucket |
| `FB_MSG_SENDER_ID` | seu messagingSenderId |
| `FB_APP_ID` | seu appId |

(Assim a chave não fica no GitHub — o build gera o `web/firebase-config.js` na hora.)

### Passo 3 — Gerar o app Android (grátis, agora)
1. No Codemagic, rode o workflow **"Bolão Flex · Android (APK)"**.
2. Ao terminar (uns 5–10 min), ele **envia o `.apk` no seu e-mail** e deixa pra baixar.
3. No celular Android: abra o `.apk` e instale (talvez precise permitir "instalar de fontes desconhecidas"). Pronto — app na tela. 🎉

### Passo 4 — Gerar o app iPhone (precisa de conta Apple)
Para iOS, a **Apple exige** uma conta de **Apple Developer (US$ 99/ano)** — é regra da Apple, não do Codemagic. Depois de ter a conta:
1. No Codemagic, configure o **code signing** (certificado + provisioning) — o próprio Codemagic tem um assistente que integra com a Apple.
2. Rode o workflow **"Bolão Flex · iOS (IPA)"** para gerar o `.ipa` (dá pra mandar pro seu iPhone via TestFlight ou instalar direto).

### Custos, resumido
| Item | Custo |
|---|---|
| Codemagic (build na nuvem) | Grátis até 500 min/mês |
| APK Android (instalar direto) | **Grátis** |
| Publicar na Play Store | US$ 25 (uma vez) |
| App iPhone / TestFlight / App Store | US$ 99/ano (Apple) |

> **Recomendação:** comece pelo **Android APK** (grátis, funciona hoje). Deixe o iPhone para quando decidir investir na conta Apple. E, enquanto isso, no iPhone dá pra usar a **versão web como PWA** ("Adicionar à tela de início") sem custo nenhum.

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
9. [Passo 5B — Dados REAIS da API esportiva](#-passo-5b--dados-reais-da-api-esportiva-football-dataorg)
10. [Passo 6 — Cloud Functions (pontuação + sincronização)](#-passo-6--cloud-functions-pontuação-automática)
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
- **Dados esportivos reais** (football-data.org): jogos, escudos, datas e **placares ao vivo**, com a tela atualizando sozinha.
- **Cloud Functions**: pontuação ao fim de cada jogo, push no feed e sincronização da API esportiva.
- **Regras de segurança** do Firestore e Storage por papel.

O que **ainda não** está implementado (próximas fases): liga por rodadas detalhada e pontuação automática da copa/longo prazo. A estrutura já está pronta para receber tudo isso.

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

## 🔐 Passo 4 — Regras de segurança (OBRIGATÓRIO)

As regras impedem que alguém leia/escreva dados que não deveria. **Sem publicá-las, o app dá o erro "Missing or insufficient permissions"** (o banco em modo de produção bloqueia tudo por padrão).

> O app foi feito para **não exigir índices compostos** — então você só precisa publicar as **regras**. Os índices são opcionais.

**Jeito A — pelo site (mais simples):**
1. [Console do Firebase](https://console.firebase.google.com) → **Firestore Database** → aba **Regras**.
2. Apague o conteúdo e **cole todo o arquivo `firestore.rules`** do projeto.
3. Clique em **Publicar**.

**Jeito B — pela CLI (também publica Storage e índices):**
```bash
firebase login
firebase use --add        # escolha o projeto bolao-flex
firebase deploy --only firestore:rules,storage
```

> Sempre que eu atualizar o `firestore.rules`, você precisa **publicar de novo** (repita este passo).

---

## 👑 Passo 5 (recomendado) — Cadastrar competições pelo painel do admin

Este é o jeito **mais fácil** de ter competições para criar bolões: tudo pelo app, sem token, sem script, sem plano pago.

### Primeiro, vire admin (uma vez)
1. No [Console do Firebase](https://console.firebase.google.com) → **Firestore Database** → coleção **users** → abra o **seu** documento (o id é o seu user; se tiver dúvida, é o que tem o seu e-mail).
2. Clique em **Adicionar campo**: nome `isSystemAdmin`, tipo **boolean**, valor **true**. Salve.
3. No app, **saia e entre de novo** (ou feche e reabra) para ele reconhecer o admin.

### Depois, cadastre competições
No app: **Perfil → Abrir painel do admin**. Lá você pode:
- **Importar competição completa** (football-data.org): traz a **temporada inteira** de ~13 competições confiáveis — Brasileirão, Libertadores, Champions, Premier League, La Liga, etc. Precisa de um **token grátis** (veja abaixo).
- **Importar liga sem token** (TheSportsDB): traz ~30 jogos recentes/próximos. Bom para começar rápido, sem cadastro.
- **Criar uma competição na mão** e **adicionar os jogos um a um** — para o que não estiver nas fontes.
- **Lançar o placar** de um jogo e **encerrar** — isso dispara o cálculo da pontuação dos bolões.

#### Token grátis da football-data.org (recomendado)
1. Registre-se em https://www.football-data.org/client/register e copie o token que chega por e-mail.
2. No arquivo `.env`, preencha: `EXPO_PUBLIC_FOOTBALL_DATA_TOKEN=seu_token`
3. Reinicie com `npx expo start -c`. Agora os botões de competição completa aparecem no painel.

> Cada competição cadastra todos os jogos da temporada de uma vez. Pode importar quantas quiser e ter **várias competições** disponíveis para os bolões.

Pronto: a competição passa a aparecer no **wizard de criar bolão**.

> As alternativas abaixo (dados de exemplo, football-data.org) continuam válidas, mas o painel do admin costuma ser o caminho mais simples.

---

## 🌱 Passo 5-alt — Dados de exemplo (competição e jogos)

> Você tem **duas opções** para ter jogos no app: (A) dados de exemplo, offline — bom para testar rápido; ou (B) **dados reais** de um campeonato de verdade, via API gratuita (Passo 5B abaixo). Pode começar pelo exemplo e depois trocar pelos dados reais.

Para palpitar, o app precisa de uma competição e alguns jogos. Como esses dados só podem ser escritos pelo back-end (por segurança), usamos um script com permissão de administrador.

1. No Console: ⚙️ **Configurações do projeto** → aba **Contas de serviço** → **Gerar nova chave privada**. Baixe o arquivo JSON.
2. Renomeie/salve esse arquivo como **`serviceAccountKey.json`** na raiz do projeto.
   ⚠️ **Esse arquivo é secreto.** Já está no `.gitignore` — nunca suba para o GitHub.
3. Instale a dependência usada pelos scripts e rode:
   ```bash
   npm install firebase-admin
   node scripts/seed.mjs
   ```
4. Pronto: o script cria uma competição **"Brasileirão Exemplo 2026"** com 5 jogos (um já finalizado, para testar a pontuação, e quatro futuros para palpitar).

---

## 🌐 Passo 5B — Dados REAIS da API esportiva (football-data.org)

Aqui o app passa a usar jogos, escudos, datas e **placares de verdade**, com atualização **ao vivo**. Usamos a **football-data.org** porque é gratuita (token sem cartão) e inclui o **Brasileirão Série A** no plano grátis.

> **Como funciona (e por que é seguro):** a chave da API **nunca** vai para o app. Quem fala com a API é o back-end, que grava os jogos no Firestore. O app só **lê** do Firestore — e em tempo real, então o placar atualiza sozinho na tela. (PRD seções 16 e 23.)

### 1. Pegue um token grátis
- Registre-se em https://www.football-data.org/client/register
- Você recebe um **token** por e-mail. Guarde-o.

### 2. Jeito mais simples (sem plano Blaze): rodar o script
Com o `serviceAccountKey.json` na raiz (mesmo do Passo 5), rode:
```bash
FOOTBALL_DATA_TOKEN=seu_token node scripts/sync-api.mjs BSA
```
- `BSA` = Brasileirão Série A. Outros códigos grátis: `PL` (Premier League), `PD` (La Liga), `SA` (Itália), `BL1` (Alemanha), `FL1` (França), `CL` (Champions), `PPL` (Portugal).
- O script cria a competição real e todos os jogos da temporada no Firestore. Rode de novo quando quiser atualizar os placares.

Agora, ao criar um bolão, a competição real aparece na lista do wizard. 🎉

### 3. Atualização automática e ao vivo (opcional, exige Blaze)
Para os placares atualizarem sozinhos a cada 15 minutos (sem rodar o script na mão), use a Cloud Function agendada:
```bash
# guarda o token como "secret" do Firebase (não fica no código)
firebase functions:secrets:set FOOTBALL_DATA_TOKEN
# digite o token quando pedir

firebase deploy --only functions
```
- A função `scheduledSyncMatches` roda a cada 15 min e ressincroniza as competições listadas em `config/sync` (o script já adiciona o código lá automaticamente).
- Quando um jogo termina, a função `onMatchFinished` recalcula a pontuação e os rankings sozinha.
- Agendamento exige o plano **Blaze** e a API **Cloud Scheduler** ativa (o deploy avisa se faltar).

> **Limite do plano grátis da API:** ~10 requisições por minuto. A sincronização a cada 15 min fica bem dentro disso.

---

## 🧮 Passo 6 — Cloud Functions (pontuação automática)

As Cloud Functions cuidam do que precisa rodar no servidor:
- **`onMatchFinished`** — recalcula a pontuação e os rankings quando um jogo termina.
- **`onFeedPostCreated`** — envia notificação (push + in-app) quando há aviso no feed.
- **`scheduledSyncMatches`** + **`syncCompetitionNow`** — sincronizam os jogos reais da API esportiva (Passo 5B).

1. Instale as dependências das functions:
   ```bash
   cd functions
   npm install
   cd ..
   ```
2. (Se for usar a API) guarde o token da API como secret:
   ```bash
   firebase functions:secrets:set FOOTBALL_DATA_TOKEN
   ```
3. Faça o deploy:
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

**`Cannot find module 'babel-preset-expo'` ao rodar `npx expo start`.**
A árvore de dependências ficou inconsistente. Resolva assim (na pasta do projeto):
```bash
# Windows (PowerShell):
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install

# Mac/Linux:
rm -rf node_modules package-lock.json
npm install
```
Depois rode `npx expo start -c` de novo. (Atalho, se não quiser apagar tudo: `npm install babel-preset-expo`.)

**Quero mudar as cores/identidade.**
Edite `src/theme/colors.ts`. Tudo no app puxa as cores de lá.

---

Feito com 💛 e ⚽. Bons palpites!
