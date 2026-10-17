// Nuvem da Roça Feliz: login com Google e dados no Firebase (Firestore).
// Só liga quando firebase-config.js tem uma configuração. Sem ela, o jogo fica offline.
(() => {
  'use strict';
  const cfg = window.FIREBASE_CONFIG;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const available = !!(cfg && cfg.apiKey && cfg.projectId);
  let auth = null, db = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = () => reject(new Error('Não carregou ' + src));
      document.head.appendChild(s);
    });
  }

  async function init(onUser) {
    if (!available) return false;
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-firestore-compat.js');
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged(u => onUser(u ? { uid: u.uid, name: u.displayName || '', photo: u.photoURL || '' } : null));
    return true;
  }

  // Realtime Database (Praça da Vila): carrega só quando alguém entra na praça.
  let rt = null;
  async function rtInit() {
    if (rt) return rt;
    if (!available || !cfg.databaseURL) throw new Error('sem databaseURL');
    await loadScript(SDK + 'firebase-database-compat.js');
    rt = firebase.database();
    return rt;
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      // Alguns celulares bloqueiam popup: cai para o redirecionamento.
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        await auth.signInWithRedirect(provider);
      } else throw e;
    }
  }
  const signOut = () => auth.signOut();

  const farm = uid => db.collection('farms').doc(uid);

  async function loadFarm(uid) {
    const d = await farm(uid).get();
    return d.exists ? d.data() : null;
  }
  const saveFarm = (uid, data) => farm(uid).set(data);
  // Salva só se a nuvem ainda estiver na versão (rev) em que esta roça se baseou. Se outro aparelho
  // (ou um save antigo) gravou no meio, NÃO grava por cima: devolve erro 'conflito'.
  async function saveFarmSeguro(uid, data, baseRev) {
    const ref = farm(uid);
    return db.runTransaction(async tx => {
      const d = await tx.get(ref), atual = d.exists ? (d.data().rev || 0) : 0;
      // outro aparelho entrou depois deste: este não grava e sai (sem ficar ouvindo o documento o tempo todo)
      const sess = d.exists && d.data().session, minha = data.session;
      if (sess && minha && sess.id !== minha.id && (sess.at || 0) > (minha.at || 0)) { const e = new Error('outro aparelho'); e.code = 'outroAparelho'; e.session = sess; throw e; }
      if (atual !== baseRev) { const e = new Error('conflito'); e.code = 'conflito'; e.rev = atual; throw e; }
      tx.set(ref, Object.assign({}, data, { rev: baseRev + 1 }));
      return baseRev + 1;
    });
  }
  // Cópias de segurança diárias: farms/{uid}/backups/{AAAA-MM-DD}.
  const salvarBackup = (uid, dia, data) => farm(uid).collection('backups').doc(dia).set(data);
  async function listarBackups(uid) {
    const qs = await farm(uid).collection('backups').get();
    return qs.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => (a.id < b.id ? 1 : -1));
  }
  const apagarBackup = (uid, dia) => farm(uid).collection('backups').doc(dia).delete();
  // Sessão: qual aparelho está jogando agora. Entrar num aparelho novo tira o anterior.
  const claimSession = (uid, session) => farm(uid).set({ session }, { merge: true });
  const watchFarm = (uid, cb) => farm(uid).onSnapshot(d => cb(d.exists ? d.data() : null), e => console.warn('roça:', e));
  // Confere (1 leitura) se outro aparelho entrou nesta conta.
  async function sessaoAtual(uid) { const d = await farm(uid).get(); return d.exists ? d.data().session || null : null; }

  // Código de amigo: 6 letras/números, fácil de ditar (sem 0/O, 1/I/L).
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  async function claimCode(uid) {
    for (let tries = 0; tries < 8; tries++) {
      let code = '';
      for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      const ref = db.collection('codes').doc(code);
      const d = await ref.get();
      if (!d.exists) { await ref.set({ uid }); return code; }
    }
    throw new Error('Não consegui gerar um código de amigo');
  }
  function normalizeCode(code) { return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  async function findCode(code) {
    code = normalizeCode(code);
    if (code.length !== 6) return null;
    const d = await db.collection('codes').doc(code).get();
    return d.exists ? d.data().uid : null;
  }

  // Visitas: o que um amigo fez na sua roça (ajudou, alimentou, pegou colheita).
  // O dono aplica e apaga quando abre o jogo.
  const sendVisit = (toUid, visit) => farm(toUid).collection('visits').add(visit);
  function watchVisits(uid, cb) {
    return farm(uid).collection('visits').onSnapshot(qs => {
      const list = qs.docs.map(d => ({ id: d.id, data: d.data() }));
      if (list.length) cb(list);
    }, e => console.warn('visitas:', e));
  }
  const deleteVisit = (uid, id) => farm(uid).collection('visits').doc(id).delete();

  // Pedidos de amizade: farms/{destino}/requests/{quemPediu}.
  const requestRef = (toUid, fromUid) => farm(toUid).collection('requests').doc(fromUid);
  const sendRequest = (toUid, data) => requestRef(toUid, data.from).set(data);
  const deleteRequest = (toUid, fromUid) => requestRef(toUid, fromUid).delete();
  async function requestExists(toUid, fromUid) { return (await requestRef(toUid, fromUid).get()).exists; }
  function watchRequests(uid, cb) {
    return farm(uid).collection('requests').onSnapshot(qs => {
      cb(qs.docs.map(d => ({ id: d.id, data: d.data() })));
    }, e => console.warn('pedidos:', e));
  }

  // Amizades guardadas à parte: farms/{dono}/amigos/{amigo}. Só mudam quando alguém vira amigo ou toca em
  // Excluir, nunca num salvamento comum. É a lista "oficial": se a lista dentro do save se perder, volta daqui.
  const amigoRef = (dono, amigo) => farm(dono).collection('amigos').doc(amigo);
  const addAmigo = (dono, amigo) => amigoRef(dono, amigo).set({ at: Date.now() });
  const removeAmigo = (dono, amigo) => amigoRef(dono, amigo).delete();
  async function listAmigos(dono) { return (await farm(dono).collection('amigos').get()).docs.map(d => d.id); }
  // O "amigo" ainda tem o "dono" como amigo? (pode ler porque é sobre si mesmo)
  async function ehAmigoDe(dono, amigo) { return (await amigoRef(dono, amigo).get()).exists; }

  // Notificações (Firebase Cloud Messaging). O aparelho guarda o "endereço" dele (token) em push/{uid},
  // junto com a agenda do que vai ficar pronto. Um programinha no GitHub lê isso e manda os avisos.
  let messagingOk = false;
  async function ativarPush(uid, vapidKey, reg) {
    if (!messagingOk) { await loadScript(SDK + 'firebase-messaging-compat.js'); messagingOk = true; }
    const token = await firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: reg });
    if (!token) throw new Error('sem token');
    await db.collection('push').doc(uid).set({ tokens: firebase.firestore.FieldValue.arrayUnion(token) }, { merge: true });
    return token;
  }
  async function desativarPush(uid, token) {
    if (token) await db.collection('push').doc(uid).set({ tokens: firebase.firestore.FieldValue.arrayRemove(token) }, { merge: true });
  }
  const salvarPush = (uid, data) => db.collection('push').doc(uid).set(data, { merge: true });
  // Aviso para outra pessoa (visita, presente, pedido de amizade). O programinha entrega e apaga.
  const mandarAviso = data => db.collection('avisos').add(data);

  // Chat entre amigos: cada um tem a sua caixa farms/{uid}/chat com as mensagens que mandou e recebeu.
  // Mandar grava nas duas caixas de uma vez (a do amigo e a sua).
  function enviarMsg(de, para, data) {
    const lote = db.batch(), msg = Object.assign({}, data, { de, para });
    lote.set(farm(para).collection('chat').doc(), msg);
    lote.set(farm(de).collection('chat').doc(), msg);
    return lote.commit();
  }
  function watchChat(uid, cb) {
    return farm(uid).collection('chat').orderBy('at').limitToLast(300).onSnapshot(
      qs => cb(qs.docs.map(d => Object.assign({ id: d.id }, d.data()))), e => console.warn('chat:', e));
  }
  const apagarMsg = (uid, id) => farm(uid).collection('chat').doc(id).delete();

  // Presença (online/offline): documento pequenininho presenca/{uid}, separado da roça.
  const marcarPresenca = (uid, online) => db.collection('presenca').doc(uid).set({ online: !!online, visto: Date.now() });
  function watchPresenca(uids, cb) {
    const unsubs = [];
    for (let i = 0; i < uids.length; i += 30) {
      const lote = uids.slice(i, i + 30);
      unsubs.push(db.collection('presenca').where(firebase.firestore.FieldPath.documentId(), 'in', lote)
        .onSnapshot(qs => qs.docs.forEach(d => cb(d.id, d.data())), e => console.warn('presença:', e)));
    }
    return () => unsubs.forEach(u => u());
  }

  // Ranking semanal: ranking/{uid} com os pontos da semana (e os da semana passada, para o prêmio).
  const salvarRanking = (uid, d) => db.collection('ranking').doc(uid).set(d);
  async function lerRanking(uids) {
    const out = {};
    for (let i = 0; i < uids.length; i += 30) {
      const lote = uids.slice(i, i + 30); if (!lote.length) continue;
      const qs = await db.collection('ranking').where(firebase.firestore.FieldPath.documentId(), 'in', lote).get();
      qs.docs.forEach(d => { out[d.id] = d.data(); });
    }
    return out;
  }
  // Ranking global: os jogadores com mais pontos de TODOS (não só amigos), ordenado por pts (índice padrão
  // do Firestore, sem precisar de índice composto). Pega um pouco mais que o pedido porque "pts" pode ser
  // de uma semana anterior (quem não abriu o jogo ainda esta semana) — o jogo filtra isso ao montar a lista.
  async function lerRankingGlobal(limite) {
    const out = {};
    const qs = await db.collection('ranking').orderBy('pts', 'desc').limit(limite || 100).get();
    qs.docs.forEach(d => { out[d.id] = d.data(); });
    return out;
  }

  window.RFCloud = {
    salvarRanking, lerRanking, lerRankingGlobal, sessaoAtual,
    marcarPresenca, watchPresenca,
    enviarMsg, watchChat, apagarMsg, rtInit,
    ativarPush, desativarPush, salvarPush, mandarAviso, saveFarmSeguro, salvarBackup, listarBackups, apagarBackup,
    available, init, signIn, signOut, loadFarm, saveFarm, claimSession, watchFarm, claimCode, findCode, normalizeCode,
    sendVisit, watchVisits, deleteVisit, sendRequest, deleteRequest, requestExists, watchRequests,
    addAmigo, removeAmigo, listAmigos, ehAmigoDe,
  };
})();
