import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const STATUS_INFO = {
  '':       { label: '—',  cor: '#ddd',    texto: '#666', nome: '' },
  ok:       { label: '✔',  cor: '#007a33', texto: '#fff', nome: 'Executado' },
  pend:     { label: '⚠',  cor: '#e65100', texto: '#fff', nome: 'C/ pendência' },
  nok:      { label: '✘',  cor: '#c62828', texto: '#fff', nome: 'Não executado' },
  fin:      { label: '★',  cor: '#1565c0', texto: '#fff', nome: 'Sol. finalizado' },
  semprog:  { label: '○',  cor: '#bbb',    texto: '#fff', nome: 'Sem programação' },
};

export default function ItemModal({ item, onClose, onSave, onDelete, todosItens }) {
  const [aba, setAba] = useState('dados');
  const [dados, setDados] = useState(item);
  const [novaTag, setNovaTag] = useState('');
  const [historicoTags, setHistoricoTags] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [picker, setPicker] = useState(null);   // null | 'partial' | 'fin' | 'copy'
  const [partialState, setPartialState] = useState({});
  const [finDia, setFinDia] = useState(null);
  const [copySrcId, setCopySrcId] = useState('');

  useEffect(() => { setDados(item); }, [item]);
  useEffect(() => {
    if (item.draft) buscarHistoricoTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.draft]);

  // busca as TAGs do mesmo Draft em OUTRAS semanas, guardando de qual semana veio cada uma
  async function buscarHistoricoTags() {
    const { data } = await supabase
      .from('itens')
      .select('tags, semana_id, semanas(numero)')
      .eq('draft', item.draft)
      .neq('id', item.id);
    const todas = [];
    (data || []).forEach(it => {
      const numeroSemana = it.semanas ? it.semanas.numero : '?';
      (it.tags || []).forEach(t => todas.push({ tag: t, semana: numeroSemana }));
    });
    setHistoricoTags(todas);
  }
  function semanasOndeTagApareceu(t) {
    const sems = [];
    historicoTags.forEach(h => {
      if (tagsSaoEquivalentes(h.tag, t) && !sems.includes(h.semana)) sems.push(h.semana);
    });
    return sems.sort((a, b) => parseInt(a) - parseInt(b));
  }

  function tagsSaoEquivalentes(a, b) {
    const na = String(a || '').trim().toLowerCase().replace(/\s+/g, '');
    const nb = String(b || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!na || !nb) return false;
    if (na === nb) return true;
    return na.startsWith(nb) || nb.startsWith(na);
  }
  function tagEhRepetida(t) { return historicoTags.some(h => tagsSaoEquivalentes(h.tag, t)); }

  function campo(chave, valor) { setDados(prev => ({ ...prev, [chave]: valor })); }

  function temAlgumDiaPreenchido() {
    const dias = dados.aderencia_dias || {};
    return DIAS.some(d => dias[d] && dias[d].status);
  }

  // clicar num status: marca; clicar de novo no mesmo: desmarca (igual ao HTML)
  function setStatusDia(dia, valor) {
    const diasAtual = dados.aderencia_dias || {};
    const atual = (diasAtual[dia] || {}).status || '';
    campo('aderencia_dias', { ...diasAtual, [dia]: { ...(diasAtual[dia] || {}), status: atual === valor ? '' : valor } });
  }
  function atualizarCampoDia(dia, chave, texto) {
    const diasAtual = dados.aderencia_dias || {};
    campo('aderencia_dias', { ...diasAtual, [dia]: { ...(diasAtual[dia] || {}), [chave]: texto } });
  }
  function temAlgumDiaEm(it) {
    const dias = it.aderencia_dias || {};
    return DIAS.some(d => dias[d] && dias[d].status);
  }
  function preencherSemana(status) {
    if (temAlgumDiaPreenchido() && !confirm('Este item já possui dias preenchidos.\nDeseja sobrescrever?')) return;
    const novo = {};
    DIAS.forEach(d => { novo[d] = { ...(dados.aderencia_dias || {})[d], status }; });
    campo('aderencia_dias', novo);
  }
  // "Semana não executada": Seg-Sex como não executado, fim de semana como sem programação
  function preencherSemanaNok() {
    if (temAlgumDiaPreenchido() && !confirm('Este item já possui dias preenchidos.\nDeseja sobrescrever?')) return;
    const novo = {};
    DIAS.forEach(d => {
      const st = (d === 'Sáb' || d === 'Dom') ? 'semprog' : 'nok';
      novo[d] = { ...(dados.aderencia_dias || {})[d], status: st };
    });
    campo('aderencia_dias', novo);
  }

  function abrirPartial() {
    const st = {};
    DIAS.forEach(d => { st[d] = ((dados.aderencia_dias || {})[d] || {}).status || ''; });
    setPartialState(st);
    setPicker('partial');
  }
  function ciclarPartial(dia) {
    const cycle = ['ok', 'nok', 'fin', 'semprog', ''];
    const cur = partialState[dia] || '';
    setPartialState(prev => ({ ...prev, [dia]: cycle[(cycle.indexOf(cur) + 1) % cycle.length] }));
  }
  function aplicarPartial() {
    if (temAlgumDiaPreenchido() && !confirm('Este item já possui dias preenchidos.\nDeseja sobrescrever?')) return;
    const diasAtual = dados.aderencia_dias || {};
    const novo = { ...diasAtual };
    DIAS.forEach(d => { novo[d] = { ...(diasAtual[d] || {}), status: partialState[d] || '' }; });
    campo('aderencia_dias', novo);
    setPicker(null);
  }

  // "Finalizado em X": dias até X viram executado, os seguintes viram finalizado
  function aplicarFin() {
    if (!finDia) { alert('Selecione o dia de conclusão!'); return; }
    if (temAlgumDiaPreenchido() && !confirm('Este item já possui dias preenchidos.\nDeseja sobrescrever?')) return;
    const idxFim = DIAS.indexOf(finDia);
    const diasAtual = dados.aderencia_dias || {};
    const novo = {};
    DIAS.forEach((d, idx) => { novo[d] = { ...(diasAtual[d] || {}), status: idx <= idxFim ? 'ok' : 'fin' }; });
    campo('aderencia_dias', novo);
    setPicker(null); setFinDia(null);
  }

  function aplicarCopy() {
    if (!copySrcId) { alert('Selecione um item!'); return; }
    const src = (todosItens || []).find(i => i.id === copySrcId);
    if (!src) return;
    if (temAlgumDiaPreenchido() && !confirm('Este item já possui dias preenchidos.\nDeseja sobrescrever?')) return;
    campo('aderencia_dias', JSON.parse(JSON.stringify(src.aderencia_dias || {})));
    setPicker(null); setCopySrcId('');
  }

  function setProgresso(val) {
    const prev = dados.progresso;
    const novo = prev === val ? '' : val;
    campo('progresso', novo);
    if (val === 'niniciado' && prev !== 'niniciado') {
      if (!temAlgumDiaPreenchido() || confirm('Deseja preencher automaticamente como "Não executado"?')) {
        const diasNovo = {};
        DIAS.forEach(d => {
          const st = (d === 'Sáb' || d === 'Dom') ? 'semprog' : 'nok';
          diasNovo[d] = { ...(dados.aderencia_dias || {})[d], status: st };
        });
        setDados(prev2 => ({ ...prev2, progresso: novo, aderencia_dias: diasNovo }));
      }
    }
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

        <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: '14px 20px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <b>ITEM {dados.item || '-'}</b>
          {dados.fora_programacao && <span style={{ background: '#fff3e0', color: '#e65100', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 'bold' }}>⚡ Fora da programação</span>}
        </div>
        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 'bold', color: '#005a27', background: '#e8f5e9', padding: '12px 20px', borderBottom: '1px solid #c8e6c9', letterSpacing: .5 }}>
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
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#e65100', fontWeight: 'bold' }}>
                  <input type="checkbox" checked={!!dados.fora_programacao} onChange={e => campo('fora_programacao', e.target.checked)} />
                  ⚡ Item fora da programação
                </label>
              </div>
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
                          ? <span style={{ color: '#e53935', fontSize: 11, marginLeft: 8, fontWeight: 'bold' }}>
                              🔴 repetida ✔ — já pedida na(s) semana(s): {semanasOndeTagApareceu(t).join(', ')}
                            </span>
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
              {/* Situação ao término da semana */}
              <div style={secaoEstilo}>
                <div style={secaoLabelEstilo}>📌 Situação ao término da semana</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[['andamento', '↻ Em andamento', '#f9a825'], ['niniciado', '○ Não iniciado', '#c62828'], ['concluido', '✔ Concluído', '#007a33']].map(([v, l, cor]) => (
                    <button key={v} onClick={() => setProgresso(v)}
                      style={btnEstilo(dados.progresso === v ? cor : '#eee', dados.progresso === v ? '#fff' : '#555')}>
                      {l}
                    </button>
                  ))}
                </div>
                {dados.progresso === 'niniciado' && (
                  <div style={{ marginTop: 10 }}>
                    <label style={labelEstilo}>📝 Motivo do não início</label>
                    <textarea value={dados.motivo_niniciado || ''} onChange={e => campo('motivo_niniciado', e.target.value)}
                      rows={2} style={{ ...inputEstilo, width: '100%', resize: 'vertical' }} />
                  </div>
                )}
              </div>

              {/* Continuidade */}
              <div style={secaoEstilo}>
                <div style={secaoLabelEstilo}>🔁 Continuidade</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={!!dados.vem_da_semana}
                      onChange={e => campo('vem_da_semana', e.target.checked)} />
                    Vem da semana
                  </label>
                  <input type="text" placeholder="Nº" disabled={!dados.vem_da_semana}
                    value={dados.semana_origem || ''} onChange={e => campo('semana_origem', e.target.value)}
                    style={{ ...inputEstilo, width: 80, background: dados.vem_da_semana ? '#fff' : '#f0f0f0' }} />
                </div>
              </div>

              {/* Execução por dia */}
              <div style={secaoEstilo}>
                <div style={secaoLabelEstilo}>📆 Execução por dia</div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <button onClick={() => preencherSemana('ok')} style={btnEstilo('#007a33')}>✔ Semana executada</button>
                  <button onClick={preencherSemanaNok} style={btnEstilo('#c62828')}>✘ Semana não executada</button>
                  <button onClick={() => preencherSemana('semprog')} style={btnEstilo('#757575')}>🚫 Sem programação</button>
                  <button onClick={abrirPartial} style={btnEstilo('#1565c0')}>📅 Semana parcial</button>
                  <button onClick={() => { setFinDia(null); setPicker('fin'); }} style={btnEstilo('#0288d1')}>★ Finalizado em...</button>
                  <button onClick={() => setPicker('copy')} style={btnEstilo('#6a1b9a')}>📋 Copiar de outro item</button>
                </div>

                {picker === 'partial' && (
                  <div style={pickerEstilo('#1565c0')}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#1565c0', marginBottom: 8 }}>📅 Clique nos dias para alternar:</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, color: '#666', marginBottom: 10 }}>
                      {Object.entries(STATUS_INFO).filter(([k]) => k).map(([k, v]) => (
                        <span key={k}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: v.cor, marginRight: 3 }} />{v.label} {v.nome}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {DIAS.map(d => {
                        const st = partialState[d] || '';
                        const info = STATUS_INFO[st];
                        return <button key={d} onClick={() => ciclarPartial(d)}
                          style={{ background: info.cor, color: info.texto, border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
                          {d} {info.label}
                        </button>;
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={aplicarPartial} style={btnEstilo('#1565c0')}>✔ Aplicar</button>
                      <button onClick={() => setPicker(null)} style={btnEstilo('#eee', '#666')}>Cancelar</button>
                    </div>
                  </div>
                )}

                {picker === 'fin' && (
                  <div style={pickerEstilo('#0288d1')}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#0288d1', marginBottom: 4 }}>★ Selecione o dia de conclusão do serviço</div>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>Os dias até a conclusão serão ✔ Executado, os posteriores serão ★ Sol. porém finalizado.</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {DIAS.map(d => (
                        <button key={d} onClick={() => setFinDia(d)}
                          style={{ background: finDia === d ? '#0288d1' : '#fff', color: finDia === d ? '#fff' : '#0288d1',
                            border: '1.5px solid #0288d1', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={aplicarFin} style={btnEstilo('#0288d1')}>★ Aplicar</button>
                      <button onClick={() => setPicker(null)} style={btnEstilo('#eee', '#666')}>Cancelar</button>
                    </div>
                  </div>
                )}

                {picker === 'copy' && (
                  <div style={pickerEstilo('#6a1b9a')}>
                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#6a1b9a', marginBottom: 8 }}>📋 Selecione o item modelo:</div>
                    <select value={copySrcId} onChange={e => setCopySrcId(e.target.value)} style={{ ...inputEstilo, width: '100%', marginBottom: 10 }}>
                      <option value="">— Selecione um item —</option>
                      {(todosItens || []).filter(i => i.id !== dados.id && temAlgumDiaEm(i)).map(i => (
                        <option key={i.id} value={i.id}>ITEM {i.item} | {i.assunto}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={aplicarCopy} style={btnEstilo('#6a1b9a')}>✔ Copiar</button>
                      <button onClick={() => setPicker(null)} style={btnEstilo('#eee', '#666')}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Grade de dias — clicar SELECIONA o dia (não cicla status) */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DIAS.map(d => {
                    const dd = (dados.aderencia_dias || {})[d] || {};
                    const st = dd.status || '';
                    const info = STATUS_INFO[st];
                    const ativo = diaSelecionado === d;
                    return (
                      <button key={d} onClick={() => setDiaSelecionado(diaSelecionado === d ? null : d)}
                        style={{
                          background: ativo ? '#e8f5e9' : '#fff',
                          border: ativo ? '2px solid #007a33' : '1.5px solid #ddd',
                          borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 'bold',
                          cursor: 'pointer', color: '#333', minWidth: 62,
                        }}>
                        {d}
                        {st && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: info.cor, marginLeft: 4, verticalAlign: 'middle' }} />}
                      </button>
                    );
                  })}
                </div>

                {/* Painel do dia selecionado */}
                {diaSelecionado && (() => {
                  const dd = (dados.aderencia_dias || {})[diaSelecionado] || {};
                  return (
                    <div style={{ marginTop: 14, background: '#f7fbf7', border: '1px solid #cfe3d0', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#007a33', marginBottom: 10 }}>{diaSelecionado} — Status</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {[
                          ['ok', '✔ Executado sem pendência', '#007a33'],
                          ['pend', '⚠ Executado com pendência', '#e65100'],
                          ['nok', '✘ Não executado', '#c62828'],
                          ['semprog', '○ Sem programação', '#999'],
                          ['fin', '★ Sol. porém finalizado', '#1565c0'],
                        ].map(([v, l, cor]) => {
                          const sel = dd.status === v;
                          return (
                            <div key={v} onClick={() => setStatusDia(diaSelecionado, v)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', borderRadius: 7,
                                background: sel ? cor + '18' : '#fff', border: '1.5px solid ' + (sel ? cor : '#e0e0e0'),
                                color: sel ? cor : '#555', fontWeight: sel ? 'bold' : 'normal', fontSize: 13 }}>
                              <input type="radio" readOnly checked={sel} />
                              {l}
                            </div>
                          );
                        })}
                      </div>

                      {(dd.status === 'pend' || dd.status === 'nok') && (
                        <div>
                          <label style={labelEstilo}>📝 Observações</label>
                          <textarea value={dd.obs || ''} onChange={e => atualizarCampoDia(diaSelecionado, 'obs', e.target.value)}
                            rows={3} style={{ ...inputEstilo, width: '100%', resize: 'vertical' }} />
                        </div>
                      )}
                      {dd.status === 'ok' && (
                        <div>
                          <label style={labelEstilo}>📝 Observações (opcional)</label>
                          <textarea value={dd.obsOk || ''} placeholder="Registre uma nota sobre a execução deste dia (opcional)..."
                            onChange={e => atualizarCampoDia(diaSelecionado, 'obsOk', e.target.value)}
                            rows={2} style={{ ...inputEstilo, width: '100%', resize: 'vertical', background: '#f9fff9', borderColor: '#a5d6a7' }} />
                          <label style={{ ...labelEstilo, marginTop: 8 }}>📅 Data de conclusão</label>
                          <input type="text" placeholder="Ex: 23/06/2026" value={dd.concluidoDia || ''}
                            onChange={e => atualizarCampoDia(diaSelecionado, 'concluidoDia', e.target.value)}
                            style={{ ...inputEstilo, width: '100%' }} />
                        </div>
                      )}
                      {dd.status === 'fin' && (
                        <div>
                          <label style={labelEstilo}>📝 Observações (opcional)</label>
                          <textarea value={dd.obsOk || ''} placeholder="Nota sobre o serviço finalizado antecipadamente..."
                            onChange={e => atualizarCampoDia(diaSelecionado, 'obsOk', e.target.value)}
                            rows={2} style={{ ...inputEstilo, width: '100%', resize: 'vertical', background: '#e3f2fd', borderColor: '#90caf9' }} />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {aba === 'devolutiva' && (
            <div>
              <label style={labelEstilo}>Texto da devolutiva</label>
              <textarea value={dados.devolutiva_texto || ''} onChange={e => campo('devolutiva_texto', e.target.value)}
                rows={4} style={{ ...inputEstilo, width: '100%', resize: 'vertical' }} />
              <label style={{ ...labelEstilo, marginTop: 12 }}>Executável?</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['sim', '✔ Sim'], ['sim_alt', '✔ Sim c/ alteração'], ['nao', '✘ Não']].map(([v, l]) => (
                  <button key={v} onClick={() => campo('devolutiva_executavel', dados.devolutiva_executavel === v ? null : v)}
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
          <button onClick={() => onSave(dados)} style={btnEstilo('#007a33')}>💾 Salvar e fechar</button>
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
const modalEstilo = { background: '#fff', width: 660, maxWidth: '96vw', maxHeight: '90vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,.35)' };
const closeXEstilo = { position: 'absolute', top: 10, right: 12, background: 'rgba(0,0,0,.2)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontWeight: 'bold', cursor: 'pointer', zIndex: 5 };
const labelEstilo = { display: 'block', fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4, textTransform: 'uppercase' };
const inputEstilo = { padding: '8px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, fontFamily: 'Arial' };
function btnEstilo(cor, texto) {
  return { background: cor, color: texto || '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' };
}
const secaoEstilo = { background: '#fafcfa', border: '1px solid #e0eae0', borderRadius: 10, padding: 14, marginBottom: 14 };
const secaoLabelEstilo = { fontSize: 12, fontWeight: 'bold', color: '#007a33', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .3 };
function pickerEstilo(cor) {
  return { background: '#f7fbf7', border: '2px solid ' + cor, borderRadius: 12, padding: 14, marginBottom: 16 };
}
