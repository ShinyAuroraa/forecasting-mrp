import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================
// CLEAN DATABASE
// ============================================

async function cleanDatabase() {
  console.log('  Cleaning database...');
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  for (const { tablename } of tablenames) {
    if (tablename === '_prisma_migrations') continue;
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
  }
  console.log('  Database cleaned.');
}

// ============================================
// SEED: UNIDADES DE MEDIDA
// ============================================

const UNIDADES = [
  { sigla: 'UN', nome: 'Unidade', fatorConversao: 1 },
  { sigla: 'KG', nome: 'Quilograma', fatorConversao: 1 },
  { sigla: 'LT', nome: 'Litro', fatorConversao: 1 },
  { sigla: 'CX', nome: 'Caixa', fatorConversao: 12 },
  { sigla: 'MT', nome: 'Metro', fatorConversao: 1 },
  { sigla: 'M2', nome: 'Metro Quadrado', fatorConversao: 1 },
  { sigla: 'M3', nome: 'Metro Cubico', fatorConversao: 1 },
  { sigla: 'PCT', nome: 'Pacote', fatorConversao: 6 },
];

async function seedUnidadesMedida() {
  console.log('  Seeding unidades de medida...');
  const created = await prisma.unidadeMedida.createManyAndReturn({
    data: UNIDADES,
  });
  return created;
}

// ============================================
// SEED: CATEGORIAS
// ============================================

async function seedCategorias() {
  console.log('  Seeding categorias...');
  const roots = [
    { nome: 'Alimentos', descricao: 'Produtos alimenticios' },
    { nome: 'Bebidas', descricao: 'Bebidas em geral' },
    { nome: 'Embalagens', descricao: 'Materiais de embalagem' },
    { nome: 'Insumos Industriais', descricao: 'Insumos para producao' },
    { nome: 'Produtos Quimicos', descricao: 'Produtos quimicos e aditivos' },
  ];

  const rootCats = [];
  for (const r of roots) {
    rootCats.push(await prisma.categoria.create({ data: r }));
  }

  const subCats: { nome: string; descricao: string; paiId: string }[] = [
    { nome: 'Congelados', descricao: 'Alimentos congelados', paiId: rootCats[0].id },
    { nome: 'Resfriados', descricao: 'Alimentos resfriados', paiId: rootCats[0].id },
    { nome: 'Refrigerantes', descricao: 'Bebidas gaseificadas', paiId: rootCats[1].id },
    { nome: 'Sucos', descricao: 'Sucos naturais e concentrados', paiId: rootCats[1].id },
    { nome: 'Plasticos', descricao: 'Embalagens plasticas', paiId: rootCats[2].id },
    { nome: 'Papelao', descricao: 'Embalagens de papelao', paiId: rootCats[2].id },
    { nome: 'Aditivos', descricao: 'Aditivos alimentares', paiId: rootCats[3].id },
    { nome: 'Conservantes', descricao: 'Conservantes industriais', paiId: rootCats[3].id },
    { nome: 'Corantes', descricao: 'Corantes alimenticios', paiId: rootCats[4].id },
    { nome: 'Aromatizantes', descricao: 'Aromatizantes e saborizantes', paiId: rootCats[4].id },
  ];

  const level1Cats = [];
  for (const s of subCats) {
    level1Cats.push(await prisma.categoria.create({ data: s }));
  }

  const level2Cats = [
    { nome: 'Pratos Prontos', descricao: 'Pratos prontos congelados', paiId: level1Cats[0].id },
    { nome: 'Iogurtes', descricao: 'Iogurtes e derivados', paiId: level1Cats[1].id },
    { nome: 'Garrafas PET', descricao: 'Garrafas PET diversas', paiId: level1Cats[4].id },
    { nome: 'Caixas Corrugadas', descricao: 'Caixas de papelao corrugado', paiId: level1Cats[5].id },
    { nome: 'Essencias', descricao: 'Essencias naturais', paiId: level1Cats[9].id },
  ];

  for (const l of level2Cats) {
    await prisma.categoria.create({ data: l });
  }

  return [...rootCats, ...level1Cats];
}

// ============================================
// SEED: PRODUTOS (100+ SKUs)
// ============================================

type CreatedUnidade = { id: string; sigla: string };
type CreatedCategoria = { id: string; nome: string };

function generateProdutos(unidades: CreatedUnidade[], categorias: CreatedCategoria[]) {
  const unUN = unidades.find(u => u.sigla === 'UN')!;
  const unKG = unidades.find(u => u.sigla === 'KG')!;
  const unLT = unidades.find(u => u.sigla === 'LT')!;
  const unMT = unidades.find(u => u.sigla === 'MT')!;
  const unCX = unidades.find(u => u.sigla === 'CX')!;
  const unPCT = unidades.find(u => u.sigla === 'PCT')!;

  const produtos: Array<{
    codigo: string;
    descricao: string;
    tipoProduto: 'ACABADO' | 'SEMI_ACABADO' | 'INSUMO' | 'EMBALAGEM' | 'MATERIA_PRIMA' | 'REVENDA';
    categoriaId: string;
    unidadeMedidaId: string;
    custoUnitario: number;
    precoVenda: number | null;
    pesoLiquidoKg: number;
    politicaRessuprimento: 'PONTO_PEDIDO' | 'MIN_MAX' | 'REVISAO_PERIODICA' | 'KANBAN';
    leadTimeProducaoDias: number | null;
    loteMinimo: number;
    multiploCompra: number;
  }> = [];

  const acabadoNames = [
    'Lasanha Bolonhesa 350g', 'Pizza Margherita 450g', 'Hamburguer Artesanal 200g',
    'Sorvete Chocolate 1L', 'Iogurte Natural 170g', 'Suco Laranja 1L',
    'Refrigerante Cola 2L', 'Agua Mineral 500ml', 'Biscoito Recheado 130g',
    'Bolo Chocolate 500g', 'Pao de Forma Integral', 'Cereal Matinal 300g',
    'Macarrao Instantaneo 80g', 'Molho de Tomate 340g', 'Leite UHT 1L',
    'Queijo Prato Fatiado 150g', 'Presunto Fatiado 200g', 'Manteiga 200g',
    'Requeijao Cremoso 200g', 'Cream Cheese 150g', 'Catchup 400g',
    'Mostarda 200g', 'Maionese 500g', 'Azeite Extra Virgem 500ml',
    'Vinagre Maca 750ml',
  ];

  for (let i = 0; i < 25; i++) {
    produtos.push({
      codigo: `SKU-PA-${String(i + 1).padStart(3, '0')}`,
      descricao: acabadoNames[i],
      tipoProduto: 'ACABADO',
      categoriaId: pick(categorias).id,
      unidadeMedidaId: i < 8 ? unUN.id : (i < 15 ? unLT.id : unKG.id),
      custoUnitario: randomBetween(5, 50),
      precoVenda: randomBetween(10, 80),
      pesoLiquidoKg: randomBetween(0.1, 2.5),
      politicaRessuprimento: 'PONTO_PEDIDO',
      leadTimeProducaoDias: randomInt(1, 5),
      loteMinimo: pick([1, 10, 12, 24]),
      multiploCompra: pick([1, 6, 12]),
    });
  }

  const semiNames = [
    'Massa Lasanha Pré-cozida', 'Recheio Bolonhesa', 'Molho Bechamel',
    'Massa Pizza', 'Blend Hamburguer', 'Base Sorvete',
    'Calda Chocolate', 'Polpa Laranja Concentrada', 'Xarope Simples',
    'Massa Biscoito', 'Massa Bolo Base', 'Recheio Chocolate',
    'Massa Pao Integral', 'Mistura Cereal', 'Base Iogurte',
  ];

  for (let i = 0; i < 15; i++) {
    produtos.push({
      codigo: `SKU-SA-${String(i + 1).padStart(3, '0')}`,
      descricao: semiNames[i],
      tipoProduto: 'SEMI_ACABADO',
      categoriaId: pick(categorias).id,
      unidadeMedidaId: i < 10 ? unKG.id : unLT.id,
      custoUnitario: randomBetween(3, 25),
      precoVenda: null,
      pesoLiquidoKg: randomBetween(0.5, 10),
      politicaRessuprimento: 'MIN_MAX',
      leadTimeProducaoDias: randomInt(1, 3),
      loteMinimo: pick([5, 10, 25]),
      multiploCompra: pick([1, 5]),
    });
  }

  const insumoNames = [
    'Farinha de Trigo Tipo 1', 'Acucar Cristal', 'Sal Refinado',
    'Oleo de Soja', 'Leite em Po Integral', 'Ovo Liquido Pasteurizado',
    'Manteiga sem Sal', 'Fermento Biologico', 'Fermento Quimico',
    'Amido de Milho', 'Extrato de Tomate', 'Carne Bovina Moida',
    'Carne Suina', 'Frango Desossado', 'Queijo Mussarela Bloco',
    'Leite Integral In Natura', 'Creme de Leite', 'Cacau em Po',
    'Essencia Baunilha', 'Gelatina em Po', 'Lecitina de Soja',
    'Acido Citrico', 'Sorbato de Potassio', 'Pectina', 'Goma Xantana',
  ];

  for (let i = 0; i < 25; i++) {
    produtos.push({
      codigo: `SKU-IN-${String(i + 1).padStart(3, '0')}`,
      descricao: insumoNames[i],
      tipoProduto: 'INSUMO',
      categoriaId: pick(categorias).id,
      unidadeMedidaId: i < 18 ? unKG.id : unLT.id,
      custoUnitario: randomBetween(2, 30),
      precoVenda: null,
      pesoLiquidoKg: randomBetween(0.5, 25),
      politicaRessuprimento: pick(['PONTO_PEDIDO', 'MIN_MAX']),
      leadTimeProducaoDias: null,
      loteMinimo: pick([1, 5, 10, 25]),
      multiploCompra: pick([1, 5, 10]),
    });
  }

  const embalagemNames = [
    'Bandeja PP 350ml', 'Bandeja PP 500ml', 'Filme PVC Stretch',
    'Caixa Papelao 30x20x15', 'Caixa Papelao 40x30x20', 'Rotulo Adesivo 10x5',
    'Tampa Plastica 85mm', 'Garrafa PET 1L', 'Garrafa PET 2L', 'Saco Plastico 20x30',
  ];

  for (let i = 0; i < 10; i++) {
    produtos.push({
      codigo: `SKU-EM-${String(i + 1).padStart(3, '0')}`,
      descricao: embalagemNames[i],
      tipoProduto: 'EMBALAGEM',
      categoriaId: pick(categorias).id,
      unidadeMedidaId: i < 7 ? unUN.id : unMT.id,
      custoUnitario: randomBetween(0.5, 5),
      precoVenda: null,
      pesoLiquidoKg: randomBetween(0.01, 0.5),
      politicaRessuprimento: 'KANBAN',
      leadTimeProducaoDias: null,
      loteMinimo: pick([100, 500, 1000]),
      multiploCompra: pick([100, 500]),
    });
  }

  const mpNames = [
    'Trigo Granel', 'Cana de Acucar', 'Leite Cru',
    'Cacau in Natura', 'Soja Granel', 'Milho Granel',
    'Tomate Industrial', 'Laranja', 'Uva',
    'Cevada', 'Arroz Granel', 'Agua Tratada',
    'Gas Carbonico', 'Polietileno PEAD', 'Polipropileno PP',
    'Papel Kraft 120g/m2', 'Tinta Flexografica', 'Cola PVA',
    'Pallets Madeira', 'Stretch Film Industrial',
  ];

  for (let i = 0; i < 20; i++) {
    produtos.push({
      codigo: `SKU-MP-${String(i + 1).padStart(3, '0')}`,
      descricao: mpNames[i],
      tipoProduto: 'MATERIA_PRIMA',
      categoriaId: pick(categorias).id,
      unidadeMedidaId: i < 12 ? unKG.id : (i < 16 ? unLT.id : unMT.id),
      custoUnitario: randomBetween(1, 15),
      precoVenda: null,
      pesoLiquidoKg: randomBetween(1, 50),
      politicaRessuprimento: pick(['PONTO_PEDIDO', 'REVISAO_PERIODICA']),
      leadTimeProducaoDias: null,
      loteMinimo: pick([50, 100, 500, 1000]),
      multiploCompra: pick([25, 50, 100]),
    });
  }

  const revendaNames = [
    'Tempero Pronto Completo', 'Molho Ingles Importado',
    'Azeite Trufado Importado', 'Vinagre Balsamico', 'Mel Organico',
  ];

  for (let i = 0; i < 5; i++) {
    produtos.push({
      codigo: `SKU-RV-${String(i + 1).padStart(3, '0')}`,
      descricao: revendaNames[i],
      tipoProduto: 'REVENDA',
      categoriaId: pick(categorias).id,
      unidadeMedidaId: unUN.id,
      custoUnitario: randomBetween(15, 80),
      precoVenda: randomBetween(25, 120),
      pesoLiquidoKg: randomBetween(0.2, 1),
      politicaRessuprimento: 'PONTO_PEDIDO',
      leadTimeProducaoDias: null,
      loteMinimo: 1,
      multiploCompra: 1,
    });
  }

  return produtos;
}

async function seedProdutos(unidades: CreatedUnidade[], categorias: CreatedCategoria[]) {
  console.log('  Seeding produtos (100+ SKUs)...');
  const data = generateProdutos(unidades, categorias);
  const created = [];
  for (const p of data) {
    created.push(await prisma.produto.create({ data: p }));
  }
  console.log(`  Created ${created.length} produtos.`);
  return created;
}

// ============================================
// SEED: FORNECEDORES
// ============================================

async function seedFornecedores() {
  console.log('  Seeding fornecedores...');
  const fornecedores = [
    { codigo: 'FORN-001', razaoSocial: 'Moinho Brasil Ltda', nomeFantasia: 'Moinho Brasil', cnpj: '12.345.678/0001-90', email: 'vendas@moinhobrasil.com.br', telefone: '(11) 3456-7890', cidade: 'Sao Paulo', estado: 'SP', leadTimePadraoDias: 7, leadTimeMinDias: 5, leadTimeMaxDias: 10, confiabilidadePct: 95, avaliacao: 5 },
    { codigo: 'FORN-002', razaoSocial: 'Acucar Nacional S.A.', nomeFantasia: 'AcucarNac', cnpj: '23.456.789/0001-01', email: 'comercial@acucarnac.com.br', telefone: '(16) 3234-5678', cidade: 'Ribeirao Preto', estado: 'SP', leadTimePadraoDias: 10, leadTimeMinDias: 7, leadTimeMaxDias: 14, confiabilidadePct: 92, avaliacao: 4 },
    { codigo: 'FORN-003', razaoSocial: 'Laticinios Serra Gaúcha', nomeFantasia: 'Serra Lac', cnpj: '34.567.890/0001-12', email: 'pedidos@serralac.com.br', telefone: '(54) 3456-1234', cidade: 'Caxias do Sul', estado: 'RS', leadTimePadraoDias: 14, leadTimeMinDias: 10, leadTimeMaxDias: 21, confiabilidadePct: 88, avaliacao: 4 },
    { codigo: 'FORN-004', razaoSocial: 'Embalagens Futuro Ind. Com.', nomeFantasia: 'EmbalaFut', cnpj: '45.678.901/0001-23', email: 'vendas@embalafut.com.br', telefone: '(41) 3567-8901', cidade: 'Curitiba', estado: 'PR', leadTimePadraoDias: 21, leadTimeMinDias: 14, leadTimeMaxDias: 30, confiabilidadePct: 90, avaliacao: 3 },
    { codigo: 'FORN-005', razaoSocial: 'Quimica Paulista Ltda', nomeFantasia: 'QuimPaul', cnpj: '56.789.012/0001-34', email: 'sac@quimpaul.com.br', telefone: '(11) 4567-2345', cidade: 'Guarulhos', estado: 'SP', leadTimePadraoDias: 30, leadTimeMinDias: 21, leadTimeMaxDias: 45, confiabilidadePct: 85, avaliacao: 3 },
    { codigo: 'FORN-006', razaoSocial: 'Carnes Premium do Sul', nomeFantasia: 'Premium Sul', cnpj: '67.890.123/0001-45', email: 'atacado@premiumsul.com.br', telefone: '(51) 3678-9012', cidade: 'Porto Alegre', estado: 'RS', leadTimePadraoDias: 5, leadTimeMinDias: 3, leadTimeMaxDias: 7, confiabilidadePct: 97, avaliacao: 5 },
    { codigo: 'FORN-007', razaoSocial: 'Citrus Valley Export', nomeFantasia: 'Citrus Valley', cnpj: '78.901.234/0001-56', email: 'export@citrusvalley.com.br', telefone: '(14) 3789-0123', cidade: 'Araraquara', estado: 'SP', leadTimePadraoDias: 10, leadTimeMinDias: 7, leadTimeMaxDias: 14, confiabilidadePct: 91, avaliacao: 4 },
    { codigo: 'FORN-008', razaoSocial: 'Petroplast Ind. Plasticos', nomeFantasia: 'Petroplast', cnpj: '89.012.345/0001-67', email: 'vendas@petroplast.ind.br', telefone: '(19) 3890-1234', cidade: 'Campinas', estado: 'SP', leadTimePadraoDias: 45, leadTimeMinDias: 30, leadTimeMaxDias: 60, confiabilidadePct: 82, avaliacao: 3 },
    { codigo: 'FORN-009', razaoSocial: 'Papel & Celulose Minas', nomeFantasia: 'PapelMinas', cnpj: '90.123.456/0001-78', email: 'comercial@papelminas.com.br', telefone: '(31) 3901-2345', cidade: 'Belo Horizonte', estado: 'MG', leadTimePadraoDias: 15, leadTimeMinDias: 10, leadTimeMaxDias: 21, confiabilidadePct: 93, avaliacao: 4 },
    { codigo: 'FORN-010', razaoSocial: 'Importadora Sabores do Mundo', nomeFantasia: 'Sabores do Mundo', cnpj: '01.234.567/0001-89', email: 'import@saboresmundo.com.br', telefone: '(11) 5012-3456', cidade: 'Sao Paulo', estado: 'SP', leadTimePadraoDias: 60, leadTimeMinDias: 45, leadTimeMaxDias: 90, confiabilidadePct: 78, avaliacao: 3 },
    { codigo: 'FORN-011', razaoSocial: 'Graos do Cerrado Ltda', nomeFantasia: 'GraosCerrado', cnpj: '11.222.333/0001-44', email: 'vendas@graoscerrado.com.br', telefone: '(62) 3123-4567', cidade: 'Goiania', estado: 'GO', leadTimePadraoDias: 12, leadTimeMinDias: 8, leadTimeMaxDias: 18, confiabilidadePct: 89, avaliacao: 4 },
    { codigo: 'FORN-012', razaoSocial: 'Gases Industriais BR', nomeFantasia: 'GasesBR', cnpj: '22.333.444/0001-55', email: 'contato@gasesbr.com.br', telefone: '(21) 3234-5678', cidade: 'Rio de Janeiro', estado: 'RJ', leadTimePadraoDias: 3, leadTimeMinDias: 2, leadTimeMaxDias: 5, confiabilidadePct: 99, avaliacao: 5 },
  ];

  const created = [];
  for (const f of fornecedores) {
    created.push(await prisma.fornecedor.create({ data: f }));
  }
  return created;
}

// ============================================
// SEED: PRODUTO-FORNECEDOR
// ============================================

type CreatedProduto = { id: string; codigo: string; tipoProduto: string };
type CreatedFornecedor = { id: string; codigo: string };

async function seedProdutoFornecedor(produtos: CreatedProduto[], fornecedores: CreatedFornecedor[]) {
  console.log('  Seeding produto-fornecedor links...');
  const purchasableTypes = ['INSUMO', 'MATERIA_PRIMA', 'EMBALAGEM', 'REVENDA'];
  const purchasable = produtos.filter(p => purchasableTypes.includes(p.tipoProduto));
  let count = 0;

  for (const prod of purchasable) {
    const numSuppliers = randomInt(2, 4);
    const selectedSuppliers = [...fornecedores].sort(() => Math.random() - 0.5).slice(0, numSuppliers);

    for (let i = 0; i < selectedSuppliers.length; i++) {
      await prisma.produtoFornecedor.create({
        data: {
          produtoId: prod.id,
          fornecedorId: selectedSuppliers[i].id,
          leadTimeDias: randomInt(5, 45),
          precoUnitario: randomBetween(1, 50),
          moq: randomBetween(1, 100),
          multiploCompra: pick([1, 5, 10, 25]),
          isPrincipal: i === 0,
        },
      });
      count++;
    }
  }
  console.log(`  Created ${count} produto-fornecedor links.`);
}

// ============================================
// SEED: BOM (Multi-Level)
// ============================================

async function seedBom(produtos: CreatedProduto[]) {
  console.log('  Seeding BOM structures...');
  const acabados = produtos.filter(p => p.tipoProduto === 'ACABADO');
  const semiAcabados = produtos.filter(p => p.tipoProduto === 'SEMI_ACABADO');
  const insumos = produtos.filter(p => p.tipoProduto === 'INSUMO');
  const materiasPrimas = produtos.filter(p => p.tipoProduto === 'MATERIA_PRIMA');
  const embalagens = produtos.filter(p => p.tipoProduto === 'EMBALAGEM');
  let count = 0;
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < acabados.length; i++) {
    const pa = acabados[i];
    const numComponents = randomInt(2, 4);
    const components = [...semiAcabados, ...insumos].sort(() => Math.random() - 0.5).slice(0, numComponents);

    for (const comp of components) {
      await prisma.bom.create({
        data: {
          produtoPaiId: pa.id,
          produtoFilhoId: comp.id,
          quantidade: randomBetween(0.05, 2),
          perdaPercentual: randomBetween(0, 5),
          nivel: 1,
          ativo: true,
          validoDesde: new Date(today),
        },
      });
      count++;

      // Level 2: add raw materials to semi-acabados
      if (comp.tipoProduto === 'SEMI_ACABADO') {
        const numRaw = randomInt(1, 3);
        const rawMats = [...materiasPrimas, ...insumos].sort(() => Math.random() - 0.5).slice(0, numRaw);
        for (const raw of rawMats) {
          if (raw.id === comp.id) continue; // avoid self-reference
          await prisma.bom.create({
            data: {
              produtoPaiId: comp.id,
              produtoFilhoId: raw.id,
              quantidade: randomBetween(0.1, 5),
              perdaPercentual: randomBetween(0, 3),
              nivel: 2,
              ativo: true,
              validoDesde: new Date(today),
            },
          });
          count++;
        }
      }
    }

    // Add 1 packaging material per finished product
    const emb = pick(embalagens);
    await prisma.bom.create({
      data: {
        produtoPaiId: pa.id,
        produtoFilhoId: emb.id,
        quantidade: 1,
        perdaPercentual: randomBetween(0, 2),
        nivel: 1,
        ativo: true,
        validoDesde: new Date(today),
      },
    });
    count++;
  }

  console.log(`  Created ${count} BOM entries.`);
}

// ============================================
// SEED: DEPOSITOS
// ============================================

async function seedDepositos() {
  console.log('  Seeding depositos...');
  const depositos = [
    { codigo: 'DEP-MP', nome: 'Almoxarifado Materia Prima', tipo: 'MATERIA_PRIMA' as const, capacidadeM3: 500, capacidadePosicoes: 200, capacidadeKg: 50000 },
    { codigo: 'DEP-PA', nome: 'Estoque Produto Acabado', tipo: 'PRODUTO_ACABADO' as const, capacidadeM3: 1000, capacidadePosicoes: 500, capacidadeKg: 100000 },
    { codigo: 'DEP-WIP', nome: 'Estoque em Processo', tipo: 'WIP' as const, capacidadeM3: 200, capacidadePosicoes: 80, capacidadeKg: 20000 },
    { codigo: 'DEP-EXP', nome: 'Expedicao', tipo: 'EXPEDICAO' as const, capacidadeM3: 300, capacidadePosicoes: 150, capacidadeKg: 30000 },
    { codigo: 'DEP-QA', nome: 'Quarentena', tipo: 'QUARENTENA' as const, capacidadeM3: 100, capacidadePosicoes: 50, capacidadeKg: 10000 },
  ];

  const created = [];
  for (const d of depositos) {
    created.push(await prisma.deposito.create({ data: d }));
  }
  return created;
}

// ============================================
// SEED: INVENTARIO ATUAL
// ============================================

type CreatedDeposito = { id: string; codigo: string; tipo: string };

async function seedInventarioAtual(produtos: CreatedProduto[], depositos: CreatedDeposito[]) {
  console.log('  Seeding inventario atual...');
  const depMP = depositos.find(d => d.codigo === 'DEP-MP')!;
  const depPA = depositos.find(d => d.codigo === 'DEP-PA')!;
  const depWIP = depositos.find(d => d.codigo === 'DEP-WIP')!;
  let count = 0;

  for (const prod of produtos) {
    let depositoId: string;
    if (prod.tipoProduto === 'ACABADO') depositoId = depPA.id;
    else if (prod.tipoProduto === 'SEMI_ACABADO') depositoId = depWIP.id;
    else depositoId = depMP.id;

    const qtyDisponivel = randomBetween(50, 5000);
    const qtyReservada = randomBetween(0, qtyDisponivel * 0.1);
    const qtyTransito = Math.random() > 0.7 ? randomBetween(0, qtyDisponivel * 0.2) : 0;
    const qtyQuarentena = Math.random() > 0.9 ? randomBetween(1, 50) : 0;

    await prisma.inventarioAtual.create({
      data: {
        produtoId: prod.id,
        depositoId,
        quantidadeDisponivel: qtyDisponivel,
        quantidadeReservada: qtyReservada,
        quantidadeEmTransito: qtyTransito,
        quantidadeEmQuarentena: qtyQuarentena,
        custoMedioUnitario: randomBetween(1, 50),
        fonteAtualizacao: pick(['MANUAL', 'ERP_SYNC', 'CONTAGEM']),
        dataUltimaContagem: new Date('2026-02-01'),
      },
    });
    count++;
  }
  console.log(`  Created ${count} inventario entries.`);
}

// ============================================
// SEED: CENTROS DE TRABALHO, TURNOS, PARADAS
// ============================================

async function seedCentrosTrabalho() {
  console.log('  Seeding centros de trabalho, turnos, paradas...');
  const centros = [
    { codigo: 'CT-PROD-01', nome: 'Linha de Producao 1', tipo: 'PRODUCAO' as const, capacidadeHoraUnidades: 200, numOperadores: 8, eficienciaPercentual: 92, tempoSetupMinutos: 30, custoHora: 150 },
    { codigo: 'CT-PROD-02', nome: 'Linha de Producao 2', tipo: 'PRODUCAO' as const, capacidadeHoraUnidades: 150, numOperadores: 6, eficienciaPercentual: 88, tempoSetupMinutos: 45, custoHora: 120 },
    { codigo: 'CT-EMB-01', nome: 'Linha de Embalagem', tipo: 'EMBALAGEM' as const, capacidadeHoraUnidades: 300, numOperadores: 4, eficienciaPercentual: 95, tempoSetupMinutos: 15, custoHora: 80 },
    { codigo: 'CT-MONT-01', nome: 'Celula de Montagem', tipo: 'MONTAGEM' as const, capacidadeHoraUnidades: 100, numOperadores: 5, eficienciaPercentual: 90, tempoSetupMinutos: 20, custoHora: 100 },
    { codigo: 'CT-CQ-01', nome: 'Controle de Qualidade', tipo: 'CONTROLE_QUALIDADE' as const, capacidadeHoraUnidades: 50, numOperadores: 3, eficienciaPercentual: 98, tempoSetupMinutos: 5, custoHora: 90 },
  ];

  const created = [];
  for (const ct of centros) {
    const centro = await prisma.centroTrabalho.create({ data: ct });
    created.push(centro);

    // 2 shifts per center
    await prisma.turno.create({
      data: { centroTrabalhoId: centro.id, nome: '1o Turno', horaInicio: new Date('1970-01-01T06:00:00'), horaFim: new Date('1970-01-01T14:00:00'), diasSemana: [1, 2, 3, 4, 5], ativo: true, validoDesde: new Date('2026-01-01') },
    });
    await prisma.turno.create({
      data: { centroTrabalhoId: centro.id, nome: '2o Turno', horaInicio: new Date('1970-01-01T14:00:00'), horaFim: new Date('1970-01-01T22:00:00'), diasSemana: [1, 2, 3, 4, 5], ativo: true, validoDesde: new Date('2026-01-01') },
    });

    // 2-3 scheduled stops
    await prisma.paradaProgramada.create({
      data: { centroTrabalhoId: centro.id, tipo: 'MANUTENCAO', dataInicio: new Date('2026-03-15T06:00:00'), dataFim: new Date('2026-03-15T14:00:00'), motivo: 'Manutencao preventiva mensal', recorrente: true, cronExpression: '0 6 15 * *' },
    });
    await prisma.paradaProgramada.create({
      data: { centroTrabalhoId: centro.id, tipo: 'LIMPEZA', dataInicio: new Date('2026-03-01T22:00:00'), dataFim: new Date('2026-03-02T06:00:00'), motivo: 'Limpeza profunda semanal', recorrente: true, cronExpression: '0 22 * * 5' },
    });
  }

  return created;
}

// ============================================
// SEED: ROTEIROS DE PRODUCAO
// ============================================

type CreatedCentro = { id: string; codigo: string; tipo: string };

async function seedRoteirosProducao(produtos: CreatedProduto[], centros: CreatedCentro[]) {
  console.log('  Seeding roteiros de producao...');
  const ctProd1 = centros.find(c => c.codigo === 'CT-PROD-01')!;
  const ctProd2 = centros.find(c => c.codigo === 'CT-PROD-02')!;
  const ctEmb = centros.find(c => c.codigo === 'CT-EMB-01')!;
  const ctCQ = centros.find(c => c.codigo === 'CT-CQ-01')!;
  let count = 0;

  const acabados = produtos.filter(p => p.tipoProduto === 'ACABADO');
  const semiAcabados = produtos.filter(p => p.tipoProduto === 'SEMI_ACABADO');

  for (const pa of acabados) {
    const ctProd = Math.random() > 0.5 ? ctProd1 : ctProd2;
    const steps = [
      { centroTrabalhoId: ctProd.id, sequencia: 10, operacao: 'Preparacao de Insumos', tempoSetupMinutos: randomBetween(15, 30), tempoUnitarioMinutos: randomBetween(0.5, 2), tempoEsperaMinutos: randomBetween(0, 10) },
      { centroTrabalhoId: ctProd.id, sequencia: 20, operacao: 'Producao / Processamento', tempoSetupMinutos: randomBetween(20, 60), tempoUnitarioMinutos: randomBetween(1, 5), tempoEsperaMinutos: randomBetween(5, 15) },
      { centroTrabalhoId: ctEmb.id, sequencia: 30, operacao: 'Embalagem e Rotulagem', tempoSetupMinutos: randomBetween(10, 20), tempoUnitarioMinutos: randomBetween(0.3, 1.5), tempoEsperaMinutos: randomBetween(0, 5) },
      { centroTrabalhoId: ctCQ.id, sequencia: 40, operacao: 'Controle de Qualidade', tempoSetupMinutos: 5, tempoUnitarioMinutos: randomBetween(0.5, 2), tempoEsperaMinutos: 0 },
    ];
    for (const step of steps) {
      await prisma.roteiroProducao.create({ data: { produtoId: pa.id, ...step, ativo: true } });
      count++;
    }
  }

  for (const sa of semiAcabados) {
    const ctProd = Math.random() > 0.5 ? ctProd1 : ctProd2;
    const steps = [
      { centroTrabalhoId: ctProd.id, sequencia: 10, operacao: 'Mistura / Preparacao', tempoSetupMinutos: randomBetween(15, 30), tempoUnitarioMinutos: randomBetween(0.5, 3), tempoEsperaMinutos: randomBetween(0, 10) },
      { centroTrabalhoId: ctProd.id, sequencia: 20, operacao: 'Processamento', tempoSetupMinutos: randomBetween(10, 30), tempoUnitarioMinutos: randomBetween(1, 4), tempoEsperaMinutos: randomBetween(5, 20) },
      { centroTrabalhoId: ctCQ.id, sequencia: 30, operacao: 'Inspecao', tempoSetupMinutos: 5, tempoUnitarioMinutos: randomBetween(0.3, 1), tempoEsperaMinutos: 0 },
    ];
    for (const step of steps) {
      await prisma.roteiroProducao.create({ data: { produtoId: sa.id, ...step, ativo: true } });
      count++;
    }
  }

  console.log(`  Created ${count} roteiro entries.`);
}

// ============================================
// SEED: CALENDARIO FABRICA (365 days)
// ============================================

async function seedCalendarioFabrica() {
  console.log('  Seeding calendario fabrica (365 days)...');

  const holidays: Record<string, { tipo: 'FERIADO' | 'PONTO_FACULTATIVO' | 'FERIAS_COLETIVAS'; descricao: string }> = {
    '2026-01-01': { tipo: 'FERIADO', descricao: 'Confraternizacao Universal' },
    '2026-02-17': { tipo: 'FERIADO', descricao: 'Carnaval' },
    '2026-02-18': { tipo: 'PONTO_FACULTATIVO', descricao: 'Quarta de Cinzas' },
    '2026-04-03': { tipo: 'FERIADO', descricao: 'Sexta-feira Santa' },
    '2026-04-21': { tipo: 'FERIADO', descricao: 'Tiradentes' },
    '2026-05-01': { tipo: 'FERIADO', descricao: 'Dia do Trabalho' },
    '2026-06-04': { tipo: 'FERIADO', descricao: 'Corpus Christi' },
    '2026-09-07': { tipo: 'FERIADO', descricao: 'Independencia do Brasil' },
    '2026-10-12': { tipo: 'FERIADO', descricao: 'Nossa Senhora Aparecida' },
    '2026-11-02': { tipo: 'FERIADO', descricao: 'Finados' },
    '2026-11-15': { tipo: 'FERIADO', descricao: 'Proclamacao da Republica' },
    '2026-12-25': { tipo: 'FERIADO', descricao: 'Natal' },
  };

  // Collective vacation Dec 23-31
  for (let d = 23; d <= 31; d++) {
    const key = `2026-12-${String(d).padStart(2, '0')}`;
    if (!holidays[key]) {
      holidays[key] = { tipo: 'FERIAS_COLETIVAS', descricao: 'Ferias Coletivas' };
    }
  }

  const entries = [];
  const start = new Date('2026-01-01');

  for (let i = 0; i < 365; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    let tipo: 'UTIL' | 'FERIADO' | 'PONTO_FACULTATIVO' | 'FERIAS_COLETIVAS' | 'SABADO' | 'DOMINGO';
    let descricao: string | null = null;
    let horasProdutivas = 0;

    if (holidays[dateStr]) {
      tipo = holidays[dateStr].tipo;
      descricao = holidays[dateStr].descricao;
      horasProdutivas = 0;
    } else if (dayOfWeek === 0) {
      tipo = 'DOMINGO';
      horasProdutivas = 0;
    } else if (dayOfWeek === 6) {
      tipo = 'SABADO';
      horasProdutivas = 0;
    } else {
      tipo = 'UTIL';
      horasProdutivas = 8;
    }

    entries.push({ data: new Date(dateStr), tipo, descricao, horasProdutivas });
  }

  await prisma.calendarioFabrica.createMany({ data: entries });
  console.log(`  Created ${entries.length} calendario entries.`);
}

// ============================================
// SEED: CONFIG SISTEMA
// ============================================

async function seedConfigSistema() {
  console.log('  Seeding config sistema...');
  const configs = [
    { chave: 'forecast.horizonte_semanas', valor: 13, descricao: 'Forecast horizon in weeks' },
    { chave: 'forecast.granularidade', valor: 'semanal', descricao: 'Forecast granularity' },
    { chave: 'forecast.nivel_servico_classe_a', valor: 0.97, descricao: 'Service level for Class A products' },
    { chave: 'forecast.nivel_servico_classe_b', valor: 0.93, descricao: 'Service level for Class B products' },
    { chave: 'forecast.nivel_servico_classe_c', valor: 0.85, descricao: 'Service level for Class C products' },
    { chave: 'mrp.lotificacao_padrao', valor: 'EOQ', descricao: 'Default lot-sizing policy' },
    { chave: 'mrp.considerar_capacidade', valor: true, descricao: 'Enable capacity-aware MRP (MRP II)' },
    { chave: 'automacao.email.ativo', valor: true, descricao: 'Enable email automation' },
    { chave: 'automacao.email.horario_verificacao', valor: '06:00', descricao: 'Email check schedule time' },
  ];

  for (const c of configs) {
    await prisma.configSistema.create({
      data: { chave: c.chave, valor: c.valor as any, descricao: c.descricao },
    });
  }
  console.log(`  Created ${configs.length} config entries.`);
}

// ============================================
// SEED: USUARIOS
// ============================================

async function seedUsuarios() {
  console.log('  Seeding usuarios...');
  const password = await bcrypt.hash('ForecastMRP2026!', 10);

  const users = [
    { email: 'admin@forecasting-mrp.dev', nome: 'Admin User', senhaHash: password, role: 'admin' as const },
    { email: 'manager@forecasting-mrp.dev', nome: 'Manager User', senhaHash: password, role: 'manager' as const },
    { email: 'operator@forecasting-mrp.dev', nome: 'Operator User', senhaHash: password, role: 'operator' as const },
    { email: 'viewer@forecasting-mrp.dev', nome: 'Viewer User', senhaHash: password, role: 'viewer' as const },
  ];

  for (const u of users) {
    await prisma.usuario.create({ data: u });
  }
  console.log(`  Created ${users.length} users.`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('=== ForecastingMRP Seed Script ===');
  console.log('');

  await cleanDatabase();

  const unidades = await seedUnidadesMedida();
  const categorias = await seedCategorias();
  const produtos = await seedProdutos(unidades, categorias);
  const fornecedores = await seedFornecedores();
  await seedProdutoFornecedor(produtos, fornecedores);
  await seedBom(produtos);
  const depositos = await seedDepositos();
  await seedInventarioAtual(produtos, depositos);
  const centros = await seedCentrosTrabalho();
  await seedRoteirosProducao(produtos, centros);
  await seedCalendarioFabrica();
  await seedConfigSistema();
  await seedUsuarios();

  console.log('');
  console.log('=== Seed completed successfully! ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
