// ─────────────────────────────────────────────────────────────────────────────
// AUDITORIA DE 10.000 PLANEJAMENTOS REAIS
//
// O `test:motor` já prova que o estudo não QUEBRA: joga lixo na entrada e cobra
// que nada vire NaN. Isso é robustez, não competência. Um motor que devolvesse
// zero em tudo passaria naquele teste com louvor.
//
// Esta auditoria pergunta outra coisa, muito mais difícil e muito mais
// importante para quem vai apresentar o estudo na frente do cliente:
//
//        O CONSELHO QUE O SISTEMA DÁ ESTÁ CERTO?
//
// Para isso não serve entrada aleatória. Serve gente. São 10.000 clientes
// plausíveis — o CLT de 28 anos sem filhos, a médica autônoma com três
// crianças, o empresário de 55 com sócio e aval no banco, a viúva que quer
// resolver o inventário do marido, o casal sem filhos, o cliente que só quer
// cobrir o financiamento por 20 anos — cada um com números que existem no
// mundo.
//
// Sobre cada estudo calculado passam as REGRAS DE AUDITORIA: cada uma é uma
// coisa que um consultor sênior olharia e diria "isso está errado" ou "isso
// você deixou passar". Elas não medem estilo. Medem erro material:
//
//   · capital que nenhuma seguradora emite (limite técnico de mercado);
//   · prêmio que não cabe no bolso do cliente;
//   · proteção vendida para quem não precisa dela (solteiro sem dependentes);
//   · a mesma reserva contada duas vezes em dois lugares do estudo;
//   · pergunta decisiva que o sistema deixou de fazer (regime de bens, UF);
//   · e conselho que contradiz outro conselho do mesmo estudo.
//
// O relatório é deliberadamente desconfortável: lista quantos dos 10.000
// planejamentos cairiam em cada erro, com um caso concreto para reproduzir.
//
//   node scripts/auditoria-planejamento.mjs
//   CASOS=50000 SEMENTE=42 node scripts/auditoria-planejamento.mjs
//   node scripts/auditoria-planejamento.mjs --detalhe R07   (dumpa um caso)
//
// Saída: código 0 sempre — auditoria informa, não reprova. Quem reprova é o
// `npm run test:planejamento`, que trava nas regras já corrigidas (ver
// LIMITES_ACEITOS no fim do arquivo).
// ─────────────────────────────────────────────────────────────────────────────
import { calcularEstudo, IDADE_INDEPENDENCIA } from '../src/lib/estudo.js'

// Os tetos ficam AQUI, não importados do motor, de propósito: um auditor que
// usa as constantes do auditado não audita nada — só confirma que o sistema
// concorda consigo mesmo. Estes são os limites praticados no mercado brasileiro
// de vida individual (Icatu, MetLife, Prudential, Omint, Azos na faixa alta).
const LIMITES_MERCADO = {
  morte: 20_000_000,        // acima disso: resseguro facultativo, exames, meses
  doencas_graves: 3_000_000,
  invalidez: 20_000_000,
  diaria_dit: 1_500,        // por dia
  diaria_dih: 1_500,
}

// O diagnóstico ainda pode não existir na árvore (é o que esta auditoria pede
// que exista). Sem ele as regras do grupo G ficam neutras em vez de explodir.
let diagnosticar = null
try {
  ({ diagnosticar } = await import('../src/lib/diagnostico.js'))
} catch {
  console.log('  ⚠️  src/lib/diagnostico.js ainda não existe — regras R21..R24 desligadas.\n')
}

// As ferramentas de precificação e de níveis do plano seguem a mesma regra:
// ausentes, as regras do grupo H ficam neutras em vez de derrubar a auditoria.
// A formatação por campo mora no motor (é conhecimento de domínio, não de
// layout). A auditoria confere que ela não volte a chamar ano de dinheiro.
let valorDoCampo = null
try {
  ({ valorDoCampo } = await import('../src/lib/estudo.js'))
} catch { /* motor sem o helper: regra R37 neutra */ }

let estimarPremio = null
let montarNiveis = null
let planoQueCabe = null
try {
  ({ estimarPremio } = await import('../src/lib/premio.js'));
  ({ montarNiveis, planoQueCabe } = await import('../src/lib/niveis.js'))
} catch {
  console.log('  ⚠️  premio.js/niveis.js ainda não existem — regras R25..R31 desligadas.\n')
}

// As camadas de conhecimento: subscrição, objeções e beneficiários. Mesma
// regra de sempre — ausentes, o grupo I fica neutro.
let analisarSubscricao = null
let responderObjecoes = null
let analisarBeneficiarios = null
try {
  ({ analisarSubscricao } = await import('../src/lib/subscricao.js'));
  ({ responderObjecoes } = await import('../src/lib/objecoes.js'));
  ({ analisarBeneficiarios } = await import('../src/lib/beneficiarios.js'))
} catch {
  console.log('  ⚠️  subscricao/objecoes/beneficiarios ainda não existem — regras R32..R36 desligadas.\n')
}

const CASOS = Number(process.env.CASOS ?? 10000)
const alvoDetalhe = (() => {
  const i = process.argv.indexOf('--detalhe')
  return i > -1 ? process.argv[i + 1] : null
})()

// ─── Gerador determinístico ──────────────────────────────────────────────────
let semente = Number(process.env.SEMENTE ?? 20260813)
const rnd = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648
  return semente / 2147483648
}
const entre = (a, b) => a + rnd() * (b - a)
const inteiroEntre = (a, b) => Math.round(entre(a, b))
const escolher = (lista) => lista[Math.floor(rnd() * lista.length)]
const talvez = (p) => rnd() < p
// arredonda como gente arredonda ao dizer um número numa reunião
const redondo = (v) => {
  if (v >= 1_000_000) return Math.round(v / 50_000) * 50_000
  if (v >= 100_000) return Math.round(v / 10_000) * 10_000
  if (v >= 10_000) return Math.round(v / 500) * 500
  return Math.round(v / 100) * 100
}

const UFS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE', 'CE', 'GO', 'DF', 'MT']

function nascimentoParaIdade(idade, hoje) {
  const d = new Date(hoje)
  d.setFullYear(d.getFullYear() - idade)
  d.setDate(d.getDate() - inteiroEntre(1, 300))
  return d.toISOString().slice(0, 10)
}

// ─── Os arquétipos ───────────────────────────────────────────────────────────
// Cada um devolve { rotulo, publico, idade, plano }. O `publico` é o recorte
// que o relatório usa para dizer ONDE o sistema erra mais.
const ARQUETIPOS = [
  // ── 1. CLT jovem, solteiro, sem dependentes ────────────────────────────────
  // O caso que mais expõe conselho automático: ninguém depende dessa renda.
  () => {
    const renda = redondo(entre(3500, 12_000))
    return {
      rotulo: 'CLT jovem solteiro sem dependentes', publico: 'PF sem dependentes',
      idade: inteiroEntre(23, 32),
      plano: {
        tipo_planejamento: 'pf', focos: ['renda'],
        estado_civil: 'Solteiro(a)', regime_bens: '',
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.5, 0.8)),
        dividas_total: talvez(0.4) ? redondo(entre(5000, 60_000)) : 0,
        patrimonio_investimentos: talvez(0.6) ? redondo(entre(5000, 80_000)) : 0,
        dependentes: [],
        anos_protecao: 10,
        premio_estimado: redondo(entre(90, 320)),
      },
    }
  },

  // ── 2. Casal com filhos, renda média — o caso mais comum da carteira ───────
  () => {
    const renda = redondo(entre(9000, 30_000))
    const nFilhos = inteiroEntre(1, 3)
    return {
      rotulo: 'Casal CLT com filhos', publico: 'PF família',
      idade: inteiroEntre(32, 45),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['renda'], ['renda', 'educacao'], ['educacao']]),
        estado_civil: 'Casado(a)',
        regime_bens: talvez(0.55) ? 'Comunhão parcial' : '',
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.6, 0.92)),
        dividas_total: talvez(0.7) ? redondo(entre(80_000, 700_000)) : 0,
        patrimonio_imoveis: talvez(0.7) ? redondo(entre(250_000, 1_400_000)) : 0,
        patrimonio_investimentos: redondo(entre(10_000, 250_000)),
        patrimonio_veiculos: redondo(entre(25_000, 160_000)),
        previdencia_saldo: talvez(0.5) ? redondo(entre(15_000, 300_000)) : 0,
        previdencia_tipo: escolher(['VGBL', 'PGBL', '']),
        dependentes: Array.from({ length: nFilhos }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 20),
          custo_mensal: redondo(entre(800, 3500)),
        })),
        anos_protecao: escolher([10, 15, 20]),
        cobertura_atual: talvez(0.45) ? redondo(entre(80_000, 500_000)) : 0,
        premio_estimado: redondo(entre(180, 900)),
      },
    }
  },

  // ── 3. Autônomo / liberal de alta renda (médico, advogado, dentista) ───────
  // A renda para no dia em que ele para: DIT e doenças graves são o coração.
  () => {
    const renda = redondo(entre(35_000, 220_000))
    return {
      rotulo: 'Autônomo liberal alta renda', publico: 'PF alta renda',
      idade: inteiroEntre(35, 52),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['renda'], ['renda', 'sucessao'], ['renda', 'blindagem']]),
        estado_civil: escolher(['Casado(a)', 'Casado(a)', 'União estável']),
        regime_bens: escolher(['Comunhão parcial', 'Separação total', '']),
        profissao: escolher(['Médico', 'Advogada', 'Dentista', 'Arquiteto']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.45, 0.75)),
        dividas_total: talvez(0.5) ? redondo(entre(200_000, 2_000_000)) : 0,
        patrimonio_imoveis: redondo(entre(800_000, 6_000_000)),
        patrimonio_investimentos: redondo(entre(150_000, 3_000_000)),
        patrimonio_veiculos: redondo(entre(80_000, 500_000)),
        previdencia_saldo: redondo(entre(80_000, 1_500_000)),
        previdencia_tipo: escolher(['VGBL', 'PGBL', 'Ambos']),
        dependentes: Array.from({ length: inteiroEntre(1, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 22),
          custo_mensal: redondo(entre(2500, 12_000)),
        })),
        anos_protecao: escolher([15, 20, 25]),
        premio_estimado: redondo(entre(1500, 9000)),
        premio_anual: talvez(0.4) ? redondo(entre(16_000, 95_000)) : 0,
      },
    }
  },

  // ── 4. Empresário PJ puro — só a empresa está na mesa ──────────────────────
  () => {
    const fat = redondo(entre(1_200_000, 60_000_000))
    const socios = inteiroEntre(1, 4)
    return {
      rotulo: 'Empresário — estudo PJ puro', publico: 'PJ',
      idade: inteiroEntre(38, 60),
      plano: {
        tipo_planejamento: 'pj', focos: ['empresarial'],
        estado_civil: 'Casado(a)', regime_bens: escolher(['Comunhão parcial', 'Separação total', '']),
        pj_razao_social: 'Empresa Exemplo Ltda',
        pj_faturamento_anual: fat,
        pj_lucro_anual: talvez(0.6) ? redondo(fat * entre(0.06, 0.25)) : 0,
        pj_valuation: talvez(0.7) ? redondo(fat * entre(0.6, 3)) : 0,
        pj_num_socios: socios,
        pj_participacao_pct: socios > 1 ? Math.round(100 / socios) : 100,
        pj_divida_avalizada: talvez(0.6) ? redondo(entre(150_000, 6_000_000)) : 0,
        anos_protecao: 15,
        premio_estimado: redondo(entre(900, 12_000)),
      },
    }
  },

  // ── 5. Sócio com vida pessoal e empresa no mesmo estudo ───────────────────
  () => {
    const renda = redondo(entre(20_000, 90_000))
    const fat = redondo(entre(2_000_000, 40_000_000))
    const socios = inteiroEntre(2, 4)
    return {
      rotulo: 'Sócio PF + PJ', publico: 'PF + PJ',
      idade: inteiroEntre(36, 56),
      plano: {
        tipo_planejamento: 'pf_pj',
        focos: escolher([['renda', 'empresarial'], ['empresarial', 'sucessao'], ['renda', 'sucessao', 'empresarial']]),
        estado_civil: 'Casado(a)', regime_bens: escolher(['Comunhão parcial', 'Comunhão universal', 'Separação total', '']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.5, 0.8)),
        dividas_total: talvez(0.6) ? redondo(entre(300_000, 3_000_000)) : 0,
        patrimonio_imoveis: redondo(entre(600_000, 8_000_000)),
        patrimonio_investimentos: redondo(entre(100_000, 2_500_000)),
        patrimonio_empresa: talvez(0.5) ? redondo(entre(500_000, 20_000_000)) : 0,
        patrimonio_veiculos: redondo(entre(60_000, 400_000)),
        previdencia_saldo: talvez(0.6) ? redondo(entre(50_000, 1_200_000)) : 0,
        previdencia_tipo: escolher(['VGBL', 'PGBL', 'Ambos', '']),
        dependentes: Array.from({ length: inteiroEntre(0, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 24),
          custo_mensal: redondo(entre(1500, 8000)),
        })),
        pj_faturamento_anual: fat,
        pj_lucro_anual: redondo(fat * entre(0.05, 0.22)),
        pj_valuation: redondo(fat * entre(0.8, 2.5)),
        pj_num_socios: socios,
        pj_participacao_pct: Math.round(100 / socios),
        pj_divida_avalizada: talvez(0.65) ? redondo(entre(400_000, 8_000_000)) : 0,
        anos_protecao: escolher([15, 20]),
        premio_estimado: redondo(entre(1200, 15_000)),
      },
    }
  },

  // ── 6. Sucessão pura: patrimônio grande, renda já não é o problema ─────────
  () => {
    const imoveis = redondo(entre(3_000_000, 40_000_000))
    return {
      rotulo: 'Sucessão — patrimônio consolidado', publico: 'Sucessão',
      idade: inteiroEntre(55, 74),
      plano: {
        tipo_planejamento: escolher(['pf', 'pf_pj']),
        focos: escolher([['sucessao'], ['sucessao', 'blindagem'], ['sucessao', 'empresarial']]),
        estado_civil: escolher(['Casado(a)', 'Casado(a)', 'Viúvo(a)']),
        regime_bens: escolher(['Comunhão parcial', 'Comunhão universal', 'Separação total', '']),
        renda_mensal: redondo(entre(25_000, 150_000)),
        custo_vida_mensal: redondo(entre(15_000, 70_000)),
        dividas_total: talvez(0.3) ? redondo(entre(200_000, 3_000_000)) : 0,
        patrimonio_imoveis: imoveis,
        patrimonio_investimentos: redondo(imoveis * entre(0.05, 0.5)),
        patrimonio_empresa: talvez(0.5) ? redondo(imoveis * entre(0.2, 1.5)) : 0,
        patrimonio_veiculos: redondo(entre(120_000, 900_000)),
        patrimonio_outros: talvez(0.4) ? redondo(entre(100_000, 2_000_000)) : 0,
        previdencia_saldo: talvez(0.7) ? redondo(entre(200_000, 4_000_000)) : 0,
        previdencia_tipo: escolher(['VGBL', 'PGBL', 'Ambos']),
        tem_holding: talvez(0.3),
        tem_testamento: talvez(0.25),
        herdeiros_menores: talvez(0.2),
        itcmd_pct: escolher([4, 4, 6, 8]),
        custas_pct: escolher([6, 8, 10]),
        dependentes: Array.from({ length: inteiroEntre(0, 4) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(12, 40),
          custo_mensal: talvez(0.3) ? redondo(entre(1000, 6000)) : 0,
        })),
        anos_protecao: escolher([10, 15, 20]),
        premio_estimado: redondo(entre(2500, 30_000)),
      },
    }
  },

  // ── 7. Temporário: cobrir o financiamento e o tempo dos filhos, nada mais ──
  () => {
    const renda = redondo(entre(8000, 35_000))
    const saldo = redondo(entre(200_000, 1_200_000))
    return {
      rotulo: 'Temporário — cobrir financiamento', publico: 'Temporário',
      idade: inteiroEntre(28, 45),
      plano: {
        tipo_planejamento: 'pf', focos: ['dividas'],
        estado_civil: escolher(['Casado(a)', 'União estável']),
        regime_bens: escolher(['Comunhão parcial', '']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.65, 0.9)),
        dividas_total: saldo,
        patrimonio_imoveis: redondo(saldo * entre(1.1, 1.8)),
        patrimonio_investimentos: talvez(0.5) ? redondo(entre(5000, 90_000)) : 0,
        dependentes: Array.from({ length: inteiroEntre(0, 2) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 15),
          custo_mensal: redondo(entre(700, 2500)),
        })),
        anos_protecao: escolher([5, 8, 20, 25, 30]),
        premio_estimado: redondo(entre(120, 700)),
      },
    }
  },

  // ── 8. Viúva/viúvo com filhos — já viveu o inventário ─────────────────────
  () => {
    const renda = redondo(entre(7000, 40_000))
    return {
      rotulo: 'Viúvo(a) com filhos', publico: 'PF família',
      idade: inteiroEntre(40, 58),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['renda', 'sucessao'], ['renda'], ['sucessao', 'educacao']]),
        estado_civil: 'Viúvo(a)', regime_bens: '',
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.6, 0.88)),
        dividas_total: talvez(0.35) ? redondo(entre(30_000, 400_000)) : 0,
        patrimonio_imoveis: redondo(entre(300_000, 2_500_000)),
        patrimonio_investimentos: redondo(entre(30_000, 800_000)),
        previdencia_saldo: talvez(0.5) ? redondo(entre(20_000, 400_000)) : 0,
        previdencia_tipo: escolher(['VGBL', '']),
        herdeiros_menores: talvez(0.5),
        dependentes: Array.from({ length: inteiroEntre(1, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(2, 20),
          custo_mensal: redondo(entre(900, 4000)),
        })),
        anos_protecao: escolher([10, 15, 20]),
        premio_estimado: redondo(entre(200, 1500)),
      },
    }
  },

  // ── 9. Foco em aposentadoria e acúmulo ────────────────────────────────────
  () => {
    const renda = redondo(entre(12_000, 60_000))
    return {
      rotulo: 'Foco em aposentadoria', publico: 'Aposentadoria',
      idade: inteiroEntre(30, 52),
      plano: {
        tipo_planejamento: 'pf',
        focos: escolher([['aposentadoria'], ['aposentadoria', 'renda'], ['aposentadoria', 'sucessao']]),
        estado_civil: escolher(['Casado(a)', 'Solteiro(a)', 'União estável']),
        regime_bens: escolher(['Comunhão parcial', '']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.5, 0.8)),
        renda_desejada_aposentadoria: talvez(0.6) ? redondo(renda * entre(0.5, 1.1)) : 0,
        idade_aposentadoria: escolher([55, 60, 62, 65]),
        previdencia_saldo: redondo(entre(20_000, 900_000)),
        previdencia_aporte_mensal: redondo(entre(500, 8000)),
        previdencia_tipo: escolher(['VGBL', 'PGBL', 'Ambos']),
        patrimonio_investimentos: redondo(entre(20_000, 800_000)),
        patrimonio_imoveis: talvez(0.6) ? redondo(entre(300_000, 2_000_000)) : 0,
        dependentes: Array.from({ length: inteiroEntre(0, 2) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 24), custo_mensal: redondo(entre(800, 4000)),
        })),
        anos_protecao: escolher([15, 20, 25]),
        premio_estimado: redondo(entre(300, 3000)),
      },
    }
  },

  // ── 10. Baixa renda / MEI — o plano tem que caber no bolso ────────────────
  () => {
    const renda = redondo(entre(2200, 6500))
    return {
      rotulo: 'MEI / baixa renda', publico: 'PF baixa renda',
      idade: inteiroEntre(24, 48),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['renda'], ['renda', 'educacao']]),
        estado_civil: escolher(['Casado(a)', 'Solteiro(a)', 'União estável']),
        regime_bens: '',
        profissao: escolher(['Autônomo', 'MEI', 'Cabeleireira']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.75, 1.05)),
        dividas_total: talvez(0.6) ? redondo(entre(3000, 60_000)) : 0,
        patrimonio_investimentos: talvez(0.3) ? redondo(entre(1000, 25_000)) : 0,
        patrimonio_veiculos: talvez(0.5) ? redondo(entre(12_000, 70_000)) : 0,
        dependentes: Array.from({ length: inteiroEntre(0, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 18), custo_mensal: redondo(entre(300, 1200)),
        })),
        anos_protecao: escolher([10, 15, 20]),
        premio_estimado: redondo(entre(60, 260)),
      },
    }
  },

  // ── 11. Casal sem filhos (DINK) — dois salários, nenhum dependente ────────
  () => {
    const renda = redondo(entre(15_000, 60_000))
    return {
      rotulo: 'Casal sem filhos (DINK)', publico: 'PF sem dependentes',
      idade: inteiroEntre(30, 44),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['renda'], ['blindagem'], ['renda', 'aposentadoria']]),
        estado_civil: escolher(['Casado(a)', 'União estável']),
        regime_bens: escolher(['Comunhão parcial', 'Separação total', '']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.45, 0.75)),
        dividas_total: talvez(0.5) ? redondo(entre(100_000, 900_000)) : 0,
        patrimonio_imoveis: talvez(0.7) ? redondo(entre(400_000, 2_500_000)) : 0,
        patrimonio_investimentos: redondo(entre(50_000, 900_000)),
        previdencia_saldo: talvez(0.6) ? redondo(entre(30_000, 500_000)) : 0,
        previdencia_tipo: escolher(['VGBL', 'PGBL', '']),
        dependentes: [],
        anos_protecao: escolher([10, 15, 20]),
        premio_estimado: redondo(entre(200, 1400)),
      },
    }
  },

  // ── 12. Idoso: proteção já não é renda, é sucessão e funeral ──────────────
  () => {
    const patrimonio = redondo(entre(800_000, 12_000_000))
    return {
      rotulo: 'Cliente 65+', publico: 'Sucessão',
      idade: inteiroEntre(65, 78),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['sucessao'], ['sucessao', 'blindagem']]),
        estado_civil: escolher(['Casado(a)', 'Viúvo(a)']),
        regime_bens: escolher(['Comunhão parcial', 'Comunhão universal', '']),
        renda_mensal: redondo(entre(6000, 60_000)),
        custo_vida_mensal: redondo(entre(5000, 35_000)),
        patrimonio_imoveis: patrimonio,
        patrimonio_investimentos: redondo(patrimonio * entre(0.1, 0.6)),
        previdencia_saldo: talvez(0.6) ? redondo(entre(100_000, 2_000_000)) : 0,
        previdencia_tipo: escolher(['VGBL', 'PGBL']),
        dependentes: [],
        anos_protecao: escolher([5, 10, 15, 20]),
        premio_estimado: redondo(entre(1500, 20_000)),
      },
    }
  },

  // ── 13. Divorciado com pensão alimentícia ─────────────────────────────────
  () => {
    const renda = redondo(entre(10_000, 50_000))
    return {
      rotulo: 'Divorciado com pensão', publico: 'PF família',
      idade: inteiroEntre(35, 52),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['renda', 'educacao'], ['educacao']]),
        estado_civil: 'Divorciado(a)', regime_bens: '',
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.55, 0.85)),
        dividas_total: talvez(0.5) ? redondo(entre(50_000, 500_000)) : 0,
        patrimonio_imoveis: talvez(0.5) ? redondo(entre(250_000, 1_500_000)) : 0,
        patrimonio_investimentos: redondo(entre(10_000, 400_000)),
        dependentes: Array.from({ length: inteiroEntre(1, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(1, 21), custo_mensal: redondo(entre(1200, 6000)),
        })),
        anos_protecao: escolher([10, 15, 20]),
        premio_estimado: redondo(entre(250, 1800)),
      },
    }
  },

  // ── 14. Homem-chave: a empresa depende de uma pessoa só ───────────────────
  () => {
    const fat = redondo(entre(800_000, 15_000_000))
    return {
      rotulo: 'Homem-chave / sócio único', publico: 'PJ',
      idade: inteiroEntre(34, 58),
      plano: {
        tipo_planejamento: 'pf_pj', focos: ['empresarial'],
        estado_civil: escolher(['Casado(a)', 'Solteiro(a)']),
        regime_bens: escolher(['Comunhão parcial', '']),
        renda_mensal: redondo(entre(12_000, 70_000)),
        custo_vida_mensal: redondo(entre(8000, 40_000)),
        pj_faturamento_anual: fat,
        pj_lucro_anual: talvez(0.5) ? redondo(fat * entre(0.08, 0.3)) : 0,
        pj_num_socios: 1,
        pj_participacao_pct: 100,
        pj_valuation: talvez(0.4) ? redondo(fat * entre(1, 3)) : 0,
        pj_divida_avalizada: talvez(0.7) ? redondo(entre(200_000, 4_000_000)) : 0,
        patrimonio_imoveis: talvez(0.6) ? redondo(entre(400_000, 3_000_000)) : 0,
        patrimonio_investimentos: redondo(entre(30_000, 600_000)),
        dependentes: Array.from({ length: inteiroEntre(0, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 22), custo_mensal: redondo(entre(1000, 5000)),
        })),
        anos_protecao: escolher([15, 20]),
        premio_estimado: redondo(entre(700, 8000)),
      },
    }
  },

  // ── 15. Filhos pequenos + patrimônio: o inventário judicial ───────────────
  () => {
    const renda = redondo(entre(18_000, 80_000))
    return {
      rotulo: 'Herdeiros menores com patrimônio', publico: 'Sucessão',
      idade: inteiroEntre(33, 46),
      plano: {
        tipo_planejamento: 'pf', focos: escolher([['sucessao', 'renda'], ['sucessao', 'educacao']]),
        estado_civil: 'Casado(a)',
        regime_bens: escolher(['Comunhão parcial', 'Comunhão universal', 'Separação total']),
        renda_mensal: renda, custo_vida_mensal: redondo(renda * entre(0.5, 0.8)),
        dividas_total: talvez(0.5) ? redondo(entre(200_000, 2_000_000)) : 0,
        patrimonio_imoveis: redondo(entre(1_500_000, 12_000_000)),
        patrimonio_investimentos: redondo(entre(100_000, 1_500_000)),
        patrimonio_veiculos: redondo(entre(80_000, 400_000)),
        previdencia_saldo: talvez(0.6) ? redondo(entre(50_000, 900_000)) : 0,
        previdencia_tipo: escolher(['VGBL', 'PGBL', 'Ambos']),
        dependentes: Array.from({ length: inteiroEntre(1, 3) }, (_, i) => ({
          nome: `Filho ${i + 1}`, idade: inteiroEntre(0, 12), custo_mensal: redondo(entre(1500, 7000)),
        })),
        anos_protecao: escolher([15, 20, 25]),
        premio_estimado: redondo(entre(800, 6000)),
      },
    }
  },
]

// Ruído de preenchimento: na vida real o estudo raramente chega completo.
// Sem isso a auditoria só testaria o cenário ideal, que é o que menos acontece.
function comLacunas(plano) {
  const p = { ...plano }
  if (talvez(0.18)) delete p.custo_vida_mensal
  if (talvez(0.12)) p.renda_mensal = 0
  if (talvez(0.25)) p.cobertura_atual = undefined
  if (talvez(0.30)) p.premio_anual = 0
  if (talvez(0.10)) p.anos_protecao = ''
  if (talvez(0.15)) p.previdencia_tipo = ''
  return p
}

// ─── A carteira que o cliente já tem ─────────────────────────────────────────
// A maioria dos clientes chega com alguma apólice, e quase nunca é a que eles
// pensam que é: vida em grupo da empresa, prestamista do financiamento, uma
// individual antiga de capital pequeno. O gerador reproduz essa mistura para a
// auditoria exercitar a decomposição da carteira nos 10.000 casos — sem isso o
// código novo passaria batido pelo teste que mais protege o sistema.
function carteiraAleatoria(coberturaAtual) {
  if (!(coberturaAtual > 0) || talvez(0.45)) return undefined
  const fatias = []
  let resta = coberturaAtual
  const tipos = [
    { origem: 'empresa', descricao: 'Vida em grupo do empregador', custeio: 'empresa' },
    { origem: 'banco', descricao: 'Prestamista do financiamento', custeio: 'proprio' },
    { origem: 'individual', descricao: 'Apólice individual antiga', custeio: 'proprio' },
    { origem: 'consignado', descricao: 'Consignado', custeio: 'proprio' },
  ]
  const quantas = inteiroEntre(1, 3)
  for (let k = 0; k < quantas && resta > 0; k++) {
    const ultima = k === quantas - 1
    const capital = ultima ? resta : redondo(entre(resta * 0.2, resta * 0.8))
    fatias.push({ ...escolher(tipos), capital })
    resta -= capital
  }
  // De vez em quando o detalhe NÃO fecha com o total declarado — é o caso real
  // em que ela lembrou de uma apólice e esqueceu de somar no campo do total.
  if (talvez(0.15)) fatias.push({
    origem: 'individual', descricao: 'Apólice esquecida no total',
    capital: redondo(entre(20_000, 200_000)), custeio: 'proprio',
  })
  return fatias
}

function gerarCenario() {
  const base = escolher(ARQUETIPOS)()
  const hoje = new Date('2026-08-13T12:00:00Z')
  const plano = comLacunas({
    uf: escolher(UFS),
    fumante: talvez(0.14),
    ...base.plano,
  })
  const carteira = carteiraAleatoria(Number(plano.cobertura_atual) || 0)
  if (carteira) plano.seguros_existentes = carteira

  // Cirurgias (migração 027). Em ~15% dos casos a coluna NÃO existe: é a
  // instalação que ainda não rodou a migração, e o estudo tem que continuar
  // inteiro sem ela. Nos outros, o valor às vezes vem da consultora e às
  // vezes fica vazio para o estudo sugerir — os dois caminhos precisam passar
  // pelas 10.000 revisões, senão o código novo escapa da rede que protege
  // todo o resto do sistema.
  if (!talvez(0.15)) {
    plano.capital_cirurgias = talvez(0.25) ? redondo(entre(5_000, 80_000)) : null
  }

  // Atividades de risco, IMC e indicação de beneficiários (migração 025). Sem
  // isso o código novo passaria batido pelo teste que mais protege o sistema.
  const ATIVIDADES = ['moto', 'aviacao', 'mergulho', 'altura', 'escalada',
    'paraquedismo', 'automobilismo', 'artes_marciais', 'caca_submarina']
  plano.atividades_risco = ATIVIDADES.filter(() => talvez(0.08))
  if (talvez(0.5)) { plano.altura_cm = inteiroEntre(150, 200); plano.peso_kg = inteiroEntre(45, 190) }
  if (talvez(0.25)) plano.condicoes_declaradas = 'Condição declarada na reunião'
  if (talvez(0.55)) {
    // Metade das indicações inclui um menor — é o caso que o sistema existe
    // para pegar, e o que mais aparece na carteira de quem tem filho pequeno.
    const quantos = inteiroEntre(1, 3)
    const fatias = []
    for (let k = 0; k < quantos; k++) {
      const menor = talvez(0.45)
      const anos = menor ? inteiroEntre(0, 17) : inteiroEntre(19, 75)
      fatias.push({
        nome: `Beneficiário ${k + 1}`,
        parentesco: escolher(['Cônjuge', 'Filho(a)', 'Companheiro(a)', 'Outro', 'Irmão(ã)']),
        // de propósito nem sempre soma 100: é o erro mais comum da indicação
        pct: Math.round(100 / quantos),
        nascimento: nascimentoParaIdade(anos, hoje),
      })
    }
    plano.beneficiarios = fatias
  }
  return {
    ...base,
    hoje,
    plano,
    dataNascimento: nascimentoParaIdade(base.idade, hoje),
  }
}

// ─── As regras ───────────────────────────────────────────────────────────────
// Cada regra é uma coisa que um consultor sênior apontaria numa revisão.
// `quando` devolve string (a explicação do achado) ou null.
const m = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
const temAviso = (e, trecho) => e.inconsistencias.some((i) => i.texto.toLowerCase().includes(trecho))

const REGRAS = [
  // ── A. Capital que o mercado não emite ────────────────────────────────────
  {
    id: 'R01', gravidade: 'grave',
    titulo: 'Doenças graves acima do teto que a seguradora emite',
    porque: 'O mercado brasileiro não emite doenças graves acima de ~R$ 3 mi, e quase '
      + 'sempre limita a cobertura a uma fração do capital de morte. Sugerir R$ 5 mi '
      + 'é apresentar um número que a cotação vai derrubar na frente do cliente.',
    quando: (c, e) => {
      const v = e.sugestoes.doencas_graves
      if (v > LIMITES_MERCADO.doencas_graves) {
        return `sugeriu ${m(v)} (teto de mercado ${m(LIMITES_MERCADO.doencas_graves)})`
      }
      return null
    },
  },
  {
    id: 'R02', gravidade: 'grave',
    titulo: 'Diária de DIT acima do que qualquer seguradora aceita',
    porque: 'DIT é limitada por dia e pelo comprometimento da renda. Renda ÷ 30 para '
      + 'quem ganha R$ 150 mil dá R$ 5.000/dia — nenhuma apólice individual emite isso.',
    quando: (c, e) => {
      const v = e.sugestoes.dit
      return v > LIMITES_MERCADO.diaria_dit ? `sugeriu ${m(v)}/dia (teto ${m(LIMITES_MERCADO.diaria_dit)})` : null
    },
  },
  {
    id: 'R03', gravidade: 'atencao',
    titulo: 'Capital de morte acima do limite técnico de subscrição',
    porque: 'Acima de ~R$ 20 mi o caso vira resseguro facultativo, com exames e prazo '
      + 'de meses. O estudo pode propor, mas precisa avisar — senão a consultora promete prazo que não existe.',
    quando: (c, e) => {
      const v = e.valores.morte
      if (v > LIMITES_MERCADO.morte && !temAviso(e, 'resseguro')) {
        return `capital de ${m(v)} sem aviso de subscrição especial`
      }
      return null
    },
  },

  // ── B. O plano cabe no bolso? ─────────────────────────────────────────────
  {
    id: 'R04', gravidade: 'grave',
    titulo: 'Prêmio maior que a sobra mensal do cliente',
    porque: 'Se o cliente gasta tudo que ganha, o prêmio sai de onde? Apólice que não '
      + 'cabe no orçamento cancela em 6 meses — e cancelamento estorna comissão.',
    quando: (c, e) => {
      const premio = e.investimento?.mensal ?? 0
      if (!(premio > 0) || e.poupancaMensal == null) return null
      if (premio > e.poupancaMensal && !temAviso(e, 'sobra')) {
        return `prêmio ${m(premio)}/mês contra sobra de ${m(e.poupancaMensal)}/mês`
      }
      return null
    },
  },
  {
    id: 'R05', gravidade: 'atencao',
    titulo: 'Prêmio passa de 10% da renda sem nenhum aviso',
    porque: 'A régua de mercado para proteção pessoal é 5% a 10% da renda. O motor só '
      + 'avisa acima de 30% — três vezes o razoável. Entre 10% e 30% a consultora apresenta sem saber.',
    quando: (c, e) => {
      const pct = e.investimento?.pctRenda
      if (pct == null) return null
      return pct > 10 && !temAviso(e, 'da renda') ? `prêmio em ${pct}% da renda, sem aviso` : null
    },
  },

  // ── C. Proteção vendida para quem não precisa dela ────────────────────────
  {
    id: 'R06', gravidade: 'grave',
    titulo: 'Capital de morte cheio para cliente sem nenhum dependente',
    porque: 'Solteiro sem filhos, sem cônjuge e sem dívida: não há renda a substituir. '
      + 'Sugerir 10 anos de custo de vida é vender proteção para um risco que não existe — '
      + 'o certo é ir para doenças graves, invalidez e sucessão.',
    quando: (c, e) => {
      const semDependentes = e.filhos.length === 0
        && ['Solteiro(a)', 'Divorciado(a)', 'Viúvo(a)'].includes(c.plano.estado_civil)
      if (!semDependentes) return null
      if (e.sugestoes.morte > e.dividas + 60_000 && !temAviso(e, 'dependente')) {
        return `sem dependentes e sem aviso: sugeriu ${m(e.sugestoes.morte)} de morte`
      }
      return null
    },
  },
  {
    id: 'R07', gravidade: 'atencao',
    titulo: 'Estudo PJ puro apresentando coberturas de família',
    porque: 'Quando a consultora escolhe "Empresarial (PJ)", o estudo é sobre a empresa. '
      + 'Trazer morte/DIT/funeral calculados sobre uma renda pessoal que nem foi levantada '
      + 'polui a proposta e abre flanco de pergunta que ela não tem resposta.',
    quando: (c, e) => {
      if (e.tipo !== 'pj') return null
      const pf = e.ativas.filter((x) => !x.pj)
      return pf.length > 0 ? `${pf.length} cobertura(s) PF num estudo PJ: ${pf.map((x) => x.id).join(', ')}` : null
    },
  },
  {
    id: 'R08', gravidade: 'atencao',
    titulo: 'Idoso com capital de morte calculado como reposição de renda',
    porque: 'Aos 68 anos, com filhos adultos, a renda não precisa ser substituída por '
      + '20 anos. O capital certo é o do inventário. Projetar custo de vida × 20 anos '
      + 'infla o prêmio e derruba a venda.',
    quando: (c, e) => {
      if (e.idade == null || e.idade < 62) return null
      if (e.filhos.some((f) => f.idade != null && f.idade < IDADE_INDEPENDENCIA)) return null
      const rendaEmbutida = e.sugestoes.morte - e.dividas
      if (rendaEmbutida > 0 && e.custoInventario > 0 && rendaEmbutida > e.custoInventario * 2
        && !temAviso(e, 'reposição de renda')) {
        return `aos ${e.idade} anos: ${m(rendaEmbutida)} de reposição de renda contra ${m(e.custoInventario)} de inventário`
      }
      return null
    },
  },

  // ── D. Dinheiro contado duas vezes ────────────────────────────────────────
  {
    id: 'R09', gravidade: 'grave',
    titulo: 'A mesma apólice atual conta como capital de morte E como liquidez do inventário',
    porque: 'A cobertura que já existe aparece abatendo o gap de morte e, ao mesmo tempo, '
      + 'como dinheiro disponível para pagar o ITCMD. Se ela for usada para sustentar a '
      + 'família, não paga o imposto. O estudo promete o mesmo dinheiro duas vezes.',
    quando: (c, e) => {
      if (!(e.coberturaAtual > 0) || !(e.custoInventario > 0)) return null
      // A apólice atual só pode aparecer na liquidez sucessória na parte que
      // SOBRA depois de reservado o capital de morte. Se o capital de morte já
      // consome tudo e mesmo assim sobra alguma coisa aqui, é conta dupla.
      const consumidaPelaFamilia = Math.min(e.coberturaAtual, e.valores.morte)
      const livreDeclarada = e.coberturaLivreParaSucessao ?? e.coberturaAtual
      if (livreDeclarada + consumidaPelaFamilia > e.coberturaAtual + 0.01) {
        return `${m(e.coberturaAtual)} de apólice atual gerando ${m(livreDeclarada + consumidaPelaFamilia)} de uso`
      }
      return null
    },
  },
  {
    id: 'R10', gravidade: 'atencao',
    titulo: 'Previdência conta como liquidez do inventário e como reserva da família',
    porque: 'O saldo do VGBL aparece em `liquidezImediata` (paga o ITCMD) e em '
      + '`recursosLiquidos` (sustenta a família nos meses do gráfico). É um saldo só.',
    quando: (c, e) => {
      if (!(e.previdenciaLiquida > 0) || !(e.custoInventario > 0)) return null
      // O contrato: a liquidez que paga o inventário tem que ser a EARMARCADA
      // (sem o dinheiro já prometido à família), e a autonomia "hoje" tem que
      // descontar o inventário que ninguém cobriu. Sem esses dois campos, o
      // estudo está somando o mesmo saldo em duas contas diferentes.
      if (e.liquidezSucessoria == null) return 'estudo não separa a liquidez sucessória da reserva da família'
      if (e.custoInventarioNaoCoberto == null) return 'a autonomia "hoje" não desconta o custo do inventário'
      if (e.liquidezSucessoria > e.liquidezBruta + 0.01) {
        return `liquidez sucessória ${m(e.liquidezSucessoria)} maior que o disponível ${m(e.liquidezBruta)}`
      }
      return null
    },
  },

  // ── E. Perguntas decisivas que o sistema não faz ──────────────────────────
  {
    id: 'R11', gravidade: 'grave',
    titulo: 'Cliente casado sem regime de bens: o estudo tributa o patrimônio inteiro calado',
    porque: 'Sem o regime, o motor cai no "sem meação" e cobra ITCMD sobre 100% do '
      + 'patrimônio — pode superdimensionar a verba sucessória em 50%. E não pede o dado.',
    quando: (c, e) => {
      const casado = ['Casado(a)', 'União estável'].includes(c.plano.estado_civil)
      if (!casado || e.sucessao.regimeBens) return null
      if (!(e.custoInventario > 0)) return null
      return temAviso(e, 'regime de bens') ? null
        : `casado sem regime informado, ITCMD sobre ${m(e.sucessao.baseInventario)}`
    },
  },
  {
    id: 'R12', gravidade: 'atencao',
    titulo: 'ITCMD fixo em 4% sem perguntar o estado',
    porque: 'O ITCMD é estadual: 4% em SP, até 8% no RJ e progressivo em vários estados. '
      + 'Assumir 4% para todo mundo erra a verba sucessória em até 100% — para menos, '
      + 'que é o pior lado do erro.',
    quando: (c, e) => {
      if (!(e.custoInventario > 0)) return null
      if (c.plano.itcmd_pct) return null
      return e.itcmdOrigem == null || e.itcmdOrigem === 'padrao'
        ? `UF ${c.plano.uf} ignorada, usou ${e.itcmd}% fixo` : null
    },
  },
  {
    id: 'R13', gravidade: 'atencao',
    titulo: 'Autônomo/liberal sem DIT no estudo',
    porque: 'Para quem não tem CLT, o dia parado é o risco mais provável de todos — '
      + 'muito mais provável que a morte. Um estudo de autônomo sem DIT está incompleto.',
    quando: (c, e, d) => {
      if (!/Autônomo|MEI|Médic|Advogad|Dentista|Arquitet|Cabeleireira/i.test(c.plano.profissao ?? '')) return null
      if (e.valores.dit > 0) return null
      // DIT zerada porque a renda não foi levantada é falta de DADO, não de
      // conselho — desde que o sistema esteja pedindo o dado em voz alta.
      const pediuRenda = d?.pendencias?.some((p) => p.id === 'renda')
      return pediuRenda ? null : 'profissão autônoma e DIT zerada, sem pedir a renda'
    },
  },

  // ── F. Coerência interna do estudo ────────────────────────────────────────
  {
    id: 'R14', gravidade: 'grave',
    titulo: 'Verba sucessória cobre o imposto mas ignora o custo de segurar os bens',
    porque: 'Enquanto o inventário corre (6 a 18 meses), a família continua pagando IPTU, '
      + 'condomínio e as contas do imóvel travado. A verba calculada cobre só o ITCMD do dia 1.',
    quando: (c, e) => {
      if (!(e.custoInventario > 0) || !(e.sucessao.prazoInventarioMeses >= 6)) return null
      return e.custoSustentacaoInventario == null
        ? `inventário de ${e.sucessao.prazoInventarioMeses} meses sem custo de manutenção calculado`
        : null
    },
  },
  {
    id: 'R15', gravidade: 'atencao',
    titulo: 'Aval avalizado sem invalidez correspondente',
    porque: 'O aval é executado tanto na morte quanto na invalidez do avalista — o banco '
      + 'não espera o óbito. Cobrir aval só na morte deixa metade do risco na mesa.',
    quando: (c, e) => {
      if (!(e.valores.aval > 0)) return null
      return e.cenarios.invalidez >= e.valores.aval ? null
        : 'aval coberto na morte e descoberto na invalidez'
    },
  },
  {
    id: 'R16', gravidade: 'grave',
    titulo: 'Buy-sell sem número de sócios: não dá para saber quem compra a quota',
    porque: 'Acordo de sócios só funciona com apólice cruzada entre TODOS os sócios. '
      + 'Sem saber quantos são, o estudo apresenta um capital sem dizer quem paga o prêmio dele.',
    quando: (c, e) => {
      if (!(e.valores.socios > 0)) return null
      return e.pj.numSocios >= 2 ? null : `capital de ${m(e.valores.socios)} de buy-sell com ${e.pj.numSocios} sócio(s) informado(s)`
    },
  },
  {
    id: 'R17', gravidade: 'atencao',
    titulo: 'Participação de 100% recebendo capital de buy-sell',
    porque: 'Sócio único não tem com quem fazer buy-sell: não há outro sócio para comprar '
      + 'a quota. O capital certo aqui é homem-chave e liquidez sucessória, não acordo de sócios.',
    quando: (c, e) => {
      if (!(e.valores.socios > 0)) return null
      return e.pj.participacao >= 100 ? `100% do capital social com ${m(e.valores.socios)} de buy-sell` : null
    },
  },
  {
    id: 'R18', gravidade: 'atencao',
    titulo: 'Meta de aposentadoria e lacuna que não conversam',
    porque: 'A lacuna projeta o IR no resgate lá na frente; o aporte necessário parte do '
      + 'saldo já líquido hoje. São duas contas com premissas diferentes exibidas lado a lado.',
    quando: (c, e) => {
      const a = e.aposentadoria
      if (!a || a.aporteNecessario == null || !(a.lacuna > 0)) return null
      // reconstroi a lacuna a partir do aporte que o próprio estudo pede
      const conferencia = a.aporteNecessario > 0 && a.faltaAportar === 0 && a.lacuna > a.capitalNecessario * 0.05
      return conferencia ? `lacuna de ${m(a.lacuna)} com "falta aportar" zerado` : null
    },
  },
  {
    id: 'R19', gravidade: 'grave',
    titulo: 'Horizonte de proteção termina antes de a dívida acabar',
    porque: 'Financiamento de 30 anos com proteção de 10: nos 20 anos seguintes a família '
      + 'fica com o saldo devedor e sem capital. É o erro clássico do seguro temporário.',
    quando: (c, e) => {
      if (!(e.dividas > 0) || !(e.valores.morte > 0)) return null
      if (e.prazoDividaAnos == null) return null
      return e.anos < e.prazoDividaAnos && !temAviso(e, 'dívida') ? `proteção de ${e.anos} anos para dívida de ${e.prazoDividaAnos}` : null
    },
  },
  {
    id: 'R20', gravidade: 'atencao',
    titulo: 'Estudo sem nenhuma cobertura que paga em vida',
    porque: 'Invalidez, doenças graves e DIT são o que desmonta o "só serve se eu morrer". '
      + 'Um estudo só com morte é um estudo que perde a objeção mais comum da categoria.',
    quando: (c, e, d) => {
      if (e.ativas.length === 0) return null
      const emVida = e.ativas.some((x) => ['invalidez', 'doencas_graves', 'dit', 'dih'].includes(x.id))
      if (emVida) return null
      // Passa se o sistema NOTOU o buraco — seja avisando, seja recomendando
      // a cobertura, seja pedindo o dado que falta para dimensioná-la.
      const notou = temAviso(e, 'só paga se o cliente morrer')
        || d?.recomendacoes?.some((r) => ['sem-invalidez', 'sem-doencas-graves', 'sem-dit'].includes(r.id))
        || d?.pendencias?.some((p) => p.id === 'renda')
      return notou ? null : 'nenhuma cobertura paga com o cliente vivo, e o sistema não comentou'
    },
  },

  // ── G. O diagnóstico (a inteligência que palpita) ─────────────────────────
  {
    id: 'R21', gravidade: 'grave',
    titulo: 'Diagnóstico não produz nenhuma recomendação',
    porque: 'A consultora abre a aba e não recebe palpite nenhum. Um estudo com dados '
      + 'sempre tem pelo menos uma coisa a dizer — nem que seja o que falta preencher.',
    quando: (c, e, d) => {
      if (!d || d.recomendacoes.length > 0) return null
      // Estudo em branco não é omissão: se o sistema está pedindo os dados que
      // faltam, ele ESTÁ dizendo o que fazer. O que não pode é ficar mudo.
      return d.pendenciasCriticas.length > 0 ? null : 'zero recomendações e zero pendências críticas'
    },
  },
  {
    id: 'R22', gravidade: 'grave',
    titulo: 'Recomendação sem número ou sem justificativa',
    porque: 'Palpite sem conta atrás é chute. Toda recomendação precisa dizer de onde '
      + 'saiu — é isso que a consultora repete quando o cliente pergunta "por quê?".',
    quando: (c, e, d) => {
      if (!d) return null
      const ruim = d.recomendacoes.find((r) => !r.porque || r.porque.trim().length < 20)
      return ruim ? `"${ruim.titulo}" sem justificativa` : null
    },
  },
  {
    id: 'R23', gravidade: 'grave',
    titulo: 'Recomendação com número impossível na tela',
    porque: 'NaN, Infinity ou R$ -0 numa recomendação é o pior lugar possível para um bug: '
      + 'a consultora lê em voz alta para o cliente.',
    quando: (c, e, d) => {
      if (!d) return null
      const texto = JSON.stringify(d)
      const bug = texto.match(/NaN|Infinity|R\$ -|undefined/)
      return bug ? `encontrado "${bug[0]}"` : null
    },
  },
  {
    id: 'R24', gravidade: 'atencao',
    titulo: 'Perfil do cliente não classificado',
    porque: 'Sem saber se é família, sucessão, empresa ou acúmulo, o sistema não consegue '
      + 'priorizar nada — e todo conselho sai genérico.',
    quando: (c, e, d) => (d && !d.perfil?.id ? 'perfil nulo' : null),
  },

  // ── H. A carteira que ele já tem, o preço e os níveis ─────────────────────
  {
    id: 'R25', gravidade: 'grave',
    titulo: 'Cobertura da empresa contada como proteção permanente',
    porque: 'Vida em grupo acaba no dia em que o vínculo acaba, e o vínculo costuma acabar '
      + 'no pior momento. Abatida do capital de morte sem aviso, ela faz o estudo prometer '
      + 'uma proteção que some — e o cliente só descobre quando for recontratar mais velho.',
    quando: (c, e) => {
      if (!(e.capitalQueEvapora > 0) || !(e.valores.morte > 0)) return null
      return temAviso(e, 'dependem do vínculo')
        ? null
        : `${m(e.capitalQueEvapora)} de vida em grupo sem aviso nenhum`
    },
  },
  {
    id: 'R26', gravidade: 'grave',
    titulo: 'Prestamista do banco contada como capital da família',
    porque: 'O beneficiário do seguro do financiamento é o banco. Ele quita a dívida — que o '
      + 'estudo já desconta à parte — e não entrega um real. Abatê-lo do capital de morte '
      + 'desconta a mesma dívida duas vezes e encolhe o gap artificialmente.',
    quando: (c, e) => {
      if (!(e.carteira?.quitaDivida > 0) || !(e.coberturaAtual > 0)) return null
      return temAviso(e, 'prestamista') ? null : `${m(e.carteira.quitaDivida)} de prestamista sem aviso`
    },
  },
  {
    id: 'R27', gravidade: 'grave',
    titulo: 'Decomposição da carteira não fecha com o total',
    porque: 'Portátil + condicionada + prestamista tem que dar exatamente o total das apólices '
      + 'listadas. Se não fecha, algum caso caiu fora da classificação e o número que a '
      + 'consultora lê na tela está errado.',
    quando: (c, e) => {
      const k = e.carteira
      if (!k?.detalhado) return null
      const soma = k.portavel + k.condicionada + k.quitaDivida
      return Math.abs(soma - k.total) > 1
        ? `soma ${m(soma)} contra total ${m(k.total)}` : null
    },
  },
  {
    id: 'R28', gravidade: 'grave',
    titulo: 'Estimativa de prêmio com número impossível',
    porque: 'A faixa estimada é lida em voz alta na reunião. NaN, negativo ou um mínimo maior '
      + 'que o máximo ali é pior do que não ter estimativa nenhuma.',
    quando: (c, e) => {
      if (!estimarPremio) return null
      const p = estimarPremio(e)
      if (!p) return null
      if (![p.mensal, p.min, p.max].every((v) => Number.isFinite(v) && v >= 0)) {
        return `faixa inválida: ${p.min}–${p.max} (central ${p.mensal})`
      }
      if (p.min > p.mensal || p.mensal > p.max) return `faixa fora de ordem: ${p.min} / ${p.mensal} / ${p.max}`
      const somaItens = p.itens.reduce((s, i) => s + i.mensal, 0)
      return Math.abs(somaItens - p.mensal) > 1.5
        ? `itens somam ${somaItens.toFixed(2)} e o total diz ${p.mensal}` : null
    },
  },
  {
    id: 'R29', gravidade: 'atencao',
    titulo: 'Taxa estimada fora da faixa praticável do mercado',
    porque: 'Medida cobertura a cobertura (e não no bolo, que mistura diária com capital), '
      + 'a taxa mensal por R$ 1.000 tem uma faixa conhecida no vida individual brasileiro. '
      + 'Fora dela a estimativa desmoraliza a ferramenta na primeira vez que for usada. '
      + 'Idade acima da emissão é caso à parte: ali o preço alto é a informação, e o '
      + 'estimador tem que estar AVISANDO em vez de só cobrar caro.',
    quando: (c, e) => {
      if (!estimarPremio) return null
      const p = estimarPremio(e)
      if (!p) return null
      for (const item of p.itens) {
        // acima da idade de emissão o número é grande de propósito; o que a
        // auditoria cobra aqui é o aviso, não o valor
        if (item.foraDaIdadeDeEmissao) {
          if (!p.avisos.some((a) => a.id === item.id)) return `${item.rotulo} fora da idade de emissão e sem aviso`
          continue
        }
        // diárias são cotadas por R$ 1 de diária, régua diferente
        const porDiaria = item.id === 'dit' || item.id === 'dih'
        const taxa = porDiaria ? item.mensal / item.valor : (item.mensal / item.valor) * 1000
        const teto = porDiaria ? 1.2 : 8
        const piso = porDiaria ? 0.01 : 0.01
        if (taxa > teto) return `${item.rotulo}: R$ ${taxa.toFixed(2)} por ${porDiaria ? 'real de diária' : 'mil'} — caro demais para ser crível`
        if (taxa < piso) return `${item.rotulo}: R$ ${taxa.toFixed(3)} por ${porDiaria ? 'real de diária' : 'mil'} — barato demais para ser crível`
      }
      return null
    },
  },
  {
    id: 'R30', gravidade: 'grave',
    titulo: 'Níveis do plano fora de ordem ou repetidos',
    porque: 'A escada só ajuda a decidir se cada degrau custar mais e entregar mais que o de '
      + 'baixo. Dois níveis com o mesmo preço, ou um "completo" mais barato que o "essencial", '
      + 'transformam a escolha em confusão na frente do cliente.',
    quando: (c, e, d) => {
      if (!montarNiveis) return null
      const n = montarNiveis(e, { perfil: d?.perfil })
      if (!n) return null
      for (let k = 1; k < n.niveis.length; k++) {
        if (n.niveis[k].mensal <= n.niveis[k - 1].mensal) {
          return `${n.niveis[k].id} (${m(n.niveis[k].mensal)}) não é mais caro que ${n.niveis[k - 1].id} (${m(n.niveis[k - 1].mensal)})`
        }
        if (n.niveis[k].capital < n.niveis[k - 1].capital) {
          return `${n.niveis[k].id} custa mais e entrega menos capital que ${n.niveis[k - 1].id}`
        }
      }
      return null
    },
  },
  {
    id: 'R31', gravidade: 'grave',
    titulo: 'Plano que cabe no orçamento estoura o próprio teto',
    porque: 'A ferramenta existe para caber. Se o conjunto escolhido custa mais que o teto '
      + 'informado, ela entrega justamente o problema que veio resolver.',
    quando: (c, e, d) => {
      if (!planoQueCabe || !(e.poupancaMensal > 0)) return null
      const p = planoQueCabe(e, e.poupancaMensal, { perfil: d?.perfil })
      if (!p) return null
      if (p.mensal > p.teto) return `escolheu ${m(p.mensal)} para um teto de ${m(p.teto)}`
      if (p.sobra < 0) return `sobra negativa (${m(p.sobra)})`
      // o que ficou de fora tem que ser, de fato, o que não cabia
      const menorFora = Math.min(...p.fora.map((f) => f.mensal), Infinity)
      if (p.fora.length > 0 && p.mensal + menorFora <= p.teto) {
        return `deixou de fora um item de ${m(menorFora)} que ainda cabia na sobra de ${m(p.sobra)}`
      }
      return null
    },
  },

  // ── I. As camadas de conhecimento ─────────────────────────────────────────
  {
    id: 'R32', gravidade: 'grave',
    titulo: 'Prazo de emissão prometido sem sustentação',
    porque: 'A consultora repete esse prazo para o cliente no fim da reunião. Faixa invertida, '
      + 'prazo zero ou frase vazia vira promessa quebrada — e cliente perdoa preço, não perdoa '
      + 'surpresa depois de já ter decidido comprar.',
    quando: (c, e) => {
      if (!analisarSubscricao || e.ativas.length === 0) return null
      const s = analisarSubscricao(e, c.plano)
      if (!s) return null
      const [min, max] = s.prazoDias
      if (!(min > 0) || !(max >= min)) return `faixa de prazo inválida: ${min}–${max}`
      if (!s.combinado || s.combinado.length < 20) return 'sem a frase pronta para dizer ao cliente'
      if (s.exigencias.length === 0) return 'nenhuma exigência listada'
      return null
    },
  },
  {
    id: 'R33', gravidade: 'grave',
    titulo: 'Atividade que exclui acidente sem virar restrição escrita',
    porque: 'Agravo é preço; restrição é o cliente achar que está coberto justamente na hora de '
      + 'maior risco. Confundir os dois é o erro mais caro da subscrição, e ele só aparece no '
      + 'sinistro, quando ninguém pode mais resolver.',
    quando: (c, e) => {
      if (!analisarSubscricao || e.ativas.length === 0) return null
      const s = analisarSubscricao(e, c.plano)
      if (!s) return null
      const excluem = ['aviacao', 'mergulho', 'paraquedismo', 'automobilismo', 'escalada', 'caca_submarina']
      const declaradas = (c.plano.atividades_risco ?? []).filter((a) => excluem.includes(a))
      const faltando = declaradas.filter((a) => !s.restricoes.some((r) => r.id === a))
      return faltando.length > 0 ? `sem restrição escrita para: ${faltando.join(', ')}` : null
    },
  },
  {
    id: 'R34', gravidade: 'grave',
    titulo: 'Objeção respondida pela metade',
    porque: 'Meia resposta é dita na reunião com a mesma confiança da inteira, e é onde a '
      + 'conversa desanda. Toda objeção precisa de argumento, do que NÃO dizer e da pergunta '
      + 'que faz avançar — ou não deve aparecer.',
    quando: (c, e, d) => {
      if (!responderObjecoes) return null
      const r = responderObjecoes(e, { diagnostico: d, cliente: c.plano })
      if (!r) return null
      const ruim = r.lista.find((o) => !o.argumentos?.length || !o.naoDiga || !o.pergunta || !o.comoSoa)
      if (ruim) return `"${ruim.rotulo}" incompleta`
      const texto = JSON.stringify(r)
      const bug = texto.match(/NaN|Infinity|R\$ -|undefined/)
      return bug ? `encontrado "${bug[0]}" no texto lido em voz alta` : null
    },
  },
  {
    id: 'R35', gravidade: 'atencao',
    titulo: 'Objeção óbvia não prevista pelo estudo',
    porque: 'A ferramenta promete PREVER o que o cliente vai dizer. Se ele tem vida em grupo e '
      + '"já tenho seguro" não aparece entre as esperadas, a promessa não se cumpre justamente '
      + 'no caso em que ela seria mais útil.',
    quando: (c, e, d) => {
      if (!responderObjecoes) return null
      const r = responderObjecoes(e, { diagnostico: d, cliente: c.plano })
      if (!r) return null
      const esperado = (id) => r.esperadas.some((o) => o.id === id)
      if (e.carteira?.condicionada > 0 && !esperado('ja_tem')) {
        return 'vida em grupo na carteira e "já tenho seguro" fora das esperadas'
      }
      if (e.investimento?.pctRenda > 12 && !esperado('preco')) {
        return `prêmio em ${e.investimento.pctRenda}% da renda e "está caro" fora das esperadas`
      }
      return null
    },
  },
  {
    id: 'R36', gravidade: 'grave',
    titulo: 'Beneficiário menor sem alerta',
    porque: 'É o caso que acontece com quem fez tudo certo: o pai que indicou os filhos. A '
      + 'seguradora paga e o dinheiro trava em autorização judicial por meses — exatamente o '
      + 'contrário do que o seguro foi contratado para fazer. Passar batido aqui é falhar no '
      + 'propósito, não na regra.',
    quando: (c, e) => {
      if (!analisarBeneficiarios) return null
      const b = analisarBeneficiarios(c.plano, e, { hoje: c.hoje })
      if (!b) return null
      const temMenor = b.itens.some((x) => x.menor === true && x.pct > 0)
      if (temMenor && !b.alertas.some((x) => x.id === 'menor' && x.grave)) {
        return 'menor indicado e nenhum alerta grave'
      }
      if (b.declarado && Math.abs(b.somaPct - 100) > 0.5
        && !b.alertas.some((x) => x.id === 'soma')) {
        return `soma ${b.somaPct}% sem alerta`
      }
      return null
    },
  },
  {
    id: 'R37', gravidade: 'atencao',
    titulo: 'Correção de um clique oferecida na unidade errada',
    porque: 'Os dois lugares em que o sistema oferece corrigir um número com um clique '
      + 'formatavam tudo como dinheiro. "Estender a proteção para 18 anos" virava o botão '
      + '"Aplicar R$ 18", e quem bate o olho entende que o estudo sugere dezoito reais de '
      + 'alguma coisa. Campo de contagem tem que sair com a unidade dele.',
    quando: (c, e, d) => {
      if (!valorDoCampo) return null
      const alvos = [
        ...e.inconsistencias.filter((i) => i.corrigir).map((i) => [i.corrigir, i.valor]),
        ...(d?.recomendacoes ?? []).filter((r) => r.campo && r.valor > 0).map((r) => [r.campo, r.valor]),
      ]
      const CONTAGEM = ['anos_protecao', 'dividas_prazo_anos', 'idade_aposentadoria',
        'pj_num_socios', 'num_dependentes', 'dit_dias', 'dih_dias', 'dit_franquia_dias']
      for (const [campo, valor] of alvos) {
        const texto = valorDoCampo(campo, valor)
        if (CONTAGEM.includes(campo) && /R\$/.test(texto)) {
          return `${campo} saindo como dinheiro: "${texto}"`
        }
        if (!CONTAGEM.includes(campo) && !/R\$|%|cm|kg/.test(texto)) {
          return `${campo} saindo sem unidade nenhuma: "${texto}"`
        }
      }
      return null
    },
  },
]

// ─── Execução ────────────────────────────────────────────────────────────────
const achados = new Map(REGRAS.map((r) => [r.id, { regra: r, casos: [], porPublico: new Map() }]))
const totalPorPublico = new Map()
const erros = []
let comDiagnostico = 0

console.log(`\n  AUDITORIA DE PLANEJAMENTO — ${CASOS.toLocaleString('pt-BR')} clientes plausíveis`)
console.log(`  semente ${process.env.SEMENTE ?? 20260813} · ${REGRAS.length} regras de revisão\n`)

for (let i = 0; i < CASOS; i++) {
  const c = gerarCenario()
  totalPorPublico.set(c.publico, (totalPorPublico.get(c.publico) ?? 0) + 1)

  let e
  try {
    e = calcularEstudo(c.plano, { dataNascimento: c.dataNascimento, hoje: c.hoje })
  } catch (err) {
    erros.push(`caso ${i} (${c.rotulo}): calcularEstudo explodiu — ${err.message}`)
    continue
  }
  if (!e) { erros.push(`caso ${i}: estudo nulo`); continue }

  let d = null
  if (diagnosticar) {
    try {
      d = diagnosticar(e, { cliente: { nome: 'Cliente', profissao: c.plano.profissao } })
      if (d) comDiagnostico += 1
    } catch (err) {
      erros.push(`caso ${i} (${c.rotulo}): diagnosticar explodiu — ${err.message}`)
    }
  }

  for (const regra of REGRAS) {
    if (!diagnosticar && regra.id >= 'R21') continue
    let achou
    try {
      achou = regra.quando(c, e, d)
    } catch (err) {
      erros.push(`caso ${i}: regra ${regra.id} explodiu — ${err.message}`)
      continue
    }
    if (!achou) continue
    const alvo = achados.get(regra.id)
    if (alvo.casos.length < 3) alvo.casos.push({ i, rotulo: c.rotulo, detalhe: achou, cenario: c })
    alvo.total = (alvo.total ?? 0) + 1
    alvo.porPublico.set(c.publico, (alvo.porPublico.get(c.publico) ?? 0) + 1)
  }

  if (alvoDetalhe && achados.get(alvoDetalhe)?.total === 1 && achados.get(alvoDetalhe).casos.length === 1) {
    console.log(`\n── CASO DE ${alvoDetalhe} ──`)
    console.log(JSON.stringify({ cenario: c, estudo: e, diagnostico: d }, null, 2).slice(0, 12_000))
  }
}

// ─── Relatório ───────────────────────────────────────────────────────────────
const lista = [...achados.values()].filter((a) => a.total > 0)
  .sort((a, b) => {
    const peso = (x) => (x.regra.gravidade === 'grave' ? 1e9 : 0) + x.total
    return peso(b) - peso(a)
  })

const pct = (n) => `${((n / CASOS) * 100).toFixed(1).replace('.', ',')}%`

if (erros.length > 0) {
  console.log('  ⛔ FALHAS DE EXECUÇÃO')
  for (const x of erros.slice(0, 10)) console.log(`     ${x}`)
  if (erros.length > 10) console.log(`     … e mais ${erros.length - 10}`)
  console.log('')
}

if (lista.length === 0) {
  console.log(`  ✅ Nenhuma das regras de revisão encontrou problema nos ${CASOS.toLocaleString('pt-BR')} planejamentos.\n`)
} else {
  for (const a of lista) {
    const sigla = a.regra.gravidade === 'grave' ? '🔴 GRAVE  ' : '🟡 ATENÇÃO'
    console.log(`  ${sigla} ${a.regra.id} · ${a.regra.titulo}`)
    console.log(`     ${a.total.toLocaleString('pt-BR')} de ${CASOS.toLocaleString('pt-BR')} planejamentos (${pct(a.total)})`)
    const porPub = [...a.porPublico.entries()].sort((x, y) => y[1] - x[1])
      .map(([p, n]) => `${p} ${Math.round((n / (totalPorPublico.get(p) || 1)) * 100)}%`).join(' · ')
    console.log(`     onde dói: ${porPub}`)
    console.log(`     ${a.regra.porque.replace(/\s+/g, ' ')}`)
    for (const caso of a.casos.slice(0, 2)) {
      console.log(`     ex.: [${caso.rotulo}] ${caso.detalhe}`)
    }
    console.log('')
  }
}

const graves = lista.filter((a) => a.regra.gravidade === 'grave')
console.log('  ─────────────────────────────────────────────────────────────')
console.log(`  ${lista.length} regra(s) com achado · ${graves.length} grave(s)`)
console.log(`  diagnóstico produzido em ${comDiagnostico.toLocaleString('pt-BR')} de ${CASOS.toLocaleString('pt-BR')} estudos`)
console.log(`  planejamentos por público: ${[...totalPorPublico.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(' · ')}`)
console.log('  ─────────────────────────────────────────────────────────────\n')

// ─── Modo trava ──────────────────────────────────────────────────────────────
// Depois de corrigido, cada regra vira contrato: `--travar` reprova se qualquer
// regra passar do limite aceito. É o que roda no `npm test`.
const LIMITES_ACEITOS = {
  // Regras que dependem de dado que o cliente pode legitimamente não ter.
  R12: 0.02,   // UF em branco no cadastro
  R13: 0.02,   // profissão em branco
  R16: 0.02,   // nº de sócios em branco num estudo PJ incompleto
}
if (process.argv.includes('--travar')) {
  const reprovadas = lista.filter((a) => {
    const limite = LIMITES_ACEITOS[a.regra.id] ?? 0
    return a.total / CASOS > limite
  })
  if (erros.length > 0 || reprovadas.length > 0) {
    console.log('  ⛔ AUDITORIA REPROVADA')
    for (const a of reprovadas) {
      console.log(`     ${a.regra.id} em ${pct(a.total)} (limite ${((LIMITES_ACEITOS[a.regra.id] ?? 0) * 100).toFixed(0)}%)`)
    }
    console.log('')
    process.exit(1)
  }
  console.log('  ✅ Auditoria aprovada — todas as regras dentro do limite.\n')
}
