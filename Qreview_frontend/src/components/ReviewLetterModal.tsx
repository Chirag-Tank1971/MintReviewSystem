import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, FileDown, Award, Loader2, Check } from 'lucide-react';
import { EmployeeReview } from '../types';
import { generateReviewLetterHtml, downloadReviewLetterPdf } from '../utils/reviewLetterExport';
import { DEFAULT_LETTER_SETTINGS } from '../utils/letterExport';
import { useModalAnimation } from '../hooks/useModalAnimation';

interface ReviewLetterModalProps {
  review: EmployeeReview;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Read-only "all details in one" letter for a finalized (CLOSED) quarterly review —
 * Manager score, HOD score, averaged final score, full KRA breakdown, and every growth/
 * feedback field. Rendered once as HTML and reused identically for the on-screen preview
 * (iframe), Print, Download PDF, and Download HTML, so what you see is exactly what you get.
 */
export const ReviewLetterModal: React.FC<ReviewLetterModalProps> = ({ review, isOpen, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadPdfSuccess, setDownloadPdfSuccess] = useState(false);
  const [downloadHtmlSuccess, setDownloadHtmlSuccess] = useState(false);

  const { isMounted, handleClose, backdropClass, cardClass } =
    useModalAnimation({ isOpen, onClose });

  const htmlContent = useMemo(() => generateReviewLetterHtml(review, DEFAULT_LETTER_SETTINGS), [review]);

  useEffect(() => {
    if (!isMounted) return;
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = origOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, handleClose]);

  if (!isMounted) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    try {
      const win = iframeRef.current?.contentWindow;
      if (win) {
        win.focus();
        win.print();
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Print failed, falling back to window.print():', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadReviewLetterPdf(review);
      setDownloadPdfSuccess(true);
      setTimeout(() => setDownloadPdfSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
      handlePrint();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quarterly_Review_Letter_${review.employeeCode}_${review.reviewPeriodName.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadHtmlSuccess(true);
    setTimeout(() => setDownloadHtmlSuccess(false), 3000);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[9997] overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 ${backdropClass}`}
    >
      <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[92vh] ${cardClass}`}>
        {/* Toolbar */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shadow-md shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30 text-indigo-300">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block text-white">Quarterly Review Letter</span>
              <span className="text-[11px] text-slate-300">{review.employeeName} • {review.reviewPeriodName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50"
              title="Download crisp vector PDF (.pdf)"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : downloadPdfSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloadPdfSuccess ? 'PDF Ready!' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-medium rounded-lg transition-colors border border-white/10 cursor-pointer"
              title="Download standalone HTML"
            >
              {downloadHtmlSuccess ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>HTML</span>
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium rounded-lg transition-colors border border-slate-700 cursor-pointer"
            >
              {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 cursor-pointer"
              title="Close Letter"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Letter preview — identical HTML to Print/PDF/HTML export */}
        <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title="Quarterly Review Letter"
            className="w-full border-0 bg-white"
            style={{ height: '75vh' }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
