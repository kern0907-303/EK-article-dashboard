import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isGateEnabled, isValidToken } from "@/lib/auth";

// 不需要登入的路徑：
// - 登入頁與登入接口本身
// - 三個品牌測驗頁與名單接口（對外的行銷頁，訪客要能用）
// - 唯讀的雷達關鍵字資料
const PUBLIC_PATHS = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/lead",
  "/api/radar/keywords",
  "/nas/quiz",
  "/abl/check",
  "/i8/diagnosis",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  if (!isGateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (await isValidToken(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // 排除 Next 靜態資源與圖示，其餘都檢查
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|txt)$).*)"],
};
