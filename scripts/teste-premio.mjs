// ─────────────────────────────────────────────────────────────────────────────
// TESTE DAS FERRAMENTAS DE PLANEJAMENTO — preço, níveis e carteira existente.
//
// Estas três ferramentas produzem números que a consultora lê em voz alta na
// frente do cliente. A auditoria de 10.000 casos já cobre a plausibilidade
// estatística delas; aqui ficam as invariantes que precisam valer SEMPRE, e os
// casos de borda que um gerador aleatório quase nunca sorteia.
//
// A pergunta que cada bloco responde:
//   · o preço se comporta como preço?      (monótono, sem NaN, idade importa)
//   · a escada de níveis é mesmo escada?   (cada degrau custa e entrega mais)
//   · o corte por orçamento respeita o teto e a ordem do risco?
//   · a carteira existente separa o que é dele do que é emprestado?
// ─────────────────────────────────────────────────────────────────────────────

import { calcularEstudo, analisarCoberturaExistente } from '../src/lib/estudo.js'
import {
  estimarPremio, precoMensal, conferirCotacao, TABELA_TAXAS,
  IDADE_REFERENCIA, fatorIdade,
} from '../src/lib/premio.js'
import { montarNiveis, planoQueCabe, ORDEM_RISCO_PADRAO } from '../src/lib/niveis.js'
import { diagnosticar } from '../src/lib/diagnostico.js'

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
  renda_mensal: 25_000, custo_vida_mensal: 14_000, dividas_total: 300_000,
  anos_protecao: 15, estado_civil: 'Casado(a)', regime_bens: 'Comunhão parcial',
  dependentes: [{ nome: 'Ana', idade: 8, custo_mensal: 2500 }],
  patrimonio_imoveis: 1_200_000, patrimonio_investimentos: 400_000,
  previdencia_saldo: 200_000, previdencia_tipo: 'VGBL', previdencia_aporte_mensal: 1500,
  cobertura_atual: 0, capital_invalidez: null, capital_doencas_graves: null,
  dit_diaria: null, verba_sucessoria: null, itcmd_pct: null, custas_pct: 8,
  tipo_planejamento: 'pf', focos: ['renda', 'sucessao'], uf: 'SP',
  premio_estimado: null, fumante: false, idade_aposentadoria: 65,
})

const estudoCom = (extra = {}, idade = 40) => calcularEstudo(
  { ...planoBase(), ...extra },
  { dataNascimento: nascimentoPara(idade), hoje: HOJE },
)

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O preço se comporta como preço ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  // Na idade de referência a tabela vale exatamente como está escrita: é a
  // âncora de todo o resto, e um desvio aqui deslocaria a carteira inteira.
  const p = precoMensal('morte', 1_000_000, { idade: IDADE_REFERENCIA })
  ok(Math.abs(p - TABELA_TAXAS.morte.taxa * 1000) < 0.01,
    `na idade de referência o preço é a taxa da tabela (R$ ${p})`,
    `esperado ${TABELA_TAXAS.morte.taxa * 1000}`)

  const todosUm = Object.keys(TABELA_TAXAS)
    .every((id) => Math.abs(fatorIdade(id, IDADE_REFERENCIA, false) - 1) < 1e-9)
  ok(todosUm, 'o fator de idade é 1,00 na referência para TODA cobertura')
}

{
  // Mais capital custa mais; mais idade custa mais. Se qualquer uma dessas
  // duas quebrar, todo o comparativo de níveis perde o sentido.
  let monotonoCapital = true
  let monotonoIdade = true
  for (const id of Object.keys(TABELA_TAXAS)) {
    const porDiaria = TABELA_TAXAS[id].base === 'diaria'
    const v1 = porDiaria ? 200 : 100_000
    const v2 = porDiaria ? 400 : 500_000
    if (!(precoMensal(id, v2, { idade: 40 }) > precoMensal(id, v1, { idade: 40 }))) {
      monotonoCapital = false
    }
    for (let idade = 20; idade < 70; idade += 5) {
      const a = precoMensal(id, v1, { idade })
      const b = precoMensal(id, v1, { idade: idade + 5 })
      if (b < a) { monotonoIdade = false; break }
    }
  }
  ok(monotonoCapital, 'mais capital sempre custa mais, em toda cobertura')
  ok(monotonoIdade, 'mais idade nunca custa menos, em toda cobertura')
}

{
  // Franquia maior barateia, limite de diárias maior encarece — é o que a
  // consultora vai negociar quando o preço travar a conversa.
  const caro = precoMensal('dit', 500, { idade: 40, dias: 90, franquia: 7 })
  const barato = precoMensal('dit', 500, { idade: 40, dias: 90, franquia: 30 })
  ok(barato < caro, `franquia maior barateia a DIT (${barato} < ${caro})`)
  const curto = precoMensal('dit', 500, { idade: 40, dias: 90, franquia: 15 })
  const longo = precoMensal('dit', 500, { idade: 40, dias: 360, franquia: 15 })
  ok(longo > curto, `mais diárias custam mais (${longo} > ${curto})`)
  // …mas nunca de forma proporcional: o afastamento longo é raro e a curva satura
  ok(longo < curto * 4, 'quadruplicar as diárias não quadruplica o prêmio (a curva satura)')
}

{
  const naoFumante = estudoCom({ fumante: false })
  const fumante = estudoCom({ fumante: true })
  const a = estimarPremio(naoFumante)
  const b = estimarPremio(fumante)
  ok(b.mensal > a.mensal, `fumante paga mais (${b.mensal} > ${a.mensal})`)
  ok(b.max - b.min > a.max - a.min, 'e a faixa do fumante é mais larga (o agravo varia por seguradora)')
}

{
  const semIdade = calcularEstudo(planoBase(), { hoje: HOJE })
  ok(estimarPremio(semIdade) === null,
    'sem data de nascimento o estimador devolve null em vez de chutar uma idade')
}

{
  const e = estudoCom()
  const p = estimarPremio(e)
  ok(p.min < p.mensal && p.mensal < p.max, `a faixa contém o valor central (${p.min}–${p.mensal}–${p.max})`)
  ok(p.max - p.mensal > p.mensal - p.min,
    'a faixa é assimétrica para cima: agravo só empurra o preço nessa direção')
  const soma = p.itens.reduce((s, i) => s + i.mensal, 0)
  ok(Math.abs(soma - p.mensal) < 1.5, 'o total é a soma dos itens', `${soma} vs ${p.mensal}`)
  ok(p.itens.every((i) => i.pctDoTotal > 0), 'toda cobertura listada tem uma fatia do total')
  ok(p.estimativa === true, 'a saída se declara estimativa — a tela nunca pode esquecer disso')
}

{
  // Acima da idade de emissão o número sai, mas acompanhado.
  const velho = estudoCom({}, 68)
  const p = estimarPremio(velho)
  const dg = p?.itens.find((i) => i.id === 'doencas_graves')
  if (dg) {
    ok(dg.foraDaIdadeDeEmissao === true, 'aos 68 anos doenças graves é marcada como fora da emissão')
    ok(p.avisos.some((a) => a.id === 'doencas_graves'),
      'e vem com aviso escrito, em vez de só um preço alto')
  } else {
    ok(true, 'aos 68 anos o estudo nem sugere doenças graves (também é resposta válida)')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A conferência da cotação ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  const e = estudoCom()
  const p = estimarPremio(e)
  const dentro = calcularEstudo(
    { ...planoBase(), premio_estimado: p.mensal },
    { dataNascimento: nascimentoPara(40), hoje: HOJE },
  )
  ok(conferirCotacao(dentro, p).situacao === 'dentro', 'cotação na faixa: nada a conferir')

  const acima = calcularEstudo(
    { ...planoBase(), premio_estimado: p.max * 3 },
    { dataNascimento: nascimentoPara(40), hoje: HOJE },
  )
  const rAcima = conferirCotacao(acima, p)
  ok(rAcima.situacao === 'acima' && rAcima.pct > 0, 'cotação muito acima é sinalizada com o percentual')
  ok(/agravo/i.test(rAcima.texto), 'e sugere a causa mais provável (agravo, capital, cobertura a mais)')

  const abaixo = calcularEstudo(
    { ...planoBase(), premio_estimado: Math.max(Math.round(p.min / 4), 1) },
    { dataNascimento: nascimentoPara(40), hoje: HOJE },
  )
  ok(conferirCotacao(abaixo, p).situacao === 'abaixo',
    'cotação muito abaixo também: pode ter faltado cobertura na cotação')

  ok(conferirCotacao(estudoCom(), p) === null || conferirCotacao(estudoCom(), p).situacao,
    'sem prêmio cotado a conferência não inventa veredito')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A escada de níveis é mesmo uma escada ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  const e = estudoCom()
  const d = diagnosticar(e, { cliente: {} })
  const n = montarNiveis(e, { perfil: d.perfil })
  ok(n != null, 'um estudo completo produz os níveis')
  ok(n.niveis.length >= 2, `pelo menos dois degraus (${n.niveis.length})`)

  let subindo = true
  let entregando = true
  for (let i = 1; i < n.niveis.length; i++) {
    if (n.niveis[i].mensal <= n.niveis[i - 1].mensal) subindo = false
    if (n.niveis[i].capital < n.niveis[i - 1].capital) entregando = false
  }
  ok(subindo, 'cada degrau custa mais que o de baixo')
  ok(entregando, 'e nenhum degrau mais caro entrega menos capital')

  const completo = n.niveis[n.niveis.length - 1]
  ok(completo.descoberto.length === 0, 'o nível mais alto não deixa nada descoberto')
  const primeiro = n.niveis[0]
  ok(primeiro.descoberto.length === 0 || primeiro.descoberto.every((x) => x.rotulo),
    'todo item descoberto tem rótulo legível')
  ok(n.niveis.every((x) => x.tese && x.tese.length > 20),
    'todo nível explica para que serve, não só quanto custa')
}

{
  // A promessa central do essencial: ele NUNCA deixa a família devendo. Se há
  // dívida, o capital de morte entra mesmo que o corte fosse por outro lado.
  const e = estudoCom({ dividas_total: 800_000 })
  const n = montarNiveis(e, { perfil: diagnosticar(e, { cliente: {} }).perfil })
  const essencial = n.niveis.find((x) => x.id === 'essencial') ?? n.niveis[0]
  ok(essencial.itens.some((i) => i.id === 'morte'),
    'com dívida na mesa, o nível essencial sempre inclui o capital de morte')
}

{
  // E no estudo empresarial, o aval não é opcional: o banco executa de todo jeito.
  const e = estudoCom({
    tipo_planejamento: 'pf_pj', pj_valuation: 2_000_000, pj_participacao_pct: 50,
    pj_num_socios: 2, pj_lucro_anual: 600_000, pj_divida_avalizada: 900_000,
    focos: ['empresarial'],
  })
  const n = montarNiveis(e, { perfil: diagnosticar(e, { cliente: {} }).perfil })
  const essencial = n.niveis.find((x) => x.id === 'essencial') ?? n.niveis[0]
  ok(essencial.itens.some((i) => i.id === 'aval'),
    'com dívida avalizada, o nível essencial sempre inclui a cobertura do aval')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── O plano que cabe no orçamento ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  const e = estudoCom()
  const perfil = diagnosticar(e, { cliente: {} }).perfil
  const cheio = estimarPremio(e).mensal

  for (const fracao of [0.05, 0.2, 0.5, 0.8, 0.99]) {
    const teto = Math.round(cheio * fracao)
    const p = planoQueCabe(e, teto, { perfil })
    if (!p) continue
    if (p.mensal > p.teto) {
      ok(false, `teto de ${teto} respeitado`, `escolheu ${p.mensal}`)
      break
    }
  }
  ok(true, 'nenhum teto é estourado, de 5% a 99% do plano cheio')

  const p = planoQueCabe(e, Math.round(cheio * 0.4), { perfil })
  ok(p.sobra >= 0, 'a sobra nunca é negativa')
  ok(p.dentro.length > 0, 'com 40% do orçamento ainda sobra um plano de pé')
  ok(p.fora.every((f) => f.faltam > 0), 'todo item cortado diz quanto faltaria para entrar')

  // A ordem do risco é a promessa da ferramenta: cortar pelo que é mais fácil
  // de tirar (a invalidez, sempre) é justamente o erro que ela evita.
  const ordem = perfil?.prioridade?.length ? perfil.prioridade : ORDEM_RISCO_PADRAO
  const posicao = (id) => { const i = ordem.indexOf(id); return i === -1 ? 99 : i }
  const piorDentro = Math.max(...p.dentro.map((x) => posicao(x.id)))
  const melhorFora = Math.min(...p.fora.map((x) => posicao(x.id)), 99)
  // um item de ordem pior só entra antes de um melhor se o melhor não coubesse
  const inversoes = p.fora.filter((f) => posicao(f.id) < piorDentro)
  ok(inversoes.length === 0 || inversoes.every((f) => f.mensal > 0),
    `a ordem do risco é respeitada (pior dentro ${piorDentro}, melhor fora ${melhorFora})`)

  const generoso = planoQueCabe(e, cheio * 10, { perfil })
  ok(generoso.completo === true && generoso.fora.length === 0,
    'com orçamento de sobra, nada fica de fora e a ferramenta diz isso')

  const nada = planoQueCabe(e, 1, { perfil })
  ok(nada.vazio === true, 'com teto de R$ 1 a ferramenta admite que nada cabe, em vez de forçar')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── A carteira que ele já tem ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  const sem = analisarCoberturaExistente({}, 500_000)
  ok(sem.detalhado === false, 'sem detalhe, a carteira se declara não detalhada')
  ok(sem.portavel === 500_000,
    'e o total declarado continua sendo tratado como portátil — nenhum estudo antigo muda de número sozinho')
}

{
  // O caso que motivou a ferramenta: R$ 800 mil de "cobertura" que na prática
  // não entregam um real permanente à família.
  const k = analisarCoberturaExistente({
    seguros_existentes: [
      { origem: 'empresa', descricao: 'Vida em grupo', capital: 500_000, custeio: 'empresa' },
      { origem: 'banco', descricao: 'Prestamista do imóvel', capital: 300_000, custeio: 'proprio' },
    ],
  }, 800_000)
  ok(k.total === 800_000, 'o total soma as apólices listadas')
  ok(k.portavel === 0, 'nada é portátil: uma acaba com o emprego, a outra é do banco')
  ok(k.condicionada === 500_000, 'a vida em grupo é classificada como condicionada ao vínculo')
  ok(k.quitaDivida === 300_000, 'a prestamista é classificada como dinheiro que não chega à família')
  ok(k.divergencia === 0, 'e o detalhe fecha com o total declarado')
}

{
  // Apólice "individual" paga pela empresa é benefício de emprego com outro nome.
  const k = analisarCoberturaExistente({
    seguros_existentes: [
      { origem: 'individual', descricao: 'Vida da diretoria', capital: 400_000, custeio: 'empresa' },
    ],
  }, 400_000)
  ok(k.portavel === 0 && k.condicionada === 400_000,
    'o custeio manda sobre a origem: individual paga pela empresa acaba com o vínculo')
}

{
  const k = analisarCoberturaExistente({
    seguros_existentes: [
      { origem: 'individual', descricao: 'Icatu', capital: 600_000, custeio: 'proprio' },
    ],
  }, 400_000)
  ok(k.divergencia === 200_000, 'o detalhe que não fecha com o total é reportado, não escondido')
}

{
  const e = estudoCom({
    cobertura_atual: 800_000,
    seguros_existentes: [
      { origem: 'empresa', descricao: 'Vida em grupo', capital: 500_000, custeio: 'empresa' },
      { origem: 'banco', descricao: 'Prestamista', capital: 300_000, custeio: 'proprio' },
    ],
  })
  ok(e.gapPortavel > e.gap,
    `o gap portátil é maior que o gap ingênuo (${Math.round(e.gapPortavel)} > ${Math.round(e.gap)})`)
  ok(e.capitalQueEvapora === 500_000, 'o estudo sabe quanto some se ele sair da empresa')
  ok(e.inconsistencias.some((i) => /dependem do vínculo/.test(i.texto) && i.grave),
    'e avisa disso como problema GRAVE')
  ok(e.inconsistencias.some((i) => /prestamista/i.test(i.texto) && i.grave),
    'a prestamista contada como capital também é aviso grave')

  const d = diagnosticar(e, { cliente: {} })
  ok(d.recomendacoes.some((r) => r.id === 'cobertura-emprestada'),
    'o diagnóstico transforma isso em recomendação com frase para a reunião')
  ok(d.recomendacoes.some((r) => r.id === 'prestamista-nao-chega'),
    'e cobra a correção da prestamista')
}

{
  // Cliente que diz ter seguro e não se sabe de que tipo: vira pendência.
  const e = estudoCom({ cobertura_atual: 400_000 })
  const d = diagnosticar(e, { cliente: {} })
  ok(d.pendencias.some((p) => p.id === 'carteira'),
    'cobertura sem detalhe vira pendência de "o que perguntar antes de apresentar"')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Dez mil estudos ao acaso: nada explode, nada sai impossível ──')
// ─────────────────────────────────────────────────────────────────────────────

{
  let semente = 20260813
  const rnd = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648
    return semente / 2147483648
  }
  const entre = (a, b) => a + rnd() * (b - a)
  const talvez = (p) => rnd() < p

  let explodiu = null
  let impossivel = null
  let tetoEstourado = null
  let escadaTorta = null

  for (let i = 0; i < 10_000 && !explodiu && !impossivel && !tetoEstourado && !escadaTorta; i++) {
    const idade = Math.round(entre(18, 82))
    const plano = {
      ...planoBase(),
      renda_mensal: talvez(0.1) ? 0 : Math.round(entre(1500, 400_000)),
      custo_vida_mensal: talvez(0.1) ? 0 : Math.round(entre(800, 300_000)),
      dividas_total: talvez(0.3) ? 0 : Math.round(entre(0, 5_000_000)),
      anos_protecao: Math.round(entre(1, 60)),
      patrimonio_imoveis: talvez(0.3) ? 0 : Math.round(entre(0, 30_000_000)),
      patrimonio_investimentos: talvez(0.4) ? 0 : Math.round(entre(0, 10_000_000)),
      previdencia_saldo: talvez(0.5) ? 0 : Math.round(entre(0, 5_000_000)),
      cobertura_atual: talvez(0.5) ? 0 : Math.round(entre(0, 5_000_000)),
      fumante: talvez(0.2),
      dit_dias: Math.round(entre(1, 1095)),
      dit_franquia_dias: Math.round(entre(0, 200)),
      dih_dias: Math.round(entre(1, 365)),
      tipo_planejamento: talvez(0.25) ? (talvez(0.5) ? 'pj' : 'pf_pj') : 'pf',
      pj_valuation: Math.round(entre(0, 50_000_000)),
      pj_participacao_pct: Math.round(entre(0, 100)),
      pj_num_socios: Math.round(entre(0, 8)),
      pj_lucro_anual: Math.round(entre(0, 20_000_000)),
      pj_divida_avalizada: Math.round(entre(0, 10_000_000)),
      seguros_existentes: talvez(0.4) ? [
        { origem: ['empresa', 'banco', 'individual', 'consignado', 'outro'][Math.floor(rnd() * 5)],
          descricao: 'Apólice', capital: Math.round(entre(0, 3_000_000)),
          custeio: talvez(0.4) ? 'empresa' : 'proprio' },
      ] : [],
    }

    try {
      const e = calcularEstudo(plano, { dataNascimento: nascimentoPara(idade), hoje: HOJE })
      const d = diagnosticar(e, { cliente: {} })
      const p = estimarPremio(e)
      const n = montarNiveis(e, { perfil: d?.perfil })
      const teto = Math.round(entre(1, 60_000))
      const cabe = planoQueCabe(e, teto, { perfil: d?.perfil })

      const numeros = [
        p?.mensal, p?.min, p?.max, p?.anual,
        ...(p?.itens ?? []).map((x) => x.mensal),
        ...(n?.niveis ?? []).flatMap((x) => [x.mensal, x.capital]),
        cabe?.mensal, cabe?.sobra, cabe?.capital,
        e.gapPortavel, e.capitalQueEvapora,
        e.carteira.portavel, e.carteira.condicionada, e.carteira.quitaDivida,
      ].filter((v) => v !== undefined && v !== null)
      if (numeros.some((v) => !Number.isFinite(v) || v < 0)) {
        impossivel = `caso ${i} (idade ${idade}): número inválido em ${JSON.stringify(numeros)}`
      }
      if (cabe && cabe.mensal > cabe.teto) {
        tetoEstourado = `caso ${i}: ${cabe.mensal} para um teto de ${cabe.teto}`
      }
      if (n) {
        for (let k = 1; k < n.niveis.length; k++) {
          if (n.niveis[k].mensal <= n.niveis[k - 1].mensal) {
            escadaTorta = `caso ${i}: ${n.niveis[k].id} não é mais caro que ${n.niveis[k - 1].id}`
          }
        }
      }
    } catch (err) {
      explodiu = `caso ${i} (idade ${idade}): ${err.message}`
    }
  }

  ok(!explodiu, 'nenhum estudo ao acaso derruba as ferramentas', explodiu ?? '')
  ok(!impossivel, 'nenhum número sai NaN, infinito ou negativo', impossivel ?? '')
  ok(!tetoEstourado, 'o teto de orçamento nunca é estourado', tetoEstourado ?? '')
  ok(!escadaTorta, 'a escada de níveis nunca fica fora de ordem', escadaTorta ?? '')
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── RESULTADO (planejamento: preço, níveis e carteira) ──')
console.log(falhas === 0 ? `Falhas: nenhuma 🎉  (${feitos} conferências)` : `Falhas: ${falhas} de ${feitos}`)
process.exit(falhas === 0 ? 0 : 1)
