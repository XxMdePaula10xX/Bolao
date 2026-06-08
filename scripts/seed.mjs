/**
 * Script para popular o Firestore com dados de exemplo:
 *  - 1 competição (Brasileirão Exemplo 2026)
 *  - alguns jogos (uns no futuro para palpitar, um já finalizado)
 *
 * COMO USAR (veja detalhes no README, seção "Dados de exemplo"):
 *  1. No Console do Firebase > Configurações do projeto > Contas de
 *     serviço > "Gerar nova chave privada". Baixe o JSON.
 *  2. Salve esse arquivo como  serviceAccountKey.json  na raiz do projeto.
 *     (Ele já está no .gitignore — NUNCA suba isso pro GitHub.)
 *  3. Rode:  node scripts/seed.mjs
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const COMP_ID = 'brasileirao-2026';

function team(id, name, shortName) {
  return { id, name, shortName, crestUrl: null };
}

const teams = {
  fla: team('fla', 'Flamengo', 'FLA'),
  pal: team('pal', 'Palmeiras', 'PAL'),
  cor: team('cor', 'Corinthians', 'COR'),
  sao: team('sao', 'São Paulo', 'SAO'),
  gre: team('gre', 'Grêmio', 'GRE'),
  int: team('int', 'Internacional', 'INT'),
};

function hoursFromNow(h) {
  return Timestamp.fromMillis(Date.now() + h * 60 * 60 * 1000);
}

const matches = [
  // Jogo já finalizado (para testar a pontuação automática)
  {
    id: 'm1',
    home: teams.fla,
    away: teams.pal,
    startTime: hoursFromNow(-48),
    status: 'finished',
    homeScore: 2,
    awayScore: 1,
    round: 1,
  },
  // Jogos futuros (abertos para palpite)
  { id: 'm2', home: teams.cor, away: teams.sao, startTime: hoursFromNow(24), status: 'scheduled', homeScore: null, awayScore: null, round: 2 },
  { id: 'm3', home: teams.gre, away: teams.int, startTime: hoursFromNow(26), status: 'scheduled', homeScore: null, awayScore: null, round: 2 },
  { id: 'm4', home: teams.fla, away: teams.cor, startTime: hoursFromNow(48), status: 'scheduled', homeScore: null, awayScore: null, round: 2 },
  { id: 'm5', home: teams.pal, away: teams.sao, startTime: hoursFromNow(50), status: 'scheduled', homeScore: null, awayScore: null, round: 2 },
];

async function seed() {
  console.log('Criando competição...');
  await db.doc(`competitions/${COMP_ID}`).set({
    id: COMP_ID,
    sportType: 'football',
    name: 'Brasileirão Exemplo 2026',
    season: '2026',
    status: 'ongoing',
    sourceProvider: 'seed',
    logoUrl: null,
    metadata: {},
  });

  console.log('Criando jogos...');
  for (const m of matches) {
    await db.doc(`matches/${m.id}`).set({
      id: m.id,
      competitionId: COMP_ID,
      externalId: m.id,
      homeTeam: m.home,
      awayTeam: m.away,
      startTime: m.startTime,
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      stage: 'group',
      round: m.round,
      group: null,
      lastSyncedAt: Timestamp.now(),
    });
  }

  console.log('✅ Pronto! Competição e', matches.length, 'jogos criados.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Erro no seed:', e);
  process.exit(1);
});
