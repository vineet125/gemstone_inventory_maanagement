import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GemStock — Semi-Precious Stone Management",
  description: "Inventory, manufacturing, and sales management for semi-precious stones",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  try {
    var themes={amber:"30 80% 45%",blue:"217 91% 45%",green:"142 76% 36%",purple:"270 70% 50%",rose:"346 84% 46%",teal:"173 80% 36%",indigo:"239 84% 55%"};
    var darkThemes={amber:"30 80% 55%",blue:"217 91% 60%",green:"142 76% 50%",purple:"270 70% 65%",rose:"346 84% 60%",teal:"173 80% 50%",indigo:"239 84% 68%"};
    var color=localStorage.getItem("gs-color")||"amber";
    var mode=localStorage.getItem("gs-mode")||"light";
    var primary=mode==="dark"?darkThemes[color]:themes[color];
    if(primary){document.documentElement.style.setProperty("--primary",primary);document.documentElement.style.setProperty("--ring",primary);}
    if(mode==="dark")document.documentElement.classList.add("dark");
  }catch(e){}
})();
        `}} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
