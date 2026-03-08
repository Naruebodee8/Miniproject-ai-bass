import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const notoSansThai = Noto_Sans_Thai({
    subsets: ["thai", "latin"],
    weight: ["300", "400", "500", "600", "700"],
    variable: "--font-noto-thai",
});

export const metadata: Metadata = {
    title: "Referee-GPT | ระบบถาม-ตอบกฎบาสเกตบอล",
    description:
        "ระบบ AI อัจฉริยะสำหรับถามตอบกฎบาสเกตบอลอย่างเป็นทางการ พร้อมอ้างอิงข้อกฎ",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th">
            <body className={`${notoSansThai.variable} font-sans antialiased`}>
                {/* Navigation */}
                <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
                    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2.5">
                            <span className="text-2xl">🏀</span>
                            <span className="font-bold text-white text-lg tracking-tight">
                                Referee<span className="text-orange-400">GPT</span>
                            </span>
                        </Link>
                        <div className="flex items-center gap-1">
                            <Link
                                href="/"
                                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-all duration-200"
                            >
                                💬 แชท
                            </Link>
                            <Link
                                href="/dashboard"
                                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-all duration-200"
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
