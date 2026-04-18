"use client";

import React, { useEffect, useRef, memo } from 'react';
import 'katex/dist/katex.min.css';
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render';

interface MathTextProps {
  text: string;
  className?: string;
}

const MathText = memo(function MathText({ text, className = "" }: MathTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastProcessedText = useRef<string>("");

  // Pre-process text to wrap common math patterns (like x^2) in $ if they aren't already wrapped.
  const processedText = React.useMemo(() => {
    if (!text) return "";
    // Regex to find exponents like x^2, (x+1)^2, a^b that aren't already preceded by $
    // We target common patterns: [word or brackets]^[word or brackets]
    return text.replace(/(?<![\$])(\b[a-zA-Z0-9]+\^\{?[a-zA-Z0-9]+\}?|\([^\$]+\)\^\{?[a-zA-Z0-9]+\}?)(?![\$])/g, (match) => {
      return `$${match}$`;
    });
  }, [text]);

  useEffect(() => {
    if (containerRef.current && processedText !== lastProcessedText.current) {
      console.log(`[MathText] Rendering Math for: "${processedText.substring(0, 30)}..."`);
      
      const timer = setTimeout(() => {
        if (!containerRef.current) return;
        try {
          renderMathInElement(containerRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\begin{equation}', right: '\\end{equation}', display: true },
              { left: '\\begin{align}', right: '\\end{align}', display: true },
              { left: '\\begin{alignat}', right: '\\end{alignat}', display: true },
              { left: '\\begin{gather}', right: '\\end{gather}', display: true },
              { left: '\\begin{CD}', right: '\\end{CD}', display: true },
            ],
            throwOnError: false,
            trust: true,
            strict: false,
            ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
          });
          lastProcessedText.current = processedText;
          console.log(`[MathText] Successfully rendered processed text`);
        } catch (err) {
          console.error("[MathText] Render Error:", err, "for text:", text);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [processedText, text]);

  if (!text) return null;

  return (
    <div 
      ref={containerRef}
      className={`math-text-container ${className}`}
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
});

export default MathText;
