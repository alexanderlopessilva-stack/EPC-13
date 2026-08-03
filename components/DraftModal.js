import { useState } from 'react';
import { supabase } from '../lib/supabase';

const SITUACAO_CONFIG = {
  AGUARD_AVAL: { label: '⏳ Aguardando avaliação', cor: '#7B68EE', bg: '#f0eeff' },
  AGUARD_DEV:  { label: '📬 Aguardando devolutiva', cor: '#0057B8', bg: '#e8f0fb' },
  EM_EXEC:     { label: '⚙️ Em execução', cor: '#b8860b', bg: '#fffde7' },
  FINALIZADO:  { label: '✅ Draft finalizado', cor: '#008542', bg: '#e8f5e9' },
  CANCELADO:   { label: '🚫 Draft cancelado', cor: '#c0392b', bg: '#fdecea' },
};
const STATUS_REV = {
  SEM_PEND: { label: '✅ Sem pendência', cor: '#008542' },
  AJUSTE:   { label: '🔴 Ajuste necessário', cor: '#c0392b' },
  NENHUM:   { label: '— Nenhum', cor: '#999' },
};

export default function DraftModal({ draft, onClose, onSave, onDelete }) {
  const [dados, setDados] = useState(draft);
  const [abaRev, setAbaRev] = useState(0);

  function campo(chave, valor) { setDados(prev => ({ ...prev, [chave]: valor })); }

  async function marcarSituacao(nova) {
    campo('situacao', nova);
    campo('situacao_data', new Date().toLocaleDateString('pt-BR'));
  }

  function verArquivo(arq) {
    if (!arq.url) { alert('Arquivo não disponível (pode não ter sido importado).'); return; }
    window.open(arq.url, '_blank');
  }

  const revisaoAtual = dados.revisoes && dados.revisoes[abaRev];

  return (
    <div style={overlayEstilo}>
      <div style={modalEstilo}>
        <button onClick={onClose} style={closeXEstilo} title="Fechar">✕</button>

        <div style={{ background: 'linear-gradient(135deg,#0B5FA8,#08427a)', color: '#fff', padding: '14px 20px', borderRadius: '14px 14px 0 0' }}>
          <b style={{ fontSize: 15 }}>{dados.codigo}</b>
          <div style={{ fontSize: 12, opacity: .9, marginTop: 2 }}>{dados.assunto}</div>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 6, textTransform: 'uppercase' }}>Situação</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(SITUACAO_CONFIG).map(([k, cfg]) => (
              <button key={k} onClick={() => marcarSituacao(k)}
                style={{ background: dados.situacao === k ? cfg.cor : cfg.bg, color: dados.situacao === k ? '#fff' : cfg.cor,
                  border: '1px solid ' + cfg.cor, borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f5f7fa', overflowX: 'auto' }}>
          {(dados.revisoes || []).map((r, i) => (
            <button key={r.id || i} onClick={() => setAbaRev(i)}
              style={{ padding: '10px 16px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap',
                background: abaRev === i ? '#fff' : 'transparent', color: abaRev === i ? '#0B5FA8' : '#888',
                borderBottom: abaRev === i ? '3px solid #0B5FA8' : '3px solid transparent' }}>
              Rev. {r.letra}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {revisaoAtual ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef4fb', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#0B5FA8', fontSize: 14 }}>Revisão {revisaoAtual.letra}</div>
                  <div style={{ fontSize: 12, color: '#4a6d94', marginTop: 2 }}>Criada em {revisaoAtual.criado_em || '-'}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: (STATUS_REV[revisaoAtual.status] || STATUS_REV.NENHUM).cor }}>
                  {(STATUS_REV[revisaoAtual.status] || STATUS_REV.NENHUM).label}
                </span>
              </div>

              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#0B5FA8', marginBottom: 8, textTransform: 'uppercase' }}>Arquivos</div>
              {(revisaoAtual.arquivos || []).length === 0 && <div style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>Nenhum arquivo nesta revisão.</div>}
              {(revisaoAtual.arquivos || []).map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7fafd', border: '1px solid #dde8f0', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{a.tipo === 'xlsx' ? '📊' : '📄'} {a.nome}</span>
                  <button onClick={() => verArquivo(a)} style={btnEstilo('#0B5FA8')}>👁 Ver</button>
                </div>
              ))}

              {(revisaoAtual.ciclos || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#0B5FA8', marginBottom: 8, textTransform: 'uppercase' }}>Histórico de status</div>
                  {revisaoAtual.ciclos.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: c.tipo === 'AJUSTE' ? '#c0392b' : '#008542', marginBottom: 4 }}>
                      {c.tipo === 'AJUSTE' ? '🔴 Ajuste necessário' : '✅ Sem pendência'} — {c.data}
                    </div>
                  ))}
                </div>
              )}

              {(revisaoAtual.comentarios || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#0B5FA8', marginBottom: 8, textTransform: 'uppercase' }}>Comentários</div>
                  {revisaoAtual.comentarios.map((c, i) => (
                    <div key={i} style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 12 }}>
                      {typeof c === 'string' ? c : (c.texto || JSON.stringify(c))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <div style={{ color: '#999', textAlign: 'center', padding: 30 }}>Este Draft não tem nenhuma revisão.</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => onDelete(dados.id)} style={btnEstilo('#fdecea', '#c0392b')}>🗑 Excluir Draft</button>
          <button onClick={() => onSave(dados)} style={btnEstilo('#0B5FA8')}>💾 Salvar e fechar</button>
        </div>
      </div>
    </div>
  );
}

const overlayEstilo = { position: 'fixed', inset: 0, background: 'rgba(0,20,5,.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modalEstilo = { background: '#fff', width: 700, maxWidth: '96vw', maxHeight: '90vh', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 8px 40px rgba(0,0,0,.35)' };
const closeXEstilo = { position: 'absolute', top: 10, right: 12, background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: '50%', width: 30, height: 30, color: '#fff', fontWeight: 'bold', cursor: 'pointer', zIndex: 5 };
function btnEstilo(cor, texto) {
  return { background: cor, color: texto || '#fff', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' };
}
