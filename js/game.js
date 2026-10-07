(() => {
'use strict';

// ============================================================
// Dados do jogo
// ============================================================
// Mapa da roça: mesmo formato da área do rancho — a casa/celeiro ficam no meio, lá em cima, e a terra
// se abre pros dois lados e pra frente (u ∈ [-28, 44), v ∈ [-28, 36), igual ao rancho com a margem dele).
// A grade de canteiros guarda o índice a partir do canto (RU0, RV0) do mundo; o que fica atrás da linha
// do horizonte (u+v < 0) é céu e não vira canteiro.
const RU0 = -28, RV0 = -28, COLS = 72, ROWS = 64, N = COLS * ROWS;
const plotU = i => i % COLS + RU0, plotV = i => Math.floor(i / COLS) + RV0;
const plotAt = (u, v) => { const c = Math.floor(u) - RU0, r = Math.floor(v) - RV0; return c >= 0 && r >= 0 && c < COLS && r < ROWS ? r * COLS + c : -1; };
const plotCeu = i => plotU(i) + plotV(i) < 0; // célula atrás do horizonte (céu)
const START_LOTS = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]].map(([u, v]) => plotAt(u, v)); // os 6 canteiros iniciais, perto do celeiro
const ROOM = 5;
const HOUR = 3600, DAY = 86400e3; // HOUR em segundos (tempos de produção), DAY em milissegundos (idades)
const SAVE_KEY = 'roca-feliz-v3', OLD_SAVE_KEYS = ['roca-feliz-v2', 'roca-feliz-v1'], SETTINGS_KEY = 'roca-feliz-config';
const settings = Object.assign(
  { music: true, sfx: true, musicVol: 0.5, sfxVol: 0.7, track: 0, tema: 'auto' },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })(),
);
const Cloud = window.RFCloud || { available: false };

// Plantações. custo = semente de 1 canteiro; venda = quanto vale a colheita inteira do canteiro
// (sempre 1,6 × a semente), dividida em "rend" unidades.
const MIN = 60;
const CROP_LIST = [
  // id, nome, nível, semente, venda, tempo, XP, unidades, tipo, cores
  ['feijao',   'Feijão',         1,  10,   16,   2 * MIN,       2,  4,  'pendente', '#c9a86a', null, 'longo'],
  ['arroz',    'Arroz',          1,  15,   25,   3 * MIN,       2,  5,  'grao',     '#efdc9a'],
  ['cenoura',  'Cenoura',        1,  20,   32,   5 * MIN,       3,  4,  'raiz',     '#f08a24', '#e0761a'],
  ['trigo',    'Trigo',          2,  30,   48,   10 * MIN,      4,  6,  'grao',     '#e8c35a'],
  ['mandioca', 'Mandioca',       2,  150,  260,  8 * HOUR,      14, 6,  'raiz',     '#c9a06a', '#8a5a33'], // demorada: planta antes de dormir
  ['milho',    'Milho',          3,  50,   80,   20 * MIN,      5,  5,  'alto',     '#f7d046'],
  ['batata',   'Batata',         4,  80,   128,  30 * MIN,      6,  8,  'raiz',     '#c9a06a', '#a47a48'],
  ['tomate',   'Tomate',         5,  120,  192,  HOUR,          8,  8,  'moita',    '#e53b2f'],
  ['couve',    'Couve',          5,  100,  160,  45 * MIN,      7,  6,  'folha',    '#4f8a3f'],
  ['alface',   'Alface',         6,  150,  240,  1.5 * HOUR,    9,  6,  'folha',    '#8fd05a'],
  ['amendoim', 'Amendoim',       7,  180,  290,  2 * HOUR,      10, 8,  'raiz',     '#d9b27a', '#b8905a'],
  ['maxixe',   'Maxixe',         8,  220,  350,  2 * HOUR,      11, 8,  'chao',     '#8fbf4a', '#d8ecb8'],
  ['cebola',   'Cebola',         8,  200,  320,  2.5 * HOUR,    11, 8,  'raiz',     '#b8617e', '#e6c07a'],
  ['abobora',  'Abóbora',        9,  250,  400,  4 * HOUR,      12, 4,  'chao',     '#f28c1b', '#c9650a'],
  ['cana',     'Cana-de-açúcar', 11, 350,  560,  5 * HOUR,      14, 6,  'cana',     '#8a5a7a'],
  ['melancia', 'Melancia',       12, 400,  640,  6 * HOUR,      15, 4,  'chao',     '#4d9a3e', '#2a5e27'],
  ['pepino',   'Pepino',         13, 450,  720,  5 * HOUR,      15, 8,  'pendente', '#4f8f3a', null, 'longo'],
  ['pimentao', 'Pimentão',       14, 500,  800,  7 * HOUR,      16, 8,  'pendente', '#d8342a'],
  ['abacaxi',  'Abacaxi',        16, 700,  1120, 10 * HOUR,     20, 4,  'abacaxi',  '#e0a83a'],
  ['mamao',    'Mamão',          17, 800,  1280, 12 * HOUR,     20, 4,  'pendente', '#f39a3a'],
  ['soja',     'Soja',           20, 1100, 1760, 16 * HOUR,     25, 8,  'pendente', '#a8984a'],
  ['algodao',  'Algodão',        21, 1200, 1920, 18 * HOUR,     26, 10, 'moita',    '#ffffff'],
  ['limao',    'Limão',          23, 1400, 2240, 20 * HOUR,     27, 16, 'moita',    '#9ccf3a'],
  ['cafe',     'Café',           26, 1800, 2880, 24 * HOUR,     30, 16, 'moita',    '#c0302a', null, 'pequeno'],
  ['conde',    'Fruta-do-conde', 29, 2400, 3840, 32 * HOUR,     38, 6,  'pendente', '#8fbf6a', null, 'redondo'],
  ['maracuja', 'Maracujá',       30, 2500, 4000, 36 * HOUR,     40, 10, 'pendente', '#f2d03a', null, 'redondo'],
  ['cacau',    'Cacau',          32, 3200, 5120, 48 * HOUR,     44, 8,  'pendente', '#d4791e', '#7a4a2a', 'redondo'],
];
// (as árvores frutíferas saíram daqui: agora são frutíferas do Pomar, plantadas no gramado, fora dos canteiros)
const CROPS = [
  ...CROP_LIST.map(([id, nome, nivel, custo, venda, tempo, xp, rend, tipo, cor, cor2, forma]) =>
    ({ id, nome, nivel, custo, tempo, xp, rend, preco: Math.round(venda / rend), prod: id, prodNome: nome, tipo, cor, cor2: cor2 || cor, forma, pequeno: forma === 'pequeno' })),
];
const CROP = Object.fromEntries(CROPS.map(c => [c.id, c]));
// O que vai para o celeiro: a fruta/verdura de cada plantação.
const PRODUCE = Object.fromEntries(CROPS.map(c => [c.prod, { id: c.prod, nome: c.prodNome, preco: c.preco, planta: c.id }]));

// Produtos dos animais de produção (o leitão da porca não vai para o celeiro: vira um porquinho).
const PRODUCTS = [
  { id: 'ovo',         nome: 'Ovo',             preco: 60 },
  { id: 'ovoangola',   nome: 'Ovo de angola',   preco: 75 },
  { id: 'ovopata',     nome: 'Ovo de pata',     preco: 90 },
  { id: 'pelo',        nome: 'Pelo de coelho',  preco: 120 },
  { id: 'leitecabra',  nome: 'Leite de cabra',  preco: 180 },
  { id: 'la',          nome: 'Lã',              preco: 250 },
  { id: 'leite',       nome: 'Leite',           preco: 300 },
  { id: 'mel',         nome: 'Mel',             preco: 400 },
  { id: 'leitebufala', nome: 'Leite de búfala', preco: 500 },
  { id: 'ovocodorna', nome: 'Ovo de codorna',  preco: 45 },
  { id: 'ovoperu',     nome: 'Ovo de peru',     preco: 110 },
  { id: 'plumaganso',  nome: 'Pluma de ganso',  preco: 150 },
  { id: 'penapavao',   nome: 'Pena de pavão',   preco: 700 },
  { id: 'lalhama',     nome: 'Lã de lhama',     preco: 480 },
  { id: 'esterco',     nome: 'Esterco',         preco: 110 },
  { id: 'bacon',       nome: 'Bacon',           preco: 350 },
  { id: 'leitejumenta', nome: 'Leite de jumenta', preco: 450 },
  { id: 'crina',       nome: 'Crina de cavalo', preco: 650 },
  { id: 'penaavestruz', nome: 'Pena de avestruz', preco: 800 },
  { id: 'peloonca',    nome: 'Pelo de onça',    preco: 2500 },
];
const PRODUCT = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
// Materiais que os bichos da caçada deixam ao serem pegos (além das moedas): usados na fábrica, vendidos ou entregues no caminhão.
const PRODUTOS_CACA = [
  { id: 'carnejavali', nome: 'Carne de javali',      nomePl: 'carnes de javali',      preco: 60 },
  { id: 'pena',        nome: 'Pena de ave',          nomePl: 'penas de ave',          preco: 15 },
  { id: 'pata',        nome: 'Pata de lebre',        nomePl: 'patas de lebre',        preco: 30 },
  { id: 'presa',       nome: 'Presa de chupa-cabra', nomePl: 'presas de chupa-cabra', preco: 300 },
];
for (const p of PRODUTOS_CACA) PRODUCT[p.id] = { ...p, caca: true };
// Presentinhos que cada gato traz a cada 12h (hora certa, não é sorteio): vende no celeiro que nem qualquer produto.
const GATO_PRESENTE_MS = 12 * 3600e3;
const PRESENTES_GATO = [
  { id: 'novelo',             nome: 'Novelo de lã',        nomePl: 'novelos de lã',         preco: 220, peso: 10 },
  { id: 'ratocacado',         nome: 'Rato caçado',         nomePl: 'ratos caçados',         preco: 250, peso: 8 },
  { id: 'lagartixa',          nome: 'Lagartixa seca',      nomePl: 'lagartixas secas',      preco: 260, peso: 8 },
  { id: 'sininho',            nome: 'Sininho perdido',     nomePl: 'sininhos perdidos',     preco: 320, peso: 5 },
  { id: 'presentemisterioso', nome: 'Presente misterioso', nomePl: 'presentes misteriosos', preco: 480, peso: 2 },
];
for (const p of PRESENTES_GATO) PRODUCT[p.id] = { ...p, gato: true };
const PRESENTES_ARARA = [
  { id: 'penaarara', nome: 'Pena de arara', nomePl: 'penas de arara', preco: 300, peso: 10 },
  { id: 'ovoarara',  nome: 'Ovo de arara',  nomePl: 'ovos de arara',  preco: 520, peso: 3 },
];
for (const p of PRESENTES_ARARA) PRODUCT[p.id] = { ...p, gato: true };
const PET_PRESENTES = { gato: PRESENTES_GATO, arara: PRESENTES_ARARA };
const PET_EMOJI = { gato: '🐱', arara: '🦜' };
function sortearPresentePet(pool) {
  const tot = pool.reduce((t, p) => t + (p.peso || 1), 0);
  let r = Math.random() * tot;
  for (const p of pool) { r -= (p.peso || 1); if (r <= 0) return p; }
  return pool[0];
}
// Cada gato/pavão/cavalo tem seu próprio relógio (presenteProx); quem já tinha antes desta versão ganha o primeiro em 12h.
function petsTick() {
  if (!state) return;
  const agora = Date.now();
  let mudou = false;
  for (const g of state.animals) {
    const pool = PET_PRESENTES[g.k]; if (!pool) continue;
    if (!g.presenteProx) { g.presenteProx = agora + GATO_PRESENTE_MS; continue; }
    if (agora < g.presenteProx) continue;
    const p = sortearPresentePet(pool);
    state.barn[p.id] = (state.barn[p.id] || 0) + 1;
    g.presenteProx = agora + GATO_PRESENTE_MS;
    mudou = true;
    const nome = g.nome || `Seu(sua) ${ANIMAL[g.k].nome.toLowerCase()}`;
    const msg = `${PET_EMOJI[g.k] || '🐾'} ${nome} ${g.k === 'gato' ? 'trouxe' : 'deixou'} ${p.nome.endsWith('a') ? 'uma' : 'um'} ${p.nome.toLowerCase()}! Foi para o celeiro.`;
    toast(msg, 'good'); addNews(msg);
  }
  if (mudou) done();
}
// Prêmios de subir de nível: 1 item sorteado (dá pra vender no celeiro), junto com moedas e trevos.
const PREMIOS_NIVEL = [
  { id: 'medalhabronze', nome: 'Medalha de bronze', nomePl: 'medalhas de bronze', preco: 120, peso: 10 },
  { id: 'medalhaprata',  nome: 'Medalha de prata',  nomePl: 'medalhas de prata',  preco: 220, peso: 6 },
  { id: 'medalhaouro',   nome: 'Medalha de ouro',   nomePl: 'medalhas de ouro',   preco: 380, peso: 3 },
  { id: 'trofeu',        nome: 'Troféu de nível',   nomePl: 'troféus de nível',   preco: 600, peso: 1 },
];
for (const p of PREMIOS_NIVEL) PRODUCT[p.id] = { ...p, nivel: true };
function sortearPremioNivel() {
  const tot = PREMIOS_NIVEL.reduce((t, p) => t + p.peso, 0);
  let r = Math.random() * tot;
  for (const p of PREMIOS_NIVEL) { r -= p.peso; if (r <= 0) return p; }
  return PREMIOS_NIVEL[0];
}
// Junta o que o bicho larga (carne, no caso do javali/javaporco, e o drop genérico dos outros) e devolve o textinho pro resultado.
function aplicaDropsCaca(b) {
  let txt = '';
  if (b.carne) {
    state.barn.carnejavali = (state.barn.carnejavali || 0) + b.carne;
    txt += ` e ${b.carne} ${b.carne > 1 ? PRODUCT.carnejavali.nomePl : PRODUCT.carnejavali.nome.toLowerCase()}`;
  }
  if (b.drop) {
    const p = PRODUCT[b.drop.id];
    state.barn[b.drop.id] = (state.barn[b.drop.id] || 0) + b.drop.qtd;
    txt += ` e ${b.drop.qtd} ${b.drop.qtd > 1 ? p.nomePl : p.nome.toLowerCase()}`;
  }
  return txt;
}
// Bicho de onde vem cada material (pra travar receita/pedido até você já ter caçado um).
const BICHO_DO_DROP = {};
// Frutas do pomar (vêm das frutíferas plantadas no gramado)
const FRUTAS = [
  { id: 'pitanga',    nome: 'Pitanga',    preco: 25, cor: '#e0402a' },
  { id: 'framboesa',  nome: 'Framboesa',  preco: 30, cor: '#d8284a' },
  { id: 'amora',      nome: 'Amora',      preco: 30, cor: '#5a1f4a' },
  { id: 'morango',    nome: 'Morango',    preco: 30, cor: '#e0224a' },
  { id: 'maracuja',   nome: 'Maracujá',   preco: 45, cor: '#e8c030' },
  { id: 'jabuticaba', nome: 'Jabuticaba', preco: 35, cor: '#2a1a2a' },
  { id: 'uva',        nome: 'Uva',        preco: 50, cor: '#6b3a8a' },
  { id: 'manga',      nome: 'Manga',      preco: 60, cor: '#f2a030' },
  { id: 'caju',       nome: 'Caju',       preco: 55, cor: '#e8502a' },
  { id: 'maca',       nome: 'Maçã',       preco: 65, cor: '#d8342a' },
  { id: 'laranja',    nome: 'Laranja',    preco: 60, cor: '#f28c1b' },
  { id: 'pequi',      nome: 'Pequi',      preco: 90, cor: '#b8c040' },
  { id: 'banana',     nome: 'Banana',     preco: 70, cor: '#f2d03a' },
  { id: 'coco',       nome: 'Coco',       preco: 80, cor: '#7a5a3a' },
  { id: 'goiaba',     nome: 'Goiaba',     preco: 75, cor: '#c9d45a' },
];
const FRUTA = Object.fromEntries(FRUTAS.map(f => [f.id, f]));
for (const f of FRUTAS) PRODUCT[f.id] = { id: f.id, nome: f.nome, preco: f.preco, fruta: true };
PRODUCT.leitao = { id: 'leitao', nome: 'Leitão', preco: 700 };

// tipo 'prod': produz a cada "tempo" se alimentado (racao = moedas por produção) durante "periodo" dias;
//   depois para até a visita do veterinário.
// tipo 'cria': compra pequeno, alimenta 1 vez por dia (racao) e vende adulto por "venda".
// tipo 'pet': companhia, não come nem produz. lugar: 'casa' ou 'curral'.
const ANIMALS = [
  // repro = dias entre filhotes/ovos de um casal da espécie (sem repro, a espécie só nasce de outra)
  { id: 'galinha',   tipo: 'prod', nome: 'Galinha',   f: 1, nivel: 2,  custo: 500,  racao: 20,  tempo: 4 * HOUR,  prod: 'ovo',         periodo: 30, xp: 2, repro: 1 },
  { id: 'angola',    tipo: 'prod', nome: "Galinha-d'angola", f: 1, nivel: 3, custo: 700, racao: 25, tempo: 5 * HOUR, prod: 'ovoangola', periodo: 30, xp: 2, repro: 1 },
  { id: 'pato',      tipo: 'prod', nome: 'Pato',      f: 0, nivel: 4,  custo: 900,  racao: 30,  tempo: 6 * HOUR,  prod: 'ovopata',     periodo: 30, xp: 3, repro: 1 },
  { id: 'coelho',    tipo: 'prod', nome: 'Coelho',    f: 0, nivel: 5,  custo: 1200, racao: 40,  tempo: 8 * HOUR,  prod: 'pelo',        periodo: 30, xp: 3, repro: 1 },
  { id: 'cabra',     tipo: 'prod', nome: 'Cabra',     f: 1, nivel: 7,  custo: 2000, racao: 60,  tempo: 8 * HOUR,  prod: 'leitecabra',  periodo: 45, xp: 4, repro: 2 },
  { id: 'ovelha',    tipo: 'prod', nome: 'Ovelha',    f: 1, nivel: 8,  custo: 2500, racao: 80,  tempo: 10 * HOUR, prod: 'la',          periodo: 45, xp: 5, repro: 2 },
  { id: 'vaca',      tipo: 'prod', nome: 'Vaca',      f: 1, nivel: 10, custo: 4000, racao: 120, tempo: 8 * HOUR,  prod: 'leite',       periodo: 45, xp: 5, repro: 3 },
  { id: 'porca',     tipo: 'prod', nome: 'Porca',     f: 1, nivel: 15, custo: 5000, racao: 150, tempo: 24 * HOUR, prod: 'leitao',      periodo: 45, xp: 5, desenho: 'porco', escala: 1.15, repro: 2 },
  { id: 'bufala',    tipo: 'prod', nome: 'Búfala',    f: 1, nivel: 18, custo: 8000, racao: 250, tempo: 12 * HOUR, prod: 'leitebufala', periodo: 60, xp: 7, repro: 3 },
  { id: 'porco',     tipo: 'prod', nome: 'Porquinho', f: 0, nivel: 3,  custo: 1000, racao: 50,  tempo: 12 * HOUR, prod: 'bacon',       periodo: 45, xp: 4 },
  { id: 'bezerro',   tipo: 'prod', nome: 'Bezerro',   f: 0, nivel: 6,  custo: 2000, racao: 80,  tempo: 12 * HOUR, prod: 'esterco',     periodo: 45, xp: 4, desenho: 'vaca', escala: 0.8 },
  { id: 'potro',     tipo: 'prod', nome: 'Potro',     f: 0, nivel: 12, custo: 5000, racao: 120, tempo: 16 * HOUR, prod: 'crina',       periodo: 60, xp: 6, desenho: 'cavalo', repro: 3 },
  { id: 'burro',     tipo: 'prod', nome: 'Burro',     f: 0, nivel: 14, custo: 3500, racao: 100, tempo: 14 * HOUR, prod: 'leitejumenta', periodo: 60, xp: 6, desenho: 'jumento', repro: 3 },
  { id: 'avestruz',  tipo: 'prod', nome: 'Avestruz',  f: 1, nivel: 20, custo: 8000, racao: 200, tempo: 24 * HOUR, prod: 'penaavestruz', periodo: 60, xp: 8, repro: 3 },
  { id: 'codorna',   tipo: 'prod', nome: 'Codorna',   f: 1, nivel: 6,  custo: 600,  racao: 20,  tempo: 3 * HOUR,  prod: 'ovocodorna',  periodo: 30, xp: 2, desenho: 'galinha', escala: 0.65, repro: 1 },
  { id: 'peru',      tipo: 'prod', nome: 'Peru',      f: 0, nivel: 9,  custo: 1500, racao: 50,  tempo: 8 * HOUR,  prod: 'ovoperu',     periodo: 30, xp: 3, desenho: 'galinha', escala: 1.4, repro: 2 },
  { id: 'ganso',     tipo: 'prod', nome: 'Ganso',     f: 0, nivel: 11, custo: 1800, racao: 55,  tempo: 9 * HOUR,  prod: 'plumaganso',  periodo: 35, xp: 4, desenho: 'pato', escala: 1.3, repro: 2 },
  { id: 'pavao',     tipo: 'prod', nome: 'Pavão',     f: 0, nivel: 16, custo: 6000, racao: 160, tempo: 20 * HOUR, prod: 'penapavao',   periodo: 60, xp: 7, repro: 3 },
  { id: 'lhama',     tipo: 'prod', nome: 'Lhama',     f: 1, nivel: 24, custo: 9000, racao: 220, tempo: 18 * HOUR, prod: 'lalhama',     periodo: 60, xp: 8, desenho: 'ovelha', escala: 1.35, repro: 3 },
  { id: 'onca',      tipo: 'prod', nome: 'Onça-pintada', f: 1, nivel: 35, custo: 30000, racao: 500, tempo: 24 * HOUR, prod: 'peloonca', periodo: 90, xp: 15, repro: 5 },
  { id: 'gato',      tipo: 'pet',  nome: 'Gato',      f: 0, nivel: 4,  custo: 800,  lugar: 'casa' },
  { id: 'arara',     tipo: 'pet',  nome: 'Arara',     f: 1, nivel: 22, custo: 8000, lugar: 'casa', fixo: true },
];
const ANIMAL = Object.fromEntries(ANIMALS.map(a => [a.id, a]));
// Até 3 gatos por jogador, cada um com um pelo diferente (o próximo comprado pega a cor que ainda não tem).
const GATO_CORES = [
  { id: 'laranja', nome: 'Laranja', pel: '#e8963f', escuro: '#c06a22', claro: '#e08a3a' },
  { id: 'cinza',   nome: 'Cinza',   pel: '#9aa0a8', escuro: '#6a707a', claro: '#8a909a' },
  { id: 'preto',   nome: 'Preto',   pel: '#3a3a3a', escuro: '#242424', claro: '#333333' },
];
const GATO_MAX = GATO_CORES.length;
const PET_MAX = { gato: GATO_MAX, arara: 2 };
const corGato = a => GATO_CORES.find(c => c.id === a.cor) || GATO_CORES[0];
const RACAO_ESP = 100; // ração especial: a próxima produção rende em dobro
const vetCost = d => Math.round(d.custo * 0.25);
const inPen = a => ANIMAL[a.k].tipo !== 'pet' || ANIMAL[a.k].lugar === 'curral';

// Mapeamento de qual filhote cada espécie adulta gera (reprodução)
const FILHOTES = {
  galinha: 'galinha',   // filhote é galinha (mesma espécie)
  angola: 'angola',
  pato: 'pato',
  coelho: 'coelho',
  cabra: 'cabra',
  ovelha: 'ovelha',
  vaca: 'bezerro',      // vaca gera bezerro
  porca: 'porco',       // porca gera porquinho
  bufala: 'bufala',
  potro: 'potro',
  burro: 'burro',
  avestruz: 'avestruz',
  onca: 'onca',
  codorna: 'codorna',
  peru: 'peru',
  ganso: 'ganso',
  pavao: 'pavao',
  lhama: 'lhama',
};
const AVES = ['galinha', 'angola', 'pato', 'avestruz', 'codorna', 'peru', 'ganso', 'pavao']; // só aves botam ovos; mamíferos têm o filhote direto
const tempoRepro = k => ((ANIMAL[k] && ANIMAL[k].repro) || 3) * DAY; // cada espécie tem o seu intervalo (1 a 5 dias)
// Animais não se compram: vêm de missões, de amigos, de chocar/reproduzir e de subir de nível.
// Cada um vira um "crédito" (state.animalCred) que se resgata em Loja › Animais, no abrigo certo.
const darAnimal = (k, n = 1) => { const c = state.animalCred || (state.animalCred = {}); c[k] = (c[k] || 0) + n; };
const animaisLiberados = s => ANIMALS.filter(d => d.tipo !== 'pet' && d.nivel <= (s.level || 1));
function sortearAnimalCred() {
  const l = animaisLiberados(state); if (!l.length) return null;
  const d = l[Math.floor(Math.random() * l.length)]; darAnimal(d.id); return d;
}

// Abrigos do rancho: cada bicho mora no seu. Cada nível aumenta quantos cabem.
// precos: construir (nível 1), depois aumentar para o nível 2 e o 3.
const ABRIGOS = [
  { id: 'galinheiro',   nome: 'Galinheiro',        o: 'o', nivel: 1,  precos: [0, 1500, 4000],     bichos: ['galinha', 'codorna'] },
  { id: 'angoleiro',    nome: 'Galinheiro-d\'Angola', o: 'o', nivel: 2, precos: [500, 1500, 3000], bichos: ['angola', 'peru'] },
  { id: 'patoril',      nome: 'Patoril',           o: 'o', nivel: 3,  precos: [800, 2000, 4000],   bichos: ['pato', 'ganso'] },
  { id: 'coelheira',    nome: 'Coelheira',         o: 'a', nivel: 5,  precos: [2000, 3000, 6000],  bichos: ['coelho'] },
  { id: 'cabril',       nome: 'Cabril',            o: 'o', nivel: 7,  precos: [2500, 3500, 7000],  bichos: ['cabra'] },
  { id: 'ovelharia',    nome: 'Ovelharia',         o: 'a', nivel: 8,  precos: [3000, 4000, 8000],  bichos: ['ovelha', 'lhama'] },
  { id: 'estabulo',     nome: 'Curral de Vacas',   o: 'o', nivel: 6,  precos: [3500, 5500, 11000], bichos: ['vaca', 'bezerro'] },
  { id: 'estabulo_buf', nome: 'Curral de Búfalas', o: 'o', nivel: 18, precos: [5000, 7000, 14000], bichos: ['bufala'] },
  { id: 'chiqueiro',    nome: 'Chiqueiro',         o: 'o', nivel: 3,  precos: [1500, 3000, 6000],  bichos: ['porco', 'porca'] },
  { id: 'cocheira',     nome: 'Cocheira de Cavalo', o: 'a', nivel: 10, precos: [6000, 9000, 18000], bichos: ['potro'] },
  { id: 'jumentaria',   nome: 'Jumentaria',        o: 'a', nivel: 14, precos: [4000, 6000, 12000], bichos: ['burro'] },
  { id: 'cercado',      nome: 'Viveiro Exótico', o: 'o', nivel: 15, precos: [8000, 12000, 24000], bichos: ['avestruz', 'onca', 'pavao'] },
];
const ABRIGO = Object.fromEntries(ABRIGOS.map(b => [b.id, b]));
const ABRIGO_CAP = [0, 4, 6, 6];               // animais que cabem em cada nível
const ABRIGO_NIVEL = [0, 0, 3, 6];             // níveis de jogador a mais para aumentar
const abrigoOf = k => ABRIGOS.find(b => b.bichos.includes(k));
// O rancho começa como uma grade de 4 × 2 cercados, cada um com 4 × 3,8 casas — mas dá para
// arrastar qualquer um (Modo Mover) para outro canto do rancho; a posição fica em state.animPos.
const YARD_W = 4, YARD_D = 3.8, RANCH_C = YARD_W * 4, RANCH_R = YARD_D * 2;
const yardOrigemPadrao = id => { const k = ABRIGOS.findIndex(b => b.id === id); return [(k % 4) * YARD_W, Math.floor(k / 4) * YARD_D]; };
function yardOf(id) {
  const custom = isHome() && state.animPos && state.animPos[id];
  const [u0, v0] = custom || yardOrigemPadrao(id);
  const rot = !!(isHome() && state.animRot && state.animRot[id]);
  return { u0, v0, u1: u0 + YARD_W, v1: v0 + YARD_D, rot };
}
// Gira o conteúdo do cercado 90° (casinha, cocho etc. mudam de lado) sem mexer no cercado em si
// (ele é quase quadrado). Troca temporariamente a função iso() por uma que transpõe (u,v) em volta
// do canto do cercado — tudo que for desenhado com P()/iso() dentro de fn() sai rodado; feito assim
// (em vez de reescrever cada abrigo) porque cada tipo de casinha tem um jeito de desenhar diferente.
function comRotacaoAbrigo(y, fn) {
  if (!y.rot) return fn();
  const isoAntes = iso;
  iso = (u, v) => isoAntes(y.u0 + (v - y.v0), y.v0 + (u - y.u0));
  try { fn(); } finally { iso = isoAntes; }
}
const abrigoLv = (s, id) => (s.abrigos && s.abrigos[id]) || 0;
const livesIn = (s, id) => s.animals.filter(a => inPen(a) && abrigoOf(a.k).id === id);
const vagas = (s, id) => ABRIGO_CAP[abrigoLv(s, id)] - livesIn(s, id).length;
// Saves antigos e roças de vizinhos não têm abrigos: constrói os que os bichos já usam.
function ensureAbrigos(s) {
  const ab = s.abrigos && typeof s.abrigos === 'object' ? s.abrigos : {};
  s.abrigos = {};
  for (const b of ABRIGOS) {
    const n = s.animals.filter(a => inPen(a) && abrigoOf(a.k) === b).length;
    let lv = clamp(Number(ab[b.id]) || 0, 0, 3);
    while (lv < 3 && ABRIGO_CAP[lv] < n) lv++;
    if (b.id === 'galinheiro') lv = Math.max(1, lv);
    if (lv) s.abrigos[b.id] = lv;
  }
  return s;
}
const drawKind = a => ANIMAL[a.k].desenho || a.k;
// Animais de produção vivem "periodo" dias. Depois vão embora e é preciso resgatar ou chocar outro.
const lifeLeft = a => ANIMAL[a.k].tipo === 'prod' ? a.born + ANIMAL[a.k].periodo * DAY - Date.now() : Infinity;
const isTired = () => false;
// Vender um animal vale bem menos que a compra, e cai um pouco a cada dia que passa.
// Quanto o animal vale na venda: adulto de cria vale o preço cheio; filhote e bicho de companhia, parte da compra.
const precoVenda = a => { const d = ANIMAL[a.k]; return d.tipo === 'prod' ? sellPrice(a) : isAdult(a) ? d.venda : Math.max(1, Math.round(d.custo * (d.tipo === 'cria' ? 0.5 : 0.4))); };
const sellPrice = a => { const d = ANIMAL[a.k]; return Math.max(1, Math.round(d.custo * 0.4 * clamp(lifeLeft(a) / (d.periodo * DAY), 0, 1))); };
function vida(ms) {
  if (ms >= DAY) { const n = Math.floor(ms / DAY); return `${n} ${n > 1 ? 'dias' : 'dia'}`; }
  return fmt(Math.max(60, ms / 1000));
}
const isAdult = a => ANIMAL[a.k].tipo === 'cria' && a.g >= ANIMAL[a.k].tempo;
function isHungry(a) {
  const d = ANIMAL[a.k];
  if (d.tipo === 'prod') return !a.fed && !a.ready;
  if (d.tipo === 'cria') return !isAdult(a) && (a.food || 0) <= 0;
  return false;
}
const seuSua = a => (a.f ? 'Sua ' : 'Seu ') + a.nome.toLowerCase();
const nomeBicho = a => a.nome && a.nome !== ANIMAL[a.k].nome ? `${a.nome} (${ANIMAL[a.k].nome.toLowerCase()})` : ANIMAL[a.k].nome;

// Cães de guarda: um vigia a roça, outro o rancho. Só protegem acordados (com comida).
const DOGS = [
  { id: 'caramelo', nome: 'Vira-lata caramelo', custo: 1000, nivel: 3, vida: 15, protege: 0.55, morde: 0.4, xpDia: 10, xpPega: 15, cor: '#d99a4e', cor2: '#b8793a' },
  { id: 'pastor',   nome: 'Pastor-alemão',      custo: 3000, nivel: 8, vida: 25, protege: 0.7,  morde: 0.5, xpDia: 20, xpPega: 25, cor: '#8a5a2e', cor2: '#2a221c' },
  { id: 'fila',     nome: 'Fila brasileiro',    custo: 6000, nivel: 15, vida: 35, protege: 0.85, morde: 0.6, xpDia: 30, xpPega: 40, cor: '#b8783e', cor2: '#3a2a20' },
];
const DOG = Object.fromEntries(DOGS.map(d => [d.id, d]));
const DOG_FOOD = { custo: 50, horas: 8 };
// Vender um cachorro vale bem menos que a compra, e cai a cada dia de vida que passa (igual aos bichos de companhia).
const dogSellPrice = d => { const b = DOG[d.raca]; return Math.max(1, Math.round(b.custo * 0.4 * clamp((d.born + b.vida * DAY - Date.now()) / (b.vida * DAY), 0, 1))); };
const DOG_NAMES = ['Totó', 'Rex', 'Pipoca', 'Thor', 'Mel', 'Bidu', 'Paçoca', 'Nina', 'Bolinha', 'Faísca', 'Pretinha', 'Caramelo'];
// Nome de cada lugar com o artigo certo ("a roça", "o rancho"…)
const SLOT = { roca: { a: 'a roça', aSua: 'a sua roça', daSua: 'da sua roça', A: 'A roça' }, animais: { a: 'o rancho', aSua: 'o seu rancho', daSua: 'do seu rancho', A: 'O rancho' } };
const STEAL_MAX = { roca: 4, animais: 3 }; // itens por amigo por dia (roca conta plantação e pomar juntos)
// Dia pelo relógio do aparelho: os limites voltam à meia-noite.
const localDay = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / DAY);

const DECOR = [
  { id: 'tapete', nome: 'Tapete de crochê', custo: 600,  nivel: 1, conforto: 3 },
  { id: 'vaso',   nome: 'Vaso de planta',   custo: 800,  nivel: 2, conforto: 3 },
  { id: 'quadro', nome: 'Quadro',           custo: 1200, nivel: 3, conforto: 4 },
  { id: 'abajur', nome: 'Abajur',           custo: 1500, nivel: 4, conforto: 4 },
  { id: 'sofa',   nome: 'Sofá',             custo: 2500, nivel: 6, conforto: 6 },
  { id: 'tv',     nome: 'Televisão',        custo: 4000, nivel: 8, conforto: 8 },
];
const DECO = Object.fromEntries(DECOR.map(d => [d.id, d]));
// Cada lugar da casa tem vários modelos. Você compra os que quiser e escolhe qual fica em uso.
const MODELOS = [
  { id: 'tapete',          lugar: 'tapete', nome: 'Tapete de crochê',     custo: 600,  nivel: 1,  conforto: 3, padrao: 'croche', cor: '#b8433a', cor2: '#f2c14e' },
  { id: 'tapete_listras',  lugar: 'tapete', nome: 'Tapete azul listrado', custo: 900,  nivel: 3,  conforto: 4, padrao: 'listras', cor: '#3f6fa8', cor2: '#f4f1ea' },
  { id: 'tapete_xadrez',   lugar: 'tapete', nome: 'Tapete xadrez',        custo: 1400, nivel: 6,  conforto: 5, padrao: 'xadrez', cor: '#4f9a2f', cor2: '#f2c14e' },
  { id: 'vaso',            lugar: 'vaso',   nome: 'Vaso de flores',       custo: 800,  nivel: 2,  conforto: 3, tipo: 'flores', cor: '#d0703f' },
  { id: 'vaso_cacto',      lugar: 'vaso',   nome: 'Cacto',                custo: 700,  nivel: 3,  conforto: 3, tipo: 'cacto', cor: '#3f6fa8' },
  { id: 'vaso_girassol',   lugar: 'vaso',   nome: 'Girassóis',            custo: 1300, nivel: 6,  conforto: 5, tipo: 'girassol', cor: '#f4f1ea' },
  { id: 'quadro',          lugar: 'quadro', nome: 'Quadro de paisagem',   custo: 1200, nivel: 3,  conforto: 4, tipo: 'paisagem', cor: '#c9962e' },
  { id: 'quadro_vaca',     lugar: 'quadro', nome: 'Retrato da vaca',      custo: 1600, nivel: 5,  conforto: 5, tipo: 'vaca', cor: '#7a4a22' },
  { id: 'quadro_sol',      lugar: 'quadro', nome: 'Pôr do sol',           custo: 2200, nivel: 9,  conforto: 6, tipo: 'sol', cor: '#2c5282' },
  { id: 'abajur',          lugar: 'abajur', nome: 'Abajur amarelo',       custo: 1500, nivel: 4,  conforto: 4, tipo: 'abajur', cor: '#f6d27a' },
  { id: 'abajur_franja',   lugar: 'abajur', nome: 'Abajur de franjas',    custo: 1900, nivel: 6,  conforto: 5, tipo: 'franja', cor: '#f48fb1' },
  { id: 'abajur_lampiao',  lugar: 'abajur', nome: 'Lampião',              custo: 2600, nivel: 9,  conforto: 6, tipo: 'lampiao', cor: '#c98c00' },
  { id: 'sofa',            lugar: 'sofa',   nome: 'Sofá verde',           custo: 2500, nivel: 6,  conforto: 6, cores: ['#5c9a78', '#4a8466', '#3f7358', '#6fb08c', '#66a482'] },
  { id: 'sofa_vermelho',   lugar: 'sofa',   nome: 'Sofá vermelho',        custo: 3200, nivel: 8,  conforto: 7, cores: ['#c8402f', '#a53325', '#8f2a1e', '#e0584a', '#d24a3b'] },
  { id: 'sofa_couro',      lugar: 'sofa',   nome: 'Sofá de couro',        custo: 4500, nivel: 12, conforto: 9, cores: ['#8a5a33', '#6e4424', '#5a3614', '#a86b38', '#96602f'] },
  { id: 'tv_radio',        lugar: 'tv',     nome: 'Rádio antigo',         custo: 3000, nivel: 7,  conforto: 7, tipo: 'radio' },
  { id: 'tv',              lugar: 'tv',     nome: 'TV de tubo',           custo: 4000, nivel: 8,  conforto: 8, tipo: 'tubo' },
  { id: 'tv_plana',        lugar: 'tv',     nome: 'TV de tela plana',     custo: 7000, nivel: 14, conforto: 11, tipo: 'plana' },
];
const MODELO = Object.fromEntries(MODELOS.map(m => [m.id, m]));
// O modelo em uso num lugar (saves antigos guardavam só "true", que é o primeiro modelo).
const emUso = (s, lugar) => { const v = s.decor && s.decor[lugar]; return v === true ? MODELO[lugar] : MODELO[v] || null; };
const LUGAR_NOME = { tapete: 'Tapetes', vaso: 'Vasos', quadro: 'Quadros', abajur: 'Luz', sofa: 'Sofás', tv: 'TV e rádio' };
// Onde cada decoração fica na sala: [coluna, linha, altura] do centro.
const DECOR_SPOT = {
  tapete: [2.6, 2.65, 0], vaso: [4.4, 4.3, 0.35], quadro: [3.7, 0, 0.92],
  abajur: [0.6, 0.6, 0.6], sofa: [0.55, 1.95, 0.35], tv: [3.65, 0.38, 0.45],
};

// Fertilizantes: cada um corta uma parte do tempo total da planta. Dá para usar quantos quiser.
const FERTS = [
  { id: 'basico',  nome: 'Fertilizante básico',  curto: 'Básico',  corta: 0.25, custo: 20,  nivel: 1,  cor: '#c98a4b' },
  { id: 'rapido',  nome: 'Fertilizante rápido',  curto: 'Rápido',  corta: 0.5,  custo: 90,  nivel: 5,  cor: '#4a8fd0' },
  { id: 'premium', nome: 'Fertilizante premium', curto: 'Premium', corta: 0.75, custo: 350, nivel: 10, cor: '#e0a020' },
];
const FERT = Object.fromEntries(FERTS.map(f => [f.id, f]));

const item = id => PRODUCE[id] || PRODUCT[id];
const STAGE_NAMES = ['Semente', 'Broto', 'Crescendo', 'Quase lá', 'Maduro'];

// Vizinhos da vila (não são amigos de verdade). "acima": quantos níveis a roça deles tem a mais que a sua.
const NEIGHBORS = [
  { id: 'ze',    nome: 'Seu Zé',     fazenda: 'Sítio Boa Vista',    cao: 'Rex',    casa: '#d9a441', pega: 0.16, acima: 2,
    avatar: { sexo: 'm', pele: 2, cabelo: 'curto', corCabelo: 4, chapeu: 'palha', camisa: 'xadrez', calca: 'macacao', sapato: 'bota', mao: 'enxada' } },
  { id: 'maria', nome: 'Dona Maria', fazenda: 'Chácara das Flores', cao: 'Pipoca', casa: '#c7658f', pega: 0.08, acima: 5,
    avatar: { sexo: 'f', pele: 1, cabelo: 'rabo', corCabelo: 4, chapeu: 'palha', camisa: 'florida', calca: 'saia', sapato: 'sapatilha', mao: 'nada' } },
];
// Nomes escolhidos pelo jogador: da fazenda e do avatar. Quem visita vê "[fazenda] de [avatar]".
const NOME_MAX = 24;
const limpaNome = v => String(v || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NOME_MAX);
const meuApelido = () => (state && state.apelido) || (user ? firstName(user.name) : 'Você');
const minhaFazenda = () => (state && state.fazenda) || 'Roça Feliz';
const deQuem = v => `${v.fazenda || 'Roça Feliz'} de ${v.nome}`;

// Ordem em que os lotes são liberados: do centro para as bordas.
function orderFor(cols, rows) {
  const d = i => { const c = i % cols, r = Math.floor(i / cols); return (c + .5 - cols / 2) ** 2 + ((r + .5 - rows / 2) * 1.4) ** 2; };
  return [...Array(cols * rows).keys()].sort((a, b) => d(a) - d(b) || a - b);
}
const ORDER = orderFor(COLS, ROWS);

// XP pra subir de nível: fórmula exponencial — próximo = atual + (atual/2)
const need = l => {
  if (l <= 1) return 200;
  const anterior = need(l - 1);
  return Math.round(anterior + anterior / 2);
};
// Expansões: cada uma libera mais canteiros, que você coloca onde quiser dentro da área da roça.
// Cada canteiro novo custa sempre 1000 moedas, não importa o nível (preco = 1000 × canteiros ganhos na
// expansão). Limite de 80 canteiros no total — progressão organizada pra chegar lá até o nível 50, num
// ritmo parecido do início ao fim (sempre uns +10 a +14 canteiros por expansão).
// Quem já tinha comprado mais que 80 (de uma versão antiga, quando não tinha esse teto) não perde
// nenhum: freeLots() nunca fica negativo, só para de liberar canteiro novo até esse limite valer de novo.
const EXPANSOES = [
  { nivel: 1,  preco: 0,     total: 6 },
  { nivel: 5,  preco: 6000,  total: 12 },
  { nivel: 10, preco: 8000,  total: 20 },
  { nivel: 15, preco: 10000, total: 30 },
  { nivel: 20, preco: 12000, total: 42 },
  { nivel: 30, preco: 14000, total: 56 },
  { nivel: 40, preco: 14000, total: 70 },
  { nivel: 50, preco: 10000, total: 80 },
];
const XP_CAP = 50; // colheitas por planta por dia que ainda dão XP (evita ganhar XP infinito com o feijão)
const newId = () => Math.random().toString(36).slice(2, 10);

function emptyPlot(s = 'locked') { return { s, c: null, g: 0, dry: false, w: 0, b: 0, dmg: 0, id: null, th: [], fert: false }; }
function newAnimal(k) {
  const d = ANIMAL[k], a = { id: newId(), k, born: Date.now() };
  if (d.tipo === 'prod') Object.assign(a, { fed: true, g: 0, ready: false, n: 0 }); // a primeira refeição vem junto
  else if (d.tipo === 'cria') Object.assign(a, { g: 0, food: Math.min(24 * HOUR, d.tempo) });
  else Object.assign(a, { nome: d.nome, lastPet: 0 });
  return a;
}
// Faz o animal produzir ou crescer por "sec" segundos.
function growAnimal(a, sec, s = state) {
  const d = ANIMAL[a.k];
  if (d.tipo === 'prod') {
    if (a.fed && !a.ready) { a.g += sec * acelera(s, d.prod); if (a.g >= d.tempo) { a.g = d.tempo; a.ready = true; a.fed = false; } }
  } else if (d.tipo === 'cria' && a.g < d.tempo) {
    const use = Math.min(sec, a.food || 0);
    a.g = Math.min(d.tempo, a.g + use); a.food = (a.food || 0) - use;
  }
}

function newState() {
  const plots = Array.from({ length: N }, () => emptyPlot());
  const novVisto = typeof NOVIDADES !== 'undefined' ? NOVIDADES.reduce((m, n) => Math.max(m, n.v), 0) - 1 : 0;
  START_LOTS.forEach(i => plots[i].s = 'plowed');
  return {
    v: 3, coins: 2000, xp: 0, level: 1, plots, barn: {}, owned: START_LOTS.length, exp: 0, novVisto, boasVindas: true,
    tool: 'hand', seed: 'feijao', t: Date.now(), nb: {}, tools: { enxada: false }, xpDay: { d: 0, c: {} },
    animals: [], decor: {}, abrigos: { galinheiro: 1 }, racaoEsp: 0,
    enfeites: { cerca: 40 }, cercaDada: 1, objetos: { roca: [], animais: [] }, pos: {}, invNovos: 0, skins: {}, skin: null,
    missions: null, gift: { i: 0, ciclo: 0, last: -1 }, owe: {}, col: {}, stamps: {}, temas: { classico: true }, tema: 'classico', helpDay: -1,
    friends: [], sent: {}, code: null, owner: null, log: {}, amizade: {},
    fert: { basico: 2 }, fertSel: 'basico',
    dogs: { roca: null, animais: null }, dogFood: 0, news: [], newsSeen: 0, limits: {},
    stats: { colheitas: 0, coletas: 0, vendido: 0, roubado: 0, ajudas: 0 },
    chocadeira: { ovos: [], level: 0 },
    animalCred: {}, animalNivel: {},
    bloqueados: {},
  };
}

// Aceita saves antigos (v1, grade 6×4) e dados vindos da nuvem.
function migrate(s) {
  if (!s || typeof s !== 'object') return null;
  if (!s.plantasBR) {
    // as plantações ficaram mais brasileiras: o nabo virou feijão e a pera virou soja
    try { s = JSON.parse(JSON.stringify(s).replace(/"nabo"/g, '"feijao"').replace(/"pera"/g, '"soja"')); } catch (e) { /* segue como está */ }
    s.plantasBR = 1;
  }
  if (s.v === 1 || s.v === 2) {
    // A economia mudou inteira: a roça recomeça, mas amigos, código e avisos ficam.
    const keep = { friends: s.friends, sent: s.sent, code: s.code, owner: s.owner, news: s.news, newsSeen: s.newsSeen };
    s = Object.assign(newState(), keep);
    s.news = [{ at: Date.now(), msg: 'A Roça Feliz foi renovada! Tem 27 plantações novas, árvores frutíferas e expansões. Você recomeça com 2.000 moedas.' }].concat(Array.isArray(s.news) ? s.news : []);
  }
  // Grades antigas da roça (todas começavam no canto (0,0) do mundo): remapeia cada canteiro pra mesma
  // posição do mundo na grade nova. Se algum cair fora dela ou no céu, vai pro lugar livre mais perto
  // da casa — ninguém perde canteiro.
  const GRADES_ANTIGAS = { 100: 10, 196: 14, 784: 28, 1568: 28, 2352: 28, 4096: 64 };
  if (s.v === 3 && Array.isArray(s.plots) && s.plots.length !== N && GRADES_ANTIGAS[s.plots.length]) {
    const oc = GRADES_ANTIGAS[s.plots.length], novos = Array.from({ length: N }, () => emptyPlot()), sobra = [];
    s.plots.forEach((p, i) => {
      if (!p || p.s === 'locked') return;
      const j = plotAt(i % oc, Math.floor(i / oc));
      if (j >= 0 && !plotCeu(j)) novos[j] = p; else sobra.push(p);
    });
    if (sobra.length) {
      const livres = [...Array(N).keys()].filter(j => novos[j].s === 'locked' && !plotCeu(j))
        .sort((a, b) => Math.hypot(plotU(a), plotV(a)) - Math.hypot(plotU(b), plotV(b)));
      sobra.forEach((p, k) => { if (livres[k] !== undefined) novos[livres[k]] = p; });
    }
    s.plots = novos;
  }
  if (s.v !== 3 || !Array.isArray(s.plots) || s.plots.length !== N) return null;
  s.animals = Array.isArray(s.animals) ? s.animals.filter(a => a && ANIMAL[a.k]) : [];
  s.animals = s.animals.map(a => Object.assign(newAnimal(a.k), a));
  s.racaoEsp = Math.max(0, Number(s.racaoEsp) || 0);
  ensureAbrigos(s);
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  s.gift = Object.assign({ i: 0, ciclo: 0, last: -1 }, obj(s.gift));
  s.owe = obj(s.owe); s.col = obj(s.col); s.stamps = obj(s.stamps); s.avatar = avatarOk(s.avatar);
  s.amizade = obj(s.amizade);
  s.temas = Object.assign({ classico: true }, obj(s.temas));
  if (!s.temas[s.tema]) s.tema = 'classico';
  if (!s.missions || !Array.isArray(s.missions.dia) || !Array.isArray(s.missions.semana)) s.missions = null;
  if (typeof s.helpDay !== 'number') s.helpDay = -1;
  s.changed = Number(s.changed) || 0;
  s.pocao = Math.max(0, Number(s.pocao) || 0);
  s.enfeites = s.enfeites && typeof s.enfeites === 'object' ? s.enfeites : {};
  s.lugares = s.lugares && typeof s.lugares === 'object' ? s.lugares : {};
  s.skins = s.skins && typeof s.skins === 'object' ? s.skins : {};
  s.objetos = s.objetos && typeof s.objetos === 'object' ? s.objetos : {};
  s.pos = s.pos && typeof s.pos === 'object' ? s.pos : {};
  for (const sc of ['roca', 'animais']) {
    if (!Array.isArray(s.objetos[sc])) s.objetos[sc] = [];
    // saves de antes: os enfeites dos lugares fixos viram posições livres
    const velho = s.lugares && Array.isArray(s.lugares[sc]) ? s.lugares[sc] : [];
    velho.forEach((id, k) => { if (ENFEITE[id] && LUGARES[sc][k]) s.objetos[sc].push({ id, u: LUGARES[sc][k][0], v: LUGARES[sc][k][1] }); });
    s.objetos[sc] = s.objetos[sc].filter(o => o && ENFEITE[o.id] && isFinite(o.u) && isFinite(o.v));
  }
  delete s.lugares;
  s.invNovos = Math.max(0, Number(s.invNovos) || 0);
  s.banca = Array.isArray(s.banca) ? s.banca.filter(x => x && item(x.item) && x.qtd > 0) : [];
  if (s.fab && Array.isArray(s.fab.fila)) {
    // A fábrica virou máquinas separadas: redistribui o que estava na fila única e dá de graça
    // os espaços que já valiam pro nível (quem já tinha, não perde).
    const old = s.fab.fila.filter(x => x && RECEITA[x.r]);
    const maquinas = {};
    for (const M of MAQUINAS) maquinas[M.id] = { fila: [], extra: 0 };
    for (const x of old) { const mid = MAQUINA_DE[x.r]; if (mid) maquinas[mid].fila.push(x); }
    for (const M of MAQUINAS) for (let k = 1; k < M.slots.length; k++) if (s.level >= M.slots[k].nivel) maquinas[M.id].extra = k;
    s.fab = { maquinas };
    s.news = [{ at: Date.now(), msg: 'A Fábrica mudou 🏭: agora cada tipo de produto tem sua própria máquina (Moinho & Padaria, Cozinha do Rio, Conservas, Laticínios, Suqueira), cada uma com seus espaços. O que estava na fila continua produzindo, e você ganhou de graça os espaços que já valiam pro seu nível — dá pra comprar mais em cada máquina agora!' }].concat(Array.isArray(s.news) ? s.news : []);
  } else {
    s.fab = s.fab && s.fab.maquinas && typeof s.fab.maquinas === 'object' ? s.fab : { maquinas: {} };
    for (const M of MAQUINAS) {
      const m = s.fab.maquinas[M.id];
      s.fab.maquinas[M.id] = m && Array.isArray(m.fila) ? { fila: m.fila.filter(x => x && RECEITA[x.r]), extra: Math.max(0, Math.min(M.slots.length - 1, Number(m.extra) || 0)) } : { fila: [], extra: 0 };
    }
  }
  if (s.truck && !Array.isArray(s.truck.pedidos)) s.truck = null;
  const dogs = s.dogs && typeof s.dogs === 'object' ? s.dogs : {};
  s.dogs = {};
  for (const slot of ['roca', 'animais']) { const d = dogs[slot]; s.dogs[slot] = d && DOG[d.raca] ? d : null; }
  s.dogFood = Math.max(0, Number(s.dogFood) || 0);
  s.news = Array.isArray(s.news) ? s.news.filter(n => n && n.at > Date.now() - NEWS_DIAS * 86400e3).slice(0, 30) : [];
  s.newsSeen = Number(s.newsSeen) || 0;
  s.limits = s.limits && typeof s.limits === 'object' ? s.limits : {};
  if (s.barn && s.barn.trufa) { s.barn.bacon = (s.barn.bacon || 0) + s.barn.trufa; delete s.barn.trufa; } // a trufa virou bacon
  s.decor = s.decor && typeof s.decor === 'object' ? s.decor : {};
  s.decorTem = s.decorTem && typeof s.decorTem === 'object' ? s.decorTem : {};
  for (const [lugar, v] of Object.entries(s.decor)) {
    const m = v === true ? MODELO[lugar] : MODELO[v];
    if (!m || m.lugar !== lugar) { delete s.decor[lugar]; continue; }
    s.decor[lugar] = m.id; s.decorTem[m.id] = true;
  }
  s.friends = Array.isArray(s.friends) ? s.friends.filter(f => typeof f === 'string') : [];
  // cópia de segurança de quem já foi amigo (só sai daqui quando você exclui a pessoa)
  s.amigosVistos = obj(s.amigosVistos); for (const f of s.friends) s.amigosVistos[f] = 1;
  s.fazenda = limpaNome(s.fazenda); s.apelido = limpaNome(s.apelido);
  s.sent = s.sent && typeof s.sent === 'object' && !Array.isArray(s.sent) ? s.sent : {};
  s.fert = s.fert && typeof s.fert === 'object' ? s.fert : {};
  if (!FERT[s.fertSel]) s.fertSel = 'basico';
  s.log = s.log && typeof s.log === 'object' ? s.log : {};
  s.nb = s.nb && typeof s.nb === 'object' ? s.nb : {};
  s.barn = s.barn && typeof s.barn === 'object' ? s.barn : {};
  s.stats = Object.assign({ colheitas: 0, coletas: 0, vendido: 0, roubado: 0, ajudas: 0 }, s.stats);
  s.tools = Object.assign({ enxada: false }, s.tools);
  s.xpDay = s.xpDay && s.xpDay.c ? s.xpDay : { d: 0, c: {} };
  s.exp = clamp(Number(s.exp) || 0, 0, EXPANSOES.length - 1);
  if (!s.pomarMove) {
    // as árvores frutíferas saíram da Horta (não ocupam mais canteiro) e viraram frutíferas do Pomar
    const velhas = { morangueiro: 1, videira: 1, macieira: 1, laranjeira: 1, bananeira: 1, coqueiro: 1, mangueira: 1, goiabeira: 1 };
    let n = 0;
    for (const p of s.plots) if ((p.s === 'growing' || p.s === 'withered') && velhas[p.c]) { s.enfeites[p.c] = (s.enfeites[p.c] || 0) + 1; n++; }
    if (n) {
      s.invNovos = (s.invNovos || 0) + 1;
      s.news = [{ at: Date.now(), msg: 'A Horta saiu: as árvores frutíferas não ocupam mais canteiro! Elas foram para o seu Inventário — plante no gramado da roça ou do rancho, junto com as outras frutíferas do Pomar.' }].concat(Array.isArray(s.news) ? s.news : []);
    }
    s.pomarMove = 1;
  }
  for (const p of s.plots) {
    if (!Array.isArray(p.th)) p.th = [];
    if ((p.s === 'growing' || p.s === 'withered') && !CROP[p.c]) Object.assign(p, emptyPlot('plowed'));
    p.w = 0; // não tem mais mato
    if (p.b && p.dry) p.dry = false; // nunca os dois problemas juntos
    p.b = Math.min(1, p.b || 0);
    if (p.s === 'growing' && !p.id) p.id = newId();
  }
  s.owned = s.plots.filter(p => p.s !== 'locked').length;
  if (!CROP[s.seed]) s.seed = 'feijao';
  if (!s.tool || s.tool === 'weed') s.tool = 'hand';
  // frutíferas ganham um id (para os amigos ajudarem) e passam a viver por colheitas
  for (const sc of ['roca', 'animais']) for (const o of (s.objetos && Array.isArray(s.objetos[sc]) ? s.objetos[sc] : [])) if (o && ENFEITE[o.id] && ENFEITE[o.id].fruteira) { if (!o.fid) o.fid = newId(); if (typeof o.colhidas !== 'number') o.colhidas = 0; if (!o.seca && secaDe(o, s)) { o.seca = 1; if (!o.ajudada && !o.placa) o.placa = Date.now(); } }
  // animais não se compram mais: fica um casal de cada espécie, o resto é vendido e o valor vira moedas
  s.animalCred = s.animalCred && typeof s.animalCred === 'object' ? s.animalCred : {};
  s.animalNivel = s.animalNivel && typeof s.animalNivel === 'object' ? s.animalNivel : {};
  if (!s.animaisProd && Array.isArray(s.animals)) {
    s.animaisProd = 1;
    for (const a of s.animals) if (a && ANIMAL[a.k] && ANIMAL[a.k].tipo === 'prod' && typeof a.fed !== 'boolean') Object.assign(a, { fed: true, g: 0, ready: false, n: a.n || 0 }); // antigos de criação: agora produzem
  }
  if (!s.animaisReset && Array.isArray(s.animals)) {
    s.animaisReset = 1;
    s.animals = s.animals.filter(a => a && ANIMAL[a.k]);
    let moedas = 0, vendidos = 0;
    for (const d of ANIMALS) {
      if (d.tipo === 'pet') continue;
      const meus = s.animals.filter(a => a.k === d.id).sort((x, y) => precoVenda(y) - precoVenda(x));
      if (meus.length <= 2) continue;
      const fora = new Set(meus.slice(2));
      for (const a of fora) { moedas += precoVenda(a); vendidos++; }
      s.animals = s.animals.filter(a => !fora.has(a));
    }
    s.coins = (s.coins || 0) + moedas;
    let creditos = 0;
    for (const d of ANIMALS) {
      if (d.nivel > (s.level || 1)) continue;
      s.animalNivel[d.id] = 1;
      const meta = d.tipo === 'prod' ? 2 : 1, falta = meta - s.animals.filter(a => a.k === d.id).length;
      if (falta > 0) { s.animalCred[d.id] = (s.animalCred[d.id] || 0) + falta; creditos += falta; }
    }
    if (vendidos || creditos) s.news = [{ at: Date.now(), msg: `Animais não se compram mais! ${vendidos ? `Ficou um casal de cada espécie: ${vendidos} animai${vendidos > 1 ? 's' : ''} a mais foram vendidos e você recebeu ${moedas.toLocaleString('pt-BR')} moedas. ` : ''}${creditos ? `Você tem ${creditos} animal${creditos > 1 ? 'is' : ''} para resgatar em Loja › Animais. ` : ''}Agora eles vêm de nível, missões da semana, amigos e reprodução.` }].concat(Array.isArray(s.news) ? s.news : []);
  }
  // animais novos liberados pelo nível (incluindo espécies que chegaram depois): ganha para resgatar
  if (s.animaisReset && Array.isArray(s.animals)) {
    const novos = [];
    for (const d of ANIMALS) {
      if (d.nivel > (s.level || 1) || s.animalNivel[d.id]) continue;
      s.animalNivel[d.id] = 1; const meta = d.tipo === 'prod' ? 2 : 1, falta = meta - s.animals.filter(a => a.k === d.id).length;
      if (falta > 0) { s.animalCred[d.id] = (s.animalCred[d.id] || 0) + falta; novos.push(d.nome); }
    }
    if (novos.length) s.news = [{ at: Date.now(), msg: `Animais novos para resgatar em Loja › Animais: ${novos.join(', ')}.` }].concat(Array.isArray(s.news) ? s.news : []);
  }
  // a cerca em volta da roça saiu: quem já jogava ganha 40 pedaços de cerca para pôr onde quiser
  if (!s.cercaDada) { s.cercaDada = 1; s.enfeites = s.enfeites && typeof s.enfeites === 'object' ? s.enfeites : {}; s.enfeites.cerca = (s.enfeites.cerca || 0) + 40; s.invNovos = (s.invNovos || 0) + 1; }
  s.bloqueados = s.bloqueados && typeof s.bloqueados === 'object' ? s.bloqueados : {};
  s.chocadeira = s.chocadeira && typeof s.chocadeira === 'object' ? s.chocadeira : { ovos: [], level: 0 };
  s.ultima_reproducao = s.ultima_reproducao && typeof s.ultima_reproducao === 'object' ? s.ultima_reproducao : {};
  return s;
}

// O tempo passou enquanto a roça estava fechada.
function phaseTempo(p) { return CROP[p.c].tempo; }
// Faz a planta crescer "sec" segundos. Terra seca cresce mais devagar; pragas
// vão comendo parte da colheita (no máximo 35%), proporcional ao tempo da planta.
// Planta pronta que fica mais de 24h sem colher apodrece. Volta com uma poção ou com a ajuda de amigos.
const PODRE_APOS = 24 * HOUR, POCAO = { custo: 150 }, CURA_MAX = 3;
function growPlot(p, sec, events, s = state) {
  if (p.s !== 'growing') return;
  const crop = CROP[p.c], T = phaseTempo(p);
  if (p.g >= T) {
    if (!p.podre) { p.pronto = (p.pronto || 0) + sec; if (p.pronto >= PODRE_APOS) p.podre = true; }
    return;
  }
  if (events) {
    // Um problema de cada vez: ou a terra seca, ou aparecem insetos (de vez em quando).
    if (!p.dry && !p.b && Math.random() < 0.12 / T * sec) p.b = 1;
    else if (!p.dry && !p.b && Math.random() < 0.5 / T * sec) p.dry = true;
  }
  p.g = Math.min(T, p.g + sec * (p.dry ? 0.7 : 1) * acelera(s, crop.prod));
  const trouble = p.w + p.b + (p.dry ? 0.5 : 0);
  if (trouble) p.dmg = Math.min(crop.rend * 0.35, p.dmg + trouble * crop.rend * sec / (T * 4));
}
function catchUp(s, sec) {
  sec = Math.max(0, sec || 0);
  for (const p of s.plots) growPlot(p, sec, false, s);
  for (const a of s.animals) growAnimal(a, sec, s);
}

function load() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    for (const k of OLD_SAVE_KEYS) raw = raw || localStorage.getItem(k);
    if (!raw) return null;
    const s = migrate(JSON.parse(raw));
    if (!s) return null;
    catchUp(s, (Date.now() - (s.t || Date.now())) / 1000);
    const old = Date.now() - 2 * 86400e3, today = localDay();
    for (const k of Object.keys(s.log)) if (s.log[k] < old) delete s.log[k];
    for (const k of Object.keys(s.limits)) if (!(s.limits[k] && s.limits[k].d >= today)) delete s.limits[k];
    return s;
  } catch (e) { return null; }
}
function save() {
  if (kicked) return; // outro aparelho assumiu: este não grava mais nada
  try { state.t = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ }
}
// Só um aparelho joga por vez. Cada aba aberta ganha uma sessão; a mais nova vale.
const isPhone = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const SESSION = { id: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), at: 0, device: isPhone ? 'celular' : 'computador' };
let kicked = null, unsubFarm = null, staleLocal = false;

// ============================================================
// Estado da tela
// ============================================================
let state;
let view = { kind: 'home' };        // home | npc | friend
let scene = 'roca';                 // roca | animais | casa
let tab = 'loja', shopSeg = 'sementes';
let hover = null;
const pointer = { x: 0, y: 0, inside: false, touch: false, tipUntil: 0 };
const popups = [];
let hits = [];                      // alvos clicáveis desenhados no último quadro
const amb = {};                     // posição dos animais andando (só na tela)
const L = { W: 60, ox: 0, oy: 0, cw: 0, ch: 0, horizon: 0, dpr: 1, pan: { x: 0, y: 0 }, canPan: false };

// Nuvem
let user = null, cloudStatus = Cloud.available ? 'loading' : 'off', syncStatus = '', dirty = false, lastCloud = 0;
const CLOUD_MS = 30 * 1000; // intervalo mínimo entre salvamentos automáticos na nuvem
let unsubVisits = null, unsubRequests = null, unsubChat = null;
let requests = [];                  // pedidos de amizade recebidos (ao vivo)
const friendInfo = {};
const pedeAjuda = uid => { const f = friendInfo[uid]; return f && typeof f === 'object' && !f.erro ? f.ajuda || 0 : 0; };
const amigosPedindo = () => (state && user ? state.friends.filter(pedeAjuda) : []);
// De tempos em tempos vê quem está pedindo ajuda (para o número no botão Amigos)
setInterval(() => { if (user && state && !document.hidden) state.friends.forEach(uid => fetchFriendInfo(uid)); }, 150e3);

const $ = s => document.querySelector(s);
const cv = $('#cv'), mainCtx = cv.getContext('2d');
let ctx = mainCtx; // as funções de desenho usam este contexto; os ícones trocam por outro
const stage = $('#stage'), tip = $('#tip');

const S = () => view.kind === 'home' ? state : view.data;
const isHome = () => view.kind === 'home';

// ============================================================
// Utilidades
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function quando(at) {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h}h` : `há ${Math.round(h / 24)} ${Math.round(h / 24) > 1 ? 'dias' : 'dia'}`;
}
function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (h) return `${h}h ${m}min`;
  if (m) return s ? `${m}min ${s}s` : `${m}min`;
  return `${s}s`;
}
function stageOf(p) {
  const k = p.g / phaseTempo(p);
  return k >= 1 ? 4 : k < 0.12 ? 0 : k < 0.4 ? 1 : k < 0.7 ? 2 : 3;
}
const ripe = p => p.s === 'growing' && !p.podre && p.g >= phaseTempo(p);
// Cada colheita rende um número sorteado numa faixa em volta da média (feijão: 3 a 5).
const yieldRange = c => { const k = daEstacao(c.id) ? 1 + ESTACAO_BONUS : 1; return [Math.max(1, Math.round(c.rend * 0.75 * k)), Math.max(1, Math.round(c.rend * 1.25 * k))]; };
const OURO_CHANCE = 0.03, OURO_VEZES = 5; // colheita dourada: rara, rende 5 vezes mais
const expectedYield = p => Math.max(1, Math.round(CROP[p.c].rend - p.dmg));
function rollYield(p) {
  const [lo, hi] = yieldRange(CROP[p.c]);
  return Math.max(1, lo + Math.floor(Math.random() * (hi - lo + 1)) - Math.round(p.dmg));
}
const faixa = c => { const [lo, hi] = yieldRange(c); return lo === hi ? `${lo}` : `${lo} a ${hi}`; };
// Dá para comprar qualquer lote encostado (lado com lado) na terra que você já tem.
function neighbors(i) {
  const c = i % COLS, r = Math.floor(i / COLS), out = [];
  if (c > 0) out.push(i - 1); if (c < COLS - 1) out.push(i + 1);
  if (r > 0) out.push(i - COLS); if (r < ROWS - 1) out.push(i + COLS);
  return out;
}
const allowedLots = () => EXPANSOES[state.exp].total;
const freeLots = () => Math.max(0, allowedLots() - state.owned);
// Lote onde dá para colocar um canteiro agora: qualquer pedaço de terra livre da sua roça, não só o que
// encosta nos canteiros que você já tem (dá pra escolher o lugar à vontade, contanto que tenha vaga comprada).
const canBuy = i => freeLots() > 0 && state.plots[i].s === 'locked' && !plotCeu(i) && !objetoNaCelula(i);
// Tem algo em cima deste pedaço de terra — enfeite/frutífera do jogador OU uma construção fixa (casa,
// celeiro, canil, pesqueiro, placa de terras, trilha da caçada, armadilha)? Aí não dá para virar canteiro.
// Antes só olhava os enfeites do jogador; a trilha da caçada (mata) fica dentro da grade (as outras
// construções ficam fora), então sem isso dava para "comprar" um canteiro bem em cima dela e ele sumia,
// escondido atrás do desenho da trilha.
function objetoNaCelula(i) {
  const c = plotU(i) + 0.5, r = plotV(i) + 0.5;
  return objList(state, 'roca').some(o => !o.cerca && Math.abs(o.u - c) < o.r + 0.35 && Math.abs(o.v - r) < o.r + 0.35);
}
let buyPending = null; // lote clicado uma vez, esperando o segundo clique para confirmar
const sfx = name => { if (window.RFAudio) window.RFAudio.play(name); };
const comfort = s => DECOR.reduce((t, d) => t + (emUso(s, d.id) ? emUso(s, d.id).conforto : 0), 0) + confortoEnfeites(s);
const firstName = n => (n || '').split(' ')[0] || 'Você';

$('#trevosHud').addEventListener('click', () => { if (trevosPendentes()) { missSeg = 'trevos'; openPanel('missoes'); } else openPanel('loja', 'trevo'); });
// A caixa de avisos fica no topo da página (por cima das janelas abertas, como a pescaria).
(() => { const t = document.getElementById('toasts'); if (t && t.parentElement !== document.body) document.body.appendChild(t); })();
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  if (kind === 'bad') sfx('error');
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2800);
  const all = $('#toasts').children; if (all.length > (L.cw < 500 ? 2 : 3)) all[0].remove();
}
function popupAt(pos, text, color, delay = 0) {
  if (!pos) return;
  popups.push({ x: pos.x, y: pos.y - L.W * 0.2, text, color, t0: performance.now() + delay });
}
function lvlUpFX() {
  const lvlEl = $('#lvl'), ring = lvlEl && lvlEl.closest('.avatar-ring');
  if (!ring) return;
  lvlEl.classList.remove('lvlup'); void lvlEl.offsetWidth; lvlEl.classList.add('lvlup');
  ring.classList.remove('lvlup'); void ring.offsetWidth; ring.classList.add('lvlup');
  setTimeout(() => { lvlEl.classList.remove('lvlup'); ring.classList.remove('lvlup'); }, 850);
  const bits = ['✨', '⭐', '🎉', '💛', '🌟'];
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('span');
    s.className = 'lvlconfetti'; s.textContent = bits[i % bits.length];
    const ang = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 36 + Math.random() * 26;
    s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
    s.style.setProperty('--rot', (Math.random() * 360 - 180).toFixed(0) + 'deg');
    ring.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}
// Cartão no meio da tela com os prêmios de subir de nível (moedas, trevos e o item sorteado).
let lvlupTimer = 0;
function lvlupCard(bonus, trevos, premio) {
  const card = $('#lvlupCard'); if (!card) return;
  $('#lvlupN').textContent = state.level;
  $('#lvlupRewards').innerHTML = `
    <div class="lvlup-item"><span class="lvlup-emoji">🪙</span>+${bonus.toLocaleString('pt-BR')}</div>
    <div class="lvlup-item"><span class="lvlup-emoji">🍀</span>+${trevos}</div>
    <div class="lvlup-item"><img alt="" src="${itemIcon(premio.id)}">${premio.nome}</div>`;
  clearTimeout(lvlupTimer);
  card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
  lvlupTimer = setTimeout(() => card.classList.remove('show'), 2600);
}
function addXP(n, pos) {
  n = Math.max(n, Math.round(n * (1 + comfort(state) / 100)));
  state.xp += n;
  popupAt(pos, `+${n} XP`, '#4aa3df', 180);
  while (state.xp >= need(state.level)) {
    state.xp -= need(state.level); state.level++;
    sfx('level');
    lvlUpFX();
    const bonus = state.level * 100; state.coins += bonus;
    const trevos = Math.floor(state.level / 3) + 2; trevosDe().saldo += trevos;
    const premio = sortearPremioNivel(); state.barn[premio.id] = (state.barn[premio.id] || 0) + 1;
    lvlupCard(bonus, trevos, premio);
    const novas = [...CROPS, ...ANIMALS, ...DECOR].filter(c => c.nivel === state.level).map(c => c.nome);
    for (const M of MAQUINAS) if (M.slots[0].nivel === state.level) novas.push(`${M.nome} (fábrica)`);
    for (const [id, n] of AV_OPC.mao) if (AV_NIVEL[id] === state.level) { novas.push(`${n.toLowerCase()} para o avatar (⚙️ › Seu avatar)`); addNews(`🎁 Item novo para o avatar: ${n}! Coloque na mão dele em ⚙️ › Seu avatar.`); }
    // Animal novo liberado neste nível: ganha para resgatar (casal para os de produção, 1 para os demais)
    for (const d of ANIMALS) {
      const dado = state.animalNivel || (state.animalNivel = {});
      if (d.nivel !== state.level || dado[d.id]) continue;
      dado[d.id] = 1; const n = d.tipo === 'prod' ? 2 : 1; darAnimal(d.id, n);
      novas.push(`+${n} ${d.nome.toLowerCase()} para resgatar (Loja › Animais)`);
    }
    toast(`Nível ${state.level}! +${bonus} moedas · +${trevos} 🍀 · +1 ${premio.nome.toLowerCase()}` + (novas.length ? ` · novidades: ${novas.join(', ')}` : ''), 'good');
  }
}
function addCoins(n, pos) {
  state.coins += n;
  if (n) popupAt(pos, `${n > 0 ? '+' : ''}${n} moedas`, n > 0 ? '#f2b705' : '#e05a3a', 360);
}
function gain(id, qty, pos) {
  state.barn[id] = (state.barn[id] || 0) + qty;
  popupAt(pos, `+${qty} ${item(id).nome}`, '#ffffff');
}
// state.changed marca a última mudança de verdade (não o último salvamento): é o que decide
// se a roça deste aparelho é mais nova que a da nuvem.
function done() { if (state) { state.changed = Date.now(); state.pendente = true; } save(); agendarSyncPush(); dirty = true; renderHUD(); renderPane(); renderSceneInfo(); }

// ============================================================
// Ações na sua roça
// ============================================================
function actPlot(i) {
  const p = S().plots[i];
  if (!isHome()) return awayPlot(i, p);
  const tool = state.tool, pos = cellCenter(i);
  if (p.s === 'locked') return clickLot(i);
  if (p.s === 'growing' && p.podre && tool !== 'hoe') return usePotion(p, pos);
  if (tool === 'fert') return fertilize(p, pos);
  const has = t => tool === 'hand' || tool === t;
  if (p.s === 'growing' && p.b > 0 && has('pest')) { p.b--; sfx('pest'); useFx('pest', pos); track('praga'); addXP(2, pos); addCoins(1, pos); return done(); }
  if (p.s === 'growing' && p.w > 0 && has('weed')) { p.w--; sfx('weed'); addXP(2, pos); addCoins(1, pos); return done(); }
  if (p.s === 'growing' && p.dry && has('water')) { p.dry = false; sfx('water'); useFx('water', pos); track('regar'); addXP(1, pos); return done(); }
  if (ripe(p) && tool === 'hand') return harvest(p, pos);
  if (p.s === 'withered' && has('hoe')) { Object.assign(p, emptyPlot('plowed')); sfx('hoe'); useFx('hoe', pos); addXP(1, pos); return done(); }
  if (p.s === 'growing' && tool === 'hoe') {
    // O enxadão (ferramenta 'hoe'; no save continua tools.enxada) arranca qualquer plantação. Pede um segundo clique.
    if (buyPending && buyPending.i === 'hoe' + i && performance.now() < buyPending.until) {
      buyPending = null; Object.assign(p, emptyPlot('plowed')); sfx('hoe'); useFx('hoe', pos);
      return done();
    }
    buyPending = { i: 'hoe' + i, until: performance.now() + 4000 };
    return toast(`Arrancar ${CROP[p.c].nome.toLowerCase()}? Clique de novo para confirmar.`);
  }
  if (p.s === 'plowed' && tool === 'seed') return plant(p, pos);
  // Terra vazia sem semente na mão: abre a Loja para escolher o que plantar (nada é plantado sozinho).
  if (p.s === 'plowed' && tool === 'hand') { openPanel('loja', 'sementes'); return toast('Escolha uma semente na Loja e clique na terra para plantar.'); }
  const hints = {
    hoe: 'O enxadão limpa plantas secas e arranca plantações.', water: 'Essa terra não precisa de água.',
    pest: 'Não há pragas aqui.', weed: 'Não há mato aqui.', seed: 'Só dá para plantar em terra arada.',
  };
  if (hints[tool]) toast(hints[tool]);
}

function curar(p) { p.podre = false; p.pronto = 0; }
function usePotion(p, pos) {
  if ((state.pocao || 0) <= 0) {
    openPanel('loja', 'adubo');
    return toast(`${CROP[p.c].nome} apodreceu. Compre uma poção (${POCAO.custo} moedas) ou peça ajuda aos amigos.`, 'bad');
  }
  state.pocao--; curar(p);
  sfx('level'); useFx('pocao', pos); popupAt(pos, 'Novinha de novo!', '#c9a6ff');
  toast(`Poção usada: ${CROP[p.c].nome.toLowerCase()} voltou a ficar boa. Colha logo!`, 'good');
  done();
}
function plant(p, pos) {
  const crop = CROP[state.seed];
  if (crop.nivel > state.level) return toast(`${crop.nome} libera no nível ${crop.nivel}.`);
  if (state.coins < crop.custo) return toast(`Faltam moedas para ${crop.nome} (${crop.custo}).`, 'bad');
  addCoins(-crop.custo, pos);
  Object.assign(p, emptyPlot('growing'), { c: crop.id, id: newId(), ouro: Math.random() < OURO_CHANCE });
  sfx('plant'); useFx('seed', pos); track('plantar');
  if (xpAllowed(crop.id)) addXP(1, pos);
  done();
}

// Quantas colheitas de cada planta já deram XP hoje.
function xpAllowed(id) {
  const today = localDay();
  if (state.xpDay.d !== today) state.xpDay = { d: today, c: {} };
  return (state.xpDay.c[id] || 0) < XP_CAP;
}
function fertilize(p, pos) {
  const f = FERT[state.fertSel], have = state.fert[f.id] || 0;
  if (p.s !== 'growing') return toast('O adubo é para planta que está crescendo.');
  if (ripe(p)) return toast('Essa planta já está pronta para colher.');
  if (have <= 0) { openPanel('loja', 'adubo'); return toast(`Você não tem ${f.nome}. Compre na Loja.`); }
  const T = phaseTempo(p), corte = Math.min(T - p.g, T * f.corta);
  state.fert[f.id] = have - 1;
  p.g += corte;
  p.fert = true;
  sfx('fert'); useFx('fert', pos); track('adubar');
  popupAt(pos, `−${fmt(corte)}`, '#9be36a');
  addXP(1, pos);
  renderTools();
  done();
}

function buyFert(id, n) {
  const f = FERT[id], cost = f.custo * n;
  if (state.level < f.nivel) return toast(`${f.nome} libera no nível ${f.nivel}.`);
  if (state.coins < cost) return toast(`Faltam moedas: ${n} × ${f.nome} custa ${cost}.`, 'bad');
  state.coins -= cost;
  state.fert[id] = (state.fert[id] || 0) + n;
  sfx('buy');
  toast(`+${n} ${f.nome}`, 'good');
  renderTools();
  done();
}

function clickLot(i) {
  if (!freeLots()) {
    const next = EXPANSOES[state.exp + 1];
    return toast(next ? `Para ter mais canteiros, compre a próxima expansão na aba Terreno (nível ${next.nivel}).` : 'Sua roça já está no tamanho máximo.');
  }
  if (!canBuy(i)) return;
  if (buyPending && buyPending.i === i && performance.now() < buyPending.until) {
    buyPending = null;
    state.plots[i] = emptyPlot('plowed'); state.owned++;
    sfx('hoe');
    toast(freeLots() ? `Canteiro novo! Ainda dá para colocar ${freeLots()}.` : 'Canteiro novo pronto para plantar!', 'good');
    return done();
  }
  buyPending = { i, until: performance.now() + 4000 };
  sfx('click');
  toast('Clique de novo neste lugar para colocar o canteiro aqui.');
}
function buyExpansion() {
  const next = EXPANSOES[state.exp + 1];
  if (!next) return;
  if (state.level < next.nivel) return toast(`Essa expansão libera no nível ${next.nivel}.`);
  if (state.coins < next.preco) return toast(`A expansão custa ${next.preco.toLocaleString('pt-BR')} moedas.`, 'bad');
  state.coins -= next.preco; state.exp++;
  sfx('buy');
  addXP(10, null);
  toast(`Expansão comprada! Coloque ${freeLots()} canteiros novos onde quiser: clique nos + da roça.`, 'good');
  if (!isHome()) goHome();
  setScene('roca');
  done();
}

function harvest(p, pos) { harvestPlot(p, pos); done(); }
// O miolo da colheita, sem chamar done() — assim a Colheita rápida pode colher vários canteiros
// e salvar/renderizar só uma vez no final, em vez de um done() por canteiro.
function harvestPlot(p, pos) {
  const crop = CROP[p.c], ouro = !!p.ouro, qty = rollYield(p) * (ouro ? OURO_VEZES : 1);
  sfx('harvest');
  gain(crop.prod, qty, pos);
  state.stats.colheitas++;
  track('colher'); if (daEstacao(crop.id)) track('estacao');
  collect(crop.prod, pos);
  if (ouro) {
    track('dourada'); sfx('level');
    popupAt(pos, `Dourada! ×${OURO_VEZES}`, '#ffd54a', 250);
    toast(`Colheita dourada de ${crop.nome.toLowerCase()}: ${qty} ${crop.prodNome.toLowerCase()}!`, 'good');
    addNews(`Você fez uma colheita dourada de ${crop.nome.toLowerCase()} (${qty} ${crop.prodNome.toLowerCase()}).`);
  }
  if (xpAllowed(crop.id)) { state.xpDay.c[crop.id] = (state.xpDay.c[crop.id] || 0) + 1; addXP(crop.xp, pos); }
  else if (state.xpDay.c[crop.id] === XP_CAP) { state.xpDay.c[crop.id]++; toast(`Hoje ${crop.nome.toLowerCase()} já deu todo o XP (${XP_CAP} colheitas). Ainda rende moedas; o XP volta amanhã.`); }
  Object.assign(p, { s: 'withered', g: 0, w: 0, b: 0, dry: false, th: [] });
}
// Colheita rápida: colhe de uma vez todo canteiro pronto da sua roça.
function harvestAll() {
  if (!isHome()) return;
  const list = state.plots.map((p, i) => ({ p, i })).filter(x => ripe(x.p)), frutas = fruteirasProntas();
  if (!list.length && !frutas.length) return toast('Nada pronto pra colher agora. 🌱');
  for (const { p, i } of list) harvestPlot(p, cellCenter(i));
  for (const o of frutas) colherFruteira(o);
  if (frutas.length) sfx('collect');
  const partes = [list.length && `${list.length} ${list.length > 1 ? 'canteiros' : 'canteiro'}`, frutas.length && `${frutas.length} ${frutas.length > 1 ? 'frutíferas' : 'frutífera'}`].filter(Boolean);
  toast(`Colheu ${partes.join(' e ')}.`, 'good');
  done();
}
// Limpeza rápida: limpa de uma vez toda terra seca da sua roça (mesma ação do enxadão, uma por uma).
function clearAllWithered() {
  if (!isHome()) return;
  if (!state.tools.enxada) return toast('Você precisa do Enxadão para limpar a terra automaticamente. Compre na Loja › Ferramentas.', 'bad');
  const list = state.plots.map((p, i) => ({ p, i })).filter(x => x.p.s === 'withered');
  if (!list.length) return toast('Nenhuma terra seca pra limpar agora. 🌾');
  for (const { p, i } of list) { Object.assign(p, emptyPlot('plowed')); useFx('hoe', cellCenter(i)); addXP(1, cellCenter(i)); }
  sfx('hoe');
  toast(`Limpou ${list.length} ${list.length > 1 ? 'terras secas' : 'terra seca'}.`, 'good');
  done();
}


// Clique num bicho: ele solta uma frase (balãozinho) e o seu barulho.
const FALAS_BICHO = {
  galinha: ['Có có có!', 'Botei um ovo! 🥚', 'Cadê o milho?', 'Achei uma minhoca!'],
  angola: ['Tô fraco! Tô fraco!', 'Quem mexeu no meu ninho?', 'Tô de pintinha nova ✨', 'Que calor, sô!'],
  pato: ['Quá quá!', 'Cadê a lagoa?', 'Hoje tem banho? 🦆', 'Quá! Quem chegou?'],
  coelho: ['Cenoura, por favor! 🥕', 'Hop hop!', '*mexe o narizinho*', 'Orelhas em pé!'],
  cabra: ['Méééé!', 'Posso comer seu chapéu?', 'Subi no telhado!', 'Mééé, que capim bom!'],
  ovelha: ['Béééé!', 'Tá frio sem lã…', 'Contando carneirinhos 💤', 'Bééé, fofinha eu?'],
  vaca: ['Muuuu!', 'Capim fresquinho 😋', 'Tô ruminando…', 'Leitinho saindo!'],
  bufala: ['Muuuu!', 'Cadê a lama?', 'Forte que nem eu, só eu!'],
  bezerro: ['Mé-uuu!', 'Cadê a mamãe?', 'Quero mamar!'],
  porco: ['Oinc oinc!', 'Tem lama aí?', 'Sobrou lavagem?', 'Oinc! Tô com fome!'],
  porca: ['Oinc oinc!', 'Cuidado com os leitõezinhos!', 'Tem lama aí?'],
  avestruz: ['Bum bum!', 'Quem viu meu ovo gigante?', 'Corro mais que o caminhão!'],
  gato: ['Miau!', 'Ronronando… 😸', 'Cadê o peixe?', 'Miau, carinho!'],
  arara: ['Currupaco!', 'Louro quer biscoito!', 'Roça Feliz! Roça Feliz!', 'Olá! Olá!'],
};
function falaBicho(a) {
  const d = ANIMAL[a.k], lista = FALAS_BICHO[a.k] || ['…'];
  falar('animal:' + a.id, a.nome || d.nome, lista[Math.floor(Math.random() * lista.length)]);
  sfx('bicho_' + a.k);
}
function actAnimal(id) {
  const s = S(), a = s.animals.find(x => x.id === id);
  if (!a) return;
  falaBicho(a);
  const d = ANIMAL[a.k], pos = animalPos(a.id);
  if (!isHome()) return awayAnimal(a, d, PRODUCT[d.prod], pos);
  if (d.tipo === 'pet') return petAnimal(a, pos);
  if (d.tipo === 'cria') {
    if (isAdult(a)) return confirmTwice('sell' + a.id, `Vender ${d.nome.toLowerCase()} adulto por ${d.venda.toLocaleString('pt-BR')} moedas? Clique de novo para vender.`, () => sellAdult(a, pos));
    if (isHungry(a)) return feedAnimal(a, pos) && done();
    return toast(`${d.nome} está crescendo: falta ${fmt(d.tempo - a.g)}. Comida por mais ${fmt(a.food)}.`);
  }
  if (a.ready) { collectAnimal(a, pos); return done(); }
  if (!a.fed) return feedAnimal(a, pos, true) && done();
  const rt = reproTexto(a.k);
  toast(`${d.nome} está produzindo ${PRODUCT[d.prod].nome.toLowerCase()}: falta ${fmt((d.tempo - a.g) / acelera(S(), d.prod))}.${rt ? ' ' + rt : ''}`);
}
// Ações que pedem um segundo clique para confirmar.
function confirmTwice(key, msg, fn) {
  if (buyPending && buyPending.i === key && performance.now() < buyPending.until) { buyPending = null; return fn(); }
  buyPending = { i: key, until: performance.now() + 4000 };
  toast(msg);
}
function collectAnimal(a, pos) {
  const d = ANIMAL[a.k], qty = a.dobro ? 2 : 1;
  a.ready = false; a.g = 0; a.n++; a.dobro = false;
  sfx('collect');
  if (d.prod === 'leitao') {
    // A porca teve leitões: vão para o chiqueiro para crescer (se couber).
    let born = 0;
    while (born < qty && vagas(state, 'chiqueiro') > 0) { state.animals.push(newAnimal('porco')); born++; }
    if (born) popupAt(pos, born > 1 ? '+2 porquinhos!' : '+1 porquinho!', '#ffffff');
    if (born < qty) { const n = qty - born; addCoins(PRODUCT.leitao.preco * n, pos); toast(`O chiqueiro está cheio: ${n > 1 ? 'os leitões foram vendidos' : 'o leitão foi vendido'} por ${PRODUCT.leitao.preco * n} moedas.`); }
  } else { gain(d.prod, qty, pos); collect(d.prod, pos); }
  addXP(d.xp, pos); state.stats.coletas++; track('coletar', qty);
}
// Alimenta um animal pagando a ração. Clicando nele, usa a ração especial se você tiver.
function feedAnimal(a, pos, allowSpecial) {
  const d = ANIMAL[a.k];
  if (state.coins < d.racao) { toast(`Faltam moedas para a ração (${d.racao}).`, 'bad'); return false; }
  addCoins(-d.racao, pos);
  if (d.tipo === 'prod') {
    a.fed = true;
    if (allowSpecial && state.racaoEsp > 0) { state.racaoEsp--; a.dobro = true; popupAt(pos, 'Ração especial: produção em dobro!', '#ffe08a', 500); }
  } else a.food = Math.min(24 * HOUR, d.tempo - a.g);
  sfx('feed'); addXP(1, pos); track('alimentar');
  return true;
}
function sellAdult(a, pos) {
  const d = ANIMAL[a.k];
  state.animals = state.animals.filter(x => x !== a); delete amb[a.id];
  addCoins(d.venda, pos);
  state.stats.vendido += d.venda;
  sfx('coin');
  addXP(d.xp, pos);
  toast(`Você vendeu ${d.f ? 'a' : 'o'} ${d.nome.toLowerCase()} por ${d.venda.toLocaleString('pt-BR')} moedas!`, 'good');
  done();
}
function petAnimal(a, pos) {
  const d = ANIMAL[a.k];
  popupAt(pos, '♥', '#ff6b8a'); popupAt(pos, '♥', '#ff8aa3', 200);
  sfx('collect');
  track('carinho');
  if (Date.now() - (a.lastPet || 0) > DAY) { a.lastPet = Date.now(); addXP(2, pos); done(); }
  else toast(`${a.nome || d.nome} adorou o carinho!`);
}
function feedAll() {
  const list = state.animals.filter(isHungry);
  if (!list.length) return toast('Nenhum animal com fome agora.');
  let n = 0, spent = 0;
  for (const a of list) {
    const d = ANIMAL[a.k];
    if (state.coins < d.racao) break;
    const before = state.coins;
    if (feedAnimal(a, animalPos(a.id), false)) { n++; spent += before - state.coins; }
  }
  if (n < list.length) toast(`Alimentou ${n} de ${list.length}: faltaram moedas para o resto.`, 'bad');
  else toast(`Alimentou ${n} ${n > 1 ? 'animais' : 'animal'} por ${spent.toLocaleString('pt-BR')} moedas.`, 'good');
  done();
}
function collectAll() {
  const list = state.animals.filter(a => ANIMAL[a.k].tipo === 'prod' && a.ready);
  if (!list.length) return toast('Nada pronto para recolher.');
  for (const a of list) collectAnimal(a, animalPos(a.id));
  toast(`Recolheu ${list.length} ${list.length > 1 ? 'produtos' : 'produto'}.`, 'good');
  done();
}

// ---------- Cachorros ----------
const dogAlive = d => d && Date.now() - d.born < DOG[d.raca].vida * DAY;
const dogAwake = d => dogAlive(d) && d.fedUntil > Date.now();
const sorteia = l => l[Math.floor(Math.random() * l.length)];
const FALAS_CAO = ['Au au! 🐶', 'Au! Tô de olho!', 'Cadê meu osso? 🦴', 'Aqui ninguém pega nada!', 'Au au! Brinca comigo?', 'Grrr… quem vem lá?', 'Au! Bora passear?', '*abana o rabo*'];
const FALAS_AVATAR = ['Cê tá bão?', 'Ô trem bão!', 'Bora trabaiá!', 'Que dia bonito, sô!', 'Essa roça tá uma belezura!', 'Uai, cadê meu chapéu?', 'Hoje tem colheita boa!', 'Vou tomar um cafezin ☕', 'Nó, que calor!', 'Bão demais da conta!'];
const FALAS_DONO = ['Seja bem-vindo na minha roça!', 'Fique à vontade, sô!', 'Aceita um cafezinho?', 'Dá uma ajudinha na horta?', 'Que bom que cê veio!', 'Repara na bagunça não!'];
const latir = (slot, nome) => { falar('dog:' + slot, nome, sorteia(FALAS_CAO)); sfx('bark'); };
function actDog(slot) {
  const d = S().dogs && S().dogs[slot];
  if (!isHome()) {
    if (view.kind === 'npc' && !d) return latir(slot, view.cao);
    if (!d) return;
    if (dogAwake(d)) latir(slot, d.nome); else falar('dog:' + slot, d.nome, 'Zzz… 💤');
    return toast(dogAwake(d) ? `${d.nome} está acordado vigiando ${SLOT[slot].a}. Cuidado!` : `${d.nome} está dormindo… é a sua chance.`);
  }
  if (!d) {
    openPanel('loja', 'caes');
    return toast(`Compre um cachorro na Loja para vigiar ${SLOT[slot].a}.`);
  }
  if (!dogAwake(d)) { feedDog(slot); if (dogAwake(d)) latir(slot, d.nome); return; }
  latir(slot, d.nome);
  const dias = Math.ceil((d.born + DOG[d.raca].vida * DAY - Date.now()) / DAY);
  toast(`${d.nome} está de guarda. Comida por mais ${fmt((d.fedUntil - Date.now()) / 1000)} · vive mais ${dias} ${dias > 1 ? 'dias' : 'dia'}.`);
}
function feedDog(slot) {
  const d = state.dogs[slot];
  if (!d || dogAwake(d)) return;
  if (state.dogFood <= 0) {
    openPanel('loja', 'caes');
    return toast(`Acabou a ração de cachorro. Compre na Loja (${DOG_FOOD.custo} moedas, dura ${DOG_FOOD.horas}h).`, 'bad');
  }
  state.dogFood--;
  d.fedUntil = Date.now() + DOG_FOOD.horas * 3600e3;
  sfx('feed');
  const pos = dogPos(slot);
  popupAt(pos, 'Acordado!', '#ffe08a');
  addXP(2, pos);
  done();
}
function buyDog(raca, slot) {
  const b = DOG[raca];
  if (state.dogs[slot]) return toast(`Já tem um cachorro vigiando ${SLOT[slot].a}.`);
  if (state.level < b.nivel) return toast(`${b.nome} libera no nível ${b.nivel}.`);
  if (state.coins < b.custo) return toast(`${b.nome} custa ${b.custo} moedas.`, 'bad');
  const used = Object.values(state.dogs).filter(Boolean).map(d => d.nome);
  const nome = DOG_NAMES.filter(n => !used.includes(n))[Math.floor(Math.random() * (DOG_NAMES.length - used.length))];
  state.coins -= b.custo;
  // O cachorro chega de barriga cheia.
  state.dogs[slot] = { raca, nome, born: Date.now(), fedUntil: Date.now() + DOG_FOOD.horas * 3600e3, lastXp: Date.now() };
  sfx('buy'); sfx('bark');
  addXP(5, null);
  toast(`${nome}, ${b.nome.toLowerCase()}, agora vigia ${SLOT[slot].aSua}!`, 'good');
  if (isHome()) setScene(slot === 'roca' ? 'roca' : 'animais');
  done();
}
function buyDogFood(n) {
  const cost = DOG_FOOD.custo * n;
  if (state.coins < cost) return toast(`Faltam moedas: ${n} ração custa ${cost}.`, 'bad');
  state.coins -= cost; state.dogFood += n;
  sfx('buy');
  toast(`+${n} ração de cachorro`, 'good');
  done();
}

// ---------- Tempo de vida, XP diário dos cães e avisos ----------
// ---------- Novidades do jogo: viram cartas na caixa de correio ----------
// Ao lançar algo novo, acrescente aqui { v: número da versão (rf-version), txt }.
const NOVIDADES = [
  { v: 46, txt: 'Seu progresso agora é protegido: o jogo guarda uma cópia da roça por dia e dá para restaurar em ⚙️ › Cópias de segurança.' },
  { v: 51, txt: 'Notificações! Ative em ⚙️ › Notificações e receba avisos de colheita pronta, animais, fábrica, caminhão e amigos, mesmo com o jogo fechado.' },
  { v: 52, txt: 'Dê um nome para a sua fazenda e para o seu avatar em ⚙️ › Nomes. Quem visitar vai ver "[fazenda] de [avatar]".' },
  { v: 54, txt: 'Avatar de menina com roupas próprias: blusa de babado, saia rodada, jardineira, sapatilha e mais. Veja em ⚙️ › Seu avatar.' },
  { v: 55, txt: 'Chat com amigos! Na aba Amigos, toque em 💬 Conversar para trocar mensagens.' },
  { v: 57, txt: 'Os animais agora falam e fazem barulho quando você clica neles. E chegou a galinha-d\'angola (nível 3, no Galinheiro)!' },
  { v: 59, txt: 'Veja quem está online: a lista de amigos mostra 🟢 Online ou "visto há X min".' },
  { v: 60, txt: 'Pescaria 🎣: clique no pesqueiro na frente da casinha do cachorro, espere a boia afundar e puxe! Tem 8 peixes, do lambari ao pirarucu.' },
  { v: 60, txt: 'Pedidos da vila: Seu Zé e Dona Maria pedem coisas da sua roça em Missões › Vila. Entregue, ganhe corações ❤️ e presentes exclusivos.' },
  { v: 60, txt: 'Ranking semanal 🏆: na aba Amigos, veja quem fez mais pontos na semana. Os 3 primeiros ganham moedas toda segunda!' },
  { v: 61, txt: 'A partir de agora, toda novidade do jogo chega aqui no correio. Fique de olho! 📬' },
  { v: 63, txt: 'Pescaria nova: escolha a isca (🪱 minhoca, 🌽 milho do celeiro, 🦐 camarão no nível 6, 🎏 isca artificial no nível 12) — cada peixe só morde algumas. E abra o 📖 Livro de peixes para ver o que já pegou e o que falta!' },
  { v: 63, txt: 'Receitas com peixe na Fábrica: lambari frito, caldo de tilápia, moqueca de tucunaré, pintado assado, dourado na brasa e pirarucu de casaca.' },
  { v: 82, txt: 'Tutorial rápido 📘: quer relembrar como tudo funciona? Abra ⚙️ › Ajuda › Ver tutorial. E quem começa agora já escolhe o nome da fazenda e monta o avatar logo na chegada.' },
  { v: 94, txt: 'Domínio de cada peixe ★: pegando mais do mesmo peixe, ele ganha até 4 estrelas no 📖 Livro de peixes. Cada estrela faz ele morder 15% mais e vale trevos para resgatar (1, 2, 3 e 5). E agora completar todas as missões do dia dá 🍀 2 trevos, e todas as da semana dão 🍀 6!' },
  { v: 109, txt: 'A enxada de arrancar também ganhou desenho de enxada de verdade (antes aparecia um machado).' },
  { v: 116, txt: 'Chegou o MAXIXE 🥒 (nível 8): a rama se espalha no chão e dá maxixes verdinhos cheios de espinhos moles.' },
  { v: 117, txt: 'A Horta saiu da roça 🌳: morangueiro, videira, macieira, laranjeira, bananeira, coqueiro e goiabeira não ocupam mais canteiro! Agora são frutíferas do Pomar (Loja › Pomar): plante no gramado, dão morango, uva, maçã, laranja, banana, coco e goiaba de tempos em tempos e secam depois de umas colheitas, igualzinho às outras frutíferas. Quem já tinha uma plantada ganhou de volta no Inventário.' },
  { v: 118, txt: 'Caçada mais fácil de acertar 🎯: os pássaros (pombo e pardal) voam mais devagar e balançam menos no ar, e a pedrinha do estilingue chega mais rápido — menos "chute" e mais precisão.' },
  { v: 119, txt: 'Aviso quando o ponto de pesca descansar 🎣: o pesqueiro brilha na sua roça assim que ele voltar a pescar, e chegou o aviso 🎣 Ponto de pesca descansado nas notificações do celular (⚙️ › Notificações).' },
  { v: 120, txt: 'Dá para pegar frutas do pomar dos amigos e da vila 🍇: quando estiver visitando, toque numa frutífera pronta para pegar uma fruta (até 3 por dia em cada roça, cuidado com o cachorro!).' },
  { v: 121, txt: 'Fertilizantes mais fortes e mais baratos 🌱: básico corta 25%, rápido 50% e premium 75% do tempo da planta (antes era 10/25/50%), e ficaram bem mais baratos — agora compensa usar até nas plantas simples. E chegou o CACAU 🍫 (nível 32, 48h), a plantação mais demorada da Roça Feliz.' },
  { v: 122, txt: 'O limite de pegar coisas visitando ficou mais simples: agora é 4 itens da plantação e do pomar juntos (antes eram 3 + 3 separados) e 3 dos animais, por amigo por dia.' },
  { v: 123, txt: 'Fábrica remodelada 🏭: agora são 5 máquinas (Moinho & Padaria, Cozinha do Rio, Conservas, Laticínios e Suqueira), cada uma com seus próprios espaços de produção! O primeiro libera sozinho no nível certo, os outros você compra com moedas. Quem já tinha nível suficiente ganhou os espaços de graça.' },
  { v: 124, txt: 'Roça mais leve pra bateria 🔋: o jogo desenha a tela a 30 quadros por segundo (de sobra pra uma roça) e para de desenhar quando a tela está bloqueada ou em outra aba. E chegou o botão "Jogar sem internet" na entrada: sem sinal, dá pra jogar na hora salvando só neste aparelho, e quando o sinal voltar é só entrar com o Google (aqui ou em ⚙️) que a roça sobe pra nuvem sozinha. Também chegou um toquinho de viola 🎻 quando chega novidade de um amigo.' },
  { v: 125, txt: 'Mais lugares na banca 🏪: além dos 6 de sempre, mais 4 liberam por nível (8, 12, 18 e 25) — e cada amigo de verdade que você tem adianta a liberação em 1 nível, até 5 níveis de desconto!' },
  { v: 126, txt: 'Aviso da pesca mais visível 🐟: quando um ponto de pesca descansar, agora aparece um balãozinho com um peixe em cima do pesqueiro, bem mais fácil de notar.' },
  { v: 128, txt: 'Corrigido: girar o celular (retrato ↔ paisagem) no meio do jogo às vezes deixava a tela desalinhada. Agora reajusta sozinho sempre que a orientação ou o tamanho da tela muda.' },
  { v: 129, txt: 'Sua lista de amigos agora vem ordenada por nível (quem pede ajuda no pomar continua aparecendo primeiro).' },
  { v: 130, txt: 'Notificação de mensagem mais discreta 💬: agora só avisa que um amigo mandou mensagem, sem mostrar o conteúdo na notificação do celular.' },
  { v: 131, txt: 'A tarrafa 🕸️ agora seca separadamente em cada pesqueiro: jogar em um lago não afeta o tempo de espera dos outros. A lista de pesqueiros mostra o tempo da tarrafa de cada um.' },
  { v: 132, txt: 'No modo Mover, chegou o botão 📦 Guardar: dá para mandar o item direto pro inventário sem precisar cancelar e abrir o menu de novo.' },
  { v: 133, txt: 'Corrigido: no celular, rolar a tela pra cima/baixo em cima do lago da pescaria às vezes travava. Agora só trava o toque durante a fisgada e a briga (pra puxar rápido); no resto, dá pra rolar normalmente.' },
  { v: 134, txt: 'Corrigido: a tarrafa tinha parado de funcionar pra quem já jogava antes da última atualização. Agora seca certinho, separada em cada pesqueiro.' },
  { v: 135, txt: 'Corrigido: o avisinho de peixe 🐟 em cima do pesqueiro só aparecia quando o ponto tinha acabado de descansar. Agora aparece sempre que der pra pescar de vara ali, mesmo que você ainda não tenha usado nenhuma pescaria.' },
  { v: 136, txt: 'O avisinho de peixe 🐟 no pesqueiro agora também aparece quando a tarrafa está pronta, não só a vara.' },
  { v: 137, txt: 'A entrada do mato agora também ganha um avisinho 🐾, parecido com o da pescaria: aparece sempre que tem caçada disponível em algum dos seus lugares.' },
  { v: 138, txt: 'Corrigido: no celular, um objeto movido bem pra longe (como a casa) podia ficar cortado na borda da tela, mesmo aparecendo certinho no computador. Agora o enquadramento sempre encolhe a roça o quanto for preciso pra tudo caber.' },
  { v: 139, txt: 'Corrigido: a correção anterior não estava encolhendo o bastante quando um objeto ficava bem longe da grade (o cálculo travava num zoom mínimo que ainda cortava). Agora encolhe de verdade até tudo caber, com casa movida pra direita, pro celular em pé ou não.' },
  { v: 140, txt: 'O selo do botão Negócios agora também avisa quando dá pra fazer algo na fábrica (espaço livre numa máquina + ingrediente na mão), não só quando algo já terminou de produzir ou tem pedido do caminhão pra entregar.' },
  { v: 141, txt: 'Corrigido: a carne de javali, pega na caçada, entrava no celeiro mas não aparecia na lista (só contava no número do selo). Agora aparece certinho, com preço e tudo.' },
  { v: 142, txt: 'Corrigido: o mesmo bug da carne de javali também acontecia com as frutas do pomar — entravam no celeiro e contavam no selo, mas sumiam da lista. Agora aparecem certinho.' },
  { v: 143, txt: 'Broto de cada semente diferenciado desde o primeiro instante que planta, não só depois que já cresceu um pouco.' },
  { v: 144, txt: 'A fileira de pontos de pesca e lugares de caçada agora esmaece na ponta quando tem mais pra rolar, pra não parecer cortada.' },
  { v: 145, txt: 'Corrigido: as mensagens prontas do chat com amigos não rolavam pro lado no toque do celular.' },
  { v: 146, txt: 'Javali e rato bem maiores quando invadem a plantação, pra ficar fácil de ver e tocar neles. E a invasão agora pode acontecer a cada 8 horas, em vez de 12.' },
  { v: 147, txt: 'Cada pesqueiro agora tem seu elenco próprio de peixes, sem repetir espécie de um lugar pro outro. E o 📖 Livro de peixes ganhou um botão pra mostrar só os peixes (e a isca de cada um) do lago onde você está.' },
  { v: 148, txt: 'Foto de perfil nova em ⚙️ › Sua foto: além da do Google, escolha entre ilustrações da Roça Feliz — ovo, milho, vaca e cachorro, de cara, mais três que você libera jogando: dourado (pesque 1 peixe), javali (caçe um) e o raríssimo Chupa-cabra. Quem jogou no primeiro mês ganhou também uma moldura dourada exclusiva na foto.' },
  { v: 149, txt: 'Corrigido: com um tema de casa ativo, todos os abrigos do rancho ficavam da mesma cor. Agora cada bicho mantém a cor e o jeitão do seu abrigo. E o porco não tem mais casinha: só um lamaçal bem grande pra ele se lambuzar, com cocho do lado.' },
  { v: 150, txt: 'Foto de perfil com cara nova: 14 selos coloridos pra escolher (8 de cara, 6 liberando jogando), bem mais bonitos que antes. Toque na sua foto (lá em cima) pra trocar na hora. E chegou a aba Moldura da foto, com a moldura dourada de pioneiro pra quem já tinha ganhado.' },
  { v: 151, txt: 'Trocado o selo do Chupa-cabra: estava parecendo um demônio, agora é um alien 👽.' },
  { v: 152, txt: 'O selo de Alienígena 👽 virou opção separada, e o Chupa-cabra agora é um morcego 🦇. Chegaram 3 molduras grátis pra foto (Campo, Céu e Pôr do sol) além da dourada de pioneiro. E corrigido: quem já era pioneiro de antes agora recebe a moldura dourada.' },
  { v: 153, txt: 'Chegaram 5 molduras novas pra foto, liberando por nível: Flor (nível 5), Girassol (nível 10), Lavanda (nível 15), Borboleta (nível 22) e Arco-íris (nível 30).' },
  { v: 154, txt: 'Molduras da foto redesenhadas: em vez de um anel liso, agora têm galhos, pétalas e nuvens invadindo a foto de um jeito mais criativo. E chegou uma animaçãozinha (com confete!) toda vez que você sobe de nível.' },
  { v: 155, txt: 'A caçada agora deixa material: pássaro solta pena, lebre solta pata e o lendário Chupa-cabra solta presa (além da carne de javali, que já existia). Vendem no celeiro/banca, entram nos pedidos do caminhão, e dá pra fazer cocar, amuleto e colar na nova máquina Artesanato da caçada.' },
  { v: 156, txt: 'As casinhas dos animais não ficam mais presas na grade do rancho: entre no Modo Mover e arraste cada abrigo para onde quiser (sem encostar em outro).' },
  { v: 157, txt: 'Chegou o Bloco de água na Loja › Enfeites: do tamanho de uma plantação, encaixa um do lado do outro e vira um laguinho, com peixinho pulando quando tem pelo menos dois juntos.' },
  { v: 158, txt: 'Se você tiver um laguinho (2+ blocos de água juntos), chegou Celeste, a sucuri: ela anda por perto, entra na água pra pescar, sai com o peixe e come. Clique nela para ver o que está fazendo.' },
  { v: 159, txt: 'Celeste, a sucuri do laguinho, agora leva seu tempo: passeia bem mais antes de entrar na água de novo, pesca com calma e demora pra comer. Menos corrida, mais charme.' },
  { v: 160, txt: 'Os blocos de água ganharam bordas arredondadas: as pontas que ficam pra fora do laguinho agora são curvas, em vez de quadradinhas.' },
  { v: 161, txt: 'Celeste, a sucuri, ficou bem mais fofa: cabeça grande e redonda, olhões brilhantes, bochecha rosada, sorrisinho e uma linguinha que aparece de vez em quando.' },
  { v: 162, txt: 'Corrigido: dava pra notar a divisão entre blocos de água encostados (uma friestinha de grama e o brilho repetido em cada um). Agora ficam bem juntinhos, sem gap, com um brilho só pro laguinho inteiro.' },
  { v: 163, txt: 'Celeste, a sucuri, ganhou um corpo de verdade: uma fita só afunilando da cabeça até a cauda, sem as bolinhas, em tom azul-esverdeado de bicho d\'água.' },
  { v: 164, txt: 'Bloco de água mais barato: agora custa 30 moedas, o mesmo preço da cerca mais em conta.' },
  { v: 165, txt: 'Tirada a Celeste. Os peixinhos do laguinho ficaram maiores e agora nadam de bloco em bloco por todo o laguinho, em vez de pular parados num cantinho só.' },
  { v: 166, txt: 'Área do rancho bem maior pra arrastar os abrigos no Modo Mover, e a câmera agora acompanha se você mandar um bem longe. E não dá mais pra soltar um abrigo em cima do lugar reservado de outro que ainda não foi construído.' },
  { v: 167, txt: 'Casinhas do rancho: agora dá pra girar (casinha, cocho etc. mudam de lado), segurar em cima abre o menu com a opção Mover, e os bichos vão junto quando você move a casinha deles.' },
  { v: 168, txt: 'No Modo Mover chegaram 🗑️ Remover tudo (manda tudo pro inventário de uma vez) e 📐 Layouts (salve até 3 arranjos diferentes de cada cena e aplique quando quiser). Roça e Rancho têm os seus próprios, sem se misturar.' },
  { v: 169, txt: 'Cada layout salvo agora mostra uma fotinha (um mapinha visto de cima com um pontinho colorido por item), pra você reconhecer o arranjo antes de aplicar.' },
  { v: 170, txt: 'Chegou o botão 🧹 Rastelo na roça: clique e o avatar vai sozinho até o monte de folhas mais perto pra rastelar. Sem folha nenhuma, avisa que não tem nada pra fazer agora.' },
  { v: 171, txt: 'Corrigido: na roça, o botão de rastelar folhas estava criando uma barra extra que empurrava os ícones da lateral e ficava tudo sobreposto. Agora ele mora junto com as ferramentas, num só carrossel.' },
  { v: 172, txt: 'Com o celular na vertical, Roça/Rancho/Casa e Presente/Mover voltaram a ficar numa coluna vertical do lado esquerdo (em vez de uma fileira embaixo). E o botão de rastelar folhas trocou a vassoura pelo ícone do rastelo de verdade, agora chamado "Rastelar": clicando sem folha nenhuma, ele avisa em vez de simplesmente ficar apagado.' },
  { v: 173, txt: 'Ajuste fino no celular na vertical: a coluna Roça/Rancho/Casa/Presente/Mover desceu um pouco e a barra de ferramentas subiu um pouquinho, pra ficar mais confortável de alcançar.' },
  { v: 174, txt: 'Corrigido: se algo interrompesse o avatar rastelando (visitar outro amigo, recarregar a página), o monte de folhas ficava preso pra sempre, sem contar como folha e sem dar pra clicar. Agora ele libera sozinho. E o preço das expansões de canteiro mudou para 1.000 moedas por canteiro em qualquer nível.' },
  { v: 175, txt: 'A ferramenta de arrancar plantação/árvore virou "Enxadão" (não tinha por que ter dois "Rastelo" na mesma barra). E corrigido: o clique no Bloco de água estava com uma área grande demais, invadindo os canteiros vizinhos.' },
  { v: 176, txt: 'Agora dá para vender o cachorro de guarda (na casinha ou na Loja › Cães): o preço cai um pouco a cada dia de vida que passa, igual aos outros bichos de companhia.' },
  { v: 177, txt: 'O Enxadão tinha ganhado só o nome novo, mas o ícone continuava sendo o do rastelo. Agora tem o desenho certo (uma lâmina de enxada), separado do ícone do botão Rastelar.' },
  { v: 178, txt: 'Ajustado o ícone do Enxadão: a lâmina estava apontando pro lado errado (na mesma direção do cabo). Agora fica perpendicular ao cabo, do jeito que uma enxada de verdade é.' },
  { v: 179, txt: 'O ícone do Enxadão estava puxado pro lado dentro do círculo. Recentralizado.' },
  { v: 180, txt: 'Clicar de novo no Adubo já selecionado agora troca o tipo (básico → rápido → premium → básico…), pra escolher qual usar sem precisar abrir a Loja.' },
  { v: 181, txt: 'Chegou o botão 🧺 Colher na roça: colhe de uma vez todo canteiro pronto, sem precisar clicar um por um. Sem nada pronto, avisa que não tem nada pra fazer agora.' },
  { v: 182, txt: 'Caçada rendendo mais: todo bicho vale bem mais moedas, e cada entrada no mato agora dá pra caçar 5 vezes (antes eram 3). E chegaram mais peixes pros rios: tuvira e mandubé no Córrego Cascavel e no Rio Meia Ponte, papa-terra no Ribeirão João Leite, tambacu no Rio dos Bois, e a cachara no Rio Amazonas, junto do jaú e da piraíba.' },
  { v: 183, txt: 'Ajustada a caçada: volta a começar com 3 entradas por vez, subindo 1 a cada 6 níveis (a partir do nível 10, quando ela libera) até o máximo de 6.' },
  { v: 184, txt: 'A pescaria agora funciona igual à caçada: começa com 3 pescarias por ponto, subindo 1 a cada 10 níveis (que é quando libera ponto novo) até o máximo de 6.' },
  { v: 185, txt: 'Agora dá para ter até 3 gatos em casa, cada um com um pelo diferente (laranja, cinza e preto). O primeiro que sobrar você compra, o próximo já vem na cor que falta.' },
  { v: 186, txt: 'Seus gatos agora trazem presentinho a cada 12h (novelo de lã, rato caçado, lagartixa seca, sininho perdido ou, raramente, um presente misterioso) direto pro celeiro: vende de 220 a 480 moedas cada.' },
  { v: 187, txt: 'Subir de nível ficou mais festivo: além das moedas de sempre, agora aparece um cartão no meio da tela mostrando os prêmios — moedas, alguns trevos 🍀 (mais conforme o nível sobe) e uma medalha ou troféu que dá pra vender no celeiro.' },
  { v: 188, txt: 'O bônus de moedas ao subir de nível dobrou: agora é nível × 100 (antes era × 50).' },
  { v: 189, txt: 'Atualização grande: ranking global 🌎 (além do de amigos), pena do pavão e ferradura do cavalo pra vender, mais espécies de peixe e de caça (10 em cada lago/mato), mapa maior (14×14, com a terra fora da área comprada marcada visualmente), mais XP pra subir de nível, e o botão 🚜 agora oferece colheita automática e limpeza automática de terra seca. Corrigido o travamento no Rio Amazonas ao abrir o livro de peixes, a animação do rastelo ao ir limpar folhas, e o esconderijo dos bichos na caçada. Frutífera ajudada por um amigo agora rende só mais uma colheita e seca de vez.' },
  { v: 190, txt: 'Negócios › Fábrica: agora toda máquina tem 6 espaços (antes, Laticínios, Suqueira e Artesanato tinham só 2, e Conservas 3). O 1º continua liberando de graça no nível certo; os outros 5 se compram subindo de nível, igual já era.' },
  { v: 191, txt: 'Mais espaço pra decorar: dá pra espalhar enfeite e cerca bem mais longe dos canteiros (na roça) e dos cercados (no rancho), com uma linha pontilhada mostrando até onde vai. E a Terreno ganhou mais 2 expansões (níveis 80 e 90), até dar pra ocupar a roça inteira.' },
  { v: 192, txt: 'Corrigido: não dá mais para colocar enfeite ou cerca lá em cima, onde já é céu. E a área onde dá para construir/decorar (na roça e no rancho) ganhou matinhos espalhados, pra ficar mais bonita e mostrar bem onde é gramado de verdade.' },
  { v: 193, txt: 'Cavalo e pavão: o presentinho deles (ferradura e pena) já era de hora certa (a cada 12h), mas o texto dava a entender que era de vez em quando ou vinha do carinho. Agora mostra direitinho "produzindo · falta Xh" no abrigo, igual aos outros animais, sem misturar com o carinho (que continua dando XP à parte).' },
  { v: 194, txt: 'Canteiro novo não precisa mais encostar nos que você já tem: agora dá para escolher qualquer pedaço livre da sua terra, contanto que tenha vaga comprada na aba Terreno.' },
  { v: 195, txt: 'Tirei a trama escura que marcava a terra sem vaga comprada: agora o gramado fica igual em qualquer lugar da roça.' },
  { v: 196, txt: 'Com o celular em pé, agora dá para dar bem mais zoom. E em qualquer tela, dá para arrastar bem mais para os lados.' },
  { v: 197, txt: 'Agora dá para pegar um pouquinho de qualquer quantidade de amigos por dia, não só de 5. E chegou a amizade ❤️ entre vocês: ajude ou presenteie seus amigos para ela subir, e os presentes que você manda ficam melhores (mais moedas, mais fertilizante, mais ração) a cada nível.' },
  { v: 198, txt: 'Corrigido: em alguns lugares dentro da área permitida, o canteiro novo sumia ao ser colocado (a trilha da caçada escondia ele). Agora o jogo não deixa mais colocar canteiro em cima dela nem de outras construções fixas.' },
  { v: 199, txt: 'A área onde dá para colocar enfeite é bem maior que a área da terra de canteiros (que fica presa à grade da roça) — agora uma segunda linha pontilhada, mais escura, mostra até onde a terra vai, e a mensagem de erro avisa quando você tenta mover um canteiro pra fora dela.' },
  { v: 200, txt: 'A roça cresceu de 14×14 para 28×28: agora a terra de canteiros ocupa a mesma área onde já dava para colocar enfeite, então dá para espalhar canteiro por praticamente qualquer lugar do mapa. A aba Terreno ganhou mais 6 expansões (até o nível 175) para dar conta do tamanho novo.' },
  { v: 201, txt: 'Tirei de vez a margem extra que só dava pra enfeite na roça: agora o limite de decoração é exatamente o mesmo limite do mapa da terra de canteiros, um limite só, sem confusão. (No rancho continua havendo uma margem além dos cercados, que não mudam de tamanho.)' },
  { v: 202, txt: 'Reorganizei as expansões de terreno: agora o máximo é 80 canteiros, numa progressão mais equilibrada (sempre uns +10 a +14 por expansão) até o nível 50. Quem já tinha mais que 80 não perde nenhum canteiro — só para de liberar vaga nova até o limite valer de novo.' },
  { v: 203, txt: 'A área de construção da roça dobrou de tamanho (28×56, não mais quadrada) — bem mais espaço pra espalhar canteiro e enfeite, sem chegar perto do céu.' },
  { v: 204, txt: 'O mapa aumentou de novo: a roça (terreno e plantação) ficou com mais espaço ainda (28×84), e o rancho também — a área pra espalhar enfeite e mover os cercados dobrou.' },
  { v: 205, txt: 'O mapa da roça virou quadrado: agora é 64×64, bem maior que antes.' },
  { v: 206, txt: 'Corrigido o zoom/arrastar da roça: a câmera estava se afastando demais pra tentar mostrar todo canteiro que dava pra comprar (o que virou o mapa inteiro depois que ele cresceu), deixando tudo pequeno e o deslize estranho. Agora ela enquadra só a terra que você já tem, do jeito que era antes.' },
  { v: 214, txt: 'O banco de madeira agora gira de verdade: de frente, de lado, de costas e do outro lado, visto de perfil (no modo Mover, toque em Girar).' },
  { v: 212, txt: 'A placa de expansão de terrenos agora cresce e diminui junto com a roça no zoom, igual ao celeiro e à casa: fica sempre do mesmo tamanho em relação ao terreno.' },
  { v: 210, txt: 'Agora o giro dá a volta completa: 4 posições, de 90° em 90°. Casa, celeiro e casinha do cachorro mostram os fundos (sem a porta e as janelas da frente) nos giros 2 e 3; árvores e decorações viram para o outro lado.' },
  { v: 209, txt: 'Agora dá pra girar 90° as construções (casa, celeiro, casinha do cachorro, pesqueiro, árvores) e as decorações: no modo Mover, pegue o item e toque em Girar (ou aperte R). As casas dos bichos já giravam; as cercas continuam como estavam. E a placa de expansão de terrenos agora tem tamanho fixo: não aumenta nem diminui mais com o zoom.' },
  { v: 208, txt: 'A área da roça agora tem o mesmo formato da do rancho: a fazenda fica lá no alto, no meio, e o terreno abre pros dois lados e pra frente, cortado reto pelo céu. E o arrastar foi refeito: com qualquer zoom dá pra ir até a beirada da área (esquerda, direita, frente e até o céu), e ao mudar de direção a tela responde na hora, sem ficar presa.' },
  { v: 207, txt: 'O arrastar da tela na roça agora segue a mesma lógica do rancho: a folga de deslizar bate certinho com o tamanho de verdade do que está na tela (antes ficava sempre do tamanho da janela, sem ligação com o zoom, e o deslize ficava esquisito).' },
  { v: 115, txt: 'Plantações mais brasileiras 🇧🇷: o nabo virou FEIJÃO (quem tinha nabo agora tem feijão) e a pera virou SOJA. Chegaram arroz, couve, amendoim, cana-de-açúcar e algodão, e as receitas Arroz com feijão, Paçoca e Rapadura. Cada planta agora tem o seu broto enquanto cresce. No pomar, a pitangueira virou árvore e chegou a framboeseira, e cada frutífera ganhou o seu jeito.' },
  { v: 114, txt: 'Cercas e porteiras 🚪: na Loja › Enfeites agora tem vários tipos de cerca (arame farpado, branca, bambu, azul, com roseiras e muro de pedra) e porteiras (de madeira, branca e portão de ferro). A porteira ocupa um pedaço da cerca e gira igual.' },
  { v: 113, txt: 'Loja mais esperta 📦: se você já tem o enfeite, a cerca ou a frutífera no Inventário, a Loja mostra quantos tem e o botão usa o do inventário primeiro (dá para comprar mais no botãozinho +).' },
  { v: 112, txt: 'Mudanças na caçada e nas pragas: a Caçada agora libera no nível 10. Pragas na plantação só aparecem no máximo uma vez a cada 12 horas, com você na roça: toca um alarme, a tela fica vermelha e você vê o bicho chegando. O cachorro de guarda corre atrás dele, e tem a nova 🪤 Armadilha de pragas (Loja › Itens), que pega um bicho por vez e depois recarrega.' },
  { v: 111, txt: 'Caçada ainda melhor 🎯: cada bicho novo vira uma 📷 foto no mural da sua casa (uma por bicho). Dá para ter uma 2ª arapuca e escolher a isca: milho, quirera (atrai bicho incomum) ou fruta do pomar (atrai os raros). Cada bicho tem seu domínio ★ com estrelas e trevos. E, de vez em quando, um rato ou javali entra na plantação: clique para espantar! Se ninguém espantar, ele come só um pouquinho de 1 ou 2 plantas. Com o cachorro da roça de guarda, isso quase não acontece.' },
  { v: 110, txt: 'Chegou a CAÇADA 🎯 (a partir do nível 10)! Clique na trilha do mato na sua roça. Cace pragas com o estilingue e a espingarda (rato, pombo, pardal, lebre-europeia, javali, javaporco… e o lendário CHUPA-CABRA, que anda pela Serra Dourada e pela Chapada, mais à noite 👀). Arme a 🪤 arapuca com milho para pegar bichos do mato (preá, tatu, paca, mutum…): eles vão para o Livro da caçada e são soltos. Tem lugares para comprar, domínio de caçada, trevos, missões e conquistas.' },
  { v: 108, txt: 'A motosserra ganhou desenho de motosserra de verdade (antes aparecia um serrote).' },
  { v: 107, txt: 'Correio: agora dá para apagar cada carta (✕) ou todas de uma vez, e as cartas somem sozinhas depois de 7 dias. Na conversa com amigos tem o botão 🧹 Limpar.' },
  { v: 106, txt: 'Canteiros se mudam como o resto: segure o dedo (ou botão direito) em cima de um e escolha Mover. A placa de terras à venda agora fica no lugar dela, e também dá para mudar de lugar.' },
  { v: 105, txt: 'Pomar com limite: até 4 de cada arbusto e 3 de cada árvore (contando as do inventário). Derrubou uma seca? Libera para comprar outra.' },
  { v: 104, txt: 'Pomar ainda mais barato: enxada 50, motosserra 100 e frutíferas que rendem mais de 2,5× o preço. E chegou o 🌳 Domínio do pomar: colher frutas (e ajudar as dos amigos) sobe o nível, que dá mais frutas por colheita, mais colheitas antes de secar e trevos para resgatar.' },
  { v: 103, txt: 'Na Loja, "Mudas" virou Horta e o Pomar ficou do lado. Os montes de folhas brilham e têm o rastelo em cima. E o botão 🆘 Precisa de ajuda leva direto para a roça (ou o rancho) do amigo, com a frutífera marcada.' },
  { v: 102, txt: 'Pomar mais barato 🍊: frutíferas e ferramentas custam bem menos, e cada frutífera agora dá 3 colheitas (não morre mais por dias). Depois da última, ela seca: toque nela e ponha a 🪧 placa de ajuda. Todos os seus amigos são avisados e, quando um ajudar, ela volta a dar frutas. Na lista de Amigos, o botão 🆘 Precisa de ajuda fica colorido quando um amigo está pedindo. Ajudar frutífera não conta no limite do dia.' },
  { v: 101, txt: 'Canteiros e cercas 🚧: no botão Mover agora dá para mudar os canteiros de lugar (vão com o que estiver plantado). A cerca em volta da roça saiu: compre pedaços de cerca na Loja › Enfeites e ponha onde quiser (quem já jogava ganhou 40 de presente, estão no Inventário). O estilo da cerca segue o tema da roça. O rancho continua igual.' },
  { v: 100, txt: 'Montes de folhas 🍂: de vez em quando cai um monte de folhas no gramado (no outono, bem mais). Clique nele e o seu avatar vai lá rastelar: ganha XP e umas moedinhas!' },
  { v: 97, txt: 'Pomar 🌳: as árvores de enfeite saíram e chegaram as frutíferas! Compre na Loja › Pomar pitangueira, amoreira, maracujazeiro, jabuticabeira, mangueira, cajueiro e pequizeiro, e plante no gramado (agora dá para pôr enfeites e frutíferas no gramado dentro da cerca, fora da terra comprada). Elas dão frutas e secam depois de uns dias: arbusto seco sai com a 🪓 enxada de arrancar e árvore seca com a motosserra, que você ganha completando missões, de amigos ou comprando.' },
  { v: 93, txt: 'O tema da casa agora vale também para a casinha do cachorro e para os abrigos dos bichos no rancho: tudo combinando!' },
  { v: 91, txt: 'Loja do Trevo 🍀 cheia de novidades: chapéu de cangaceiro, boina, panamá, gorro, sanfona, buquê, regador dourado, ipê-amarelo, fogueira de São João, balanço, carro de boi, as casas Lavanda, do Cerrado e Estrelada, a música Seresta ao Luar e itens úteis (iscas, ração especial, tarrafa e pontos de pesca prontos na hora).' },
  { v: 90, txt: 'Chegaram os Trevos 🍀, a moeda verde da roça! Ganhe resgatando cada peixe novo no 📖 Livro de peixes, os níveis do domínio de pesca e as conquistas (Missões › 🍀 Trevos). O que você já fez também vale: é só resgatar! Troque na Loja do Trevo por itens exclusivos: chapéus, lampião, músicas, enfeites e temas de casa.' },
  { v: 88, txt: 'Visual caprichado: abrigos, casinha do cachorro e enfeites com mais detalhes; animais maiores e mais fáceis de clicar; e a roça aparece mais perto na tela.' },
  { v: 87, txt: 'Casa e celeiro de cara nova 🏡: desenho novo, com telhado, chaminé, floreiras e celeiro de telhado quebrado. Clique na sua casa para entrar ou trocar o tema: Chalé de madeira, Casarão colonial, Casa Girassol, Casa da Vovó e Casa de pedra.' },
  { v: 85, txt: 'Pescaria mais prática 🎣: depois de fisgar, é só tocar quando o anel em volta do peixe ficar VERDE. Peixe comum precisa de 2 puxadas certas, raro de 3 e lendário de 4. Errou? Perde um pouquinho, e o peixe só escapa com 3 erros seguidos.' },
  { v: 79, txt: 'Novo ponto de pesca: 🔄 Pesque e Solte (libera no nível 5, de graça)! Fica sempre aberto e não gasta isca: pesque quanto quiser. Mas é pesque e solte: cada peixe volta para o rio e dá só 10 moedas e 1 XP. Ele NÃO vai para o celeiro, o livro de peixes, as conquistas, as missões nem o domínio de pesca.' },
  { v: 78, txt: 'Peixes de Goiás 🐟: chegaram 15 espécies novas, como cará, piau, mandi, curimbatá, cascudo, piranha, corvina, matrinxã, peixe-cachorra, aruanã, barbado, tambaqui, pirarara, jaú e piraíba. Alguns só aparecem nos rios grandes: veja no 📖 Livro de peixes onde cada um morde.' },
  { v: 77, txt: 'Mais pescaria: agora cada ponto de pesca dá 3 pescarias de vara antes de descansar (a tarrafa continua igual).' },
  { v: 75, txt: 'Domínio de pesca 🎖️: cada peixe pego dá pontos (os raros valem mais). A cada nível de domínio, a espera da vara e da tarrafa cai 5%, até 45% no nível 10. Os peixes que você já pegou contam!' },
  { v: 74, txt: 'Os pontos de pesca ganharam nomes de verdade: Córrego Cascavel (nível 5), Rio Meia Ponte (10), Ribeirão João Leite (15), Rio dos Bois (20), Rio Araguaia (25) e Rio Amazonas (30), cada um com seu cenário.' },
  { v: 71, txt: 'Pontos de pesca 🎣: cada ponto dá uma pescaria a cada 2 horas. Além do pesqueiro de casa, compre o Córrego Cascavel (nível 5), o Rio Meia Ponte (10), o Ribeirão João Leite (15), o Rio dos Bois (20), o Rio Araguaia (25) e o Rio Amazonas (30): quanto mais longe, mais peixe raro. E chegou a tarrafa 🕸️: pega 3 peixes de uma vez, uma vez a cada 12 horas.' },
  { v: 70, txt: 'Clique na casinha do cachorro para trocar o nome dele. E o gato ganhou uma caminha na sala: clique nela para trocar o nome do bichano.' },
  { v: 69, txt: 'Venda animais direto no abrigo: clique na casa deles, e cada bicho da lista tem o botão Vender.' },
  { v: 69, txt: 'Itens novos para o avatar que liberam por nível: facão (5), foice (10), laço (15), viola (20) e machado (25). Escolha em ⚙️ › Seu avatar › Na mão.' },
  { v: 69, txt: 'Música nova: "Rock na Porteira", um rock rural com guitarra, bateria e viola. Troque em ⚙️ › Música.' },
  { v: 68, txt: 'Dá para trocar o nome de todos os animais e dos cachorros por 50 moedas: toque em Nome no abrigo, na Loja › Animais ou na Loja › Cachorros. O nome de quem acabou de chegar continua de graça.' },
  { v: 67, txt: 'Visitas mais vivas: na roça dos amigos (e do Seu Zé e da Dona Maria), o avatar do dono também passeia. Clique nele para ouvir o que ele tem a dizer!' },
  { v: 66, txt: 'Nomes: dar o primeiro nome para a fazenda e para o avatar continua grátis; para trocar um nome depois, custa 100 moedas (em ⚙️ › Nomes).' },
  { v: 65, txt: 'Peixe novo ✨: quando pegar um peixe pela primeira vez, aparece o selo NOVO! e ele fica marcado no 📖 Livro de peixes. A dica da isca mostra com ✨ os que você ainda não pegou.' },
  { v: 63, txt: 'Agora são 5 missões diárias, com tipos novos: pescar, pegar peixe raro, cozinhar peixe, atender a vila, visitar roças e mais.' },
];
const VERSAO_NUM = Number(document.querySelector('meta[name="rf-version"]')?.content) || 0;
function checarNovidades() {
  if (!state) return;
  const ultima = NOVIDADES.reduce((m, n) => Math.max(m, n.v), 0);
  // quem já jogava antes desta carta existir recebe só as novidades mais recentes
  if (state.novVisto == null) state.novVisto = 56;
  const novas = NOVIDADES.filter(n => n.v > state.novVisto && n.v <= Math.max(VERSAO_NUM, ultima));
  if (!novas.length) return;
  const agora = Date.now();
  novas.forEach((n, k) => { state.news.unshift({ at: agora + k, msg: '📰 Novidade na Roça Feliz: ' + n.txt }); });
  state.news.length = Math.min(state.news.length, 30);
  state.novVisto = ultima; save(); renderTabs();
  setTimeout(() => toast(`📬 Chegou ${novas.length > 1 ? `${novas.length} cartas novas` : 'uma carta nova'} no correio: novidades do jogo!`, 'good'), 2500);
}
// Cartas do correio ficam no máximo 7 dias (e as 30 mais novas); dá para apagar antes.
const NEWS_DIAS = 7;
function podarNews() { const lim = Date.now() - NEWS_DIAS * 86400e3; state.news = state.news.filter(n => n.at > lim).slice(0, 30); }
function addNews(msg) {
  state.news.unshift({ at: Date.now(), msg });
  podarNews();
  renderTabs();
}
function tickLife() {
  const now = Date.now();
  let changed = false;
  for (const a of state.animals.slice()) {
    if (lifeLeft(a) > 0) continue;
    const d = ANIMAL[a.k];
    state.animals = state.animals.filter(x => x !== a); delete amb[a.id];
    const msg = `${seuSua(d)} viveu ${d.periodo} dias e foi embora. Compre ${d.f ? 'outra' : 'outro'} na loja.`;
    addNews(msg); toast(msg);
    changed = true;
  }
  for (const slot of ['roca', 'animais']) {
    const d = state.dogs[slot];
    if (!d) continue;
    const b = DOG[d.raca];
    if (!dogAlive(d)) {
      state.dogs[slot] = null;
      const msg = `${d.nome} ficou velhinho e foi descansar. ${SLOT[slot].A} está sem cachorro.`;
      addNews(msg); toast(msg); changed = true;
      continue;
    }
    const days = Math.floor((now - d.lastXp) / DAY);
    if (days >= 1) {
      const n = Math.min(days, 3) * b.xpDia;
      d.lastXp += days * DAY;
      addXP(n, null);
      addNews(`${d.nome} vigiou ${SLOT[slot].aSua} e rendeu +${n} XP.`);
      changed = true;
    }
  }
  if (changed) done();
}

// Clicar num abrigo abre a janela dele: quem mora lá, aumentar o abrigo e comprar bichos.
let abrigoSel = null;
function actAbrigo(id) {
  if (!isHome()) return toast(`${ABRIGO[id].nome} de ${view.nome}.`);
  abrigoSel = id;
  openPanel('abrigo');
}
const credBtn = k => { const c = (state.animalCred || {})[k] || 0; return c > 0 ? `<button class="btn gold" data-buy-animal="${k}">Resgatar${c > 1 ? ` (${c})` : ''}</button>` : '<button class="btn ghost" disabled>Não se compra</button>'; };
function abrigoHTML() {
  const b = ABRIGO[abrigoSel], lv = abrigoLv(state, b.id);
  if (!lv) return `<div class="row"><img alt="" src="${abrigoIcon(b.id)}"><div><div class="name">${b.nome}</div><div class="meta">Ainda não foi construíd${b.o}. Para: ${b.bichos.map(k => ANIMAL[k].nome.toLowerCase()).join(', ')}.</div></div>
    ${state.level < b.nivel ? `<button class="btn" disabled>Nível ${b.nivel}</button>` : `<button class="btn gold" data-abrigo="${b.id}" ${state.coins < b.precos[0] ? 'disabled' : ''}>${b.precos[0] ? moeda(b.precos[0]) : 'Grátis'}</button>`}</div>`;
  const moram = livesIn(state, b.id), cap = ABRIGO_CAP[lv], nivelUp = lv < 3 ? b.nivel + ABRIGO_NIVEL[lv + 1] : 0;
  let html = `<div class="row sel"><img alt="" src="${abrigoIcon(b.id)}"><div><div class="name">${b.nome} · nível ${lv}</div><div class="meta">${moram.length} de ${cap} animais${lv < 3 ? ` · nível ${lv + 1} cabe ${ABRIGO_CAP[lv + 1]}` : ' · nível máximo'}</div></div>
    ${lv >= 3 ? '<div></div>' : state.level < nivelUp ? `<button class="btn" disabled>Nível ${nivelUp}</button>` : `<button class="btn" data-abrigo="${b.id}" ${state.coins < b.precos[lv] ? 'disabled' : ''}>Aumentar<br><small>${b.precos[lv].toLocaleString('pt-BR')}</small></button>`}</div>`;
  html += `<h3>Quem mora aqui</h3>`;
  if (!moram.length) html += `<div class="empty">Ninguém ainda. Resgate um animal aqui embaixo!</div>`;
  for (const a of moram) {
    const d = ANIMAL[a.k];
    const st = d.tipo === 'prod' ? (a.ready ? 'produto pronto!' : a.fed ? 'produzindo' : 'com fome') + ` · vive mais ${vida(lifeLeft(a))}`
      : d.tipo === 'cria' ? (isAdult(a) ? 'adulto, pronto para vender' : `crescendo · falta ${fmt(d.tempo - a.g)}`)
      : PET_PRESENTES[a.k] ? (a.presenteProx && a.presenteProx <= Date.now() ? 'presente pronto! 🎁' : `produzindo · falta ${fmt(((a.presenteProx || Date.now() + GATO_PRESENTE_MS) - Date.now()) / 1000)}`) : 'companhia';
    const armed = buyPending && buyPending.i === 'venda' + a.id && performance.now() < buyPending.until;
    html += `<div class="row"><img alt="" src="${animalIcon(d.id)}"><div><div class="name">${esc(a.nome || d.nome)}</div><div class="meta">${d.nome} · ${st}</div></div>
      <div class="stack"><button class="btn ghost" data-renomear="${a.id}">Nome<br><small>${moeda(CUSTO_NOME_BICHO)}</small></button>
      <button class="btn ${armed ? 'danger' : isAdult(a) ? 'gold' : 'ghost'}" data-sell-animal="${a.id}" title="Vender">${armed ? 'Confirmar' : 'Vender ' + moeda(precoVenda(a))}</button></div></div>`;
  }
  html += `<h3>Animais para ${b.o === 'a' ? 'a' : 'o'} ${b.nome.toLowerCase()}</h3>`;
  for (const k of b.bichos) {
    const d = ANIMAL[k], locked = d.nivel > state.level, cheio = moram.length >= cap;
    const info = d.tipo === 'prod' ? `ração ${d.racao} · ${PRODUCT[d.prod] ? PRODUCT[d.prod].nome.toLowerCase() : 'leitões'} a cada ${fmt(d.tempo)} · vive ${d.periodo} dias`
      : d.tipo === 'cria' ? `cresce em ${fmt(d.tempo)} e vende por ${d.venda.toLocaleString('pt-BR')}`
      : PET_PRESENTES[k] ? `dá ${PET_PRESENTES[k][0].nomePl || PET_PRESENTES[k][0].nome.toLowerCase()} a cada ${fmt(GATO_PRESENTE_MS / 1000)} para vender · companhia (carinho dá XP à parte)` : 'companhia · carinho dá XP';
    html += `<div class="row ${locked ? 'locked' : ''}"><img alt="" src="${animalIcon(k)}"><div><div class="name">${d.nome}</div><div class="meta">${info}</div></div>
      ${locked ? `<button class="btn" disabled>Nível ${d.nivel}</button>` : cheio ? '<button class="btn ghost" disabled>Cheio</button>' : credBtn(k)}</div>`;
  }
  return html;
}
function actDecor(id) {
  const m = emUso(S(), id);
  if (!isHome()) return toast(`${m ? m.nome : DECO[id].nome} de ${view.nome}.`);
  openPanel('loja', 'decor');
  toast(m ? `${m.nome}: +${m.conforto}% de XP. Na Loja você pode trocar o modelo.` : `Escolha ${LUGAR_NOME[id].toLowerCase()} na Loja para este lugar.`);
}

function buyAnimal(k) {
  const d = ANIMAL[k];
  if (!((state.animalCred || {})[k] > 0)) return toast(`${d.nome} não se compra: ganhe em missões, de amigos, chocando ovos ou ao subir de nível.`, 'bad');
  if (PET_MAX[k]) { if (state.animals.filter(a => a.k === k).length >= PET_MAX[k]) return toast(`Você já tem o máximo de ${PET_MAX[k]} ${d.nome.toLowerCase()}s.`); }
  else if (d.lugar === 'casa' && state.animals.some(a => a.k === k)) return toast(`Você já tem ${d.f ? 'uma' : 'um'} ${d.nome.toLowerCase()} em casa.`);
  else if (d.tipo !== 'pet') {
    const qtd = state.animals.filter(a => a.k === k).length;
  }
  if (state.level < d.nivel) return toast(`${d.nome} libera no nível ${d.nivel}.`);
  const ab = d.lugar !== 'casa' && abrigoOf(k);
  if (ab && !abrigoLv(state, ab.id)) return toast(`${d.nome} precisa de um${ab.o === 'a' ? 'a' : ''} ${ab.nome.toLowerCase()}. Construa na aba Abrigos.`, 'bad');
  if (ab && vagas(state, ab.id) <= 0) return toast(`${ab.o === 'a' ? 'A' : 'O'} ${ab.nome.toLowerCase()} está ${ab.o === 'a' ? 'cheia' : 'cheio'}. Aumente na aba Abrigos.`, 'bad');
  state.animalCred[k]--;
  const novo = newAnimal(k);
  if (k === 'gato') {
    const usadas = state.animals.filter(a => a.k === 'gato').map(a => a.cor);
    novo.cor = (GATO_CORES.find(c => !usadas.includes(c.id)) || GATO_CORES[0]).id;
  }
  if (PET_PRESENTES[k]) novo.presenteProx = Date.now() + GATO_PRESENTE_MS;
  state.animals.push(novo);
  sfx('buy');
  addXP(4, null);
  toast(d.lugar === 'casa' ? `${d.nome} chegou em casa!` : `${d.nome} chegou ${ab.o === 'a' ? 'na' : 'no'} ${ab.nome.toLowerCase()}!`, 'good');
  if (isHome()) setScene(d.lugar === 'casa' ? 'casa' : 'animais');
  done();
  askName(novo);
}
// Janelinha para dar nome ao bicho que acabou de chegar.
const NOMES = { f: ['Mimosa', 'Estrela', 'Pintada', 'Florzinha', 'Malhada', 'Belinha', 'Dona Chica', 'Pipoca', 'Jujuba', 'Violeta'],
  m: ['Bidu', 'Tonico', 'Pingo', 'Faísca', 'Zé Pequeno', 'Chiquinho', 'Barão', 'Bolota', 'Paçoca', 'Trovão'] };
// O nome de quem acabou de chegar é de graça; trocar depois custa CUSTO_NOME_BICHO (animais e cachorros).
const CUSTO_NOME_BICHO = 50;
let nomeDe = null;   // { animal: id } ou { dog: slot }, com troca: true quando é renomear (pago)
function askName(a) {
  const d = ANIMAL[a.k], l = NOMES[d.f ? 'f' : 'm'];
  nomeDe = { animal: a.id, troca: false };
  $('#nomeImg').src = petIcon(a);
  $('#nomeTxt').textContent = `${d.f ? 'Sua nova' : 'Seu novo'} ${d.nome.toLowerCase()} chegou! Como ${d.f ? 'ela' : 'ele'} vai se chamar?`;
  $('#nomeInput').value = l[Math.floor(Math.random() * l.length)];
  abrirNome();
}
function abrirNome() {
  const btn = $('#nomeForm button');
  btn.textContent = nomeDe.troca ? `Salvar · ${CUSTO_NOME_BICHO} moedas` : 'Salvar';
  btn.disabled = nomeDe.troca && state.coins < CUSTO_NOME_BICHO;
  $('#nomeCusto').hidden = !nomeDe.troca;
  $('#nomeCusto').textContent = state.coins < CUSTO_NOME_BICHO ? `Trocar o nome custa ${CUSTO_NOME_BICHO} moedas. Faltam ${CUSTO_NOME_BICHO - state.coins}.` : `Trocar o nome custa ${CUSTO_NOME_BICHO} moedas.`;
  $('#nome').hidden = false; $('#nomeInput').select(); $('#nomeInput').focus();
}
function trocarNome(alvo) {
  if (!isHome()) return;
  if (alvo.animal) {
    const a = state.animals.find(x => x.id === alvo.animal); if (!a) return;
    const d = ANIMAL[a.k];
    $('#nomeImg').src = petIcon(a);
    $('#nomeTxt').textContent = `Qual vai ser o novo nome de ${a.nome || d.nome} (${d.nome.toLowerCase()})?`;
    $('#nomeInput').value = a.nome || d.nome;
  } else {
    const c = state.dogs[alvo.dog]; if (!c) return;
    $('#nomeImg').src = dogIcon(c.raca);
    $('#nomeTxt').textContent = `Qual vai ser o novo nome de ${c.nome}, que vigia ${SLOT[alvo.dog].a}?`;
    $('#nomeInput').value = c.nome;
  }
  nomeDe = Object.assign({ troca: true }, alvo);
  abrirNome();
}
function saveName(e) {
  if (e) e.preventDefault();
  if (!nomeDe) return;
  const v = limpaNome($('#nomeInput').value).slice(0, 18);
  const a = nomeDe.animal && state.animals.find(x => x.id === nomeDe.animal), c = nomeDe.dog && state.dogs[nomeDe.dog];
  const atual = a ? a.nome : c ? c.nome : '';
  if (!v || !(a || c)) return fecharNome();
  if (nomeDe.troca) {
    if (v === atual) return fecharNome();
    if (state.coins < CUSTO_NOME_BICHO) { sfx('error'); return toast(`Trocar o nome custa ${CUSTO_NOME_BICHO} moedas.`, 'bad'); }
    state.coins -= CUSTO_NOME_BICHO; sfx('buy');
  }
  if (a) { a.nome = v; toast(nomeDe.troca ? `Agora ${ANIMAL[a.k].f ? 'ela' : 'ele'} se chama ${v}! (−${CUSTO_NOME_BICHO} moedas)` : `Bem-vind${ANIMAL[a.k].f ? 'a' : 'o'}, ${v}!`, 'good'); }
  else { c.nome = v; toast(`Agora o cachorro se chama ${v}! (−${CUSTO_NOME_BICHO} moedas)`, 'good'); }
  done(); fecharNome(); renderPane();
}
function fecharNome() { $('#nome').hidden = true; nomeDe = null; }
// Constrói um abrigo ou aumenta o nível dele.
function buyAbrigo(id) {
  const b = ABRIGO[id], lv = abrigoLv(state, id);
  if (lv >= 3) return toast(`${b.nome} já está no nível máximo.`);
  const preco = b.precos[lv], nivel = b.nivel + ABRIGO_NIVEL[lv + 1];
  if (state.level < nivel) return toast(`${lv ? 'Aumentar' : 'Construir'} ${b.o} ${b.nome.toLowerCase()} libera no nível ${nivel}.`);
  if (state.coins < preco) return toast(`Faltam moedas: custa ${preco.toLocaleString('pt-BR')}.`, 'bad');
  state.coins -= preco; state.abrigos[id] = lv + 1;
  sfx('buy'); addXP(lv ? 10 : 15, null);
  toast(lv ? `${b.nome} no nível ${lv + 1}: agora cabem ${ABRIGO_CAP[lv + 1]} animais!` : `${b.nome} construíd${b.o}! Cabem ${ABRIGO_CAP[1]} animais.`, 'good');
  if (isHome()) setScene('animais');
  done();
}
function buyDecor(id) {
  const d = MODELO[id];
  if (!d || state.decorTem[id]) return;
  if (state.level < d.nivel) return toast(`${d.nome} libera no nível ${d.nivel}.`);
  if (state.coins < d.custo) return toast(`${d.nome} custa ${d.custo} moedas.`, 'bad');
  state.coins -= d.custo; state.decorTem[id] = true; state.decor[d.lugar] = id;
  sfx('buy');
  addXP(3, null);
  toast(`${d.nome} na sua casa! Agora você ganha +${comfort(state)}% de XP.`, 'good');
  if (isHome()) setScene('casa');
  done();
}
function usarDecor(id) {
  const d = MODELO[id]; if (!d || !state.decorTem[id]) return;
  state.decor[d.lugar] = id; sfx('buy');
  toast(`${d.nome} em uso. Conforto: +${comfort(state)}% de XP.`, 'good');
  if (isHome()) setScene('casa');
  done();
}

function sell(id, qtd) {
  const it = item(id), q = state.barn[id] || 0; if (!q || !it) return;
  const n = qtd === true ? q : clamp(Math.round(qtd) || 1, 1, q);
  const vai_zerar = (q - n === 0);
  if (vai_zerar && PRODUCE[id]) {
    const crop = PRODUCE[id].planta ? CROP[PRODUCE[id].planta] : null;
    if (crop) {
      const msg = `Vai vender todas as ${it.nome.toLowerCase()}. Deixar alguma quantidade para plantar?`;
      if (!confirm(msg)) return;
    }
  }
  state.barn[id] = q - n; if (!state.barn[id]) delete state.barn[id];
  state.coins += n * it.preco; state.stats.vendido += n * it.preco; track('vender', n * it.preco);
  sfx('coin');
  done();
}
function sellAll() {
  let total = 0, avisos = [];
  for (const [id, q] of Object.entries(state.barn)) {
    if (state.bloqueados && state.bloqueados[id]) continue;
    const it = item(id);
    if (!it) continue;
    total += q * it.preco;
    if (PRODUCE[id] && PRODUCE[id].planta) {
      const crop = CROP[PRODUCE[id].planta];
      if (crop) avisos.push(crop.nome);
    }
  }
  if (!total) return toast('Nenhum produto desbloqueado para vender.', 'bad');
  if (avisos.length > 0) {
    const msg = `Vai vender tudo. Isso vai zerar as colheitas de:\n${avisos.join(', ')}\n\nTem certeza?`;
    if (!confirm(msg)) return;
  }
  for (const [id] of Object.entries(state.barn)) {
    if (!(state.bloqueados && state.bloqueados[id])) delete state.barn[id];
  }
  state.coins += total; state.stats.vendido += total; track('vender', total);
  sfx('coin');
  toast(`Vendeu ${moeda(total)}`, 'good');
  done();
}

// ============================================================
// Visitas (vizinhos da vila e amigos de verdade)
// ============================================================
function genNeighbor() {
  const plots = Array.from({ length: N }, () => emptyPlot());
  const count = 12 + Math.floor(Math.random() * 16);
  for (const i of ORDER.slice(0, count)) {
    const pool = CROPS.filter(c => c.nivel <= Math.max(5, state.level + 3));
    const crop = pool[Math.floor(Math.random() * pool.length)];
    if (Math.random() < 0.12) { plots[i] = emptyPlot('plowed'); continue; }
    const mature = Math.random() < 0.5, bug = Math.random() < 0.08;
    plots[i] = Object.assign(emptyPlot('growing'), {
      c: crop.id, id: newId(),
      g: mature ? crop.tempo : crop.tempo * rand(0.15, 0.95),
      b: bug ? 1 : 0,
      dry: !bug && !mature && Math.random() < 0.25,
      podre: mature && Math.random() < 0.2, // algumas esquecidas: dá para ajudar a salvar
    });
  }
  const animals = [];
  const nA = 3 + Math.floor(Math.random() * 5);
  for (let k = 0; k < nA; k++) {
    const pool = ANIMALS.filter(x => x.tipo === 'prod' && x.prod !== 'leitao');
    const a = newAnimal(pool[Math.floor(Math.random() * pool.length)].id), r = Math.random();
    if (r < 0.45) { a.ready = true; a.fed = false; a.g = ANIMAL[a.k].tempo; }
    else if (r < 0.7) { a.fed = false; }
    else a.g = ANIMAL[a.k].tempo * rand(0.1, 0.9);
    animals.push(a);
  }
  const decor = {};
  for (const d of DECOR) if (Math.random() < 0.55) decor[d.id] = true;
  return ensureAbrigos({ plots, animals, decor, banca: npcBanca(), refreshAt: Date.now() + 4 * 60 * 1000 });
}

// Tela de carregamento de uns 3 segundos ao ir ou voltar da roça de alguém.
const CARREGA_MS = 3000;
let carregaTimer = 0;
const espera = ms => new Promise(r => setTimeout(r, ms));
// A carroça leva o seu avatar até a roça do vizinho (e traz de volta, no caminho inverso).
function telaCarregando(txt, ms = CARREGA_MS, nome = 'Vizinho', volta = false) {
  const el = $('#loading'); if (!el) return;
  $('#loadingTxt').textContent = txt;
  const ini = performance.now(), ativo = viagem;
  viagem = { ini, fim: ini + CARREGA_MS, nome, volta, espera: !ms };
  if (!ativo) requestAnimationFrame(drawViagem);
  const bar = el.querySelector('.loadbar i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
  el.hidden = false; clearTimeout(carregaTimer);
  if (ms) carregaTimer = setTimeout(fecharCarregando, ms);
}
function fecharCarregando() { clearTimeout(carregaTimer); const el = $('#loading'); if (el) el.hidden = true; viagem = null; }

function visitNpc(id) {
  const nb = NEIGHBORS.find(n => n.id === id);
  telaCarregando(`Indo até ${nb.fazenda} de ${nb.nome}…`, CARREGA_MS, nb.fazenda);
  const cur = state.nb[id];
  if (!cur || !Array.isArray(cur.plots) || cur.plots.length !== N || Date.now() > cur.refreshAt || !cur.animals || cur.animals.some(a => !a.born) || !cur.abrigos || cur.plots.some(p => p.w || (p.b && p.dry)) || !cur.plots.some(p => 'podre' in p) || !cur.banca) state.nb[id] = genNeighbor();
  view = { kind: 'npc', id, nome: nb.nome, fazenda: nb.fazenda, cao: nb.cao, pega: nb.pega, casa: nb.casa, data: state.nb[id], nivel: state.level + nb.acima, avatar: avatarOk(nb.avatar) };
  afterVisit();
  save();
}

async function visitFriend(uid, ajudar) {
  if (!user) return;
  const amigo = friendInfo[uid];
  const nomeAmigo = amigo && amigo.name && !amigo.erro ? amigo.name : 'Amigo', fazAmigo = (amigo && amigo.fazenda) || 'Roça Feliz';
  telaCarregando(`Indo até ${fazAmigo} de ${nomeAmigo}…`, 0, fazAmigo);
  try {
    const [f] = await Promise.all([Cloud.loadFarm(uid), espera(CARREGA_MS)]);
    const data = f && f.stateJson ? migrate(JSON.parse(f.stateJson)) : null;
    if (!data) return toast('Essa roça ainda não existe na nuvem.', 'bad');
    catchUp(data, (Date.now() - (f.updatedAt || Date.now())) / 1000);
    const nome = limpaNome(f.apelido || data.apelido) || (firstName(f.name) === 'Você' ? 'Amigo' : firstName(f.name));
    view = { kind: 'friend', uid, nome, fazenda: limpaNome(f.fazenda || data.fazenda) || 'Roça Feliz', cao: 'Bidu', pega: 0.12, casa: '#7aa35a', data, nivel: data.level || f.level || 1, avatar: avatarOk(data.avatar) };
    afterVisit();
    // veio pelo botão "Precisa de ajuda": vai para onde está a frutífera com a placa
    const onde = ['roca', 'animais'].find(sc => pedidosAjuda({ pomarXP: data.pomarXP, objetos: { [sc]: data.objetos && data.objetos[sc] } }));
    if (onde) {
      if (onde !== 'roca') setScene(onde);
      toast(`🆘 Procure a frutífera com a placa AJUDA! (tem uma setinha 🤝 em cima) ${onde === 'animais' ? 'aqui no rancho ' : ''}e toque nela para ajudar.`, 'good');
    } else if (ajudar) toast(`${nome} já foi ajudado por alguém. Obrigado mesmo assim! 🤝`);
  } catch (e) {
    console.warn(e);
    if (e && e.code === 'permission-denied') reatarAmizade(uid);
    else toast('Não consegui abrir a roça do amigo agora.', 'bad');
  } finally { fecharCarregando(); }
}

function afterVisit() {
  track('visitar');
  hover = null; setScene('roca');
  if (['seed', 'hoe', 'fert'].includes(state.tool)) state.tool = 'hand';
  $('#bannerTxt').textContent = `Você está em ${deQuem(view)} (nível ${view.nivel}). Veja a banca em Negócios. Regue, tire as pragas, alimente os animais ou pegue um pouquinho da colheita… cuidado com ${view.cao}!`;
  $('#banner').hidden = false;
  cv.setAttribute('aria-label', deQuem(view));
  renderVisita();
  renderTools(); renderPane(); renderSceneInfo();
}
// Na roça de outra pessoa somem os botões que só servem na sua (Loja, Celeiro, Presente, Mover…).
// Ficam Amigos (para ir a outra roça) e Negócios (para comprar na banca).
const TABS_VISITA = ['amigos', 'fabrica'];
function renderVisita() {
  const fora = !isHome();
  document.body.classList.toggle('visitando', fora);
  if (fora && !$('#panel').hidden && !TABS_VISITA.includes(tab)) closePanel();
  for (const k of Object.keys(critters)) delete critters[k]; // os bichinhos se espalham de novo na roça de quem você visita
  renderMoveBtn(); pedirFitHud(); renderTabs();
}
function goHome() {
  if (!isHome()) telaCarregando(`Voltando para ${minhaFazenda()}…`, CARREGA_MS, view.fazenda || view.nome || 'Vizinho', true);
  view = { kind: 'home' }; hover = null; renderVisita();
  setScene('roca'); // voltar para a sua fazenda sempre começa na roça
  $('#banner').hidden = true; cv.setAttribute('aria-label', 'Sua roça');
  renderTools(); renderPane(); renderSceneInfo();
}

const visitKey = id => (view.kind === 'friend' ? view.uid : view.id) + ':' + id;
function help(pos) { state.stats.ajudas++; addXP(2, pos); addCoins(2, pos); track('ajudar'); helpBack(pos); if (view.kind === 'friend') ganharAmizade(view.uid); }
// Limite de itens por amigo por dia: 4 da plantação (conta o pomar junto) e 3 dos animais — sem limite
// de quantas roças diferentes, dá para pegar de todos os amigos que tiver.
function stealLimit() {
  const today = localDay(), key = (view.kind === 'friend' ? view.uid : view.id) + ':' + today;
  return state.limits[key] || (state.limits[key] = { d: today, roca: 0, animais: 0 });
}
// Em quantas roças você já pegou algo hoje (só para mostrar na dica, não limita mais nada).
const farmsToday = () => Object.values(state.limits).filter(l => l && l.d === localDay() && l.roca + l.animais > 0).length;
// O cachorro do dono pode espantar (e às vezes morder) quem tenta pegar.
// Nos vizinhos da vila o cachorro está sempre acordado; nos amigos, só se tiver comida.
function guarded(slot, pos, visit) {
  let nome, protege, morde;
  if (view.kind === 'friend') {
    const d = view.data.dogs && view.data.dogs[slot];
    if (!dogAwake(d)) return false;
    nome = d.nome; protege = DOG[d.raca].protege; morde = DOG[d.raca].morde;
  } else { nome = view.cao; protege = view.pega; morde = 0.7; }
  if (Math.random() >= protege) return false;
  const bitten = Math.random() < morde, loss = bitten ? Math.min(state.coins, 10) : 0;
  if (loss) addCoins(-loss, pos);
  sfx('bark');
  toast(bitten ? `${nome}, o cachorro de ${view.nome}, te mordeu! −${loss} moedas` : `${nome}, o cachorro de ${view.nome}, te espantou!`, 'bad');
  sendVisit(Object.assign(visit, { caught: true, coins: loss }));
  return true;
}
function sendVisit(v) {
  if (view.kind !== 'friend' || !user) return;
  Cloud.sendVisit(view.uid, Object.assign({ from: user.uid, fromName: meuApelido(), at: Date.now() }, v))
    .catch(e => console.warn('visita não enviada:', e));
  if (v.t !== 'gift') avisarAmigo(view.uid, 'visita', `${meuApelido()} passou na sua roça!`);
}
function alreadyTook(obj, key) {
  return obj.stolen || state.log[key] || (user && Array.isArray(obj.th) && obj.th.includes(user.uid));
}

function awayPlot(i, p) {
  if (p.s !== 'growing') return;
  const tool = state.tool, has = t => tool === 'hand' || tool === t, pos = cellCenter(i);
  let what = null;
  if (p.b > 0 && has('pest')) { p.b--; what = 'b'; sfx('pest'); useFx('pest', pos); }
  else if (p.w > 0 && has('weed')) { p.w--; what = 'w'; sfx('weed'); }
  else if (p.dry && has('water')) { p.dry = false; what = 'dry'; sfx('water'); useFx('water', pos); track('regar'); }
  if (!what && p.podre && tool === 'hand') {
    const lim = stealLimit();
    if ((lim.cura || 0) >= CURA_MAX) return toast(`Você já salvou ${CURA_MAX} plantas de ${view.nome} hoje. À meia-noite libera de novo!`);
    lim.cura = (lim.cura || 0) + 1; curar(p); what = 'podre';
    state.log[visitKey(p.id)] = Date.now(); // quem salvou a planta não pode pegar dela depois
    sfx('level'); useFx('pocao', pos); popupAt(pos, 'Salvou a planta!', '#c9a6ff');
  }
  if (what) { help(pos); sendVisit({ t: 'help', what, plot: i, pid: p.id }); return done(); }
  if (ripe(p) && tool === 'hand') {
    const key = visitKey(p.id), lim = stealLimit();
    if (alreadyTook(p, key)) return toast('Você já pegou daqui. Não exagere!');
    if (lim.roca >= STEAL_MAX.roca) return toast(`Você já pegou ${STEAL_MAX.roca} itens da plantação e do pomar de ${view.nome} hoje. À meia-noite libera de novo!`);
    p.stolen = true; state.log[key] = Date.now(); lim.roca++;
    if (guarded('roca', pos, { t: 'steal', plot: i, pid: p.id, qty: 0 })) return done();
    const crop = CROP[p.c];
    sfx('harvest');
    gain(crop.prod, 1, pos); state.stats.roubado++; addXP(1, pos); track('pegar');
    sendVisit({ t: 'steal', plot: i, pid: p.id, qty: 1 });
    return done();
  }
}

function awayAnimal(a, def, prod, pos) {
  if (def.tipo === 'pet') return petAnimal(a, pos);
  if (def.tipo === 'cria') return toast(`${def.nome} de ${view.nome} ainda está crescendo.`);
  if (def.prod === 'leitao' && a.ready) return toast('Leitão não dá para levar!');
  if (!a.fed && !a.ready) { a.fed = true; sfx('feed'); help(pos); sendVisit({ t: 'feed', animal: a.id }); return done(); }
  if (a.ready) {
    const key = visitKey(a.id + ':' + a.n), lim = stealLimit();
    if (alreadyTook(a, key)) return toast('Você já pegou deste bicho. Não exagere!');
    if (lim.animais >= STEAL_MAX.animais) return toast(`Você já pegou ${STEAL_MAX.animais} itens dos animais de ${view.nome} hoje. À meia-noite libera de novo!`);
    a.stolen = true; state.log[key] = Date.now(); lim.animais++;
    if (guarded('animais', pos, { t: 'stealA', animal: a.id })) return done();
    sfx('collect');
    gain(prod.id, 1, pos);
    addXP(1, pos); state.stats.roubado++; track('pegar');
    sendVisit({ t: 'stealA', animal: a.id });
    return done();
  }
  toast(`${def.nome} de ${view.nome} está produzindo.`);
}

// O que seus amigos fizeram na sua roça enquanto você estava fora.
function applyVisits(list) {
  const msgs = {};
  for (const { id, data: v } of list) {
    Cloud.deleteVisit(user.uid, id).catch(() => {});
    if (!v || typeof v !== 'object' || typeof v.from !== 'string' || v.from === user.uid) continue;
    const who = firstName(String(v.fromName || 'Um amigo').slice(0, 40));
    const note = (m, steal) => (msgs[who] = msgs[who] || []).push(m);
    const p = Number.isInteger(v.plot) && v.plot >= 0 && v.plot < N ? state.plots[v.plot] : null;
    const a = typeof v.animal === 'string' ? state.animals.find(x => x.id === v.animal) : null;
    if (!state.friends.includes(v.from)) continue;
    if (v.caught && (v.t === 'steal' || v.t === 'stealA' || v.t === 'stealF')) {
      // Seu cachorro espantou (ou mordeu) um amigo que tentou pegar coisas.
      const slot = v.t === 'steal' ? 'roca' : v.t === 'stealA' ? 'animais' : (v.sc === 'animais' ? 'animais' : 'roca'), d = state.dogs[slot];
      const coins = clamp(Math.round(Number(v.coins) || 0), 0, 10), nome = d ? d.nome : 'Seu cachorro';
      if (coins) state.coins += coins;
      addXP(d ? DOG[d.raca].xpPega : 5, null);
      const msg = coins ? `${nome} mordeu ${who}, que tentou pegar ${SLOT[slot].daSua}, e ganhou ${coins} moedas!`
        : `${nome} espantou ${who}, que tentou pegar ${SLOT[slot].daSua}.`;
      addNews(msg); toast(msg, 'good');
      continue;
    }
    if (v.t === 'help' && v.what === 'fruteira') {
      const sc = v.sc === 'animais' ? 'animais' : 'roca', l = objetosDe(state, sc);
      const o = l.find(x => v.fid && x.fid === v.fid) || (!v.fid && Number.isInteger(v.idx) ? l[v.idx] : null);
      if (o && ENFEITE[o.id] && ENFEITE[o.id].fruteira && estadoFruteira(o).morta && !o.ajudada) {
        o.colhidas = Math.max(0, colheitasDe(ENFEITE[o.id]) - 1); o.ult = Date.now(); o.placa = 0; o.seca = 0; o.ajudada = 1;
        note(`ajudou no seu pomar (${ENFEITE[o.id].nome.toLowerCase()} vai dar frutas mais uma vez)`); helpedBy(v.from, who);
      }
      continue;
    }
    if (v.t === 'help' && p && p.id === v.pid) {
      if (v.what === 'w') p.w = Math.max(0, p.w - 1);
      if (v.what === 'b') p.b = Math.max(0, p.b - 1);
      if (v.what === 'dry') p.dry = false;
      if (v.what === 'podre') curar(p);
      note('ajudou na sua roça'); helpedBy(v.from, who);
    } else if (v.t === 'steal' && p && p.id === v.pid && p.s === 'growing') {
      const qty = 1;
      p.dmg = Math.min(CROP[p.c].rend - 1, p.dmg + qty);
      if (!p.th.includes(v.from)) p.th.push(v.from);
      note(`pegou ${qty} ${CROP[p.c].prodNome} da sua plantação`, true);
    } else if (v.t === 'buy') {
      const sl = (state.banca || []).find(x => x.id === v.slot && x.item === v.item && x.qtd === v.qtd && x.preco === v.preco);
      if (sl) bancaVendeu(sl, who);
    } else if (v.t === 'gift' && PRESENTE_AMIGO.some(g => g.id === v.gift)) {
      const g = PRESENTE_AMIGO.find(x => x.id === v.gift), lvl = clamp(Number(v.nivel) || 0, 0, AMIZADE_NIVEL_MAX);
      g.dar(state, lvl); note(`mandou um presente para você: ${g.nome(lvl)}`);
    } else if (v.t === 'feed' && a && ANIMAL[a.k].tipo === 'prod' && isHungry(a)) {
      a.fed = true; note('alimentou seus animais'); helpedBy(v.from, who);
    } else if (v.t === 'stealA' && a && ANIMAL[a.k].tipo === 'prod' && a.ready) {
      a.ready = false; a.g = 0; a.n++;
      note(`pegou 1 ${PRODUCT[ANIMAL[a.k].prod].nome} dos seus animais`, true);
    } else if (v.t === 'stealF') {
      const sc = v.sc === 'animais' ? 'animais' : 'roca', l = objetosDe(state, sc);
      const o = l.find(x => v.fid && x.fid === v.fid) || (!v.fid && Number.isInteger(v.idx) ? l[v.idx] : null);
      if (o && ENFEITE[o.id] && ENFEITE[o.id].fruteira) note(`pegou 1 ${FRUTA[ENFEITE[o.id].fruta].nome} do seu pomar`, true);
    }
  }
  if (Object.keys(msgs).length) sfx('aviso'); // toquinho de viola: chegou novidade de um amigo
  for (const [who, list2] of Object.entries(msgs)) {
    // Junta repetições: "pegou 1 Milho" duas vezes vira "pegou 2 Milho".
    const count = {};
    for (const m of list2) count[m] = (count[m] || 0) + 1;
    const parts = Object.entries(count).map(([m, n]) => n > 1 && m.startsWith('pegou 1 ') ? m.replace('pegou 1 ', `pegou ${n} `) : m);
    const msg = `${who} ${parts.join(', ')}.`;
    addNews(msg); toast(msg, 'good');
  }
  done();
}

// ============================================================
// Nuvem: login com Google, salvamento e amigos
// ============================================================
// Proteções contra perder progresso:
//  - nuvemOk: só salva na nuvem depois de ter CARREGADO a roça da nuvem com sucesso neste aparelho;
//  - rev: cada salvamento aumenta a versão; só grava se a nuvem ainda estiver na versão em que esta roça
//    se baseou (senão outro aparelho gravou no meio, e este recarrega em vez de gravar por cima);
//  - nivelNuvem: nunca grava uma roça com nível menor que o que já está na nuvem.
let nuvemOk = false, nivelNuvem = 0, salvando = false;
async function cloudSave() {
  if (!user || kicked || !nuvemOk || salvando) return;
  if (state.level < nivelNuvem) { console.warn('bloqueado: nível menor que o da nuvem'); return recarregarDaNuvem('A roça deste aparelho está atrás da nuvem. Carregando a versão salva…'); }
  salvando = true; dirty = false; lastCloud = performance.now();
  syncStatus = 'Salvando…'; renderAccount();
  try {
    state.owner = user.uid;
    const base = state.rev || 0;
    // friends e sent ficam fora do JSON para as regras do Firestore decidirem quem pode ver a roça.
    const rev = await Cloud.saveFarmSeguro(user.uid, {
      stateJson: JSON.stringify(Object.assign({}, state, { rev: base + 1, pendente: false })), name: user.name || '', photo: fotoParaSalvar(),
      moldura: molduraAtual(),
      level: state.level, code: state.code || '', updatedAt: Date.now(), apelido: state.apelido || '', fazenda: state.fazenda || '',
      friends: state.friends.slice(), sent: Object.keys(state.sent), session: SESSION,
    }, base);
    state.rev = rev; state.pendente = false; nivelNuvem = Math.max(nivelNuvem, state.level); save();
    syncStatus = 'Salvo na nuvem';
    sincronizarPush(); // agenda dos avisos (só grava se mudou)
    publicarRanking();
  } catch (e) {
    console.warn(e);
    if (e && e.code === 'outroAparelho') { salvando = false; return kick(e.session); }
    if (e && e.code === 'conflito') { salvando = false; return recarregarDaNuvem('A roça foi salva em outro aparelho. Carregando a versão mais nova…'); }
    dirty = true; syncStatus = 'Sem conexão';
  } finally { salvando = false; }
  renderAccount();
}
// Guarda uma cópia da roça deste aparelho antes de trocar pela da nuvem (dá para restaurar nas Configurações).
function guardarCopiaLocal(s, motivo) {
  try { if (s && s.level) localStorage.setItem('roca-feliz-copia', JSON.stringify({ at: Date.now(), motivo, level: s.level, stateJson: JSON.stringify(s) })); } catch (e) { /* sem espaço */ }
}
async function recarregarDaNuvem(msg) {
  if (!user) return;
  nuvemOk = false; toast(msg);
  try {
    const remote = await Cloud.loadFarm(user.uid);
    const rs = remote && remote.stateJson ? migrate(JSON.parse(remote.stateJson)) : null;
    if (!rs) return;
    guardarCopiaLocal(state, 'antes de recarregar da nuvem');
    catchUp(rs, (Date.now() - (remote.updatedAt || Date.now())) / 1000);
    rs.rev = remote.rev || 0; rs.pendente = false; rs.owner = user.uid;
    state = rs; nivelNuvem = Math.max(nivelNuvem, rs.level || 0); nuvemOk = true; save();
    view = { kind: 'home' }; $('#banner').hidden = true;
    renderTools(); renderHUD(); renderAccount(); renderPane(); renderSceneInfo(); renderTabs();
  } catch (e) { console.warn(e); setTimeout(() => recarregarDaNuvem(msg), 30000); }
}

// Outro aparelho entrou na mesma conta: este para, sem gravar por cima, e sai.
function kick(sess) {
  if (kicked) return;
  kicked = `Você entrou no ${sess.device || 'outro aparelho'} e por isso saiu daqui. Para jogar neste aparelho, entre de novo: a roça continua de onde parou.`;
  guardarCopiaLocal(state, 'saiu porque entrou em outro aparelho');
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* sem armazenamento */ }
  state.changed = 0; staleLocal = true; nuvemOk = false;
  Cloud.signOut().catch(() => {});
  showGate('login', kicked);
}
async function onUser(u) {
  if (unsubVisits) { unsubVisits(); unsubVisits = null; }
  if (unsubChat) { unsubChat(); unsubChat = null; } chatMsgs = [];
  if (unsubPresenca) { unsubPresenca(); unsubPresenca = null; } presencaDe = '';
  if (unsubRequests) { unsubRequests(); unsubRequests = null; }
  if (unsubFarm) { unsubFarm(); unsubFarm = null; }
  user = u; requests = [];
  for (const k of Object.keys(friendInfo)) delete friendInfo[k];
  if (!u) {
    cloudStatus = 'out'; syncStatus = '';
    if (view.kind === 'friend') goHome();
    renderAccount(); renderPane(); renderTabs();
    // Sem sinal e sem login: não trava esperando o Google, deixa jogar offline de uma vez.
    if (!kicked && 'onLine' in navigator && !navigator.onLine) { enterGame(); return; }
    showGate('login', kicked || undefined);
    return;
  }
  cloudStatus = 'loading'; renderAccount();
  showGate('entering');
  try {
    // Avisa o outro aparelho que agora é a vez deste, espera ele parar e só então carrega a roça.
    kicked = null;
    SESSION.at = Date.now();
    await Cloud.claimSession(u.uid, SESSION);
    await new Promise(r => setTimeout(r, 1500));
    const remote = await Cloud.loadFarm(u.uid);
    const rs = remote && remote.stateJson ? migrate(JSON.parse(remote.stateJson)) : null;
    const remoteRev = (remote && remote.rev) || 0;
    if (rs) {
      rs.rev = remoteRev; rs.pendente = false;
      // Este aparelho só fica com a roça dele se ela foi feita EM CIMA da versão atual da nuvem
      // (mesma rev) e tem mudanças que ainda não subiram. Horário não decide mais nada.
      const localDescende = !staleLocal && state.owner === u.uid && (state.rev || 0) === remoteRev && state.pendente;
      if (localDescende && state.level >= (rs.level || 0)) { /* fica com a daqui: é a nuvem + mudanças novas */ }
      else if (state.owner === u.uid && state.level > (rs.level || 0) &&
        confirm(`Este aparelho tem uma roça no nível ${state.level}, e a da nuvem está no nível ${rs.level}.\n\nOK = usar a deste aparelho (nível ${state.level})\nCancelar = usar a da nuvem (nível ${rs.level})`)) {
        state.rev = remoteRev; state.pendente = true; // o jogador escolheu: sobe a daqui
      } else {
        if (state.owner === u.uid) guardarCopiaLocal(state, 'antes de carregar da nuvem');
        catchUp(rs, (Date.now() - (remote.updatedAt || Date.now())) / 1000); state = rs;
      }
      nivelNuvem = state.pendente ? state.level : (rs.level || 0);
      // cópia de segurança do dia na nuvem (antes de qualquer coisa gravar por cima)
      try {
        const dia = new Date().toISOString().slice(0, 10);
        if (localStorage.getItem('rf-bkp-' + u.uid) !== dia) {
          await Cloud.salvarBackup(u.uid, dia, { stateJson: remote.stateJson, level: rs.level || 0, rev: remoteRev, at: Date.now() });
          localStorage.setItem('rf-bkp-' + u.uid, dia);
          Cloud.listarBackups(u.uid).then(l => l.slice(14).forEach(b => Cloud.apagarBackup(u.uid, b.id).catch(() => {}))).catch(() => {});
        }
      } catch (e) { console.warn('cópia de segurança:', e); }
    } else if (state.owner && state.owner !== u.uid) {
      state = newState(); // a roça deste navegador é de outra conta
      state.rev = remoteRev;
    } else state.rev = remoteRev; // conta nova: primeira roça na nuvem
    nuvemOk = true;
    staleLocal = false;
    state.owner = u.uid;
    if (!state.code) state.code = await Cloud.claimCode(u.uid);
    view = { kind: 'home' }; $('#banner').hidden = true;
    save();
    cloudStatus = 'ready';
    await cloudSave();
    // Outro aparelho entrou? Descobre na hora de salvar (a gravação confere) ou quando o jogo volta
    // para a tela — sem ficar ouvindo o documento da roça, o que gastava uma leitura a cada salvamento.
    unsubVisits = Cloud.watchVisits(u.uid, applyVisits);
    if (Cloud.watchChat) unsubChat = Cloud.watchChat(u.uid, onChat);
    marcarPresenca(!document.hidden); presencaDe = ''; vigiarPresenca();
    unsubRequests = Cloud.watchRequests(u.uid, onRequests);
    checkSent(); recuperarAmigos(); setTimeout(premioRanking, 4000); setTimeout(renovarPush, 5000);
    enterGame();
    toast(`Olá, ${firstName(u.name)}! Bom te ver na roça.`, 'good');
  } catch (e) {
    console.warn(e);
    // Sem carregar a nuvem, NUNCA salva nela (senão a roça deste aparelho podia apagar a de lá).
    nuvemOk = false; cloudStatus = 'ready'; syncStatus = 'Sem conexão';
    enterGame();
    toast('Não consegui falar com a nuvem. Vou tentar de novo sozinho; seu progresso da nuvem está seguro.', 'bad');
    setTimeout(() => { if (user && user.uid === u.uid && !nuvemOk) onUser(u); }, 30000);
  }
  renderTools(); renderHUD(); renderAccount(); renderPane(); renderSceneInfo(); renderTabs();
}

// ---------- Tela de entrada (só quando o login está ligado) ----------
const root = document.documentElement;
const isGated = () => root.classList.contains('gated');
function showGate(mode, msg) {
  root.classList.add('gated');
  tip.hidden = true;
  drawGateArt();
  $('#gateLogin').hidden = mode !== 'login';
  $('#gateRetry').hidden = mode !== 'error';
  $('#gateOffline').hidden = mode !== 'login' && mode !== 'error';
  const st = $('#gateStatus');
  st.className = 'gate-status' + (mode === 'error' ? ' bad' : '');
  st.textContent = msg || { loading: 'Abrindo a porteira…', entering: 'Carregando sua roça…', waiting: 'Esperando o Google…' }[mode] || '';
}
function enterGame() {
  root.classList.remove('gated');
  if (state) { state.tool = 'hand'; renderTools(); }
  resize(); setScene(scene);
  presentePioneiro(); checarNovidades();
  if (state.boasVindas && isHome()) setTimeout(abrirBoasVindas, 400);
  else setTimeout(() => { if (giftReady() && !isGated()) showGift(); }, 1500);
}
// Recado para o jogador: na tela de entrada, vai no status; no jogo, vira aviso.
function notify(msg, kind) {
  if (isGated()) { const st = $('#gateStatus'); st.className = 'gate-status' + (kind === 'bad' ? ' bad' : ''); st.textContent = msg; }
  else toast(msg, kind);
}
$('#gateLogin').addEventListener('click', () => login());
$('#gateRetry').addEventListener('click', () => location.reload());
// Joga só neste aparelho por enquanto; quando fizer login (aqui ou em ⚙️ › Conta), a roça sobe pra nuvem sozinha.
$('#gateOffline').addEventListener('click', () => { cloudStatus = 'out'; enterGame(); renderAccount(); toast('Jogando sem internet: a roça fica salva neste aparelho. Entre com o Google quando quiser salvar na nuvem.'); });

// Ilustração da tela de entrada, feita com os mesmos desenhos do jogo.
let gateArtDone = false;
function drawGateArt() {
  if (gateArtDone) return;
  const g = $('#gateArt'), saved = Object.assign({}, L);
  ctx = g.getContext('2d');
  try {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    Object.assign(L, { cw: 480, ch: 280, W: 96, ox: 262, oy: 108, horizon: 86, dpr: 2 });
    drawSky(0, 'dia'); drawGround();
    drawBarn(72, 172, 96);
    drawTree(430, 150, 80, 0);
    drawFence(3, 2, 'back');
    const crops = ['tomate', 'milho', 'abobora', 'cenoura', 'alface', 'melancia'];
    for (let sum = 0; sum <= 3; sum++) for (let c = 0; c < 3; c++) {
      const r = sum - c; if (r < 0 || r > 1) continue;
      const crop = CROP[crops[r * 3 + c]];
      drawPlot(plotAt(c, r), Object.assign(emptyPlot('growing'), { c: crop.id, g: crop.tempo, id: 'g' }), 0, true);
    }
    const q1 = iso(3.4, 1.2), q3 = iso(3.0, 2.0);
    drawAnimal('vaca', 150, 256, 1.15, 0, 1, false);
    drawAnimal('galinha', q1.x, q1.y, 1.1, 0, -1, false);
    drawAnimal('galinha', q3.x, q3.y, 1.0, 0, 1, false);
    gateArtDone = true;
  } finally { ctx = mainCtx; Object.assign(L, saved); }
}

// ---------- Pedidos de amizade ----------
// Quem digita o código cria farms/{outro}/requests/{eu}. O outro aceita ou recusa.
// Aceitar = colocar na lista friends e salvar; quem pediu percebe isso em checkSent().
function onRequests(list) {
  const seen = new Set(requests.map(r => r.from));
  requests = list
    .map(r => r.data)
    .filter(r => r && typeof r.from === 'string' && r.from !== user.uid && !state.friends.includes(r.from))
    .map(r => ({ from: r.from, name: String(r.fromName || 'Alguém').slice(0, 60), photo: typeof r.fromPhoto === 'string' ? r.fromPhoto : '', moldura: typeof r.fromMoldura === 'string' ? r.fromMoldura : '', at: r.at || 0, reatar: !!r.reatar }));
  // Se a pessoa já é amiga (ex.: pediu de novo ou pediu para reatar), o pedido é só apagado
  // e a amizade é confirmada na lista oficial (isso conserta o lado de cá).
  for (const r of list) if (r.data && state.friends.includes(r.data.from)) { oficializar(r.data.from); Cloud.deleteRequest(user.uid, r.data.from).catch(() => {}); }
  for (const r of requests) if (!seen.has(r.from)) toast(r.reatar ? `${firstName(r.name)} quer reatar a amizade! Veja na aba Amigos.` : `${firstName(r.name)} quer ser seu amigo! Veja na aba Amigos.`, 'good');
  renderTabs();
  if (tab === 'amigos') renderPane();
}

async function addFriend(code) {
  if (!user) return;
  code = Cloud.normalizeCode(code);
  if (code.length !== 6) return toast('O código tem 6 letras e números.');
  if (code === state.code) return toast('Esse é o seu próprio código!');
  try {
    const uid = await Cloud.findCode(code);
    if (!uid) return toast('Não achei ninguém com esse código.', 'bad');
    if (state.friends.includes(uid)) return toast('Vocês já são amigos.');
    if (requests.some(r => r.from === uid)) return acceptRequest(uid);
    if (state.sent[uid]) return toast('Você já mandou um pedido para essa pessoa.');
    state.sent[uid] = { at: Date.now(), code };
    await cloudSave(); // libera a sua roça para essa pessoa espiar antes de aceitar
    await Cloud.sendRequest(uid, { from: user.uid, fromName: meuApelido(), fromPhoto: fotoParaSalvar(), fromMoldura: molduraAtual(), at: Date.now() });
    avisarAmigo(uid, 'pedido', `${meuApelido()} quer ser seu amigo na Roça Feliz!`);
    toast('Pedido enviado! A amizade começa quando a pessoa aceitar.', 'good');
    done();
  } catch (e) {
    console.warn(e);
    toast('Não consegui mandar o pedido agora. Tente de novo.', 'bad');
  }
}

async function acceptRequest(uid) {
  if (!user) return;
  if (!state.friends.includes(uid)) state.friends.push(uid);
  (state.amigosVistos ||= {})[uid] = 1;
  oficializar(uid);
  delete state.sent[uid];
  const r = requests.find(x => x.from === uid);
  requests = requests.filter(x => x.from !== uid);
  delete friendInfo[uid];
  save(); await cloudSave();
  Cloud.deleteRequest(user.uid, uid).catch(e => console.warn(e));
  toast(`Agora você e ${firstName(r ? r.name : 'seu amigo')} são amigos!`, 'good');
  renderTabs(); renderPane();
}

function refuseRequest(uid) {
  if (!user) return;
  requests = requests.filter(x => x.from !== uid);
  Cloud.deleteRequest(user.uid, uid).catch(e => console.warn(e));
  renderTabs(); renderPane();
}

async function cancelRequest(uid) {
  if (!user) return;
  delete state.sent[uid];
  Cloud.deleteRequest(uid, user.uid).catch(e => console.warn(e));
  done(); await cloudSave();
}

async function unfriend(uid) {
  state.friends = state.friends.filter(f => f !== uid);
  if (state.amigosVistos) delete state.amigosVistos[uid];
  if (user && Cloud.removeAmigo) Cloud.removeAmigo(user.uid, uid).catch(e => console.warn(e));
  delete friendInfo[uid];
  if (view.kind === 'friend' && view.uid === uid) goHome();
  done(); await cloudSave();
  toast('Amigo excluído.');
}

// Confere os pedidos que você mandou: aceito (a pessoa te colocou na lista) ou recusado (o pedido sumiu).
let checkingSent = false;
async function checkSent() {
  if (!user || checkingSent) return;
  const pending = Object.keys(state.sent);
  if (!pending.length) return;
  checkingSent = true;
  let changed = false;
  try {
    for (const uid of pending) {
      let farm = null;
      try { farm = await Cloud.loadFarm(uid); } catch (e) { farm = null; }
      if (farm && Array.isArray(farm.friends) && farm.friends.includes(user.uid)) {
        delete state.sent[uid];
        if (!state.friends.includes(uid)) state.friends.push(uid);
        (state.amigosVistos ||= {})[uid] = 1;
        oficializar(uid);
        toast(`${firstName(farm.name || 'Seu amigo')} aceitou seu pedido de amizade!`, 'good');
        changed = true;
        continue;
      }
      const still = await Cloud.requestExists(uid, user.uid).catch(() => true);
      if (!still) { delete state.sent[uid]; changed = true; }
    }
  } finally { checkingSent = false; }
  if (changed) { done(); cloudSave(); }
}

// A roça do amigo vem da nuvem como texto (stateJson); os objetos (frutíferas com placa) ficam lá dentro.
const estadoDoAmigo = f => { try { return f && f.stateJson ? JSON.parse(f.stateJson) : f; } catch (e) { return f; } };
// (a cada 2 min lê de novo, para o botão "Precisa de ajuda" ficar em dia)
function fetchFriendInfo(uid, forca) {
  const fi = friendInfo[uid];
  if (!user || (fi !== undefined && !(fi && fi.at && !fi.buscando && (forca || Date.now() - fi.at > 120e3)))) return;
  if (fi && fi.at) fi.buscando = true; else friendInfo[uid] = 'loading';
  Cloud.loadFarm(uid).then(f => {
    friendInfo[uid] = f ? { name: limpaNome(f.apelido) || firstName(f.name || 'Amigo'), fazenda: limpaNome(f.fazenda) || 'Roça Feliz', photo: f.photo || '', moldura: typeof f.moldura === 'string' ? f.moldura : '', level: f.level || 1, ajuda: pedidosAjuda(estadoDoAmigo(f)), at: Date.now() } : null;
    renderTabs();
  }).catch(e => {
    // Não conseguiu ler (sem internet, login ainda carregando, ou a pessoa desfez a amizade):
    // NUNCA apaga o amigo sozinho. Um erro passageiro apagava amigos de verdade.
    friendInfo[uid] = { erro: true, name: 'Amigo', photo: '', level: 0 };
    setTimeout(() => { if (friendInfo[uid] && friendInfo[uid].erro) delete friendInfo[uid]; }, 60000); // tenta de novo depois
  }).finally(() => { if (tab === 'amigos') renderPane(); });
}
// Lista oficial de amigos na nuvem (farms/{você}/amigos). Só muda ao virar amigo ou ao Excluir.
function oficializar(uid) { if (user && Cloud.addAmigo) Cloud.addAmigo(user.uid, uid).catch(e => console.warn('amigos:', e)); }
// Recupera amigos que sumiram da lista: procura quem já foi seu amigo (cópia de segurança e rastros
// como visitas, presentes e ajudas) e devolve para a lista quem ainda tem você na lista dele.
let recuperando = false, ultimaRecup = 0;
async function recuperarAmigos() {
  if (!user || recuperando) return;
  recuperando = true;
  try {
    const voltaram = [];
    // 1) a lista oficial manda: quem está lá é amigo, ponto. E quem está só no save entra na lista oficial.
    if (Cloud.listAmigos) {
      try {
        const oficial = await Cloud.listAmigos(user.uid);
        for (const uid of oficial) if (!state.friends.includes(uid)) {
          state.friends.push(uid); (state.amigosVistos ||= {})[uid] = 1; delete friendInfo[uid];
          let nome = 'Amigo'; try { const f = await Cloud.loadFarm(uid); if (f && f.name) nome = firstName(f.name); } catch (e) { /* tanto faz */ }
          voltaram.push(nome);
        }
        for (const uid of state.friends) if (!oficial.includes(uid)) oficializar(uid);
      } catch (e) { console.warn('lista oficial de amigos:', e); } // regras antigas: segue só com os rastros
    }
    // 2) rastros (visitas, presentes, ajudas): volta quem ainda tem você como amigo
    const npc = new Set(NEIGHBORS.map(n => n.id)), cand = new Set(Object.keys(state.amigosVistos || {}));
    const add = k => { const uid = String(k).split(':')[0]; if (uid.length >= 20 && !npc.has(uid)) cand.add(uid); };
    Object.keys(state.log || {}).forEach(add); Object.keys(state.limits || {}).forEach(add); Object.keys(state.owe || {}).forEach(add);
    ((state.sentGifts && state.sentGifts.to) || []).forEach(add);
    for (const uid of cand) {
      if (uid === user.uid || state.friends.includes(uid)) continue;
      let farm = null, oficial = false;
      try { oficial = Cloud.ehAmigoDe ? await Cloud.ehAmigoDe(uid, user.uid) : false; } catch (e) { /* regras antigas */ }
      try { farm = await Cloud.loadFarm(uid); } catch (e) { if (!oficial) continue; }
      if (oficial || (farm && Array.isArray(farm.friends) && farm.friends.includes(user.uid))) {
        state.friends.push(uid); (state.amigosVistos ||= {})[uid] = 1; delete friendInfo[uid]; oficializar(uid);
        voltaram.push(firstName((farm && farm.name) || 'Amigo'));
      }
    }
    if (voltaram.length) {
      done(); await cloudSave();
      toast(`Amigos de volta na sua lista: ${voltaram.join(', ')}.`, 'good');
    }
  } finally { recuperando = false; }
}

// ============================================================
// Reprodução e chocadeira
// ============================================================
// Casal = 2 animais da mesma espécie. O relógio começa quando o casal se forma e, a cada tempoRepro(espécie),
// se os dois estiverem alimentados, nasce um filhote (aves põem um ovo na chocadeira do rancho).
const reproEspecies = () => Object.keys(FILHOTES).filter(k => ANIMAL[k] && ANIMAL[k].tipo === 'prod');
function reproEstado(k) {
  const casal = state.animals.filter(a => a.k === k);
  const alim = casal.filter(a => a.fed || a.ready).length, ult = (state.ultima_reproducao || {})[k];
  const falta = ult ? Math.max(0, ult + tempoRepro(k) - Date.now()) : tempoRepro(k);
  return { n: casal.length, alim, falta, par: casal.length >= 2 };
}
function reproTexto(k) {
  if (!FILHOTES[k] || !isHome()) return '';
  const d = ANIMAL[k], ave = AVES.includes(k), r = reproEstado(k), oQue = ave ? 'ovo na chocadeira' : 'filhote';
  if (!r.par) return `💞 Falta um par para ter ${ave ? 'ovos' : 'filhotes'}: compre mais ${d.f ? 'uma' : 'um'} ${d.nome.toLowerCase()}.`;
  if (r.falta > 0) return `${ave ? '🥚' : '🐾'} Próximo ${oQue} em ${fmt(r.falta / 1000)}${r.alim < 2 ? ' (alimente o casal)' : ''}`;
  if (r.alim < 2) return `${ave ? '🥚' : '🐾'} Pronto para ter ${oQue}, mas o casal precisa estar alimentado.`;
  if (ave && state.chocadeira.ovos.length >= 20) return '🥚 A chocadeira está cheia.';
  if (!ave) { const ab = abrigoOf(FILHOTES[k]); if (!ab || vagas(state, ab.id) <= 0) return '🐾 Pronto para ter filhote, mas o abrigo está cheio.'; }
  return `${ave ? '🥚' : '🐾'} Prestes a ter ${oQue}!`;
}
function verificarReproducao() {
  if (!isHome()) return; // Reprodução só acontece na sua roça
  if (!state.chocadeira || !Array.isArray(state.chocadeira.ovos)) state.chocadeira = { ovos: [], level: 0 };
  if (!state.ultima_reproducao) state.ultima_reproducao = {};
  const now = Date.now();
  for (const k of reproEspecies()) {
    const r = reproEstado(k);
    if (!r.par) { delete state.ultima_reproducao[k]; continue; }
    if (!state.ultima_reproducao[k]) { state.ultima_reproducao[k] = now; continue; }
    if (r.falta > 0 || r.alim < 2) continue;
    const filhote = FILHOTES[k];
    if (!AVES.includes(k)) {
      const ab = abrigoOf(filhote);
      if (!ab || vagas(state, ab.id) <= 0) continue;
      state.animals.push(newAnimal(filhote));
      state.ultima_reproducao[k] = now;
      toast(`🐾 Nasceu ${ANIMAL[filhote].f ? 'uma' : 'um'} ${ANIMAL[filhote].nome.toLowerCase()}!`, 'good');
      done();
    } else if (state.chocadeira.ovos.length < 20) {
      state.chocadeira.ovos.push({ especie: filhote, nascimento: now + 24 * HOUR });
      state.ultima_reproducao[k] = now;
      toast(`🥚 Ovo de ${ANIMAL[filhote].nome.toLowerCase()} colocado na chocadeira!`, 'good');
      done();
    }
  }
}

function hatcharOvos() {
  if (!isHome() || !state.chocadeira || !state.chocadeira.ovos.length) return;

  const agora = Date.now();
  const ovosHatched = [];

  for (let i = state.chocadeira.ovos.length - 1; i >= 0; i--) {
    const ovo = state.chocadeira.ovos[i];
    if (agora >= ovo.nascimento) {
      const filhote = ovo.especie;
      const abrigo = abrigoOf(filhote);

      // Verificar se há vaga no abrigo
      if (abrigo && vagas(state, abrigo.id) > 0) {
        state.animals.push(newAnimal(filhote));
        ovosHatched.push(ANIMAL[filhote].nome.toLowerCase());
        state.chocadeira.ovos.splice(i, 1);
      }
    }
  }

  if (ovosHatched.length) {
    toast(`🐣 ${ovosHatched.length} filhote${ovosHatched.length > 1 ? 's' : ''} nasceu${ovosHatched.length > 1 ? 'ram' : ''}!`, 'good');
    done();
  }
}

// ============================================================
// Simulação
// ============================================================
function tick(dt) {
  for (const p of state.plots) growPlot(p, dt, true);
  for (const a of state.animals) growAnimal(a, dt);

  // Verificar reprodução a cada tick (cada espécie tem seu intervalo)
  verificarReproducao();
  hatcharOvos();
}

// Faz os bichos passearem dentro de uma área (cercado ou sala). Os com fome vão para o cocho.
const ROOM_AREA = { u0: 1.3, u1: 4.1, v0: 1.2, v1: 4.2 };
function fixedSpot(a, list) {
  const same = list.filter(x => ANIMAL[x.k].fixo), n = same.indexOf(a);
  if (ANIMAL[a.k].lugar === 'casa') return [4.45 - n * 0.8, 1.5 + n * 0.5];
  const y = yardOf('apiario'), [hu, hv] = HIVE_SPOTS[n % HIVE_SPOTS.length], [u, v] = y.rot ? [hv, hu] : [hu, hv];
  return [y.u0 + u, y.v0 + v];
}
function updateWander(list, dt, area) {
  for (const a of list) {
    const d = ANIMAL[a.k];
    let m = amb[a.id];
    if (!m) {
      let u, v;
      if (d.fixo) [u, v] = fixedSpot(a, list);
      else { u = rand(area.u0, area.u1); v = rand(area.v0, area.v1); }
      m = amb[a.id] = { u, v, tu: u, tv: v, wait: rand(0, 2), dir: Math.random() < 0.5 ? 1 : -1, moving: false };
    }
    if (d.fixo) { m.moving = false; continue; }
    const hungry = area.trough && isHungry(a);
    if (m.wait > 0) { m.wait -= dt; m.moving = false; continue; }
    const du = m.tu - m.u, dv = m.tv - m.v, dist = Math.hypot(du, dv);
    if (dist < 0.05) {
      m.wait = hungry ? rand(2, 5) : rand(1, 4); m.moving = false;
      if (hungry) { m.tu = rand(area.trough.u0, area.trough.u1); m.tv = rand(area.trough.v0, area.trough.v1); }
      else { m.tu = rand(area.u0, area.u1); m.tv = rand(area.v0, area.v1); }
      continue;
    }
    const kind = drawKind(a), speed = kind === 'tartaruga' ? 0.06 : SMALL_ANIMALS.includes(kind) ? 0.55 : 0.3;
    const k = Math.min(1, speed * dt / dist);
    m.u += du * k; m.v += dv * k; m.moving = true;
    const sx = du - dv; if (Math.abs(sx) > 0.01) m.dir = sx > 0 ? 1 : -1;
  }
}
// Tamanho do bicho na tela: os de criação crescem de 60% até o tamanho adulto.
function animalScale(a, base) {
  const d = ANIMAL[a.k];
  let k = base * (d.escala || 1);
  if (d.tipo === 'cria') k *= 0.6 + 0.4 * Math.min(1, a.g / d.tempo);
  return k;
}
function drawAnimalAt(a, m, base, t) {
  const p = iso(m.u, m.v), W = L.W, kind = drawKind(a), sc = animalScale(a, base);
  if (hover && hover.kind === 'animal' && hover.id === a.id) {
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, W * 0.26, W * 0.09, 0, 0, 7); ctx.stroke();
  }
  drawAnimal(kind, p.x, p.y, sc, t, m.dir, m.moving, kind === 'gato' ? corGato(a) : undefined);
  const h = ANIMAL_H[kind] * sc;
  m.topo = { x: p.x, y: p.y - h - W * 0.05 };
  hits.push({ kind: 'animal', id: a.id, x: p.x, y: p.y - h * 0.5, r: Math.max(W * 0.3, h * 0.85) });
}
function animalBubble(a, home) {
  const d = ANIMAL[a.k];
  if (d.tipo === 'pet') return null;
  if (d.tipo === 'cria') return home ? (isAdult(a) ? 'sell' : isHungry(a) ? 'feed' : null) : null;
  const took = !home && (a.stolen || state.log[visitKey(a.id + ':' + a.n)]);
  if (a.ready) return took ? null : 'prod';
  return !a.fed ? 'feed' : null;
}

// ============================================================
// Geometria isométrica
// ============================================================
function resize() {
  const r = stage.getBoundingClientRect();
  const cw = Math.max(0, r.width), ch = Math.max(0, r.height);
  L.dpr = Math.min(2, window.devicePixelRatio || 1);
  // só mexe no tamanho do canvas se mudou de verdade (mudar apaga o desenho e dava um "piscar")
  const w = Math.round(cw * L.dpr), h = Math.round(ch * L.dpr);
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  L.cw = cw; L.ch = ch;
}
// Gira o celular (retrato ↔ paisagem) ou muda o tamanho da janela: refaz as contas do tamanho da
// tela. Sem isso, só ficava do jeito certo se o jogo já tivesse sido aberto naquela posição.
const pedeResize = () => { if (state) { resize(); pedirFitHud(); } };
window.addEventListener('resize', pedeResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', pedeResize);
window.addEventListener('orientationchange', () => {
  // no celular a tela às vezes só assenta no tamanho novo um instante depois de girar
  pedeResize(); setTimeout(pedeResize, 100); setTimeout(pedeResize, 400);
});
const ZOOM_MIN = 0.6;
// Celular em pé (tela estreita e mais alta que larga) permite mais zoom: a largura já limita bem mais
// o tamanho da fazenda do que no modo deitado, então precisa de um teto maior para aproximar igual.
const zoomMax = () => (L.cw < 700 && L.ch > L.cw) ? 3.6 : 2.5;
const zoomOf = sc => clamp(Number(settings.zoom && settings.zoom[sc]) || 1, ZOOM_MIN, zoomMax());
function setZoom(z, sc = scene) {
  const old = zoomOf(sc), nz = clamp(Math.round(z * 100) / 100, ZOOM_MIN, zoomMax());
  settings.zoom = Object.assign({}, settings.zoom, { [sc]: nz });
  L.pan.x *= nz / old; L.pan.y *= nz / old;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* sem armazenamento */ }
  renderZoom();
}
function renderZoom() {
  const z = zoomOf(scene);
  if (!$('#zoomIn')) return;
  $('#zoomIn').disabled = z >= zoomMax(); $('#zoomOut').disabled = z <= ZOOM_MIN;
  $('#zoomReset').textContent = `${Math.round(z * 100)}%`;
}
// Espaço da tela que os botões por cima do jogo cobrem.
function insets() {
  if (L.cw < 700 && L.ch > L.cw) return { t: 144, b: 150, l: 6, r: 6 };   // celular em pé
  if (L.ch < 520) return { t: 50, b: 60, l: 58, r: 60 };                 // celular deitado
  return L.cw < 700 ? { t: 70, b: 92, l: 44, r: 52 } : { t: 76, b: 104, l: 96, r: 104 };
}
function layout(sc) {
  const { cw, ch } = L, I = insets();
  const aw = Math.max(80, cw - I.l - I.r), ah = Math.max(80, ch - I.t - I.b), cx = I.l + aw / 2, cy = I.t + ah / 2;
  let box = { w: aw, h: ah }; // tamanho do que precisa aparecer, no zoom normal
  if (sc === 'roca') {
    // A câmera enquadra só a terra em uso e se afasta conforme a roça cresce. Não conta mais os lotes só
    // "compráveis" (canBuy): desde que o canteiro ficou livre pra ir em qualquer canto da roça (não só
    // encostado no que já tinha), isso virava praticamente a grade inteira sempre que sobrava vaga
    // comprada, e a câmera zoom-ava pra longe sem necessidade, atrapalhando o arrastar.
    const plots = S().plots;
    let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
    plots.forEach((p, i) => {
      if (p.s === 'locked') return;
      const c = plotU(i), r = plotV(i);
      c0 = Math.min(c0, c); c1 = Math.max(c1, c + 1); r0 = Math.min(r0, r); r1 = Math.max(r1, r + 1);
    });
    if (c0 > c1) { c0 = 0; c1 = 3; r0 = 0; r1 = 2; }
    // os enfeites colocados também entram no enquadramento
    const objs = objList(S(), 'roca');
    for (const o of objs) if (o.u >= 0 && o.v >= 0) { c1 = Math.max(c1, Math.ceil(o.u)); r1 = Math.max(r1, Math.ceil(o.v)); }
    c0 = Math.max(RU0, c0 - 1); c1 = Math.min(RU0 + COLS, c1 + 1); r0 = Math.max(RV0, r0 - 1); r1 = Math.min(RV0 + ROWS, r1 + 1);
    const span = (c1 - c0) + (r1 - r0);
    // No celular os botões do lado ficam por cima da grama: a roça usa a largura toda.
    const rw = cw < 700 ? cw - 12 : aw;
    const full = Math.min(rw / 7.4, ah / 4.9);
    // (um pouco mais perto que antes: a roça aparece maior e é mais fácil de tocar)
    const antes = Math.max(full, Math.min(rw * 1.8 / span, ah * 0.86 / (span / 4 + 0.9), rw / 5, ah / 3.6));
    L.W = antes * 1.15;
    // esqU/dirU: extremos de verdade da cena em iso-x. c1/r1 acima já vêm limitados à grade
    // (Math.min(COLS/ROWS, …)), então um objeto movido bem além dela (como a casa) precisa entrar
    // aqui pelo valor real dele, senão nem o zoom nem a centralização percebem que ele ficou pra fora.
    const esqU = Math.min((c0 - r1) / 2, ...objs.map(o => (o.u - o.v) / 2)) - 0.6;
    const dirU = Math.max((c1 - r0) / 2, ...objs.map(o => (o.u - o.v) / 2)) + 0.4;
    // da casinha do cachorro (à esquerda) até o fim dos canteiros (ou do objeto mais distante) tem
    // que caber na largura, sem ir para trás dos botões. Só encolhe (nunca aumenta o zoom); o piso de
    // 20px é só pra não desaparecer se alguém arrastar um objeto pra um lugar bem absurdo.
    // (antes isso só rodava no computador, e o piso era "antes": no celular, e sempre que o objeto ficava
    // bem longe da grade, esse piso impedia de encolher o quanto precisava e cortava a tela)
    L.W = Math.min(L.W, Math.max(20, rw / (dirU - esqU)));
    const cc = (c0 + c1) / 2, rc = (r0 + r1) / 2;
    L.ox = cx - (esqU + dirU) * L.W / 2;
    L.oy = Math.min(I.t + ah * 0.6 - (cc + rc) * L.W / 4, I.t + ah - (c1 + r1) * L.W / 4 - 0.25 * L.W);
    // Se sobrar espaço à direita, empurra a roça para a casinha do cachorro caber na tela.
    const esq = Math.min(...objs.map(o => (o.u - o.v) / 2)) - 0.45; // o que fica mais à esquerda (casinha, celeiro…)
    const falta = (cw < 700 ? 6 : I.l) - esq * L.W - L.ox, sobra = I.l + aw - (L.ox + (dirU - 0.4) * L.W);
    if (falta > 0 && (sobra > 0 || cw < 700)) L.ox += cw < 700 ? falta : Math.min(falta, sobra);
    // Igual o rancho faz: registra o tamanho de verdade do que foi enquadrado, pra folga de arrastar
    // (ovx/ovy lá embaixo) bater com a tela de verdade, não com o tamanho da janela (box.w/h não
    // eram atualizados aqui antes, então a folga de arrastar da roça não tinha relação com o zoom
    // dela — por isso o deslize ficava estranho, diferente do rancho).
    box = { w: (dirU - esqU) * L.W, h: (span / 4 + 1.5) * L.W };
  } else if (sc === 'animais') {
    // O rancho inteiro cabe na tela; no celular fica maior e dá para arrastar. Abrigo movido pra fora
    // da grade original entra na conta, senão o enquadramento não crescia pra mostrar ele.
    let u0 = 0, u1 = RANCH_C, v0 = 0, v1 = RANCH_R;
    for (const b of ABRIGOS) { const y = yardOf(b.id); u0 = Math.min(u0, y.u0); u1 = Math.max(u1, y.u1); v0 = Math.min(v0, y.v0); v1 = Math.max(v1, y.v1); }
    for (const o of objList(state, 'animais')) if (o.key === 'chocadeira') { u0 = Math.min(u0, o.u - 0.8); v0 = Math.min(v0, o.v - 0.8); u1 = Math.max(u1, o.u + 0.8); v1 = Math.max(v1, o.v + 0.8); }
    const du = u1 - u0, dv = v1 - v0;
    const bw = (du + dv) / 2 + 0.8, bh = (du + dv) / 4 + 1.6;
    L.W = Math.max(Math.min(aw / bw, ah / bh) * 1.08, cw < 700 ? 72 : 0);
    L.ox = cx - ((u0 + u1) - (v0 + v1)) * L.W / 4 + 0.1 * L.W;
    L.oy = I.t + ah / 2 - (((u0 + u1) + (v0 + v1)) / 8 - 0.55) * L.W;
    box = { w: bw * L.W, h: bh * L.W };
  } else {
    L.W = Math.min(aw / 5.9, ah / 4.35);
    L.ox = cx;
    L.oy = I.t + ah - ROOM / 2 * L.W - 0.3 * L.W;
  }
  // Zoom em volta do meio da tela; arrastar anda pela parte que ficou de fora.
  const z = zoomOf(sc);
  L.W *= z; L.ox = cx + (L.ox - cx) * z; L.oy = cy + (L.oy - cy) * z;
  if (sc === 'roca' || sc === 'animais') {
    // Arrastar anda pela área inteira de construir (a mesma da linha pontilhada), em qualquer zoom.
    // Antes a folga era um tanto fixo em volta do meio do enquadramento: com zoom grande metade da área
    // ficava fora de alcance e o arrastar travava "do nada". Agora os limites vêm das pontas da área na
    // tela: dá pra ir até a beirada esquerda/direita, até a frente e, pra trás, até o céu.
    const [a0, b0, a1, b1] = areaDe(sc), mg = Math.max(L.W * 1.5, 40);
    const xMin = iso(a0, b1).x - mg, xMax = iso(a1, b0).x + mg;
    const yMax = iso(a1, b1).y + mg, yCeu = iso(CEU_MIN / 2, CEU_MIN / 2).y;
    const loX = Math.min(I.l + aw - xMax, 0), hiX = Math.max(I.l - xMin, 0);
    // pra trás para quando o horizonte chega lá pelo meio da área visível
    const loY = Math.min(I.t + ah - yMax, 0), hiY = Math.max(I.t + ah * 0.45 - yCeu, 0);
    const px = clamp(L.pan.x, loX, hiX), py = clamp(L.pan.y, loY, hiY);
    // passou do limite arrastando? o "ponto de partida" do dedo acompanha, pra voltar na hora que
    // mudar de direção (antes ficava uma zona morta: tinha que desfazer todo o excesso antes de mexer)
    if (drag && drag.moved && !drag.item && drag.px !== undefined) { drag.px += px - L.pan.x; drag.py += py - L.pan.y; }
    L.pan.x = px; L.pan.y = py;
    L.canPan = true;
  } else {
    const ovx = Math.max(aw * 0.6, L.W * 7, (box.w * z - aw) / 2 + Math.max(aw * 0.2, L.W * 2.5));
    const ovy = Math.max(ah * 0.25, L.W * 2.5, (box.h * z - ah) / 2 + Math.max(ah * 0.1, L.W));
    L.pan.x = clamp(L.pan.x, -ovx, ovx); L.pan.y = clamp(L.pan.y, -ovy, ovy);
    L.canPan = ovx > 0 || ovy > 0;
  }
  L.ox += L.pan.x; L.oy += L.pan.y;
  L.horizon = Math.max(ch * 0.08, L.oy - L.W * 0.9);
}
function iso(c, r) { return { x: L.ox + (c - r) * L.W / 2, y: L.oy + (c + r) * L.W / 4 }; }
function P(c, r, h = 0) { const q = iso(c, r); return { x: q.x, y: q.y - h * L.W }; }
function cellAt(x, y) {
  const a = (x - L.ox) / (L.W / 2), b = (y - L.oy) / (L.W / 4);
  return plotAt((a + b) / 2, (b - a) / 2);
}
function cellCenter(i) { return iso(plotU(i) + .5, plotV(i) + .5); }
function animalPos(id) { const m = amb[id]; return m ? iso(m.u, m.v) : null; }

function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.closePath(); }
function quad(a, b, c, d, fill, stroke, lw) {
  poly([a, b, c, d]);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
// Caixa isométrica: mostra o topo e as duas faces viradas para quem olha.
function isoBox(c0, r0, c1, r1, h0, h1, top, left, right) {
  quad(P(c0, r1, h0), P(c1, r1, h0), P(c1, r1, h1), P(c0, r1, h1), left);
  quad(P(c1, r0, h0), P(c1, r1, h0), P(c1, r1, h1), P(c1, r0, h1), right);
  quad(P(c0, r0, h1), P(c1, r0, h1), P(c1, r1, h1), P(c0, r1, h1), top);
}
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
function line(a, b, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }

// ============================================================
// Cenário
// ============================================================
// Tufos de grama, flores e folhas ficam presos ao chão (coordenadas da grade), para acompanhar o zoom.
const TUFTS = Array.from({ length: 420 }, () => [Math.random(), Math.random(), Math.random()]);
const tuftAt = (x, y) => iso(-8 + x * 28, -8 + y * 28);
const STARS = Array.from({ length: 40 }, () => [Math.random(), Math.random() * 0.9, Math.random()]);

function timeOfDay() {
  if (settings.tema === 'dia') return 'dia';
  if (settings.tema === 'noite') return 'noite';
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 6.5 && h < 17) return 'dia';
  if (h >= 17 && h < 19) return 'tarde';
  if (h >= 5 && h < 6.5) return 'aurora';
  return 'noite';
}
const SKIES = { dia: ['#7cc4ef', '#c5ebfa'], tarde: ['#f28b5b', '#ffd49a'], aurora: ['#8a8fcf', '#ffc9a8'], noite: ['#101b3f', '#2f4a7c'] };

function drawSky(t, tod) {
  const { cw, horizon } = L;
  const [a, b] = SKIES[tod];
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, horizon + 2);
  if (tod === 'noite') {
    ctx.fillStyle = '#fff';
    for (const [x, y, k] of STARS) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 900 + k * 9)); ctx.fillRect(x * cw, y * horizon, 1.5, 1.5); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4f1d0'; ctx.beginPath(); ctx.arc(cw * 0.86, horizon * 0.42, L.W * 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cw * 0.86 + L.W * 0.08, horizon * 0.38, L.W * 0.17, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = tod === 'dia' ? '#fff3a6' : '#ffb35c';
    ctx.beginPath(); ctx.arc(cw * 0.88, tod === 'dia' ? horizon * 0.4 : horizon * 0.8, L.W * 0.22, 0, 7); ctx.fill();
  }
  ctx.fillStyle = tod === 'noite' ? 'rgba(200,210,240,.18)' : 'rgba(255,255,255,.85)';
  for (let k = 0; k < 3; k++) {
    const sp = 8 + k * 5, span = cw + L.W * 3;
    const x = ((t / 1000) * sp + k * span / 3) % span - L.W * 1.5;
    const y = horizon * (0.25 + k * 0.2), s = L.W * (0.28 + k * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.3, s * 0.5, 0, 0, 7);
    ctx.ellipse(x - s * 0.6, y + s * 0.1, s * 0.7, s * 0.4, 0, 0, 7);
    ctx.ellipse(x + s * 0.6, y + s * 0.05, s * 0.8, s * 0.45, 0, 0, 7);
    ctx.fill();
  }
}

function drawGround() {
  const { cw, ch, horizon, W } = L, est = estacao();
  ctx.fillStyle = est.morro;
  ctx.beginPath(); ctx.moveTo(0, horizon + 4);
  for (let x = 0; x <= cw + 20; x += 20) ctx.lineTo(x, horizon - Math.sin(x / cw * 7 + 1) * W * 0.12 - W * 0.08);
  ctx.lineTo(cw, horizon + 10); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, horizon, 0, ch);
  g.addColorStop(0, est.grama[0]); g.addColorStop(1, est.grama[1]);
  ctx.fillStyle = g; ctx.fillRect(0, horizon, cw, ch - horizon);
  // outono: folhas caídas; inverno: montinhos de neve
  const visivel = q => q.x > -20 && q.x < cw + 20 && q.y > horizon + 6 && q.y < ch + 20;
  if (est.folhas || est.neve) TUFTS.forEach(([x, y, k], n) => {
    if (n % (est.neve ? 5 : 3)) return;
    const q0 = tuftAt(x, y); if (!visivel(q0)) return;
    const px = q0.x, py = q0.y;
    ctx.fillStyle = est.neve ? 'rgba(140,175,130,.45)' : ['#d9822b', '#c8502a', '#e8b04a'][n % 3];
    ctx.beginPath(); ctx.ellipse(px, py, est.neve ? W * (0.08 + k * 0.1) : W * 0.035, est.neve ? W * (0.025 + k * 0.03) : W * 0.018, est.neve ? 0 : k * 3, 0, 7); ctx.fill();
  });
  const FL = ['#ffffff', '#ffd54a', '#f06292', '#ffffff', '#ba68c8'];
  TUFTS.forEach(([x, y, k], n) => {
    if (!est.flores || n % Math.max(2, Math.round(27 / est.flores))) return;
    const q0 = tuftAt(x, y); if (!visivel(q0)) return;
    const px = q0.x, py = q0.y, r = Math.max(1.8, W * 0.025);
    for (let f = 0; f < 3; f++) { ctx.fillStyle = FL[(n + f) % FL.length]; ctx.beginPath(); ctx.arc(px + f * r * 2.4 - r * 2.4, py + (f % 2) * r * 1.5, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc(px, py, r * 0.45, 0, 7); ctx.fill();
  });
  ctx.strokeStyle = est.neve ? 'rgba(110,140,120,.3)' : est.folhas ? 'rgba(110,100,30,.45)' : 'rgba(46,110,30,.45)'; ctx.lineWidth = 1.2;
  for (const [x, y, k] of TUFTS) {
    const q0 = tuftAt(x, y); if (!visivel(q0)) continue;
    const px = q0.x, py = q0.y, s = W * (0.04 + k * 0.04);
    ctx.beginPath();
    ctx.moveTo(px - s, py - s); ctx.lineTo(px - s * 0.3, py);
    ctx.moveTo(px, py - s * 1.3); ctx.lineTo(px, py);
    ctx.moveTo(px + s, py - s); ctx.lineTo(px + s * 0.3, py);
    ctx.stroke();
  }
}

function nightOverlay(tod) {
  if (tod === 'dia') return;
  ctx.fillStyle = tod === 'noite' ? 'rgba(15,25,70,.32)' : tod === 'tarde' ? 'rgba(255,120,40,.1)' : 'rgba(120,100,200,.12)';
  ctx.fillRect(0, 0, L.cw, L.ch);
}

// ---------- Casa e celeiro (com temas) ----------
// Desenho em "2,5D": frente + lateral mais escura + telhado com beiral. Leve: poucos caminhos.
// Os temas mudam as cores da casa e do celeiro juntos (a Casa dos Pioneiros é presente do 1º mês).
const TEMAS_CASA = [
  { id: 'classico', nome: 'Clássica',          desc: 'Casinha creme de telhado de barro e celeiro vermelho.', nivel: 1,  custo: 0,
    parede: '#f1dcae', telhado: '#c0562f', porta: '#7a4a22', moldura: '#fff7e6', celeiro: '#c8402f', celTelhado: '#6e3b2a', friso: '#fff4e0' },
  { id: 'pioneiro', nome: 'Casa dos Pioneiros', desc: 'Azul com detalhes dourados. Presente de quem jogou no primeiro mês.', especial: true,
    parede: '#f3e9cf', telhado: '#2c5282', porta: '#2c5282', moldura: '#ffd54a', celeiro: '#3f6fa8', celTelhado: '#2c5282', friso: '#ffd54a', estrela: true },
  { id: 'chale',    nome: 'Chalé de madeira',   desc: 'Tábuas de madeira e telhado verde-musgo.', nivel: 5,  custo: 2500,
    parede: '#c08a55', telhado: '#4f7a3a', porta: '#6b3f1f', moldura: '#f3e3c0', celeiro: '#8a5a33', celTelhado: '#4f7a3a', friso: '#f3e3c0', tabuas: true },
  { id: 'colonial', nome: 'Casarão colonial',   desc: 'Paredes brancas, janelas azuis e telhas de barro, como nas cidades históricas de Goiás.', nivel: 8,  custo: 4000,
    parede: '#fbf7ee', telhado: '#c86a3a', porta: '#2f6fb0', moldura: '#2f6fb0', celeiro: '#ece4d2', celTelhado: '#c86a3a', friso: '#2f6fb0' },
  { id: 'girassol', nome: 'Casa Girassol',      desc: 'Amarelinha e alegre, com telhado vermelho.', nivel: 12, custo: 6000,
    parede: '#f2c94c', telhado: '#a8432f', porta: '#7a4a22', moldura: '#ffffff', celeiro: '#e39a2c', celTelhado: '#8a3a2a', friso: '#ffffff' },
  { id: 'vovo',     nome: 'Casa da Vovó',       desc: 'Rosinha, com janelas brancas e telhado cor de vinho.', nivel: 15, custo: 8000,
    parede: '#f4b8c8', telhado: '#7a3f63', porta: '#7a3f63', moldura: '#ffffff', celeiro: '#d97a9a', celTelhado: '#6a3a5a', friso: '#ffffff' },
  { id: 'pedra',    nome: 'Casa de pedra',      desc: 'Paredes de pedra e telhado escuro, bem de fazenda antiga.', nivel: 20, custo: 12000,
    parede: '#a3a7ab', telhado: '#3f4a55', porta: '#5a3a1f', moldura: '#e8e2d0', celeiro: '#7f858c', celTelhado: '#3f4a55', friso: '#e8e2d0', pedra: true },
  { id: 'trevo',    nome: 'Casa do Trevo',      desc: 'Verde-menta com trevo na fachada. Exclusiva da Loja do Trevo 🍀.', trevo: 40,
    parede: '#d8f0c8', telhado: '#3f8a3a', porta: '#2f6a2a', moldura: '#ffffff', celeiro: '#5aa04a', celTelhado: '#2f6a2a', friso: '#ffffff', icone: 'trevo' },
  { id: 'lavanda',  nome: 'Casa Lavanda',       desc: 'Lilás clarinho com telhado roxo. Exclusiva da Loja do Trevo 🍀.', trevo: 40,
    parede: '#e6dcf5', telhado: '#6a4a9a', porta: '#6a4a9a', moldura: '#ffffff', celeiro: '#b89ad8', celTelhado: '#4a3a7a', friso: '#ffffff' },
  { id: 'cerrado',  nome: 'Casa do Cerrado',    desc: 'Cor de terra do cerrado, com telhado cor de ferrugem. Exclusiva da Loja do Trevo 🍀.', trevo: 45,
    parede: '#e8b878', telhado: '#9a4a24', porta: '#5a3a1f', moldura: '#f6e7c8', celeiro: '#c8702f', celTelhado: '#6a3a18', friso: '#f6e7c8' },
  { id: 'estrelada', nome: 'Casa Estrelada',    desc: 'Azul da noite com detalhes dourados. Exclusiva da Loja do Trevo 🍀.', trevo: 50,
    parede: '#34487a', telhado: '#1a2440', porta: '#e0b030', moldura: '#ffd54a', celeiro: '#3f5690', celTelhado: '#1a2440', friso: '#ffd54a', estrela: true },
  { id: 'real',     nome: 'Rancho Real',        desc: 'Vinho e dourado, de fazenda de novela. Exclusiva da Loja do Trevo 🍀.', trevo: 60,
    parede: '#f6e7c8', telhado: '#8a1f2a', porta: '#8a1f2a', moldura: '#e0b030', celeiro: '#9a2530', celTelhado: '#5a1018', friso: '#e0b030', estrela: true },
];
function desenhaTrevo(g, x, y, r) {
  g.fillStyle = '#2f8a2f'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, 0, 7); g.fill(); }
  g.strokeStyle = '#2f6a2a'; g.lineWidth = Math.max(1, r * 0.2); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + r * 0.3, y + r * 0.9, x + r * 0.7, y + r * 1.2); g.stroke();
}
const TEMA_CASA = Object.fromEntries(TEMAS_CASA.map(t => [t.id, t]));
// Escurece (k < 0) ou clareia (k > 0) uma cor #rrggbb.
function tomCor(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = c => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function forma(pts, fill, stroke, lw) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
// textura da parede (tábuas ou pedras) dentro de um retângulo
function texturaParede(tm, x0, y0, w, h, s) {
  if (tm.tabuas) { ctx.strokeStyle = 'rgba(90,50,20,.25)'; ctx.lineWidth = 1; for (let k = 1; k < 6; k++) { const yy = y0 + h * k / 6; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + w, yy); ctx.stroke(); } }
  if (tm.pedra) { ctx.fillStyle = 'rgba(60,60,60,.18)'; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const px = x0 + w * (c + (r % 2) * 0.5) / 4 + 2, py = y0 + h * r / 4 + 2; if (px + w / 5 < x0 + w) { ctx.beginPath(); ctx.roundRect(px, py, w / 5, h / 5.2, 2); ctx.fill(); } } }
}
function janelaCasa(x, y, w, h, tm) {
  ctx.fillStyle = tm.moldura; ctx.beginPath(); ctx.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, 2); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 1, y + 1, w * 0.35, h * 0.4);
  ctx.strokeStyle = tm.moldura; ctx.lineWidth = Math.max(1, w * 0.1); ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
}
function temaCasa(skin, cor) {
  const tm = TEMA_CASA[skin] && skin !== 'classico' ? TEMA_CASA[skin] : TEMA_CASA.classico;
  return cor && !TEMA_CASA[skin] ? Object.assign({}, tm, { parede: cor }) : tm;
}
function drawHouse(x, y, s, cor, skin, costas) {
  const tm = temaCasa(skin, cor), fw = s * 0.66, fh = s * 0.4, rh = s * 0.3, dx = s * 0.34, dy = -s * 0.17, ov = s * 0.05;
  const X0 = x - (fw + dx) / 2, Y = y - dy / 2;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.62, s * 0.12, 0, 0, 7); ctx.fill();
  // lateral (mais escura)
  forma([[X0 + fw, Y], [X0 + fw + dx, Y + dy], [X0 + fw + dx, Y + dy - fh], [X0 + fw, Y - fh]], tomCor(tm.parede, -0.18));
  // frente com a empena
  forma([[X0, Y], [X0 + fw, Y], [X0 + fw, Y - fh], [X0 + fw / 2, Y - fh - rh], [X0, Y - fh]], tm.parede);
  ctx.save(); ctx.beginPath(); ctx.rect(X0, Y - fh, fw, fh); ctx.clip(); texturaParede(tm, X0, Y - fh, fw, fh, s); ctx.restore();
  // chaminé (atrás do telhado) e fumacinha
  const cx = X0 + fw * 0.5 + dx * 0.7, cy = Y - fh - rh * 0.55 + dy * 0.7;
  ctx.fillStyle = tomCor(tm.parede, -0.3); ctx.fillRect(cx - s * 0.035, cy - s * 0.2, s * 0.07, s * 0.2);
  ctx.fillStyle = tomCor(tm.telhado, -0.2); ctx.fillRect(cx - s * 0.045, cy - s * 0.22, s * 0.09, s * 0.03);
  const tt = performance.now() / 1000;
  for (let k = 0; k < 3; k++) { const f = (tt * 0.35 + k / 3) % 1; ctx.fillStyle = `rgba(235,235,235,${0.55 * (1 - f)})`; ctx.beginPath(); ctx.arc(cx + Math.sin(f * 4 + k) * s * 0.03, cy - s * 0.24 - f * s * 0.3, s * (0.03 + f * 0.04), 0, 7); ctx.fill(); }
  // telhado: a água da direita (vista de cima) e a borda da frente
  const cume = [X0 + fw / 2, Y - fh - rh], beiralD = [X0 + fw + ov, Y - fh + ov * 0.9];
  forma([cume, beiralD, [beiralD[0] + dx, beiralD[1] + dy], [cume[0] + dx, cume[1] + dy]], tm.telhado);
  ctx.strokeStyle = tomCor(tm.telhado, -0.25); ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { const a = k / 4, p = [cume[0] + (beiralD[0] - cume[0]) * a, cume[1] + (beiralD[1] - cume[1]) * a]; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + dx, p[1] + dy); ctx.stroke(); }
  if (estacao().neve) forma([cume, [cume[0] + (beiralD[0] - cume[0]) * 0.45, cume[1] + (beiralD[1] - cume[1]) * 0.45], [cume[0] + (beiralD[0] - cume[0]) * 0.45 + dx, cume[1] + (beiralD[1] - cume[1]) * 0.45 + dy], [cume[0] + dx, cume[1] + dy]], '#ffffff');
  ctx.strokeStyle = tomCor(tm.telhado, -0.3); ctx.lineWidth = Math.max(2, s * 0.045); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(X0 - ov, Y - fh + ov * 0.9); ctx.lineTo(cume[0], cume[1]); ctx.lineTo(beiralD[0], beiralD[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cume[0], cume[1]); ctx.lineTo(cume[0] + dx, cume[1] + dy); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  // janelinha redonda na empena
  ctx.fillStyle = tm.moldura; ctx.beginPath(); ctx.arc(cume[0], Y - fh - rh * 0.4, s * 0.045, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cume[0], Y - fh - rh * 0.4, s * 0.03, 0, 7); ctx.fill();
  if (!costas) {
  // porta com arco, degrau e maçaneta
  const pw = fw * 0.24, ph = fh * 0.66, px = X0 + fw * 0.5 - pw / 2;
  ctx.fillStyle = tomCor(tm.parede, -0.35); ctx.fillRect(px - s * 0.02, Y - s * 0.02, pw + s * 0.04, s * 0.03);
  ctx.fillStyle = tm.porta; ctx.beginPath(); ctx.moveTo(px, Y); ctx.lineTo(px, Y - ph + pw / 2); ctx.arc(px + pw / 2, Y - ph + pw / 2, pw / 2, Math.PI, 0); ctx.lineTo(px + pw, Y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(px + pw * 0.78, Y - ph * 0.45, s * 0.012, 0, 7); ctx.fill();
  }
  // janelas da frente e da lateral
  const jw = fw * 0.18, jh = fh * 0.3;
  if (!costas) janelaCasa(X0 + fw * 0.08, Y - fh * 0.72, jw, jh, tm), janelaCasa(X0 + fw * 0.74, Y - fh * 0.72, jw, jh, tm);
  // floreira embaixo das janelas
  if (!costas) for (const jx of [X0 + fw * 0.08, X0 + fw * 0.74]) { ctx.fillStyle = '#8a5a33'; ctx.fillRect(jx - 1, Y - fh * 0.72 + jh + 2, jw + 2, s * 0.025); for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#e0503a', '#f2c14e', '#e86aa0'][k]; ctx.beginPath(); ctx.arc(jx + jw * (0.2 + k * 0.3), Y - fh * 0.72 + jh + 1, s * 0.014, 0, 7); ctx.fill(); } }
  ctx.save(); ctx.transform(1, dy / dx, 0, 1, 0, 0);
  const lx = X0 + fw + dx * 0.35, ly = (Y - fh * 0.72) - (dy / dx) * (X0 + fw + dx * 0.35) + dy * 0.35;
  janelaCasa(lx, ly, dx * 0.32, jh, tm); ctx.restore();
  if (tm.estrela) star(cume[0], Y - fh - rh * 0.4, s * 0.04);
  if (tm.icone === 'trevo') desenhaTrevo(ctx, cume[0], Y - fh - rh * 0.42, s * 0.035);
}
function drawBarn(x, y, s, skin, costas) {
  const tm = temaCasa(skin), fw = s * 0.72, fh = s * 0.44, rh = s * 0.34, dx = s * 0.36, dy = -s * 0.18, ov = s * 0.05;
  const X0 = x - (fw + dx) / 2, Y = y - dy / 2;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.64, s * 0.12, 0, 0, 7); ctx.fill();
  forma([[X0 + fw, Y], [X0 + fw + dx, Y + dy], [X0 + fw + dx, Y + dy - fh], [X0 + fw, Y - fh]], tomCor(tm.celeiro, -0.22));
  // frente com telhado "quebrado" (gambrel), o jeito clássico de celeiro
  const q1 = [X0 + fw * 0.1, Y - fh - rh * 0.62], cume = [X0 + fw / 2, Y - fh - rh], q2 = [X0 + fw * 0.9, Y - fh - rh * 0.62];
  forma([[X0, Y], [X0 + fw, Y], [X0 + fw, Y - fh], q2, cume, q1, [X0, Y - fh]], tm.celeiro);
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; for (let k = 1; k < 7; k++) { const xx = X0 + fw * k / 7; ctx.beginPath(); ctx.moveTo(xx, Y); ctx.lineTo(xx, Y - fh); ctx.stroke(); }
  // telhado lateral em duas águas
  const bD = [X0 + fw + ov, Y - fh + ov * 0.9];
  forma([q2, bD, [bD[0] + dx, bD[1] + dy], [q2[0] + dx, q2[1] + dy]], tm.celTelhado);
  forma([cume, q2, [q2[0] + dx, q2[1] + dy], [cume[0] + dx, cume[1] + dy]], tomCor(tm.celTelhado, 0.12));
  if (estacao().neve) forma([cume, q2, [q2[0] + dx, q2[1] + dy], [cume[0] + dx, cume[1] + dy]], '#ffffff');
  ctx.strokeStyle = tm.friso; ctx.lineWidth = Math.max(2, s * 0.035); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(X0 - ov, Y - fh + ov); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(cume[0], cume[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(bD[0], bD[1]); ctx.stroke();
  ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  // porta grande com X e a janela do feno
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  const dw = fw * 0.44, dh = fh * 0.72, dxp = X0 + fw / 2 - dw / 2;
  if (!costas) {
    ctx.fillStyle = tomCor(tm.celeiro, -0.3); ctx.fillRect(dxp, Y - dh, dw, dh);
    ctx.strokeRect(dxp, Y - dh, dw, dh);
    ctx.beginPath(); ctx.moveTo(dxp, Y - dh); ctx.lineTo(dxp + dw, Y); ctx.moveTo(dxp + dw, Y - dh); ctx.lineTo(dxp, Y); ctx.moveTo(dxp + dw / 2, Y - dh); ctx.lineTo(dxp + dw / 2, Y); ctx.stroke();
  }
  const hw = fw * 0.2, hh = rh * 0.34, hy = Y - fh - rh * 0.5;
  ctx.fillStyle = '#5a3a1f'; ctx.fillRect(cume[0] - hw / 2, hy, hw, hh); ctx.strokeRect(cume[0] - hw / 2, hy, hw, hh);
  ctx.fillStyle = '#e8c35a'; ctx.fillRect(cume[0] - hw / 2 + 2, hy + hh * 0.55, hw - 4, hh * 0.4); // feno
  ctx.strokeRect(X0, Y - fh, fw, fh);
  if (tm.estrela) star(cume[0], Y - fh - rh * 0.78, s * 0.045);
  if (tm.icone === 'trevo') desenhaTrevo(ctx, cume[0], Y - fh - rh * 0.8, s * 0.04);
}
function drawCoop(x, y, s) {
  const w = s * 0.8, h = s * 0.45;
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.65, s * 0.07, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#6e4424'; ctx.fillRect(x - w * 0.42, y - s * 0.12, s * 0.05, s * 0.12); ctx.fillRect(x + w * 0.36, y - s * 0.12, s * 0.05, s * 0.12);
  ctx.fillStyle = '#d9a86a'; ctx.fillRect(x - w / 2, y - s * 0.12 - h, w, h);
  ctx.strokeStyle = 'rgba(110,68,36,.5)'; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - w / 2, y - s * 0.12 - h * k / 4); ctx.lineTo(x + w / 2, y - s * 0.12 - h * k / 4); ctx.stroke(); }
  ctx.fillStyle = '#c8402f';
  ctx.beginPath(); ctx.moveTo(x - w * 0.62, y - s * 0.12 - h); ctx.lineTo(x, y - s * 0.12 - h - s * 0.32); ctx.lineTo(x + w * 0.62, y - s * 0.12 - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(x, y - s * 0.12 - h * 0.45, s * 0.1, Math.PI, 0); ctx.lineTo(x + s * 0.1, y - s * 0.12 - h * 0.1); ctx.lineTo(x - s * 0.1, y - s * 0.12 - h * 0.1); ctx.fill();
  ctx.strokeStyle = '#a0703f'; ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.moveTo(x - s * 0.08, y - s * 0.12 - h * 0.1); ctx.lineTo(x + s * 0.25, y); ctx.stroke();
}
function drawTree(x, y, s, t, coqueiro) {
  const sw = Math.sin(t / 1400 + x) * s * 0.02, est = estacao();
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.35, s * 0.08, 0, 0, 7); ctx.fill();
  if (coqueiro) {
    // tronco curvo e folhas compridas
    ctx.strokeStyle = '#9a6a3a'; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - s * 0.15, y - s * 0.5, x + sw * 3, y - s * 0.95); ctx.stroke(); ctx.lineCap = 'butt';
    const tx = x + sw * 3, ty = y - s * 0.95;
    for (const a of [-2.6, -2.0, -1.2, -0.5, 0.1, -1.6]) leaf(tx, ty, s * 0.55, s * 0.09, a + Math.PI / 2 + sw * 0.05, '#3f9a2f');
    ctx.fillStyle = '#7a4a22'; for (const dx of [-0.05, 0.05, 0]) { ctx.beginPath(); ctx.arc(tx + dx * s, ty + s * 0.06, s * 0.05, 0, 7); ctx.fill(); }
    return;
  }
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5);
  if (est.pelada) {
    // outono e inverno: só os galhos (no inverno, com neve em cima)
    const galhos = [[-0.34, -0.9, -0.2, -0.62], [0.32, -0.95, 0.18, -0.6], [-0.05, -1.05, 0, -0.6], [-0.3, -0.62, -0.1, -0.52], [0.3, -0.66, 0.1, -0.55]];
    ctx.strokeStyle = '#6b4220'; ctx.lineCap = 'round';
    for (const [x1, y1, x0, y0] of galhos) { ctx.lineWidth = s * 0.045; ctx.beginPath(); ctx.moveTo(x + x0 * s * 0.3, y + y0 * s); ctx.quadraticCurveTo(x + (x0 + x1) * s / 2 + sw, y + (y0 + y1) * s / 2, x + x1 * s + sw, y + y1 * s); ctx.stroke(); }
    ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + sw, y - s * 0.75); ctx.stroke();
    if (est.neve) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.035;
      for (const [x1, y1, x0, y0] of galhos) { ctx.beginPath(); ctx.moveTo(x + (x0 + x1) * s / 2 + sw, y + (y0 + y1) * s / 2 - s * 0.03); ctx.lineTo(x + x1 * s + sw, y + y1 * s - s * 0.03); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.3, s * 0.07, 0, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#d9822b'; for (const [dx, dy] of [[-0.3, -0.88], [0.28, -0.9]]) { ctx.beginPath(); ctx.ellipse(x + dx * s + sw, y + dy * s, s * 0.035, s * 0.02, 0.5, 0, 7); ctx.fill(); }
    }
    ctx.lineCap = 'butt';
    return;
  }
  ctx.fillStyle = est.folha;
  ctx.beginPath(); ctx.arc(x + sw, y - s * 0.72, s * 0.32, 0, 7); ctx.arc(x - s * 0.22 + sw, y - s * 0.55, s * 0.24, 0, 7); ctx.arc(x + s * 0.22 + sw, y - s * 0.56, s * 0.25, 0, 7); ctx.fill();
  if (est.flor) {
    // primavera: árvore florida
    for (let k = 0; k < 14; k++) { const a = k * 2.4, r = s * (0.08 + (k % 5) * 0.05); ctx.fillStyle = k % 3 ? '#f8bbd0' : '#ffffff'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 1.3 + sw, y - s * 0.66 + Math.sin(a) * r * 0.9, s * 0.03, 0, 7); ctx.fill(); }
    return;
  }
  ctx.fillStyle = '#e53b2f';
  for (const [dx, dy] of [[-.15, -.7], [.12, -.8], [.2, -.55], [-.25, -.5]]) { ctx.beginPath(); ctx.arc(x + dx * s + sw, y + dy * s, s * 0.035, 0, 7); ctx.fill(); }
}
// Cachorro virado para a esquerda. raca muda as cores; sleeping = deitado dormindo.
function drawDog(x, y, s, t, raca = 'caramelo', sleeping = false) {
  const b = DOG[raca] || DOG.caramelo, body = b.cor, dark = b.cor2;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.06, 0, 0, 7); ctx.fill();
  ctx.lineCap = 'round';
  if (sleeping) {
    ctx.strokeStyle = body; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(x + s * 0.26, y - s * 0.07); ctx.quadraticCurveTo(x + s * 0.38, y - s * 0.02, x + s * 0.3, y); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x + s * 0.04, y - s * 0.08, s * 0.25, s * 0.09, 0, 0, 7); ctx.fill();
    if (raca === 'pastor') { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x + s * 0.08, y - s * 0.13, s * 0.15, s * 0.05, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(x - s * 0.22, y - s * 0.08, s * 0.11, s * 0.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = raca === 'caramelo' ? '#a8692f' : dark;
    ctx.beginPath(); ctx.ellipse(x - s * 0.19, y - s * 0.13, s * 0.045, s * 0.07, 0.9, 0, 7); ctx.fill();
    if (raca === 'fila') { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.07, s * 0.05, s * 0.04, 0, 0, 7); ctx.fill(); }
    line({ x: x - s * 0.27, y: y - s * 0.095 }, { x: x - s * 0.225, y: y - s * 0.09 }, '#222', Math.max(1, s * 0.018));
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - s * 0.33, y - s * 0.075, s * 0.02, 0, 7); ctx.fill();
    const k = (t / 1600) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.95 - k * 0.9})`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.max(9, Math.round(s * 0.17))}px 'Baloo 2', sans-serif`;
    ctx.fillText('z', x - s * 0.16 + k * s * 0.12, y - s * 0.26 - k * s * 0.22);
    ctx.font = `800 ${Math.max(8, Math.round(s * 0.12))}px 'Baloo 2', sans-serif`;
    ctx.fillText('z', x - s * 0.05 + k * s * 0.12, y - s * 0.38 - k * s * 0.22);
    ctx.lineCap = 'butt';
    return;
  }
  const wag = Math.sin(t / 120) * 0.5;
  ctx.strokeStyle = body; ctx.lineWidth = s * 0.06;
  ctx.beginPath(); ctx.moveTo(x + s * 0.22, y - s * 0.22); ctx.lineTo(x + s * 0.36, y - s * 0.34 + wag * s * 0.1); ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(x + s * 0.05, y - s * 0.18, s * 0.22, s * 0.12, 0, 0, 7); ctx.fill();
  ctx.fillRect(x - s * 0.12, y - s * 0.12, s * 0.06, s * 0.12); ctx.fillRect(x + s * 0.16, y - s * 0.12, s * 0.06, s * 0.12);
  if (raca === 'pastor') { ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x + s * 0.09, y - s * 0.25, s * 0.15, s * 0.06, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(x - s * 0.17, y - s * 0.3, s * 0.13, 0, 7); ctx.fill();
  ctx.fillStyle = raca === 'caramelo' ? '#a8692f' : dark;
  ctx.beginPath(); ctx.ellipse(x - s * 0.26, y - s * 0.28, s * 0.05, s * 0.1, 0.4, 0, 7); ctx.fill();
  if (raca === 'pastor') { ctx.beginPath(); ctx.moveTo(x - s * 0.12, y - s * 0.4); ctx.lineTo(x - s * 0.08, y - s * 0.52); ctx.lineTo(x - s * 0.03, y - s * 0.39); ctx.fill(); }
  if (raca === 'fila') { ctx.beginPath(); ctx.ellipse(x - s * 0.28, y - s * 0.26, s * 0.06, s * 0.05, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - s * 0.21, y - s * 0.32, s * 0.02, 0, 7); ctx.arc(x - s * 0.3, y - s * 0.27, s * 0.025, 0, 7); ctx.fill();
  ctx.lineCap = 'butt';
}
// Casinha de cachorro, com a base centrada em (x, y).
function drawKennel(x, y, s, skin, costas) {
  // casinha em "2,5D": frente com empena, lateral mais escura, telhado com beiral, plaquinha e tigela.
  // Com tema de casa, usa as cores do celeiro do tema.
  const fw = s * 0.5, fh = s * 0.3, rh = s * 0.22, dx = s * 0.26, dy = -s * 0.13, ov = s * 0.04;
  const tm = TEMA_CASA[skin] && skin !== 'classico' ? TEMA_CASA[skin] : null;
  const X0 = x - (fw + dx) / 2, Y = y - dy / 2, mad = tm ? tm.celeiro : '#b88350', tel = tm ? tm.celTelhado : '#c8402f';
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.46, s * 0.1, 0, 0, 7); ctx.fill();
  forma([[X0 + fw, Y], [X0 + fw + dx, Y + dy], [X0 + fw + dx, Y + dy - fh], [X0 + fw, Y - fh]], tomCor(mad, -0.22));
  forma([[X0, Y], [X0 + fw, Y], [X0 + fw, Y - fh], [X0 + fw / 2, Y - fh - rh], [X0, Y - fh]], mad);
  ctx.strokeStyle = 'rgba(90,50,20,.3)'; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { const yy = Y - fh * k / 4; ctx.beginPath(); ctx.moveTo(X0, yy); ctx.lineTo(X0 + fw, yy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X0 + fw, yy); ctx.lineTo(X0 + fw + dx, yy + dy); ctx.stroke(); }
  const cume = [X0 + fw / 2, Y - fh - rh], bD = [X0 + fw + ov, Y - fh + ov];
  forma([cume, bD, [bD[0] + dx, bD[1] + dy], [cume[0] + dx, cume[1] + dy]], tel);
  ctx.strokeStyle = tomCor(tel, -0.25); for (let k = 1; k < 3; k++) { const a = k / 3, p = [cume[0] + (bD[0] - cume[0]) * a, cume[1] + (bD[1] - cume[1]) * a]; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + dx, p[1] + dy); ctx.stroke(); }
  ctx.strokeStyle = tomCor(tel, -0.35); ctx.lineWidth = Math.max(2, s * 0.045); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(X0 - ov, Y - fh + ov); ctx.lineTo(cume[0], cume[1]); ctx.lineTo(bD[0], bD[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cume[0], cume[1]); ctx.lineTo(cume[0] + dx, cume[1] + dy); ctx.stroke(); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  if (estacao().neve) forma([cume, [cume[0] + (bD[0] - cume[0]) * 0.5, cume[1] + (bD[1] - cume[1]) * 0.5], [cume[0] + (bD[0] - cume[0]) * 0.5 + dx, cume[1] + (bD[1] - cume[1]) * 0.5 + dy], [cume[0] + dx, cume[1] + dy]], '#ffffff');
  if (!costas) {
  // porta em arco com moldura clara
  const pw = fw * 0.44, ph = fh * 0.8, px = X0 + fw / 2;
  ctx.fillStyle = '#f3e3c0'; ctx.beginPath(); ctx.moveTo(px - pw / 2 - 2, Y); ctx.lineTo(px - pw / 2 - 2, Y - ph + pw / 2); ctx.arc(px, Y - ph + pw / 2, pw / 2 + 2, Math.PI, 0); ctx.lineTo(px + pw / 2 + 2, Y); ctx.fill();
  ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(px - pw / 2, Y); ctx.lineTo(px - pw / 2, Y - ph + pw / 2); ctx.arc(px, Y - ph + pw / 2, pw / 2, Math.PI, 0); ctx.lineTo(px + pw / 2, Y); ctx.fill();
  }
  // plaquinha com osso
  ctx.fillStyle = '#f3e3c0'; ctx.beginPath(); ctx.roundRect(cume[0] - s * 0.07, Y - fh - rh * 0.55, s * 0.14, s * 0.06, 2); ctx.fill();
  ctx.fillStyle = '#b88350'; ctx.fillRect(cume[0] - s * 0.035, Y - fh - rh * 0.55 + s * 0.022, s * 0.07, s * 0.016);
  for (const sx of [-1, 1]) for (const sy of [0, 1]) { ctx.beginPath(); ctx.arc(cume[0] + sx * s * 0.037, Y - fh - rh * 0.55 + s * 0.02 + sy * s * 0.02, s * 0.01, 0, 7); ctx.fill(); }
  // tigela
  ctx.fillStyle = '#5f7fa0'; ctx.beginPath(); ctx.ellipse(x + s * 0.36, y + s * 0.02, s * 0.075, s * 0.032, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.ellipse(x + s * 0.36, y + s * 0.012, s * 0.055, s * 0.018, 0, 0, 7); ctx.fill();
}
// Onde fica o cachorro de cada lugar (na cena atual).
// A casinha fica à esquerda do celeiro, com o cachorro na frente dela.
const KENNEL_AT = () => { const [u, v] = posOf(S(), scene === 'animais' ? 'animais' : 'roca', 'canil'); return iso(u, v); };
const DOG_AT = () => { const [u, v] = posOf(S(), scene === 'animais' ? 'animais' : 'roca', 'canil'); return iso(u + 1.15, v + 0.65); };
function dogPos(slot) {
  if (scene !== (slot === 'roca' ? 'roca' : 'animais')) return null;
  const p = DOG_AT(); return { x: p.x, y: p.y - L.W * 0.25 };
}
// Casinha + cachorro (ou o lugar vazio) na sua roça ou na de um amigo.
// A casinha vai atrás da cerca; o cachorro, na frente, para aparecer bem.
function drawKennelSpot(slot, s, home, costas) {
  const d = s.dogs && s.dogs[slot];
  if (!home && !dogAlive(d)) return;
  const k = KENNEL_AT();
  drawKennel(k.x, k.y, L.W * 0.85, s.skin, costas);
}
function tipCanil(slot) {
  const c = S().dogs && S().dogs[slot]; if (!c) return null;
  return `<b>Casinha do ${esc(c.nome)}</b>${isHome() ? '<br>Clique para ver seus cachorros.' : ''}`;
}
function tipCaminha(id) {
  const g = S().animals.find(x => x.id === id); if (!g) return null;
  return `<b>Caminha do ${esc(g.nome || 'gato')}</b>${isHome() ? `<br>Clique para trocar o nome dele (${CUSTO_NOME_BICHO} moedas).` : ''}`;
}
function drawDogSpot(slot, s, t, home) {
  const W = L.W, k = KENNEL_AT(), p = DOG_AT();
  const d = s.dogs && s.dogs[slot];
  if (!home && !dogAlive(d)) return;
  if (home && slot === 'roca' && invasor && invasor.fase === 'cachorro') return; // saiu correndo atrás da praga
  if (dogAlive(d)) {
    if (hover && hover.kind === 'dog' && hover.slot === slot) {
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, W * 0.26, W * 0.08, 0, 0, 7); ctx.stroke();
    }
    drawDog(p.x, p.y, W * 0.72, t, d.raca, !dogAwake(d));
  } else {
    const R = clamp(W * 0.1, 9, 14), m = { x: k.x, y: k.y - W * 0.52 };
    ctx.fillStyle = 'rgba(255,253,242,.95)'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, 7); ctx.fill(); ctx.stroke();
    line({ x: m.x - R * 0.5, y: m.y }, { x: m.x + R * 0.5, y: m.y }, '#4f9a2f', 2.5);
    line({ x: m.x, y: m.y - R * 0.5 }, { x: m.x, y: m.y + R * 0.5 }, '#4f9a2f', 2.5);
    hits.push({ kind: 'dog', slot, x: m.x, y: m.y, r: Math.max(R * 1.8, 22) }); // o + também abre a loja de cães
  }
  hits.push({ kind: 'dog', slot, x: (k.x + p.x) / 2, y: p.y - W * 0.2, r: W * 0.4 });
  // a casinha em si: clicar troca o nome do cachorro
  if (dogAlive(d)) {
    hits.push({ kind: 'canil', slot, x: k.x, y: k.y - W * 0.32, r: W * 0.3 });
    if (hover && hover.kind === 'canil' && hover.slot === slot) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(k.x, k.y, W * 0.36, W * 0.13, 0, 0, 7); ctx.stroke(); }
  }
}
function dogBubble(slot, s, t, home) {
  const d = s.dogs && s.dogs[slot];
  if (!home || !dogAlive(d) || dogAwake(d)) return;
  const p = DOG_AT();
  drawBubbleAt(p.x, p.y - L.W * 0.55, 'bone', d, t, 3);
}

// Cerca do lado de trás ('back') ou da frente ('front') de uma área cols×rows.
function drawFence(cols, rows, side) { const e = -0.14; drawFenceRect(e, e, cols - e, rows - e, side); }
// Um trecho de cerca de a até b, no estilo do tema da roça.
function fenceRun(a, b, steps, skipFirst, tm) {
  const W = L.W;
  if (tm.pedra) {
    // muro baixo de pedra
    const h = W * 0.16;
    ctx.fillStyle = tm.trilho; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - h); ctx.lineTo(a.x, a.y - h); ctx.closePath(); ctx.fill();
    line({ x: a.x, y: a.y - h }, { x: b.x, y: b.y - h }, tm.topo, W * 0.04);
    ctx.strokeStyle = 'rgba(70,64,52,.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < steps * 2; k++) { const q = lerp(a, b, (k + (k % 2) * 0.5) / (steps * 2)); ctx.strokeRect(q.x - W * 0.06, q.y - h * (k % 2 ? 0.95 : 0.5), W * 0.12, h * 0.45); }
    return;
  }
  const post = p => {
    ctx.fillStyle = tm.poste; ctx.fillRect(p.x - W * 0.025, p.y - W * 0.2, W * 0.05, W * 0.2);
    ctx.fillStyle = estacao().neve ? '#ffffff' : tm.topo; ctx.fillRect(p.x - W * 0.025, p.y - W * 0.2 - (estacao().neve ? W * 0.015 : 0), W * 0.05, W * 0.03 + (estacao().neve ? W * 0.015 : 0));
    if (tm.bambu) for (const h of [0.07, 0.14]) { ctx.fillStyle = 'rgba(60,80,20,.5)'; ctx.fillRect(p.x - W * 0.025, p.y - W * h, W * 0.05, 1.5); }
    if (tm.rosas) { ctx.fillStyle = '#3f8a2a'; ctx.beginPath(); ctx.arc(p.x, p.y - W * 0.03, W * 0.05, 0, 7); ctx.fill(); ctx.fillStyle = '#e53b2f'; ctx.beginPath(); ctx.arc(p.x + W * 0.02, p.y - W * 0.06, W * 0.022, 0, 7); ctx.fill(); }
  };
  if (tm.arame) {
    for (const h of [0.06, 0.12, 0.18]) {
      line({ x: a.x, y: a.y - W * h }, { x: b.x, y: b.y - W * h }, tm.trilho, Math.max(1, W * 0.008));
      ctx.strokeStyle = tm.trilho; ctx.lineWidth = 1;
      for (let k = 1; k < steps * 4; k++) { const q = lerp(a, b, k / (steps * 4)); ctx.beginPath(); ctx.moveTo(q.x - 2, q.y - W * h - 2); ctx.lineTo(q.x + 2, q.y - W * h + 2); ctx.moveTo(q.x + 2, q.y - W * h - 2); ctx.lineTo(q.x - 2, q.y - W * h + 2); ctx.stroke(); }
    }
  } else for (const h of [0.08, 0.16]) line({ x: a.x, y: a.y - W * h }, { x: b.x, y: b.y - W * h }, tm.trilho, W * 0.03);
  for (let k = skipFirst ? 1 : 0; k <= steps; k++) post(lerp(a, b, k / steps));
}
function drawFenceRect(u0, v0, u1, v1, side) {
  const tm = temaDe(S());
  const run = (c0, r0, c1, r1, steps, skipFirst) => fenceRun(iso(c0, r0), iso(c1, r1), steps, skipFirst, tm);
  const nu = Math.round((u1 - u0) * 2), nv = Math.round((v1 - v0) * 2);
  if (side === 'back') { run(u0, v0, u1, v0, nu); run(u0, v0, u0, v1, nv, true); }
  else { run(u0, v1, u1, v1, nu, true); run(u1, v0, u1, v1, nv, true); }
}

// ============================================================
// Plantas, pragas e produtos
// ============================================================
function leaf(x, y, len, wid, ang, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.ellipse(0, -len / 2, wid, len / 2, 0, 0, 7);
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = 'rgba(20,50,10,.35)'; ctx.lineWidth = Math.max(0.8, wid * 0.18); ctx.stroke();
  ctx.restore();
}
function ball(x, y, r, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, 7); ctx.fill();
}

// Planta com a base em (x, y); s = escala.
// Brotinhos: cada planta cresce do seu jeito (capim, trevinho, folha larga, roseta, rama…).
const BROTO = { feijao: 'trevo', soja: 'trevo', amendoim: 'amendoim', arroz: 'capim', trigo: 'capim', milho: 'milho', cana: 'cana', cenoura: 'plumosa',
  cebola: 'tubo', mandioca: 'palmada', batata: 'batata', tomate: 'tomate', alface: 'roseta', couve: 'couve', abobora: 'larga', melancia: 'larga', pepino: 'larga', maxixe: 'larga',
  pimentao: 'arbusto', abacaxi: 'espada', mamao: 'mamao', limao: 'arvorezinha', cafe: 'cafe', conde: 'arvorezinha', maracuja: 'trepadeira', algodao: 'algodao', cacau: 'arvorezinha' };
function drawBroto(x, y, s, crop, stage, sway) {
  const g = stage === 2 ? 1 : 0.6, tipo = BROTO[crop.id] || 'arbusto', lw = w => { ctx.lineWidth = w * s; ctx.lineCap = 'round'; };
  const haste = (h, cor = '#3a8a2c', w = 1.3) => { ctx.strokeStyle = cor; lw(w); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway * 6 * s, y - h * s); ctx.stroke(); return { x: x + sway * 6 * s, y: y - h * s }; };
  const bolinha = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, 7); ctx.fill(); };
  switch (tipo) {
    case 'capim': case 'milho': case 'cana': { // folhas finas e compridas saindo do chão
      const n = stage === 2 ? 5 : 3, larg = tipo === 'milho' ? 2.8 : tipo === 'cana' ? 2 : 1.3, alt = (crop.id === 'arroz' ? 15 : 18) * g;
      for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * (tipo === 'milho' ? 0.5 : 0.28) + sway; leaf(x, y, alt * s * (1 - Math.abs(a) * 0.3), larg * s, a, k % 2 ? '#6cc24a' : (crop.id === 'arroz' ? '#7cc84a' : '#4fa83a')); }
      if (tipo === 'cana') { ctx.fillStyle = '#9a6a8a'; ctx.fillRect(x - 1.2 * s, y - 3 * s, 2.4 * s, 3 * s); }
      break;
    }
    case 'trevo': case 'amendoim': { // hastezinha com folhas de três (feijão/soja) ou pares de folhinhas ovais (amendoim)
      const topo = haste(9 * g + 2);
      const tri = (cx, cy, r, c) => { for (const a of [-0.9, 0, 0.9]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx + Math.sin(a) * r * 1.1, cy - Math.cos(a) * r * 1.1, r * 0.75, r, a, 0, 7); ctx.fill(); } };
      const cor = crop.id === 'soja' ? '#7ab84a' : '#4fa83a';
      if (tipo === 'trevo') { tri(topo.x, topo.y, 2.6 * s * (0.8 + g * 0.3), cor); if (stage === 2) { tri(x - 5 * s, y - 6 * s, 2.2 * s, '#6cc24a'); tri(x + 5 * s, y - 5 * s, 2.2 * s, '#6cc24a'); } }
      else for (const [dx, dy] of stage === 2 ? [[-3, -4], [3, -4], [-3, -9], [3, -9], [0, -12]] : [[-2.5, -5], [2.5, -5]]) { ctx.fillStyle = '#5aa83a'; ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, 2 * s, 1.3 * s, dx * 0.2, 0, 7); ctx.fill(); }
      break;
    }
    case 'plumosa': { // cenoura: folhagem fininha e rendada
      ctx.strokeStyle = '#4fa83a'; lw(0.8);
      for (const a of stage === 2 ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.3, 0.3]) {
        const tx = x + Math.sin(a + sway) * 14 * g * s, ty = y - Math.cos(a) * 14 * g * s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
        for (let k = 1; k <= 3; k++) { const px = x + (tx - x) * k / 4, py = y + (ty - y) * k / 4; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 2.5 * s, py - 2 * s); ctx.moveTo(px, py); ctx.lineTo(px + 2.5 * s, py - 2 * s); ctx.stroke(); }
      }
      break;
    }
    case 'tubo': { // cebola: canudinhos em pé
      ctx.strokeStyle = '#5aa83a'; lw(1.8);
      for (const a of stage === 2 ? [-0.25, 0, 0.22] : [-0.1, 0.12]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a + sway * 0.5) * 16 * g * s, y - Math.cos(a) * 16 * g * s); ctx.stroke(); }
      break;
    }
    case 'palmada': { // mandioca: talos avermelhados com folha em forma de mão
      const topo = haste(12 * g + 2, '#b0503a', 1.4);
      const mao = (cx, cy, r) => { for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) leaf(cx, cy, r, r * 0.22, a + sway, '#3f8a2c'); };
      mao(topo.x, topo.y, 9 * g * s); if (stage === 2) mao(x - 4 * s, y - 6 * s, 6 * s);
      break;
    }
    case 'roseta': case 'couve': { // alface/couve: rosetinha de folhas redondas
      const cor = tipo === 'couve' ? '#4f8a4a' : '#9ad85a', cor2 = tipo === 'couve' ? '#6a9a6a' : '#b8e87a', n = stage === 2 ? 6 : 4;
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; ctx.fillStyle = k % 2 ? cor : cor2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 3.5 * g * s, y - 3 * s + Math.sin(a) * 1.8 * g * s, 4.2 * g * s, 3 * g * s, a, 0, 7); ctx.fill(); }
      if (tipo === 'couve') { ctx.strokeStyle = 'rgba(230,240,230,.7)'; lw(0.6); ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.lineTo(x + 3 * g * s, y - 5 * s); ctx.stroke(); }
      break;
    }
    case 'larga': { // abóbora/melancia/pepino: folhas largas e rentes ao chão, com gavinha
      const cor = crop.id === 'melancia' ? '#3f8a2f' : '#5aa83a';
      for (const [dx, a] of stage === 2 ? [[-6, -1.2], [6, 1.2], [0, 0]] : [[-3, -0.9], [3, 0.9]]) { ctx.save(); ctx.translate(x + dx * s, y); ctx.scale(1, 0.7); leaf(0, 0, 10 * g * s, 6 * g * s, a + sway, cor); ctx.restore(); }
      if (stage === 2) { ctx.strokeStyle = '#6cc24a'; lw(0.7); ctx.beginPath(); ctx.arc(x + 9 * s, y - 4 * s, 2 * s, 0, 5); ctx.stroke(); }
      break;
    }
    case 'espada': { // abacaxi: folhas duras em ponta
      ctx.fillStyle = '#4f8a3a';
      for (const a of stage === 2 ? [-1, -0.5, 0, 0.5, 1] : [-0.5, 0, 0.5]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-1.2 * s, 0); ctx.lineTo(0, -13 * g * s); ctx.lineTo(1.2 * s, 0); ctx.fill(); ctx.restore(); }
      break;
    }
    case 'tomate': case 'arbusto': case 'algodao': case 'cafe': case 'morango': case 'batata': {
      // hastezinha com folhas: tomate recortadas e acinzentadas; café brilhantes e escuras em pares;
      // algodão largas com lóbulos; morango de três com borda serrilhada; batata e pimentão, lisinhas
      const cor = { tomate: '#5a9a4a', cafe: '#2f7a2a', algodao: '#5aa83a', morango: '#3f9a3a', batata: '#4f9a3a' }[tipo] || '#4fa83a';
      const topo = haste(tipo === 'morango' ? 4 : 11 * g + 2, tipo === 'cafe' ? '#6b4a2a' : '#3a8a2c');
      const pares = stage === 2 ? [0.4, 0.7, 1] : [0.8];
      for (const k of pares) {
        const px = x + (topo.x - x) * k, py = y + (topo.y - y) * k, tam = (tipo === 'algodao' ? 7 : tipo === 'cafe' ? 6.5 : 5.5) * s * (0.7 + g * 0.3);
        for (const lado of [-1, 1]) {
          if (tipo === 'algodao') { for (const a of [-0.5, 0, 0.5]) leaf(px, py, tam, tam * 0.4, lado * (1 + a * 0.6) + sway, cor); }
          else if (tipo === 'tomate') { leaf(px, py, tam, tam * 0.35, lado * 1.1 + sway, cor); leaf(px + lado * tam * 0.5, py - tam * 0.3, tam * 0.5, tam * 0.2, lado * 0.6 + sway, cor); }
          else leaf(px, py, tam, tam * (tipo === 'cafe' ? 0.45 : 0.4), lado * 1.05 + sway, cor);
        }
      }
      if (tipo === 'cafe') bolinha(topo.x, topo.y, 1.2, '#3f8a2c');
      break;
    }
    case 'mamao': { // mamoeiro: um caule só e folhonas recortadas lá em cima
      const topo = haste(14 * g + 2, '#8a9a5a', 2);
      for (const a of stage === 2 ? [-1.2, -0.4, 0.4, 1.2] : [-0.7, 0.7]) for (const b of [-0.3, 0, 0.3]) leaf(topo.x, topo.y, 7 * g * s, 1.6 * s, a + b + sway, '#4fa83a');
      break;
    }
    case 'trepadeira': { // maracujá/uva: raminha com gavinhas enrolando num tutor
      ctx.strokeStyle = '#8a5a33'; lw(1); ctx.beginPath(); ctx.moveTo(x + 3 * s, y); ctx.lineTo(x + 3 * s, y - 18 * g * s); ctx.stroke();
      const topo = haste(15 * g, '#4f8a2a', 1);
      for (const k of stage === 2 ? [0.4, 0.7, 1] : [0.8]) leaf(x + (topo.x - x) * k, y + (topo.y - y) * k, 6 * s, 3.4 * s, (k * 7 % 2 ? 1 : -1) + sway, '#5aa83a');
      ctx.strokeStyle = '#7ab84a'; lw(0.6); ctx.beginPath(); ctx.arc(topo.x + 2 * s, topo.y, 1.6 * s, 0, 5); ctx.stroke();
      break;
    }
    case 'bananeira': { // folhonas compridas que saem de um pseudocaule
      const topo = haste(8 * g + 2, '#8aae5a', 2.6);
      for (const a of stage === 2 ? [-1, -0.2, 0.7] : [-0.5, 0.5]) leaf(topo.x, topo.y, 14 * g * s, 4 * g * s, a + sway, '#6cc24a');
      break;
    }
    case 'coqueiro': { // palmas arqueadas
      ctx.fillStyle = '#9a7a4a'; ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 3 * s, 2.4 * s, 0, 0, 7); ctx.fill();
      for (const a of stage === 2 ? [-1.1, -0.4, 0.3, 1] : [-0.6, 0.5]) leaf(x, y - 3 * s, 15 * g * s, 2.2 * s, a + sway, '#4f9a3a');
      break;
    }
    default: { // arvorezinha: muda com caule fino e folhinhas alternadas
      const topo = haste(12 * g + 3, '#6b4a2a', 1.2);
      for (const k of stage === 2 ? [0.35, 0.6, 0.85, 1] : [0.7, 1]) leaf(x + (topo.x - x) * k, y + (topo.y - y) * k, 5.5 * s, 2.4 * s, (k * 10 % 2 < 1 ? -1 : 1) + sway, crop.id === 'laranjeira' || crop.id === 'limao' ? '#3f8a2c' : '#5aa83a');
    }
  }
  ctx.lineCap = 'butt';
}
function drawPlant(x, y, s, crop, stage, t, withered) {
  const sway = Math.sin(t / 700 + x * 0.05) * 0.08;
  const G = '#4fa83a', GD = '#3a8a2c', GL = '#6cc24a';
  if (withered) {
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(x + d * 3 * s, y); ctx.quadraticCurveTo(x + d * 5 * s, y - 14 * s, x + d * 11 * s, y - 6 * s); ctx.stroke(); }
    leaf(x - 8 * s, y - 2 * s, 7 * s, 2.5 * s, -1.6, '#a88b55');
    ctx.lineCap = 'butt';
    return;
  }
  if (stage === 0) {
    // recém-plantado: covinha de terra fofa (mais clara) com um brotinho da cara da planta, bem pequenininho
    ctx.fillStyle = 'rgba(40,20,5,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 7.5 * s, 3 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b67a45'; ctx.beginPath(); ctx.ellipse(x, y - 0.5 * s, 6.5 * s, 3.4 * s, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#c98f57'; ctx.beginPath(); ctx.ellipse(x - 1.5 * s, y - 1.5 * s, 3 * s, 1.4 * s, 0, 0, 7); ctx.fill();
    drawBroto(x, y, s * 0.5, crop, 1, sway);
  } else if (stage === 1 || stage === 2) {
    drawBroto(x, y, s, crop, stage, sway);
  } else {
    const ripeNow = stage === 4;
    switch (crop.tipo) {
      case 'raiz': {
        if (crop.id === 'cebola') {
          if (ripeNow) {
            ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 6 * s, 5 * s, 0, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - 2 * s, y - 4 * s, 1.5 * s, 3 * s, 0, 0, 7); ctx.fill();
          }
          ctx.strokeStyle = '#5aa83a'; ctx.lineWidth = 1.6 * s; ctx.lineCap = 'round';
          for (const a of [-0.35, -0.12, 0.1, 0.3]) { ctx.beginPath(); ctx.moveTo(x, y - 6 * s); ctx.lineTo(x + Math.sin(a + sway) * 22 * s, y - 6 * s - Math.cos(a) * 22 * s); ctx.stroke(); }
          ctx.lineCap = 'butt';
          break;
        }
        if (crop.id === 'batata') {
          if (ripeNow) for (const [dx, dy] of [[-7, 1], [6, 2], [0, 3]]) { ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, 3.6 * s, 2.6 * s, 0.3, 0, 7); ctx.fill(); }
          ctx.fillStyle = GD; ctx.beginPath(); ctx.arc(x - 5 * s, y - 7 * s, 6 * s, 0, 7); ctx.arc(x + 5 * s, y - 7 * s, 6 * s, 0, 7); ctx.fill();
          ctx.fillStyle = G; ctx.beginPath(); ctx.arc(x + sway * 5 * s, y - 11 * s, 7 * s, 0, 7); ctx.fill();
          if (ripeNow) { ctx.fillStyle = '#f2f0f5'; for (const [dx, dy] of [[-4, -13], [3, -15], [5, -9]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 1.3 * s, 0, 7); ctx.fill(); } }
          break;
        }
        if (ripeNow) {
          ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.ellipse(x, y - 1 * s, 6.5 * s, 4.5 * s, 0, 0, 7); ctx.fill();
          ctx.fillStyle = crop.cor2; ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 6 * s, 2.4 * s, 0, 0, 7); ctx.fill();
        }
        for (const a of [-1.1, -0.55, 0, 0.55, 1.1]) leaf(x, y - 3 * s, (ripeNow ? 22 : 18) * s, 4.2 * s, a + sway, a === 0 ? GL : G);
        break;
      }
      case 'grao': {
        ctx.lineCap = 'round';
        for (const dx of [-5, -2, 1, 4, 6.5]) {
          const tx = x + dx * s + sway * 14 * s, ty = y - 26 * s;
          ctx.strokeStyle = ripeNow ? '#c9a24a' : '#6aa83a'; ctx.lineWidth = 1.2 * s;
          ctx.beginPath(); ctx.moveTo(x + dx * s * 0.5, y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = ripeNow ? crop.cor : '#9cc85a';
          ctx.beginPath(); ctx.ellipse(tx, ty - 3 * s, 1.8 * s, 4.5 * s, dx * 0.03, 0, 7); ctx.fill();
          ctx.strokeStyle = ripeNow ? '#d9b25a' : '#8ab84a'; ctx.lineWidth = 0.6 * s;
          ctx.beginPath(); ctx.moveTo(tx, ty - 7 * s); ctx.lineTo(tx - 1 * s, ty - 11 * s); ctx.moveTo(tx, ty - 7 * s); ctx.lineTo(tx + 1 * s, ty - 11 * s); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        break;
      }
      case 'folha': {
        const r = (ripeNow ? 11 : 8) * s;
        ctx.fillStyle = '#5a9e3a'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.5, r * 1.1, r * 0.6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.arc(x, y - r * 0.8, r * 0.8, 0, 7); ctx.fill();
        ctx.fillStyle = '#b8e87a'; ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.95, r * 0.45, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(60,110,30,.45)'; ctx.lineWidth = 1;
        for (const a of [-0.9, -0.3, 0.3, 0.9]) { ctx.beginPath(); ctx.arc(x, y - r * 0.8, r * 0.8, a - 0.2 - Math.PI / 2, a + 0.2 - Math.PI / 2); ctx.stroke(); }
        break;
      }
      case 'abacaxi': {
        ctx.fillStyle = '#4f8a3a';
        for (const a of [-1.2, -0.8, -0.4, 0.4, 0.8, 1.2]) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-1.5 * s, 0); ctx.lineTo(0, -16 * s); ctx.lineTo(1.5 * s, 0); ctx.fill(); ctx.restore(); }
        if (ripeNow) {
          ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.ellipse(x, y - 11 * s, 4.5 * s, 6.5 * s, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(120,70,20,.5)'; ctx.lineWidth = 0.7 * s;
          for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 11 * s + k * 2.5 * s); ctx.lineTo(x + 4 * s, y - 13 * s + k * 2.5 * s); ctx.stroke(); }
          ctx.fillStyle = '#5aa83a';
          for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.translate(x, y - 17 * s); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-1 * s, 0); ctx.lineTo(0, -6 * s); ctx.lineTo(1 * s, 0); ctx.fill(); ctx.restore(); }
        }
        break;
      }
      case 'alto': {
        const h = (ripeNow ? 40 : 32) * s;
        ctx.strokeStyle = '#5a9e33'; ctx.lineWidth = 3.2 * s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway * 20 * s, y - h); ctx.stroke();
        for (const [k, a] of [[0.2, -1.2], [0.35, 1.2], [0.55, -1.1], [0.72, 1.1]]) leaf(x + sway * 20 * s * k, y - h * k, 17 * s, 3.2 * s, a + sway, k > 0.5 ? GL : G);
        if (ripeNow) {
          ctx.save(); ctx.translate(x + sway * 10 * s + 4 * s, y - h * 0.5); ctx.rotate(0.35);
          ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.ellipse(0, 0, 3.6 * s, 8.5 * s, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(160,110,0,.4)'; for (let k = -2; k <= 2; k++) ctx.fillRect(-2.6 * s, k * 3 * s, 5.2 * s, 0.8 * s);
          ctx.restore();
          leaf(x + 2 * s, y - h * 0.38, 12 * s, 2.6 * s, 0.7, '#7fbf4a');
        }
        ctx.strokeStyle = '#d9b25a'; ctx.lineWidth = 1.3 * s;
        const tx = x + sway * 20 * s, ty = y - h;
        for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.sin(a) * 6 * s, ty - Math.cos(a) * 6 * s); ctx.stroke(); }
        break;
      }
      case 'moita':
      case 'pendente': {
        const small = crop.pequeno, r = (small ? 7.5 : 9.5) * s, cy = y - (small ? 7 : 11) * s;
        ctx.fillStyle = GD; ctx.beginPath(); ctx.arc(x - r * 0.6, cy + r * 0.2, r * 0.8, 0, 7); ctx.arc(x + r * 0.6, cy + r * 0.2, r * 0.8, 0, 7); ctx.fill();
        ctx.fillStyle = G; ctx.beginPath(); ctx.arc(x + sway * 6 * s, cy - r * 0.2, r, 0, 7); ctx.fill();
        ctx.fillStyle = GL; ctx.beginPath(); ctx.arc(x - r * 0.3 + sway * 6 * s, cy - r * 0.5, r * 0.45, 0, 7); ctx.fill();
        if (crop.tipo === 'moita') {
          const col = ripeNow ? crop.cor : '#a4cf45', fr = (small ? 2.6 : 3.3) * s, k = r / (9.5 * s);
          for (const [dx, dy] of [[-6, -1], [5, -4], [1, 3], [-2, -9], [7, 3]]) ball(x + dx * s * k, cy + dy * s * k, fr, col);
        } else {
          const col = ripeNow ? crop.cor : '#9bc36a';
          const [rx, ry] = crop.forma === 'longo' ? [1.8, 7] : crop.forma === 'redondo' ? [3.6, 3.8] : [2.8, 6];
          for (const dx of [-6, 1, 7]) {
            const fx = x + dx * s, fy = cy + r * 0.55;
            ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(fx, fy + 4 * s, rx * s, (ripeNow ? ry : ry * 0.66) * s, 0.1, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(fx - 1 * s, fy + 2 * s, 0.8 * s, 2 * s, 0.1, 0, 7); ctx.fill();
            if (crop.id === 'maxixe') { ctx.strokeStyle = '#d8ecb8'; ctx.lineWidth = 0.7 * s; for (let k = 0; k < 8; k++) { const a = k * 0.8, ex = fx + Math.cos(a) * rx * s, ey = fy + 4 * s + Math.sin(a) * (ripeNow ? ry : ry * 0.66) * s; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * 1.4 * s, ey + Math.sin(a) * 1.4 * s); ctx.stroke(); } }
            ctx.fillStyle = '#3f7a2a'; ctx.beginPath(); ctx.ellipse(fx, fy - 1 * s, 2.4 * s, 1.4 * s, 0, 0, 7); ctx.fill();
          }
        }
        break;
      }
      case 'cana': {
        // touceira de cana: colmos em gomos (verde-arroxeados) e folhas compridas lá em cima
        const h = (ripeNow ? 42 : 32) * s;
        for (const [dx, a] of [[-4, -0.08], [0, 0.02], [4, 0.1]]) {
          const tx = x + dx * s + Math.sin(a) * h + sway * 14 * s, ty = y - h;
          ctx.strokeStyle = ripeNow ? crop.cor : '#7aa84a'; ctx.lineWidth = 2.6 * s; ctx.beginPath(); ctx.moveTo(x + dx * s, y); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.strokeStyle = 'rgba(40,30,20,.45)'; ctx.lineWidth = 1 * s;
          for (let k = 1; k < 6; k++) { const q = { x: x + dx * s + (tx - x - dx * s) * k / 6, y: y + (ty - y) * k / 6 }; ctx.beginPath(); ctx.moveTo(q.x - 1.4 * s, q.y); ctx.lineTo(q.x + 1.4 * s, q.y); ctx.stroke(); }
          for (const la of [-1.3, -0.6, 0.6, 1.3]) leaf(tx, ty + 2 * s, 14 * s, 1.8 * s, la + sway, la > 0 ? GL : G);
        }
        break;
      }
      case 'chao': {
        for (const [dx, dy, a] of [[-10, 0, -1.4], [10, -1, 1.4], [-5, -4, -0.6], [6, -5, 0.7], [0, 2, 0]]) {
          ctx.save(); ctx.translate(x + dx * s, y + dy * s); ctx.scale(1, 0.55);
          leaf(0, 0, 13 * s, 6 * s, a, a === 0 ? GL : G); ctx.restore();
        }
        if (crop.id === 'maxixe') {
          // maxixes pequenos, ovais, cheios de espinhos moles, espalhados na rama
          for (const [dx, dy, a] of [[-8, -2, 0.4], [6, -4, -0.3], [0, 2, 0.1]]) {
            const fx = x + dx * s, fy = y + dy * s - 3 * s, rx = (ripeNow ? 3.4 : 2.4) * s, ry = (ripeNow ? 4.8 : 3.4) * s;
            ctx.fillStyle = ripeNow ? crop.cor : '#a8cf6a'; ctx.beginPath(); ctx.ellipse(fx, fy, rx, ry, a, 0, 7); ctx.fill();
            ctx.strokeStyle = crop.cor2; ctx.lineWidth = 0.8 * s;
            for (let k = 0; k < 10; k++) { const b = k * 0.63, ex = fx + Math.cos(b) * rx * 0.9, ey = fy + Math.sin(b) * ry * 0.9; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(b) * 1.6 * s, ey + Math.sin(b) * 1.6 * s); ctx.stroke(); }
            ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(fx - rx * 0.35, fy - ry * 0.3, rx * 0.25, ry * 0.3, a, 0, 7); ctx.fill();
          }
        } else if (ripeNow) {
          const rx = 11 * s, ry = 8 * s, fy = y - 5 * s;
          ctx.fillStyle = crop.cor; ctx.beginPath(); ctx.ellipse(x, fy, rx, ry, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = crop.cor2; ctx.lineWidth = (crop.id === 'melancia' ? 2 : 1.2) * s;
          for (const k of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.ellipse(x + k * rx * 0.9, fy, rx * 0.22, ry * 0.95, 0, -1.4, 1.4); ctx.stroke(); }
          ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.4, fy - ry * 0.4, rx * 0.25, ry * 0.18, -0.4, 0, 7); ctx.fill();
          ctx.strokeStyle = '#6b4a1a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x, fy - ry); ctx.lineTo(x + 2 * s, fy - ry - 3 * s); ctx.stroke();
        } else {
          ctx.fillStyle = '#9cc85a'; ctx.beginPath(); ctx.ellipse(x + 2 * s, y - 3 * s, 5 * s, 4 * s, 0, 0, 7); ctx.fill();
        }
        break;
      }
    }
  }
}


function drawWeed(x, y, s) {
  ctx.strokeStyle = '#2d5e1a'; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * 9 * s, y - Math.cos(a) * 9 * s); ctx.stroke(); }
  ctx.fillStyle = '#f5d33a'; ctx.beginPath(); ctx.arc(x + 1 * s, y - 9 * s, 1.8 * s, 0, 7); ctx.fill();
  ctx.lineCap = 'butt';
}
function drawBug(x, y, s, t, k) {
  const a = t / 500 + k * 2.3;
  const bx = x + Math.cos(a) * 5 * s, by = y + Math.sin(a) * 2.5 * s;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 0.8 * s;
  for (const d of [-1, 1]) for (const e of [-1.5, 0, 1.5]) { ctx.beginPath(); ctx.moveTo(0, e * s); ctx.lineTo(d * 3.5 * s, e * s + Math.sin(t / 60 + e) * s); ctx.stroke(); }
  ctx.fillStyle = '#3b2a18'; ctx.beginPath(); ctx.ellipse(0, 0, 2.4 * s, 3.4 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7d9a2a'; ctx.beginPath(); ctx.ellipse(0, 0.6 * s, 1.8 * s, 2.3 * s, 0, 0, 7); ctx.fill();
  ctx.restore();
}

// Produtos dos animais, centrados em (x, y); s ≈ 1/10 do tamanho.
function drawProduct(id, x, y, s) {
  id = { penaarara: 'pena', ovoarara: 'ovo', penapavao: 'pena', ovocodorna: 'ovoangola', ovoperu: 'ovoangola', plumaganso: 'penaavestruz', lalhama: 'la' }[id] || id;
  if (RECEITA[id]) return drawGood(id, x, y, s);
  if (PEIXE[id]) return drawPeixe(ctx, x, y, s * 0.85 * cabePeixe(PEIXE[id]), PEIXE[id]);
  if (FRUTA[id]) return drawFruta(id, x, y, s);
  if (id === 'carnejavali') {
    ctx.fillStyle = '#b8403a'; ctx.strokeStyle = '#7a2420'; ctx.lineWidth = Math.max(1, 0.6 * s);
    ctx.beginPath(); ctx.ellipse(x - 1 * s, y + 1 * s, 6.5 * s, 5 * s, -0.3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f4d8c8'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.ellipse(x - 1 * s, y + 1 * s, 4.2 * s, 3 * s, -0.3, 0.4, 2.8); ctx.stroke();
    ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.roundRect(x + 4 * s, y - 5 * s, 5 * s, 2.4 * s, 1 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 9 * s, y - 4.8 * s, 1.5 * s, 0, 7); ctx.arc(x + 9 * s, y - 2.8 * s, 1.5 * s, 0, 7); ctx.fill();
    return;
  }
  ctx.lineWidth = Math.max(1, 0.6 * s);
  if (id === 'ovo') {
    ctx.fillStyle = '#fff6df'; ctx.strokeStyle = '#cdb88c';
    ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 4.6 * s, 6 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(x - 1.6 * s, y - 1.5 * s, 1.1 * s, 1.8 * s, 0.3, 0, 7); ctx.fill();
  } else if (id === 'leite' || id === 'leitecabra' || id === 'leitebufala' || id === 'leitejumenta') {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#9fb4c8';
    ctx.beginPath(); ctx.moveTo(x - 4 * s, y + 7 * s); ctx.lineTo(x - 4 * s, y - 1 * s); ctx.lineTo(x - 2 * s, y - 4 * s); ctx.lineTo(x + 2 * s, y - 4 * s); ctx.lineTo(x + 4 * s, y - 1 * s); ctx.lineTo(x + 4 * s, y + 7 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = { leite: '#3a7bd5', leitecabra: '#b07a44', leitebufala: '#3a3a3a', leitejumenta: '#8a6aa8' }[id]; ctx.fillRect(x - 2.3 * s, y - 6.5 * s, 4.6 * s, 2.6 * s);
    ctx.fillRect(x - 4 * s, y + 1.5 * s, 8 * s, 2.4 * s);
  } else if (id === 'la') {
    ctx.fillStyle = '#f3eee2'; ctx.strokeStyle = '#c8bda2';
    ctx.beginPath(); ctx.arc(x, y, 6 * s, 0, 7); ctx.fill(); ctx.stroke();
    for (const a of [-0.8, 0, 0.8]) { ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 2.5 * s, a + 1.2, 0, Math.PI); ctx.stroke(); }
  } else if (id === 'trufa') {
    ctx.fillStyle = '#5b3a24';
    ctx.beginPath(); ctx.arc(x, y + 1 * s, 5.5 * s, 0, 7); ctx.arc(x - 3 * s, y - 2 * s, 3 * s, 0, 7); ctx.arc(x + 3 * s, y - 1.5 * s, 3.2 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6448';
    for (const [dx, dy] of [[-2, 0], [2, 2], [0, -3], [3, -2]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 0.8 * s, 0, 7); ctx.fill(); }
  } else if (id === 'mel') {
    ctx.fillStyle = '#f2b52a'; ctx.strokeStyle = '#b07a14';
    ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 3 * s); ctx.lineTo(x - 5 * s, y + 6 * s); ctx.quadraticCurveTo(x, y + 8 * s, x + 5 * s, y + 6 * s); ctx.lineTo(x + 5 * s, y - 3 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c8402f'; ctx.fillRect(x - 5.8 * s, y - 6 * s, 11.6 * s, 3.2 * s);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 3.5 * s, y - 1 * s, 1.4 * s, 5 * s);
  } else if (id === 'leitao') {
    ctx.fillStyle = '#f5aebb'; ctx.beginPath(); ctx.arc(x, y, 6 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e991a0'; ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 3 * s); ctx.lineTo(x - 4 * s, y - 8 * s); ctx.lineTo(x - 1.5 * s, y - 5 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 5 * s, y - 3 * s); ctx.lineTo(x + 4 * s, y - 8 * s); ctx.lineTo(x + 1.5 * s, y - 5 * s); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 2.8 * s, 2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8606e'; ctx.beginPath(); ctx.arc(x - 1 * s, y + 2 * s, 0.6 * s, 0, 7); ctx.arc(x + 1 * s, y + 2 * s, 0.6 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 2.3 * s, y - 1.5 * s, 0.7 * s, 0, 7); ctx.arc(x + 2.3 * s, y - 1.5 * s, 0.7 * s, 0, 7); ctx.fill();
  } else if (id === 'bacon') {
    for (const dy of [-2.5, 2.5]) {
      ctx.save(); ctx.translate(x, y + dy * s); ctx.rotate(-0.25);
      ctx.fillStyle = '#c8554a'; ctx.beginPath(); ctx.moveTo(-7 * s, -1.6 * s);
      for (let k = -7; k <= 7; k += 2) ctx.lineTo(k * s, (k % 4 === 0 ? -2.4 : -1.2) * s);
      for (let k = 7; k >= -7; k -= 2) ctx.lineTo(k * s, (k % 4 === 0 ? 1.2 : 2.4) * s);
      ctx.fill();
      ctx.strokeStyle = '#f3d2c4'; ctx.lineWidth = 0.9 * s;
      ctx.beginPath(); ctx.moveTo(-6.5 * s, 0); for (let k = -6; k <= 6; k += 2) ctx.lineTo(k * s, (k % 4 === 0 ? -0.5 : 0.5) * s); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'pelo') {
    ctx.fillStyle = '#ece7de'; ctx.strokeStyle = '#c8bda2';
    for (const [dx, dy, r] of [[-2.5, 1, 3.8], [2.5, 1, 3.8], [0, -2, 4]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#f7f4ef'; ctx.beginPath(); ctx.arc(x - 1 * s, y - 2.5 * s, 1.6 * s, 0, 7); ctx.fill();
  } else if (id === 'ovopata' || id === 'ovoangola') {
    const pata = id === 'ovopata', rx = pata ? 5 : 3.8, ry = pata ? 6.5 : 5.2;
    ctx.fillStyle = pata ? '#dcefe6' : '#efe0c4'; ctx.strokeStyle = pata ? '#a9c9ba' : '#c9b48c';
    ctx.beginPath(); ctx.ellipse(x, y + 1 * s, rx * s, ry * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (!pata) { ctx.fillStyle = '#9a7650'; for (const [dx, dy] of [[-1.5, -1], [1.2, 0.5], [-0.5, 2.5], [1.6, 3], [0.3, -2.8], [-2, 2]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 0.45 * s, 0, 7); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - 1.5 * s, y - 1.5 * s, 1 * s, 1.7 * s, 0.3, 0, 7); ctx.fill();
  } else if (id === 'esterco') {
    ctx.fillStyle = '#6b4a2a';
    ctx.beginPath(); ctx.ellipse(x, y + 4 * s, 6.5 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 4.8 * s, 2.3 * s, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 0.5 * s, y - 1.6 * s, 3 * s, 2 * s, 0, 0, 7); ctx.fill();
    leaf(x + 2 * s, y - 2.5 * s, 5 * s, 1.6 * s, 0.5, '#4fa83a');
  } else if (id === 'crina') {
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 1 * s; ctx.lineCap = 'round';
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 0.6 * s, y - 6 * s); ctx.quadraticCurveTo(x + k * 1.2 * s, y, x + k * 1.6 * s + 1 * s, y + 6 * s); ctx.stroke(); }
    ctx.fillStyle = '#c8402f'; ctx.fillRect(x - 3 * s, y - 4 * s, 6 * s, 1.8 * s);
    ctx.lineCap = 'butt';
  } else if (id === 'peloonca') {
    ctx.fillStyle = '#e0a030'; ctx.strokeStyle = '#9a6a14';
    for (const [dx, dy, r] of [[-2.5, 1, 3.8], [2.5, 1, 3.8], [0, -2, 4]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#3a2a14';
    for (const [dx, dy] of [[-3, 1], [2.6, 1.6], [0, -2.4], [-0.5, 2.8]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 0.9 * s, 0, 7); ctx.fill(); }
  } else if (id === 'penaavestruz') {
    line({ x: x + 3 * s, y: y + 7 * s }, { x: x - 2 * s, y: y - 7 * s }, '#8a7a5a', 0.8 * s);
    ctx.save(); ctx.translate(x - 1 * s, y - 3 * s); ctx.rotate(-0.35);
    ctx.fillStyle = '#f3f1ea'; ctx.strokeStyle = '#c9c3b3'; ctx.beginPath(); ctx.ellipse(0, 0, 3.8 * s, 6 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9d4c4'; ctx.beginPath(); ctx.ellipse(0, 1 * s, 2 * s, 3.4 * s, 0, 0, 7); ctx.fill();
    ctx.restore();
  } else if (id === 'pena') {
    line({ x: x + 3 * s, y: y + 7 * s }, { x: x - 2 * s, y: y - 7 * s }, '#8a7a4a', 0.8 * s);
    ctx.save(); ctx.translate(x - 1 * s, y - 3 * s); ctx.rotate(-0.35);
    ctx.fillStyle = '#3f9a5a'; ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e0b030'; ctx.beginPath(); ctx.ellipse(0, -1 * s, 2 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f4fa0'; ctx.beginPath(); ctx.ellipse(0, -1 * s, 1.1 * s, 1.5 * s, 0, 0, 7); ctx.fill();
    ctx.restore();
  } else if (id === 'pata') {
    ctx.fillStyle = '#c8965a'; ctx.strokeStyle = '#8a6234';
    ctx.beginPath(); ctx.ellipse(x, y + 2.5 * s, 4.2 * s, 3 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    for (const dx of [-2.6, 0, 2.6]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y - 2.2 * s, 1.5 * s, 2.1 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(x - 1.5 * s, y + 1 * s, 1.2 * s, 0.8 * s, 0.3, 0, 7); ctx.fill();
  } else if (id === 'presa') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.15);
    ctx.fillStyle = '#f2ecd8'; ctx.strokeStyle = '#a89a72';
    ctx.beginPath(); ctx.moveTo(-2.6 * s, -6 * s); ctx.quadraticCurveTo(2.4 * s, -1 * s, 0.6 * s, 6.5 * s); ctx.quadraticCurveTo(-1.2 * s, 1 * s, -2.6 * s, -6 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-1.4 * s, -2.5 * s, 0.8 * s, 2.3 * s, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a1f2a'; ctx.beginPath(); ctx.arc(0.4 * s, 6 * s, 1 * s, 0, 7); ctx.fill();
    ctx.restore();
  } else if (id === 'novelo') {
    ctx.fillStyle = '#d8384a'; ctx.strokeStyle = '#9a1f2e'; ctx.lineWidth = Math.max(1, 0.6 * s);
    ctx.beginPath(); ctx.arc(x, y, 6 * s, 0, 7); ctx.fill(); ctx.stroke();
    for (const a of [-0.7, 0, 0.7]) { ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 2.4 * s, a + 1.1, 0, Math.PI); ctx.stroke(); }
    ctx.strokeStyle = '#f2b0b8'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(x + 5 * s, y + 3 * s); ctx.quadraticCurveTo(x + 9 * s, y + 6 * s, x + 8 * s, y + 10 * s); ctx.stroke();
  } else if (id === 'ratocacado') {
    ctx.save(); ctx.translate(x, y + 2 * s); ctx.rotate(-0.1);
    ctx.strokeStyle = '#9a9088'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(6 * s, 1 * s); ctx.quadraticCurveTo(11 * s, 4 * s, 9 * s, 8 * s); ctx.stroke();
    ctx.fillStyle = '#8a8078'; ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * s, 3.6 * s, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6 * s, -2.5 * s, 2.6 * s, 2.2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8b0b0'; ctx.beginPath(); ctx.arc(-7.4 * s, -3.6 * s, 1.1 * s, 0, 7); ctx.arc(-4.8 * s, -4 * s, 1 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-6.6 * s, -1.5 * s, 0.5 * s, 0, 7); ctx.fill();
    ctx.restore();
  } else if (id === 'lagartixa') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.2);
    ctx.strokeStyle = '#b8a468'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7 * s, 3 * s); ctx.quadraticCurveTo(-2 * s, -2 * s, 2 * s, 1 * s); ctx.quadraticCurveTo(5 * s, 3 * s, 8 * s, -1 * s); ctx.stroke();
    for (const [dx, dy] of [[-4, 3], [0, -1], [3, 3]]) { ctx.beginPath(); ctx.moveTo(dx * s, dy * s); ctx.lineTo((dx - 2) * s, (dy + 3) * s); ctx.moveTo(dx * s, dy * s); ctx.lineTo((dx + 1) * s, (dy + 3.2) * s); ctx.stroke(); }
    ctx.fillStyle = '#c9b878'; ctx.beginPath(); ctx.arc(-7.5 * s, 3.2 * s, 1.6 * s, 0, 7); ctx.fill();
    ctx.restore();
  } else if (id === 'sininho') {
    ctx.fillStyle = '#e8c33a'; ctx.strokeStyle = '#a8811a'; ctx.lineWidth = Math.max(1, 0.6 * s);
    ctx.beginPath(); ctx.arc(x, y + 1 * s, 5.5 * s, 0.15, Math.PI - 0.15); ctx.quadraticCurveTo(x - 6 * s, y - 4 * s, x, y - 6 * s); ctx.quadraticCurveTo(x + 6 * s, y - 4 * s, x + 5.4 * s, y + 3.5 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a6a10'; ctx.beginPath(); ctx.arc(x, y + 6.5 * s, 1.3 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a6a10'; ctx.beginPath(); ctx.arc(x, y - 7 * s, 1.4 * s, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x - 2 * s, y - 2 * s, 1 * s, 2 * s, 0.3, 0, 7); ctx.fill();
  } else if (id === 'presentemisterioso') {
    ctx.fillStyle = '#6b3a8a'; ctx.strokeStyle = '#3f2058'; ctx.lineWidth = Math.max(1, 0.6 * s);
    ctx.beginPath(); ctx.roundRect(x - 6 * s, y - 4 * s, 12 * s, 9 * s, 1 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2c230'; ctx.fillRect(x - 1.1 * s, y - 4 * s, 2.2 * s, 9 * s);
    ctx.beginPath(); ctx.moveTo(x - 2.6 * s, y - 4 * s); ctx.quadraticCurveTo(x, y - 8 * s, x + 2.6 * s, y - 4 * s); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', x - 3.2 * s, y + 2.5 * s);
  } else if (id === 'medalhabronze' || id === 'medalhaprata' || id === 'medalhaouro') {
    const cores = { medalhabronze: ['#b8712f', '#8a5220'], medalhaprata: ['#c9ccd2', '#9698a0'], medalhaouro: ['#f2c230', '#c8941a'] }[id];
    ctx.fillStyle = '#c8402f'; ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 9 * s); ctx.lineTo(x - 0.8 * s, y - 2 * s); ctx.lineTo(x - 4 * s, y - 2.5 * s); ctx.fill();
    ctx.fillStyle = '#8a1f2a'; ctx.beginPath(); ctx.moveTo(x + 3 * s, y - 9 * s); ctx.lineTo(x + 4 * s, y - 2.5 * s); ctx.lineTo(x + 0.8 * s, y - 2 * s); ctx.fill();
    ctx.fillStyle = cores[0]; ctx.strokeStyle = cores[1]; ctx.lineWidth = Math.max(1, 0.8 * s);
    ctx.beginPath(); ctx.arc(x, y + 1 * s, 6 * s, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(x - 1.8 * s, y - 1 * s, 1.6 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = cores[1]; ctx.lineWidth = 0.7 * s; ctx.beginPath(); ctx.arc(x, y + 1 * s, 3.4 * s, 0, 7); ctx.stroke();
  } else if (id === 'trofeu') {
    ctx.fillStyle = '#e8c33a'; ctx.strokeStyle = '#a8811a'; ctx.lineWidth = Math.max(1, 0.6 * s);
    ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 6 * s); ctx.lineTo(x + 4 * s, y - 6 * s); ctx.lineTo(x + 3 * s, y - 1 * s); ctx.quadraticCurveTo(x, y + 1 * s, x - 3 * s, y - 1 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 5.5 * s); ctx.quadraticCurveTo(x - 8 * s, y - 5 * s, x - 6 * s, y - 1 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 4 * s, y - 5.5 * s); ctx.quadraticCurveTo(x + 8 * s, y - 5 * s, x + 6 * s, y - 1 * s); ctx.stroke();
    ctx.fillRect(x - 1 * s, y - 1 * s, 2 * s, 3 * s);
    ctx.beginPath(); ctx.moveTo(x - 3 * s, y + 2 * s); ctx.lineTo(x + 3 * s, y + 2 * s); ctx.lineTo(x + 2.4 * s, y + 4 * s); ctx.lineTo(x - 2.4 * s, y + 4 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (id === 'ferradura') {
    ctx.strokeStyle = '#8a8e92'; ctx.lineWidth = 3.2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - 1 * s, 5.5 * s, 0.35, Math.PI - 0.35); ctx.stroke();
    ctx.fillStyle = '#5a5e62';
    for (const dx of [-4.6, 4.6]) for (const dy of [1, 4.5]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 0.7 * s, 0, 7); ctx.fill(); }
  }
}

// ============================================================
// Animais (desenhados virados para a direita; dir=-1 espelha)
// ============================================================
function drawAnimal(k, x, y, s, t, dir, moving, cor) {
  const step = moving ? Math.sin(t / 90) : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  const shadow = { galinha: 9, vaca: 22, ovelha: 16, porco: 16, coelho: 9, angola: 9, pato: 10, jumento: 21, cavalo: 23, pavao: 12, cabra: 14, bufala: 23, abelha: 11, avestruz: 13, gato: 8, tartaruga: 9, arara: 7, onca: 17 }[k];
  ctx.beginPath(); ctx.ellipse(0, 0, shadow * s, shadow * 0.28 * s, 0, 0, 7); ctx.fill();
  const leg = (lx, len, col, w) => { ctx.fillStyle = col; ctx.fillRect(lx * s - w * s / 2, -len * s, w * s, len * s); };
  if (k === 'galinha') {
    ctx.strokeStyle = '#e8a02a'; ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.moveTo(-2 * s, -5 * s); ctx.lineTo(-2 * s + step * 1.5 * s, 0); ctx.moveTo(2 * s, -5 * s); ctx.lineTo(2 * s - step * 1.5 * s, 0); ctx.stroke();
    ctx.fillStyle = '#f7f4ea';
    ctx.beginPath(); ctx.moveTo(-8 * s, -12 * s); ctx.lineTo(-12 * s, -19 * s); ctx.lineTo(-5 * s, -15 * s); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -10 * s, 9 * s, 6.5 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d3cbb5'; ctx.lineWidth = 0.8 * s; ctx.stroke();
    ctx.fillStyle = '#e9e3d1'; ctx.beginPath(); ctx.ellipse(-1 * s, -10 * s, 5 * s, 3.4 * s, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#f7f4ea'; ctx.beginPath(); ctx.arc(6.5 * s, -17 * s, 4.3 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e03a2f'; ctx.beginPath(); ctx.arc(5 * s, -21.5 * s, 1.6 * s, 0, 7); ctx.arc(7.2 * s, -22 * s, 1.7 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9.5 * s, -14 * s, 1.1 * s, 1.8 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0a020'; ctx.beginPath(); ctx.moveTo(10.3 * s, -18 * s); ctx.lineTo(13.5 * s, -16.8 * s); ctx.lineTo(10.3 * s, -15.6 * s); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(7.6 * s, -18 * s, 0.8 * s, 0, 7); ctx.fill();
  } else if (k === 'vaca') {
    for (const [lx, ph] of [[-12, 1], [-6, -1], [6, -1], [12, 1]]) { leg(lx + step * ph, 11, '#f1ede5', 3.2); ctx.fillStyle = '#3a2a1e'; ctx.fillRect((lx + step * ph) * s - 1.6 * s, -2 * s, 3.2 * s, 2 * s); }
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(-17 * s, -20 * s); ctx.quadraticCurveTo(-21 * s, -14 * s, -20 * s, -8 * s); ctx.stroke();
    ctx.fillStyle = '#3a2a1e'; ctx.beginPath(); ctx.ellipse(-20 * s, -7 * s, 1.4 * s, 2.2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f7f4ee'; ctx.beginPath(); ctx.ellipse(0, -18 * s, 18 * s, 9.5 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#cfc6b8'; ctx.lineWidth = 0.8 * s; ctx.stroke();
    ctx.fillStyle = '#2e2622';
    for (const [dx, dy, rx, ry] of [[-7, -20, 5, 4], [6, -15, 4, 3], [-12, -14, 3, 3], [9, -23, 3, 2.4]]) { ctx.beginPath(); ctx.ellipse(dx * s, dy * s, rx * s, ry * s, 0.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#f2a7b0'; ctx.beginPath(); ctx.ellipse(3 * s, -9 * s, 4 * s, 2.4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#efe6c8'; ctx.beginPath(); ctx.moveTo(15 * s, -29 * s); ctx.lineTo(14 * s, -34 * s); ctx.lineTo(17 * s, -30 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(20 * s, -29 * s); ctx.lineTo(21 * s, -34 * s); ctx.lineTo(22 * s, -29 * s); ctx.fill();
    ctx.fillStyle = '#f7f4ee'; ctx.beginPath(); ctx.ellipse(19 * s, -24 * s, 6.5 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2e2622'; ctx.beginPath(); ctx.ellipse(12.5 * s, -27 * s, 3.2 * s, 1.6 * s, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2a7b0'; ctx.beginPath(); ctx.ellipse(22 * s, -20.5 * s, 4.6 * s, 3.4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4a4a'; ctx.beginPath(); ctx.arc(21 * s, -20.5 * s, 0.7 * s, 0, 7); ctx.arc(23.6 * s, -20.5 * s, 0.7 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(19.5 * s, -26 * s, 1 * s, 0, 7); ctx.fill();
  } else if (k === 'ovelha') {
    for (const [lx, ph] of [[-8, 1], [-4, -1], [4, -1], [8, 1]]) leg(lx + step * ph, 8, '#2e2a28', 2.2);
    ctx.fillStyle = '#f5f1e8'; ctx.strokeStyle = '#d5ccb8'; ctx.lineWidth = 0.8 * s;
    for (const [dx, dy, r] of [[-8, -13, 6], [-2, -17, 7], [5, -15, 6.5], [0, -11, 6.5], [-6, -18, 5], [8, -11, 5]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, r * s, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#2e2a28'; ctx.beginPath(); ctx.ellipse(13 * s, -18 * s, 4.6 * s, 3.8 * s, 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10 * s, -21 * s, 2.6 * s, 1.2 * s, -0.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#f5f1e8'; ctx.beginPath(); ctx.arc(11 * s, -22 * s, 3 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(14.5 * s, -19 * s, 0.9 * s, 0, 7); ctx.fill();
  } else if (k === 'porco') {
    for (const [lx, ph] of [[-9, 1], [-4, -1], [5, -1], [10, 1]]) leg(lx + step * ph, 6, '#e991a0', 3);
    ctx.strokeStyle = '#e07f90'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.arc(-16 * s, -14 * s, 2 * s, 0, 5); ctx.stroke();
    ctx.fillStyle = '#f5aebb'; ctx.beginPath(); ctx.ellipse(0, -12 * s, 15 * s, 8.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f7bcc7'; ctx.beginPath(); ctx.ellipse(-2 * s, -15 * s, 9 * s, 3.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f5aebb'; ctx.beginPath(); ctx.arc(13 * s, -15 * s, 6.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e991a0'; ctx.beginPath(); ctx.moveTo(9 * s, -20 * s); ctx.lineTo(11 * s, -25 * s); ctx.lineTo(14 * s, -20 * s); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19 * s, -14 * s, 2.8 * s, 3.4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8606e'; ctx.beginPath(); ctx.arc(18.6 * s, -15 * s, 0.7 * s, 0, 7); ctx.arc(19.6 * s, -13 * s, 0.7 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(14.5 * s, -17.5 * s, 0.9 * s, 0, 7); ctx.fill();
  } else if (k === 'coelho') {
    const hop = moving ? Math.abs(Math.sin(t / 110)) * 3 * s : 0;
    ctx.translate(0, -hop);
    ctx.fillStyle = '#ece6dc'; ctx.beginPath(); ctx.ellipse(3 * s, -1 * s, 3 * s, 1.3 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f4f0ea'; ctx.beginPath(); ctx.ellipse(0, -7 * s, 8 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-8 * s, -8 * s, 2.6 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#f4f0ea'; ctx.beginPath(); ctx.arc(6 * s, -11 * s, 4.6 * s, 0, 7); ctx.fill();
    for (const [ex, a] of [[4.3, -0.25], [7.4, 0.18]]) {
      ctx.fillStyle = '#f4f0ea'; ctx.beginPath(); ctx.ellipse(ex * s, -19 * s, 1.7 * s, 5.2 * s, a, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2a7b0'; ctx.beginPath(); ctx.ellipse(ex * s, -19 * s, 0.8 * s, 3.6 * s, a, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(7.8 * s, -12 * s, 0.8 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e98a9a'; ctx.beginPath(); ctx.arc(10.4 * s, -10.5 * s, 0.8 * s, 0, 7); ctx.fill();
  } else if (k === 'angola') {
    ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1.3 * s;
    ctx.beginPath(); ctx.moveTo(-2 * s, -5 * s); ctx.lineTo(-2 * s + step * 1.5 * s, 0); ctx.moveTo(2 * s, -5 * s); ctx.lineTo(2 * s - step * 1.5 * s, 0); ctx.stroke();
    ctx.fillStyle = '#4a4f5a'; ctx.beginPath(); ctx.ellipse(0, -10 * s, 9 * s, 6.8 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const [dx, dy] of [[-5, -12], [-2, -14], [1, -11], [4, -13], [-6, -8], [-3, -9], [0, -7], [3, -8], [6, -10], [-1, -5], [2, -4], [5, -6]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 0.55 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#4a4f5a'; ctx.beginPath(); ctx.ellipse(6 * s, -15 * s, 2 * s, 3.5 * s, 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#a9cbe6'; ctx.beginPath(); ctx.arc(7.2 * s, -18 * s, 2.8 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.moveTo(6 * s, -20 * s); ctx.lineTo(7 * s, -23.5 * s); ctx.lineTo(8.2 * s, -20 * s); ctx.fill();
    ctx.fillStyle = '#e03a2f'; ctx.beginPath(); ctx.ellipse(9 * s, -15.5 * s, 0.9 * s, 1.4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9c29a'; ctx.beginPath(); ctx.moveTo(9.6 * s, -19 * s); ctx.lineTo(12 * s, -18 * s); ctx.lineTo(9.6 * s, -17 * s); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(8 * s, -18.6 * s, 0.7 * s, 0, 7); ctx.fill();
  } else if (k === 'pato') {
    ctx.fillStyle = '#f0a020';
    ctx.beginPath(); ctx.ellipse((-2 + step) * s, -0.5 * s, 2.4 * s, 1 * s, 0, 0, 7); ctx.ellipse((3 - step) * s, -0.5 * s, 2.4 * s, 1 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fbfbf7';
    ctx.beginPath(); ctx.moveTo(-9 * s, -9 * s); ctx.lineTo(-13 * s, -14 * s); ctx.lineTo(-6 * s, -12 * s); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -7.5 * s, 10 * s, 5.8 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d8d2c4'; ctx.lineWidth = 0.8 * s; ctx.stroke();
    ctx.fillStyle = '#eeeae0'; ctx.beginPath(); ctx.ellipse(-2 * s, -8 * s, 5.5 * s, 3 * s, 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.ellipse(6 * s, -12.5 * s, 2.8 * s, 5 * s, 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(7.2 * s, -17.5 * s, 3.8 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0a020'; ctx.beginPath(); ctx.ellipse(11.8 * s, -16.8 * s, 3.4 * s, 1.4 * s, 0.05, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(8.5 * s, -18.6 * s, 0.8 * s, 0, 7); ctx.fill();
  } else if (k === 'jumento' || k === 'cavalo') {
    const horse = k === 'cavalo';
    const body = horse ? '#8a5a33' : '#9a9590', light = horse ? '#a8744a' : '#d9d3c8', mane = horse ? '#3a2412' : '#5a5550';
    const legH = horse ? 14 : 11;
    for (const [lx, ph] of [[-12, 1], [-7, -1], [8, -1], [13, 1]]) { leg(lx + step * ph, legH, body, 3); ctx.fillStyle = '#2a1e16'; ctx.fillRect((lx + step * ph) * s - 1.6 * s, -1.8 * s, 3.2 * s, 1.8 * s); }
    ctx.strokeStyle = mane; ctx.lineWidth = (horse ? 3 : 1.4) * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16 * s, -(legH + 8) * s); ctx.quadraticCurveTo(-21 * s, -(legH + 2) * s, -19 * s, -(legH - 4) * s); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -(legH + 7) * s, 17 * s, 8.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(1 * s, -(legH + 3) * s, 12 * s, 3.5 * s, 0, 0, 7); ctx.fill();
    // pescoço e cabeça
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(10 * s, -(legH + 12) * s); ctx.lineTo(17 * s, -(legH + 24) * s); ctx.lineTo(23 * s, -(legH + 20) * s); ctx.lineTo(16 * s, -(legH + 5) * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(21 * s, -(legH + 20) * s, 6.5 * s, 4 * s, 0.55, 0, 7); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(24.5 * s, -(legH + 16.5) * s, 3.4 * s, 2.8 * s, 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1e16'; ctx.beginPath(); ctx.arc(25.5 * s, -(legH + 16.5) * s, 0.6 * s, 0, 7); ctx.fill();
    if (horse) {
      ctx.strokeStyle = mane; ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(10 * s, -(legH + 13) * s); ctx.lineTo(17 * s, -(legH + 25) * s); ctx.stroke();
      ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.ellipse(22 * s, -(legH + 20.5) * s, 1 * s, 2.6 * s, 0.55, 0, 7); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(17 * s, -(legH + 24) * s); ctx.lineTo(17.5 * s, -(legH + 28) * s); ctx.lineTo(19 * s, -(legH + 24.5) * s); ctx.fill();
    } else {
      ctx.strokeStyle = mane; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.moveTo(10.5 * s, -(legH + 13) * s); ctx.lineTo(17 * s, -(legH + 24) * s); ctx.stroke();
      for (const [ex, a] of [[15.5, -0.35], [18.5, 0.05]]) {
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(ex * s, -(legH + 29) * s, 1.8 * s, 6 * s, a, 0, 7); ctx.fill();
        ctx.fillStyle = mane; ctx.beginPath(); ctx.ellipse(ex * s + Math.sin(a) * 4 * s, -(legH + 33.5) * s, 1.2 * s, 1.6 * s, a, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(20 * s, -(legH + 22) * s, 0.9 * s, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  } else if (k === 'pavao') {
    // leque de penas atrás do corpo
    const fan = moving ? 0.75 : 1;
    for (let j = 0; j < 9; j++) {
      const a = -Math.PI * (0.08 + 0.84 * j / 8), len = 17 * s * fan, cx = -3 * s, cy = -10 * s;
      const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len * 0.95;
      line({ x: cx, y: cy }, { x: ex, y: ey }, '#2e7d4f', 2.2 * s);
      ctx.fillStyle = '#3f9a5a'; ctx.beginPath(); ctx.ellipse(ex, ey, 2.6 * s, 3.4 * s, a + Math.PI / 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#e0b030'; ctx.beginPath(); ctx.arc(ex, ey, 1.6 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#1f4fa0'; ctx.beginPath(); ctx.arc(ex, ey, 0.9 * s, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(-1 * s, -4 * s); ctx.lineTo(-1 * s + step * 1.4 * s, 0); ctx.moveTo(2 * s, -4 * s); ctx.lineTo(2 * s - step * 1.4 * s, 0); ctx.stroke();
    ctx.fillStyle = '#1f5fa8'; ctx.beginPath(); ctx.ellipse(0, -9 * s, 6 * s, 6.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a78c8'; ctx.beginPath(); ctx.ellipse(3 * s, -15 * s, 2 * s, 5 * s, 0.25, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(4.8 * s, -20 * s, 2.5 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1f5fa8'; ctx.lineWidth = 0.6 * s;
    for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(4.6 * s, -22 * s); ctx.lineTo((4.6 + d * 1.4) * s, -25.5 * s); ctx.stroke(); ctx.fillStyle = '#2a78c8'; ctx.beginPath(); ctx.arc((4.6 + d * 1.4) * s, -25.8 * s, 0.7 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(5.6 * s, -20.5 * s, 1 * s, 0.6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(5.8 * s, -20.5 * s, 0.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#c9b27a'; ctx.beginPath(); ctx.moveTo(7 * s, -20.5 * s); ctx.lineTo(8.8 * s, -19.8 * s); ctx.lineTo(7 * s, -19.2 * s); ctx.fill();
  } else if (k === 'cabra') {
    for (const [lx, ph] of [[-9, 1], [-5, -1], [5, -1], [9, 1]]) { leg(lx + step * ph, 9, '#d8d0c2', 2.2); ctx.fillStyle = '#3a2a1e'; ctx.fillRect((lx + step * ph) * s - 1.1 * s, -1.4 * s, 2.2 * s, 1.4 * s); }
    ctx.fillStyle = '#f0ebe0'; ctx.beginPath(); ctx.moveTo(-12 * s, -18 * s); ctx.lineTo(-15 * s, -23 * s); ctx.lineTo(-10 * s, -20 * s); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -15 * s, 12.5 * s, 6.8 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8895a'; ctx.beginPath(); ctx.ellipse(-4 * s, -17 * s, 5 * s, 3.5 * s, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#f0ebe0';
    ctx.beginPath(); ctx.moveTo(8 * s, -18 * s); ctx.lineTo(12 * s, -26 * s); ctx.lineTo(16 * s, -24 * s); ctx.lineTo(12 * s, -14 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15 * s, -25 * s, 5 * s, 3.4 * s, 0.35, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6b6258'; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(12.5 * s, -28 * s); ctx.quadraticCurveTo(9 * s, -34 * s, 7 * s, -30 * s); ctx.stroke();
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(17 * s, -22.5 * s); ctx.lineTo(18.5 * s, -18 * s); ctx.lineTo(16 * s, -21.5 * s); ctx.fill();
    ctx.fillStyle = '#c9bfae'; ctx.beginPath(); ctx.ellipse(11 * s, -27 * s, 2.8 * s, 1.1 * s, -0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(15.5 * s, -26.5 * s, 0.8 * s, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  } else if (k === 'bufala') {
    for (const [lx, ph] of [[-12, 1], [-6, -1], [6, -1], [12, 1]]) { leg(lx + step * ph, 11, '#2e2b2b', 3.4); }
    ctx.strokeStyle = '#2e2b2b'; ctx.lineWidth = 1.3 * s;
    ctx.beginPath(); ctx.moveTo(-18 * s, -20 * s); ctx.quadraticCurveTo(-21 * s, -14 * s, -20 * s, -8 * s); ctx.stroke();
    ctx.fillStyle = '#3d3a3a'; ctx.beginPath(); ctx.ellipse(0, -18 * s, 19 * s, 10 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a4646'; ctx.beginPath(); ctx.ellipse(-2 * s, -22 * s, 12 * s, 4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3d3a3a'; ctx.beginPath(); ctx.ellipse(19 * s, -22 * s, 7 * s, 6 * s, 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a5454'; ctx.beginPath(); ctx.ellipse(23 * s, -19 * s, 4.2 * s, 3.2 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d9d0c0'; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(17 * s, -27 * s); ctx.quadraticCurveTo(8 * s, -32 * s, 9 * s, -24 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(21 * s, -27 * s); ctx.quadraticCurveTo(28 * s, -33 * s, 27 * s, -25 * s); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(20 * s, -23.5 * s, 1 * s, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  } else if (k === 'abelha') {
    // colmeia de madeira com abelhas voando em volta
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(-9 * s, -3 * s, 18 * s, 3 * s);
    ctx.fillStyle = '#e8b04a'; ctx.fillRect(-8 * s, -13 * s, 16 * s, 10 * s);
    ctx.fillStyle = '#d99a3a'; ctx.fillRect(-8 * s, -23 * s, 16 * s, 10 * s);
    ctx.strokeStyle = 'rgba(120,70,20,.5)'; ctx.lineWidth = 1; ctx.strokeRect(-8 * s, -13 * s, 16 * s, 10 * s); ctx.strokeRect(-8 * s, -23 * s, 16 * s, 10 * s);
    ctx.fillStyle = '#c8402f'; ctx.fillRect(-10 * s, -26 * s, 20 * s, 3.2 * s);
    ctx.fillStyle = '#3a2412'; ctx.fillRect(-4 * s, -5.5 * s, 8 * s, 1.6 * s);
    for (let j = 0; j < 4; j++) {
      const a = t / 400 + j * 1.6, bx = Math.cos(a) * 13 * s, by = -16 * s + Math.sin(a * 1.3) * 7 * s;
      ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(bx, by, 1.8 * s, 1.3 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(bx - 0.3 * s, by - 1.2 * s, 0.7 * s, 2.4 * s);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(bx, by - 1.6 * s, 1.1 * s, 0.7 * s, 0, 0, 7); ctx.fill();
    }
  } else if (k === 'avestruz') {
    ctx.strokeStyle = '#e8a9a0'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2 * s, -20 * s); ctx.lineTo(-3 * s + step * 2 * s, 0); ctx.moveTo(3 * s, -20 * s); ctx.lineTo(4 * s - step * 2 * s, 0); ctx.stroke();
    ctx.fillStyle = '#2a2624'; ctx.beginPath(); ctx.ellipse(0, -26 * s, 11 * s, 8 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.ellipse(-10 * s, -28 * s, 4 * s, 3 * s, -0.4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e8b0a4'; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(7 * s, -30 * s); ctx.quadraticCurveTo(12 * s, -40 * s, 9 * s, -48 * s); ctx.stroke();
    ctx.fillStyle = '#e8b0a4'; ctx.beginPath(); ctx.ellipse(10 * s, -49 * s, 3 * s, 2.3 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9a06a'; ctx.beginPath(); ctx.moveTo(12.5 * s, -49.5 * s); ctx.lineTo(15.5 * s, -48.5 * s); ctx.lineTo(12.5 * s, -47.8 * s); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(10.8 * s, -49.8 * s, 0.7 * s, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  } else if (k === 'gato') {
    const gc = cor || GATO_CORES[0];
    const tail = Math.sin(t / 400) * 0.4;
    ctx.strokeStyle = gc.claro; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6 * s, -8 * s); ctx.quadraticCurveTo(-11 * s, -10 * s, -10 * s + tail * 4 * s, -17 * s); ctx.stroke();
    for (const [lx, ph] of [[-4, 1], [-1.5, -1], [2.5, -1], [5, 1]]) leg(lx + step * ph * 0.6, 4, gc.claro, 1.6);
    ctx.fillStyle = gc.pel; ctx.beginPath(); ctx.ellipse(0, -7 * s, 7.5 * s, 3.8 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = gc.escuro; ctx.lineWidth = 0.9 * s;
    for (const dx of [-3.5, -1, 1.5]) { ctx.beginPath(); ctx.moveTo(dx * s, -10.4 * s); ctx.lineTo(dx * s + 0.6 * s, -7.5 * s); ctx.stroke(); }
    ctx.fillStyle = gc.pel; ctx.beginPath(); ctx.arc(7 * s, -11 * s, 3.6 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4.8 * s, -13.3 * s); ctx.lineTo(5.4 * s, -16.8 * s); ctx.lineTo(7.2 * s, -14.2 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7.6 * s, -14.3 * s); ctx.lineTo(9.2 * s, -16.6 * s); ctx.lineTo(9.8 * s, -13 * s); ctx.fill();
    ctx.fillStyle = '#2f6e1e'; ctx.beginPath(); ctx.arc(8.4 * s, -11.6 * s, 0.75 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e98a9a'; ctx.beginPath(); ctx.arc(10.3 * s, -10.4 * s, 0.6 * s, 0, 7); ctx.fill();
    ctx.lineCap = 'butt';
  } else if (k === 'onca') {
    const tail = Math.sin(t / 400) * 0.5, pel = '#e0a030', pintas = '#3a2a14';
    ctx.strokeStyle = pel; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12 * s, -13 * s); ctx.quadraticCurveTo(-20 * s, -15 * s, -19 * s + tail * 5 * s, -24 * s); ctx.stroke(); ctx.lineCap = 'butt';
    for (const [lx, ph] of [[-8, 1], [-4, -1], [6, -1], [10, 1]]) leg(lx + step * ph * 0.6, 8, '#c98a22', 2.8);
    ctx.fillStyle = pel; ctx.beginPath(); ctx.ellipse(0, -12 * s, 14 * s, 6.4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = pintas;
    for (const [dx, dy] of [[-8, -14], [-3, -10], [2, -15], [7, -11], [-6, -9], [10, -14]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 1.5 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = pel; ctx.beginPath(); ctx.arc(14 * s, -17 * s, 5.6 * s, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(11 * s, -21 * s); ctx.lineTo(11.6 * s, -26 * s); ctx.lineTo(14.4 * s, -22 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(15 * s, -22 * s); ctx.lineTo(17.4 * s, -25.6 * s); ctx.lineTo(18.4 * s, -20.4 * s); ctx.fill();
    ctx.fillStyle = '#f3e3b8'; ctx.beginPath(); ctx.ellipse(17 * s, -15.4 * s, 2.6 * s, 2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f6e1e'; ctx.beginPath(); ctx.arc(15.6 * s, -18.2 * s, 0.9 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(19 * s, -16.2 * s, 0.8 * s, 0, 7); ctx.fill();
    ctx.fillStyle = pintas; for (const [dx, dy] of [[12, -20], [14, -14.6]]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 0.8 * s, 0, 7); ctx.fill(); }
  } else if (k === 'tartaruga') {
    const head = Math.sin(t / 900) * 0.8;
    ctx.fillStyle = '#8fae5a';
    for (const [lx, ly] of [[-5, -1], [5, -1], [-4, 0.5], [4, 0.5]]) { ctx.beginPath(); ctx.ellipse(lx * s, ly * s, 1.8 * s, 1.3 * s, 0, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse((9 + head) * s, -3 * s, 2.6 * s, 2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc((10 + head) * s, -3.5 * s, 0.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#6b7a3a'; ctx.beginPath(); ctx.ellipse(0, -3.5 * s, 7.5 * s, 4.8 * s, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#5a6630'; ctx.fillRect(-7.5 * s, -3.8 * s, 15 * s, 1.2 * s);
    ctx.strokeStyle = '#4a5528'; ctx.lineWidth = 0.8 * s;
    for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(dx * s - 1.8 * s, -4 * s); ctx.lineTo(dx * s, -7.2 * s); ctx.lineTo(dx * s + 1.8 * s, -4 * s); ctx.stroke(); }
  } else if (k === 'arara') {
    // poleiro com a arara em cima
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(-1 * s, -30 * s, 2 * s, 30 * s); ctx.fillRect(-7 * s, -30 * s, 14 * s, 1.6 * s);
    ctx.fillStyle = '#6b4424'; ctx.beginPath(); ctx.ellipse(0, 0, 6 * s, 1.8 * s, 0, 0, 7); ctx.fill();
    const bob = Math.sin(t / 700) * 0.5 * s;
    ctx.fillStyle = '#d8342a';
    ctx.beginPath(); ctx.moveTo(-1.5 * s, -32 * s); ctx.lineTo(-3.5 * s, -18 * s + bob); ctx.lineTo(0.5 * s, -32 * s); ctx.fill();
    ctx.fillStyle = '#2a6fc8'; ctx.beginPath(); ctx.moveTo(-0.5 * s, -32 * s); ctx.lineTo(-1.5 * s, -20 * s + bob); ctx.lineTo(1.5 * s, -32 * s); ctx.fill();
    ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.ellipse(0, -36 * s + bob, 3.6 * s, 5.5 * s, 0.15, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(-1.8 * s, -35 * s + bob, 2 * s, 3.4 * s, 0.25, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a6fc8'; ctx.beginPath(); ctx.ellipse(-2.2 * s, -33 * s + bob, 1.8 * s, 3 * s, 0.25, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.arc(1.2 * s, -42 * s + bob, 3 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.ellipse(2.4 * s, -42 * s + bob, 1.4 * s, 1.1 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(2.5 * s, -42.2 * s + bob, 0.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.moveTo(3.8 * s, -43 * s + bob); ctx.quadraticCurveTo(6.5 * s, -42 * s + bob, 4.3 * s, -39.5 * s + bob); ctx.lineTo(3.8 * s, -41 * s + bob); ctx.fill();
  }
  ctx.restore();
}
const ANIMAL_H = { galinha: 24, vaca: 34, ovelha: 25, porco: 25, coelho: 22, angola: 23, pato: 22, jumento: 42, cavalo: 46, pavao: 30, cabra: 32, bufala: 36, abelha: 26, avestruz: 52, gato: 16, tartaruga: 9, arara: 46, onca: 28 };
const SMALL_ANIMALS = ['galinha', 'coelho', 'angola', 'pato', 'gato'];

// ============================================================
// Balões de aviso
// ============================================================
function drawBubbleAt(x, y, kind, obj, t, seed) {
  const W = L.W, R = clamp(W * 0.13, 11, 20);
  y += Math.sin(t / 300 + seed) * W * 0.02;
  ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - R * 0.3, y + R * 0.9); ctx.lineTo(x, y + R * 1.45); ctx.lineTo(x + R * 0.3, y + R * 0.9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - R * 0.3, y + R * 0.95); ctx.lineTo(x, y + R * 1.45); ctx.lineTo(x + R * 0.3, y + R * 0.95); ctx.stroke();
  const s = R / 11;
  if (kind === 'water') {
    ctx.fillStyle = '#3aa0e8'; ctx.beginPath(); ctx.moveTo(x, y - 7 * s);
    ctx.bezierCurveTo(x + 6 * s, y, x + 5 * s, y + 6 * s, x, y + 6 * s); ctx.bezierCurveTo(x - 5 * s, y + 6 * s, x - 6 * s, y, x, y - 7 * s); ctx.fill();
  } else if (kind === 'pest') drawBug(x, y, s * 1.3, 0, 0);
  else if (kind === 'rastelo') { const im = toolImg('rastelo'); if (im) ctx.drawImage(im, x - 8.5 * s, y - 8.5 * s, 17 * s, 17 * s); }
  else if (kind === 'weed') drawWeed(x, y + 5 * s, s * 1.1);
  else if (kind === 'hoe') {
    line({ x: x - 6 * s, y: y + 6 * s }, { x: x + 4 * s, y: y - 5 * s }, '#8a5a2b', 2 * s);
    ctx.fillStyle = '#8f9aa3'; ctx.beginPath(); ctx.moveTo(x + 1 * s, y - 7 * s); ctx.lineTo(x + 8 * s, y - 2 * s); ctx.lineTo(x + 6 * s, y); ctx.lineTo(x + 2 * s, y - 4 * s); ctx.fill();
  } else if (kind === 'ripe') {
    // Pronto para colher: um check verde.
    ctx.fillStyle = '#43a047'; ctx.beginPath(); ctx.arc(x, y, 7.5 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - 3.6 * s, y + 0.2 * s); ctx.lineTo(x - 1 * s, y + 3 * s); ctx.lineTo(x + 4 * s, y - 2.8 * s); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  } else if (kind === 'pesca') {
    // Ponto de pesca descansado: um peixinho pronto pra fisgar.
    ctx.fillStyle = '#4fa8e0'; ctx.strokeStyle = '#2a6a9a'; ctx.lineWidth = 0.9 * s;
    ctx.beginPath(); ctx.ellipse(x - 1 * s, y, 6 * s, 3.6 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 5 * s, y); ctx.lineTo(x + 8.5 * s, y - 3.2 * s); ctx.lineTo(x + 8.5 * s, y + 3.2 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 4.2 * s, y - 0.8 * s, 1 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#123'; ctx.beginPath(); ctx.arc(x - 4 * s, y - 0.8 * s, 0.5 * s, 0, 7); ctx.fill();
  } else if (kind === 'caca') {
    // Lugar de caçada com bicho disponível: uma pegadinha.
    ctx.fillStyle = '#7a5a33';
    ctx.beginPath(); ctx.ellipse(x, y + 2.4 * s, 4.4 * s, 5.6 * s, 0, 0, 7); ctx.fill();
    for (const [dx, dy, r] of [[-3.6, -4.2, 1.7], [-1.3, -5.6, 1.9], [1.3, -5.6, 1.9], [3.6, -4.2, 1.7]]) {
      ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, r * s, r * 1.15 * s, 0, 0, 7); ctx.fill();
    }
  } else if (kind === 'poda') {
    // tesoura de poda
    ctx.strokeStyle = '#6b7780'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 5 * s); ctx.lineTo(x + 4 * s, y + 3 * s); ctx.moveTo(x + 5 * s, y - 5 * s); ctx.lineTo(x - 4 * s, y + 3 * s); ctx.stroke();
    ctx.strokeStyle = '#c8402f'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.arc(x - 5 * s, y + 5 * s, 2.2 * s, 0, 7); ctx.moveTo(x + 7.2 * s, y + 5 * s); ctx.arc(x + 5 * s, y + 5 * s, 2.2 * s, 0, 7); ctx.stroke();
    ctx.lineCap = 'butt';
  } else if (kind === 'podre') {
    // vidrinho de poção
    ctx.fillStyle = '#b48ce0'; ctx.strokeStyle = '#5a3a8a'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.arc(x, y + 2 * s, 5 * s, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8fdc5a'; ctx.beginPath(); ctx.arc(x, y + 3 * s, 3.5 * s, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e0d4f5'; ctx.fillRect(x - 1.8 * s, y - 6 * s, 3.6 * s, 4 * s);
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x - 2.2 * s, y - 7.5 * s, 4.4 * s, 2 * s);
  } else if (kind === 'vet') {
    ctx.fillStyle = '#e03a2f'; ctx.fillRect(x - 1.8 * s, y - 6 * s, 3.6 * s, 12 * s); ctx.fillRect(x - 6 * s, y - 1.8 * s, 12 * s, 3.6 * s);
  } else if (kind === 'sell') {
    ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc(x, y, 6.5 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b77f00'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.arc(x, y, 4.6 * s, 0, 7); ctx.stroke();
    ctx.fillStyle = '#8a5a00'; ctx.font = `800 ${Math.round(8 * s)}px 'Baloo 2', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', x, y + 0.5 * s);
  } else if (kind === 'bone') {
    ctx.fillStyle = '#f3ead6'; ctx.strokeStyle = '#b8a47a'; ctx.lineWidth = 0.8 * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
    ctx.fillRect(-4.5 * s, -1.3 * s, 9 * s, 2.6 * s);
    for (const dx of [-4.5, 4.5]) for (const dy of [-1.5, 1.5]) { ctx.beginPath(); ctx.arc(dx * s, dy * s, 1.8 * s, 0, 7); ctx.fill(); }
    ctx.restore();
  } else if (kind === 'prod') {
    drawProduct(ANIMAL[obj.k].prod, x, y, s * 0.95);
  } else if (kind === 'feed') {
    ctx.fillStyle = '#f2c14e';
    for (const [dx, dy] of [[-3, 2], [0, -1], [3, 2], [-1.5, 5], [1.5, 5], [0, 2]]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s - 1 * s, 1.5 * s, 2.2 * s, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#b8862a'; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(x, y - 6 * s); ctx.lineTo(x, y - 2 * s); ctx.stroke();
  }
  if (kind === 'prod') {
    ctx.fillStyle = '#ffd54a'; const sp = 1 + Math.sin(t / 200 + seed) * 0.3;
    ctx.beginPath(); ctx.arc(x + 7 * s, y - 6 * s, 1.5 * s * sp, 0, 7); ctx.fill();
  }
}

// ============================================================
// Cena: roça
// ============================================================
function diamond(c, r, inset) {
  return [iso(c + inset, r + inset), iso(c + 1 - inset, r + inset), iso(c + 1 - inset, r + 1 - inset), iso(c + inset, r + 1 - inset)];
}
const PLANT_SPOTS = [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];
const BIG_SPOTS = [[0.62, 0.34], [0.36, 0.64]];
const WEED_SPOTS = [[0.5, 0.16], [0.86, 0.55], [0.16, 0.86]];

function drawPlot(i, p, t, home) {
  const c = plotU(i), r = plotV(i), W = L.W;
  const [p1, p2, p3, p4] = diamond(c, r, 0.05);
  const hov = hover && hover.kind === 'plot' && hover.i === i;
  if (p.s === 'locked') {
    if (home && canBuy(i)) {
      ctx.setLineDash([4, 4]); quad(p1, p2, p3, p4, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.6)', 1.5); ctx.setLineDash([]);
      const m = cellCenter(i);
      const pending = buyPending && buyPending.i === i && performance.now() < buyPending.until;
      if (!pending) {
        const R = clamp(W * 0.09, 8, 13);
        ctx.fillStyle = 'rgba(255,253,242,.9)'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, 7); ctx.fill(); ctx.stroke();
        line({ x: m.x - R * 0.5, y: m.y }, { x: m.x + R * 0.5, y: m.y }, '#4f9a2f', 2.2);
        line({ x: m.x, y: m.y - R * 0.5 }, { x: m.x, y: m.y + R * 0.5 }, '#4f9a2f', 2.2);
        if (hov) quad(p1, p2, p3, p4, null, 'rgba(255,255,255,.9)', 2);
        return;
      }
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(m.x - W * 0.03, m.y - W * 0.3, W * 0.06, W * 0.3);
      const bw = W * 0.56, bh = W * 0.26;
      ctx.fillStyle = '#d39a5c'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 2;
      ctx.fillRect(m.x - bw / 2, m.y - W * 0.47, bw, bh); ctx.strokeRect(m.x - bw / 2, m.y - W * 0.47, bw, bh);
      ctx.fillStyle = '#4a2a10'; ctx.font = `800 ${Math.round(clamp(W * 0.11, 9, 15))}px 'Baloo 2', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Colocar', m.x, m.y - W * 0.405);
      ctx.fillText('aqui?', m.x, m.y - W * 0.29);
    }
    if (hov) quad(p1, p2, p3, p4, null, 'rgba(255,255,255,.9)', 2);
    return;
  }
  // Terra fofa: borda mais clara, miolo escuro com leiras e torrões.
  const d = W * 0.09;
  const dry = p.s === 'growing' && p.dry;
  const dn = pt => ({ x: pt.x, y: pt.y + d });
  const tone = dry ? ['#c29266', '#a87a4e', '#8a6038'] : p.s === 'withered' ? ['#a8825a', '#8f6b45', '#6e5034'] : p.fert ? ['#9a5f34', '#6e3e1e', '#58300f'] : ['#a86b3c', '#7e4a26', '#633718'];
  quad(p4, p3, dn(p3), dn(p4), '#6b3f1d');
  quad(p3, p2, dn(p2), dn(p3), '#52301a');
  quad(p1, p2, p3, p4, tone[0]);
  line(p4, p1, 'rgba(255,230,190,.35)', 1.5); line(p1, p2, 'rgba(255,230,190,.35)', 1.5);
  const [q1, q2, q3, q4] = diamond(c, r, 0.14);
  quad(q1, q2, q3, q4, tone[1]);
  for (let k = 0; k < 4; k++) {
    const a = lerp(q1, q4, (k + 0.5) / 4), b = lerp(q2, q3, (k + 0.5) / 4);
    line({ x: a.x, y: a.y + 1 }, { x: b.x, y: b.y + 1 }, tone[2], Math.max(1.5, W * 0.035));
    line({ x: a.x, y: a.y - W * 0.012 }, { x: b.x, y: b.y - W * 0.012 }, 'rgba(255,220,170,.18)', Math.max(1, W * 0.012));
  }
  ctx.fillStyle = p.fert && p.s === 'growing' ? 'rgba(255,225,120,.85)' : 'rgba(40,20,5,.35)';
  for (const [u, v] of [[0.25, 0.5], [0.5, 0.8], [0.78, 0.42], [0.5, 0.22], [0.35, 0.3], [0.66, 0.66]]) { const q = iso(c + u, r + v); ctx.fillRect(q.x - 1, q.y - 1, 2.5, 2); }
  if (dry) {
    const m = cellCenter(i); ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.x - W * .15, m.y); ctx.lineTo(m.x - W * .05, m.y + W * .03); ctx.lineTo(m.x + W * .02, m.y - W * .02); ctx.lineTo(m.x + W * .14, m.y + W * .02); ctx.stroke();
  }
  if (hov) quad(p1, p2, p3, p4, null, 'rgba(255,255,255,.95)', 2.5);
  if (p.s === 'growing' || p.s === 'withered') {
    const crop = CROP[p.c];
    for (let k = 0; k < p.w; k++) { const [u, v] = WEED_SPOTS[k]; const q = iso(c + u, r + v); drawWeed(q.x, q.y, W / 100); }
    const st = p.s === 'growing' ? stageOf(p) : 4;
    const big = crop && crop.tipo === 'chao' && st >= 3;
    const s = W / 100 * (big ? 1.25 : 0.72) * (st === 0 ? 1.2 : 1);
    if (p.ouro && p.s === 'growing') goldGlow(c, r, t, st);
    for (const [u, v] of (big ? BIG_SPOTS : PLANT_SPOTS)) { const q = iso(c + u, r + v); drawPlant(q.x, q.y, s, crop, st, t, p.s === 'withered' || p.podre); }
    if (p.podre) drawRot(c, r, t);
    if (p.ouro && p.s === 'growing') goldSparkle(c, r, t, st);
    for (let k = 0; k < p.b; k++) { const q = iso(c + 0.45 + k * 0.15, r + 0.5); drawBug(q.x, q.y, W / 100, t, k + i); }
  }
}

// Placa do terreno: avisa quando sai a próxima expansão (ou que ela já pode ser comprada).
function landSignText() {
  if (freeLots()) return [`${freeLots()} ${freeLots() > 1 ? 'canteiros' : 'canteiro'}`, 'para colocar no +', '#2f5e14'];
  const next = EXPANSOES[state.exp + 1];
  if (!next) return null;
  const extra = next.total - EXPANSOES[state.exp].total;
  if (state.level < next.nivel) return [`+${extra} canteiros`, `no nível ${next.nivel}`, '#7a1d10'];
  return [`+${extra} canteiros`, `comprar · ${next.preco.toLocaleString('pt-BR')}`, '#2f5e14'];
}
// A placa fica no lugar dela (dá para mudar no modo Mover), sem depender de onde estão os canteiros.
function drawLandSign(x, y, fantasma) {
  const txt = landSignText(); if (!txt) return;
  // Tudo proporcional ao chão (sem travar a letra): a placa mantém sempre o mesmo tamanho em relação à roça.
  const W = L.W;
  const hov = hover && hover.kind === 'land';
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x, y, W * 0.18, W * 0.05, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(x - W * 0.035, y - W * 0.5, W * 0.07, W * 0.5);
  const fs = W * 0.1;
  ctx.font = `800 ${fs}px 'Baloo 2', sans-serif`;
  const bw = Math.max(ctx.measureText(txt[0]).width, ctx.measureText(txt[1]).width) + fs * 1.6, bh = fs * 2.9, top = y - W * 0.5 - bh * 0.7;
  const bx = x + Math.max(0, bw / 2 - W * 0.3); // a tábua fica para a direita, longe do celeiro
  ctx.fillStyle = hov ? '#e8b273' : '#d39a5c'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = fs * 0.2;
  ctx.beginPath(); ctx.roundRect(bx - bw / 2, top, bw, bh, fs * 0.55); ctx.fill(); ctx.stroke();
  line({ x: bx - bw / 2 + fs * 0.4, y: top + bh / 2 }, { x: bx + bw / 2 - fs * 0.4, y: top + bh / 2 }, 'rgba(122,74,34,.35)', 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4a2a10'; ctx.fillText(txt[0], bx, top + bh * 0.3);
  ctx.fillStyle = txt[2]; ctx.fillText(txt[1], bx, top + bh * 0.72);
  if (!fantasma && !moveMode) hits.push({ kind: 'land', x: bx, y: top + bh / 2, r: Math.max(bw / 2, 30) });
}
// Planta podre: manchas escuras no chão e mosquinhas voando.
function drawRot(c, r, t) {
  const m = iso(c + 0.5, r + 0.5), W = L.W;
  ctx.fillStyle = 'rgba(70,50,30,.35)'; ctx.beginPath(); ctx.ellipse(m.x, m.y, W * 0.35, W * 0.15, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#222';
  for (let k = 0; k < 3; k++) { const a = t / 180 + k * 2.1; ctx.beginPath(); ctx.arc(m.x + Math.cos(a) * W * 0.18, m.y - W * 0.3 + Math.sin(a * 1.7) * W * 0.08, Math.max(1.2, W * 0.012), 0, 7); ctx.fill(); }
}
// Planta dourada: brilho no chão e estrelinhas piscando (mais fortes quando está pronta).
function goldGlow(c, r, t, st) {
  const m = iso(c + 0.5, r + 0.5), W = L.W, k = st >= 4 ? 1 : 0.5;
  const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, W * 0.5);
  g.addColorStop(0, `rgba(255,215,64,${0.55 * k})`); g.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(m.x, m.y, W * 0.5, W * 0.26, 0, 0, 7); ctx.fill();
}
function goldSparkle(c, r, t, st) {
  const m = iso(c + 0.5, r + 0.5), W = L.W, n = st >= 4 ? 5 : 2;
  for (let k = 0; k < n; k++) {
    const a = t / 700 + k * 1.3, tw = Math.abs(Math.sin(t / 300 + k * 2));
    star(m.x + Math.cos(a) * W * 0.3, m.y - W * 0.25 + Math.sin(a * 1.3) * W * 0.18, W * 0.05 * tw + 1);
  }
}
function plotBubble(p, home) {
  if (p.s === 'withered') return home ? 'hoe' : null;
  if (p.s !== 'growing') return null;
  if (p.podre) return 'podre';
  if (p.b) return 'pest';
  if (p.w) return 'weed';
  if (p.dry) return 'water';
  if (ripe(p) && (home || !(p.stolen || state.log[visitKey(p.id)]))) return 'ripe';
  return null;
}

// Lago do tema "Lago dos patos", com patinhos nadando.
function drawLake(x, y, W, t) {
  ctx.fillStyle = '#6b8f4a'; ctx.beginPath(); ctx.ellipse(x, y, W * 1.05, W * 0.45, 0, 0, 7); ctx.fill();
  ctx.fillStyle = estacao().neve ? '#cfe6f5' : '#5aa9e6'; ctx.beginPath(); ctx.ellipse(x, y, W * 0.95, W * 0.38, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) { const r = ((t / 1500 + k / 3) % 1); ctx.globalAlpha = 1 - r; ctx.beginPath(); ctx.ellipse(x - W * 0.3, y, W * 0.1 + r * W * 0.3, W * 0.04 + r * W * 0.12, 0, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#4f9a2f'; for (const [dx, dy] of [[0.5, 0.1], [0.62, -0.05], [-0.6, 0.12]]) { ctx.beginPath(); ctx.ellipse(x + dx * W, y + dy * W, W * 0.08, W * 0.035, 0, 0.3, 6.1); ctx.lineTo(x + dx * W, y + dy * W); ctx.fill(); }
  for (let k = 0; k < 2; k++) {
    const a = t / 6000 + k * 3, px = x + Math.cos(a) * W * 0.5, py = y + Math.sin(a) * W * 0.16;
    drawAnimal('pato', px, py + W * 0.05, W / 100 * 0.9, t, Math.sin(a) > 0 ? -1 : 1, false);
  }
}
function drawRoca(s, t, home) {
  const tod = timeOfDay(), W = L.W;
  drawSky(t, tod); drawGround();
  if (home) { drawLimiteItens('roca'); drawMatinhos('roca'); }
  // lago (grande no tema "Lago dos patos"; nos outros, um pesqueiro menor). Na sua roça, clique para pescar.
  if (temaDe(s).lago) { const q = iso(...LAGO_POS); drawLake(q.x, q.y, W * 0.72, t);
    if (home && pescaPronta()) drawBubbleAt(q.x, q.y - W * 0.55, 'pesca', null, t, 99);
    if (home && !moveMode) { hits.push({ kind: 'lago', x: q.x, y: q.y, r: W * 0.6 });
      if (hover && hover.kind === 'lago') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.75, W * 0.3, 0, 0, 7); ctx.stroke(); } } }
  // casa, celeiro, casinha, árvores e enfeites: cada um no seu lugar (dá para mudar no modo Mover)
  const cachorroDepois = drawObjetos(s, 'roca', t, home, 'tras');
  // (a roça não tem mais cerca em volta: as cercas agora são compradas e postas onde quiser)
  if (cachorroDepois) drawDogSpot('roca', s, t, home);
  // canteiros e o que está no gramado entre eles, do fundo para a frente
  const mov = home && moveMode && moving && moving.plot !== undefined ? moving.plot : -1;
  let d0 = -Infinity;
  for (let sum = 0; sum <= COLS + ROWS - 2; sum++) {
    const prof = sum + RU0 + RV0 + 1; // u+v (do mundo) da frente dessa diagonal de canteiros
    drawObjetos(s, 'roca', t, home, 'frente', d0, prof); d0 = prof;
    for (let c = 0; c < COLS; c++) {
      const r = sum - c, i = r * COLS + c; if (r < 0 || r >= ROWS) continue;
      if (i === mov) continue; // está na mão do jogador
      drawPlot(i, s.plots[i], t, home);
      if (home && moveMode && !moving && s.plots[i].s !== 'locked') { const [p1, p2, p3, p4] = diamond(plotU(i), plotV(i), 0.05); ctx.setLineDash([5, 5]); quad(p1, p2, p3, p4, null, 'rgba(255,255,255,.85)', 2); ctx.setLineDash([]); }
    }
  }
  if (home) drawFolhas(t);
  if (home) drawInvasor(t);
  drawAvatares('roca', t);
  drawObjetos(s, 'roca', t, home, 'frente', d0);
  drawPeixesRoca(s, t);
  drawMoving('roca', t);
  drawCritters(t, tod);
  nightOverlay(tod);
  drawWeather(t);
  if (home) drawAlertaInvasao(t);
  for (let i = 0; i < N; i++) {
    const k = plotBubble(s.plots[i], home);
    if (k) { const m = cellCenter(i); drawBubbleAt(m.x, m.y - W * 0.55, k, s.plots[i], t, i); }
  }
  dogBubble('roca', s, t, home);
}

// ============================================================
// Cena: animais
// ============================================================
// Cada abrigo tem um cercado. O prédio fica no fundo, o cocho à direita e os bichos passeiam na frente.
const SHED = { u: 0.3, v: 0.25, w: 1.7, d: 1.1 };
const yardArea = id => {
  const y = yardOf(id);
  // girado: a mesma área, só transposta (troca qual eixo fica perto da casinha), pra bater com comRotacaoAbrigo.
  if (y.rot) return { u0: y.u0 + 1.65, u1: y.u1 - 0.4, v0: y.v0 + 0.45, v1: y.v1 - 0.4, trough: id !== 'apiario' && { u0: y.u0 + 0.95, u1: y.u0 + 1.15, v0: y.v0 + 2.45, v1: y.v0 + 3.45 } };
  return { u0: y.u0 + 0.45, u1: y.u1 - 0.4, v0: y.v0 + 1.65, v1: y.v1 - 0.4, trough: id !== 'apiario' && { u0: y.u0 + 2.45, u1: y.u0 + 3.45, v0: y.v0 + 0.95, v1: y.v0 + 1.15 } };
};
const HIVE_SPOTS = [[0.9, 1.95], [1.9, 1.95], [2.9, 1.95], [0.9, 2.9], [1.9, 2.9], [2.9, 2.9], [3.5, 2.4], [3.5, 3.3]];
// Estilo de cada prédio: paredes, telhado e detalhes.
const SHED_LOOK = {
  galinheiro: { wall: '#ecc98c', wallR: '#d2a869', roof: '#c8402f', roofD: '#8f2a1e', chao: '#dccb8e', h: 0.55, legs: 0.12 },
  coelheira:  { wall: '#d9a86a', wallR: '#bf8c50', roof: '#5a9a3a', roofD: '#3d7326', chao: '#b5dc7a', h: 0.45, legs: 0.2, small: true },
  chiqueiro:  { wall: '#d99a7c', wallR: '#bd7f62', roof: '#8a5a33', roofD: '#6b4220', chao: '#b99264', h: 0.5 },
  apiario:    { wall: '#f4d774', wallR: '#dcb957', roof: '#e08a2e', roofD: '#b86a1a', chao: '#b5dc7a', h: 0.45, small: true },
  aprisco:    { wall: '#cfc8b8', wallR: '#b3ab98', roof: '#6c8f3a', roofD: '#4f6e28', chao: '#bfe08a', h: 0.6, pedra: true },
  estabulo:   { wall: '#c8402f', wallR: '#a53325', roof: '#7a2a1e', roofD: '#5a1d14', chao: '#cdb97c', h: 0.75, trim: true },
  cocheira:   { wall: '#b07a44', wallR: '#94622f', roof: '#3f6fa8', roofD: '#2c5282', chao: '#c9b27a', h: 0.72, trim: true },
  angoleiro:    { wall: '#e0b87a', wallR: '#c79c5e', roof: '#7a6a9a', roofD: '#5a4c78', chao: '#dccb8e', h: 0.55, legs: 0.12 },
  patoril:      { wall: '#b8d4e0', wallR: '#9ab8c8', roof: '#3f6fa8', roofD: '#2c5282', chao: '#b5dc7a', h: 0.5, legs: 0.1 },
  cabril:       { wall: '#cfc8b8', wallR: '#b3ab98', roof: '#6c8f3a', roofD: '#4f6e28', chao: '#bfe08a', h: 0.6, pedra: true },
  ovelharia:    { wall: '#e8e2d0', wallR: '#cfc8b0', roof: '#8a7a5a', roofD: '#6b5c40', chao: '#bfe08a', h: 0.6 },
  estabulo_buf: { wall: '#8a6a5a', wallR: '#6e5244', roof: '#4a2a1e', roofD: '#33190f', chao: '#cdb97c', h: 0.75, trim: true },
  jumentaria:   { wall: '#a8a090', wallR: '#8e8676', roof: '#5a4a3a', roofD: '#403326', chao: '#c9b27a', h: 0.7, trim: true },
  cercado:    { wall: '#e3bf62', wallR: '#c9a24a', roof: '#e3bf62', roofD: '#b8943a', chao: '#b5dc7a', h: 0.8, aberto: true },
};
const sm0 = k => !!k.small;
// Prédio com telhado de duas águas. A cumeeira corre no sentido u.
// Abrigo com o acabamento do tema da casa (friso e textura), mas cada bicho mantém sua cor e formato
// próprios — senão, com um tema ativo, todos os abrigos ficavam da mesma cor e pareciam iguais.
function lookDoAbrigo(id, skin) {
  const k = SHED_LOOK[id], tm = TEMA_CASA[skin] && skin !== 'classico' ? TEMA_CASA[skin] : null;
  if (!tm) return k;
  return Object.assign({}, k, { frisoCor: tm.friso, pedra: !!tm.pedra || k.pedra, tabuas: !!tm.tabuas });
}
function drawShed(id, u0, v0, lv, t, skin) {
  const k = lookDoAbrigo(id, skin), sm = k.small ? 0.78 : 1;
  const a0 = u0 + SHED.u, b0 = v0 + SHED.v, a1 = a0 + SHED.w * sm, b1 = b0 + SHED.d * sm;
  const h0 = k.legs || 0, h = h0 + k.h * sm, rh = 0.42 * sm, vm = (b0 + b1) / 2, o = 0.1;
  const W = L.W;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; poly([P(a0, b1 + 0.12), P(a1 + 0.15, b1 + 0.12), P(a1 + 0.15, b0), P(a0, b0)]); ctx.fill();
  if (k.legs) for (const [u, v] of [[a0 + 0.08, b1 - 0.08], [a1 - 0.08, b1 - 0.08], [a1 - 0.08, b0 + 0.1]]) { const q = P(u, v); ctx.fillStyle = '#6e4424'; ctx.fillRect(q.x - W * 0.02, q.y - h0 * W, W * 0.04, h0 * W); }
  if (k.aberto) {
    // viveiro: telhado de palha em quatro postes, com um poleiro
    for (const [u, v] of [[a0 + 0.1, b1 - 0.1], [a1 - 0.1, b1 - 0.1], [a1 - 0.1, b0 + 0.1], [a0 + 0.1, b0 + 0.1]]) {
      const q = P(u, v); ctx.fillStyle = '#8a5a33'; ctx.fillRect(q.x - W * 0.025, q.y - h * W, W * 0.05, h * W);
    }
    line(P(a0 + 0.3, vm, 0.35), P(a1 - 0.3, vm, 0.35), '#8a5a33', W * 0.04);
  } else {
    isoBox(a0, b0, a1, b1, h0, h, k.wall, k.wall, k.wallR);
    if (k.pedra) {
      ctx.strokeStyle = 'rgba(90,80,60,.35)'; ctx.lineWidth = 1;
      for (let r = 1; r < 4; r++) { const hh = h0 + (h - h0) * r / 4; line(P(a0, b1, hh), P(a1, b1, hh), 'rgba(90,80,60,.35)', 1); line(P(a1, b0, hh), P(a1, b1, hh), 'rgba(90,80,60,.3)', 1); }
    } else {
      for (let r = 1; r < 4; r++) { const hh = h0 + (h - h0) * r / 4; line(P(a0, b1, hh), P(a1, b1, hh), 'rgba(80,40,10,.22)', 1); line(P(a1, b0, hh), P(a1, b1, hh), 'rgba(80,40,10,.2)', 1); }
    }
    // porta virada para o cercado
    const dm = (a0 + a1) / 2, dw = 0.26 * sm, dh = h0 + (h - h0) * 0.72;
    if (k.trim) {
      quad(P(dm - dw, b1, h0), P(dm + dw, b1, h0), P(dm + dw, b1, dh), P(dm - dw, b1, dh), '#fff4e0');
      quad(P(dm - dw + 0.04, b1, h0), P(dm + dw - 0.04, b1, h0), P(dm + dw - 0.04, b1, dh - 0.04), P(dm - dw + 0.04, b1, dh - 0.04), k.wallR);
      line(P(dm - dw + 0.04, b1, h0), P(dm + dw - 0.04, b1, dh - 0.04), '#fff4e0', 2);
      line(P(dm + dw - 0.04, b1, h0), P(dm - dw + 0.04, b1, dh - 0.04), '#fff4e0', 2);
      quad(P(a1, vm - 0.14, h * 0.55), P(a1, vm + 0.14, h * 0.55), P(a1, vm + 0.14, h * 0.8), P(a1, vm - 0.14, h * 0.8), '#fff4e0');
      quad(P(a1, vm - 0.1, h * 0.58), P(a1, vm + 0.1, h * 0.58), P(a1, vm + 0.1, h * 0.77), P(a1, vm - 0.1, h * 0.77), '#3a2412');
    } else {
      quad(P(dm - dw, b1, h0), P(dm + dw, b1, h0), P(dm + dw, b1, dh), P(dm - dw, b1, dh), '#3a2412');
      if (id === 'coelheira') { ctx.strokeStyle = 'rgba(230,230,230,.7)'; ctx.lineWidth = 1; for (let q = 1; q < 4; q++) line(P(dm - dw + q * dw / 2, b1, h0), P(dm - dw + q * dw / 2, b1, dh), 'rgba(230,230,230,.7)', 1); }
    }
    if (id === 'galinheiro') line(P(dm, b1, h0), P(dm + 0.1, b1 + 0.4), '#a0703f', W * 0.05); // rampa
    if (id === 'apiario') { const q = P(a1, vm, h * 0.55); ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.ellipse(q.x + W * 0.04, q.y, W * 0.07, W * 0.09, 0, 0, 7); ctx.fill(); }
    // oitão (a ponta triangular do telhado)
    ctx.fillStyle = k.wallR; poly([P(a1, b0, h), P(a1, b1, h), P(a1, vm, h + rh)]); ctx.fill();
    // frisos claros nos cantos e janelinha com moldura na lateral (acabamento, sem pesar)
    const friso = k.frisoCor || (k.trim ? '#fff4e0' : 'rgba(255,248,230,.75)');
    for (const [u, v] of [[a0, b1], [a1, b1], [a1, b0]]) line(P(u, v, h0), P(u, v, h), friso, Math.max(1.5, W * 0.022));
    line(P(a0, b1, h0), P(a1, b1, h0), 'rgba(0,0,0,.18)', Math.max(1, W * 0.012));
    if (!k.trim && !sm0(k)) {
      const ju = a0 + (a1 - a0) * 0.2, jw = 0.16, jz = h0 + (h - h0) * 0.45, jh = (h - h0) * 0.3;
      quad(P(ju - 0.03, b1, jz - 0.03), P(ju + jw + 0.03, b1, jz - 0.03), P(ju + jw + 0.03, b1, jz + jh + 0.03), P(ju - 0.03, b1, jz + jh + 0.03), '#fff4e0');
      quad(P(ju, b1, jz), P(ju + jw, b1, jz), P(ju + jw, b1, jz + jh), P(ju, b1, jz + jh), '#ffe9a8');
      line(P(ju + jw / 2, b1, jz), P(ju + jw / 2, b1, jz + jh), '#fff4e0', 1.2);
    }
    // oitão com uma aberturinha redonda
    const oo = P(a1, vm, h + rh * 0.35); ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.ellipse(oo.x, oo.y, W * 0.04, W * 0.035, 0, 0, 7); ctx.fill();
  }
  // telhado: a água de trás, a da frente e a beirada
  quad(P(a0 - o, b0 - o, h - 0.04), P(a1 + o, b0 - o, h - 0.04), P(a1 + o, vm, h + rh), P(a0 - o, vm, h + rh), k.roofD);
  quad(P(a0 - o, vm, h + rh), P(a1 + o, vm, h + rh), P(a1 + o, b1 + o, h - 0.04), P(a0 - o, b1 + o, h - 0.04), k.roof);
  quad(P(a1 + o, vm, h + rh), P(a1 + o, b1 + o, h - 0.04), P(a1 + o, b1 + o, h - 0.1), P(a1 + o, vm, h + rh - 0.06), k.roofD);
  quad(P(a1 + o, vm, h + rh), P(a1 + o, b0 - o, h - 0.04), P(a1 + o, b0 - o, h - 0.1), P(a1 + o, vm, h + rh - 0.06), k.roofD);
  for (let r = 1; r < 4; r++) { const f = r / 4; line(lerp(P(a0 - o, vm, h + rh), P(a0 - o, b1 + o, h - 0.04), f), lerp(P(a1 + o, vm, h + rh), P(a1 + o, b1 + o, h - 0.04), f), 'rgba(0,0,0,.14)', 1); }
  line(P(a0 - o, vm, h + rh), P(a1 + o, vm, h + rh), k.roofD, W * 0.045);
  line(P(a0 - o, vm, h + rh + 0.012), P(a1 + o, vm, h + rh + 0.012), 'rgba(255,255,255,.35)', Math.max(1, W * 0.012)); // brilho da cumeeira
  line(P(a0 - o, b1 + o, h - 0.04), P(a1 + o, b1 + o, h - 0.04), 'rgba(0,0,0,.25)', Math.max(1, W * 0.015)); // beiral
  // estrelinhas do nível no telhado
  for (let s = 0; s < lv; s++) { const q = lerp(P(a0, vm, h + rh * 0.55), P(a1, vm, h + rh * 0.55), (s + 1) / (lv + 1)); star(q.x, q.y + W * 0.08, W * 0.07); }
  return { x: P((a0 + a1) / 2, (b0 + b1) / 2, h).x, y: P((a0 + a1) / 2, (b0 + b1) / 2, h * 0.6).y, top: P(a0, vm, h + rh).y };
}
function star(x, y, r) {
  ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = '#a87400'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
// Cocho com ração (ou flores, no apiário).
function drawTrough(y, id) {
  if (id === 'apiario') {
    for (const [u, v, c] of [[2.6, 0.6, '#f06292'], [3.0, 0.9, '#ffd54a'], [3.4, 0.55, '#ffffff'], [2.8, 1.2, '#ba68c8'], [3.5, 1.15, '#ff8a65']]) {
      const q = iso(y.u0 + u, y.v0 + v); ctx.fillStyle = '#4f9a2f'; ctx.beginPath(); ctx.ellipse(q.x, q.y, L.W * 0.12, L.W * 0.05, 0, 0, 7); ctx.fill();
      for (let p = 0; p < 5; p++) { const a = p * 1.26; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * L.W * 0.035, q.y - L.W * 0.05 + Math.sin(a) * L.W * 0.02, L.W * 0.025, 0, 7); ctx.fill(); }
    }
    return;
  }
  isoBox(y.u0 + 2.5, y.v0 + 0.45, y.u0 + 3.5, y.v0 + 0.75, 0, 0.14, '#e3bf62', '#8a5a33', '#6e4424');
  ctx.fillStyle = '#c9a24a'; for (let k = 0; k < 6; k++) { const q = P(y.u0 + 2.6 + k * 0.15, y.v0 + 0.6, 0.14); ctx.fillRect(q.x - 1, q.y - 1.5, 2, 2); }
}
// Lugar vazio de um abrigo: contorno pontilhado e uma placa.
function drawEmptyYard(b, y, home) {
  const W = L.W;
  if (!home) return;
  const lv = 0, nivel = b.nivel, locked = state.level < nivel;
  const pts = [iso(y.u0 + 0.15, y.v0 + 0.15), iso(y.u1 - 0.15, y.v0 + 0.15), iso(y.u1 - 0.15, y.v1 - 0.15), iso(y.u0 + 0.15, y.v1 - 0.15)];
  ctx.setLineDash([6, 6]); quad(...pts, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.7)', 2); ctx.setLineDash([]);
  const m = iso((y.u0 + y.u1) / 2, (y.v0 + y.v1) / 2);
  const hov = hover && hover.kind === 'abrigo' && hover.id === b.id;
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(m.x - W * 0.035, m.y - W * 0.45, W * 0.07, W * 0.45);
  const bw = Math.max(W * 1.25, 84), bh = Math.max(W * 0.5, 34), top = m.y - W * 0.45 - bh * 0.6;
  ctx.fillStyle = hov ? '#e8b273' : '#d39a5c'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(m.x - bw / 2, top, bw, bh, 6); ctx.fill(); ctx.stroke();
  const fs = Math.round(clamp(W * 0.15, 11, 16));
  ctx.fillStyle = '#4a2a10'; ctx.font = `800 ${fs}px 'Baloo 2', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.nome, m.x, top + bh * 0.32);
  ctx.font = `700 ${Math.round(fs * 0.85)}px 'Baloo 2', sans-serif`;
  ctx.fillStyle = locked ? '#7a1d10' : '#2f5e14';
  ctx.fillText(locked ? `Nível ${nivel}` : `Construir · ${b.precos[lv].toLocaleString('pt-BR')}`, m.x, top + bh * 0.72);
  hits.push({ kind: 'abrigo', id: b.id, x: m.x, y: top + bh / 2, r: Math.max(W * 0.7, 44) });
}
function drawYard(b, s, t, home, dt, bubbles) {
  const y = yardOf(b.id), lv = abrigoLv(s, b.id), W = L.W, k = SHED_LOOK[b.id];
  if (!lv) return drawEmptyYard(b, y, home);
  const e = 0.12, R = [y.u0 + e, y.v0 + e, y.u1 - e, y.v1 - e];
  quad(iso(R[0], R[1]), iso(R[2], R[1]), iso(R[2], R[3]), iso(R[0], R[3]), k.chao);
  comRotacaoAbrigo(y, () => {
    if (b.id === 'chiqueiro') {
      // porco não tem casa, só um lamaçal bem grande no meio do chiqueiro
      const q = iso(y.u0 + 1.5, y.v0 + 1.9);
      ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.85, W * 0.36, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.ellipse(q.x, q.y + W * 0.06, W * 0.7, W * 0.26, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(q.x - W * 0.22, q.y - W * 0.08, W * 0.3, W * 0.09, 0, 0, 7); ctx.fill();
    }
    if (b.id === 'galinheiro') { ctx.fillStyle = 'rgba(200,160,70,.5)'; for (let j = 0; j < 14; j++) { const q = iso(y.u0 + 0.5 + (j * 0.37) % 3, y.v0 + 1.7 + (j * 0.61) % 1.8); ctx.fillRect(q.x, q.y, W * 0.08, 1.5); } }
    drawTrough(y, b.id);
  });
  drawFenceRect(R[0], R[1], R[2], R[3], 'back');
  // porco não tem casinha: só o chiqueiro com lama e cocho
  let c;
  comRotacaoAbrigo(y, () => { c = b.id === 'chiqueiro' ? iso(y.u0 + 1.5, y.v0 + 1.9) : drawShed(b.id, y.u0, y.v0, lv, t, s.skin); });
  const hov = hover && hover.kind === 'abrigo' && hover.id === b.id;
  if (hov) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; poly([iso(R[0], R[1]), iso(R[2], R[1]), iso(R[2], R[3]), iso(R[0], R[3])]); ctx.stroke(); }
  hits.push({ kind: 'abrigo', id: b.id, x: c.x, y: c.y, r: W * 0.55 });
  const list = livesIn(s, b.id);
  updateWander(list, dt, yardArea(b.id));
  const base = W / 100 * 1.65;
  const sorted = list.map(a => ({ a, m: amb[a.id] })).sort((p, q) => (p.m.u + p.m.v) - (q.m.u + q.m.v));
  for (const { a, m } of sorted) drawAnimalAt(a, m, base, t);
  drawFenceRect(R[0], R[1], R[2], R[3], 'front');
  for (const { a, m } of sorted) {
    const kk = animalBubble(a, home);
    if (kk) bubbles.push([a, m, kk, animalScale(a, base)]);
  }
}
function drawPen(s, t, home, dt) {
  const tod = timeOfDay(), W = L.W;
  drawSky(t, tod); drawGround();
  if (home) { drawLimiteItens('animais'); drawMatinhos('animais'); }
  drawObjetos(s, 'animais', t, home, 'tras');
  const bubbles = [];
  const order = ABRIGOS.slice().sort((a, b) => { const p = yardOf(a.id), q = yardOf(b.id); return (p.u0 + p.v0) - (q.u0 + q.v0); });
  for (const b of order) { if (moving && moving.key === 'abrigo:' + b.id) continue; drawYard(b, s, t, home, dt, bubbles); }
  drawAvatares('animais', t);
  drawObjetos(s, 'animais', t, home, 'frente');
  drawMoving('animais', t);
  drawCritters(t, tod);
  nightOverlay(tod);
  drawWeather(t);
  for (const [a, m, k, sc] of bubbles) { const p = iso(m.u, m.v); drawBubbleAt(p.x, p.y - ANIMAL_H[drawKind(a)] * sc - W * 0.2, k, a, t, m.u * 7); }
  dogBubble('animais', s, t, home);
}

// ============================================================
// Cena: casa
// ============================================================
const DRAW_DECOR = {
  quadro(t, m) {
    quad(P(3.1, 0, 0.72), P(4.3, 0, 0.72), P(4.3, 0, 1.12), P(3.1, 0, 1.12), m.cor, 'rgba(0,0,0,.35)', 1.5);
    if (m.tipo === 'vaca') {
      quad(P(3.18, 0, 0.77), P(4.22, 0, 0.77), P(4.22, 0, 1.07), P(3.18, 0, 1.07), '#e8f4d8');
      const c = P(3.7, 0, 0.92), W = L.W;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, W * 0.16, W * 0.12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(c.x - W * 0.07, c.y - W * 0.04, W * 0.05, W * 0.04, 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#f4a6b0'; ctx.beginPath(); ctx.ellipse(c.x, c.y + W * 0.07, W * 0.09, W * 0.045, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; for (const dx of [-0.05, 0.05]) { ctx.beginPath(); ctx.arc(c.x + dx * W, c.y - W * 0.01, W * 0.015, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#e8c35a'; for (const dx of [-0.17, 0.17]) { ctx.beginPath(); ctx.ellipse(c.x + dx * W, c.y - W * 0.08, W * 0.04, W * 0.02, dx > 0 ? -0.5 : 0.5, 0, 7); ctx.fill(); }
      return;
    }
    const sol = m.tipo === 'sol';
    quad(P(3.18, 0, 0.77), P(4.22, 0, 0.77), P(4.22, 0, 1.07), P(3.18, 0, 1.07), sol ? '#f28b5b' : '#9fd6f2');
    if (sol) { const q = P(3.7, 0, 0.86); ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(q.x, q.y, L.W * 0.08, Math.PI, 0); ctx.fill(); quad(P(3.18, 0, 0.77), P(4.22, 0, 0.77), P(4.22, 0, 0.84), P(3.18, 0, 0.84), '#2c5282'); return; }
    poly([P(3.18, 0, 0.77), P(4.22, 0, 0.77), P(4.22, 0, 0.86), P(3.7, 0, 0.93), P(3.18, 0, 0.87)]); ctx.fillStyle = '#5ea83a'; ctx.fill();
    const sun = P(3.98, 0, 1.0); ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(sun.x, sun.y, L.W * 0.04, 0, 7); ctx.fill();
    const h = P(3.45, 0, 0.9); ctx.fillStyle = '#c8402f'; ctx.fillRect(h.x - L.W * 0.035, h.y - L.W * 0.03, L.W * 0.07, L.W * 0.05);
  },
  tapete(t, m) {
    quad(P(1.3, 1.4), P(3.9, 1.4), P(3.9, 3.9), P(1.3, 3.9), m.cor);
    if (m.padrao === 'listras') {
      for (let k = 0; k < 5; k++) { const v0 = 1.55 + k * 0.5; quad(P(1.3, v0), P(3.9, v0), P(3.9, v0 + 0.2), P(1.3, v0 + 0.2), m.cor2); }
    } else if (m.padrao === 'xadrez') {
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) quad(P(1.3 + i * 0.52, 1.4 + j * 0.5), P(1.82 + i * 0.52, 1.4 + j * 0.5), P(1.82 + i * 0.52, 1.9 + j * 0.5), P(1.3 + i * 0.52, 1.9 + j * 0.5), m.cor2);
    } else {
      quad(P(1.5, 1.6), P(3.7, 1.6), P(3.7, 3.7), P(1.5, 3.7), null, m.cor2, 2);
      quad(P(2.6, 2.05), P(3.2, 2.65), P(2.6, 3.25), P(2.0, 2.65), m.cor2);
      quad(P(2.6, 2.35), P(2.9, 2.65), P(2.6, 2.95), P(2.3, 2.65), m.cor);
    }
    for (let k = 0; k <= 12; k++) { const a = P(1.3 + k * 2.6 / 12, 3.9), b = P(1.3 + k * 2.6 / 12, 4.0); line(a, b, m.cor2, 1.2); }
  },
  abajur(t, m) {
    const b = P(0.6, 0.6, 0), top = P(0.6, 0.6, 1.05), bot = P(0.6, 0.6, 0.8), W = L.W;
    const night = timeOfDay() !== 'dia';
    const g = ctx.createRadialGradient(bot.x, bot.y, 0, bot.x, bot.y, W * 1.3);
    g.addColorStop(0, `rgba(255,233,160,${night ? 0.5 : 0.22})`); g.addColorStop(1, 'rgba(255,233,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bot.x, bot.y, W * 1.3, 0, 7); ctx.fill();
    if (m.tipo === 'lampiao') {
      // lampião de pendurar, numa mesinha
      isoBox(0.35, 0.35, 0.85, 0.85, 0, 0.45, '#a86b38', '#8a5a33', '#6e4424');
      const c = P(0.6, 0.6, 0.62);
      ctx.fillStyle = m.cor; ctx.fillRect(c.x - W * 0.08, c.y - W * 0.02, W * 0.16, W * 0.04); ctx.fillRect(c.x - W * 0.06, c.y - W * 0.28, W * 0.12, W * 0.04);
      ctx.fillStyle = 'rgba(255,230,150,.85)'; ctx.fillRect(c.x - W * 0.06, c.y - W * 0.24, W * 0.12, W * 0.22);
      ctx.strokeStyle = m.cor; ctx.lineWidth = 2; ctx.strokeRect(c.x - W * 0.06, c.y - W * 0.24, W * 0.12, W * 0.22);
      ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.ellipse(c.x, c.y - W * 0.1, W * 0.025, W * 0.05 + Math.sin(t / 150) * W * 0.005, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(c.x, c.y - W * 0.33, W * 0.04, Math.PI, 0); ctx.strokeStyle = m.cor; ctx.stroke();
      return;
    }
    ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.ellipse(b.x, b.y, W * 0.12, W * 0.05, 0, 0, 7); ctx.fill();
    line(b, bot, '#5a3a22', W * 0.025);
    poly([{ x: top.x - W * 0.09, y: top.y }, { x: top.x + W * 0.09, y: top.y }, { x: bot.x + W * 0.16, y: bot.y }, { x: bot.x - W * 0.16, y: bot.y }]);
    ctx.fillStyle = m.cor; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (m.tipo === 'franja') { ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 1.2; for (let k = 0; k <= 8; k++) { const x = bot.x - W * 0.16 + k * W * 0.04; ctx.beginPath(); ctx.moveTo(x, bot.y); ctx.lineTo(x, bot.y + W * 0.05); ctx.stroke(); } }
  },
  tv(t, m) {
    isoBox(2.9, 0.1, 4.4, 0.65, 0, 0.28, '#9a6a3e', '#7a4a22', '#653c1b');
    line(P(3.65, 0.65, 0.05), P(3.65, 0.65, 0.23), '#4a2c14', 1.5);
    if (m.tipo === 'radio') {
      isoBox(3.2, 0.2, 4.1, 0.5, 0.28, 0.62, '#b07a44', '#8a5a33', '#6e4424');
      quad(P(3.3, 0.5, 0.34), P(3.75, 0.5, 0.34), P(3.75, 0.5, 0.56), P(3.3, 0.5, 0.56), '#e8d2a8');
      ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 1; for (let k = 1; k < 4; k++) line(P(3.3 + k * 0.11, 0.5, 0.34), P(3.3 + k * 0.11, 0.5, 0.56), 'rgba(90,60,30,.5)', 1);
      for (const u of [3.85, 4.0]) { const q = P(u, 0.5, 0.45); ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(q.x, q.y, L.W * 0.03, 0, 7); ctx.fill(); }
      const k = Math.sin(t / 200); ctx.fillStyle = '#3a2412'; const n = P(4.05, 0.3, 0.75 + k * 0.02); ctx.font = `${Math.round(L.W * 0.12)}px serif`; ctx.fillText('♪', n.x, n.y);
      return;
    }
    if (m.tipo === 'plana') {
      line(P(3.65, 0.35, 0.28), P(3.65, 0.35, 0.42), '#333', 3);
      quad(P(2.95, 0.36, 0.4), P(4.35, 0.36, 0.4), P(4.35, 0.36, 1.0), P(2.95, 0.36, 1.0), '#1a1a1a');
      const hue = (t / 60) % 360;
      quad(P(3.0, 0.36, 0.44), P(4.3, 0.36, 0.44), P(4.3, 0.36, 0.96), P(3.0, 0.36, 0.96), `hsl(${hue}, 55%, 60%)`);
      const k = (Math.sin(t / 600) + 1) / 2, q = P(3.2 + k * 0.9, 0.36, 0.62);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(q.x, q.y, L.W * 0.05, 0, 7); ctx.fill();
      return;
    }
    isoBox(3.1, 0.18, 4.2, 0.4, 0.28, 0.74, '#3a3a3a', '#2a2a2a', '#1e1e1e');
    const hue = (t / 60) % 360;
    quad(P(3.18, 0.4, 0.34), P(4.12, 0.4, 0.34), P(4.12, 0.4, 0.68), P(3.18, 0.4, 0.68), `hsl(${hue}, 45%, 58%)`);
    const k = (Math.sin(t / 600) + 1) / 2, q = P(3.3 + k * 0.7, 0.4, 0.46);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(q.x, q.y, L.W * 0.035, 0, 7); ctx.fill();
    line(P(3.65, 0.29, 0.74), P(3.3, 0.29, 0.98), '#555', 1.5); line(P(3.65, 0.29, 0.74), P(4.0, 0.29, 0.98), '#555', 1.5);
  },
  sofa(t, m) {
    const [a, b, c, d, e] = m.cores;
    isoBox(0.1, 1.0, 1.0, 2.9, 0, 0.3, a, b, c);
    quad(P(0.42, 1.25, 0.3), P(0.95, 1.25, 0.3), P(0.95, 1.9, 0.3), P(0.42, 1.9, 0.3), d);
    quad(P(0.42, 2.0, 0.3), P(0.95, 2.0, 0.3), P(0.95, 2.65, 0.3), P(0.42, 2.65, 0.3), d);
    isoBox(0.1, 1.0, 0.38, 2.9, 0.3, 0.7, a, b, c);
    isoBox(0.1, 1.0, 1.0, 1.22, 0.3, 0.46, e, b, c);
    isoBox(0.1, 2.68, 1.0, 2.9, 0.3, 0.46, e, b, c);
  },
  vaso(t, m) {
    isoBox(4.15, 4.05, 4.65, 4.55, 0, 0.28, m.cor, 'rgba(0,0,0,.12)', 'rgba(0,0,0,.25)');
    isoBox(4.15, 4.05, 4.65, 4.55, 0, 0.28, m.cor, m.cor, m.cor);
    quad(P(4.18, 4.08, 0.28), P(4.62, 4.08, 0.28), P(4.62, 4.52, 0.28), P(4.18, 4.52, 0.28), '#5a3a20');
    const b = P(4.4, 4.3, 0.28), W = L.W, sw = Math.sin(t / 900) * 0.05;
    if (m.tipo === 'cacto') {
      ctx.fillStyle = '#4f9a2f'; ctx.strokeStyle = '#2f6e1e'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(b.x, b.y - W * 0.2, W * 0.07, W * 0.2, 0, 0, 7); ctx.fill(); ctx.stroke();
      for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(b.x + d * W * 0.11, b.y - W * 0.22 - (d > 0 ? W * 0.05 : 0), W * 0.04, W * 0.09, 0, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#f06292'; ctx.beginPath(); ctx.arc(b.x, b.y - W * 0.4, W * 0.035, 0, 7); ctx.fill();
      return;
    }
    [-1.1, -0.6, -0.15, 0.3, 0.75, 1.15].forEach((a, i) => leaf(b.x, b.y, W * (0.32 + (i % 2) * 0.08), W * 0.055, a + sw, i % 2 ? '#4fa83a' : '#3a8a2c'));
    if (m.tipo === 'girassol') {
      for (const [dx, dy] of [[-0.1, -0.4], [0.1, -0.46], [0.02, -0.52]]) {
        const x = b.x + dx * W, y = b.y + dy * W;
        ctx.fillStyle = '#ffd54a'; for (let k = 0; k < 8; k++) { const a2 = k * Math.PI / 4; ctx.beginPath(); ctx.ellipse(x + Math.cos(a2) * W * 0.04, y + Math.sin(a2) * W * 0.04, W * 0.025, W * 0.015, a2, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#6b3a1a'; ctx.beginPath(); ctx.arc(x, y, W * 0.028, 0, 7); ctx.fill();
      }
      return;
    }
    ctx.fillStyle = '#ef7aa0';
    for (const [dx, dy] of [[-0.08, -0.38], [0.1, -0.42], [0.02, -0.46]]) { ctx.beginPath(); ctx.arc(b.x + dx * W, b.y + dy * W, W * 0.035, 0, 7); ctx.fill(); }
  },
};
const DECOR_ORDER = ['quadro', 'tapete', 'abajur', 'tv', 'sofa', 'vaso'];
const DECOR_FOOT = {
  tapete: [1.3, 1.4, 3.9, 3.9], vaso: [4.1, 4.0, 4.7, 4.6], abajur: [0.35, 0.35, 0.85, 0.85],
  sofa: [0.1, 1.0, 1.0, 2.9], tv: [2.9, 0.1, 4.4, 0.65],
};
function decorCenter(id) { const [c, r, h] = DECOR_SPOT[id]; return P(c, r, h); }

function drawSlotHint(id) {
  ctx.setLineDash([5, 4]);
  if (id === 'quadro') quad(P(3.1, 0, 0.72), P(4.3, 0, 0.72), P(4.3, 0, 1.12), P(3.1, 0, 1.12), 'rgba(255,255,255,.12)', 'rgba(255,255,255,.75)', 1.5);
  else { const [c0, r0, c1, r1] = DECOR_FOOT[id]; quad(P(c0, r0), P(c1, r0), P(c1, r1), P(c0, r1), 'rgba(255,255,255,.12)', 'rgba(255,255,255,.75)', 1.5); }
  ctx.setLineDash([]);
  const m = decorCenter(id), R = clamp(L.W * 0.1, 9, 15);
  ctx.fillStyle = 'rgba(255,253,242,.95)'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, 7); ctx.fill(); ctx.stroke();
  line({ x: m.x - R * 0.5, y: m.y }, { x: m.x + R * 0.5, y: m.y }, '#4f9a2f', 2.5);
  line({ x: m.x, y: m.y - R * 0.5 }, { x: m.x, y: m.y + R * 0.5 }, '#4f9a2f', 2.5);
}

function drawRoom(s, t, home) {
  const W = L.W, H = 1.3, tod = timeOfDay();
  const g = ctx.createRadialGradient(L.cw / 2, L.ch * 0.55, W * 0.5, L.cw / 2, L.ch * 0.55, L.cw * 0.7);
  g.addColorStop(0, '#6b4a30'); g.addColorStop(1, '#2e1f14');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.cw, L.ch);
  // piso de tábuas
  quad(P(0, ROOM, -0.12), P(ROOM, ROOM, -0.12), P(ROOM, ROOM), P(0, ROOM), '#5a3a20');
  quad(P(ROOM, 0, -0.12), P(ROOM, ROOM, -0.12), P(ROOM, ROOM), P(ROOM, 0), '#4a2f18');
  for (let k = 0; k < ROOM * 2; k++) {
    quad(P(k / 2, 0), P((k + 1) / 2, 0), P((k + 1) / 2, ROOM), P(k / 2, ROOM), k % 2 ? '#c48a52' : '#b98049');
    for (let j = 1; j <= 2; j++) { const r = (k * 1.7 + j * 2.1) % ROOM; line(P(k / 2, r), P((k + 1) / 2, r), 'rgba(0,0,0,.15)', 1); }
  }
  // paredes
  quad(P(0, 0), P(0, ROOM), P(0, ROOM, H), P(0, 0, H), '#e6cf9c');
  quad(P(0, 0), P(ROOM, 0), P(ROOM, 0, H), P(0, 0, H), '#f1dcae');
  for (let k = 0.25; k < ROOM; k += 0.5) {
    line(P(0, k, 0.08), P(0, k, H), 'rgba(160,110,60,.13)', 2);
    line(P(k, 0, 0.08), P(k, 0, H), 'rgba(160,110,60,.13)', 2);
  }
  quad(P(0, 0), P(0, ROOM), P(0, ROOM, 0.08), P(0, 0, 0.08), '#8a5a33');
  quad(P(0, 0), P(ROOM, 0), P(ROOM, 0, 0.08), P(0, 0, 0.08), '#9a6a3e');
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 4; poly([P(0, ROOM, H), P(0, 0, H), P(ROOM, 0, H)]); ctx.stroke();
  // janela
  quad(P(0.85, 0, 0.4), P(1.12, 0, 0.4), P(1.12, 0, 1.14), P(0.85, 0, 1.14), '#c8402f');
  quad(P(2.18, 0, 0.4), P(2.45, 0, 0.4), P(2.45, 0, 1.14), P(2.18, 0, 1.14), '#c8402f');
  quad(P(1.0, 0, 0.45), P(2.3, 0, 0.45), P(2.3, 0, 1.08), P(1.0, 0, 1.08), '#fffaf0');
  quad(P(1.08, 0, 0.52), P(2.22, 0, 0.52), P(2.22, 0, 1.0), P(1.08, 0, 1.0), SKIES[tod][1]);
  if (tod === 'noite') { const m = P(1.9, 0, 0.88); ctx.fillStyle = '#f4f1d0'; ctx.beginPath(); ctx.arc(m.x, m.y, W * 0.05, 0, 7); ctx.fill(); }
  else quad(P(1.08, 0, 0.52), P(2.22, 0, 0.52), P(2.22, 0, 0.66), P(1.08, 0, 0.72), '#7cbf4f');
  line(P(1.65, 0, 0.52), P(1.65, 0, 1.0), '#fffaf0', 3); line(P(1.08, 0, 0.76), P(2.22, 0, 0.76), '#fffaf0', 3);
  // porta
  quad(P(0, 3.4), P(0, 4.5), P(0, 4.5, 0.9), P(0, 3.4, 0.9), '#7a4a22', '#4a2c14', 2);
  quad(P(0, 3.55, 0.5), P(0, 4.35, 0.5), P(0, 4.35, 0.8), P(0, 3.55, 0.8), null, 'rgba(0,0,0,.25)', 1.5);
  quad(P(0, 3.55, 0.1), P(0, 4.35, 0.1), P(0, 4.35, 0.42), P(0, 3.55, 0.42), null, 'rgba(0,0,0,.25)', 1.5);
  const kn = P(0, 3.6, 0.45); ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.arc(kn.x, kn.y, W * 0.025, 0, 7); ctx.fill();
  // decorações
  for (const id of DECOR_ORDER) { const m = emUso(s, id); if (m) DRAW_DECOR[id](t, m); }
  drawMural(s, t, home);
  // bichos de companhia que moram dentro de casa
  const pets = s.animals.filter(a => ANIMAL[a.k].lugar === 'casa');
  const gato = pets.find(a => a.k === 'gato');
  if (gato) drawCaminha(gato, t);
  updateWander(pets, Math.min(0.05, 1 / 60), ROOM_AREA);
  pets.map(a => ({ a, m: amb[a.id] })).sort((x, y) => (x.m.u + x.m.v) - (y.m.u + y.m.v)).forEach(({ a, m }) => drawAnimalAt(a, m, W / 100 * (a.k === 'arara' ? 1.55 : 2.4), t));
  for (const id of DECOR_ORDER) {
    if (home && !emUso(s, id)) drawSlotHint(id);
    if (home || emUso(s, id)) { const m = decorCenter(id); hits.push({ kind: 'decor', id, x: m.x, y: m.y, r: W * 0.4 }); }
  }
  const hv = hover && hover.kind === 'decor' && decorCenter(hover.id);
  if (hv) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hv.x, hv.y, W * 0.42, 0, 7); ctx.stroke(); }
}

// Caminha do gato, no chão da sala. Clicar nela troca o nome dele.
const CAMINHA_AT = [3.15, 4.45];
function drawCaminha(a, t) {
  const W = L.W, c = P(CAMINHA_AT[0], CAMINHA_AT[1]), rx = W * 0.34, ry = W * 0.17;
  if (hover && hover.kind === 'caminha') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 1.15, ry * 1.2, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + ry * 0.25, rx * 1.02, ry * 1.02, 0, 0, 7); ctx.fill();
  // borda fofa (lateral e topo) e a almofada do meio
  ctx.fillStyle = '#9c3a28'; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c9523a'; ctx.beginPath(); ctx.ellipse(c.x, c.y - ry * 0.35, rx, ry, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f3dcae'; ctx.beginPath(); ctx.ellipse(c.x, c.y - ry * 0.3, rx * 0.72, ry * 0.62, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,30,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(c.x, c.y - ry * 0.3, rx * 0.5, ry * 0.4, 0, 0, 7); ctx.stroke();
  // patinha bordada na borda da frente
  const px = c.x, py = c.y + ry * 0.38, r = W * 0.018;
  ctx.fillStyle = '#f3dcae'; ctx.beginPath(); ctx.arc(px, py, r * 1.3, 0, 7); ctx.fill();
  for (const [dx, dy] of [[-1.5, -1.5], [0, -2.1], [1.5, -1.5]]) { ctx.beginPath(); ctx.arc(px + dx * r, py + dy * r, r * 0.6, 0, 7); ctx.fill(); }
  hits.push({ kind: 'caminha', id: a.id, x: c.x, y: c.y - ry * 0.3, r: W * 0.32 });
}

// ---------- A ferramenta na mão ----------
// O item escolhido acompanha o cursor e, ao usar, aparece em cima da planta (regando, borrifando…).
const toolImgs = {};
function toolImg(kind) {
  const src = kind === 'seed' ? cropIcon(state.seed) : kind === 'fert' ? fertIcon(state.fertSel) : kind === 'pocao' ? potionIcon()
    : TOOL_ICONS[kind] && 'data:image/svg+xml,' + encodeURIComponent(TOOL_ICONS[kind].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" '));
  if (!src) return null;
  if (!toolImgs[src]) { const im = new Image(); im.src = src; toolImgs[src] = im; }
  const im = toolImgs[src];
  return im.complete && im.naturalWidth ? im : null;
}
const fxs = [];
function useFx(kind, pos) { if (pos) fxs.push({ kind, x: pos.x, y: pos.y, t0: performance.now() }); }
const FX_COLOR = { pocao: '#b48ce0', water: '#3aa0e8', pest: 'rgba(210,225,235,.9)', fert: '#ffd54a', seed: '#8a5a2b', hoe: '#6b3f1d' };
function drawFx(t) {
  const W = L.W, S = clamp(W * 0.42, 30, 60);
  for (let k = fxs.length - 1; k >= 0; k--) {
    const f = fxs[k], age = (t - f.t0) / 900;
    if (age > 1) { fxs.splice(k, 1); continue; }
    const im = toolImg(f.kind), x = f.x + S * 0.35, y = f.y - W * 0.45;
    // partículas caindo na terra
    ctx.fillStyle = FX_COLOR[f.kind];
    for (let n = 0; n < 7; n++) {
      const a = (age * 1.6 + n / 7) % 1, px = f.x - S * 0.3 + ((n * 37) % 11) / 11 * S * 0.6, py = y + S * 0.2 + a * (f.y - y);
      if (age > 0.15) { ctx.globalAlpha = 1 - age; ctx.beginPath(); ctx.ellipse(px, py, S * 0.05, S * (f.kind === 'water' ? 0.09 : 0.05), 0, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = Math.min(1, (1 - age) * 3);
    if (im) {
      ctx.save(); ctx.translate(x, y);
      ctx.rotate(-0.15 - Math.sin(Math.min(1, age * 2.2) * Math.PI) * (f.kind === 'hoe' ? 0.9 : 0.6));
      ctx.drawImage(im, -S / 2, -S / 2, S, S); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
// Com o mouse sobre a roça, o item escolhido aparece no lugar da setinha.
function drawCursorTool() {
  const show = scene === 'roca' && isHome() && state.tool !== 'hand' && pointer.inside && !pointer.touch && !(drag && drag.moved);
  cv.style.cursor = show ? 'none' : '';
  if (!show) return;
  const im = toolImg(state.tool); if (!im) { cv.style.cursor = ''; return; }
  const S = clamp(L.W * 0.4, 30, 52);
  ctx.save(); ctx.translate(pointer.x, pointer.y); ctx.rotate(-0.25);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  ctx.drawImage(im, -S * 0.2, -S * 0.8, S, S); ctx.restore();
}
// Balões de fala (cachorro e avatar): nome em negrito e a fala embaixo, somem em ~2,5 s.
let falas = [];
function falar(alvo, nome, txt) { falas = falas.filter(f => f.alvo !== alvo); falas.push({ alvo, nome, txt, t0: performance.now() }); }
function posFala(alvo) {
  if (alvo === 'avatar' || alvo === 'avatar:dono') { const w = avWalk[scene + ':' + (alvo === 'avatar' ? 'eu' : 'dono')]; return w && w.tela; }
  if (alvo.startsWith('animal:')) { const m = amb[alvo.slice(7)]; return m && m.topo; }
  if (alvo.startsWith('dog:')) return dogPos(alvo.slice(4));
  return null;
}
function drawFalas(t) {
  falas = falas.filter(f => t - f.t0 < 2600);
  for (const f of falas) {
    const p = posFala(f.alvo); if (!p) continue;
    const age = (t - f.t0) / 2600, sobe = Math.min(1, age * 8);
    ctx.globalAlpha = age > 0.8 ? (1 - age) * 5 : 1;
    const fs = Math.round(clamp(L.W * 0.13, 12, 17));
    ctx.font = `800 ${fs}px 'Baloo 2', sans-serif`; const w1 = ctx.measureText(f.nome).width;
    ctx.font = `700 ${fs}px 'Baloo 2', sans-serif`; const w2 = ctx.measureText(f.txt).width;
    const bw = Math.max(w1, w2) + 22, bh = fs * 2.5 + 10, x = clamp(p.x, bw / 2 + 6, L.cw - bw / 2 - 6), y = p.y - 10 - bh - (1 - sobe) * -8;
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.roundRect(x - bw / 2 + 2, y + 3, bw, bh, 12); ctx.fill();
    ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - bw / 2, y, bw, bh, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - 7, y + bh - 1); ctx.lineTo(p.x, y + bh + 9); ctx.lineTo(p.x + 7, y + bh - 1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x - 7, y + bh); ctx.lineTo(p.x, y + bh + 9); ctx.lineTo(p.x + 7, y + bh); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7a4a22'; ctx.font = `800 ${fs}px 'Baloo 2', sans-serif`; ctx.fillText(f.nome, x, y + 5 + fs * 0.65);
    ctx.fillStyle = '#2f2a1f'; ctx.font = `700 ${fs}px 'Baloo 2', sans-serif`; ctx.fillText(f.txt, x, y + 5 + fs * 1.85);
  }
  ctx.globalAlpha = 1;
}
function drawPopups(t) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(clamp(L.W * 0.16, 12, 20))}px 'Baloo 2', sans-serif`;
  for (let k = popups.length - 1; k >= 0; k--) {
    const pp = popups[k], age = (t - pp.t0) / 1300;
    if (age < 0) continue;
    if (age > 1) { popups.splice(k, 1); continue; }
    ctx.globalAlpha = 1 - age * age;
    const y = pp.y - age * L.W * 0.5;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,24,8,.85)'; ctx.strokeText(pp.text, pp.x, y);
    ctx.fillStyle = pp.color; ctx.fillText(pp.text, pp.x, y);
  }
  ctx.globalAlpha = 1;
}

function draw(t, dt) {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  layout(scene); hits = [];
  const s = S(), home = isHome();
  if (scene === 'roca') drawRoca(s, t, home);
  else if (scene === 'animais') drawPen(s, t, home, dt);
  else drawRoom(s, t, home);
  drawFx(t);
  drawPopups(t); drawFalas(t);
  drawCursorTool();
}

// ============================================================
// Ícones para a loja e o celeiro
// ============================================================
const ICONS = {};
function makeIcon(key, fn) {
  if (ICONS[key]) return ICONS[key];
  const g = document.createElement('canvas'); g.width = g.height = 96;
  const saved = Object.assign({}, L);
  ctx = g.getContext('2d');
  try { fn(); } finally { ctx = mainCtx; Object.assign(L, saved); }
  return (ICONS[key] = g.toDataURL());
}
const cropIcon = id => makeIcon('c:' + id, () => {
  const crop = CROP[id];
  ctx.fillStyle = '#8b5a33'; ctx.beginPath(); ctx.ellipse(48, 76, 34, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(60,34,14,.35)'; ctx.beginPath(); ctx.ellipse(48, 78, 26, 8, 0, 0, 7); ctx.fill();
  const sc = { chao: 2.3, alto: 1.6, grao: 2.2, abacaxi: 2.6, folha: 2.8 }[crop.tipo] || 2.4;
  drawPlant(48, 78, sc, crop, 4, 0, false);
});
const animalIcon = id => makeIcon('a:' + id, () => {
  const k = ANIMAL[id].desenho || id;
  const sc = { galinha: 2.6, vaca: 1.6, ovelha: 2.2, porco: 2.1, coelho: 2.7, angola: 2.5, pato: 2.5, jumento: 1.45, cavalo: 1.35, pavao: 2.0, cabra: 1.9, bufala: 1.5, abelha: 2.6, avestruz: 1.45, gato: 3.4, tartaruga: 3.6, arara: 1.75, onca: 1.7 }[k];
  const x = SMALL_ANIMALS.includes(k) || k === 'tartaruga' ? 46 : k === 'pavao' ? 56 : k === 'abelha' || k === 'arara' ? 48 : k === 'avestruz' ? 42 : 38;
  drawAnimal(k, x, 88, sc, 0, 1, false);
});
// Ícone do gato na cor certa (um por cor, cacheado) — para diferenciar cada um dos até 3 gatos nas listas.
const gatoIcon = corId => makeIcon('gato:' + corId, () => drawAnimal('gato', 46, 88, 3.4, 0, 1, false, GATO_CORES.find(c => c.id === corId) || GATO_CORES[0]));
const petIcon = a => a.k === 'gato' ? gatoIcon(corGato(a).id) : animalIcon(a.k);
const productIcon = id => makeIcon('p:' + id, () => drawProduct(id, 48, 48, 5.5));
const decorIcon = mid => makeIcon('d:' + mid, () => {
  const mod = MODELO[mid], id = mod.lugar;
  L.W = { tapete: 34, sofa: 48, tv: 64, quadro: 100, abajur: 70, vaso: 105 }[id];
  L.ox = 0; L.oy = 0;
  const m = decorCenter(id);
  L.ox = 48 - m.x; L.oy = (id === 'abajur' ? 52 : 56) - m.y;
  if (id === 'quadro') { ctx.fillStyle = '#f1dcae'; ctx.fillRect(8, 8, 80, 80); }
  DRAW_DECOR[id](0, mod);
});
const abrigoIcon = id => makeIcon('ab:' + id, () => {
  L.W = 58; L.ox = 0; L.oy = 0;
  const m = P(SHED.u + SHED.w / 2, SHED.v + SHED.d / 2, 0.3);
  L.ox = 44 - m.x; L.oy = 60 - m.y;
  drawShed(id, 0, 0, 0, 0);
});
const potionIcon = () => makeIcon('pocao', () => {
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(48, 86, 24, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#b48ce0'; ctx.strokeStyle = '#5a3a8a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(48, 60, 24, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8fdc5a'; ctx.beginPath(); ctx.arc(48, 62, 19, 0.1, Math.PI - 0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(38, 50, 5, 8, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#e0d4f5'; ctx.fillRect(40, 22, 16, 16); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(38, 14, 20, 9);
});
const itemIcon = id => PRODUCE[id] ? cropIcon(PRODUCE[id].planta) : productIcon(id);
const dogIcon = raca => makeIcon('dog:' + raca, () => drawDog(50, 88, 118, 0, raca, false));
const bowlIcon = () => makeIcon('bowl', () => {
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(48, 74, 32, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c8402f'; ctx.beginPath(); ctx.moveTo(18, 50); ctx.lineTo(78, 50); ctx.lineTo(70, 72); ctx.lineTo(26, 72); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a0301f'; ctx.beginPath(); ctx.ellipse(48, 50, 30, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9a6a3a';
  for (const [dx, dy] of [[-16, 0], [-8, -4], [0, -2], [8, -5], [16, -1], [-4, 3], [6, 2], [-12, -6], [12, 3]]) { ctx.beginPath(); ctx.arc(48 + dx, 49 + dy, 4, 0, 7); ctx.fill(); }
});
const fertIcon = id => makeIcon('f:' + id, () => {
  const f = FERT[id];
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(48, 86, 28, 6, 0, 0, 7); ctx.fill();
  // saco de adubo
  ctx.fillStyle = '#e9d6a8'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(24, 30); ctx.quadraticCurveTo(48, 20, 72, 30); ctx.lineTo(76, 82); ctx.quadraticCurveTo(48, 90, 20, 82); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, 30); ctx.lineTo(36, 18); ctx.lineTo(60, 18); ctx.lineTo(66, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = f.cor; ctx.fillRect(22, 46, 52, 22);
  leaf(48, 64, 18, 5, -0.5, '#4fa83a'); leaf(48, 64, 18, 5, 0.5, '#6cc24a');
  ctx.fillStyle = '#fff'; ctx.font = "800 13px 'Baloo 2', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${f.corta * 100}%`, 48, 50);
});

// ============================================================
// Interface
// ============================================================
const TOOL_ICONS = {
  hand: '<svg viewBox="0 0 24 24" fill="#ffd9b0" stroke="#6b4220" stroke-width="1.6" stroke-linejoin="round"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V5.5a1.5 1.5 0 0 1 3 0V12V8.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-5-2.7L4.3 14a1.6 1.6 0 0 1 2.6-1.8L8 13.5z"/></svg>',
  hoe: '<svg viewBox="0 0 24 24"><path d="M8 22 17 8" stroke="#8a5a2b" stroke-width="2.6" stroke-linecap="round"/><path d="M16 9 7 5 8 2 17 6Z" fill="#6b747c" stroke="#3a4247" stroke-width="0.9" stroke-linejoin="round"/></svg>',
  rastelo: '<svg viewBox="0 0 24 24"><path d="M3.5 21.5 16 8" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round"/><path d="M12.3 4.3 19.7 11.7" stroke="#5d6770" stroke-width="2.4" stroke-linecap="round"/><path d="M13.2 5.2l2.4-2.4M15.2 7.2l2.4-2.4M17.2 9.2l2.4-2.4M19.2 11.2l2.4-2.4" stroke="#5d6770" stroke-width="1.5" stroke-linecap="round"/></svg>',
  water: '<svg viewBox="0 0 24 24" stroke="#1d5f8f" stroke-width="1.4" stroke-linejoin="round"><path d="M6 10h9v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="#5cb4ee"/><path d="M15 12l5-5 1.5 1.5-5.5 6" fill="#5cb4ee"/><path d="M8 10a2.5 2.5 0 0 1 5 0" fill="none"/><path d="M21 11.5v1.5M19 13v1.5" stroke="#3aa0e8" stroke-linecap="round"/></svg>',
  pest: '<svg viewBox="0 0 24 24" stroke="#3b2a18" stroke-width="1.4" stroke-linejoin="round"><rect x="7" y="8" width="9" height="13" rx="2" fill="#e05a3a"/><path d="M9 8V5h5v3" fill="#bbb"/><path d="M14 5h3l2-1" fill="none"/><path d="M19 7l2-1M19 9l2 0" stroke="#7aa" stroke-linecap="round"/><circle cx="11.5" cy="14.5" r="2.2" fill="#fff"/></svg>',
  weed: '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><path d="M12 21v-7M12 14c-3 0-5-2-5-5 3 0 5 2 5 5zM12 14c3 0 5-2 5-5-3 0-5 2-5 5z" stroke="#2f6e1e" stroke-width="1.8" fill="#6cc24a"/><path d="M12 7V2M9.5 4.5 12 2l2.5 2.5" stroke="#6b4220" stroke-width="1.8"/></svg>',
};
const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const TOOLS = [
  { id: 'hand', nome: 'Mão' }, { id: 'hoe', nome: 'Enxadão' }, { id: 'water', nome: 'Regar' },
  { id: 'pest', nome: 'Inseticida' }, { id: 'seed', nome: 'Semente' },
  { id: 'fert', nome: 'Adubo' },
];
const HOME_ONLY = ['seed', 'hoe', 'fert'];
const availTools = () => TOOLS.filter(t => (isHome() || !HOME_ONLY.includes(t.id)) && (t.id !== 'hoe' || state.tools.enxada));

// ---------- Botões da tela sem se sobrepor ----------
// Depois de o CSS montar a tela, confere o espaço de verdade: cada coluna de botões começa abaixo
// do que está em cima dela e, se não couber até o que está embaixo, encolhe por inteiro.
let fitPedido = 0;
function pedirFitHud() { if (!fitPedido) fitPedido = requestAnimationFrame(() => { fitPedido = 0; fitHud(); }); }
function fitHud() {
  const q = sel => document.querySelector(sel);
  const player = q('.player'), topo = q('.topright'), menu = q('.menu'), cenas = q('#scenes'), gift = q('.giftwrap'), zoom = q('.zoom');
  const baixo = [q('#tools'), q('#penActions')];
  if (!menu || !cenas || !zoom) return;
  for (const el of [menu, cenas, gift, zoom]) if (el) { el.style.transform = ''; el.style.top = ''; el.style.bottom = ''; el.style.left = ''; el.style.transformOrigin = ''; }
  const vis = el => el && !el.hidden && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  const R = el => el.getBoundingClientRect();
  const cruza = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const cruzaX = (a, b) => a.left < b.right - 1 && b.left < a.right - 1;
  const H = innerHeight, M = 4;
  // zoom encostado na barra de ferramentas: sobe para cima dela
  for (const b of baixo) if (vis(b) && vis(zoom) && cruza(R(zoom), R(b))) { zoom.style.top = 'auto'; zoom.style.bottom = `${H - R(b).top + M}px`; }
  const coluna = el => getComputedStyle(el).display === 'grid';
  // limite de baixo de uma coluna: o primeiro obstáculo abaixo dela que ocupa a mesma faixa
  const limite = (x, topo, obst) => obst.filter(vis).map(R).filter(r => cruzaX(r, x) && r.top > topo).reduce((m, r) => Math.min(m, r.top - M), H - M);
  const encaixa = (els, origem, obst) => {
    els = els.filter(vis); if (!els.length) return;
    const top0 = R(els[0]).top, faixa = els.map(R).reduce((a, r) => ({ left: Math.min(a.left, r.left), right: Math.max(a.right, r.right) }), { left: 1e9, right: -1e9 });
    const fundo = limite(faixa, top0, obst), alto = R(els[els.length - 1]).bottom - top0;
    const k = Math.max(0.45, Math.min(1, (fundo - top0) / alto));
    if (k >= 1) return;
    let y = top0;
    for (const el of els) {
      const h = R(el).height;
      el.style.transformOrigin = origem; el.style.transform = `scale(${k})`;
      el.style.top = `${y}px`; y += h * k + 6 * k;
    }
  };
  // coluna da esquerda (lugares + presente/mover) começa abaixo do cartão do jogador
  if (coluna(cenas)) {
    if (vis(player) && cruzaX(R(player), R(cenas)) && R(cenas).top < R(player).bottom + M) cenas.style.top = `${R(player).bottom + M}px`;
    if (vis(gift)) gift.style.top = `${R(cenas).bottom + 6}px`;
    encaixa([cenas, gift], 'top left', [zoom, ...baixo]);
  } else if (vis(gift)) {
    // celular em pé: lugares e presente lado a lado embaixo
    gift.style.left = `${R(cenas).right + M}px`;
  }
  // menu da direita começa abaixo dos botões de salvar e configurações
  if (coluna(menu)) {
    if (vis(topo) && cruzaX(R(topo), R(menu)) && R(menu).top < R(topo).bottom + M) menu.style.top = `${R(topo).bottom + M}px`;
    encaixa([menu], 'top right', [zoom, ...baixo]);
  } else if (vis(topo) && R(menu).top < R(topo).bottom + M) menu.style.top = `${R(topo).bottom + M}px`;
}
addEventListener('resize', pedirFitHud);
function renderTools() {
  const box = $('#tools'), hint = $('#sceneHint');
  box.hidden = scene !== 'roca';
  hint.hidden = scene === 'roca';
  hint.textContent = scene === 'animais'
    ? (isHome() ? 'Clique num animal para alimentar, recolher ou vender. Clique num abrigo para aumentar ou para construir um novo. No Modo Mover dá para arrastar os abrigos para outro canto do rancho.' : 'Dê comida aos animais com fome para ajudar. Produto pronto dá para pegar um pouquinho.')
    : (isHome() ? 'Os espaços com + são lugares para decoração. Cada peça dá conforto, e conforto aumenta o XP que você ganha. Gato, tartaruga e arara moram aqui: clique neles para fazer carinho.' : 'Esta é a casa do seu vizinho.');
  box.innerHTML = '';
  availTools().forEach((t, k) => {
    const b = document.createElement('button');
    b.className = 'roundbtn tool'; b.type = 'button';
    b.setAttribute('aria-pressed', String(state.tool === t.id));
    const icon = t.id === 'seed' ? `<img alt="" src="${cropIcon(state.seed)}">`
      : t.id === 'fert' ? `<img alt="" src="${fertIcon(state.fertSel)}">` : TOOL_ICONS[t.id];
    const label = t.id === 'seed' ? CROP[state.seed].nome
      : t.id === 'fert' ? `${FERT[state.fertSel].curto} ×${state.fert[state.fertSel] || 0}` : t.nome;
    b.innerHTML = `<span class="ic">${icon}</span><span class="lb">${label}</span>`;
    b.title = (t.id === 'hand' ? 'Faz a ação certa: colhe, rega, tira pragas, planta' : t.nome) + ` (tecla ${k + 1})`;
    b.addEventListener('click', () => setTool(t.id));
    box.appendChild(b);
  });
  if (scene === 'roca' && isHome() && !isGated()) {
    const b = document.createElement('button');
    b.className = 'roundbtn tool'; b.type = 'button'; b.id = 'rasteloBtn';
    b.innerHTML = `<span class="ic">${TOOL_ICONS.rastelo}</span><span class="lb">Rastelar</span>`;
    b.title = 'Manda o avatar rastelar as folhas espalhadas';
    b.addEventListener('click', irRastelar);
    box.appendChild(b);
    atualizarRastelo();
    const c = document.createElement('button');
    c.className = 'roundbtn tool'; c.type = 'button'; c.id = 'colherBtn';
    c.innerHTML = `<span class="ic">🚜</span><span class="lb">Colher</span>`;
    c.title = 'Colheita e limpeza automáticas';
    c.addEventListener('click', e => abrirMenuColher(e.currentTarget));
    box.appendChild(c);
    atualizarColher();
  }
}
// Atualiza o texto do botão de rastelar folhas sem recriar o #tools inteiro (evita perder a rolagem/seleção a cada tick).
// Fica sempre clicável: sem folha nenhuma, o clique mostra um aviso (ver irRastelar) em vez de só desabilitar o botão.
function atualizarRastelo() {
  const b = $('#rasteloBtn'); if (!b) return;
  const n = folhasDe().filter(f => !f.alvo).length;
  const key = 'folhas:' + n;
  if (b.dataset.key === key) return;
  b.dataset.key = key;
  b.querySelector('.lb').textContent = n ? `Rastelar (${n})` : 'Rastelar';
}
// Atualiza o texto do botão de colheita rápida sem recriar o #tools inteiro.
function atualizarColher() {
  const b = $('#colherBtn'); if (!b) return;
  const n = state.plots.filter(ripe).length + fruteirasProntas().length;
  const key = 'colher:' + n;
  if (b.dataset.key === key) return;
  b.dataset.key = key;
  b.querySelector('.lb').textContent = n ? `Colher (${n})` : 'Colher';
}
// Menu do botão 🚜: escolher entre colheita automática (canteiros prontos) e limpeza automática (terra seca).
function abrirMenuColher(btn) {
  const m = $('#ctxMenu'), r = btn.getBoundingClientRect();
  const nColher = state.plots.filter(ripe).length + fruteirasProntas().length, nLimpar = state.plots.filter(p => p.s === 'withered').length;
  m.innerHTML = `<b>Ações automáticas</b><button type="button" data-ctx="colher">🧺 Colheita automática${nColher ? ` (${nColher})` : ''}</button><button type="button" data-ctx="limpar">🧹 Limpeza automática de terras${nLimpar ? ` (${nLimpar})` : ''}</button><button type="button" data-ctx="fechar">Cancelar</button>`;
  m.dataset.key = ''; m.hidden = false;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${clamp(r.left + r.width / 2 - w / 2, 6, L.cw - w - 6)}px`; m.style.top = `${clamp(r.top - h - 10, 6, L.ch - h - 6)}px`;
  sfx('click');
}
function setTool(id) {
  if (!isHome() && HOME_ONLY.includes(id)) return;
  // Clicar de novo no Adubo já selecionado troca pro próximo tipo (básico → rápido → premium → básico…).
  if (id === 'fert' && state.tool === 'fert') {
    const idx = FERTS.findIndex(f => f.id === state.fertSel);
    state.fertSel = FERTS[(idx + 1) % FERTS.length].id;
  }
  state.tool = id; renderTools(); renderPane();
}
function setScene(sc) {
  if (sc !== scene) { L.pan = { x: 0, y: 0 }; if (moving && !moving.novo) moving = null; }
  scene = sc; hover = null; renderZoom();
  if (sc === 'casa' && moveMode) { moveMode = false; moving = null; }
  renderMoveBtn();
  document.querySelectorAll('#scenes button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.scene === sc)));
  renderTools(); renderSceneInfo(); pedirFitHud();
}

// ---------- Foto de perfil: a do Google, ou um selo colorido da Roça Feliz (alguns você libera jogando) ----------
const FOTOS_PERFIL = [
  { id: 'ovo',        nome: 'Ovo',         emoji: '🥚', bg: ['#fff6da', '#ffcf5c'] },
  { id: 'milho',      nome: 'Milho',       emoji: '🌽', bg: ['#fff3b0', '#e0a010'] },
  { id: 'vaca',       nome: 'Vaca',        emoji: '🐄', bg: ['#ffffff', '#e8a8b8'] },
  { id: 'cao',        nome: 'Cachorro',    emoji: '🐶', bg: ['#ffe4b8', '#b8763a'] },
  { id: 'galinha',    nome: 'Galinha',     emoji: '🐔', bg: ['#ffd9ad', '#d8402f'] },
  { id: 'girassol',   nome: 'Girassol',    emoji: '🌻', bg: ['#fff3b0', '#e07a1a'] },
  { id: 'morango',    nome: 'Morango',     emoji: '🍓', bg: ['#ffd0dd', '#c81f42'] },
  { id: 'cavalo',     nome: 'Cavalo',      emoji: '🐴', bg: ['#ead6ac', '#7a4a22'] },
  { id: 'peixe',      nome: 'Peixe',       emoji: '🐟', bg: ['#c8ecf7', '#256fa0'] },
  { id: 'javali',     nome: 'Javali',      emoji: '🐗', bg: ['#dcecc0', '#3f5e1e'], requer: () => !!(state.caca && state.caca.col && state.caca.col.javali), dica: 'Caçe um javali' },
  { id: 'abelha',     nome: 'Abelha',      emoji: '🐝', bg: ['#fff3b0', '#2a2410'], requer: () => !!(state.abrigos && state.abrigos.apiario), dica: 'Construa o Apiário' },
  { id: 'estrela',    nome: 'Estrela',     emoji: '⭐', bg: ['#e6dcff', '#4a2f8a'], requer: () => state.level >= 20, dica: 'Chegue ao nível 20' },
  { id: 'trevo',      nome: 'Trevo',       emoji: '🍀', bg: ['#d4f5c0', '#256a20'], requer: () => ((state.trevos && state.trevos.saldo) || 0) >= 20, dica: 'Tenha 20 trevos 🍀' },
  { id: 'chupacabra', nome: 'Chupa-cabra', emoji: '🦇', bg: ['#c8b0e6', '#241634'], requer: () => !!(state.caca && state.caca.trofeu), dica: 'Pegue o lendário Chupa-cabra' },
  { id: 'alien',      nome: 'Alienígena',  emoji: '👽', bg: ['#c0f0d8', '#0f3a2e'] },
];
const FOTO_PERFIL = Object.fromEntries(FOTOS_PERFIL.map(f => [f.id, f]));
function fotoIconUrl(f) {
  return makeIcon('foto2:' + f.id, () => {
    const g = ctx.createRadialGradient(40, 32, 4, 48, 48, 66);
    g.addColorStop(0, f.bg[0]); g.addColorStop(1, f.bg[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(48, 48, 48, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(33, 26, 19, 11, -0.4, 0, 7); ctx.fill();
    ctx.font = '58px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(f.emoji, 48, 55);
  });
}
for (const f of FOTOS_PERFIL) f.icon = () => fotoIconUrl(f);
const fotoLiberada = f => !f.requer || f.requer();
// A foto que EU mostro agora: o selo escolhido (se já liberado) ou a foto do Google.
const fotoAtual = () => {
  const f = state && state.fotoPerfil && FOTO_PERFIL[state.fotoPerfil];
  if (f && fotoLiberada(f)) return f.icon();
  return (user && user.photo) || '';
};
// O que salvar/mandar pra nuvem: um link de verdade, ou "icone:xxx" pra um amigo saber desenhar o selo certo.
const fotoParaSalvar = () => {
  const f = state && state.fotoPerfil && FOTO_PERFIL[state.fotoPerfil];
  return f && fotoLiberada(f) ? 'icone:' + f.id : ((user && user.photo) || '');
};
// Transforma o que veio de um amigo (link ou "icone:xxx") numa src de <img> de verdade.
const resolveFoto = src => {
  if (!src) return '';
  if (src.startsWith('icone:')) { const f = FOTO_PERFIL[src.slice(6)]; return f ? f.icon() : ''; }
  return src;
};
function renderFotosCfg() {
  const box = $('#fotosCfg'); if (!box || !state) return;
  const sel = state.fotoPerfil || '';
  const opcoes = [];
  if (user && user.photo) opcoes.push(`<button type="button" class="fotobtn" data-foto="" aria-pressed="${!sel}"><img alt="" referrerpolicy="no-referrer" src="${esc(user.photo)}"><small>Do Google</small></button>`);
  for (const f of FOTOS_PERFIL) {
    opcoes.push(fotoLiberada(f)
      ? `<button type="button" class="fotobtn" data-foto="${f.id}" aria-pressed="${sel === f.id}"><img alt="" src="${f.icon()}"><small>${esc(f.nome)}</small></button>`
      : `<button type="button" class="fotobtn trava" disabled title="🔒 ${esc(f.dica || '')}"><img alt="" src="${f.icon()}" style="opacity:.4"><small>🔒 ${esc(f.nome)}</small></button>`);
  }
  box.innerHTML = opcoes.join('');
  renderMolduraCfg();
}
// ---------- Moldura da foto: um anel decorativo ao redor da foto (algumas exclusivas) ----------
const MOLDURAS = [
  { id: '',         nome: 'Nenhuma' },
  { id: 'campo',     nome: 'Campo' },
  { id: 'ceu',       nome: 'Céu' },
  { id: 'sol',       nome: 'Pôr do sol' },
  { id: 'flor',      nome: 'Flor',       requer: () => state.level >= 5,  dica: 'Chegue ao nível 5' },
  { id: 'girassol',  nome: 'Girassol',   requer: () => state.level >= 10, dica: 'Chegue ao nível 10' },
  { id: 'lavanda',   nome: 'Lavanda',    requer: () => state.level >= 15, dica: 'Chegue ao nível 15' },
  { id: 'borboleta', nome: 'Borboleta',  requer: () => state.level >= 22, dica: 'Chegue ao nível 22' },
  { id: 'arcoiris',  nome: 'Arco-íris',  requer: () => state.level >= 30, dica: 'Chegue ao nível 30' },
  { id: 'pioneiro',  nome: 'Pioneiro',   requer: () => !!(state.molduras && state.molduras.pioneiro), dica: 'Exclusiva de quem jogou no primeiro mês' },
];
const MOLDURA = Object.fromEntries(MOLDURAS.map(m => [m.id, m]));
// A moldura escolhida (só vale se ainda estiver liberada); '' = nenhuma.
const molduraAtual = () => {
  const id = state && state.molduraSel;
  const m = id != null && MOLDURA[id];
  return m && (!m.requer || m.requer()) ? id : '';
};
function renderMolduraCfg() {
  const box = $('#molduraCfg'); if (!box || !state) return;
  const sel = molduraAtual();
  box.innerHTML = MOLDURAS.map(m => (!m.requer || m.requer())
    ? `<button type="button" class="fotobtn moldurabtn ${m.id ? 'moldura-' + m.id : ''}" data-moldura="${m.id}" aria-pressed="${sel === m.id}"><span class="molduraprev"></span><small>${esc(m.nome)}</small></button>`
    : `<button type="button" class="fotobtn trava" disabled title="🔒 ${esc(m.dica || '')}"><span class="molduraprev"></span><small>🔒 ${esc(m.nome)}</small></button>`
  ).join('');
}
function escolherMoldura(id) {
  const m = id ? MOLDURA[id] : MOLDURA[''];
  if (id && (!m || (m.requer && !m.requer()))) return;
  state.molduraSel = id || '';
  renderMolduraCfg(); renderHUD(); renderAccount(); done(); sfx('click');
}
function escolherFoto(id) {
  const f = id ? FOTO_PERFIL[id] : null;
  if (id && (!f || !fotoLiberada(f))) return;
  state.fotoPerfil = id || null;
  renderFotosCfg(); renderHUD(); renderAccount(); done(); sfx('click');
}
function renderHUD() {
  $('#lvl').textContent = state.level;
  const n = need(state.level);
  $('#xptxt').textContent = `${state.xp} / ${n}`;
  $('#xpbar').style.width = `${Math.min(100, state.xp / n * 100)}%`;
  $('#coins').textContent = state.coins.toLocaleString('pt-BR');
  $('#trevos').textContent = (state.trevos && state.trevos.saldo) || 0;
  const nome = state.apelido || (user ? firstName(user.name) : 'Roça Feliz');
  if ($('#pname').textContent !== nome) $('#pname').textContent = nome;
  const foto = fotoAtual();
  const face = foto ? `<img alt="" referrerpolicy="no-referrer" src="${esc(foto)}">` : esc(user ? nome[0] : '☺');
  if ($('#face').dataset.k !== face) { $('#face').innerHTML = face; $('#face').dataset.k = face; }
  const ring = $('#face').closest('.avatar-ring');
  if (ring) { for (const m of MOLDURAS) if (m.id) ring.classList.remove('moldura-' + m.id); const sel = molduraAtual(); if (sel) ring.classList.add('moldura-' + sel); }
}

function renderPenActions() {
  const el = $('#penActions');
  if (!el) return;
  const show = scene === 'animais' && isHome() && !isGated();
  el.hidden = !show;
  if (!show) return;
  const hungry = state.animals.filter(isHungry), ready = state.animals.filter(a => ANIMAL[a.k].tipo === 'prod' && a.ready);
  const cost = hungry.reduce((t, a) => t + ANIMAL[a.k].racao, 0);
  const key = hungry.length + ':' + cost + ':' + ready.length;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.innerHTML = `<button class="btn" type="button" data-feed-all ${hungry.length ? '' : 'disabled'} aria-label="Alimentar todos${hungry.length ? ` (${hungry.length}) por ${cost} moedas` : ''}">Alimentar<span class="wide"> todos</span>${hungry.length ? ` (${hungry.length}) · <span class="coin"></span>${cost.toLocaleString('pt-BR')}` : ''}</button>
    <button class="btn gold" type="button" data-collect-all ${ready.length ? '' : 'disabled'}>Recolher<span class="wide"> tudo</span>${ready.length ? ` (${ready.length})` : ''}</button>`;
}
// Manda o avatar rastelar o monte de folhas mais perto (ou avisa se não tiver nenhum).
function irRastelar() {
  if (!isHome() || scene !== 'roca') return;
  const livres = folhasDe().filter(f => !f.alvo);
  if (!livres.length) return toast('Não tem nenhuma folha pra rastelar agora. 🍂');
  const w = avWalk['roca:eu'];
  if (w && w.tarefa) return toast('Calma: o avatar ainda está rastelando o outro monte!');
  let alvo = livres[0], melhorDist = Infinity;
  if (w) for (const f of livres) { const d = Math.hypot(f.u - w.fu, f.v - w.fv); if (d < melhorDist) { melhorDist = d; alvo = f; } }
  rastelarFolhas(alvo.id);
}
function renderSceneInfo() {
  renderPenActions();
  if (scene === 'roca') { atualizarRastelo(); atualizarColher(); }
  const s = S(), el = $('#sceneInfo');
  const est = estacao(), owner = `${est.icone} ${est.nome}${raining() ? (est.neve ? ' · nevando' : ' · chovendo') : ''} · ` + (isHome() ? `${minhaFazenda()} · ` : `${deQuem(view)} (nível ${view.nivel}) · `);
  if (scene === 'roca') { const n = s.plots.filter(p => p.s !== 'locked').length; el.textContent = owner + `${n}${isHome() ? ` de ${Math.max(n, allowedLots())}` : ''} canteiros`; }
  else if (scene === 'animais') {
    const cap = ABRIGOS.reduce((t, b) => t + ABRIGO_CAP[abrigoLv(s, b.id)], 0);
    el.textContent = owner + `${s.animals.filter(inPen).length}${isHome() ? ` de ${cap}` : ''} animais`;
  }
  else el.textContent = owner + `Conforto ${comfort(s)} · +${comfort(s)}% de XP`;
}

function renderAccount() {
  if (state) renderHUD();
  const el = $('#account');
  if (!Cloud.available) { el.innerHTML = '<span class="acct-note">Salvo neste navegador</span>'; return; }
  if (cloudStatus === 'loading') { el.innerHTML = '<span class="acct-note">Conectando…</span>'; return; }
  if (user) {
    const foto = fotoAtual(), sel = molduraAtual(), moldura = sel ? ' moldura-' + sel : '';
    el.innerHTML = `${foto ? `<img class="${moldura.trim()}" alt="" referrerpolicy="no-referrer" src="${esc(foto)}">` : ''}
      <span class="who"><span>${esc(firstName(user.name))}</span><small>${esc(syncStatus)}</small></span>
      <button class="btn ghost" type="button" data-logout>Sair</button>`;
    return;
  }
  el.innerHTML = `<button class="gbtn" type="button" data-login>${GOOGLE_G}Entrar com Google</button>`;
}
$('#account').addEventListener('click', e => {
  if (e.target.closest('[data-login]')) { closeSettings(); login(); }
  if (e.target.closest('[data-logout]')) { closeSettings(); logout(); }
});
function login() {
  if (!Cloud.available) return;
  if (isGated()) showGate('login', 'Esperando o Google…');
  Cloud.signIn().catch(e => {
    if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) {
      if (isGated()) showGate('login');
      return;
    }
    console.warn(e);
    const why = e && e.code === 'auth/unauthorized-domain'
      ? 'Este endereço ainda não foi autorizado no Firebase (Authentication > Configurações > Domínios autorizados).'
      : 'Não deu para entrar com o Google agora. Tente de novo.';
    if (isGated()) showGate('login', why); else toast(why, 'bad');
  });
}
async function logout() {
  save();
  if (dirty) await cloudSave();
  showGate('loading', 'Saindo…');
  try { await Cloud.signOut(); } catch (e) { console.warn(e); showGate('login'); }
}

let resetArmed = false, unfriendArmed = null;
function renderTabs() {
  const setBadge = (el, n, label) => {
    if (!el) return;
    const o = el.querySelector('.badge');
    if (o && o.textContent === String(n)) return;
    if (o) o.remove();
    if (n) el.insertAdjacentHTML('beforeend', `<span class="badge" aria-label="${n} ${label}">${n}</span>`);
  };
  const unread = state ? state.news.filter(n => n.at > state.newsSeen).length : 0;
  setBadge(document.querySelector('.tab[data-tab="amigos"]'), requests.length + naoLidas() + amigosPedindo().length, 'pedidos de amizade, mensagens e amigos pedindo ajuda');
  setBadge(document.querySelector('.tab[data-tab="correio"]'), unread, 'cartas novas');
  const visitando = !isHome();
  if (state && visitando) {
    // na roça de outra pessoa só importa o que tem na banca dela
    for (const t of ['celeiro', 'inventario']) setBadge(document.querySelector(`.tab[data-tab="${t}"]`), 0, '');
    const nb = view.data && Array.isArray(view.data.banca) ? view.data.banca.length : 0;
    setBadge(document.querySelector('.tab[data-tab="fabrica"]'), nb, 'itens na banca');
  } else if (state) {
    setBadge(document.querySelector('.tab[data-tab="celeiro"]'), avisoItens('celeiro') ? Object.values(state.barn).reduce((t, q) => t + (q > 0 ? q : 0), 0) : 0, 'itens no celeiro');
    setBadge(document.querySelector('.tab[data-tab="inventario"]'), avisoItens('inventario') ? state.invNovos || 0 : 0, 'coisas novas no inventário');
    setBadge(document.querySelector('.tab[data-tab="fabrica"]'), prontosFab() + entregaveis(), 'coisas prontas, disponíveis pra fazer na fábrica, ou pedidos para entregar');
  }
  const mb = document.querySelector('.tab[data-tab="missoes"]'), mn = missoesProntas();
  setBadge(mb, mn, 'prêmios');
  renderGiftBtn();
  // Avisos nos botões Roça e Rancho: quantas coisas estão prontas para colher ou recolher.
  if (state) {
    const prontos = visitando ? { roca: 0, animais: 0 } : { roca: state.plots.filter(p => ripe(p)).length,
      animais: state.animals.filter(a => (ANIMAL[a.k].tipo === 'prod' && a.ready) || isAdult(a)).length };
    for (const [sc, n] of Object.entries(prontos)) {
      const b = document.querySelector(`#scenes [data-scene="${sc}"]`); if (!b) continue;
      const k = String(n), o = b.querySelector('.badge');
      if (o && o.textContent === k) continue;
      if (o) o.remove();
      if (n) b.insertAdjacentHTML('beforeend', `<span class="badge ready" aria-label="${n} ${sc === 'roca' ? 'para colher' : 'para recolher ou vender'}">${n}</span>`);
    }
  }
}
// Preço nos botões da loja: ícone de moeda + valor (e a quantidade, quando tem).
const moeda = (n, q) => `${q ? `<span class="qtd">×${q}</span>` : ''}<span class="coin" aria-hidden="true"></span>${n.toLocaleString('pt-BR')}`;
// Os cachorros que você tem (roça e rancho): raça, nome, ração, vida, trocar o nome. Usado na Loja e na casinha.
function caesHTML(naLoja) {
  let html = '';
  for (const slot of ['roca', 'animais']) {
    const d = state.dogs[slot];
    if (!d) { html += `<div class="row"><div class="avatar" style="background:#b7b39c">?</div><div><div class="name">${slot === 'roca' ? 'Roça' : 'Rancho'} sem cachorro</div><div class="meta">${naLoja ? 'Escolha uma raça aqui embaixo.' : 'Compre um na Loja › Cães.'}</div></div>${naLoja ? '<div></div>' : `<button class="btn ghost" data-ir-caes="1">Ver raças</button>`}</div>`; continue; }
    const b = DOG[d.raca], awake = dogAwake(d), dias = Math.max(1, Math.ceil((d.born + b.vida * DAY - Date.now()) / DAY));
    const armed = buyPending && buyPending.i === 'vendaDog' + slot && performance.now() < buyPending.until;
    html += `<div class="row ${awake ? '' : 'sel'}"><img alt="" src="${dogIcon(d.raca)}">
      <div><div class="name">${esc(d.nome)} · ${slot === 'roca' ? 'roça' : 'rancho'}</div>
      <div class="meta">Raça: <b>${b.nome}</b> · vive mais ${dias} ${dias > 1 ? 'dias' : 'dia'}<br>${awake ? `Acordado · ração por mais ${fmt((d.fedUntil - Date.now()) / 1000)}` : '<b>Dormindo de fome!</b> Não está vigiando.'}</div></div>
      <div class="stack">${awake ? '' : `<button class="btn" data-feed-dog="${slot}">Dar ração</button>`}<button class="btn ghost" data-renomear-dog="${slot}">Trocar nome<br><small>${moeda(CUSTO_NOME_BICHO)}</small></button>
      <button class="btn ${armed ? 'danger' : 'ghost'}" data-sell-dog="${slot}" title="Vender">${armed ? 'Confirmar' : 'Vender ' + moeda(dogSellPrice(d))}</button></div></div>`;
  }
  html += `<div class="row"><img alt="" src="${bowlIcon()}">
    <div><div class="name">Ração de cachorro</div><div class="meta">${DOG_FOOD.custo} moedas · dura ${DOG_FOOD.horas}h · você tem <b>${state.dogFood}</b></div></div>
    <div class="stack"><button class="btn" data-dog-food="1" ${state.coins < DOG_FOOD.custo ? 'disabled' : ''}>${moeda(DOG_FOOD.custo, 1)}</button>
    <button class="btn ghost" data-dog-food="3" ${state.coins < DOG_FOOD.custo * 3 ? 'disabled' : ''}>${moeda(DOG_FOOD.custo * 3, 3)}</button></div></div>`;
  return html;
}
// Temas da casa e do celeiro: os que você tem (Usar) e os da loja (Comprar). Aparece ao clicar na casa e na Loja › Temas.
const casaTemaIcon = id => makeIcon('casatema:' + id, () => { ctx.save(); drawBarn(62, 86, 50, id); drawHouse(34, 90, 52, null, id); ctx.restore(); });
function casaTemasHTML() {
  const atual = TEMA_CASA[state.skin] ? state.skin : 'classico';
  return TEMAS_CASA.filter(t => !t.especial || state.skins[t.id]).map(t => {
    const tem = t.id === 'classico' || state.skins[t.id], usando = atual === t.id, trava = !tem && t.nivel > state.level;
    const btn = usando ? '<button class="btn ghost" disabled>Em uso</button>'
      : tem ? `<button class="btn" data-casa-tema="${t.id}">Usar</button>`
      : t.trevo ? `<button class="btn ghost" data-abrir-trevos="1">🍀 ${t.trevo}</button>`
      : trava ? `<button class="btn" disabled>Nível ${t.nivel}</button>`
      : `<button class="btn gold" data-casa-tema="${t.id}" ${state.coins < t.custo ? 'disabled' : ''}>${moeda(t.custo)}</button>`;
    return `<div class="row ${usando ? 'sel' : ''} ${trava ? 'locked' : ''}"><img alt="" src="${casaTemaIcon(t.id)}">
      <div><div class="name">${t.nome}${t.especial ? ' <span class="tag">⭐ pioneiros</span>' : ''}</div><div class="meta">${t.desc}${tem && !usando ? ' · <b>já é seu</b>' : ''}</div></div>${btn}</div>`;
  }).join('');
}
function usarCasaTema(id) {
  const t = TEMA_CASA[id]; if (!t) return;
  const tem = id === 'classico' || state.skins[id];
  if (!tem) {
    if (t.especial) return;
    if (t.trevo) return openPanel('loja', 'trevo');
    if (state.level < t.nivel) return toast(`${t.nome} libera no nível ${t.nivel}.`, 'bad');
    if (state.coins < t.custo) { sfx('error'); return toast(`${t.nome} custa ${t.custo.toLocaleString('pt-BR')} moedas.`, 'bad'); }
    return confirmTwice('casatema' + id, `Comprar o tema ${t.nome} por ${t.custo.toLocaleString('pt-BR')} moedas? Toque de novo para confirmar.`, () => {
      state.coins -= t.custo; state.skins[id] = true; state.skin = id; sfx('buy');
      toast(`🏡 ${t.nome}: sua casa e seu celeiro ficaram de cara nova!`, 'good'); done(); renderPane();
    });
  }
  state.skin = id === 'classico' ? null : id; sfx('click');
  toast(`🏡 Tema ${t.nome} na casa e no celeiro!`, 'good'); done(); renderPane();
}
const TAB_NAMES = { casaTemas: 'Sua casa', canil: 'Casinha do cachorro',  loja: 'Loja', celeiro: 'Celeiro', terreno: 'Terreno', amigos: 'Amigos', missoes: 'Missões', correio: 'Correio', fabrica: 'Negócios', inventario: 'Inventário', chocadeira: 'Chocadeira' };
// A janela abre por cima do jogo. Clicar de novo no mesmo botão fecha.
function openPanel(t, seg, focus) {
  tab = t; if (seg) shopSeg = seg;
  $('#panel').hidden = false;
  renderPane(); $('#pane').scrollTop = 0;
  if (t === 'amigos') { vigiarPresenca(); checkSent(); if (Date.now() - ultimaRecup > 60000) { ultimaRecup = Date.now(); recuperarAmigos(); } }
  if (focus) focusRow('abrigo-' + focus);
}
function closePanel() { $('#panel').hidden = true; renderPane(); }
function focusRow(id) {
  const el = document.getElementById(id); if (!el) return;
  el.scrollIntoView({ block: 'center' }); el.classList.add('flash');
}
function chocadeiraHTML() {
  let html = '';
    html += `<h3>Chocadeira 🐣</h3>`;
    html += `<p class="hint">Cada espécie precisa de um casal (2 animais) alimentado. Aves (e avestruzes) põem ovos aqui; mamíferos têm o filhote direto no abrigo. O tempo depende da espécie: de 1 dia (galinhas, patos, coelhos…) a 5 dias (a rara onça-pintada).</p>`;
    for (const k of reproEspecies()) {
      if (!state.animals.some(a => a.k === k)) continue;
      html += `<div class="row"><img alt="" src="${animalIcon(k)}"><div><div class="name">${ANIMAL[k].nome}</div><div class="meta">${reproTexto(k)}</div></div><div></div></div>`;
    }
    if (!state.chocadeira || !state.chocadeira.ovos || !state.chocadeira.ovos.length) {
      html += `<div class="empty">A chocadeira está vazia.<br>Aves bem-alimentadas botam ovos para incubar. Mamíferos têm o filhote direto, sem ovo.</div>`;
    } else {
      html += `<p class="hint">Ovos levam 24 horas para incubar. Filhotes nascem automaticamente se houver vaga no abrigo.</p>`;
      const agora = Date.now();
      for (const ovo of state.chocadeira.ovos) {
        const tempoRestante = ovo.nascimento - agora;
        const porcentagem = Math.max(0, Math.min(100, 100 - (tempoRestante / (24 * HOUR)) * 100));
        const animalData = ANIMAL[ovo.especie];

        html += `<div class="row"><img alt="" src="${animalIcon(ovo.especie)}">
          <div><div class="name">Ovo de ${animalData.nome.toLowerCase()}</div>
          <div class="meta">${tempoRestante > 0 ? `Nasce em ${fmt(tempoRestante / 1000)}` : '<b>Pronto para nascer!</b>'}</div>
          <div class="mbar"><i style="width:${porcentagem}%"></i></div></div>
          <div></div></div>`;
      }
      html += `<div class="row"><div class="avatar" style="background:#5a646c">🥚</div>
        <div><div class="name">Total de ovos</div><div class="meta">${state.chocadeira.ovos.length} de 20</div></div></div>`;
    }
  return html;
}
function renderPane() {
  const open = !$('#panel').hidden;
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(open && b.dataset.tab === tab)));
  $('#panelTitle').textContent = tab === 'abrigo' && abrigoSel ? ABRIGO[abrigoSel].nome : TAB_NAMES[tab];
  if (!open) return;
  const pane = $('#pane');
  let html = '';
  if (tab === 'abrigo') html = abrigoHTML();
  else if (tab === 'casaTemas') html = `<div class="row"><img alt="" src="${casaTemaIcon(TEMA_CASA[state.skin] ? state.skin : 'classico')}"><div><div class="name">Entrar na casa</div><div class="meta">Decore a sala e faça carinho nos bichinhos.</div></div><button class="btn gold" data-entrar-casa="1">Entrar 🏠</button></div>
    <h3>Temas da casa e do celeiro</h3><p class="hint">O tema muda a casa e o celeiro juntos. Os amigos veem quando visitam.</p>` + casaTemasHTML();
  else if (tab === 'canil') html = `<p class="hint">Seus cachorros vigiam a roça e o rancho. Aqui você vê a raça, o nome e a ração de cada um, e pode trocar o nome.</p>` + caesHTML(false);
  else if (tab === 'inventario') html = inventarioHTML();
  else if (tab === 'missoes') html = missoesHTML();
  else if (tab === 'fabrica') html = fabricaHTML();
  else if (tab === 'loja') {
    const segs = [['sementes', 'Sementes'], ['pomar', 'Pomar'], ['adubo', 'Itens'], ['animais', 'Animais'], ['abrigos', 'Abrigos'], ['caes', 'Cães'], ['decor', 'Casa'], ['enfeites', 'Enfeites'], ['temas', 'Temas'], ['trevo', '🍀 Trevo']];
    html += `<div class="seg small" role="tablist">${segs.map(([id, n]) => `<button type="button" role="tab" data-seg="${id}" aria-selected="${shopSeg === id}">${n}</button>`).join('')}</div>`;
    if (shopSeg === 'sementes') {
      html += `<p class="hint">Escolha uma semente e clique na terra arada para plantar. Cada semente vale para um canteiro e é cobrada no plantio.</p>`;
      const shown = CROPS.filter(c => c.nivel <= state.level);
      const upcoming = CROPS.filter(c => c.nivel > state.level);
      for (const c of [...shown, ...upcoming.slice(0, 2)]) {
        const locked = c.nivel > state.level, sel = state.seed === c.id && state.tool === 'seed';
        const total = c.rend * c.preco;
        const meta = `Semente ${c.custo.toLocaleString('pt-BR')} · ${fmt(c.tempo)}<br>rende ${faixa(c)} × ${c.preco} · lucro médio ${(total - c.custo).toLocaleString('pt-BR')} · ${c.xp} XP`;
        html += `<div class="row ${locked ? 'locked' : ''} ${sel ? 'sel' : ''}">
          <img alt="" src="${cropIcon(c.id)}">
          <div><div class="name">${c.nome}${daEstacao(c.id) ? ` <span class="tag">${estacao().icone} da estação +${Math.round(ESTACAO_BONUS * 100)}%</span>` : ''}</div><div class="meta">${meta}</div></div>
          ${locked ? `<button class="btn" disabled>Nível ${c.nivel}</button>` : `<button class="btn ${sel ? 'gold' : ''}" data-seed="${c.id}" aria-label="${sel ? 'Na mão' : `Escolher ${c.nome} por ${c.custo} moedas`}">${sel ? 'Na mão' : moeda(c.custo)}</button>`}
        </div>`;
      }
      if (upcoming.length > 2) html += `<p class="hint">Mais ${upcoming.length - 2} plantações liberam nos próximos níveis, até o nível ${upcoming[upcoming.length - 1].nivel}.</p>`;
    } else if (shopSeg === 'adubo') {
      html += `<div class="row ${state.armadilha ? 'sel' : state.level < ARMADILHA.nivel ? 'locked' : ''}"><div class="avatar" style="background:#5a646c;font-size:24px">🪤</div>
        <div><div class="name">Armadilha de pragas</div><div class="meta">Fica perto da plantação e pega o rato ou javali que invadir (um por vez, e dá a recompensa). Depois recarrega em ${fmt(ARMADILHA.recarga / 1000)}.${state.armadilha ? ` ${armadilhaPronta() ? '<b>Carregada.</b>' : `Pronta em ${fmt((state.armadilha.pronta - Date.now()) / 1000)}.`}` : ''}</div></div>
        ${state.armadilha ? '<button class="btn ghost" disabled>Sua</button>' : state.level < ARMADILHA.nivel ? `<button class="btn" disabled>Nível ${ARMADILHA.nivel}</button>` : `<button class="btn" data-comprar-armadilha="1" ${state.coins < ARMADILHA.custo ? 'disabled' : ''}>${moeda(ARMADILHA.custo)}</button>`}</div>`;
      html += `<div class="row ${state.tools.enxada ? 'sel' : ''}"><div class="avatar" style="background:#8a5a33">${TOOL_ICONS.hoe}</div>
        <div><div class="name">Enxadão</div><div class="meta">100 moedas · limpa a terra e arranca qualquer plantação ou árvore do canteiro</div></div>
        ${state.tools.enxada ? '<button class="btn ghost" disabled>Sua</button>' : `<button class="btn" data-buy-hoe ${state.coins < 100 ? 'disabled' : ''}>${moeda(100)}</button>`}</div>`;
      html += `<div class="row"><img alt="" src="${bowlIcon()}">
        <div><div class="name">Ração especial</div><div class="meta">${RACAO_ESP} moedas · a próxima produção do animal rende em dobro. É usada quando você alimenta um animal clicando nele. Você tem <b>${state.racaoEsp}</b></div></div>
        <div class="stack"><button class="btn" data-racao-esp="1" ${state.coins < RACAO_ESP ? 'disabled' : ''}>${moeda(RACAO_ESP, 1)}</button><button class="btn ghost" data-racao-esp="5" ${state.coins < RACAO_ESP * 5 ? 'disabled' : ''}>${moeda(RACAO_ESP * 5, 5)}</button></div></div>`;
      html += `<div class="row"><img alt="" src="${potionIcon()}">
        <div><div class="name">Poção</div><div class="meta">${POCAO.custo} moedas · salva uma planta que apodreceu (ficou mais de 24h pronta sem colher). Você tem <b>${state.pocao || 0}</b></div></div>
        <div class="stack"><button class="btn" data-pocao="1" ${state.coins < POCAO.custo ? 'disabled' : ''}>${moeda(POCAO.custo, 1)}</button><button class="btn ghost" data-pocao="3" ${state.coins < POCAO.custo * 3 ? 'disabled' : ''}>${moeda(POCAO.custo * 3, 3)}</button></div></div>`;
      html += `<p class="hint">O regador é grátis. Fertilizante corta uma parte do tempo total da planta; escolha o tipo e clique numa planta com a ferramenta Adubo. Dá para usar quantos quiser na mesma planta.</p>`;
      for (const f of FERTS) {
        const locked = f.nivel > state.level, have = state.fert[f.id] || 0;
        const sel = state.tool === 'fert' && state.fertSel === f.id;
        html += `<div class="row ${locked ? 'locked' : ''} ${sel ? 'sel' : ''}">
          <img alt="" src="${fertIcon(f.id)}">
          <div><div class="name">${f.nome}</div>
          <div class="meta">Corta ${f.corta * 100}% do tempo da planta<br>${f.custo.toLocaleString('pt-BR')} moedas · você tem <b>${have}</b></div></div>
          ${locked ? `<button class="btn" disabled>Nível ${f.nivel}</button>` : `<div class="stack">
            <button class="btn" data-buy-fert="${f.id}" data-n="1" ${state.coins < f.custo ? 'disabled' : ''}>${moeda(f.custo, 1)}</button>
            <button class="btn ghost" data-buy-fert="${f.id}" data-n="5" ${state.coins < f.custo * 5 ? 'disabled' : ''}>${moeda(f.custo * 5, 5)}</button>
            ${have ? `<button class="btn ${sel ? 'gold' : 'ghost'}" data-use-fert="${f.id}">${sel ? 'Na mão' : 'Usar'}</button>` : ''}</div>`}
        </div>`;
      }
    } else if (shopSeg === 'animais') {
      html += `<p class="hint">Animais não se compram: você ganha ao subir de nível, em missões da semana, de presente de amigos (amizade nível 2+) e chocando ovos ou com a reprodução de um casal. Resgate aqui e ele vai para o abrigo, que você constrói na aba Abrigos. Sem comida o animal só para de produzir. Animais de produção vivem alguns dias; depois vão embora, então mantenha um casal para a reprodução repor.</p>`;
      const row = (d, meta, btn) => `<div class="row ${d.nivel > state.level ? 'locked' : ''}"><img alt="" src="${animalIcon(d.id)}">
        <div><div class="name">${d.nome}${(state.animalCred || {})[d.id] > 0 ? ` <span class="tag">🎁 ${state.animalCred[d.id]} para resgatar</span>` : ''}${state.animals.some(x => x.k === d.id) ? ` <span class="meta">(${state.animals.filter(x => x.k === d.id).length}${PET_MAX[d.id] ? '/' + PET_MAX[d.id] : ''})</span>` : ''}</div><div class="meta">${meta}</div></div>${btn}</div>`;
      const buyBtn = d => {
        if (d.nivel > state.level) return `<button class="btn" disabled>Nível ${d.nivel}</button>`;
        if (PET_MAX[d.id] && state.animals.filter(x => x.k === d.id).length >= PET_MAX[d.id]) return `<button class="btn ghost" disabled>Máximo (${PET_MAX[d.id]})</button>`;
        if (!((state.animalCred || {})[d.id] > 0)) return credBtn(d.id);
        const ab = d.lugar !== 'casa' && abrigoOf(d.id);
        if (ab && !abrigoLv(state, ab.id)) return `<button class="btn ghost" data-seg="abrigos" data-focus="${ab.id}">Precisa ${ab.o === 'a' ? 'da' : 'do'} ${ab.nome.toLowerCase()}</button>`;
        if (ab && vagas(state, ab.id) <= 0) return `<button class="btn ghost" data-seg="abrigos" data-focus="${ab.id}">${ab.nome} ${ab.o === 'a' ? 'cheia' : 'cheio'}</button>`;
        return credBtn(d.id);
      };
      const visible = tipo => { const l = ANIMALS.filter(d => d.tipo === tipo); const up = l.filter(d => d.nivel > state.level); return [...l.filter(d => d.nivel <= state.level), ...up.slice(0, 2)]; };
      html += `<h3>Produção</h3>`;
      for (const d of visible('prod')) {
        const prodTxt = d.prod === 'leitao' ? 'leitões (viram porquinhos no chiqueiro)' : `${PRODUCT[d.prod].nome.toLowerCase()} (vende por ${PRODUCT[d.prod].preco})`;
        html += row(d, `ração ${d.racao} por produção<br>${prodTxt} a cada ${fmt(d.tempo)}<br>${d.repro ? `casal ${AVES.includes(d.id) ? 'bota ovo' : 'tem filhote'} a cada ${d.repro} dia${d.repro > 1 ? 's' : ''}` : 'nasce de outra espécie'} · vive ${d.periodo} dias · ${d.xp} XP por coleta`, buyBtn(d));
      }
      html += `<h3>Companhia</h3>`;
      for (const d of visible('pet')) html += row(d, `${d.id === 'arara' ? 'voa junto com o seu avatar' : 'mora ' + (d.lugar === 'casa' ? 'dentro de casa' : (abrigoOf(d.id).o === 'a' ? 'na ' : 'no ') + abrigoOf(d.id).nome.toLowerCase())}<br>${PET_PRESENTES[d.id] ? `dá ${PET_PRESENTES[d.id][0].nomePl || PET_PRESENTES[d.id][0].nome.toLowerCase()} a cada ${fmt(GATO_PRESENTE_MS / 1000)} para vender · não come` : 'não come nem produz'} · carinho dá 2 XP por dia`, buyBtn(d));
      const pets = state.animals.filter(a => ANIMAL[a.k].tipo === 'pet');
      if (pets.length) {
        html += `<h3>Nomes dos seus bichos</h3>`;
        for (const a of pets) html += `<div class="row"><img alt="" src="${petIcon(a)}"><div><div class="name">${esc(a.nome || ANIMAL[a.k].nome)}</div><div class="meta">${ANIMAL[a.k].nome}${a.k === 'gato' ? ' · ' + corGato(a).nome : ''}</div></div>
          <button class="btn ghost" data-renomear="${a.id}">Nome<br><small>${moeda(CUSTO_NOME_BICHO)}</small></button></div>`;
      }
      const meus = state.animals.filter(a => ANIMAL[a.k].tipo === 'prod').sort((x, y) => lifeLeft(x) - lifeLeft(y));
      if (meus.length) {
        html += `<h3>Seus animais de produção</h3><p class="hint">Vender dá bem menos que a compra, e o valor cai a cada dia de vida que passa.</p>`;
        for (const a of meus) {
          const d = ANIMAL[a.k], left = lifeLeft(a), armed = buyPending && buyPending.i === 'venda' + a.id && performance.now() < buyPending.until;
          html += `<div class="row"><img alt="" src="${animalIcon(d.id)}"><div><div class="name">${esc(a.nome || d.nome)}</div>
            <div class="meta">${a.nome && a.nome !== d.nome ? d.nome.toLowerCase() + ' · ' : ''}vive mais ${vida(left)}</div><div class="mbar"><i style="width:${clamp(left / (d.periodo * DAY), 0, 1) * 100}%"></i></div></div>
            <button class="btn ${armed ? 'danger' : 'ghost'}" data-sell-animal="${a.id}">${armed ? 'Confirmar' : moeda(sellPrice(a))}</button></div>`;
        }
      }
    } else if (shopSeg === 'abrigos') {
      html += `<p class="hint">Cada abrigo tem o seu cercado no rancho. Nível 1 cabe ${ABRIGO_CAP[1]} animais, nível 2 cabe ${ABRIGO_CAP[2]} e nível 3 cabe ${ABRIGO_CAP[3]}.</p>`;
      for (const b of ABRIGOS.filter(x => x.bichos.length > 0)) {
        const lv = abrigoLv(state, b.id), max = lv >= 3, nivel = b.nivel + ABRIGO_NIVEL[Math.min(3, lv + 1)], preco = b.precos[Math.min(2, lv)];
        const quem = b.bichos.map(k => ANIMAL[k].nome).join(', ');
        const btn = max ? '<button class="btn ghost" disabled>Nível máximo</button>'
          : state.level < nivel ? `<button class="btn" disabled>Nível ${nivel}</button>`
          : `<button class="btn ${lv ? '' : 'gold'}" data-abrigo="${b.id}" ${state.coins < preco ? 'disabled' : ''}>${preco ? moeda(preco) : 'Grátis'}</button>`;
        html += `<div class="row ${state.level < b.nivel ? 'locked' : ''} ${lv ? 'sel' : ''}" id="abrigo-${b.id}"><img alt="" src="${abrigoIcon(b.id)}">
          <div><div class="name">${b.nome}${lv ? ` · nível ${lv}` : ''}</div>
          <div class="meta">${quem}<br>${lv ? `${livesIn(state, b.id).length} de ${ABRIGO_CAP[lv]} animais${max ? '' : ` · nível ${lv + 1} cabe ${ABRIGO_CAP[lv + 1]}`}` : `cabe ${ABRIGO_CAP[1]} animais`}</div></div>${btn}</div>`;
      }
    } else if (shopSeg === 'caes') {
      html += `<p class="hint">Um cachorro vigia a roça e outro o rancho. Acordado (com ração), ele espanta quem tenta pegar suas coisas e às vezes morde, ganhando até 10 moedas do ladrão. A ração dura ${DOG_FOOD.horas}h.</p>`;
      html += caesHTML(true);
      html += `<h3>Raças</h3>`;
      for (const b of DOGS) {
        const locked = b.nivel > state.level;
        const btn = slot => `<button class="btn ${slot === 'animais' ? 'ghost' : ''}" data-buy-dog="${b.id}" data-slot="${slot}" ${state.dogs[slot] || state.coins < b.custo ? 'disabled' : ''}>${slot === 'roca' ? 'Para a roça' : 'Para o rancho'}</button>`;
        html += `<div class="row wide ${locked ? 'locked' : ''}"><img alt="" src="${dogIcon(b.id)}">
          <div><div class="name">${b.nome}</div>
          <div class="meta">${b.custo} moedas · vive ${b.vida} dias<br>espanta ${Math.round(b.protege * 100)}% dos ladrões · morde ${Math.round(b.morde * 100)}% deles<br>+${b.xpDia} XP por dia · +${b.xpPega} XP por ladrão</div></div>
          <div class="actions">${locked ? `<button class="btn" disabled>Nível ${b.nivel}</button>` : btn('roca') + btn('animais')}</div></div>`;
      }
    } else if (shopSeg === 'enfeites') {
      html += `<p class="hint">Enfeites vão para o Inventário. De lá você escolhe onde pôr, na roça ou no rancho, fora dos canteiros e cercados. Cada um dá conforto (+XP).</p>`;
      {
        html += `<h3>Cercas e porteiras</h3><p class="hint" style="margin:0 0 6px">Cada pedaço tem uma casa de comprimento: ponha vários seguidos e gire (⟳) para fechar os cantos. A porteira ocupa um pedaço da cerca. Só enfeitam (não dão XP).</p>`;
        for (const e of ENFEITES.filter(x => x.cerca)) {
          const tem = state.enfeites[e.id] || 0, postos = objetosDe(state, 'roca').filter(o => o.id === e.id).length, locked = e.nivel > state.level;
          const btn = (q, mais) => `<button class="btn ${mais ? 'ghost' : ''}" data-enfeite-comprar="${e.id}" data-mais="1"${q > 1 ? ` data-qtd="${q}"` : ''} ${state.coins < e.custo * q ? 'disabled' : ''}>${mais ? '+ ' : ''}${q > 1 ? q + ' · ' : ''}${moeda(e.custo * q)}</button>`;
          html += `<div class="row wide ${locked ? 'locked' : ''}"><img alt="" src="${enfeiteIcon(e.id)}"><div><div class="name">${e.nome}</div><div class="meta">${e.desc}${tem ? ` · no inventário: <b>${tem}</b>` : ''}${postos ? ` · colocados: ${postos}` : ''}</div></div>
            <div class="actions">${tem ? `<button class="btn gold" data-enfeite-usar="${e.id}">📦 Usar · tem ${tem}</button>` : ''}${locked ? `<button class="btn" disabled>Nível ${e.nivel}</button>` : btn(1, tem) + (e.porteira ? '' : btn(10, tem))}</div></div>`;
        }
        html += `<h3>Enfeites</h3>`;
      }
      for (const e of ENFEITES.filter(x => !x.especial && !x.fruteira && !x.cerca)) {
        const tem = state.enfeites[e.id] || 0, postos = ['roca', 'animais'].reduce((t, sc) => t + objetosDe(state, sc).filter(o => o.id === e.id).length, 0);
        const locked = e.nivel > state.level;
        html += `<div class="row ${locked ? 'locked' : ''}"><img alt="" src="${enfeiteIcon(e.id)}">
          <div><div class="name">${e.nome}</div><div class="meta">+${e.conforto}% de XP${tem ? ` · no inventário: <b>${tem}</b>` : ''}${postos ? ` · colocados: ${postos}` : ''}</div></div>
          ${locked && !tem ? `<button class="btn" disabled>Nível ${e.nivel}</button>` : botaoEnfeiteLoja(e, !locked)}</div>`;
      }
    } else if (shopSeg === 'pomar') {
      html += pomarLojaHTML();
    } else if (shopSeg === 'trevo') {
      html += trevoLojaHTML();
    } else if (shopSeg === 'temas') {
      html += `<p class="hint">Os temas mudam o estilo das cercas que você põe (Loja › Enfeites) e o jeito da sua roça. Os amigos veem o seu tema quando visitam.</p>`;
      html += `<h3>Casa e celeiro</h3>` + casaTemasHTML() + `<h3>Cerca e roça</h3>`;
      for (const t of TEMAS) {
        const locked = t.nivel > state.level, owned = !!state.temas[t.id], using = state.tema === t.id;
        html += `<div class="row ${locked ? 'locked' : ''} ${using ? 'sel' : ''}"><img alt="" src="${temaIcon(t.id)}">
          <div><div class="name">${t.nome}</div><div class="meta">${t.desc}</div></div>
          ${using ? '<button class="btn ghost" disabled>Em uso</button>' : owned ? `<button class="btn" data-tema-roca="${t.id}">Usar</button>` : locked ? `<button class="btn" disabled>Nível ${t.nivel}</button>` : `<button class="btn" data-tema-roca="${t.id}" ${state.coins < t.custo ? 'disabled' : ''}>${moeda(t.custo)}</button>`}</div>`;
      }
    } else {
      html += `<p class="hint">Decore a sua casa. Cada lugar tem vários modelos: compre os que quiser e escolha qual fica em uso. O conforto do modelo em uso vale +1% de XP por ponto. Agora: +${comfort(state)}%.</p>`;
      for (const d of DECOR) {
        html += `<h3>${LUGAR_NOME[d.id]}</h3>`;
        for (const m of MODELOS.filter(x => x.lugar === d.id)) {
          const locked = m.nivel > state.level, tem = !!state.decorTem[m.id], uso = state.decor[d.id] === m.id;
          html += `<div class="row ${locked ? 'locked' : ''} ${uso ? 'sel' : ''}">
            <img alt="" src="${decorIcon(m.id)}">
            <div><div class="name">${m.nome}</div><div class="meta">${m.custo.toLocaleString('pt-BR')} moedas · +${m.conforto} de conforto${uso ? ' · <b>em uso</b>' : tem ? ' · guardado' : ''}</div></div>
            ${tem ? `<div class="stack">${uso ? '<button class="btn ghost" data-see-house>Na casa</button>' : `<button class="btn" data-usar-decor="${m.id}">Usar</button>`}${venderBtn('dec:' + m.id, Math.floor(m.custo / 2))}</div>`
              : locked ? `<button class="btn" disabled>Nível ${m.nivel}</button>` : `<button class="btn" data-buy-decor="${m.id}" ${state.coins < m.custo ? 'disabled' : ''}>${moeda(m.custo)}</button>`}
          </div>`;
        }
      }
    }
  } else if (tab === 'celeiro') {
    html += chaveAviso('celeiro', 'Mostrar a quantidade de itens no botão do Celeiro');
    const items = [...Object.values(PRODUCE), ...PRODUCTS, ...PRODUTOS_CACA.map(p => PRODUCT[p.id]), ...PEIXES.map(p => PRODUCT[p.id]), ...FRUTAS.map(f => PRODUCT[f.id]), ...PRESENTES_GATO.map(p => PRODUCT[p.id]), ...PRESENTES_ARARA.map(p => PRODUCT[p.id]), ...PREMIOS_NIVEL.map(p => PRODUCT[p.id]), ...RECEITAS].filter(it => state.barn[it.id] > 0);
    let total = 0; for (const it of items) total += state.barn[it.id] * it.preco;
    html += `<h3>Celeiro</h3>`;
    if (!items.length) html += `<div class="empty">O celeiro está vazio.<br>Colha na roça e recolha ovos, leite, lã e trufas dos animais.</div>`;
    else {
      html += `<div class="total"><span>Total: ${moeda(total)}</span><button class="btn gold" data-sellall>Vender tudo</button></div>`;
      for (const it of items) {
        const q = state.barn[it.id], key = 'sell:' + it.id, sel = q > 1 ? qtdSel[key] = clamp(qtdSel[key] || 1, 1, q) : 1;
        const bloq = state.bloqueados && state.bloqueados[it.id];
        html += `<div class="row"><img alt="" src="${itemIcon(it.id)}">
          <div><div class="name">${it.nome} × ${q}${bloq ? ' 🔒' : ''}</div><div class="meta">${moeda(it.preco)} cada · ${moeda(q * it.preco)} no total${it.id === 'milho' ? '<br>também serve de comida para os animais' : ''}</div></div>
          <div class="stack"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" ${bloq ? 'checked' : ''} data-toggle-block="${it.id}"> Bloquear</label>${!bloq ? (q > 1 ? qtdStep(key, q) : '') + `<button class="btn" data-sell="${it.id}" data-qtd="${sel}">Vender ${sel} · ${moeda(sel * it.preco)}</button>${q > 1 ? `<button class="btn ghost" data-sellall-of="${it.id}">Todos</button>` : ''}` : '<button class="btn ghost" disabled>Bloqueado</button>'}</div></div>`;
      }
    }
  } else if (tab === 'terreno') {
    html += `<h3>Terreno</h3><div class="kv">
      <span>Canteiros</span><span>${state.owned} de ${Math.max(state.owned, allowedLots())}</span>
      <span>Animais</span><span>${state.animals.length}</span>
      <span>Abrigos</span><span>${Object.keys(state.abrigos).length} de ${ABRIGOS.length}</span>
      <span>Decorações</span><span>${Object.keys(state.decorTem).length} de ${MODELOS.length} modelos</span>
      <span>Colheitas</span><span>${state.stats.colheitas}</span>
      <span>Produtos dos animais</span><span>${state.stats.coletas}</span>
      <span>Moedas vendidas</span><span>${state.stats.vendido}</span>
      <span>Pegos nas visitas</span><span>${state.stats.roubado}</span>
      <span>Ajudas aos amigos</span><span>${state.stats.ajudas}</span></div>`;
    if (freeLots()) html += `<div class="row sel"><div></div><div><div class="name">${freeLots()} ${freeLots() > 1 ? 'canteiros' : 'canteiro'} para colocar</div><div class="meta">Clique num + encostado na sua terra (duas vezes) para escolher o lugar.</div></div>
        <button class="btn gold" data-see-land>Ver na roça</button></div>`;
    html += `<h3>Expansões</h3>`;
    EXPANSOES.forEach((e, k) => {
      if (k === 0) return;
      const have = k <= state.exp, next = k === state.exp + 1, extra = e.total - EXPANSOES[k - 1].total;
      if (!have && !next && k > state.exp + 3) return;
      html += `<div class="row ${have ? '' : next ? '' : 'locked'}"><div class="avatar" style="background:${have ? '#4f9a2f' : '#b7b39c'}">${k + 1}</div>
        <div><div class="name">+${extra} canteiros (total ${e.total})</div><div class="meta">${e.preco.toLocaleString('pt-BR')} moedas · nível ${e.nivel}</div></div>
        ${have ? '<button class="btn ghost" disabled>Comprada</button>' : next ? `<button class="btn gold" data-expand ${state.level >= e.nivel && state.coins >= e.preco ? '' : 'disabled'}>${moeda(e.preco)}</button>` : `<button class="btn" disabled>Nível ${e.nivel}</button>`}</div>`;
    });
    html += `<p class="hint">Pragas comem parte da colheita enquanto ficam lá. Terra seca faz a planta crescer mais devagar. Nunca acontecem os dois juntos. Cada planta dá XP em até ${XP_CAP} colheitas por dia.</p>`;
  } else if (tab === 'chocadeira') {
    html += chocadeiraHTML();
  } else if (tab === 'correio') {
    // Caixa de correio: as novidades da sua roça (visitas, presentes, cachorro, animais…)
    podarNews();
    html += `<p class="hint">Tudo o que aconteceu na sua roça (visitas dos amigos, presentes, o que o cachorro fez, recados da vila) e as novidades do jogo 📰. As cartas somem sozinhas depois de ${NEWS_DIAS} dias.</p>`;
    if (!state.news.length) html += `<div class="empty">A caixa de correio está vazia.</div>`;
    else {
      html += `<div class="newsbar"><button class="btn ghost" type="button" data-news-limpar="1">🗑️ Apagar todas</button></div>`;
      html += `<div class="news">${state.news.map(n =>
        `<div class="${n.at > state.newsSeen ? 'new' : ''}"><button class="newsdel" type="button" data-news-del="${n.at}" aria-label="Apagar esta carta" title="Apagar">✕</button><time>${quando(n.at)}</time>${esc(n.msg)}</div>`).join('')}</div>`;
      if (state.news[0].at > state.newsSeen) { state.newsSeen = state.news[0].at; setTimeout(renderTabs, 0); save(); }
    }
  } else if (tab === 'amigos') {
    html += `<h3>Amigos</h3>`;
    if (!Cloud.available) {
      html += `<p class="hint">Login com Google e amigos de verdade funcionam quando o jogo está publicado com o Firebase ligado (o passo a passo está no README). Nesta versão, a roça fica salva só neste navegador.</p>`;
    } else if (!user) {
      html += `<p class="hint">Entre com o Google para salvar a roça na nuvem, jogar em qualquer aparelho e visitar seus amigos.</p>
        <button class="gbtn" type="button" data-login style="justify-self:start">${GOOGLE_G}Entrar com Google</button>`;
    } else {
      html += `<div class="codebox"><div><div class="meta">Seu código de amigo</div><strong>${esc(state.code || '······')}</strong></div>
          <button class="btn ghost" data-copy-code type="button">Copiar</button></div>
        <form class="addform" id="addFriend"><input id="friendCode" maxlength="7" placeholder="Código do amigo" autocomplete="off" aria-label="Código do amigo"><button class="btn" type="submit">Adicionar</button></form>`;
      const avatar = (photo, name, color, moldura) => {
        const src = resolveFoto(photo), cls = 'avatar' + (moldura ? ' moldura-' + moldura : '');
        return src ? `<img class="${cls}" alt="" referrerpolicy="no-referrer" src="${esc(src)}">`
          : `<div class="${cls}" style="background:${color}">${esc((name || '?')[0])}</div>`;
      };
      if (requests.length) {
        html += `<h3>Pedidos de amizade</h3>`;
        for (const r of requests) {
          html += `<div class="row sel">${avatar(r.photo, r.name, '#d9a441', r.moldura)}
            <div><div class="name">${esc(r.name)}</div><div class="meta">${r.reatar ? 'quer reatar a amizade (ela sumiu por um erro antigo do jogo)' : 'quer ser seu amigo'}</div></div>
            <div class="stack"><button class="btn" data-accept="${esc(r.from)}">Aceitar</button><button class="btn ghost" data-refuse="${esc(r.from)}">Recusar</button></div></div>`;
        }
      }
      html += rankingHTML();
      html += `<h3>Seus amigos</h3>`;
      if (state.friends.length) html += `<p class="hint">Mande um presente por dia para até ${PRESENTE_MAX} amigos (hoje: ${giftsToday().to.length} de ${PRESENTE_MAX}). Não custa nada!</p>`;
      if (!state.friends.length) html += `<div class="empty">Mande seu código para um amigo e peça o dele. A amizade começa quando um aceitar o pedido do outro.</div>`;
      if (amigosPedindo().length) html += `<p class="hint pedeajuda">🆘 ${amigosPedindo().length === 1 ? 'Um amigo precisa' : `${amigosPedindo().length} amigos precisam`} de ajuda no pomar! Visite e toque na frutífera com a placa (🤝). Ajudar frutífera não conta no limite do dia.</p>`;
      const nivelDe = uid => { const f = friendInfo[uid]; return f && typeof f === 'object' && !f.erro ? f.level || 0 : 0; };
      for (const uid of [...state.friends].sort((a, b) => (pedeAjuda(b) ? 1 : 0) - (pedeAjuda(a) ? 1 : 0) || nivelDe(b) - nivelDe(a))) {
        fetchFriendInfo(uid);
        const f = friendInfo[uid];
        const here = view.kind === 'friend' && view.uid === uid;
        if (f === 'loading') { html += `<div class="row"><div class="avatar" style="background:#c9c3a8"></div><div class="meta">Carregando…</div><div></div></div>`; continue; }
        const name = f ? f.name : 'Amigo';
        const armed = unfriendArmed === uid;
        html += `<div class="row ${here ? 'sel' : ''}">${avatar(f && f.photo, name, '#7aa35a', f && f.moldura)}
          <div><div class="name">${esc(name)}${owes(uid) ? '<span class="tag">ajudou você</span>' : ''}</div><div class="meta">${bolinhaStatus(uid)} · ${f && f.erro ? 'Não deu para ver a roça: toque em Reatar' : f ? `${esc(f.fazenda || 'Roça Feliz')} · nível ${f.level}` : 'Ainda não entrou no jogo'}${owes(uid) ? ` · ajude de volta: +${AJUDA_BONUS.moedas} moedas` : ''}</div>
          <div class="meta" title="Amizade: ajude ou presenteie para subir">${'❤️'.repeat(nivelAmizade(uid))}${'🤍'.repeat(AMIZADE_NIVEL_MAX - nivelAmizade(uid))} · presentes ${nivelAmizade(uid) ? 'melhores' : 'melhoram com a amizade'}</div></div>
          <div class="stack">${here ? `<button class="btn ghost" data-home>Voltar</button>` : (f && f.erro ? `<button class="btn" data-reatar="${esc(uid)}">Reatar</button>` : `<button class="btn" data-visit-friend="${esc(uid)}" ${f ? '' : 'disabled'}>Visitar</button>`)}
          ${here ? '' : `<button class="btn ${pedeAjuda(uid) ? 'socorro' : 'ghost'}" data-ajudar-friend="${esc(uid)}" ${pedeAjuda(uid) ? '' : 'disabled title="Nenhuma frutífera pedindo ajuda agora"'}>🆘 Precisa de ajuda${pedeAjuda(uid) > 1 ? ` (${pedeAjuda(uid)})` : ''}</button>`}
          <button class="btn" data-chat="${esc(uid)}" ${f && !f.erro ? '' : 'disabled'}>💬 Conversar${naoLidas(uid) ? ` <span class="badge" aria-label="${naoLidas(uid)} mensagens novas">${naoLidas(uid)}</span>` : ''}</button>
          ${giftsToday().to.includes(uid) ? '<button class="btn ghost" disabled>🎁 Enviado</button>' : `<button class="btn gold" data-send-gift="${esc(uid)}" ${f && !f.erro && giftsToday().to.length < PRESENTE_MAX ? '' : 'disabled'}>🎁 Presentear</button>`}
          ${armed ? `<span class="meta">Excluir ${esc(firstName(name))}?</span><button class="btn ghost" data-unfriend-cancel>Cancelar</button><button class="btn danger" data-unfriend="${esc(uid)}">Confirmar</button>`
            : `<button class="btn ghost" data-unfriend="${esc(uid)}">Excluir</button>`}</div></div>`;
      }
      const sent = Object.entries(state.sent);
      if (sent.length) {
        html += `<h3>Pedidos enviados</h3>`;
        for (const [uid, info] of sent) {
          html += `<div class="row">${avatar('', '?', '#b7b39c')}
            <div><div class="name">Código ${esc(info.code || '')}</div><div class="meta">Esperando a pessoa aceitar</div></div>
            <button class="btn ghost" data-cancel-request="${esc(uid)}">Cancelar</button></div>`;
        }
      }
    }
    html += `<p class="hint">Hoje você já pegou coisas em ${farmsToday()} ${farmsToday() === 1 ? 'roça' : 'roças'} (sem limite de quantas). Em cada uma dá para pegar ${STEAL_MAX.roca} itens da plantação e do pomar, e ${STEAL_MAX.animais} dos animais. Tudo volta à meia-noite.</p>`;
    html += `<h3>Vizinhos da vila</h3><p class="hint">Sempre tem alguém em casa por aqui. Cada vizinho tem um cachorro de guarda.</p>`;
    for (const n of NEIGHBORS) {
      const here = view.kind === 'npc' && view.id === n.id;
      html += `<div class="row ${here ? 'sel' : ''}"><div class="avatar" style="background:${n.casa}">${n.nome.split(' ').pop()[0]}</div>
        <div><div class="name">${n.nome}${owes(n.id) ? '<span class="tag">ajudou você</span>' : ''}</div><div class="meta">Nível ${state.level + n.acima} · ${owes(n.id) ? `Ajude de volta: +${AJUDA_BONUS.moedas} moedas · ` : ''}Cachorro: ${n.cao} · ${n.pega >= .15 ? 'bravo' : n.pega >= .09 ? 'atento' : 'dorminhoco'}</div></div>
        ${here ? `<button class="btn ghost" data-home>Voltar</button>` : `<button class="btn" data-visit="${n.id}">Visitar</button>`}</div>`;
    }
  }
  pane.innerHTML = html;
}

// Botão desativado (bloqueado) não recebe toque: aqui o jogo explica por quê.
// (o CSS deixa o toque "atravessar" o botão desativado e chegar até aqui)
function explicarBloqueado(e) {
  const b = [...document.querySelectorAll('#pane button:disabled, #settings button:disabled')].find(x => { const r = x.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
  if (!b) return false;
  const txt = b.textContent.replace(/\s+/g, ' ').trim();
  let msg = '';
  if (/^n[íi]vel\s*\d+/i.test(txt)) msg = `🔒 Libera no ${txt.toLowerCase()}. Continue jogando para subir de nível!`;
  else if (/🍀/.test(txt)) msg = `🍀 Faltam trevos: custa ${txt.replace(/[^0-9]/g, '')}. Ganhe resgatando peixes, domínio e conquistas em Missões › 🍀 Trevos.`;
  else if (/^\d|moedas|^×/.test(txt) || b.querySelector('.coin')) msg = `🪙 Moedas insuficientes: custa ${txt.replace(/^×\d+/, '').replace(/[^0-9.]/g, '')} moedas.`;
  else if (/cheio|cheia/i.test(txt)) msg = 'Não cabe mais: aumente o abrigo na aba Abrigos.';
  else if (b.dataset.fruteiraCheia) msg = `Limite de ${ENFEITE[b.dataset.fruteiraCheia].nome.toLowerCase()} atingido (${LIMITE_FRUTEIRA[ENFEITE[b.dataset.fruteiraCheia].fruteira]}). Derrube uma seca para comprar outra.`;
  if (!msg) return false;
  sfx('error'); toast(msg, 'bad'); return true;
}
$('#pane').addEventListener('click', e => { if (e.target.closest('#pane') && !e.target.closest('button:not(:disabled)')) explicarBloqueado(e); }, true);
$('#pane').addEventListener('click', e => {
  const inp = e.target.closest('input[data-toggle-block]');
  if (inp) {
    const d = inp.dataset;
    if (d.toggleBlock) {
      if (!state.bloqueados) state.bloqueados = {};
      if (state.bloqueados[d.toggleBlock]) delete state.bloqueados[d.toggleBlock];
      else state.bloqueados[d.toggleBlock] = true;
      renderPane();
      return;
    }
  }
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.renomear) return trocarNome({ animal: d.renomear });
  if (d.renomearDog) return trocarNome({ dog: d.renomearDog });
  if (d.fseg) { fabSeg = d.fseg; renderPane(); $('#pane').scrollTop = 0; return; }
  if (d.fabricar) return fabricar(d.fabricar);
  if (d.fabRecolher) return recolherFab(d.fabRecolher);
  if (d.fabSlot) return comprarSlotFab(d.fabSlot);
  if (d.bancaRem) return bancaRemove(d.bancaRem);
  if ('bancaNovo' in d) return abrirBancaModal();
  if (d.bancaComprar) return bancaComprar(d.bancaComprar);
  if (d.entregar) return entregar(Number(d.entregar));
  if (d.mseg) { missSeg = d.mseg; renderPane(); $('#pane').scrollTop = 0; return; }
  if (d.vila) { const [npc, id] = d.vila.split(':'); return entregarVila(npc, id); }
  if (d.claim) { const [tp, k] = d.claim.split(':'); return claimMission(tp, Number(k)); }
  if (d.temaRoca) return buyTema(d.temaRoca);
  if (d.casaTema) return usarCasaTema(d.casaTema);
  if (d.comprarFerr) return comprarFerramenta(d.comprarFerr);
  if (d.trevoConq) { resgatarConquista(d.trevoConq); return renderPane(); }
  if (d.trevoTodos) { resgatarTodosPeixes(); return renderPane(); }
  if (d.trevoDominio) { resgatarDominio(); return renderPane(); }
  if (d.trevoPomar) { resgatarPomar(); return renderPane(); }
  if (d.comprarArmadilha) { comprarArmadilha(); return renderPane(); }
  if (d.trevoBichos) { resgatarBichos(); return renderPane(); }
  if (d.trevoDomcaca) { resgatarDomCaca(); return renderPane(); }
  if (d.newsDel) { state.news = state.news.filter(n => String(n.at) !== d.newsDel); sfx('click'); save(); renderTabs(); return renderPane(); }
  if (d.newsLimpar) return confirmTwice('news-limpar', 'Apagar todas as cartas do correio? Toque de novo para confirmar.', () => { state.news = []; sfx('water'); toast('Correio limpo! 📭', 'good'); save(); renderTabs(); renderPane(); });
  if (d.trevoComprar) return comprarTrevoItem(d.trevoComprar);
  if (d.abrirTrevos) { missSeg = 'trevos'; return openPanel('missoes'); }
  if (d.irLojaTrevo) return openPanel('loja', 'trevo');
  if (d.abrirLivro) { closePanel(); if (!isHome()) goHome(); abrirPesca(); pescaLivro = true; return renderPesca(); }
  if (d.entrarCasa) { closePanel(); return setScene('casa'); }
  if ('skin' in d) { state.skin = d.skin || null; toast(d.skin ? 'Celeiro e casa dos Pioneiros!' : 'Celeiro e casa clássicos.', 'good'); if (isHome()) setScene('roca'); return done(); }
  if (d.enfeiteUsar || (d.enfeiteComprar && !d.mais && state.enfeites[d.enfeiteComprar] > 0)) { const id = d.enfeiteUsar || d.enfeiteComprar; toast(`📦 Usando ${ENFEITE[id].nome.toLowerCase()} do inventário (você tem ${state.enfeites[id]}).`); return invPor(id, ehCerca(id) || scene !== 'animais' ? 'roca' : 'animais'); }
  if (d.enfeiteComprar) return comprarEnfeite(d.enfeiteComprar, Number(d.qtd) || 1);
  if (d.invPor) return invPor(d.invPor, d.sc);
  if (d.venderDec) return venderDecoracao(d.venderDec, Number(d.qtd) || 1);
  if (d.invGuardarCercas) {
    const [sc, id] = d.invGuardarCercas.split(':'), l = objetosDe(state, sc), all = l.filter(o => o.id === id);
    const n = clamp(Math.round(Number(d.qtd)) || all.length, 1, all.length), retirar = new Set(all.slice(0, n));
    state.objetos[sc] = l.filter(o => !retirar.has(o)); state.enfeites[id] = (state.enfeites[id] || 0) + n;
    toast(`${n}× ${ENFEITE[id].nome.toLowerCase()} guardado${n > 1 ? 's' : ''} no inventário.`); return done();
  }
  if (d.invGuardar) { const [sc, i] = d.invGuardar.split(':'); return invGuardar(sc, Number(i)); }
  if (d.qtdd || d.qtdi) { const k = d.qtdd || d.qtdi, max = Number(d.qtdMax) || 1; qtdSel[k] = clamp((qtdSel[k] || 1) + (d.qtdi ? 1 : -1), 1, max); return renderPane(); }
  if (d.pocao) {
    const n = Number(d.pocao) || 1;
    if (state.coins < POCAO.custo * n) return toast(`Faltam moedas: ${n} ${n > 1 ? 'poções custam' : 'poção custa'} ${POCAO.custo * n}.`, 'bad');
    state.coins -= POCAO.custo * n; state.pocao = (state.pocao || 0) + n; sfx('buy'); toast(`+${n} ${n > 1 ? 'poções' : 'poção'}`, 'good'); return done();
  }
  if (d.sendGift) return escolherPresente(d.sendGift);
  if (d.sellAnimal) {
    const a = state.animals.find(x => x.id === d.sellAnimal); if (!a) return;
    const key = 'venda' + a.id;
    if (!(buyPending && buyPending.i === key && performance.now() < buyPending.until)) {
      buyPending = { i: key, until: performance.now() + 4000 }; renderPane();
      setTimeout(() => { if (buyPending && buyPending.i === key) { buyPending = null; renderPane(); } }, 4000);
      return;
    }
    buyPending = null;
    if (isAdult(a)) { sellAdult(a, null); return renderPane(); }
    const price = precoVenda(a), nome = ANIMAL[a.k].nome.toLowerCase();
    state.animals = state.animals.filter(x => x !== a); delete amb[a.id];
    state.coins += price; sfx('coin'); track('vender', price);
    toast(`Vendeu ${ANIMAL[a.k].f ? 'a' : 'o'} ${nome}${a.nome && a.nome !== ANIMAL[a.k].nome ? ` ${a.nome}` : ''} por ${price.toLocaleString('pt-BR')} moedas.`, 'good');
    done(); return renderPane();
  }
  if (d.sellDog) {
    const slot = d.sellDog, dog = state.dogs[slot]; if (!dog) return;
    const key = 'vendaDog' + slot;
    if (!(buyPending && buyPending.i === key && performance.now() < buyPending.until)) {
      buyPending = { i: key, until: performance.now() + 4000 }; renderPane();
      setTimeout(() => { if (buyPending && buyPending.i === key) { buyPending = null; renderPane(); } }, 4000);
      return;
    }
    buyPending = null;
    const price = dogSellPrice(dog), b = DOG[dog.raca];
    state.dogs[slot] = null;
    state.coins += price; sfx('coin'); track('vender', price);
    toast(`Vendeu ${dog.nome}, ${b.nome.toLowerCase()}, por ${price.toLocaleString('pt-BR')} moedas. ${SLOT[slot].A} ficou sem cachorro de guarda.`, 'good');
    done(); return renderPane();
  }
  if (d.rankModo) { rankModo = d.rankModo; renderPane(); return; }
  if (d.seg) { shopSeg = d.seg; renderPane(); $('#pane').scrollTop = 0; if (d.focus) focusRow('abrigo-' + d.focus); }
  else if (d.abrigo) buyAbrigo(d.abrigo);
  else if (d.seed) { state.seed = d.seed; state.tool = 'seed'; if (!isHome()) goHome(); setScene('roca'); closePanel(); save(); toast(`${CROP[d.seed].nome} na mão: clique na terra arada para plantar.`); }
  else if (d.buyAnimal) buyAnimal(d.buyAnimal);
  else if (d.buyDecor) buyDecor(d.buyDecor);
  else if (d.usarDecor) usarDecor(d.usarDecor);
  else if ('seeHouse' in d) { if (!isHome()) goHome(); setScene('casa'); closePanel(); }
  else if (d.sell) sell(d.sell, Number(d.qtd) || 1);
  else if (d.sellallOf) sell(d.sellallOf, true);
  else if ('sellall' in d) sellAll();
  else if ('seeLand' in d) { if (!isHome()) goHome(); setScene('roca'); closePanel(); toast('Clique num + encostado na sua terra para colocar um canteiro.'); }
  else if ('expand' in d) buyExpansion();
  else if (d.buyFert) buyFert(d.buyFert, Number(d.n) || 1);
  else if (d.racaoEsp) {
    const n = Number(d.racaoEsp) || 1;
    if (state.coins < RACAO_ESP * n) toast(`Faltam moedas: ${n} ração especial custa ${RACAO_ESP * n}.`, 'bad');
    else { state.coins -= RACAO_ESP * n; state.racaoEsp += n; sfx('buy'); toast(`+${n} ração especial`, 'good'); done(); }
  }
  else if ('buyHoe' in d) {
    if (state.coins < 100) toast('O enxadão custa 100 moedas.', 'bad');
    else { state.coins -= 100; state.tools.enxada = true; sfx('buy'); toast('Enxadão comprado! Agora ele aparece nas ferramentas.', 'good'); renderTools(); done(); }
  }
  else if (d.buyDog) buyDog(d.buyDog, d.slot);
  else if (d.dogFood) buyDogFood(Number(d.dogFood) || 1);
  else if (d.feedDog) { feedDog(d.feedDog); renderPane(); }
  else if (d.irCaes) openPanel('loja', 'caes');
  else if (d.useFert) { state.fertSel = d.useFert; if (!isHome()) goHome(); setScene('roca'); setTool('fert'); closePanel(); save(); }
  else if (d.visit) { visitNpc(d.visit); closePanel(); }
  else if (d.visitFriend) { visitFriend(d.visitFriend); closePanel(); }
  else if (d.ajudarFriend) { visitFriend(d.ajudarFriend, true); closePanel(); }
  else if (d.reatar) reatarAmizade(d.reatar);
  else if (d.chat) abrirChat(d.chat);
  else if (d.accept) acceptRequest(d.accept);
  else if (d.refuse) refuseRequest(d.refuse);
  else if (d.cancelRequest) cancelRequest(d.cancelRequest);
  else if ('unfriendCancel' in d) { unfriendArmed = null; renderPane(); }
  else if (d.unfriend) {
    // primeiro clique pergunta (Cancelar / Confirmar); o segundo exclui
    if (unfriendArmed !== d.unfriend) { unfriendArmed = d.unfriend; renderPane(); }
    else { unfriendArmed = null; unfriend(d.unfriend); }
  }
  else if ('home' in d) goHome();
  else if ('login' in d) login();
  else if ('copyCode' in d) {
    const code = state.code || '';
    const ok = () => toast('Código copiado!', 'good');
    try { navigator.clipboard.writeText(code).then(ok, () => toast(`Seu código: ${code}`)); } catch (err) { toast(`Seu código: ${code}`); }
  }
  else if ('reset' in d) {
    if (!resetArmed) { resetArmed = true; renderPane(); setTimeout(() => { resetArmed = false; if (tab === 'terreno') renderPane(); }, 4000); return; }
    resetArmed = false;
    const keep = { owner: state.owner, code: state.code, friends: state.friends, sent: state.sent };
    state = Object.assign(newState(), keep);
    goHome(); setScene('roca'); done();
    toast('Roça nova em folha!', 'good');
  }
});
$('#pane').addEventListener('change', e => {
});
$('#pane').addEventListener('submit', e => {
  if (e.target.id !== 'addFriend') return;
  e.preventDefault();
  addFriend($('#friendCode').value);
});
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  if (!$('#panel').hidden && tab === b.dataset.tab) closePanel(); else openPanel(b.dataset.tab);
}));
$('#closePanel').addEventListener('click', closePanel);
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#panel').hidden && $('#settings').hidden) closePanel(); });
// Ícones dos botões redondos
const MENU_ICONS = {
  loja: '<svg viewBox="0 0 32 32"><path d="M5 14h22v13H5z" fill="#f1dcae" stroke="#7a4a22" stroke-width="1.6"/><path d="M12 19h8v8h-8z" fill="#8a5a33"/><path d="M3 8h26l-2 7H5z" fill="#fff" stroke="#7a4a22" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 8l-1 7M13.5 8 13 15M18.5 8l.5 7M24 8l1 7" stroke="#e0463a" stroke-width="3"/><path d="M3 8l3-4h20l3 4" fill="#e0463a" stroke="#7a4a22" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  celeiro: '<svg viewBox="0 0 32 32"><path d="M4 14 16 5l12 9v14H4z" fill="#c8402f" stroke="#6b1f14" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 28V18h10v10" fill="#fff4e0"/><path d="M11 18l10 10M21 18 11 28" stroke="#c8402f" stroke-width="1.6"/><circle cx="16" cy="12" r="2.2" fill="#fff4e0"/></svg>',
  terreno: '<svg viewBox="0 0 32 32"><path d="M16 9 29 17 16 25 3 17z" fill="#8b5a33" stroke="#4a2c14" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 17l7-4.3M12 19l7-4.3M15 21l7-4.3" stroke="#5e3a1c" stroke-width="1.2"/><circle cx="24" cy="8" r="6" fill="#4f9a2f" stroke="#2f6e1e" stroke-width="1.4"/><path d="M24 5v6M21 8h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  amigos: '<svg viewBox="0 0 32 32"><circle cx="11" cy="12" r="5" fill="#ffd9b0" stroke="#6b4220" stroke-width="1.5"/><path d="M3 27c0-5 3.5-8 8-8s8 3 8 8z" fill="#4aa3df" stroke="#1d5f8f" stroke-width="1.5"/><circle cx="22" cy="13" r="4.5" fill="#f3c08e" stroke="#6b4220" stroke-width="1.5"/><path d="M15 27c0-4.5 3-7.5 7-7.5s7 3 7 7.5z" fill="#e9a800" stroke="#a87400" stroke-width="1.5"/></svg>',
  missoes: '<svg viewBox="0 0 32 32"><path d="M8 4h16a2 2 0 0 1 2 2v22l-4-2-3 2-3-2-3 2-3-2-4 2V6a2 2 0 0 1 2-2z" fill="#fff4e0" stroke="#7a4a22" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 11l2 2 3-4M10 18l2 2 3-4" fill="none" stroke="#4f9a2f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 11h5M18 18h5" stroke="#a86b38" stroke-width="2" stroke-linecap="round"/></svg>',
  inventario: '<svg viewBox="0 0 32 32"><path d="M4 12h24v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#a86b38" stroke="#5a3614" stroke-width="1.6"/><path d="M3 8h26v5H3z" fill="#c98a4b" stroke="#5a3614" stroke-width="1.6"/><path d="M13 16h6v4h-6z" fill="#ffd54a" stroke="#a87400" stroke-width="1.2"/><path d="M4 12h24" stroke="#5a3614" stroke-width="1.6"/></svg>',
  chocadeira: '<svg viewBox="0 0 32 32"><path d="M4 10h24v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#c9a86a" stroke="#7a4a22" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="16" r="3.5" fill="#f5e6c8" stroke="#8a5a33" stroke-width="1.2"/><circle cx="16" cy="16" r="3.5" fill="#f5e6c8" stroke="#8a5a33" stroke-width="1.2"/><circle cx="22" cy="16" r="3.5" fill="#f5e6c8" stroke="#8a5a33" stroke-width="1.2"/><path d="M4 10h24v2H4z" fill="#a86b38" stroke="#7a4a22" stroke-width="1.2"/><path d="M9 12l1.5 1M15 12l1.5 1M21 12l1.5 1" stroke="#8a5a33" stroke-width="1.2" stroke-linecap="round"/></svg>',
  mover: '<svg viewBox="0 0 32 32" fill="none" stroke="#7a4a22" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4v24M4 16h24M16 4l-4 4M16 4l4 4M16 28l-4-4M16 28l4-4M4 16l4-4M4 16l4 4M28 16l-4-4M28 16l-4 4"/></svg>',
  // Negócios: barraquinha com toldo listrado (fábrica, banca e caminhão ficam aqui dentro)
  fabrica: '<svg viewBox="0 0 32 32"><path d="M6 14h20v14H6z" fill="#c98a4b" stroke="#6b3f1f" stroke-width="1.5"/><path d="M10 19h12v9H10z" fill="#7a4a24"/><path d="M11 20h4v3h-4zM17 20h4v3h-4z" fill="#ffe08a"/><path d="M3 14l3-9h20l3 9z" fill="#fff" stroke="#6b1f14" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 5l-2 9h4l1-9zM17 5v9h4l-1-9z" fill="#d8402f"/><path d="M3 14q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0q2.5 3 5 0q2.5 3 6 0" fill="#d8402f" stroke="#6b1f14" stroke-width="1.2"/><circle cx="24" cy="25" r="2.4" fill="#e8b04a" stroke="#8a5a1f"/></svg>',
  correio: '<svg viewBox="0 0 32 32"><path d="M15 28V17" stroke="#7a4a22" stroke-width="3"/><path d="M5 10a6 6 0 0 1 12 0v8H5z" fill="#4a86c7" stroke="#2c5a8f" stroke-width="1.5" stroke-linejoin="round"/><path d="M11 4h12a6 6 0 0 1 6 6v8H17v-8a6 6 0 0 0-6-6z" fill="#5a9ae0" stroke="#2c5a8f" stroke-width="1.5" stroke-linejoin="round"/><path d="M23 18v-6h4v3h-4" fill="#e0463a" stroke="#8f2a1e" stroke-width="1.2"/><path d="M8 11h6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
  presente: '<svg viewBox="0 0 32 32"><rect x="5" y="13" width="22" height="15" rx="2" fill="#e0463a" stroke="#8f2a1e" stroke-width="1.6"/><rect x="3" y="9" width="26" height="6" rx="1.5" fill="#f25a4a" stroke="#8f2a1e" stroke-width="1.6"/><path d="M14 9h4v19h-4z" fill="#ffd54a"/><path d="M16 9c-2-5-8-6-8-2s6 2 8 2zM16 9c2-5 8-6 8-2s-6 2-8 2z" fill="#ffd54a" stroke="#a87400" stroke-width="1.4"/></svg>',
  casa: '<svg viewBox="0 0 32 32"><path d="M5 15 16 6l11 9v13H5z" fill="#f1dcae" stroke="#7a4a22" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 16 16 4l14 12" fill="none" stroke="#b5532f" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 28v-8h6v8" fill="#8a5a33"/><path d="M20 15h5v4h-5z" fill="#9fd4f5" stroke="#7a4a22" stroke-width="1.2"/></svg>',
};
function paintMenuIcons() {
  document.querySelectorAll('.tab .ic').forEach(el => { el.innerHTML = MENU_ICONS[el.parentNode.dataset.tab]; });
  const sc = { roca: `<img alt="" src="${cropIcon('milho')}">`, animais: `<img alt="" src="${animalIcon('vaca')}">`, casa: MENU_ICONS.casa };
  document.querySelectorAll('#scenes .ic').forEach(el => { el.innerHTML = sc[el.parentNode.dataset.scene]; });
  const g = document.querySelector('#giftBtn .ic'); if (g) g.innerHTML = MENU_ICONS.presente;
  const m = document.querySelector('#moveBtn .ic'); if (m) m.innerHTML = MENU_ICONS.mover;
}
document.querySelectorAll('#scenes button').forEach(b => b.addEventListener('click', () => setScene(b.dataset.scene)));
$('#goHome').addEventListener('click', () => goHome());
$('#penActions').addEventListener('click', e => {
  if (e.target.closest('[data-feed-all]')) feedAll();
  else if (e.target.closest('[data-collect-all]')) collectAll();
});

// ============================================================
// Dicas ao passar o mouse
// ============================================================
function tipPlot(i) {
  const p = S().plots[i], home = isHome();
  if (p.s === 'locked') {
    if (home && canBuy(i)) return `<b>Espaço livre</b><br>Clique duas vezes para colocar um canteiro aqui.<br>Você tem ${freeLots()} para colocar.`;
    if (home && !freeLots()) return '<b>Pasto</b><br>Compre uma expansão na aba Terreno para ter mais canteiros.';
    return home ? 'Pasto.' : null;
  }
  if (p.s === 'plowed') return home ? `<b>Terra arada</b><br>${state.tool === 'seed' ? `Clique para plantar ${CROP[state.seed].nome}.` : 'Clique para escolher uma semente na Loja.'}` : '<b>Terra arada</b>';
  if (p.s === 'withered') return '<b>Planta seca</b><br>Use a Mão ou o enxadão para limpar.';
  const crop = CROP[p.c], st = stageOf(p), T = phaseTempo(p), k = Math.min(1, p.g / T);
  if (p.podre) return `<b>${crop.nome} podre</b><br>Ficou mais de 24h sem colher.<br>${home ? `Clique para usar uma poção (você tem ${state.pocao || 0}) ou peça ajuda a um amigo.` : 'Clique para salvar a planta do seu amigo!'}`;
  let h = `<b>${crop.nome}</b> · ${STAGE_NAMES[st]}`;
  if (st < 4 || k < 1) h += `<br>Fica pronto em ${fmt((T - p.g) / (p.dry ? 0.7 : 1) / acelera(S(), crop.prod))}`;
  else h += !home && (p.stolen || state.log[visitKey(p.id)]) ? '<br>Você já pegou daqui.' : `<br>Pronto para colher! Apodrece em ${fmt(Math.max(60, PODRE_APOS - (p.pronto || 0)))}`;
  h += `<div class="bar"><i style="width:${k * 100}%"></i></div>`;
  const probs = [];
  if (p.w) probs.push(`${p.w} mato`); if (p.b) probs.push(`${p.b} praga${p.b > 1 ? 's' : ''}`); if (p.dry) probs.push('terra seca');
  if (probs.length) h += `<div class="warn">${probs.join(' · ')}</div>`;
  if (p.fert) h += 'adubada';
  if (home) {
    const [lo, hi] = yieldRange(crop), d = Math.round(p.dmg), a = Math.max(1, lo - d), z = Math.max(1, hi - d);
    h += `<br>Vai render ${a === z ? a : `${a} a ${z}`} ${crop.prodNome.toLowerCase()}${d ? ` (as pragas comeram ${d})` : ''}`;
  }
  return h;
}
function tipAnimal(id) {
  const a = S().animals.find(x => x.id === id); if (!a) return null;
  const d = ANIMAL[a.k], home = isHome();
  if (d.tipo === 'pet') return `<b>${esc(a.nome || d.nome)}</b> · ${d.nome.toLowerCase()}<br>Clique para fazer carinho.`;
  let h = `<b>${esc(a.nome || d.nome)}</b>${a.nome && a.nome !== d.nome ? ` · ${d.nome.toLowerCase()}` : ''}<br>`;
  if (d.tipo === 'cria') {
    if (isAdult(a)) return h + `Adulto! ${home ? `Clique para vender por ${d.venda.toLocaleString('pt-BR')} moedas.` : ''}`;
    h += `Crescendo: falta ${fmt(d.tempo - a.g)}<div class="bar"><i style="width:${a.g / d.tempo * 100}%"></i></div>`;
    return h + (a.food > 0 ? `Comida por mais ${fmt(a.food)}` : `<span class="warn">Com fome, parou de crescer.</span>${home ? ` Clique para dar ração (${d.racao}).` : ''}`);
  }
  const prod = PRODUCT[d.prod];
  if (a.ready) h += `${prod.nome} pronto${a.dobro ? ' (em dobro!)' : ''}! Clique para recolher.`;
  else if (!a.fed) h += `Com fome. ${home ? `Clique para dar ração (${d.racao} moedas${state.racaoEsp ? ', usa 1 ração especial' : ''}).` : 'Clique para dar comida e ajudar.'}`;
  else h += `Produzindo ${prod.nome.toLowerCase()}${a.dobro ? ' em dobro' : ''}: falta ${fmt((d.tempo - a.g) / acelera(S(), d.prod))}<div class="bar"><i style="width:${a.g / d.tempo * 100}%"></i></div>`;
  { const rt = reproTexto(a.k); if (rt) h += `<br>${rt}`; }
  h += `<br>Vive mais ${vida(lifeLeft(a))}`;
  if (home) h += ` · vende por ${sellPrice(a).toLocaleString('pt-BR')} (na Loja › Animais)`;
  return h;
}
function tipDog(slot) {
  const d = S().dogs && S().dogs[slot];
  if (!dogAlive(d)) return isHome() ? `<b>Casinha vazia</b><br>Compre um cachorro para vigiar ${SLOT[slot].a}.` : null;
  const b = DOG[d.raca], awake = dogAwake(d);
  let h = `<b>${esc(d.nome)}</b> · ${b.nome}<br>`;
  if (!isHome()) return h + (awake ? 'Acordado e de olho em você!' : 'Dormindo… pode ser a sua chance.');
  h += awake ? `De guarda. Ração por mais ${fmt((d.fedUntil - Date.now()) / 1000)}` : `<span class="warn">Dormindo de fome. Clique para dar ração (você tem ${state.dogFood}).</span>`;
  const dias = Math.max(1, Math.ceil((d.born + b.vida * DAY - Date.now()) / DAY));
  return h + `<br>Vive mais ${dias} ${dias > 1 ? 'dias' : 'dia'}`;
}
function tipAbrigo(id) {
  const b = ABRIGO[id], s = S(), lv = abrigoLv(s, id);
  const quem = b.bichos.map(k => ANIMAL[k].nome.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' e $1');
  if (!lv) return `<b>${b.nome}</b><br>Para ${quem}.<br>${state.level < b.nivel ? `Libera no nível ${b.nivel}.` : `Construir por ${b.precos[0].toLocaleString('pt-BR')} moedas. Clique para ver.`}`;
  let h = `<b>${b.nome}</b> · nível ${lv}<br>${livesIn(s, id).length} de ${ABRIGO_CAP[lv]} animais · ${quem}`;
  if (isHome()) h += '<br>Clique para ver quem mora aqui e comprar bichos.';
  return h;
}
function tipBicho(i) {
  const c = crittersOf(scene).list[i];
  return c ? `<b>${BICHO[c.tipo].nome}</b><br>Clique para ouvir.` : null;
}
function tipEnfeite(id, key, sc) {
  const e = ENFEITE[id]; if (!e) return null;
  if (e.fruteira) { const o = key && objetosDe(S(), sc || scene)[Number(String(key).slice(4))]; if (o) return tipFruteira(o); }
  return `<b>${e.nome}</b><br>+${e.conforto}% de XP${e.especial ? `<br>${origemEnfeite(e, S())}` : ''}${isHome() ? '<br>Mude de lugar com o botão Mover.' : ''}`;
}
function tipLand() {
  const next = EXPANSOES[state.exp + 1];
  if (freeLots()) return `<b>Terra para colocar</b><br>Clique duas vezes num + encostado na sua terra.`;
  if (!next) return null;
  return `<b>Próxima expansão</b><br>+${next.total - EXPANSOES[state.exp].total} canteiros · ${next.preco.toLocaleString('pt-BR')} moedas · nível ${next.nivel}<br>Clique para ver todas.`;
}
function tipDecor(id) {
  const m = emUso(S(), id);
  if (m) return `<b>${m.nome}</b><br>+${m.conforto} de conforto${isHome() ? '<br>Clique para trocar o modelo.' : ''}`;
  return `<b>Lugar para ${LUGAR_NOME[id].toLowerCase()}</b><br>Veja os modelos na Loja › Casa.`;
}
let lastTip = '';
function updateTip() {
  const show = hover && $('#ctxMenu').hidden && (pointer.inside && !pointer.touch || performance.now() < pointer.tipUntil);
  const html = !show ? null : hover.kind === 'plot' ? tipPlot(hover.i) : hover.kind === 'animal' ? tipAnimal(hover.id) : hover.kind === 'dog' ? tipDog(hover.slot) : hover.kind === 'canil' ? tipCanil(hover.slot) : hover.kind === 'caminha' ? tipCaminha(hover.id) : hover.kind === 'abrigo' ? tipAbrigo(hover.id) : hover.kind === 'land' ? tipLand() : hover.kind === 'caca' ? (state.level >= CACA_NIVEL ? '<b>🎯 Trilha da caçada</b><br>Clique para caçar pragas com o estilingue ou a espingarda, e armar a arapuca.' : `<b>🎯 Trilha da caçada</b><br>Libera no nível ${CACA_NIVEL}.`) : hover.kind === 'bicho' ? tipBicho(hover.i) : hover.kind === 'avatar' ? (hover.quem === 'dono' ? `<b>${esc(view.nome)}</b><br>${view.avatar && view.avatar.sexo === 'f' ? 'Dona' : 'Dono'} de ${esc(view.fazenda || 'Roça Feliz')}. Clique para dar um oi.` : `<b>${esc(meuApelido())}</b>${meuApelido() === 'Você' ? '' : ' (você)'}<br>Clique para dar um oi.`) : hover.kind === 'invasor' ? `<b>${invasor ? (invasor.tipo === 'javali' ? '🐗 Javali' : '🐀 Rato') : 'Praga'} na plantação!</b><br>Clique para espantar antes que ele coma.` : hover.kind === 'chocadeira' ? tipChocadeira() : hover.kind === 'armadilha' ? `<b>🪤 Armadilha de pragas</b><br>${armadilhaPronta() ? 'Carregada: pega a próxima praga que invadir a plantação.' : `Recarregando: pronta em ${fmt((state.armadilha.pronta - Date.now()) / 1000)}.`}` : hover.kind === 'mural' ? `<b>📷 Mural da caçada</b><br>${hover.n} foto${hover.n === 1 ? '' : 's'} de bichos. ${isHome() ? 'Clique para abrir o Livro da caçada.' : ''}` : hover.kind === 'folhas' ? '<b>🍂 Monte de folhas</b><br>Clique e o avatar vai rastelar (+XP e umas moedinhas).' : hover.kind === 'lago' ? `<b>🎣 Lago</b><br>Clique para pescar (🪱 ${iscasDe().minhoca || 0} minhocas).` : hover.kind === 'enfeite' ? tipEnfeite(hover.id, hover.key, hover.sc) : hover.kind === 'obj' ? null : hover.kind === 'celeiro' ? `<b>${isHome() ? 'Seu celeiro' : 'Celeiro de ' + esc(view.nome)}</b>${isHome() ? '<br>Clique para ver o que está guardado.' : ''}` : hover.kind === 'casa' ? `<b>${isHome() ? 'Sua casa' : 'Casa de ' + esc(view.nome)}</b><br>${isHome() ? 'Clique para entrar ou trocar o tema.' : 'Clique para entrar.'}` : tipDecor(hover.id);
  if (!html) { tip.hidden = true; lastTip = ''; return; }
  if (html !== lastTip) { tip.innerHTML = html; lastTip = html; }
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = pointer.x + 16, y = pointer.y + 16;
  if (x + w > L.cw) x = pointer.x - w - 12;
  if (y + h > L.ch) y = pointer.y - h - 12;
  tip.style.left = `${Math.max(4, x)}px`; tip.style.top = `${Math.max(4, y)}px`;
}

// ============================================================
// Mouse, toque e teclado
// ============================================================
function pick(x, y) {
  let best = null, bd = Infinity;
  for (const h of hits) { const d = Math.hypot(x - h.x, y - h.y); if (d < h.r && d < bd) { best = h; bd = d; } }
  if (best) return best;
  if (scene === 'roca') { const i = cellAt(x, y); if (i >= 0) return { kind: 'plot', i }; }
  // No rancho, o cercado inteiro abre o abrigo (os bichos lá dentro têm preferência, pelos hits acima)
  if (scene === 'animais') {
    const [u, v] = screenToWorld(x, y);
    for (const b of ABRIGOS) {
      const r = yardOf(b.id);
      if (u >= r.u0 && u < r.u1 && v >= r.v0 && v < r.v1 && (isHome() || abrigoLv(S(), b.id))) return { kind: 'abrigo', id: b.id };
    }
  }
  return null;
}
function localPos(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
// Arrastar move a câmera quando a cena não cabe na tela. Roda do mouse e pinça dão zoom.
let drag = null;
const fingers = new Map();
cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(zoomOf(scene) * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
function pinch(e) {
  if (!fingers.has(e.pointerId)) return false;
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size < 2) return false;
  const [a, b] = [...fingers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
  if (!drag || !drag.pinch) drag = { pinch: d, z: zoomOf(scene), moved: true };
  else setZoom(drag.z * d / drag.pinch);
  return true;
}
const endTouch = e => { fingers.delete(e.pointerId); if (drag && drag.pinch && fingers.size < 2) drag = { x: 0, y: 0, moved: true, dead: true }; };
cv.addEventListener('pointercancel', endTouch);
// Dedo que soltou fora do desenho (em cima de um botão) também tem que sair da conta; senão o jogo
// achava que ainda havia dois dedos na tela e o arrastar travava depois de um zoom de pinça.
// Pinça começando em cima de um botão (fora do desenho) também dá zoom no cenário.
const foraDaPinca = el => el === cv || (el && el.closest && el.closest('.panel, .modal, #ctxMenu, .movebar'));
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !foraDaPinca(e.target)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }, true);
window.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && e.target !== cv && fingers.size >= 2 && pinch(e)) hover = null; }, true);
window.addEventListener('pointerup', e => { if (e.target !== cv) { fingers.delete(e.pointerId); if (drag && drag.dead && !fingers.size) drag = null; } }, true);
window.addEventListener('pointercancel', e => { fingers.delete(e.pointerId); if (!fingers.size && drag && (drag.dead || drag.pinch)) drag = null; }, true);
$('#zoomIn')?.addEventListener('click', () => setZoom(zoomOf(scene) * 1.25));
$('#zoomOut')?.addEventListener('click', () => setZoom(zoomOf(scene) / 1.25));
$('#zoomReset')?.addEventListener('click', () => { setZoom(1); L.pan = { x: 0, y: 0 }; });
cv.addEventListener('pointermove', e => {
  const q = localPos(e); pointer.x = q.x; pointer.y = q.y; pointer.inside = true; pointer.touch = e.pointerType === 'touch';
  if (pinch(e)) { hover = null; return; }
  if (drag && drag.dead) return;
  if (drag && drag.item) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ } }
    if (drag.moved) { const [u, v] = screenToWorld(q.x, q.y); moving.u = Math.round((u + drag.item.du) * 20) / 20; moving.v = Math.round((v + drag.item.dv) * 20) / 20; if (movCerca()) [moving.u, moving.v] = encaixaCerca(moving.u, moving.v, moving.rot || 0); else if (movAgua()) [moving.u, moving.v] = encaixaAgua(moving.u, moving.v); hover = null; }
    return;
  }
  if (drag && L.canPan) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ } }
    if (drag.moved) { clearTimeout(holdTimer); L.pan.x = drag.px + dx; L.pan.y = drag.py + dy; hover = null; return; }
  }
  hover = pick(q.x, q.y);
});
cv.addEventListener('pointerleave', () => { pointer.inside = false; if (!pointer.touch) hover = null; });
// Menu de uma casa, árvore ou enfeite (mover / guardar): no celular, segurando o dedo; no computador, botão direito.
let holdTimer = null, holdFired = false;
function objAt(x, y) {
  if (!isHome() || scene === 'casa') return null;
  // a área de clique cobre o desenho inteiro (largura para cada lado e altura, em casas da grade)
  const CAIXA = { armadilha: [0.25, 0.35], mata: [0.6, 0.8], placa: [0.5, 0.95], casa: [0.55, 1.0], celeiro: [0.62, 1.15], canil: [0.4, 0.65], chocadeira: [0.35, 0.55], arv1: [0.4, 1.05], arv2: [0.4, 1.05], pesqueiro: [0.5, 0.3] };
  let best = null, bd = Infinity;
  for (const o of objList(state, scene)) {
    if (o.key === 'placa' && !landSignText()) continue;
    const q = iso(o.u, o.v), [w, h] = o.cerca ? [0.2, 0.25] : o.id ? [0.32, 0.7] : CAIXA[o.key];
    if (Math.abs(x - q.x) > w * L.W || y > q.y + 0.12 * L.W || y < q.y - h * L.W) continue;
    const d = Math.hypot(x - q.x, y - (q.y - h * L.W / 2));
    if (d < bd) { best = o; bd = d; }
  }
  // sem casa/enfeite ali: um canteiro seu também tem o menu (para mudar de lugar)
  if (!best && scene === 'roca') { const i = cellAt(x, y); if (i >= 0 && state.plots[i].s !== 'locked') return { key: 'plot:' + i, plot: i, u: plotU(i) + 0.5, v: plotV(i) + 0.5 }; }
  // sem nada ali: uma casinha construída do rancho também tem o menu (segurar em cima pra mover)
  if (!best && scene === 'animais') {
    const [wu, wv] = screenToWorld(x, y);
    for (const b of ABRIGOS) {
      if (!abrigoLv(state, b.id)) continue;
      const y0 = yardOf(b.id);
      if (wu >= y0.u0 && wu < y0.u1 && wv >= y0.v0 && wv < y0.v1) return { key: 'abrigo:' + b.id, abrigoNome: ABRIGO[b.id].nome, u: (y0.u0 + y0.u1) / 2, v: (y0.v0 + y0.v1) / 2 };
    }
  }
  return best;
}
function abrirMenuObj(o, x, y) {
  const m = $('#ctxMenu'), nome = o.plot !== undefined ? 'Canteiro' : o.abrigoNome || (o.id ? ENFEITE[o.id].nome : OBJ_INFO[o.key].nome);
  m.innerHTML = `<b>${esc(nome)}</b><button type="button" data-ctx="mover">↔️ Mover</button>${o.id ? '<button type="button" data-ctx="guardar">📦 Guardar no inventário</button>' : ''}<button type="button" data-ctx="fechar">Cancelar</button>`;
  m.dataset.key = o.key;
  m.hidden = false;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${clamp(x - w / 2, 6, L.cw - w - 6)}px`; m.style.top = `${clamp(y - h - 16, 6, L.ch - h - 6)}px`;
  sfx('click');
}
function fecharMenuObj() { $('#ctxMenu').hidden = true; }
$('#ctxMenu').addEventListener('click', e => {
  const b = e.target.closest('[data-ctx]'); if (!b) return;
  const key = $('#ctxMenu').dataset.key; fecharMenuObj();
  if (b.dataset.ctx === 'mover' && key.startsWith('plot:')) {
    const i = Number(key.slice(5));
    moveMode = true; moving = { plot: i, uma: true, u: plotU(i) + 0.5, v: plotV(i) + 0.5 }; renderMoveBtn(); renderTools();
    toast(moveDica('Canteiro'));
  } else if (b.dataset.ctx === 'mover' && key.startsWith('abrigo:')) {
    const id = key.slice(7), y0 = yardOf(id);
    moveMode = true; moving = { key, uma: true, u: (y0.u0 + y0.u1) / 2, v: (y0.v0 + y0.v1) / 2, rot: y0.rot ? 1 : 0 }; renderMoveBtn(); renderTools();
    toast(moveDica(ABRIGO[id].nome));
  } else if (b.dataset.ctx === 'mover') {
    const o = objList(state, scene).find(x => x.key === key);
    moveMode = true; moving = { key, uma: true, u: o ? o.u : 0, v: o ? o.v : 0, rot: o && o.rot }; renderMoveBtn(); renderTools();
    toast(moveDica(o && o.id ? ENFEITE[o.id].nome : OBJ_INFO[key] ? OBJ_INFO[key].nome : 'Pronto'));
  } else if (b.dataset.ctx === 'guardar' && key.startsWith('enf:')) invGuardar(scene, Number(key.slice(4)));
  else if (b.dataset.ctx === 'placa') pedirAjudaFruteira($('#ctxMenu').dataset.sc || scene, Number(key.slice(4)));
  else if (b.dataset.ctx === 'derrubar') derrubarFruteira($('#ctxMenu').dataset.sc || scene, Number(key.slice(4)));
  else if (b.dataset.ctx === 'colher') harvestAll();
  else if (b.dataset.ctx === 'limpar') clearAllWithered();
});
cv.addEventListener('contextmenu', e => {
  const q = localPos(e), o = objAt(q.x, q.y);
  if (!o) return;
  e.preventDefault(); abrirMenuObj(o, q.x, q.y);
});
cv.addEventListener('pointerdown', e => {
  pointer.touch = e.pointerType === 'touch';
  // primeiro dedo de um toque novo: esquece dedos antigos que ficaram presos
  if (e.isPrimary) { fingers.clear(); if (drag && (drag.dead || drag.pinch)) drag = null; }
  if (e.pointerType === 'touch') fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (fingers.size >= 2) return;
  drag = { x: e.clientX, y: e.clientY, px: L.pan.x, py: L.pan.y, moved: false };
  fecharMenuObj();
  if (moveMode && moving && e.pointerType !== 'mouse' && isHome()) {
    // pegou o item que está sendo movido? então o dedo arrasta ele (e não a tela)
    const q = localPos(e), g = iso(moving.u, moving.v), W = L.W;
    if (Math.abs(q.x - g.x) < W * 0.7 && q.y < g.y + W * 0.35 && q.y > g.y - W * 1.2) {
      const [u, v] = screenToWorld(q.x, q.y);
      drag.item = { du: moving.u - u, dv: moving.v - v };
    }
  }
  clearTimeout(holdTimer); holdFired = false;
  if (e.pointerType !== 'mouse' && !moving) { // segurar o dedo (no computador é o botão direito)
    const q = localPos(e), o = objAt(q.x, q.y);
    if (o) holdTimer = setTimeout(() => { if (drag && !drag.moved) { holdFired = true; abrirMenuObj(o, q.x, q.y); } }, 550);
  }
});
cv.addEventListener('pointerup', () => clearTimeout(holdTimer));
cv.addEventListener('pointerup', e => {
  endTouch(e);
  // soltou o item num lugar ruim? encaixa no lugar livre mais perto (se tiver um bem pertinho)
  if (drag && drag.item && drag.moved && moving && moving.plot === undefined && !movCerca() && !movAgua()) [moving.u, moving.v] = pontoLivre(scene, moving.u, moving.v, moving.key, raioMov(), 1.5);
  if (drag && !drag.moved) drag = null;
  else if (drag && drag.dead && !fingers.size) setTimeout(() => { if (drag && drag.dead) drag = null; }, 0);
});
cv.addEventListener('click', e => {
  if (holdFired) { holdFired = false; drag = null; return; } // o clique que termina o "segurar" não conta
  if (drag && (drag.moved || drag.dead)) { drag = null; return; }
  drag = null;
  const q = localPos(e); pointer.x = q.x; pointer.y = q.y;
  if (moveMode && isHome() && scene !== 'casa') return moveClick(q.x, q.y);
  const target = pick(q.x, q.y); hover = target;
  if (pointer.touch) pointer.tipUntil = performance.now() + 2200;
  if (!target) return;
  if (target.kind === 'plot') actPlot(target.i);
  else if (target.kind === 'animal') actAnimal(target.id);
  else if (target.kind === 'decor') actDecor(target.id);
  else if (target.kind === 'dog') actDog(target.slot);
  else if (target.kind === 'canil') { if (isHome()) openPanel('canil'); else { const c = S().dogs[target.slot]; if (c) toast(`Casinha do ${c.nome}.`); } }
  else if (target.kind === 'caminha') { if (isHome()) trocarNome({ animal: target.id }); else { const g = S().animals.find(x => x.id === target.id); if (g) toast(`Caminha do ${g.nome || 'gato'}.`); } }
  else if (target.kind === 'abrigo') actAbrigo(target.id);
  else if (target.kind === 'land') openPanel('terreno');
  else if (target.kind === 'caca') abrirCaca();
  else if (target.kind === 'bicho') actBicho(target.i);
  else if (target.kind === 'lago') abrirPesca();
  else if (target.kind === 'folhas') rastelarFolhas(target.id);
  else if (target.kind === 'invasor') espantarInvasor();
  else if (target.kind === 'chocadeira') openPanel('chocadeira');
  else if (target.kind === 'armadilha') toast(armadilhaPronta() ? '🪤 Armadilha carregada: pega a próxima praga que invadir a plantação.' : `🪤 Armadilha recarregando: pronta em ${fmt((state.armadilha.pronta - Date.now()) / 1000)}.`);
  else if (target.kind === 'mural') { abrirCaca(); if (caca) { cacaLivro = true; renderCaca(); } }
  else if (target.kind === 'avatar' && target.quem === 'dono') { falar('avatar:dono', view.nome, sorteia(FALAS_DONO.concat(FALAS_AVATAR))); sfx('fala'); }
  else if (target.kind === 'avatar') { falar('avatar', meuApelido(), sorteia(FALAS_AVATAR)); sfx('fala'); }
  else if (target.kind === 'enfeite') actEnfeite(target.id, target.key, target.sc);
  else if (target.kind === 'casa') { if (isHome()) openPanel('casaTemas'); else setScene('casa'); }
  else if (target.kind === 'celeiro') { if (isHome()) openPanel('celeiro'); else toast(`Celeiro de ${view.nome}.`); }
});
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (scene !== 'roca' || isGated() || !$('#settings').hidden) return;
  const k = parseInt(e.key, 10), avail = availTools();
  if (k >= 1 && k <= avail.length) setTool(avail[k - 1].id);
});
new ResizeObserver(resize).observe(stage);

// ============================================================
// Configurações: música, sons e tema (ficam salvas neste aparelho)
// ============================================================
function applySettings() {
  if (state && !musicaLiberada(settings.track)) settings.track = 0; // música exclusiva de outra conta
  if (window.RFAudio) window.RFAudio.configure({
    music: settings.music, sfx: settings.sfx, musicVol: settings.musicVol, sfxVol: settings.sfxVol, track: settings.track,
  });
  root.dataset.tema = timeOfDay() === 'noite' ? 'noite' : 'dia';
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* sem armazenamento */ }
  applySettings();
}
const TRACK_INFO = ['Violão e flauta, bem tranquila', 'Valsa lenta de sanfona', 'Viola caipira no fim da tarde', 'Rock rural: guitarra, bateria e viola', 'Viola de raiz em terças', 'Sanfona, zabumba e triângulo', 'Valsa de flauta e violão ao luar'];
// Nomes: dar o primeiro nome é de graça; trocar um nome que já existe custa 100 moedas (cada um).
const CUSTO_NOME = 100;
function custoNomes() {
  const fz = limpaNome($('#nomeFazenda').value), av = limpaNome($('#nomeAvatar').value);
  const muda = [[fz, state.fazenda || ''], [av, state.apelido || '']].filter(([novo, velho]) => novo !== velho);
  return { fz, av, muda: muda.length, custo: muda.filter(([, velho]) => velho).length * CUSTO_NOME };
}
function renderNomes() {
  const fz = $('#nomeFazenda'), av = $('#nomeAvatar'); if (!fz || !state) return;
  if (document.activeElement !== fz && !fz.dataset.editado) fz.value = state.fazenda || '';
  if (document.activeElement !== av && !av.dataset.editado) av.value = state.apelido || '';
  av.placeholder = user ? firstName(user.name) : 'Seu nome';
  $('#nomePrev').textContent = `${limpaNome(fz.value) || 'Roça Feliz'} de ${limpaNome(av.value) || av.placeholder}`;
  const c = custoNomes(), btn = $('#nomesSalvar'), falta = c.custo > state.coins;
  btn.hidden = !c.muda; $('#nomesCancelar').hidden = !c.muda;
  btn.textContent = c.custo ? `Salvar · ${c.custo} moedas` : 'Salvar (grátis)';
  btn.disabled = falta;
  $('#nomesCusto').textContent = falta ? `Faltam ${c.custo - state.coins} moedas para trocar.` : 'Dar o primeiro nome é grátis. Trocar um nome custa 100 moedas.';
}
function limparEdicaoNomes() { delete $('#nomeFazenda').dataset.editado; delete $('#nomeAvatar').dataset.editado; }
function salvarNomes() {
  const c = custoNomes(); if (!c.muda) return;
  if (c.custo > state.coins) { sfx('error'); return toast(`Trocar o nome custa ${c.custo} moedas. Faltam ${c.custo - state.coins}.`, 'bad'); }
  state.coins -= c.custo; state.fazenda = c.fz; state.apelido = c.av; limparEdicaoNomes();
  sfx(c.custo ? 'buy' : 'collect'); done(); renderHUD(); renderSceneInfo(); renderNomes();
  toast(`Nomes salvos: ${minhaFazenda()} de ${meuApelido()}!${c.custo ? ` (−${c.custo} moedas)` : ''}`, 'good');
}
for (const id of ['#nomeFazenda', '#nomeAvatar']) {
  $(id).addEventListener('input', e => { e.target.dataset.editado = '1'; renderNomes(); });
  $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); salvarNomes(); } });
}
$('#nomesSalvar').addEventListener('click', salvarNomes);
$('#nomesCancelar').addEventListener('click', () => { limparEdicaoNomes(); $('#nomeFazenda').value = state.fazenda || ''; $('#nomeAvatar').value = state.apelido || ''; renderNomes(); });
function renderSettings() {
  renderNomes(); renderAvatarCfg(); renderFotosCfg(); renderPushCfg();
  $('#optMusic').checked = settings.music;
  $('#optSfx').checked = settings.sfx;
  $('#volMusic').value = Math.round(settings.musicVol * 100); $('#volMusicOut').textContent = $('#volMusic').value;
  $('#volSfx').value = Math.round(settings.sfxVol * 100); $('#volSfxOut').textContent = $('#volSfx').value;
  const names = window.RFAudio ? window.RFAudio.tracks : ['Música 1', 'Música 2', 'Música 3'];
  $('#tracks').innerHTML = names.map((n, k) => musicaLiberada(k) ? `<button type="button" class="track" role="radio" aria-checked="${settings.track === k}" data-track="${k}">
    <span class="dot"></span><span>${esc(n)}<small>${TRACK_INFO[k] || ''}</small></span></button>`
    : `<button type="button" class="track trava" role="radio" aria-checked="false" aria-disabled="true" data-musica-trava="${esc(n)}"><span class="dot"></span><span>🍀 ${esc(n)}<small>Exclusiva da Loja do Trevo (Loja › 🍀 Trevo)</small></span></button>`).join('');
  document.querySelectorAll('#temaSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tema === settings.tema)));
  document.querySelectorAll('#temaSeg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tema === settings.tema)));
}
// ============================================================
// Notificações no celular (com o jogo fechado)
// ============================================================
// O jogo monta uma agenda do que vai ficar pronto e guarda em push/{uid}. A cada 15 minutos um
// programinha no GitHub (servidor/notificacoes.js) confere as agendas e manda os avisos.
const PUSH_TIPOS = [
  ['colheita', '🌽 Colheita pronta e plantas quase estragando'],
  ['animais', '🐔 Produtos dos animais'],
  ['fabrica', '🏭 Fábrica terminou'],
  ['caminhao', '🚚 Pedidos novos no caminhão'],
  ['pesca', '🎣 Ponto de pesca descansado'],
  ['amigos', '🎁 Amigos: visitas, presentes e pedidos'],
];
const VAPID = () => window.FIREBASE_VAPID_KEY || '';
const pushOk = () => !!(VAPID() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && /^https?:/.test(location.protocol));
function pushCfg() { return state.push || (state.push = { on: false, prefs: Object.fromEntries(PUSH_TIPOS.map(([k]) => [k, true])) }); }
function agendaPush() {
  const agora = Date.now(), lista = [];
  const add = (t, tipo, txt) => { if (t > agora + 60e3 && t < agora + 8 * DAY) lista.push({ t: Math.round(t), tipo, txt }); };
  for (const p of state.plots) {
    if (p.s !== 'growing' || p.podre || !CROP[p.c]) continue;
    const T = phaseTempo(p), crop = CROP[p.c];
    if (p.g < T) add(agora + (T - p.g) / (p.dry ? 0.7 : 1) / acelera(state, crop.prod) * 1000, 'colheita', `${crop.nome} pronto para colher!`);
    else add(agora + (PODRE_APOS - (p.pronto || 0) - 2 * HOUR) * 1000, 'colheita', `⚠️ ${crop.nome} vai estragar em 2 horas! Colha ou use uma poção.`);
  }
  for (const a of state.animals) {
    const d = ANIMAL[a.k];
    if (d && d.tipo === 'prod' && a.fed && !a.ready && PRODUCT[d.prod]) add(agora + (d.tempo - a.g) / acelera(state, d.prod) * 1000, 'animais', `${PRODUCT[d.prod].nome} pronto para recolher!`);
  }
  for (const m of Object.values((state.fab && state.fab.maquinas) || {})) for (const x of m.fila) if (RECEITA[x.r]) add(x.fim, 'fabrica', `${RECEITA[x.r].nome} ficou pronto na fábrica!`);
  add((blocoCaminhao() + 1) * CAMINHAO_BLOCO, 'caminhao', `Chegaram ${CAMINHAO_N} pedidos novos no caminhão!`);
  for (const p of PONTOS) { const prox = !p.solte && temPonto(p.id) && pontosDe().prox[p.id]; if (prox) add(prox, 'pesca', `${p.emoji} ${p.nome} descansou! Pode pescar de novo.`); }
  // um aviso por tipo a cada 20 minutos no máximo
  lista.sort((a, b) => a.t - b.t);
  const ult = {}, out = [];
  for (const x of lista) { if (ult[x.tipo] && x.t - ult[x.tipo] < 20 * 60e3) continue; ult[x.tipo] = x.t; out.push(x); }
  return out.slice(0, 40);
}
// A agenda sobe sozinha poucos segundos depois de cada ação (e na hora em que o app é fechado),
// sem depender do salvamento da roça, que só acontece a cada 30 s.
let pushChave = '', pushTimer = 0, pushInfo = null;
function sincronizarPush(forcar) {
  clearTimeout(pushTimer);
  if (!user || !state || !pushCfg().on || !Cloud.salvarPush) return;
  const agenda = agendaPush(), prefs = pushCfg().prefs;
  const chave = JSON.stringify([prefs, agenda.map(x => [Math.round(x.t / 60e3), x.tipo])]);
  if (!forcar && chave === pushChave) return;
  pushChave = chave;
  Cloud.salvarPush(user.uid, { agenda, prefs, proximo: agenda.length ? agenda[0].t : 9e15, enviadoAte: Date.now(), nome: firstName(user.name) })
    .then(() => { pushInfo = { n: agenda.length, prox: agenda[0], at: Date.now() }; })
    .catch(e => { console.warn('notificações:', e); pushChave = ''; pushErro = (e && (e.code || e.message)) || String(e); });
}
function agendarSyncPush() { if (state && state.push && state.push.on) { clearTimeout(pushTimer); pushTimer = setTimeout(sincronizarPush, 3000); } }
async function ativarNotificacoes() {
  const st = $('#pushStatus');
  if (!user) return (st.textContent = 'Entre com a conta Google para receber avisos.');
  if (!pushOk()) return (st.textContent = 'Este aparelho ou navegador não aceita notificações.');
  st.textContent = 'Pedindo permissão…';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { st.textContent = 'Sem permissão. Libere as notificações da Roça Feliz nas configurações do aparelho.'; return; }
    const reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
    const token = await Cloud.ativarPush(user.uid, VAPID(), reg);
    try { localStorage.setItem('rf-push-token', token); } catch (e) { /* tanto faz */ }
    pushCfg().on = true; done(); sincronizarPush(true);
    st.textContent = 'Pronto! Você vai receber avisos neste aparelho.';
    toast('Notificações ligadas!', 'good');
  } catch (e) {
    console.warn(e);
    pushErro = (e && (e.code || e.message)) || String(e);
    st.textContent = pushErro.includes('permission-denied') ? 'O Firebase recusou: publique as regras novas do firestore.rules.' : `Não deu para ligar: ${pushErro}`;
    return;
  }
  renderPushCfg();
}
let pushErro = '';
// A cada entrada: se este aparelho já tem permissão, registra de novo o "endereço" dele (token).
// O endereço muda de vez em quando (atualização do app, limpeza do navegador) e o servidor apaga os
// que pararam de funcionar; sem isso, o aparelho parava de receber avisos sem ninguém perceber.
async function renovarPush() {
  try {
    if (!user || !pushOk() || Notification.permission !== 'granted') return;
    let tinha = null; try { tinha = localStorage.getItem('rf-push-token'); } catch (e) { /* tanto faz */ }
    if (!tinha && !(state.push && state.push.on)) return; // nunca ligou as notificações
    const reg = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready;
    const token = await Cloud.ativarPush(user.uid, VAPID(), reg);
    try { localStorage.setItem('rf-push-token', token); } catch (e) { /* tanto faz */ }
    if (tinha && tinha !== token && Cloud.desativarPush) Cloud.desativarPush(user.uid, tinha).catch(() => {});
    pushCfg().on = true; sincronizarPush(true);
  } catch (e) { console.warn('renovar notificações:', e); }
}
const pushNesteAparelho = () => { try { return !!localStorage.getItem('rf-push-token') && 'Notification' in window && Notification.permission === 'granted'; } catch (e) { return false; } };
// Testes: "neste aparelho" mostra um aviso na hora (confere permissão e o service worker);
// "pelo servidor" pede para o programinha do GitHub mandar um aviso (chega em até ~15 min).
async function testarAvisoAqui() {
  const st = $('#pushStatus');
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Roça Feliz', { body: 'Teste: as notificações aparecem neste aparelho! 🌽', icon: 'icons/icon-192.png', tag: 'teste' });
    st.textContent = 'Mandei um aviso de teste agora. Apareceu? Se não, libere as notificações do app nas configurações do celular.';
  } catch (e) { st.textContent = `Não consegui mostrar o aviso: ${(e && e.message) || e}`; }
}
async function testarAvisoServidor() {
  const st = $('#pushStatus');
  if (!user) return (st.textContent = 'Entre com a conta Google primeiro.');
  try {
    await Cloud.mandarAviso({ para: user.uid, de: user.uid, tipo: 'teste', txt: 'Teste do servidor: os avisos estão funcionando! 🎉', at: Date.now() });
    st.textContent = 'Pedido de teste enviado. Feche o jogo: o aviso chega na próxima rodada do servidor (1 a 2 minutos com o despertador do cron-job.org ligado).';
  } catch (e) { st.textContent = (e && e.code) === 'permission-denied' ? 'O Firebase recusou: publique as regras novas do firestore.rules.' : `Erro: ${(e && e.message) || e}`; }
}
async function desligarNotificacoes() {
  let token = null; try { token = localStorage.getItem('rf-push-token'); localStorage.removeItem('rf-push-token'); } catch (e) { /* tanto faz */ }
  pushCfg().on = false; done();
  if (user && Cloud.desativarPush) await Cloud.desativarPush(user.uid, token).catch(() => {});
  renderPushCfg(); toast('Notificações desligadas neste aparelho.');
}
function renderPushCfg() {
  const box = $('#pushCfg'); if (!box || !state) return;
  const c = pushCfg(), neste = (() => { try { return !!localStorage.getItem('rf-push-token'); } catch (e) { return false; } })();
  const ligado = c.on && neste && 'Notification' in window && Notification.permission === 'granted';
  box.innerHTML = !VAPID() ? '<p class="hint" style="margin:0">As notificações ainda não foram configuradas no Firebase.</p>'
    : `<div class="setrow"><span>${ligado ? '🔔 Avisos ligados neste aparelho' : '🔕 Avisos desligados neste aparelho'}</span>${ligado ? '<button class="btn ghost" type="button" data-push-off>Desligar</button>' : '<button class="btn gold" type="button" data-push-on>Ativar avisos</button>'}</div>
    ${PUSH_TIPOS.map(([k, n]) => `<div class="setrow"><label for="push_${k}">${n}</label><input type="checkbox" class="switch" id="push_${k}" data-push-tipo="${k}" ${c.prefs[k] !== false ? 'checked' : ''}></div>`).join('')}
    <div class="setrow"><span>Testar</span><span class="stack" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ghost" type="button" data-push-teste-aqui>Neste aparelho</button><button class="btn ghost" type="button" data-push-teste-servidor ${ligado ? '' : 'disabled'}>Pelo servidor</button></span></div>
    <p class="hint" style="margin:0;color:var(--muted);font-size:12px">Permissão: ${'Notification' in window ? { granted: 'liberada', denied: 'bloqueada', default: 'ainda não pedida' }[Notification.permission] : 'sem suporte'} · aparelho registrado: ${neste ? 'sim' : 'não'} · conta: ${user ? 'conectada' : 'não'}${pushInfo ? ` · agenda enviada ${new Date(pushInfo.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: ${pushInfo.n} aviso${pushInfo.n === 1 ? '' : 's'}${pushInfo.prox ? `, próximo às ${new Date(pushInfo.prox.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${esc(pushInfo.prox.txt)})` : ''}` : ''}${pushErro ? ` · último erro: ${esc(pushErro)}` : ''}</p>
    <p class="hint" id="pushStatus" role="status" style="margin:0;color:var(--muted);font-size:13px">Os avisos chegam mesmo com o jogo fechado (podem atrasar alguns minutos).</p>`;
}
// Aviso para um amigo (visita, presente, pedido). Visitas: no máximo um aviso a cada 30 min por amigo.
const avisoFeito = {};
function avisarAmigo(para, tipo, txt) {
  if (!user || !Cloud.mandarAviso || !para) return;
  const k = para + ':' + tipo;
  if (tipo === 'visita' && avisoFeito[k] && Date.now() - avisoFeito[k] < 30 * 60e3) return;
  if (tipo === 'ajuda' && avisoFeito[k] && Date.now() - avisoFeito[k] < 10 * 60e3) return;
  if (tipo === 'chat' && avisoFeito[k] && Date.now() - avisoFeito[k] < 2 * 60e3) return;
  avisoFeito[k] = Date.now();
  Cloud.mandarAviso({ para, de: user.uid, tipo, txt, at: Date.now() }).catch(e => console.warn('aviso:', e));
}

// ---------- Cópias de segurança (Configurações) ----------
let copias = null;
async function verCopias() {
  const box = $('#copiasLista'); if (!box) return;
  box.innerHTML = '<p class="hint" style="margin:0">Procurando cópias…</p>';
  const lista = [];
  try { const c = JSON.parse(localStorage.getItem('roca-feliz-copia') || 'null'); if (c && c.stateJson) lista.push({ id: 'local', nome: `Neste aparelho (${new Date(c.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})`, level: c.level, stateJson: c.stateJson }); } catch (e) { /* sem cópia */ }
  if (user && Cloud.listarBackups) {
    try { for (const b of await Cloud.listarBackups(user.uid)) lista.push({ id: b.id, nome: `Nuvem, ${b.id.split('-').reverse().join('/')}`, level: b.level, stateJson: b.stateJson }); }
    catch (e) { console.warn(e); }
  }
  copias = lista;
  box.innerHTML = lista.length ? lista.map((c, k) => `<div class="setrow"><span>${esc(c.nome)} · <b>nível ${c.level}</b></span><button class="btn ghost" type="button" data-restaurar="${k}">Restaurar</button></div>`).join('')
    : '<p class="hint" style="margin:0">Ainda não há cópias. A primeira é feita hoje, na próxima vez que você entrar.</p>';
}
async function restaurarCopia(k) {
  const c = copias && copias[k]; if (!c) return;
  if (!confirm(`Voltar a roça para esta cópia (nível ${c.level})? A roça de agora (nível ${state.level}) fica guardada como cópia deste aparelho.`)) return;
  const s2 = migrate(JSON.parse(c.stateJson)); if (!s2) return toast('Essa cópia não abriu.', 'bad');
  guardarCopiaLocal(state, 'antes de restaurar uma cópia');
  let rev = state.rev || 0;
  if (user) { try { const r = await Cloud.loadFarm(user.uid); rev = (r && r.rev) || 0; } catch (e) { return toast('Sem conexão com a nuvem agora. Tente de novo.', 'bad'); } }
  s2.owner = user ? user.uid : s2.owner; s2.rev = rev; s2.friends = Array.from(new Set([...(s2.friends || []), ...state.friends]));
  state = s2; nivelNuvem = state.level; nuvemOk = !!user;
  done(); if (user) await cloudSave();
  $('#settings').hidden = true;
  view = { kind: 'home' }; renderTools(); renderHUD(); renderPane(); renderSceneInfo(); renderTabs();
  toast(`Roça restaurada: nível ${state.level}!`, 'good');
}

// ---------- Atualizações ----------
// Busca o index.html do site sem cache e compara a versão com a que está rodando.
// Se tiver versão nova (ou não der para conferir), salva a roça, limpa os caches e recarrega.
const VERSION = document.querySelector('meta[name="rf-version"]')?.content || '?';
async function checkUpdate() {
  const st = $('#updStatus'), btn = $('#checkUpdate');
  btn.disabled = true; st.textContent = 'Procurando versão nova…';
  let remote = null;
  try {
    const r = await fetch(`${location.pathname.replace(/[^/]*$/, '')}index.html?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) remote = ((await r.text()).match(/name="rf-version" content="([^"]+)"/) || [])[1] || null;
  } catch (e) { /* sem internet ou página sem site (versão do Claude) */ }
  if (remote && remote === VERSION) {
    btn.disabled = false;
    st.textContent = `Você já está na versão mais nova (${VERSION}).`;
    return;
  }
  st.textContent = remote ? `Versão ${remote} encontrada! Atualizando…` : 'Recarregando o jogo com os arquivos mais novos…';
  save();
  try { if (user && dirty) await cloudSave(); } catch (e) { /* a roça já está salva no aparelho */ }
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* sem cache */ }
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) { /* sem service worker */ }
  try { sessionStorage.setItem('rf-updated', VERSION); } catch (e) { /* sem armazenamento */ }
  // Um endereço diferente obriga o navegador a baixar a página de novo.
  // Sem o site para comparar (versão do Claude ou sem internet), só recarrega.
  if (remote) location.replace(`${location.pathname}?atualizar=${Date.now()}${location.hash}`);
  else location.reload();
}
function afterUpdate() {
  if (!/[?&]atualizar=/.test(location.search)) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* tanto faz */ }
  let old = null; try { old = sessionStorage.getItem('rf-updated'); sessionStorage.removeItem('rf-updated'); } catch (e) { /* sem armazenamento */ }
  setTimeout(() => toast(old && old !== VERSION ? `Jogo atualizado para a versão ${VERSION}!` : `Jogo recarregado (versão ${VERSION}).`, 'good'), 1200);
}
$('#checkUpdate')?.addEventListener('click', checkUpdate);
// Toda vez que o jogo abre (ou volta a aparecer depois de muito tempo), confere em silêncio se há versão nova.
// Se tiver, salva e recarrega sozinho. Só tenta uma vez por versão, para nunca ficar recarregando sem parar.
async function autoUpdate() {
  if (!/^https?:/.test(location.protocol)) return; // versão do Claude / arquivo local: não tem site para comparar
  let remote = null;
  try {
    const r = await fetch(`${location.pathname.replace(/[^/]*$/, '')}index.html?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) remote = ((await r.text()).match(/name="rf-version" content="([^"]+)"/) || [])[1] || null;
  } catch (e) { return; } // sem internet: joga com o que tem
  if (!remote || remote === VERSION) return;
  try { if (sessionStorage.getItem('rf-auto') === remote) return; sessionStorage.setItem('rf-auto', remote); } catch (e) { return; }
  if (state) save();
  try { if (user && dirty) await cloudSave(); } catch (e) { /* já está salvo no aparelho */ }
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* sem cache */ }
  try { sessionStorage.setItem('rf-updated', VERSION); } catch (e) { /* sem armazenamento */ }
  location.replace(`${location.pathname}?atualizar=${Date.now()}${location.hash}`);
}
let ultimaChecagem = 0;
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultimaChecagem > 30 * 60 * 1000) { ultimaChecagem = Date.now(); autoUpdate(); } });
function openSettings() { if ($('#verTxt')) $('#verTxt').textContent = `Versão ${VERSION}`; if ($('#updStatus')) $('#updStatus').textContent = ''; if ($('#checkUpdate')) $('#checkUpdate').disabled = false; limparEdicaoNomes(); renderSettings(); $('#settings').hidden = false; $('#settings [data-close]').focus(); }
function closeSettings() { $('#settings').hidden = true; $('#openSettings').focus(); }
$('#openSettings').addEventListener('click', openSettings);
$('#giftBtn').addEventListener('click', showGift);
$('#bancaModal').addEventListener('click', bancaModalClick);
$('#bmPreco').addEventListener('change', e => { bm.preco = Math.round(Number(e.target.value) || 0); renderBancaModal(); });
$('#moveBtn').addEventListener('click', () => setMoveMode(!moveMode));
window.addEventListener('keydown', e => { if (e.key === 'Escape' && moveMode) { if (moving) { cancelarMove(); toast('Cancelado.'); } else setMoveMode(false); } });
$('#presente').addEventListener('click', e => {
  const o = e.target.closest('[data-pres]');
  if (o) { $('#presente').hidden = true; return sendFriendGift(presenteParaUid, o.dataset.pres); }
  if (e.target === $('#presente') || e.target.closest('[data-close]')) $('#presente').hidden = true;
});
$('#nomeForm').addEventListener('submit', saveName);
$('#nome').addEventListener('click', e => { if (e.target === $('#nome') || e.target.closest('[data-close]')) fecharNome(); });
$('#giftOpen').addEventListener('click', openGift);
$('#face').closest('.avatar-ring').addEventListener('click', () => {
  openSettings();
  setTimeout(() => $('#fotosCfg').scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
});
$('#gift').addEventListener('click', e => { if (e.target === $('#gift') || e.target.closest('[data-close]')) closeGift(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#gift').hidden) closeGift(); });
$('#settings').addEventListener('click', e => {
  if (e.target === $('#settings') || e.target.closest('[data-close]')) return closeSettings();
  if (avatarClick(e)) return;
  const fb = e.target.closest('[data-foto]'); if (fb && !fb.disabled) return escolherFoto(fb.dataset.foto);
  const mb = e.target.closest('[data-moldura]'); if (mb && !mb.disabled) return escolherMoldura(mb.dataset.moldura);
  if (e.target.closest('#verTutorial')) return iniciarTutorial();
  if (e.target.closest('[data-push-on]')) return ativarNotificacoes();
  if (e.target.closest('#verCopias')) return verCopias();
  const rc = e.target.closest('[data-restaurar]'); if (rc) return restaurarCopia(Number(rc.dataset.restaurar));
  if (e.target.closest('[data-push-off]')) return desligarNotificacoes();
  if (e.target.closest('[data-push-teste-aqui]')) return testarAvisoAqui();
  if (e.target.closest('[data-push-teste-servidor]')) return testarAvisoServidor();
  // Só os botões de dentro da janela (a página inteira também tem data-tema).
  const mt = e.target.closest('[data-musica-trava]');
  if (mt) { sfx('error'); return toast(`🍀 "${mt.dataset.musicaTrava}" é exclusiva da Loja do Trevo. Troque trevos por ela em Loja › 🍀 Trevo.`, 'bad'); }
  const at = e.target.closest('[data-av-trava]');
  if (at) { sfx('error'); return toast(at.dataset.avTrava, 'bad'); }
  const tr = e.target.closest('#tracks [data-track]');
  if (tr) { settings.track = Number(tr.dataset.track); settings.music = true; saveSettings(); renderSettings(); }
  const tm = e.target.closest('#temaSeg [data-tema]');
  if (tm) { settings.tema = tm.dataset.tema; saveSettings(); renderSettings(); }
});
$('#optMusic').addEventListener('change', e => { settings.music = e.target.checked; saveSettings(); });
$('#settings').addEventListener('change', e => {
  const t = e.target.closest('[data-push-tipo]'); if (!t) return;
  pushCfg().prefs[t.dataset.pushTipo] = t.checked; done(); sincronizarPush(true);
});
$('#optSfx').addEventListener('change', e => { settings.sfx = e.target.checked; saveSettings(); });
$('#volMusic').addEventListener('input', e => { settings.musicVol = e.target.value / 100; $('#volMusicOut').textContent = e.target.value; saveSettings(); });
$('#volSfx').addEventListener('input', e => { settings.sfxVol = e.target.value / 100; $('#volSfxOut').textContent = e.target.value; saveSettings(); });
$('#volSfx').addEventListener('change', () => sfx('coin'));
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#settings').hidden) closeSettings(); });
// O som só pode começar depois de um toque ou clique do jogador.
const unlockAudio = () => { if (window.RFAudio) window.RFAudio.unlock(); };
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
// Clique em qualquer botão faz um "tic".
document.addEventListener('click', e => { if (e.target.closest('button')) sfx('click'); }, true);

// ============================================================
// Missões, presente diário, ajuda de volta, coleção, temas, estações, chuva e bichinhos
// ============================================================
// A semana começa na segunda-feira à meia-noite (o dia 0 do calendário foi uma quinta).
const weekOf = d => Math.floor((d + 3) / 7);
const thisWeek = () => weekOf(localDay());

// ---------- Estações: mudam toda segunda-feira ----------
const ESTACOES = [
  { id: 'primavera', nome: 'Primavera', icone: '🌸', plantas: ['alface', 'cenoura', 'morangueiro', 'tomate', 'cebola'],
    grama: ['#86c450', '#9ad35e'], morro: '#6fae43', folha: '#4f9a34', flores: 9, borboletas: 10, flor: true },
  { id: 'verao', nome: 'Verão', icone: '☀️', plantas: ['melancia', 'milho', 'abacaxi', 'maracuja', 'pepino', 'cana', 'maxixe'],
    grama: ['#94c24a', '#a8cf55'], morro: '#79a83f', folha: '#4a8f2a', flores: 2, borboletas: 5 },
  { id: 'outono', nome: 'Outono', icone: '🍂', plantas: ['abobora', 'batata', 'macieira', 'videira', 'soja', 'amendoim'],
    grama: ['#a7b64c', '#b9c05a'], morro: '#8f9c3e', folha: '#d9822b', flores: 0, folhas: true, pelada: true, borboletas: 2 },
  { id: 'inverno', nome: 'Inverno', icone: '❄️', plantas: ['feijao', 'trigo', 'laranjeira', 'limao', 'cafe', 'couve'],
    grama: ['#e3ecf1', '#f3f7fa'], morro: '#d2dfe7', folha: '#2f6e3a', flores: 0, neve: true, pelada: true, borboletas: 0 },
];
const ESTACAO_BONUS = 0.3; // plantas da estação rendem 30% a mais
const estacao = () => ESTACOES[thisWeek() % 4];
const daEstacao = id => estacao().plantas.includes(id);

// ---------- Missões ----------
// ev: o que conta. alvo: por faixa de nível (1–4, 5–14, 15+). need: só aparece se fizer sentido.
const temProd = () => state.animals.some(a => ANIMAL[a.k].tipo === 'prod');
const MISSOES_DIA = [
  { ev: 'colher', txt: 'Colha {n} vezes', alvo: [10, 20, 30] },
  { ev: 'plantar', txt: 'Plante {n} sementes', alvo: [10, 20, 30] },
  { ev: 'regar', txt: 'Regue {n} canteiros (seus ou dos vizinhos)', alvo: [3, 5, 8] },
  { ev: 'coletar', txt: 'Recolha {n} produtos dos animais', alvo: [4, 8, 12], need: temProd },
  { ev: 'alimentar', txt: 'Alimente {n} animais', alvo: [4, 8, 12], need: temProd },
  { ev: 'vender', txt: 'Venda {n} moedas no celeiro', alvo: [300, 1500, 5000] },
  { ev: 'ajudar', txt: 'Ajude os vizinhos {n} vezes', alvo: [3, 5, 8] },
  { ev: 'pegar', txt: 'Pegue {n} itens nas roças dos vizinhos', alvo: [2, 4, 6] },
  { ev: 'adubar', txt: 'Use {n} fertilizantes', alvo: [2, 3, 5] },
  { ev: 'presentear', txt: 'Mande presente para {n} amigos', alvo: [1, 2, 3], need: () => state.friends.length > 0 },
  { ev: 'fabricar', txt: 'Faça {n} coisas na fábrica', alvo: [2, 4, 6], need: () => state.level >= 2 },
  { ev: 'entregar', txt: 'Entregue {n} pedidos do caminhão', alvo: [1, 2, 3] },
  { ev: 'pescar', txt: 'Pesque {n} peixes', alvo: [3, 5, 8] },
  { ev: 'raro', txt: 'Pesque {n} peixe raro (ou melhor)', alvo: [1, 1, 2], need: () => state.level >= 6 },
  { ev: 'cacar', txt: 'Cace ou pegue na arapuca {n} bichos', alvo: [2, 3, 5], need: () => state.level >= CACA_NIVEL },
  { ev: 'cozinhar', txt: 'Prepare {n} prato de peixe na fábrica', alvo: [1, 2, 3], need: () => state.level >= 3 },
  { ev: 'vila', txt: 'Atenda {n} pedido da vila', alvo: [1, 1, 2] },
  { ev: 'visitar', txt: 'Visite {n} roças (amigos ou vizinhos)', alvo: [1, 2, 3] },
  { ev: 'praga', txt: 'Acabe com {n} pragas', alvo: [2, 4, 6] },
  { ev: 'carinho', txt: 'Faça carinho nos bichinhos {n} vezes', alvo: [3, 5, 8], need: () => state.animals.some(a => ANIMAL[a.k].tipo === 'pet') },
  { ev: 'coletar', txt: 'Recolha {n} produtos dos animais', alvo: [8, 15, 25], need: temProd },
];
const MISSOES_DIARIAS_N = 5;
const MISSOES_SEMANA = [
  { ev: 'colher', txt: 'Colha {n} vezes', alvo: [100, 200, 350] },
  { ev: 'plantar', txt: 'Plante {n} sementes', alvo: [100, 200, 350] },
  { ev: 'coletar', txt: 'Recolha {n} produtos dos animais', alvo: [30, 60, 100], need: temProd },
  { ev: 'vender', txt: 'Venda {n} moedas no celeiro', alvo: [4000, 20000, 60000] },
  { ev: 'ajudar', txt: 'Ajude os vizinhos {n} vezes', alvo: [20, 35, 50] },
  { ev: 'estacao', txt: 'Colha {n} vezes plantas da estação', alvo: [15, 30, 60] },
  { ev: 'dourada', txt: 'Faça {n} colheita dourada', alvo: [1, 1, 2] },
  { ev: 'adubar', txt: 'Use {n} fertilizantes', alvo: [10, 20, 30] },
  { ev: 'fabricar', txt: 'Faça {n} coisas na fábrica', alvo: [15, 30, 50], need: () => state.level >= 2 },
  { ev: 'entregar', txt: 'Entregue {n} pedidos do caminhão', alvo: [8, 15, 25] },
  { ev: 'vila', txt: 'Atenda {n} pedidos da vila', alvo: [3, 5, 8] },
  { ev: 'pescar', txt: 'Pesque {n} peixes', alvo: [10, 20, 30] },
  { ev: 'cacar', txt: 'Cace ou pegue na arapuca {n} bichos', alvo: [10, 20, 30], need: () => state.level >= CACA_NIVEL },
];
const faixaNivel = () => state.level < 5 ? 0 : state.level < 15 ? 1 : 2;
function sortear(pool, n) {
  const ok = pool.filter(m => !m.need || m.need()), out = [];
  while (out.length < n && ok.length) out.push(ok.splice(Math.floor(Math.random() * ok.length), 1)[0]);
  return out.map(m => ({ ev: m.ev, txt: m.txt, alvo: m.alvo[faixaNivel()], feito: 0, pego: false }));
}
const premioDia = () => ({ moedas: Math.round((60 + state.level * 15) / 10) * 10, xp: 10 + state.level * 2 });
const premioSemana = () => ({ moedas: Math.round((600 + state.level * 150) / 10) * 10, xp: 80 + state.level * 10, racao: 1 });
// Todo dia, à meia-noite, troca as missões do dia; toda segunda, as da semana.
function rollPeriods() {
  const d = localDay(), w = thisWeek();
  const m = state.missions || (state.missions = { d: -1, w: -1, dia: [], semana: [] });
  const novoDia = m.d !== d;
  if (novoDia) { m.d = d; m.dia = sortear(MISSOES_DIA, MISSOES_DIARIAS_N); }
  else if (m.dia.length < MISSOES_DIARIAS_N) { // quem já tinha só 3 hoje ganha as que faltam
    const tem = new Set(m.dia.map(x => x.ev));
    m.dia.push(...sortear(MISSOES_DIA.filter(x => !tem.has(x.ev)), MISSOES_DIARIAS_N - m.dia.length));
  }
  if (m.w !== w) { m.w = w; m.semana = sortear(MISSOES_SEMANA, 3); }
  if (novoDia && state.helpDay !== d) { state.helpDay = d; npcHelps(); }
  if (novoDia) iscasDe().minhoca = Math.max(iscasDe().minhoca || 0, ISCA_GRATIS_DIA); // 5 minhocas grátis por dia
  rankAtual();
}
function track(ev, n = 1) {
  if (!state) return;
  rankPontos(ev);
  if (!state.missions) rollPeriods();
  let pronto = false;
  for (const m of [...state.missions.dia, ...state.missions.semana]) {
    if (m.ev !== ev || m.feito >= m.alvo) continue;
    m.feito = Math.min(m.alvo, m.feito + n);
    if (m.feito >= m.alvo) pronto = true;
  }
  if (pronto) { toast('Missão cumprida! Pegue o prêmio em Missões.', 'good'); sfx('level'); renderTabs(); }
}
function claimMission(tipo, k) {
  const m = state.missions[tipo][k];
  if (!m || m.pego || m.feito < m.alvo) return;
  const p = tipo === 'dia' ? premioDia() : premioSemana();
  m.pego = true;
  state.coins += p.moedas; addXP(p.xp, null);
  if (p.racao) state.racaoEsp += p.racao;
  sfx('coin');
  const bicho = tipo === 'semana' ? sortearAnimalCred() : null;
  toast(`Prêmio: +${p.moedas.toLocaleString('pt-BR')} moedas e +${p.xp} XP${p.racao ? ' e 1 ração especial' : ''}${bicho ? ` e ${bicho.f ? 'uma' : 'um'} ${bicho.nome.toLowerCase()} para resgatar (Loja › Animais)` : ''}!`, 'good');
  // completou todas do dia (ou da semana)? ganha trevos, uma vez por dia / por semana
  const ms = state.missions, marca = tipo === 'dia' ? 'd' : 'w';
  if (ms[tipo].every(x => x.pego) && ms['trevo_' + tipo] !== ms[marca]) {
    ms['trevo_' + tipo] = ms[marca];
    setTimeout(() => ganharTrevos(TREVO_MISSOES[tipo], tipo === 'dia' ? 'Todas as missões do dia!' : 'Todas as missões da semana!'), 700);
    const fer = tipo === 'dia' ? 'enxada' : 'motosserra'; derrubarDe()[fer]++;
    setTimeout(() => toast(`${tipo === 'dia' ? '🌱 +1 enxada de arrancar' : '⛓️ +1 motosserra'} de prêmio!`, 'good'), 1500);
  }
  renderTabs(); done();
}
const TREVO_MISSOES = { dia: 2, semana: 6 };
const prontasDe = tipo => state && state.missions ? state.missions[tipo].filter(m => m.feito >= m.alvo && !m.pego).length : 0;
const missoesProntas = () => prontasDe('dia') + prontasDe('semana') + ((state && state.newStamps) || 0) + vilaProntos() + trevosPendentes();

// ---------- Presente diário: 7 dias, depois vem uma leva nova ----------
const PRESENTES = [
  [{ moedas: 100 }, { fert: 'basico', n: 2 }, { moedas: 200 }, { racao: 2 }, { fert: 'rapido', n: 1 }, { moedas: 500 }, { moedas: 1000, fert: 'premium', n: 1 }],
  [{ moedas: 150 }, { racaoCao: 2 }, { fert: 'basico', n: 3 }, { moedas: 300 }, { racao: 3 }, { fert: 'rapido', n: 2 }, { moedas: 1500, fert: 'premium', n: 1 }],
  [{ moedas: 200 }, { fert: 'rapido', n: 1 }, { moedas: 400 }, { racao: 2 }, { racaoCao: 3 }, { moedas: 800 }, { moedas: 2000, fert: 'premium', n: 2 }],
];
const leva = () => PRESENTES[(state.gift.ciclo || 0) % PRESENTES.length];
const giftReady = () => state && state.gift && state.gift.last !== localDay();
function giftText(g) {
  const p = [];
  if (g.moedas) p.push(`${g.moedas.toLocaleString('pt-BR')} moedas`);
  if (g.fert) p.push(`${g.n} ${FERT[g.fert].nome.toLowerCase()}`);
  if (g.racao) p.push(`${g.racao} ração especial`);
  if (g.racaoCao) p.push(`${g.racaoCao} ração de cachorro`);
  return p.join(' + ');
}
function openGift() {
  if (!giftReady()) return;
  const g = leva()[state.gift.i];
  if (g.moedas) state.coins += g.moedas;
  if (g.fert) state.fert[g.fert] = (state.fert[g.fert] || 0) + g.n;
  if (g.racao) state.racaoEsp += g.racao;
  if (g.racaoCao) state.dogFood += g.racaoCao;
  state.gift.last = localDay();
  state.gift.i++;
  if (state.gift.i >= 7) { state.gift.i = 0; state.gift.ciclo = (state.gift.ciclo || 0) + 1; }
  sfx('level');
  toast(`Presente do dia: ${giftText(g)}!`, 'good');
  renderGift(); renderGiftBtn(); renderTools(); done();
}
function renderGiftBtn() {
  const b = $('#giftBtn'); if (!b || !state) return;
  const old = b.querySelector('.badge'); if (old) old.remove();
  if (giftReady()) b.insertAdjacentHTML('beforeend', '<span class="badge" aria-label="presente esperando">1</span>');
}
function renderGift() {
  if (!state) return;
  const ready = giftReady(), dia = state.gift.i, lista = leva();
  // Já abriu hoje: o dia de hoje é o anterior (que pode ser o último da leva passada).
  const hoje = ready ? dia : (dia + 6) % 7, levaHoje = ready || dia ? lista : PRESENTES[((state.gift.ciclo || 0) + PRESENTES.length - 1) % PRESENTES.length];
  $('#giftDays').innerHTML = levaHoje.map((g, k) => {
    const cls = k < hoje || (!ready && k === hoje) ? 'got' : k === hoje ? 'today' : '';
    return `<div class="gday ${cls}"><b>Dia ${k + 1}</b><img alt="" src="${giftIcon(g)}"><small>${giftText(g)}</small></div>`;
  }).join('');
  $('#giftOpen').disabled = !ready;
  $('#giftOpen').textContent = ready ? 'Abrir presente' : 'Volte amanhã!';
  $('#giftNote').textContent = ready ? `Hoje é o dia ${hoje + 1} de 7.` : 'Você já abriu o presente de hoje. Depois do dia 7 vem uma leva nova.';
}
const giftIcon = g => g.fert && !g.moedas ? fertIcon(g.fert) : g.racao ? bowlIcon() : g.racaoCao ? dogIcon('caramelo') : makeIcon('gift:' + (g.fert ? 'big' : 'coin'), () => {
  if (g.fert) { // o baú do dia 7
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(18, 40, 60, 40); ctx.fillStyle = '#a86b38'; ctx.fillRect(14, 30, 68, 16);
    ctx.fillStyle = '#f2b705'; ctx.fillRect(44, 30, 8, 50); ctx.fillRect(14, 44, 68, 5);
    ctx.fillStyle = '#ffd54a'; for (const [x, y] of [[30, 22], [62, 18], [48, 12]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); }
    return;
  }
  for (const [x, y] of [[36, 64], [60, 64], [48, 46]]) {
    ctx.fillStyle = '#c98c00'; ctx.beginPath(); ctx.ellipse(x, y + 3, 16, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.ellipse(x, y, 16, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(x, y - 1, 9, 3.5, 0, 0, 7); ctx.fill();
  }
});
function showGift() { renderGift(); $('#gift').hidden = false; $('#giftOpen').focus(); }
function closeGift() { $('#gift').hidden = true; }

// ---------- Amizade com cada amigo ----------
// Sobe 1 ponto por dia, por amigo, toda vez que você ajuda (rega, tira praga, cura planta, alimenta
// animal) ou manda presente para essa pessoa. A cada AMIZADE_POR_NIVEL pontos sobe um nível de amizade
// (até o máximo), e os presentes que você manda pra ela ficam melhores — igual a amizade da vila, mas
// entre jogadores de verdade.
const AMIZADE_POR_NIVEL = 3, AMIZADE_NIVEL_MAX = 4;
const nivelAmizade = uid => clamp(Math.floor((state.amizade[uid] || 0) / AMIZADE_POR_NIVEL), 0, AMIZADE_NIVEL_MAX);
function ganharAmizade(uid) {
  if (!uid) return;
  const key = 'amz:' + uid + ':' + localDay();
  if (state.log[key]) return;
  state.log[key] = Date.now();
  state.amizade[uid] = (state.amizade[uid] || 0) + 1;
}
// ---------- Presentes para os amigos ----------
// Um presente por amigo por dia, para até 5 amigos. Não custa nada para quem manda. Cada opção melhora
// (mais moedas, mais quantidade) conforme o nível de amizade com quem vai receber.
const PRESENTE_AMIGO = [
  { id: 'moedas', nome: lvl => `${100 + lvl * 50} moedas`, dar: (s, lvl) => { s.coins += 100 + lvl * 50; } },
  { id: 'basico', nome: lvl => `${1 + Math.floor(lvl / 2)} fertilizante${lvl >= 2 ? 's' : ''} básico${lvl >= 2 ? 's' : ''}`, dar: (s, lvl) => { s.fert.basico = (s.fert.basico || 0) + 1 + Math.floor(lvl / 2); } },
  { id: 'racao', nome: lvl => { const n = 1 + Math.floor(lvl / 2); return n > 1 ? `${n} rações especiais` : '1 ração especial'; }, dar: (s, lvl) => { s.racaoEsp += 1 + Math.floor(lvl / 2); } },
  { id: 'racaoCao', nome: lvl => `${2 + lvl} rações de cachorro`, dar: (s, lvl) => { s.dogFood += 2 + lvl; } },
  { id: 'animal', minLvl: 2, nome: () => '1 animal surpresa', dar: s => { const l = animaisLiberados(s); if (!l.length) { s.coins += 100; return; } const d = l[Math.floor(Math.random() * l.length)]; (s.animalCred = s.animalCred || {})[d.id] = (s.animalCred[d.id] || 0) + 1; } },
  { id: 'enxada', nome: () => '1 enxada de arrancar', dar: s => { (s.derrubar = s.derrubar || {}).enxada = (s.derrubar.enxada || 0) + 1; } },
  { id: 'motosserra', nome: () => '1 motosserra', dar: s => { (s.derrubar = s.derrubar || {}).motosserra = (s.derrubar.motosserra || 0) + 1; } },
];
const PRESENTE_MAX = 5;
function giftsToday() {
  if (!state.sentGifts || state.sentGifts.d !== localDay()) state.sentGifts = { d: localDay(), to: [] };
  return state.sentGifts;
}
// Antes de enviar, abre uma janelinha para escolher o presente daquele amigo.
let presenteParaUid = null;
function escolherPresente(uid) {
  const g = giftsToday();
  if (g.to.includes(uid)) return toast('Você já mandou um presente para essa pessoa hoje.');
  if (g.to.length >= PRESENTE_MAX) return toast(`Você já mandou ${PRESENTE_MAX} presentes hoje. À meia-noite libera de novo!`);
  presenteParaUid = uid;
  const f = friendInfo[uid], lvl = nivelAmizade(uid);
  $('#presTxt').textContent = `Escolha o presente para ${firstName(f && f.name ? f.name : 'seu amigo')}. Não custa nada!${lvl ? ` Amizade nível ${lvl}: presentes melhores!` : ''}`;
  const icon = { animal: animalIcon('galinha'), basico: fertIcon('basico'), racao: bowlIcon(), racaoCao: dogIcon('caramelo'), enxada: ferramentaIcon('enxada'), motosserra: ferramentaIcon('motosserra') };
  $('#presOpcoes').innerHTML = PRESENTE_AMIGO.filter(p => !p.minLvl || lvl >= p.minLvl).map(p => `<button type="button" class="presopt" data-pres="${p.id}"><img alt="" src="${p.id === 'moedas' ? giftIcon({ moedas: 100 + lvl * 50 }) : icon[p.id]}"><span>${p.nome(lvl)}</span></button>`).join('');
  $('#presente').hidden = false;
  $('#presOpcoes button').focus();
}
// Quando o jogo do amigo perdeu você da lista (erro antigo), o Firebase recusa presentes e visitas.
// Aí o jogo manda sozinho um pedido de "reatar": o amigo aceita com um toque e tudo volta.
async function reatarAmizade(uid, silencioso) {
  if (!user) return;
  const hoje = localDay(); state.reatar = state.reatar || {};
  if (state.reatar[uid] === hoje) { if (!silencioso) toast('O pedido para reatar a amizade já foi enviado hoje. Peça para seu amigo abrir o jogo e aceitar em Amigos.'); return; }
  try {
    await Cloud.sendRequest(uid, { from: user.uid, fromName: meuApelido(), fromPhoto: fotoParaSalvar(), fromMoldura: molduraAtual(), at: Date.now(), reatar: true });
    avisarAmigo(uid, 'pedido', `${meuApelido()} quer reatar a amizade na Roça Feliz!`);
    state.reatar[uid] = hoje; done();
    const f = friendInfo[uid], nome = firstName(f && f.name && !f.erro ? f.name : 'seu amigo');
    if (!silencioso) toast(`A amizade tinha sumido do jogo de ${nome} (erro antigo). Mandei um pedido para reatar: quando aceitar em Amigos, presentes e visitas voltam.`, 'good');
  } catch (e) { console.warn(e); if (!silencioso) toast('Não consegui mandar o pedido para reatar agora. Tente de novo.', 'bad'); }
}
async function sendFriendGift(uid, escolha) {
  if (!user) return;
  const g = giftsToday(), pick = PRESENTE_AMIGO.find(p => p.id === escolha) || PRESENTE_AMIGO[0], lvl = nivelAmizade(uid);
  if (g.to.includes(uid)) return toast('Você já mandou um presente para essa pessoa hoje.');
  if (g.to.length >= PRESENTE_MAX) return toast(`Você já mandou ${PRESENTE_MAX} presentes hoje. À meia-noite libera de novo!`);
  g.to.push(uid); renderPane();
  try {
    await Cloud.sendVisit(uid, { t: 'gift', gift: pick.id, nivel: lvl, from: user.uid, fromName: meuApelido(), at: Date.now() });
    avisarAmigo(uid, 'presente', `🎁 ${meuApelido()} te mandou um presente!`);
    sfx('buy'); addXP(2, null); track('presentear'); ganharAmizade(uid);
    const f = friendInfo[uid];
    toast(`Presente enviado para ${firstName(f && f.name ? f.name : 'seu amigo')}: ${pick.nome(lvl)}!`, 'good');
    done();
  } catch (e) {
    console.warn(e);
    g.to = g.to.filter(x => x !== uid); renderPane();
    if (e && e.code === 'permission-denied') reatarAmizade(uid);
    else toast('Não consegui mandar o presente agora. Tente de novo.', 'bad');
  }
}

// ---------- Presença dos amigos (online / offline) ----------
// Enquanto o jogo está aberto e na tela, marca "online" a cada 5 minutos. Ao sair, marca offline.
const PRESENCA_MS = 5 * 60e3, ONLINE_ATE = 11 * 60e3;
const presenca = {};
let presencaTimer = 0, unsubPresenca = null, presencaDe = '';
function marcarPresenca(online) {
  if (!user || !Cloud.marcarPresenca) return;
  Cloud.marcarPresenca(user.uid, online).catch(e => console.warn('presença:', e));
  clearTimeout(presencaTimer);
  if (online) presencaTimer = setTimeout(() => marcarPresenca(!document.hidden), PRESENCA_MS);
}
function vigiarPresenca() {
  if (!user || !Cloud.watchPresenca) return;
  const lista = state.friends.slice().sort(), chave = lista.join(',');
  if (chave === presencaDe) return;
  presencaDe = chave; if (unsubPresenca) unsubPresenca(); unsubPresenca = null;
  if (lista.length) unsubPresenca = Cloud.watchPresenca(lista, (uid, p) => {
    presenca[uid] = p; if (tab === 'amigos') renderPane(); if (chatCom === uid) renderChatStatus();
  });
}
function statusAmigo(uid) {
  const p = presenca[uid];
  if (!p || !p.visto) return { on: false, txt: 'Offline' };
  const idade = Date.now() - p.visto;
  if (p.online && idade < ONLINE_ATE) return { on: true, txt: 'Online' };
  const min = Math.max(1, Math.round(idade / 60e3));
  return { on: false, txt: min < 60 ? `Visto há ${min} min` : min < 60 * 24 ? `Visto há ${Math.round(min / 60)} h` : `Visto há ${Math.round(min / 1440)} dia${min >= 2880 ? 's' : ''}` };
}
const bolinhaStatus = uid => { const st = statusAmigo(uid); return `<span class="status ${st.on ? 'on' : ''}" title="${st.txt}">${st.txt}</span>`; };
let sessaoConferida = 0;
document.addEventListener('visibilitychange', () => {
  if (!user) return;
  marcarPresenca(!document.hidden);
  if (document.hidden) publicarRanking(true);
  if (!document.hidden && !kicked && Cloud.sessaoAtual && Date.now() - sessaoConferida > 2 * 60e3) {
    sessaoConferida = Date.now();
    Cloud.sessaoAtual(user.uid).then(sess => { if (sess && sess.id !== SESSION.id && sess.at > SESSION.at) kick(sess); }).catch(() => {});
  }
});
window.addEventListener('pagehide', () => { if (user) { marcarPresenca(false); publicarRanking(true); } });

// ---------- Chat com amigos ----------
let chatMsgs = [], chatCom = null, chatUltimoEnvio = 0, chatPrimeira = true;
const CHAT_RAPIDAS = ['Oi! 👋', 'Obrigado pela ajuda! 🙏', 'Me visita? 🏡', 'Te mandei um presente! 🎁', 'Suas plantas estão lindas! 🌽', 'Boa colheita! 🍀', '😂', '❤️'];
const lidoAte = uid => (state && state.chatLido && state.chatLido[uid]) || 0;
function naoLidas(uid) {
  if (!user || !state) return 0;
  return chatMsgs.filter(m => m.de !== user.uid && (!uid || m.de === uid) && state.friends.includes(m.de) && (m.at || 0) > lidoAte(m.de)).length;
}
function onChat(lista) {
  const antes = new Set(chatMsgs.map(m => m.id));
  chatMsgs = lista.filter(m => m && typeof m.txt === 'string' && typeof m.de === 'string');
  if (!chatPrimeira) for (const m of chatMsgs) if (!antes.has(m.id) && m.de !== user.uid && m.de !== chatCom && state.friends.includes(m.de)) {
    const f = friendInfo[m.de]; fetchFriendInfo(m.de);
    const quem = f && f.name && !f.erro ? f.name : (m.nome || 'Amigo');
    toast(`💬 ${quem}: ${m.txt.slice(0, 80)}`, 'good'); sfx('click');
    // jogo minimizado ou em outra aba: aviso do celular/computador na hora
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker)
      navigator.serviceWorker.ready.then(reg => reg.showNotification(`💬 ${quem}`, { body: m.txt.slice(0, 120), icon: 'icons/icon-192.png', tag: 'chat-' + m.de, renotify: true, data: { link: './' } })).catch(() => {});
  }
  chatPrimeira = false;
  if (chatCom) { renderChat(); marcarLido(chatCom); }
  renderTabs(); if (tab === 'amigos') renderPane();
  // limpeza: mensagens com mais de 30 dias saem da sua caixa
  const velho = Date.now() - 30 * DAY;
  for (const m of chatMsgs) if ((m.at || 0) < velho) Cloud.apagarMsg(user.uid, m.id).catch(() => {});
}
function marcarLido(uid) {
  const ult = chatMsgs.filter(m => m.de === uid).reduce((t, m) => Math.max(t, m.at || 0), 0);
  if (ult > lidoAte(uid)) { (state.chatLido ||= {})[uid] = ult; save(); renderTabs(); if (tab === 'amigos') renderPane(); }
}
function abrirChat(uid) {
  if (!user) return toast('Entre com a conta Google para conversar.');
  chatCom = uid; fetchFriendInfo(uid);
  const f = friendInfo[uid];
  $('#chatTitle').textContent = f && f.name && !f.erro ? f.name : 'Conversa';
  renderChatStatus();
  $('#chatRapidas').innerHTML = CHAT_RAPIDAS.map(t => `<button type="button" data-rapida="${esc(t)}">${esc(t)}</button>`).join('');
  $('#chatAviso').hidden = pushNesteAparelho() || !pushOk();
  $('#chat').hidden = false; renderChat(); marcarLido(uid);
  setTimeout(() => { if (!pointer.touch) $('#chatTxt').focus(); }, 50);
}
function renderChatStatus() {
  const el = $('#chatStatus'); if (!el || !chatCom) return;
  const st = statusAmigo(chatCom); el.textContent = st.txt; el.className = 'status' + (st.on ? ' on' : '');
}
function fecharChat() { $('#chat').hidden = true; chatCom = null; }
// Limpa a conversa só da sua caixa (o amigo continua com a cópia dele).
function limparChat() {
  if (!chatCom || !user) return;
  const com = chatCom, conversa = chatMsgs.filter(m => (m.de === user.uid && m.para === com) || (m.de === com && m.para === user.uid));
  if (!conversa.length) return toast('Não tem mensagens para limpar.');
  confirmTwice('chat-limpar:' + com, 'Apagar esta conversa da sua caixa? (O amigo continua com a dele.) Toque de novo para confirmar.', async () => {
    await Promise.all(conversa.map(m => Cloud.apagarMsg(user.uid, m.id).catch(e => console.warn('apagar msg:', e))));
    toast('Conversa limpa! 🧹', 'good'); sfx('water');
  });
}
$('#chatLimpar')?.addEventListener('click', limparChat);
function renderChat() {
  const box = $('#chatLista'); if (!box || !chatCom) return;
  const conversa = chatMsgs.filter(m => (m.de === user.uid && m.para === chatCom) || (m.de === chatCom && m.para === user.uid));
  const f = friendInfo[chatCom], nome = f && f.name && !f.erro ? f.name : 'seu amigo';
  if (!conversa.length) { box.innerHTML = `<div class="vazio">Nenhuma mensagem ainda.<br>Diga oi para ${esc(nome)}! 👋</div>`; return; }
  let dia = '', html = '';
  for (const m of conversa) {
    const d = new Date(m.at || Date.now()), dd = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (dd !== dia) { dia = dd; html += `<div class="chatdia">${dd === new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) ? 'Hoje' : dd}</div>`; }
    html += `<div class="bolha ${m.de === user.uid ? 'eu' : 'ele'}">${esc(m.txt)}<small>${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></div>`;
  }
  const noFim = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.innerHTML = html;
  if (noFim || box.dataset.com !== chatCom) box.scrollTop = box.scrollHeight;
  box.dataset.com = chatCom;
}
async function enviarChat(txt, tentativa = 0) {
  txt = String(txt || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!txt || !chatCom || !user) return;
  if (Date.now() - chatUltimoEnvio < 800) return; // sem enxurrada
  chatUltimoEnvio = Date.now();
  const para = chatCom;
  try {
    await Cloud.enviarMsg(user.uid, para, { txt, at: Date.now(), nome: meuApelido() });
    $('#chatTxt').value = '';
    avisarAmigo(para, 'chat', `💬 ${meuApelido()} te mandou uma mensagem`); // sem o conteúdo, por privacidade
  } catch (e) {
    console.warn(e);
    if (e && e.code === 'permission-denied' && !tentativa) {
      // amizade recém-feita: o lado de lá pode ainda não ter confirmado. Confirma o nosso e tenta de novo.
      oficializar(para); checkSent();
      toast('Confirmando a amizade… já tento mandar de novo.');
      chatUltimoEnvio = 0;
      return setTimeout(() => { if (chatCom === para) enviarChat(txt, 1); }, 3000);
    }
    if (e && e.code === 'permission-denied') toast('A amizade ainda não foi confirmada do lado do seu amigo. Assim que ele abrir o jogo, a mensagem vai. Se continuar, toque em Reatar.', 'bad');
    else toast('Não consegui mandar a mensagem agora. Tente de novo.', 'bad');
  }
}
$('#pesca').addEventListener('click', e => {
  if (e.target === $('#pesca') || e.target.closest('[data-close]')) return fecharPesca();
  if (e.target.closest('#pescaBtn') || e.target.closest('#pescaCv')) { if (puxouNoToque) { puxouNoToque = false; return; } return puxar(); }
  if (e.target.closest('#pescaComprar')) return comprarIscas();
  if (e.target.closest('#pescaTarrafa')) return jogarTarrafa();
  const tp = e.target.closest('[data-trevo-peixe]'); if (tp) { resgatarPeixe(tp.dataset.trevoPeixe); return renderPesca(); }
  if (e.target.closest('[data-trevo-todos]')) { resgatarTodosPeixes(); return renderPesca(); }
  if (e.target.closest('[data-trevo-dominio]')) { resgatarDominio(); return renderPesca(); }
  if (e.target.closest('[data-livro-lago]')) { livroSoLago = !livroSoLago; return renderPesca(); }
  const pb = e.target.closest('[data-ponto]');
  if (pb && pontosArrastou) return;
  if (pb) {
    if (pesca && ['esperando', 'fisgou', 'tarrafa', 'brigando'].includes(pesca.fase)) return;
    if (!temPonto(pb.dataset.ponto)) return comprarPonto(pb.dataset.ponto);
    state.pontoSel = pb.dataset.ponto; save(); pesca = { fase: 'pronto', t0: performance.now() }; sfx('click'); return renderPesca();
  }
  if (e.target.closest('#pescaLivroBtn')) { if (pescaLivro) livroVisto(); pescaLivro = !pescaLivro; return renderPesca(); }
  const ib = e.target.closest('[data-isca]'); if (ib && pesca && !['esperando', 'fisgou', 'brigando', 'tarrafa'].includes(pesca.fase)) { state.iscaSel = ib.dataset.isca; save(); return renderPesca(); }
});
window.addEventListener('keydown', e => {
  if (!$('#pesca').hidden && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    if (!e.repeat) puxar();
  }
  if (e.key === 'Escape' && !$('#pesca').hidden) fecharPesca();
});
// Na briga, a puxada vale no instante do toque (pointerdown), sem esperar o dedo subir.
let puxouNoToque = false;
for (const id of ['#pescaCv', '#pescaBtn']) {
  $(id).addEventListener('pointerdown', e => { if (pesca && pesca.fase === 'brigando') { e.preventDefault(); puxouNoToque = true; puxada(); } });
  $(id).addEventListener('contextmenu', e => e.preventDefault());
}
if (location.protocol === 'file:') window.__pesca = () => pesca; // só para testes locais
if (location.protocol === 'file:') window.__rf = { iso: (u, v) => iso(u, v), st: () => state, mov: () => moving, bicho: id => bichoIcon(id), planta: (id, st) => makeIcon('pt:' + id + st, () => drawPlant(48, 80, 2.6, CROP[id], st, 0, false)), enf: id => enfeiteIcon(id) }; // só para testes locais
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); enviarChat($('#chatTxt').value); });
$('#chat').addEventListener('click', e => {
  if (e.target === $('#chat') || e.target.closest('[data-close]')) return fecharChat();
  const r = e.target.closest('[data-rapida]'); if (r) enviarChat(r.dataset.rapida);
});
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#chat').hidden) fecharChat(); });

// ---------- Ajuda de volta ----------
// Quem ajudou a sua roça fica marcado por 2 dias. Ajudar essa pessoa de volta dá um bônus.
const AJUDA_BONUS = { moedas: 50, xp: 15 }, AJUDA_PRAZO = 2 * DAY;
function helpedBy(key, nome) {
  state.owe[key] = { nome, at: Date.now() };
}
function helpBack(pos) {
  const key = view.kind === 'friend' ? view.uid : view.id, o = state.owe[key];
  if (!o) return;
  delete state.owe[key];
  if (Date.now() - o.at > AJUDA_PRAZO) return;
  addCoins(AJUDA_BONUS.moedas, pos); addXP(AJUDA_BONUS.xp, pos);
  toast(`Você retribuiu a ajuda de ${o.nome}! +${AJUDA_BONUS.moedas} moedas`, 'good');
}
// Os vizinhos da vila também dão uma mão de vez em quando (uma vez por dia, no máximo).
function npcHelps() {
  if (Math.random() > 0.6) return;
  const nb = NEIGHBORS[Math.floor(Math.random() * NEIGHBORS.length)];
  const p = state.plots.find(q => q.s === 'growing' && (q.b || q.dry || q.podre));
  if (p) { p.b = 0; p.dry = false; if (p.podre) curar(p); }
  helpedBy(nb.id, nb.nome);
  addNews(`${nb.nome} passou aqui e ${p ? 'cuidou de uma planta sua' : 'deu uma olhada na sua roça'}. Ajude de volta em até 2 dias e ganhe ${AJUDA_BONUS.moedas} moedas!`);
}
const owes = key => state.owe[key] && Date.now() - state.owe[key].at < AJUDA_PRAZO;

// ---------- Livro de coleção ----------
// Cada planta e produto dos animais ganha carimbos com o número de colheitas.
// Cada carimbo também deixa aquele item mais rápido de produzir (acumula até o diamante).
const RAPIDEZ = [0, 0.05, 0.10, 0.15, 0.20];
const menosTempo = (s, prod) => RAPIDEZ[Math.min(RAPIDEZ.length - 1, (s && s.stamps && s.stamps[prod]) || 0)];
const acelera = (s, prod) => 1 / (1 - menosTempo(s, prod));
const CARIMBOS = [
  { n: 10, nome: 'bronze', cor: '#cd7f32', moedas: 100, xp: 10 },
  { n: 50, nome: 'prata', cor: '#b8c2cc', moedas: 500, xp: 50 },
  { n: 200, nome: 'ouro', cor: '#f2b705', moedas: 2000, xp: 150 },
  { n: 500, nome: 'diamante', cor: '#6fd3f2', moedas: 5000, xp: 400 },
];
const COLECAO = () => [...CROPS.map(c => ({ id: c.prod, nome: c.prodNome, icon: () => cropIcon(c.id), nivel: c.nivel })),
  ...PRODUCTS.filter(p => p.id !== 'leitao').map(p => ({ id: p.id, nome: p.nome, icon: () => productIcon(p.id), nivel: 0 })),
  ...PEIXES.filter(p => !p.lixo).map(p => ({ id: p.id, nome: p.nome, icon: () => productIcon(p.id), nivel: p.nivel })),
  ...FRUTAS.map(f => ({ id: f.id, nome: f.nome, icon: () => productIcon(f.id), nivel: 0 }))];
function collect(id, pos) {
  const n = state.col[id] = (state.col[id] || 0) + 1, lv = state.stamps[id] || 0, c = CARIMBOS[lv];
  if (!c || n < c.n) return;
  state.stamps[id] = lv + 1; state.newStamps = (state.newStamps || 0) + 1; renderTabs();
  state.coins += c.moedas; addXP(c.xp, pos);
  sfx('level');
  toast(`Carimbo de ${c.nome} no livro de coleção: ${item(id).nome}! +${c.moedas.toLocaleString('pt-BR')} moedas · agora fica pronto ${Math.round(RAPIDEZ[lv + 1] * 100)}% mais rápido`, 'good');
}

// ---------- Temas da roça ----------
const TEMAS = [
  { id: 'classico', nome: 'Clássico', nivel: 1, custo: 0, desc: 'Cerca de madeira e macieiras.', trilho: '#b98050', poste: '#a4703f', topo: '#c99260' },
  { id: 'branca', nome: 'Cerca branca', nivel: 5, custo: 3000, desc: 'Cerca branca com roseiras.', trilho: '#f4f1ea', poste: '#dcd6ca', topo: '#ffffff', rosas: true },
  { id: 'pedra', nome: 'Muro de pedra', nivel: 10, custo: 6000, desc: 'Muro baixo de pedra, bem de sítio.', trilho: '#a8a294', poste: '#8f897b', topo: '#c7c1b3', pedra: true },
  { id: 'tropical', nome: 'Tropical', nivel: 15, custo: 10000, desc: 'Cerca de bambu e coqueiros.', trilho: '#c9b35a', poste: '#8fae3e', topo: '#b5cf5a', bambu: true, coqueiro: true },
  { id: 'lago', nome: 'Lago dos patos', nivel: 20, custo: 15000, desc: 'Cerca azul e um lago com patinhos.', trilho: '#6b8fb5', poste: '#4f7299', topo: '#8fb0d1', lago: true },
];
const TEMA = Object.fromEntries(TEMAS.map(t => [t.id, t]));
const temaDe = s => TEMA[s && s.tema] || TEMA.classico;
function buyTema(id) {
  const t = TEMA[id];
  if (state.temas[id]) { state.tema = id; toast(`Tema ${t.nome} na roça!`, 'good'); if (isHome()) setScene('roca'); return done(); }
  if (state.level < t.nivel) return toast(`${t.nome} libera no nível ${t.nivel}.`);
  if (state.coins < t.custo) return toast(`${t.nome} custa ${t.custo.toLocaleString('pt-BR')} moedas.`, 'bad');
  state.coins -= t.custo; state.temas[id] = true; state.tema = id;
  sfx('buy'); addXP(10, null);
  toast(`Tema ${t.nome} comprado e colocado na roça!`, 'good');
  if (isHome()) { setScene('roca'); closePanel(); }
  done();
}
const temaIcon = id => makeIcon('tema:' + id, () => {
  L.W = 40; L.ox = 48; L.oy = 30;
  const tm = TEMA[id];
  quad(iso(0, 0), iso(1.6, 0), iso(1.6, 1.6), iso(0, 1.6), '#8cc84b');
  if (tm.lago) { ctx.fillStyle = '#5aa9e6'; ctx.beginPath(); ctx.ellipse(48, 62, 22, 10, 0, 0, 7); ctx.fill(); }
  fenceRun(iso(0, 0), iso(1.6, 0), 4, false, tm);
  fenceRun(iso(0, 0), iso(0, 1.6), 4, true, tm);
});

// ---------- Chuva (e neve no inverno) ----------
// Cada bloco de 20 minutos tem uma chance de começar com 5 minutos de chuva. É o mesmo para todo mundo.
const CHUVA_BLOCO = 20 * 60e3, CHUVA_DURA = 5 * 60e3;
function hash01(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const raining = () => { const b = Math.floor(Date.now() / CHUVA_BLOCO); return hash01(b) < 0.2 && Date.now() - b * CHUVA_BLOCO < CHUVA_DURA; };
let wasRaining = false;
function weatherTick() {
  const r = raining();
  if (r) for (const p of state.plots) if (p.s === 'growing') p.dry = false; // a chuva rega tudo
  if (r !== wasRaining) {
    wasRaining = r;
    if (r && !isGated()) toast(estacao().neve ? 'Começou a nevar! A neve está molhando a roça.' : 'Começou a chover! A chuva está regando a roça.', 'good');
  }
  if (window.RFAudio && window.RFAudio.rain) window.RFAudio.rain(r && scene !== 'casa' && !isGated());
}
const DROPS = Array.from({ length: 140 }, () => [Math.random(), Math.random(), 0.6 + Math.random() * 0.8]);
function drawWeather(t) {
  if (!raining()) return;
  const { cw, ch } = L, neve = estacao().neve;
  ctx.fillStyle = neve ? 'rgba(230,240,255,.15)' : 'rgba(40,60,90,.25)'; ctx.fillRect(0, 0, cw, ch);
  if (neve) {
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    for (const [x, y, k] of DROPS) {
      const py = (y * ch + t * 0.03 * k) % ch, px = (x * cw + Math.sin(t / 900 + y * 20) * 12) % cw;
      ctx.beginPath(); ctx.arc(px, py, 1.5 + k, 0, 7); ctx.fill();
    }
    return;
  }
  ctx.strokeStyle = 'rgba(70,110,170,.6)'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const [x, y, k] of DROPS) {
    const py = (y * ch + t * 0.6 * k) % ch, px = (x * cw - py * 0.15 + cw) % cw;
    ctx.moveTo(px, py); ctx.lineTo(px - 4, py + 16 * k);
  }
  ctx.stroke();
}

// ---------- Borboletas, sapos, porquinhos-da-índia, grilos e vaga-lumes ----------
let bando = { t0: -1e9, y: 0.4 };
// Os bichinhos moram no chão da cena (coordenadas da grade), então acompanham o zoom e o arrasto.
// Sapos pulam, porquinhos-da-índia passeiam e mordiscam, grilos dão pulinhos; borboletas voam por cima.
const CRIT_TIPOS = ['sapo', 'sapo', 'preá', 'preá', 'grilo', 'grilo', 'grilo'];
const CRIT_CORES = [['#c98a4b', '#fff4e0'], ['#5a3a22', '#e8c9a0'], ['#e8e0d0', '#c98a4b']];
const critters = {};
// Lugares de grama onde eles podem ficar: na roça, os lotes ainda sem canteiro; no rancho, em volta dos cercados.
function centroRoca() {
  let su = 0, sv = 0, n = 0;
  S().plots.forEach((p, i) => { if (p.s !== 'locked') { su += plotU(i) + 0.5; sv += plotV(i) + 0.5; n++; } });
  return n ? [su / n, sv / n] : [2, 2];
}
function critterHome(sc) {
  if (sc === 'roca') {
    // só a grama perto da plantação (o mapa é enorme: sorteando no mapa todo, os bichinhos ficavam longe da tela)
    const pl = S().plots, livres = [];
    for (let i = 0; i < N; i++) {
      if (pl[i].s !== 'locked' || plotCeu(i)) continue;
      const c = i % COLS, r = Math.floor(i / COLS); let perto = false;
      for (let dr = -3; dr <= 3 && !perto; dr++) for (let dc = -3; dc <= 3; dc++) {
        const cc = c + dc, rr = r + dr;
        if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && pl[rr * COLS + cc].s !== 'locked') { perto = true; break; }
      }
      if (perto) livres.push([plotU(i) + 0.5, plotV(i) + 0.5]);
    }
    if (livres.length) return livres[Math.floor(Math.random() * livres.length)];
    const [cu, cv] = centroRoca(); return [cu - 3 + Math.random() * 2, cv + Math.random() * 4];
  }
  return Math.random() < 0.6 ? [Math.random() * RANCH_C, RANCH_R + 0.5 + Math.random() * 1.2] : [-1.2 - Math.random(), Math.random() * RANCH_R];
}
function crittersOf(sc) {
  if (critters[sc]) return critters[sc];
  const list = CRIT_TIPOS.map((tipo, k) => {
    const [u, v] = critterHome(sc);
    return { tipo, u, v, hu: u, hv: v, fu: u, fv: v, tu: u, tv: v, t0: 0, dur: 1, wait: Math.random() * 3, dir: Math.random() < 0.5 ? 1 : -1, cor: CRIT_CORES[k % 3] };
  });
  const [cu, cv] = sc === 'roca' ? centroRoca() : [RANCH_C / 2, RANCH_R / 2 + 1], sp = sc === 'roca' ? 4 : 6;
  const flies = Array.from({ length: 10 }, (_, k) => ({ u: cu + (Math.random() - 0.5) * 2 * sp, v: cv + (Math.random() - 0.5) * 2 * sp, s: Math.random() * 10, cor: ['#ffd54a', '#ffffff', '#ff9a3c', '#6fb6ff', '#f48fb1', '#b388ff', '#ffffff', '#ffd54a', '#80deea', '#ff8a65'][k] }));
  return (critters[sc] = { list, flies });
}
function moveCritter(c, t) {
  const age = (t - c.t0) / 1000;
  if (age < c.dur) return age / c.dur;
  c.u = c.tu; c.v = c.tv;
  if (age < c.dur + c.wait) return 1;
  // escolhe o próximo passo perto de casa
  const far = c.tipo === 'preá' ? 0.5 : c.tipo === 'sapo' ? 0.45 : 0.25;
  c.fu = c.u; c.fv = c.v;
  c.tu = clamp(c.u + (Math.random() - 0.5) * far * 2, c.hu - 0.9, c.hu + 0.9);
  c.tv = clamp(c.v + (Math.random() - 0.5) * far * 2, c.hv - 0.9, c.hv + 0.9);
  const sx = (c.tu - c.fu) - (c.tv - c.fv); if (Math.abs(sx) > 0.01) c.dir = sx > 0 ? 1 : -1;
  c.dur = c.tipo === 'preá' ? 1.6 : c.tipo === 'sapo' ? 0.45 : 0.25;
  c.wait = c.tipo === 'preá' ? 1 + Math.random() * 3 : c.tipo === 'sapo' ? 2 + Math.random() * 4 : 1 + Math.random() * 2.5;
  c.t0 = t;
  return 0;
}
// Clique num bichinho: ele faz o seu som e dá um pulinho (ou sai andando).
const BICHO = { sapo: { nome: 'Sapo', som: 'sapo', fala: 'Croac!' }, 'preá': { nome: 'Porquinho-da-índia', som: 'prea', fala: 'Uíí!' }, grilo: { nome: 'Grilo', som: 'grilo', fala: 'Cri-cri!' } };
function actBicho(i) {
  const c = crittersOf(scene).list[i]; if (!c) return;
  const b = BICHO[c.tipo], q = P(c.u, c.v, 0.25);
  sfx(b.som);
  popupAt(q, b.fala, '#ffffff');
  c.t0 = -1e9; c.wait = 0; // já parte para o próximo pulo
}
function drawFrog(x, y, s, dir, t, jump) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = '#3f8a2a';
  ctx.beginPath(); ctx.ellipse(-6, -2, 5, 3, -0.4, 0, 7); ctx.fill(); // perna de trás
  ctx.fillStyle = '#5cb043';
  ctx.beginPath(); ctx.ellipse(0, -6, 8, 5.5, -0.15, 0, 7); ctx.fill();
  if (!jump) { const puff = Math.max(0, Math.sin(t / 250)) ** 6; ctx.fillStyle = '#e8f0a0'; ctx.beginPath(); ctx.ellipse(5, -3, 3 + puff * 2.5, 2 + puff * 2, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#5cb043'; ctx.beginPath(); ctx.arc(3, -11, 3, 0, 7); ctx.arc(7, -10.5, 2.8, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3.3, -11.5, 1.8, 0, 7); ctx.arc(7.3, -11, 1.7, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(3.8, -11.5, 0.9, 0, 7); ctx.arc(7.7, -11, 0.9, 0, 7); ctx.fill();
  ctx.fillStyle = '#3f8a2a'; ctx.fillRect(3, -1, 2, 2.5); ctx.fillRect(-2, -1, 2, 2.5);
  ctx.restore();
}
function drawCavy(x, y, s, dir, t, cor, moving) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  const nib = moving ? 0 : Math.max(0, Math.sin(t / 180)) * 0.8;
  ctx.fillStyle = cor[0]; ctx.beginPath(); ctx.ellipse(0, -6, 10, 6.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = cor[1]; ctx.beginPath(); ctx.ellipse(-3, -7, 5, 4, 0.3, 0, 7); ctx.fill();
  ctx.fillStyle = cor[0]; ctx.beginPath(); ctx.ellipse(8, -6 + nib, 5, 4.5, 0.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#e9a0a0'; ctx.beginPath(); ctx.ellipse(6, -11 + nib, 2, 1.5, -0.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(10, -7.5 + nib, 1, 0, 7); ctx.fill();
  ctx.fillStyle = '#d87a7a'; ctx.beginPath(); ctx.arc(12.8, -5 + nib, 0.9, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a3a22'; const k = moving ? Math.sin(t / 90) * 1.2 : 0; ctx.fillRect(-6 + k, -1, 2.5, 1.5); ctx.fillRect(5 - k, -1, 2.5, 1.5);
  ctx.restore();
}
function drawCricket(x, y, s, dir, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.strokeStyle = '#3b2a14'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-6, -8); ctx.lineTo(-8, 0); ctx.stroke(); // perna de pulo
  ctx.beginPath(); ctx.moveTo(4, -4); ctx.quadraticCurveTo(9, -12, 13, -9 + Math.sin(t / 120)); ctx.moveTo(4, -4); ctx.quadraticCurveTo(8, -13, 11, -13); ctx.stroke();
  ctx.fillStyle = '#6b4a1e'; ctx.beginPath(); ctx.ellipse(0, -3.5, 5.5, 2.3, -0.1, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a3212'; ctx.beginPath(); ctx.arc(4.5, -4, 2, 0, 7); ctx.fill();
  ctx.restore();
}
// ============================================================
// Avatar: a pessoa do jogador. Anda pela roça e pelo rancho e vai junto nas visitas.
// ============================================================
const AV_PELE = ['#f6d3b3', '#e8b48a', '#c98b5e', '#9a6440', '#6b4128'];
const AV_CORES_CABELO = ['#2a1a10', '#5a3614', '#a8481e', '#e0b44a', '#b9b4ac'];
const AV_OPC = {
  sexo: [['m', 'Menino'], ['f', 'Menina']],
  cabelo: [['curto', 'Curto'], ['cacheado', 'Cacheado'], ['comprido', 'Comprido'], ['rabo', 'Rabo de cavalo']],
  chapeu: [['sem', 'Sem'], ['palha', 'Palha'], ['bone', 'Boné'], ['cowboy', 'Cowboy'], ['couro', 'Couro'], ['flores', 'Coroa de flores'], ['cangaceiro', 'Cangaceiro'], ['boina', 'Boina'], ['panama', 'Panamá'], ['gorro', 'Gorro de lã']],
  mao: [['nada', 'Nada'], ['vara', 'Vara de pesca'], ['espingarda', 'Espingarda'], ['enxada', 'Enxada'], ['facao', 'Facão'], ['foice', 'Foice'], ['laco', 'Laço'], ['viola', 'Viola'], ['machado', 'Machado'], ['lampiao', 'Lampião'], ['sanfona', 'Sanfona'], ['buque', 'Buquê'], ['regador', 'Regador dourado']],
};
// Roupas: cada um tem as suas (menino e menina têm peças e cores diferentes).
const AV_ROUPAS = {
  m: {
    camisa: [['camiseta', 'Camiseta'], ['xadrez', 'Xadrez'], ['regata', 'Regata']],
    calca: [['jeans', 'Jeans'], ['bermuda', 'Bermuda'], ['macacao', 'Macacão']],
    sapato: [['bota', 'Bota'], ['tenis', 'Tênis'], ['chinelo', 'Chinelo']],
  },
  f: {
    camisa: [['blusa', 'Blusa de babado'], ['florida', 'Florida'], ['regatinha', 'Regatinha']],
    calca: [['saia', 'Saia rodada'], ['jardineira', 'Jardineira'], ['jeansclara', 'Calça jeans']],
    sapato: [['sapatilha', 'Sapatilha'], ['botinha', 'Botinha'], ['sandalia', 'Sandália']],
  },
};
// Itens de avatar que liberam ao subir de nível (os outros já vêm liberados).
const AV_NIVEL = { facao: 5, foice: 10, laco: 15, viola: 20, machado: 25 };
// Itens exclusivos da Loja do Trevo (só depois de comprar com 🍀).
const AV_TREVO = { couro: 'chapeu:couro', flores: 'chapeu:flores', lampiao: 'mao:lampiao', cangaceiro: 'chapeu:cangaceiro', boina: 'chapeu:boina', panama: 'chapeu:panama', gorro: 'chapeu:gorro', sanfona: 'mao:sanfona', buque: 'mao:buque', regador: 'mao:regador' };
const avTravado = (k, id) => (k === 'mao' && AV_NIVEL[id] > (state ? state.level : 1)) || (!!AV_TREVO[id] && !temTrevoItem(AV_TREVO[id]));
const ROUPA_PADRAO = { m: { camisa: 'xadrez', calca: 'jeans', sapato: 'bota' }, f: { camisa: 'blusa', calca: 'saia', sapato: 'sapatilha' } };
const opcoesAvatar = (av, k) => AV_OPC[k] || AV_ROUPAS[av.sexo === 'f' ? 'f' : 'm'][k];
const AV_PADRAO = { sexo: 'm', pele: 1, camisa: 'xadrez', calca: 'jeans', sapato: 'bota', cabelo: 'curto', corCabelo: 1, chapeu: 'sem', mao: 'nada' };
function avatarOk(a) {
  const r = Object.assign({}, AV_PADRAO);
  if (a && typeof a === 'object') {
    for (const k of Object.keys(AV_OPC)) if (AV_OPC[k].some(([id]) => id === a[k])) r[k] = a[k];
    Object.assign(r, ROUPA_PADRAO[r.sexo]);
    for (const k of ['camisa', 'calca', 'sapato']) if (opcoesAvatar(r, k).some(([id]) => id === a[k])) r[k] = a[k];
    if (Number.isInteger(a.pele) && a.pele >= 0 && a.pele < AV_PELE.length) r.pele = a.pele;
    if (Number.isInteger(a.corCabelo) && a.corCabelo >= 0 && a.corCabelo < AV_CORES_CABELO.length) r.corCabelo = a.corCabelo;
    if (!a.cabelo && r.sexo === 'f') r.cabelo = 'comprido'; // avatar antigo: menina de cabelo comprido
  }
  return r;
}
// Chapéu por cima do cabelo.
function drawChapeu(g, tipo) {
  if (tipo === 'palha') {
    g.fillStyle = '#e8c65a'; g.beginPath(); g.ellipse(0, -63, 17, 4.5, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0, -67, 9.5, 7, 0, Math.PI, 0); g.fill(); g.fillRect(-9.5, -67, 19, 4);
    g.fillStyle = '#c8402f'; g.fillRect(-9.5, -66, 19, 2.4);
    g.strokeStyle = 'rgba(140,100,30,.5)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, -63, 13, 3, 0, 0, 7); g.stroke();
  } else if (tipo === 'bone') {
    g.fillStyle = '#3f6fa8'; g.beginPath(); g.ellipse(0, -63, 11, 8.5, 0, Math.PI, 0); g.fill(); g.fillRect(-11, -63.5, 22, 2.5);
    g.fillStyle = '#2c5282'; g.beginPath(); g.ellipse(6, -61.5, 9, 2.6, 0.05, 0, 7); g.fill();
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(0, -67, 2.3, 0, 7); g.fill();
  } else if (tipo === 'cangaceiro') {
    // chapéu de couro em meia-lua, com estrelas douradas
    g.fillStyle = '#7a4a24'; g.beginPath(); g.moveTo(-17, -62); g.quadraticCurveTo(-12, -80, 0, -79); g.quadraticCurveTo(12, -80, 17, -62); g.quadraticCurveTo(0, -66, -17, -62); g.fill();
    g.strokeStyle = '#4a2c14'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#ffd54a'; for (const [x, y] of [[0, -72], [-7, -68], [7, -68]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 1 : 2.4; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }
  } else if (tipo === 'boina') {
    g.fillStyle = '#8a1f2a'; g.beginPath(); g.ellipse(-2, -67, 12, 5.5, -0.15, 0, 7); g.fill();
    g.fillStyle = '#6a1520'; g.fillRect(-9, -64.5, 18, 2);
    g.fillStyle = '#8a1f2a'; g.beginPath(); g.arc(-2, -72.5, 1.4, 0, 7); g.fill();
  } else if (tipo === 'panama') {
    g.fillStyle = '#f4ecd8'; g.beginPath(); g.ellipse(0, -63, 16, 3.8, 0, 0, 7); g.fill();
    g.beginPath(); g.roundRect(-9, -73, 18, 10, 4); g.fill();
    g.fillStyle = '#2a2a2a'; g.fillRect(-9, -66.5, 18, 2.6);
    g.strokeStyle = 'rgba(120,100,60,.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -73); g.lineTo(0, -68); g.stroke();
  } else if (tipo === 'gorro') {
    g.fillStyle = '#3f8ac8'; g.beginPath(); g.ellipse(0, -64, 10.5, 9, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#f4f1ea'; g.fillRect(-10.5, -65.5, 21, 3.5); g.fillRect(-10, -70, 20, 1.6);
    g.beginPath(); g.arc(0, -74, 3, 0, 7); g.fill();
  } else if (tipo === 'couro') {
    // chapéu de couro de vaqueiro, aba larga e cordão trançado
    g.fillStyle = '#6b3f1f'; g.beginPath(); g.ellipse(0, -63, 19, 4.5, 0, 0, 7); g.fill();
    g.fillStyle = '#7a4a24'; g.beginPath(); g.moveTo(-10, -63); g.quadraticCurveTo(-10, -74, 0, -74); g.quadraticCurveTo(10, -74, 10, -63); g.fill();
    g.strokeStyle = '#e8c35a'; g.lineWidth = 1.4; g.setLineDash([2, 1.5]); g.beginPath(); g.moveTo(-10, -65.5); g.lineTo(10, -65.5); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(40,20,5,.5)'; g.lineWidth = 0.7; g.beginPath(); g.ellipse(0, -63, 15, 3, 0, 0, 7); g.stroke();
  } else if (tipo === 'flores') {
    // coroa de flores
    g.strokeStyle = '#4f9a2f'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -64, 10.5, 3, 0, 0, 7); g.stroke();
    const cores = ['#e53b2f', '#ffd54a', '#f06292', '#ffffff', '#ba68c8', '#ff9a3a'];
    for (let k = 0; k < 7; k++) { const a = Math.PI + k * Math.PI / 6, fx = Math.cos(a) * 10.5, fy = -64 + Math.sin(a) * 3; g.fillStyle = cores[k % cores.length]; g.beginPath(); g.arc(fx, fy - 1, 2.4, 0, 7); g.fill(); g.fillStyle = '#f2a900'; g.beginPath(); g.arc(fx, fy - 1, 0.9, 0, 7); g.fill(); }
  } else if (tipo === 'cowboy') {
    g.fillStyle = '#8a5a33'; g.beginPath(); g.moveTo(-19, -64); g.quadraticCurveTo(0, -58, 19, -64); g.quadraticCurveTo(0, -61.5, -19, -64); g.fill();
    g.beginPath(); g.ellipse(0, -62.5, 16, 3.4, 0, 0, 7); g.fill();
    g.fillStyle = '#9a6a3d'; g.beginPath(); g.moveTo(-9, -63); g.lineTo(-8, -72); g.quadraticCurveTo(0, -69, 8, -72); g.lineTo(9, -63); g.fill();
    g.fillStyle = '#4a2c14'; g.fillRect(-9, -66, 18, 2.2);
  }
}
// O que o avatar leva na mão direita (desenhado a partir da mão, que fica em (0, 17) do braço).
function drawNaMao(g, tipo, t) {
  if (tipo === 'vara') {
    g.strokeStyle = '#7a4a24'; g.lineWidth = 1.8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 18); g.lineTo(16, -26); g.stroke();
    g.strokeStyle = 'rgba(60,60,60,.7)'; g.lineWidth = 0.6; const bal = Math.sin(t / 500) * 2;
    g.beginPath(); g.moveTo(16, -26); g.quadraticCurveTo(20 + bal, -8, 19 + bal, 6); g.stroke();
    g.fillStyle = '#d8402f'; g.beginPath(); g.arc(19 + bal, 7, 1.8, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(19 + bal, 7, 1.8, 0, Math.PI); g.fill();
    g.fillStyle = '#4a2c14'; g.beginPath(); g.arc(3, 11, 1.6, 0, 7); g.fill();
  } else if (tipo === 'espingarda') {
    g.save(); g.translate(0, 17); g.rotate(0.5);
    g.fillStyle = '#7a4a24'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(2, 0); g.lineTo(3.5, 10); g.lineTo(-1.5, 11); g.fill();
    g.fillStyle = '#5e646b'; g.fillRect(-1.8, -30, 1.6, 31); g.fillRect(0.2, -30, 1.6, 31);
    g.fillStyle = '#3a3e43'; g.fillRect(-2, -2, 4, 3);
    g.restore();
  } else if (tipo === 'facao') {
    // facão de lâmina larga, apontando para baixo e para frente
    g.fillStyle = '#5a341a'; g.beginPath(); g.roundRect(-1.6, 12, 3.2, 7, 1.2); g.fill();
    g.fillStyle = '#3a3e43'; g.fillRect(-2.4, 18.5, 4.8, 1.4);
    g.fillStyle = '#c3ccd4'; g.beginPath(); g.moveTo(-1.6, 20); g.lineTo(1.8, 20); g.quadraticCurveTo(5.5, 29, 6, 37); g.lineTo(3.4, 36); g.quadraticCurveTo(0.5, 29, -1.6, 20); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(1.4, 21); g.quadraticCurveTo(5, 29, 5.6, 35.5); g.stroke();
  } else if (tipo === 'foice') {
    g.strokeStyle = '#a4703f'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1, 26); g.lineTo(2, -14); g.stroke();
    g.strokeStyle = '#9aa4ac'; g.lineWidth = 2.2; g.beginPath(); g.arc(9, -12, 8, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 0.6; g.beginPath(); g.arc(9, -12, 7, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  } else if (tipo === 'laco') {
    // laço de corda enrolado, balançando de leve
    const bal = Math.sin(t / 600) * 0.12;
    g.save(); g.translate(0, 16.5); g.rotate(bal);
    g.strokeStyle = '#c9a15a'; g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(1 + i * 0.6, 9, 6.5 - i * 0.7, 8.5 - i * 0.6, 0, 0, 7); g.stroke(); }
    g.strokeStyle = '#a57f3e'; g.beginPath(); g.moveTo(1, 17); g.quadraticCurveTo(4, 22, 2, 26); g.stroke();
    g.restore();
  } else if (tipo === 'viola') {
    // viola caipira segurada pelo braço
    g.save(); g.translate(0, 16.5); g.rotate(-0.35);
    g.fillStyle = '#6b3d1c'; g.fillRect(-1.3, -12, 2.6, 16); g.fillRect(-2, -15, 4, 4);
    g.fillStyle = '#c98a3e'; g.beginPath(); g.ellipse(0, 9, 5, 4.2, 0, 0, 7); g.ellipse(0, 15.5, 6.4, 5.4, 0, 0, 7); g.fill();
    g.strokeStyle = '#7a4a1e'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 9, 5, 4.2, 0, 0, 7); g.ellipse(0, 15.5, 6.4, 5.4, 0, 0, 7); g.stroke();
    g.fillStyle = '#3a2410'; g.beginPath(); g.arc(0, 11.5, 1.8, 0, 7); g.fill();
    g.strokeStyle = 'rgba(240,240,220,.8)'; g.lineWidth = 0.35; for (const x of [-0.7, 0, 0.7]) { g.beginPath(); g.moveTo(x, -13); g.lineTo(x, 18); g.stroke(); }
    g.restore();
  } else if (tipo === 'sanfona') {
    // sanfona pendurada no braço
    g.save(); g.translate(1, 20); g.rotate(-0.15);
    g.fillStyle = '#b8203a'; g.fillRect(-9, -6, 5, 14); g.fillRect(4, -6, 5, 14);
    g.fillStyle = '#2a2a2a'; for (let k = 0; k < 4; k++) g.fillRect(-4 + k * 2, -6, 1.2, 14);
    g.fillStyle = '#f4f1ea'; for (let k = 0; k < 4; k++) g.fillRect(-8.5, -4.5 + k * 3.2, 3.8, 1.6);
    g.fillStyle = '#e0b030'; g.fillRect(-9, -6.5, 18, 1); g.fillRect(-9, 7.5, 18, 1);
    g.restore();
  } else if (tipo === 'buque') {
    g.fillStyle = '#4f9a2f'; g.beginPath(); g.moveTo(-2, 18); g.lineTo(2, 18); g.lineTo(5, 8); g.lineTo(-5, 8); g.closePath(); g.fill();
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(-3, 19); g.lineTo(3, 19); g.lineTo(6, 12); g.lineTo(-6, 12); g.closePath(); g.fill();
    for (const [x, y, c] of [[-4, 6, '#e53b2f'], [0, 4, '#ffd54a'], [4, 6, '#f06292'], [-2, 9, '#ba68c8'], [2.5, 9, '#ffffff']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
  } else if (tipo === 'regador') {
    g.save(); g.translate(0, 22);
    g.fillStyle = '#e0b030'; g.beginPath(); g.roundRect(-5, -6, 10, 9, 2); g.fill();
    g.strokeStyle = '#e0b030'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(5, -2); g.lineTo(11, -7); g.stroke(); g.beginPath(); g.arc(0, -7, 3.5, Math.PI, 0); g.stroke();
    g.fillStyle = '#fff4c0'; g.fillRect(-3.5, -4.5, 2, 5);
    g.restore();
  } else if (tipo === 'rastelo') {
    // rastelo puxando as folhas: vai e vem
    const o = Math.sin(t / 130) * 4;
    g.strokeStyle = '#a4703f'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-3 + o * 0.3, 4); g.lineTo(9 + o, 40); g.stroke();
    g.strokeStyle = '#5d6770'; g.lineWidth = 2; g.beginPath(); g.moveTo(3 + o, 40); g.lineTo(15 + o, 40); g.stroke();
    g.lineWidth = 1.2; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(3.5 + o + k * 2.8, 40); g.lineTo(3 + o + k * 2.8, 43.5); g.stroke(); }
    g.lineCap = 'butt';
  } else if (tipo === 'lampiao') {
    // lampião aceso pendurado na mão, com brilho que pulsa
    g.save(); g.translate(0, 18); g.rotate(Math.sin(t / 700) * 0.1);
    const bril = 0.35 + Math.sin(t / 300) * 0.1;
    g.fillStyle = `rgba(255,210,90,${bril})`; g.beginPath(); g.arc(0, 11, 11, 0, 7); g.fill();
    g.strokeStyle = '#3a3e43'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 3); g.stroke();
    g.fillStyle = '#3a3e43'; g.fillRect(-4, 3, 8, 2); g.fillRect(-4.5, 17, 9, 2.5);
    g.fillStyle = 'rgba(255,230,150,.95)'; g.beginPath(); g.roundRect(-3.5, 5, 7, 12, 2); g.fill();
    g.fillStyle = '#ff9a2a'; g.beginPath(); g.ellipse(0, 12, 1.6, 3, 0, 0, 7); g.fill();
    g.strokeStyle = '#3a3e43'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-3.5, 5); g.lineTo(-3.5, 17); g.moveTo(3.5, 5); g.lineTo(3.5, 17); g.stroke();
    g.restore();
  } else if (tipo === 'machado') {
    g.strokeStyle = '#a4703f'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1, 26); g.lineTo(3, -16); g.stroke();
    g.fillStyle = '#8f9aa3'; g.beginPath(); g.moveTo(2, -17); g.lineTo(10, -21); g.quadraticCurveTo(12.5, -15, 10, -8); g.lineTo(2.6, -11); g.fill();
    g.fillStyle = '#d9e0e6'; g.beginPath(); g.moveTo(10, -21); g.quadraticCurveTo(12.5, -15, 10, -8); g.lineTo(9, -9); g.quadraticCurveTo(11, -15, 9, -20); g.fill();
  } else if (tipo === 'enxada') {
    g.strokeStyle = '#a4703f'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1, 26); g.lineTo(3, -18); g.stroke();
    g.fillStyle = '#8f9aa3'; g.beginPath(); g.moveTo(2, -18); g.lineTo(12, -15); g.lineTo(12, -9); g.lineTo(3, -14); g.fill();
  }
}
// Desenha o avatar de frente, com os pés em (x, y). "passo" balança pernas e braços.
function drawAvatar(g, x, y, s, av, t, andando, dir = 1) {
  av = avatarOk(av);
  const pele = AV_PELE[av.pele], f = av.sexo === 'f';
  const ph = andando ? Math.sin(t / 110) : 0, pe = [Math.max(0, ph) * 3, Math.max(0, -ph) * 3];
  const jeans = '#3f6fa8', jeansD = '#2c5282', jeansF = '#7fa8d8', jeansFD = '#5f88bc';
  g.save(); g.translate(x, y); g.scale(s, s); g.translate(0, andando ? -Math.abs(Math.cos(t / 110)) * 1.2 : 0);
  const rr = (x0, y0, w, h, r, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x0, y0, w, h, r); g.fill(); };
  const ombro = f ? 9.3 : 10.5;
  // cabelo comprido fica atrás de tudo
  const corCab = AV_CORES_CABELO[av.corCabelo];
  if (av.cabelo === 'comprido') { g.fillStyle = corCab; g.beginPath(); g.roundRect(-11.5, -60, 23, f ? 30 : 26, 8); g.fill(); }
  if (av.cabelo === 'rabo') { g.fillStyle = corCab; g.beginPath(); g.ellipse(-dir * 9, -52, 4, 10, dir * 0.35 + (andando ? ph * 0.15 : 0), 0, 7); g.fill(); }
  // pernas, calça e calçados
  for (const [k, lx0] of [[0, -6.5], [1, 1.5]]) {
    const up = pe[k], lx = f ? lx0 + (k ? -0.3 : 0.8) : lx0, lw = f ? 4.3 : 5;
    rr(lx, -25 - up, lw, 21, 2, pele);
    if (!f) {
      if (av.calca === 'bermuda') rr(lx - 0.5, -25 - up, 6, 11, 2, '#c9a66b');
      else rr(lx - 0.5, -25 - up, 6, 20, 2, k ? jeansD : jeans);
    } else if (av.calca === 'jeansclara') {
      rr(lx - 0.6, -25 - up, lw + 1.2, 20, 2, k ? jeansFD : jeansF);
      g.fillStyle = k ? jeansFD : jeansF; g.beginPath(); g.moveTo(lx - 0.6, -8 - up); g.lineTo(lx - 1.6, -5 - up); g.lineTo(lx + lw + 1.6, -5 - up); g.lineTo(lx + lw + 0.6, -8 - up); g.fill(); // boca larga
    }
    const sy = -5 - up;
    if (!f) {
      if (av.sapato === 'bota') { rr(lx - 1, sy - 4, 7.5, 9, 2, '#7a4a24'); rr(lx - 1, sy + 3.5, 8, 1.8, 1, '#4a2c14'); }
      else if (av.sapato === 'tenis') { rr(lx - 1, sy, 7.5, 5, 2.2, '#f4f1ea'); g.fillStyle = '#d8402f'; g.fillRect(lx, sy + 1.5, 5.5, 1.3); rr(lx - 1, sy + 4, 7.5, 1.4, 0.7, '#9a9a9a'); }
      else { rr(lx - 1, sy + 3, 7.5, 2.2, 1, '#e08a2e'); rr(lx, sy, 5, 3.5, 1.5, pele); g.strokeStyle = '#3f6fa8'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(lx, sy + 3); g.lineTo(lx + 2.5, sy + 0.8); g.lineTo(lx + 5, sy + 3); g.stroke(); }
    } else if (av.sapato === 'sapatilha') {
      rr(lx - 1, sy + 1, 6.5, 4, 2, '#c8233f'); g.fillStyle = '#ff9fb5'; g.beginPath(); g.ellipse(lx + 2.2, sy + 1.4, 1.6, 0.9, 0, 0, 7); g.fill();
    } else if (av.sapato === 'botinha') {
      rr(lx - 0.8, sy - 3, 6.2, 8, 2, '#c98f57'); rr(lx - 1, sy + 3.6, 6.8, 1.6, 0.8, '#8a5a33'); g.fillStyle = '#f4e1c6'; g.fillRect(lx - 0.8, sy - 3, 6.2, 1.4);
    } else {
      rr(lx - 1, sy + 3.2, 6.8, 1.8, 0.9, '#f4d9a8'); rr(lx, sy + 0.5, 4.5, 3.2, 1.5, pele);
      g.strokeStyle = '#e25b8f'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(lx - 0.3, sy + 2); g.lineTo(lx + 4.8, sy + 2); g.moveTo(lx + 2.2, sy + 0.4); g.lineTo(lx + 2.2, sy + 3.3); g.stroke();
    }
  }
  // cores e mangas de cada peça
  const LOOK = {
    camiseta: ['#d8402f', 8], xadrez: ['#c8402f', 16], regata: ['#f2c14e', 0],
    blusa: ['#f48fb1', 6], florida: ['#b39ddb', 12], regatinha: ['#7fd1b9', 0],
  };
  const [corCamisa, manga] = LOOK[av.camisa] || LOOK.xadrez;
  const corManga = av.camisa === 'xadrez' ? '#a53325' : av.camisa === 'blusa' ? '#f8a8c4' : corCamisa;
  // braços (balançam ao contrário das pernas)
  const angMao = 0.12 + (andando ? -ph * 0.35 : 0) * (av.mao === 'nada' ? 1 : 0.3);
  for (const [sx, k] of [[-1, 1], [1, 0]]) {
    g.save(); g.translate(sx * ombro, -41); g.rotate(sx === 1 ? angMao : sx * 0.12 + (andando ? (k ? ph : -ph) * 0.35 : 0));
    rr(f ? -2.1 : -2.5, 0, f ? 4.2 : 5, 17, 2.3, pele);
    if (manga) {
      if (av.camisa === 'blusa') { g.fillStyle = corManga; g.beginPath(); g.ellipse(0, 2.5, 3.8, 4, 0, 0, 7); g.fill(); } // manga bufante
      else rr(-3, -0.5, 6, manga, 2.5, corManga);
    }
    g.restore();
  }
  // tronco (menina: cintura marcada)
  g.save(); g.beginPath();
  if (f) { g.moveTo(-9.5, -42); g.quadraticCurveTo(-9.5, -44.5, -6, -44.5); g.lineTo(6, -44.5); g.quadraticCurveTo(9.5, -44.5, 9.5, -42); g.quadraticCurveTo(7, -34, 7.6, -30); g.quadraticCurveTo(9.5, -26, 9.5, -23); g.lineTo(-9.5, -23); g.quadraticCurveTo(-9.5, -26, -7.6, -30); g.quadraticCurveTo(-7, -34, -9.5, -42); g.closePath(); }
  else g.roundRect(-10.5, -44, 21, 21, 5);
  g.clip();
  g.fillStyle = corCamisa; g.fillRect(-11, -45, 22, 23);
  if (av.camisa === 'xadrez') {
    g.fillStyle = 'rgba(40,20,20,.35)'; for (let k = -10; k < 11; k += 5) g.fillRect(k, -45, 2, 23);
    g.fillStyle = 'rgba(255,240,220,.3)'; for (let k = -43; k < -22; k += 5) g.fillRect(-11, k, 22, 2);
  }
  if (av.camisa === 'florida') {
    for (const [fx, fy] of [[-5, -40], [3, -37], [-2, -31], [5, -28], [-6, -27], [6, -42]]) {
      g.fillStyle = '#fff'; for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(fx + Math.cos(a * 1.26) * 1.2, fy + Math.sin(a * 1.26) * 1.2, 0.9, 0, 7); g.fill(); }
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(fx, fy, 0.7, 0, 7); g.fill();
    }
  }
  if (av.camisa === 'regata') { g.fillStyle = pele; g.beginPath(); g.ellipse(-11, -44, 5, 7, 0, 0, 7); g.ellipse(11, -44, 5, 7, 0, 0, 7); g.ellipse(0, -45, 5, 3.5, 0, 0, 7); g.fill(); }
  if (av.camisa === 'regatinha') { g.fillStyle = pele; g.beginPath(); g.ellipse(-10, -44, 5.5, 7, 0, 0, 7); g.ellipse(10, -44, 5.5, 7, 0, 0, 7); g.ellipse(0, -45, 5, 3, 0, 0, 7); g.fill(); g.strokeStyle = corCamisa; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-4.5, -39); g.lineTo(-5.5, -45); g.moveTo(4.5, -39); g.lineTo(5.5, -45); g.stroke(); }
  if (av.camisa === 'blusa') { g.fillStyle = '#fff'; for (let k = -5; k <= 5; k += 2.5) { g.beginPath(); g.arc(k, -43.5, 1.6, 0, 7); g.fill(); } }
  if (!f) {
    if (av.calca === 'macacao') {
      g.fillStyle = jeans; g.fillRect(-7, -35, 14, 13); g.fillRect(-11, -26, 22, 5);
      g.strokeStyle = jeans; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-6, -35); g.lineTo(-7, -45); g.moveTo(6, -35); g.lineTo(7, -45); g.stroke();
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(-5, -33, 1.2, 0, 7); g.arc(5, -33, 1.2, 0, 7); g.fill();
    } else { g.fillStyle = av.calca === 'bermuda' ? '#b08d55' : jeansD; g.fillRect(-11, -26, 22, 4); g.fillStyle = '#e8c65a'; g.fillRect(-1.5, -25.5, 3, 3); }
  } else if (av.calca === 'jardineira') {
    g.fillStyle = jeansF; g.fillRect(-6, -35, 12, 12);
    g.strokeStyle = jeansF; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -35); g.lineTo(-6, -45); g.moveTo(5, -35); g.lineTo(6, -45); g.stroke();
    g.fillStyle = '#ff9fb5'; g.beginPath(); g.arc(0, -30, 1.8, 0, 7); g.fill(); // coraçãozinho no bolso
  } else if (av.calca === 'jeansclara') { g.fillStyle = jeansFD; g.fillRect(-11, -26, 22, 3.5); }
  g.restore();
  // saias (por cima das pernas, rodando um pouquinho ao andar)
  if (f && (av.calca === 'saia' || av.calca === 'jardineira')) {
    const roda = andando ? ph * 1.2 : 0, cor = av.calca === 'saia' ? '#e25b8f' : jeansF, bar = av.calca === 'saia' ? '#b83a6b' : jeansFD;
    g.fillStyle = cor; g.beginPath(); g.moveTo(-8.5, -26); g.lineTo(8.5, -26); g.lineTo(12 + roda, -12); g.quadraticCurveTo(0, -9.5, -12 + roda, -12); g.closePath(); g.fill();
    g.strokeStyle = bar; g.lineWidth = 1.6; g.beginPath(); g.moveTo(12 + roda, -12.5); g.quadraticCurveTo(0, -10, -12 + roda, -12.5); g.stroke();
    if (av.calca === 'saia') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, -25); g.lineTo(-5 + roda, -12); g.moveTo(3, -25); g.lineTo(5 + roda, -12); g.stroke(); }
    else { g.fillStyle = jeansFD; g.fillRect(-9, -26, 18, 2.5); }
  }
  // pescoço e cabeça
  rr(-2.3, -47, 4.6, 4, 1, pele); rr(-2.3, -47, 4.6, 4, 1, 'rgba(90,40,20,.2)');
  g.fillStyle = pele; g.beginPath(); if (f) g.ellipse(0, -56, 10.2, 10.6, 0, 0, 7); else g.arc(0, -56, 10.5, 0, 7); g.fill();
  g.fillStyle = pele; g.beginPath(); g.arc(-10.2, -55, 2.3, 0, 7); g.arc(10.2, -55, 2.3, 0, 7); g.fill();
  if (f) { g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(-10.4, -52.6, 1.1, 0, 7); g.arc(10.4, -52.6, 1.1, 0, 7); g.fill(); } // brinquinhos
  // cabelo
  g.fillStyle = corCab;
  if (av.cabelo === 'cacheado') {
    for (let k = 0; k < 9; k++) { const a = Math.PI * (1.0 + k / 8); g.beginPath(); g.arc(Math.cos(a) * 10, -57 + Math.sin(a) * 10, 4.2, 0, 7); g.fill(); }
    g.beginPath(); g.arc(-11, -52, 3.4, 0, 7); g.arc(11, -52, 3.4, 0, 7); g.fill();
    if (f) { g.beginPath(); g.arc(-11.5, -47.5, 3.2, 0, 7); g.arc(11.5, -47.5, 3.2, 0, 7); g.fill(); }
  } else {
    g.beginPath(); g.arc(0, -57, 11, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    if (f) { g.beginPath(); g.moveTo(-10.5, -59); g.quadraticCurveTo(-6, -58, -1, -62.5); g.quadraticCurveTo(4, -57, 10.5, -58); g.lineTo(10, -64); g.lineTo(-10, -64); g.fill(); } // franja de lado
    else { g.beginPath(); g.moveTo(-10.5, -59); g.quadraticCurveTo(-3, -54, 4, -60); g.quadraticCurveTo(8, -56, 10.5, -59); g.lineTo(10, -63); g.lineTo(-10, -63); g.fill(); }
    if (av.cabelo === 'comprido') { g.fillRect(-11.5, -58, 3, f ? 16 : 12); g.fillRect(8.5, -58, 3, f ? 16 : 12); }
    if (av.cabelo === 'rabo') { g.fillStyle = '#e25b8f'; g.beginPath(); g.arc(-dir * 9, -60, 1.8, 0, 7); g.fill(); }
  }
  if (f && av.chapeu === 'sem' && av.cabelo !== 'rabo') { // presilha de florzinha
    g.fillStyle = '#ff7aa2'; for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(7 + Math.cos(a * 1.26) * 1.6, -62 + Math.sin(a * 1.26) * 1.6, 1.3, 0, 7); g.fill(); }
    g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(7, -62, 1, 0, 7); g.fill();
  }
  drawChapeu(g, av.chapeu);
  // rosto (olha um pouquinho para onde anda)
  const o = dir * 1.2;
  if (f) {
    // olhos maiores com brilho e cílios, batom
    g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(-3.8 + o, -55, 1.6, 2.2, 0, 0, 7); g.ellipse(3.8 + o, -55, 1.6, 2.2, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-3.3 + o, -55.8, 0.55, 0, 7); g.arc(4.3 + o, -55.8, 0.55, 0, 7); g.fill();
    g.strokeStyle = '#2a1a10'; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath();
    for (const ex of [-3.8, 3.8]) { const sg = Math.sign(ex); g.moveTo(ex + o + sg * 1.2, -56.6); g.lineTo(ex + o + sg * 2.4, -57.8); g.moveTo(ex + o + sg * 0.3, -57.1); g.lineTo(ex + o + sg * 0.9, -58.6); }
    g.stroke();
    g.fillStyle = 'rgba(240,100,130,.5)'; g.beginPath(); g.ellipse(-6.3 + o, -51.3, 2.4, 1.5, 0, 0, 7); g.ellipse(6.3 + o, -51.3, 2.4, 1.5, 0, 0, 7); g.fill();
    g.fillStyle = '#d9546e'; g.beginPath(); g.moveTo(-2 + o, -51); g.quadraticCurveTo(o, -52, 2 + o, -51); g.quadraticCurveTo(o, -48.8, -2 + o, -51); g.fill();
    g.lineCap = 'butt';
  } else {
    g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(-3.8 + o, -55, 1.3, 1.8, 0, 0, 7); g.ellipse(3.8 + o, -55, 1.3, 1.8, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(230,110,110,.45)'; g.beginPath(); g.ellipse(-6.5 + o, -51.5, 2.3, 1.4, 0, 0, 7); g.ellipse(6.5 + o, -51.5, 2.3, 1.4, 0, 0, 7); g.fill();
    g.strokeStyle = '#7a3a22'; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); g.arc(o, -51.5, 2.6, 0.25, Math.PI - 0.25); g.stroke(); g.lineCap = 'butt';
  }
  if (av.mao !== 'nada') {
    g.save(); g.translate(ombro, -41); g.rotate(angMao);
    drawNaMao(g, av.mao, t);
    g.fillStyle = pele; g.beginPath(); g.arc(0, 16.5, 2.6, 0, 7); g.fill(); // a mão segurando
    g.restore();
  }
  g.restore();
}
// Passeio pela cena: escolhe um ponto, anda até lá, espera um pouco e repete.
const avWalk = {};
function avatarArea(sc) {
  if (sc === 'animais') return { u0: 0.3, u1: RANCH_C - 0.3, v0: RANCH_R + 0.35, v1: RANCH_R + 1.3 };
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  S().plots.forEach((p, i) => { if (p.s !== 'locked') { const c = plotU(i), r = plotV(i); c0 = Math.min(c0, c); c1 = Math.max(c1, c + 1); r0 = Math.min(r0, r); r1 = Math.max(r1, r + 1); } });
  if (c1 <= c0) { c0 = 0; c1 = 3; r0 = 0; r1 = 3; }
  // o avatar passeia numa faixa de grama fora das terras (na frente; se não couber, do lado; senão, fora da cerca)
  // (longe o bastante para o corpo dele não ficar na frente das terras)
  const U1 = RU0 + COLS, V1 = RV0 + ROWS;
  if (V1 - r1 >= 2.8) return { u0: c0 + 0.8, u1: Math.min(U1 - 0.3, Math.max(c0 + 1.2, c1 + 0.8)), v0: r1 + 1.8, v1: Math.min(V1 - 0.25, r1 + 2.6) };
  if (U1 - c1 >= 2.8) return { u0: c1 + 1.8, u1: Math.min(U1 - 0.25, c1 + 2.6), v0: r0 + 0.6, v1: Math.min(V1 - 0.3, Math.max(r0 + 1, r1 + 0.6)) };
  return { u0: c0, u1: c1, v0: r1 + 0.5, v1: r1 + 1.1 };
}
// quem: 'eu' (o seu avatar, que vai junto nas visitas) ou 'dono' (o avatar do dono da roça visitada).
function drawAvatarWalk(sc, t, quem = 'eu') {
  const a = avatarArea(sc), chave = sc + ':' + quem;
  let w = avWalk[chave];
  if (!w || w.dono !== view.kind + (view.id || view.uid || '')) {
    const u = a.u0 + Math.random() * (a.u1 - a.u0), v = a.v0 + Math.random() * (a.v1 - a.v0);
    w = avWalk[chave] = { dono: view.kind + (view.id || view.uid || ''), fu: u, fv: v, tu: u, tv: v, t0: t, dur: 0, wait: 1500, dir: 1 };
  }
  let k = w.dur ? Math.min(1, (t - w.t0) / w.dur) : 1;
  if (quem === 'eu' && w.tarefa && k >= 1) return rastelando(w, sc, t);
  if (k >= 1 && t - w.t0 > w.dur + w.wait && !w.tarefa) {
    w.fu = w.tu; w.fv = w.tv;
    w.tu = clamp(w.fu + (Math.random() - 0.5) * 4, a.u0, a.u1); w.tv = clamp(w.fv + (Math.random() - 0.5) * 4, a.v0, a.v1);
    const dist = Math.hypot(w.tu - w.fu, w.tv - w.fv), sx = (w.tu - w.fu) - (w.tv - w.fv);
    if (Math.abs(sx) > 0.01) w.dir = sx > 0 ? 1 : -1;
    w.t0 = t; w.dur = dist / 0.7 * 1000; w.wait = 1200 + Math.random() * 3500; k = 0;
  }
  const u = w.fu + (w.tu - w.fu) * k, v = w.fv + (w.tv - w.fv) * k, q = iso(u, v), W = L.W;
  const esc = W / 95 * (sc === 'animais' ? 1.25 : 1);
  w.tela = { x: q.x, y: q.y - 70 * esc };
  hits.push({ kind: 'avatar', quem, x: q.x, y: q.y - 34 * esc, r: Math.max(26 * esc, 16) });
  if (hover && hover.kind === 'avatar' && (hover.quem || 'eu') === quem) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.17, W * 0.06, 0, 0, 7); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.13, W * 0.045, 0, 0, 7); ctx.fill();
  // Indo rastelar um monte de folhas: já mostra o rastelo na mão no caminho, não só ao chegar.
  const avTarefa = quem === 'eu' && w.tarefa ? Object.assign({}, state.avatar, { mao: 'rastelo' }) : state.avatar;
  drawAvatar(ctx, q.x, q.y, esc, quem === 'dono' ? view.avatar : avTarefa, t, k < 1, w.dir);
  if (quem === 'eu') drawAraras(u, v, esc, t);
}
// As araras voam junto com o avatar: seguem de longe, devagar, balançando no ar.
const araraSeg = {};
function drawAraras(u, v, esc, t) {
  if (!state) return;
  state.animals.filter(a => a.k === 'arara').slice(0, PET_MAX.arara).forEach((a, i) => {
    const alvoU = u + (i ? 0.5 : -0.5), alvoV = v + (i ? -0.5 : 0.5);
    let f = araraSeg[a.id];
    if (!f || Math.hypot(f.u - alvoU, f.v - alvoV) > 6) f = araraSeg[a.id] = { u: alvoU, v: alvoV, t, dir: 1 };
    const dt = clamp((t - f.t) / 1000, 0, 0.1), kk = 1 - Math.exp(-dt * 2.2);
    const sx = (alvoU - f.u) - (alvoV - f.v);
    f.u += (alvoU - f.u) * kk; f.v += (alvoV - f.v) * kk; f.t = t;
    if (Math.abs(sx) > 0.15) f.dir = sx > 0 ? 1 : -1;
    const q = iso(f.u, f.v), alt = (44 + Math.sin(t / 380 + i * 2) * 5) * esc;
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 9 * esc, 3 * esc, 0, 0, 7); ctx.fill();
    drawAraraVoando(q.x, q.y - alt, esc * 0.7, t + i * 160, f.dir);
  });
}
function drawAraraVoando(x, y, s, t, dir) {
  const bate = Math.sin(t / 95);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = '#2a6fc8'; ctx.beginPath(); ctx.moveTo(-4, 1); ctx.lineTo(-19, 9); ctx.lineTo(-15, 3); ctx.lineTo(-4, -1); ctx.fill();
  ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-17, 5); ctx.lineTo(-13, 0); ctx.lineTo(-4, -1); ctx.fill();
  ctx.save(); ctx.translate(-1, -1); ctx.rotate(-0.2 + bate * 0.7);
  ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(0, -7, 3.2, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a6fc8'; ctx.beginPath(); ctx.ellipse(0, -10, 2.2, 6, 0, 0, 7); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#d8342a'; ctx.beginPath(); ctx.ellipse(1, 0, 7, 3.8, -0.35, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(7, -4, 3.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.ellipse(8, -4, 1.6, 1.3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(8.2, -4.2, 0.55, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.moveTo(9, -5); ctx.quadraticCurveTo(12.5, -4, 10, -1); ctx.lineTo(9, -3); ctx.fill();
  ctx.restore();
}
// ---------- Montes de folhas: de vez em quando aparecem no gramado; o avatar vai lá e rastela ----------
const FOLHAS_MAX = 3;
const folhasIntervalo = () => (estacao().id === 'outono' ? 8 + Math.random() * 8 : 20 + Math.random() * 20) * 60e3; // no outono cai mais folha
function folhasDe() { return state.folhas = Array.isArray(state.folhas) ? state.folhas : []; }
function folhasTick() {
  if (!state || kicked) return;
  const l = folhasDe(), agora = Date.now();
  // Se o monte ficou marcado como "sendo rastelado" mas a tarefa do avatar sumiu (visitou outra
  // fazenda, recarregou a página, etc.), libera ele de novo em vez de deixar preso pra sempre.
  const w = avWalk['roca:eu'];
  for (const f of l) if (f.alvo && (!w || !w.tarefa || w.tarefa.id !== f.id)) f.alvo = false;
  if (!state.folhasProx) { state.folhasProx = agora + 3 * 60e3; return; }
  let n = 0, mudou = false;
  while (agora >= state.folhasProx && n++ < FOLHAS_MAX) { if (l.length < FOLHAS_MAX && novaFolha()) mudou = true; state.folhasProx += folhasIntervalo(); }
  if (agora >= state.folhasProx) state.folhasProx = agora + folhasIntervalo();
  if (mudou) save();
}
// Um lugar livre no gramado da roça, dentro da cerca (fora dos canteiros e sem encostar em nada).
function novaFolha() {
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  state.plots.forEach((p, i) => { if (p.s !== 'locked') { const c = plotU(i), r = plotV(i); c0 = Math.min(c0, c); c1 = Math.max(c1, c + 1); r0 = Math.min(r0, r); r1 = Math.max(r1, r + 1); } });
  if (c1 <= c0) { c0 = 0; c1 = 3; r0 = 0; r1 = 3; }
  for (let k = 0; k < 60; k++) {
    const u = Math.round((c0 - 1.5 + Math.random() * (c1 - c0 + 3.5)) * 20) / 20, v = Math.round((r0 - 1.5 + Math.random() * (r1 - r0 + 3.5)) * 20) / 20;
    if (u < RU0 + 0.5 || v < RV0 + 0.5 || u > RU0 + COLS - 0.5 || v > RV0 + ROWS - 0.5 || !validSpot('roca', u, v, null, 0.45)) continue; // só dentro da cerca
    if (folhasDe().some(f => Math.hypot(f.u - u, f.v - v) < 1)) continue;
    folhasDe().push({ id: Math.random().toString(36).slice(2, 8), u, v, at: Date.now() });
    return true;
  }
  return false;
}
function drawFolhas(t) {
  const W = L.W;
  for (const f of folhasDe()) {
    const q = iso(f.u, f.v), s = W / 100 * 1.3, bal = Math.sin(t / 900 + f.u) * 0.6;
    // brilho dourado pulsando no chão, para chamar atenção
    if (!f.alvo) { const pu = 0.5 + 0.5 * Math.sin(t / 350 + f.u); ctx.fillStyle = `rgba(255,214,90,${0.25 + pu * 0.25})`; ctx.beginPath(); ctx.ellipse(q.x, q.y, (26 + pu * 6) * s, (9 + pu * 2) * s, 0, 0, 7); ctx.fill(); }
    if (hover && hover.kind === 'folhas' && hover.id === f.id) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.26, W * 0.09, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 20 * s, 6 * s, 0, 0, 7); ctx.fill();
    const cores = ['#d9822b', '#c8402f', '#e8b020', '#9a5a2a', '#e06a2a'];
    ctx.fillStyle = '#a8602a'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 4 * s, 18 * s, 8 * s, 0, Math.PI, 0); ctx.fill();
    for (let k = 0; k < 16; k++) {
      const a = k * 2.4, r = (k % 4) * 4 + 2, lx = q.x + Math.cos(a) * r * 1.3 * s, ly = q.y - 5 * s - Math.abs(Math.sin(a)) * (10 - r * 0.9) * s - (k > 12 ? 6 * s : 0);
      ctx.fillStyle = cores[k % cores.length]; ctx.beginPath(); ctx.ellipse(lx, ly, 3.4 * s, 1.8 * s, a + bal * 0.2, 0, 7); ctx.fill();
    }
    if (!f.alvo) {
      drawBubbleAt(q.x, q.y - 30 * s, 'rastelo', null, t, f.u * 3);
      hits.push({ kind: 'folhas', id: f.id, x: q.x, y: q.y - 14 * s, r: Math.max(W * 0.34, 22) });
    }
  }
}
function rastelarFolhas(id) {
  if (!isHome()) return;
  const f = folhasDe().find(x => x.id === id); if (!f || f.alvo) return;
  const w = avWalk['roca:eu'];
  if (scene !== 'roca' || !w || w.dono !== 'home') return concluirFolhas(id);
  if (w.tarefa) return toast('Calma: o avatar ainda está rastelando o outro monte!');
  const t = performance.now(), k = w.dur ? Math.min(1, (t - w.t0) / w.dur) : 1;
  w.fu = w.fu + (w.tu - w.fu) * k; w.fv = w.fv + (w.tv - w.fv) * k;
  w.tu = f.u + 0.4; w.tv = f.v + 0.1;
  const dist = Math.hypot(w.tu - w.fu, w.tv - w.fv), sx = (w.tu - w.fu) - (w.tv - w.fv);
  w.dir = sx > 0 ? 1 : -1; w.t0 = t; w.dur = dist / 1.4 * 1000; w.tarefa = { id, ini: 0 };
  f.alvo = true; sfx('click');
  const q = iso(f.u, f.v); useFx('hoe', { x: q.x, y: q.y });
}
// Chegou no monte: fica rastelando um pouquinho, com folhas voando, e depois o monte some.
function rastelando(w, sc, t) {
  const tf = w.tarefa, f = folhasDe().find(x => x.id === tf.id);
  if (!f) { w.tarefa = null; return; }
  if (!tf.ini) { tf.ini = t; sfx('hoe'); }
  const q = iso(w.tu, w.tv), W = L.W, esc = W / 95;
  w.dir = -1; w.tela = { x: q.x, y: q.y - 70 * esc };
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.13, W * 0.045, 0, 0, 7); ctx.fill();
  drawAvatar(ctx, q.x, q.y, esc, Object.assign({}, state.avatar, { mao: 'rastelo' }), t, false, -1);
  const fq = iso(f.u, f.v), ke = (t - tf.ini) / 1600;
  for (let k = 0; k < 5; k++) { const p = (ke * 2.5 + k / 5) % 1; ctx.globalAlpha = 1 - p; ctx.fillStyle = ['#d9822b', '#c8402f', '#e8b020', '#e06a2a', '#9a5a2a'][k]; ctx.beginPath(); ctx.ellipse(fq.x + (k - 2) * 6 * esc + p * 10 * esc, fq.y - 8 * esc - p * 22 * esc, 3 * esc, 1.6 * esc, p * 6, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (ke >= 1) { concluirFolhas(tf.id); w.tarefa = null; w.fu = w.tu; w.fv = w.tv; w.t0 = t; w.dur = 0; w.wait = 1200; }
}
function concluirFolhas(id) {
  const l = folhasDe(), i = l.findIndex(x => x.id === id); if (i < 0) return;
  const f = l[i]; l.splice(i, 1);
  const q = iso(f.u, f.v), pos = scene === 'roca' ? { x: q.x, y: q.y - L.W * 0.2 } : null, moedas = 5 + Math.floor(Math.random() * 8);
  addCoins(moedas, pos); addXP(3, pos); sfx('collect');
  state.stats.folhas = (state.stats.folhas || 0) + 1;
  done();
}
// Na roça dos outros, o dono também passeia (desenha antes o que está mais ao fundo).
function drawAvatares(sc, t) {
  if (isHome() || !view.avatar) return drawAvatarWalk(sc, t);
  const fundo = q => { const w = avWalk[sc + ':' + q]; return w ? w.fu + (w.tu - w.fu) * Math.min(1, w.dur ? (t - w.t0) / w.dur : 1) + w.fv + (w.tv - w.fv) * Math.min(1, w.dur ? (t - w.t0) / w.dur : 1) : 0; };
  ['eu', 'dono'].sort((x, y) => fundo(x) - fundo(y)).forEach(q => drawAvatarWalk(sc, t, q));
}
// Prévia nas Configurações.
function renderAvatarCfg(sel = '#avatarCfg') {
  const box = $(sel); if (!box || !state) return;
  const av = state.avatar = avatarOk(state.avatar);
  const linha = (k, nome) => `<div class="avrow"><span>${nome}</span><div class="seg small" role="radiogroup" aria-label="${nome}">${opcoesAvatar(av, k).map(([id, n]) => avTravado(k, id)
    ? (AV_TREVO[id] ? `<button type="button" role="radio" class="trava" aria-disabled="true" aria-checked="false" data-av-trava="🍀 ${n} é exclusivo da Loja do Trevo. Troque trevos por ele em Loja › 🍀 Trevo.">🍀 ${n}</button>`
      : `<button type="button" role="radio" class="trava" aria-disabled="true" aria-checked="false" data-av-trava="🔒 ${n} libera no nível ${AV_NIVEL[id]}.">🔒 ${n} <small>Nv ${AV_NIVEL[id]}</small></button>`)
    : `<button type="button" role="radio" data-av="${k}:${id}" aria-checked="${av[k] === id}" aria-selected="${av[k] === id}">${n}</button>`).join('')}</div></div>`;
  box.innerHTML = `<canvas class="avprev" width="120" height="150" aria-label="Prévia do avatar"></canvas><div class="avopts">
    ${linha('sexo', 'Sexo')}
    <div class="avrow"><span>Pele</span><div class="peles" role="radiogroup" aria-label="Cor de pele">${AV_PELE.map((c, k) => `<button type="button" role="radio" class="pele" style="background:${c}" data-av="pele:${k}" aria-checked="${av.pele === k}" aria-label="Tom ${k + 1}"></button>`).join('')}</div></div>
    ${linha('cabelo', 'Cabelo')}
    <div class="avrow"><span>Cor</span><div class="peles" role="radiogroup" aria-label="Cor do cabelo">${AV_CORES_CABELO.map((c, k) => `<button type="button" role="radio" class="pele" style="background:${c}" data-av="corCabelo:${k}" aria-checked="${av.corCabelo === k}" aria-label="${['Preto', 'Castanho', 'Ruivo', 'Loiro', 'Grisalho'][k]}"></button>`).join('')}</div></div>
    ${linha('chapeu', 'Chapéu')}${linha('camisa', av.sexo === 'f' ? 'Blusa' : 'Camisa')}${linha('calca', av.sexo === 'f' ? 'Baixo' : 'Calça')}${linha('sapato', av.sexo === 'f' ? 'Calçado' : 'Sapato')}${linha('mao', 'Na mão')}</div>`;
  if (!avLoop) { avLoop = true; requestAnimationFrame(avPreview); }
}
let avLoop = false;
// Anima as prévias do avatar que estiverem na tela (Configurações e boas-vindas).
function avPreview() {
  const vis = [...document.querySelectorAll('canvas.avprev')].filter(c => c.offsetParent);
  if (!vis.length) { avLoop = false; return; }
  const t = performance.now();
  for (const c of vis) {
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#bfe08a'; g.beginPath(); g.ellipse(60, 138, 44, 10, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(60, 138, 18, 5, 0, 0, 7); g.fill();
    drawAvatar(g, 60, 138, 1.85, state.avatar, t, true, Math.sin(t / 1500) > 0 ? 1 : -1);
  }
  requestAnimationFrame(avPreview);
}
function avatarClick(e) {
  const b = e.target.closest('.avcfg [data-av]'); if (!b) return false;
  const caixa = '#' + b.closest('.avcfg').id;
  const [k, v] = b.dataset.av.split(':');
  if (avTravado(k, v)) return false;
  state.avatar = avatarOk(Object.assign({}, state.avatar, { [k]: k === 'pele' || k === 'corCabelo' ? Number(v) : v }));
  const run = true;
  renderAvatarCfg(caixa); done(); sfx('click');
  return run;
}

// ---------- Boas-vindas do jogador novo e tutorial rápido ----------
// Na primeira vez: dar nome à fazenda e ao avatar, montar o avatar e escolher se quer o tutorial.
function abrirBoasVindas() {
  const m = $('#boasvindas'); if (!m || !state) return;
  $('#bvFazenda').value = state.fazenda || '';
  $('#bvAvatarNome').value = state.apelido || '';
  $('#bvAvatarNome').placeholder = user ? firstName(user.name) : 'Seu nome';
  mostrarPassoBV(1); m.hidden = false;
  renderAvatarCfg('#bvAvatar'); if (!avLoop) { avLoop = true; requestAnimationFrame(avPreview); }
  setTimeout(() => $('#bvFazenda').focus(), 50);
}
function mostrarPassoBV(n) {
  $('#bvPasso1').hidden = n !== 1; $('#bvPasso2').hidden = n !== 2;
  $('#bvTitulo').textContent = n === 1 ? 'Bem-vindo à Roça Feliz! 🌻' : 'Quer um tutorial rápido?';
  if (n === 1) { renderAvatarCfg('#bvAvatar'); if (!avLoop) { avLoop = true; requestAnimationFrame(avPreview); } }
}
function salvarBoasVindas() {
  const fz = limpaNome($('#bvFazenda').value), av = limpaNome($('#bvAvatarNome').value);
  if (!fz) { sfx('error'); $('#bvFazenda').focus(); return toast('Dê um nome para a sua fazenda. 🌾', 'bad'); }
  state.fazenda = fz; state.apelido = av; // o primeiro nome é de graça
  done(); renderHUD(); renderSceneInfo(); sfx('collect');
  $('#bvNomes').textContent = `${minhaFazenda()} de ${meuApelido()}`;
  mostrarPassoBV(2);
}
function fecharBoasVindas(comTutorial) {
  $('#boasvindas').hidden = true; delete state.boasVindas; done();
  if (comTutorial) iniciarTutorial();
  else { toast('Beleza! Se quiser o tutorial depois, é só abrir ⚙️ › Ajuda.', 'good'); setTimeout(() => { if (giftReady()) showGift(); }, 1200); }
}
$('#boasvindas').addEventListener('click', e => {
  if (avatarClick(e)) return;
  const at = e.target.closest('[data-av-trava]'); if (at) { sfx('error'); return toast(at.dataset.avTrava, 'bad'); }
  if (e.target.closest('#bvContinuar')) return salvarBoasVindas();
  if (e.target.closest('#bvTutSim')) return fecharBoasVindas(true);
  if (e.target.closest('#bvTutNao')) return fecharBoasVindas(false);
  if (e.target.closest('#bvVoltar')) return mostrarPassoBV(1);
});
for (const id of ['#bvFazenda', '#bvAvatarNome']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarBoasVindas(); } });

const TUTORIAL = [
  { alvo: '#tools', cena: 'roca', txt: '🌱 <b>Plantar:</b> com a ✋ Mão, clique numa terra arada. A Loja abre para você escolher a semente; depois clique na terra para plantar.' },
  { alvo: '#tools', cena: 'roca', txt: '💧 <b>Cuidar:</b> use o Regador nas plantas com sede e o Inseticida quando aparecer praga. Planta cuidada cresce certinho.' },
  { alvo: '[data-tab="celeiro"]', cena: 'roca', txt: '🧺 <b>Colher:</b> quando aparecer o ✔ em cima da planta, clique para colher. Tudo vai para o <b>Celeiro</b>, onde dá para vender.' },
  { alvo: '[data-tab="loja"]', cena: 'roca', txt: '🏪 <b>Loja:</b> sementes, mudas, adubo, animais, abrigos, cachorros e enfeites. Coisas novas liberam a cada nível.' },
  { alvo: '[data-scene="animais"]', cena: 'animais', txt: '🐔 <b>Rancho:</b> seus animais ficam aqui. Dê ração e recolha ovos, leite e mais. Clique num abrigo para ver quem mora nele.' },
  { alvo: '[data-tab="fabrica"]', cena: 'roca', txt: '🏭 <b>Negócios:</b> na Fábrica você transforma o que colheu em produtos que valem mais; na Banca vende para outros jogadores; o Caminhão leva pedidos grandes.' },
  { alvo: '[data-tab="missoes"]', cena: 'roca', txt: '📋 <b>Missões:</b> todo dia tem missões novas com prêmios. A vila também faz pedidos.' },
  { alvo: '#stage', cena: 'roca', txt: '🎣 <b>Pescaria:</b> clique no pesqueiro (a plaquinha 🎣 perto da casinha do cachorro). Espere a boia afundar, puxe e brigue com o peixe!' },
  { alvo: '[data-tab="amigos"]', cena: 'roca', txt: '👥 <b>Amigos:</b> adicione amigos, visite a roça deles, mande presentes e converse no chat.' },
  { alvo: '#openSettings', cena: 'roca', txt: '⚙️ <b>Configurações:</b> troque o avatar, a música, ative as notificações e reveja este tutorial em Ajuda. Boa colheita! 🌻' },
];
let tut = -1;
function iniciarTutorial() { tut = 0; if ($('#settings')) $('#settings').hidden = true; mostrarTutorial(); }
function mostrarTutorial() {
  document.querySelectorAll('.tutfoco').forEach(el => el.classList.remove('tutfoco'));
  const box = $('#tutorial');
  if (tut < 0 || tut >= TUTORIAL.length) { box.hidden = true; if (tut >= TUTORIAL.length) { state.tutorialFeito = true; done(); toast('Tutorial concluído! Boa colheita! 🌻', 'good'); sfx('level'); setTimeout(() => { if (giftReady()) showGift(); }, 1500); } tut = -1; return; }
  const p = TUTORIAL[tut];
  if (p.cena && scene !== p.cena && isHome()) setScene(p.cena);
  const el = document.querySelector(p.alvo); if (el && el.id !== 'stage') el.classList.add('tutfoco');
  $('#tutTxt').innerHTML = p.txt;
  $('#tutPasso').textContent = `${tut + 1} de ${TUTORIAL.length}`;
  $('#tutVoltar').disabled = tut === 0;
  $('#tutProx').textContent = tut === TUTORIAL.length - 1 ? 'Concluir ✔' : 'Próximo ›';
  box.hidden = false;
  // o cartão não pode tapar o que está sendo mostrado: se o alvo está embaixo, o cartão sobe
  const r = el && el.id !== 'stage' ? el.getBoundingClientRect() : null;
  box.classList.toggle('topo', !!r && r.top > innerHeight * 0.5);
}
$('#tutorial').addEventListener('click', e => {
  if (e.target.closest('#tutProx')) { tut++; sfx('click'); return mostrarTutorial(); }
  if (e.target.closest('#tutVoltar')) { tut = Math.max(0, tut - 1); sfx('click'); return mostrarTutorial(); }
  if (e.target.closest('#tutPular')) { tut = -1; return mostrarTutorial(); }
});

// ---------- Viagem de carroça (tela de carregamento) ----------
let viagem = null;
function drawCarroca(g, x, y, s, t, andando) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const trote = andando ? Math.sin(t / 90) : 0;
  // cavalo (à direita, puxando)
  g.save(); g.translate(46, 0);
  g.strokeStyle = '#6b4220'; g.lineWidth = 3.2; g.lineCap = 'round';
  for (const [lx, k] of [[-10, 1], [-5, -1], [8, -1], [12, 1]]) { g.beginPath(); g.moveTo(lx, -20); g.lineTo(lx + trote * k * 3, -2); g.stroke(); }
  g.fillStyle = '#8a5a33'; g.beginPath(); g.ellipse(1, -24, 16, 8.5, 0, 0, 7); g.fill();
  g.beginPath(); g.moveTo(10, -28); g.lineTo(18, -44); g.lineTo(25, -42); g.lineTo(17, -24); g.fill();
  g.beginPath(); g.ellipse(24, -43, 7, 4.2, 0.35, 0, 7); g.fill();
  g.fillStyle = '#4a2c14'; g.beginPath(); g.moveTo(12, -30); g.lineTo(17, -46); g.lineTo(20, -45); g.lineTo(15, -28); g.fill();
  g.beginPath(); g.moveTo(-15, -26); g.quadraticCurveTo(-24, -20 + trote * 2, -20, -8); g.lineTo(-17, -22); g.fill();
  g.fillStyle = '#8a5a33'; g.beginPath(); g.moveTo(19, -47); g.lineTo(20, -52); g.lineTo(22, -46); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(25, -45, 1.1, 0, 7); g.fill();
  g.restore();
  // varas ligando ao cavalo
  g.strokeStyle = '#7a4a24'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(18, -18); g.lineTo(44, -24); g.stroke();
  // pessoa sentada (desenha inteira; a caixa da carroça cobre as pernas)
  drawAvatar(g, 2, -6 + (andando ? Math.abs(trote) * -1 : 0), 0.62, state.avatar, t, false, 1);
  // caixa da carroça
  g.fillStyle = '#b07a44'; g.strokeStyle = '#6b3f1f'; g.lineWidth = 1.5;
  g.beginPath(); g.roundRect(-22, -26, 42, 16, 2); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(107,63,31,.6)'; g.beginPath(); g.moveTo(-22, -18); g.lineTo(20, -18); g.stroke();
  g.fillStyle = '#e8c65a'; g.beginPath(); g.ellipse(-12, -27, 8, 4, 0, Math.PI, 0); g.fill(); // feno
  // rodas
  for (const wx of [-12, 10]) {
    g.save(); g.translate(wx, -8); g.rotate(andando ? t / 160 : 0);
    g.strokeStyle = '#4a2c14'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.stroke();
    g.lineWidth = 1.2; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.stroke(); }
    g.restore();
  }
  g.restore();
}
// ---------- Entrega do caminhão (3 s): o avatar leva a caixa até o caminhão e ele vai embora ----------
const ENTREGA_MS = 3000;
function mostrarEntrega(msg) {
  const el = $('#loading'); if (!el) return toast(msg, 'good');
  $('#loadingTxt').textContent = 'Carregando o caminhão…';
  const bar = el.querySelector('.loadbar i'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
  const ini = performance.now(), ativo = viagem;
  viagem = { ini, fim: ini + ENTREGA_MS, cena: 'caminhao', nome: '', volta: false, espera: false };
  el.hidden = false; clearTimeout(carregaTimer);
  if (!ativo) requestAnimationFrame(drawViagem);
  setTimeout(() => sfx('coin'), ENTREGA_MS * 0.55);
  carregaTimer = setTimeout(() => { fecharCarregando(); toast(msg, 'good'); }, ENTREGA_MS);
}
function drawCaixa(g, x, y, s) {
  g.fillStyle = '#c98a4b'; g.strokeStyle = '#6b3f1f'; g.lineWidth = 1.2 * s;
  g.beginPath(); g.roundRect(x - 9 * s, y - 16 * s, 18 * s, 16 * s, 2 * s); g.fill(); g.stroke();
  g.fillStyle = '#e8c65a'; g.fillRect(x - 2 * s, y - 16 * s, 4 * s, 16 * s);
  g.strokeStyle = 'rgba(107,63,31,.5)'; g.beginPath(); g.moveTo(x - 9 * s, y - 8 * s); g.lineTo(x + 9 * s, y - 8 * s); g.stroke();
}
function drawCaminhaoLado(g, x, y, s, t, andando, carga) {
  g.save(); g.translate(x, y); g.scale(s, s);
  // carroceria (atrás, à esquerda) e cabine (à frente, à direita)
  g.fillStyle = '#7a4a24'; g.fillRect(-58, -30, 62, 20);
  g.fillStyle = '#a86b38'; g.fillRect(-58, -34, 62, 5); g.fillRect(-58, -30, 4, 20); g.fillRect(0, -30, 4, 20);
  for (let k = 0; k < carga; k++) drawCaixa(g, -46 + (k % 3) * 18, -30 - Math.floor(k / 3) * 15, 0.9);
  g.fillStyle = '#d8402f'; g.beginPath(); g.roundRect(4, -44, 30, 34, 5); g.fill();
  g.fillStyle = '#bfe6ff'; g.beginPath(); g.roundRect(14, -40, 16, 12, 3); g.fill();
  g.fillStyle = '#a53325'; g.fillRect(4, -18, 32, 6);
  g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(34, -16, 2.5, 0, 7); g.fill();
  g.fillStyle = '#5a646b'; g.fillRect(-60, -12, 98, 4);
  for (const wx of [-40, 22]) {
    g.save(); g.translate(wx, -6); g.rotate(andando ? t / 90 : 0);
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill();
    g.fillStyle = '#9aa3aa'; g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.fill();
    g.fillStyle = '#2a2a2a'; g.fillRect(-0.8, -3.5, 1.6, 7);
    g.restore();
  }
  if (andando) { // fumacinha do escapamento
    g.fillStyle = 'rgba(160,160,160,.5)';
    for (let j = 0; j < 3; j++) { const a = (t / 250 + j / 3) % 1; g.beginPath(); g.arc(-64 - a * 18, -10 - a * 8, 3 + a * 5, 0, 7); g.fill(); }
  }
  g.restore();
}
function drawEntrega(g, cw, ch, estrada, t) {
  const k = clamp((t - viagem.ini) / (viagem.fim - viagem.ini), 0, 1), esc = clamp(cw / 420, 0.75, 1.5);
  const suave = v => v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2;
  // celeiro de onde sai a caixa
  const bx = Math.max(40, cw * 0.1);
  g.fillStyle = '#c8402f'; g.fillRect(bx - 26, estrada - 50, 52, 36);
  g.fillStyle = '#7a2a1e'; g.beginPath(); g.moveTo(bx - 32, estrada - 48); g.lineTo(bx, estrada - 72); g.lineTo(bx + 32, estrada - 48); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(bx - 10, estrada - 34, 20, 20);
  g.beginPath(); g.moveTo(bx - 10, estrada - 34); g.lineTo(bx + 10, estrada - 14); g.moveTo(bx + 10, estrada - 34); g.lineTo(bx - 10, estrada - 14); g.stroke();
  // caminhão: parado até 60% do tempo, depois acelera para a direita
  const parado = cw * 0.64, saida = k < 0.6 ? 0 : suave((k - 0.6) / 0.4) * (cw * 0.75);
  const tx = parado + saida, ty = estrada + 8;
  const guardou = k >= 0.5;
  drawCaminhaoLado(g, tx, ty, esc, t, k >= 0.6, 3 + (guardou ? 1 : 0));
  // avatar: anda até a traseira do caminhão levando a caixa, põe a caixa e acena
  const ax0 = bx + 34, ax1 = parado - 70 * esc;
  const ak = clamp(k / 0.4, 0, 1), ax = ax0 + (ax1 - ax0) * suave(ak), andando = k < 0.4;
  const as = 0.8 * esc, ay = estrada + 10;
  g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(ax, ay, 12 * esc, 3.5 * esc, 0, 0, 7); g.fill();
  drawAvatar(g, ax, ay, as, state && state.avatar, t, andando, 1);
  if (!guardou) {
    // caixa nas mãos; entre 40% e 50% ela sobe até a carroceria
    const lk = clamp((k - 0.4) / 0.1, 0, 1);
    const cx0 = ax, cy0 = ay - 66 * as, cx1 = tx - 28 * esc, cy1 = ty - 30 * esc - 15 * esc;
    drawCaixa(g, cx0 + (cx1 - cx0) * lk, cy0 + (cy1 - cy0) * lk - Math.sin(lk * Math.PI) * 14 * esc, esc);
  } else if (k > 0.6) {
    // acena para o caminhão
    g.strokeStyle = AV_PELE[avatarOk(state && state.avatar).pele]; g.lineWidth = 3.5 * as; g.lineCap = 'round';
    const w = Math.sin(t / 110) * 0.5;
    g.beginPath(); g.moveTo(ax + 10 * as, ay - 40 * as); g.lineTo(ax + 18 * as + w * 6 * as, ay - 60 * as); g.stroke(); g.lineCap = 'butt';
  }
  if (k > 0.52 && k < 0.7) { g.font = `800 ${Math.round(14 * esc)}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeText('+ moedas!', tx - 20 * esc, ty - 70 * esc - (k - 0.52) * 60); g.fillStyle = '#ffe08a'; g.fillText('+ moedas!', tx - 20 * esc, ty - 70 * esc - (k - 0.52) * 60); }
}
function drawViagem() {
  const c = $('#loadCv'); if (!c || !viagem || $('#loading').hidden) { viagem = null; return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = c.clientWidth, ch = c.clientHeight;
  if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
  const g = c.getContext('2d'), t = performance.now();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
  const ceu = g.createLinearGradient(0, 0, 0, ch); ceu.addColorStop(0, '#8fd0f5'); ceu.addColorStop(1, '#d9f1ff');
  g.fillStyle = ceu; g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#fff5b0'; g.beginPath(); g.arc(cw * 0.82, ch * 0.2, 16, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (let k = 0; k < 3; k++) { const x = ((t / 60 + k * 170) % (cw + 120)) - 60, y = 22 + k * 16; g.beginPath(); g.ellipse(x, y, 26, 9, 0, 0, 7); g.ellipse(x + 18, y - 5, 16, 9, 0, 0, 7); g.fill(); }
  const chao = ch * 0.58;
  g.fillStyle = '#9fd26a'; g.beginPath(); g.moveTo(0, chao); for (let x = 0; x <= cw; x += 20) g.lineTo(x, chao - 12 - Math.sin(x / 60) * 8); g.lineTo(cw, ch); g.lineTo(0, ch); g.fill();
  g.fillStyle = '#7dbb48'; g.fillRect(0, chao, cw, ch - chao);
  const estrada = ch * 0.78;
  g.fillStyle = '#d8b67a'; g.fillRect(0, estrada - 10, cw, 22);
  g.fillStyle = '#c29a5c'; for (let x = 8; x < cw; x += 34) g.fillRect(x, estrada, 14, 2.5);
  if (viagem.cena === 'caminhao') { drawEntrega(g, cw, ch, estrada, t); requestAnimationFrame(drawViagem); return; }
  // as duas roças, uma em cada ponta
  const casa = (x, cor, telhado, nome) => {
    g.fillStyle = cor; g.fillRect(x - 24, estrada - 44, 48, 30);
    g.fillStyle = telhado; g.beginPath(); g.moveTo(x - 30, estrada - 42); g.lineTo(x, estrada - 64); g.lineTo(x + 30, estrada - 42); g.fill();
    g.fillStyle = '#6b3f1f'; g.fillRect(x - 6, estrada - 30, 12, 16);
    g.fillStyle = '#fff'; g.fillRect(x - 19, estrada - 38, 9, 8); g.fillRect(x + 10, estrada - 38, 9, 8);
    // nome da fazenda sempre inteiro dentro do quadro (diminui a letra se for comprido)
    let fs = 13; g.font = `800 ${fs}px system-ui, sans-serif`;
    while (g.measureText(nome).width > cw * 0.46 && fs > 9) g.font = `800 ${--fs}px system-ui, sans-serif`;
    const tw = g.measureText(nome).width, tx = clamp(x, tw / 2 + 6, cw - tw / 2 - 6);
    g.textAlign = 'center';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(nome, tx, estrada - 70); g.fillStyle = '#fff'; g.fillText(nome, tx, estrada - 70);
  };
  const xa = Math.max(46, cw * 0.1), xb = cw - xa;
  casa(xa, '#c8402f', '#7a2a1e', minhaFazenda());
  casa(xb, '#e3bf62', '#3f6fa8', viagem.nome);
  // progresso: vai de uma casa até a outra (na volta, o caminho inverso)
  const ms = viagem.fim - viagem.ini, k = clamp((t - viagem.ini) / ms, 0, viagem.espera ? 0.94 : 1);
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const x0 = xa + 34, x1 = xb - 34, px = viagem.volta ? x1 - (x1 - x0) * e : x0 + (x1 - x0) * e, esc = clamp(cw / 400, 0.75, 1.5);
  g.save(); g.translate(px, estrada + 8);
  if (viagem.volta) g.scale(-1, 1);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(10 * esc, 0, 50 * esc, 5, 0, 0, 7); g.fill();
  // poeirinha atrás
  g.fillStyle = 'rgba(200,170,120,.55)';
  for (let j = 0; j < 3; j++) { const a = ((t / 300 + j / 3) % 1); g.beginPath(); g.arc((-30 - a * 22) * esc, -4 - a * 8, (3 + a * 5) * esc, 0, 7); g.fill(); }
  drawCarroca(g, 0, 0, esc, t, k < 1);
  g.restore();
  requestAnimationFrame(drawViagem);
}
function drawCritters(t, tod) {
  const W = L.W, est = estacao(), chuva = raining(), cena = crittersOf(scene), s = W / 100 * (scene === 'animais' ? 1.5 : 1.1);
  // Se o lote onde o bichinho morava virou canteiro, ele muda para outro pedaço de grama.
  if (scene === 'roca') for (const c of cena.list) {
    const i = plotAt(c.hu, c.hv);
    if (i >= 0 && S().plots[i].s !== 'locked') {
      const [u, v] = critterHome('roca'); Object.assign(c, { u, v, hu: u, hv: v, fu: u, fv: v, tu: u, tv: v });
    }
  }
  if (tod === 'noite') {
    // vaga-lumes, presos ao chão da cena
    for (let k = 0; k < 14; k++) {
      const q = P(cena.flies[k % 5].u + hash01(k) * 6 - 2 + Math.sin(t / 1700 + k) * 0.4, cena.flies[k % 5].v + hash01(k + 50) * 6 - 2 + Math.cos(t / 1300 + k * 2) * 0.4, 0.4 + 0.3 * Math.sin(t / 900 + k));
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t / 500 + k * 3));
      ctx.fillStyle = 'rgba(255,240,120,.35)'; ctx.beginPath(); ctx.arc(q.x, q.y, W * 0.06, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff59a'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.5, W * 0.02), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // bichinhos do chão (no inverno só os porquinhos-da-índia; na chuva, só os sapos)
  const vivos = cena.list.filter(c => !(est.neve && c.tipo !== 'preá') && !(chuva && c.tipo !== 'sapo') && !(tod === 'noite' && c.tipo === 'preá'));
  vivos.map(c => ({ c, k: moveCritter(c, t) })).sort((a, b) => (a.c.u + a.c.v) - (b.c.u + b.c.v)).forEach(({ c, k }) => {
    const u = c.fu + (c.tu - c.fu) * k, v = c.fv + (c.tv - c.fv) * k;
    const pulo = c.tipo !== 'preá' && k > 0 && k < 1 ? Math.sin(k * Math.PI) * (c.tipo === 'sapo' ? 0.35 : 0.18) : 0;
    const g = iso(u, v), q = P(u, v, pulo);
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, W * (c.tipo === 'grilo' ? 0.05 : 0.1), W * 0.03, 0, 0, 7); ctx.fill();
    const idx = cena.list.indexOf(c), hov = hover && hover.kind === 'bicho' && hover.i === idx;
    if (hov) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(g.x, g.y, W * 0.14, W * 0.05, 0, 0, 7); ctx.stroke(); }
    hits.push({ kind: 'bicho', i: idx, x: q.x, y: q.y - W * 0.06, r: Math.max(W * 0.13, 16) });
    if (c.tipo === 'sapo') drawFrog(q.x, q.y, s, c.dir, t, pulo > 0);
    else if (c.tipo === 'preá') drawCavy(q.x, q.y, s * 0.95, c.dir, t, c.cor, k > 0 && k < 1);
    else drawCricket(q.x, q.y, s * 0.8, c.dir, t);
  });
  // outono: folhas caindo; inverno: neve fininha o tempo todo
  if (est.folhas && !chuva) for (let k = 0; k < 10; k++) {
    const f = cena.flies[k], ciclo = (t / 7000 + k * 0.137) % 1, h = 2.2 * (1 - ciclo);
    const q = P(f.u + Math.sin(t / 1200 + k) * 0.4 + ciclo * 0.8, f.v + ciclo * 0.5, h);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(t / 500 + k); ctx.fillStyle = ['#d9822b', '#c8502a', '#e8b04a'][k % 3];
    ctx.beginPath(); ctx.ellipse(0, 0, W * 0.035, W * 0.018, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  if (est.neve && !chuva) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < 40; k++) { const x = (hash01(k) * L.cw + Math.sin(t / 1500 + k) * 15) % L.cw, y = (hash01(k + 9) * L.ch + t * 0.02 * (0.5 + hash01(k + 3))) % L.ch; ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7); ctx.fill(); }
  }
  if (tod === 'noite' || chuva) return;
  // borboletas: muitas na primavera, poucas no outono, nenhuma no inverno
  const sz = clamp(W * 0.07, 4, 12);
  for (const b of cena.flies.slice(0, est.borboletas)) {
    const u = b.u + Math.sin(t / 5000 + b.s) * 2.5, v = b.v + Math.cos(t / 6200 + b.s * 2) * 2.5;
    const q = P(u, v, 0.6 + 0.25 * Math.sin(t / 600 + b.s * 3));
    const x = q.x, y = q.y, flap = Math.abs(Math.sin(t / 90 + b.s));
    ctx.fillStyle = b.cor; ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 0.8;
    for (const sgn of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(x + sgn * sz * 0.55 * flap, y - sz * 0.2, sz * 0.6 * flap + 0.5, sz * 0.5, sgn * 0.4, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + sgn * sz * 0.4 * flap, y + sz * 0.35, sz * 0.4 * flap + 0.4, sz * 0.35, -sgn * 0.3, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#3a2412'; ctx.fillRect(x - 0.8, y - sz * 0.5, 1.6, sz);
  }
  // um bando de passarinhos passa lá no céu de vez em quando
  const { cw, horizon } = L;
  if (t - bando.t0 > 26000) bando = { t0: t, y: 0.25 + Math.random() * 0.4 };
  const age = (t - bando.t0) / 14000;
  if (age < 1) {
    ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const x = -40 + age * (cw + 80) - k * 18, y = horizon * bando.y + (k % 2) * 10 + k * 4, w = 7 + Math.sin(t / 120 + k) * 3;
      ctx.beginPath(); ctx.moveTo(x - 8, y - w * 0.5); ctx.quadraticCurveTo(x - 4, y - w, x, y); ctx.quadraticCurveTo(x + 4, y - w, x + 8, y - w * 0.5); ctx.stroke();
    }
  }
}

// ============================================================
// Pescaria: lago da roça, isca, minijogo de fisgar e livro de peixes
// ============================================================
// Cada pesqueiro tem seu próprio elenco de peixes: nenhuma espécie se repete de um lugar pro outro
// ("pontos" diz onde cada um morde). O lixo (lata/bota) é a exceção: aparece em qualquer lugar.
const PEIXES = [
  { id: 'lata',     nome: 'Lata velha', preco: 2,    raro: 'lixo',     peso: 5,   nivel: 1, lixo: true, iscas: ['minhoca', 'milho'] },
  { id: 'bota',     nome: 'Bota velha', preco: 5,    raro: 'lixo',     peso: 4,   nivel: 1, lixo: true, iscas: ['minhoca', 'milho'] },
  // Pesqueiro de casa (e Pesque e Solte, a mesma água)
  { id: 'lambari',  nome: 'Lambari',    preco: 30,   raro: 'comum',    peso: 30,  nivel: 1,  iscas: ['minhoca', 'milho'], cor: ['#c9d3dc', '#8fa3b5'], tam: 0.7, pontos: ['casa', 'solte'] },
  { id: 'tilapia',  nome: 'Tilápia',    preco: 50,   raro: 'comum',    peso: 25,  nivel: 1,  iscas: ['minhoca', 'milho'], cor: ['#9aa88f', '#6f7d64'], tam: 0.85, pontos: ['casa', 'solte'] },
  { id: 'acara',    nome: 'Cará',        preco: 35,   raro: 'comum',    peso: 22,  nivel: 1,  iscas: ['minhoca'], cor: ['#b9a86a', '#7a6a3a'], tam: 0.7, alto: true, listras: true, pontos: ['casa', 'solte'] },
  { id: 'piau',     nome: 'Piau',        preco: 45,   raro: 'comum',    peso: 20,  nivel: 2,  iscas: ['minhoca', 'milho'], cor: ['#c9c2a0', '#9a8a5a'], tam: 0.85, pintas: true, pontos: ['casa', 'solte'] },
  { id: 'mandi',    nome: 'Mandi',       preco: 40,   raro: 'comum',    peso: 18,  nivel: 2,  iscas: ['minhoca'], cor: ['#d9c79a', '#a88a4a'], tam: 0.8, bigode: true, pontos: ['casa', 'solte'] },
  { id: 'carpa', nome: 'Carpa', preco: 48, raro: 'comum', peso: 20, nivel: 1, iscas: ['minhoca'], cor: ['#c9d3dc', '#8fa3b5'], tam: 0.80, pontos: ['casa', 'solte'] },
  { id: 'bagre', nome: 'Bagre', preco: 42, raro: 'comum', peso: 18, nivel: 1, iscas: ['minhoca', 'milho'], cor: ['#9aa88f', '#6f7d64'], tam: 0.88, alto: true, pontos: ['casa', 'solte'] },
  { id: 'jundia', nome: 'Jundiá', preco: 55, raro: 'comum', peso: 16, nivel: 2, iscas: ['milho'], cor: ['#b9a86a', '#7a6a3a'], tam: 0.96, longo: true, pontos: ['casa', 'solte'] },
  { id: 'saguiru', nome: 'Saguiru', preco: 38, raro: 'comum', peso: 20, nivel: 1, iscas: ['camarao'], cor: ['#c9c2a0', '#9a8a5a'], tam: 1.04, bigode: true, pontos: ['casa', 'solte'] },
  { id: 'cascudinho', nome: 'Cascudinho', preco: 60, raro: 'incomum', peso: 14, nivel: 2, iscas: ['camarao', 'artificial'], cor: ['#d9c79a', '#a88a4a'], tam: 1.12, dentes: true, pontos: ['casa', 'solte'] },
  // Córrego Cascavel
  { id: 'traira',   nome: 'Traíra',     preco: 70,   raro: 'comum',    peso: 15,  nivel: 3,  iscas: ['minhoca', 'camarao', 'artificial'], cor: ['#7a6a4a', '#4f4430'], tam: 0.95, pontos: ['riacho'] },
  { id: 'curimba',  nome: 'Curimbatá',   preco: 55,   raro: 'comum',    peso: 16,  nivel: 3,  iscas: ['milho'], cor: ['#b8bcc0', '#8a6a4a'], tam: 0.95, pontos: ['riacho'] },
  { id: 'pacu',     nome: 'Pacu',       preco: 90,   raro: 'incomum',  peso: 12,  nivel: 4,  iscas: ['milho'], cor: ['#8a8f99', '#e07a3a'], tam: 0.95, alto: true, pontos: ['riacho'] },
  { id: 'cascudo',  nome: 'Cascudo',     preco: 80,   raro: 'incomum',  peso: 10,  nivel: 4,  iscas: ['minhoca', 'milho'], cor: ['#5a5040', '#3a3228'], tam: 0.85, armadura: true, pintas: true, pontos: ['riacho'] },
  { id: 'tuvira',   nome: 'Tuvira',      preco: 65,   raro: 'comum',    peso: 14,  nivel: 3,  iscas: ['minhoca'], cor: ['#6a6a52', '#3a3a2a'], tam: 0.8, longo: true, pontos: ['riacho'] },
  { id: 'lambariamarelo', nome: 'Lambari-do-rabo-amarelo', preco: 75, raro: 'comum', peso: 14, nivel: 3, iscas: ['minhoca', 'camarao'], cor: ['#7a6a4a', '#4f4430'], tam: 0.80, listras: true, pontos: ['riacho'] },
  { id: 'joana', nome: 'Joana', preco: 85, raro: 'comum', peso: 12, nivel: 4, iscas: ['artificial'], cor: ['#b8bcc0', '#8a6a4a'], tam: 0.88, pintas: true, pontos: ['riacho'] },
  { id: 'manjuba', nome: 'Manjuba', preco: 65, raro: 'comum', peso: 15, nivel: 3, iscas: ['camarao', 'minhoca', 'milho'], cor: ['#8a8f99', '#e07a3a'], tam: 0.96, armadura: true, pontos: ['riacho'] },
  { id: 'caraacu', nome: 'Cará-açu', preco: 95, raro: 'incomum', peso: 11, nivel: 4, iscas: ['minhoca'], cor: ['#6a6a52', '#3a3a2a'], tam: 1.04, barriga: '#e0a050', pontos: ['riacho'] },
  { id: 'cascudopreto', nome: 'Cascudo-preto', preco: 100, raro: 'incomum', peso: 9, nivel: 5, iscas: ['minhoca', 'milho'], cor: ['#9aa0a8', '#6a707a'], tam: 1.12, alto: true, pintas: true, pontos: ['riacho'] },
  // Rio Meia Ponte
  { id: 'piranha',  nome: 'Piranha',     preco: 85,   raro: 'incomum',  peso: 11,  nivel: 5,  iscas: ['minhoca', 'camarao'], cor: ['#9aa0a8', '#6a707a'], tam: 0.8, alto: true, dentes: true, barriga: '#e0503a', pontos: ['represa'] },
  { id: 'tucunare', nome: 'Tucunaré',   preco: 160,  raro: 'raro',     peso: 8,   nivel: 6,  iscas: ['camarao', 'artificial'], cor: ['#e3bf3a', '#4f7a2a'], tam: 1, listras: true, pontos: ['represa'] },
  { id: 'corvina',  nome: 'Corvina',     preco: 110,  raro: 'incomum',  peso: 9,   nivel: 7,  iscas: ['camarao', 'milho'], cor: ['#d9d9cf', '#a8a898'], tam: 1, pontos: ['represa'] },
  { id: 'mandube',  nome: 'Mandubé',     preco: 130,  raro: 'incomum',  peso: 8,   nivel: 7,  iscas: ['minhoca', 'camarao'], cor: ['#c9b98a', '#8a704a'], tam: 0.9, bigode: true, pontos: ['represa'] },
  { id: 'carpacapim', nome: 'Carpa-capim', preco: 95, raro: 'incomum', peso: 10, nivel: 5, iscas: ['milho'], cor: ['#e3bf3a', '#4f7a2a'], tam: 0.80, longo: true, bigode: true, pontos: ['represa'] },
  { id: 'bagresapo', nome: 'Bagre-sapo', preco: 105, raro: 'incomum', peso: 9, nivel: 6, iscas: ['camarao'], cor: ['#d9d9cf', '#a8a898'], tam: 0.88, pontos: ['represa'] },
  { id: 'jacunda', nome: 'Jacundá', preco: 115, raro: 'incomum', peso: 8, nivel: 6, iscas: ['camarao', 'artificial'], cor: ['#c9b98a', '#8a704a'], tam: 0.96, alto: true, pontos: ['represa'] },
  { id: 'carapeba', nome: 'Carapeba', preco: 125, raro: 'incomum', peso: 7, nivel: 7, iscas: ['minhoca', 'camarao'], cor: ['#c8ccd2', '#3a3a3a'], tam: 1.04, longo: true, pontos: ['represa'] },
  { id: 'saburim', nome: 'Saburim', preco: 140, raro: 'raro', peso: 6, nivel: 8, iscas: ['artificial'], cor: ['#c7c1b3', '#4a4a4a'], tam: 1.12, bigode: true, pontos: ['represa'] },
  { id: 'robalo', nome: 'Robalo', preco: 155, raro: 'raro', peso: 6, nivel: 9, iscas: ['camarao', 'minhoca', 'milho'], cor: ['#c9c9c2', '#8a8a80'], tam: 0.80, dentes: true, pontos: ['represa'] },
  // Ribeirão João Leite
  { id: 'matrinxa', nome: 'Matrinxã',    preco: 120,  raro: 'incomum',  peso: 8,   nivel: 8,  iscas: ['milho', 'minhoca'], cor: ['#c8ccd2', '#3a3a3a'], tam: 1, barriga: '#e8c070', pontos: ['rio'] },
  { id: 'pintado',  nome: 'Pintado',    preco: 220,  raro: 'raro',     peso: 6,   nivel: 9,  iscas: ['camarao'], cor: ['#c7c1b3', '#4a4a4a'], tam: 1.1, pintas: true, pontos: ['rio'] },
  { id: 'papaterra', nome: 'Papa-terra', preco: 200,  raro: 'raro',     peso: 6,   nivel: 9,  iscas: ['camarao', 'milho'], cor: ['#c9c9c2', '#8a8a80'], tam: 1, longo: true, pontos: ['rio'] },
  { id: 'cachorra', nome: 'Peixe-cachorra', preco: 190, raro: 'raro',   peso: 6,   nivel: 10, iscas: ['camarao', 'artificial'], cor: ['#d0d4d8', '#e0a040'], tam: 1, longo: true, dentes: true, pontos: ['rio'] },
  { id: 'trairao', nome: 'Trairão', preco: 130, raro: 'incomum', peso: 8, nivel: 8, iscas: ['minhoca'], cor: ['#d0d4d8', '#e0a040'], tam: 0.88, listras: true, pontos: ['rio'] },
  { id: 'acaritinga', nome: 'Acari-tinga', preco: 140, raro: 'incomum', peso: 7, nivel: 9, iscas: ['minhoca', 'milho'], cor: ['#c8c090', '#8a8a5a'], tam: 0.96, pintas: true, pontos: ['rio'] },
  { id: 'cangati', nome: 'Cangati', preco: 150, raro: 'incomum', peso: 7, nivel: 9, iscas: ['milho'], cor: ['#f2b705', '#d9822b'], tam: 1.04, armadura: true, pontos: ['rio'] },
  { id: 'mandiamarelo', nome: 'Mandi-amarelo', preco: 165, raro: 'raro', peso: 6, nivel: 10, iscas: ['camarao'], cor: ['#b0a898', '#7a7060'], tam: 1.12, barriga: '#e0a050', pontos: ['rio'] },
  { id: 'cari', nome: 'Cari', preco: 145, raro: 'incomum', peso: 7, nivel: 8, iscas: ['camarao', 'artificial'], cor: ['#c9d3dc', '#8fa3b5'], tam: 0.80, alto: true, pintas: true, pontos: ['rio'] },
  { id: 'caparari', nome: 'Caparari', preco: 230, raro: 'raro', peso: 6, nivel: 10, iscas: ['minhoca', 'camarao'], cor: ['#9aa88f', '#6f7d64'], tam: 0.88, longo: true, bigode: true, pontos: ['rio'] },
  // Rio dos Bois
  { id: 'aruana',   nome: 'Aruanã',      preco: 240,  raro: 'raro',     peso: 5,   nivel: 11, iscas: ['artificial'], cor: ['#c8c090', '#8a8a5a'], tam: 1.05, longo: true, pontos: ['lagoa'] },
  { id: 'dourado',  nome: 'Dourado',    preco: 400,  raro: 'épico',    peso: 3,   nivel: 12, iscas: ['camarao', 'artificial'], cor: ['#f2b705', '#d9822b'], tam: 1.1, pontos: ['lagoa'] },
  { id: 'barbado',  nome: 'Barbado',     preco: 260,  raro: 'raro',     peso: 5,   nivel: 13, iscas: ['camarao', 'minhoca', 'milho'], cor: ['#b0a898', '#7a7060'], tam: 1.05, bigode: true, pontos: ['lagoa'] },
  { id: 'tambacu',  nome: 'Tambacu',    preco: 350,  raro: 'raro',     peso: 5,   nivel: 13, iscas: ['milho', 'minhoca'], cor: ['#6a6a50', '#3a3a2a'], tam: 1.1, alto: true, barriga: '#d8c060', pontos: ['lagoa'] },
  { id: 'piraputanga', nome: 'Piraputanga', preco: 230, raro: 'raro', peso: 5, nivel: 11, iscas: ['artificial'], cor: ['#b9a86a', '#7a6a3a'], tam: 0.96, pontos: ['lagoa'] },
  { id: 'piapara', nome: 'Piapara', preco: 245, raro: 'raro', peso: 5, nivel: 12, iscas: ['camarao', 'minhoca', 'milho'], cor: ['#c9c2a0', '#9a8a5a'], tam: 1.04, alto: true, pontos: ['lagoa'] },
  { id: 'piava', nome: 'Piava', preco: 215, raro: 'raro', peso: 5, nivel: 11, iscas: ['minhoca'], cor: ['#d9c79a', '#a88a4a'], tam: 1.12, longo: true, pontos: ['lagoa'] },
  { id: 'bicuda', nome: 'Bicuda', preco: 280, raro: 'raro', peso: 4, nivel: 13, iscas: ['minhoca', 'milho'], cor: ['#7a6a4a', '#4f4430'], tam: 0.80, bigode: true, pontos: ['lagoa'] },
  { id: 'piacu', nome: 'Piaçu', preco: 260, raro: 'raro', peso: 5, nivel: 12, iscas: ['milho'], cor: ['#b8bcc0', '#8a6a4a'], tam: 0.88, dentes: true, pontos: ['lagoa'] },
  { id: 'voadeira', nome: 'Voadeira', preco: 300, raro: 'épico', peso: 3, nivel: 14, iscas: ['camarao'], cor: ['#8a8f99', '#e07a3a'], tam: 0.96, listras: true, pontos: ['lagoa'] },
  // Rio Araguaia
  { id: 'tambaqui', nome: 'Tambaqui',    preco: 450,  raro: 'épico',    peso: 3,   nivel: 15, iscas: ['milho', 'minhoca'], cor: ['#6a6a50', '#2a2a22'], tam: 1.15, alto: true, barriga: '#d8c060', pontos: ['araguaia'] },
  { id: 'pirarucu', nome: 'Pirarucu',   preco: 1000, raro: 'lendário', peso: 1,   nivel: 18, iscas: ['artificial'], cor: ['#6b5a4a', '#c8402f'], tam: 1.3, pontos: ['araguaia'] },
  { id: 'pirarara', nome: 'Pirarara',    preco: 600,  raro: 'épico',    peso: 2,   nivel: 20, iscas: ['camarao'], cor: ['#4a4a44', '#e0502a'], tam: 1.2, bigode: true, barriga: '#e8d8a0', pontos: ['araguaia'] },
  { id: 'piracanjuba', nome: 'Piracanjuba', preco: 420, raro: 'épico', peso: 3, nivel: 15, iscas: ['camarao', 'artificial'], cor: ['#6a6a52', '#3a3a2a'], tam: 1.04, pintas: true, pontos: ['araguaia'] },
  { id: 'pacumanteiga', nome: 'Pacu-manteiga', preco: 390, raro: 'épico', peso: 3, nivel: 16, iscas: ['minhoca', 'camarao'], cor: ['#9aa0a8', '#6a707a'], tam: 1.12, armadura: true, pontos: ['araguaia'] },
  { id: 'curimatapioa', nome: 'Curimatã-pioa', preco: 350, raro: 'raro', peso: 4, nivel: 16, iscas: ['artificial'], cor: ['#e3bf3a', '#4f7a2a'], tam: 0.80, barriga: '#e0a050', pontos: ['araguaia'] },
  { id: 'jatuarana', nome: 'Jatuarana', preco: 440, raro: 'épico', peso: 3, nivel: 17, iscas: ['camarao', 'minhoca', 'milho'], cor: ['#d9d9cf', '#a8a898'], tam: 0.88, alto: true, pintas: true, pontos: ['araguaia'] },
  { id: 'pirapitinga', nome: 'Pirapitinga', preco: 460, raro: 'épico', peso: 3, nivel: 17, iscas: ['minhoca'], cor: ['#c9b98a', '#8a704a'], tam: 0.96, longo: true, bigode: true, pontos: ['araguaia'] },
  { id: 'caranha', nome: 'Caranha', preco: 520, raro: 'épico', peso: 2, nivel: 19, iscas: ['minhoca', 'milho'], cor: ['#c8ccd2', '#3a3a3a'], tam: 1.04, pontos: ['araguaia'] },
  { id: 'cuiucuiu', nome: 'Cuiú-cuiú', preco: 650, raro: 'épico', peso: 2, nivel: 21, iscas: ['milho'], cor: ['#c7c1b3', '#4a4a4a'], tam: 1.12, alto: true, pontos: ['araguaia'] },
  // Rio Amazonas
  { id: 'jau',      nome: 'Jaú',         preco: 1200, raro: 'lendário', peso: 1,   nivel: 24, iscas: ['camarao', 'artificial', 'minhoca'], cor: ['#7a6a4a', '#5a4a30'], tam: 1.3, bigode: true, pintas: true, pontos: ['amazonas'] },
  { id: 'cachara',  nome: 'Cachara',     preco: 1350, raro: 'lendário', peso: 0.8, nivel: 26, iscas: ['camarao', 'artificial'], cor: ['#8a7a5a', '#4a3a28'], tam: 1.3, bigode: true, pintas: true, longo: true, pontos: ['amazonas'] },
  { id: 'piraiba',  nome: 'Piraíba',     preco: 1500, raro: 'lendário', peso: 0.7, nivel: 28, iscas: ['artificial'], cor: ['#8a8e92', '#5a5e62'], tam: 1.4, bigode: true, pontos: ['amazonas'] },
  { id: 'pirapucu', nome: 'Pirapucu', preco: 900, raro: 'lendário', peso: 1.2, nivel: 23, iscas: ['camarao'], cor: ['#c9c9c2', '#8a8a80'], tam: 0.80, longo: true, pontos: ['amazonas'] },
  { id: 'sardinhaamazonica', nome: 'Sardinha-amazônica', preco: 850, raro: 'lendário', peso: 1.3, nivel: 23, iscas: ['camarao', 'artificial'], cor: ['#d0d4d8', '#e0a040'], tam: 0.88, bigode: true, pontos: ['amazonas'] },
  { id: 'acaradisco', nome: 'Acará-disco', preco: 950, raro: 'lendário', peso: 1, nivel: 24, iscas: ['minhoca', 'camarao'], cor: ['#c8c090', '#8a8a5a'], tam: 0.96, dentes: true, pontos: ['amazonas'] },
  { id: 'pacupeva', nome: 'Pacu-peva', preco: 1000, raro: 'lendário', peso: 1, nivel: 25, iscas: ['artificial'], cor: ['#f2b705', '#d9822b'], tam: 1.04, listras: true, pontos: ['amazonas'] },
  { id: 'aracu', nome: 'Aracu', preco: 980, raro: 'lendário', peso: 1, nivel: 25, iscas: ['camarao', 'minhoca', 'milho'], cor: ['#b0a898', '#7a7060'], tam: 1.12, pintas: true, pontos: ['amazonas'] },
  { id: 'surubim', nome: 'Surubim', preco: 1300, raro: 'lendário', peso: 0.8, nivel: 27, iscas: ['minhoca'], cor: ['#c9d3dc', '#8fa3b5'], tam: 0.80, armadura: true, pontos: ['amazonas'] },
  { id: 'tucunareacu', nome: 'Tucunaré-açu', preco: 1400, raro: 'lendário', peso: 0.7, nivel: 29, iscas: ['minhoca', 'milho'], cor: ['#9aa88f', '#6f7d64'], tam: 0.88, barriga: '#e0a050', pontos: ['amazonas'] },
];
// Peixe grande ou comprido encolhe um pouco para caber no ícone.
const cabePeixe = p => Math.min(1, 0.95 / ((p.tam || 1) * (p.longo ? 1.3 : 1)));
const peixeNoPonto = (p, ponto) => !p.pontos || p.pontos.includes(ponto);
const PEIXE = Object.fromEntries(PEIXES.map(p => [p.id, p]));
for (const p of PEIXES) PRODUCT[p.id] = { id: p.id, nome: p.nome, preco: p.preco, peixe: true };
const COR_RARO = { lixo: '#8a8672', comum: '#6a8a4a', incomum: '#3f8ac8', raro: '#8a4fc8', 'épico': '#d9822b', 'lendário': '#c8402f' };
// Iscas: cada peixe só morde algumas. O milho sai do seu celeiro; as outras se compram aqui.
const ISCAS = [
  { id: 'minhoca',    nome: 'Minhoca',         emoji: '🪱', nivel: 1,  pacote: 10, custo: 60, plural: 'minhocas' },
  { id: 'milho',      nome: 'Milho',           emoji: '🌽', nivel: 1,  doCeleiro: 'milho' },
  { id: 'camarao',    nome: 'Camarão',         emoji: '🦐', nivel: 6,  pacote: 10, custo: 180, plural: 'camarões' },
  { id: 'artificial', nome: 'Isca artificial', emoji: '🎏', nivel: 12, pacote: 5,  custo: 400, plural: 'iscas artificiais' },
];
const ISCA = Object.fromEntries(ISCAS.map(i => [i.id, i]));
const ISCA_GRATIS_DIA = 5;
function iscasDe() {
  const t = state.iscasT || (state.iscasT = { minhoca: state.iscas == null ? 10 : state.iscas, camarao: 0, artificial: 0 });
  delete state.iscas; return t;
}
const qtdIsca = id => ISCA[id].doCeleiro ? (state.barn[ISCA[id].doCeleiro] || 0) : (iscasDe()[id] || 0);
const iscaSel = () => { const id = state.iscaSel; return ISCA[id] && ISCA[id].nivel <= state.level ? id : 'minhoca'; };
function drawPeixe(g, x, y, s, p) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (p.id === 'bota') {
    g.fillStyle = '#6b4220'; g.beginPath(); g.moveTo(-5, -9); g.lineTo(2, -9); g.lineTo(2, 1); g.lineTo(8, 2); g.quadraticCurveTo(9, 6, 6, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.fillStyle = '#4a2c14'; g.fillRect(-5, 4.5, 14, 2);
  } else if (p.id === 'lata') {
    g.fillStyle = '#9aa3aa'; g.fillRect(-4, -7, 8, 13); g.fillStyle = '#c8402f'; g.fillRect(-4, -3, 8, 5); g.fillStyle = '#6b7780'; g.fillRect(-4, -8, 8, 1.5);
  } else {
    const k = p.tam || 1, a = p.alto ? 1.35 : 1, L = p.longo ? 1.3 : 1;
    if (p.longo) { g.scale(L, 1 / 1.12); }
    g.fillStyle = p.cor[1]; g.beginPath(); g.moveTo(-8 * k, 0); g.lineTo(-13 * k, -5 * k * a); g.lineTo(-13 * k, 5 * k * a); g.closePath(); g.fill(); // rabo
    g.beginPath(); g.moveTo(-2 * k, -4 * k * a); g.quadraticCurveTo(1 * k, -8 * k * a, 4 * k, -4 * k * a); g.fill(); // barbatana
    g.fillStyle = p.cor[0]; g.beginPath(); g.ellipse(0, 0, 10 * k, 4.6 * k * a, 0, 0, 7); g.fill();
    if (p.barriga) { g.save(); g.beginPath(); g.ellipse(0, 0, 10 * k, 4.6 * k * a, 0, 0, 7); g.clip(); g.fillStyle = p.barriga; g.beginPath(); g.ellipse(1 * k, 3.6 * k * a, 9 * k, 2.6 * k * a, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(1 * k, 1.8 * k * a, 7 * k, 1.8 * k * a, 0, 0, 7); g.fill();
    if (p.armadura) { g.strokeStyle = 'rgba(20,16,10,.5)'; g.lineWidth = 0.6 * k; for (const lx of [-6, -3, 0, 3]) { g.beginPath(); g.arc(lx * k, 0, 4 * k, -1.1, 1.1); g.stroke(); } }
    if (p.bigode) { g.strokeStyle = 'rgba(40,30,20,.85)'; g.lineWidth = 0.55 * k; for (const [dy, cx, cy] of [[-0.5, 13, -3], [0.8, 13.5, 4], [1.6, 11.5, 6.5]]) { g.beginPath(); g.moveTo(9.3 * k, dy * k); g.quadraticCurveTo(cx * k, cy * k, (cx - 1) * k, (cy + 2.5) * k); g.stroke(); } }
    if (p.dentes) { g.fillStyle = '#fff'; for (const tx of [7.2, 8.2, 9.1]) { g.beginPath(); g.moveTo(tx * k, 1.2 * k); g.lineTo((tx + 0.4) * k, 2.4 * k); g.lineTo((tx + 0.8) * k, 1.2 * k); g.fill(); } g.strokeStyle = 'rgba(40,20,20,.6)'; g.lineWidth = 0.5 * k; g.beginPath(); g.moveTo(6.5 * k, 1.2 * k); g.lineTo(10 * k, 1 * k); g.stroke(); }
    if (p.listras) { g.fillStyle = 'rgba(40,60,20,.55)'; for (const lx of [-4, 0, 4]) g.fillRect(lx * k, -4 * k, 1.4 * k, 7 * k); }
    if (p.pintas) { g.fillStyle = 'rgba(30,30,30,.6)'; for (const [px, py] of [[-4, -1], [-1, -2], [2, -1], [-2, 1], [4, 0]]) { g.beginPath(); g.arc(px * k, py * k, 0.8 * k, 0, 7); g.fill(); } }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(6 * k, -1.2 * k, 1.5 * k, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(6.4 * k, -1.2 * k, 0.8 * k, 0, 7); g.fill();
  }
  g.restore();
}
let pesca = null, pescaRaf = 0;
function abrirPesca() {
  if (!isHome()) return;
  iscasDe(); pescaLivro = false;
  pesca = { fase: 'pronto', t0: performance.now() };
  $('#pesca').hidden = false; renderPesca();
  if (!pescaRaf) pescaRaf = requestAnimationFrame(desenharPesca);
}
function fecharPesca() { if (pescaLivro) livroVisto(); $('#pesca').hidden = true; pesca = null; }
// Ao sair do livro, os peixes marcados como NOVO! deixam de ser novidade.
function livroVisto() { if ((state.peixesNovos || []).length) { state.peixesNovos = []; save(); } }
// ---------- Pontos de pesca ----------
// Cada ponto dá uma pescaria a cada 2 horas. O pesqueiro de casa já vem; os outros liberam por nível e se compram.
// Quanto mais longe, mais "sorte": peixe raro morde mais e vem menos lixo.
const PONTO_MS = 2 * 3600e3, TARRAFA_MS = 12 * 3600e3, TARRAFA_N = 3;
// Domínio de pesca: cada peixe pego dá pontos (mais para os raros). A cada nível de domínio,
// a espera da vara e da tarrafa cai 5% (até 45% no nível 10). Conta também os peixes de antes.
const DOMINIO_PTS = { comum: 1, incomum: 2, raro: 4, 'épico': 8, 'lendário': 20 };
const DOMINIO_NV = [0, 10, 25, 50, 90, 150, 240, 360, 520, 750];
const DOMINIO_CORTE = 0.05;
const dominioXP = () => PEIXES.reduce((t, p) => t + (p.lixo ? 0 : (state.col[p.id] || 0) * DOMINIO_PTS[p.raro]), 0);
function dominio() {
  const xp = dominioXP(); let nv = 1;
  while (nv < DOMINIO_NV.length && xp >= DOMINIO_NV[nv]) nv++;
  const ini = DOMINIO_NV[nv - 1], fim = DOMINIO_NV[nv];
  return { nv, xp, ini, fim, max: nv >= DOMINIO_NV.length, corte: (nv - 1) * DOMINIO_CORTE };
}
const esperaVara = () => Math.round(PONTO_MS * (1 - dominio().corte));
const esperaTarrafa = () => Math.round(TARRAFA_MS * (1 - dominio().corte));
function dominioHTML() {
  const d = dominio(), pct = d.max ? 100 : Math.round((d.xp - d.ini) / (d.fim - d.ini) * 100);
  return `<span class="dnv">🎖️ Domínio de pesca <b>Nv ${d.nv}</b></span><span class="dbar"><i style="width:${pct}%"></i></span>
    ${dominioAResgatar().length ? `<button class="btn gold dresg" type="button" data-trevo-dominio="1">Resgatar 🍀${dominioAResgatar().reduce((t, n) => t + (TREVO_DOMINIO[n] || 0), 0)}</button>` : ''}
    <span class="dinfo">${d.corte ? `−${Math.round(d.corte * 100)}% de espera · ` : ''}vara ${fmt(esperaVara() / 1000)} · tarrafa ${fmt(esperaTarrafa() / 1000)}${d.max ? ' · máximo!' : ` · ${d.fim - d.xp} pts p/ Nv ${d.nv + 1}`}</span>`;
}
const PONTOS = [
  { id: 'casa',    nome: 'Pesqueiro de casa', emoji: '🏡', nivel: 1,  custo: 0,     sorte: 1,    agua: ['#6cb6e8', '#2f7ab8'], margem: '#7dbb48' },
  // Pesque e solte: sempre aberto, sem gastar isca. O peixe volta para a água: só dá moedas e XP.
  { id: 'solte',    nome: 'Pesque e Solte',       emoji: '🔄', nivel: 5,  custo: 0,     sorte: 1,    cena: 'solte', solte: true, agua: ['#7cc4e4', '#3584b8'], margem: '#8cc458' },
  // (os ids ficam os mesmos de antes para quem já tinha comprado; o "cena" diz o que desenhar)
  { id: 'riacho',   nome: 'Córrego Cascavel',     emoji: '🪨', nivel: 5,  custo: 1500,  sorte: 1.2,  cena: 'pedras',  agua: ['#8ad4e0', '#3a8ea6'], margem: '#86c050' },
  { id: 'represa',  nome: 'Rio Meia Ponte',       emoji: '🌉', nivel: 10, custo: 5000,  sorte: 1.45, cena: 'ponte',   agua: ['#7fb0c8', '#3a6f8a'], margem: '#6fae44' },
  { id: 'rio',      nome: 'Ribeirão João Leite',  emoji: '🧱', nivel: 15, custo: 8000, sorte: 1.75, cena: 'represa', agua: ['#5d9fca', '#22598a'], margem: '#5e9e3a' },
  { id: 'lagoa',    nome: 'Rio dos Bois',         emoji: '🐂', nivel: 20, custo: 14000, sorte: 2.1,  cena: 'mata',    agua: ['#9aae72', '#56703f'], margem: '#66a844' },
  { id: 'araguaia', nome: 'Rio Araguaia',         emoji: '🏖️', nivel: 25, custo: 22000, sorte: 2.5,  cena: 'praia',   agua: ['#6fc0d8', '#1f7a9a'], margem: '#7cb850' },
  { id: 'amazonas', nome: 'Rio Amazonas',         emoji: '🌴', nivel: 30, custo: 35000, sorte: 3,    cena: 'amazonas', agua: ['#a08a5a', '#5a4a2a'], margem: '#3f8a2a' },
];
const PONTO = Object.fromEntries(PONTOS.map(p => [p.id, p]));
function pontosDe() {
  const p = state.pontos || (state.pontos = { meus: ['casa'], prox: {} });
  if (!p.meus.includes('casa')) p.meus.unshift('casa');
  p.prox = p.prox || {}; p.usos = p.usos || {};
  return p;
}
const temPonto = id => !!PONTO[id] && (PONTO[id].custo === 0 ? state.level >= PONTO[id].nivel : pontosDe().meus.includes(id));
const SOLTE_MOEDAS = 10, SOLTE_XP = 1;
const pontoSel = () => { const id = state.pontoSel; return PONTO[id] && temPonto(id) ? id : 'casa'; };
const faltaPonto = id => Math.max(0, (pontosDe().prox[id] || 0) - Date.now());
// Cada ponto dá varaPorVez() pescarias de vara; depois descansa (2 horas, menos com o domínio).
const varaPorVez = () => 3;
const restamVara = id => PONTO[id] && PONTO[id].solte ? Infinity : faltaPonto(id) ? 0 : Math.max(0, varaPorVez() - (pontosDe().usos[id] || 0));
const tarrafaObj = () => (state.tarrafaEm && typeof state.tarrafaEm === 'object' ? state.tarrafaEm : (state.tarrafaEm = {}));
const faltaTarrafa = (id = pontoSel()) => Math.max(0, (tarrafaObj()[id] || 0) - Date.now());
// Algum ponto seu tem pescaria de vara ou tarrafa disponível agora (descansado ou nunca usado): mostra um brilho no pesqueiro.
const pescaPronta = () => state && PONTOS.some(p => !p.solte && temPonto(p.id) && ((!faltaPonto(p.id) && restamVara(p.id) > 0) || !faltaTarrafa(p.id)));
function comprarPonto(id) {
  const d = PONTO[id]; if (!d || temPonto(id)) return;
  if (state.level < d.nivel) return toast(`${d.emoji} ${d.nome}: libera no nível ${d.nivel}${d.custo ? ` e custa ${d.custo.toLocaleString('pt-BR')} moedas` : ' (de graça)'}.`);
  if (state.coins < d.custo) { sfx('error'); return toast(`${d.nome} custa ${d.custo.toLocaleString('pt-BR')} moedas. Faltam ${(d.custo - state.coins).toLocaleString('pt-BR')}.`, 'bad'); }
  return confirmTwice('ponto' + id, `Comprar o ponto ${d.nome} por ${d.custo.toLocaleString('pt-BR')} moedas? Toque de novo para confirmar.`, () => {
    state.coins -= d.custo; pontosDe().meus.push(id); state.pontoSel = id; sfx('buy');
    if (pesca) pesca = { fase: 'pronto', t0: performance.now() };
    toast(`${d.emoji} ${d.nome} é seu! Peixe raro morde mais por lá.`, 'good'); done(); renderPesca();
  });
}
function sortearPeixe(isca, sorte = 1, semLixo = false, ponto = 'casa') {
  let ok = PEIXES.filter(p => p.nivel <= state.level && (!isca || p.iscas.includes(isca)) && !(semLixo && p.lixo) && peixeNoPonto(p, ponto));
  if (!ok.length) ok = PEIXES.filter(p => p.id === 'lambari');
  const peso0 = p => p.lixo ? p.peso / sorte : ['raro', 'épico', 'lendário'].includes(p.raro) ? p.peso * sorte : p.raro === 'incomum' ? p.peso * Math.sqrt(sorte) : p.peso;
  const peso = p => peso0(p) * (p.lixo ? 1 : 1 + 0.15 * estrelasDe(p)); // cada estrela do domínio da espécie: morde 15% mais
  const tot = ok.reduce((t, p) => t + peso(p), 0);
  let r = Math.random() * tot;
  for (const p of ok) { r -= peso(p); if (r <= 0) return p; }
  return ok[0];
}
// Guarda o peixe pego: celeiro, coleção, livro, missões e XP. Diz se era novo.
function guardarPeixe(p) {
  const antes = dominio().nv;
  const novo = !p.lixo && !(state.col[p.id] > 0);
  state.barn[p.id] = (state.barn[p.id] || 0) + 1;
  if (novo) { state.peixesNovos = state.peixesNovos || []; if (!state.peixesNovos.includes(p.id)) state.peixesNovos.push(p.id); }
  if (!p.lixo) { collect(p.id, null); track('pescar'); if (['raro', 'épico', 'lendário'].includes(p.raro)) track('raro'); }
  addXP({ lixo: 0, comum: 2, incomum: 4, raro: 8, 'épico': 15, 'lendário': 40 }[p.raro], null);
  state.stats.peixes = (state.stats.peixes || 0) + (p.lixo ? 0 : 1);
  const d = dominio();
  if (d.nv > antes) {
    setTimeout(() => { sfx('level'); toast(`🎖️ Domínio de pesca nível ${d.nv}! Agora a espera é ${Math.round(d.corte * 100)}% menor: vara ${fmt(esperaVara() / 1000)}, tarrafa ${fmt(esperaTarrafa() / 1000)}.`, 'good'); }, 900);
    addNews(`🎖️ Seu domínio de pesca subiu para o nível ${d.nv}: a espera da vara e da tarrafa caiu ${Math.round(d.corte * 100)}%.`);
  }
  return novo;
}
// Tarrafa: joga a rede e pega 3 peixes de uma vez (sem isca), uma vez a cada 12 horas.
function jogarTarrafa() {
  if (!pesca || ['esperando', 'fisgou', 'tarrafa', 'brigando'].includes(pesca.fase)) return;
  if (PONTO[pontoSel()].solte) return toast('No Pesque e Solte não vale tarrafa: aqui é só vara, e o peixe volta para o rio.');
  if (faltaTarrafa()) return toast(`A tarrafa deste pesqueiro está secando: dá para jogar de novo em ${fmt(faltaTarrafa() / 1000)}.`);
  const sorte = PONTO[pontoSel()].sorte;
  const peixes = Array.from({ length: TARRAFA_N }, () => sortearPeixe(null, sorte, true, pontoSel()));
  tarrafaObj()[pontoSel()] = Date.now() + esperaTarrafa(); save();
  if (pescaLivro) livroVisto(); pescaLivro = false;
  pesca = { fase: 'tarrafa', t0: performance.now(), peixes };
  sfx('water'); renderPesca();
}
function recolherTarrafa() {
  const peixes = pesca.peixes, novos = peixes.filter(p => guardarPeixe(p));
  const nomes = peixes.map(p => p.nome).join(', ');
  pesca = { fase: 'resultado', t0: performance.now(), peixes, novos: novos.map(p => p.id),
    msg: `🕸️ Tarrafa cheia! Pegou ${nomes}.${novos.length ? ` ✨ Novo no livro: ${novos.map(p => p.nome).join(', ')}!` : ''}` };
  sfx(novos.length || peixes.some(p => ['raro', 'épico', 'lendário'].includes(p.raro)) ? 'level' : 'collect');
  if (novos.length) toast(`✨ Peixe novo no livro: ${novos.map(p => p.nome).join(', ')}!`, 'good');
  done(); renderPesca();
}
function lancar() {
  if (!pesca || (pesca.fase !== 'pronto' && pesca.fase !== 'resultado')) return;
  const pt = PONTO[pontoSel()];
  if (faltaPonto(pt.id)) { sfx('error'); return toast(`${pt.nome} está descansando: os peixes voltam em ${fmt(faltaPonto(pt.id) / 1000)}. Tente outro ponto ou a tarrafa!`); }
  const isca = iscaSel(), def = ISCA[isca];
  if (pt.solte) { // no pesque e solte a isca é por conta da casa
    const agora = performance.now();
    pesca = { fase: 'esperando', t0: agora, isca, ponto: pt.id, mordida: agora + 1800 + Math.random() * 3800, beliscos: [agora + 700 + Math.random() * 900] };
    sfx('water'); return renderPesca();
  }
  if (qtdIsca(isca) <= 0) {
    // o aviso aparece dentro da própria janela da pescaria (antes ia para um aviso escondido atrás dela)
    const temOutra = ISCAS.find(i => i.id !== isca && i.nivel <= state.level && qtdIsca(i.id) > 0);
    pesca = { fase: 'pronto', t0: performance.now(), aviso: (def.doCeleiro ? '🌽 Sem milho no celeiro! Colha milho para usar de isca.' : `🪱 Acabou a isca de ${def.nome.toLowerCase()}!${isca === 'minhoca' ? ' Amanhã chegam 5 minhocas grátis.' : ''} Compre mais aqui embaixo.`)
      + (temOutra ? ` Ou use ${temOutra.emoji} ${temOutra.nome.toLowerCase()} (você tem ${qtdIsca(temOutra.id)}).` : '') + (temPonto('solte') ? ' No 🔄 Pesque e Solte dá para pescar sem isca.' : '') };
    sfx('error'); return renderPesca();
  }
  if (def.doCeleiro) { state.barn[def.doCeleiro]--; if (!state.barn[def.doCeleiro]) delete state.barn[def.doCeleiro]; } else iscasDe()[isca]--;
  save();
  const agora = performance.now();
  pesca = { fase: 'esperando', t0: agora, isca, ponto: pt.id, mordida: agora + 1800 + Math.random() * 3800, beliscos: [agora + 700 + Math.random() * 900] };
  sfx('water'); renderPesca();
}
function puxar() {
  if (!pesca) return;
  if (pesca.fase === 'pronto' || pesca.fase === 'resultado') return lancar();
  if (pesca.fase === 'esperando') { pesca = { fase: 'resultado', t0: performance.now(), msg: 'Puxou cedo demais! O peixe fugiu.' }; sfx('error'); return renderPesca(); }
  if (pesca.fase === 'brigando') return puxada();
  if (pesca.fase === 'fisgou') return iniciarBriga();
}
// ---------- A briga com o peixe: puxadas no ritmo ----------
// Depois de fisgar, um anel vai fechando em volta do peixe. Toque (tela, botão ou espaço) quando ele
// ficar VERDE: cada acerto puxa o peixe para perto. Errar tira um pouco do progresso; 3 erros seguidos
// e o peixe escapa. Peixe raro pede mais puxadas, com anel mais rápido e janela verde menor.
// O domínio de pesca alarga a janela verde.
const BRIGA = {
  lixo:       { precisa: 1, ciclo: 1500, janela: 0.30 },
  comum:      { precisa: 2, ciclo: 1350, janela: 0.26 },
  incomum:    { precisa: 2, ciclo: 1200, janela: 0.23 },
  raro:       { precisa: 3, ciclo: 1100, janela: 0.21 },
  'épico':    { precisa: 3, ciclo: 1000, janela: 0.19 },
  'lendário': { precisa: 4, ciclo: 900,  janela: 0.17 },
};
function iniciarBriga() {
  const agora = performance.now(), p = pesca.peixe, d = BRIGA[p.raro] || BRIGA.comum;
  pesca = { fase: 'brigando', t0: agora, ponto: pesca.ponto, isca: pesca.isca, peixe: p,
    precisa: d.precisa, ciclo: d.ciclo, janela: d.janela + 0.012 * (dominio().nv - 1),
    acertos: 0, erros: 0, volta: agora + 250, fala: null };
  sfx('water'); renderPesca();
}
// Posição do anel na volta atual: 0 (bem aberto) até 1 (fechado). A janela verde fica no meio.
const anelK = (b, t) => (t - b.volta) / b.ciclo;
const naJanela = (b, k) => Math.abs(k - 0.6) <= b.janela / 2;
function falaBriga(b, txt, cor) { b.fala = { txt, cor, t: performance.now() }; }
function puxada() {
  const b = pesca; if (!b || b.fase !== 'brigando') return;
  const t = performance.now(), k = anelK(b, t);
  if (k < 0) return; // pausinha entre uma volta e outra
  if (naJanela(b, k)) {
    b.acertos++; b.erros = 0; sfx('collect'); falaBriga(b, ['Boa!', 'Isso!', 'Puxou!', 'Show!'][Math.floor(Math.random() * 4)], '#4fb82f');
    try { if (navigator.vibrate) navigator.vibrate(25); } catch (e) { /* sem vibração */ }
    if (b.acertos >= b.precisa) return concluirPesca();
  } else {
    errouPuxada(b, k < 0.6 ? 'Cedo!' : 'Tarde!');
  }
  b.volta = t + 350; renderPesca();
}
function errouPuxada(b, txt) {
  b.erros++; b.acertos = Math.max(0, b.acertos - 1); sfx('error'); falaBriga(b, txt, '#e0503a');
  if (b.erros >= 3) {
    const p = b.peixe, um = `um${p.nome.endsWith('a') && p.id !== 'pirarucu' && p.id !== 'papaterra' ? 'a' : ''}`;
    pesca = { fase: 'resultado', t0: performance.now(), msg: p.lixo ? 'A linha afrouxou e o enrosco escapou. 😅 Tente de novo!' : `A linha afrouxou e o peixe escapou… era ${um} ${p.nome}! 😩 Tente de novo.` };
    return renderPesca();
  }
  renderPesca();
}
function passoBriga(t) {
  const b = pesca;
  if (anelK(b, t) > 1.05) { errouPuxada(b, 'Passou!'); if (pesca === b) b.volta = t + 350; } // deixou o anel fechar sem tocar
}
function concluirPesca() {
  {
    if (PONTO[pesca.ponto] && PONTO[pesca.ponto].solte) return soltarPeixe(pesca.peixe);
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) { /* sem vibração */ }
    const p = pesca.peixe, novo = guardarPeixe(p);
    const pp = pontosDe(), pid = pesca.ponto || 'casa';
    pp.usos[pid] = (pp.usos[pid] || 0) + 1;
    if (pp.usos[pid] >= varaPorVez()) { pp.usos[pid] = 0; pp.prox[pid] = Date.now() + esperaVara(); } // o ponto descansa (2 horas, menos com domínio)
    const um = `um${p.nome.endsWith('a') && p.id !== 'pirarucu' && p.id !== 'papaterra' ? 'a' : ''}`;
    pesca = { fase: 'resultado', t0: performance.now(), peixe: p, novo, msg: p.lixo ? `Ih… veio uma ${p.nome.toLowerCase()}. 😅`
      : novo ? `✨ Peixe novo! Pegou ${um} ${p.nome} pela primeira vez (${p.raro}) — já está no 📖 Livro de peixes!` : `Pegou ${um} ${p.nome}! (${p.raro})` };
    sfx(p.lixo ? 'error' : novo || ['raro', 'épico', 'lendário'].includes(p.raro) ? 'level' : 'collect');
    if (novo) toast(`✨ Peixe novo no livro: ${p.nome}!`, 'good');
    done(); renderPesca();
  }
}
// Pesque e solte: o peixe volta para o rio. Dá só moedas e XP; não vai para o celeiro, o livro,
// as conquistas, as missões nem o domínio de pesca.
function soltarPeixe(p) {
  addCoins(SOLTE_MOEDAS, null); addXP(SOLTE_XP, null);
  const um = `um${p.nome.endsWith('a') && p.id !== 'pirarucu' && p.id !== 'papaterra' ? 'a' : ''}`;
  pesca = { fase: 'resultado', t0: performance.now(), peixe: p, solto: true, ponto: 'solte',
    msg: `🔄 Pegou ${um} ${p.nome} e soltou de volta no rio! +${SOLTE_MOEDAS} moedas e +${SOLTE_XP} XP. (Pesque e solte: o peixe não vai para o celeiro, o livro nem as conquistas.)` };
  sfx('coin'); done(); renderPesca();
}
// Fileira de pontos: dá para arrastar com o mouse (no celular, é só deslizar) e a roda do mouse anda para os lados.
let pontosArrastou = false;
(() => {
  const el = $('#pescaPontos'); if (!el) return;
  let ini = null;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { ini = { x: e.clientX, s: el.scrollLeft }; pontosArrastou = false; } });
  window.addEventListener('pointermove', e => { if (!ini) return; const dx = e.clientX - ini.x; if (Math.abs(dx) > 5) pontosArrastou = true; el.scrollLeft = ini.s - dx; });
  window.addEventListener('pointerup', () => { if (ini) { ini = null; setTimeout(() => { pontosArrastou = false; }, 0); } });
  // Só "rouba" a rolagem do mouse pros pontos quando ainda dá pra andar pro lado; nas pontas,
  // deixa a rolagem passar pra tela (senão ela ficava travada quando o rato para em cima da fileira).
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const podeEsquerda = el.scrollLeft > 0, podeDireita = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    if ((e.deltaY < 0 && !podeEsquerda) || (e.deltaY > 0 && !podeDireita)) return;
    el.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
})();
// Degradê nas pontas das fileiras horizontais (pontos de pesca, lugares de caçada): sem isso, o
// próximo item cortado na borda parecia um bug, em vez de uma dica de "dá pra arrastar mais".
function fadePontos(el) {
  if (!el) return;
  const folga = el.scrollWidth - el.clientWidth;
  el.classList.toggle('fade-l', el.scrollLeft > 2);
  el.classList.toggle('fade-r', el.scrollLeft < folga - 2);
}
document.querySelectorAll('.pontos').forEach(el => el.addEventListener('scroll', () => fadePontos(el), { passive: true }));
window.addEventListener('resize', () => document.querySelectorAll('.pontos').forEach(fadePontos));
// Só troca o HTML se mudou (assim o relógio atualiza sem "comer" o toque no botão).
const setHtml = (el, html) => { if (el && el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };
function renderPesca() {
  if (!pesca) return;
  const btn = $('#pescaBtn'), msg = $('#pescaMsg');
  const pt = PONTO[pontoSel()], descansa = faltaPonto(pt.id), livre = pesca.fase === 'pronto' || pesca.fase === 'resultado';
  // só trava o toque (sem rolar) durante as fases de reação rápida; no resto, dá pra rolar a tela com o dedo em cima do lago
  $('#pesca').classList.toggle('travapesca', pesca.fase === 'fisgou' || pesca.fase === 'brigando');
  btn.textContent = pesca.fase === 'esperando' ? 'Esperando…' : pesca.fase === 'fisgou' ? 'PUXA! 🎣' : pesca.fase === 'brigando' ? `PUXA no verde! 🟢 ${pesca.acertos}/${pesca.precisa}` : pesca.fase === 'tarrafa' ? 'Puxando a rede…'
    : descansa ? `⏳ Volta em ${fmt(descansa / 1000)}` : !pt.solte && qtdIsca(iscaSel()) <= 0 ? `Sem isca ${ISCA[iscaSel()].emoji}` : `${pesca.fase === 'resultado' ? 'Lançar de novo' : 'Lançar a linha'}${pt.solte ? '' : ` (${restamVara(pt.id)}/${varaPorVez()})`}`;
  btn.disabled = livre && !!descansa;
  const tb = $('#pescaTarrafa'), ft = faltaTarrafa();
  setHtml(tb, ft ? `🕸️ Tarrafa<br><small>em ${fmt(ft / 1000)}</small>` : `🕸️ Tarrafa<br><small>pega ${TARRAFA_N} peixes</small>`);
  tb.disabled = !!ft || !livre || !!pt.solte;
  tb.hidden = !!pt.solte;
  $('#pescaIscas').closest('.pescabar').hidden = !!pt.solte; // no pesque e solte a isca é da casa
  setHtml($('#pescaDominio'), dominioHTML());
  const pp = pontosDe();
  setHtml($('#pescaPontos'), PONTOS.map(d => {
    const meu = temPonto(d.id), trava = d.nivel > state.level, f = meu ? faltaPonto(d.id) : 0;
    const ft = meu && !d.solte ? faltaTarrafa(d.id) : 0, tarr = meu && !d.solte ? ` · 🕸️ ${ft ? fmt(ft / 1000) : 'pronta'}` : '';
    const st = (d.solte && meu ? `Sempre aberto · ${moeda(SOLTE_MOEDAS)}` : meu ? (f ? `⏳ ${fmt(f / 1000)}` : `Pronto! 🎣 ${restamVara(d.id)}/${varaPorVez()}`) : trava ? `🔒 Nv ${d.nivel} · ${d.custo ? moeda(d.custo) : 'grátis'}` : moeda(d.custo)) + tarr;
    return `<button type="button" class="pontobtn ${meu ? '' : trava ? 'trava' : 'loja'} ${f ? 'descansa' : ''}" data-ponto="${d.id}" aria-pressed="${meu && d.id === pt.id}">
      <b>${d.emoji} ${d.nome}</b><small>${st}</small></button>`;
  }).join(''));
  fadePontos($('#pescaPontos'));
  btn.classList.toggle('gold', pesca.fase === 'fisgou' || pesca.fase === 'pronto' || pesca.fase === 'resultado');
  btn.classList.toggle('pulsa', pesca.fase === 'fisgou');
  btn.classList.toggle('gold', pesca.fase === 'fisgou' || pesca.fase === 'pronto' || pesca.fase === 'resultado' || pesca.fase === 'brigando');
  msg.textContent = pesca.fase === 'tarrafa' ? 'Lá vai a tarrafa… 🕸️'
    : pesca.fase === 'brigando' ? `Fisgou! 🐟 Toque quando o anel ficar VERDE. Faltam ${pesca.precisa - pesca.acertos} puxada${pesca.precisa - pesca.acertos > 1 ? 's' : ''}.${pesca.erros ? ` (${pesca.erros} erro${pesca.erros > 1 ? 's' : ''} seguido${pesca.erros > 1 ? 's' : ''}: com 3, ele escapa)` : ''}`
    : pesca.fase === 'pronto' && pesca.aviso ? pesca.aviso
    : pesca.fase === 'pronto' && descansa ? `${pt.nome} está descansando. Escolha outro ponto ou jogue a tarrafa!`
    : pesca.fase === 'pronto' && pt.solte ? `🔄 Pesque e Solte: pesque quanto quiser, sem gastar isca! Cada peixe é solto de volta no rio e dá só ${SOLTE_MOEDAS} moedas e ${SOLTE_XP} XP — não vai para o celeiro, o livro, as conquistas nem as missões.`
    : pesca.fase === 'pronto' ? `${pt.emoji} ${pt.nome}: ${varaPorVez()} pescarias por vez. Toque em "Lançar a linha" e espere a boia afundar. Aí, puxe rápido!`
    : pesca.fase === 'esperando' ? 'Shhh… espere a boia afundar de verdade.' : pesca.fase === 'fisgou' ? 'Afundou! Puxa agora!' : pesca.msg || '';
  // escolha da isca
  const sel = iscaSel();
  setHtml($('#pescaIscas'), ISCAS.map(i => {
    const trava = i.nivel > state.level;
    return `<button type="button" class="iscabtn" data-isca="${i.id}" aria-pressed="${sel === i.id}" ${trava ? 'disabled' : ''} title="${i.nome}">${i.emoji}<small>${trava ? `Nv ${i.nivel}` : qtdIsca(i.id)}</small></button>`;
  }).join(''));
  const d = ISCA[sel], cb = $('#pescaComprar');
  cb.hidden = !!d.doCeleiro || !!pt.solte;
  if (!d.doCeleiro) { setHtml(cb, `Comprar ${d.pacote} ${d.plural} · ${moeda(d.custo)}`); cb.disabled = state.coins < d.custo; }
  $('#pescaDica').textContent = pt.solte ? `🔄 Aqui a isca é grátis e dá para pescar sem parar. Os peixes são soltos: não contam para o livro nem para as conquistas.` : `${d.emoji} ${d.nome}${d.doCeleiro ? ' (do celeiro)' : ''}: atrai ${PEIXES.filter(p => !p.lixo && p.iscas.includes(sel) && peixeNoPonto(p, pt.id)).map(p => p.nivel > state.level ? '???' : p.nome + (state.col[p.id] ? '' : ' ✨')).join(', ')}.${PEIXES.some(p => !p.lixo && p.iscas.includes(sel) && peixeNoPonto(p, pt.id) && p.nivel <= state.level && !state.col[p.id]) ? ' (✨ = nunca pegou)' : ''}`;
  $('#pescaLivro').hidden = !pescaLivro; $('#pescaCv').hidden = pescaLivro;
  const nn = (state.peixesNovos || []).length;
  $('#pescaLivroBtn').textContent = pescaLivro ? '🎣 Voltar a pescar' : `📖 Livro de peixes${nn ? ` · ✨ ${nn} novo${nn > 1 ? 's' : ''}` : ''}`;
  if (pescaLivro) setHtml($('#pescaLivro'), livroPeixes());
}
// Livro de peixes: o que já pegou (com figura), o que falta (sombra), raridade, quantos e do que precisa.
let pescaLivro = false, livroSoLago = true;
const peixeSombra = id => makeIcon('ps:' + id, () => { ctx.globalAlpha = 0.85; drawPeixe(ctx, 48, 48, 4.7 * cabePeixe(PEIXE[id]), Object.assign({}, PEIXE[id], { cor: ['#5b6470', '#4a525c'], listras: false, pintas: false, barriga: false, armadura: false })); ctx.globalAlpha = 1; });
function livroPeixes() {
  const todos = PEIXES.filter(p => !p.lixo), pt = PONTO[pontoSel()];
  const lista = livroSoLago ? todos.filter(p => peixeNoPonto(p, pt.id)) : todos;
  const pegos = todos.filter(p => state.col[p.id]).length, pend = peixesAResgatar();
  const soma = pend.reduce((t, p) => t + trevosDoPeixe(p), 0);
  return `<p class="hint" style="margin:0 0 8px">Você já pegou <b>${pegos} de ${todos.length}</b> peixes. Cada espécie nova vale trevos 🍀 (comum 1, incomum 2, raro 3, épico 5, lendário 10). E cada peixe tem o seu domínio ★: pegando mais do mesmo, ele ganha estrelas (até 4), morde 15% mais por estrela e cada estrela vale trevos (1, 2, 3 e 5).</p>
    <p style="margin:0 0 8px;text-align:center"><button class="btn ${livroSoLago ? 'gold' : 'ghost'}" type="button" data-livro-lago="1">${livroSoLago ? `🎣 Só ${pt.nome} (${lista.length})` : `🌎 Todos os peixes (${todos.length})`}</button></p>
    ${pend.length ? `<p style="margin:0 0 8px;text-align:center"><button class="btn gold" type="button" data-trevo-todos="1">Resgatar tudo · 🍀 ${soma}</button></p>` : ''}<div class="livro">${lista.map(p => {
    const n = state.col[p.id] || 0, novo = (state.peixesNovos || []).includes(p.id), resg = trevosDoPeixe(p), est = estrelasDe(p), prox = (MAESTRIA[p.raro] || MAESTRIA.comum)[est];
    return `<div class="lvcard ${n ? '' : 'falta'}">${novo ? '<span class="lvnovo">NOVO!</span>' : ''}<img alt="" src="${n ? productIcon(p.id) : peixeSombra(p.id)}">
      <b>${n ? esc(p.nome) : '???'}</b><span class="raro" style="color:${COR_RARO[p.raro]}">${p.raro}</span>
      <small>${n ? `Pegou ${n}× · vale ${p.preco}` : 'Ainda não pegou'}</small>
      ${n ? `<small class="lvest" title="Domínio desta espécie">${'★'.repeat(est)}${'☆'.repeat(4 - est)}${prox ? ` <span>${n}/${prox}</span>` : ' <span>máximo!</span>'}</small>` : ''}
      <small class="req">Nível ${p.nivel}${p.nivel > state.level ? ' 🔒' : ''} · ${p.iscas.map(i => ISCA[i].emoji).join(' ')}</small>${p.pontos ? `<small class="req">📍 ${p.pontos.map(id => PONTO[id].nome).slice(0, 2).join(', ')}${p.pontos.length > 2 ? '…' : ''}</small>` : ''}
      ${resg ? `<button class="btn gold lvresg" type="button" data-trevo-peixe="${p.id}">Resgatar 🍀${resg}</button>` : n ? '<small class="lvok">🍀 em dia</small>' : `<small class="req">🍀 ${TREVO_PEIXE[p.raro] || 1}</small>`}</div>`;
  }).join('')}</div>`;
}
function desenharPesca(t) {
  pescaRaf = 0;
  const c = $('#pescaCv'); if (!c || !pesca || $('#pesca').hidden) return;
  // Livro de peixes aberto (ou canvas ainda sem tamanho): o canvas fica escondido (clientWidth 0), e
  // alguns fundos (ex.: Rio Amazonas) têm "for" com passo cw*algo — com cw=0 isso trava num loop infinito.
  // Só re-agenda o quadro e sai, sem desenhar nada, até a pescaria voltar a aparecer.
  if (pescaLivro || !c.clientWidth) { pescaRaf = requestAnimationFrame(desenharPesca); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = c.clientWidth, ch = c.clientHeight;
  if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // fases que mudam com o tempo
  if (pesca.fase === 'esperando' && t >= pesca.mordida) { pesca = { fase: 'fisgou', t0: t, ponto: pesca.ponto, peixe: sortearPeixe(pesca.isca, PONTO[pesca.ponto || 'casa'].sorte, !!PONTO[pesca.ponto || 'casa'].solte, pesca.ponto || 'casa') }; pesca.janela = { comum: 950, lixo: 1000, incomum: 850, raro: 720, 'épico': 620, 'lendário': 520 }[pesca.peixe.raro]; sfx('water'); renderPesca(); }
  if (pesca.fase === 'fisgou' && t - pesca.t0 > pesca.janela) { pesca = { fase: 'resultado', t0: t, msg: 'Ah, escapou… tente de novo!' }; renderPesca(); }
  if (pesca.fase === 'tarrafa' && t - pesca.t0 > 2200) recolherTarrafa();
  if (pesca.fase === 'brigando') passoBriga(t);
  if (!pescaRelogio || t - pescaRelogio > 1000) { pescaRelogio = t; renderPesca(); } // contagem regressiva dos pontos e da tarrafa
  const PT = PONTO[pesca.ponto || pontoSel()];
  // céu, margem e água
  const ceu = g.createLinearGradient(0, 0, 0, ch * 0.4); ceu.addColorStop(0, '#8fd0f5'); ceu.addColorStop(1, '#d9f1ff');
  g.fillStyle = ceu; g.fillRect(0, 0, cw, ch * 0.4);
  g.fillStyle = PT.margem; g.beginPath(); g.moveTo(0, ch * 0.4); for (let x = 0; x <= cw; x += 20) g.lineTo(x, ch * 0.36 - Math.sin(x / 50) * 6); g.lineTo(cw, ch * 0.42); g.lineTo(0, ch * 0.42); g.fill();
  desenharFundoPonto(g, PT, cw, ch, t);
  const agua = g.createLinearGradient(0, ch * 0.4, 0, ch); agua.addColorStop(0, PT.agua[0]); agua.addColorStop(1, PT.agua[1]);
  g.fillStyle = agua; g.fillRect(0, ch * 0.4, cw, ch);
  desenharAguaPonto(g, PT, cw, ch, t);
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5;
  for (let k = 0; k < 6; k++) { const yy = ch * 0.5 + k * ch * 0.08, xx = ((t / 40 + k * 90) % (cw + 60)) - 30; g.beginPath(); g.moveTo(xx, yy); g.quadraticCurveTo(xx + 15, yy - 3, xx + 30, yy); g.stroke(); }
  // barranco com o avatar
  g.fillStyle = '#8a5a33'; g.beginPath(); g.moveTo(0, ch); g.lineTo(0, ch * 0.62); g.quadraticCurveTo(cw * 0.22, ch * 0.6, cw * 0.3, ch); g.fill();
  g.fillStyle = '#7dbb48'; g.beginPath(); g.moveTo(0, ch * 0.64); g.quadraticCurveTo(cw * 0.2, ch * 0.6, cw * 0.28, ch * 0.66); g.lineTo(0, ch * 0.68); g.fill();
  const esc = clamp(ch / 260, 0.8, 1.6), ax = cw * 0.13, ay = ch * 0.66;
  drawAvatar(g, ax, ay, 1.1 * esc, Object.assign({}, state.avatar, { mao: 'nada' }), t, false, 1);
  // vara e linha
  const mao = { x: ax + 13 * esc, y: ay - 26 * esc }, ponta = { x: ax + 70 * esc, y: ay - 95 * esc };
  const fisgou = pesca.fase === 'fisgou', briga = pesca.fase === 'brigando';
  const curva = fisgou ? 10 * esc : briga ? 16 * esc + Math.sin(t / 60) * 2 : 0;
  g.strokeStyle = '#7a4a24'; g.lineWidth = 2.5 * esc; g.lineCap = 'round';
  g.beginPath(); g.moveTo(mao.x, mao.y); g.quadraticCurveTo((mao.x + ponta.x) / 2, (mao.y + ponta.y) / 2 - curva, ponta.x, ponta.y + curva); g.stroke(); g.lineCap = 'butt';
  const naAgua = pesca.fase === 'esperando' || fisgou;
  const bx = cw * 0.62, by = ch * 0.62;
  let boiaY = by + Math.sin(t / 400) * 2;
  if (pesca.fase === 'esperando' && pesca.beliscos.some(b => t > b && t < b + 250)) boiaY += 4; // beliscada
  if (fisgou) boiaY += 9 + Math.sin(t / 45) * 3;
  if (naAgua) {
    g.strokeStyle = 'rgba(40,40,40,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ponta.x, ponta.y + curva); g.quadraticCurveTo(bx - 20, by - 60, bx, boiaY - 6); g.stroke();
    if (fisgou) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; for (let k = 0; k < 2; k++) { const r = ((t - pesca.t0) / 400 + k / 2) % 1; g.globalAlpha = 1 - r; g.beginPath(); g.ellipse(bx, by + 4, 8 + r * 30, 3 + r * 10, 0, 0, 7); g.stroke(); } g.globalAlpha = 1; }
    g.fillStyle = '#d8402f'; g.beginPath(); g.arc(bx, boiaY - 4, 5, Math.PI, 0); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, boiaY - 4, 5, 0, Math.PI); g.fill();
    if (fisgou) { g.font = `900 ${Math.round(34 * esc)}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#6b1f14'; g.strokeText('!', bx, by - 30); g.fillStyle = '#ffe08a'; g.fillText('!', bx, by - 30); }
  } else if (briga) {
    // o peixe vem chegando perto da margem a cada puxada certa
    const perto = pesca.acertos / pesca.precisa, px = cw * (0.66 - perto * 0.2), py = ch * (0.66 - perto * 0.04) + Math.sin(t / 120) * 2;
    g.strokeStyle = 'rgba(40,40,40,.75)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(ponta.x, ponta.y + curva); g.lineTo(px, py); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
    for (let k = 0; k < 2; k++) { const r = ((t / 300) + k / 2) % 1; g.globalAlpha = 1 - r; g.beginPath(); g.ellipse(px, py + 4, 8 + r * 18, 3 + r * 6, 0, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let k = 0; k < 4; k++) { const a = t / 90 + k * 1.7; g.beginPath(); g.arc(px + Math.cos(a) * 9, py - Math.abs(Math.sin(a)) * 10, 1.8, 0, 7); g.fill(); }
    // o alvo (círculo fixo) e o anel que vai fechando; fica verde na hora certa
    const R = 26 * esc, k = anelK(pesca, t), verde = k >= 0 && naJanela(pesca, k);
    g.setLineDash([5, 4]); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(px, py - 4, R, 0, 7); g.stroke(); g.setLineDash([]);
    if (k >= 0) {
      const r = R * (3 - 3.33 * Math.min(1.05, k)); // em k = 0,6 o anel encosta no alvo
      if (r > 2) {
        g.strokeStyle = verde ? '#4fdc3a' : k > 0.6 ? '#ff7a5a' : '#ffe08a'; g.lineWidth = verde ? 6 : 4;
        if (verde) { g.shadowColor = '#4fdc3a'; g.shadowBlur = 14; }
        g.beginPath(); g.arc(px, py - 4, r, 0, 7); g.stroke(); g.shadowBlur = 0;
      }
    }
    // puxadas: bolinhas em cima
    const n = pesca.precisa, dx = 16 * esc, x0 = cw / 2 - (n - 1) * dx / 2, y0 = ch * 0.1;
    for (let q = 0; q < n; q++) { g.fillStyle = q < pesca.acertos ? '#4fb82f' : 'rgba(255,255,255,.8)'; g.strokeStyle = '#2f5a1f'; g.lineWidth = 2; g.beginPath(); g.arc(x0 + q * dx, y0, 6 * esc, 0, 7); g.fill(); g.stroke(); }
    // corações de chance: 3 erros seguidos e o peixe escapa
    g.font = `${Math.round(13 * esc)}px system-ui, sans-serif`; g.textAlign = 'center';
    g.fillText('❤️'.repeat(3 - pesca.erros) + '🤍'.repeat(pesca.erros), cw / 2, y0 + 22 * esc);
    // "Boa!", "Cedo!", "Tarde!"
    if (pesca.fala && t - pesca.fala.t < 700) {
      const a = (t - pesca.fala.t) / 700;
      g.globalAlpha = 1 - a; g.font = `900 ${Math.round(20 * esc)}px system-ui, sans-serif`; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.5)'; g.fillStyle = pesca.fala.cor;
      g.strokeText(pesca.fala.txt, px, py - R - 12 - a * 20); g.fillText(pesca.fala.txt, px, py - R - 12 - a * 20); g.globalAlpha = 1;
    }
    if (t - pesca.t0 < 2200) { g.font = `800 ${Math.round(13 * esc)}px system-ui, sans-serif`; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.55)'; g.fillStyle = '#fff'; const tx = cw * 0.55, ty = ch * 0.27; g.strokeText('Toque quando o anel ficar verde!', tx, ty); g.fillText('Toque quando o anel ficar verde!', tx, ty); }
  } else {
    g.strokeStyle = 'rgba(40,40,40,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ponta.x, ponta.y); g.lineTo(ponta.x + 4, ponta.y + 40); g.stroke();
  }
  // tarrafa: a rede voa, abre e cai na água
  if (pesca.fase === 'tarrafa') {
    const k = Math.min(1, (t - pesca.t0) / 900), cx = ax + (cw * 0.6 - ax) * k, cy = ay - 60 * esc - Math.sin(k * Math.PI) * 60 * esc + (ch * 0.62 - ay + 60 * esc) * k;
    const r = (8 + 42 * k) * esc, afunda = Math.max(0, (t - pesca.t0 - 900) / 1300);
    g.save(); g.globalAlpha = 1 - afunda * 0.6;
    g.strokeStyle = '#efe6cf'; g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(cx, cy + afunda * 6, r, r * (k < 1 ? 0.55 : 0.32), 0, 0, 7); g.stroke();
    for (let a = 0; a < 12; a++) { const an = a / 12 * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy + afunda * 6); g.lineTo(cx + Math.cos(an) * r, cy + afunda * 6 + Math.sin(an) * r * (k < 1 ? 0.55 : 0.32)); g.stroke(); }
    for (const q of [0.35, 0.7]) { g.beginPath(); g.ellipse(cx, cy + afunda * 6, r * q, r * q * (k < 1 ? 0.55 : 0.32), 0, 0, 7); g.stroke(); }
    g.fillStyle = '#7a8088'; for (let a = 0; a < 10; a++) { const an = a / 10 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(an) * r, cy + afunda * 6 + Math.sin(an) * r * (k < 1 ? 0.55 : 0.32), 1.8, 0, 7); g.fill(); }
    g.restore();
    if (k >= 1) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; const rr = ((t - pesca.t0 - 900) / 500) % 1; g.globalAlpha = 1 - rr; g.beginPath(); g.ellipse(cx, cy + 6, r + rr * 30, (r + rr * 30) * 0.32, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
  }
  // resultado da tarrafa: os 3 peixes lado a lado
  if (pesca.fase === 'resultado' && pesca.peixes) {
    const k = Math.min(1, (t - pesca.t0) / 350), n = pesca.peixes.length, gap = 8, w = Math.min((cw * 0.7 - gap * (n - 1)) / n, 120), tot = n * w + (n - 1) * gap;
    const h = 104 * esc * 0.8, x0 = cw - tot - 12, y0 = ch * 0.08 + (1 - k) * 20;
    pesca.peixes.forEach((p, i) => {
      const x = x0 + i * (w + gap);
      g.fillStyle = 'rgba(255,253,242,.95)'; g.strokeStyle = '#6b4220'; g.lineWidth = 2.5;
      g.beginPath(); g.roundRect(x, y0, w, h, 12); g.fill(); g.stroke();
      drawPeixe(g, x + w / 2, y0 + h * 0.4, Math.min(2.4, w / 34) * esc * 0.8, p);
      g.textAlign = 'center'; g.font = `800 ${Math.round(12 * esc)}px system-ui, sans-serif`; g.fillStyle = '#2f2a1f'; g.fillText(p.nome, x + w / 2, y0 + h * 0.78);
      g.font = `800 ${Math.round(9.5 * esc)}px system-ui, sans-serif`; g.fillStyle = COR_RARO[p.raro]; g.fillText(p.raro.toUpperCase(), x + w / 2, y0 + h * 0.93);
      if (pesca.novos && pesca.novos.includes(p.id)) {
        g.save(); g.translate(x + w - 6, y0 + 4); g.rotate(0.22); g.fillStyle = '#e8a317'; g.strokeStyle = '#7a4a10'; g.lineWidth = 2;
        g.beginPath(); g.roundRect(-24 * esc, -9 * esc, 48 * esc, 18 * esc, 9 * esc); g.fill(); g.stroke();
        g.fillStyle = '#fffbe6'; g.font = `900 ${Math.round(10 * esc)}px system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillText('NOVO!', 0, 1); g.restore(); g.textBaseline = 'alphabetic';
      }
    });
  }
  // resultado: o peixe pendurado e a raridade
  if (pesca.fase === 'resultado' && pesca.peixe) {
    const p = pesca.peixe, k = Math.min(1, (t - pesca.t0) / 350);
    g.fillStyle = 'rgba(255,253,242,.95)'; g.strokeStyle = '#6b4220'; g.lineWidth = 3;
    const w = Math.min(cw * 0.5, 220), h = 120 * esc * 0.8, x0 = cw * 0.55 - w / 2, y0 = ch * 0.08 + (1 - k) * 20;
    g.beginPath(); g.roundRect(x0, y0, w, h, 14); g.fill(); g.stroke();
    // solto: o peixe "nada" de volta para a água, saindo do cartão
    const sai = pesca.solto ? Math.min(1, Math.max(0, (t - pesca.t0 - 900) / 900)) : 0;
    g.save(); g.globalAlpha = 1 - sai; drawPeixe(g, x0 + w / 2 + sai * 30, y0 + h * 0.42 + sai * 40, 3.2 * esc * 0.8 * cabePeixe(p), p); g.restore();
    g.textAlign = 'center'; g.font = `800 ${Math.round(15 * esc)}px system-ui, sans-serif`; g.fillStyle = '#2f2a1f'; g.fillText(p.nome, x0 + w / 2, y0 + h * 0.8);
    g.font = `800 ${Math.round(11 * esc)}px system-ui, sans-serif`; g.fillStyle = pesca.solto ? '#2f7ab8' : COR_RARO[p.raro];
    const linha2 = pesca.solto ? `↩ SOLTO · +${SOLTE_MOEDAS} moedas · +${SOLTE_XP} XP` : `${p.raro.toUpperCase()} · vale ${p.preco}`;
    const larg = g.measureText(linha2).width; if (larg > w - 12) g.font = `800 ${Math.floor(11 * esc * (w - 12) / larg)}px system-ui, sans-serif`;
    g.fillText(linha2, x0 + w / 2, y0 + h * 0.94);
    if (pesca.novo) {
      // selo dourado "NOVO!" pulsando no canto do cartão, com brilhinhos
      const pul = 1 + Math.sin(t / 180) * 0.07, sx = x0 + w - 8, sy = y0 + 6;
      g.save(); g.translate(sx, sy); g.rotate(0.22); g.scale(pul * k, pul * k);
      g.fillStyle = '#e8a317'; g.strokeStyle = '#7a4a10'; g.lineWidth = 2.5;
      g.beginPath(); g.roundRect(-34 * esc, -12 * esc, 68 * esc, 24 * esc, 12 * esc); g.fill(); g.stroke();
      g.fillStyle = '#fffbe6'; g.font = `900 ${Math.round(13 * esc)}px system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillText('NOVO!', 0, 1);
      g.restore(); g.textBaseline = 'alphabetic';
      g.fillStyle = '#f2c14e';
      for (let i = 0; i < 5; i++) {
        const a = t / 700 + i * 1.26, r = w * 0.36 + Math.sin(t / 260 + i) * 6;
        const bx = x0 + w / 2 + Math.cos(a) * r, by = y0 + h * 0.42 + Math.sin(a) * r * 0.35, bs = (3 + Math.sin(t / 150 + i * 2) * 1.5) * esc;
        g.beginPath(); g.moveTo(bx, by - bs * 2); g.lineTo(bx + bs * 0.6, by); g.lineTo(bx, by + bs * 2); g.lineTo(bx - bs * 0.6, by); g.closePath(); g.fill();
      }
    }
  }
  pescaRaf = requestAnimationFrame(desenharPesca);
}
let pescaRelogio = 0;
// Detalhes de cada ponto: pedras no riacho, o paredão da represa, as árvores do rio, as vitórias-régias da lagoa.
function desenharFundoPonto(g, PT, cw, ch, t) {
  const c = PT.cena;
  if (c === 'solte') {
    // plaquinha na outra margem
    const x = cw * 0.72, y = ch * 0.36;
    g.fillStyle = '#6b4f30'; g.fillRect(x - 2, y - 4, 4, 14); g.fillRect(x + 60, y - 4, 4, 14);
    g.fillStyle = '#f3e3b8'; g.strokeStyle = '#6b4f30'; g.lineWidth = 2; g.beginPath(); g.roundRect(x - 12, y - 26, 88, 24, 5); g.fill(); g.stroke();
    g.fillStyle = '#2f5a8a'; g.font = '800 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('PESQUE E SOLTE', x + 32, y - 10);
  }
  if (c === 'represa') {
    g.fillStyle = '#b9b3a3'; g.fillRect(cw * 0.45, ch * 0.28, cw * 0.55, ch * 0.13);
    g.fillStyle = '#9a9384'; for (let x = cw * 0.47; x < cw; x += cw * 0.08) g.fillRect(x, ch * 0.28, 3, ch * 0.13);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(cw * 0.45, ch * 0.28, cw * 0.55, 3);
  } else if (c === 'ponte') {
    // meia ponte: começa na margem e para no meio do rio
    const y = ch * 0.3, x0 = cw * 0.55;
    g.fillStyle = '#8a6a44'; g.fillRect(x0, y, cw - x0, 6);
    g.fillStyle = '#6b4f30'; for (let x = x0 + 8; x < cw; x += 26) g.fillRect(x, y + 6, 5, ch * 0.12);
    g.strokeStyle = '#6b4f30'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y - 8); g.lineTo(cw, y - 8); g.stroke();
    for (let x = x0; x < cw; x += 13) { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x, y); g.stroke(); }
  } else if (c === 'mata') {
    for (let x = cw * 0.35; x < cw; x += cw * 0.11) { g.fillStyle = '#6b4a2a'; g.fillRect(x - 2, ch * 0.3, 4, ch * 0.08); g.fillStyle = Math.round(x) % 2 ? '#3f7a2a' : '#4f8e34'; g.beginPath(); g.arc(x, ch * 0.28, cw * 0.045, 0, 7); g.fill(); }
  } else if (c === 'praia') {
    g.fillStyle = '#f0dca0'; g.beginPath(); g.moveTo(cw * 0.3, ch * 0.41); g.quadraticCurveTo(cw * 0.65, ch * 0.3, cw, ch * 0.36); g.lineTo(cw, ch * 0.42); g.fill();
    for (const x of [0.6, 0.78]) { const px = cw * x, py = ch * 0.34; g.fillStyle = '#e84a3a'; g.beginPath(); g.moveTo(px - 14, py - 14); g.quadraticCurveTo(px, py - 24, px + 14, py - 14); g.fill(); g.strokeStyle = '#6b4f30'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py - 18); g.lineTo(px, py + 2); g.stroke(); }
  } else if (c === 'amazonas') {
    for (let x = cw * 0.25; x < cw + 20; x += cw * 0.07) {
      g.fillStyle = '#2f6a22'; g.beginPath(); g.arc(x, ch * 0.3, cw * 0.05, 0, 7); g.fill();
      g.fillStyle = '#3f7f2a'; g.beginPath(); g.arc(x + cw * 0.03, ch * 0.25, cw * 0.04, 0, 7); g.fill();
    }
    g.strokeStyle = '#5a3a1a'; g.lineWidth = 2; for (const x of [0.4, 0.72]) { g.beginPath(); g.moveTo(cw * x, ch * 0.4); g.quadraticCurveTo(cw * x + 6, ch * 0.2, cw * x - 4, ch * 0.08); g.stroke(); g.fillStyle = '#3f8a2a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cw * x - 4, ch * 0.08, 16, 4, k * 1.25, 0, 7); g.fill(); } }
  }
}
function desenharAguaPonto(g, PT, cw, ch, t) {
  const c = PT.cena;
  if (c === 'pedras') {
    for (const [x, y, r] of [[0.42, 0.5, 12], [0.8, 0.56, 16], [0.52, 0.88, 14], [0.92, 0.8, 10]]) { g.fillStyle = '#8f949a'; g.beginPath(); g.ellipse(cw * x, ch * y, r, r * 0.55, 0, 0, 7); g.fill(); g.fillStyle = '#b3b8bd'; g.beginPath(); g.ellipse(cw * x - 2, ch * y - 3, r * 0.6, r * 0.28, 0, 0, 7); g.fill(); }
  } else if (c === 'amazonas') {
    // vitórias-régias
    for (const [x, y, r] of [[0.45, 0.55, 16], [0.85, 0.5, 20], [0.75, 0.86, 18], [0.42, 0.82, 13]]) {
      g.fillStyle = '#3f8a3a'; g.beginPath(); g.ellipse(cw * x, ch * y, r, r * 0.42, 0, 0, 7); g.fill();
      g.strokeStyle = '#6b9a3a'; g.lineWidth = 2; g.beginPath(); g.ellipse(cw * x, ch * y, r, r * 0.42, 0, 0, 7); g.stroke();
    }
    g.fillStyle = '#f7c8dc'; g.beginPath(); g.arc(cw * 0.85 + 5, ch * 0.5 - 4, 4, 0, 7); g.fill();
  } else if (c === 'mata') {
    g.fillStyle = '#4f7a34'; for (const x of [0.36, 0.39, 0.95, 0.97]) { g.beginPath(); g.moveTo(cw * x, ch * 0.46); g.lineTo(cw * x - 2, ch * 0.4); g.lineTo(cw * x + 2, ch * 0.4); g.fill(); g.fillRect(cw * x - 1, ch * 0.38, 2, ch * 0.08); }
  }
}
function comprarIscas() {
  const d = ISCA[iscaSel()]; if (d.doCeleiro) return;
  if (state.coins < d.custo) return toast('Faltam moedas para as iscas.', 'bad');
  state.coins -= d.custo; iscasDe()[d.id] = (iscasDe()[d.id] || 0) + d.pacote; sfx('buy');
  toast(`+${d.pacote} ${d.plural}!`, 'good'); done(); renderPesca();
}

// ============================================================
// Pedidos da vila: Seu Zé e Dona Maria pedem coisas e viram seus amigos
// ============================================================
const VILA_MAX = 2, VILA_PRAZO = 24 * 3600e3, VILA_NOVO = 2 * 3600e3, CORACAO = 5;
const VILA_FALAS = {
  ze: ['Tô precisando de {itens} pra levar na feira. Me ajuda?', 'Minha patroa pediu {itens}. Cê tem aí?', 'Ô, vizinho! Me arruma {itens}? Te pago direitinho.'],
  maria: ['Vou fazer um bolo pros netos! Me arruma {itens}?', 'Querido(a), tem {itens} sobrando? É pra quermesse da igreja.', 'Ai, esqueci de comprar {itens}! Você me salva?'],
};
const VILA_MARCOS = [
  { c: 1, txt: '300 moedas', dar: () => { state.coins += 300; } },
  { c: 2, txt: '10 camarões para pescar', dar: () => { iscasDe().camarao = (iscasDe().camarao || 0) + 10; } },
  { c: 3, txt: 'um enfeite exclusivo', dar: npc => { const id = npc === 'ze' ? 'carroca' : 'roseira'; state.enfeites[id] = (state.enfeites[id] || 0) + 1; state.invNovos = (state.invNovos || 0) + 1; } },
  { c: 4, txt: '+10% nas recompensas dos pedidos' , dar: () => {} },
  { c: 5, txt: '2.000 moedas e o título de melhor vizinho(a)', dar: () => { state.coins += 2000; } },
];
const coracoes = npc => Math.min(VILA_MARCOS.length, Math.floor(((state.vila && state.vila[npc] && state.vila[npc].amz) || 0) / CORACAO));
function vilaDe(npc) {
  state.vila = state.vila || {};
  if (!state.vila[npc]) { state.vila[npc] = { amz: 0, pedidos: [], novoEm: 0 }; for (let k = 0; k < VILA_MAX; k++) state.vila[npc].pedidos.push(novoPedidoVila(npc)); }
  return state.vila[npc];
}
// Prato de peixe só entra em pedidos se a pessoa já pescou aquele peixe alguma vez.
const receitaPossivel = r => Object.keys(r.in).every(id => (!PEIXE[id] || (state.col && state.col[id] > 0)) && jaCacou(id));
function itensDaVila() {
  const lista = [];
  for (const c of CROPS) if (c.nivel <= state.level) lista.push({ id: c.prod, min: 4, max: 12 });
  const temAnimal = new Set(state.animals.map(a => ANIMAL[a.k].prod).filter(Boolean));
  for (const p of PRODUCTS) if (temAnimal.has(p.id)) lista.push({ id: p.id, min: 2, max: 5 });
  for (const r of RECEITAS) if (r.nivel <= state.level && state.level >= r.nivel + 2 && receitaPossivel(r)) lista.push({ id: r.id, min: 1, max: 2 });
  return lista;
}
function novoPedidoVila(npc) {
  const pool = itensDaVila(), n = pool.length > 3 && Math.random() < 0.5 ? 2 : 1, itens = {};
  for (let k = 0; k < n && pool.length; k++) { const it = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; itens[it.id] = it.min + Math.floor(Math.random() * (it.max - it.min + 1)); }
  const valor = Object.entries(itens).reduce((t, [id, q]) => t + ((item(id) || {}).preco || 10) * q, 0);
  const bonus = coracoes(npc) >= 4 ? 1.1 : 1;
  const fala = VILA_FALAS[npc][Math.floor(Math.random() * VILA_FALAS[npc].length)];
  return { id: newId(), itens, moedas: Math.round(valor * 1.6 * bonus / 10) * 10, xp: 6 + Math.round(state.level * 1.5), fala, ate: Date.now() + VILA_PRAZO };
}
function atualizarVila() {
  for (const nb of NEIGHBORS) {
    const v = vilaDe(nb.id), agora = Date.now(), antes = v.pedidos.length;
    v.pedidos = v.pedidos.filter(p => p.ate > agora);
    if (v.pedidos.length < antes && !v.novoEm) v.novoEm = agora + VILA_NOVO; // venceu: outro chega em 2 h
    if (!v.pedidos.length && !v.novoEm) v.novoEm = agora; // sem nenhum pedido: chega um na hora
    if (v.pedidos.length < VILA_MAX && v.novoEm && agora >= v.novoEm) {
      v.pedidos.push(novoPedidoVila(nb.id));
      v.novoEm = v.pedidos.length < VILA_MAX ? agora + VILA_NOVO : 0;
    }
  }
}
const podeVila = p => Object.entries(p.itens).every(([id, q]) => (state.barn[id] || 0) >= q);
const vilaProntos = () => state && state.vila ? NEIGHBORS.reduce((t, nb) => t + ((state.vila[nb.id] && state.vila[nb.id].pedidos) || []).filter(podeVila).length, 0) : 0;
function entregarVila(npc, id) {
  const v = vilaDe(npc), p = v.pedidos.find(x => x.id === id), nb = NEIGHBORS.find(n => n.id === npc);
  if (!p || !podeVila(p)) return toast('Faltam itens no celeiro para esse pedido.', 'bad');
  for (const [iid, q] of Object.entries(p.itens)) { state.barn[iid] -= q; if (!state.barn[iid]) delete state.barn[iid]; }
  v.pedidos = v.pedidos.filter(x => x.id !== id); if (!v.novoEm) v.novoEm = Date.now() + VILA_NOVO;
  const antes = coracoes(npc);
  v.amz += 1; state.coins += p.moedas; addXP(p.xp, null); track('vila'); sfx('coin');
  let msg = `${nb.nome} agradece! +${p.moedas.toLocaleString('pt-BR')} moedas e +${p.xp} XP.`;
  const depois = coracoes(npc);
  if (depois > antes) { const m = VILA_MARCOS[depois - 1]; m.dar(npc); sfx('level'); msg += ` ❤️ Amizade com ${nb.nome} subiu: ganhou ${m.txt}!`; }
  toast(msg, 'good'); done();
}
function vilaHTML() {
  atualizarVila();
  let html = `<p class="hint">Os vizinhos da vila pedem coisas da sua roça. Cada entrega dá moedas, XP e amizade: a cada ${CORACAO} entregas, um coração ❤️ e um presente. Pedidos novos chegam a cada 2 horas.</p>`;
  for (const nb of NEIGHBORS) {
    const v = vilaDe(nb.id), c = coracoes(nb.id), prox = VILA_MARCOS[c];
    html += `<div class="row sel"><div class="avatar" style="background:${nb.casa}">${esc(nb.nome.split(' ').pop()[0])}</div>
      <div><div class="name">${esc(nb.nome)} <span class="meta">· ${esc(nb.fazenda)}</span></div>
      <div class="meta">${'❤️'.repeat(c)}${'🤍'.repeat(VILA_MARCOS.length - c)}${prox ? ` · próximo: ${prox.txt} (${v.amz % CORACAO}/${CORACAO})` : ' · melhor vizinho(a)! ⭐'}</div></div><div></div></div>`;
    if (!v.pedidos.length) html += `<div class="empty">${esc(nb.nome)} não precisa de nada agora. Volta mais tarde!</div>`;
    for (const p of v.pedidos) {
      const itensTxt = Object.entries(p.itens).map(([id, q]) => `${q} ${(item(id) || { nome: id }).nome.toLowerCase()}`).join(' e ');
      const ok = podeVila(p), falta = Math.max(0, p.ate - Date.now());
      html += `<div class="row pedvila"><div class="icons">${Object.keys(p.itens).map(id => `<img alt="" src="${itemIcon(id)}">`).join('')}</div>
        <div><div class="meta" style="font-style:italic">“${esc(p.fala.replace('{itens}', itensTxt))}”</div>
        <div class="meta">${Object.entries(p.itens).map(([id, q]) => `<span class="${(state.barn[id] || 0) >= q ? '' : 'falta'}">${q} ${(item(id) || { nome: id }).nome.toLowerCase()} (tem ${state.barn[id] || 0})</span>`).join(' + ')}</div>
        <div class="meta">Recompensa: ${moeda(p.moedas)} + ${p.xp} XP · ❤️ · vale por ${fmt(falta / 1000)}</div></div>
        <button class="btn ${ok ? 'gold' : ''}" data-vila="${nb.id}:${p.id}" ${ok ? '' : 'disabled'}>Entregar</button></div>`;
    }
  }
  return html;
}

// ============================================================
// Ranking semanal entre amigos
// ============================================================
const PONTOS_RANK = { colher: 1, coletar: 1, fabricar: 2, entregar: 5, ajudar: 3, presentear: 3, pescar: 2, vila: 8, dourada: 5 };
const PREMIO_RANK = [{ moedas: 1500, xp: 60 }, { moedas: 800, xp: 40 }, { moedas: 400, xp: 20 }];
function rankAtual() {
  const w = thisWeek();
  const r = state.rank || (state.rank = { w, pts: 0 });
  if (r.w !== w) { state.rank = { w, pts: 0, ant: { w: r.w, pts: r.pts }, premiado: r.premiado }; }
  return state.rank;
}
function rankPontos(ev) { const p = PONTOS_RANK[ev]; if (p && state) rankAtual().pts += p; }
let rankPublicado = '', rankCache = null, rankCacheEm = 0;
let rankPubEm = 0;
// Ranking global (todos os jogadores, não só amigos): reaproveita o mesmo documento ranking/{uid} e
// os mesmos pontos da semana, só que lendo os N com mais pontos no banco todo em vez de uid por uid.
let rankModo = 'amigos', rankGlobalCache = null, rankGlobalCacheEm = 0;
function publicarRanking(forcar) {
  if (!user || !Cloud.salvarRanking) return;
  if (!forcar && Date.now() - rankPubEm < 5 * 60e3) return; // no máximo a cada 5 min (poupa gravações)
  const r = rankAtual(), d = { w: r.w, pts: r.pts, antW: r.ant ? r.ant.w : 0, antPts: r.ant ? r.ant.pts : 0, nome: meuApelido(), fazenda: minhaFazenda(), nivel: state.level };
  const chave = JSON.stringify(d); if (chave === rankPublicado) return;
  rankPublicado = chave; rankPubEm = Date.now(); Cloud.salvarRanking(user.uid, d).catch(e => { console.warn('ranking:', e); rankPublicado = ''; });
}
async function lerRanking(forcar) {
  if (!user || !Cloud.lerRanking) return null;
  if (!forcar && rankCache && Date.now() - rankCacheEm < 60e3) return rankCache;
  try { rankCache = await Cloud.lerRanking(state.friends.slice(0, 60)); rankCacheEm = Date.now(); } catch (e) { console.warn(e); }
  return rankCache;
}
async function lerRankingGlobal(forcar) {
  if (!user || !Cloud.lerRankingGlobal) return null;
  if (!forcar && rankGlobalCache && Date.now() - rankGlobalCacheEm < 60e3) return rankGlobalCache;
  try { rankGlobalCache = await Cloud.lerRankingGlobal(100); rankGlobalCacheEm = Date.now(); } catch (e) { console.warn(e); }
  return rankGlobalCache;
}
const ptsNaSemana = (d, w) => !d ? 0 : d.w === w ? d.pts || 0 : d.antW === w ? d.antPts || 0 : 0;
// Na primeira vez que abre o jogo numa semana nova, vê a colocação da semana passada e dá o prêmio.
async function premioRanking() {
  const r = rankAtual();
  if (!user || !r.ant || r.premiado === r.ant.w) return;
  const docs = await lerRanking(true); if (!docs) return;
  const w = r.ant.w, meus = r.ant.pts;
  const pos = 1 + Object.values(docs).filter(d => ptsNaSemana(d, w) > meus).length;
  r.premiado = w;
  if (meus <= 0) return done();
  const pr = PREMIO_RANK[pos - 1] || { moedas: 100, xp: 5 };
  state.coins += pr.moedas; addXP(pr.xp, null); sfx('level'); done();
  toast(`🏆 Ranking da semana passada: você ficou em ${pos}º lugar com ${meus} pontos! +${pr.moedas.toLocaleString('pt-BR')} moedas e +${pr.xp} XP.`, 'good');
}
let rankHTMLcache = '', rankHTMLcacheGlobal = '';
function rankingHTML() {
  const r = rankAtual();
  const fim = new Date(); fim.setHours(0, 0, 0, 0); fim.setDate(fim.getDate() + ((8 - fim.getDay()) % 7 || 7));
  const dias = Math.max(0, Math.ceil((fim - Date.now()) / 86400e3));
  const global = rankModo === 'global';
  if (global) {
    lerRankingGlobal().then(docs => { if (docs && tab === 'amigos' && rankModo === 'global') { const novo = listaRankGlobal(docs, r); if (novo !== rankHTMLcacheGlobal) { rankHTMLcacheGlobal = novo; const el = $('#rankLista'); if (el) el.innerHTML = novo; } } });
  } else {
    lerRanking().then(docs => { if (docs && tab === 'amigos' && rankModo === 'amigos') { const novo = listaRank(docs, r); if (novo !== rankHTMLcache) { rankHTMLcache = novo; const el = $('#rankLista'); if (el) el.innerHTML = novo; } } });
  }
  const lista = global ? (rankHTMLcacheGlobal || listaRankGlobal(rankGlobalCache || {}, r)) : (rankHTMLcache || listaRank(rankCache || {}, r));
  return `<h3>🏆 Ranking da semana</h3><p class="hint">Pontos por colher (1), recolher dos animais (1), fábrica (2), pescar (2), ajudar amigos (3), presentear (3), caminhão (5), pedidos da vila (8). Termina ${dias <= 1 ? 'hoje à meia-noite' : `em ${dias} dias`} (segunda 0h). Prêmios: 🥇 ${PREMIO_RANK[0].moedas} · 🥈 ${PREMIO_RANK[1].moedas} · 🥉 ${PREMIO_RANK[2].moedas} moedas.</p>
    <div class="rankmodo"><button type="button" class="btn tiny ${global ? 'ghost' : 'gold'}" data-rank-modo="amigos">Amigos</button><button type="button" class="btn tiny ${global ? 'gold' : 'ghost'}" data-rank-modo="global">🌎 Todos os jogadores</button></div>
    <div id="rankLista">${lista}</div>`;
}
function listaRank(docs, r) {
  const w = r.w, linhas = [{ uid: 'eu', nome: `${meuApelido()} (você)`, pts: r.pts, eu: true }];
  for (const uid of state.friends) { const d = docs[uid], f = friendInfo[uid]; linhas.push({ uid, nome: (d && d.nome) || (f && f.name && !f.erro ? f.name : 'Amigo'), pts: ptsNaSemana(d, w) }); }
  linhas.sort((a, b) => b.pts - a.pts || (a.eu ? -1 : 1));
  return linhas.map((l, k) => `<div class="rankrow ${l.eu ? 'eu' : ''}"><b>${['🥇', '🥈', '🥉'][k] || `${k + 1}º`}</b><span>${esc(l.nome)}</span><strong>${l.pts} pts</strong></div>`).join('');
}
// Ranking global: os N de mais pontos no banco todo (reaproveita o mesmo doc/pontuação do ranking de amigos).
function listaRankGlobal(docs, r) {
  const w = r.w, meuUid = user && user.uid, linhas = [{ uid: 'eu', nome: `${meuApelido()} (você)`, pts: r.pts, eu: true }];
  for (const [uid, d] of Object.entries(docs)) { if (uid === meuUid) continue; linhas.push({ uid, nome: (d && d.nome) || 'Jogador', pts: ptsNaSemana(d, w) }); }
  linhas.sort((a, b) => b.pts - a.pts || (a.eu ? -1 : 1));
  return linhas.slice(0, 50).map((l, k) => `<div class="rankrow ${l.eu ? 'eu' : ''}"><b>${['🥇', '🥈', '🥉'][k] || `${k + 1}º`}</b><span>${esc(l.nome)}</span><strong>${l.pts} pts</strong></div>`).join('');
}

// Liga/desliga do número vermelho (aviso de itens) no botão do Celeiro e do Inventário.
const avisoItens = qual => !(state && state.semAviso && state.semAviso[qual]);
const chaveAviso = (qual, txt) => `<div class="setrow avisoitens"><label for="aviso_${qual}">🔴 ${txt}</label><input type="checkbox" class="switch" id="aviso_${qual}" data-aviso-itens="${qual}" ${avisoItens(qual) ? 'checked' : ''}></div>`;
$('#pane').addEventListener('change', e => {
  const t = e.target.closest('[data-aviso-itens]'); if (!t) return;
  (state.semAviso ||= {})[t.dataset.avisoItens] = !t.checked; done(); renderTabs();
  toast(t.checked ? 'Aviso de itens ligado.' : 'Aviso de itens desligado.');
});

// ---------- Tela de missões e coleção ----------
let missSeg = 'dia';
function missoesHTML() {
  rollPeriods();
  if (missSeg === 'colecao' && state.newStamps) { state.newStamps = 0; setTimeout(renderTabs, 0); save(); }
  const segs = [['dia', 'Diárias'], ['semana', 'Semanais'], ['vila', 'Vila'], ['colecao', 'Coleção'], ['trevos', '🍀 Trevos']];
  const conta = { dia: prontasDe('dia'), semana: prontasDe('semana'), vila: vilaProntos(), colecao: state.newStamps || 0, trevos: trevosPendentes() };
  let html = `<div class="seg small" role="tablist">${segs.map(([id, n]) => `<button type="button" role="tab" data-mseg="${id}" aria-selected="${missSeg === id}">${n}${conta[id] ? `<span class="badge" aria-label="${conta[id]} novidades">${conta[id]}</span>` : ''}</button>`).join('')}</div>`;
  const est = estacao();
  html += `<div class="row sel"><div class="avatar" style="background:#7aa35a;font-size:26px">${est.icone}</div><div><div class="name">${est.nome}</div>
    <div class="meta">Esta semana rendem ${Math.round(ESTACAO_BONUS * 100)}% a mais: ${est.plantas.map(id => (CROP[id] || ENFEITE[id] || { nome: id }).nome.toLowerCase()).join(', ')}.</div></div><div></div></div>`;
  if (missSeg === 'vila') return html + vilaHTML();
  if (missSeg === 'trevos') return html + trevosHTML();
  if (missSeg === 'colecao') {
    const lista = COLECAO(), temCarimbo = lista.filter(c => state.stamps[c.id]).length;
    html += `<p class="hint">Cada colheita ou produto recolhido conta. ${CARIMBOS.map((c, k) => `${c.n} dão o carimbo de ${c.nome} (+${c.moedas.toLocaleString('pt-BR')} moedas, ${Math.round(RAPIDEZ[k + 1] * 100)}% mais rápido)`).join(', ')}. Você já tem ${temCarimbo} de ${lista.length} com carimbo.</p><div class="colgrid">`;
    for (const c of lista) {
      const n = state.col[c.id] || 0, lv = state.stamps[c.id] || 0, next = CARIMBOS[lv];
      html += `<div class="colcard ${n ? '' : 'unknown'}" title="${esc(c.nome)}"><img alt="" src="${c.icon()}"><b>${n ? esc(c.nome) : '???'}</b><small>${n}${next ? ` / ${next.n}` : ''}${lv ? ` · −${Math.round(RAPIDEZ[lv] * 100)}% tempo` : ''}</small>
        <span class="stamps">${CARIMBOS.map((s, k) => `<i style="background:${k < lv ? s.cor : 'transparent'}" title="${s.nome}"></i>`).join('')}</span></div>`;
    }
    return html + '</div>';
  }
  const tipo = missSeg, lista = state.missions[tipo], p = tipo === 'dia' ? premioDia() : premioSemana();
  html += `<p class="hint">${tipo === 'dia' ? 'Missões novas todo dia à meia-noite.' : 'Missões novas toda segunda-feira à meia-noite.'} Cada uma dá ${p.moedas.toLocaleString('pt-BR')} moedas e ${p.xp} XP${p.racao ? ' e 1 ração especial' : ''}. ${state.missions['trevo_' + tipo] === state.missions[tipo === 'dia' ? 'd' : 'w'] ? `<b>🍀 +${TREVO_MISSOES[tipo]} trevos já ganhos!</b>` : `Pegue o prêmio de todas e ganhe <b>🍀 ${TREVO_MISSOES[tipo]} trevos</b> e ${tipo === 'dia' ? '<img class="emo" alt="" src="' + ferramentaIcon('enxada') + '"> 1 enxada de arrancar' : '<img class="emo" alt="" src="' + ferramentaIcon('motosserra') + '"> 1 motosserra'}.`}</p>`;
  lista.forEach((m, k) => {
    const ok = m.feito >= m.alvo;
    html += `<div class="row ${m.pego ? 'locked' : ok ? 'sel' : ''}"><div class="avatar" style="background:${ok ? '#4f9a2f' : '#d39a5c'}">${ok ? '✓' : k + 1}</div>
      <div><div class="name">${m.txt.replace('{n}', m.alvo.toLocaleString('pt-BR'))}</div>
      <div class="meta">${m.feito.toLocaleString('pt-BR')} de ${m.alvo.toLocaleString('pt-BR')}</div><div class="mbar"><i style="width:${m.feito / m.alvo * 100}%"></i></div></div>
      ${m.pego ? '<button class="btn ghost" disabled>Pego</button>' : `<button class="btn gold" data-claim="${tipo}:${k}" ${ok ? '' : 'disabled'}>${ok ? 'Pegar' : moeda(p.moedas)}</button>`}</div>`;
  });
  return html;
}

// ============================================================
// Fábrica, banca e caminhão
// ============================================================
// ---------- Fábrica: transforma colheitas e produtos dos animais em coisas que valem mais ----------
// in: ingredientes (ids do celeiro). tempo em segundos. forma/cor: como o produto é desenhado.
const RECEITAS = [
  { id: 'farinha',  nome: 'Farinha de trigo',    nivel: 2,  in: { trigo: 3 },                           tempo: 10 * MIN, forma: 'saco',     cor: '#f4efe2' },
  { id: 'farofa',   nome: 'Farinha de mandioca', nivel: 3,  in: { mandioca: 2 },                        tempo: 40 * MIN, forma: 'saco',     cor: '#f0dca8' },
  { id: 'pipoca',   nome: 'Pipoca',              nivel: 3,  in: { milho: 2 },                           tempo: 15 * MIN, forma: 'balde',    cor: '#fff3c4' },
  { id: 'pao',      nome: 'Pão',                 nivel: 4,  in: { farinha: 2, ovo: 1 },                 tempo: 30 * MIN, forma: 'pao',      cor: '#d99a4e' },
  { id: 'molho',    nome: 'Molho de tomate',     nivel: 5,  in: { tomate: 4 },                          tempo: 30 * MIN, forma: 'pote',     cor: '#d8342a' },
  { id: 'bolo',     nome: 'Bolo de cenoura',     nivel: 6,  in: { cenoura: 3, ovo: 2, farinha: 1 },     tempo: HOUR,     forma: 'bolo',     cor: '#f08a24' },
  { id: 'geleia',   nome: 'Geleia de morango',   nivel: 7,  in: { morango: 5 },                         tempo: HOUR,     forma: 'pote',     cor: '#e0224a' },
  { id: 'novelo',   nome: 'Novelo de lã',        nivel: 8,  in: { la: 2 },                              tempo: HOUR,     forma: 'novelo',   cor: '#f4f1ea' },
  { id: 'manteiga', nome: 'Manteiga',            nivel: 10, in: { leite: 1 },                           tempo: 40 * MIN, forma: 'manteiga', cor: '#ffe27a' },
  { id: 'queijo',   nome: 'Queijo',              nivel: 10, in: { leite: 2 },                           tempo: HOUR,     forma: 'queijo',   cor: '#f7d046' },
  { id: 'sucouva',  nome: 'Suco de uva',         nivel: 15, in: { uva: 4 },                             tempo: 30 * MIN, forma: 'garrafa',  cor: '#6b3a8a' },
  { id: 'sucolar',  nome: 'Suco de laranja',     nivel: 19, in: { laranja: 4 },                         tempo: 30 * MIN, forma: 'garrafa',  cor: '#f28c1b' },
  { id: 'arrozfeijao', nome: 'Arroz com feijão', nivel: 2,  in: { arroz: 3, feijao: 3 },                tempo: 20 * MIN, forma: 'prato',    cor: '#e8d8a8' },
  { id: 'pacoca',   nome: 'Paçoca',              nivel: 7,  in: { amendoim: 4 },                        tempo: 40 * MIN, forma: 'manteiga', cor: '#d9b27a' },
  { id: 'rapadura', nome: 'Rapadura',            nivel: 11, in: { cana: 4 },                            tempo: HOUR,     forma: 'manteiga', cor: '#a0602a' },
  // pratos com peixe (os peixes vêm da pescaria)
  { id: 'peixefrito',  nome: 'Lambari frito',       nivel: 3,  in: { lambari: 3, farofa: 1 },            tempo: 20 * MIN, forma: 'prato',  cor: '#d9a441', peixe: 'lambari' },
  { id: 'caldo',       nome: 'Caldo de tilápia',    nivel: 4,  in: { tilapia: 2, mandioca: 2 },          tempo: 40 * MIN, forma: 'panela', cor: '#e8c65a' },
  { id: 'moqueca',     nome: 'Moqueca de tucunaré', nivel: 7,  in: { tucunare: 1, tomate: 2, cebola: 1 }, tempo: HOUR,     forma: 'panela', cor: '#d9622a' },
  { id: 'pintadoass',  nome: 'Pintado assado',      nivel: 10, in: { pintado: 1, molho: 1 },             tempo: HOUR,     forma: 'prato',  cor: '#c7c1b3', peixe: 'pintado' },
  { id: 'douradobr',   nome: 'Dourado na brasa',    nivel: 13, in: { dourado: 1, cebola: 2 },            tempo: 90 * MIN, forma: 'prato',  cor: '#f2b705', peixe: 'dourado' },
  { id: 'casaca',      nome: 'Pirarucu de casaca',  nivel: 18, in: { pirarucu: 1, farofa: 2, banana: 3 }, tempo: 2 * HOUR, forma: 'prato',  cor: '#6b5a4a', peixe: 'pirarucu' },
  // artesanato com o que a caçada deixa (pena, pata, presa)
  { id: 'cocar',    nome: 'Cocar de penas',       nivel: 10, in: { pena: 4 },                            tempo: 45 * MIN, forma: 'novelo',   cor: '#3f9a5a' },
  { id: 'amuleto',  nome: 'Amuleto de pata',      nivel: 10, in: { pata: 2 },                            tempo: HOUR,     forma: 'manteiga', cor: '#8a6234' },
  { id: 'colar',    nome: 'Colar de presas',      nivel: 20, in: { presa: 1 },                           tempo: 2 * HOUR, forma: 'queijo',   cor: '#3a2a3a' },
];
const RECEITA = Object.fromEntries(RECEITAS.map(r => [r.id, r]));
// O produto vale 50% a mais que os ingredientes, e um pouco pelo tempo de fábrica.
for (const r of RECEITAS) {
  const base = Object.entries(r.in).reduce((t, [id, q]) => t + ((PRODUCE[id] || PRODUCT[id] || RECEITA[id] || {}).preco || 0) * q, 0);
  r.preco = Math.round(base * 1.5 + r.tempo / 60);
  PRODUCT[r.id] = { id: r.id, nome: r.nome, preco: r.preco, fabrica: true };
}
// Cada máquina tem sua receitas e seus próprios espaços: o 1º libera sozinho no nível,
// os seguintes se compram (nível + moedas). Todos os espaços de uma máquina produzem ao mesmo tempo.
// Todas as máquinas têm 6 espaços (o 1º de graça no nível, os outros 5 compram-se subindo de nível).
const MAQUINAS = [
  { id: 'padaria',    nome: 'Moinho & Padaria', emoji: '🌾',
    receitas: ['farinha', 'farofa', 'pipoca', 'pao', 'bolo', 'arrozfeijao', 'pacoca', 'rapadura'],
    slots: [{ nivel: 2, custo: 0 }, { nivel: 4, custo: 300 }, { nivel: 8, custo: 900 }, { nivel: 15, custo: 2200 }, { nivel: 24, custo: 4500 }, { nivel: 35, custo: 8000 }] },
  { id: 'cozinha',    nome: 'Cozinha do Rio', emoji: '🐟',
    receitas: ['peixefrito', 'caldo', 'moqueca', 'pintadoass', 'douradobr', 'casaca'],
    slots: [{ nivel: 3, custo: 0 }, { nivel: 7, custo: 400 }, { nivel: 13, custo: 1300 }, { nivel: 20, custo: 2800 }, { nivel: 30, custo: 5600 }, { nivel: 42, custo: 10000 }] },
  { id: 'conservas',  nome: 'Conservas', emoji: '🍯',
    receitas: ['molho', 'geleia', 'novelo'],
    slots: [{ nivel: 5, custo: 0 }, { nivel: 10, custo: 500 }, { nivel: 16, custo: 1300 }, { nivel: 24, custo: 3000 }, { nivel: 34, custo: 6000 }, { nivel: 46, custo: 11000 }] },
  { id: 'laticinios', nome: 'Laticínios', emoji: '🧀',
    receitas: ['manteiga', 'queijo'],
    slots: [{ nivel: 10, custo: 0 }, { nivel: 14, custo: 650 }, { nivel: 20, custo: 1500 }, { nivel: 28, custo: 3000 }, { nivel: 38, custo: 6000 }, { nivel: 50, custo: 11000 }] },
  { id: 'suqueira',   nome: 'Suqueira', emoji: '🧃',
    receitas: ['sucouva', 'sucolar'],
    slots: [{ nivel: 15, custo: 0 }, { nivel: 20, custo: 900 }, { nivel: 26, custo: 2000 }, { nivel: 34, custo: 4000 }, { nivel: 44, custo: 7200 }, { nivel: 56, custo: 12000 }] },
  { id: 'artesanato', nome: 'Artesanato da caçada', emoji: '🪶',
    receitas: ['cocar', 'amuleto', 'colar'],
    slots: [{ nivel: 10, custo: 0 }, { nivel: 20, custo: 800 }, { nivel: 28, custo: 1800 }, { nivel: 36, custo: 3600 }, { nivel: 46, custo: 7000 }, { nivel: 58, custo: 12000 }] },
];
const MAQUINA = Object.fromEntries(MAQUINAS.map(m => [m.id, m]));
const MAQUINA_DE = Object.fromEntries(MAQUINAS.flatMap(m => m.receitas.map(r => [r, m.id])));
const filaDe = mid => { const f = state.fab || (state.fab = { maquinas: {} }); return f.maquinas[mid] || (f.maquinas[mid] = { fila: [], extra: 0 }); };
// Quantos espaços a máquina já tem prontos pra usar (o 1º por nível, os outros comprados).
const slotsMax = mid => { const st = MAQUINA[mid].slots, m = filaDe(mid); return (state.level >= st[0].nivel ? 1 : 0) + Math.min(m.extra || 0, st.length - 1); };
// O próximo espaço a comprar nessa máquina (null se já tem todos).
const proxSlotFab = mid => { const st = MAQUINA[mid].slots, m = filaDe(mid), k = (state.level >= st[0].nivel ? 1 : 0) + (m.extra || 0); return st[k] || null; };
function comprarSlotFab(mid) {
  const M = MAQUINA[mid], nx = proxSlotFab(mid);
  if (!nx) return;
  if (state.level < nx.nivel) return toast(`Esse espaço da ${M.nome} libera no nível ${nx.nivel}.`);
  if (state.coins < nx.custo) return toast(`Esse espaço da ${M.nome} custa ${nx.custo.toLocaleString('pt-BR')} moedas.`, 'bad');
  state.coins -= nx.custo; filaDe(mid).extra = (filaDe(mid).extra || 0) + 1;
  sfx('buy'); toast(`Novo espaço na ${M.nome}!`, 'good'); done();
}
const temIngredientes = (r, n = 1) => Object.entries(r.in).every(([id, q]) => (state.barn[id] || 0) >= q * n);
function fabricar(id) {
  const r = RECEITA[id], mid = MAQUINA_DE[id], M = MAQUINA[mid], m = filaDe(mid), max = slotsMax(mid);
  if (state.level < r.nivel) return toast(`${r.nome} libera no nível ${r.nivel}.`);
  if (!max) return toast(`A ${M.nome} libera no nível ${M.slots[0].nivel}.`);
  if (m.fila.length >= max) return toast(`Os ${max} espaços da ${M.nome} estão ocupados. Recolha o que ficou pronto ou compre mais espaço.`);
  if (!temIngredientes(r)) return toast(`Faltam ingredientes para ${r.nome.toLowerCase()}.`, 'bad');
  for (const [iid, q] of Object.entries(r.in)) { state.barn[iid] -= q; if (!state.barn[iid]) delete state.barn[iid]; }
  // cada espaço trabalha sozinho: começa na hora
  const ini = Date.now();
  m.fila.push({ r: id, fim: ini + r.tempo * 1000 });
  sfx('buy'); toast(`${r.nome} na ${M.nome}! Fica pronto em ${fmt(r.tempo)}.`, 'good');
  done();
}
const prontosFabDe = mid => filaDe(mid).fila.filter(x => x.fim <= Date.now()).length;
// Máquina com espaço livre e ingrediente pra pelo menos uma receita: dá pra fazer algo ali agora.
const podeFabricarAlgo = mid => MAQUINA[mid].receitas.some(rid => RECEITA[rid].nivel <= state.level && temIngredientes(RECEITA[rid]));
const slotsLivresFab = mid => Math.max(0, slotsMax(mid) - filaDe(mid).fila.length);
const prontosFab = () => state ? MAQUINAS.reduce((t, M) => t + prontosFabDe(M.id) + (slotsLivresFab(M.id) > 0 && podeFabricarAlgo(M.id) ? 1 : 0), 0) : 0;
function recolherFab(mid) {
  const m = filaDe(mid), agora = Date.now(), prontos = m.fila.filter(x => x.fim <= agora);
  if (!prontos.length) return;
  m.fila = m.fila.filter(x => x.fim > agora);
  for (const x of prontos) { const r = RECEITA[x.r]; state.barn[r.id] = (state.barn[r.id] || 0) + 1; addXP(Math.max(2, Math.round(r.tempo / 600)), null); track('fabricar'); if (Object.keys(r.in).some(id => PEIXE[id])) track('cozinhar'); }
  sfx('collect');
  toast(`Recolheu da ${MAQUINA[mid].nome}: ${prontos.map(x => RECEITA[x.r].nome.toLowerCase()).join(', ')}.`, 'good');
  done();
}

// ---------- Banca: coloque coisas à venda para os amigos ----------
// 6 lugares sempre livres; mais 4 liberam por nível, e cada amigo de verdade adianta 1 nível (até 5).
const BANCA_BASE = 6, BANCA_EXTRA = [8, 12, 18, 25], BANCA_TOPO = BANCA_BASE + BANCA_EXTRA.length, BANCA_DESC_MAX = 5;
const bancaDesconto = () => Math.min(BANCA_DESC_MAX, (state.friends || []).length);
const bancaNivelVaga = i => Math.max(1, BANCA_EXTRA[i] - bancaDesconto());
const bancaMax = () => BANCA_BASE + BANCA_EXTRA.filter((_, i) => state.level >= bancaNivelVaga(i)).length;
const valorDe = id => (item(id) || {}).preco || 0;
function bancaAdd(id, qtd, preco) {
  state.banca = state.banca || [];
  const lim = bancaMax();
  if (state.banca.length >= lim) return toast(`A banca tem ${lim} lugares.`);
  qtd = clamp(Math.floor(qtd) || 1, 1, 10);
  if ((state.barn[id] || 0) < qtd) return toast('Você não tem tudo isso no celeiro.', 'bad');
  const [min, max] = faixaPreco(id, qtd);
  preco = clamp(Math.round(preco) || 0, min, max);
  state.barn[id] -= qtd; if (!state.barn[id]) delete state.barn[id];
  state.banca.push({ id: newId(), item: id, qtd, preco, at: Date.now() });
  sfx('buy'); toast(`${qtd} ${item(id).nome.toLowerCase()} na banca por ${preco.toLocaleString('pt-BR')} moedas.`, 'good');
  done();
}
// Preço na banca: de metade até o dobro do valor no celeiro (o máximo evita preços abusivos).
const BANCA_QTD_MAX = 10;
const faixaPreco = (id, qtd) => [Math.max(1, Math.round(valorDe(id) * qtd * 0.5)), Math.max(1, Math.round(valorDe(id) * qtd * 2))];
// Janelinha que abre ao clicar num lugar livre da banca.
const bm = { item: null, qtd: 1, preco: 0 };
function abrirBancaModal() {
  const tenho = Object.keys(state.barn).filter(id => state.barn[id] > 0 && item(id));
  if (!tenho.length) return toast('O celeiro está vazio. Colha ou fabrique algo para vender.');
  const max = bancaMax();
  if ((state.banca || []).length >= max) return toast(`A banca tem ${max} lugares.`);
  if (!tenho.includes(bm.item)) bm.item = tenho[0];
  escolherBancaItem(bm.item);
  $('#bancaModal').hidden = false;
}
function escolherBancaItem(id) {
  bm.item = id; bm.qtd = Math.min(bm.qtd || 1, state.barn[id] || 1, BANCA_QTD_MAX);
  bm.preco = Math.round(valorDe(id) * bm.qtd * 1.2);
  renderBancaModal();
}
function renderBancaModal() {
  const tenho = Object.keys(state.barn).filter(id => state.barn[id] > 0 && item(id));
  $('#bmItens').innerHTML = tenho.map(id => `<button type="button" class="bmitem ${id === bm.item ? 'sel' : ''}" data-bm-item="${id}" aria-pressed="${id === bm.item}">
    <img alt="" src="${itemIcon(id)}"><span>${esc(item(id).nome)}</span><small>tem ${state.barn[id]}</small></button>`).join('');
  const tem = state.barn[bm.item] || 0, maxQ = Math.min(tem, BANCA_QTD_MAX), [min, max] = faixaPreco(bm.item, bm.qtd);
  bm.qtd = clamp(bm.qtd, 1, maxQ); bm.preco = clamp(bm.preco, min, max);
  $('#bmNome').textContent = item(bm.item).nome;
  $('#bmQtd').textContent = bm.qtd;
  $('#bmTem').textContent = `você tem ${tem}${tem > BANCA_QTD_MAX ? ` (até ${BANCA_QTD_MAX} por lugar)` : ''}`;
  $('#bmPreco').value = bm.preco;
  $('#bmFaixa').textContent = `mín. ${min.toLocaleString('pt-BR')} · máx. ${max.toLocaleString('pt-BR')} · vale ${valorDe(bm.item).toLocaleString('pt-BR')} cada no celeiro`;
  $('#bmQmenos').disabled = bm.qtd <= 1; $('#bmQmais').disabled = bm.qtd >= maxQ;
  // o preço dá a volta: no máximo, + vai para o mínimo; no mínimo, − vai para o máximo
  $('#bmPmenos').disabled = $('#bmPmais').disabled = min >= max;
}
function bancaModalClick(e) {
  const t = e.target;
  if (t === $('#bancaModal') || t.closest('[data-close]')) { $('#bancaModal').hidden = true; return; }
  const it = t.closest('[data-bm-item]'); if (it) return escolherBancaItem(it.dataset.bmItem);
  const passo = Math.max(1, Math.round(valorDe(bm.item) * bm.qtd * 0.1));
  const un = valorDe(bm.item) * 1.2;
  if (t.closest('#bmQmenos')) { bm.qtd--; bm.preco = Math.round(un * bm.qtd); return renderBancaModal(); }
  if (t.closest('#bmQmais')) { bm.qtd++; bm.preco = Math.round(un * bm.qtd); return renderBancaModal(); }
  const [pmin, pmax] = faixaPreco(bm.item, bm.qtd);
  if (t.closest('#bmPmenos')) { bm.preco = bm.preco <= pmin ? pmax : Math.max(pmin, bm.preco - passo); return renderBancaModal(); }
  if (t.closest('#bmPmais')) { bm.preco = bm.preco >= pmax ? pmin : Math.min(pmax, bm.preco + passo); return renderBancaModal(); }
  if (t.closest('#bmOk')) { $('#bancaModal').hidden = true; return bancaAdd(bm.item, bm.qtd, bm.preco); }
}
let bancaRemArmed = null;
function bancaRemove(sid) {
  const s = (state.banca || []).find(x => x.id === sid); if (!s) return;
  if (bancaRemArmed !== sid) {
    bancaRemArmed = sid; renderPane();
    toast('Atenção: ao tirar da banca, você NÃO recebe o item de volta nem dinheiro. Clique em "Confirmar" para tirar mesmo assim.', 'bad');
    setTimeout(() => { if (bancaRemArmed === sid) { bancaRemArmed = null; renderPane(); } }, 5000);
    return;
  }
  bancaRemArmed = null;
  state.banca = state.banca.filter(x => x !== s);
  toast('Item tirado da banca.'); done();
}
// Alguém comprou da sua banca (amigo pela nuvem ou vizinho da vila).
function bancaVendeu(s, quem) {
  state.banca = state.banca.filter(x => x !== s);
  state.coins += s.preco; state.stats.vendido += s.preco; track('vender', s.preco);
  const msg = `${quem} comprou ${s.qtd} ${item(s.item).nome.toLowerCase()} da sua banca por ${s.preco.toLocaleString('pt-BR')} moedas!`;
  addNews(msg); toast(msg, 'good'); sfx('coin');
}
// Os vizinhos da vila passam na banca de vez em quando e compram o que está com preço justo.
function bancaTick() {
  const agora = Date.now(), ult = state.bancaT || agora, horas = (agora - ult) / 3600e3;
  state.bancaT = agora;
  if (!state.banca || !state.banca.length || horas <= 0) return;
  for (const s of state.banca.slice()) {
    if (agora - s.at < 10 * 60e3) continue;
    if (s.preco > valorDe(s.item) * s.qtd * 1.3) continue; // caro demais: só amigo compra
    const chance = 1 - Math.pow(0.6, Math.min(horas, 48));
    if (Math.random() < chance) bancaVendeu(s, NEIGHBORS[Math.floor(Math.random() * NEIGHBORS.length)].nome);
  }
}
// Comprar da banca de um amigo (ou de um vizinho da vila).
function bancaComprar(sid) {
  const dono = view.data, s = (dono.banca || []).find(x => x.id === sid);
  if (!s || s.vendido) return toast('Esse já foi vendido.');
  if (state.coins < s.preco) return toast(`Faltam moedas: custa ${s.preco.toLocaleString('pt-BR')}.`, 'bad');
  state.coins -= s.preco; s.vendido = true;
  state.barn[s.item] = (state.barn[s.item] || 0) + s.qtd;
  state.log['banca:' + s.id] = Date.now();
  sfx('coin');
  toast(`Comprou ${s.qtd} ${item(s.item).nome.toLowerCase()} de ${view.nome}!`, 'good');
  if (view.kind === 'friend') sendVisit({ t: 'buy', slot: s.id, item: s.item, qtd: s.qtd, preco: s.preco });
  done();
}
function npcBanca() {
  const pool = [...CROPS.filter(c => c.nivel <= state.level + 2).map(c => c.prod), 'ovo', 'leite', ...RECEITAS.filter(r => r.nivel <= state.level + 2).map(r => r.id)];
  return Array.from({ length: 3 }, () => {
    const it = pool[Math.floor(Math.random() * pool.length)], qtd = 1 + Math.floor(Math.random() * 5);
    return { id: newId(), item: it, qtd, preco: Math.round(valorDe(it) * qtd * (1 + Math.random() * 0.3)), at: Date.now() };
  });
}

// ---------- Caminhão: 5 pedidos novos a cada 4 horas ----------
const CAMINHAO_BLOCO = 4 * 3600e3, CAMINHAO_N = 5;
const blocoCaminhao = () => Math.floor(Date.now() / CAMINHAO_BLOCO);
function itensPossiveis() {
  const l = CROPS.filter(c => c.nivel <= state.level).map(c => c.prod);
  const bichos = new Set(state.animals.filter(a => ANIMAL[a.k].tipo === 'prod' && ANIMAL[a.k].prod !== 'leitao').map(a => ANIMAL[a.k].prod));
  const caca = PRODUTOS_CACA.filter(p => jaCacou(p.id)).map(p => p.id);
  return [...l, ...bichos, ...caca, ...RECEITAS.filter(r => r.nivel <= state.level && receitaPossivel(r)).map(r => r.id)];
}
function novoPedido() {
  const pool = itensPossiveis(), n = 1 + Math.floor(Math.random() * Math.min(3, 1 + state.level / 6)), itens = {};
  while (Object.keys(itens).length < n && Object.keys(itens).length < pool.length) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    const barato = valorDe(id) < 60;
    itens[id] = barato ? 4 + Math.floor(Math.random() * (4 + state.level)) : 1 + Math.floor(Math.random() * 4);
  }
  const valor = Object.entries(itens).reduce((t, [id, q]) => t + valorDe(id) * q, 0);
  return { itens, moedas: Math.round(valor * 1.6 / 5) * 5, xp: Math.max(3, Math.round(valor / 25)), feito: false };
}
function rollCaminhao() {
  const b = blocoCaminhao();
  if (state.truck && state.truck.b === b) return;
  state.truck = { b, pedidos: Array.from({ length: CAMINHAO_N }, novoPedido) };
}
const podeEntregar = p => !p.feito && Object.entries(p.itens).every(([id, q]) => (state.barn[id] || 0) >= q);
const entregaveis = () => (state && state.truck ? state.truck.pedidos.filter(podeEntregar).length : 0);
function entregar(k) {
  const p = state.truck.pedidos[k];
  if (!p || !podeEntregar(p)) return toast('Faltam itens no celeiro para esse pedido.', 'bad');
  for (const [id, q] of Object.entries(p.itens)) { state.barn[id] -= q; if (!state.barn[id]) delete state.barn[id]; }
  p.feito = true;
  state.coins += p.moedas; addXP(p.xp, null); track('entregar');
  done();
  mostrarEntrega(`O caminhão levou o pedido! +${p.moedas.toLocaleString('pt-BR')} moedas e +${p.xp} XP.`);
}

// ---------- Tela da fábrica (com a banca e o caminhão) ----------
let fabSeg = 'fabrica';
function fabricaHTML() {
  const segs = [['fabrica', 'Fábrica', prontosFab()], ['banca', 'Banca', 0], ['caminhao', 'Caminhão', entregaveis()]];
  if (!isHome()) return bancaVisitaHTML();
  rollCaminhao();
  let html = `<div class="seg small" role="tablist">${segs.map(([id, n, c]) => `<button type="button" role="tab" data-fseg="${id}" aria-selected="${fabSeg === id}">${n}${c ? `<span class="badge ready">${c}</span>` : ''}</button>`).join('')}</div>`;
  if (fabSeg === 'fabrica') {
    html += `<p class="hint">Cada máquina transforma colheitas e produtos dos animais em coisas que valem mais, e tem seus próprios espaços: o primeiro libera sozinho no nível certo, os outros você compra. Todos os espaços de uma máquina produzem ao mesmo tempo.</p>`;
    for (const M of MAQUINAS) {
      const m = filaDe(M.id), agora = Date.now(), max = slotsMax(M.id), nx = proxSlotFab(M.id);
      html += `<h3>${M.emoji} ${M.nome}</h3>`;
      if (!max) { html += `<p class="hint">Libera no nível ${M.slots[0].nivel}.</p>`; continue; }
      html += `<div class="fila">${Array.from({ length: max + (nx ? 1 : 0) }, (_, k) => {
        if (k >= max) return `<button type="button" class="fslot vazio trancado" data-fab-slot="${M.id}">🔒 ${state.level < nx.nivel ? `nível ${nx.nivel}` : moeda(nx.custo)}</button>`;
        const x = m.fila[k];
        if (!x) return '<div class="fslot vazio">vazio</div>';
        const r = RECEITA[x.r], pronto = x.fim <= agora;
        return `<div class="fslot ${pronto ? 'pronto' : ''}"><img alt="" src="${productIcon(r.id)}"><small>${pronto ? 'Pronto!' : fmt((x.fim - agora) / 1000)}</small></div>`;
      }).join('')}</div>`;
      const prontosM = prontosFabDe(M.id);
      if (prontosM) html += `<button class="btn gold" data-fab-recolher="${M.id}">Recolher ${prontosM > 1 ? `tudo (${prontosM})` : 'o que ficou pronto'}</button>`;
      const receitasM = M.receitas.map(id => RECEITA[id]);
      const vis = receitasM.filter(r => r.nivel <= state.level), prox = receitasM.filter(r => r.nivel > state.level).slice(0, 1);
      for (const r of [...vis, ...prox]) {
        const locked = r.nivel > state.level, ok = !locked && temIngredientes(r) && m.fila.length < max;
        const ing = Object.entries(r.in).map(([id, q]) => `<span class="${(state.barn[id] || 0) >= q ? '' : 'falta'}">${q} ${item(id) ? item(id).nome.toLowerCase() : id} (${state.barn[id] || 0})</span>`).join(' + ');
        html += `<div class="row ${locked ? 'locked' : ''}"><img alt="" src="${productIcon(r.id)}"><div><div class="name">${r.nome}${state.barn[r.id] ? ` <span class="meta">(${state.barn[r.id]} no celeiro)</span>` : ''}</div>
          <div class="meta">${ing}<br>${fmt(r.tempo)} · vende por ${moeda(r.preco)}</div></div>
          ${locked ? `<button class="btn" disabled>Nível ${r.nivel}</button>` : `<button class="btn" data-fabricar="${r.id}" ${ok ? '' : 'disabled'}>Fazer</button>`}</div>`;
      }
    }
  } else if (fabSeg === 'banca') {
    const banca = state.banca || [], max = bancaMax(), desc = bancaDesconto();
    html += `<p class="hint">Coloque coisas do celeiro à venda. Os amigos compram quando visitam a sua roça, e os vizinhos da vila passam de vez em quando (se o preço for justo). O dinheiro chega sozinho.${max < BANCA_TOPO ? ` Cada amigo de verdade adianta 1 nível pra liberar mais lugares (até ${BANCA_DESC_MAX})${desc ? ` — você já tem ${desc}` : ''}.` : ''}</p>`;
    html += `<div class="banca">${Array.from({ length: Math.min(BANCA_TOPO, max + 1) }, (_, k) => {
      if (k >= max) return `<button type="button" class="bslot vazio trancado" disabled>🔒<br>nível ${bancaNivelVaga(k - BANCA_BASE)}</button>`;
      const s = banca[k];
      if (!s) return '<button type="button" class="bslot vazio" data-banca-novo>+<br>lugar livre</button>';
      const armed = bancaRemArmed === s.id;
      return `<div class="bslot"><img alt="" src="${itemIcon(s.item)}"><b>${s.qtd} ${esc(item(s.item).nome)}</b><span>${moeda(s.preco)}</span>
        <button class="btn ${armed ? 'danger' : 'ghost'} tiny" data-banca-rem="${s.id}">${armed ? 'Confirmar' : 'Tirar'}</button></div>`;
    }).join('')}</div>`;
    if (!Object.keys(state.barn).some(id => state.barn[id] > 0 && item(id))) html += `<div class="empty">O celeiro está vazio. Colha ou fabrique algo para vender.</div>`;
    else if (banca.length < max) html += `<p class="hint">Clique num lugar livre para escolher o que vender.</p>`;
  } else {
    const t = state.truck, falta = (t.b + 1) * CAMINHAO_BLOCO - Date.now();
    html += `<p class="hint">O caminhão leva pedidos da cidade e paga bem mais que o celeiro. Pedidos novos em <b>${fmt(falta / 1000)}</b>.</p>`;
    t.pedidos.forEach((p, k) => {
      const ok = podeEntregar(p);
      const lista = Object.entries(p.itens).map(([id, q]) => `<span class="${(state.barn[id] || 0) >= q ? '' : 'falta'}"><img alt="" src="${itemIcon(id)}">${q} ${esc(item(id).nome.toLowerCase())} (${state.barn[id] || 0})</span>`).join('');
      html += `<div class="row ${p.feito ? 'locked' : ok ? 'sel' : ''}"><div class="avatar" style="background:${p.feito ? '#4f9a2f' : '#3f6fa8'}">${p.feito ? '✓' : k + 1}</div>
        <div><div class="pedido">${lista}</div><div class="meta">${p.moedas.toLocaleString('pt-BR')} moedas · ${p.xp} XP</div></div>
        ${p.feito ? '<button class="btn ghost" disabled>Entregue</button>' : `<button class="btn gold" data-entregar="${k}" ${ok ? '' : 'disabled'}>Entregar</button>`}</div>`;
    });
  }
  return html;
}
function bancaVisitaHTML() {
  const banca = (view.data.banca || []);
  let html = `<h3>Banca de ${esc(view.nome)}</h3>`;
  if (!banca.length) return html + '<div class="empty">A banca está vazia hoje.</div>';
  html += `<p class="hint">Compre o que quiser: vai direto para o seu celeiro.</p><div class="banca">`;
  for (const s of banca) {
    const vendido = s.vendido || state.log['banca:' + s.id];
    html += `<div class="bslot ${vendido ? 'vendido' : ''}"><img alt="" src="${itemIcon(s.item)}"><b>${s.qtd} ${esc(item(s.item) ? item(s.item).nome : s.item)}</b><span>${moeda(s.preco)}</span>
      ${vendido ? '<button class="btn ghost tiny" disabled>Vendido</button>' : `<button class="btn tiny" data-banca-comprar="${esc(s.id)}" ${state.coins < s.preco ? 'disabled' : ''}>Comprar</button>`}</div>`;
  }
  return html + '</div>';
}

// ---------- Desenho dos produtos da fábrica ----------
function drawGood(id, x, y, s) {
  const r = RECEITA[id], c = r.cor;
  ctx.lineWidth = Math.max(1, 0.5 * s); ctx.strokeStyle = 'rgba(60,30,10,.55)';
  const f = r.forma;
  if (f === 'saco') {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 4 * s); ctx.quadraticCurveTo(x - 7 * s, y + 6 * s, x - 5 * s, y + 7 * s); ctx.lineTo(x + 5 * s, y + 7 * s); ctx.quadraticCurveTo(x + 7 * s, y + 6 * s, x + 5 * s, y - 4 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a06a'; ctx.fillRect(x - 3 * s, y - 6 * s, 6 * s, 2.5 * s);
    ctx.fillStyle = id === 'farinha' ? '#e8c35a' : '#a86b38'; ctx.beginPath(); ctx.arc(x, y + 2 * s, 2.2 * s, 0, 7); ctx.fill();
  } else if (f === 'balde') {
    ctx.fillStyle = '#e0463a'; ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 2 * s); ctx.lineTo(x + 5 * s, y - 2 * s); ctx.lineTo(x + 4 * s, y + 7 * s); ctx.lineTo(x - 4 * s, y + 7 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; for (let k = 0; k < 3; k++) ctx.fillRect(x - 4 * s + k * 3 * s, y - 2 * s, 1.5 * s, 9 * s);
    ctx.fillStyle = c; for (const [dx, dy] of [[-3, -3], [0, -4.5], [3, -3], [-1.5, -5.5], [1.5, -5.8]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 1.8 * s, 0, 7); ctx.fill(); }
  } else if (f === 'pao') {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 7 * s, 4.5 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#a86b38'; for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(x + dx * s - s, y - 1 * s); ctx.lineTo(x + dx * s + s, y + 2 * s); ctx.stroke(); }
  } else if (f === 'bolo') {
    ctx.fillStyle = c; ctx.fillRect(x - 6 * s, y - 2 * s, 12 * s, 7 * s); ctx.strokeRect(x - 6 * s, y - 2 * s, 12 * s, 7 * s);
    ctx.fillStyle = '#6b3a1a'; ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 6 * s, 2 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e53b2f'; ctx.beginPath(); ctx.arc(x, y - 4 * s, 1.4 * s, 0, 7); ctx.fill();
  } else if (f === 'pote') {
    ctx.fillStyle = c; ctx.fillRect(x - 4.5 * s, y - 3 * s, 9 * s, 9 * s); ctx.strokeRect(x - 4.5 * s, y - 3 * s, 9 * s, 9 * s);
    ctx.fillStyle = '#fff4e0'; ctx.fillRect(x - 5 * s, y - 6 * s, 10 * s, 3 * s); ctx.fillStyle = '#e53b2f'; for (let k = 0; k < 3; k++) ctx.fillRect(x - 5 * s + k * 3.5 * s, y - 6 * s, 1.6 * s, 3 * s);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - 3 * s, y - 2 * s, 1.5 * s, 6 * s);
  } else if (f === 'novelo') {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y + 1 * s, 6 * s, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,130,110,.6)'; for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.ellipse(x, y + s, 5.5 * s, 2.5 * s, a, 0, 7); ctx.stroke(); }
  } else if (f === 'manteiga') {
    ctx.fillStyle = c; ctx.fillRect(x - 6 * s, y - 1 * s, 12 * s, 5 * s); ctx.strokeRect(x - 6 * s, y - 1 * s, 12 * s, 5 * s);
    ctx.fillStyle = '#fff4c0'; ctx.fillRect(x - 6 * s, y - 3 * s, 12 * s, 2 * s);
  } else if (f === 'queijo') {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 7 * s, y + 5 * s); ctx.lineTo(x + 7 * s, y + 5 * s); ctx.lineTo(x + 7 * s, y - 1 * s); ctx.lineTo(x - 7 * s, y - 4 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9a82a'; for (const [dx, dy, rr] of [[-3, 1, 1.4], [2, 2.5, 1.1], [4, -0.2, 0.9]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, rr * s, 0, 7); ctx.fill(); }
  } else if (f === 'prato') {
    ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.ellipse(x, y + 3 * s, 8 * s, 3.6 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,120,180,.5)'; ctx.beginPath(); ctx.ellipse(x, y + 3 * s, 6.5 * s, 2.7 * s, 0, 0, 7); ctx.stroke();
    const px = PEIXE[r.peixe] || PEIXE.lambari;
    drawPeixe(ctx, x - 0.5 * s, y + 1.2 * s, s * 0.45, Object.assign({}, px, { cor: [c, '#a86b38'] }));
    ctx.fillStyle = '#9bd35a'; ctx.beginPath(); ctx.arc(x + 5 * s, y + 3.5 * s, 1.4 * s, 0, 7); ctx.fill(); // limão
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(x - 5.2 * s, y + 3.6 * s, 1.2 * s, 0, 7); ctx.fill();
  } else if (f === 'panela') {
    ctx.fillStyle = '#8a4a2a'; ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 7.5 * s, 4.5 * s, 0, 0, Math.PI); ctx.lineTo(x - 7.5 * s, y + 2 * s); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - 9.5 * s, y + 1 * s, 2.5 * s, 1.6 * s); ctx.fillRect(x + 7 * s, y + 1 * s, 2.5 * s, 1.6 * s);
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 7 * s, 2.4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; for (const [dx, dy] of [[-3, 1.5], [2, 2.5], [4, 1.4]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 0.9 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#4f9a2f'; ctx.beginPath(); ctx.arc(x - 1 * s, y + 1.4 * s, 1 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.7 * s; for (const dx of [-2, 2]) { ctx.beginPath(); ctx.moveTo(x + dx * s, y - 1 * s); ctx.quadraticCurveTo(x + dx * s + 1.5 * s, y - 4 * s, x + dx * s, y - 6 * s); ctx.stroke(); }
  } else if (f === 'garrafa') {
    ctx.fillStyle = 'rgba(230,245,255,.9)'; ctx.fillRect(x - 3.5 * s, y - 3 * s, 7 * s, 10 * s); ctx.strokeRect(x - 3.5 * s, y - 3 * s, 7 * s, 10 * s);
    ctx.fillStyle = c; ctx.fillRect(x - 3 * s, y, 6 * s, 6.5 * s);
    ctx.fillStyle = 'rgba(230,245,255,.9)'; ctx.fillRect(x - 1.5 * s, y - 7 * s, 3 * s, 4 * s); ctx.fillStyle = '#4f9a2f'; ctx.fillRect(x - 1.8 * s, y - 8 * s, 3.6 * s, 1.6 * s);
  }
}

// ============================================================
// Enfeites da roça e do rancho, e o presente dos pioneiros
// ============================================================
// Enfeites ficam em lugares fixos, fora dos canteiros e dos cercados. Cada um dá conforto (+XP).
const ENFEITES = [
  { id: 'flores',     nome: 'Canteiro de flores',     nivel: 1,  custo: 300,  conforto: 1 },
  { id: 'banco',      nome: 'Banco de madeira',       nivel: 2,  custo: 500,  conforto: 1 },
  { id: 'espantalho', nome: 'Espantalho',             nivel: 3,  custo: 800,  conforto: 1 },
  { id: 'carrinho',   nome: 'Carrinho de mão',        nivel: 4,  custo: 600,  conforto: 1 },
  { id: 'poco',       nome: 'Poço',                   nivel: 6,  custo: 1500, conforto: 2 },
  { id: 'fonte',      nome: 'Fonte',                  nivel: 10, custo: 3000, conforto: 2 },
  { id: 'moinho',     nome: 'Cata-vento',             nivel: 14, custo: 5000, conforto: 3 },
  { id: 'agua',       nome: 'Bloco de água',          nivel: 4,  custo: 30,   conforto: 1, agua: true, desc: 'Do tamanho de uma plantação. Encoste um no outro para virar um laguinho, com peixinhos pulando.' },
  // Cerca: um pedaço de uma casa de comprimento, no estilo do tema da roça. Só enfeita (não dá XP).
  { id: 'cerca',      nome: 'Cerca da roça',          nivel: 1,  custo: 40,   conforto: 0, cerca: true, desc: 'No estilo do tema da roça (Loja › Temas).' },
  { id: 'cerca_arame',  nome: 'Cerca de arame farpado', nivel: 2,  custo: 30,  conforto: 0, cerca: true, estilo: { poste: '#8a6a44', topo: '#a4825a', trilho: '#6a6a6a', arame: true }, desc: 'Moirão de madeira e três fios de arame.' },
  { id: 'cerca_branca', nome: 'Cerca branca',          nivel: 3,  custo: 60,  conforto: 0, cerca: true, estilo: { trilho: '#f4f1ea', poste: '#dcd6ca', topo: '#ffffff' }, desc: 'Branquinha, de casa de fazenda.' },
  { id: 'cerca_bambu',  nome: 'Cerca de bambu',        nivel: 5,  custo: 70,  conforto: 0, cerca: true, estilo: { trilho: '#c9b35a', poste: '#8fae3e', topo: '#b5cf5a', bambu: true }, desc: 'Varas de bambu amarradas.' },
  { id: 'cerca_azul',   nome: 'Cerca azul',            nivel: 6,  custo: 60,  conforto: 0, cerca: true, estilo: { trilho: '#6b8fb5', poste: '#4f7299', topo: '#8fb0d1' }, desc: 'Pintada de azul-céu.' },
  { id: 'cerca_rosas',  nome: 'Cerca com roseiras',    nivel: 8,  custo: 90,  conforto: 0, cerca: true, estilo: { trilho: '#f4f1ea', poste: '#dcd6ca', topo: '#ffffff', rosas: true }, desc: 'Cerca branca com roseira em cada moirão.' },
  { id: 'cerca_pedra',  nome: 'Muro de pedra',         nivel: 10, custo: 110, conforto: 0, cerca: true, estilo: { trilho: '#a8a294', poste: '#8f897b', topo: '#c7c1b3', pedra: true }, desc: 'Muro baixo de pedra, bem de sítio.' },
  // porteiras: ocupam um pedaço de cerca (encaixam e giram igual)
  { id: 'porteira',        nome: 'Porteira de madeira', nivel: 1,  custo: 150, conforto: 0, cerca: true, porteira: 'madeira', desc: 'Porteira de tábua com a travessa em diagonal.' },
  { id: 'porteira_branca', nome: 'Porteira branca',     nivel: 5,  custo: 250, conforto: 0, cerca: true, porteira: 'branca', desc: 'Pintada de branco, com duas travessas em X.' },
  { id: 'porteira_ferro',  nome: 'Portão de ferro',     nivel: 12, custo: 500, conforto: 0, cerca: true, porteira: 'ferro', desc: 'Grades de ferro com o arco em cima.' },
  { id: 'bandeira',   nome: 'Bandeira dos Pioneiros', especial: true, conforto: 2 },
  { id: 'bolo',       nome: 'Bolo de boas-vindas',    especial: true, conforto: 2 },
  { id: 'carroca',    nome: 'Carroça de feno do Seu Zé',    especial: true, vila: true, conforto: 3 },
  { id: 'roseira',    nome: 'Roseira da Dona Maria',         especial: true, vila: true, conforto: 3 },
  { id: 'peixedourado', nome: 'Estátua do Peixe Dourado', especial: true, trevo: true, conforto: 3 },
  // Pomar: frutíferas. Dão frutas de tempos em tempos e secam depois da última colheita.
  // Seca: um amigo ajuda (volta a dar frutas) ou sai com enxada (arbusto) / motosserra (árvore).
  { id: 'framboeseira',  nome: 'Framboeseira',   fruteira: 'arbusto', fruta: 'framboesa',  nivel: 3,  custo: 90,   tempo: 6 * 3600,  rende: 3, colheitas: 3, conforto: 1, copa: '#5a9a3a' },
  { id: 'pitangueira',   nome: 'Pitangueira',    fruteira: 'arvore',  fruta: 'pitanga',    nivel: 4,  custo: 80,   tempo: 6 * 3600,  rende: 3, colheitas: 3, conforto: 1, copa: '#4f9a2f' },
  { id: 'amoreira',      nome: 'Amoreira',       fruteira: 'arbusto', fruta: 'amora',      nivel: 5,  custo: 130,  tempo: 7 * 3600,  rende: 4, colheitas: 3, conforto: 1, copa: '#3f8a2a' },
  { id: 'morangueiro',   nome: 'Morangueiro',    fruteira: 'arbusto', fruta: 'morango',    nivel: 7,  custo: 150,  tempo: 3 * 3600,  rende: 4, colheitas: 3, conforto: 1, copa: '#3f8a2a' },
  { id: 'maracujazeiro', nome: 'Maracujazeiro',  fruteira: 'arbusto', fruta: 'maracuja',   nivel: 8,  custo: 150,  tempo: 8 * 3600,  rende: 3, colheitas: 3, conforto: 1, copa: '#5aa03a' },
  { id: 'jabuticabeira', nome: 'Jabuticabeira',  fruteira: 'arvore',  fruta: 'jabuticaba', nivel: 7,  custo: 230,  tempo: 10 * 3600, rende: 6, colheitas: 3, conforto: 2, copa: '#3f7a2a' },
  { id: 'videira',       nome: 'Videira',        fruteira: 'arbusto', fruta: 'uva',        nivel: 15, custo: 320,  tempo: 8 * 3600,  rende: 4, colheitas: 3, conforto: 1, copa: '#6b3a8a' },
  { id: 'mangueira',     nome: 'Mangueira',      fruteira: 'arvore',  fruta: 'manga',      nivel: 10, custo: 260,  tempo: 12 * 3600, rende: 4, colheitas: 3, conforto: 2, copa: '#2f6a22' },
  { id: 'cajueiro',      nome: 'Cajueiro',       fruteira: 'arvore',  fruta: 'caju',       nivel: 12, custo: 240,  tempo: 12 * 3600, rende: 4, colheitas: 3, conforto: 2, copa: '#4f8a2a' },
  { id: 'macieira',      nome: 'Macieira',       fruteira: 'arvore',  fruta: 'maca',       nivel: 18, custo: 380,  tempo: 12 * 3600, rende: 5, colheitas: 3, conforto: 2, copa: '#3a8a2c' },
  { id: 'laranjeira',    nome: 'Laranjeira',     fruteira: 'arvore',  fruta: 'laranja',    nivel: 19, custo: 400,  tempo: 14 * 3600, rende: 5, colheitas: 3, conforto: 2, copa: '#3a8a2c' },
  { id: 'pequizeiro',    nome: 'Pequizeiro',     fruteira: 'arvore',  fruta: 'pequi',      nivel: 15, custo: 300,  tempo: 16 * 3600, rende: 3, colheitas: 3, conforto: 2, copa: '#5a8a3a' },
  { id: 'bananeira',     nome: 'Bananeira',      fruteira: 'arvore',  fruta: 'banana',     nivel: 22, custo: 460,  tempo: 9 * 3600,  rende: 6, colheitas: 3, conforto: 2, copa: '#4a9a3a' },
  { id: 'coqueiro',      nome: 'Coqueiro',       fruteira: 'arvore',  fruta: 'coco',       nivel: 24, custo: 500,  tempo: 11 * 3600, rende: 3, colheitas: 3, conforto: 2, copa: '#3a8a2c' },
  { id: 'goiabeira',     nome: 'Goiabeira',      fruteira: 'arvore',  fruta: 'goiaba',     nivel: 28, custo: 580,  tempo: 15 * 3600, rende: 5, colheitas: 3, conforto: 2, copa: '#5a9a3a' },
  { id: 'colmeieira',    nome: 'Colmeia',        fruteira: 'colmeia', fruta: 'mel',        nivel: 12, custo: 800,  tempo: 24 * 3600, rende: 3, colheitas: 4, conforto: 2, copa: '#e8c240' },
  { id: 'arcoflores',   nome: 'Arco de flores',            especial: true, trevo: true, conforto: 2 },
  { id: 'ipe',          nome: 'Ipê-amarelo',               especial: true, trevo: true, conforto: 3 },
  { id: 'fogueira',     nome: 'Fogueira de São João',      especial: true, trevo: true, conforto: 2 },
  { id: 'balanco',      nome: 'Balanço de madeira',        especial: true, trevo: true, conforto: 2 },
  { id: 'carrodeboi',   nome: 'Carro de boi',              especial: true, trevo: true, conforto: 3 },
  { id: 'trofeuchupa',  nome: 'Troféu do Chupa-cabra',     especial: true, caca: true, conforto: 3 },
];
// Etiqueta de onde veio um item especial.
const origemEnfeite = (e, s) => e.caca ? 'Troféu da caçada 🎯' : e.trevo ? 'Exclusivo da Loja do Trevo 🍀' : e.vila ? 'Presente da vila' : `Especial dos pioneiros · ${obtidoEm(s)}`;
const ENFEITE = Object.fromEntries(ENFEITES.map(e => [e.id, e]));
// Lugares antigos (saves de antes do modo Mover): viram posições livres.
const LUGARES = {
  roca: [[2.5, -0.75], [-0.75, 5.9], [5.4, -0.75], [-0.75, 7.1], [6.6, -0.75], [-0.75, 8.3]],
  animais: [[2, RANCH_R + 0.8], [6, RANCH_R + 0.8], [10, RANCH_R + 0.8], [14, RANCH_R + 0.8], [-1.1, 6.2], [RANCH_C + 0.9, 3.2]],
};
// ---------- Objetos que dá para mudar de lugar (modo Mover) ----------
// Posição padrão de cada coisa, em coordenadas da grade da cena.
const POS_PADRAO = {
  // (as árvores de enfeite saíram: agora as árvores são as frutíferas do Pomar, compradas na Loja)
  roca: { casa: [1.25, -1.45], celeiro: [-0.95, 2.15], canil: [-1.65, 3.65], pesqueiro: [-1.05, 4.85], placa: [-0.1, 1.1], mata: [1.6, 6.9], armadilha: [3.3, -0.6] },
  animais: { canil: [-1.65, 3.65], chocadeira: [-1.3, 5.6] },
};
const LAGO_POS = [3.55, -1.95];
const OBJ_INFO = { casa: { nome: 'Casa', r: 1.1 }, celeiro: { nome: 'Celeiro', r: 1.2 }, canil: { nome: 'Casinha do cachorro', r: 0.8 }, arv1: { nome: 'Árvore', r: 0.7 }, arv2: { nome: 'Árvore', r: 0.7 }, pesqueiro: { nome: 'Pesqueiro', r: 0.9 }, placa: { nome: 'Placa de terras', r: 0.45 }, mata: { nome: 'Trilha da caçada', r: 1.0 }, armadilha: { nome: 'Armadilha de pragas', r: 0.45 }, chocadeira: { nome: 'Chocadeira', r: 0.5 } };
// Giro de 90° em 90° (rot 0..3, sentido contrário ao relógio visto de cima): os desenhos são 2,5D, vistos
// de um ângulo só. Nos giros ímpares a imagem fica espelhada (as faces trocam de lado); nos giros 2 e 3
// as construções (casa, celeiro, casinha) mostram os fundos, sem porta nem janelas da frente. Itens sem
// "costas" (árvores, enfeites) ficam iguais no giro 2 ao giro 0.
const comGiro = (x, rot, fn) => {
  if (!(rot % 2)) return fn();
  ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0);
  try { fn(); } finally { ctx.restore(); }
};
const giravel = key => !!key && !['placa', 'mata', 'armadilha', 'chocadeira'].includes(key);
function posOf(s, sc, key) {
  const p = s.pos && s.pos[sc] && s.pos[sc][key];
  if (Array.isArray(p)) return p;
  if (sc === 'roca' && key === 'arv1' && temaDe(s).lago) return [6.8, -1.2]; // o lago fica no lugar da árvore
  return POS_PADRAO[sc][key];
}
const objetosDe = (s, sc) => (s.objetos && Array.isArray(s.objetos[sc]) ? s.objetos[sc] : []).filter(o => o && ENFEITE[o.id]);
function objList(s, sc) {
  const l = Object.keys(POS_PADRAO[sc]).filter(key => key !== 'armadilha' || s.armadilha).map(key => { const [u, v] = posOf(s, sc, key); return { key, u, v, r: OBJ_INFO[key].r, rot: (s.rotPos && s.rotPos[sc] && s.rotPos[sc][key]) | 0 }; });
  objetosDe(s, sc).forEach((o, i) => l.push(ehCerca(o.id) ? { key: 'enf:' + i, id: o.id, u: o.u, v: o.v, r: 0.3, obj: o, cerca: true, rot: o.rot ? 1 : 0 }
    : { key: 'enf:' + i, id: o.id, u: o.u, v: o.v, r: ['arvore', 'colmeia'].includes(ENFEITE[o.id].fruteira) ? 0.65 : 0.55, obj: o, rot: (o.rot | 0) % 4 }));
  return l;
}
const confortoEnfeites = s => ['roca', 'animais'].reduce((t, sc) => t + objetosDe(s, sc).reduce((u, o) => u + ENFEITE[o.id].conforto, 0), 0);
// Até onde dá para espalhar enfeites/cercas além da área principal. No rancho os cercados não crescem,
// então ainda faz sentido ter uma margem além deles — dobrada (era 14) pra dar mais espaço de construção
// no rancho também, não só na roça. Na roça a margem continua 0: a terra de canteiros já cobre a grade
// toda, então o limite de decoração é o mesmo limite do mapa — sem "dois limites" diferentes e confusos.
const MARGEM_ITENS = 28;
// u+v é "quão pra trás" (rumo ao horizonte) um ponto está: iso() sobe na tela conforme u+v cai, e o
// chão só é pintado até a linha do horizonte — abaixo de 0 o ponto já cai no céu. Vale pros dois eixos
// juntos (não cada um sozinho), senão um canto como (-14, 0) também ia parar lá em cima.
const CEU_MIN = 0;
// Retângulo [u0, v0, u1, v1] onde dá para construir/decorar. A roça e o rancho têm o mesmo formato:
// a fazenda lá no alto, no meio, e a área abrindo pros dois lados e pra frente, cortada reto pelo céu.
const areaDe = sc => sc === 'roca' ? [RU0, RV0, RU0 + COLS, RV0 + ROWS]
  : [-MARGEM_ITENS, -MARGEM_ITENS, RANCH_C + MARGEM_ITENS, RANCH_R + MARGEM_ITENS];
// Dá para pôr fora dos canteiros e dos cercados, sem encostar em outra coisa.
function validSpot(sc, u, v, ignora, raio = 0.55) {
  const B = [RANCH_C, RANCH_R];
  if (sc === 'roca') {
    // na roça dá para pôr em qualquer lugar do gramado, desde que não encoste em canteiro
    const m = raio * 0.7;
    for (let c = Math.floor(u - m); c <= Math.floor(u + m); c++) for (let r = Math.floor(v - m); r <= Math.floor(v + m); r++) {
      const i = plotAt(c, r);
      if (i >= 0 && state.plots[i].s !== 'locked') return false;
    }
  } else if (u > -0.5 && u < B[0] + 0.5 && v > -0.5 && v < B[1] + 0.5) return false; // no rancho, os cercados ocupam tudo
  const [a0, b0, a1, b1] = areaDe(sc);
  if (u < a0 || v < b0 || u > a1 || v > b1) return false;
  if (u + v < CEU_MIN) return false; // não deixa pôr nada lá em cima, onde já é céu
  if (sc === 'roca' && temaDe(state).lago && Math.hypot(u - LAGO_POS[0], v - LAGO_POS[1]) < 1.4) return false;
  return objList(state, sc).every(o => o.key === ignora || (o.cerca ? distCerca(u, v, o) >= raio * 0.75 : Math.hypot(o.u - u, o.v - v) >= (o.r + raio) * 0.75));
}
// Linha pontilhada marcando o limite de onde dá para colocar enfeite/cerca (com o canto de trás cortado
// na diagonal u+v=CEU_MIN, pra bater com o céu excluído lá em cima). Na roça esse já é o próprio limite
// da terra de canteiros: um limite só, igual ao limite do mapa (mesmo formato do rancho).
function drawLimiteItens(sc) {
  const [a0, b0, a1, b1] = areaDe(sc);
  const pts = [[CEU_MIN - b0, b0], [a1, b0], [a1, b1], [a0, b1], [a0, CEU_MIN - a0]].map(([u, v]) => iso(u, v));
  ctx.save();
  ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(40,30,20,.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}
// Matinhos (touceirinha de 3 bolinhas, igual às moitas da caçada) espalhados por toda a área onde dá
// pra construir/decorar — reaproveita o validSpot pra só nascer onde realmente pode (sem pisar canteiro,
// cercado, lago, outro enfeite nem o céu). Posições fixas (mesmo padrão dos TUFTS do gramado).
const MATINHOS = Array.from({ length: 220 }, () => [Math.random(), Math.random(), Math.random()]);
function drawMatinhos(sc) {
  const [u0, v0, u1, v1] = areaDe(sc), { cw, ch } = L;
  for (const [rx, ry, rk] of MATINHOS) {
    const u = u0 + rx * (u1 - u0), v = v0 + ry * (v1 - v0);
    const q = iso(u, v);
    if (q.x < -20 || q.x > cw + 20 || q.y < -20 || q.y > ch + 20) continue;
    if (!validSpot(sc, u, v, null, 0.3)) continue;
    const s = L.W * (0.055 + rk * 0.04);
    ctx.fillStyle = `rgba(47,111,34,${0.4 + rk * 0.2})`;
    for (const [dx, dy, rr] of [[-s * 0.7, 0, s * 0.8], [s * 0.7, 0, s * 0.8], [0, -s * 0.5, s]]) { ctx.beginPath(); ctx.arc(q.x + dx, q.y + dy, rr, 0, 7); ctx.fill(); }
  }
}
// ---------- Cercas: cada pedaço tem uma casa de comprimento e encaixa na beirada da grade ----------
const ehCerca = id => !!(ENFEITE[id] && ENFEITE[id].cerca);
// rot 0: corre no sentido u, de (u-0.5, v) a (u+0.5, v); rot 1: no sentido v.
const pontasCerca = (u, v, rot) => rot ? [[u, v - 0.5], [u, v + 0.5]] : [[u - 0.5, v], [u + 0.5, v]];
const encaixaCerca = (u, v, rot) => rot ? [Math.round(u), Math.floor(v) + 0.5] : [Math.floor(u) + 0.5, Math.round(v)];
function distCerca(u, v, o) {
  const [[a, b], [c, d]] = pontasCerca(o.u, o.v, o.rot), k = clamp(((u - a) * (c - a) + (v - b) * (d - b)) / ((c - a) ** 2 + (d - b) ** 2), 0, 1);
  return Math.hypot(u - (a + (c - a) * k), v - (b + (d - b) * k));
}
function validCerca(u, v, rot, ignora) {
  const [a0, b0, a1, b1] = areaDe('roca');
  if (u < a0 || v < b0 || u > a1 || v > b1) return false;
  if (u + v < CEU_MIN) return false; // não deixa pôr cerca lá em cima, onde já é céu
  // não fica no meio de dois canteiros (na beirada de um canteiro pode)
  const dono = (c, r) => { const i = plotAt(c, r); return i >= 0 && state.plots[i].s !== 'locked'; };
  if (rot ? dono(u - 1, Math.floor(v)) && dono(u, Math.floor(v)) : dono(Math.floor(u), v - 1) && dono(Math.floor(u), v)) return false;
  if (temaDe(state).lago && Math.hypot(u - LAGO_POS[0], v - LAGO_POS[1]) < 1.3) return false;
  const [a, b] = pontasCerca(u, v, rot);
  return objList(state, 'roca').every(o => o.key === ignora || (o.cerca ? !(o.u === u && o.v === v && o.rot === rot)
    : [0.15, 0.5, 0.85].every(k => Math.hypot(a[0] + (b[0] - a[0]) * k - o.u, a[1] + (b[1] - a[1]) * k - o.v) >= o.r * 0.7)));
}
const estiloCerca = (id, s) => (ENFEITE[id] && ENFEITE[id].estilo) || temaDe(s);
function drawCercaSeg(u, v, rot, s, id = 'cerca') {
  const [a, b] = pontasCerca(u, v, rot), e = ENFEITE[id];
  if (e && e.porteira) return drawPorteira(iso(...a), iso(...b), e.porteira, L.W);
  fenceRun(iso(...a), iso(...b), 2, false, estiloCerca(id, s));
}
// Porteira entre dois moirões mais grossos: tábuas com travessa (madeira/branca) ou grade com arco (ferro).
function drawPorteira(a, b, tipo, W) {
  const h = W * 0.22, cor = { madeira: '#a4703f', branca: '#f4f1ea', ferro: '#3f454b' }[tipo], esc = { madeira: '#6b4220', branca: '#b8b0a0', ferro: '#23272b' }[tipo];
  const at = (k, y) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - y });
  if (tipo === 'ferro') {
    for (let k = 1; k < 10; k++) line(at(k / 10, 0), at(k / 10, h * (0.85 + Math.sin(k / 10 * Math.PI) * 0.35)), cor, W * 0.014);
    ctx.strokeStyle = cor; ctx.lineWidth = W * 0.02; ctx.beginPath(); for (let k = 0; k <= 20; k++) { const p = at(k / 20, h * (0.85 + Math.sin(k / 20 * Math.PI) * 0.35)); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke();
    line(at(0.08, h * 0.35), at(0.92, h * 0.35), cor, W * 0.018);
    ctx.fillStyle = '#e0b040'; for (const k of [0.3, 0.5, 0.7]) { const p = at(k, h * (0.85 + Math.sin(k * Math.PI) * 0.35) + W * 0.02); ctx.beginPath(); ctx.arc(p.x, p.y, W * 0.012, 0, 7); ctx.fill(); }
  } else {
    for (const y of [0.15, 0.5, 0.85]) line(at(0.06, h * y), at(0.94, h * y), cor, W * 0.034);
    line(at(0.08, h * 0.12), at(0.92, h * 0.88), cor, W * 0.03);
    if (tipo === 'branca') line(at(0.08, h * 0.88), at(0.92, h * 0.12), cor, W * 0.03);
    ctx.strokeStyle = esc; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(at(0.06, h * 0.5).x, at(0.06, h * 0.5).y); ctx.lineTo(at(0.94, h * 0.5).x, at(0.94, h * 0.5).y); ctx.stroke();
  }
  // moirões grossos nas duas pontas, com tampinha
  for (const p of [a, b]) {
    ctx.fillStyle = tipo === 'ferro' ? '#8f897b' : esc; ctx.fillRect(p.x - W * 0.035, p.y - h * 1.35, W * 0.07, h * 1.35);
    ctx.fillStyle = tipo === 'ferro' ? '#c7c1b3' : cor; ctx.fillRect(p.x - W * 0.045, p.y - h * 1.35 - W * 0.02, W * 0.09, W * 0.03);
  }
}
// O que está sendo movido é uma cerca? (devolve o objeto guardado, se for um já colocado)
const movCercaId = () => moving && (moving.novo || (moving.key && moving.key.startsWith('enf:') && (objetosDe(state, scene)[Number(moving.key.slice(4))] || {}).id)) || 'cerca';
const movCerca = () => moving && (moving.novo ? ehCerca(moving.novo) : moving.key && moving.key.startsWith('enf:') && ehCerca((objetosDe(state, scene)[Number(moving.key.slice(4))] || {}).id));
// Bloco de água: do tamanho de uma plantação, encaixado igual (célula inteira, centro em c+0,5/r+0,5).
const ehAgua = id => !!(ENFEITE[id] && ENFEITE[id].agua);
const movAgua = () => moving && (moving.novo ? ehAgua(moving.novo) : moving.key && moving.key.startsWith('enf:') && ehAgua((objetosDe(state, scene)[Number(moving.key.slice(4))] || {}).id));
const encaixaAgua = (u, v) => [Math.floor(u) + 0.5, Math.floor(v) + 0.5];
function validAgua(u, v) {
  const i = plotAt(u, v);
  if (i < 0 || plotCeu(i)) return false;
  return state.plots[i].s === 'locked' && !objetoNaCelula(i);
}
// Uma casa do rancho sendo movida? moving.u/v é o centro do cercado (4 × 3,8), não um pontinho.
const movAbrigoId = () => moving && moving.key && moving.key.startsWith('abrigo:') && moving.key.slice(7);
// Cabe aí? Não pode encostar em outro cercado (construído ou não — reserva o lugar dele também) nem
// sair muito longe do rancho, mas agora dá pra espalhar bem mais ao redor da grade original (dobrado,
// era 3, pra abrir mais espaço de construção no rancho).
function validYardPos(id, cu, cv) {
  const u0 = cu - YARD_W / 2, v0 = cv - YARD_D / 2, u1 = u0 + YARD_W, v1 = v0 + YARD_D;
  const folga = 6;
  if (u0 < -YARD_W * folga || v0 < -YARD_D * folga || u1 > RANCH_C + YARD_W * folga || v1 > RANCH_R + YARD_D * folga) return false;
  if (u0 + v0 < CEU_MIN) return false; // não deixa levar o cercado lá em cima, onde já é céu
  for (const b of ABRIGOS) {
    if (b.id === id) continue;
    const y = yardOf(b.id);
    if (u0 < y.u1 && u1 > y.u0 && v0 < y.v1 && v1 > y.v0) return false;
  }
  const [kx, kv] = posOf(state, 'animais', 'canil');
  return !(kx > u0 - 0.8 && kx < u1 + 0.8 && kv > v0 - 0.8 && kv < v1 + 0.8);
}
// Um canteiro só vai para um pedaço de terra livre (sem canteiro, enfeite ou folhas em cima).
const celulaMov = () => { const j = plotAt(moving.u, moving.v); return j >= 0 && !plotCeu(j) ? j : -1; };
function validCanteiro(i, j) {
  if (j < 0) return false;
  if (j === i) return true;
  const c = plotU(j) + 0.5, r = plotV(j) + 0.5;
  return state.plots[j].s === 'locked' && !objetoNaCelula(j) && !folhasDe().some(f => Math.abs(f.u - c) < 0.75 && Math.abs(f.v - r) < 0.75);
}
// O lugar onde está o item na mão serve?
function movOk() {
  if (!moving) return false;
  if (moving.plot !== undefined) return validCanteiro(moving.plot, celulaMov());
  if (movCerca()) return scene === 'roca' && validCerca(moving.u, moving.v, moving.rot || 0, moving.key);
  if (movAgua()) return scene === 'roca' && validAgua(moving.u, moving.v);
  if (movAbrigoId()) return validYardPos(movAbrigoId(), moving.u, moving.v);
  return validSpot(scene, moving.u, moving.v, moving.key, raioMov());
}
// Gira 90° o que não é cerca nem casinha do rancho: construções (casa, celeiro, casinha do cachorro,
// pesqueiro, árvores) e enfeites. Bloco de água é quadradinho igual dos 4 lados, então não gira.
const movGiravel = () => !!moving && moving.plot === undefined && !movCerca() && !movAgua() && !movAbrigoId() && (moving.novo || giravel(moving.key));
function girarItem() {
  if (!movGiravel()) return;
  moving.rot = ((moving.rot | 0) + 1) % 4;
  sfx('click'); renderMoveBar();
}
const girarMovendo = () => { if (movAbrigoId()) girarAbrigo(); else if (movCerca()) girarCerca(); else girarItem(); };
const movQualquerGiro = () => movCerca() || movAbrigoId() || movGiravel();
function girarCerca() {
  if (!movCerca()) return;
  moving.rot = moving.rot ? 0 : 1; [moving.u, moving.v] = encaixaCerca(moving.u + (moving.rot ? 0.5 : -0.5), moving.v + (moving.rot ? -0.5 : 0.5), moving.rot);
  sfx('click'); renderMoveBar();
}
// Gira a casinha do rancho 90° dentro do mesmo cercado (o cercado quase não muda de forma, mas a
// casinha, o cocho etc. mudam de lado — comRotacaoAbrigo cuida do desenho).
function girarAbrigo() {
  if (!movAbrigoId()) return;
  moving.rot = moving.rot ? 0 : 1;
  sfx('click'); renderMoveBar();
}
function screenToWorld(x, y) {
  const a = (x - L.ox) / (L.W / 2), b = (y - L.oy) / (L.W / 4);
  return [Math.round((a + b) / 2 * 20) / 20, Math.round((b - a) / 2 * 20) / 20];
}
let moveMode = false, moving = null; // moving: { key } para mover, { novo: id } para pôr um enfeite do inventário
function setMoveMode(on) {
  moveMode = on; moving = null;
  renderMoveBtn(); renderTools(); renderMoveBar();
  if (on) toast(pointer.touch ? 'Modo Mover: toque numa casa, árvore, enfeite, cerca ou canteiro, arraste até o lugar novo e toque em "Salvar aqui".' : 'Modo Mover: clique numa casa, árvore, enfeite, cerca ou canteiro e depois no lugar novo.');
}
function renderMoveBtn() {
  renderMoveBar();
  const b = $('#moveBtn'); if (!b) return;
  b.hidden = !isHome() || scene === 'casa';
  b.setAttribute('aria-pressed', String(moveMode));
}
// No computador o item segue o mouse e um clique solta. No celular (ou tocando), o item fica
// parado: arraste com o dedo (ou toque no lugar novo) e confirme com "Salvar aqui".
const raioMov = () => moving && moving.key && OBJ_INFO[moving.key] ? OBJ_INFO[moving.key].r : 0.55;
const moveDica = nome => pointer.touch ? `${nome}: arraste com o dedo até o lugar novo e toque em "Salvar aqui".` : `${nome}: clique no lugar novo. Esc cancela.`;
// Procura o lugar livre mais perto (em volta do ponto pedido).
function pontoLivre(sc, u, v, key, raio, max = 6) {
  if (validSpot(sc, u, v, key, raio)) return [u, v];
  for (let d = 0.25; d <= max; d += 0.25) for (let a = 0; a < 16; a++) {
    const uu = Math.round((u + Math.cos(a / 8 * Math.PI) * d) * 20) / 20, vv = Math.round((v + Math.sin(a / 8 * Math.PI) * d) * 20) / 20;
    if (validSpot(sc, uu, vv, key, raio)) return [uu, vv];
  }
  return [u, v];
}
function moveClick(x, y) {
  if (!moving) {
    const alvo = pick(x, y), cel = scene === 'roca' ? cellAt(x, y) : -1;
    if (alvo && alvo.kind === 'abrigo' && abrigoLv(state, alvo.id)) {
      const y0 = yardOf(alvo.id);
      moving = { key: 'abrigo:' + alvo.id, u: (y0.u0 + y0.u1) / 2, v: (y0.v0 + y0.v1) / 2, rot: y0.rot ? 1 : 0 };
      renderMoveBar();
      return toast(moveDica(ABRIGO[alvo.id].nome));
    }
    if ((!alvo || alvo.kind !== 'obj') && cel >= 0 && state.plots[cel].s !== 'locked') {
      // canteiro: vai inteiro para outro pedaço de terra, com o que estiver plantado
      moving = { plot: cel, u: plotU(cel) + 0.5, v: plotV(cel) + 0.5 };
      renderMoveBar();
      return toast(moveDica('Canteiro'));
    }
    if (!alvo || alvo.kind !== 'obj') return toast(pointer.touch ? 'Toque numa casa, árvore, enfeite, cerca ou canteiro para mudar de lugar.' : 'Clique numa casa, árvore, enfeite, cerca ou canteiro para mudar de lugar.');
    const o = objList(state, scene).find(k => k.key === alvo.key);
    moving = { key: alvo.key, u: o ? o.u : 0, v: o ? o.v : 0, rot: o && o.rot };
    renderMoveBar();
    return toast(moveDica(alvo.nome || 'Pronto'));
  }
  let [u, v] = screenToWorld(x, y);
  if (movCerca()) [u, v] = encaixaCerca(u, v, moving.rot || 0);
  else if (movAgua()) [u, v] = encaixaAgua(u, v);
  if (pointer.touch) { moving.u = u; moving.v = v; return renderMoveBar(); } // toque só leva o item até lá
  moving.u = u; moving.v = v;
  salvarMove();
}
function salvarMove() {
  if (!moving) return;
  const { u, v } = moving, cerca = movCerca(), agua = movAgua(), abrigoId = movAbrigoId();
  if (!movOk()) return toast(moving.plot !== undefined ? (celulaMov() < 0 ? 'Aqui não dá: isso já é fora do mapa da roça.' : 'Aqui não dá: o canteiro vai para um pedaço de gramado livre (sem enfeite nem folhas).')
    : cerca ? 'Aqui não dá: a cerca não pode ficar entre dois canteiros nem em cima de outra coisa.'
    : agua ? 'Aqui não dá: o bloco de água precisa de uma casa de gramado livre.'
    : abrigoId ? 'Aqui não dá: o cercado não pode encostar em outro nem ficar longe demais do rancho.'
    : 'Aqui não dá: tem que ser no gramado, fora dos canteiros e cercados, sem encostar em outra coisa.', 'bad');
  if (moving.plot !== undefined) {
    const i = moving.plot, j = celulaMov();
    if (j !== i) { [state.plots[i], state.plots[j]] = [state.plots[j], state.plots[i]]; if (hover && hover.kind === 'plot') hover = null; }
    const uma = moving.uma; moving = null; sfx('buy'); done();
    if (uma) { moveMode = false; renderMoveBtn(); renderTools(); renderMoveBar(); return toast('Canteiro no lugar novo!', 'good'); }
    renderMoveBar();
    return toast(pointer.touch ? 'Canteiro no lugar novo! Toque em outro para mudar, ou em Concluir.' : 'Canteiro no lugar novo! Clique em outro para mudar, ou Esc para sair.', 'good');
  }
  if (cerca && moving.novo) {
    // cerca: põe um pedaço e já vem o próximo, seguindo na mesma direção
    const id = moving.novo, nome = ENFEITE[id].nome;
    if (!(state.enfeites[id] > 0)) { moving = null; return; }
    (state.objetos.roca = objetosDe(state, 'roca')).push({ id, u, v, rot: moving.rot || 0 });
    state.enfeites[id]--; sfx('buy'); done();
    if (state.enfeites[id] > 0) {
      const r = moving.rot || 0; moving.u = r ? u : u + 1; moving.v = r ? v + 1 : v;
      renderMoveBar(); return toast(`${nome} colocada! Sobram ${state.enfeites[id]}.`, 'good');
    }
    moving = null; moveMode = false; renderMoveBtn(); renderTools();
    return toast(`${nome} colocada! Acabou (compre mais na Loja › Enfeites).`, 'good');
  }
  if (agua && moving.novo) {
    // bloco de água: põe um e já deixa o próximo prontinho do lado, para ir formando o laguinho
    const id = moving.novo, nome = ENFEITE[id].nome;
    if (!(state.enfeites[id] > 0)) { moving = null; return; }
    (state.objetos.roca = objetosDe(state, 'roca')).push({ id, u, v });
    state.enfeites[id]--; sfx('buy'); done();
    if (state.enfeites[id] > 0) {
      moving.u = u + 1; moving.v = v;
      renderMoveBar(); return toast(`${nome} colocado! Sobram ${state.enfeites[id]}.`, 'good');
    }
    moving = null; moveMode = false; renderMoveBtn(); renderTools();
    return toast(`${nome} colocado! Acabou (compre mais na Loja › Enfeites).`, 'good');
  }
  if (moving.novo) {
    if (!(state.enfeites[moving.novo] > 0)) { moving = null; return; }
    const novo = { id: moving.novo, u, v };
    if (moving.rot) novo.rot = moving.rot | 0;
    if (ENFEITE[moving.novo].fruteira) { novo.t0 = Date.now(); novo.ult = Date.now(); novo.colhidas = 0; novo.fid = newId(); } // frutífera: começa a contar ao plantar
    (state.objetos[scene] = objetosDe(state, scene)).push(novo);
    state.enfeites[moving.novo]--;
    toast(`${ENFEITE[moving.novo].nome} colocado! +${ENFEITE[moving.novo].conforto}% de XP.`, 'good');
    moveMode = false; renderMoveBtn(); // pôr um item do inventário termina o modo
  } else if (moving.key.startsWith('enf:')) {
    const o = objetosDe(state, scene)[Number(moving.key.slice(4))]; if (o) { o.u = u; o.v = v; if (cerca) o.rot = moving.rot || 0; else if (!agua) { if (moving.rot) o.rot = moving.rot | 0; else delete o.rot; } }
  } else if (abrigoId) {
    const antes = yardOf(abrigoId);
    state.animPos = state.animPos || {}; state.animPos[abrigoId] = [u - YARD_W / 2, v - YARD_D / 2];
    state.animRot = state.animRot || {}; state.animRot[abrigoId] = !!moving.rot;
    // os bichos vão junto: desloca a posição de passeio deles pela mesma distância que a casinha andou
    const depois = yardOf(abrigoId), du = depois.u0 - antes.u0, dv = depois.v0 - antes.v0;
    if (du || dv) for (const a of livesIn(state, abrigoId)) { const m = amb[a.id]; if (m) { m.u += du; m.v += dv; m.tu += du; m.tv += dv; } }
  } else {
    state.pos = state.pos || {}; (state.pos[scene] = state.pos[scene] || {})[moving.key] = [u, v];
    if (giravel(moving.key)) { state.rotPos = state.rotPos || {}; (state.rotPos[scene] = state.rotPos[scene] || {})[moving.key] = moving.rot | 0; }
  }
  if (moving.uma) { moveMode = false; renderMoveBtn(); }
  moving = null; sfx('buy'); done(); renderMoveBar();
  if (!moveMode) toast('Lugar novo salvo!', 'good');
}
function cancelarMove() {
  if (moving && !moving.uma && !moving.novo) moving = null; else { moveMode = false; moving = null; renderMoveBtn(); renderTools(); }
  renderMoveBar();
}
// Barrinha de baixo enquanto está movendo: Salvar aqui (fica cinza se o lugar não serve) e Cancelar.
let moveBarOk = null;
function renderMoveBar() {
  const bar = $('#moveBar'); if (!bar) return;
  const on = moveMode && isHome() && scene !== 'casa';
  bar.hidden = !on; document.body.classList.toggle('movendo', on); if (!on) return;
  const ok = movOk();
  const txt = !moving ? (pointer.touch ? 'Toque no item que quer mudar de lugar' : 'Clique no item que quer mudar de lugar')
    : !ok ? (moving.plot !== undefined ? (celulaMov() < 0 ? 'Aqui não dá: já é fora do mapa' : 'Aqui não dá: escolha um gramado livre') : movCerca() ? 'Aqui não dá: entre canteiros ou em cima de algo' : movAbrigoId() ? 'Aqui não dá: o cercado não pode encostar em outro nem ficar longe demais do rancho' : 'Aqui não dá: fora dos canteiros e cercados')
    : movCerca() ? (pointer.touch ? 'Arraste a cerca e salve (Girar muda o lado)' : 'Clique para pôr a cerca · R gira')
    : movAbrigoId() ? (pointer.touch ? 'Arraste a casinha e salve (Girar muda a casinha de lado)' : 'Clique para soltar · R gira a casinha')
    : movGiravel() ? (pointer.touch ? 'Arraste o item e salve (Girar dá 90° a cada toque)' : 'Clique para soltar · R gira 90°')
    : pointer.touch ? 'Arraste o item e salve' : 'Clique para soltar aqui';
  if (bar.dataset.txt !== txt) { bar.dataset.txt = txt; $('#moveMsg').textContent = txt; }
  $('#moveOk').hidden = !moving; $('#moveOk').disabled = !ok;
  const gira = $('#moveRot'); if (gira) gira.hidden = !movQualquerGiro();
  const guarda = $('#moveGuardar'); if (guarda) guarda.hidden = !(moving && moving.key && moving.key.startsWith('enf:'));
  const limpa = $('#moveClear'); if (limpa) limpa.hidden = !!moving;
  const layoutsBtn = $('#moveLayouts'); if (layoutsBtn) layoutsBtn.hidden = !!moving;
  $('#moveCancel').textContent = moving ? 'Cancelar' : 'Concluir';
  moveBarOk = ok;
}
function guardarMovendo() {
  if (!moving || !moving.key || !moving.key.startsWith('enf:')) return;
  invGuardar(scene, Number(moving.key.slice(4)));
  if (moving.uma) { moveMode = false; renderMoveBtn(); }
  moving = null; renderMoveBar();
}
$('#moveOk')?.addEventListener('click', salvarMove);
$('#moveRot')?.addEventListener('click', girarMovendo);
$('#moveGuardar')?.addEventListener('click', guardarMovendo);
$('#moveClear')?.addEventListener('click', () => removerTudoEnfeites(scene));
$('#moveLayouts')?.addEventListener('click', abrirLayouts);
window.addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && moveMode && movQualquerGiro() && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) girarMovendo(); });
$('#moveCancel')?.addEventListener('click', cancelarMove);
// Desenha os objetos da cena. "tras": os que ficam atrás da cerca (u ou v negativos); "frente": o resto.
// d0/d1 (opcional): só os que estão nessa faixa de profundidade (u + v), para intercalar com os canteiros.
function drawObjetos(s, sc, t, home, stage, d0 = -Infinity, d1 = Infinity) {
  const W = L.W, tm = temaDe(s);
  let cachorroDepois = false;
  // Na roça a terra agora se estende pros dois lados da casa (u ou v negativos também têm canteiro),
  // então tudo entra na ordem de profundidade junto com os canteiros ('tras' não desenha nada lá).
  const atras = o => sc !== 'roca' && o.key !== 'chocadeira' && (o.u < 0 || o.v < 0); // a chocadeira fica por cima dos cercados
  const l = objList(s, sc).filter(o => atras(o) === (stage === 'tras') && o.u + o.v >= d0 && o.u + o.v < d1).sort((a, b) => (a.u + a.v) - (b.u + b.v));
  for (const o of l) {
    if (moving && !moving.novo && moving.key === o.key) continue; // está na mão do jogador
    if (o.key === 'placa' && !(home && landSignText())) continue; // só aparece na sua roça, com terra para comprar
    const q = iso(o.u, o.v);
    if (o.cerca) {
      drawCercaSeg(o.u, o.v, o.rot, s, o.id);
      if (moveMode && home) {
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(q.x, q.y - W * 0.12, W * 0.035, 0, 7); ctx.fill();
        hits.push({ kind: 'obj', key: o.key, nome: 'Cerca', x: q.x, y: q.y - W * 0.12, r: W * 0.16 });
      }
      continue;
    }
    if (moveMode && home) {
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, W * o.r * 0.55, W * o.r * 0.2, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      hits.push({ kind: 'obj', key: o.key, nome: o.id ? ENFEITE[o.id].nome : OBJ_INFO[o.key].nome, x: q.x, y: q.y - W * 0.3, r: W * Math.max(0.35, o.r * 0.5) });
    }
    if (o.key === 'placa') { drawLandSign(q.x, q.y); continue; }
    if (o.key === 'armadilha') {
      drawArmadilha(q.x, q.y, W, !s.armadilha || Date.now() >= (s.armadilha.pronta || 0), t);
      if (!moveMode && home) hits.push({ kind: 'armadilha', x: q.x, y: q.y - W * 0.12, r: W * 0.25 });
      continue;
    }
    if (o.key === 'chocadeira') {
      drawChocadeira(q.x, q.y, W, (s.chocadeira && s.chocadeira.ovos) || [], t);
      if (!moveMode && home) {
        if (hover && hover.kind === 'chocadeira') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.3, W * 0.1, 0, 0, 7); ctx.stroke(); }
        hits.push({ kind: 'chocadeira', x: q.x, y: q.y - W * 0.2, r: W * 0.28 });
      }
      continue;
    }
    if (o.key === 'mata') {
      drawMataCaca(q.x, q.y, W);
      if (home && cacaPronta()) drawBubbleAt(q.x, q.y - W * 0.75, 'caca', null, t, 99);
      if (!moveMode && home) {
        if (hover && hover.kind === 'caca') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.62, W * 0.2, 0, 0, 7); ctx.stroke(); }
        hits.push({ kind: 'caca', x: q.x, y: q.y - W * 0.3, r: W * 0.5 });
      }
      continue;
    }
    if (o.key === 'casa') {
      comGiro(q.x, o.rot, () => drawHouse(q.x, q.y, W * 0.95, home ? '#f1dcae' : view.casa, s.skin, o.rot >= 2));
      if (!moveMode) {
        if (hover && hover.kind === 'casa') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.6, W * 0.16, 0, 0, 7); ctx.stroke(); }
        hits.push({ kind: 'casa', x: q.x, y: q.y - W * 0.35, r: W * 0.45 });
      }
    } else if (o.key === 'celeiro') {
      comGiro(q.x, o.rot, () => drawBarn(q.x, q.y, W * 1.15, s.skin, o.rot >= 2));
      if (!moveMode) {
        if (hover && hover.kind === 'celeiro') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.7, W * 0.18, 0, 0, 7); ctx.stroke(); }
        hits.push({ kind: 'celeiro', x: q.x, y: q.y - W * 0.4, r: W * 0.5 });
      }
    } else if (o.key === 'pesqueiro') {
      // pesqueiro: laguinho com uma plaquinha. Na sua roça, clique para pescar.
      comGiro(q.x, o.rot, () => {
        drawLake(q.x, q.y, W * 0.48, t);
        ctx.fillStyle = '#7a4a22'; ctx.fillRect(q.x + W * 0.4, q.y - W * 0.34, W * 0.035, W * 0.3);
        ctx.fillStyle = '#d39a5c'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(q.x + W * 0.28, q.y - W * 0.46, W * 0.28, W * 0.14, 3); ctx.fill(); ctx.stroke();
      });
      ctx.font = `${Math.round(W * 0.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎣', q.x + (o.rot % 2 ? -1 : 1) * W * 0.42, q.y - W * 0.39);
      if (home && pescaPronta()) drawBubbleAt(q.x, q.y - W * 0.75, 'pesca', null, t, 99);
      if (!moveMode && home) {
        if (hover && hover.kind === 'lago') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.52, W * 0.21, 0, 0, 7); ctx.stroke(); }
        hits.push({ kind: 'lago', x: q.x, y: q.y - W * 0.05, r: W * 0.45 });
      }
    } else if (o.key === 'canil') {
      const slot = sc === 'roca' ? 'roca' : 'animais';
      if (view.kind === 'npc') { const d = DOG_AT(); drawDog(d.x, d.y, W * 0.7, t); hits.push({ kind: 'dog', slot, x: d.x, y: d.y - W * 0.2, r: W * 0.4 }); continue; }
      { const kk = KENNEL_AT(); comGiro(kk.x, o.rot, () => drawKennelSpot(slot, s, home, o.rot >= 2)); }
      if (stage === 'tras' && sc === 'roca') cachorroDepois = true; // o cachorro vai na frente da cerca
      else drawDogSpot(slot, s, t, home);
    } else if (o.key === 'arv1' || o.key === 'arv2') comGiro(q.x, o.rot, () => drawTree(q.x, q.y, W * (sc === 'roca' ? (o.key === 'arv1' ? 1.0 : 0.8) : (o.key === 'arv1' ? 1.0 : 1.1)), t, sc === 'roca' && tm.coqueiro));
    else if (ENFEITE[o.id].agua) {
      drawAgua(s, sc, o, t);
      const hov = !moveMode && hover && hover.kind === 'enfeite' && hover.sc === sc && hover.key === o.key;
      if (hov) { const c = o.u - 0.5, r = o.v - 0.5; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; poly(diamond(c, r, 0.03)); ctx.stroke(); }
      if (!moveMode) hits.push({ kind: 'enfeite', sc, key: o.key, id: o.id, x: q.x, y: q.y, r: W * 0.26 });
    }
    else if (o.id) {
      const hov = !moveMode && hover && hover.kind === 'enfeite' && hover.sc === sc && hover.key === o.key;
      if (hov) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 0.35, W * 0.12, 0, 0, 7); ctx.stroke(); }
      comGiro(q.x, o.rot, () => {
        if (ENFEITE[o.id].fruteira && o.obj) drawFruteira(o.obj, q.x, q.y, W / 100, t, home);
        else drawEnfeite(o.id, q.x, q.y, W / 100, t, o.rot);
      });
      if (!moveMode) hits.push({ kind: 'enfeite', sc, key: o.key, id: o.id, x: q.x, y: q.y - W * (['arvore', 'colmeia'].includes(ENFEITE[o.id].fruteira) ? 0.45 : 0.25), r: W * (['arvore', 'colmeia'].includes(ENFEITE[o.id].fruteira) ? 0.45 : 0.32) });
    }
  }
  return cachorroDepois;
}
// O objeto que está sendo movido acompanha o dedo/mouse, com uma sombra verde (pode) ou vermelha (não pode).
function drawMoving(sc, t) {
  renderMoveBar();
  if (!moveMode || !moving || !isHome()) return;
  // com o mouse em cima da cena, o item segue o mouse; no toque, fica onde foi arrastado
  if (!pointer.touch && pointer.inside) [moving.u, moving.v] = screenToWorld(pointer.x, pointer.y);
  if (movCerca()) [moving.u, moving.v] = encaixaCerca(moving.u, moving.v, moving.rot || 0);
  else if (movAgua()) [moving.u, moving.v] = encaixaAgua(moving.u, moving.v);
  if (moving.plot !== undefined) {
    // canteiro: o pedaço de terra de destino fica verde (pode) ou vermelho (não pode)
    const j = celulaMov(), ok = validCanteiro(moving.plot, j);
    if (j < 0) return;
    const [p1, p2, p3, p4] = diamond(plotU(j), plotV(j), 0.02);
    ctx.globalAlpha = 0.8; drawPlot(j, state.plots[moving.plot], t, false); ctx.globalAlpha = 1;
    quad(p1, p2, p3, p4, ok ? 'rgba(80,200,80,.3)' : 'rgba(220,60,50,.35)', ok ? 'rgba(255,255,255,.9)' : 'rgba(255,200,200,.9)', 2.5);
    return;
  }
  if (movCerca()) {
    const ok = movOk(), [a, b] = pontasCerca(moving.u, moving.v, moving.rot || 0), qa = iso(...a), qb = iso(...b);
    line(qa, qb, ok ? 'rgba(80,200,80,.55)' : 'rgba(220,60,50,.55)', L.W * 0.12);
    ctx.globalAlpha = 0.8; drawCercaSeg(moving.u, moving.v, moving.rot || 0, state, movCercaId()); ctx.globalAlpha = 1;
    return;
  }
  if (movAgua()) {
    const ok = movOk(), c = Math.floor(moving.u), r = Math.floor(moving.v);
    const [p1, p2, p3, p4] = diamond(c, r, 0.03);
    quad(p1, p2, p3, p4, ok ? 'rgba(80,200,80,.3)' : 'rgba(220,60,50,.35)', ok ? 'rgba(255,255,255,.9)' : 'rgba(255,200,200,.9)', 2.5);
    ctx.globalAlpha = 0.8; quad(p1, p2, p3, p4, '#4f95d8'); ctx.globalAlpha = 1;
    return;
  }
  const abrigoId = movAbrigoId();
  if (abrigoId) {
    const u0 = moving.u - YARD_W / 2, v0 = moving.v - YARD_D / 2, u1 = u0 + YARD_W, v1 = v0 + YARD_D, ok = movOk();
    quad(iso(u0, v0), iso(u1, v0), iso(u1, v1), iso(u0, v1), ok ? 'rgba(80,200,80,.3)' : 'rgba(220,60,50,.35)', ok ? 'rgba(255,255,255,.9)' : 'rgba(255,200,200,.9)', 2.5);
    ctx.globalAlpha = 0.85;
    comRotacaoAbrigo({ u0, v0, rot: !!moving.rot }, () => {
      if (abrigoId === 'chiqueiro') { const q = iso(u0 + 1.5, v0 + 1.9); ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.ellipse(q.x, q.y, L.W * 0.85, L.W * 0.36, 0, 0, 7); ctx.fill(); }
      else drawShed(abrigoId, u0, v0, abrigoLv(state, abrigoId), t, state.skin);
    });
    ctx.globalAlpha = 1;
    return;
  }
  const W = L.W, u = moving.u, v = moving.v, q = iso(u, v);
  const raio = raioMov(), ok = validSpot(sc, u, v, moving.key, raio);
  // setinhas em volta mostram que dá para arrastar
  if (pointer.touch) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.ellipse(q.x, q.y, W * raio * 0.75, W * raio * 0.32, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = ok ? 'rgba(80,200,80,.35)' : 'rgba(220,60,50,.35)';
  ctx.beginPath(); ctx.ellipse(q.x, q.y, W * raio * 0.6, W * raio * 0.25, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.75;
  const k = moving.key, s = state;
  const gr = moving.rot | 0;
  if (moving.novo) comGiro(q.x, gr, () => drawEnfeite(moving.novo, q.x, q.y, W / 100, t, gr));
  else if (k.startsWith('enf:')) { const o = objetosDe(s, sc)[Number(k.slice(4))]; if (o) comGiro(q.x, gr, () => drawEnfeite(o.id, q.x, q.y, W / 100, t, gr)); }
  else if (k === 'casa') comGiro(q.x, gr, () => drawHouse(q.x, q.y, W * 0.95, '#f1dcae', s.skin, gr >= 2));
  else if (k === 'celeiro') comGiro(q.x, gr, () => drawBarn(q.x, q.y, W * 1.15, s.skin, gr >= 2));
  else if (k === 'canil') comGiro(q.x, gr, () => drawKennel(q.x, q.y, L.W * 0.85, s.skin, gr >= 2));
  else if (k === 'pesqueiro') comGiro(q.x, gr, () => drawLake(q.x, q.y, W * 0.48, t));
  else if (k === 'placa') drawLandSign(q.x, q.y, true);
  else if (k === 'mata') drawMataCaca(q.x, q.y, W);
  else if (k === 'armadilha') drawArmadilha(q.x, q.y, W, true, t);
  else if (k === 'chocadeira') drawChocadeira(q.x, q.y, W, [], t);
  else comGiro(q.x, gr, () => drawTree(q.x, q.y, W * 0.9, t, sc === 'roca' && temaDe(s).coqueiro));
  ctx.globalAlpha = 1;
}
// Seletor de quantidade (− n +) para vender ou guardar mais de um de uma vez. Só de tela, não salva.
const qtdSel = {};
function qtdStep(key, max) {
  const n = clamp(Math.round(qtdSel[key]) || max, 1, max);
  qtdSel[key] = n;
  return `<div class="stepper"><button type="button" class="btn ghost" data-qtdd="${key}" data-qtd-max="${max}" ${n <= 1 ? 'disabled' : ''} aria-label="Menos">−</button><b>${n}</b><button type="button" class="btn ghost" data-qtdi="${key}" data-qtd-max="${max}" ${n >= max ? 'disabled' : ''} aria-label="Mais">+</button></div>`;
}
// Vender decoração: metade do que custou, com um clique a mais para confirmar. Itens de evento não se vendem.
let vendaArmed = null;
const venderBtn = (key, preco, max = 1) => {
  const qk = 'v:' + key, n = max > 1 ? clamp(qtdSel[qk] || 1, 1, max) : 1;
  qtdSel[qk] = n;
  const total = preco * n;
  return (max > 1 ? qtdStep(qk, max) : '') + (vendaArmed === key
    ? `<button class="btn danger" data-vender-dec="${key}" data-qtd="${n}">Confirmar ${moeda(total)}</button>`
    : `<button class="btn ghost" data-vender-dec="${key}" data-qtd="${n}">Vender ${moeda(total)}</button>`);
};
function venderDecoracao(key, qtd = 1) {
  if (vendaArmed !== key) {
    vendaArmed = key; renderPane();
    setTimeout(() => { if (vendaArmed === key) { vendaArmed = null; renderPane(); } }, 4000);
    return;
  }
  vendaArmed = null;
  const [tipo, id] = key.split(':');
  let nome, preco, n = 1;
  if (tipo === 'enf') {
    const e = ENFEITE[id];
    if (!e || e.especial || !(state.enfeites[id] > 0)) return;
    n = clamp(Math.round(qtd) || 1, 1, state.enfeites[id]);
    state.enfeites[id] -= n; nome = e.nome; preco = Math.floor(e.custo / 2) * n;
  } else {
    const d = MODELO[id];
    if (!d || !state.decorTem[id]) return;
    delete state.decorTem[id]; if (state.decor[d.lugar] === id) delete state.decor[d.lugar];
    nome = d.nome; preco = Math.floor(d.custo / 2);
  }
  state.coins += preco; sfx('coin');
  toast(`Vendeu ${n > 1 ? `${n}× ` : ''}${nome.toLowerCase()} por ${preco.toLocaleString('pt-BR')} moedas.`, 'good');
  done();
}
// Na Loja: se já tem o item no inventário, o botão principal usa o do inventário (e um botãozinho compra mais).
function botaoEnfeiteLoja(e, podeComprar = true, qtd = 1) {
  const tem = state.enfeites[e.id] || 0, custo = e.custo * qtd, comprar = mais => `<button class="btn ${mais ? 'ghost mais' : ''}" data-enfeite-comprar="${e.id}"${qtd > 1 ? ` data-qtd="${qtd}"` : ''}${mais ? ' data-mais="1"' : ''} ${state.coins < custo ? 'disabled' : ''}>${mais ? '+ ' : ''}${qtd > 1 ? qtd + ' · ' : ''}${moeda(custo)}</button>`;
  if (!tem) return podeComprar ? comprar(false) : '';
  return `<div class="stack"><button class="btn gold" data-enfeite-usar="${e.id}">📦 Usar · tem ${tem}</button>${podeComprar ? comprar(true) : ''}</div>`;
}
// Limite de cada frutífera: contando as plantadas (roça e rancho) e as guardadas no inventário.
const LIMITE_FRUTEIRA = { arbusto: 4, arvore: 3, colmeia: 4 };
const fruteirasDe = id => ['roca', 'animais'].reduce((n, sc) => n + objetosDe(state, sc).filter(o => o.id === id).length, 0) + (state.enfeites[id] || 0);
function comprarEnfeite(id, qtd = 1) {
  const e = ENFEITE[id];
  if (e.especial) return;
  if (e.fruteira && fruteirasDe(id) + qtd > LIMITE_FRUTEIRA[e.fruteira]) return toast(`Limite de ${e.nome.toLowerCase()}: no máximo ${LIMITE_FRUTEIRA[e.fruteira]} (contando as do inventário). Você já tem ${fruteirasDe(id)}.`, 'bad');
  if (state.level < e.nivel) return toast(`${e.nome} libera no nível ${e.nivel}.`);
  if (state.coins < e.custo * qtd) return toast(`${qtd > 1 ? qtd + ' × ' : ''}${e.nome} custa ${(e.custo * qtd).toLocaleString('pt-BR')} moedas.`, 'bad');
  state.coins -= e.custo * qtd; state.enfeites[id] = (state.enfeites[id] || 0) + qtd; state.invNovos = (state.invNovos || 0) + 1;
  sfx('buy'); if (!e.cerca) addXP(3, null);
  toast(e.cerca ? `${qtd > 1 ? qtd + '× ' : ''}${e.nome} no Inventário! Toque em "📦 Usar" para pôr na roça.` : `${e.nome} comprado! Está no Inventário.`, 'good');
  renderTabs(); done();
}
function actEnfeite(id, key, sc) {
  const e = ENFEITE[id];
  if (e.fruteira && key) return actFruteira(sc || scene, Number(String(key).slice(4)));
  toast(isHome() ? `${e.nome}: +${e.conforto}% de XP. Para mudar de lugar, use o botão Mover; para guardar, o Inventário.` : `${e.nome} de ${view.nome}.`);
}
// ---------- Inventário: enfeites guardados e os que estão na roça ou no rancho ----------
function inventarioHTML() {
  if (state.invNovos) { state.invNovos = 0; setTimeout(renderTabs, 0); save(); }
  let html = chaveAviso('inventario', 'Avisar coisas novas no botão do Inventário') + `<p class="hint">Dá para vender enfeites guardados pela metade do preço (os de eventos não se vendem).</p><p class="hint">Aqui ficam os enfeites que você comprou ou ganhou. Para pôr um na roça ou no rancho, escolha e clique no lugar. Para mudar de lugar, use o botão Mover.</p>`;
  const guardados = ENFEITES.filter(e => state.enfeites[e.id] > 0);
  html += `<h3>Guardados</h3>`;
  if (!guardados.length) html += `<div class="empty">Nada guardado. Compre enfeites na Loja › Enfeites.</div>`;
  for (const e of guardados) {
    html += `<div class="row wide ${e.especial ? 'sel' : ''}"><img alt="" src="${enfeiteIcon(e.id)}"><div><div class="name">${e.nome} × ${state.enfeites[e.id]}${e.especial ? ` <span class="tag">${e.vila ? '🏡 vila' : '⭐ pioneiros'}</span>` : ''}</div><div class="meta">${e.cerca ? 'Um pedaço de cerca para a roça. Depois de pôr um, já vem o próximo (dá para girar).' : `+${e.conforto}% de XP quando está na roça ou no rancho`}${e.especial ? `<br>${origemEnfeite(e, state)}` : ''}</div></div>
      <div class="actions"><button class="btn gold" data-inv-por="${e.id}" data-sc="roca">Pôr na roça</button>${e.cerca ? '' : `<button class="btn gold" data-inv-por="${e.id}" data-sc="animais">Pôr no rancho</button>`}
      ${e.especial ? '' : venderBtn('enf:' + e.id, Math.floor(e.custo / 2), state.enfeites[e.id])}</div></div>`;
  }
  for (const sc of ['roca', 'animais']) {
    const l = objetosDe(state, sc);
    if (!l.length) continue;
    html += `<h3>${sc === 'roca' ? 'Na roça' : 'No rancho'}</h3>`;
    for (const ce of ENFEITES.filter(x => x.cerca)) {
      const n = l.filter(o => o.id === ce.id).length;
      if (n) {
        const key = 'gc:' + sc + ':' + ce.id, stepper = n > 1 ? qtdStep(key, n) : '', sel = qtdSel[key] || 1;
        html += `<div class="row"><img alt="" src="${enfeiteIcon(ce.id)}"><div><div class="name">${ce.nome} × ${n}</div><div class="meta">Para mudar de lugar ou girar, use o botão Mover</div></div>
          <div class="stack">${stepper}<button class="btn ghost" data-inv-guardar-cercas="${sc}:${ce.id}" data-qtd="${sel}">Guardar${n > 1 ? ` ${sel}` : ''}</button></div></div>`;
      }
    }
    l.forEach((o, i) => {
      const e = ENFEITE[o.id];
      if (e.cerca) return;
      html += e.fruteira ? `<div class="row"><img alt="" src="${enfeiteIcon(e.id)}"><div><div class="name">${e.nome}</div><div class="meta">${estadoFruteira(o).txt}</div></div><div></div></div>`
        : `<div class="row"><img alt="" src="${enfeiteIcon(e.id)}"><div><div class="name">${e.nome}</div><div class="meta">+${e.conforto}% de XP${e.especial ? ` · ${origemEnfeite(e, state)}` : ''}</div></div><button class="btn ghost" data-inv-guardar="${sc}:${i}">Guardar</button></div>`;
    });
  }
  return html;
}
function invPor(id, sc) {
  if (!(state.enfeites[id] > 0)) return;
  closePanel(); if (!isHome()) goHome(); setScene(sc);
  const [u0, v0] = screenToWorld(L.cw / 2, L.ch * 0.55), [u, v] = ehCerca(id) ? encaixaCerca(u0, v0, 0) : ehAgua(id) ? encaixaAgua(u0, v0) : pontoLivre(sc, u0, v0, null, 0.55);
  moveMode = true; moving = { novo: id, u, v, rot: 0 }; renderMoveBtn(); renderTools();
  toast(moveDica(ENFEITE[id].nome));
}
function invGuardar(sc, i) {
  const l = objetosDe(state, sc), o = l[i]; if (!o) return;
  state.objetos[sc] = l.filter((_, k) => k !== i);
  state.enfeites[o.id] = (state.enfeites[o.id] || 0) + 1;
  toast(`${ENFEITE[o.id].nome} guardado no inventário.`); done();
}
// ---------- Remover tudo (Modo Mover) e Layouts: guarda até 3 arranjos por cena (roça e rancho não se misturam) ----------
function removerTudoEnfeites(sc) {
  const l = objetosDe(state, sc);
  if (!l.length) return toast('Não tem nada pra remover aqui.');
  for (const o of l) state.enfeites[o.id] = (state.enfeites[o.id] || 0) + 1;
  state.objetos[sc] = [];
  sfx('buy'); toast(`Tudo guardado no inventário (${l.length} ${l.length === 1 ? 'item' : 'itens'}).`, 'good'); done(); renderMoveBar();
}
const layoutsDe = sc => { const L = state.layouts || (state.layouts = {}); return L[sc] || (L[sc] = [null, null, null]); };
function salvarLayout(sc, slot) {
  const l = objetosDe(state, sc);
  if (!l.length) return toast('Coloque alguma coisa na cena antes de salvar um layout.');
  const nome = (layoutsDe(sc)[slot] && layoutsDe(sc)[slot].nome) || `Layout ${slot + 1}`;
  layoutsDe(sc)[slot] = { nome, objetos: JSON.parse(JSON.stringify(l)) };
  sfx('buy'); toast(`${nome} salvo com o arranjo de agora!`, 'good'); done(); renderLayouts();
}
function apagarLayout(sc, slot) {
  layoutsDe(sc)[slot] = null; done(); renderLayouts();
}
function renomearLayout(sc, slot, nome) {
  const L = layoutsDe(sc)[slot]; if (!L) return;
  L.nome = (nome || '').trim().slice(0, 24) || `Layout ${slot + 1}`; done(); renderLayouts();
}
// Aplica um layout salvo: devolve o que está na cena pro inventário e recoloca o arranjo salvo,
// usando o que tiver disponível (o que sobrou de material, se algo foi vendido depois de salvar).
function aplicarLayout(sc, slot) {
  const L = layoutsDe(sc)[slot];
  if (!L) return toast('Esse layout está vazio. Salve um arranjo nele primeiro.');
  const atuais = objetosDe(state, sc);
  const disponivel = {};
  for (const o of atuais) disponivel[o.id] = (disponivel[o.id] || 0) + 1;
  for (const [id, q] of Object.entries(state.enfeites || {})) disponivel[id] = (disponivel[id] || 0) + q;
  const usados = {}, novos = [];
  let faltou = 0;
  for (const o of L.objetos) {
    usados[o.id] = (usados[o.id] || 0) + 1;
    if (usados[o.id] <= (disponivel[o.id] || 0)) novos.push(JSON.parse(JSON.stringify(o)));
    else faltou++;
  }
  for (const o of atuais) state.enfeites[o.id] = (state.enfeites[o.id] || 0) + 1;
  for (const o of novos) { state.enfeites[o.id] = (state.enfeites[o.id] || 0) - 1; if (state.enfeites[o.id] <= 0) delete state.enfeites[o.id]; }
  state.objetos[sc] = novos;
  sfx('buy'); toast(`${L.nome} aplicado!${faltou ? ` (faltou material pra ${faltou} ${faltou === 1 ? 'item' : 'itens'})` : ''}`, 'good');
  done(); renderMoveBar(); fecharLayouts();
}
function abrirLayouts() { $('#layouts').hidden = false; renderLayouts(); }
function fecharLayouts() { $('#layouts').hidden = true; }
// Fotinha do layout: um mapinha visto de cima, com um pontinho colorido por item na posição salva.
function layoutPreviewIcon(sc, L) {
  const key = 'layout:' + sc + ':' + L.objetos.map(o => `${o.id}@${o.u},${o.v}`).join('|');
  return makeIcon(key, () => {
    const [a0, b0, a1, b1] = areaDe(sc === 'animais' ? 'animais' : 'roca');
    ctx.fillStyle = '#bfe08a'; ctx.fillRect(3, 3, 90, 90);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.strokeRect(3, 3, 90, 90);
    for (const o of L.objetos) {
      const px = 3 + clamp((o.u - a0) / (a1 - a0), 0, 1) * 90, py = 3 + clamp((o.v - b0) / (b1 - b0), 0, 1) * 90;
      const cor = ehAgua(o.id) ? '#4f95d8' : ehCerca(o.id) ? '#8a5a33' : (ENFEITE[o.id] && ENFEITE[o.id].fruteira) ? '#4f9a2f' : '#e0a800';
      ctx.fillStyle = cor; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, 3.4, 0, 7); ctx.fill(); ctx.stroke();
    }
  });
}
function renderLayouts() {
  if ($('#layouts').hidden) return;
  const sc = scene, nomeCena = sc === 'animais' ? 'do rancho' : 'da roça';
  let html = `<h3 style="margin-top:0">Layouts ${nomeCena}</h3>`;
  layoutsDe(sc).forEach((L, k) => {
    const capa = L && L.objetos.length ? `<img alt="" src="${layoutPreviewIcon(sc, L)}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex:none">`
      : `<div class="avatar" style="background:${L ? '#4f9a2f' : '#b7b39c'};flex:none">${k + 1}</div>`;
    html += `<div style="display:flex;gap:10px;align-items:center;background:var(--card);border:2px solid var(--panel-2);border-radius:12px;padding:8px 10px;margin-bottom:8px">
      ${capa}
      <div style="flex:1;min-width:0">
        <div class="name">${L ? esc(L.nome) : `Layout ${k + 1}`}</div><div class="meta">${L ? `${L.objetos.length} ${L.objetos.length === 1 ? 'item' : 'itens'}` : 'Vazio'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          ${L ? `<button class="btn gold" type="button" data-layout-aplicar="${k}">Aplicar</button>` : ''}
          <button class="btn ghost" type="button" data-layout-salvar="${k}">${L ? 'Sobrescrever' : 'Salvar aqui'}</button>
          ${L ? `<button class="btn ghost" type="button" data-layout-renomear="${k}">✏️</button><button class="btn ghost" type="button" data-layout-apagar="${k}">Apagar</button>` : ''}
        </div>
      </div></div>`;
  });
  $('#layoutsBody').innerHTML = html;
}
$('#layouts').addEventListener('click', e => {
  if (e.target === $('#layouts') || e.target.closest('[data-close]')) return fecharLayouts();
  const b = e.target.closest('button[data-layout-aplicar], button[data-layout-salvar], button[data-layout-apagar], button[data-layout-renomear]'); if (!b) return;
  const sc = scene;
  if (b.dataset.layoutAplicar !== undefined) aplicarLayout(sc, Number(b.dataset.layoutAplicar));
  else if (b.dataset.layoutSalvar !== undefined) salvarLayout(sc, Number(b.dataset.layoutSalvar));
  else if (b.dataset.layoutApagar !== undefined) apagarLayout(sc, Number(b.dataset.layoutApagar));
  else if (b.dataset.layoutRenomear !== undefined) { const slot = Number(b.dataset.layoutRenomear), atual = layoutsDe(sc)[slot]; const nome = window.prompt('Nome do layout:', atual ? atual.nome : ''); if (nome !== null) renomearLayout(sc, slot, nome); }
});
// Todos os blocos de água conectados (4 direções) a partir de "o" — o mesmo laguinho.
function aguaGrupo(objs, o) {
  const vistos = new Set(), fila = [o], grupo = [];
  while (fila.length) {
    const c = fila.pop(), k = c.u + ',' + c.v; if (vistos.has(k)) continue; vistos.add(k); grupo.push(c);
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const viz = objs.find(x => Math.abs(x.u - (c.u + du)) < 0.1 && Math.abs(x.v - (c.v + dv)) < 0.1);
      if (viz) fila.push(viz);
    }
  }
  return grupo;
}
// Ponto na aresta from→to, a uma distância r de "from" (ou o próprio "from" se r for 0/falsy).
function aguaApara(from, to, r) {
  if (!r) return from;
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy), rr = Math.min(r, d / 2);
  return { x: from.x + dx / d * rr, y: from.y + dy / d * rr };
}
// Bloco de água: do tamanho de uma célula (igual um canteiro). Sem borda no lado que encosta em
// outro bloco de água, pra virar um laguinho contínuo — e as pontas que ficam pra fora (sem vizinho
// dos dois lados) saem arredondadas, pra não parecer um monte de quadradinhos colados.
// Com peixinho pulando quando tem pelo menos 2 juntos.
function drawAgua(s, sc, o, t) {
  const objs = objetosDe(s, sc).filter(x => ehAgua(x.id));
  const viz = (du, dv) => objs.some(x => Math.abs(x.u - (o.u + du)) < 0.1 && Math.abs(x.v - (o.v + dv)) < 0.1);
  const c = o.u - 0.5, r = o.v - 0.5;
  // Só encolhe (0,03) no lado exposto (sem vizinho) — no lado que encosta em outro bloco, vai até a
  // borda exata da célula, senão sobrava uma friestinha de grama entre os dois e dava pra notar a divisão.
  const IN = 0.03, iL = viz(-1, 0) ? 0 : IN, iR = viz(1, 0) ? 0 : IN, iT = viz(0, -1) ? 0 : IN, iB = viz(0, 1) ? 0 : IN;
  const p1 = iso(c + iL, r + iT), p2 = iso(c + 1 - iR, r + iT), p3 = iso(c + 1 - iR, r + 1 - iB), p4 = iso(c + iL, r + 1 - iB);
  const cor = estacao().neve ? '#cfe6f5' : '#4f95d8', raio = L.W * 0.16;
  // cada corte (round1..4) só arredonda se as DUAS arestas que se encontram ali não tiverem vizinho
  const rd1 = (!viz(0, -1) && !viz(-1, 0)) ? raio : 0;
  const rd2 = (!viz(0, -1) && !viz(1, 0)) ? raio : 0;
  const rd3 = (!viz(1, 0) && !viz(0, 1)) ? raio : 0;
  const rd4 = (!viz(0, 1) && !viz(-1, 0)) ? raio : 0;
  const pts = [p1, p2, p3, p4], rds = [rd1, rd2, rd3, rd4];
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4], cur = pts[i], next = pts[(i + 1) % 4], rr = rds[i];
    const a = aguaApara(cur, prev, rr), b = aguaApara(cur, next, rr);
    if (i === 0) ctx.moveTo(a.x, a.y); else ctx.lineTo(a.x, a.y);
    if (rr) ctx.quadraticCurveTo(cur.x, cur.y, b.x, b.y); else ctx.lineTo(b.x, b.y);
  }
  ctx.closePath(); ctx.fillStyle = cor; ctx.fill();
  // borda: só nas arestas sem vizinho, já aparadas nas pontas arredondadas
  const bordaEdge = (exposto, a, ra, b, rb) => { if (exposto) line(aguaApara(a, b, ra), aguaApara(b, a, rb), 'rgba(255,255,255,.4)', 1.3); };
  bordaEdge(!viz(0, -1), p1, rd1, p2, rd2);
  bordaEdge(!viz(1, 0), p2, rd2, p3, rd3);
  bordaEdge(!viz(0, 1), p3, rd3, p4, rd4);
  bordaEdge(!viz(-1, 0), p4, rd4, p1, rd1);
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.3;
  for (const [cur, rr, prev, next] of [[p1, rd1, p4, p2], [p2, rd2, p1, p3], [p3, rd3, p2, p4], [p4, rd4, p3, p1]]) {
    if (!rr) continue;
    const a = aguaApara(cur, prev, rr), b = aguaApara(cur, next, rr);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cur.x, cur.y, b.x, b.y); ctx.stroke();
  }
  const m = { x: (p1.x + p3.x) / 2, y: (p1.y + p3.y) / 2 };
  const conectado = viz(1, 0) || viz(-1, 0) || viz(0, 1) || viz(0, -1);
  const grupo = conectado ? aguaGrupo(objs, o) : [o];
  const ancora = grupo.every(x => x.u > o.u || (x.u === o.u && x.v >= o.v));
  // O brilho e os peixes são só um por laguinho (não um por bloco), senão dá pra perceber a divisão.
  if (!conectado) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(m.x - L.W * 0.08, m.y - L.W * 0.06, L.W * 0.14, L.W * 0.06, 0, 0, 7); ctx.fill(); }
  else if (ancora) {
    const gu = grupo.reduce((a, x) => a + x.u, 0) / grupo.length, gv = grupo.reduce((a, x) => a + x.v, 0) / grupo.length;
    const gc = iso(gu, gv), k = Math.sqrt(grupo.length);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.ellipse(gc.x - L.W * 0.1 * k, gc.y - L.W * 0.08 * k, L.W * 0.16 * k, L.W * 0.07 * k, 0, 0, 7); ctx.fill();
  }
}
// Peixe de célula em célula do laguinho, num horário determinístico (sem guardar estado): a cada
// "perna" (PEIXE_LAGOA_LEG ms) troca de bloco de destino, escolhido por uma pseudo-aleatoriedade com seed.
const PEIXE_LAGOA_LEG = 3200;
function peixeLagoaAlvo(grupo, seed, leg) {
  const x = Math.sin(seed * 12.9898 + leg * 78.233) * 43758.5453;
  return grupo[Math.floor((x - Math.floor(x)) * grupo.length) % grupo.length];
}
function drawPeixesLagoa(grupo, t, W) {
  const n = Math.min(3, Math.max(1, Math.round(grupo.length / 2)));
  for (let i = 0; i < n; i++) {
    const seed = i * 991 + Math.round(grupo[0].u * 131 + grupo[0].v * 257);
    const total = t + i * 1300, leg = Math.floor(total / PEIXE_LAGOA_LEG), frac = (total % PEIXE_LAGOA_LEG) / PEIXE_LAGOA_LEG;
    const de = peixeLagoaAlvo(grupo, seed, leg), pra = peixeLagoaAlvo(grupo, seed, leg + 1);
    const u = de.u + (pra.u - de.u) * frac, v = de.v + (pra.v - de.v) * frac;
    const q = iso(u, v), qDe = iso(de.u, de.v), qPra = iso(pra.u, pra.v);
    const ang = Math.atan2(qPra.y - qDe.y, qPra.x - qDe.x);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang); ctx.globalAlpha = 0.92;
    drawPeixe(ctx, 0, 0, W / 130, PEIXE.lambari);
    ctx.globalAlpha = 1; ctx.restore();
  }
}
// Desenha os peixinhos de todos os laguinhos da cena, por cima de tudo (senão um bloco de água
// desenhado depois do peixe, na mesma volta do loop, cobria ele).
function drawPeixesRoca(s, t) {
  const objs = objetosDe(s, 'roca').filter(x => ehAgua(x.id)), vistos = new Set();
  for (const o of objs) {
    const k = o.u + ',' + o.v; if (vistos.has(k)) continue;
    const grupo = aguaGrupo(objs, o);
    for (const x of grupo) vistos.add(x.u + ',' + x.v);
    drawPeixesLagoa(grupo, t, L.W);
  }
}
// Desenho dos enfeites, com a base em (x, y). s = escala (1 = casa de 100px).
function drawEnfeite(id, x, y, s, t, rot) {
  if (ENFEITE[id] && ENFEITE[id].fruteira) return drawFruteira({ id }, x, y, s, t, false);
  if (ENFEITE[id] && ENFEITE[id].cerca && id !== 'cerca') {
    // ícone: um pedaço de frente, no estilo do item
    const W0 = L.W; L.W = 230 * s / 1.6;
    ctx.fillStyle = '#9ccf6a'; ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 30 * s, 7 * s, 0, 0, 7); ctx.fill();
    const a = { x: x - 26 * s, y: y - 2 * s }, b = { x: x + 26 * s, y: y - 8 * s };
    if (ENFEITE[id].porteira) drawPorteira(a, b, ENFEITE[id].porteira, L.W); else fenceRun(a, b, 2, false, ENFEITE[id].estilo);
    L.W = W0; return;
  }
  if (id === 'agua') {
    // ícone: um quadradinho de água visto de cima, com um peixinho pulando
    ctx.fillStyle = '#4f95d8'; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.roundRect(x - 24 * s, y - 20 * s, 48 * s, 40 * s, 4 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(x - 8 * s, y - 8 * s, 14 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x + 6 * s, y + 2 * s); ctx.rotate(-0.3);
    drawPeixe(ctx, 0, 0, s * 0.5, PEIXE.lambari);
    ctx.restore();
    return;
  }
  ctx.lineWidth = Math.max(1, 1.2 * s); ctx.strokeStyle = 'rgba(60,30,10,.5)';
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 8 * s, 0, 0, 7); ctx.fill();
  if (id === 'trofeuchupa') {
    // plaquinha de madeira com a cabeça do Chupa-cabra
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(x - 2 * s, y - 30 * s, 4 * s, 30 * s);
    ctx.fillStyle = '#a8703a'; ctx.strokeStyle = '#5a3414'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x, y - 62 * s); ctx.lineTo(x + 18 * s, y - 50 * s); ctx.lineTo(x + 14 * s, y - 28 * s); ctx.lineTo(x - 14 * s, y - 28 * s); ctx.lineTo(x - 18 * s, y - 50 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawBicho(ctx, x - 12 * s, y - 24 * s, s * 0.95, CACA_BICHO.chupacabra, 0, false);
    ctx.fillStyle = '#f2c14e'; ctx.font = `900 ${Math.round(7 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('★', x, y - 54 * s);
    return;
  }
  if (id === 'cerca') {
    // pedacinho de cerca de madeira (no ícone, sem o tema)
    ctx.fillStyle = '#b98050'; ctx.fillRect(x - 24 * s, y - 16 * s, 48 * s, 5 * s); ctx.fillRect(x - 24 * s, y - 30 * s, 48 * s, 5 * s);
    for (const dx of [-20, 0, 20]) { ctx.fillStyle = '#a4703f'; ctx.fillRect(x + (dx - 3) * s, y - 38 * s, 6 * s, 38 * s); ctx.fillStyle = '#c99260'; ctx.fillRect(x + (dx - 3) * s, y - 38 * s, 6 * s, 4 * s); }
    return;
  }
  if (id === 'carroca') {
    // carroça de feno (presente do Seu Zé)
    ctx.strokeStyle = '#7a4a24'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(x + 14 * s, y - 10 * s); ctx.lineTo(x + 30 * s, y - 4 * s); ctx.stroke();
    ctx.fillStyle = '#e8c65a'; ctx.beginPath(); ctx.ellipse(x - 2 * s, y - 24 * s, 17 * s, 9 * s, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#d9b44a'; for (const dx of [-12, -4, 4, 10]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y - 26 * s, 3 * s, 5 * s, 0.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#a86b38'; ctx.strokeStyle = '#6b3f1f'; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.roundRect(x - 20 * s, y - 24 * s, 36 * s, 13 * s, 2 * s); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(107,63,31,.6)'; ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 17.5 * s); ctx.lineTo(x + 16 * s, y - 17.5 * s); ctx.stroke();
    for (const wx of [-11, 8]) { ctx.strokeStyle = '#4a2c14'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(x + wx * s, y - 7 * s, 7 * s, 0, 7); ctx.stroke();
      ctx.lineWidth = 1 * s; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + wx * s - Math.cos(a) * 6 * s, y - 7 * s - Math.sin(a) * 6 * s); ctx.lineTo(x + wx * s + Math.cos(a) * 6 * s, y - 7 * s + Math.sin(a) * 6 * s); ctx.stroke(); } }
    return;
  }
  if (id === 'roseira') {
    // roseira (presente da Dona Maria)
    ctx.fillStyle = '#8b5a33'; ctx.beginPath(); ctx.ellipse(x, y - 2 * s, 16 * s, 5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#3f8a2a'; for (const [dx, dy, r] of [[-9, -12, 9], [8, -13, 9], [0, -20, 10], [-4, -8, 8], [5, -7, 8]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); }
    for (const [dx, dy] of [[-10, -15], [7, -18], [0, -26], [-3, -10], [9, -9], [-12, -6], [3, -14]]) {
      ctx.fillStyle = '#e25b8f'; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 3.4 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#b83a6b'; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 1.6 * s, 0, 7); ctx.fill();
    }
    return;
  }
  if (id === 'flores') {
    // canteiro com borda de tábuas e flores de pétalas
    ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.ellipse(x, y - 3 * s, 25 * s, 9 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4f2a'; ctx.beginPath(); ctx.ellipse(x, y - 1 * s, 25 * s, 9 * s, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.ellipse(x, y - 5 * s, 21 * s, 6.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4f9a2f'; for (let k = 0; k < 9; k++) { const a = k * 0.7; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14 * s, y - 8 * s + Math.sin(a) * 3.5 * s, 4 * s, 2 * s, a, 0, 7); ctx.fill(); }
    const cores = ['#e53b2f', '#ffd54a', '#f06292', '#ffffff', '#ba68c8'];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.3, r = 5 + (k % 3) * 5, fx = x + Math.cos(a) * r * 1.4 * s, fy = y - 11 * s + Math.sin(a) * r * 0.4 * s;
      ctx.strokeStyle = '#3f7a24'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + 5 * s); ctx.stroke();
      ctx.fillStyle = cores[k % 5]; for (let p = 0; p < 5; p++) { const pa = p * 1.257; ctx.beginPath(); ctx.arc(fx + Math.cos(pa) * 2.2 * s, fy + Math.sin(pa) * 2.2 * s, 1.8 * s, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#f2a900'; ctx.beginPath(); ctx.arc(fx, fy, 1.3 * s, 0, 7); ctx.fill();
    }
  } else if (id === 'banco') {
    // banco de praça: pés de ferro, ripas arredondadas. Giro 0 = de frente; 2 = de costas (o encosto
    // fica na frente do assento); ímpares = de lado, na diagonal (o comGiro espelha o 3).
    const giro = (rot | 0) % 4;
    if (giro % 2) {
      // de lado (perfil): só a ponta do banco — pé da frente, pé de trás subindo no encosto e as pontas das
      // ripas. Giro 1 com o encosto à esquerda, giro 3 à direita (o comGiro ainda espelha os dois).
      const f = giro === 1 ? 1 : -1, X = dx => x + dx * f * s;
      const ret = (a, b, y0, y1, cor) => { ctx.fillStyle = cor; ctx.fillRect(Math.min(X(a), X(b)), y - y1 * s, Math.abs(X(b) - X(a)), (y1 - y0) * s); };
      const ripa = (dx, h, cor) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.roundRect(X(dx) - 2.2 * s, y - (h + 3.5) * s, 4.4 * s, 3.5 * s, 1.2 * s); ctx.fill(); };
      // perna da frente, pé de trás + encosto inclinado, barra do assento
      ret(7, 10, 0, 13, '#3a3e43'); ret(6, 11, 0, 1.5, '#3a3e43');
      ctx.fillStyle = '#3a3e43'; poly([{ x: X(-9), y }, { x: X(-6), y }, { x: X(-8.5), y: y - 31 * s }, { x: X(-11.5), y: y - 31 * s }]); ctx.fill();
      ret(-11, -5, 0, 1.5, '#3a3e43'); ret(-8, 10, 11, 13, '#3a3e43');
      // pontas das ripas do assento e do encosto
      for (const dx of [-3, 2.5, 7.5]) ripa(dx, 12.5, '#c08a55');
      for (const [dx, h] of [[-10.6, 17], [-11.4, 22], [-12.2, 27]]) ripa(dx + 3.2, h, '#b07a44');
      return;
    }
    ctx.save();
    const pes = () => { ctx.fillStyle = '#3a3e43'; for (const dx of [-19, 16]) { ctx.fillRect(x + dx * s, y - 13 * s, 3 * s, 13 * s); ctx.fillRect(x + dx * s - 1 * s, y - 1.5 * s, 5 * s, 1.5 * s); } };
    const assento = dy => { for (const [yy, hh] of [[-16, 4], [-12, 3]]) { ctx.fillStyle = '#c08a55'; ctx.beginPath(); ctx.roundRect(x - 25 * s, y + (yy + dy) * s, 50 * s, hh * s, 1.5 * s); ctx.fill(); } };
    if (giro === 2) {
      pes(); assento(-3);
      ctx.fillStyle = '#3a3e43'; for (const dx of [-21, 18]) ctx.fillRect(x + dx * s, y - 31 * s, 3 * s, 31 * s);
      for (const yy of [-31, -26, -21]) { ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.roundRect(x - 25 * s, y + yy * s, 50 * s, 3.5 * s, 1.5 * s); ctx.fill(); }
      ctx.fillStyle = '#2c3034'; ctx.fillRect(x - 23 * s, y - 24 * s, 46 * s, 1.5 * s);
    } else {
      pes();
      ctx.fillStyle = '#3a3e43'; for (const dx of [-21, 18]) ctx.fillRect(x + dx * s, y - 31 * s, 3 * s, 18 * s);
      assento(0);
      for (const yy of [-31, -26, -21]) { ctx.fillStyle = '#b07a44'; ctx.beginPath(); ctx.roundRect(x - 25 * s, y + yy * s, 50 * s, 3.5 * s, 1.5 * s); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - 24 * s, y + yy * s + 0.5 * s, 48 * s, 1 * s); }
    }
    ctx.restore();
  } else if (id === 'espantalho') {
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(x - 2 * s, y - 48 * s, 4 * s, 48 * s); ctx.fillRect(x - 21 * s, y - 36 * s, 42 * s, 3.5 * s);
    // camisa xadrez com remendo e palha saindo
    ctx.fillStyle = '#c8402f'; ctx.beginPath(); ctx.moveTo(x - 12 * s, y - 38 * s); ctx.lineTo(x + 12 * s, y - 38 * s); ctx.lineTo(x + 10 * s, y - 16 * s); ctx.lineTo(x - 10 * s, y - 16 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,20,10,.45)'; ctx.lineWidth = 1 * s; for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + dx * s, y - 38 * s); ctx.lineTo(x + dx * s, y - 16 * s); ctx.stroke(); } for (const dy of [-32, -25]) { ctx.beginPath(); ctx.moveTo(x - 11 * s, y + dy * s); ctx.lineTo(x + 11 * s, y + dy * s); ctx.stroke(); }
    ctx.fillStyle = '#3f6fa8'; ctx.fillRect(x + 2 * s, y - 27 * s, 6 * s, 6 * s);
    ctx.fillStyle = '#e8c35a'; for (const dx of [-22, 19]) for (let q = 0; q < 3; q++) ctx.fillRect(x + dx * s + q * 1.2 * s, y - 35 * s, 1 * s, 6 * s);
    for (let q = 0; q < 4; q++) ctx.fillRect(x - 6 * s + q * 4 * s, y - 16 * s, 1.2 * s, 5 * s);
    // cabeça de saco com sorriso costurado e chapéu de palha
    ctx.fillStyle = '#e6d2a4'; ctx.beginPath(); ctx.arc(x, y - 44 * s, 8 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(x - 4 * s, y - 46 * s, 2 * s, 2 * s); ctx.fillRect(x + 2 * s, y - 46 * s, 2 * s, 2 * s);
    ctx.strokeStyle = '#6b3a1a'; ctx.lineWidth = 0.9 * s; ctx.beginPath(); ctx.arc(x, y - 43 * s, 3.5 * s, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.fillStyle = '#e0b040'; ctx.beginPath(); ctx.ellipse(x, y - 51 * s, 15 * s, 3.5 * s, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 7 * s, y - 51 * s); ctx.quadraticCurveTo(x, y - 63 * s, x + 7 * s, y - 51 * s); ctx.fill();
    ctx.fillStyle = '#c8402f'; ctx.fillRect(x - 7 * s, y - 54 * s, 14 * s, 2 * s);
    // um passarinho no braço
    ctx.fillStyle = '#5a6a7a'; ctx.beginPath(); ctx.ellipse(x + 15 * s, y - 39 * s, 3 * s, 2.2 * s, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x + 17.5 * s, y - 41 * s, 1.6 * s, 0, 7); ctx.fill();
  } else if (id === 'carrinho') {
    // carrinho de mão verde cheio de abóboras
    ctx.strokeStyle = '#6e4424'; ctx.lineWidth = 2.5 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 12 * s, y - 13 * s); ctx.lineTo(x - 30 * s, y - 20 * s); ctx.moveTo(x - 10 * s, y - 9 * s); ctx.lineTo(x - 13 * s, y); ctx.moveTo(x + 2 * s, y - 9 * s); ctx.lineTo(x, y); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#4f9a3a'; ctx.beginPath(); ctx.moveTo(x - 18 * s, y - 21 * s); ctx.lineTo(x + 16 * s, y - 21 * s); ctx.lineTo(x + 9 * s, y - 8 * s); ctx.lineTo(x - 14 * s, y - 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.moveTo(x - 18 * s, y - 21 * s); ctx.lineTo(x + 16 * s, y - 21 * s); ctx.lineTo(x + 14 * s, y - 18 * s); ctx.lineTo(x - 17 * s, y - 18 * s); ctx.fill();
    for (const [dx, r] of [[-9, 5.5], [2, 6.5], [10, 4.5]]) { ctx.fillStyle = '#f28c28'; ctx.beginPath(); ctx.ellipse(x + dx * s, y - 23 * s, r * s, r * 0.8 * s, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(160,70,10,.5)'; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(x + dx * s, y - (23 + r * 0.8) * s); ctx.lineTo(x + dx * s, y - (23 - r * 0.8) * s); ctx.stroke(); ctx.fillStyle = '#4f7a24'; ctx.fillRect(x + dx * s - 0.8 * s, y - (24.5 + r * 0.8) * s, 1.6 * s, 2.5 * s); }
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x + 11 * s, y - 5 * s, 5.5 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(x + 11 * s, y - 5 * s, 2 * s, 0, 7); ctx.fill();
  } else if (id === 'poco') {
    // poço de pedra redondo, telhadinho de telhas e balde
    ctx.fillStyle = '#9a9488'; ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 17 * s, 6 * s, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(x - 17 * s, y - 18 * s, 34 * s, 14 * s);
    ctx.fillStyle = 'rgba(70,65,55,.35)'; for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { ctx.beginPath(); ctx.roundRect(x - 16 * s + c * 6.6 * s + (r % 2) * 3 * s, y - 17 * s + r * 4.6 * s, 5.4 * s, 3.6 * s, 1.2 * s); ctx.fill(); }
    ctx.fillStyle = '#c7c1b3'; ctx.beginPath(); ctx.ellipse(x, y - 18 * s, 17 * s, 6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f5d7a'; ctx.beginPath(); ctx.ellipse(x, y - 18 * s, 12.5 * s, 4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - 4 * s, y - 19 * s, 4 * s, 1 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6e4424'; ctx.fillRect(x - 15 * s, y - 44 * s, 3 * s, 26 * s); ctx.fillRect(x + 12 * s, y - 44 * s, 3 * s, 26 * s);
    ctx.strokeStyle = '#6e4424'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x - 13 * s, y - 36 * s); ctx.lineTo(x + 13 * s, y - 36 * s); ctx.stroke();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(x + 3 * s, y - 36 * s); ctx.lineTo(x + 3 * s, y - 28 * s); ctx.stroke();
    ctx.fillStyle = '#8a5a33'; ctx.beginPath(); ctx.moveTo(x - 1 * s, y - 28 * s); ctx.lineTo(x + 7 * s, y - 28 * s); ctx.lineTo(x + 6 * s, y - 22 * s); ctx.lineTo(x, y - 22 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b5532f'; ctx.beginPath(); ctx.moveTo(x - 24 * s, y - 41 * s); ctx.lineTo(x, y - 56 * s); ctx.lineTo(x + 24 * s, y - 41 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,30,10,.45)'; ctx.lineWidth = 1 * s; for (let k = 1; k < 4; k++) { const f = k / 4; ctx.beginPath(); ctx.moveTo(x - 24 * s * f, y - (56 - 15 * f) * s); ctx.lineTo(x + 24 * s * f, y - (56 - 15 * f) * s); ctx.stroke(); }
    ctx.strokeStyle = '#7a2e18'; ctx.lineWidth = 2 * s; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 25 * s, y - 40.5 * s); ctx.lineTo(x, y - 56.5 * s); ctx.lineTo(x + 25 * s, y - 40.5 * s); ctx.stroke(); ctx.lineJoin = 'miter';
  } else if (id === 'fonte') {
    // fonte de dois andares com água caindo e brilhinhos
    ctx.fillStyle = '#b3ac9e'; ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 25 * s, 8.5 * s, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(x - 25 * s, y - 9 * s, 50 * s, 5 * s);
    ctx.fillStyle = '#cfc8b8'; ctx.beginPath(); ctx.ellipse(x, y - 9 * s, 25 * s, 8.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5aa9e6'; ctx.beginPath(); ctx.ellipse(x, y - 9.5 * s, 21 * s, 6.5 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#bdb6a8'; ctx.fillRect(x - 3 * s, y - 30 * s, 6 * s, 21 * s);
    ctx.fillStyle = '#cfc8b8'; ctx.beginPath(); ctx.ellipse(x, y - 29 * s, 11 * s, 3.8 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7cc0f0'; ctx.beginPath(); ctx.ellipse(x, y - 29.5 * s, 8.5 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#bdb6a8'; ctx.fillRect(x - 1.5 * s, y - 38 * s, 3 * s, 9 * s); ctx.beginPath(); ctx.arc(x, y - 39 * s, 2.6 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,255,.9)'; ctx.lineWidth = 1.4 * s;
    for (const d of [-1, 1]) { const w = Math.sin(t / 200) * s; ctx.beginPath(); ctx.moveTo(x, y - 41 * s); ctx.quadraticCurveTo(x + d * 7 * s, y - 46 * s + w, x + d * 9 * s, y - 30 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + d * 9 * s, y - 29 * s); ctx.quadraticCurveTo(x + d * 16 * s, y - 27 * s + w, x + d * 17 * s, y - 10 * s); ctx.stroke(); }
    for (let k = 0; k < 3; k++) { const a = (t / 500 + k * 2.1) % 6.28, bx = x + Math.cos(a) * 14 * s, by = y - 10 * s + Math.sin(a) * 4 * s; ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t / 150 + k)})`; ctx.beginPath(); ctx.arc(bx, by, 1.2 * s, 0, 7); ctx.fill(); }
  } else if (id === 'moinho') {
    // cata-vento de fazenda: torre de treliça e cata-vento de pás
    ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(x - 11 * s, y); ctx.lineTo(x - 2 * s, y - 50 * s); ctx.moveTo(x + 11 * s, y); ctx.lineTo(x + 2 * s, y - 50 * s); ctx.stroke();
    ctx.lineWidth = 1 * s; for (let k = 0; k < 5; k++) { const y1 = y - k * 10 * s, y2 = y - (k + 1) * 10 * s, w1 = 11 - k * 1.8, w2 = 11 - (k + 1) * 1.8; ctx.beginPath(); ctx.moveTo(x - w1 * s, y1); ctx.lineTo(x + w2 * s, y2); ctx.moveTo(x + w1 * s, y1); ctx.lineTo(x - w2 * s, y2); ctx.moveTo(x - w2 * s, y2); ctx.lineTo(x + w2 * s, y2); ctx.stroke(); }
    ctx.fillStyle = '#c8402f'; ctx.beginPath(); ctx.moveTo(x + 3 * s, y - 52 * s); ctx.lineTo(x + 20 * s, y - 55 * s); ctx.lineTo(x + 20 * s, y - 49 * s); ctx.closePath(); ctx.fill(); // leme
    ctx.save(); ctx.translate(x, y - 52 * s); ctx.rotate(t / 700);
    for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = k % 2 ? '#e8e2d0' : '#c8402f'; ctx.beginPath(); ctx.moveTo(2 * s, -1.5 * s); ctx.lineTo(16 * s, -3.5 * s); ctx.lineTo(16 * s, 3.5 * s); ctx.lineTo(2 * s, 1.5 * s); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.fillStyle = '#3a3e43'; ctx.beginPath(); ctx.arc(x, y - 52 * s, 2.8 * s, 0, 7); ctx.fill();
  } else if (id === 'bandeira') {
    ctx.fillStyle = '#8a8f96'; ctx.fillRect(x - 1.5 * s, y - 70 * s, 3 * s, 70 * s);
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(x, y - 71 * s, 3 * s, 0, 7); ctx.fill();
    const w = k => Math.sin(t / 250 + k) * 3 * s;
    ctx.fillStyle = '#2e8b3e'; ctx.beginPath(); ctx.moveTo(x + 1.5 * s, y - 68 * s);
    for (let k = 0; k <= 6; k++) ctx.lineTo(x + (1.5 + k * 6) * s, y - 68 * s + w(k));
    for (let k = 6; k >= 0; k--) ctx.lineTo(x + (1.5 + k * 6) * s, y - 44 * s + w(k));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(x + 19 * s, y - 66 * s + w(3)); ctx.lineTo(x + 34 * s, y - 56 * s + w(5)); ctx.lineTo(x + 19 * s, y - 46 * s + w(3)); ctx.lineTo(x + 4 * s, y - 56 * s + w(1)); ctx.closePath(); ctx.fill();
    star(x + 19 * s, y - 56 * s + w(3), 5 * s);
  } else if (id === 'ipe') {
    // ipê-amarelo, a flor do cerrado, soltando pétalas
    ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 1.5 * s, y - 36 * s); ctx.lineTo(x + 1.5 * s, y - 36 * s); ctx.lineTo(x + 3 * s, y); ctx.fill();
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x, y - 28 * s); ctx.lineTo(x - 12 * s, y - 40 * s); ctx.moveTo(x, y - 30 * s); ctx.lineTo(x + 13 * s, y - 42 * s); ctx.stroke();
    for (const [dx, dy, r, c] of [[-14, -44, 11, '#f2c14e'], [13, -46, 12, '#f2c14e'], [0, -52, 13, '#ffd54a'], [-6, -40, 9, '#e8b020'], [7, -41, 9, '#ffd54a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff4a0'; for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.arc(x + ((k * 13) % 26 - 13) * s, y - (40 + (k * 7) % 16) * s, 1.4 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffd54a'; for (let k = 0; k < 3; k++) { const f = ((t / 3000) + k / 3) % 1; ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.ellipse(x + (k * 9 - 9 + Math.sin(f * 6 + k) * 4) * s, y - (40 - f * 38) * s, 1.8 * s, 1 * s, f * 3, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  } else if (id === 'fogueira') {
    ctx.fillStyle = '#9a9488'; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14 * s, y - 4 * s + Math.sin(a) * 4.5 * s, 3.5 * s, 2.4 * s, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#6b3f1f'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 11 * s, y - 2 * s); ctx.lineTo(x + 8 * s, y - 18 * s); ctx.moveTo(x + 11 * s, y - 2 * s); ctx.lineTo(x - 8 * s, y - 18 * s); ctx.moveTo(x, y); ctx.lineTo(x, y - 20 * s); ctx.stroke(); ctx.lineCap = 'butt';
    for (const [c, k] of [['#e0502a', 1], ['#f2a12a', 0.72], ['#ffe08a', 0.42]]) { const f = Math.sin(t / 90 + k * 5) * 1.5; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - 10 * k * s, y - 8 * s); ctx.quadraticCurveTo(x - 9 * k * s, y - (22 + f) * k * s - 8 * s, x + f * s, y - 36 * k * s - 6 * s); ctx.quadraticCurveTo(x + 9 * k * s, y - (22 - f) * k * s - 8 * s, x + 10 * k * s, y - 8 * s); ctx.fill(); }
    ctx.fillStyle = '#ffd54a'; for (let k = 0; k < 4; k++) { const f = ((t / 900) + k / 4) % 1; ctx.globalAlpha = 1 - f; ctx.beginPath(); ctx.arc(x + Math.sin(k * 3 + f * 5) * 8 * s, y - (30 + f * 30) * s, 1.3 * s, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  } else if (id === 'balanco') {
    ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - 22 * s, y); ctx.lineTo(x - 15 * s, y - 44 * s); ctx.lineTo(x - 8 * s, y); ctx.moveTo(x + 8 * s, y); ctx.lineTo(x + 15 * s, y - 44 * s); ctx.lineTo(x + 22 * s, y); ctx.moveTo(x - 17 * s, y - 44 * s); ctx.lineTo(x + 17 * s, y - 44 * s); ctx.stroke();
    const bal = Math.sin(t / 700) * 0.18; ctx.save(); ctx.translate(x, y - 44 * s); ctx.rotate(bal);
    ctx.strokeStyle = '#c9a15a'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(-7 * s, 0); ctx.lineTo(-7 * s, 32 * s); ctx.moveTo(7 * s, 0); ctx.lineTo(7 * s, 32 * s); ctx.stroke();
    ctx.fillStyle = '#b07a44'; ctx.beginPath(); ctx.roundRect(-10 * s, 31 * s, 20 * s, 4 * s, 1.5 * s); ctx.fill(); ctx.restore();
  } else if (id === 'carrodeboi') {
    ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 24 * s); ctx.lineTo(x + 14 * s, y - 24 * s); ctx.lineTo(x + 12 * s, y - 13 * s); ctx.lineTo(x - 18 * s, y - 13 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6b3f1f'; ctx.lineWidth = 1.2 * s; for (const dx of [-14, -6, 2, 10]) { ctx.beginPath(); ctx.moveTo(x + dx * s, y - 24 * s); ctx.lineTo(x + dx * s, y - 32 * s); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(x - 16 * s, y - 31 * s); ctx.lineTo(x + 12 * s, y - 31 * s); ctx.stroke();
    ctx.strokeStyle = '#6b3f1f'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(x + 13 * s, y - 16 * s); ctx.lineTo(x + 32 * s, y - 12 * s); ctx.stroke();
    ctx.fillStyle = '#6b3f1f'; ctx.beginPath(); ctx.arc(x - 3 * s, y - 10 * s, 10 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#b88350'; ctx.beginPath(); ctx.arc(x - 3 * s, y - 10 * s, 7.5 * s, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6b3f1f'; ctx.lineWidth = 1.4 * s; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x - 3 * s - Math.cos(a) * 7.5 * s, y - 10 * s - Math.sin(a) * 7.5 * s); ctx.lineTo(x - 3 * s + Math.cos(a) * 7.5 * s, y - 10 * s + Math.sin(a) * 7.5 * s); ctx.stroke(); }
    ctx.fillStyle = '#6b3f1f'; ctx.beginPath(); ctx.arc(x - 3 * s, y - 10 * s, 2 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8c35a'; ctx.beginPath(); ctx.ellipse(x - 3 * s, y - 27 * s, 15 * s, 5 * s, 0, Math.PI, 0); ctx.fill();
  } else if (id === 'peixedourado') {
    // pedestal de pedra com um dourado saltando, brilhando
    ctx.fillStyle = '#a8a294'; ctx.fillRect(x - 13 * s, y - 14 * s, 26 * s, 12 * s); ctx.fillStyle = '#c7c1b3'; ctx.fillRect(x - 15 * s, y - 17 * s, 30 * s, 4 * s); ctx.fillRect(x - 15 * s, y - 4 * s, 30 * s, 3 * s);
    ctx.save(); ctx.translate(x, y - 34 * s); ctx.rotate(-0.5);
    drawPeixe(ctx, 0, 0, 1.6 * s, Object.assign({}, PEIXE.dourado, { cor: ['#f2c14e', '#d9822b'] })); ctx.restore();
    for (let k = 0; k < 3; k++) { const a = t / 400 + k * 2.1, bx = x + Math.cos(a) * 16 * s, by = y - 34 * s + Math.sin(a) * 10 * s; ctx.fillStyle = `rgba(255,236,150,${0.5 + 0.5 * Math.sin(t / 160 + k)})`; ctx.beginPath(); ctx.arc(bx, by, 1.6 * s, 0, 7); ctx.fill(); }
  } else if (id === 'arcoflores') {
    ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - 20 * s, y); ctx.lineTo(x - 20 * s, y - 34 * s); ctx.arc(x, y - 34 * s, 20 * s, Math.PI, 0); ctx.lineTo(x + 20 * s, y); ctx.stroke();
    const cores = ['#e53b2f', '#ffd54a', '#f06292', '#ffffff', '#ba68c8'];
    for (let k = 0; k <= 14; k++) { const f = k / 14; let fx, fy; if (f < 0.3) { fx = x - 20 * s; fy = y - f / 0.3 * 34 * s; } else if (f > 0.7) { fx = x + 20 * s; fy = y - (1 - f) / 0.3 * 34 * s; } else { const a = Math.PI + (f - 0.3) / 0.4 * Math.PI; fx = x + Math.cos(a) * 20 * s; fy = y - 34 * s + Math.sin(a) * 20 * s; }
      ctx.fillStyle = '#4f9a2f'; ctx.beginPath(); ctx.arc(fx + 2 * s, fy + 1 * s, 3 * s, 0, 7); ctx.fill(); ctx.fillStyle = cores[k % 5]; ctx.beginPath(); ctx.arc(fx, fy, 2.6 * s, 0, 7); ctx.fill(); }
  } else if (id === 'bolo') {
    ctx.fillStyle = '#b07a44'; ctx.fillRect(x - 18 * s, y - 16 * s, 3 * s, 16 * s); ctx.fillRect(x + 15 * s, y - 16 * s, 3 * s, 16 * s);
    ctx.fillStyle = '#fff4e0'; ctx.fillRect(x - 22 * s, y - 20 * s, 44 * s, 5 * s); ctx.fillStyle = '#e0463a'; for (let k = 0; k < 6; k++) ctx.fillRect(x - 22 * s + k * 8 * s, y - 20 * s, 4 * s, 5 * s);
    ctx.fillStyle = '#f8bbd0'; ctx.fillRect(x - 14 * s, y - 32 * s, 28 * s, 12 * s); ctx.strokeRect(x - 14 * s, y - 32 * s, 28 * s, 12 * s);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 9 * s, y - 42 * s, 18 * s, 10 * s); ctx.strokeRect(x - 9 * s, y - 42 * s, 18 * s, 10 * s);
    ctx.fillStyle = '#e53b2f'; for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(x + dx * s, y - 43 * s, 2 * s, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#4aa3df'; ctx.fillRect(x - 1 * s, y - 52 * s, 2 * s, 8 * s);
    ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.ellipse(x, y - 54 * s + Math.sin(t / 120) * 0.5 * s, 2 * s, 3.5 * s, 0, 0, 7); ctx.fill();
  }
}
const enfeiteIcon = id => makeIcon('enf3:' + id, () => drawEnfeite(id, 48, 88, ENFEITE[id] && ['arvore', 'colmeia'].includes(ENFEITE[id].fruteira) ? 1.1 : { bandeira: 1.15, espantalho: 1.3, moinho: 1.3, ipe: 1.2, fogueira: 1.5, balanco: 1.4, arcoflores: 1.4, peixedourado: 1.5, carrodeboi: 1.4 }[id] || 1.6, 0));

// ============================================================
// Pomar: frutíferas (arbustos e árvores) plantadas no gramado. Dão frutas de tempos em tempos
// e secam depois de uns dias. Arbusto seco sai com a enxada de arrancar; árvore seca, com a motosserra.
// As ferramentas de derrubar se compram na Loja › Pomar, ganham-se completando missões e vêm de amigos.
// ============================================================
const FERR_DERRUBAR = { enxada: { nome: 'Enxada de arrancar', emoji: '🌱', custo: 50, para: 'arbusto' }, motosserra: { nome: 'Motosserra', emoji: '⛓️', custo: 100, para: 'arvore' } };
function derrubarDe() { const d = state.derrubar || (state.derrubar = {}); d.enxada = d.enxada || 0; d.motosserra = d.motosserra || 0; return d; }
// Motosserra desenhada (o emoji de serra é um serrote): corpo laranja com alça, sabre cinza e a corrente.
function drawMotosserra(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.35); ctx.lineJoin = 'round';
  // sabre com a corrente
  ctx.fillStyle = '#b8c2ca'; ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(38, -6); ctx.arc(38, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-2, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#39424a'; for (let k = 0; k < 9; k++) { const cx = 2 + k * 4.4; ctx.beginPath(); ctx.moveTo(cx, -7.5); ctx.lineTo(cx + 2.2, -10.5); ctx.lineTo(cx + 3.6, -7.2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, 7.5); ctx.lineTo(cx + 2.2, 10.5); ctx.lineTo(cx + 3.6, 7.2); ctx.fill(); }
  ctx.strokeStyle = '#7d8a95'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(38, 0); ctx.stroke();
  // corpo do motor
  ctx.fillStyle = '#f07a1a'; ctx.strokeStyle = '#8a3f08'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.roundRect(-30, -14, 32, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2f2f2f'; ctx.beginPath(); ctx.roundRect(-24, -9, 16, 14, 3); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-22 + k * 4, -7); ctx.lineTo(-22 + k * 4, 3); ctx.stroke(); }
  // alça de cima e cabo de trás
  ctx.strokeStyle = '#2f2f2f'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, -14); ctx.quadraticCurveTo(-14, -30, -2, -14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-30, 2); ctx.lineTo(-40, 4); ctx.lineTo(-40, 12); ctx.lineTo(-28, 12); ctx.stroke();
  ctx.lineCap = 'butt'; ctx.restore();
}
// Enxada: cabo comprido de madeira e a lâmina larga de ferro, em ângulo reto com o cabo.
function drawEnxada(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(0.5); ctx.lineJoin = 'round';
  // cabo comprido de madeira
  ctx.fillStyle = '#b77a3e'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-3.5, -38, 7, 82, 3.5); ctx.fill(); ctx.stroke();
  // pescoço de ferro no alto do cabo e a lâmina larga dobrada para baixo, virada para o cabo (formato de "7")
  ctx.fillStyle = '#6c7780'; ctx.strokeStyle = '#2f363c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-5, -44, 18, 9, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#9aa6af';
  ctx.beginPath(); ctx.moveTo(9, -42); ctx.lineTo(19, -42); ctx.lineTo(34, -8); ctx.lineTo(14, -2); ctx.lineTo(8, -34); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e4eaee'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(31, -8); ctx.lineTo(16, -4); ctx.stroke(); // fio brilhando
  ctx.restore();
}
const ferrEmo = id => `<img class="emo" alt="" src="${ferramentaIcon(id)}">`;
const ferramentaIcon = id => id === 'motosserra' ? makeIcon('ferr:motosserra2', () => drawMotosserra(52, 54, 0.95)) : id === 'enxada' ? makeIcon('ferr:enxada4', () => drawEnxada(38, 54, 0.9)) : makeIcon('ferr:' + id, () => { ctx.font = '60px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(FERR_DERRUBAR[id].emoji, 48, 52); });
// Cada frutífera dá um número de colheitas (e.colheitas). Depois da última, seca: aí dá para pôr
// a placa de ajuda (um amigo que ajudar faz ela voltar a dar frutas) ou derrubar com a ferramenta.
// Domínio do pomar: cada colheita de frutífera dá pontos (árvore vale 2) e ajudar a de um amigo, 1.
// Cada nível dá mais frutas por colheita (+1 nos níveis 3, 5, 7 e 9) e mais colheitas antes de secar
// (+1 nos níveis 4, 7 e 10). Cada nível também dá trevos para resgatar.
const POMAR_NV = [0, 5, 12, 22, 35, 52, 75, 105, 145, 200];
function dominioPomar(est = state) {
  const xp = (est && est.pomarXP) || 0; let nv = 1;
  while (nv < POMAR_NV.length && xp >= POMAR_NV[nv]) nv++;
  return { nv, xp, ini: POMAR_NV[nv - 1], fim: POMAR_NV[nv], max: nv >= POMAR_NV.length, frutas: Math.floor((nv - 1) / 2), colheitas: [4, 7, 10].filter(n => nv >= n).length };
}
const rendeDe = e => e.rende + (isHome() ? dominioPomar().frutas : 0);
const colheitasDe = e => e.colheitas + (isHome() ? dominioPomar().colheitas : 0);
function ganharPomar(pts) {
  const antes = dominioPomar().nv; state.pomarXP = (state.pomarXP || 0) + pts;
  const d = dominioPomar();
  if (d.nv > antes) { sfx('level'); toast(`🌳 Domínio do pomar nível ${d.nv}! ${d.frutas ? `+${d.frutas} fruta${d.frutas > 1 ? 's' : ''} por colheita · ` : ''}${colheitasDe(ENFEITE.pitangueira)} colheitas antes de secar. Resgate os trevos em Missões › Trevos.`, 'good'); renderTabs(); }
}
function dominioPomarHTML() {
  const d = dominioPomar(), pct = d.max ? 100 : Math.round((d.xp - d.ini) / (d.fim - d.ini) * 100);
  return `<div class="dominio"><span class="dnv">🌳 Domínio do pomar <b>Nv ${d.nv}</b></span><span class="dbar"><i style="width:${pct}%"></i></span>
    ${pomarAResgatar().length ? `<button class="btn gold dresg" type="button" data-trevo-pomar="1">Resgatar 🍀${pomarAResgatar().reduce((t, n) => t + (TREVO_DOMINIO[n] || 0), 0)}</button>` : ''}
    <span class="dinfo">+${d.frutas} fruta${d.frutas === 1 ? '' : 's'} por colheita · ${colheitasDe(ENFEITE.pitangueira)} colheitas antes de secar${d.max ? ' · máximo!' : ` · ${d.fim - d.xp} pts p/ Nv ${d.nv + 1} (colher arbusto 1, árvore 2, ajudar amigo 1)`}</span></div>`;
}
// Colhe uma frutífera sua que está pronta (toque nela ou colheita automática). Devolve quantas frutas deu.
function colherFruteira(o) {
  const e = ENFEITE[o.id], f = FRUTA[e.fruta], rende = rendeDe(e);
  state.barn[f.id] = (state.barn[f.id] || 0) + rende;
  for (let k = 0; k < rende; k++) collect(f.id, null);
  o.ult = Date.now(); o.colhidas = (o.colhidas || 0) + 1; state.stats.colheitas = (state.stats.colheitas || 0) + 1; track('colher');
  addXP(['arvore', 'colmeia'].includes(e.fruteira) ? 6 : 3, null);
  if (o.colhidas >= colheitasDe(e)) { o.seca = 1; if (!o.ajudada) avisarSecou(o); }
  ganharPomar(['arvore', 'colmeia'].includes(e.fruteira) ? 2 : 1);
  return rende;
}
// Frutíferas suas (roça e rancho) prontas para colher.
const fruteirasProntas = () => ['roca', 'animais'].flatMap(sc => objetosDe(state, sc).filter(o => o && ENFEITE[o.id] && ENFEITE[o.id].fruteira && estadoFruteira(o).pronto));
function estadoFruteira(o) {
  const e = ENFEITE[o.id], agora = Date.now(), t0 = o.t0 || agora, ult = o.ult || t0;
  const restam = o.seca ? 0 : Math.max(isHome() ? 0 : 1, colheitasDe(e) - (o.colhidas || 0)), morta = restam <= 0, pronto = !morta && agora - ult >= e.tempo * 1000;
  const falta = Math.max(0, ult + e.tempo * 1000 - agora);
  const f = FRUTA[e.fruta], resto = `${restam} colheita${restam > 1 ? 's' : ''} até secar`;
  const txt = morta ? (o.ajudada ? `Secou 🥀 de vez: já foi ajudada uma vez, não dá mais pra reviver. Derrube com ${['arvore', 'colmeia'].includes(e.fruteira) ? 'a motosserra' : 'a enxada de arrancar'}.`
      : isHome() ? 'Secou 🥀 · seus amigos foram avisados: quando um ajudar, ela dá frutas mais uma vez 🤝'
      : 'Secou 🥀 · precisa de ajuda! Toque para ajudar 🤝')
    : pronto ? `Pronta! ${rendeDe(e)} ${f.nome.toLowerCase()}s para colher · ${resto}`
    : `Próxima colheita em ${fmt(falta / 1000)} · ${resto}`;
  return { morta, pronto, falta, restam, txt };
}
// Frutífera seca pela primeira vez (ainda não ajudada): os amigos podem ajudar.
const secaDe = (o, s) => !!(o && ENFEITE[o.id] && ENFEITE[o.id].fruteira && (o.seca || (o.colhidas || 0) >= ENFEITE[o.id].colheitas + dominioPomar(s).colheitas));
const precisaAjuda = (o, s) => secaDe(o, s) && !o.ajudada;
// Frutíferas dos amigos (na roça e no rancho) com a placa de ajuda.
const pedidosAjuda = s => ['roca', 'animais'].reduce((n, sc) => n + (s && s.objetos && Array.isArray(s.objetos[sc]) ? s.objetos[sc] : []).filter(o => precisaAjuda(o, s)).length, 0);
// Põe a placa e avisa todos os amigos (aviso no celular e o botão "Precisa de ajuda" na lista de amigos).
function pedirAjudaFruteira(sc, i) {
  const o = objetosDe(state, sc)[i]; if (!o || !estadoFruteira(o).morta || o.ajudada) return;
  avisarSecou(o); sfx('buy');
  const e = ENFEITE[o.id];
  done();
  toast(state.friends.length ? `🔔 Seus amigos foram avisados de novo. Quando um ajudar, ${e.nome.toLowerCase()} dá frutas mais uma vez.` : 'Você ainda não tem amigos: adicione alguém em Amigos para ele poder ajudar.', 'good');
}
// Secou pela primeira vez: põe a placa AJUDA sozinha e avisa os amigos.
function avisarSecou(o) {
  const e = ENFEITE[o.id];
  o.seca = 1; o.placa = o.placa || Date.now(); o.fid = o.fid || newId();
  for (const uid of state.friends) avisarAmigo(uid, 'ajuda', `${meuApelido()} precisa de ajuda: ${e.nome.toLowerCase()} secou no pomar 🥀 Passe lá para ajudar!`);
  if (user) cloudSave();
}
function derrubarFruteira(sc, i) {
  const o = objetosDe(state, sc)[i]; if (!o) return;
  const e = ENFEITE[o.id], fer = ['arvore', 'colmeia'].includes(e.fruteira) ? 'motosserra' : 'enxada', F = FERR_DERRUBAR[fer], d = derrubarDe();
  if (!d[fer]) { toast(`Precisa de ${F.emoji} ${F.nome.toLowerCase()} para derrubar: compre na Loja › Pomar, ganhe completando as missões ou peça a um amigo.`, 'bad'); return openPanel('loja', 'pomar'); }
  d[fer]--; const l = objetosDe(state, sc); l.splice(i, 1); state.objetos[sc] = l;
  sfx('water'); toast(`${F.emoji} ${e.nome} derrubada. O lugar ficou livre para plantar outra!`, 'good'); done();
}
// Menu da frutífera seca: pedir ajuda ou derrubar.
function menuFruteira(sc, i) {
  const o = objetosDe(state, sc)[i]; if (!o) return;
  const e = ENFEITE[o.id], fer = ['arvore', 'colmeia'].includes(e.fruteira) ? 'motosserra' : 'enxada', F = FERR_DERRUBAR[fer], m = $('#ctxMenu'), q = iso(o.u, o.v);
  m.innerHTML = `<b>${esc(e.nome)} secou 🥀</b>${o.ajudada ? '<span class="meta" style="display:block;margin:2px 0 6px">Secou de vez: já foi ajudada uma vez</span>'
    : '<span class="meta" style="display:block;margin:2px 0 6px">Esperando um amigo ajudar 🤝</span><button type="button" data-ctx="placa">🔔 Avisar os amigos de novo</button>'}<button type="button" data-ctx="derrubar">${ferrEmo(fer)} Derrubar (você tem ${derrubarDe()[fer]})</button><button type="button" data-ctx="fechar">Cancelar</button>`;
  m.dataset.key = 'enf:' + i; m.dataset.sc = sc; m.hidden = false;
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = `${clamp(q.x - w / 2, 6, L.cw - w - 6)}px`; m.style.top = `${clamp(q.y - L.W * 0.5 - h, 6, L.ch - h - 6)}px`;
  sfx('click');
}
function tipFruteira(o) {
  const e = ENFEITE[o.id], st = estadoFruteira(o);
  return `<b>${e.nome}</b><br>${st.txt}${st.morta && isHome() ? `<br>Você tem ${derrubarDe()[['arvore', 'colmeia'].includes(e.fruteira) ? 'motosserra' : 'enxada']}.` : ''}`;
}
function actFruteira(sc, i) {
  const o = objetosDe(S(), sc)[i]; if (!o) return;
  const e = ENFEITE[o.id], st = estadoFruteira(o), f = FRUTA[e.fruta];
  if (!isHome()) {
    if (st.morta && !o.ajudada && view.kind === 'friend') {
      // ajudar a frutífera do amigo: não conta no limite do dia. Só pode ser ajudada uma vez na vida:
      // depois dessa, rende só mais 1 colheita e seca de vez (sem poder pedir ajuda de novo).
      const key = visitKey('fr:' + (o.fid || i) + ':ajuda');
      if (state.log[key]) return toast('Você já ajudou esta. Obrigado! 🤝');
      state.log[key] = Date.now();
      const q = iso(o.u, o.v), pos = { x: q.x, y: q.y - L.W * 0.4 };
      o.placa = 0; o.seca = 0; o.ajudada = 1; o.colhidas = Math.max(0, (o.colhidas || 0) - 1); o.ult = Date.now();
      help(pos); ganharPomar(1); addXP(3, pos); sfx('level'); popupAt(pos, 'Reviveu! 🌱', '#8fd16a');
      sendVisit({ t: 'help', what: 'fruteira', sc, fid: o.fid || '', idx: i });
      toast(`🤝 Você ajudou ${view.nome}: ${e.nome.toLowerCase()} vai dar fruta mais uma vez antes de secar de vez!`, 'good');
      return done();
    }
    if (st.pronto) {
      const key = visitKey('fr:' + (o.fid || i)), lim = stealLimit();
      if (alreadyTook(o, key)) return toast('Você já pegou daqui. Não exagere!');
      if (lim.roca >= STEAL_MAX.roca) return toast(`Você já pegou ${STEAL_MAX.roca} itens da plantação e do pomar de ${view.nome} hoje. À meia-noite libera de novo!`);
      const q = iso(o.u, o.v), pos = { x: q.x, y: q.y - L.W * 0.4 };
      lim.roca++; state.log[key] = Date.now();
      if (guarded(sc, pos, { t: 'stealF', sc, fid: o.fid || '', idx: i })) return done();
      sfx('harvest'); gain(f.id, 1, pos); state.stats.roubado++; addXP(1, pos); track('pegar');
      sendVisit({ t: 'stealF', sc, fid: o.fid || '', idx: i });
      toast(`🧺 Pegou 1 ${f.nome.toLowerCase()} do pomar de ${view.nome}!`, 'good');
      return done();
    }
    return toast(`${e.nome} de ${view.nome}: ${st.morta ? (o.ajudada ? 'secou de vez.' : 'secou e está pedindo ajuda.') : st.txt}`);
  }
  if (st.pronto) {
    const rende = colherFruteira(o); sfx('collect');
    const max = colheitasDe(e), acabou = !!o.seca, resta = max - o.colhidas;
    toast(`🧺 +${rende} ${f.nome.toLowerCase()}s no celeiro!${acabou ? ` ${o.ajudada ? `Foi a última: ${e.nome.toLowerCase()} secou de vez. Agora é derrubar e plantar outra.` : `${e.nome} secou 🥀: seus amigos foram avisados. Se um ajudar, ela dá frutas mais uma vez.`}` : ` Falta${resta > 1 ? 'm' : ''} ${resta} colheita${resta > 1 ? 's' : ''}.`}`, 'good');
    return done();
  }
  if (st.morta) return menuFruteira(sc, i);
  toast(`${e.nome}: ${st.txt}`);
}
function drawFruta(id, x, y, s) {
  const f = FRUTA[id]; ctx.lineWidth = Math.max(1, 0.5 * s); ctx.strokeStyle = 'rgba(0,0,0,.25)';
  const bola = (dx, dy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(x + (dx - r * 0.35) * s, y + (dy - r * 0.35) * s, r * 0.3 * s, 0, 7); ctx.fill(); };
  if (id === 'manga') { ctx.fillStyle = '#f2a030'; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 5 * s, 6.5 * s, 0.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(200,60,30,.5)'; ctx.beginPath(); ctx.ellipse(x + 2 * s, y - 1 * s, 2.5 * s, 3.5 * s, 0.5, 0, 7); ctx.fill(); }
  else if (id === 'caju') { ctx.fillStyle = '#e8502a'; ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 4.5 * s, 5.5 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.ellipse(x, y + 7.5 * s, 2.2 * s, 1.8 * s, 0, 0, 7); ctx.fill(); }
  else if (id === 'maracuja') bola(0, 1, 5.5, f.cor);
  else if (id === 'pequi') bola(0, 1, 5.5, f.cor);
  else if (id === 'framboesa' || id === 'amora') {
    // frutinha feita de bolinhas (drupas): framboesa redondinha e vermelha; amora comprida e roxa-escura
    const pts = id === 'amora' ? [[0, -4], [-1.4, -2], [1.4, -2], [0, 0], [-1.4, 2], [1.4, 2], [0, 4]] : [[0, -2.6], [-2, -1], [2, -1], [0, 0.4], [-2, 1.8], [2, 1.8], [0, 3]];
    for (const [dx, dy] of pts) bola(dx, dy + 1, 1.7, f.cor);
  } else if (id === 'pitanga') {
    bola(0, 1, 4.6, f.cor); ctx.strokeStyle = 'rgba(120,20,10,.45)'; ctx.lineWidth = 0.6 * s;
    for (const a of [-0.9, -0.3, 0.3, 0.9]) { ctx.beginPath(); ctx.ellipse(x + a * 3 * s, y + 1 * s, 1.2 * s, 4.2 * s, 0, 0, 7); ctx.stroke(); }
  }
  else if (id === 'morango') {
    ctx.fillStyle = f.cor; ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.quadraticCurveTo(x + 5 * s, y, x, y + 6 * s); ctx.quadraticCurveTo(x - 5 * s, y, x, y - 3 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2d84a'; for (const [dx, dy] of [[-1.8, 0], [1.8, 0.5], [-1.2, 3], [1.2, 3.2], [0, 1.6]]) { ctx.beginPath(); ctx.ellipse(x + dx * s, y + dy * s, 0.5 * s, 0.8 * s, 0, 0, 7); ctx.fill(); }
  }
  else if (id === 'uva') for (const [dx, dy] of [[-2, -2], [2, -2], [0, -0.5], [-2.6, 1.5], [2.6, 1.5], [0, 2.5], [-1, 4.5], [1, 4.5]]) bola(dx, dy, 1.7, f.cor);
  else if (id === 'banana') {
    ctx.strokeStyle = f.cor; ctx.lineWidth = 3.2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + 2 * s, y + 8 * s, 7 * s, 3.7, 5.3); ctx.stroke(); ctx.lineCap = 'butt';
  }
  else if (id === 'coco') { bola(0, 1.5, 5.5, '#5a4230'); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.5 * s; for (const a of [0, 1.2, 2.4, 3.6, 4.8]) { ctx.beginPath(); ctx.moveTo(x, y + 1.5 * s); ctx.lineTo(x + Math.cos(a) * 5 * s, y + 1.5 * s + Math.sin(a) * 5 * s); ctx.stroke(); } }
  else for (const [dx, dy] of [[-2.5, 2], [2.5, 2], [0, -1.5]]) bola(dx, dy, id === 'jabuticaba' ? 2.8 : 2.5, f.cor);
  ctx.fillStyle = '#4f9a2f'; ctx.beginPath(); ctx.ellipse(x + 2 * s, y - 5 * s, 2.6 * s, 1.2 * s, -0.5, 0, 7); ctx.fill();
}
// A frutífera no chão: arbusto redondinho ou árvore com tronco. Pronta = cheia de frutas; seca = galhos pelados.
function drawFruteira(o, x, y, s, t, home) {
  const e = ENFEITE[o.id], st = o.t0 || o.ult || o.seca || o.colhidas != null ? estadoFruteira(o) : { pronto: true, morta: false }, f = FRUTA[e.fruta], arv = ['arvore', 'colmeia'].includes(e.fruteira);
  const seca = st.morta, pronto = st.pronto && !seca, sway = Math.sin(t / 900 + x * 0.03) * 0.6 * s;
  const bola = (cx, cy, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + cx * s, y + cy * s, r * s, 0, 7); ctx.fill(); };
  const tronco = (pts, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)); ctx.stroke(); ctx.lineCap = 'butt'; };
  const fruta = (cx, cy, k = 0.5) => drawFruta(e.fruta, x + cx * s, y + cy * s, s * k);
  const cinza = '#9a8a5a', galho = seca ? '#7a6a5a' : '#6b4a2a';
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y, (arv ? 30 : 22) * s, (arv ? 9 : 7) * s, 0, 0, 7); ctx.fill();
  switch (o.id) {
    case 'framboeseira': { // hastes compridas e arqueadas, folhinhas serrilhadas, framboesas nas pontas
      const hastes = [[-16, -22], [-8, -30], [2, -33], [11, -28], [17, -20]];
      for (const [hx, hy] of hastes) {
        ctx.strokeStyle = seca ? '#8a7a5a' : '#8a4a3a'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x, y - 1 * s); ctx.quadraticCurveTo(x + hx * 0.3 * s, y + (hy - 6) * s, x + hx * s + sway, y + hy * 0.6 * s); ctx.stroke();
        if (!seca) for (const k of [0.45, 0.75]) { const lx = x + hx * k * s + sway * k, ly = y + hy * (k < 0.6 ? 0.85 : 0.75) * s; leaf(lx, ly, 7 * s, 3 * s, hx > 0 ? 0.9 : -0.9, k < 0.6 ? '#4f8a33' : '#6aa844'); }
        if (pronto) fruta(hx + sway / s, hy * 0.6 + 2, 0.45);
      }
      break;
    }
    case 'amoreira': { // arbusto mais alto e irregular, verde-escuro, cachinhos de amora
      for (const [cx, cy, r, c] of [[-11, -12, 9, '#2f6a22'], [10, -14, 10, '#2f6a22'], [-2, -24, 11, '#3a7a2a'], [-12, -24, 7, '#3a7a2a'], [11, -27, 7, '#44882f'], [0, -33, 7, '#4f9434']]) bola(cx + sway / s * (cy < -20 ? 1 : 0.4), cy, r, seca ? cinza : c);
      if (seca) tronco([[0, 0], [-3, -18], [-9, -26]], 1.6, galho);
      if (pronto) for (const [cx, cy] of [[-10, -12], [8, -16], [-2, -26], [11, -26], [-12, -22], [2, -9]]) fruta(cx, cy, 0.42);
      break;
    }
    case 'maracujazeiro': { // espaldeira de madeira com a rama subindo, flores e maracujás pendurados
      tronco([[-18, 0], [-18, -30]], 2.4, '#8a5a33'); tronco([[18, 0], [18, -30]], 2.4, '#8a5a33');
      ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 0.8 * s; for (const h of [-29, -18]) { ctx.beginPath(); ctx.moveTo(x - 18 * s, y + h * s); ctx.lineTo(x + 18 * s, y + h * s); ctx.stroke(); }
      tronco([[0, 0], [-3, -12], [0, -20], [-8, -26], [-17, -29]], 1.4, seca ? '#8a7a5a' : '#4f7a2a');
      tronco([[0, -20], [9, -25], [17, -29]], 1.4, seca ? '#8a7a5a' : '#4f7a2a');
      if (!seca) {
        for (const [lx, ly, a] of [[-14, -30, -0.4], [-6, -28, 0.3], [5, -27, -0.3], [13, -31, 0.4], [-2, -16, -1], [3, -10, 1], [-11, -19, 0.2], [11, -19, -0.2]]) leaf(x + lx * s, y + ly * s, 7 * s, 3.4 * s, a, '#4f9a3a');
        for (const [fx, fy] of [[-10, -31], [8, -32]]) { bola(fx, fy, 2.4, '#f4f1ea'); bola(fx, fy, 1.1, '#7a4aa0'); }
        if (pronto) for (const fx of [-12, 1, 12]) { tronco([[fx, -28], [fx, -23]], 0.6, '#4f7a2a'); fruta(fx, -19, 0.5); }
      }
      break;
    }
    case 'pitangueira': { // arvorezinha de copa cheia de folhinhas miúdas, pitangas vermelhas
      tronco([[0, 0], [-1, -18]], 4, galho); tronco([[-1, -14], [-9, -22]], 2, galho); tronco([[-1, -16], [8, -24]], 2, galho);
      if (!seca) for (let k = 0; k < 16; k++) { const a = k * 2.4, r = 5 + (k % 4) * 3.4; bola(Math.cos(a) * r * 1.3 + sway / s, -30 + Math.sin(a) * r * 0.8, 5.2, ['#2f6a22', '#3a7a2a', '#44882f', '#4f9434'][k % 4]); }
      if (pronto) for (const [cx, cy] of [[-12, -28], [-4, -36], [7, -34], [13, -26], [0, -24], [-8, -20]]) fruta(cx, cy, 0.42);
      break;
    }
    case 'jabuticabeira': { // vários tronquinhos lisos saindo do chão; a fruta nasce no tronco!
      for (const [bx, tx] of [[-5, -12], [0, 0], [5, 12]]) tronco([[bx, 0], [tx * 0.6, -26], [tx, -36]], 3.2, seca ? '#8a7a6a' : '#9a7a5a');
      if (!seca) for (const [cx, cy, r] of [[-14, -42, 12], [14, -44, 13], [0, -52, 14], [-5, -40, 10], [7, -40, 10]]) bola(cx + sway / s, cy, r, '#3f7a2a');
      if (pronto) for (let k = 0; k < 14; k++) { const tr = [-1, 0, 1][k % 3]; bola(tr * 4 + tr * (k / 14) * 6 + (k % 2 ? 1.6 : -1.6), -4 - k * 1.9, 1.9, f.cor); }
      break;
    }
    case 'mangueira': { // tronco grosso e uma copa enorme, bem fechada
      tronco([[0, 0], [0, -24]], 7, galho); tronco([[0, -20], [-10, -30]], 3, galho); tronco([[0, -22], [11, -32]], 3, galho);
      if (!seca) { ctx.fillStyle = '#245a1a'; ctx.beginPath(); ctx.ellipse(x + sway, y - 42 * s, 30 * s, 20 * s, 0, 0, 7); ctx.fill(); bola(-12, -48, 13, '#2f6a22'); bola(10, -50, 14, '#2f6a22'); bola(0, -56, 12, '#3a7a2a'); }
      if (pronto) for (const [cx, cy] of [[-18, -32], [-6, -30], [8, -31], [19, -35], [0, -40]]) { tronco([[cx, cy - 5], [cx, cy - 1]], 0.6, '#3f5a2a'); fruta(cx, cy + 3, 0.55); }
      break;
    }
    case 'cajueiro': { // tronco torto e baixo, copa larga e esparramada
      tronco([[0, 0], [4, -10], [-2, -18], [3, -24]], 5, galho); tronco([[-2, -18], [-18, -26]], 2.6, galho); tronco([[3, -22], [20, -28]], 2.6, galho);
      if (!seca) for (const [cx, cy, r] of [[-22, -30, 9], [-10, -34, 11], [4, -36, 12], [18, -33, 10], [26, -29, 7], [-26, -26, 6]]) bola(cx + sway / s, cy, r, cx % 2 ? '#3f7a2a' : '#4f8a2f');
      if (pronto) for (const [cx, cy] of [[-18, -24], [-5, -26], [10, -27], [22, -24]]) fruta(cx, cy + 2, 0.55);
      break;
    }
    case 'pequizeiro': { // árvore do cerrado: tronco retorcido e casca grossa, copa em tufos
      tronco([[0, 0], [-4, -10], [2, -20], [-2, -28]], 5.5, seca ? '#7a6a5a' : '#5a4230');
      tronco([[2, -20], [16, -30], [22, -40]], 2.6, seca ? '#7a6a5a' : '#5a4230'); tronco([[-2, -26], [-16, -36]], 2.6, seca ? '#7a6a5a' : '#5a4230');
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.8 * s; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x + (-3 + k) * s, y - k * 5 * s); ctx.lineTo(x + (-1 + k) * s, y - (k * 5 + 3) * s); ctx.stroke(); }
      if (!seca) for (const [cx, cy, r] of [[-18, -40, 9], [-6, -36, 7], [4, -44, 10], [20, -44, 9], [12, -34, 6]]) bola(cx + sway / s, cy, r, '#5a8a3a');
      if (pronto) for (const [cx, cy] of [[-16, -32], [2, -36], [18, -36]]) fruta(cx, cy + 2, 0.5);
      break;
    }
    case 'morangueiro': { // moita rasteira de folhas em roseta, morangos entre as folhas
      for (const [cx, cy, a] of [[-9, -6, -0.6], [8, -8, 0.6], [-2, -12, 0], [10, -3, 1.1], [-11, -1, -1.1], [1, -4, 0.2]]) leaf(x + cx * s, y + cy * s, 8 * s, 5 * s, a, seca ? cinza : '#4f9434');
      if (pronto) for (const [cx, cy] of [[-8, -3], [7, -5], [0, -8], [-3, 1], [4, 0]]) fruta(cx, cy, 0.4);
      break;
    }
    case 'videira': { // espaldeira baixa com folhas largas e cachos de uva pendurados
      tronco([[-16, 0], [-16, -22]], 2.2, '#8a5a33'); tronco([[16, 0], [16, -22]], 2.2, '#8a5a33');
      ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 0.8 * s; ctx.beginPath(); ctx.moveTo(x - 16 * s, y - 22 * s); ctx.lineTo(x + 16 * s, y - 22 * s); ctx.stroke();
      tronco([[0, 0], [-4, -10], [0, -20], [sway / s, -22]], 1.6, seca ? '#8a7a5a' : '#4f7a2a');
      if (!seca) for (const [lx, ly, a] of [[-12, -22, -0.5], [-3, -24, 0.2], [7, -23, -0.2], [14, -21, 0.5], [-8, -14, -0.8], [4, -12, 0.6]]) leaf(x + lx * s, y + ly * s, 7.5 * s, 4 * s, a, '#4f9a3a');
      if (pronto) for (const cx of [-9, 2, 12]) fruta(cx + sway / s, -14, 0.55);
      break;
    }
    case 'macieira': case 'laranjeira': case 'goiabeira': { // árvore de copa redonda e cheia, tronco curto
      tronco([[0, 0], [0, -20]], 5.5, galho); tronco([[0, -16], [-8, -26]], 2.4, galho); tronco([[0, -18], [9, -27]], 2.4, galho);
      if (!seca) { ctx.fillStyle = e.copa; ctx.beginPath(); ctx.ellipse(x + sway, y - 34 * s, 24 * s, 17 * s, 0, 0, 7); ctx.fill(); bola(-10, -38, 10, e.copa); bola(9, -39, 11, e.copa); bola(0, -46, 9, '#4fa83a'); }
      if (pronto) for (const [cx, cy] of [[-15, -28], [-4, -34], [7, -32], [15, -26], [0, -22]]) fruta(cx, cy + 2, 0.5);
      break;
    }
    case 'bananeira': { // pseudocaule com folhas grandes tipo pá, cacho de bananas
      tronco([[0, 0], [0, -30]], 5, seca ? galho : '#7f9a4a');
      if (!seca) for (const [a, len] of [[-1.3, 1], [-0.6, 1.15], [0.15, 1], [0.85, 1.15], [1.4, 0.9]]) {
        const tx = x, ty = y - 30 * s;
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(a + sway / (18 * s));
        ctx.fillStyle = a > 0 ? '#5cb04a' : '#4a9a3a'; ctx.beginPath(); ctx.ellipse(0, -12 * s * len, 6.5 * s, 14 * s * len, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (pronto) for (const [cx, cy] of [[3, -18], [5, -14], [3, -10]]) fruta(cx, cy, 0.45);
      break;
    }
    case 'coqueiro': { // tronco alto e fino inclinado, copa de palmas no topo, cocos no cacho
      const topx = 8, topy = -46;
      tronco([[0, 0], [4, -22], [topx, topy]], 3.4, seca ? galho : '#9a7a52');
      if (!seca) for (const a of [-2.6, -2, -1.4, -0.8, -0.2, 0.4]) {
        ctx.save(); ctx.translate(x + topx * s, y + topy * s); ctx.rotate(a + sway / (26 * s));
        ctx.fillStyle = a < -1.4 ? '#4fa83a' : '#3a8a2c'; ctx.beginPath(); ctx.ellipse(0, -13 * s, 3.4 * s, 15 * s, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (pronto) for (const [cx, cy] of [[topx - 4, topy + 6], [topx + 3, topy + 7], [topx - 1, topy + 9]]) fruta(cx, cy, 0.5);
      break;
    }
    default: {
      bola(0, -12, 12, seca ? cinza : e.copa || '#4f9a2f');
      if (pronto) fruta(0, -12, 0.5);
    }
  }
  if (seca && arv && o.id !== 'jabuticabeira') for (const [dx, dy] of [[-16, -44], [16, -46], [3, -54]]) { ctx.strokeStyle = '#7a6a5a'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(x + dx * 0.7 * s, y + dy * 0.8 * s); ctx.lineTo(x + dx * s, y + dy * s - 5 * s); ctx.stroke(); }
  if (seca && !arv && o.id === 'framboeseira') { /* as hastes já ficam secas */ }
  // placa de ajuda fincada do lado
  if (seca && !o.ajudada) {
    const px = x + (arv ? 22 : 18) * s, py = y + 2 * s;
    ctx.fillStyle = '#7a4a22'; ctx.fillRect(px - 1.5 * s, py - 24 * s, 3 * s, 24 * s);
    ctx.fillStyle = '#e8c07a'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.roundRect(px - 13 * s, py - 32 * s, 26 * s, 12 * s, 2 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b3261e'; ctx.font = `800 ${Math.round(7 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AJUDA!', px, py - 25.6 * s); ctx.textBaseline = 'alphabetic';
  }
  // balãozinho em cima: pronta (cesta), seca (ferramenta) ou, na roça do amigo, pedindo ajuda (🤝)
  if (!home && st.morta && !o.ajudada && view.kind === 'friend') {
    const pu = 0.5 + 0.5 * Math.sin(t / 300);
    ctx.strokeStyle = `rgba(230,70,40,${0.5 + pu * 0.4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, (arv ? 34 : 26) * s * (1 + pu * 0.15), (arv ? 11 : 9) * s * (1 + pu * 0.15), 0, 0, 7); ctx.stroke();
    const by = y - (arv ? 72 : 36) * s + Math.sin(t / 250) * 3 * s, r = 10 * s;
    ctx.fillStyle = '#fff3c4'; ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, by, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.font = `${Math.round(12 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤝', x, by + 0.5); ctx.textBaseline = 'alphabetic';
  }
  if (home && o.t0 && (st.pronto || st.morta)) {
    const by = y - (arv ? 72 : 36) * s + Math.sin(t / 300) * 2 * s, r = 9 * s;
    ctx.fillStyle = 'rgba(255,253,242,.95)'; ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, by, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.font = `${Math.round(11 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(st.morta ? (o.ajudada ? '🪓' : '🪧') : '🧺', x, by + 0.5); ctx.textBaseline = 'alphabetic';
  }
}
function pomarLojaHTML() {
  const d = derrubarDe();
  let html = dominioPomarHTML() + `<p class="hint">Plante frutíferas no gramado da roça ou do rancho (fora dos canteiros). Dá para ter até ${LIMITE_FRUTEIRA.arbusto} de cada arbusto e ${LIMITE_FRUTEIRA.arvore} de cada árvore (derrube uma seca para comprar outra). Cada uma dá ${colheitasDe(ENFEITE.pitangueira)} colheitas e depois seca. Seca, você escolhe: pôr a 🪧 placa de ajuda (todos os seus amigos são avisados e, quando um ajudar, ela volta a dar frutas) ou derrubar (arbusto com a <img class="emo" alt="" src="${ferramentaIcon('enxada')}"> enxada de arrancar; árvore com a <img class="emo" alt="" src="${ferramentaIcon('motosserra')}"> motosserra). Ganhe as ferramentas completando todas as missões (dia: enxada, semana: motosserra), de presente de amigos ou compre aqui.</p>`;
  html += `<h3>Ferramentas de derrubar</h3>`;
  for (const [id, F] of Object.entries(FERR_DERRUBAR)) html += `<div class="row"><img alt="" src="${ferramentaIcon(id)}"><div><div class="name">${F.nome}</div><div class="meta">Tira um${F.para === 'arvore' ? 'a árvore' : ' arbusto'} seco · você tem <b>${d[id]}</b></div></div>
    <button class="btn" data-comprar-ferr="${id}" ${state.coins < F.custo ? 'disabled' : ''}>${moeda(F.custo)}</button></div>`;
  for (const [tipo, titulo] of [['arbusto', 'Arbustos'], ['arvore', 'Árvores'], ['colmeia', 'Colmeias']]) {
    html += `<h3>${titulo}</h3>`;
    for (const e of ENFEITES.filter(x => x.fruteira === tipo)) {
      const f = FRUTA[e.fruta], locked = e.nivel > state.level, tem = state.enfeites[e.id] || 0, lim = LIMITE_FRUTEIRA[e.fruteira], ja = fruteirasDe(e.id), cheio = ja >= lim;
      html += `<div class="row ${locked ? 'locked' : ''}"><img alt="" src="${enfeiteIcon(e.id)}"><div><div class="name">${e.nome}</div>
        <div class="meta">${rendeDe(e)} ${f.nome.toLowerCase()}s (vale ${f.preco}) a cada ${fmt(e.tempo)} · ${colheitasDe(e)} colheitas: rende ${(rendeDe(e) * f.preco * colheitasDe(e)).toLocaleString('pt-BR')} moedas (${(rendeDe(e) * f.preco * colheitasDe(e) / e.custo).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}× o preço)<br>Você tem <b>${ja} de ${lim}</b>${tem ? ` (${tem} no inventário)` : ''}</div></div>
        ${tem ? botaoEnfeiteLoja(e, !locked && !cheio) : locked ? `<button class="btn" disabled>Nível ${e.nivel}</button>` : cheio ? `<button class="btn" disabled data-fruteira-cheia="${e.id}">Limite ${lim}</button>` : botaoEnfeiteLoja(e)}</div>`;
    }
  }
  return html;
}
function comprarFerramenta(id) {
  const F = FERR_DERRUBAR[id]; if (!F) return;
  if (state.coins < F.custo) return toast(`${F.nome} custa ${F.custo} moedas.`, 'bad');
  state.coins -= F.custo; derrubarDe()[id]++; sfx('buy'); toast(`${F.emoji} +1 ${F.nome.toLowerCase()}!`, 'good'); done();
}

// ============================================================
// Caçada 🎯: um modo de jogo parecido com a pesca. Tem lugares para caçar (liberam por nível e se
// compram), armas (estilingue e espingarda, com munição), a arapuca, o Livro da caçada e o domínio.
// Pragas (rato, pombo, pardal, lebre-europeia, javali…) se caçam com estilingue ou espingarda e dão
// recompensa (e carne, no caso do javali). Os bichos nativos só caem na arapuca: são registrados no
// livro e soltos de volta no mato. O lendário é o Chupa-cabra: aparece na serra e na chapada, mais à noite.
// ============================================================
const CACA_NIVEL = 10, CACA_MS = 2 * 3600e3, ARAPUCA_MS = 4 * 3600e3;
const cacaPorVez = () => 3;
const LUGARES_CACA = [
  { id: 'capoeira', nome: 'Capoeira do fundo',     emoji: '🌿', nivel: 10, custo: 0,     sorte: 1,   chao: '#86c050', mato: '#3f8a2a', morro: '#9ccf6a' },
  { id: 'mata',     nome: 'Mata ciliar',           emoji: '🌳', nivel: 12, custo: 2500,  sorte: 1.3, chao: '#6fae44', mato: '#2f6f22', morro: '#7fb85a' },
  { id: 'cerrado',  nome: 'Cerrado',               emoji: '🌾', nivel: 15, custo: 6000,  sorte: 1.6, chao: '#bdb466', mato: '#7a8a3a', morro: '#c9b877' },
  { id: 'serra',    nome: 'Serra Dourada',         emoji: '⛰️', nivel: 20, custo: 12000, sorte: 2,   chao: '#c8a466', mato: '#6a7a3a', morro: '#b89a6a' },
  { id: 'chapada',  nome: 'Chapada dos Veadeiros', emoji: '🏞️', nivel: 28, custo: 25000, sorte: 2.6, chao: '#a8a456', mato: '#4a6a2a', morro: '#9a8a6a' },
];
const LUGAR_CACA = Object.fromEntries(LUGARES_CACA.map(l => [l.id, l]));
// lug = a partir de qual lugar aparece (0 = capoeira… 4 = chapada)
const CACA_BICHOS = [
  // pragas: estilingue (pequenas) e espingarda (grandes)
  { id: 'rato',       nome: 'Rato do paiol',   raro: 'comum',    praga: true, armas: ['estilingue'], nivel: 10,  lug: 0, forma: 'rato',  cor: '#8a8078', tam: 0.7,  vel: 1.1, hp: 1, moedas: 25,  peso: 10 },
  { id: 'pombo',      nome: 'Pombo',           raro: 'comum',    praga: true, armas: ['estilingue'], nivel: 10,  lug: 0, forma: 'ave',   cor: '#9aa3ad', tam: 0.75, vel: 0.9, hp: 1, moedas: 20,  peso: 10, voa: true, drop: { id: 'pena', qtd: 2 } },
  { id: 'pardal',     nome: 'Pardal',          raro: 'incomum',  praga: true, armas: ['estilingue'], nivel: 10,  lug: 0, forma: 'ave',   cor: '#a07a4a', tam: 0.6,  vel: 1.1, hp: 1, moedas: 35, peso: 5, voa: true, drop: { id: 'pena', qtd: 2 } },
  { id: 'lebre',      nome: 'Lebre-europeia',  raro: 'incomum',  praga: true, armas: ['estilingue', 'espingarda'], nivel: 10, lug: 0, forma: 'lebre', cor: '#b08a5a', tam: 0.9, vel: 1.55, hp: 1, moedas: 65, peso: 6, drop: { id: 'pata', qtd: 2 } },
  { id: 'javali',     nome: 'Javali',          raro: 'raro',     praga: true, armas: ['espingarda'], nivel: 12, lug: 1, forma: 'porco', cor: '#5a4a3a', tam: 1.3,  vel: 1.0, hp: 2, moedas: 150,  carne: 3, peso: 7 },
  { id: 'javaporco',  nome: 'Javaporco',       raro: 'épico',    praga: true, armas: ['espingarda'], nivel: 15, lug: 2, forma: 'porco', cor: '#7a5a44', tam: 1.5,  vel: 1.15, hp: 3, moedas: 260, carne: 4, peso: 2.5, pintas: true },
  { id: 'chupacabra', nome: 'Chupa-cabra',     raro: 'lendário', praga: true, armas: ['espingarda'], nivel: 20, lug: 3, forma: 'chupa', cor: '#6a7a6a', tam: 1.25, vel: 1.75, hp: 4, moedas: 1600, peso: 0.6, drop: { id: 'presa', qtd: 2 } },
  // nativos: só na arapuca, e voltam para o mato
  { id: 'rolinha',    nome: 'Rolinha',         raro: 'comum',    armas: ['arapuca'], nivel: 10,  lug: 0, forma: 'ave',   cor: '#c89a7a', tam: 0.6,  moedas: 10,  peso: 10 },
  { id: 'prea',       nome: 'Preá',            raro: 'comum',    armas: ['arapuca'], nivel: 10,  lug: 0, forma: 'rato',  cor: '#8a6a4a', tam: 0.7,  moedas: 10,  peso: 10, semRabo: true },
  { id: 'codorna',    nome: 'Codorna',         raro: 'comum',    armas: ['arapuca'], nivel: 10,  lug: 0, forma: 'ave',   cor: '#9a7a52', tam: 0.65, moedas: 10,  peso: 8, gorda: true },
  { id: 'inhambu',    nome: 'Inhambu',         raro: 'incomum',  armas: ['arapuca'], nivel: 10,  lug: 1, forma: 'ave',   cor: '#7a6a4a', tam: 0.75, moedas: 18, peso: 6, gorda: true },
  { id: 'tatu',       nome: 'Tatu-galinha',    raro: 'incomum',  armas: ['arapuca'], nivel: 10,  lug: 1, forma: 'tatu',  cor: '#a09080', tam: 0.9,  moedas: 18, peso: 6 },
  { id: 'cutia',      nome: 'Cutia',           raro: 'incomum',  armas: ['arapuca'], nivel: 12, lug: 1, forma: 'rato',  cor: '#c8843a', tam: 0.9,  moedas: 18, peso: 5, semRabo: true },
  { id: 'paca',       nome: 'Paca',            raro: 'raro',     armas: ['arapuca'], nivel: 12, lug: 2, forma: 'rato',  cor: '#7a5230', tam: 1,    moedas: 35, peso: 3, semRabo: true, pintas: true },
  { id: 'jacu',       nome: 'Jacu',            raro: 'raro',     armas: ['arapuca'], nivel: 14, lug: 2, forma: 'ave',   cor: '#2e2a2a', tam: 0.95, moedas: 35, peso: 3, papo: true },
  { id: 'mutum',      nome: 'Mutum',           raro: 'épico',    armas: ['arapuca'], nivel: 18, lug: 3, forma: 'ave',   cor: '#1e1e22', tam: 1.05, moedas: 70, peso: 1.2, crista: true },
  // +3 espécies na capoeira/mata/cerrado/serra/chapada (lug 0)
  { id: 'gamba', nome: 'Gambá', raro: 'incomum', praga: true, armas: ['estilingue'], nivel: 10, lug: 0, forma: 'rato', cor: '#8a8078', tam: 0.75, vel: 1, hp: 1, moedas: 28, peso: 6, semRabo: false },
  { id: 'sabia', nome: 'Sabiá', raro: 'comum', armas: ['arapuca'], nivel: 10, lug: 0, forma: 'ave', cor: '#9aa3ad', tam: 0.6, moedas: 10, peso: 10 },
  { id: 'joaodebarro', nome: 'João-de-barro', raro: 'comum', armas: ['arapuca'], nivel: 10, lug: 0, forma: 'ave', cor: '#a07a4a', tam: 0.62, moedas: 10, peso: 9, gorda: true },
  // +6 espécies na capoeira/mata/cerrado/serra/chapada (lug 1)
  { id: 'quati', nome: 'Quati', raro: 'incomum', praga: true, armas: ['estilingue', 'espingarda'], nivel: 12, lug: 1, forma: 'rato', cor: '#b08a5a', tam: 0.95, vel: 1.2, hp: 1, moedas: 45, peso: 5, semRabo: false },
  { id: 'irara', nome: 'Irara', raro: 'raro', praga: true, armas: ['espingarda'], nivel: 12, lug: 1, forma: 'lebre', cor: '#5a4a3a', tam: 0.9, vel: 1.5, hp: 1, moedas: 70, peso: 4 },
  { id: 'saira', nome: 'Saíra', raro: 'incomum', armas: ['arapuca'], nivel: 12, lug: 1, forma: 'ave', cor: '#7a5a44', tam: 0.6, moedas: 15, peso: 6, voa: true },
  { id: 'tucano', nome: 'Tucano', raro: 'raro', armas: ['arapuca'], nivel: 12, lug: 1, forma: 'ave', cor: '#c89a7a', tam: 0.85, moedas: 22, peso: 4, voa: true, papo: true },
  { id: 'veadocatingueiro', nome: 'Veado-catingueiro', raro: 'raro', armas: ['arapuca'], nivel: 12, lug: 1, forma: 'porco', cor: '#8a6a4a', tam: 1.15, moedas: 28, peso: 3 },
  { id: 'quero-quero', nome: 'Quero-quero', raro: 'comum', armas: ['arapuca'], nivel: 12, lug: 1, forma: 'ave', cor: '#9a7a52', tam: 0.65, moedas: 12, peso: 7 },
  // +7 espécies na capoeira/mata/cerrado/serra/chapada (lug 2)
  { id: 'raposa', nome: 'Raposa-do-campo', raro: 'raro', praga: true, armas: ['espingarda'], nivel: 15, lug: 2, forma: 'lebre', cor: '#7a6a4a', tam: 1, vel: 1.4, hp: 2, moedas: 85, peso: 4 },
  { id: 'queixada', nome: 'Queixada', raro: 'épico', praga: true, armas: ['espingarda'], nivel: 15, lug: 2, forma: 'porco', cor: '#a09080', tam: 1.35, vel: 1.1, hp: 2, moedas: 150, peso: 2.2, pintas: true },
  { id: 'serieman', nome: 'Seriema', raro: 'incomum', armas: ['arapuca'], nivel: 15, lug: 2, forma: 'ave', cor: '#c8843a', tam: 0.9, moedas: 18, peso: 6, crista: true },
  { id: 'tamandua', nome: 'Tamanduá-bandeira', raro: 'raro', armas: ['arapuca'], nivel: 15, lug: 2, forma: 'tatu', cor: '#7a5230', tam: 1.1, moedas: 30, peso: 3 },
  { id: 'emaCampo', nome: 'Ema', raro: 'épico', armas: ['arapuca'], nivel: 15, lug: 2, forma: 'ave', cor: '#2e2a2a', tam: 1.3, moedas: 45, peso: 1.5, gorda: true },
  { id: 'curica', nome: 'Curicaca', raro: 'incomum', armas: ['arapuca'], nivel: 15, lug: 2, forma: 'ave', cor: '#1e1e22', tam: 0.8, moedas: 16, peso: 6, voa: true },
  { id: 'lobinho', nome: 'Lobinho-do-cerrado', raro: 'raro', armas: ['arapuca'], nivel: 15, lug: 2, forma: 'lebre', cor: '#6a7a6a', tam: 1, moedas: 32, peso: 3 },
  // +8 espécies na capoeira/mata/cerrado/serra/chapada (lug 3)
  { id: 'gatomato', nome: 'Gato-do-mato', raro: 'épico', praga: true, armas: ['espingarda'], nivel: 20, lug: 3, forma: 'lebre', cor: '#8a8078', tam: 1, vel: 1.6, hp: 2, moedas: 180, peso: 2, pintas: true },
  { id: 'javaliSerra', nome: 'Javali-serrano', raro: 'raro', praga: true, armas: ['espingarda'], nivel: 20, lug: 3, forma: 'porco', cor: '#9aa3ad', tam: 1.4, vel: 1.05, hp: 2, moedas: 170, peso: 3 },
  { id: 'gaviao', nome: 'Gavião-carijó', raro: 'raro', armas: ['arapuca'], nivel: 20, lug: 3, forma: 'ave', cor: '#a07a4a', tam: 0.95, moedas: 25, peso: 4, voa: true },
  { id: 'jaguatirica', nome: 'Jaguatirica', raro: 'épico', armas: ['arapuca'], nivel: 20, lug: 3, forma: 'lebre', cor: '#b08a5a', tam: 1.15, moedas: 48, peso: 1.8, pintas: true },
  { id: 'capivaraSerra', nome: 'Capivara', raro: 'incomum', armas: ['arapuca'], nivel: 20, lug: 3, forma: 'rato', cor: '#5a4a3a', tam: 1.3, moedas: 20, peso: 5 },
  { id: 'maracana', nome: 'Maracanã', raro: 'raro', armas: ['arapuca'], nivel: 20, lug: 3, forma: 'ave', cor: '#7a5a44', tam: 0.8, moedas: 26, peso: 3.5, voa: true },
  { id: 'vedetinha', nome: 'Veado-campeiro', raro: 'épico', armas: ['arapuca'], nivel: 20, lug: 3, forma: 'porco', cor: '#c89a7a', tam: 1.2, moedas: 55, peso: 1.6 },
  { id: 'corujaBuraqueira', nome: 'Coruja-buraqueira', raro: 'incomum', armas: ['arapuca'], nivel: 20, lug: 3, forma: 'ave', cor: '#8a6a4a', tam: 0.7, moedas: 18, peso: 5, voa: true },
  // +10 espécies na capoeira/mata/cerrado/serra/chapada (lug 4)
  { id: 'oncepintada', nome: 'Onça-pintada', raro: 'lendário', praga: true, armas: ['espingarda'], nivel: 28, lug: 4, forma: 'lebre', cor: '#9a7a52', tam: 1.5, vel: 1.3, hp: 3, moedas: 700, peso: 0.9, pintas: true },
  { id: 'lobo-guara', nome: 'Lobo-guará', raro: 'épico', praga: true, armas: ['espingarda'], nivel: 28, lug: 4, forma: 'lebre', cor: '#7a6a4a', tam: 1.25, vel: 1.35, hp: 2, moedas: 220, peso: 1.8 },
  { id: 'antaChapada', nome: 'Anta', raro: 'épico', praga: true, armas: ['espingarda'], nivel: 28, lug: 4, forma: 'porco', cor: '#a09080', tam: 1.5, vel: 0.95, hp: 3, moedas: 240, peso: 1.7 },
  { id: 'arara-azul', nome: 'Arara-azul-de-lear', raro: 'lendário', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'ave', cor: '#c8843a', tam: 1, moedas: 90, peso: 0.8, voa: true },
  { id: 'tatuBola', nome: 'Tatu-bola', raro: 'raro', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'tatu', cor: '#7a5230', tam: 0.95, moedas: 32, peso: 3 },
  { id: 'gaviaoReal', nome: 'Gavião-real', raro: 'lendário', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'ave', cor: '#2e2a2a', tam: 1.1, moedas: 95, peso: 0.7, voa: true, crista: true },
  { id: 'suacu', nome: 'Suaçu-veado', raro: 'épico', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'porco', cor: '#1e1e22', tam: 1.25, moedas: 50, peso: 1.6 },
  { id: 'papagaioChapada', nome: 'Papagaio-chauá', raro: 'raro', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'ave', cor: '#6a7a6a', tam: 0.85, moedas: 35, peso: 3, voa: true, papo: true },
  { id: 'preaDaChapada', nome: 'Preá-da-chapada', raro: 'incomum', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'rato', cor: '#8a8078', tam: 0.75, moedas: 20, peso: 5, semRabo: true },
  { id: 'tucanAcu', nome: 'Tucano-açu', raro: 'épico', armas: ['arapuca'], nivel: 28, lug: 4, forma: 'ave', cor: '#9aa3ad', tam: 0.95, moedas: 45, peso: 1.8, voa: true, papo: true },

];
const CACA_BICHO = Object.fromEntries(CACA_BICHOS.map(b => [b.id, b]));
for (const b of CACA_BICHOS) if (b.drop) (BICHO_DO_DROP[b.drop.id] || (BICHO_DO_DROP[b.drop.id] = [])).push(b.id);
BICHO_DO_DROP.carnejavali = ['javali', 'javaporco'];
const jaCacou = id => !BICHO_DO_DROP[id] || (state.caca && state.caca.col && BICHO_DO_DROP[id].some(b => state.caca.col[b] > 0));
const ARMAS_CACA = {
  estilingue: { nome: 'Estilingue', nivel: 10, custo: 0,    mun: 'pedra',    munNome: 'pedrinhas', pacote: 10, munCusto: 20 },
  espingarda: { nome: 'Espingarda', nivel: 12, custo: 2500, mun: 'cartucho', munNome: 'cartuchos', pacote: 5,  munCusto: 120 },
};
const ARAPUCA = { nivel: 10, custo: 400, nivel2: 14, custo2: 1500 };
// Iscas da arapuca: milho (do celeiro), quirera (compra) atrai mais bicho incomum, e fruta do pomar atrai os raros.
const ISCAS_ARAPUCA = {
  milho:   { nome: 'Milho',   emoji: '🌽', vazia: 0.15, bonus: {} },
  quirera: { nome: 'Quirera', emoji: '🌾', vazia: 0.08, bonus: { incomum: 1.8, raro: 1.4 }, pacote: 5, custo: 60 },
  fruta:   { nome: 'Fruta do pomar', emoji: '🍊', vazia: 0.05, bonus: { raro: 2.5, 'épico': 2.5, incomum: 1.2 } },
};
const frutaIsca = () => FRUTAS.map(f => f.id).filter(id => state.barn[id] > 0).sort((a, b) => state.barn[b] - state.barn[a])[0];
const qtdIscaArap = id => id === 'milho' ? state.barn.milho || 0 : id === 'quirera' ? cacaDe().quirera || 0 : FRUTAS.reduce((t, f) => t + (state.barn[f.id] || 0), 0);

function cacaDe() {
  const c = state.caca || (state.caca = {});
  c.lugares = Array.isArray(c.lugares) ? c.lugares : ['capoeira'];
  if (!c.lugares.includes('capoeira')) c.lugares.unshift('capoeira');
  c.prox = c.prox || {}; c.usos = c.usos || {}; c.col = c.col || {}; c.novos = c.novos || [];
  c.armas = c.armas || { estilingue: true }; c.mun = c.mun || {};
  if (!c.presente) { c.presente = 1; c.mun.pedra = (c.mun.pedra || 0) + 10; } // começa com 10 pedrinhas
  if (c.temArapuca && !c.nArap) c.nArap = 1;
  c.arms = Array.isArray(c.arms) ? c.arms : [c.arapuca || null, null]; delete c.arapuca; delete c.temArapuca;
  c.nArap = c.nArap || 0;
  if (!ISCAS_ARAPUCA[c.iscaArap]) c.iscaArap = 'milho';
  if (!LUGAR_CACA[c.lugar] || !temLugarCaca(c.lugar)) c.lugar = 'capoeira';
  if (!ARMAS_CACA[c.arma] || !c.armas[c.arma]) c.arma = 'estilingue';
  return c;
}
const temLugarCaca = id => { const l = LUGAR_CACA[id]; return !!l && (l.custo === 0 ? state.level >= l.nivel : (state.caca && state.caca.lugares || []).includes(id)); };
const faltaLugarCaca = id => Math.max(0, (cacaDe().prox[id] || 0) - Date.now());
const restamCaca = id => faltaLugarCaca(id) ? 0 : Math.max(0, cacaPorVez() - (cacaDe().usos[id] || 0));
const munDe = arma => cacaDe().mun[ARMAS_CACA[arma].mun] || 0;
// Algum lugar seu tem caçada disponível agora (descansado ou nunca usado): mostra um brilho na entrada do mato.
const cacaPronta = () => state && LUGARES_CACA.some(l => temLugarCaca(l.id) && !faltaLugarCaca(l.id) && restamCaca(l.id) > 0);
// Domínio de caçada: pontos por bicho (mais para os raros); cada nível corta 5% da espera e aumenta a mira.
const dominioCacaXP = () => CACA_BICHOS.reduce((t, b) => t + (cacaDe().col[b.id] || 0) * DOMINIO_PTS[b.raro], 0);
function dominioCaca() {
  const xp = dominioCacaXP(); let nv = 1;
  while (nv < DOMINIO_NV.length && xp >= DOMINIO_NV[nv]) nv++;
  return { nv, xp, ini: DOMINIO_NV[nv - 1], fim: DOMINIO_NV[nv], max: nv >= DOMINIO_NV.length, corte: (nv - 1) * DOMINIO_CORTE, mira: 1 + (nv - 1) * 0.05 };
}
const esperaCaca = () => Math.round(CACA_MS * (1 - dominioCaca().corte));
const esperaArapuca = () => Math.round(ARAPUCA_MS * (1 - dominioCaca().corte));
const cacaDomAResgatar = () => { const nv = dominioCaca().nv, t = trevosDe(), r = []; t.domCaca = t.domCaca || {}; for (let n = 2; n <= nv; n++) if (!t.domCaca[n]) r.push(n); return r; };
// Domínio de cada bicho ★: pegando mais do mesmo, ele ganha estrelas (até 4), aparece 15% mais por
// estrela e cada estrela vale trevos (1, 2, 3 e 5), como os peixes.
const estrelasBicho = b => { const n = cacaDe().col[b.id] || 0, m = MAESTRIA[b.raro] || MAESTRIA.comum; return m.filter(x => n >= x).length; };
function trevosDoBicho(b) {
  const t = trevosDe(); t.caca = t.caca || {}; t.cacaEst = t.cacaEst || {};
  if (!cacaDe().col[b.id]) return 0;
  let n = t.caca[b.id] ? 0 : (TREVO_PEIXE[b.raro] || 1);
  for (let k = t.cacaEst[b.id] || 0; k < estrelasBicho(b); k++) n += TREVO_ESTRELA[k];
  return n;
}
const bichosAResgatar = () => CACA_BICHOS.filter(b => trevosDoBicho(b) > 0);
function resgatarBichos() {
  const l = bichosAResgatar(), t = trevosDe(); if (!l.length) return;
  let n = 0; for (const b of l) { n += trevosDoBicho(b); t.caca[b.id] = true; t.cacaEst[b.id] = estrelasBicho(b); }
  ganharTrevos(n, `${l.length} bicho${l.length > 1 ? 's' : ''} do Livro da caçada.`);
}
function resgatarDomCaca() {
  const l = cacaDomAResgatar(), t = trevosDe(); if (!l.length) return;
  let n = 0; for (const nv of l) { t.domCaca[nv] = true; n += TREVO_DOMINIO[nv] || 0; }
  ganharTrevos(n, `Domínio de caçada ${l.length > 1 ? `níveis ${l[0]} a ${l[l.length - 1]}` : `nível ${l[0]}`}.`);
}
function dominioCacaHTML() {
  const d = dominioCaca(), pct = d.max ? 100 : Math.round((d.xp - d.ini) / (d.fim - d.ini) * 100), r = cacaDomAResgatar();
  return `<span class="dnv">🎖️ Domínio de caçada <b>Nv ${d.nv}</b></span><span class="dbar"><i style="width:${pct}%"></i></span>
    ${r.length ? `<button class="btn gold dresg" type="button" data-trevo-domcaca="1">Resgatar 🍀${r.reduce((t, n) => t + (TREVO_DOMINIO[n] || 0), 0)}</button>` : ''}
    <span class="dinfo">${d.corte ? `−${Math.round(d.corte * 100)}% de espera · mira +${Math.round((d.mira - 1) * 100)}% · ` : ''}mato ${fmt(esperaCaca() / 1000)} · arapuca ${fmt(esperaArapuca() / 1000)}${d.max ? ' · máximo!' : ` · ${d.fim - d.xp} pts p/ Nv ${d.nv + 1}`}</span>`;
}
function sortearBicho(arma, lugar, isca) {
  const li = LUGARES_CACA.findIndex(l => l.id === lugar), L0 = LUGAR_CACA[lugar], noite = timeOfDay() === 'noite';
  let ok = CACA_BICHOS.filter(b => b.armas.includes(arma) && b.nivel <= state.level && b.lug <= li);
  if (!ok.length) ok = [CACA_BICHO[arma === 'arapuca' ? 'rolinha' : arma === 'espingarda' ? 'lebre' : 'rato']];
  const bonus = (isca && ISCAS_ARAPUCA[isca] && ISCAS_ARAPUCA[isca].bonus) || {};
  const peso = b => b.peso * (['raro', 'épico', 'lendário'].includes(b.raro) ? L0.sorte : b.raro === 'incomum' ? Math.sqrt(L0.sorte) : 1) * (b.id === 'chupacabra' && noite ? 3 : 1)
    * (1 + 0.15 * estrelasBicho(b)) * (bonus[b.raro] || 1);
  let r = Math.random() * ok.reduce((t, b) => t + peso(b), 0);
  for (const b of ok) { r -= peso(b); if (r <= 0) return b; }
  return ok[0];
}
// Guarda no livro (e no domínio). Diz se era novo.
function registrarBicho(b) {
  const c = cacaDe(), antes = dominioCaca().nv, novo = !c.col[b.id];
  c.col[b.id] = (c.col[b.id] || 0) + 1;
  if (novo && !c.novos.includes(b.id)) c.novos.push(b.id);
  if (novo) setTimeout(() => toast(`📷 Foto nova de ${b.nome.toLowerCase()} no mural da sua casa!`, 'good'), 1600);
  addXP({ comum: 3, incomum: 6, raro: 12, 'épico': 20, 'lendário': 60 }[b.raro], null);
  state.stats.caca = (state.stats.caca || 0) + 1; track('cacar');
  const d = dominioCaca();
  if (d.nv > antes) setTimeout(() => { sfx('level'); toast(`🎖️ Domínio de caçada nível ${d.nv}! Espera ${Math.round(d.corte * 100)}% menor e mira melhor. Resgate os trevos.`, 'good'); }, 900);
  return novo;
}
function comprarLugarCaca(id) {
  const l = LUGAR_CACA[id]; if (!l || temLugarCaca(id)) return;
  if (state.level < l.nivel) return toast(`${l.emoji} ${l.nome}: libera no nível ${l.nivel} e custa ${l.custo.toLocaleString('pt-BR')} moedas.`);
  if (state.coins < l.custo) return toast(`${l.nome} custa ${l.custo.toLocaleString('pt-BR')} moedas. Faltam ${(l.custo - state.coins).toLocaleString('pt-BR')}.`, 'bad');
  confirmTwice('lugarcaca' + id, `Comprar ${l.nome} por ${l.custo.toLocaleString('pt-BR')} moedas? Toque de novo para confirmar.`, () => {
    state.coins -= l.custo; cacaDe().lugares.push(id); cacaDe().lugar = id; sfx('buy');
    toast(`${l.emoji} ${l.nome} é seu! Bicho raro aparece mais por lá.`, 'good'); caca = { fase: 'pronto' }; done(); renderCaca();
  });
}
function comprarArma(id) {
  const a = ARMAS_CACA[id], c = cacaDe(); if (!a || c.armas[id]) return;
  if (state.level < a.nivel) return toast(`${a.nome}: libera no nível ${a.nivel}.`);
  if (state.coins < a.custo) return toast(`${a.nome} custa ${a.custo.toLocaleString('pt-BR')} moedas.`, 'bad');
  confirmTwice('arma' + id, `Comprar ${a.nome.toLowerCase()} por ${a.custo.toLocaleString('pt-BR')} moedas? Toque de novo para confirmar.`, () => {
    state.coins -= a.custo; c.armas[id] = true; c.arma = id; c.mun[a.mun] = (c.mun[a.mun] || 0) + a.pacote; sfx('buy');
    toast(`${a.nome} é sua! Veio com ${a.pacote} ${a.munNome}. Pega javali, javaporco… e dizem que até o Chupa-cabra.`, 'good'); done(); renderCaca();
  });
}
function comprarMunicao() {
  const a = ARMAS_CACA[cacaDe().arma];
  if (state.coins < a.munCusto) return toast(`${a.pacote} ${a.munNome} custam ${a.munCusto} moedas.`, 'bad');
  state.coins -= a.munCusto; cacaDe().mun[a.mun] = (cacaDe().mun[a.mun] || 0) + a.pacote; sfx('buy');
  toast(`+${a.pacote} ${a.munNome}!`, 'good'); done(); renderCaca();
}
// ---------- Arapuca: arma com 1 milho de isca, volta depois de umas horas e vê o que caiu ----------
function comprarArapuca() {
  const c = cacaDe(), segunda = c.nArap >= 1, nv = segunda ? ARAPUCA.nivel2 : ARAPUCA.nivel, custo = segunda ? ARAPUCA.custo2 : ARAPUCA.custo;
  if (c.nArap >= 2) return;
  if (state.level < nv) return toast(`🪤 A ${segunda ? 'segunda arapuca' : 'arapuca'} libera no nível ${nv}.`);
  if (state.coins < custo) return toast(`A ${segunda ? 'segunda arapuca' : 'arapuca'} custa ${custo.toLocaleString('pt-BR')} moedas.`, 'bad');
  confirmTwice('arapuca' + c.nArap, `Comprar ${segunda ? 'a segunda arapuca' : 'a arapuca'} por ${custo.toLocaleString('pt-BR')} moedas? Toque de novo para confirmar.`, () => {
    state.coins -= custo; c.nArap++; sfx('buy'); toast(`🪤 ${segunda ? 'Segunda arapuca' : 'Arapuca'} comprada! Escolha a isca e arme.`, 'good'); done(); renderCaca();
  });
}
function comprarQuirera() {
  const q = ISCAS_ARAPUCA.quirera;
  if (state.coins < q.custo) return toast(`${q.pacote} quireras custam ${q.custo} moedas.`, 'bad');
  state.coins -= q.custo; cacaDe().quirera = (cacaDe().quirera || 0) + q.pacote; sfx('buy'); toast(`🌾 +${q.pacote} quireras para a arapuca!`, 'good'); done(); renderCaca();
}
function arapucaAcao(k) {
  const c = cacaDe(), ar = c.arms[k];
  if (!ar) {
    const isca = c.iscaArap, d = ISCAS_ARAPUCA[isca];
    if (qtdIscaArap(isca) <= 0) return toast(isca === 'milho' ? '🌽 Sem milho no celeiro! Plante e colha milho, ou escolha outra isca.' : isca === 'quirera' ? '🌾 Sem quirera: compre aqui embaixo.' : '🍊 Sem fruta no celeiro: colha do seu pomar.', 'bad');
    if (isca === 'milho') { state.barn.milho--; if (!state.barn.milho) delete state.barn.milho; }
    else if (isca === 'quirera') c.quirera--;
    else { const f = frutaIsca(); state.barn[f]--; if (!state.barn[f]) delete state.barn[f]; }
    c.arms[k] = { lugar: c.lugar, pronta: Date.now() + esperaArapuca(), isca }; sfx('hoe');
    toast(`🪤 Arapuca armada em ${LUGAR_CACA[c.lugar].nome} com ${d.nome.toLowerCase()}! Volte em ${fmt(esperaArapuca() / 1000)}.`, 'good'); done(); return renderCaca();
  }
  const falta = ar.pronta - Date.now();
  if (falta > 0) return toast(`🪤 A arapuca ainda está armada: volte em ${fmt(falta / 1000)}.`);
  c.arms[k] = null;
  const d = ISCAS_ARAPUCA[ar.isca] || ISCAS_ARAPUCA.milho;
  if (Math.random() < d.vazia) { caca = { fase: 'resultado', msg: '🪤 A arapuca desarmou e comeram a isca… nada desta vez. Arme de novo!' }; sfx('error'); done(); return renderCaca(); }
  const b = sortearBicho('arapuca', ar.lugar, ar.isca), novo = registrarBicho(b);
  addCoins(b.moedas, null);
  caca = { fase: 'resultado', bicho: b, solto: true, novo,
    msg: `🪤 Caiu ${um(b)} ${b.nome} na arapuca!${novo ? ' ✨ Novo no livro!' : ''} Anotou no livro e soltou de volta no mato 🌿 (+${b.moedas} moedas).` };
  sfx(novo ? 'level' : 'collect'); if (novo) toast(`✨ Bicho novo no livro: ${b.nome}!`, 'good');
  done(); renderCaca();
}
const BICHO_FEM = ['rolinha', 'prea', 'codorna', 'cutia', 'paca', 'lebre'];
const um = b => BICHO_FEM.includes(b.id) ? 'uma' : 'um';

// ---------- A caçada no mato: o bicho corre (ou voa) e você toca nele para atirar ----------
let caca = null, cacaRaf = 0, cacaLivro = false, cacaRelogio = 0;
function abrirCaca() {
  if (!isHome()) return;
  if (state.level < CACA_NIVEL) return toast(`🎯 A caçada libera no nível ${CACA_NIVEL}.`);
  cacaDe(); cacaLivro = false; caca = { fase: 'pronto' };
  $('#caca').hidden = false; renderCaca();
  if (!cacaRaf) cacaRaf = requestAnimationFrame(desenharCaca);
}
function fecharCaca() { if (cacaLivro) cacaLivroVisto(); $('#caca').hidden = true; caca = null; }
function cacaLivroVisto() { if (cacaDe().novos.length) { cacaDe().novos = []; save(); } }
function entrarNoMato() {
  if (!caca || !['pronto', 'resultado'].includes(caca.fase)) return;
  const c = cacaDe(), l = LUGAR_CACA[c.lugar], a = ARMAS_CACA[c.arma];
  if (faltaLugarCaca(l.id)) return toast(`${l.nome} está sossegado: os bichos voltam em ${fmt(faltaLugarCaca(l.id) / 1000)}. Tente outro lugar ou a arapuca!`);
  if (munDe(c.arma) <= 0) { caca = { fase: 'pronto', aviso: `Acabou a munição! Compre mais ${a.munNome} aqui embaixo.` }; sfx('error'); return renderCaca(); }
  c.usos[l.id] = (c.usos[l.id] || 0) + 1;
  if (c.usos[l.id] >= cacaPorVez()) { c.usos[l.id] = 0; c.prox[l.id] = Date.now() + esperaCaca(); }
  save();
  const t = performance.now();
  caca = { fase: 'procurando', t0: t, aparece: t + 1200 + Math.random() * 1600, arma: c.arma, lugar: l.id, bicho: sortearBicho(c.arma, l.id) };
  sfx('weed'); renderCaca();
}
// O bicho entra por um lado, atravessa e sai; dá até 3 passadas. Às vezes se esconde numa moita.
function soltarBicho(t, cw, ch) {
  const b = caca.bicho, dir = Math.random() < 0.5 ? 1 : -1, faixas = b.voa ? [0.2, 0.3, 0.4] : [0.6, 0.72, 0.84];
  caca.fase = 'mira';
  caca.a = { x: dir > 0 ? -40 : cw + 40, y: ch * faixas[Math.floor(Math.random() * 3)], dir, vel: (70 + Math.random() * 25) * b.vel * (cw / 420), hp: b.hp, passes: 0, pausa: 0, esconde: 0, flash: 0, ult: t, faixas };
  sfx(b.id === 'chupacabra' ? 'uivo' : 'weed');
  renderCaca();
}
function moverBicho(t, cw, ch) {
  const a = caca.a, dt = Math.min(0.05, (t - a.ult) / 1000); a.ult = t;
  if (a.pausa > t || a.esconde > t) return;
  a.x += a.dir * a.vel * dt;
  // moitas: de vez em quando o bicho de chão para escondido atrás de uma. Alinha o y do bicho com
  // o da moita certa (mesma fórmula do desenhaMoitas em desenharCaca) pra ele sumir atrás da planta
  // de verdade, não numa fileira vazia do gramado.
  if (!caca.bicho.voa && !a.escondeu) for (const [k, mx] of MOITAS.entries()) if (Math.abs(a.x - mx * cw) < 6 && Math.random() < 0.45) {
    a.esconde = t + 500 + Math.random() * 700; a.escondeu = true; a.y = ch * (0.6 + (k % 3) * 0.12) + 4;
  }
  if ((a.dir > 0 && a.x > cw + 50) || (a.dir < 0 && a.x < -50)) {
    a.passes++; a.escondeu = false;
    if (a.passes >= 3) { caca = { fase: 'resultado', msg: `${um(caca.bicho) === 'uma' ? 'A' : 'O'} ${caca.bicho.nome.toLowerCase()} sumiu no mato… 😩 Tente de novo!` }; sfx('error'); return renderCaca(); }
    a.dir *= -1; a.y = ch * a.faixas[Math.floor(Math.random() * 3)]; a.pausa = t + 400 + Math.random() * 700;
  }
}
const MOITAS = [0.16, 0.42, 0.68, 0.9];
const posBicho = (a, t) => ({ x: a.x, y: a.y + (caca.bicho.voa ? Math.sin(t / 260) * 4 : 0) });
function atirar(x, y) {
  if (!caca || caca.fase !== 'mira') return;
  const c = cacaDe(), a = ARMAS_CACA[caca.arma];
  if (munDe(caca.arma) <= 0) { caca = { fase: 'resultado', msg: `Acabou a munição e o bicho fugiu! Compre mais ${a.munNome} aqui embaixo.` }; sfx('error'); return renderCaca(); }
  c.mun[a.mun]--; save();
  const t = performance.now(), cv = $('#cacaCv'), cw = cv.clientWidth, ch = cv.clientHeight;
  if (caca.arma === 'espingarda') { sfx('tiro'); caca.tiro = { x, y, t }; return acertou(x, y, t); }
  // estilingue: a pedrinha voa até o ponto tocado; vale onde o bicho estiver quando ela chegar
  sfx('estilingue');
  caca.pedra = { x0: cw / 2, y0: ch - 18, x, y, t0: t, dur: 150 };
  renderCaca();
}
function acertou(x, y, t) {
  const a = caca.a, b = caca.bicho, p = posBicho(a, t), cv = $('#cacaCv'), escala = cv.clientWidth / 420;
  // bicho voador tem uma mira um pouco mais generosa (é pequeno e rápido, senão fica quase impossível de acertar)
  const raio = 24 * Math.max(b.tam, b.voa ? 0.85 : b.tam) * escala * dominioCaca().mira * (caca.arma === 'espingarda' ? 1.15 : 1);
  if (a.esconde > t || Math.hypot(x - p.x, y - (p.y - 10 * b.tam * escala)) > raio) { caca.fala = { txt: 'Errou!', cor: '#e0503a', t, x, y }; sfx('error'); return renderCaca(); }
  a.hp--; a.flash = t + 250;
  if (a.hp <= 0) return pegouBicho();
  caca.fala = { txt: ['Acertou!', 'Mais um!', 'Tá ferido!'][Math.floor(Math.random() * 3)], cor: '#4fb82f', t, x, y };
  a.vel *= 1.25; a.dir *= Math.random() < 0.5 ? -1 : 1; sfx('hoe');
  try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* sem vibração */ }
  renderCaca();
}
function pegouBicho() {
  const b = caca.bicho, novo = registrarBicho(b);
  addCoins(b.moedas, null);
  const dropTxt = aplicaDropsCaca(b);
  let extra = '';
  if (b.id === 'chupacabra' && !cacaDe().trofeu) { cacaDe().trofeu = 1; state.enfeites.trofeuchupa = (state.enfeites.trofeuchupa || 0) + 1; state.invNovos = (state.invNovos || 0) + 1; extra = ' 🏆 Ganhou o Troféu do Chupa-cabra (está no Inventário)!'; addNews('🏆 Você pegou o lendário Chupa-cabra! O troféu está no Inventário.'); }
  caca = { fase: 'resultado', bicho: b, novo,
    msg: `🎯 Pegou ${um(b)} ${b.nome}! (${b.raro}) +${b.moedas.toLocaleString('pt-BR')} moedas de recompensa por tirar a praga${dropTxt ? dropTxt + ' no celeiro' : ''}.${novo ? ' ✨ Novo no livro!' : ''}${extra}` };
  sfx(novo || ['raro', 'épico', 'lendário'].includes(b.raro) ? 'level' : 'collect');
  try { if (navigator.vibrate) navigator.vibrate(50); } catch (e) { /* sem vibração */ }
  if (novo) toast(`✨ Bicho novo no livro: ${b.nome}!`, 'good');
  done(); renderCaca();
}
function renderCaca() {
  if (!caca) return;
  const c = cacaDe(), l = LUGAR_CACA[c.lugar], a = ARMAS_CACA[c.arma], btn = $('#cacaBtn');
  const livre = caca.fase === 'pronto' || caca.fase === 'resultado', descansa = faltaLugarCaca(l.id);
  btn.textContent = caca.fase === 'procurando' ? 'Procurando… 👀' : caca.fase === 'mira' ? `🎯 Toque no bicho! (${munDe(caca.arma)} ${ARMAS_CACA[caca.arma].munNome})`
    : descansa ? `⏳ Volta em ${fmt(descansa / 1000)}` : munDe(c.arma) <= 0 ? `Sem ${a.munNome}` : `${caca.fase === 'resultado' ? 'Caçar de novo' : 'Entrar no mato'} (${restamCaca(l.id)}/${cacaPorVez()})`;
  btn.disabled = (livre && !!descansa) || caca.fase === 'mira' || caca.fase === 'procurando';
  // arapucas (até 2) e a isca
  const arBtn = k => {
    const ar = c.arms[k], falta = ar ? ar.pronta - Date.now() : 0, pronta = ar && falta <= 0;
    return `<button class="btn ${pronta ? 'gold pulsa' : 'ghost'} tarrafa" type="button" data-arap="${k}" ${livre ? '' : 'disabled'}>${!ar ? `🪤 Armar${c.nArap > 1 ? ` ${k + 1}` : ''}<br><small>${ISCAS_ARAPUCA[c.iscaArap].emoji} ${ISCAS_ARAPUCA[c.iscaArap].nome.toLowerCase()}</small>`
      : pronta ? `🪤 Ver${c.nArap > 1 ? ` ${k + 1}` : ''}!<br><small>caiu alguma coisa?</small>` : `🪤 Armada${c.nArap > 1 ? ` ${k + 1}` : ''}<br><small>${ISCAS_ARAPUCA[ar.isca || 'milho'].emoji} em ${fmt(falta / 1000)}</small>`}</button>`;
  };
  const prox = c.nArap >= 2 ? '' : c.nArap === 0 ? `<button class="btn ghost tarrafa" type="button" data-arap="comprar">🪤 Arapuca<br><small>${state.level < ARAPUCA.nivel ? `🔒 Nv ${ARAPUCA.nivel}` : moeda(ARAPUCA.custo)}</small></button>`
    : `<button class="btn ghost tarrafa" type="button" data-arap="comprar">+ 2ª arapuca<br><small>${state.level < ARAPUCA.nivel2 ? `🔒 Nv ${ARAPUCA.nivel2}` : moeda(ARAPUCA.custo2)}</small></button>`;
  setHtml($('#cacaArapuca'), Array.from({ length: c.nArap }, (_, k) => arBtn(k)).join('') + prox);
  const bi = $('#cacaIscas'); bi.closest('.pescabar').hidden = !c.nArap;
  setHtml(bi, Object.entries(ISCAS_ARAPUCA).map(([id, d]) => `<button type="button" class="iscabtn" data-isca-arap="${id}" aria-pressed="${c.iscaArap === id}" title="${d.nome}">${d.emoji}<small>${qtdIscaArap(id)}</small></button>`).join('')
    + (c.iscaArap === 'quirera' ? `<button type="button" class="btn ghost" data-comprar-quirera="1" style="font-size:12px;padding:4px 8px">+${ISCAS_ARAPUCA.quirera.pacote} · ${moeda(ISCAS_ARAPUCA.quirera.custo)}</button>` : ''));
  setHtml($('#cacaDominio'), dominioCacaHTML());
  setHtml($('#cacaLugares'), LUGARES_CACA.map(d => {
    const meu = temLugarCaca(d.id), trava = d.nivel > state.level, f = meu ? faltaLugarCaca(d.id) : 0;
    const st = meu ? (f ? `⏳ ${fmt(f / 1000)}` : `Pronto! 🎯 ${restamCaca(d.id)}/${cacaPorVez()}`) : trava ? `🔒 Nv ${d.nivel} · ${d.custo ? moeda(d.custo) : 'grátis'}` : moeda(d.custo);
    return `<button type="button" class="pontobtn ${meu ? '' : trava ? 'trava' : 'loja'} ${f ? 'descansa' : ''}" data-lugar-caca="${d.id}" aria-pressed="${meu && d.id === l.id}"><b>${d.emoji} ${d.nome}</b><small>${st}</small></button>`;
  }).join(''));
  fadePontos($('#cacaLugares'));
  setHtml($('#cacaArmas'), Object.entries(ARMAS_CACA).map(([id, d]) => {
    const tem = c.armas[id], trava = d.nivel > state.level;
    return `<button type="button" class="iscabtn armabtn" data-arma="${id}" aria-pressed="${c.arma === id}" title="${d.nome}"><img alt="" src="${armaIcon(id)}"><small>${tem ? `${munDe(id)} ${id === 'estilingue' ? '🪨' : '🧨'}` : trava ? `Nv ${d.nivel}` : d.custo.toLocaleString('pt-BR')}</small></button>`;
  }).join(''));
  const cb = $('#cacaComprar'); setHtml(cb, `Comprar ${a.pacote} ${a.munNome} · ${moeda(a.munCusto)}`); cb.disabled = state.coins < a.munCusto;
  const alvos = CACA_BICHOS.filter(b => b.armas.includes(c.arma) && b.lug <= LUGARES_CACA.findIndex(x => x.id === l.id));
  $('#cacaDica').textContent = `${a.nome}: ${alvos.map(b => b.nivel > state.level ? '???' : b.nome + (c.col[b.id] ? '' : ' ✨')).join(', ')}.${c.arma === 'estilingue' ? ' A pedrinha demora um tiquinho: mire um pouco na frente do bicho!' : ' Bicho grande aguenta mais de um tiro.'} Os bichos nativos (preá, tatu, paca…) só caem na 🪤 arapuca e são soltos.`;
  $('#cacaMsg').textContent = caca.fase === 'procurando' ? 'Shhh… andando devagar pelo mato 👀'
    : caca.fase === 'mira' ? `Olha ${um(caca.bicho) === 'uma' ? 'a' : 'o'} ${caca.bicho.nome}! Toque nele para atirar${caca.bicho.hp > 1 ? ` (aguenta ${caca.bicho.hp} tiros)` : ''}.`
    : caca.fase === 'pronto' && caca.aviso ? caca.aviso
    : caca.fase === 'pronto' && descansa ? `${l.nome} está sossegado. Escolha outro lugar ou arme a arapuca!`
    : caca.fase === 'pronto' ? `${l.emoji} ${l.nome}: ${cacaPorVez()} entradas no mato por vez. Quando o bicho aparecer, toque nele!${l.id === 'serra' || l.id === 'chapada' ? ' Dizem que à noite o Chupa-cabra anda por aqui… 👀' : ''}`
    : caca.msg || '';
  $('#cacaLivro').hidden = !cacaLivro; $('#cacaCv').hidden = cacaLivro;
  const nn = c.novos.length;
  $('#cacaLivroBtn').textContent = cacaLivro ? '🎯 Voltar a caçar' : `📖 Livro da caçada${nn ? ` · ✨ ${nn} novo${nn > 1 ? 's' : ''}` : ''}`;
  if (cacaLivro) setHtml($('#cacaLivro'), livroCaca());
}
function livroCaca() {
  const c = cacaDe(), pegos = CACA_BICHOS.filter(b => c.col[b.id]).length, pend = bichosAResgatar(), soma = pend.reduce((t, b) => t + trevosDoBicho(b), 0);
  const card = b => { const n = c.col[b.id] || 0, novo = c.novos.includes(b.id);
    return `<div class="lvcard ${n ? '' : 'falta'}">${novo ? '<span class="lvnovo">NOVO!</span>' : ''}<img alt="" src="${n ? bichoIcon(b.id) : bichoSombra(b.id)}">
      <b>${n ? esc(b.nome) : '???'}</b><span class="raro" style="color:${COR_RARO[b.raro]}">${b.raro}</span>
      ${n ? `<small class="lvest" title="Domínio deste bicho">${'★'.repeat(estrelasBicho(b))}${'☆'.repeat(4 - estrelasBicho(b))}${(MAESTRIA[b.raro] || MAESTRIA.comum)[estrelasBicho(b)] ? ` <span>${n}/${(MAESTRIA[b.raro] || MAESTRIA.comum)[estrelasBicho(b)]}</span>` : ' <span>máximo!</span>'}</small>` : ''}
      <small>${n ? `📷 ${b.praga ? 'Pegou' : 'Registrou'} ${n}×` : b.nivel > state.level ? `Nível ${b.nivel}` : `${b.armas.map(x => x === 'arapuca' ? 'arapuca' : ARMAS_CACA[x].nome.toLowerCase()).join(' ou ')} · ${LUGARES_CACA[b.lug].nome}${b.lug < 4 ? ' ou além' : ''}`}</small></div>`; };
  return `<p class="hint" style="margin:0 0 8px">Você já tem <b>${pegos} de ${CACA_BICHOS.length}</b> bichos no livro. Cada bicho novo vale trevos 🍀 (comum 1, incomum 2, raro 3, épico 5, lendário 10) e uma 📷 foto no mural da sua casa. E cada bicho tem o seu domínio ★: pegando mais do mesmo, ele ganha estrelas (até 4), aparece 15% mais e cada estrela vale trevos.</p>
    ${pend.length ? `<p style="margin:0 0 8px;text-align:center"><button class="btn gold" type="button" data-trevo-bichos="1">Resgatar tudo · 🍀 ${soma}</button></p>` : ''}
    <h3 style="margin:4px 0">🎯 Pragas (estilingue e espingarda)</h3><div class="livro">${CACA_BICHOS.filter(b => b.praga).map(card).join('')}</div>
    <h3 style="margin:10px 0 4px">🪤 Bichos do mato (arapuca, soltos depois)</h3><div class="livro">${CACA_BICHOS.filter(b => !b.praga).map(card).join('')}</div>`;
}
// ---------- Desenhos: bichos, armas e a cena do mato ----------
// Bicho de frente para a direita, com os pés em (x, y). s = escala (1 = bicho médio).
function drawBicho(g, x, y, s, b, t, correndo) {
  const k = s * b.tam, pe = correndo ? Math.sin(t / 60) * 3 * k : 0, cor = b.cor, esc = tomCor(cor, -0.25), cla = tomCor(cor, 0.25);
  g.save(); g.translate(x, y); g.lineJoin = 'round'; g.lineCap = 'round';
  const olho = (ox, oy, r = 1.6, c = '#111') => { g.fillStyle = c; g.beginPath(); g.arc(ox * k, oy * k, r * k, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc((ox + 0.4) * k, (oy - 0.5) * k, r * 0.35 * k, 0, 7); g.fill(); };
  const perna = (px, dy) => { g.strokeStyle = esc; g.lineWidth = 2.6 * k; g.beginPath(); g.moveTo(px * k, -6 * k); g.lineTo(px * k + dy, 0); g.stroke(); };
  g.fillStyle = 'rgba(0,0,0,.18)'; if (!b.voa || !correndo) { g.beginPath(); g.ellipse(0, 0, 14 * k, 3 * k, 0, 0, 7); g.fill(); }
  if (b.forma === 'rato') {
    perna(-6, pe); perna(6, -pe);
    if (!b.semRabo) { g.strokeStyle = '#c89a8a'; g.lineWidth = 1.4 * k; g.beginPath(); g.moveTo(-11 * k, -7 * k); g.quadraticCurveTo(-20 * k, -4 * k, -24 * k, -10 * k); g.stroke(); }
    g.fillStyle = cor; g.beginPath(); g.ellipse(0, -9 * k, 12 * k, 7 * k, 0, 0, 7); g.fill();
    if (b.pintas) { g.fillStyle = '#f4ead8'; for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) { g.beginPath(); g.arc((-7 + q * 4.5) * k, (-10 + r * 3.5) * k, 1.1 * k, 0, 7); g.fill(); } }
    g.fillStyle = cor; g.beginPath(); g.ellipse(11 * k, -11 * k, 6 * k, 5 * k, 0.2, 0, 7); g.fill();
    g.fillStyle = cla; g.beginPath(); g.arc(9 * k, -16 * k, 2.6 * k, 0, 7); g.fill();
    g.fillStyle = '#e88a9a'; g.beginPath(); g.arc(17 * k, -10 * k, 1.2 * k, 0, 7); g.fill();
    olho(13, -12.5, 1.3);
  } else if (b.forma === 'lebre') {
    perna(-7, pe * 1.4); perna(7, -pe * 1.4);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-13 * k, -12 * k, 3 * k, 0, 7); g.fill();
    g.fillStyle = cor; g.beginPath(); g.ellipse(0, -11 * k, 13 * k, 7.5 * k, -0.1, 0, 7); g.fill();
    g.beginPath(); g.ellipse(12 * k, -16 * k, 5.5 * k, 4.5 * k, 0.3, 0, 7); g.fill();
    for (const [ex, ang] of [[9, -0.5], [12, -0.2]]) { g.fillStyle = cor; g.beginPath(); g.ellipse(ex * k, -25 * k, 2 * k, 7.5 * k, ang, 0, 7); g.fill(); g.fillStyle = '#e8a0a8'; g.beginPath(); g.ellipse(ex * k, -25 * k, 0.9 * k, 5.5 * k, ang, 0, 7); g.fill(); }
    olho(14, -17, 1.4);
  } else if (b.forma === 'tatu') {
    perna(-6, pe); perna(6, -pe);
    g.strokeStyle = esc; g.lineWidth = 2.5 * k; g.beginPath(); g.moveTo(-12 * k, -5 * k); g.lineTo(-20 * k, -2 * k); g.stroke();
    g.fillStyle = cor; g.beginPath(); g.ellipse(0, -6 * k, 13 * k, 9 * k, 0, Math.PI, 0); g.fill();
    g.strokeStyle = esc; g.lineWidth = 1 * k; for (let q = -2; q <= 2; q++) { g.beginPath(); g.moveTo(q * 4 * k, -6 * k); g.quadraticCurveTo(q * 4.4 * k, -12 * k, q * 3.6 * k, -14.5 * k); g.stroke(); }
    g.fillStyle = cla; g.beginPath(); g.moveTo(11 * k, -9 * k); g.lineTo(21 * k, -5 * k); g.lineTo(11 * k, -3 * k); g.fill();
    g.fillStyle = cor; g.beginPath(); g.ellipse(11 * k, -12 * k, 1.6 * k, 3.4 * k, 0.3, 0, 7); g.fill();
    olho(15, -6.5, 1);
  } else if (b.forma === 'porco') {
    perna(-8, pe); perna(-3, -pe); perna(5, pe); perna(10, -pe);
    g.strokeStyle = esc; g.lineWidth = 1.5 * k; g.beginPath(); g.moveTo(-14 * k, -12 * k); g.quadraticCurveTo(-19 * k, -16 * k, -17 * k, -10 * k); g.stroke();
    g.fillStyle = cor; g.beginPath(); g.ellipse(0, -12 * k, 15 * k, 9 * k, 0, 0, 7); g.fill();
    // crina no lombo
    g.fillStyle = esc; g.beginPath(); for (let q = -10; q <= 8; q += 3) { g.moveTo(q * k, -19 * k); g.lineTo((q + 1.5) * k, -24 * k); g.lineTo((q + 3) * k, -19 * k); } g.fill();
    if (b.pintas) { g.fillStyle = 'rgba(240,200,170,.55)'; for (const [px, py, r] of [[-6, -12, 3.2], [3, -9, 2.6], [-1, -15, 2]]) { g.beginPath(); g.arc(px * k, py * k, r * k, 0, 7); g.fill(); } }
    g.fillStyle = cor; g.beginPath(); g.ellipse(15 * k, -12 * k, 7 * k, 6 * k, 0.15, 0, 7); g.fill();
    g.fillStyle = esc; g.beginPath(); g.ellipse(21.5 * k, -10.5 * k, 2.4 * k, 3 * k, 0, 0, 7); g.fill();
    g.fillStyle = '#f4efe2'; g.beginPath(); g.moveTo(19 * k, -8 * k); g.quadraticCurveTo(22 * k, -13 * k, 20 * k, -16 * k); g.lineTo(18.6 * k, -9 * k); g.fill(); // presa
    g.fillStyle = esc; g.beginPath(); g.moveTo(11 * k, -17 * k); g.lineTo(13 * k, -22 * k); g.lineTo(15 * k, -17 * k); g.fill();
    olho(16, -14, 1.2, '#1a0a0a');
  } else if (b.forma === 'chupa') {
    // Chupa-cabra: corcunda cinza-esverdeada com espinhos, pernas compridas, olhos vermelhos e presas
    const brilho = 0.5 + 0.5 * Math.sin(t / 200);
    g.fillStyle = `rgba(160,255,120,${0.12 + brilho * 0.1})`; g.beginPath(); g.ellipse(0, -16 * k, 24 * k, 18 * k, 0, 0, 7); g.fill();
    g.strokeStyle = esc; g.lineWidth = 3 * k;
    for (const [px, d] of [[-8, pe], [-3, -pe], [6, pe], [11, -pe]]) { g.beginPath(); g.moveTo(px * k, -12 * k); g.lineTo(px * k + d, -5 * k); g.lineTo(px * k + d * 1.5 + 2 * k, 0); g.stroke(); }
    g.strokeStyle = esc; g.lineWidth = 1.6 * k; g.beginPath(); g.moveTo(-13 * k, -15 * k); g.quadraticCurveTo(-24 * k, -12 * k, -26 * k, -20 * k); g.stroke();
    g.fillStyle = cor; g.beginPath(); g.moveTo(-14 * k, -12 * k); g.quadraticCurveTo(-10 * k, -30 * k, 4 * k, -26 * k); g.quadraticCurveTo(14 * k, -22 * k, 14 * k, -14 * k); g.quadraticCurveTo(0, -8 * k, -14 * k, -12 * k); g.fill();
    g.fillStyle = '#3a4a3a'; g.beginPath(); for (let q = -10; q <= 6; q += 4) { const yy = -28 + Math.abs(q + 2) * 0.35; g.moveTo(q * k, (yy + 2) * k); g.lineTo((q + 2) * k, (yy - 5) * k); g.lineTo((q + 4) * k, (yy + 2) * k); } g.fill();
    g.fillStyle = cla; g.beginPath(); g.ellipse(17 * k, -20 * k, 7 * k, 5.5 * k, 0.25, 0, 7); g.fill();
    g.fillStyle = cor; g.beginPath(); g.moveTo(13 * k, -24 * k); g.lineTo(11 * k, -33 * k); g.lineTo(17 * k, -25 * k); g.fill();
    g.fillStyle = `rgb(${200 + brilho * 55},20,20)`; g.beginPath(); g.ellipse(19 * k, -22 * k, 2.4 * k, 1.6 * k, 0.3, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(20 * k, -17 * k); g.lineTo(21 * k, -13 * k); g.lineTo(22 * k, -17 * k); g.moveTo(17 * k, -16.5 * k); g.lineTo(17.8 * k, -13.5 * k); g.lineTo(18.6 * k, -16.5 * k); g.fill();
  } else { // ave
    const asa = correndo && b.voa ? Math.sin(t / 50) : 0.2;
    if (!b.voa || !correndo) { g.strokeStyle = '#c8783a'; g.lineWidth = 1.3 * k; g.beginPath(); g.moveTo(-2 * k, -5 * k); g.lineTo(-2 * k + pe * 0.5, 0); g.moveTo(3 * k, -5 * k); g.lineTo(3 * k - pe * 0.5, 0); g.stroke(); }
    g.fillStyle = esc; g.beginPath(); g.moveTo(-9 * k, -11 * k); g.lineTo(-17 * k, -14 * k); g.lineTo(-16 * k, -8 * k); g.fill();
    g.fillStyle = cor; g.beginPath(); g.ellipse(0, -11 * k, (b.gorda ? 10 : 9) * k, (b.gorda ? 7.5 : 6) * k, -0.1, 0, 7); g.fill();
    g.fillStyle = esc; g.beginPath(); g.ellipse(-1 * k, (-12 - asa * 6) * k, 7 * k, (2.6 + Math.abs(asa) * 2.5) * k, -0.2 - asa * 0.4, 0, 7); g.fill();
    g.fillStyle = cor; g.beginPath(); g.arc(8 * k, -17 * k, 4.6 * k, 0, 7); g.fill();
    if (b.papo) { g.fillStyle = '#d8352a'; g.beginPath(); g.ellipse(9 * k, -12 * k, 2 * k, 2.8 * k, 0, 0, 7); g.fill(); }
    if (b.crista) { g.fillStyle = '#111'; g.beginPath(); for (let q = 0; q < 4; q++) { g.moveTo((5 + q) * k, -20 * k); g.lineTo((4 + q * 1.4) * k, -26 * k); g.lineTo((6.5 + q) * k, -20.5 * k); } g.fill(); }
    g.fillStyle = b.crista ? '#f2c02a' : '#e8a040'; g.beginPath(); g.moveTo(12 * k, -18 * k); g.lineTo(16.5 * k, -16.5 * k); g.lineTo(12 * k, -15 * k); g.fill();
    olho(9.5, -18, 1.2);
  }
  g.restore();
}
const escBicho = id => id === 'chupacabra' ? [44, 84, 1.3] : CACA_BICHO[id].forma === 'porco' ? [40, 76, 2.05 / CACA_BICHO[id].tam] : [46, 74, 2.3 / Math.max(0.9, CACA_BICHO[id].tam)];
const bichoIcon = id => makeIcon('bicho2:' + id, () => { const [x, y, e] = escBicho(id); drawBicho(ctx, x, y, e, CACA_BICHO[id], 0, false); });
const bichoSombra = id => makeIcon('bichos2:' + id, () => { ctx.globalAlpha = 0.85; const [x, y, e] = escBicho(id); drawBicho(ctx, x, y, e, Object.assign({}, CACA_BICHO[id], { cor: '#5b6470', pintas: false, papo: false }), 0, false); ctx.globalAlpha = 1; });
function drawArma(g, id, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  if (id === 'estilingue') {
    g.strokeStyle = '#8a5a2b'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 22); g.lineTo(0, 2); g.lineTo(-11, -16); g.moveTo(0, 2); g.lineTo(11, -16); g.stroke();
    g.strokeStyle = '#6b4220'; g.lineWidth = 2; g.beginPath(); g.moveTo(-2, 20); g.lineTo(-2, 4); g.stroke();
    g.strokeStyle = '#c8402f'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-11, -15); g.quadraticCurveTo(0, -4, 11, -15); g.stroke();
    g.fillStyle = '#7a4a22'; g.beginPath(); g.ellipse(0, -8, 4, 2.6, 0, 0, 7); g.fill();
  } else {
    g.rotate(-0.45);
    g.fillStyle = '#8a5a2b'; g.strokeStyle = '#4a2a10'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-30, 2); g.lineTo(-14, -3); g.lineTo(-6, -3); g.lineTo(-6, 4); g.lineTo(-16, 5); g.lineTo(-30, 10); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#3a3f44'; g.beginPath(); g.roundRect(-8, -5, 40, 5, 2); g.fill(); g.beginPath(); g.roundRect(-8, -1, 36, 4, 2); g.fill();
    g.strokeStyle = '#3a3f44'; g.lineWidth = 1.6; g.beginPath(); g.arc(-8, 6, 3.5, 0, Math.PI); g.stroke();
  }
  g.restore();
}
const armaIcon = id => makeIcon('arma:' + id, () => drawArma(ctx, id, 48, 50, id === 'estilingue' ? 1.9 : 1.6));
function desenharCaca(t) {
  cacaRaf = 0;
  const cv = $('#cacaCv'); if (!cv || !caca || $('#caca').hidden) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight;
  if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (caca.fase === 'procurando' && t >= caca.aparece) soltarBicho(t, cw, ch);
  if (caca.fase === 'mira') moverBicho(t, cw, ch);
  if (caca.fase === 'mira' && caca.pedra && t - caca.pedra.t0 >= caca.pedra.dur) { const p = caca.pedra; caca.pedra = null; acertou(p.x, p.y, t); }
  if (!cacaRelogio || t - cacaRelogio > 1000) { cacaRelogio = t; renderCaca(); }
  const Lg = LUGAR_CACA[(caca.lugar) || cacaDe().lugar], noite = timeOfDay() === 'noite', escala = cw / 420;
  // céu, morros e mata ao fundo
  const ceu = g.createLinearGradient(0, 0, 0, ch * 0.45); ceu.addColorStop(0, noite ? '#1d2a4a' : '#8fd0f5'); ceu.addColorStop(1, noite ? '#3a4a6a' : '#e3f4ff');
  g.fillStyle = ceu; g.fillRect(0, 0, cw, ch * 0.45);
  if (noite) { g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(cw * 0.82, ch * 0.12, 12, 0, 7); g.fill(); }
  g.fillStyle = Lg.morro; g.beginPath(); g.moveTo(0, ch * 0.45); for (let x = 0; x <= cw; x += 30) g.lineTo(x, ch * 0.3 - Math.sin(x / 70 + 1) * ch * 0.06 - (Lg.id === 'serra' || Lg.id === 'chapada' ? Math.abs(Math.sin(x / 45)) * ch * 0.08 : 0)); g.lineTo(cw, ch * 0.45); g.fill();
  for (let k = 0; k < 9; k++) { const x = (k + 0.3) * cw / 8.5, r = (14 + (k * 7) % 10) * escala; g.fillStyle = tomCor(Lg.mato, -0.1 + (k % 3) * 0.06); g.fillRect(x - 2, ch * 0.4 - r, 4, r); g.beginPath(); g.arc(x, ch * 0.4 - r, r, 0, 7); g.fill(); }
  const chao = g.createLinearGradient(0, ch * 0.42, 0, ch); chao.addColorStop(0, Lg.chao); chao.addColorStop(1, tomCor(Lg.chao, -0.2));
  g.fillStyle = chao; g.fillRect(0, ch * 0.42, cw, ch);
  g.strokeStyle = tomCor(Lg.chao, -0.3); g.lineWidth = 1.2;
  for (let k = 0; k < 40; k++) { const x = (k * 97) % cw, y = ch * 0.5 + ((k * 53) % (ch * 0.48)); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x, y); g.lineTo(x + 2, y - 5); g.stroke(); }
  // o bicho (atrás das moitas quando está escondido)
  const a = caca.a, b = caca.bicho;
  const desenhaMoitas = () => { for (const [k, mx] of MOITAS.entries()) { const y = ch * (0.6 + (k % 3) * 0.12) + 4, r = 20 * escala, mexe = caca.fase === 'procurando' ? Math.sin(t / 70 + k) * 2 : 0; g.fillStyle = tomCor(Lg.mato, 0.05); for (const [dx, dy, rr] of [[-r * 0.7, 0, r * 0.8], [r * 0.7, 0, r * 0.8], [0, -r * 0.5, r]]) { g.beginPath(); g.arc(mx * cw + dx + mexe, y + dy - r * 0.4, rr, 0, 7); g.fill(); } } };
  if (caca.fase === 'mira' && a) {
    const p = posBicho(a, t), escondido = a.esconde > t;
    if (escondido) { desenhaMoitas(); g.globalAlpha = 0.5; drawBicho(g, p.x, p.y, escala * 1.4, b, t, false); g.globalAlpha = 1; }
    else {
      desenhaMoitas();
      g.save(); if (a.dir < 0) { g.translate(p.x * 2, 0); g.scale(-1, 1); }
      if (a.flash > t) g.globalAlpha = 0.5 + 0.5 * Math.sin(t / 25);
      drawBicho(g, p.x, p.y, escala * 1.4, b, t, a.pausa <= t);
      g.restore(); g.globalAlpha = 1;
    }
  } else desenhaMoitas();
  // arma na parte de baixo, a pedrinha voando, o tiro e o "Errou!/Acertou!"
  const arma = caca.arma || cacaDe().arma;
  drawArma(g, arma, cw / 2, ch - 22 * escala, 1.3 * escala);
  if (caca.pedra) { const p = caca.pedra, q = Math.min(1, (t - p.t0) / p.dur); g.fillStyle = '#6a625a'; g.beginPath(); g.arc(p.x0 + (p.x - p.x0) * q, p.y0 + (p.y - p.y0) * q - Math.sin(q * Math.PI) * 20, 4 * (1.2 - q * 0.5), 0, 7); g.fill(); }
  if (caca.tiro && t - caca.tiro.t < 180) { const q = (t - caca.tiro.t) / 180; g.fillStyle = `rgba(255,220,120,${1 - q})`; g.beginPath(); g.arc(caca.tiro.x, caca.tiro.y, 10 + q * 16, 0, 7); g.fill(); g.fillStyle = `rgba(255,255,255,${0.35 * (1 - q)})`; g.fillRect(0, 0, cw, ch); }
  if (caca.fala && t - caca.fala.t < 700) { const f = caca.fala, q = (t - f.t) / 700; g.globalAlpha = 1 - q; g.fillStyle = f.cor; g.font = `900 ${Math.round(18 * Math.max(0.8, escala))}px system-ui`; g.textAlign = 'center'; g.fillText(f.txt, f.x, f.y - 16 - q * 20); g.globalAlpha = 1; }
  if (caca.fase === 'mira' && pointer.cacaMira) { const m = pointer.cacaMira; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, 12, 0, 7); g.moveTo(m.x - 18, m.y); g.lineTo(m.x - 6, m.y); g.moveTo(m.x + 6, m.y); g.lineTo(m.x + 18, m.y); g.moveTo(m.x, m.y - 18); g.lineTo(m.x, m.y - 6); g.moveTo(m.x, m.y + 6); g.lineTo(m.x, m.y + 18); g.stroke(); }
  // resultado: o bicho pego aparece no meio
  if (caca.fase === 'resultado' && caca.bicho) { const q = Math.min(1, (t - (caca.tr || (caca.tr = t))) / 300); drawBicho(g, cw / 2, ch * 0.62, escala * 1.6 * (0.6 + 0.4 * q), caca.bicho, t, false); }
  if (noite) { g.fillStyle = 'rgba(20,30,70,.28)'; g.fillRect(0, 0, cw, ch); }
  cacaRaf = requestAnimationFrame(desenharCaca);
}
$('#caca').addEventListener('click', e => {
  if (e.target === $('#caca') || e.target.closest('[data-close]')) return fecharCaca();
  if (e.target.closest('#cacaBtn')) return entrarNoMato();
  const apb = e.target.closest('[data-arap]'); if (apb) return apb.dataset.arap === 'comprar' ? comprarArapuca() : arapucaAcao(Number(apb.dataset.arap));
  const ib = e.target.closest('[data-isca-arap]'); if (ib) { cacaDe().iscaArap = ib.dataset.iscaArap; save(); sfx('click'); return renderCaca(); }
  if (e.target.closest('[data-comprar-quirera]')) return comprarQuirera();
  if (e.target.closest('#cacaComprar')) return comprarMunicao();
  if (e.target.closest('[data-trevo-bichos]')) { resgatarBichos(); return renderCaca(); }
  if (e.target.closest('[data-trevo-domcaca]')) { resgatarDomCaca(); return renderCaca(); }
  if (e.target.closest('#cacaLivroBtn')) { if (cacaLivro) cacaLivroVisto(); cacaLivro = !cacaLivro; return renderCaca(); }
  const lb = e.target.closest('[data-lugar-caca]');
  if (lb) {
    if (caca && ['procurando', 'mira'].includes(caca.fase)) return;
    if (!temLugarCaca(lb.dataset.lugarCaca)) return comprarLugarCaca(lb.dataset.lugarCaca);
    cacaDe().lugar = lb.dataset.lugarCaca; save(); caca = { fase: 'pronto' }; sfx('click'); return renderCaca();
  }
  const ab = e.target.closest('[data-arma]');
  if (ab) {
    if (caca && ['procurando', 'mira'].includes(caca.fase)) return;
    const id = ab.dataset.arma;
    if (!cacaDe().armas[id]) return comprarArma(id);
    cacaDe().arma = id; save(); caca = { fase: 'pronto' }; sfx('click'); return renderCaca();
  }
});
// o tiro vale no instante do toque
$('#cacaCv').addEventListener('pointerdown', e => {
  if (!caca || caca.fase !== 'mira') return;
  e.preventDefault(); const r = $('#cacaCv').getBoundingClientRect();
  atirar(e.clientX - r.left, e.clientY - r.top);
});
$('#cacaCv').addEventListener('pointermove', e => { const r = $('#cacaCv').getBoundingClientRect(); pointer.cacaMira = e.pointerType === 'mouse' ? { x: e.clientX - r.left, y: e.clientY - r.top } : null; });
$('#cacaCv').addEventListener('pointerleave', () => { pointer.cacaMira = null; });
$('#cacaCv').addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ($('#caca').hidden) return;
  if (e.key === 'Escape') fecharCaca();
  else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && caca && ['pronto', 'resultado'].includes(caca.fase)) { e.preventDefault(); entrarNoMato(); }
});
if (location.protocol === 'file:') window.__caca = () => caca; // só para testes locais
// A entrada da caçada na roça: uma trilha para o mato, com árvores e a plaquinha com o alvo.
function drawMataCaca(x, y, W) {
  const s = W / 100;
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(x, y, 60 * s, 18 * s, 0, 0, 7); ctx.fill();
  for (const [dx, dy, r, c] of [[-30, -6, 22, '#2f6f22'], [22, -10, 26, '#3a7f2a'], [-4, -18, 20, '#2a5f1e']]) {
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x + (dx - 3) * s, y + (dy - r * 1.2) * s, 6 * s, r * 1.2 * s);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx * s, y + (dy - r * 1.4) * s, r * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(x + (dx - r * 0.3) * s, y + (dy - r * 1.7) * s, r * 0.4 * s, 0, 7); ctx.fill();
  }
  for (const [dx, dy] of [[-44, 4], [40, 6], [8, 8]]) { ctx.fillStyle = '#4f9a2f'; ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s - 6 * s, 9 * s, 0, 7); ctx.arc(x + (dx + 8) * s, y + dy * s - 4 * s, 7 * s, 0, 7); ctx.fill(); }
  // trilha de terra
  ctx.fillStyle = '#c9a36a'; ctx.beginPath(); ctx.ellipse(x - 4 * s, y + 10 * s, 12 * s, 5 * s, 0, 0, 7); ctx.fill();
  // plaquinha com o alvo
  const px = x + 30 * s, py = y + 14 * s;
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(px - 2 * s, py - 30 * s, 4 * s, 30 * s);
  ctx.fillStyle = '#d39a5c'; ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.roundRect(px - 16 * s, py - 44 * s, 32 * s, 18 * s, 3 * s); ctx.fill(); ctx.stroke();
  for (const [r, c] of [[7, '#c8402f'], [5, '#fff'], [3, '#c8402f']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py - 35 * s, r * s, 0, 7); ctx.fill(); }
}

// ---------- Mural da caçada: uma foto de cada bicho, na parede da sala ----------
const fotoImgs = {};
function fotoImg(id) { const src = bichoIcon(id); if (!fotoImgs[src]) { const im = new Image(); im.src = src; fotoImgs[src] = im; } const im = fotoImgs[src]; return im.complete && im.naturalWidth ? im : null; }
function drawMural(s, t, home) {
  const col = (s.caca && s.caca.col) || {}, fotos = CACA_BICHOS.filter(b => col[b.id]);
  if (!fotos.length) return;
  const W = L.W;
  // quadro de cortiça na parede da esquerda, em cima do sofá
  quad(P(0, 0.92, 0.7), P(0, 3.28, 0.7), P(0, 3.28, 1.26), P(0, 0.92, 1.26), '#8a5a33', 'rgba(0,0,0,.35)', 1.5);
  quad(P(0, 0.98, 0.74), P(0, 3.22, 0.74), P(0, 3.22, 1.22), P(0, 0.98, 1.22), '#d8a868');
  fotos.forEach((b, k) => {
    const c = P(0, 1.14 + (k % 8) * 0.28, k < 8 ? 1.1 : 0.86), w = W * 0.12, ang = ((k * 37) % 9 - 4) * 0.02;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-w / 2 + 1.5, -w / 2 + 1.5, w, w * 1.12);
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(-w / 2, -w / 2, w, w * 1.12);
    ctx.fillStyle = '#cfe8b8'; ctx.fillRect(-w / 2 + w * 0.08, -w / 2 + w * 0.08, w * 0.84, w * 0.8);
    const im = fotoImg(b.id); if (im) ctx.drawImage(im, -w / 2 + w * 0.08, -w / 2 + w * 0.08, w * 0.84, w * 0.8);
    ctx.fillStyle = '#c8402f'; ctx.beginPath(); ctx.arc(0, -w / 2 + 1, Math.max(1.5, w * 0.06), 0, 7); ctx.fill(); // tachinha
    ctx.restore();
  });
  const m = P(0, 2.1, 0.98);
  if (hover && hover.kind === 'mural') { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; poly([P(0, 0.92, 0.7), P(0, 3.28, 0.7), P(0, 3.28, 1.26), P(0, 0.92, 1.26)]); ctx.stroke(); }
  hits.push({ kind: 'mural', n: fotos.length, x: m.x, y: m.y, r: W * 0.45 });
}
// ---------- Pragas que invadem a roça ----------
// No máximo uma vez a cada 8 horas, e só com você na roça (jogo aberto). Toca um alarme, a tela fica com um
// alerta vermelho e o bicho (rato; javali a partir do nível 12) corre até um canteiro. Aí:
//  · a armadilha (se tiver e estiver carregada) pega o bicho — e recarrega;
//  · senão, o cachorro da roça acordado (com ração) corre e espanta, em 3 de cada 4 vezes;
//  · senão, você tem 60 segundos para clicar e espantar; se não, ele come um pouco de 1 planta (o javali, até 2) e vai embora.
let invasor = null;
const INVASAO_ESPERA = 60e3, INVASAO_CADA = 8 * 3600e3, ARMADILHA = { nivel: CACA_NIVEL, custo: 1500, recarga: 16 * 3600e3 };
const sessaoIni = Date.now();
const armadilhaPronta = () => !!state.armadilha && Date.now() >= (state.armadilha.pronta || 0);
function invasaoTick(forca) {
  if (!state || !isHome() || state.level < CACA_NIVEL || invasor) return;
  const agora = Date.now();
  if (!forca) {
    if (scene !== 'roca' || document.hidden || !$('#pesca').hidden || !$('#caca').hidden || agora - sessaoIni < 60e3) return; // só com você olhando a roça
    if (agora - (state.invasaoUlt || 0) < INVASAO_CADA) return;
    if (Math.random() > 1 / 450) return; // passou das 8h: acontece num momento qualquer (≈ 15 min jogando, em média)
  }
  const alvos = state.plots.map((p, i) => i).filter(i => { const p = state.plots[i]; return p.s === 'growing' && !p.podre; });
  if (!alvos.length) return;
  state.invasaoUlt = agora; save();
  const tipo = state.level >= 12 && Math.random() < 0.35 ? 'javali' : 'rato', i = alvos[Math.floor(Math.random() * alvos.length)];
  const u = plotU(i) + 0.5, v = plotV(i) + 0.5, lado = Math.random() < 0.5 ? 1 : -1;
  const d = state.dogs && state.dogs.roca;
  invasor = { tipo, i, u, v, fase: 'chegando', t0: performance.now(), de: [u + 4 * lado, v + 3.5], dir: lado > 0 ? -1 : 1,
    destino: armadilhaPronta() ? 'armadilha' : d && dogAwake(d) && Math.random() < 0.75 ? 'cachorro' : 'espera' };
  sfx('alarme'); try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* sem vibração */ }
  toast(`⚠️ ${tipo === 'javali' ? '🐗 Um javali' : '🐀 Um rato'} está invadindo a plantação!`, 'bad');
}
const nomePraga = v => v.tipo === 'javali' ? 'o javali' : 'o rato';
// Passo da animação (chamado a cada quadro).
function passoInvasao(t) {
  const v = invasor; if (!v) return;
  const dt = t - v.t0;
  if (v.fase === 'chegando' && dt > 2200) {
    v.t0 = t;
    if (v.destino === 'armadilha') { v.fase = 'presa'; sfx('armadilha'); }
    else if (v.destino === 'cachorro') { v.fase = 'cachorro'; sfx('bark'); const c = posOf(state, 'roca', 'canil'); v.cao = [c[0], c[1]]; }
    else { v.fase = 'espera'; v.limite = Date.now() + INVASAO_ESPERA; }
  } else if (v.fase === 'presa' && dt > 2600) {
    state.armadilha.pronta = Date.now() + ARMADILHA.recarga;
    const b = CACA_BICHO[v.tipo]; addCoins(b.moedas, null); const dropTxt = aplicaDropsCaca(b);
    const msg = `🪤 A armadilha pegou ${nomePraga(v)} na plantação! +${b.moedas} moedas${dropTxt}. Ela recarrega em ${fmt(ARMADILHA.recarga / 1000)}.`;
    toast(msg, 'good'); addNews(msg); invasor = null; done();
  } else if (v.fase === 'cachorro' && dt > 1500 && !v.fugindo) { v.fugindo = t; sfx('bark'); }
  else if (v.fase === 'cachorro' && v.fugindo && t - v.fugindo > 1800) {
    const d = state.dogs.roca, msg = `🐕 ${d ? d.nome : 'Seu cachorro'} correu atrás ${v.tipo === 'javali' ? 'do javali' : 'do rato'} e espantou da plantação!`;
    addXP(d ? DOG[d.raca].xpPega : 5, null); toast(msg, 'good'); addNews(msg); invasor = null; done();
  } else if (v.fase === 'espera' && Date.now() >= v.limite) { v.fase = 'comendo'; v.t0 = t; sfx('bicho_porco'); }
  else if (v.fase === 'comendo' && dt > 3200) {
    const comidas = [v.i];
    if (v.tipo === 'javali') { const viz = neighbors(v.i).filter(j => state.plots[j].s === 'growing' && !state.plots[j].podre); if (viz.length) comidas.push(viz[Math.floor(Math.random() * viz.length)]); }
    for (const i of comidas) { const p = state.plots[i]; if (p.s === 'growing' && CROP[p.c]) p.dmg = Math.min(CROP[p.c].rend - 1, (p.dmg || 0) + (v.tipo === 'javali' ? 2 : 1)); }
    const msg = `${v.tipo === 'javali' ? '🐗 O javali' : '🐀 O rato'} comeu um pouco de ${comidas.length} planta${comidas.length > 1 ? 's' : ''} e foi embora. Um cachorro de guarda ou a armadilha evitam isso!`;
    toast(msg, 'bad'); addNews(msg); v.fase = 'fugindo'; v.t0 = t; done();
  } else if (v.fase === 'fugindo' && dt > 1600) invasor = null;
}
function espantarInvasor() {
  const v = invasor; if (!v || v.fase !== 'espera') return;
  const q = iso(v.u, v.v), pos = { x: q.x, y: q.y - L.W * 0.3 };
  addXP(v.tipo === 'javali' ? 6 : 3, pos); addCoins(v.tipo === 'javali' ? 12 : 5, pos); sfx('hoe'); popupAt(pos, 'Xô!', '#c8402f');
  toast(`${v.tipo === 'javali' ? '🐗 Espantou o javali' : '🐀 Espantou o rato'}! A plantação está salva.`, 'good');
  v.fase = 'fugindo'; v.t0 = performance.now(); done();
}
function drawInvasor(t) {
  passoInvasao(t);
  const v = invasor; if (!v) return;
  const W = L.W, b = CACA_BICHO[v.tipo], esc = W / 100 * (v.tipo === 'javali' ? 1.9 : 2.7), dt = t - v.t0;
  const lerp2 = (a, c, k) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
  let pos = [v.u, v.v], correndo = false, dir = v.dir, alfa = 1;
  if (v.fase === 'chegando') { pos = lerp2(v.de, [v.u, v.v], Math.min(1, dt / 2200)); correndo = true; }
  else if (v.fase === 'fugindo' || (v.fase === 'cachorro' && v.fugindo)) { const k = Math.min(1, (t - (v.fugindo || v.t0)) / 1600); pos = lerp2([v.u, v.v], [v.de[0], v.de[1] + 1], k); correndo = true; dir = -v.dir; alfa = 1 - Math.max(0, k - 0.7) / 0.3; }
  const q = iso(pos[0], pos[1]), pulo = correndo ? Math.abs(Math.sin(t / 90)) * W * 0.03 : 0;
  // comendo: a planta balança e voam pedacinhos de folha
  if (v.fase === 'comendo') {
    for (let k = 0; k < 6; k++) { const f = ((dt / 500) + k / 6) % 1; ctx.globalAlpha = 1 - f; ctx.fillStyle = k % 2 ? '#4fa83a' : '#8a6a3a'; ctx.beginPath(); ctx.ellipse(q.x + Math.cos(k * 1.9) * f * W * 0.3, q.y - W * 0.1 - f * W * 0.25, 3, 1.6, k, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.globalAlpha = alfa; if (dir < 0) { ctx.translate(q.x * 2, 0); ctx.scale(-1, 1); }
  const mastiga = v.fase === 'comendo' ? Math.sin(t / 60) * W * 0.012 : 0;
  drawBicho(ctx, q.x, q.y + W * 0.05 - pulo + mastiga, esc, b, t, correndo || v.fase === 'comendo');
  ctx.restore(); ctx.globalAlpha = 1;
  // armadilha: a gaiolinha cai em cima do bicho
  if (v.fase === 'presa') {
    const k = Math.min(1, dt / 250), gy = q.y - W * 0.6 * (1 - k), w = W * (v.tipo === 'javali' ? 0.84 : 0.58), h = w * 0.8;
    ctx.strokeStyle = '#5a646c'; ctx.lineWidth = 2.2; ctx.fillStyle = 'rgba(90,100,108,.15)';
    ctx.beginPath(); ctx.rect(q.x - w / 2, gy - h, w, h); ctx.fill(); ctx.stroke();
    for (let x = 1; x < 6; x++) { ctx.beginPath(); ctx.moveTo(q.x - w / 2 + (w * x) / 6, gy - h); ctx.lineTo(q.x - w / 2 + (w * x) / 6, gy); ctx.stroke(); }
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(q.x - w / 2 - 2, gy - h - 4, w + 4, 5);
    if (k >= 1) { ctx.font = `900 ${Math.round(W * 0.13)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#2f8a2f'; ctx.fillText('Pego! 🪤', q.x, gy - h - 10 - Math.min(10, (dt - 250) / 40)); }
  }
  // cachorro: sai da casinha correndo e vai atrás do bicho
  if (v.fase === 'cachorro' && v.cao) {
    const k = Math.min(1, dt / 1500), cp = v.fugindo ? lerp2([v.u - 0.3, v.v + 0.2], [v.de[0] - 0.4, v.de[1] + 1.2], Math.min(1, (t - v.fugindo) / 1700)) : lerp2(v.cao, [v.u - 0.3, v.v + 0.2], k);
    const cq = iso(cp[0], cp[1]); const d = state.dogs.roca;
    drawDog(cq.x, cq.y - Math.abs(Math.sin(t / 80)) * W * 0.03, W * 0.7, t, d ? d.raca : 'caramelo');
    if (!v.fugindo || t - v.fugindo < 900) { ctx.font = `900 ${Math.round(W * 0.12)}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#7a3a12'; ctx.fillText('Au! Au!', cq.x, cq.y - W * 0.55); }
  }
  // esperando você: balão "!" com a contagem dos 60 segundos
  if (v.fase === 'espera') {
    const falta = Math.max(0, v.limite - Date.now()) / INVASAO_ESPERA, by = q.y - W * 0.45 + Math.sin(t / 200) * 3, R = clamp(W * 0.12, 11, 18);
    ctx.fillStyle = falta < 0.3 ? '#e0463a' : '#fff3c4'; ctx.strokeStyle = '#8f2a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, by, R, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c8402f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, by, R + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * falta); ctx.stroke();
    ctx.fillStyle = falta < 0.3 ? '#fff' : '#c8402f'; ctx.font = `900 ${Math.round(R * 1.3)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', q.x, by + 1); ctx.textBaseline = 'alphabetic';
    if (hover && hover.kind === 'invasor') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(q.x, q.y + W * 0.05, W * 0.3, W * 0.1, 0, 0, 7); ctx.stroke(); }
    hits.push({ kind: 'invasor', x: q.x, y: q.y - W * 0.12, r: Math.max(W * 0.34, 22) });
  }
}
// Alerta vermelho na tela inteira enquanto o bicho está na plantação (desenhado por cima de tudo).
function drawAlertaInvasao(t) {
  const v = invasor; if (!v || !['chegando', 'espera', 'comendo'].includes(v.fase)) return;
  const pu = 0.5 + 0.5 * Math.sin(t / 180), cw = L.cw, ch = L.ch;
  const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  g.addColorStop(0, 'rgba(220,30,20,0)'); g.addColorStop(1, `rgba(220,30,20,${0.25 + pu * 0.3})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = `rgba(230,40,30,${0.5 + pu * 0.5})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, cw - 8, ch - 8);
  const txt = v.fase === 'comendo' ? `${v.tipo === 'javali' ? '🐗 O javali' : '🐀 O rato'} está comendo a plantação!` : v.fase === 'espera' ? `⚠️ ${v.tipo === 'javali' ? 'JAVALI' : 'RATO'} NA PLANTAÇÃO! Toque nele para espantar` : `⚠️ ${v.tipo === 'javali' ? 'JAVALI' : 'RATO'} INVADINDO A ROÇA!`;
  ctx.font = `900 ${Math.round(clamp(cw * 0.03, 15, 24))}px 'Baloo 2', system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 30, y = ch * (cw < 700 ? 0.3 : 0.26);
  ctx.fillStyle = `rgba(200,30,20,${0.85 + pu * 0.15})`; ctx.beginPath(); ctx.roundRect(cw / 2 - w / 2, y - 20, w, 40, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(txt, cw / 2, y + 1); ctx.textBaseline = 'alphabetic';
}
// ---------- Armadilha de pragas: comprada na Loja › Itens. Fica na roça e pega um bicho por vez. ----------
function comprarArmadilha() {
  if (state.armadilha) return;
  if (state.level < ARMADILHA.nivel) return toast(`A armadilha libera no nível ${ARMADILHA.nivel}.`);
  if (state.coins < ARMADILHA.custo) return toast(`A armadilha custa ${ARMADILHA.custo.toLocaleString('pt-BR')} moedas.`, 'bad');
  state.coins -= ARMADILHA.custo; state.armadilha = { pronta: 0 }; sfx('buy');
  toast('🪤 Armadilha comprada! Ela fica perto da plantação e pega a próxima praga que aparecer (dá para mudar de lugar no Mover).', 'good'); done();
}
function tipChocadeira() {
  const ovos = (state.chocadeira && state.chocadeira.ovos) || [];
  if (!ovos.length) return '<b>🥚 Chocadeira</b><br>Vazia. Quando um casal de aves estiver alimentado, o ovo vem para cá.<br>Clique para abrir.';
  const prox = Math.min(...ovos.map(o => o.nascimento)) - Date.now();
  return `<b>🥚 Chocadeira</b><br>${ovos.length} ovo${ovos.length > 1 ? 's' : ''} · ${prox > 0 ? `o próximo nasce em ${fmt(prox / 1000)}` : 'esperando vaga no abrigo'}<br>Clique para abrir.`;
}
function drawChocadeira(x, y, W, ovos, t) {
  const s = W / 100, quente = ovos.length > 0;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y, 24 * s, 7 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a5a33'; ctx.fillRect(x - 20 * s, y - 10 * s, 40 * s, 10 * s);
  ctx.fillStyle = '#6b4220'; ctx.fillRect(x - 20 * s, y - 3 * s, 40 * s, 3 * s);
  ctx.fillStyle = quente ? 'rgba(255,200,90,.45)' : 'rgba(190,225,240,.4)'; ctx.strokeStyle = '#5a646c'; ctx.lineWidth = 1.6 * s;
  ctx.beginPath(); ctx.moveTo(x - 17 * s, y - 10 * s); ctx.quadraticCurveTo(x - 17 * s, y - 34 * s, x, y - 34 * s); ctx.quadraticCurveTo(x + 17 * s, y - 34 * s, x + 17 * s, y - 10 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let k = 0; k < Math.min(4, ovos.length || 0); k++) { ctx.fillStyle = '#f6efe0'; ctx.beginPath(); ctx.ellipse(x + (k - 1.5) * 8 * s, y - 14 * s, 3.4 * s, 4.4 * s, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.8 * s; ctx.stroke(); }
  if (quente) { const pu = 0.5 + 0.5 * Math.sin(t / 400); ctx.fillStyle = `rgba(255,150,40,${0.55 + pu * 0.4})`; ctx.beginPath(); ctx.arc(x, y - 27 * s, 2.6 * s, 0, 7); ctx.fill(); }
}
function drawArmadilha(x, y, W, pronta, t) {
  const s = W / 100;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 7 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#8a5a33'; ctx.beginPath(); ctx.moveTo(x - 20 * s, y); ctx.lineTo(x + 20 * s, y); ctx.lineTo(x + 20 * s, y - 4 * s); ctx.lineTo(x - 20 * s, y - 4 * s); ctx.fill();
  ctx.strokeStyle = '#5a646c'; ctx.lineWidth = 1.6 * s; ctx.fillStyle = 'rgba(90,100,108,.12)';
  ctx.beginPath(); ctx.rect(x - 18 * s, y - 24 * s, 36 * s, 20 * s); ctx.fill(); ctx.stroke();
  for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x - 18 * s + k * 6 * s, y - 24 * s); ctx.lineTo(x - 18 * s + k * 6 * s, y - 4 * s); ctx.stroke(); }
  // porta: aberta (pronta, com a iscazinha) ou fechada (recarregando)
  if (pronta) { ctx.beginPath(); ctx.moveTo(x + 18 * s, y - 24 * s); ctx.lineTo(x + 30 * s, y - 32 * s); ctx.stroke(); ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 5 * s); ctx.lineTo(x + 4 * s, y - 5 * s); ctx.lineTo(x, y - 11 * s); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(40,40,40,.35)'; ctx.fillRect(x + 16 * s, y - 24 * s, 3 * s, 20 * s); }
}
if (location.protocol === 'file:') window.__invadir = () => { invasaoTick(true); return invasor; }; // só para testes

// ============================================================
// Trevos 🍀: a moeda verde. Não se compra: ganha resgatando peixes novos (no Livro de peixes),
// níveis do domínio de pesca e conquistas. Serve para a Loja do Trevo, com itens exclusivos.
// Tudo o que já foi feito antes (peixes, níveis, conquistas) também pode ser resgatado.
// ============================================================
const TREVO_PEIXE = { comum: 1, incomum: 2, raro: 3, 'épico': 5, 'lendário': 10 };
const TREVO_DOMINIO = [0, 0, 2, 2, 3, 3, 4, 4, 5, 5, 10]; // ao chegar em cada nível (índice = nível)
function trevosDe() {
  const t = state.trevos || (state.trevos = { saldo: 0, peixes: {}, dominio: {}, conq: {}, itens: {}, maestria: {} });
  for (const k of ['peixes', 'dominio', 'conq', 'itens', 'maestria']) t[k] = t[k] || {};
  t.saldo = t.saldo || 0;
  // conserto: na primeira versão o nível 2 do domínio pagava 0 e os outros um nível atrasado; paga a diferença
  if (!t.domFix) { t.domFix = 1; const antigo = [0, 0, 2, 2, 3, 3, 4, 4, 5, 10]; for (const nv of Object.keys(t.dominio)) t.saldo += Math.max(0, (TREVO_DOMINIO[nv] || 0) - (antigo[nv - 1] || 0)); }
  return t;
}
const temTrevoItem = id => !!(state && state.trevos && state.trevos.itens && state.trevos.itens[id]);
const PEIXES_REAIS = () => PEIXES.filter(p => !p.lixo);
const CONQUISTAS = [
  { id: 'caca30',     nome: 'Mateiro',               desc: 'Caçar ou pegar na arapuca 30 bichos',   alvo: 30,    valor: () => (state.caca && state.stats.caca) || 0, trevos: 5 },
  { id: 'chupacabra', nome: 'Caçador de lendas',     desc: 'Pegar o Chupa-cabra',                   alvo: 1,     valor: () => (state.caca && state.caca.col && state.caca.col.chupacabra) || 0, trevos: 10 },
  { id: 'colher100',  nome: 'Mão na terra',          desc: 'Colher 100 vezes',                      alvo: 100,   valor: () => state.stats.colheitas || 0, trevos: 3 },
  { id: 'colher1000', nome: 'Lavrador de mão cheia', desc: 'Colher 1.000 vezes',                    alvo: 1000,  valor: () => state.stats.colheitas || 0, trevos: 10 },
  { id: 'coletas200', nome: 'Cuidador do rancho',    desc: 'Recolher 200 produtos dos animais',     alvo: 200,   valor: () => state.stats.coletas || 0, trevos: 5 },
  { id: 'vender50k',  nome: 'Bom de negócio',        desc: 'Vender 50.000 moedas em produtos',      alvo: 50000, valor: () => state.stats.vendido || 0, trevos: 5 },
  { id: 'ajudas30',   nome: 'Vizinho camarada',      desc: 'Ajudar amigos 30 vezes',                alvo: 30,    valor: () => state.stats.ajudas || 0, trevos: 5 },
  { id: 'peixes50',   nome: 'Pescador de fé',        desc: 'Pegar 50 peixes (vara ou tarrafa)',     alvo: 50,    valor: () => state.stats.peixes || 0, trevos: 4 },
  { id: 'lendario',   nome: 'Lenda do rio',          desc: 'Pegar um peixe lendário',               alvo: 1,     valor: () => PEIXES_REAIS().filter(p => p.raro === 'lendário' && state.col[p.id]).length, trevos: 8 },
  { id: 'livro',      nome: 'Livro completo',        desc: 'Pegar todas as espécies de peixe',      alvo: () => PEIXES_REAIS().length, valor: () => PEIXES_REAIS().filter(p => state.col[p.id]).length, trevos: 20 },
  { id: 'rios',       nome: 'Conhece todos os rios', desc: 'Ter todos os pontos de pesca',          alvo: () => PONTOS.length, valor: () => PONTOS.filter(p => temPonto(p.id)).length, trevos: 10 },
  { id: 'animais10',  nome: 'Fazendão',              desc: 'Ter 10 animais ao mesmo tempo',         alvo: 10,    valor: () => state.animals.length, trevos: 4 },
  { id: 'amigos5',    nome: 'Roça cheia de amigos',  desc: 'Ter 5 amigos',                          alvo: 5,     valor: () => state.friends.length, trevos: 4 },
  { id: 'nivel10',    nome: 'Sitiante',              desc: 'Chegar ao nível 10',                    alvo: 10,    valor: () => state.level, trevos: 3 },
  { id: 'nivel20',    nome: 'Fazendeiro',            desc: 'Chegar ao nível 20',                    alvo: 20,    valor: () => state.level, trevos: 6 },
  { id: 'nivel30',    nome: 'Coronel da roça',       desc: 'Chegar ao nível 30',                    alvo: 30,    valor: () => state.level, trevos: 10 },
];
const alvoDe = c => typeof c.alvo === 'function' ? c.alvo() : c.alvo;
const conqPronta = c => !trevosDe().conq[c.id] && c.valor() >= alvoDe(c);
// Domínio de cada espécie (estrelas): quanto mais você pega o mesmo peixe, mais estrelas ele ganha.
// Cada estrela faz ele morder 15% mais (entre os que mordem na isca e no ponto) e vale trevos.
const MAESTRIA = { comum: [10, 30, 75, 150], incomum: [8, 20, 50, 100], raro: [5, 15, 35, 70], 'épico': [3, 8, 20, 40], 'lendário': [2, 5, 10, 20] };
const TREVO_ESTRELA = [1, 2, 3, 5];
const estrelasDe = p => { const n = state.col[p.id] || 0, m = MAESTRIA[p.raro] || MAESTRIA.comum; return m.filter(x => n >= x).length; };
const estrelasPegas = id => (trevosDe().maestria[id] || 0);
// trevos que faltam resgatar de um peixe: a 1ª vez que pegou + as estrelas novas
function trevosDoPeixe(p) {
  const t = trevosDe(); if (!state.col[p.id]) return 0;
  let n = t.peixes[p.id] ? 0 : (TREVO_PEIXE[p.raro] || 1);
  for (let k = estrelasPegas(p.id); k < estrelasDe(p); k++) n += TREVO_ESTRELA[k];
  return n;
}
const peixesAResgatar = () => PEIXES_REAIS().filter(p => trevosDoPeixe(p) > 0);
const pomarAResgatar = () => { const nv = dominioPomar().nv, t = trevosDe(), r = []; t.pomar = t.pomar || {}; for (let n = 2; n <= nv; n++) if (!t.pomar[n]) r.push(n); return r; };
function resgatarPomar() {
  const l = pomarAResgatar(), t = trevosDe(); if (!l.length) return;
  let n = 0; for (const nv of l) { t.pomar[nv] = true; n += TREVO_DOMINIO[nv] || 0; }
  ganharTrevos(n, `Domínio do pomar ${l.length > 1 ? `níveis ${l[0]} a ${l[l.length - 1]}` : `nível ${l[0]}`}.`);
}
const dominioAResgatar = () => { const nv = dominio().nv, r = []; for (let n = 2; n <= nv; n++) if (!trevosDe().dominio[n]) r.push(n); return r; };
// conta as linhas de "Para resgatar" (todos os peixes juntos são uma linha, o domínio é outra, e cada conquista)
const trevosPendentes = () => !state ? 0 : (peixesAResgatar().length ? 1 : 0) + (dominioAResgatar().length ? 1 : 0) + (pomarAResgatar().length ? 1 : 0) + (state.level >= CACA_NIVEL && bichosAResgatar().length ? 1 : 0) + (state.level >= CACA_NIVEL && cacaDomAResgatar().length ? 1 : 0) + CONQUISTAS.filter(conqPronta).length;
function ganharTrevos(n, motivo) {
  if (!n) { done(); renderTabs(); return; }
  trevosDe().saldo += n; sfx('level');
  toast(`🍀 +${n} trevo${n > 1 ? 's' : ''}! ${motivo}`, 'good');
  done(); renderTabs(); renderHUD();
}
function marcarPeixe(p) { const t = trevosDe(), n = trevosDoPeixe(p); t.peixes[p.id] = true; t.maestria[p.id] = estrelasDe(p); return n; }
function resgatarPeixe(id) {
  const p = PEIXE[id]; if (!p || !trevosDoPeixe(p)) return;
  const e = estrelasDe(p), n = marcarPeixe(p);
  ganharTrevos(n, `${p.nome}${e ? ` ${'★'.repeat(e)}` : ''} no livro.`);
}
function resgatarTodosPeixes() {
  const l = peixesAResgatar(); if (!l.length) return;
  let n = 0; for (const p of l) n += marcarPeixe(p);
  ganharTrevos(n, `${l.length} peixe${l.length > 1 ? 's' : ''} do livro.`);
}
function resgatarDominio() {
  const l = dominioAResgatar(), t = trevosDe(); if (!l.length) return;
  let n = 0; for (const nv of l) { t.dominio[nv] = true; n += TREVO_DOMINIO[nv] || 0; }
  ganharTrevos(n, `Domínio de pesca ${l.length > 1 ? `níveis ${l[0]} a ${l[l.length - 1]}` : `nível ${l[0]}`}.`);
}
function resgatarConquista(id) {
  const c = CONQUISTAS.find(x => x.id === id); if (!c || !conqPronta(c)) return;
  trevosDe().conq[id] = true; ganharTrevos(c.trevos, `Conquista: ${c.nome}.`);
}
// Loja do Trevo: só coisas exclusivas.
const TREVO_LOJA = [
  { id: 'chapeu:couro',         nome: 'Chapéu de couro',            tipo: 'Avatar',  preco: 15, desc: 'Chapéu de vaqueiro com cordão dourado.' },
  { id: 'chapeu:flores',        nome: 'Coroa de flores',            tipo: 'Avatar',  preco: 15, desc: 'Uma coroa de flores do campo.' },
  { id: 'mao:lampiao',          nome: 'Lampião',                    tipo: 'Avatar',  preco: 20, desc: 'Lampião aceso na mão do avatar.' },
  { id: 'musica:4',             nome: 'Música "Moda de Viola"',     tipo: 'Música',  preco: 25, desc: 'Viola caipira em terças, bem de raiz.' },
  { id: 'musica:5',             nome: 'Música "Forró na Roça"',     tipo: 'Música',  preco: 25, desc: 'Sanfona, zabumba e triângulo.' },
  { id: 'enfeite:arcoflores',   nome: 'Arco de flores',             tipo: 'Enfeite', preco: 20, desc: 'Arco de madeira coberto de flores (+2% XP).' },
  { id: 'enfeite:peixedourado', nome: 'Estátua do Peixe Dourado',   tipo: 'Enfeite', preco: 30, desc: 'Um dourado de ouro saltando (+3% XP).' },
  { id: 'casa:trevo',           nome: 'Tema Casa do Trevo',         tipo: 'Tema',    preco: 40, desc: 'Casa e celeiro verde-menta, com trevo na fachada.' },
  { id: 'casa:real',            nome: 'Tema Rancho Real',           tipo: 'Tema',    preco: 60, desc: 'Casa e celeiro vinho com dourado.' },
  { id: 'chapeu:cangaceiro',    nome: 'Chapéu de cangaceiro',       tipo: 'Avatar',  preco: 20, desc: 'Meia-lua de couro com estrelas douradas.' },
  { id: 'chapeu:boina',         nome: 'Boina',                      tipo: 'Avatar',  preco: 12, desc: 'Boina vinho, charmosa.' },
  { id: 'chapeu:panama',        nome: 'Chapéu-panamá',              tipo: 'Avatar',  preco: 15, desc: 'Branquinho, com fita preta.' },
  { id: 'chapeu:gorro',         nome: 'Gorro de lã',                tipo: 'Avatar',  preco: 12, desc: 'Para as manhãs frias do inverno.' },
  { id: 'mao:sanfona',          nome: 'Sanfona',                    tipo: 'Avatar',  preco: 25, desc: 'Uma sanfona pendurada no braço.' },
  { id: 'mao:buque',            nome: 'Buquê de flores',            tipo: 'Avatar',  preco: 15, desc: 'Flores do campo na mão.' },
  { id: 'mao:regador',          nome: 'Regador dourado',            tipo: 'Avatar',  preco: 20, desc: 'O regador de quem cuida bem da roça.' },
  { id: 'musica:6',             nome: 'Música "Seresta ao Luar"',   tipo: 'Música',  preco: 25, desc: 'Valsa de flauta e violão, para a noite.' },
  { id: 'enfeite:ipe',          nome: 'Ipê-amarelo',                tipo: 'Enfeite', preco: 25, desc: 'A árvore do cerrado, soltando pétalas (+3% XP).' },
  { id: 'enfeite:fogueira',     nome: 'Fogueira de São João',       tipo: 'Enfeite', preco: 25, desc: 'Fogueira acesa com faíscas (+2% XP).' },
  { id: 'enfeite:balanco',      nome: 'Balanço de madeira',         tipo: 'Enfeite', preco: 20, desc: 'Um balanço que vai e vem (+2% XP).' },
  { id: 'enfeite:carrodeboi',   nome: 'Carro de boi',               tipo: 'Enfeite', preco: 35, desc: 'O carro de boi com rodas de madeira (+3% XP).' },
  { id: 'casa:lavanda',         nome: 'Tema Casa Lavanda',          tipo: 'Tema',    preco: 40, desc: 'Casa e celeiro lilás com telhado roxo.' },
  { id: 'casa:cerrado',         nome: 'Tema Casa do Cerrado',       tipo: 'Tema',    preco: 45, desc: 'Cor de terra, com telhado cor de ferrugem.' },
  { id: 'casa:estrelada',       nome: 'Tema Casa Estrelada',        tipo: 'Tema',    preco: 50, desc: 'Azul da noite com detalhes dourados.' },
  // úteis (dá para trocar quantas vezes quiser)
  { id: 'util:camarao',   nome: '10 camarões',              tipo: 'Útil', preco: 4,  repete: true, desc: 'Isca de camarão para a pescaria.', usar: () => { iscasDe().camarao = (iscasDe().camarao || 0) + 10; } },
  { id: 'util:artificial', nome: '5 iscas artificiais',     tipo: 'Útil', preco: 6,  repete: true, desc: 'Para tucunaré, dourado e pirarucu.', usar: () => { iscasDe().artificial = (iscasDe().artificial || 0) + 5; } },
  { id: 'util:tarrafa',   nome: 'Tarrafa pronta agora',     tipo: 'Útil', preco: 8,  repete: true, desc: 'Seca a tarrafa deste pesqueiro na hora: pode jogar de novo.', pode: () => faltaTarrafa() > 0, naoPode: 'A tarrafa já está pronta!', usar: () => { tarrafaObj()[pontoSel()] = 0; } },
  { id: 'util:enxada',    nome: 'Enxada de arrancar',       tipo: 'Útil', preco: 3,  repete: true, desc: 'Tira um arbusto seco do pomar.', usar: () => { derrubarDe().enxada++; } },
  { id: 'util:motosserra', nome: 'Motosserra',              tipo: 'Útil', preco: 6,  repete: true, desc: 'Derruba uma árvore seca do pomar.', usar: () => { derrubarDe().motosserra++; } },
  { id: 'util:racao',     nome: '3 rações especiais',       tipo: 'Útil', preco: 6,  repete: true, desc: 'Cada uma faz um animal produzir em dobro.', usar: () => { state.racaoEsp = (state.racaoEsp || 0) + 3; } },
  { id: 'util:pontos',    nome: 'Pontos de pesca descansados', tipo: 'Útil', preco: 10, repete: true, desc: 'Todos os seus pontos de pesca voltam a ter 3 pescarias.', pode: () => PONTOS.some(p => faltaPonto(p.id) > 0), naoPode: 'Seus pontos de pesca já estão prontos!', usar: () => { const pp = pontosDe(); pp.prox = {}; pp.usos = {}; } },
];
const TREVO_TIPOS = ['Útil', 'Avatar', 'Enfeite', 'Tema', 'Música'];
const musicaLiberada = k => !(window.RFAudio && window.RFAudio.exclusivas && window.RFAudio.exclusivas[k]) || temTrevoItem('musica:' + k);
function iconeTrevoItem(it) {
  const [tipo, id] = it.id.split(':');
  if (tipo === 'casa') return casaTemaIcon(id);
  if (tipo === 'enfeite') return enfeiteIcon(id);
  return makeIcon('trevoitem:' + it.id, () => {
    if (tipo === 'musica') { ctx.fillStyle = '#2f8a2f'; ctx.font = '56px system-ui'; ctx.textAlign = 'center'; ctx.fillText({ 4: '🪕', 5: '🪗', 6: '🌙' }[id] || '🎵', 48, 70); return; }
    if (tipo === 'util' && id === 'motosserra') return drawMotosserra(52, 54, 0.95);
    if (tipo === 'util' && id === 'enxada') return drawEnxada(38, 54, 0.9);
    if (tipo === 'util') { ctx.font = '54px system-ui'; ctx.textAlign = 'center'; ctx.fillText({ camarao: '🦐', artificial: '🎏', tarrafa: '🕸️', racao: '🌾', pontos: '🎣', enxada: '🪓', motosserra: '⛓️' }[id] || '🧺', 48, 70); return; }
    const av = Object.assign({}, avatarOk(state.avatar), tipo === 'chapeu' ? { chapeu: id } : { mao: id });
    drawAvatar(ctx, 48, 92, 1.2, av, 0, false, 1);
  });
}
function comprarTrevoItem(id) {
  const it = TREVO_LOJA.find(x => x.id === id), t = trevosDe(); if (!it || (t.itens[id] && !it.repete)) return;
  if (it.pode && !it.pode()) return toast(it.naoPode || 'Não precisa agora.');
  if (t.saldo < it.preco) { sfx('error'); return toast(`Faltam ${it.preco - t.saldo} 🍀 para ${it.nome}. Resgate peixes, domínio e conquistas!`, 'bad'); }
  return confirmTwice('trevo' + id, `Trocar ${it.preco} 🍀 por ${it.nome}? Toque de novo para confirmar.`, () => {
    t.saldo -= it.preco;
    const [tipo, x] = id.split(':');
    if (it.repete) { it.usar(); sfx('buy'); toast(`🍀 ${it.nome}: pronto!`, 'good'); done(); renderPane(); renderTabs(); renderHUD(); return; }
    t.itens[id] = true;
    if (tipo === 'casa') state.skins[x] = true;
    if (tipo === 'enfeite') { state.enfeites[x] = (state.enfeites[x] || 0) + 1; state.invNovos = (state.invNovos || 0) + 1; }
    sfx('buy');
    toast(`🍀 ${it.nome} é seu! ${tipo === 'casa' ? 'Use clicando na sua casa.' : tipo === 'enfeite' ? 'Está no Inventário.' : tipo === 'musica' ? 'Escolha em ⚙️ › Música.' : 'Escolha em ⚙️ › Seu avatar.'}`, 'good');
    done(); renderPane(); renderTabs(); renderHUD();
  });
}
function trevosHTML() {
  const t = trevosDe(), pp = peixesAResgatar(), dd = dominioAResgatar(), prontas = CONQUISTAS.filter(conqPronta);
  let html = `<div class="row sel"><div class="avatar" style="background:#2f8a2f;font-size:26px">🍀</div><div><div class="name">Você tem ${t.saldo} trevo${t.saldo === 1 ? '' : 's'}</div>
    <div class="meta">A moeda verde da roça. Ganhe resgatando peixes no 📖 Livro de peixes, o domínio de pesca, as conquistas e completando as missões. Troque por itens exclusivos na Loja › 🍀 Trevo.</div></div><div></div></div>`;
  // o que tem para resgatar vem sempre primeiro, com o botão ali mesmo
  const total = trevosPendentes();
  html += `<h3>Para resgatar${total ? ` (${total})` : ''}</h3>`;
  if (!total) html += `<div class="empty">Nada para resgatar agora. Continue pescando e jogando! 🌱</div>`;
  if (pp.length) {
    const soma = pp.reduce((n, p) => n + trevosDoPeixe(p), 0);
    html += `<div class="row sel"><div class="avatar" style="background:#3f8ac8;font-size:24px">🐟</div><div><div class="name">Peixes do livro</div>
      <div class="meta">${pp.map(p => `${esc(p.nome)}${estrelasDe(p) ? ' ' + '★'.repeat(estrelasDe(p)) : ''}`).join(', ')}</div></div>
      <button class="btn gold" data-trevo-todos="1">Resgatar 🍀${soma}</button></div>`;
  }
  if (dd.length) html += `<div class="row sel"><div class="avatar" style="background:#e0a800;font-size:24px">🎖️</div><div><div class="name">Domínio de pesca</div>
      <div class="meta">Nível ${dd.length > 1 ? `${dd[0]} a ${dd[dd.length - 1]}` : dd[0]}</div></div>
      <button class="btn gold" data-trevo-dominio="1">Resgatar 🍀${dd.reduce((n, x) => n + (TREVO_DOMINIO[x] || 0), 0)}</button></div>`;
  if (state.level >= CACA_NIVEL) {
    const bb = bichosAResgatar(), dc = cacaDomAResgatar();
    if (bb.length) html += `<div class="row sel"><div class="avatar" style="background:#6b8a3a;font-size:24px">🎯</div><div><div class="name">Livro da caçada</div>
      <div class="meta">${bb.map(b => `${esc(b.nome)}${estrelasBicho(b) ? ' ' + '★'.repeat(estrelasBicho(b)) : ''}`).join(', ')}</div></div><button class="btn gold" data-trevo-bichos="1">Resgatar 🍀${bb.reduce((n, b) => n + trevosDoBicho(b), 0)}</button></div>`;
    if (dc.length) html += `<div class="row sel"><div class="avatar" style="background:#e0a800;font-size:24px">🎖️</div><div><div class="name">Domínio de caçada</div>
      <div class="meta">Nível ${dc.length > 1 ? `${dc[0]} a ${dc[dc.length - 1]}` : dc[0]}</div></div><button class="btn gold" data-trevo-domcaca="1">Resgatar 🍀${dc.reduce((n, x) => n + (TREVO_DOMINIO[x] || 0), 0)}</button></div>`;
  }
  const pa = pomarAResgatar();
  if (pa.length) html += `<div class="row sel"><div class="avatar" style="background:#4f9a2f;font-size:24px">🌳</div><div><div class="name">Domínio do pomar</div>
      <div class="meta">Nível ${pa.length > 1 ? `${pa[0]} a ${pa[pa.length - 1]}` : pa[0]}</div></div>
      <button class="btn gold" data-trevo-pomar="1">Resgatar 🍀${pa.reduce((n, x) => n + (TREVO_DOMINIO[x] || 0), 0)}</button></div>`;
  const linhaConq = c => {
    const alvo = alvoDe(c), v = Math.min(alvo, c.valor()), feita = trevosDe().conq[c.id], pronta = conqPronta(c);
    return `<div class="row ${pronta ? 'sel' : ''}"><div class="avatar" style="background:${feita ? '#b7b39c' : '#2f8a2f'};font-size:20px">${feita ? '✔' : '🏅'}</div>
      <div><div class="name">${c.nome}</div><div class="meta">${c.desc} · ${v.toLocaleString('pt-BR')}/${alvo.toLocaleString('pt-BR')}</div><div class="mbar"><i style="width:${Math.round(v / alvo * 100)}%"></i></div></div>
      ${feita ? '<button class="btn ghost" disabled>Resgatado</button>' : pronta ? `<button class="btn gold" data-trevo-conq="${c.id}">Resgatar 🍀${c.trevos}</button>` : `<button class="btn ghost" disabled>🍀 ${c.trevos}</button>`}</div>`;
  };
  for (const c of prontas) html += linhaConq(c);
  // as outras conquistas: primeiro as em andamento (mais perto do fim antes), depois as já resgatadas
  const falta = CONQUISTAS.filter(c => !conqPronta(c) && !trevosDe().conq[c.id]).sort((a, b) => b.valor() / alvoDe(b) - a.valor() / alvoDe(a));
  const feitas = CONQUISTAS.filter(c => trevosDe().conq[c.id]);
  if (falta.length) html += `<h3>Conquistas em andamento</h3>` + falta.map(linhaConq).join('');
  if (feitas.length) html += `<h3>Conquistas resgatadas</h3>` + feitas.map(linhaConq).join('');
  html += `<div class="row"><div class="avatar" style="background:#2f8a2f;font-size:24px">🛍️</div><div><div class="name">Loja do Trevo</div><div class="meta">Os itens exclusivos ficam na Loja, na aba 🍀 Trevo.</div></div><button class="btn gold" data-ir-loja-trevo="1">Abrir</button></div>`;
  return html;
}
function trevoLojaHTML() {
  const t = trevosDe();
  let html = `<div class="row sel"><div class="avatar" style="background:#2f8a2f;font-size:26px">🍀</div><div><div class="name">Você tem ${t.saldo} trevo${t.saldo === 1 ? '' : 's'}</div><div class="meta">Ganhe resgatando peixes, domínio de pesca e conquistas em Missões › 🍀 Trevos.</div></div><button class="btn ghost" data-abrir-trevos="1">Ganhar</button></div>
    <p class="hint">Itens exclusivos: só se conseguem com trevos. Os úteis dá para trocar quantas vezes quiser.</p>`;
  for (const it of TREVO_TIPOS.flatMap(tp => { const l = TREVO_LOJA.filter(x => x.tipo === tp); return l.length ? [{ cab: tp }, ...l] : []; })) {
    if (it.cab) { html += `<p class="trevocab">${{ 'Útil': '🧺 Úteis', Avatar: '🧑‍🌾 Para o avatar', Enfeite: '🌼 Enfeites', Tema: '🏡 Temas da casa', 'Música': '🎵 Músicas' }[it.cab]}</p>`; continue; }
    const tem = t.itens[it.id] && !it.repete;
    html += `<div class="row ${tem ? 'sel' : ''}"><img alt="" src="${iconeTrevoItem(it)}"><div><div class="name">${it.nome} <span class="tag">${it.tipo}</span></div><div class="meta">${it.desc}</div></div>
      ${tem ? '<button class="btn ghost" disabled>Já é seu</button>' : `<button class="btn gold" data-trevo-comprar="${it.id}" ${t.saldo < it.preco ? 'disabled' : ''}>🍀 ${it.preco}</button>`}</div>`;
  }
  return html;
}

// ---------- Presente dos pioneiros: quem joga no primeiro mês ganha itens especiais ----------
// Mês e ano em que os itens de evento chegaram (aparece no mouse e no inventário).
function obtidoEm(s) {
  const t = s && s.pioneiro; if (!t) return '';
  const d = new Date(t > 1 ? t : Math.min(Date.now(), PIONEIRO_ATE));
  return 'Obtido em ' + d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
const PIONEIRO_ATE = new Date(2026, 9, 31, 23, 59, 59).getTime(); // até 31 de outubro de 2026
function presentePioneiro() {
  if (!state) return;
  // A moldura de pioneiro chegou depois: quem já era pioneiro de antes não tinha ganhado. Dá retroativo.
  if (state.pioneiro && !(state.molduras && state.molduras.pioneiro)) {
    state.molduras = state.molduras || {}; state.molduras.pioneiro = true;
    if (state.molduraSel === undefined) state.molduraSel = 'pioneiro';
    const msg2 = '🏅 Você ganhou a moldura dourada de pioneiro na sua foto de perfil! Veja (e escolha outra, se quiser) em ⚙️ › Moldura da foto.';
    addNews(msg2);
    setTimeout(() => toast(msg2, 'good'), 2500);
    done();
  }
  if (state.pioneiro || Date.now() > PIONEIRO_ATE) return;
  state.pioneiro = Date.now();
  state.enfeites.bandeira = (state.enfeites.bandeira || 0) + 1;
  state.enfeites.bolo = (state.enfeites.bolo || 0) + 1;
  state.skins.pioneiro = true; state.skin = 'pioneiro';
  state.molduras = state.molduras || {}; state.molduras.pioneiro = true;
  if (state.molduraSel === undefined) state.molduraSel = 'pioneiro'; // já vem escolhida, mas dá pra tirar em ⚙️ › Sua foto
  state.invNovos = (state.invNovos || 0) + 2; // os enfeites vão para o inventário, você escolhe onde pôr
  const msg = 'Presente de pioneiro! Por jogar no primeiro mês da Roça Feliz você ganhou a Bandeira dos Pioneiros e um Bolo de boas-vindas (estão no Inventário), o tema azul e dourado para o celeiro e a casa, e uma moldura dourada exclusiva na sua foto de perfil.';
  addNews(msg);
  setTimeout(() => toast(msg, 'good'), 2500);
  done();
}

// ============================================================
// Laço principal
// ============================================================
// 30 fps bastam pra um jogo de fazenda (nada precisa de 60+) e o canvas é a maior parte do
// gasto de bateria; enquanto a tela está oculta (celular bloqueado, outra aba) não desenha nada.
const DRAW_MS = 1000 / 30;
let last = performance.now(), lastSave = 0, lastUI = 0, lastInfo = 0, lastSentCheck = 0, lastDraw = 0;
function frame(now) {
  const dt = Math.min(1, (now - last) / 1000); last = now;
  if (!document.hidden) {
    tick(dt);
    if (!isGated() && L.cw > 20 && now - lastDraw >= DRAW_MS) { draw(now, dt); lastDraw = now; }
    if (now - lastUI > 250) { updateTip(); lastUI = now; }
    if (now - lastInfo > 2000) {
      tickLife(); rollPeriods(); weatherTick(); bancaTick(); rollCaminhao(); folhasTick(); invasaoTick(); petsTick();
      // a fábrica e o caminhão têm relógio: atualiza a janela (menos a banca, que tem formulário)
      if (!$('#panel').hidden && tab === 'fabrica' && fabSeg !== 'banca' && isHome()) { const y = $('#pane').scrollTop; renderPane(); $('#pane').scrollTop = y; } renderTabs(); renderSceneInfo(); root.dataset.tema = timeOfDay() === 'noite' ? 'noite' : 'dia'; lastInfo = now; }
  }
  if (now - lastSave > 5000) { save(); lastSave = now; }
  if (user && dirty && now - lastCloud > CLOUD_MS) cloudSave(); // salva na nuvem no máximo a cada 30 segundos (poupa o limite grátis do Firebase)
  if (user && now - lastSentCheck > 60000) { lastSentCheck = now; checkSent(); }
  requestAnimationFrame(frame);
}

function start(data) {
  state = (data && data.state && migrate(data.state)) || load() || newState();
  state.tool = 'hand'; // o jogo sempre começa com a Mão
  applySettings();
  rollPeriods(); presentePioneiro(); checarNovidades();
  resize(); setScene('roca'); renderHUD(); renderAccount(); renderPane(); paintMenuIcons(); afterUpdate(); renderTabs();
  ultimaChecagem = Date.now(); autoUpdate();
  // app instalável (celular, tablet e o app de Android): abre mesmo sem internet
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!Cloud.available && state.boasVindas) setTimeout(abrirBoasVindas, 600);
  else if (!Cloud.available) setTimeout(() => { if (giftReady()) showGift(); }, 1500);
  requestAnimationFrame(t => { last = t; frame(t); });
  if (Cloud.available) {
    showGate('loading');
    Cloud.init(onUser).catch(e => {
      console.warn(e); cloudStatus = 'off';
      if ('onLine' in navigator && !navigator.onLine) { enterGame(); renderAccount(); return; }
      showGate('error', 'Não consegui abrir o login do Google. Confira a internet e tente de novo.');
      renderAccount();
    });
  }
}
window.addEventListener('pagehide', () => { save(); sincronizarPush(); if (user && dirty) cloudSave(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state) { save(); sincronizarPush(); if (user && dirty) cloudSave(); } return; }
  // voltou (tela desbloqueada, aba em foco de novo): avança de uma vez o tempo que passou
  // parado, já que o laço principal não desenha nem conta o crescimento com a tela oculta.
  if (state && state.t) { const sec = (Date.now() - state.t) / 1000; if (sec > 2) catchUp(state, sec); }
  last = performance.now(); // evita um "pulo" grande de dt no próximo quadro
  if (state) { renderPane(); renderTabs(); renderSceneInfo(); }
});
// Botão de salvar na hora
async function saveNow() {
  if (!state || kicked) return;
  save();
  if (!user) return toast('Salvo neste aparelho!', 'good');
  dirty = true; await cloudSave();
  toast(syncStatus === 'Salvo na nuvem' ? 'Salvo na nuvem!' : 'Não consegui salvar na nuvem agora. Ficou salvo neste aparelho.', syncStatus === 'Salvo na nuvem' ? 'good' : 'bad');
}
$('#saveBtn')?.addEventListener('click', saveNow);
window.claude?.hot?.snapshot?.(() => ({ state }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
