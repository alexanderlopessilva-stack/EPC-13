import { SENHA_ACESSO, COOKIE_NOME } from '../../lib/authConfig';

export default function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const { senha } = req.body || {};
  if (senha === SENHA_ACESSO) {
    // fica logado por 30 dias nesse navegador
    res.setHeader('Set-Cookie', COOKIE_NOME + '=' + SENHA_ACESSO + '; Path=/; Max-Age=2592000; SameSite=Lax');
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
}
