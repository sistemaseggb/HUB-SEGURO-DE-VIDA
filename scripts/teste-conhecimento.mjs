// ─────────────────────────────────────────────────────────────────────────────
// TESTE DAS CAMADAS DE CONHECIMENTO — subscrição, objeções e beneficiários.
//
// As três produzem texto que a consultora lê em voz alta, e duas delas fazem
// afirmações que um cliente pode conferir com o advogado dele. O que se cobra
// aqui é diferente do que se cobra de um motor de cálculo:
//
//   · a subscrição nunca pode ser otimista por engano (prazo que só cresce com
//     capital e idade, restrição sempre dita, agravo nunca escondido);
//   · a objeção nunca pode sair pela metade — meia resposta é dita com a mesma
//     confiança da inteira;
//   · o beneficiário menor SEMPRE precisa disparar o alerta, porque é o caso
//     que acontece com quem fez tudo certo.
//
// Mais um fuzz de 10.000 estudos: nada explode, nada sai vazio, nada some.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularEstudo } from '../src/lib/estudo.js'
import { diagnosticar } from '../src/lib/diagnostico.js'
import { estimarPremio } from '../src/lib/premio.js'
import {
  analisarSubscricao, classificarProfissao, faixaIMC, ATIVIDADES_RISCO,
} from '../src/lib/subscricao.js'
import { responderObjecoes, responderObjecoesDetectadas } from '../src/lib/objecoes.js'
import { analisarBeneficiarios, CONHECIMENTO } from '../src/lib/beneficiarios.js'
import { OBJECOES as OBJECOES_TRANSCRICAO } from '../src/lib/transcricao.js'

let falhas = 0
let feitos = 0
const ok = (cond, nome, detalhe = '') => {
  feitos += 1
  if (cond) { console.log(`✓ ${nome}`); return true }
  falhas += 1
  console.log(`✗ ${nome}${detalhe ? ` — ${detalhe}` : ''}`)
  return false
}

const HOJE = new Date('2026-08-13T12:00:00Z')
const nascimentoPara = (idade) => {
  const d = new Date(HOJE)
  d.setUTCFullYear(d.getUTCFullYear() - idade)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

const planoBase = () => ({
  profissao: 'Advogado', renda_mensal: 30_000, custo_vida_mensal: 15_000,
  dividas_total: 400_000, anos_protecao: 15,
  estado_civil: 'Casado(a)', regime_bens: 'Comunhão parcial',
  dependentes: [{ nome: 'Ana', idade: 8, custo_mensal: 2500 }],
  patrimonio_imoveis: 1_500_000, patrimonio_investimentos: 500_000,
  previdencia_saldo: 300_000, previdencia_tipo: 'VGBL', previdencia_aporte_mensal: 2000,
  cobertura_atual: 0, capital_invalidez: null, capital_doencas_graves: null,
  dit_diaria: null, verba_sucessoria: null, itcmd_pct: null, custas_pct: 8,
  tipo_planejamento: 'pf', focos: ['renda', 'sucessao'], uf: 'SP',
  premio_estimado: 1200, fumante: false, idade_aposentadoria: 65,
  atividades_risco: [], beneficiarios: [],
})

const estudoCom = (extra = {}, idade = 42) => calcularEstudo(
  { ...planoBase(), ...extra },
  { dataNascimento: nascimentoPara(idade), hoje: HOJE },
)

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A subscrição nunca é otimista por engano ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  // Mais capital nunca pode significar menos exigência nem menos prazo. Se
  // isso inverter, a consultora promete prazo curto justamente no caso grande.
  let prazoOk = true
  let exigenciaOk = true
  let antMin = -1
  let antExig = -1
  for (const capital of [100_000, 400_000, 900_000, 2_000_000, 5_000_000, 25_000_000]) {
    const e = estudoCom({ capital_sugerido: capital, capital_invalidez: 0,
      capital_doencas_graves: 0, verba_sucessoria: 0, capital_morte_acidental: 0 })
    const s = analisarSubscricao(e, planoBase())
    if (s.prazoDias[0] < antMin) prazoOk = false
    if (s.exigencias.length < antExig) exigenciaOk = false
    antMin = s.prazoDias[0]
    antExig = s.exigencias.length
  }
  ok(prazoOk, 'o prazo estimado nunca encolhe quando o capital cresce')
  ok(exigenciaOk, 'nem a lista de exigências')

  const s = analisarSubscricao(estudoCom(), planoBase())
  ok(s.prazoDias[0] <= s.prazoDias[1], 'a faixa de prazo está em ordem')
  ok(s.documentos.length >= 3, 'sempre há uma lista de documentos para pedir na hora')
  ok(/beneficiári/i.test(s.documentos.join(' ')),
    'e os dados dos beneficiários estão sempre nela — é o que mais volta para correção')
}

{
  // Idade avançada precisa puxar exame, mesmo com capital modesto.
  const jovem = analisarSubscricao(estudoCom({}, 30), planoBase())
  const idoso = analisarSubscricao(estudoCom({}, 64), planoBase())
  ok(idoso.prazoDias[1] > jovem.prazoDias[1], 'aos 64 o prazo é maior que aos 30')
  ok(idoso.exigencias.some((x) => /exame/i.test(x)), 'e a idade puxa exame para dentro das exigências')
}

{
  const classe = classificarProfissao('Motoboy de aplicativo')
  ok(classe?.id === 'alto', 'motoboy cai na classe de risco alto', classe?.id)
  ok(classificarProfissao('Analista de sistemas')?.id === 'baixo', 'analista cai na classe baixa')
  ok(classificarProfissao('Empresário')?.id === 'autonomo',
    'empresário cai na classe de renda sem carteira — o gargalo dele é comprovar renda')
  ok(classificarProfissao('')?.id === undefined || classificarProfissao('') === null,
    'profissão em branco não é classificada às cegas')
}

{
  // A restrição é o pior tipo de surpresa: precisa aparecer SEMPRE que a
  // atividade excluir a cobertura de acidente.
  let todasAvisadas = true
  for (const a of ATIVIDADES_RISCO.filter((x) => x.excluiAcidente)) {
    const s = analisarSubscricao(estudoCom(), { ...planoBase(), atividades_risco: [a.id] })
    if (!s.restricoes.some((r) => r.id === a.id)) todasAvisadas = false
  }
  ok(todasAvisadas, 'toda atividade que exclui acidente vira restrição escrita na tela')

  const s = analisarSubscricao(estudoCom(), { ...planoBase(), atividades_risco: ['moto'] })
  ok(s.fatores.some((f) => f.id === 'atividade-moto'), 'e toda atividade de risco entra como fator de agravo')
  ok(s.agravoEstimado > 1, 'com atividade de risco o agravo estimado passa de 1')
  ok(s.perguntar.length > 0, 'e o sistema entrega a pergunta que a análise vai fazer')
}

{
  const fumante = analisarSubscricao(estudoCom({ fumante: true }), planoBase())
  ok(fumante.fatores.some((f) => f.id === 'fumante'), 'fumante entra como fator')
  ok(/12 meses/.test(fumante.fatores.find((f) => f.id === 'fumante').nota),
    'com a informação que o cliente pode agir sobre: 12 meses sem fumar reclassifica')
  ok(!fumante.automatico, 'e o caso deixa de ser tratado como automático')
}

{
  ok(faixaIMC(80, 180).faixa === 'normal', 'IMC 24,7 é faixa normal')
  ok(faixaIMC(120, 175).agravo > 1, 'IMC 39 traz agravo')
  ok(faixaIMC(0, 180) === null && faixaIMC(80, 0) === null, 'sem peso ou sem altura, não inventa IMC')
  ok(faixaIMC(999, 180) === null, 'peso absurdo não vira IMC de obesidade mórbida')
}

{
  const simples = analisarSubscricao(estudoCom({
    capital_sugerido: 300_000, capital_invalidez: 0, capital_doencas_graves: 0,
    verba_sucessoria: 0, capital_morte_acidental: 0, capital_fraturas: 0,
    capital_cirurgias: null,
    dit_diaria: 0, dih_diaria: 0, funeral_individual: 0, funeral_familiar: 0,
  }, 32), { ...planoBase(), profissao: 'Analista' })
  ok(simples.automatico === true, 'caso simples e jovem é reconhecido como automático')
  ok(/costuma sair em/.test(simples.combinado), 'e a frase pronta promete prazo curto')

  const dificil = analisarSubscricao(estudoCom({}, 62), {
    ...planoBase(), profissao: 'Piloto', atividades_risco: ['aviacao'],
    condicoes_declaradas: 'Hipertensão',
  })
  ok(dificil.automatico === false, 'caso com piloto, idade e condição declarada não é automático')
  ok(/não é automático/.test(dificil.combinado), 'e a frase pronta avisa disso antes de prometer')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── As objeções: previstas, e nunca pela metade ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  const e = estudoCom()
  const d = diagnosticar(e, { cliente: {} })
  const r = responderObjecoes(e, { diagnostico: d, premio: estimarPremio(e), cliente: {} })

  ok(r.lista.length >= 6, `o catálogo responde a várias objeções (${r.lista.length})`)
  ok(r.lista.every((o) => o.argumentos.length > 0), 'nenhuma objeção sai sem argumento')
  ok(r.lista.every((o) => o.naoDiga && o.naoDiga.length > 30),
    'toda objeção diz também o que NÃO dizer — a parte que decide a conversa')
  ok(r.lista.every((o) => o.pergunta && o.pergunta.length > 15),
    'e devolve uma pergunta que faz a conversa avançar')
  ok(r.lista.every((o) => o.comoSoa), 'toda objeção mostra como ela costuma soar na boca do cliente')

  const ordenada = r.lista.every((o, i) => i === 0 || r.lista[i - 1].pontos >= o.pontos)
  ok(ordenada, 'a lista sai ordenada pela probabilidade neste caso')

  const texto = JSON.stringify(r)
  ok(!/NaN|Infinity|undefined|R\$ -/.test(texto),
    'nenhum número impossível no texto que ela vai ler em voz alta')
}

{
  // A previsão é a promessa da ferramenta: o estudo sabe quais vão aparecer.
  const comGrupo = estudoCom({
    cobertura_atual: 600_000,
    seguros_existentes: [
      { origem: 'empresa', descricao: 'Vida em grupo', capital: 600_000, custeio: 'empresa' },
    ],
  })
  const rGrupo = responderObjecoes(comGrupo, { premio: estimarPremio(comGrupo), cliente: {} })
  ok(rGrupo.porId.ja_tem?.nivel === 'certa',
    'com vida em grupo na carteira, "já tenho seguro" é dada como certa')
  ok(/vida em grupo/i.test(rGrupo.porId.ja_tem.argumentos.join(' ')),
    'e a resposta cita a apólice dele, não um caso genérico')

  const caro = estudoCom({ renda_mensal: 6000, custo_vida_mensal: 5200, premio_estimado: 900 })
  const rCaro = responderObjecoes(caro, { premio: estimarPremio(caro), cliente: {} })
  ok(rCaro.porId.preco?.nivel === 'certa',
    'com o prêmio pesado na renda, "está caro" é dada como certa')
  ok(rCaro.esperadas.some((o) => o.id === 'preco'), 'e entra na lista das esperadas')

  const jovem = estudoCom({
    dependentes: [], estado_civil: 'Solteiro(a)', num_dependentes: 0,
  }, 27)
  const rJovem = responderObjecoes(jovem, { premio: estimarPremio(jovem), cliente: {} })
  ok(rJovem.porId.sem_urgencia?.nivel === 'certa',
    'jovem sem dependentes: "não é prioridade agora" é dada como certa')

  const patrimonial = estudoCom({
    patrimonio_imoveis: 6_000_000, patrimonio_investimentos: 200_000, verba_sucessoria: 0,
  })
  const rPat = responderObjecoes(patrimonial, { premio: estimarPremio(patrimonial), cliente: {} })
  ok(rPat.porId.patrimonio?.nivel === 'certa',
    'patrimônio alto e sem liquidez: "minha família já está protegida" é dada como certa')
}

{
  // A ponte com a transcrição: os ids precisam bater, senão a objeção detectada
  // na gravação não encontra a resposta calculada.
  const e = estudoCom({ cobertura_atual: 500_000 })
  const r = responderObjecoes(e, { premio: estimarPremio(e), cliente: {} })
  const idsTranscricao = OBJECOES_TRANSCRICAO.map((o) => o.id)
  const cobertos = idsTranscricao.filter((id) => r.porId[id])
  ok(cobertos.length >= 6,
    `as objeções que a transcrição detecta encontram resposta aqui (${cobertos.length} de ${idsTranscricao.length})`,
    idsTranscricao.filter((id) => !r.porId[id]).join(', '))

  const analiseFalsa = { objecoes: [{ id: 'preco', rotulo: 'Preço', trecho: 'achei caro' }] }
  const casadas = responderObjecoesDetectadas(analiseFalsa, r)
  ok(casadas.length === 1 && casadas[0].resposta?.id === 'preco',
    'objeção detectada na gravação encontra a resposta já calculada para aquele cliente')
  ok(responderObjecoesDetectadas(null, r).length === 0, 'sem gravação, a ponte devolve lista vazia')
}

{
  // Estudo vazio: a ferramenta não pode inventar resposta com lacuna no meio.
  const vazio = calcularEstudo({}, { hoje: HOJE })
  const r = responderObjecoes(vazio, { cliente: {} })
  ok(r !== null, 'estudo em branco ainda devolve estrutura')
  ok(r.lista.every((o) => o.argumentos.every((a) => !/R\$ 0\b/.test(a) || o.id === 'nao_recebo')),
    'e nenhuma resposta sai com "R$ 0" no meio do argumento')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Beneficiários: o alerta que salva a promessa ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  const e = estudoCom()
  const a = analisarBeneficiarios({ beneficiarios: [] }, e)
  ok(a.declarado === false, 'sem indicação, a análise se declara não preenchida')
  ok(a.alertas.some((x) => x.id === 'sem-indicacao'), 'e avisa que a lei vai decidir por ele')
  ok(/792/.test(a.alertas.find((x) => x.id === 'sem-indicacao').texto),
    'citando o artigo, para ela poder sustentar na frente de um cliente com advogado')
}

{
  // O caso que justifica o arquivo inteiro.
  const e = estudoCom()
  const a = analisarBeneficiarios({
    beneficiarios: [
      { nome: 'Ana', parentesco: 'Filho(a)', pct: 50, nascimento: '2018-04-01' },
      { nome: 'Beto', parentesco: 'Filho(a)', pct: 50, nascimento: '2015-09-10' },
    ],
  }, e, { hoje: HOJE })
  const alerta = a.alertas.find((x) => x.id === 'menor')
  ok(!!alerta && alerta.grave, 'dois filhos menores como beneficiários: alerta GRAVE')
  ok(/alvar|autoriza[çc][ãa]o judicial/i.test(alerta.texto),
    'e o texto explica o que trava de verdade — a autorização judicial')
  ok(a.menores.length === 2, 'os dois são identificados como menores')
  ok(a.capitalParaMenores > 0, 'e o sistema sabe quanto do capital fica travado')
}

{
  const e = estudoCom()
  const a = analisarBeneficiarios({
    beneficiarios: [
      { nome: 'Mariana', parentesco: 'Cônjuge', pct: 60, nascimento: '1985-01-01' },
      { nome: 'Ana', parentesco: 'Filho(a)', pct: 30, nascimento: '2018-04-01' },
    ],
  }, e, { hoje: HOJE })
  ok(a.alertas.some((x) => x.id === 'soma' && x.grave), 'soma diferente de 100% é alerta grave')
  ok(a.somaPct === 90, 'e o sistema diz exatamente quanto somou', String(a.somaPct))
}

{
  const e = estudoCom()
  const a = analisarBeneficiarios({
    beneficiarios: [{ nome: 'Ana', parentesco: 'Filho(a)', pct: 100 }],
  }, e, { hoje: HOJE })
  ok(a.itens[0].menor === null, 'sem data de nascimento, o sistema não afirma que é menor')
  ok(a.alertas.some((x) => x.id === 'idade-desconhecida'),
    'mas cobra a data em vez de deixar passar como se estivesse tudo bem')
}

{
  const e = estudoCom()
  const a = analisarBeneficiarios({
    beneficiarios: [{ nome: 'Irmão', parentesco: 'Irmão(ã)', pct: 100, nascimento: '1980-01-01' }],
  }, e, { hoje: HOJE })
  ok(a.alertas.some((x) => x.id === 'sem-conjuge'),
    'cliente casado sem o cônjuge na lista vira pergunta — pode ser deliberado')
  ok(!a.alertas.find((x) => x.id === 'sem-conjuge').grave,
    'e não é tratado como erro, porque pode ser exatamente o que ele quer')
}

{
  const e = estudoCom()
  const a = analisarBeneficiarios({
    beneficiarios: [
      { nome: 'Mariana', parentesco: 'Cônjuge', pct: 50, nascimento: '1985-01-01' },
      { nome: 'Ana', parentesco: 'Filho(a)', pct: 50, nascimento: '1998-04-01' },
    ],
  }, e, { hoje: HOJE })
  ok(a.alertas.length === 0, 'indicação bem feita não gera alerta nenhum', JSON.stringify(a.alertas.map((x) => x.id)))
  ok(a.rateio.every((b) => b.valor > 0), 'e o rateio em dinheiro sai para cada um')
}

{
  ok(CONHECIMENTO.length >= 5, 'a base de conhecimento tem os cartões de consulta')
  ok(CONHECIMENTO.every((c) => c.referencia && c.texto.length > 80),
    'toda afirmação jurídica traz a referência e a explicação')
  ok(CONHECIMENTO.some((c) => /794/.test(c.referencia)),
    'inclusive o art. 794, que é o alicerce do capítulo de sucessão da proposta')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Dez mil estudos ao acaso: nada explode, nada some ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  let semente = 20260813
  const rnd = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648
    return semente / 2147483648
  }
  const entre = (a, b) => a + rnd() * (b - a)
  const talvez = (p) => rnd() < p
  const escolher = (l) => l[Math.floor(rnd() * l.length)]

  const PROFISSOES = ['Motoboy', 'Médico', 'Advogado', 'Piloto', 'Analista', 'Empresário',
    'Vigilante', 'Pedreiro', 'Professora', '', 'Caminhoneiro']

  let explodiu = null
  let vazio = null
  let semAlerta = null

  for (let i = 0; i < 10_000 && !explodiu && !vazio && !semAlerta; i++) {
    const idade = Math.round(entre(18, 80))
    const menor = talvez(0.4)
    const plano = {
      ...planoBase(),
      profissao: escolher(PROFISSOES),
      renda_mensal: talvez(0.1) ? 0 : Math.round(entre(1500, 300_000)),
      custo_vida_mensal: talvez(0.1) ? 0 : Math.round(entre(800, 200_000)),
      dividas_total: talvez(0.3) ? 0 : Math.round(entre(0, 4_000_000)),
      patrimonio_imoveis: talvez(0.3) ? 0 : Math.round(entre(0, 20_000_000)),
      cobertura_atual: talvez(0.5) ? 0 : Math.round(entre(0, 4_000_000)),
      premio_estimado: talvez(0.25) ? 0 : Math.round(entre(50, 30_000)),
      fumante: talvez(0.2),
      altura_cm: talvez(0.5) ? Math.round(entre(140, 210)) : null,
      peso_kg: talvez(0.5) ? Math.round(entre(40, 200)) : null,
      condicoes_declaradas: talvez(0.2) ? 'Algo declarado' : null,
      atividades_risco: ATIVIDADES_RISCO.filter(() => talvez(0.15)).map((a) => a.id),
      tipo_planejamento: talvez(0.25) ? 'pf_pj' : 'pf',
      pj_valuation: Math.round(entre(0, 20_000_000)),
      pj_num_socios: Math.round(entre(0, 6)),
      pj_divida_avalizada: Math.round(entre(0, 5_000_000)),
      beneficiarios: talvez(0.6) ? [
        { nome: 'Alguém', parentesco: escolher(['Cônjuge', 'Filho(a)', 'Outro', 'Companheiro(a)']),
          pct: Math.round(entre(0, 100)),
          nascimento: menor ? nascimentoPara(Math.round(entre(0, 17)))
            : nascimentoPara(Math.round(entre(19, 70))) },
      ] : [],
    }

    try {
      const e = calcularEstudo(plano, { dataNascimento: nascimentoPara(idade), hoje: HOJE })
      const d = diagnosticar(e, { cliente: { profissao: plano.profissao } })
      const p = estimarPremio(e)
      const s = e.ativas.length > 0 ? analisarSubscricao(e, plano) : null
      const o = responderObjecoes(e, { diagnostico: d, premio: p, cliente: plano })
      const b = analisarBeneficiarios(plano, e, { hoje: HOJE })

      const texto = JSON.stringify({ s, o, b })
      if (/NaN|Infinity|undefined|R\$ -/.test(texto)) {
        vazio = `caso ${i}: número impossível no texto`
      }
      if (s && (!(s.prazoDias[0] > 0) || s.prazoDias[0] > s.prazoDias[1] || !s.combinado)) {
        vazio = `caso ${i}: subscrição sem prazo válido (${JSON.stringify(s.prazoDias)})`
      }
      if (o.lista.some((x) => !x.argumentos.length || !x.naoDiga || !x.pergunta)) {
        vazio = `caso ${i}: objeção incompleta`
      }
      // A promessa que não pode falhar nunca: menor indicado sempre avisado.
      const temMenor = b.itens.some((x) => x.menor === true && x.pct > 0)
      if (temMenor && !b.alertas.some((x) => x.id === 'menor')) {
        semAlerta = `caso ${i}: beneficiário menor sem alerta`
      }
    } catch (err) {
      explodiu = `caso ${i} (idade ${idade}): ${err.message}`
    }
  }

  ok(!explodiu, 'nenhum estudo ao acaso derruba as três camadas', explodiu ?? '')
  ok(!vazio, 'nada sai vazio, impossível ou pela metade', vazio ?? '')
  ok(!semAlerta, 'beneficiário menor NUNCA passa sem alerta', semAlerta ?? '')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RESULTADO (conhecimento: subscrição, objeções e beneficiários) ──')
console.log(falhas === 0 ? `Falhas: nenhuma 🎉  (${feitos} conferências)` : `Falhas: ${falhas} de ${feitos}`)
process.exit(falhas === 0 ? 0 : 1)
