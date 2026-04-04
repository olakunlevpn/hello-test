"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { t } from "@/i18n";

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const resultClass = "w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono text-foreground min-h-[100px] resize-y";

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  toast.success(t("copied"));
}

/* ─── Password Generator ─────────────────────────── */
export function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [upper, setUpper] = useState(true);
  const [lower, setLower] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [result, setResult] = useState("");

  const generate = () => {
    let chars = "";
    if (upper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (lower) chars += "abcdefghijklmnopqrstuvwxyz";
    if (numbers) chars += "0123456789";
    if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";
    if (!chars) return;
    let pw = "";
    for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setResult(pw);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium w-16">Length</label>
        <Input type="number" min={4} max={128} value={length} onChange={(e) => setLength(+e.target.value)} className="w-24" />
      </div>
      <div className="flex flex-wrap gap-3">
        {[
          { label: "A-Z", val: upper, set: setUpper },
          { label: "a-z", val: lower, set: setLower },
          { label: "0-9", val: numbers, set: setNumbers },
          { label: "!@#$", val: symbols, set: setSymbols },
        ].map((o) => (
          <label key={o.label} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={o.val} onChange={() => o.set(!o.val)} className="accent-primary" />
            {o.label}
          </label>
        ))}
      </div>
      <Button onClick={generate}><RefreshCw className="mr-1 h-3 w-3" /> Generate</Button>
      {result && (
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-lg font-mono break-all">{result}</code>
          <Button variant="outline" size="sm" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── UTM Link Builder ────────────────────────────── */
export function UtmGenerator() {
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("");

  const buildUrl = () => {
    if (!url) return "";
    const params = new URLSearchParams();
    if (source) params.set("utm_source", source);
    if (medium) params.set("utm_medium", medium);
    if (campaign) params.set("utm_campaign", campaign);
    if (term) params.set("utm_term", term);
    if (content) params.set("utm_content", content);
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${params.toString() ? sep + params.toString() : ""}`;
  };

  const result = buildUrl();

  return (
    <div className="space-y-3 max-w-lg">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" />
      <div className="grid grid-cols-2 gap-3">
        <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (e.g. google)" />
        <Input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="Medium (e.g. email)" />
        <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Campaign (e.g. spring)" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term (optional)" />
      </div>
      <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content (optional)" />
      {result && url && (
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono break-all">{result}</code>
          <Button variant="outline" size="sm" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── Slug Generator ──────────────────────────────── */
export function SlugGenerator() {
  const [input, setInput] = useState("");
  const slug = input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");

  return (
    <div className="space-y-3 max-w-lg">
      <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter text to slugify..." />
      {slug && (
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 font-mono">{slug}</code>
          <Button variant="outline" size="sm" onClick={() => copyText(slug)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── WhatsApp Link ───────────────────────────────── */
export function WhatsappLink() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const link = phone ? `https://wa.me/${phone.replace(/\D/g, "")}${message ? "?text=" + encodeURIComponent(message) : ""}` : "";

  return (
    <div className="space-y-3 max-w-lg">
      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (e.g. 14155552671)" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pre-filled message (optional)" rows={3} className={inputClass} />
      {link && (
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono break-all">{link}</code>
          <Button variant="outline" size="sm" onClick={() => copyText(link)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── DNS Lookup ──────────────────────────────────── */
export function DnsLookup() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tools/dns?domain=${encodeURIComponent(domain.trim())}`);
      if (res.ok) setResult(await res.json());
      else toast.error(t("error"));
    } catch { toast.error(t("error")); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex gap-2">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" onKeyDown={(e) => e.key === "Enter" && lookup()} />
        <Button onClick={lookup} disabled={loading}>{loading ? "..." : t("search")}</Button>
      </div>
      {result && (
        <div className="space-y-2">
          {Object.entries((result as any).records || {}).map(([type, records]) => (
            <div key={type} className="rounded-md border border-input p-3">
              <Badge variant="outline" className="mb-2">{type}</Badge>
              <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(records, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── WHOIS Lookup (client-side via API) ──────────── */
export function WhoisLookup() {
  const [domain, setDomain] = useState("");

  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex gap-2">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <Button onClick={() => window.open(`https://www.whois.com/whois/${encodeURIComponent(domain)}`, "_blank")}>
          {t("search")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Opens whois.com in a new tab</p>
    </div>
  );
}

/* ─── SSL Checker ─────────────────────────────────── */
export function SslLookup() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tools/ssl?domain=${encodeURIComponent(domain.trim())}`);
      if (res.ok) setResult(await res.json());
      else toast.error(t("error"));
    } catch { toast.error(t("error")); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex gap-2">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" onKeyDown={(e) => e.key === "Enter" && lookup()} />
        <Button onClick={lookup} disabled={loading}>{loading ? "..." : t("search")}</Button>
      </div>
      {result && !("error" in result) && (
        <div className="rounded-md border border-input p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge className={(result.valid as boolean) ? "bg-green-600" : "bg-destructive"}>
              {(result.valid as boolean) ? "Valid" : "Invalid"}
            </Badge>
            <span className="font-mono">{result.domain as string}</span>
          </div>
          {["issuer", "subject", "validFrom", "validTo", "protocol", "serialNumber"].map((k) => (
            result[k] ? <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-mono">{String(result[k])}</span></div> : null
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Base64 Encode/Decode ────────────────────────── */
export function Base64Tool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const result = (() => { try { return mode === "encode" ? btoa(input) : atob(input); } catch { return "Invalid input"; } })();

  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex gap-2">
        <Button variant={mode === "encode" ? "default" : "outline"} size="sm" onClick={() => setMode("encode")}>Encode</Button>
        <Button variant={mode === "decode" ? "default" : "outline"} size="sm" onClick={() => setMode("decode")}>Decode</Button>
      </div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === "encode" ? "Text to encode..." : "Base64 to decode..."} rows={4} className={inputClass} />
      {input && (
        <div className="relative">
          <textarea readOnly value={result} rows={4} className={resultClass} />
          <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── URL Encode/Decode ───────────────────────────── */
export function UrlEncodeTool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const result = (() => { try { return mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input); } catch { return "Invalid input"; } })();

  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex gap-2">
        <Button variant={mode === "encode" ? "default" : "outline"} size="sm" onClick={() => setMode("encode")}>Encode</Button>
        <Button variant={mode === "decode" ? "default" : "outline"} size="sm" onClick={() => setMode("decode")}>Decode</Button>
      </div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === "encode" ? "URL to encode..." : "Encoded URL to decode..."} rows={3} className={inputClass} />
      {input && (
        <div className="relative">
          <textarea readOnly value={result} rows={3} className={resultClass} />
          <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── Markdown to HTML ────────────────────────────── */
export function MarkdownToHtml() {
  const [input, setInput] = useState("");

  const convert = (md: string) => {
    return md
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/\n/g, "<br>");
  };

  const result = convert(input);

  return (
    <div className="space-y-3 max-w-2xl">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="# Heading\n**Bold** *Italic*\n- List item\n[Link](url)" rows={6} className={inputClass} />
      {input && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <textarea readOnly value={result} rows={6} className={resultClass} />
            <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
          </div>
          <div className="rounded-md border border-input p-3 prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      )}
    </div>
  );
}

/* ─── HTML Tag Remover ────────────────────────────── */
export function HtmlStripper() {
  const [input, setInput] = useState("");
  const result = input.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  return (
    <div className="space-y-3 max-w-lg">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste HTML here..." rows={5} className={inputClass} />
      {input && (
        <div className="relative">
          <textarea readOnly value={result} rows={5} className={resultClass} />
          <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
    </div>
  );
}

/* ─── JSON Validator ──────────────────────────────── */
export function JsonValidator() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ valid: boolean; formatted: string; error?: string } | null>(null);

  const validate = () => {
    try {
      const parsed = JSON.parse(input);
      setResult({ valid: true, formatted: JSON.stringify(parsed, null, 2) });
    } catch (e) {
      setResult({ valid: false, formatted: "", error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder='{"key": "value"}' rows={6} className={`${inputClass} font-mono`} />
      <Button onClick={validate}>Validate & Format</Button>
      {result && (
        <div>
          <Badge className={result.valid ? "bg-green-600 mb-2" : "bg-destructive mb-2"}>
            {result.valid ? "Valid JSON" : "Invalid JSON"}
          </Badge>
          {result.error && <p className="text-sm text-destructive">{result.error}</p>}
          {result.valid && (
            <div className="relative">
              <textarea readOnly value={result.formatted} rows={8} className={`${resultClass} font-mono`} />
              <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => copyText(result.formatted)}><Copy className="h-3 w-3" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Password Strength Checker ───────────────────── */
export function PasswordChecker() {
  const [pw, setPw] = useState("");

  const getStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-green-600"];
    return { score, label: labels[Math.min(score, 4)], color: colors[Math.min(score, 4)] };
  };

  const strength = pw ? getStrength(pw) : null;

  return (
    <div className="space-y-3 max-w-lg">
      <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter password to check..." />
      {strength && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full ${strength.color} transition-all`} style={{ width: `${(strength.score / 5) * 100}%` }} />
            </div>
            <Badge variant="outline">{strength.label}</Badge>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>{pw.length >= 8 ? "✓" : "✗"} At least 8 characters ({pw.length})</div>
            <div>{/[A-Z]/.test(pw) ? "✓" : "✗"} Uppercase letter</div>
            <div>{/[a-z]/.test(pw) ? "✓" : "✗"} Lowercase letter</div>
            <div>{/\d/.test(pw) ? "✓" : "✗"} Number</div>
            <div>{/[^a-zA-Z0-9]/.test(pw) ? "✓" : "✗"} Special character</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── AES Encrypt/Decrypt ─────────────────────────── */
export function AesEncrypt() {
  const [input, setInput] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [result, setResult] = useState("");
  const [processing, setProcessing] = useState(false);

  const deriveKey = async (pass: string, salt: Uint8Array) => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  };

  const handleEncrypt = async () => {
    if (!input || !passphrase) return;
    setProcessing(true);
    try {
      const enc = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(passphrase, salt);
      const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(input));
      const combined = new Uint8Array(salt.length + iv.length + new Uint8Array(encrypted).length);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);
      setResult(btoa(String.fromCharCode(...combined)));
    } catch { setResult("Encryption failed"); }
    finally { setProcessing(false); }
  };

  const handleDecrypt = async () => {
    if (!input || !passphrase) return;
    setProcessing(true);
    try {
      const raw = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
      const salt = raw.slice(0, 16);
      const iv = raw.slice(16, 28);
      const data = raw.slice(28);
      const key = await deriveKey(passphrase, salt);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
      setResult(new TextDecoder().decode(decrypted));
    } catch { setResult("Decryption failed — wrong passphrase or corrupted data"); }
    finally { setProcessing(false); }
  };

  return (
    <div className="space-y-3 max-w-lg">
      <div className="flex gap-2">
        <Button variant={mode === "encrypt" ? "default" : "outline"} size="sm" onClick={() => { setMode("encrypt"); setResult(""); }}>Encrypt</Button>
        <Button variant={mode === "decrypt" ? "default" : "outline"} size="sm" onClick={() => { setMode("decrypt"); setResult(""); }}>Decrypt</Button>
      </div>
      <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Passphrase (secret key)" />
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === "encrypt" ? "Text to encrypt..." : "Base64 ciphertext to decrypt..."} rows={5} className={inputClass} />
      <Button onClick={mode === "encrypt" ? handleEncrypt : handleDecrypt} disabled={processing || !input || !passphrase}>
        {processing ? "..." : mode === "encrypt" ? "Encrypt" : "Decrypt"}
      </Button>
      {result && (
        <div className="relative">
          <textarea readOnly value={result} rows={5} className={resultClass} />
          <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={() => copyText(result)}><Copy className="h-3 w-3" /></Button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">AES-256-GCM · PBKDF2 100K iterations · Random salt + IV · Client-side only</p>
    </div>
  );
}

/* ─── Hash Generator ──────────────────────────────── */
export function HashGenerator() {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<Record<string, string>>({});

  const generate = async () => {
    if (!input) return;
    const enc = new TextEncoder();
    const data = enc.encode(input);
    const results: Record<string, string> = {};
    for (const algo of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"]) {
      const hash = await crypto.subtle.digest(algo, data);
      results[algo] = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    setHashes(results);
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text to hash..." rows={3} className={inputClass} />
      <Button onClick={generate} disabled={!input}>Generate Hashes</Button>
      {Object.keys(hashes).length > 0 && (
        <div className="space-y-2">
          {Object.entries(hashes).map(([algo, hash]) => (
            <div key={algo} className="flex items-start gap-2">
              <Badge variant="outline" className="mt-1 w-20 justify-center flex-shrink-0">{algo}</Badge>
              <code className="flex-1 text-xs font-mono break-all rounded-md border border-input bg-muted/30 px-2 py-1.5">{hash}</code>
              <Button variant="outline" size="sm" onClick={() => copyText(hash)} className="flex-shrink-0"><Copy className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── RSA Key Pair Generator ──────────────────────── */
export function RsaKeypair() {
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
        true,
        ["encrypt", "decrypt"]
      );
      const pubExported = await crypto.subtle.exportKey("spki", keyPair.publicKey);
      const privExported = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
      const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      const formatPem = (b64: string, type: string) => {
        const lines = b64.match(/.{1,64}/g) || [];
        return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
      };
      setPublicKey(formatPem(toBase64(pubExported), "PUBLIC KEY"));
      setPrivateKey(formatPem(toBase64(privExported), "PRIVATE KEY"));
    } catch { toast.error(t("error")); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <Button onClick={generate} disabled={generating}>
        <RefreshCw className={`mr-1 h-3 w-3 ${generating ? "animate-spin" : ""}`} />
        {generating ? "Generating..." : "Generate 2048-bit RSA Key Pair"}
      </Button>
      {publicKey && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground">Public Key</label>
              <Button variant="outline" size="sm" onClick={() => copyText(publicKey)}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
            </div>
            <textarea readOnly value={publicKey} rows={6} className={`${resultClass} text-xs`} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-destructive">Private Key</label>
              <Button variant="outline" size="sm" onClick={() => copyText(privateKey)}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
            </div>
            <textarea readOnly value={privateKey} rows={8} className={`${resultClass} text-xs`} />
          </div>
          <p className="text-[10px] text-muted-foreground">RSA-2048 · OAEP · SHA-256 · Generated client-side — private key never leaves your browser</p>
        </>
      )}
    </div>
  );
}

/* ─── JWT Decoder ─────────────────────────────────── */
export function JwtDecoder() {
  const [token, setToken] = useState("");

  const decode = () => {
    if (!token.trim()) return null;
    try {
      const parts = token.trim().split(".");
      if (parts.length !== 3) return { error: "Invalid JWT — must have 3 parts separated by dots" };
      const decodeBase64 = (s: string) => {
        const padded = s.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(padded));
      };
      const header = decodeBase64(parts[0]);
      const payload = decodeBase64(parts[1]);
      const exp = payload.exp ? new Date(payload.exp * 1000) : null;
      const iat = payload.iat ? new Date(payload.iat * 1000) : null;
      const expired = exp ? exp < new Date() : false;
      return { header, payload, expired, exp, iat };
    } catch {
      return { error: "Failed to decode JWT" };
    }
  };

  const decoded = decode();

  return (
    <div className="space-y-3 max-w-2xl">
      <textarea value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste JWT token here (eyJhbG...)" rows={4} className={`${inputClass} font-mono text-xs`} />
      {decoded && !("error" in decoded) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{decoded.header.alg || "?"}</Badge>
            <Badge variant="outline">{decoded.header.typ || "JWT"}</Badge>
            {decoded.expired !== undefined && (
              <Badge className={decoded.expired ? "bg-destructive" : "bg-green-600"}>
                {decoded.expired ? "Expired" : "Valid"}
              </Badge>
            )}
            {decoded.exp && (
              <span className="text-xs text-muted-foreground">
                {decoded.expired ? "Expired" : "Expires"}: {decoded.exp.toLocaleString()}
              </span>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Header</label>
            <pre className="rounded-md border border-input bg-muted/30 p-3 text-xs font-mono overflow-x-auto">{JSON.stringify(decoded.header, null, 2)}</pre>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Payload</label>
            <pre className="rounded-md border border-input bg-muted/30 p-3 text-xs font-mono overflow-x-auto">{JSON.stringify(decoded.payload, null, 2)}</pre>
          </div>
        </div>
      )}
      {decoded && "error" in decoded && (
        <p className="text-sm text-destructive">{decoded.error}</p>
      )}
      <p className="text-[10px] text-muted-foreground">Decodes only — does NOT verify the signature. Client-side only.</p>
    </div>
  );
}

/* ─── JS Obfuscator ───────────────────────────────── */
export function JsObfuscator() {
  const [code, setCode] = useState("");
  const [preset, setPreset] = useState("medium");
  const [result, setResult] = useState("");
  const [stats, setStats] = useState<{ originalSize: number; obfuscatedSize: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleObfuscate = async () => {
    if (!code.trim()) return;
    setProcessing(true);
    setResult("");
    setStats(null);
    try {
      const res = await fetch("/api/tools/obfuscate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, preset }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data.obfuscated);
        setStats({ originalSize: data.originalSize, obfuscatedSize: data.obfuscatedSize });
      } else {
        const data = await res.json();
        toast.error(data.error || t("error"));
      }
    } catch { toast.error(t("error")); }
    finally { setProcessing(false); }
  };

  const presets = [
    { id: "low", label: "Low", desc: "String array, hex identifiers" },
    { id: "medium", label: "Medium", desc: "+ Control flow, dead code, self-defending" },
    { id: "high", label: "Maximum", desc: "+ RC4 encoding, debug protection, rename globals" },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Preset selector */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">Protection Level</label>
        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                preset === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <div className="font-semibold">{p.label}</div>
              <div className="text-[10px] mt-0.5 opacity-70">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">JavaScript Code</label>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={`// Paste your JavaScript code here\nfunction hello() {\n  console.log("Hello World");\n}`}
          rows={10}
          className={`${inputClass} font-mono text-xs`}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleObfuscate} disabled={processing || !code.trim()}>
          {processing ? "Obfuscating..." : "Obfuscate"}
        </Button>
        {stats && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Original: {(stats.originalSize / 1024).toFixed(1)}KB</span>
            <span>Obfuscated: {(stats.obfuscatedSize / 1024).toFixed(1)}KB</span>
            <span>Ratio: {((stats.obfuscatedSize / stats.originalSize) * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Output */}
      {result && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-muted-foreground">Obfuscated Output</label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(result)}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
              <Button variant="outline" size="sm" onClick={() => {
                const blob = new Blob([result], { type: "text/javascript" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "obfuscated.js";
                document.body.appendChild(a); a.click();
                document.body.removeChild(a); URL.revokeObjectURL(url);
              }}>Download .js</Button>
            </div>
          </div>
          <textarea readOnly value={result} rows={12} className={`${resultClass} text-xs font-mono`} />
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/20 p-3 text-[10px] text-muted-foreground space-y-1">
        <div className="font-semibold">Protection Features by Level:</div>
        <div><strong>Low:</strong> String array encoding, hex identifiers, string shuffle/rotate</div>
        <div><strong>Medium:</strong> + Control flow flattening, dead code injection, self-defending, string splitting, Base64 encoding, console disable</div>
        <div><strong>Maximum:</strong> + RC4 string encoding, debug protection (anti-debugger), rename globals, unicode escape, max dead code injection</div>
      </div>
    </div>
  );
}

/* ─── Character Counter ───────────────────────────── */
export function CharCounter() {
  const [input, setInput] = useState("");
  const chars = input.length;
  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const lines = input ? input.split("\n").length : 0;
  const sentences = input.trim() ? input.split(/[.!?]+/).filter(Boolean).length : 0;

  return (
    <div className="space-y-3 max-w-lg">
      <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type or paste text here..." rows={6} className={inputClass} />
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Characters", value: chars },
          { label: "Words", value: words },
          { label: "Lines", value: lines },
          { label: "Sentences", value: sentences },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-input p-3 text-center">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
