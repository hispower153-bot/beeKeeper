"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

const C = { cream: "#FBF5E8", ink: "#2B2210", amberDeep: "#B87317", woodLine: "#E7D8B8", inkSoft: "#6B5E45", red: "#B5453F", redBg: "#F6E4E1" };

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { setError("이메일 또는 비밀번호가 올바르지 않습니다."); return; }
      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setSignupDone(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: C.cream, fontFamily: "Inter, sans-serif" }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#fff", border: `1px solid ${C.woodLine}` }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: C.ink }}>양봉일지</h1>
        <p className="text-sm mb-5" style={{ color: C.inkSoft }}>벌통 관리 시스템에 로그인하세요</p>

        {signupDone ? (
          <p className="text-sm rounded-lg p-3" style={{ background: "#E7EFE3", color: "#4C7A52" }}>
            가입 확인 메일을 보냈습니다. 메일함에서 인증 링크를 눌러주세요.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label className="block mb-3">
              <span className="text-xs font-semibold block mb-1" style={{ color: C.inkSoft }}>이메일</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.woodLine}` }} />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-semibold block mb-1" style={{ color: C.inkSoft }}>비밀번호</span>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.woodLine}` }} />
            </label>
            {error && <p className="text-xs rounded-lg p-2.5 mb-3" style={{ background: C.redBg, color: C.red }}>{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full font-semibold rounded-lg py-2.5 text-sm text-white mb-3"
              style={{ background: C.amberDeep, opacity: loading ? 0.6 : 1 }}>
              {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
            </button>
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              className="w-full text-xs font-semibold underline" style={{ color: C.inkSoft }}>
              {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
