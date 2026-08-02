import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

export default function Home() {
  const [semanas, setSemanas] = useState([]);
  const [semanaAtivaId, setSemanaAtivaId] = useState(null);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // formulário de novo item
  const [novoItem, setNovoItem] = useState({ item: '', assunto: '', draft: '', disciplina: '', responsavel: '' });
  const [novaTagTexto, setNovaTagTexto] = useState({}); // { itemId: 'texto digitando' }

  useEffect(() => { carregarSemanas(); }, []);
  useEffect(() => { if (semanaAtivaId) carregarItens(semanaAtivaId); }, [semanaAtivaId]);

  async function carregarSemanas() {
    setCarregando(true);
    const { data, error } = await supabase.from('semanas').select('*').order('numero', { ascending: true });
    if (error) { setErro('Erro ao carregar semanas: ' + error.message); setCarregando(false); return; }
    setSemanas(data || []);
    if (data && data.length > 0 && !semanaAtivaId) {
      setSemanaAtivaId(data[data.length - 1].id);
    } else {
      setCarregando(false);
    }
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
    if (error) { alert('Erro ao criar semana: ' + error.message); return; }
    await carregarSemanas();
    setSemanaAtivaId(data.id);
  }

  async function adicionarItem() {
    if (!novoItem.item.trim() && !novoItem.assunto.trim()) {
      alert('Preencha ao menos o número do item ou o assunto.');
      return;
    }
    const { error } = await supabase.from('itens').insert({
      semana_id: semanaAtivaId,
      item: novoItem.item,
      assunto: novoItem.assunto,
      draft: novoItem.draft,
      disciplina: novoItem.disciplina,
      responsavel: novoItem.responsavel,
      aderencia_dias: {},
      tags: [],
      tags_situacoes: {},
    });
    if (error) { alert('Erro ao adicionar item: ' + error.message); return; }
    setNovoItem({ item: '', assunto: '', draft: '', disciplina: '', responsavel: '' });
    carregarItens(semanaAtivaId);
  }

  async function excluirItem(id) {
    if (!confirm('Excluir este item permanentemente?')) return;
    const { error } = await supabase.from('itens').delete().eq('id', id);
    if (error) { alert('Erro ao excluir: ' + error.message); return; }
    carregarItens(semanaAtivaId);
  }

  async function alternarDia(itemAtual, dia) {
    const diasAtual = itemAtual.aderencia_dias || {};
    const statusAtual = (diasAtual[dia] && diasAtual[dia].status) || '';
    const proximoIdx = (STATUS_CICLO.indexOf(statusAtual) + 1) % STATUS_CICLO.length;
    const novoStatus = STATUS_CICLO[proximoIdx];
    const novosDias = { ...diasAtual, [dia]: { ...(diasAtual[dia] || {}), status: novoStatus } };

    // atualiza local primeiro (resposta rápida na tela)
    setItens(prev => prev.map(it => it.id === itemAtual.id ? { ...it, aderencia_dias: novosDias } : it));

    const { error } = await supabase.from('itens').update({ aderencia_dias: novosDias, atualizado_em: new Date().toISOString() }).eq('id', itemAtual.id);
    if (error) { alert('Erro ao salvar: ' + error.message); carregarItens(semanaAtivaId); }
  }

  async function adicionarTag(itemAtual) {
    const texto = (novaTagTexto[itemAtual.id] || '').trim();
    if (!texto) return;
    const novasTags = [...(itemAtual.tags || []), texto];
    setItens(prev => prev.map(it => it.id === itemAtual.id ? { ...it, tags: novasTags } : it));
    setNovaTagTexto(prev => ({ ...prev, [itemAtual.id]: '' }));
    const { error } = await supabase.from('itens').update({ tags: novasTags }).eq('id', itemAtual.id);
    if (error) { alert('Erro ao salvar TAG: ' + error.message); carregarItens(semanaAtivaId); }
  }

  async function removerTag(itemAtual, tagRemover) {
    const novasTags = (itemAtual.tags || []).filter(t => t !== tagRemover);
    setItens(prev => prev.map(it => it.id === itemAtual.id ? { ...it, tags: novasTags } : it));
    const { error } = await supabase.from('itens').update({ tags: novasTags }).eq('id', itemAtual.id);
    if (error) { alert('Erro ao remover TAG: ' + error.message); carregarItens(semanaAtivaId); }
  }

  const semanaAtiva = semanas.find(s => s.id === semanaAtivaId);

  return (
    <div>
      <header style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: '16px 20px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>EPC13 — Aderência Semanal (Online)</h1>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 20px', background: '#fff', borderBottom: '1px solid #ddd', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 'bold', color: '#007a33' }}>Semana:</span>
        <select value={semanaAtivaId || ''} onChange={e => setSemanaAtivaId(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}>
          {semanas.map(s => <option key={s.id} value={s.id}>Semana {s.numero}</option>)}
        </select>
        <button onClick={criarSemana} style={btnEstilo('#007a33')}>+ Nova Semana</button>
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

        {!carregando && itens.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>Nenhum item nesta semana ainda.</div>
        )}

        {itens.map(it => (
          <div key={it.id} style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, boxShadow: '0 1px 8px rgba(0,0,0,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <b>ITEM {it.item || '-'} | DRAFT {it.draft || '-'}</b>
                <div style={{ fontSize: 13, color: '#555' }}>{it.assunto}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{it.disciplina} {it.responsavel ? '· ' + it.responsavel : ''}</div>
              </div>
              <button onClick={() => excluirItem(it.id)} style={{ ...btnEstilo('#fdecea'), color: '#c0392b' }}>🗑</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {DIAS.map(d => {
                const st = (it.aderencia_dias && it.aderencia_dias[d] && it.aderencia_dias[d].status) || '';
                const info = STATUS_INFO[st];
                return (
                  <button key={d} onClick={() => alternarDia(it, d)} title={d}
                    style={{ background: info.cor, color: info.texto, border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer', minWidth: 44 }}>
                    {d}<br />{info.label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {(it.tags || []).map(t => (
                  <span key={t} style={{ background: '#e8f5e9', color: '#007a33', borderRadius: 12, padding: '3px 10px', fontSize: 12 }}>
                    {t} <span onClick={() => removerTag(it, t)} style={{ cursor: 'pointer', marginLeft: 4, color: '#c0392b' }}>✕</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="Nova TAG..." value={novaTagTexto[it.id] || ''}
                  onChange={e => setNovaTagTexto(prev => ({ ...prev, [it.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') adicionarTag(it); }}
                  style={{ ...inputEstilo, flex: 1 }} />
                <button onClick={() => adicionarTag(it)} style={btnEstilo('#00838f')}>+ TAG</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function btnEstilo(cor) {
  return { background: cor, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' };
}
const inputEstilo = { padding: '7px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, fontFamily: 'Arial' };
