'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Printer, Loader2, BookOpen } from 'lucide-react';

export default function SistemaPage() {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/v1/system-doc/markdown`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        setMarkdown(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Error cargando documento');
        setLoading(false);
      });
  }, []);

  const handleDownloadMd = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    window.location.href = `${apiUrl}/api/v1/system-doc/markdown?download=1`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 no-print">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7" />
            Aremko-CLI Sistema Completo
          </h2>
          <p className="text-muted-foreground">
            Snapshot funcional y técnico del sistema, generado en vivo desde el código actual.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleDownloadMd} disabled={loading || !!error}>
            <Download className="h-4 w-4 mr-2" />
            Descargar .md
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={loading || !!error}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3 py-12 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            <span className="text-gray-600">Cargando documento…</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200">
          <CardContent className="py-8 text-center">
            <p className="text-red-700 font-medium">Error: {error}</p>
            <p className="text-sm text-gray-500 mt-1">Reintenta más tarde o revisa el deploy del backend.</p>
          </CardContent>
        </Card>
      )}

      {markdown && (
        <Card data-system-doc>
          <CardContent className="p-6 md:p-10">
            <div className="system-doc-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      <style jsx global>{`
        .system-doc-prose {
          color: #111827;
          font-size: 14px;
          line-height: 1.65;
          max-width: 80ch;
          margin: 0 auto;
        }
        .system-doc-prose h1 {
          font-size: 28px;
          font-weight: 700;
          margin-top: 32px;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
          color: #111827;
        }
        .system-doc-prose h1:first-child {
          margin-top: 0;
        }
        .system-doc-prose h2 {
          font-size: 22px;
          font-weight: 700;
          margin-top: 28px;
          margin-bottom: 12px;
          color: #1f2937;
        }
        .system-doc-prose h3 {
          font-size: 18px;
          font-weight: 600;
          margin-top: 24px;
          margin-bottom: 10px;
          color: #374151;
        }
        .system-doc-prose p {
          margin-bottom: 14px;
        }
        .system-doc-prose strong {
          font-weight: 600;
          color: #111827;
        }
        .system-doc-prose ul, .system-doc-prose ol {
          margin-bottom: 14px;
          padding-left: 24px;
          list-style-position: outside;
        }
        .system-doc-prose ul { list-style-type: disc; }
        .system-doc-prose ol { list-style-type: decimal; }
        .system-doc-prose li { margin-bottom: 4px; }
        .system-doc-prose code {
          background: #f3f4f6;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.875em;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #be185d;
        }
        .system-doc-prose pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 16px 0;
          font-size: 12px;
        }
        .system-doc-prose pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .system-doc-prose table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13px;
        }
        .system-doc-prose th, .system-doc-prose td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
        }
        .system-doc-prose th {
          background: #f9fafb;
          font-weight: 600;
        }
        .system-doc-prose hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 24px 0;
        }
        .system-doc-prose em { font-style: italic; color: #6b7280; }
        .system-doc-prose a { color: #2563eb; text-decoration: underline; }

        @media print {
          [data-system-doc] {
            box-shadow: none !important;
            border: none !important;
          }
          .system-doc-prose {
            max-width: 100% !important;
            font-size: 11pt;
          }
          .system-doc-prose h1, .system-doc-prose h2, .system-doc-prose h3 {
            break-after: avoid-page;
            page-break-after: avoid;
          }
          .system-doc-prose pre, .system-doc-prose table {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
