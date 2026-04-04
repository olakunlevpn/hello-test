"use client";

import { useState } from "react";
import {
  KeyRound,
  Link,
  Globe,
  Search,
  Shield,
  Binary,
  FileJson,
  Hash,
  Lock,
  FileCode,
  MessageCircle,
  FileText,
  Type,
  Wrench,
  Menu,
  X,
  ShieldCheck,
  Fingerprint,
  KeySquare,
  ScanEye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import {
  PasswordGenerator,
  UtmGenerator,
  SlugGenerator,
  WhatsappLink,
  DnsLookup,
  WhoisLookup,
  SslLookup,
  Base64Tool,
  UrlEncodeTool,
  MarkdownToHtml,
  HtmlStripper,
  JsonValidator,
  PasswordChecker,
  CharCounter,
  AesEncrypt,
  HashGenerator,
  RsaKeypair,
  JwtDecoder,
  JsObfuscator,
} from "@/components/tools/ToolComponents";

interface Tool {
  id: string;
  label: TranslationKey;
  desc: TranslationKey;
  icon: typeof KeyRound;
  category: TranslationKey;
}

const tools: Tool[] = [
  { id: "password-generator", label: "toolPasswordGenerator", desc: "toolPasswordGeneratorDesc", icon: KeyRound, category: "toolCategoryGenerators" },
  { id: "utm-generator", label: "toolUtmGenerator", desc: "toolUtmGeneratorDesc", icon: Link, category: "toolCategoryGenerators" },
  { id: "slug-generator", label: "toolSlugGenerator", desc: "toolSlugGeneratorDesc", icon: Hash, category: "toolCategoryGenerators" },
  { id: "whatsapp-link", label: "toolWhatsappLink", desc: "toolWhatsappLinkDesc", icon: MessageCircle, category: "toolCategoryGenerators" },
  { id: "dns-lookup", label: "toolDnsLookup", desc: "toolDnsLookupDesc", icon: Globe, category: "toolCategoryLookups" },
  { id: "whois-lookup", label: "toolWhoisLookup", desc: "toolWhoisLookupDesc", icon: Search, category: "toolCategoryLookups" },
  { id: "ssl-lookup", label: "toolSslLookup", desc: "toolSslLookupDesc", icon: Shield, category: "toolCategoryLookups" },
  { id: "base64", label: "toolBase64", desc: "toolBase64Desc", icon: Binary, category: "toolCategoryConverters" },
  { id: "url-encode", label: "toolUrlEncode", desc: "toolUrlEncodeDesc", icon: Link, category: "toolCategoryConverters" },
  { id: "markdown-to-html", label: "toolMarkdownToHtml", desc: "toolMarkdownToHtmlDesc", icon: FileCode, category: "toolCategoryConverters" },
  { id: "html-stripper", label: "toolHtmlStripper", desc: "toolHtmlStripperDesc", icon: FileText, category: "toolCategoryConverters" },
  { id: "json-validator", label: "toolJsonValidator", desc: "toolJsonValidatorDesc", icon: FileJson, category: "toolCategoryValidators" },
  { id: "password-checker", label: "toolPasswordChecker", desc: "toolPasswordCheckerDesc", icon: Lock, category: "toolCategoryValidators" },
  { id: "char-counter", label: "toolCharCounter", desc: "toolCharCounterDesc", icon: Type, category: "toolCategoryValidators" },
  // Encryption
  { id: "aes-encrypt", label: "toolAesEncrypt", desc: "toolAesEncryptDesc", icon: ShieldCheck, category: "toolCategoryEncryption" },
  { id: "hash-generator", label: "toolHashGenerator", desc: "toolHashGeneratorDesc", icon: Fingerprint, category: "toolCategoryEncryption" },
  { id: "rsa-keypair", label: "toolRsaKeypair", desc: "toolRsaKeypairDesc", icon: KeySquare, category: "toolCategoryEncryption" },
  { id: "jwt-decoder", label: "toolJwtDecoder", desc: "toolJwtDecoderDesc", icon: ScanEye, category: "toolCategoryEncryption" },
  { id: "js-obfuscator", label: "toolJsObfuscator", desc: "toolJsObfuscatorDesc", icon: Shield, category: "toolCategoryEncryption" },
];

const categories = Array.from(new Set(tools.map((tl) => tl.category)));

const toolComponentMap: Record<string, React.ComponentType> = {
  "password-generator": PasswordGenerator,
  "utm-generator": UtmGenerator,
  "slug-generator": SlugGenerator,
  "whatsapp-link": WhatsappLink,
  "dns-lookup": DnsLookup,
  "whois-lookup": WhoisLookup,
  "ssl-lookup": SslLookup,
  "base64": Base64Tool,
  "url-encode": UrlEncodeTool,
  "markdown-to-html": MarkdownToHtml,
  "html-stripper": HtmlStripper,
  "json-validator": JsonValidator,
  "password-checker": PasswordChecker,
  "char-counter": CharCounter,
  "aes-encrypt": AesEncrypt,
  "hash-generator": HashGenerator,
  "rsa-keypair": RsaKeypair,
  "jwt-decoder": JwtDecoder,
  "js-obfuscator": JsObfuscator,
};

export default function ToolboxPage() {
  const [activeTool, setActiveTool] = useState("password-generator");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const active = tools.find((tl) => tl.id === activeTool);
  const ToolComponent = activeTool !== "invitations" ? toolComponentMap[activeTool] : null;

  const handleSelectTool = (id: string) => {
    setActiveTool(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-lg border border-border overflow-hidden">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden absolute top-2 left-2 z-10 p-2 rounded-md bg-card border border-border"
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Inner Sidebar */}
      <div className={cn(
        "w-56 flex-shrink-0 border-r border-border bg-card overflow-y-auto",
        "fixed z-40 h-full md:relative md:z-auto",
        "transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">{t("toolbox")}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="py-2">
          {categories.map((cat) => (
            <div key={cat} className="mb-3">
              <div className="px-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {t(cat)}
              </div>
              {tools
                .filter((tl) => tl.category === cat)
                .map((tl) => {
                  const Icon = tl.icon;
                  const isActive = activeTool === tl.id;
                  return (
                    <button
                      key={tl.id}
                      onClick={() => handleSelectTool(tl.id)}
                      className={cn(
                        "flex items-center gap-2 w-full px-4 py-1.5 text-xs font-medium transition-colors text-left",
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      {t(tl.label)}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {active && (
          <div>
            <div className="flex items-center gap-3 mb-6 ml-8 md:ml-0">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <active.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{t(active.label)}</h2>
                <p className="text-xs text-muted-foreground">{t(active.desc)}</p>
              </div>
            </div>

            {ToolComponent ? <ToolComponent /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
