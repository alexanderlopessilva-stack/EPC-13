import { NextResponse } from 'next/server';
import { SENHA_ACESSO, COOKIE_NOME } from './lib/authConfig';

export function middleware(request) {
  const cookie = request.cookies.get(COOKIE_NOME);
  if (cookie && cookie.value === SENHA_ACESSO) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = '/entrar';
  return NextResponse.redirect(url);
}

// roda em tudo, EXCETO a própria tela de entrada, a API de login e os arquivos estáticos do Next
export const config = {
  matcher: ['/((?!entrar|api/entrar|_next/static|_next/image|favicon.ico).*)'],
};
