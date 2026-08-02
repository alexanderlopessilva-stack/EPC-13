import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import ItemModal from '../components/ItemModal';
import PTDrawer from '../components/PTDrawer';
import RelatorioHistorico from '../components/RelatorioHistorico';
import AtualizacaoDiffModal from '../components/AtualizacaoDiffModal';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const STATUS_CICLO = ['', 'ok', 'pend', 'nok', 'fin', 'semprog'];
const STATUS_INFO = {
  '':       { label: '—',  cor: '#ddd',    texto: '#666' },
  ok:       { label: '✔',  cor: '#007a33', texto: '#fff' },
  pend:     { label: '⚠',  cor: '#f9a825', texto: '#fff' },
  nok:      { label: '✘',  cor: '#c62828', texto: '#fff' },
  fin:      { label: '★',  cor: '#0288d1', texto: '#fff' },
  semprog:  { label: '—',  cor: '#757575', texto: '#fff' },
};

export default function Aderencia() {
  const [semanas, setSemanas] = useState([]);
  const [semanaAtivaId, setSemanaAtivaId] = useState(null);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [ordenarPor, setOrdenarPor] = useState('');
  const [pendentesDiaAtivo, setPendentesDiaAtivo] = useState(false);
  const [pendentesDia, setPendentesDia] = useState('');
  const [itemAberto, setItemAberto] = useState(null);
  const [avisoBusca, setAvisoBusca] = useState(null); // null | 'nenhuma' | ['31','35',...]
  const [diffAtualizacao, setDiffAtualizacao] = useState(null);
  const [novoItem, setNovoItem] = useState({ item: '', assunto: '', draft: '', disciplina: '', responsavel: '' });
  const [ptAberto, setPtAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);

  useEffect(() => { carregarSemanas(); }, []);
  useEffect(() => { if (semanaAtivaId) carregarItens(semanaAtivaId); }, [semanaAtivaId]);

  async function carregarSemanas() {
    const { data, error } = await supabase.from('semanas').select('*').order('numero', { ascending: true });
    if (error) { setErro('Erro ao carregar semanas: ' + error.message); setCarregando(false); return; }
    setSemanas(data || []);
    if (data && data.length > 0) setSemanaAtivaId(prev => prev || data[data.length - 1].id);
    else setCarregando(false);
  }

  async function carregarItens(semanaId) {
    setCarregando(true);
    const { data, error } = await supabase.from('itens').select('*').eq('semana_id', semanaId).order('criado_em', { ascending: true });
    if (error) { setErro('Erro ao carregar itens: ' + error.message); setCarregando(false); return; }
    setItens(data || []);
    setCarregando(false);
  }

  async function criarSemana() {
    const numero = prompt('Número da nova semana (ex: 15):');
    if (!numero || !numero.trim()) return;
    const { data, error } = await supabase.from('semanas').insert({ numero: numero.trim() }).select().single();
    if (error) { alert('Erro: ' + error.message); return; }
    await carregarSemanas();
    setSemanaAtivaId(data.id);
    setMenuAberto(false);
  }

  async function adicionarItem() {
    if (!novoItem.item.trim() && !novoItem.assunto.trim()) { alert('Preencha ao menos o item ou o assunto.'); return; }
    const { error } = await supabase.from('itens').insert({
      semana_id: semanaAtivaId, ...novoItem,
      aderencia_dias: {}, tags: [], tags_situacoes: {}, emissao_pt: {},
    });
    if (error) { alert('Erro: ' + error.message); return; }
    setNovoItem({ item: '', assunto: '', draft: '', disciplina: '', responsavel: '' });
    carregarItens(semanaAtivaId);
  }

  async function alternarDiaRapido(itemAtual, dia) {
    const diasAtual = itemAtual.aderencia_dias || {};
    const statusAtual = (diasAtual[dia] && diasAtual[dia].status) || '';
    const proximoIdx = (STATUS_CICLO.indexOf(statusAtual) + 1) % STATUS_CICLO.length;
    const novosDias = { ...diasAtual, [dia]: { status: STATUS_CICLO[proximoIdx] } };
    setItens(prev => prev.map(it => it.id === itemAtual.id ? { ...it, aderencia_dias: novosDias } : it));
    const { error } = await supabase.from('itens').update({ aderencia_dias: novosDias, atualizado_em: new Date().toISOString() }).eq('id', itemAtual.id);
    if (error) { alert('Erro ao salvar: ' + error.message); carregarItens(semanaAtivaId); }
  }

  async function salvarItem(dadosAtualizados) {
    const { id, ...resto } = dadosAtualizados;
    const { error } = await supabase.from('itens').update({ ...resto, atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setItemAberto(null);
    carregarItens(semanaAtivaId);
  }

  async function excluirItem(id) {
    if (!confirm('Excluir este item permanentemente?')) return;
    const { error } = await supabase.from('itens').delete().eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    setItemAberto(null);
    carregarItens(semanaAtivaId);
  }

  async function importarJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const texto = await file.text();
    let data;
    try { data = JSON.parse(texto); } catch (err) { alert('Arquivo JSON inválido: ' + err.message); e.target.value = ''; return; }
    if (!data.historico) { alert('Esse arquivo não parece ser uma sessão de Aderência válida (não encontrei "historico").'); e.target.value = ''; return; }

    let totalSemanasCriadas = 0, totalSemanasAtualizadas = 0, totalItensCriados = 0;
    const semanasPuladas = [];

    for (const [numero, semanaObj] of Object.entries(data.historico)) {
      const semanaExistente = semanas.find(s => s.numero === numero);
      let semanaId;

      if (semanaExistente) {
        const substituir = confirm(
          'A semana ' + numero + ' já existe no site.\n\n' +
          'Deseja SUBSTITUIR os itens dela pelos dados desse arquivo?\n' +
          '(os itens atuais dessa semana serão apagados e recriados com o que está no arquivo — TAGs, status, tudo)'
        );
        if (!substituir) { semanasPuladas.push(numero); continue; }
        semanaId = semanaExistente.id;
        const { error: errDel } = await supabase.from('itens').delete().eq('semana_id', semanaId);
        if (errDel) { alert('Erro ao limpar itens antigos da semana ' + numero + ': ' + errDel.message); continue; }
        await supabase.from('semanas').update({
          periodo_inicio: semanaObj.periodoInicio || null,
          periodo_fim: semanaObj.periodoFim || null,
        }).eq('id', semanaId);
        totalSemanasAtualizadas++;
      } else {
        const { data: novaSemana, error: errSemana } = await supabase.from('semanas').insert({
          numero,
          periodo_inicio: semanaObj.periodoInicio || null,
          periodo_fim: semanaObj.periodoFim || null,
        }).select().single();
        if (errSemana) { alert('Erro ao criar semana ' + numero + ': ' + errSemana.message); continue; }
        semanaId = novaSemana.id;
        totalSemanasCriadas++;
      }

      const linhas = (semanaObj.records || []).map(rec => {
        const raw = rec.raw || [];
        let devExec = null;
        if (rec.devolutiva && rec.devolutiva.executavel !== undefined && rec.devolutiva.executavel !== null) {
          devExec = rec.devolutiva.executavel === true ? 'sim' : rec.devolutiva.executavel === false ? 'nao' : rec.devolutiva.executavel;
        }
        return {
          semana_id: semanaId,
          item: raw[0] || '', assunto: raw[1] || '', unidade: raw[2] || '', area: raw[3] || '',
          draft: raw[5] || '', pt: raw[6] || '', atividade: raw[7] || '',
          disciplina: raw[12] || '', responsavel: raw[13] || '',
          requisitante1: raw[14] || '', matricula1: raw[15] || '',
          tags: rec.tags || [],
          tags_situacoes: rec.tagsSituacoes || {},
          aderencia_dias: (rec.aderencia && rec.aderencia.dias) || {},
          progresso: (rec.aderencia && rec.aderencia.progresso) || '',
          motivo_niniciado: (rec.aderencia && rec.aderencia.motivoNIniciado) || '',
          devolutiva_texto: (rec.devolutiva && rec.devolutiva.texto) || '',
          devolutiva_executavel: devExec,
          fora_programacao: rec.foraProg || false,
          semana_origem: rec.semanaOrigem || null,
          emissao_pt: {},
        };
      });

      // insere em lotes de 50, pra não estourar o tamanho da requisição
      for (let i = 0; i < linhas.length; i += 50) {
        const lote = linhas.slice(i, i + 50);
        const { error: errItens } = await supabase.from('itens').insert(lote);
        if (errItens) alert('Erro ao importar itens da semana ' + numero + ': ' + errItens.message);
        else totalItensCriados += lote.length;
      }
    }

    await carregarSemanas();
    setMenuAberto(false);
    alert('✅ Importação concluída!\n\n' + totalSemanasCriadas + ' semana(s) nova(s) criada(s)\n'
      + totalSemanasAtualizadas + ' semana(s) existente(s) substituída(s)\n'
      + totalItensCriados + ' item(ns) importado(s) no total'
      + (semanasPuladas.length ? '\n\n⚠️ Semana(s) que você optou por não substituir: ' + semanasPuladas.join(', ') : ''));
    e.target.value = '';
  }

  async function adicionarSemanaAnterior(e) {
    const file = e.target.files[0];
    if (!file) return;
    const num = window.prompt('🗂️ Número da semana ANTERIOR que deseja adicionar ao histórico:\n\nIsso só registra os dados dessa semana para consulta e comparação de TAGs/Drafts — não muda qual é a semana atual do sistema.', '');
    if (!num || !num.trim()) { e.target.value = ''; return; }
    const numero = num.trim();
    const existente = semanas.find(s => s.numero === numero);
    if (existente && !confirm('A semana ' + numero + ' já existe no histórico.\nDeseja sobrescrever os dados dela?')) { e.target.value = ''; return; }

    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    let headerIdx = 0;
    for (let i = 0; i < Math.min(linhas.length, 10); i++) {
      const c0 = String((linhas[i] || [])[0] || '').trim().toLowerCase();
      if (c0 === 'item') { headerIdx = i; break; }
    }
    const dadosLinhas = linhas.slice(headerIdx + 1).filter(l => l && l.some(c => String(c || '').trim() !== ''));

    let semanaId;
    if (existente) {
      semanaId = existente.id;
      await supabase.from('itens').delete().eq('semana_id', semanaId);
    } else {
      const { data: nova, error } = await supabase.from('semanas').insert({ numero }).select().single();
      if (error) { alert('Erro: ' + error.message); e.target.value = ''; return; }
      semanaId = nova.id;
    }

    const registros = dadosLinhas.map(raw => {
      const tags = String(raw[4] || '').split(/\n|;/).map(t => t.trim()).filter(Boolean);
      return {
        semana_id: semanaId,
        item: raw[0] || '', assunto: raw[1] || '', unidade: raw[2] || '', area: raw[3] || '',
        draft: raw[5] || '', pt: raw[6] || '', atividade: raw[7] || '',
        disciplina: raw[12] || '', responsavel: raw[13] || '',
        requisitante1: raw[14] || '', matricula1: raw[15] || '',
        tags, tags_situacoes: {}, aderencia_dias: {}, emissao_pt: {},
      };
    });
    for (let i = 0; i < registros.length; i += 50) await supabase.from('itens').insert(registros.slice(i, i + 50));

    await carregarSemanas();
    setSemanaAtivaId(semanaId);
    setMenuAberto(false);
    alert('✅ Semana ' + numero + ' adicionada ao histórico com ' + registros.length + ' item(ns)!\n\nEssa semana é só de referência, pra consulta e comparação de TAGs/Drafts.');
    e.target.value = '';
  }

  async function processarAtualizarSemanaAtual(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!semanaAtiva) { alert('Nenhuma semana ativa.'); e.target.value = ''; return; }

    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    let headerIdx = 0;
    for (let i = 0; i < Math.min(linhas.length, 10); i++) {
      const c0 = String((linhas[i] || [])[0] || '').trim().toLowerCase();
      if (c0 === 'item') { headerIdx = i; break; }
    }
    const dadosLinhas = linhas.slice(headerIdx + 1).filter(l => l && l.some(c => String(c || '').trim() !== ''));

    const porItem = {};
    itens.forEach(it => { if (it.item && !(it.item in porItem)) porItem[it.item] = it; });

    const CAMPOS = [
      { chave: 'assunto', idx: 1, label: 'Assunto' }, { chave: 'unidade', idx: 2, label: 'Unidade' },
      { chave: 'area', idx: 3, label: 'Área' }, { chave: 'draft', idx: 5, label: 'Draft' }, { chave: 'pt', idx: 6, label: 'PT' },
      { chave: 'disciplina', idx: 12, label: 'Disciplina' }, { chave: 'responsavel', idx: 13, label: 'Responsável' },
      { chave: 'requisitante1', idx: 14, label: 'Requisitante' }, { chave: 'matricula1', idx: 15, label: 'Matrícula' },
    ];

    const atualizacoes = [], novos = [];
    dadosLinhas.forEach(raw => {
      const itemNovo = String(raw[0] || '').trim();
      if (!itemNovo) return;
      const tagsNovas = String(raw[4] || '').split(/\n|;/).map(t => t.trim()).filter(Boolean);
      if (porItem[itemNovo]) {
        const it = porItem[itemNovo];
        const mudancas = [];
        CAMPOS.forEach(c => {
          const atual = String(it[c.chave] || '').trim();
          const novo = String(raw[c.idx] || '').trim();
          if (novo && novo !== atual) mudancas.push({ chave: c.chave, label: c.label, de: atual, para: novo });
        });
        const tagsAtuais = (it.tags || []).map(t => t.trim());
        const tagsMudaram = JSON.stringify([...tagsAtuais].sort()) !== JSON.stringify([...tagsNovas].sort());
        if (mudancas.length || tagsMudaram) atualizacoes.push({ id: it.id, item: itemNovo, assuntoAtual: it.assunto, mudancas, tagsAtuais, tagsNovas, tagsMudaram });
      } else {
        novos.push({ item: itemNovo, assunto: raw[1] || '', raw, tags: tagsNovas });
      }
    });

    if (!atualizacoes.length && !novos.length) {
      alert('✅ Nenhuma diferença encontrada — a semana ' + semanaAtiva.numero + ' já parece estar atualizada.');
      e.target.value = ''; return;
    }
    setDiffAtualizacao({ atualizacoes, novos });
    e.target.value = '';
  }

  async function aplicarDiffAtualizacao(atualizacoesEscolhidas, novosEscolhidos) {
    for (const u of atualizacoesEscolhidas) {
      const patch = {};
      u.mudancas.forEach(m => { patch[m.chave] = m.para; });
      if (u.tagsMudaram) patch.tags = u.tagsNovas;
      await supabase.from('itens').update(patch).eq('id', u.id);
    }
    for (const n of novosEscolhidos) {
      await supabase.from('itens').insert({
        semana_id: semanaAtivaId, item: n.item, assunto: n.assunto, unidade: n.raw[2] || '', area: n.raw[3] || '',
        draft: n.raw[5] || '', pt: n.raw[6] || '', atividade: n.raw[7] || '',
        disciplina: n.raw[12] || '', responsavel: n.raw[13] || '',
        requisitante1: n.raw[14] || '', matricula1: n.raw[15] || '',
        tags: n.tags, tags_situacoes: {}, aderencia_dias: {}, emissao_pt: {},
      });
    }
    setDiffAtualizacao(null);
    setMenuAberto(false);
    carregarItens(semanaAtivaId);
    alert('✅ Semana atualizada! ' + atualizacoesEscolhidas.length + ' item(ns) alterado(s), ' + novosEscolhidos.length + ' novo(s) adicionado(s).');
  }

  async function processarAtualizarSituacoesTags(e) {
    const file = e.target.files[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

    function tagsEquivalentes(a, b) {
      const na = String(a || '').trim().toLowerCase().replace(/\s+/g, '');
      const nb = String(b || '').trim().toLowerCase().replace(/\s+/g, '');
      if (!na || !nb) return false;
      if (na === nb) return true;
      return na.startsWith(nb) || nb.startsWith(na);
    }

    const grupos = [];
    for (let i = 1; i < rows.length; i++) {
      const tag = String((rows[i] || [])[0] || '').trim();
      const status = String((rows[i] || [])[5] || '').trim();
      if (!tag || !status) continue;
      let grupo = grupos.find(g => g.labels.some(l => tagsEquivalentes(l, tag)));
      if (!grupo) { grupo = { labels: [], statusList: [] }; grupos.push(grupo); }
      if (!grupo.labels.includes(tag)) grupo.labels.push(tag);
      if (!grupo.statusList.includes(status)) grupo.statusList.push(status);
    }
    if (!grupos.length) { alert('Nenhuma TAG com status encontrada.\nConfira se a TAG está na coluna A e o status na coluna F.'); e.target.value = ''; return; }

    const CONFLITO_TXT = 'Status em conflito, conferir planilha';
    const resolvidos = grupos.map(g => ({ labels: g.labels, status: g.statusList.length > 1 ? CONFLITO_TXT : g.statusList[0] }));

    const idxAtiva = semanas.findIndex(s => s.id === semanaAtivaId);
    const semanaAnterior = idxAtiva > 0 ? semanas[idxAtiva - 1] : null;
    const semanasAlvo = [semanaAtiva].concat(semanaAnterior ? [semanaAnterior] : []);

    let totalAtualizadas = 0, totalConflitos = 0;
    for (const s of semanasAlvo) {
      const { data } = await supabase.from('itens').select('id, tags, tags_situacoes').eq('semana_id', s.id);
      for (const it of (data || [])) {
        const situacoesAtuais = { ...(it.tags_situacoes || {}) };
        let mudou = false;
        (it.tags || []).forEach(t => {
          const grupo = resolvidos.find(g => g.labels.some(l => tagsEquivalentes(l, t)));
          if (grupo) {
            situacoesAtuais[t.trim().toLowerCase()] = grupo.status;
            mudou = true; totalAtualizadas++;
            if (grupo.status === CONFLITO_TXT) totalConflitos++;
          }
        });
        if (mudou) await supabase.from('itens').update({ tags_situacoes: situacoesAtuais }).eq('id', it.id);
      }
    }
    carregarItens(semanaAtivaId);
    setMenuAberto(false);
    alert('✅ Situações de TAGs atualizadas!\n\n' + totalAtualizadas + ' TAG(s) marcadas\nSemanas afetadas: ' + semanasAlvo.map(s => s.numero).join(', ') + '.'
      + (totalConflitos ? '\n\n⚠️ ' + totalConflitos + ' TAG(s) com status em conflito.' : ''));
    e.target.value = '';
  }

  async function importarExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

    // acha a linha de cabeçalho (a que tem "item" na primeira coluna que não esteja vazia)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(linhas.length, 10); i++) {
      const c0 = String((linhas[i] || [])[0] || '').trim().toLowerCase();
      if (c0 === 'item') { headerIdx = i; break; }
    }
    const dadosLinhas = linhas.slice(headerIdx + 1).filter(l => l && l.some(c => String(c || '').trim() !== ''));

    if (dadosLinhas.length === 0) { alert('Não encontrei nenhuma linha de dados nessa planilha.'); e.target.value = ''; return; }

    const semanaAlvo = semanaAtiva;
    if (!semanaAlvo) { alert('Selecione ou crie uma semana antes de importar.'); e.target.value = ''; return; }
    if (!confirm('Importar ' + dadosLinhas.length + ' linha(s) para a Semana ' + semanaAlvo.numero + '?')) { e.target.value = ''; return; }

    const registros = dadosLinhas.map(raw => {
      const tagsTexto = String(raw[4] || '');
      const tags = tagsTexto.split(/\n|;/).map(t => t.trim()).filter(Boolean);
      return {
        semana_id: semanaAlvo.id,
        item: raw[0] || '', assunto: raw[1] || '', unidade: raw[2] || '', area: raw[3] || '',
        draft: raw[5] || '', pt: raw[6] || '', atividade: raw[7] || '',
        disciplina: raw[12] || '', responsavel: raw[13] || '',
        requisitante1: raw[14] || '', matricula1: raw[15] || '',
        tags, tags_situacoes: {}, aderencia_dias: {}, emissao_pt: {},
      };
    });

    let totalImportado = 0;
    for (let i = 0; i < registros.length; i += 50) {
      const lote = registros.slice(i, i + 50);
      const { error } = await supabase.from('itens').insert(lote);
      if (error) alert('Erro ao importar linhas: ' + error.message);
      else totalImportado += lote.length;
    }

    carregarItens(semanaAtivaId);
    setMenuAberto(false);
    alert('✅ ' + totalImportado + ' item(ns) importado(s) da planilha para a Semana ' + semanaAlvo.numero + '.');
    e.target.value = '';
  }

  async function exportarExcel() {
    const XLSX = await import('xlsx');
    const linhas = itensFiltrados.map(it => ({
      Item: it.item, Assunto: it.assunto, Unidade: it.unidade, Área: it.area, Draft: it.draft, PT: it.pt,
      Atividade: it.atividade, Disciplina: it.disciplina, Responsável: it.responsavel,
      Requisitante1: it.requisitante1, Matrícula1: it.matricula1, Requisitante2: it.requisitante2, Matrícula2: it.matricula2,
      TAGs: (it.tags || []).join(', '),
      ...Object.fromEntries(DIAS.map(d => [d, (it.aderencia_dias && it.aderencia_dias[d] && it.aderencia_dias[d].status) || ''])),
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aderência');
    XLSX.writeFile(wb, 'aderencia_semana' + (semanaAtiva ? semanaAtiva.numero : '') + '.xlsx');
    setMenuAberto(false);
  }

  const semanaAtiva = semanas.find(s => s.id === semanaAtivaId);
  const idxAtiva = semanas.findIndex(s => s.id === semanaAtivaId);

  const itensFiltrados = useMemo(() => {
    let lista = [...itens];
    const termos = busca.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (termos.length) {
      lista = lista.filter(it => {
        const draftNorm = (it.draft || '').toLowerCase();
        const tagsNorm = (it.tags || []).map(t => t.toLowerCase());
        return termos.some(t => draftNorm.includes(t) || tagsNorm.some(tg => tg.includes(t)));
      });
    }
    if (pendentesDiaAtivo && pendentesDia) {
      lista = lista.filter(it => !(it.aderencia_dias && it.aderencia_dias[pendentesDia] && it.aderencia_dias[pendentesDia].status));
    }
    if (ordenarPor) {
      lista.sort((a, b) => String(a[ordenarPor] || '').localeCompare(String(b[ordenarPor] || '')));
    }
    return lista;
  }, [itens, busca, ordenarPor, pendentesDiaAtivo, pendentesDia]);

  useEffect(() => {
    verificarBuscaOutrasSemanas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, itensFiltrados.length, semanaAtivaId]);

  async function verificarBuscaOutrasSemanas() {
    const termos = busca.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (!termos.length || itensFiltrados.length > 0) { setAvisoBusca(null); return; }

    const semanasComMatch = [];
    for (const s of semanas) {
      if (s.id === semanaAtivaId) continue;
      const { data } = await supabase.from('itens').select('draft, tags').eq('semana_id', s.id);
      const tem = (data || []).some(it => {
        const draftNorm = (it.draft || '').toLowerCase();
        const tagsNorm = (it.tags || []).map(t => t.toLowerCase());
        return termos.some(t => draftNorm.includes(t) || tagsNorm.some(tg => tg.includes(t)));
      });
      if (tem) semanasComMatch.push(s.numero);
    }
    setAvisoBusca(semanasComMatch.length ? semanasComMatch : 'nenhuma');
  }

  return (
    <div>
      <header style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, position: 'relative' }}>
        <Link href="/" style={{ position: 'absolute', left: 20, color: '#fff', textDecoration: 'none', fontSize: 13 }}>← EPC13</Link>
        <h1 style={{ margin: 0, fontSize: 20 }}>Programação de atividades semanal EPC13</h1>
        <button onClick={() => setMenuAberto(true)} style={{ position: 'absolute', right: 20, ...btnEstilo('rgba(255,255,255,.15)') , border: '1.5px solid rgba(255,255,255,.4)'}}>☰ Menu</button>
      </header>

      {/* Navegador de semana */}
      <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button disabled={idxAtiva <= 0} onClick={() => setSemanaAtivaId(semanas[idxAtiva - 1].id)} style={navBtnEstilo}>◀</button>
        <select value={semanaAtivaId || ''} onChange={e => setSemanaAtivaId(e.target.value)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontWeight: 'bold', color: '#005a27' }}>
          {semanas.map(s => <option key={s.id} value={s.id}>📅 SEMANA {s.numero}</option>)}
        </select>
        <button disabled={idxAtiva >= semanas.length - 1} onClick={() => setSemanaAtivaId(semanas[idxAtiva + 1].id)} style={navBtnEstilo}>▶</button>
      </div>

      {/* Busca */}
      <div style={{ background: '#00461f', padding: '10px 20px', display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#fff' }}>🔍</span>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por Draft ou TAG (separe por vírgula)..."
          style={{ padding: '8px 14px', borderRadius: 20, border: 'none', width: 340, maxWidth: '70vw' }} />
        <button onClick={() => setPendentesDiaAtivo(a => !a)} style={{ ...btnEstilo(pendentesDiaAtivo ? '#ffd54f' : 'rgba(255,255,255,.15)', pendentesDiaAtivo ? '#1b3d1b' : '#fff'), border: '1px solid rgba(255,255,255,.4)' }}>
          📋 Pendentes do dia
        </button>
      </div>

      {avisoBusca && (
        <div style={{ background: '#fff3e0', padding: '8px 20px', display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #ffcc80' }}>
          {avisoBusca === 'nenhuma' ? (
            <span style={{ fontSize: 12, color: '#8a4b00', fontWeight: 'bold' }}>❌ Nenhum resultado encontrado em nenhuma semana para "{busca}".</span>
          ) : (
            <>
              <span style={{ fontSize: 12, color: '#8a4b00', fontWeight: 'bold' }}>⚠️ Nada encontrado na semana atual. Encontrado em:</span>
              {avisoBusca.map(num => {
                const s = semanas.find(x => x.numero === num);
                return (
                  <button key={num} onClick={() => s && setSemanaAtivaId(s.id)}
                    style={{ background: '#8a4b00', color: '#fff', border: 'none', borderRadius: 14, padding: '4px 12px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>
                    Semana {num}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {pendentesDiaAtivo && (
        <div style={{ background: '#fff3e0', padding: '8px 20px', display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#8a4b00', fontWeight: 'bold' }}>Ver não preenchidos em:</span>
          <select value={pendentesDia} onChange={e => setPendentesDia(e.target.value)} style={{ padding: '4px 10px', borderRadius: 8 }}>
            <option value="">— nenhum dia —</option>
            {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Ordenar */}
      <div style={{ background: '#005a27', padding: '8px 20px', display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
        <span style={{ color: '#fff', fontSize: 12 }}>🔽 Ordenar por:</span>
        <select value={ordenarPor} onChange={e => setOrdenarPor(e.target.value)} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>
          <option value="">— ordem original —</option>
          <option value="draft">Draft</option>
          <option value="area">Área</option>
          <option value="unidade">Unidade</option>
          <option value="disciplina">Disciplina</option>
          <option value="responsavel">Responsável</option>
        </select>
      </div>

      {erro && <div style={{ background: '#fdecea', color: '#c0392b', padding: 12, textAlign: 'center' }}>{erro}</div>}

      <div style={{ maxWidth: 900, margin: '20px auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 1px 8px rgba(0,0,0,.08)' }}>
          <div style={{ fontWeight: 'bold', color: '#007a33', marginBottom: 10 }}>➕ Adicionar item</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Item" value={novoItem.item} onChange={e => setNovoItem({ ...novoItem, item: e.target.value })} style={{ ...inputEstilo, width: 70 }} />
            <input placeholder="Assunto" value={novoItem.assunto} onChange={e => setNovoItem({ ...novoItem, assunto: e.target.value })} style={{ ...inputEstilo, flex: 1, minWidth: 160 }} />
            <input placeholder="Draft" value={novoItem.draft} onChange={e => setNovoItem({ ...novoItem, draft: e.target.value })} style={{ ...inputEstilo, width: 120 }} />
            <input placeholder="Disciplina" value={novoItem.disciplina} onChange={e => setNovoItem({ ...novoItem, disciplina: e.target.value })} style={{ ...inputEstilo, width: 120 }} />
            <input placeholder="Responsável" value={novoItem.responsavel} onChange={e => setNovoItem({ ...novoItem, responsavel: e.target.value })} style={{ ...inputEstilo, width: 140 }} />
            <button onClick={adicionarItem} style={btnEstilo('#007a33')}>Adicionar</button>
          </div>
        </div>

        {carregando && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>Carregando...</div>}
        {!carregando && itensFiltrados.length === 0 && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>Nenhum item encontrado.</div>}

        {itensFiltrados.map(it => (
          <div key={it.id} style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,.08)', cursor: 'pointer' }}
            onClick={() => setItemAberto(it)}>
            <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#005a27', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '4px 8px', marginBottom: 8 }}>
              DRAFT {it.draft || '-'}
            </div>
            <b>ITEM {it.item || '-'}</b>
            <div style={{ fontSize: 13, color: '#555' }}>{it.assunto}</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{it.disciplina} {it.responsavel ? '· ' + it.responsavel : ''}</div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
              {DIAS.map(d => {
                const st = (it.aderencia_dias && it.aderencia_dias[d] && it.aderencia_dias[d].status) || '';
                const info = STATUS_INFO[st];
                return (
                  <button key={d} onClick={() => alternarDiaRapido(it, d)} title={d}
                    style={{ background: info.cor, color: info.texto, border: 'none', borderRadius: 6, padding: '5px 9px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', minWidth: 38 }}>
                    {d}<br />{info.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Gaveta de menu */}
      {menuAberto && (
        <div onClick={e => { if (e.target === e.currentTarget) setMenuAberto(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 700 }}>
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: 300, background: '#f4f9f4', boxShadow: '6px 0 24px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: 16, display: 'flex', justifyContent: 'space-between' }}>
              <b>☰ Menu</b>
              <button onClick={() => setMenuAberto(false)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={criarSemana} style={{ ...btnEstilo('#e8f5e9', '#005a27'), textAlign: 'left' }}>🗓️ Nova Semana</button>
              <label style={{ ...btnEstilo('#fff3e0', '#8a4b00'), textAlign: 'left', cursor: 'pointer', display: 'block', border: '1.5px dashed #ffb74d' }}>
                🗂️ Adicionar Semana Anterior
                <input type="file" accept=".xlsx,.xls,.csv" onChange={adicionarSemanaAnterior} style={{ display: 'none' }} />
              </label>
              <label style={{ ...btnEstilo('#fff3e0', '#8a4b00'), textAlign: 'left', cursor: 'pointer', display: 'block', border: '1.5px dashed #ffb74d' }}>
                🔄 Atualizar Semana Atual
                <input type="file" accept=".xlsx,.xls,.csv" onChange={processarAtualizarSemanaAtual} style={{ display: 'none' }} />
              </label>
              <label style={{ ...btnEstilo('#fff3e0', '#8a4b00'), textAlign: 'left', cursor: 'pointer', display: 'block', border: '1.5px dashed #ffb74d' }}>
                🏷️ Atualizar Situações das TAGs
                <input type="file" accept=".xlsx,.xls,.csv" onChange={processarAtualizarSituacoesTags} style={{ display: 'none' }} />
              </label>
              <label style={{ ...btnEstilo('#fff3e0', '#8a4b00'), textAlign: 'left', cursor: 'pointer', display: 'block', border: '1.5px dashed #ffb74d' }}>
                📥 Importar JSON (sessão antiga)
                <input type="file" accept=".json" onChange={importarJSON} style={{ display: 'none' }} />
              </label>
              <label style={{ ...btnEstilo('#fff3e0', '#8a4b00'), textAlign: 'left', cursor: 'pointer', display: 'block', border: '1.5px dashed #ffb74d' }}>
                📥 Importar Excel (planilha, semana nova)
                <input type="file" accept=".xlsx,.xls,.csv" onChange={importarExcel} style={{ display: 'none' }} />
              </label>
              <button onClick={exportarExcel} style={{ ...btnEstilo('#e8f5e9', '#005a27'), textAlign: 'left' }}>📊 Exportar Excel</button>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#007a33', textTransform: 'uppercase', marginTop: 10, paddingTop: 8, borderTop: '1px solid #ddd' }}>Relatórios</div>
              <button onClick={() => { setRelatorioAberto(true); setMenuAberto(false); }} style={{ ...btnEstilo('#e8f5e9', '#005a27'), textAlign: 'left' }}>📈 Relatório & Histórico</button>
            </div>
          </div>
        </div>
      )}

      {itemAberto && (
        <ItemModal item={itemAberto} onClose={() => setItemAberto(null)} onSave={salvarItem} onDelete={excluirItem} />
      )}

      <button onClick={() => setPtAberto(true)} style={{
        position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'right bottom',
        background: '#1b5e20', color: '#fff', fontWeight: 'bold', fontSize: 13, padding: '10px 18px', borderRadius: '8px 8px 0 0',
        cursor: 'pointer', zIndex: 750, boxShadow: '-2px 0 10px rgba(0,0,0,.25)', letterSpacing: .3, border: 'none', userSelect: 'none',
      }}>
        📄 Emissão de PT
      </button>

      <PTDrawer aberto={ptAberto} onClose={() => setPtAberto(false)} itens={itensFiltrados} onAtualizado={() => carregarItens(semanaAtivaId)} />

      <RelatorioHistorico aberto={relatorioAberto} onClose={() => setRelatorioAberto(false)}
        semanas={semanas} itensSemanaAtual={itens} semanaAtivaNumero={semanaAtiva ? semanaAtiva.numero : ''} />

      <AtualizacaoDiffModal diff={diffAtualizacao} onCancelar={() => setDiffAtualizacao(null)} onAplicar={aplicarDiffAtualizacao} />
    </div>
  );
}

function btnEstilo(cor, texto) {
  return { background: cor, color: texto || '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' };
}
const inputEstilo = { padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, fontFamily: 'Arial' };
const navBtnEstilo = { background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' };
