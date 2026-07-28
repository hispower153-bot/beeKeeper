import "./globals.css";

export const metadata = {
  title: "양봉일지",
  description: "벌통 · 여왕벌 · 투약 · 채밀 기록 관리",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
