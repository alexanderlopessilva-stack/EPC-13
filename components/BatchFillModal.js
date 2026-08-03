import { useState } from 'react';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const STATUS_OPCOES = [
  { v: 'ok', label: '✔ Executado sem pendência', cor: '#007a33' },
  { v: 'pend', label: '⚠ Executado com pendência', cor: '#e65100' },
  { v: 'nok', label: '✘ Não executado', cor: '#c62828' },
  { v: 'semprog', label: '○ Sem programação', cor: '#999' },
  { v: 'fin', label: '★ Sol. porém finalizado', cor: '#1565c0' },
];
const COM_OBS = ['ok', 'pend', 'nok'];

export default function BatchFillModal({ aberto, qtdSelecionados, onCancelar, onConfirmar }) {
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [status, setStatus] = useState('');
  const [obs, setObs] = useState('');

  if (!aberto) return null;

  function toggleDia(d) {
    setDiasSelecionados(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }
  function toggleTodosDias() {
    setDiasSelecionados(prev => prev.length === DIAS.length ? [] : DIAS.slice());
  }
  function confirmar() {
    if (diasSelecionados.length === 0) { alert('Selecione pelo menos um dia!'); return; }
    if (!status) { alert('Selecione um status!'); return; }
    onConfirmar(diasSelecionados, status, obs.trim());
    setDiasSelecionados([]); setStatus(''); setObs('');
  }
  function cancelar() {
    setDiasSelecionados([]); setStatus(''); setObs('');
    onCancelar();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 960, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', width: 520, maxWidth: '96vw', maxHeight: '90vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#00341a,#007a33)', color: '#fff', padding: '14px 20px' }}>
          <b>📦 Preenchimento em lote</b>
          <div style={{ fontSize: 12, opacity: .9, marginTop: 4 }}>
            Preenchendo {qtdSelecionados} item{qtdSelecionados !== 1 ? 's' : ''} selecionado{qtdSelecionados !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#007a33', marginBottom: 8 }}>1. Escolha os dias</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {DIAS.map(d => (
              <button key={d} onClick={() => toggleDia(d)}
                style={{ background: diasSelecionados.includes(d) ? '#007a33' : '#eee', color: diasSelecionados.includes(d) ? '#fff' : '#555',
                  border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
                {d}
              </button>
            ))}
          </div>
          <button onClick={toggleTodosDias} style={{ background: '#eee', color: '#007a33', border: '1px solid #cfe3d0', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', marginBottom: 20 }}>
            {diasSelecionados.length === DIAS.length ? '✕ Desmarcar todos' : '☑ Marcar todos os dias'}
          </button>

          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#007a33', marginBottom: 8 }}>2. Escolha o status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {STATUS_OPCOES.map(o => {
              const sel = status === o.v;
              return (
                <div key={o.v} onClick={() => setStatus(o.v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', borderRadius: 7,
                    background: sel ? o.cor + '18' : '#fff', border: '1.5px solid ' + (sel ? o.cor : '#e0e0e0'),
                    color: sel ? o.cor : '#555', fontWeight: sel ? 'bold' : 'normal', fontSize: 13 }}>
                  <input type="radio" readOnly checked={sel} />
                  {o.label}
                </div>
              );
            })}
          </div>

          {COM_OBS.includes(status) ? (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 4, textTransform: 'uppercase' }}>
                📝 Observação (opcional, aplicada a todos os itens/dias marcados)
              </label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 13, fontFamily: 'Arial', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>Esse status não usa observação.</div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={cancelar} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
            ✕ Cancelar
          </button>
          <button onClick={confirmar} style={{ background: '#007a33', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
            ✔ Aplicar aos selecionados
          </button>
        </div>
      </div>
    </div>
  );
}
