import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.cookies.has("mg_session")) return NextResponse.next();
  const url = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

// O manifest e os ícones são buscados sem credenciais: redirecioná-los quebra a instalação do PWA.
export const config = {
  matcher: [
    "/((?!api|_next|icons|login|manifest\\.webmanifest|favicon\\.ico|apple-touch-icon\\.png).*)",
  ],
};
