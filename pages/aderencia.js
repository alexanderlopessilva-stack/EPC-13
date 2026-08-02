import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import ItemModal from '../components/ItemModal';

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
  const [novoItem, setNovoItem] = useState({ item: '', assunto: '', draft: '', disciplina: '', responsavel: '' });

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

            {(it.tags || []).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {it.tags.map(t => <span key={t} style={{ background: '#e8f5e9', color: '#007a33', borderRadius: 12, padding: '3px 10px', fontSize: 11 }}>{t}</span>)}
              </div>
            )}
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
                📥 Importar JSON (sessão antiga)
                <input type="file" accept=".json" onChange={importarJSON} style={{ display: 'none' }} />
              </label>
              <button onClick={exportarExcel} style={{ ...btnEstilo('#e8f5e9', '#005a27'), textAlign: 'left' }}>📊 Exportar Excel</button>
              <div style={{ fontSize: 11, color: '#999', marginTop: 10, padding: '10px 4px 0', borderTop: '1px solid #ddd' }}>
                Relatório, Histórico, Importar Itens e Situação de TAGs chegam na próxima atualização.
              </div>
            </div>
          </div>
        </div>
      )}

      {itemAberto && (
        <ItemModal item={itemAberto} onClose={() => setItemAberto(null)} onSave={salvarItem} onDelete={excluirItem} />
      )}
    </div>
  );
}

function btnEstilo(cor, texto) {
  return { background: cor, color: texto || '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' };
}
const inputEstilo = { padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, fontFamily: 'Arial' };
const navBtnEstilo = { background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' };
