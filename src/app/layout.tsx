import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
<<<<<<< HEAD
    title: "Mr.ZebraBKB | ระบบถาม-ตอบกฎบาสเกตบอล",
    description:
        "ระบบ AI อัจฉริยะสำหรับถามตอบกฎบาสเกตบอลอย่างเป็นทางการ พร้อมอ้างอิงข้อกฎ",
=======
  title: "Mr.Zebra - Basketball Referee AI",
  description: "ผู้เชี่ยวชาญกฎบาสเกตบอล FIBA",
>>>>>>> aeee20800e2563f129abe32055dd65e7c440903d
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
<<<<<<< HEAD
    return (
        <html lang="th">
            <body className={`${notoSansThai.variable} font-sans antialiased bg-slate-50 text-slate-800 selection:bg-sky-200 selection:text-sky-900`}>
                {/* Navigation - Premium Glassmorphism */}
                <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
                    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white flex items-center justify-center text-sm shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-300">
                                🦓
                            </div>
                            <span className="font-bold text-xl tracking-tight">
                                <span className="text-sky-600">Mr.Zebra</span>
                                <span className="text-orange-500">BKB</span>
                            </span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/"
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all duration-300"
                            >
                                💬 แชท
                            </Link>
                            <Link
                                href="/dashboard"
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all duration-300"
                            >
                                📊 แดชบอร์ด
                            </Link>
                        </div>
                    </div>
                </nav>
                <main className="pt-16">{children}</main>
            </body>
        </html>
    );
}
=======
  return (
    <html lang="th">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
>>>>>>> aeee20800e2563f129abe32055dd65e7c440903d
