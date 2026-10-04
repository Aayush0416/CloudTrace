import { useEffect, useRef } from "react";

/** Google Identity Services button. The returned credential is an ID token that the backend verifies. */
export default function GoogleButton({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (c: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null),
    cb = useRef(onCredential);
  cb.current = onCredential;
  useEffect(() => {
    const init = () => {
      const g = (window as any).google;
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (r: { credential: string }) => cb.current(r.credential),
      });
      g.accounts.id.renderButton(box.current, {
        theme: "filled_black",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "rectangular",
      });
    };
    if ((window as any).google?.accounts) return init();
    let s = document.querySelector<HTMLScriptElement>("script[data-gsi]");
    if (!s) {
      s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.dataset.gsi = "1";
      document.head.appendChild(s);
    }
    s.addEventListener("load", init);
    return () => s!.removeEventListener("load", init);
  }, [clientId]);
  return <div ref={box} className="flex justify-center" />;
}
