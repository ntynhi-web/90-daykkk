import { Component, ErrorInfo, ReactNode } from "react";

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("App render failure:", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-white"><section className="w-full max-w-md rounded-3xl border border-rose-400/30 bg-white/10 p-6"><p className="text-xs font-black uppercase tracking-wider text-rose-300">Dữ liệu chưa hợp lệ</p><h1 className="mt-2 text-xl font-black">App đã chặn màn hình trắng</h1><p className="mt-2 text-sm text-slate-300">Kế hoạch vừa nhập có cấu trúc lỗi. Dữ liệu cũ vẫn còn trong tài khoản.</p><button onClick={() => window.location.reload()} className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950">Tải lại dữ liệu an toàn</button></section></main>;
  }
}
