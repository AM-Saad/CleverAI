export function useExportContent() {
  const exportContent = async (title: string, content: string, format: 'txt' | 'doc' | 'pdf') => {
    const cleanTitle = (title || 'export').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    
    const createBlobAndDownload = (data: Array<any>, type: string, extension: string) => {
      const blob = new Blob(data, { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanTitle}.${extension}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };

    // Strip HTML for basic txt export where possible, or just raw if it's plain text.
    // Content is largely raw text based on our component views (e.g. whitespace-pre-wrap paragraph).
    const rawText = content;
    const cleanHtml = content.replace(/\n/g, '<br>');

    if (format === 'txt') {
      createBlobAndDownload([rawText], 'text/plain;charset=utf-8', 'txt');
    } else if (format === 'doc') {
      const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${cleanTitle}</title></head><body>`;
      const postHtml = "</body></html>";
      const html = preHtml + cleanHtml + postHtml;
      createBlobAndDownload(['\ufeff', html], 'application/msword;charset=utf-8', 'doc');
    } else if (format === 'pdf') {
      // Dynamic load html2pdf if not available
      if (!(window as any).html2pdf) {
        try {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load html2pdf.js'));
            document.head.appendChild(script);
          });
        } catch (e) {
          console.error(e);
          alert('Could not load PDF generation library. Please ensure you have an internet connection.');
          return;
        }
      }

      const element = document.createElement('div');
      element.innerHTML = cleanHtml;
      element.style.padding = '20px';
      element.style.fontFamily = 'sans-serif';
      
      const opt = {
        margin:       1,
        filename:     `${cleanTitle}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      (window as any).html2pdf().set(opt).from(element).save();
    }
  };

  return {
    exportContent
  };
}
