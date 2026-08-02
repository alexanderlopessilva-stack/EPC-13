import { useState, useEffect } from 'react';

export default function AtualizacaoDiffModal({ diff, onCancelar, onAplicar }) {
  const [itensSelecionados, setItensSelecionados] = useState({});
  const [novosSelecionados, setNovosSelecionados] = useState({});

  useEffect(() => {
    if (!diff) return;
    const its = {}; diff.atualizacoes.forEach(u => { its[u.id] = true; });
    const nvs = {}; diff.novos.forEach((n, i) => { nvs[i] = true; });
    setItensSelecionados(its);
    setNovosSelecionados(nvs);
  }, [diff]);

  if (!diff) return null;

  function aplicar() {
    const atualizacoesEscolhidas = diff.atualizacoes.filter(u => itensSelecionados[u.id]);
    const novosEscolhidos = diff.novos.filter((n, i) => novosSelecionados[i]);
    onAplicar(atualizacoesEscolhidas, novosEscolhidos);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', width: 700, maxWidth: '96vw', maxHeight: '90vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#6a1b9a,#4a148c)', color: '#fff', padding: '14px 20px' }}>
          <b>🔄 Revisar atualização da semana</b>
          <div style={{ fontSize: 12, opacity: .9, marginTop: 4 }}>
            Confira as diferenças encontradas na planilha. Desmarque o que não quiser aplicar.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {diff.atualizacoes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#6a1b9a', marginBottom: 10 }}>
                ✏️ Itens existentes com diferenças ({diff.atualizacoes.length})
              </div>
              {diff.atualizacoes.map(u => (
                <label key={u.id} style={{ display: 'block', background: '#f7f2fa', border: '1px solid #e0d0ec', borderRadius: 8, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <input type="checkbox" checked={!!itensSelecionados[u.id]} style={{ marginTop: 3 }}
                      onChange={e => setItensSelecionados(prev => ({ ...prev, [u.id]: e.target.checked }))} />
                    <div style={{ flex: 1 }}>
                      <b style={{ fontSize: 13 }}>ITEM {u.item}</b> — {u.assuntoAtual}
                      {u.mudancas.map((m, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                          <b>{m.label}:</b> "{m.de || '(vazio)'}" → "{m.para}"
                        </div>
                      ))}
                      {u.tagsMudaram && (
                        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                          <b>TAGs:</b> {u.tagsAtuais.join(', ') || '(nenhuma)'} → {u.tagsNovas.join(', ') || '(nenhuma)'}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {diff.novos.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: '#007a33', marginBottom: 10 }}>
                ➕ Itens novos encontrados ({diff.novos.length})
              </div>
              {diff.novos.map((n, i) => (
                <label key={i} style={{ display: 'block', background: '#f0f7f0', border: '1px solid #cfe3d0', borderRadius: 8, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={!!novosSelecionados[i]}
                      onChange={e => setNovosSelecionados(prev => ({ ...prev, [i]: e.target.checked }))} />
                    <div style={{ fontSize: 13 }}><b>ITEM {n.item}</b> — {n.assunto}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancelar} style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
            ✕ Cancelar
          </button>
          <button onClick={aplicar} style={{ background: '#6a1b9a', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
            ✔ Aplicar selecionados
          </button>
        </div>
      </div>
    </div>
  );
}
