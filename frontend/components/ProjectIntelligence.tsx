"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  FileText,
  FolderGit2,
  History,
  Lightbulb,
  Lock,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { AnalysisHistoryItem, ProjectDocument, ReadinessReport, Severity } from "@/types";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "pitch_deck", label: "Pitch deck" },
  { value: "business_plan", label: "Business plan" },
  { value: "market_research", label: "Market research" },
  { value: "financial_model", label: "Financial model" },
  { value: "product_demo", label: "Product / demo material" },
  { value: "supporting_document", label: "Supporting document" },
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const ACCEPT = ".pdf,.pptx,.docx,.txt,.md,.csv,.png,.jpg,.jpeg";

const SEVERITY_STYLE: Record<Severity, string> = {
  high: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  medium: "bg-[#FFF7ED] text-[#9A3412] border-[#FED7AA]",
  low: "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#94A3B8";
  if (score >= 85) return "#2E7D52";
  if (score >= 70) return "#1B3B6F";
  if (score >= 50) return "#B45309";
  return "#B91C1C";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-subtle ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider font-display flex items-center gap-2">
      {icon}
      {children}
    </h3>
  );
}

/** Founder-only: upload project materials and run the private investment-readiness analysis. */
export function ProjectIntelligence({
  projectId,
  onScoreChange,
}: {
  projectId: number;
  onScoreChange?: (score: number) => void;
}) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [category, setCategory] = useState("pitch_deck");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getProjectDocuments(projectId),
      api.getReadinessReport(projectId),
      api.getProjectAnalyses(projectId),
    ])
      .then(([docs, rep, hist]) => {
        if (!active) return;
        setDocuments(docs);
        setReport(rep);
        setHistory(hist);
        setLoadError(null);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Could not load project intelligence.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const doc = await api.uploadProjectDocument(projectId, file, category);
        setDocuments((prev) => [...prev, doc]);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDelete = async (doc: ProjectDocument) => {
    if (!window.confirm(`Remove "${doc.original_name}" from this project?`)) return;
    try {
      await api.deleteProjectDocument(projectId, doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not remove the document.");
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const rep = await api.analyzeProject(projectId);
      setReport(rep);
      onScoreChange?.(rep.readiness_score);
      setHistory(await api.getProjectAnalyses(projectId));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "The analysis could not be completed.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <Card><p className="text-xs text-[#64748B]">Loading project intelligence…</p></Card>;
  }
  if (loadError) {
    return (
      <Card>
        <p role="alert" className="text-xs text-[#B91C1C]">{loadError}</p>
      </Card>
    );
  }

  const github = report?.inputs?.github;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ Materials */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle icon={<FileText className="w-4 h-4 text-[#64748B]" />}>Project Materials</SectionTitle>
            <p className="text-xs text-[#64748B] mt-1">
              Everything you already have. The analysis reads all of it together.
            </p>
          </div>
          <span className="text-[11px] text-[#1B3B6F] flex items-center gap-1">
            <Lock className="w-3 h-3" /> Private until you publish
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            aria-label="Document type"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-[#FAFBFD] border border-[#E2E8F0] rounded-lg text-[#0F172A] text-xs"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            ref={fileInput}
            id="project-material-input"
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <label
            htmlFor="project-material-input"
            aria-disabled={uploading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              uploading
                ? "bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0] pointer-events-none"
                : "bg-white text-[#1B3B6F] border-[#BFD7EE] hover:bg-[#EBF2FA] cursor-pointer"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Uploading…" : "Upload files"}
          </label>
          <span className="text-[10px] text-[#94A3B8]">PDF, PPTX, DOCX, TXT, MD, CSV, PNG, JPG · up to 25 MB each</span>
        </div>

        {uploadError && (
          <p role="alert" className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {uploadError}
          </p>
        )}

        {documents.length === 0 ? (
          <p className="text-xs text-[#64748B] bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-lg px-4 py-6 text-center">
            No materials yet. Start with your pitch deck, then add your business plan, market research or anything else
            investors would ask for.
          </p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-lg">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#0F172A] truncate">{doc.original_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]">
                      {CATEGORY_LABEL[doc.category] ?? doc.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {formatBytes(doc.size_bytes)}
                    {doc.page_count ? ` · ${doc.page_count} page${doc.page_count === 1 ? "" : "s"}` : ""}
                    {doc.text_chars > 0 ? ` · ${doc.text_chars.toLocaleString()} characters of text` : ""}
                    {doc.extraction_note ? ` · ${doc.extraction_note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => api.downloadProjectDocument(doc).catch((e) => setUploadError(e.message))}
                    className="p-1.5 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
                    aria-label={`Download ${doc.original_name}`}
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded text-[#64748B] hover:text-[#B91C1C] hover:bg-[#FEF2F2]"
                    aria-label={`Remove ${doc.original_name}`}
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ------------------------------------------------------------ Analysis */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle icon={<Sparkles className="w-4 h-4 text-[#1B3B6F]" />}>AI Readiness Analysis</SectionTitle>
            <p className="text-xs text-[#64748B] mt-1">
              Reads your profile, materials, GitHub repository and links together. Only you can see this.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-[#1B3B6F] hover:bg-[#142C54] shadow-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait"
          >
            {analyzing ? <Cpu className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {analyzing ? "Analyzing…" : report?.analyzed_at ? "Re-analyze" : "Run Analysis"}
          </button>
        </div>

        {analyzing && (
          <p className="text-xs text-[#1B3B6F] bg-[#EBF2FA] border border-[#BFD7EE] rounded-lg px-3 py-2">
            Reading your materials and repository. An AI analysis usually takes one to two minutes.
          </p>
        )}
        {analyzeError && (
          <p role="alert" className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {analyzeError}
          </p>
        )}

        {!report || !report.analyzed_at ? (
          <p className="text-xs text-[#64748B] bg-[#F8FAFC] border border-dashed border-[#CBD5E1] rounded-lg px-4 py-6 text-center">
            No analysis yet. Upload your materials, then run the analysis to get your readiness score, gaps and
            improvement suggestions.
          </p>
        ) : (
          <>
            {/* Score header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold font-display" style={{ color: scoreColor(report.readiness_score) }}>
                  {report.readiness_score.toFixed(0)}
                </span>
                <span className="text-sm text-[#64748B]">/ 100</span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-[#0F172A]">{report.status_label}</p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                  {report.is_ai_generated ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#EBF2FA] text-[#1B3B6F] border border-[#BFD7EE]">
                      {report.model_version}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#9A3412] border border-[#FED7AA]">
                      Rule-based check · AI analysis not configured
                    </span>
                  )}
                  {report.analyzed_at && <span>Analyzed {new Date(report.analyzed_at).toLocaleString()}</span>}
                </div>
              </div>
            </div>

            {report.summary && <p className="text-xs sm:text-sm text-[#334155] leading-relaxed">{report.summary}</p>}

            {/* Dimensions */}
            <div className="space-y-3">
              {report.dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">{d.name}</span>
                    <span className="font-mono font-semibold" style={{ color: scoreColor(d.score) }}>
                      {d.score == null ? "—" : d.score.toFixed(0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden" aria-hidden>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.score ?? 0}%`, backgroundColor: scoreColor(d.score) }}
                    />
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">{d.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D52]" /> Strengths
                </h4>
                <ul className="space-y-1.5">
                  {report.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-[#334155] leading-relaxed pl-3 border-l-2 border-[#C8E6C9]">{s}</li>
                  ))}
                </ul>
              </div>

              {/* Gaps */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" /> Missing or weak areas
                </h4>
                {report.gaps.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No major gaps found.</p>
                ) : (
                  <ul className="space-y-2">
                    {report.gaps.map((g, i) => (
                      <li key={i} className="text-xs text-[#334155] leading-relaxed">
                        <span className={`inline-block mr-1.5 px-1.5 py-px rounded border text-[10px] font-semibold uppercase ${SEVERITY_STYLE[g.severity]}`}>
                          {g.severity}
                        </span>
                        <span className="font-semibold text-[#0F172A]">{g.area}:</span> {g.issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Suggestions */}
            {report.suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-[#1B3B6F]" /> What to improve before you publish
                </h4>
                <ol className="space-y-2">
                  {report.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-[#FAFBFD]">
                      <span className="text-xs font-mono font-bold text-[#94A3B8]">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[#0F172A]">{s.title}</span>
                          <span className={`px-1.5 py-px rounded border text-[10px] font-semibold uppercase ${SEVERITY_STYLE[s.priority]}`}>
                            {s.priority}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">{s.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Industry insights */}
            {report.industry_insights.length > 0 && (
              <div className="p-4 rounded-lg bg-[#EBF2FA] border border-[#BFD7EE] space-y-1.5">
                <h4 className="text-xs font-bold text-[#1B3B6F]">Industry insights</h4>
                <ul className="list-disc pl-4 space-y-1">
                  {report.industry_insights.map((t, i) => (
                    <li key={i} className="text-xs text-[#18345D] leading-relaxed">{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* What the analysis used */}
            {report.inputs && (
              <div className="text-[11px] text-[#64748B] space-y-1 pt-3 border-t border-[#E2E8F0]">
                <p>
                  <span className="font-semibold text-[#0F172A]">Analyzed:</span>{" "}
                  {report.inputs.documents.length > 0
                    ? report.inputs.documents.map((d) => d.name).join(", ")
                    : "no uploaded materials"}
                  {report.inputs.demo_url ? " · demo link" : ""}
                </p>
                {github && (
                  <p className="flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3" />
                    {github.ok ? `Repository ${github.full_name} read` : `Repository not read: ${github.error}`}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* History */}
        {history.length > 1 && (
          <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
            <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#64748B]" /> Progress
            </h4>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-[11px] text-[#475569]">
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span className="text-[#94A3B8]">{h.engine === "claude" ? "AI" : "Rule-based"}</span>
                  <span className="font-mono font-semibold" style={{ color: scoreColor(h.overall_score) }}>
                    {h.overall_score.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
