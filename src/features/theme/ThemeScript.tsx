import Script from "next/script";

export const THEME_STORAGE_KEY = "founderos-theme";

export function ThemeScript() {
  return (
    <Script id="founderos-theme-init" strategy="beforeInteractive">
      {`(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},t=localStorage.getItem(k)||'dark',h=document.documentElement;if(t==='light'){h.classList.remove('dark');}else{h.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`}
    </Script>
  );
}
