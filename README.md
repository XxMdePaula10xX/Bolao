# ⚽ Bolão da Copa

App **web** (roda em celular e PC) para digitalizar o nosso bolão de Copa do Mundo — com as
regras **fixas** do nosso regulamento e as **5 disputas**: Ranking Geral, Liga, Copa,
Copa da Consolação e Longo Prazo.

**Stack:** React + Vite + TypeScript · Firebase (Auth, Firestore, Cloud Functions) · React Router · TanStack Query · Zustand.

> Reconstruído do zero, web-first. O trabalho anterior está no histórico do Git (tag `arquivo-v1`).

---

## ✅ O que já está pronto (fundação)

- **Motor de pontuação** com as regras fixas (3 / 1 / 0 + bônus de pênalti → escala 0–4),
  já **testado** (`npm test`, 9/9 passando). É o coração do bolão.
- **Autenticação** por e-mail/senha (cadastro, login, recuperar senha) + auto-cura de perfil.
- **Tema dark premium** com os tokens do PRD (dourado, verde, azul, roxo, vermelho).
- **Navegação** por abas (Home, Palpites, Bolão, Perfil) + regulamento fixo publicado.
- **Modelo de dados** (Firestore) modelado para as 5 disputas desde o início.

Próximos passos: criar a edição da Copa, puxar os jogos reais, palpites jogo a jogo (com o
campo de pênaltis no mata-mata), Ranking Geral e Liga — depois Copa, Consolação, Longo Prazo,
estatísticas, chances (Monte Carlo), premiação automática e as artes.

---

## 🚀 Como rodar (passo a passo)

### 1. Pré-requisitos
- **Node.js 20+** (https://nodejs.org)

### 2. Instalar
```bash
npm install
```

### 3. Configurar o Firebase
- Crie um projeto em https://console.firebase.google.com
- Ative **Authentication → E-mail/senha** e **Firestore Database** (modo produção).
- Config. do projeto → app **Web** → copie o `firebaseConfig`.
- No projeto:
  ```bash
  cp .env.example .env
  ```
  e preencha o `.env` com os valores.

### 4. Rodar
```bash
npm run dev
```
Abra o endereço que aparecer (ex: `http://localhost:5173`). No celular, na mesma rede, use o
endereço "Network" que o Vite mostra.

### 5. Testar o motor de pontuação
```bash
npm test
```

---

## 📦 Scripts
| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o app em desenvolvimento |
| `npm run build` | Gera o site pronto para publicar (pasta `dist/`) |
| `npm run preview` | Testa o build localmente |
| `npm run typecheck` | Confere os tipos |
| `npm test` | Roda os testes do motor de pontuação |

## 🌐 Publicar (depois)
O build (`npm run build`) gera a pasta `dist/`, que pode ir para **Firebase Hosting**,
Netlify, Vercel ou Cloudflare Pages — todos com plano grátis. Detalhamos quando chegar a hora.

---

## 🗂 Estrutura
```
src/
├── main.tsx / App.tsx      # entrada + rotas (com guarda de login)
├── index.css               # design tokens (tema) + estilos base
├── types/                  # modelo de dados (Firestore)
├── lib/scoring.ts          # ⭐ motor de pontuação (testado)
├── services/               # firebase, auth
├── store/                  # estado global (Zustand)
├── components/             # Logo, AppLayout, UI
└── pages/                  # Login, Register, Home, Palpites, Bolão, Perfil
```
