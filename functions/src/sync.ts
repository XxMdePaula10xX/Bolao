/**
 * Integração com a API esportiva real (football-data.org).
 *
 * Estratégia (PRD seções 16 e 23): a CHAVE da API nunca vai para o app.
 * Uma Cloud Function chama a API e grava os jogos/placares no Firestore;
 * o app apenas LÊ do Firestore (em tempo real). Isso protege a chave,
 * controla o cache e reduz custo.
 *
 * Por que football-data.org? É gratuita (token sem cartão), e o
 * Brasileirão Série A (código BSA) está no plano grátis, além de
 * Champions, Premier League, La Liga, etc. Limite: ~10 req/min.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { db, admin } from './firebaseAdmin';

// O token é um "secret" do Firebase, definido fora do código:
//   firebase functions:secrets:set FOOTBALL_DATA_TOKEN
const FOOTBALL_DATA_TOKEN = defineSecret('FOOTBALL_DATA_TOKEN');

const PROVIDER = 'football-data';
const API_BASE = 'https://api.football-data.org/v4';

/** Converte o status da API para o nosso modelo de Match. */
function mapStatus(s: string): string {
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

/** Normaliza um time da API para o formato usado no app. */
function mapTeam(t: any) {
  return {
    id: t?.id != null ? String(t.id) : 'tbd',
    name: t?.name ?? 'A definir',
    shortName: t?.tla ?? t?.shortName ?? '',
    crestUrl: t?.crest ?? null,
  };
}

/**
 * Busca os jogos de uma competição na API e grava (upsert) a
 * competição e todos os jogos no Firestore. Retorna um resumo.
 *
 * Esta função é reutilizada pela função agendada e pela callable.
 */
export async function syncCompetitionMatches(
  code: string,
  token: string
): Promise<{ competitionId: string; matches: number }> {
  const res = await fetch(`${API_BASE}/competitions/${encodeURIComponent(code)}/matches`, {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const comp = data.competition ?? {};
  const competitionId = `fd-${code.toLowerCase()}`;
  const firstSeason = data.matches?.[0]?.season;
  const season = firstSeason?.startDate ? String(firstSeason.startDate).slice(0, 4) : '';

  // Upsert da competição.
  await db.doc(`competitions/${competitionId}`).set(
    {
      id: competitionId,
      sportType: 'football',
      name: comp.name ?? code,
      season,
      status: 'ongoing',
      sourceProvider: PROVIDER,
      logoUrl: comp.emblem ?? null,
      metadata: { code, area: comp.area?.name ?? null },
      lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Upsert dos jogos em lotes (limite de 500 escritas por batch).
  const matches: any[] = data.matches ?? [];
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
          startTime: admin.firestore.Timestamp.fromDate(new Date(m.utcDate)),
          status: mapStatus(m.status),
          homeScore: m.score?.fullTime?.home ?? null,
          awayScore: m.score?.fullTime?.away ?? null,
          stage: m.stage ?? null,
          round: m.matchday ?? null,
          group: m.group ?? null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      written++;
    }
    await batch.commit();
  }

  logger.info(`Sync ${code}: ${written} jogos gravados em ${competitionId}.`);
  return { competitionId, matches: written };
}

/**
 * Callable para o ADMIN forçar a sincronização de uma competição agora.
 * Ex.: chamar com { code: 'BSA' } a partir de um script ou tela admin.
 */
export const syncCompetitionNow = onCall(
  { secrets: [FOOTBALL_DATA_TOKEN] },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Faça login.');
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.data()?.isSystemAdmin) {
      throw new HttpsError('permission-denied', 'Apenas admin do sistema.');
    }
    const code = (req.data?.code as string | undefined)?.trim();
    if (!code) throw new HttpsError('invalid-argument', 'Informe o código (ex.: BSA).');

    const result = await syncCompetitionMatches(code, FOOTBALL_DATA_TOKEN.value());

    // Passa a acompanhar essa competição nas próximas sincronizações.
    await db.doc('config/sync').set(
      { competitionCodes: admin.firestore.FieldValue.arrayUnion(code.toUpperCase()) },
      { merge: true }
    );
    return result;
  }
);

/**
 * Função agendada: a cada 15 minutos, ressincroniza as competições
 * listadas em config/sync.competitionCodes. Mantém placares e status
 * atualizados; quando um jogo vira "finished", o gatilho onMatchFinished
 * recalcula a pontuação automaticamente.
 *
 * OBS: agendamento exige o plano Blaze e a API Cloud Scheduler ativa.
 */
export const scheduledSyncMatches = onSchedule(
  { schedule: 'every 15 minutes', secrets: [FOOTBALL_DATA_TOKEN] },
  async () => {
    const cfg = await db.doc('config/sync').get();
    const codes: string[] = cfg.data()?.competitionCodes ?? [];
    if (codes.length === 0) {
      logger.info('Nenhuma competição configurada em config/sync.');
      return;
    }
    const token = FOOTBALL_DATA_TOKEN.value();
    for (const code of codes) {
      try {
        await syncCompetitionMatches(code, token);
      } catch (e) {
        logger.error(`Sync ${code} falhou`, e);
      }
    }
  }
);
