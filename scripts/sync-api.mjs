/**
 * Sincroniza dados REAIS de uma competição (football-data.org) para o
 * Firestore — sem precisar do plano Blaze nem de Cloud Functions.
 *
 * É o jeito mais simples de começar com dados de verdade. Para
 * atualização automática contínua, depois use a Cloud Function
 * `scheduledSyncMatches` (veja o README).
 *
 * COMO USAR:
 *  1. Pegue um token grátis em https://www.football-data.org/client/register
 *  2. Tenha o serviceAccountKey.json na raiz (veja o README, seção seed).
 *  3. Rode (BSA = Brasileirão Série A):
 *       FOOTBALL_DATA_TOKEN=seu_token node scripts/sync-api.mjs BSA
 *
 *  Outros códigos grátis: PL (Premier), PD (La Liga), SA (Serie A),
 *  BL1 (Bundesliga), FL1 (Ligue 1), CL (Champions), PPL (Portugal).
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const token = process.env.FOOTBALL_DATA_TOKEN;
const code = (process.argv[2] || 'BSA').toUpperCase();

if (!token) {
  console.error('❌ Defina o token: FOOTBALL_DATA_TOKEN=seu_token node scripts/sync-api.mjs BSA');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function mapStatus(s) {
  switch (s) {
    case 'SCHEDULED':
    case 'TIMED':
      return 'scheduled';
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live';
    case 'FINISHED':
      return 'finished';
    case 'POSTPONED':
      return 'postponed';
    case 'SUSPENDED':
    case 'CANCELLED':
    case 'CANCELED':
      return 'canceled';
    default:
      return 'scheduled';
  }
}

function mapTeam(t) {
  return {
    id: t?.id != null ? String(t.id) : 'tbd',
    name: t?.name ?? 'A definir',
    shortName: t?.tla ?? t?.shortName ?? '',
    crestUrl: t?.crest ?? null,
  };
}

async function main() {
  console.log(`🔄 Buscando jogos de ${code} na football-data.org...`);
  const res = await fetch(`https://api.football-data.org/v4/competitions/${code}/matches`, {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`❌ API retornou ${res.status}: ${body.slice(0, 300)}`);
    process.exit(1);
  }
  const data = await res.json();
  const comp = data.competition ?? {};
  const competitionId = `fd-${code.toLowerCase()}`;
  const firstSeason = data.matches?.[0]?.season;
  const season = firstSeason?.startDate ? String(firstSeason.startDate).slice(0, 4) : '';

  await db.doc(`competitions/${competitionId}`).set(
    {
      id: competitionId,
      sportType: 'football',
      name: comp.name ?? code,
      season,
      status: 'ongoing',
      sourceProvider: 'football-data',
      logoUrl: comp.emblem ?? null,
      metadata: { code, area: comp.area?.name ?? null },
      lastSyncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const matches = data.matches ?? [];
  let written = 0;
  for (let i = 0; i < matches.length; i += 400) {
    const chunk = matches.slice(i, i + 400);
    const batch = db.batch();
    for (const m of chunk) {
      const id = `fd-${m.id}`;
      batch.set(
        db.doc(`matches/${id}`),
        {
          id,
          competitionId,
          externalId: String(m.id),
          homeTeam: mapTeam(m.homeTeam),
          awayTeam: mapTeam(m.awayTeam),
          startTime: Timestamp.fromDate(new Date(m.utcDate)),
          status: mapStatus(m.status),
          homeScore: m.score?.fullTime?.home ?? null,
          awayScore: m.score?.fullTime?.away ?? null,
          stage: m.stage ?? null,
          round: m.matchday ?? null,
          group: m.group ?? null,
          lastSyncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written++;
    }
    await batch.commit();
  }

  // Registra a competição para a função agendada acompanhar depois.
  await db.doc('config/sync').set(
    { competitionCodes: FieldValue.arrayUnion(code) },
    { merge: true }
  );

  console.log(`✅ ${comp.name ?? code}: ${written} jogos sincronizados (competição: ${competitionId}).`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
