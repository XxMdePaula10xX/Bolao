/* Camada de acesso ao Firebase para a versão WEB do Bolão Flex.
   Usa o SDK do Firebase direto do CDN (sem build/npm). Lê e escreve
   nas MESMAS coleções do app React Native — os dados são compartilhados. */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, limit,
  getDocs, onSnapshot, serverTimestamp, writeBatch, increment,
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

import { firebaseConfig } from '../firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* ---------------- helpers ---------------- */
export function toDate(v){
  if(!v) return null;
  if(typeof v === 'number') return new Date(v);
  if(v.toDate) return v.toDate();
  if(v.seconds) return new Date(v.seconds*1000);
  return null;
}
function slugify(t){return (t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)+/g,'').slice(0,50)}
export function inviteCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s}
export function initials(n){const p=(n||'?').trim().split(/\s+/);return (p.length===1?p[0].slice(0,2):p[0][0]+p[p.length-1][0]).toUpperCase()}

/* ---------------- auth ---------------- */
export function watchAuth(cb){ return onAuthStateChanged(auth, cb); }

export async function register(name, email, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db,'users',cred.user.uid), {
    id:cred.user.uid, name, email, avatarUrl:null, createdAt:serverTimestamp(),
    isSystemAdmin:false, stats:{poolsCreated:0,poolsJoined:0,totalPoints:0},
  }, {merge:true});
  return cred.user;
}
export async function login(email, password){ return (await signInWithEmailAndPassword(auth,email,password)).user; }
export async function logout(){ return signOut(auth); }
export async function resetPassword(email){ return sendPasswordResetEmail(auth, email); }

export async function ensureProfile(user){
  const ref = doc(db,'users',user.uid);
  const snap = await getDoc(ref);
  if(snap.exists()) return snap.data();
  const p = { id:user.uid, name:user.displayName||(user.email||'').split('@')[0]||'Palpiteiro',
    email:user.email||'', avatarUrl:null, createdAt:serverTimestamp(), isSystemAdmin:false,
    stats:{poolsCreated:0,poolsJoined:0,totalPoints:0} };
  await setDoc(ref, p, {merge:true});
  return (await getDoc(ref)).data();
}

export function authErrorMessage(e){
  const map={
    'auth/invalid-email':'E-mail inválido.','auth/user-not-found':'Conta não encontrada.',
    'auth/wrong-password':'Senha incorreta.','auth/invalid-credential':'E-mail ou senha incorretos.',
    'auth/email-already-in-use':'Este e-mail já está cadastrado.','auth/weak-password':'A senha precisa ter ao menos 6 caracteres.',
    'auth/too-many-requests':'Muitas tentativas. Tente mais tarde.','auth/network-request-failed':'Falha de conexão.',
  };
  return map[e?.code] || 'Algo deu errado. Tente novamente.';
}

/* ---------------- competições / jogos ---------------- */
export async function listCompetitions(){
  const s = await getDocs(collection(db,'competitions'));
  return s.docs.map(d=>d.data());
}
export function subscribeMatches(competitionId, cb, onErr){
  const q = query(collection(db,'matches'), where('competitionId','==',competitionId));
  return onSnapshot(q, s=>{
    const list = s.docs.map(d=>d.data()).sort((a,b)=>(toDate(a.startTime)?.getTime()||0)-(toDate(b.startTime)?.getTime()||0));
    cb(list);
  }, onErr);
}
export async function listMatches(competitionId){
  const q = query(collection(db,'matches'), where('competitionId','==',competitionId));
  const s = await getDocs(q);
  return s.docs.map(d=>d.data()).sort((a,b)=>(toDate(a.startTime)?.getTime()||0)-(toDate(b.startTime)?.getTime()||0));
}

/* ---------------- bolões ---------------- */
export async function listMyPools(uid){
  const q = query(collection(db,'poolMembers'), where('userId','==',uid), where('status','==','active'));
  const ms = await getDocs(q);
  const ids = ms.docs.map(d=>d.data().poolId);
  if(!ids.length) return [];
  const results = await Promise.all(ids.map(id=>getDoc(doc(db,'pools',id))));
  return results.filter(s=>s.exists()).map(s=>s.data());
}
export async function listPublicPools(){
  const s = await getDocs(query(collection(db,'pools'), where('isPublic','==',true), limit(50)));
  return s.docs.map(d=>d.data()).sort((a,b)=>(toDate(b.createdAt)?.getTime()||0)-(toDate(a.createdAt)?.getTime()||0));
}
export async function listOfficialPools(){
  const s = await getDocs(query(collection(db,'pools'), where('createdByAdmin','==',true), limit(20)));
  return s.docs.map(d=>d.data()).sort((a,b)=>(toDate(b.createdAt)?.getTime()||0)-(toDate(a.createdAt)?.getTime()||0));
}
export async function getPool(id){ const s=await getDoc(doc(db,'pools',id)); return s.exists()?s.data():null; }
export async function findPoolByInvite(code){
  const s = await getDocs(query(collection(db,'pools'), where('inviteCode','==',code.toUpperCase()), limit(1)));
  return s.empty ? null : s.docs[0].data();
}

export async function createPool(owner, input){
  const ref = doc(collection(db,'pools'));
  const code = inviteCode();
  const pool = {
    id:ref.id, ownerId:owner.id, name:input.name, slug:`${slugify(input.name)}-${code.toLowerCase()}`,
    description:input.description||'', isPublic:!!input.isPublic, inviteCode:code, coverImageUrl:null,
    competitionId:input.competitionId, competitionName:input.competitionName||'', status:'open', rulesVersion:1,
    settings:input.settings, prize:input.prize||'', maxParticipants:null, memberCount:1,
    createdByAdmin:!!owner.isSystemAdmin, createdAt:serverTimestamp(),
  };
  const mref = doc(db,'poolMembers',`${ref.id}_${owner.id}`);
  const member = { id:`${ref.id}_${owner.id}`, poolId:ref.id, userId:owner.id, userName:owner.name,
    userAvatarUrl:null, role:'owner', status:'active', joinedAt:serverTimestamp(), totalPoints:0, exactHits:0, winnerHits:0 };
  const batch = writeBatch(db);
  batch.set(ref,pool); batch.set(mref,member);
  batch.set(doc(db,'users',owner.id), {stats:{poolsCreated:increment(1)}}, {merge:true});
  await batch.commit();
  return pool;
}
export async function joinPool(pool, user){
  const mref = doc(db,'poolMembers',`${pool.id}_${user.id}`);
  const ex = await getDoc(mref);
  if(ex.exists() && ex.data().status==='active') return;
  const member = { id:`${pool.id}_${user.id}`, poolId:pool.id, userId:user.id, userName:user.name,
    userAvatarUrl:null, role:'member', status:'active', joinedAt:serverTimestamp(), totalPoints:0, exactHits:0, winnerHits:0 };
  const batch = writeBatch(db);
  batch.set(mref,member);
  batch.update(doc(db,'pools',pool.id), {memberCount:increment(1)});
  batch.set(doc(db,'users',user.id), {stats:{poolsJoined:increment(1)}}, {merge:true});
  await batch.commit();
}
export async function listPoolMembers(poolId){
  const s = await getDocs(query(collection(db,'poolMembers'), where('poolId','==',poolId), where('status','==','active')));
  return s.docs.map(d=>d.data()).sort((a,b)=>(b.totalPoints||0)-(a.totalPoints||0));
}

/* ---------------- palpites ---------------- */
export async function listUserPredictions(poolId, uid){
  const s = await getDocs(query(collection(db,'predictions'), where('poolId','==',poolId), where('userId','==',uid)));
  return s.docs.map(d=>d.data());
}
export async function submitPredictions(poolId, uid, drafts, matchesById){
  const batch = writeBatch(db); let saved=0, skipped=0; const now=Date.now();
  for(const d of drafts){
    const m = matchesById[d.matchId];
    const start = toDate(m?.startTime)?.getTime() || 0;
    const locked = (m?.status && m.status!=='scheduled') || (start>0 && start<=now);
    if(locked || d.predictedHome===''||d.predictedAway===''||d.predictedHome==null||d.predictedAway==null){skipped++;continue;}
    const id = `${poolId}_${uid}_${d.matchId}`;
    batch.set(doc(db,'predictions',id), {
      id, poolId, userId:uid, matchId:d.matchId,
      predictedHome:Number(d.predictedHome), predictedAway:Number(d.predictedAway),
      predictedQualifiedTeamId:null, submittedAt:serverTimestamp(), pointsAwarded:null,
    }, {merge:true});
    saved++;
  }
  if(saved) await batch.commit();
  return {saved, skipped};
}

/* ---------------- pontuação (prévia no cliente) ---------------- */
export function calcPoints(pred, actualH, actualA, rules){
  if(pred.predictedHome===actualH && pred.predictedAway===actualA) return rules.exactScorePoints;
  const sign=x=>x>0?1:x<0?-1:0;
  const ar=sign(actualH-actualA), pr=sign(pred.predictedHome-pred.predictedAway);
  if(ar===pr) return ar===0?rules.drawPoints:rules.winnerPoints;
  return 0;
}
