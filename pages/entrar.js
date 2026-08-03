import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Entrar() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  async function entrar(e) {
    e.preventDefault();
    setErro(''); setEnviando(true);
    try {
      const res = await fetch('/api/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setErro('Palavra-chave incorreta.');
      }
    } catch {
      setErro('Erro ao tentar entrar. Tente de novo.');
    }
    setEnviando(false);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 30% 20%, #0d6b38 0%, #00341a 65%, #001f10 100%)',
      fontFamily: 'Arial, sans-serif', padding: 16,
    }}>
      <form onSubmit={entrar} style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', width: 320, maxWidth: '100%', textAlign: 'center', boxShadow: '0 10px 34px rgba(0,0,0,.3)' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#00341a', letterSpacing: 1, marginBottom: 4 }}>
          EPC<span style={{ color: '#c9a600' }}>13</span>
        </div>
        <div style={{ fontSize: 12, color: '#777', marginBottom: 22 }}>Digite a palavra-chave para entrar</div>
        <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Palavra-chave" autoFocus
          style={{ width: '100%', padding: '11px 12px', borderRadius: 8, border: '1px solid #ccc', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />
        {erro && <div style={{ color: '#c0392b', fontSize: 12, marginBottom: 12, fontWeight: 'bold' }}>{erro}</div>}
        <button type="submit" disabled={enviando}
          style={{ width: '100%', background: '#007a33', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 14, fontWeight: 'bold', cursor: enviando ? 'default' : 'pointer', opacity: enviando ? .7 : 1 }}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
