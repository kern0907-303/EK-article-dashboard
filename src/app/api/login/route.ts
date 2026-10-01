import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, expectedToken, isCorrectPassword, isGateEnabled } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!isGateEnabled()) {
    return NextResponse.json({ success: true, gate: "off" });
  }
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {}

  if (!(await isCorrectPassword(password))) {
    // 故意慢一點，降低暴力猜密碼的速度
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "密碼不正確" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(AUTH_COOKIE, await expectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
