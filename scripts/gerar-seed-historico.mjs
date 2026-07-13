import * as XLSX from '/home/user/HUB-SEGURO-DE-VIDA/node_modules/xlsx/xlsx.mjs'
import * as fs from 'fs'
XLSX.set_fs(fs)

const wb = XLSX.readFile(process.env.PLANILHA || './GERAL.xlsx', { cellDates: true })
const [, ...linhas] = XLSX.utils.sheet_to_json(wb.Sheets['Propostas fechadas'], { header: 1, defval: null, blankrows: false })
const dados = linhas.filter((l) => l[0] && String(l[0]).trim())

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const q = (s) => s == null || s === '' ? 'null' : `'${String(s).replace(/'/g, "''").trim()}'`
const qnum = (v) => (v == null || v === '' || isNaN(Number(v))) ? 'null' : String(v)

function normSeguradora(v) {
  const n = norm(v)
  if (!n) return 'A definir'
  if (n.includes('mag')) return 'MAG'
  if (n.includes('azos')) return 'Azos'
  if (n.includes('icatu')) return 'Icatu'
  if (n.includes('akad')) return 'Akad (RC)'
  if (n.includes('met')) return 'Met Life'
  if (n.includes('pruden')) return 'Prudential'
  if (n.includes('omint')) return 'Omint'
  if (n.includes('potten') || n.includes('poten')) return 'Pottencial'
  if (n.includes('axa')) return 'AXA'
  return String(v).trim()
}
function normTipo(v) {
  const n = norm(v)
  if (!n || n === 'nao' || n === 'n') return ''
  if (n.includes('tempor')) return 'Seguro Temporário'
  if (n.includes('vitalic')) return 'Seguro Vitalício'
  if (n.includes('resgat')) return 'Resgatável'
  if (n.includes('empres')) return 'Seguro Empresarial'
  if (n.includes('garantia')) return 'Seguro Garantia'
  if (n === 'rc') return 'RC'
  if (n.includes('d&o') || n === 'do') return 'D&O'
  if (n.includes('vg')) return 'Seguro VG'
  if (n.includes('ap')) return 'Seguro AP'
  return String(v).trim()
}
function limparCodCliente(v) {
  let s = String(v ?? '').trim().replace(/\.0+$/, '')
  if (!s) return ''
  if (/[a-z]/i.test(s) && !/^[a-z]\d/i.test(s)) return ''
  s = s.split(/[/,;]/)[0].trim()
  return /^\d+$/.test(s) ? s : ''
}
function parsePct(v) {
  const s = String(v ?? '').trim()
  if (!s || /[a-z]/i.test(s.replace(/%/g, ''))) return ''
  const num = Number(s.replace(/%/g, '').replace(',', '.'))
  if (!Number.isFinite(num)) return ''
  return String(Math.round((num <= 1 ? num * 100 : num) * 100) / 100)
}
function premioMes(l) {
  const mes = Number(l[10]); if (Number.isFinite(mes) && mes > 0) return Math.round(mes * 100) / 100
  const anual = Number(l[8]); if (Number.isFinite(anual) && anual > 0) return Math.round(anual / 12 * 100) / 100
  return 0
}
const dataISO = (d) => d instanceof Date
  ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : ''
const especialistaAssessor = { nati: 'Natália', bruno: 'Bruno' }

// ── Assessores (nome + código AAI), únicos ──
const assessores = new Map()
for (const l of dados) {
  const nome = String(l[4] ?? '').trim() || especialistaAssessor[norm(l[2])] || 'Natália'
  const cod = String(l[5] ?? '').trim()
  const chave = cod || norm(nome)
  if (!assessores.has(chave)) assessores.set(chave, { nome, codigo: cod })
}

// ── Clientes com IDENTIDADE UNIFICADA (código OU nome) ──
// A mesma regra que o SQL usa para casar apólice→cliente: se o código já foi
// visto, é o mesmo cliente (ex.: "Rancho" e "Rancho - VIDA EM GRUPO"
// compartilham código → um só cliente). Senão, casa por nome normalizado.
// Assim cada linha da planilha aponta para um cliente canônico único, e o
// dedup de apólices fica consistente com o vínculo real.
const clientes = new Map()      // idCanon → dados do cliente
const porCodigo = new Map()     // código → idCanon
const porNome = new Map()       // norm(nome) → idCanon
let seqCli = 0

function resolverCliente(l) {
  const cod = limparCodCliente(l[1])
  const chaveNome = norm(l[0])
  if (cod && porCodigo.has(cod)) return porCodigo.get(cod)
  if (porNome.has(chaveNome)) return porNome.get(chaveNome)
  const id = ++seqCli
  const assessorNome = String(l[4] ?? '').trim() || especialistaAssessor[norm(l[2])] || 'Natália'
  clientes.set(id, {
    nome: String(l[0]).replace(/\s+/g, ' ').trim(),
    codigo: cod,
    codAssessor: String(l[5] ?? '').trim(),
    assessorNome,
    perfil: especialistaAssessor[norm(l[2])] ? `Produção: ${String(l[2]).trim()}` : '',
    entrada: dataISO(l[11]) || '2023-01-01',
  })
  if (cod) porCodigo.set(cod, id)
  porNome.set(chaveNome, id)
  return id
}
for (const l of dados) resolverCliente(l)

// ── Apólices, ligadas ao cliente canônico resolvido ──
const apolices = dados.map((l) => {
  const statusBruto = norm(l[14])
  const cli = clientes.get(resolverCliente(l))
  return {
    cliente: cli.nome,            // nome canônico (casa exato no SQL)
    codCliente: cli.codigo,       // código canônico do cliente
    seguradora: normSeguradora(l[7]),
    premio: premioMes(l),
    vigencia: dataISO(l[11]) || '2023-01-01',
    pct: parsePct(l[3]),
    numero: String(l[6] ?? '').trim(),
    tipo: normTipo(l[12]),
    status: /inativ|cancel/.test(statusBruto) ? 'cancelada' : 'ativa',
    motivo: /inativ|cancel/.test(statusBruto) ? String(l[15] ?? '').trim() : '',
  }
})

// Consolida apólices logicamente idênticas (mesma chave de dedup da carga):
// cliente+seguradora+nº, ou cliente+seguradora+vigência+prêmio sem nº. Linhas
// repetidas na planilha (a mesma apólice em grupo lançada 2×) viram uma só —
// sem duplicar a carteira e mantendo a carga idempotente.
{
  const vistos = new Set()
  const unicas = []
  let colapsadas = 0
  for (const a of apolices) {
    const chave = a.numero
      ? `${norm(a.cliente)}|${a.seguradora}|n:${norm(a.numero)}`
      : `${norm(a.cliente)}|${a.seguradora}|v:${a.vigencia}|${a.premio}`
    if (vistos.has(chave)) { colapsadas++; continue }
    vistos.add(chave)
    unicas.push(a)
  }
  apolices.length = 0
  apolices.push(...unicas)
  if (colapsadas) console.log('Apólices idênticas consolidadas:', colapsadas)
}

const seguradoras = [
  ['MAG', 40], ['Azos', 40], ['Icatu', 45], ['Akad (RC)', 40], ['Met Life', 100],
  ['Omint', 21], ['Prudential', 40], ['Pottencial', 40], ['AXA', 40], ['A definir', 0],
]

// ── Monta o SQL ──
let sql = `-- ============================================================================
-- HUB SEGURO DE VIDA — Carga histórica da base (clientes + apólices)
--
-- Gerado da aba "Propostas fechadas" da planilha geral do escritório.
-- Carrega ${clientes.size} clientes e ${apolices.length} apólices, ligados a
-- assessores e seguradoras, com a comissão calculada automaticamente.
--
-- SEGURO DE RODAR VÁRIAS VEZES: só insere o que ainda não existe (idempotente).
-- Durante a carga, as automações que criam tarefas/formulários ficam
-- desligadas — nada de centenas de tarefas. O cálculo de comissão continua
-- ligado, então cada apólice já entra com a divisão 40/30/30.
--
-- PRÉ-REQUISITO: rode antes as migrações 012, 013 e 014 (colunas de status,
-- tipo de produto e motivo). Cole este arquivo inteiro no SQL Editor do
-- Supabase e execute.
-- ============================================================================

begin;

alter table public.clientes disable trigger trg_auto_novo_lead;
alter table public.apolices  disable trigger trg_auto_venda_fechada;

-- 1) Seguradoras (não duplica: nome é único)
insert into public.seguradoras (nome, comissao_padrao_percentual) values
${seguradoras.map(([n, p]) => `  (${q(n)}, ${p})`).join(',\n')}
on conflict (nome) do nothing;

-- 2) Assessores da planilha (por código AAI ou nome) — só cria quem falta
with novos(nome, codigo) as (values
${[...assessores.values()].map((a) => `  (${q(a.nome)}, ${q(a.codigo)})`).join(',\n')}
)
insert into public.assessores (nome, codigo)
select n.nome, nullif(n.codigo, '') from novos n
where not exists (
  select 1 from public.assessores a
  where (nullif(n.codigo,'') is not null and a.codigo = n.codigo)
     or (nullif(n.codigo,'') is null and lower(a.nome) = lower(n.nome))
);

-- 3) Clientes (dedupe por nome ou código) — status "fechado" (têm apólice)
with dados(nome, codigo, cod_assessor, assessor_nome, perfil, entrada) as (values
${[...clientes.values()].map((c) => `  (${q(c.nome)}, ${q(c.codigo)}, ${q(c.codAssessor)}, ${q(c.assessorNome)}, ${q(c.perfil)}, ${q(c.entrada)})`).join(',\n')}
)
insert into public.clientes (nome, codigo, id_assessor, status_funil, perfil_necessidade, data_entrada_etapa)
select d.nome, nullif(d.codigo,''),
  coalesce(
    (select a.id from public.assessores a where nullif(d.cod_assessor,'') is not null and a.codigo = d.cod_assessor order by a.created_at limit 1),
    (select a.id from public.assessores a where lower(a.nome) = lower(d.assessor_nome) order by a.created_at limit 1)
  ),
  'fechado'::public.status_funil, nullif(d.perfil,''), d.entrada::timestamptz
from dados d
where not exists (
  select 1 from public.clientes c
  where lower(c.nome) = lower(d.nome) or (nullif(d.codigo,'') is not null and c.codigo = d.codigo)
);

-- 4) Apólices (dedupe por cliente+seguradora+nº, ou vigência+prêmio sem nº)
with aps(cliente, cod_cliente, seguradora, premio, capital, vigencia, pct, numero, tipo, status, motivo) as (values
${apolices.map((a) => `  (${q(a.cliente)}, ${q(a.codCliente)}, ${q(a.seguradora)}, ${a.premio}, 0, ${q(a.vigencia)}, ${qnum(a.pct)}, ${q(a.numero)}, ${q(a.tipo)}, ${q(a.status)}, ${q(a.motivo)})`).join(',\n')}
)
insert into public.apolices (id_cliente, id_seguradora, numero_apolice, valor_premio_mensal, capital_segurado, percentual_comissao, data_vigencia, status, tipo_produto, motivo_cancelamento)
select
  coalesce(
    (select c.id from public.clientes c where nullif(a.cod_cliente,'') is not null and c.codigo = a.cod_cliente order by c.created_at limit 1),
    (select c.id from public.clientes c where lower(c.nome) = lower(a.cliente) order by c.created_at limit 1)
  ) as id_cliente,
  (select s.id from public.seguradoras s where s.nome = a.seguradora limit 1) as id_seguradora,
  nullif(a.numero,''), a.premio, a.capital, nullif(a.pct::text,'')::numeric,
  a.vigencia::date, a.status::public.status_apolice, nullif(a.tipo,''), nullif(a.motivo,'')
from aps a
where not exists (
  select 1 from public.apolices ap
  join public.clientes c on c.id = ap.id_cliente
  where lower(c.nome) = lower(a.cliente)
    and ap.id_seguradora = (select s.id from public.seguradoras s where s.nome = a.seguradora limit 1)
    and (
      (nullif(a.numero,'') is not null and ap.numero_apolice = a.numero)
      or (nullif(a.numero,'') is null and ap.data_vigencia = a.vigencia::date and ap.valor_premio_mensal = a.premio)
    )
);

alter table public.clientes enable trigger trg_auto_novo_lead;
alter table public.apolices  enable trigger trg_auto_venda_fechada;

commit;

-- Conferência rápida:
--   select count(*) from public.clientes;
--   select count(*) from public.apolices;
`

fs.writeFileSync('/home/user/HUB-SEGURO-DE-VIDA/supabase/seeds/carga_historica.sql', sql)
console.log('Assessores:', assessores.size, '| Clientes:', clientes.size, '| Apólices:', apolices.length)
console.log('SQL escrito em supabase/seeds/carga_historica.sql')
