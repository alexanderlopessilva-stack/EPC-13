import { useState, useEffect } from 'react';
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

export default function ItemModal({ item, onClose, onSave, onDelete }) {
  const [aba, setAba] = useState('dados');
  const [dados, setDados] = useState(item);
  const [novaTag, setNovaTag] = useState('');
  const [historicoTags, setHistoricoTags] = useState([]);

  useEffect(() => { setDados(item); }, [item]);
  useEffect(() => {
    if (item.draft) buscarHistoricoTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.draft]);

  async function buscarHistoricoTags() {
    const { data } = await supabase.from('itens').select('tags').eq('draft', item.draft).neq('id', item.id);
    const todas = [];
    (data || []).forEach(it => (it.tags || []).forEach(t => todas.push(t)));
    setHistoricoTags(todas);
  }

  // Duas TAGs são "a mesma coisa" quando uma é a base/prefixo da outra
  // (ex: 6"-AQ-5123-1263 e 6"-AQ-5123-1263-Mb-NI)
  function tagsSaoEquivalentes(a, b) {
    const na = String(a || '').trim().toLowerCase().replace(/\s+/g, '');
    const nb = String(b || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!na || !nb) return false;
    if (na === nb) return true;
    return na.startsWith(nb) || nb.startsWith(na);
  }
  function tagEhRepetida(t) {
    return historicoTags.some(ht => tagsSaoEquivalentes(ht, t));
  }

  function campo(chave, valor) {
    setDados(prev => ({ ...prev, [chave]: valor }));
  }

  function alternarDia(dia) {
    const diasAtual = dados.aderencia_dias || {};
    const statusAtual = (diasAtual[dia] && diasAtual[dia].status) || '';
    const proximoIdx = (STATUS_CICLO.indexOf(statusAtual) + 1) % STATUS_CICLO.length;
    campo('aderencia_dias', { ...diasAtual, [dia]: { ...(diasAtual[dia] || {}), status: STATUS_CICLO[proximoIdx] } });
  }

  function preencherSemana(status) {
    const novo = {};
    DIAS.forEach(d => { novo[d] = { status }; });
    campo('aderencia_dias', novo);
  }

  function adicionarTag() {
    const t = novaTag.trim();
    if (!t) return;
    campo('tags', [...(dados.tags || []), t]);
    setNovaTag('');
  }
  function removerTag(t) {
    campo('tags', (dados.tags || []).filter(x => x !== t));
    const novasSit = { ...(dados.tags_situacoes || {}) };
    delete novasSit[t.trim().toLowerCase()];
    campo('tags_situacoes', novasSit);
  }
  function situacaoTag(t, texto) {
    campo('tags_situacoes', { ...(dados.tags_situacoes || {}), [t.trim().toLowerCase()]: texto });
  }

  function salvarEFechar() {
    onSave(dados);
  }

  const TABS = [
    { key: 'dados', label: '📋 Dados' },
    { key: 'tags', label: '🏷️ TAGs' },
    { key: 'aderencia', label: '📅 Aderência' },
    { key: 'devolutiva', label: '↩️ Devolutiva' },
  ];

  return (
    <div style={overlayEstilo}>
      <div style={modalEstilo}>
        <button onClick={onClose} style={closeXEstilo} title="Fechar">✕</button>

        <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: '14px 20px', borderRadius: '14px 14px 0 0' }}>
          <b>ITEM {dados.item || '-'}</b>
        </div>
        <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#005a27', background: '#e8f5e9', padding: '10px 20px', borderBottom: '1px solid #c8e6c9' }}>
          DRAFT {dados.draft || '-'}
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f5f7fa' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setAba(t.key)}
              style={{ flex: 1, padding: '10px 6px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
                background: aba === t.key ? '#fff' : 'transparent', color: aba === t.key ? '#007a33' : '#888',
                borderBottom: aba === t.key ? '3px solid #007a33' : '3px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {aba === 'dados' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Campo label="Assunto" full value={dados.assunto} onChange={v => campo('assunto', v)} />
              <Campo label="Unidade" value={dados.unidade} onChange={v => campo('unidade', v)} />
              <Campo label="Área" value={dados.area} onChange={v => campo('area', v)} />
              <Campo label="Draft" value={dados.draft} onChange={v => campo('draft', v)} />
              <Campo label="PT" value={dados.pt} onChange={v => campo('pt', v)} />
              <Campo label="Disciplina" value={dados.disciplina} onChange={v => campo('disciplina', v)} />
              <Campo label="Responsável" value={dados.responsavel} onChange={v => campo('responsavel', v)} />
              <Campo label="Requisitante 1" value={dados.requisitante1} onChange={v => campo('requisitante1', v)} />
              <Campo label="Matrícula 1" value={dados.matricula1} onChange={v => campo('matricula1', v)} />
              <Campo label="Requisitante 2" value={dados.requisitante2} onChange={v => campo('requisitante2', v)} />
              <Campo label="Matrícula 2" value={dados.matricula2} onChange={v => campo('matricula2', v)} />
              <Campo label="Atividade" full value={dados.atividade} onChange={v => campo('atividade', v)} />
            </div>
          )}

          {aba === 'tags' && (
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>
                🟢 verde = nova (não apareceu antes neste Draft) · 🔴 vermelho = repetida (já apareceu em outra semana)
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input value={novaTag} onChange={e => setNovaTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') adicionarTag(); }}
                  placeholder="Nova TAG..." style={inputEstilo} />
                <button onClick={adicionarTag} style={btnEstilo('#007a33')}>+ Adicionar</button>
              </div>
              {(dados.tags || []).length === 0 && <div style={{ color: '#999', fontSize: 13 }}>Nenhuma TAG cadastrada.</div>}
              {(dados.tags || []).map(t => {
                const repetida = tagEhRepetida(t);
                return (
                  <div key={t} style={{ background: repetida ? '#fdeaea' : '#e8f7ea', border: '1.5px solid ' + (repetida ? '#e53935' : '#2e9e44'), borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span>
                        <b style={{ fontSize: 13 }}>{t}</b>
                        {repetida
                          ? <span style={{ color: '#e53935', fontSize: 11, marginLeft: 8, fontWeight: 'bold' }}>🔴 repetida ✔</span>
                          : <span style={{ color: '#2e9e44', fontSize: 11, marginLeft: 8, fontWeight: 'bold' }}>🟢 nova</span>}
                      </span>
                      <span onClick={() => removerTag(t)} style={{ cursor: 'pointer', color: '#c0392b', fontSize: 13 }}>🗑</span>
                    </div>
                    <input placeholder="Situação desta TAG..." value={(dados.tags_situacoes || {})[t.trim().toLowerCase()] || ''}
                      onChange={e => situacaoTag(t, e.target.value)} style={{ ...inputEstilo, width: '100%' }} />
                  </div>
                );
              })}
            </div>
          )}

          {aba === 'aderencia' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button onClick={() => preencherSemana('ok')} style={btnEstilo('#007a33')}>✔ Semana executada</button>
                <button onClick={() => preencherSemana('nok')} style={btnEstilo('#c62828')}>✘ Semana não executada</button>
                <button onClick={() => preencherSemana('semprog')} style={btnEstilo('#757575')}>🚫 Sem programação</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DIAS.map(d => {
                  const st = (dados.aderencia_dias && dados.aderencia_dias[d] && dados.aderencia_dias[d].status) || '';
                  const info = STATUS_INFO[st];
                  return (
                    <button key={d} onClick={() => alternarDia(d)}
                      style={{ background: info.cor, color: info.texto, border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', minWidth: 56 }}>
                      {d}<br />{info.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {aba === 'devolutiva' && (
            <div>
              <label style={labelEstilo}>Texto da devolutiva</label>
              <textarea value={dados.devolutiva_texto || ''} onChange={e => campo('devolutiva_texto', e.target.value)}
                rows={4} style={{ ...inputEstilo, width: '100%', resize: 'vertical' }} />
              <label style={{ ...labelEstilo, marginTop: 12 }}>Executável?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['sim', '✔ Sim'], ['sim_alt', '✔ Sim c/ alteração'], ['nao', '✘ Não']].map(([v, l]) => (
                  <button key={v} onClick={() => campo('devolutiva_executavel', v)}
                    style={btnEstilo(dados.devolutiva_executavel === v ? '#007a33' : '#ddd', dados.devolutiva_executavel === v ? '#fff' : '#555')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => onDelete(dados.id)} style={btnEstilo('#fdecea', '#c0392b')}>🗑 Excluir item</button>
          <button onClick={salvarEFechar} style={btnEstilo('#007a33')}>💾 Salvar e fechar</button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, full }) {
  return (
    <div style={{ gridColumn: full ? 'span 2' : 'auto' }}>
      <label style={labelEstilo}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...inputEstilo, width: '100%' }} />
    </div>
  );
}

const overlayEstilo = { position: 'fixed', inset: 0, background: 'rgba(0,20,5,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modalEstilo = { background: '#fff', width: 640, maxWidth: '96vw', maxHeight: '90vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,.35)' };
const closeXEstilo = { position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontWeight: 'bold', cursor: 'pointer', zIndex: 5 };
const labelEstilo = { display: 'block', fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4, textTransform: 'uppercase' };
const inputEstilo = { padding: '8px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, fontFamily: 'Arial' };
function btnEstilo(cor, texto) {
  return { background: cor, color: texto || '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' };
}
