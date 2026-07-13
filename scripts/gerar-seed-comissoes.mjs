// Gera o seed do histórico de comissões 2023–2024 a partir da aba
// "Comissão Mês" da planilha geral (matriz cliente × mês), enriquecida com
// produção (Nati/Bruno) e seguradora vindas da aba "Propostas fechadas".
import * as XLSX from '/home/user/HUB-SEGURO-DE-VIDA/node_modules/xlsx/xlsx.mjs'
import * as fs from 'fs'
XLSX.set_fs(fs)

const wb = XLSX.readFile(process.env.PLANILHA || './GERAL.xlsx', { cellDates: true })
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const q = (s) => s == null || s === '' ? 'null' : `'${String(s).replace(/'/g, "''").trim()}'`

// ── Enriquecimento: produção e seguradora por cliente (da aba de propostas) ──
const [, ...props] = XLSX.utils.sheet_to_json(wb.Sheets['Propostas fechadas'], { header: 1, defval: null, blankrows: false })
const info = new Map() // norm(nome) → { producao, seguradoras:Set, codAssessor }
for (const l of props.filter((x) => x[0] && String(x[0]).trim())) {
  const k = norm(l[0])
  const seg = String(l[7] ?? '').trim()
  const segNorm = norm(seg)
  const segCanon = segNorm.includes('mag') ? 'MAG' : segNorm.includes('azos') ? 'Azos'
    : segNorm.includes('icatu') ? 'Icatu' : segNorm.includes('akad') ? 'Akad (RC)'
    : segNorm.includes('met') ? 'Met Life' : segNorm.includes('pruden') ? 'Prudential'
    : segNorm.includes('omint') ? 'Omint' : segNorm.includes('potten') ? 'Pottencial'
    : segNorm.includes('axa') ? 'AXA' : ''
  const e = info.get(k) ?? { producao: null, seguradoras: new Set(), codAssessor: null }
  const esp = norm(l[2])
  if (!e.producao && (esp === 'nati' || esp === 'bruno')) e.producao = esp === 'nati' ? 'Nati' : 'Bruno'
  if (segCanon) e.seguradoras.add(segCanon)
  if (!e.codAssessor && String(l[5] ?? '').trim()) e.codAssessor = String(l[5]).trim()
  info.set(k, e)
}

// ── Matriz Comissão Mês ──
const [cab, ...linhas] = XLSX.utils.sheet_to_json(wb.Sheets['Comissão Mês'], { header: 1, defval: null, blankrows: false })
// colunas de mês são Date; as 4 primeiras: Nome, Cód. Cliente, Nome do assessor, Cód. AAI
const meses = cab.map((c, i) => (c instanceof Date ? { i, comp: `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-01` } : null)).filter(Boolean)
const lancs = []
for (const l of linhas) {
  const nome = String(l[0] ?? '').replace(/\s+/g, ' ').trim()
  if (!nome) continue
  let cod = String(l[1] ?? '').trim().replace(/\.0+$/, '')
  if (!/^\d+$/.test(cod)) cod = ''
  const codAAI = String(l[3] ?? '').trim()
  const e = info.get(norm(nome))
  const seguradora = e && e.seguradoras.size === 1 ? [...e.seguradoras][0] : 'Histórico'
  for (const { i, comp } of meses) {
    const v = Number(l[i])
    if (!Number.isFinite(v) || v === 0) continue
    lancs.push({
      competencia: comp, seguradora, cliente: nome, cod,
      codAssessor: codAAI || e?.codAssessor || '', producao: e?.producao ?? null,
      valor: Math.round(v * 100) / 100,
    })
  }
}
const total = lancs.reduce((s, x) => s + x.valor, 0)
const comps = [...new Set(lancs.map((x) => x.competencia))].sort()
console.log(`Lançamentos: ${lancs.length} · Total: R$ ${total.toFixed(2)} · ${comps[0]} → ${comps.at(-1)}`)
const semProd = lancs.filter((x) => !x.producao).length
console.log(`Sem produção (pendência p/ classificar na tela): ${semProd}`)

let sql = `-- ============================================================================
-- HUB SEGURO DE VIDA — Histórico de comissões 2023–2024
--
-- Gerado da aba "Comissão Mês" da planilha geral (matriz cliente × mês),
-- enriquecido com produção (Nati/Bruno) e seguradora da aba de propostas.
-- ${lancs.length} lançamentos · R$ ${total.toFixed(2)} · ${comps[0].slice(0, 7)} a ${comps.at(-1).slice(0, 7)}.
--
-- Com ele, os Relatórios e o Controle da Natália mostram a evolução desde
-- 2023. Lançamentos sem produção caem nas pendências (classificação em
-- 1 clique na tela de Relatórios).
--
-- SEGURO DE RODAR VÁRIAS VEZES: se o histórico já foi carregado (origem
-- 'historico-2023-2024'), nada é inserido de novo.
-- Cole o arquivo inteiro no SQL Editor do Supabase e execute.
-- ============================================================================

insert into public.comissoes_importadas
  (competencia, seguradora, segmento, tipo_receita, cliente_nome, codigo_cliente,
   id_cliente, codigo_assessor, id_assessor, producao, parcela, valor, origem)
select v.competencia::date, v.seguradora, 'individual', 'recorrente', v.cliente,
  nullif(v.cod, ''),
  (select c.id from public.clientes c
    where (nullif(v.cod,'') is not null and c.codigo = v.cod)
       or lower(c.nome) = lower(v.cliente)
    order by c.created_at limit 1),
  nullif(v.cod_assessor, ''),
  (select a.id from public.assessores a where a.codigo = nullif(v.cod_assessor, '') order by a.created_at limit 1),
  nullif(v.producao, ''), null, v.valor, 'historico-2023-2024'
from (values
${lancs.map((x) => `  (${q(x.competencia)}, ${q(x.seguradora)}, ${q(x.cliente)}, ${q(x.cod)}, ${q(x.codAssessor)}, ${q(x.producao)}, ${x.valor})`).join(',\n')}
) as v(competencia, seguradora, cliente, cod, cod_assessor, producao, valor)
where not exists (
  select 1 from public.comissoes_importadas ci where ci.origem = 'historico-2023-2024'
);

-- Conferência: select count(*), sum(valor) from comissoes_importadas where origem='historico-2023-2024';
`
fs.writeFileSync('/home/user/HUB-SEGURO-DE-VIDA/supabase/seeds/carga_comissoes_2023_2024.sql', sql)
console.log('SQL escrito em supabase/seeds/carga_comissoes_2023_2024.sql')
