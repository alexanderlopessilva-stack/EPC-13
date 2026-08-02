import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const CORES_STATUS = { ok: '#007a33', pend: '#f9a825', nok: '#c62828', fin: '#0288d1', semprog: '#757575' };
const LABEL_STATUS = { ok: 'Executado', pend: 'Pendente', nok: 'Não executado', fin: 'Finalizado', semprog: 'Sem programação' };

export default function RelatorioHistorico({ aberto, onClose, semanas, itensSemanaAtual, semanaAtivaNumero }) {
  const [aba, setAba] = useState('relatorio'); // 'relatorio' | 'historico'
  const [semanasSelecionadas, setSemanasSelecionadas] = useState({});
  const [dadosHistorico, setDadosHistorico] = useState([]);
  const [carregandoHist, setCarregandoHist] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const todasMarcadas = {};
    semanas.forEach(s => { todasMarcadas[s.numero] = true; });
    setSemanasSelecionadas(todasMarcadas);
  }, [aberto, semanas]);

  useEffect(() => {
    if (aberto && aba === 'historico') carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, aba]);

  async function carregarHistorico() {
    setCarregandoHist(true);
    const resultado = [];
    for (const s of semanas) {
      const { data } = await supabase.from('itens').select('aderencia_dias, fora_programacao').eq('semana_id', s.id);
      const contagem = { ok: 0, pend: 0, nok: 0, fin: 0, semprog: 0 };
      (data || []).forEach(it => {
        const dias = it.aderencia_dias || {};
        Object.values(dias).forEach(d => { if (d && d.status && contagem[d.status] !== undefined) contagem[d.status]++; });
      });
      const totalExec = contagem.ok + contagem.pend + contagem.nok + contagem.fin;
      const aderenciaPct = totalExec > 0 ? Math.round(((contagem.ok + contagem.fin) / totalExec) * 100) : 0;
      resultado.push({ numero: s.numero, ...contagem, aderenciaPct, totalItens: (data || []).length });
    }
    setDadosHistorico(resultado);
    setCarregandoHist(false);
  }

  const statsAtual = useMemo(() => {
    const contagem = { ok: 0, pend: 0, nok: 0, fin: 0, semprog: 0 };
    let foraProg = 0;
    itensSemanaAtual.forEach(it => {
      if (it.fora_programacao) foraProg++;
      const dias = it.aderencia_dias || {};
      Object.values(dias).forEach(d => { if (d && d.status && contagem[d.status] !== undefined) contagem[d.status]++; });
    });
    return { ...contagem, foraProg, totalItens: itensSemanaAtual.length };
  }, [itensSemanaAtual]);

  const dadosPizza = Object.entries(statsAtual)
    .filter(([k]) => CORES_STATUS[k])
    .map(([k, v]) => ({ name: LABEL_STATUS[k], value: v, cor: CORES_STATUS[k] }))
    .filter(d => d.value > 0);

  const historicoFiltrado = dadosHistorico.filter(d => semanasSelecionadas[d.numero]);

  if (!aberto) return null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', width: 820, maxWidth: '96vw', maxHeight: '90vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b>📊 Relatório & Histórico</b>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #ddd' }}>
          <button onClick={() => setAba('relatorio')} style={tabEstilo(aba === 'relatorio')}>📈 Relatório (semana {semanaAtivaNumero})</button>
          <button onClick={() => setAba('historico')} style={tabEstilo(aba === 'historico')}>📉 Histórico (todas as semanas)</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {aba === 'relatorio' && (
            <div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <CardStat label="Total de itens" valor={statsAtual.totalItens} cor="#007a33" />
                <CardStat label="Executados" valor={statsAtual.ok} cor="#007a33" />
                <CardStat label="Pendentes" valor={statsAtual.pend} cor="#f9a825" />
                <CardStat label="Não executados" valor={statsAtual.nok} cor="#c62828" />
                <CardStat label="Finalizados" valor={statsAtual.fin} cor="#0288d1" />
                <CardStat label="Fora da programação" valor={statsAtual.foraProg} cor="#e65100" />
              </div>
              {dadosPizza.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={dadosPizza} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {dadosPizza.map((d, i) => <Cell key={i} fill={d.cor} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>Nenhum status marcado ainda nesta semana.</div>}
            </div>
          )}

          {aba === 'historico' && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#007a33', marginBottom: 6 }}>☑️ Semanas incluídas:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {semanas.map(s => (
                    <label key={s.id} style={{ fontSize: 12, background: '#f0f7f0', border: '1px solid #cfe3d0', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!semanasSelecionadas[s.numero]}
                        onChange={e => setSemanasSelecionadas(prev => ({ ...prev, [s.numero]: e.target.checked }))} /> Sem. {s.numero}
                    </label>
                  ))}
                </div>
              </div>
              {carregandoHist ? <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>Carregando...</div> : (
                historicoFiltrado.length === 0 ? <div style={{ textAlign: 'center', color: '#999', padding: 30 }}>Nenhuma semana selecionada.</div> : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={historicoFiltrado}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="numero" tickFormatter={v => 'Sem. ' + v} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="ok" name="Executado" fill={CORES_STATUS.ok} />
                        <Bar dataKey="pend" name="Pendente" fill={CORES_STATUS.pend} />
                        <Bar dataKey="nok" name="Não executado" fill={CORES_STATUS.nok} />
                        <Bar dataKey="fin" name="Finalizado" fill={CORES_STATUS.fin} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#007a33', marginBottom: 8 }}>% de aderência por semana:</div>
                      {historicoFiltrado.map(d => (
                        <div key={d.numero} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, width: 70 }}>Sem. {d.numero}</span>
                          <div style={{ flex: 1, background: '#eee', borderRadius: 6, overflow: 'hidden', height: 16 }}>
                            <div style={{ width: d.aderenciaPct + '%', background: '#007a33', height: '100%' }} />
                          </div>
                          <span style={{ fontSize: 12, width: 40 }}>{d.aderenciaPct}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardStat({ label, valor, cor }) {
  return (
    <div style={{ background: '#f7fbf7', border: '1px solid #cfe3d0', borderRadius: 10, padding: '10px 16px', minWidth: 110, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: cor }}>{valor}</div>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
    </div>
  );
}
function tabEstilo(ativo) {
  return { flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
    background: ativo ? '#fff' : '#f5f7fa', color: ativo ? '#007a33' : '#888', borderBottom: ativo ? '3px solid #007a33' : '3px solid transparent' };
}
