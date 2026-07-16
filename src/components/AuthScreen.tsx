import React, { useState } from "react";
import { Cloud, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { firebaseConfigured, signInWithGoogle } from "../firebase";

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (signInError: any) {
      if (signInError?.code !== "auth/popup-closed-by-user") {
        setError(signInError?.message || "Không thể đăng nhập bằng Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10 text-white">
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
      <section className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-white/95 p-7 text-slate-900 shadow-2xl backdrop-blur-xl md:p-9">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"><Sparkles className="h-5 w-5" /></span>
          <div><p className="text-xl font-black tracking-tight">90-Day Life OS</p><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Personal workspace</p></div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-black tracking-tight">Không gian riêng của bạn</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Đăng nhập để mục tiêu, lịch, routine và check-in được lưu theo tài khoản Google của bạn.</p>
        </div>

        <div className="my-7 grid gap-2.5">
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-xs font-semibold text-indigo-900"><Cloud className="h-4 w-4 text-indigo-600" /> Đồng bộ giữa máy tính và điện thoại</div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Mỗi tài khoản chỉ đọc và sửa dữ liệu của chính mình</div>
          <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-900"><LockKeyhole className="h-4 w-4 text-amber-600" /> Vẫn giữ bản sao cục bộ để phục hồi khi mất mạng</div>
        </div>

        {firebaseConfigured ? (
          <button onClick={handleSignIn} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-indigo-700 disabled:opacity-50">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-blue-600">G</span>
            {loading ? "Đang kết nối…" : "Tiếp tục với Google"}
          </button>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <strong>Chưa kết nối Firebase.</strong> Thêm bốn biến môi trường Firebase vào Vercel rồi redeploy để bật đăng nhập.
          </div>
        )}

        {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
        <p className="mt-5 text-center text-[10px] leading-relaxed text-slate-400">App chỉ sử dụng tên, email và ảnh đại diện để nhận diện không gian dữ liệu cá nhân.</p>
      </section>
    </main>
  );
}
